import type { CandidateAssessment, CellValue } from "./research-types";
import type { DataPoint, Source } from "./types";

export function assessCandidate(input: {
  source: Source;
  period: string;
  value: CellValue;
  unit: string;
  scope: string;
  sampleSize?: number;
  independentSourceCount?: number;
}): CandidateAssessment {
  let score = 100;
  const reasons: string[] = [];
  if (input.source.tier === "A") reasons.push("A 级来源：官方、法定披露或官方统计");
  if (input.source.tier === "B") { score -= 8; reasons.push("B 级机构研究：重要结论建议再找独立来源复核"); }
  if (input.source.tier === "C") { score -= 35; reasons.push("C 级线索：不能作为论文关键结论的唯一依据"); }
  if (input.source.linkStatus === "dead") { score -= 25; reasons.push("原链接失效：需补可访问原文或存档"); }
  if (!input.source.publishedAt) { score -= 8; reasons.push("缺少发布日期：需人工确认时效性"); }
  if (!input.period.trim()) { score -= 25; reasons.push("缺数据年份/时点"); }
  if (input.value === null || input.value === "" || (typeof input.value === "number" && !Number.isFinite(input.value))) {
    score -= 45; reasons.push("缺有效数值");
  }
  if (!input.unit.trim()) { score -= 18; reasons.push("缺单位"); }
  if (!input.scope.trim()) { score -= 22; reasons.push("缺统计口径"); }
  if (input.sampleSize !== undefined && input.sampleSize < 30) { score -= 15; reasons.push("样本量小于 30，不宜作总体推断"); }
  if ((input.independentSourceCount ?? 1) < 2 && input.source.tier !== "A") {
    score -= 8; reasons.push("目前为单一来源，建议交叉验证");
  }
  score = Math.max(0, Math.min(100, score));
  return {
    score,
    verdict: score >= 82 ? "recommended" : score >= 55 ? "review" : "reject",
    reasons,
  };
}

import { DIMENSION_LABELS, type Dimension } from "./types";

const THESIS_USE: Record<Dimension, string> = {
  market: "绪论：行业规模、增速与研究背景",
  competition: "研究场景：平台、企业与产品形态",
  consumer: "研究背景：用户画像与行为证据",
  technology: "技术背景：模型、虚拟人及产业应用",
  investment: "补充背景：公开融资与产业资本信息",
  policy: "制度背景：真实政策原文与适用边界",
};

export function buildThesisDataPlan(points: DataPoint[], sources: Source[]) {
  return (Object.keys(DIMENSION_LABELS) as Dimension[]).map((dimension) => {
    const selected = points.filter((point) => point.dimension === dimension);
    const sourceIds = new Set(selected.map((point) => point.sourceId));
    const gaps: string[] = [];
    if (!selected.length) gaps.push("尚无入选数据");
    if (selected.some((point) => !point.period)) gaps.push("缺时间");
    if (selected.some((point) => !point.scope.label)) gaps.push("缺口径");
    if (selected.some((point) => !point.sourceId)) gaps.push("缺来源");
    if (selected.length && sourceIds.size < 2) gaps.push("关键结论建议补独立来源交叉复核");
    if (sources.some((source) => sourceIds.has(source.id) && !source.publishedAt)) gaps.push("有来源缺发布日期");
    return {
      dimension,
      dimensionLabel: DIMENSION_LABELS[dimension],
      recommendedUse: THESIS_USE[dimension],
      pointCount: selected.length,
      periods: [...new Set(selected.map((point) => point.period).filter(Boolean))].sort(),
      sourceCount: sourceIds.size,
      gaps: gaps.length ? gaps : ["字段齐全；仍须回原文复核"],
    };
  });
}

export function findConflicts(points: DataPoint[]): Array<{ metric: string; period: string; values: number[]; scopes: string[] }> {
  const groups = new Map<string, DataPoint[]>();
  for (const point of points) {
    if (point.value === null) continue;
    const key = `${point.metric.trim()}@@${point.period.trim()}`;
    groups.set(key, [...(groups.get(key) ?? []), point]);
  }
  const conflicts: Array<{ metric: string; period: string; values: number[]; scopes: string[] }> = [];
  for (const group of groups.values()) {
    const values = [...new Set(group.map((point) => point.value as number))];
    if (values.length > 1) {
      conflicts.push({
        metric: group[0].metric,
        period: group[0].period,
        values,
        scopes: [...new Set(group.map((point) => point.scope.label))],
      });
    }
  }
  return conflicts;
}

export function thesisDataChecklist(config?: {
  independentVar: string; mediator: string; dependentVar: string; controls: string[];
}): Array<{ item: string; purpose: string; rule: string }> {
  return [
    { item: "行业规模、增速、渗透率", purpose: "绪论与研究背景", rule: "优先官方/机构原文；写清单位、年份、统计口径与预测标识" },
    { item: "平台与典型企业公开披露", purpose: "说明研究场景与技术落地", rule: "优先财报/公告；厂商效能数字标为企业披露，不写成普遍结论" },
    { item: "用户画像与行为研究", purpose: "提出研究问题与变量背景", rule: "必须保留样本量、调研时间、地域与题目类型" },
    { item: `${config?.independentVar || "自变量 X"}量表`, purpose: "问卷测量与信效度检验", rule: "来自真实量表/文献；不得由 AI 编造题项或参考文献" },
    { item: `${config?.mediator || "中介变量 M"}量表`, purpose: "中介机制检验", rule: "保留原始出处、题项与计分方向" },
    { item: `${config?.dependentVar || "因变量 Y"}量表`, purpose: "结果变量测量", rule: "保留原始出处、题项与计分方向" },
    { item: `控制变量${config?.controls?.length ? `（${config.controls.join("、")}）` : ""}`, purpose: "降低混杂影响", rule: "使用真实问卷字段，说明编码方式" },
    { item: "真实问卷逐行数据", purpose: "描述统计、信效度、回归与 Bootstrap 中介", rule: "不得生成或补造样本；清洗排除必须留痕" },
  ];
}
