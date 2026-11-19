import type { SurveyAnalysisResult } from "../research-types";

export function analysisMarkdown(analysis?: SurveyAnalysisResult): string {
  if (!analysis) return "";
  const lines = ["## 真实问卷分析", "", `原始样本 ${analysis.originalN} 行，分析样本 ${analysis.analysisN} 行，规则排除 ${analysis.exclusions.length} 行。`, "", "| 变量 | N | 均值 | 标准差 | 中位数 | 最小值 | 最大值 |", "| --- | ---: | ---: | ---: | ---: | ---: | ---: |"];
  analysis.descriptive.forEach((item) => lines.push(`| ${item.variable} | ${item.n} | ${item.mean.toFixed(4)} | ${item.sd.toFixed(4)} | ${item.median.toFixed(4)} | ${item.min} | ${item.max} |`));
  if (analysis.reliability) lines.push("", `Cronbach α = ${analysis.reliability.alpha.toFixed(4)}（${analysis.reliability.itemCount} 个题项）。`);
  if (analysis.validity) lines.push("", `KMO = ${analysis.validity.kmo.toFixed(4)}；Bartlett χ²(${analysis.validity.bartlettDf}) = ${analysis.validity.bartlettChiSquare.toFixed(3)}，p = ${analysis.validity.bartlettP.toExponential(3)}。`);
  if (analysis.mediation) lines.push("", "### Bootstrap 中介效应", "", `${analysis.mediation.x} → ${analysis.mediation.m} → ${analysis.mediation.y}；间接效应 ${analysis.mediation.indirect.toFixed(4)}，95% CI [${analysis.mediation.indirectCi95[0].toFixed(4)}, ${analysis.mediation.indirectCi95[1].toFixed(4)}]，${analysis.mediation.bootstrapIterations} 次有效重抽样。`);
  if (analysis.exclusions.length) {
    lines.push("", "### 清洗排除日志", "", "| 原文件行号 | 原因 |", "| ---: | --- |");
    analysis.exclusions.forEach((item) => lines.push(`| ${item.rowNumber} | ${item.reasons.join("；").replace(/\|/g, "\\|")} |`));
  }
  return lines.join("\n");
}
