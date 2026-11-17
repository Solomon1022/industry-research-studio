/**
 * 打印版 HTML 报告导出
 *
 * 生成一个自包含的单文件 HTML（内联样式、无外部依赖），
 * 用户可直接浏览器打开或「打印为 PDF」。
 */

import type { DataPoint, Dimension, Project, Source } from "../types";
import { DIMENSION_LABELS, SOURCE_TIER_LABELS } from "../types";

interface HtmlExportInput {
  project: Project;
  dataPoints: DataPoint[];
  sources: Source[];
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtValue(dp: DataPoint): string {
  if (dp.value === null) return "—";
  const num = dp.value.toLocaleString("zh-CN", { maximumFractionDigits: 2 });
  return esc(`${num} ${dp.unit}`);
}

function renderRows(points: DataPoint[], sourceMap: Map<string, Source>): string {
  const sorted = [...points].sort((a, b) => String(a.period).localeCompare(String(b.period)));
  return sorted
    .map((dp) => {
      const src = dp.sourceId ? sourceMap.get(dp.sourceId) : undefined;
      const forecastMark = dp.forecast ? '<span class="forecast">E</span>' : "";
      return `<tr>
<td>${esc(dp.period)}</td>
<td>${esc(dp.metric)}${dp.subject ? `<br><span class="sub">${esc(dp.subject)}</span>` : ""}</td>
<td class="num">${fmtValue(dp)}${forecastMark}</td>
<td><span class="scope">${esc(dp.scope.label)}</span></td>
<td>${src ? esc(src.name) : '<span class="warn">⚠ 缺来源</span>'}</td>
</tr>`;
    })
    .join("\n");
}

function renderTexts(points: DataPoint[], sourceMap: Map<string, Source>): string {
  return points
    .map((dp) => {
      const src = dp.sourceId ? sourceMap.get(dp.sourceId) : undefined;
      return `<div class="text-item">
<h4>${esc(dp.metric)}${dp.subject ? ` · ${esc(dp.subject)}` : ""}</h4>
<p>${esc(dp.text ?? "")}</p>
<p class="meta">来源：${src ? esc(src.name) : '<span class="warn">⚠ 缺来源</span>'}${dp.period ? ` · ${esc(dp.period)}` : ""}${dp.note ? ` · ${esc(dp.note)}` : ""}</p>
</div>`;
    })
    .join("\n");
}

const STYLES = `
:root { --ink:#1a1a1a; --muted:#666; --line:#ddd; --accent:#0f5ea8; --warn:#b3261e; }
* { box-sizing: border-box; }
body { font-family: "Noto Sans SC", "Microsoft YaHei", system-ui, sans-serif; color: var(--ink); max-width: 900px; margin: 0 auto; padding: 48px 24px; line-height: 1.7; }
h1 { font-size: 28px; margin: 0 0 8px; }
h2 { font-size: 20px; margin: 40px 0 12px; padding-bottom: 6px; border-bottom: 2px solid var(--accent); }
h4 { margin: 0 0 4px; font-size: 15px; }
.meta, .sub { color: var(--muted); font-size: 12.5px; }
table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 13.5px; }
th, td { border: 1px solid var(--line); padding: 6px 10px; text-align: left; vertical-align: top; }
th { background: #f5f7fa; }
.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.forecast { display: inline-block; margin-left: 4px; padding: 0 5px; border: 1px dashed var(--accent); border-radius: 3px; color: var(--accent); font-size: 11px; }
.scope { font-size: 12px; color: var(--muted); }
.warn { color: var(--warn); }
.text-item { margin: 12px 0; padding-left: 12px; border-left: 3px solid var(--line); }
.text-item p { margin: 4px 0; }
.header-meta { color: var(--muted); font-size: 14px; margin-bottom: 24px; }
.header-meta span { margin-right: 16px; }
.notice { background: #f5f7fa; border: 1px solid var(--line); padding: 10px 14px; font-size: 13px; color: var(--muted); border-radius: 4px; }
.disclaimer { margin-top: 48px; padding-top: 16px; border-top: 1px solid var(--line); font-size: 12.5px; color: var(--muted); }
ul.sources { font-size: 13px; padding-left: 20px; }
ul.sources li { margin: 6px 0; word-break: break-all; }
@media print { body { padding: 0; } h2 { break-after: avoid; } table, .text-item { break-inside: avoid; } }
`;

/** 生成完整自包含 HTML 字符串 */
export function exportPrintHtml(input: HtmlExportInput): string {
  const sourceMap = new Map(input.sources.map((s) => [s.id, s]));
  const sections = input.project.dimensions
    .map((dim: Dimension) => {
      const points = input.dataPoints.filter((d) => d.dimension === dim);
      const numerics = points.filter((p) => p.kind !== "text");
      const texts = points.filter((p) => p.kind === "text");
      const table =
        numerics.length > 0
          ? `<table><thead><tr><th>时间</th><th>指标</th><th>数值</th><th>口径</th><th>来源</th></tr></thead><tbody>${renderRows(numerics, sourceMap)}</tbody></table>`
          : "";
      const textHtml = renderTexts(texts, sourceMap);
      const empty = numerics.length === 0 && texts.length === 0 ? '<p class="meta">本维度暂无数据。</p>' : "";
      return `<h2>${esc(DIMENSION_LABELS[dim])}</h2>${table}${textHtml}${empty}`;
    })
    .join("\n");

  const sourceItems = [...input.sources]
    .sort((a, b) => a.tier.localeCompare(b.tier))
    .map(
      (s) =>
        `<li>[${s.tier}] ${esc(s.name)}《${esc(s.title)}》${s.publishedAt ? ` · ${esc(s.publishedAt)}` : ""}${s.url ? ` · ${esc(s.url)}` : ""}${s.linkStatus === "dead" ? "（链接已失效）" : ""}${s.note ? ` · ${esc(s.note)}` : ""}</li>`
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(input.project.name)} · 行业背调报告</title>
<style>${STYLES}</style>
</head>
<body>
<h1>${esc(input.project.name)} · 行业背调报告</h1>
<div class="header-meta">
<span>行业边界：${esc(input.project.industry)}</span>
<span>地域：${esc(input.project.region)}</span>
<span>时段：${esc(input.project.periodRange)}</span>
<span>生成：${new Date().toISOString().slice(0, 10)}</span>
</div>
<p class="notice">口径与标注约定：数值含单位与币种（默认人民币）；「E」为机构预测值；口径列标明统计口径，不同口径不混用。本报告由 Industry Research Studio 生成。</p>
${sections}
<h2>数据来源</h2>
<ul class="sources">${sourceItems}</ul>
<p class="meta">分级说明：${SOURCE_TIER_LABELS.A}；${SOURCE_TIER_LABELS.B}；${SOURCE_TIER_LABELS.C}。</p>
<div class="disclaimer">
<strong>免责声明</strong>：本报告基于公开数据二次整理与可视化，不构成投资建议。各机构统计口径存在差异，具体以原始报告为准；标注「E」的数值为机构预测，不代表实际结果。涉及政策与法律的内容以官方发布原文为准，本报告不构成法律意见。制作过程中未生成、修改或虚构任何原始统计数据。
</div>
</body>
</html>`;
}
