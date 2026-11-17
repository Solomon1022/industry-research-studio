/**
 * Markdown 报告导出
 *
 * 按 industry-research skill 的 report-template 结构生成报告。
 * 导出前必须通过 validateProject 的 error 级检查。
 */

import type { DataPoint, Dimension, Project, Source } from "../types";
import { DIMENSION_LABELS, METRIC_KIND_LABELS, SOURCE_TIER_LABELS } from "../types";

interface ExportInput {
  project: Project;
  dataPoints: DataPoint[];
  sources: Source[];
}

function escapePipes(s: string): string {
  return s.replace(/\|/g, "\\|");
}

function fmtValue(dp: DataPoint): string {
  if (dp.value === null) return "—";
  const num = dp.value.toLocaleString("zh-CN", { maximumFractionDigits: 2 });
  return `${num} ${dp.unit}`;
}

function fmtForecast(dp: DataPoint): string {
  return dp.forecast ? "（E）" : "";
}

function renderDataPointRow(dp: DataPoint, src?: Source): string {
  const cells = [
    dp.period,
    dp.metric + (dp.subject ? `（${dp.subject}）` : ""),
    fmtValue(dp) + fmtForecast(dp),
    dp.scope.label,
    src ? `${src.name}${src.publishedAt ? ` · ${src.publishedAt}` : ""}` : "⚠ 缺来源",
    dp.note ?? "",
  ];
  return `| ${cells.map(escapePipes).join(" | ")} |`;
}

function renderDimensionSection(
  dim: Dimension,
  points: DataPoint[],
  sourceMap: Map<string, Source>
): string {
  const lines: string[] = [];
  lines.push(`## ${DIMENSION_LABELS[dim]}`);
  lines.push("");

  const texts = points.filter((p) => p.kind === "text");
  const numerics = points.filter((p) => p.kind !== "text");

  if (numerics.length > 0) {
    lines.push("| 时间 | 指标 | 数值 | 口径 | 来源 | 备注 |");
    lines.push("| --- | --- | --- | --- | --- | --- |");
    const sorted = [...numerics].sort((a, b) => String(a.period).localeCompare(String(b.period)));
    for (const dp of sorted) {
      lines.push(renderDataPointRow(dp, dp.sourceId ? sourceMap.get(dp.sourceId) : undefined));
    }
    lines.push("");
  }

  for (const dp of texts) {
    const src = dp.sourceId ? sourceMap.get(dp.sourceId) : undefined;
    lines.push(`- **${dp.metric}**${dp.subject ? `（${dp.subject}）` : ""}：${dp.text ?? ""}`);
    lines.push(`  - 来源：${src ? `${src.name}${src.url ? `（${src.url}）` : ""}` : "⚠ 缺来源"}${dp.period ? ` · ${dp.period}` : ""}`);
    if (dp.note) lines.push(`  - 备注：${dp.note}`);
  }
  if (texts.length > 0) lines.push("");

  if (numerics.length === 0 && texts.length === 0) {
    lines.push("_本维度暂无数据。_");
    lines.push("");
  }

  return lines.join("\n");
}

function renderSourceList(sources: Source[]): string {
  const lines: string[] = [];
  lines.push("## 数据来源");
  lines.push("");
  const sorted = [...sources].sort((a, b) => a.tier.localeCompare(b.tier));
  for (const s of sorted) {
    const parts = [
      `**[${s.tier}]** ${s.name}`,
      `《${s.title}》`,
      s.publishedAt,
      s.url,
      s.linkStatus === "dead" ? "（链接已失效）" : "",
      s.note ? `备注：${s.note}` : "",
    ].filter(Boolean);
    lines.push(`- ${parts.join(" · ")}`);
  }
  lines.push("");
  lines.push(`> 分级说明：${SOURCE_TIER_LABELS.A}；${SOURCE_TIER_LABELS.B}；${SOURCE_TIER_LABELS.C}。关键结论建议以两个独立来源交叉验证。`);
  return lines.join("\n");
}

const DISCLAIMER = `## 免责声明

本报告基于公开数据二次整理与可视化，不构成投资建议。各机构统计口径存在差异（GMV/支付/收入、是否含退货与店播等），具体以原始报告为准；标注「E」的数值为机构预测，不代表实际结果。涉及政策与法律的内容以官方发布原文为准，本报告不构成法律意见。制作过程中未生成、修改或虚构任何原始统计数据。`;

/** 生成完整 Markdown 报告 */
export function exportMarkdown(input: ExportInput): string {
  const sourceMap = new Map(input.sources.map((s) => [s.id, s]));
  const lines: string[] = [];

  lines.push(`# ${input.project.name} · 行业背调报告`);
  lines.push("");
  lines.push(`- 行业边界：${input.project.industry}`);
  lines.push(`- 地域范围：${input.project.region}`);
  lines.push(`- 研究时段：${input.project.periodRange}`);
  lines.push(`- 生成时间：${new Date().toISOString().slice(0, 10)}`);
  if (input.project.note) lines.push(`- 说明：${input.project.note}`);
  lines.push("");
  lines.push("> 口径与标注约定：数值含单位与币种（默认人民币）；「E」为机构预测值；口径列标明统计口径，不同口径不混用。");
  lines.push("");

  for (const dim of input.project.dimensions) {
    const points = input.dataPoints.filter((d) => d.dimension === dim);
    lines.push(renderDimensionSection(dim, points, sourceMap));
  }

  lines.push(renderSourceList(input.sources));
  lines.push("");
  lines.push(DISCLAIMER);
  lines.push("");

  return lines.join("\n");
}

/** 预测/实际统计，用于报告头部摘要 */
export function summarize(input: ExportInput): {
  total: number;
  forecastCount: number;
  byDimension: Record<Dimension, number>;
  sourceTierCount: Record<string, number>;
} {
  const byDimension = Object.fromEntries(
    input.project.dimensions.map((d) => [d, 0])
  ) as Record<Dimension, number>;
  let forecastCount = 0;
  for (const dp of input.dataPoints) {
    if (dp.dimension in byDimension) byDimension[dp.dimension]++;
    if (dp.forecast) forecastCount++;
  }
  const sourceTierCount: Record<string, number> = { A: 0, B: 0, C: 0 };
  for (const s of input.sources) sourceTierCount[s.tier]++;
  return { total: input.dataPoints.length, forecastCount, byDimension, sourceTierCount };
}

export { METRIC_KIND_LABELS };
