/**
 * 数据保真校验引擎
 *
 * 把 industry-research skill 的「数据保真红线」落地为可执行的校验规则。
 * 规则分级：
 * - error：违反红线，报告导出前必须处理（缺来源、预测未标、口径缺失）
 * - warning：可能存在口径冲突或质量问题（同指标多口径、C级来源孤证、链接失效）
 * - info：提示性建议（样本量未注明、预测缺机构年份）
 */

import type { DataPoint, Project, Source, ValidationIssue } from "./types";
import { DIMENSION_LABELS } from "./types";

interface ValidationInput {
  project: Project;
  dataPoints: DataPoint[];
  sources: Source[];
}

/** 单条数据点校验 */
export function validateDataPoint(
  dp: DataPoint,
  sourceMap: Map<string, Source>
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // 红线 1：来源必填且必须存在
  if (!dp.sourceId) {
    issues.push({
      level: "error",
      rule: "missing-source",
      message: `「${dp.metric}」缺少来源——每个数据都必须可追溯到来源`,
      dataPointId: dp.id,
    });
  } else {
    const src = sourceMap.get(dp.sourceId);
    if (!src) {
      issues.push({
        level: "error",
        rule: "dangling-source",
        message: `「${dp.metric}」引用的来源已不存在，请重新关联`,
        dataPointId: dp.id,
      });
    } else {
      if (src.linkStatus === "dead") {
        issues.push({
          level: "warning",
          rule: "dead-link",
          message: `「${dp.metric}」的来源「${src.name}」链接已失效，请核实或更换`,
          dataPointId: dp.id,
        });
      }
      if (src.tier === "C") {
        issues.push({
          level: "warning",
          rule: "tier-c-only",
          message: `「${dp.metric}」仅有 C 级来源（媒体线索），建议补充 A/B 级佐证`,
          dataPointId: dp.id,
        });
      }
    }
  }

  // 红线 2：数值型条目必须有数值和单位
  if (dp.kind !== "text") {
    if (dp.value === null || Number.isNaN(dp.value)) {
      issues.push({
        level: "error",
        rule: "missing-value",
        message: `「${dp.metric}」是数值型条目但缺少数值`,
        dataPointId: dp.id,
      });
    }
    if (!dp.unit.trim()) {
      issues.push({
        level: "error",
        rule: "missing-unit",
        message: `「${dp.metric}」缺少单位（亿元 / % / 亿人次…）`,
        dataPointId: dp.id,
      });
    }
  } else if (!dp.text?.trim()) {
    issues.push({
      level: "error",
      rule: "missing-text",
      message: `「${dp.metric}」是文本条目但内容为空`,
      dataPointId: dp.id,
    });
  }

  // 红线 3：口径必须显式声明
  if (!dp.scope.label.trim()) {
    issues.push({
      level: "error",
      rule: "missing-scope",
      message: `「${dp.metric}」缺少口径标签（如 GMV口径 / 支付口径 / MAU去重）`,
      dataPointId: dp.id,
    });
  }

  // 红线 4：预测值必须能识别机构与时间
  if (dp.forecast) {
    const src = dp.sourceId ? sourceMap.get(dp.sourceId) : undefined;
    if (src && !src.publishedAt) {
      issues.push({
        level: "info",
        rule: "forecast-no-date",
        message: `「${dp.metric}」为预测值，建议注明来源发布日期`,
        dataPointId: dp.id,
      });
    }
  }

  // 提示：调研类数据建议注明样本量
  if (dp.dimension === "consumer" && dp.kind !== "text" && !dp.note?.trim()) {
    issues.push({
      level: "info",
      rule: "survey-no-sample",
      message: `「${dp.metric}」属消费者维度，建议在备注注明样本量与调研方式`,
      dataPointId: dp.id,
    });
  }

  return issues;
}

/** 同指标口径冲突检测：同一 metric 出现多个不同口径标签 */
export function detectScopeConflicts(dataPoints: DataPoint[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const byMetric = new Map<string, DataPoint[]>();

  for (const dp of dataPoints) {
    if (dp.kind === "text") continue;
    const key = `${dp.dimension}::${dp.metric}`;
    const list = byMetric.get(key) ?? [];
    list.push(dp);
    byMetric.set(key, list);
  }

  for (const [key, list] of byMetric) {
    const scopes = new Set(list.map((d) => d.scope.label.trim()));
    if (scopes.size > 1) {
      const [, metric] = key.split("::");
      issues.push({
        level: "warning",
        rule: "scope-conflict",
        message: `「${metric}」存在 ${scopes.size} 种口径（${[...scopes].join(" / ")}），报告中需并列说明差异，不可混用`,
        dataPointId: list[0].id,
      });
    }
  }
  return issues;
}

/** 维度覆盖检查：启用的维度是否有数据 */
export function checkDimensionCoverage(
  project: Project,
  dataPoints: DataPoint[]
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const dim of project.dimensions) {
    const count = dataPoints.filter((d) => d.dimension === dim).length;
    if (count === 0) {
      issues.push({
        level: "info",
        rule: "dimension-empty",
        message: `维度「${DIMENSION_LABELS[dim]}」暂无数据点`,
      });
    }
  }
  return issues;
}

/** 全量校验入口 */
export function validateProject(input: ValidationInput): ValidationIssue[] {
  const sourceMap = new Map(input.sources.map((s) => [s.id, s]));
  const issues: ValidationIssue[] = [];

  for (const dp of input.dataPoints) {
    issues.push(...validateDataPoint(dp, sourceMap));
  }
  issues.push(...detectScopeConflicts(input.dataPoints));
  issues.push(...checkDimensionCoverage(input.project, input.dataPoints));

  // 排序：error > warning > info
  const order = { error: 0, warning: 1, info: 2 } as const;
  return issues.sort((a, b) => order[a.level] - order[b.level]);
}

/** 是否允许导出：存在 error 级问题时阻断 */
export function canExport(issues: ValidationIssue[]): boolean {
  return !issues.some((i) => i.level === "error");
}
