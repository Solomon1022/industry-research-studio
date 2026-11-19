"use client";

import { use, useMemo, useState } from "react";
import { Topbar } from "@/components/Topbar";
import { buildAllCharts } from "@/lib/charts";
import { getActiveModel } from "@/lib/client-settings";
import { desktopBridge } from "@/lib/desktop";
import { analysisMarkdown } from "@/lib/export/analysis-text";
import { renderChartForExport } from "@/lib/export/chart";
import { exportDocx } from "@/lib/export/docx";
import { saveBytes } from "@/lib/export/download";
import { exportMarkdown } from "@/lib/export/markdown";
import { exportPrintHtml } from "@/lib/export/print-html";
import { exportCsv, exportWorkbook as exportExcel } from "@/lib/export/tabular";
import { canExport, validateProject } from "@/lib/validation";
import { useDataPoints, useEvidence, useProject, useQuestionnaires, useSources } from "@/lib/use-data";

export default function ExportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { project } = useProject(id);
  const { dataPoints } = useDataPoints(id);
  const { sources } = useSources();
  const { evidence = [] } = useEvidence(id);
  const { datasets = [] } = useQuestionnaires(id);
  const [datasetId, setDatasetId] = useState("");
  const [chartKey, setChartKey] = useState("");
  const [aiSummary, setAiSummary] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const ready = project && dataPoints && sources;
  const issues = useMemo(() => ready ? validateProject({ project, dataPoints, sources }) : [], [ready, project, dataPoints, sources]);
  const exportable = canExport(issues);
  const charts = useMemo(() => buildAllCharts(dataPoints ?? []), [dataPoints]);
  const selectedChart = charts.find((chart) => chart.key === chartKey) ?? charts[0];
  const analysis = (datasets.find((item) => item.id === datasetId) ?? datasets[0])?.analysis;
  const safeName = project?.name.replace(/[\\/:*?"<>|]/g, "_") ?? "研究项目";

  const run = async (label: string, action: () => Promise<void>) => {
    setBusy(label); setMessage("");
    try { await action(); }
    catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(""); }
  };
  if (!ready) return <><Topbar projectId={id} projectName={project?.name} /><main className="main"><div className="empty">正在载入…</div></main></>;

  const baseInput = { project, dataPoints, sources };
  const markdown = () => {
    let text = exportMarkdown(baseInput);
    if (aiSummary) text = text.replace("## 数据来源", `## AI 辅助摘要（需人工复核）\n\n${aiSummary}\n\n## 数据来源`);
    return `${text}\n\n${analysisMarkdown(analysis)}`;
  };
  const html = () => {
    let text = exportPrintHtml(baseInput);
    if (aiSummary) {
      const escaped = aiSummary.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
      text = text.replace("<h2>数据来源</h2>", `<h2>AI 辅助摘要（需人工复核）</h2><p>${escaped}</p><h2>数据来源</h2>`);
    }
    if (analysis) text = text.replace("</body>", `<h2>真实问卷分析</h2><pre style="white-space:pre-wrap">${analysisMarkdown(analysis).replace(/&/g, "&amp;").replace(/</g, "&lt;")}</pre></body>`);
    return text;
  };
  const chartNotes = () => {
    if (!selectedChart) return null;
    const point = dataPoints.find((item) => item.metric === selectedChart.metric);
    const related = dataPoints.filter((item) => item.metric === selectedChart.metric && selectedChart.scopeLabels.includes(item.scope.label));
    const names = [...new Set(related.map((item) => sources.find((source) => source.id === item.sourceId)?.name).filter(Boolean))];
    return { title: selectedChart.title, unit: point?.unit, source: names.join("；") || "项目已入选来源" };
  };
  const chartPng = async () => selectedChart && chartNotes() ? renderChartForExport(selectedChart.option, "png", chartNotes()!) : undefined;
  const wordBytes = async () => {
    const png = await chartPng();
    const chart = png && selectedChart && chartNotes() ? [{ title: selectedChart.title, data: png, width: 600, height: 338, source: chartNotes()!.source }] : [];
    return exportDocx({ ...baseInput, evidence, analysis, aiSummary, charts: chart });
  };
  const save = async (name: string, bytes: Uint8Array | string, type: string) => setMessage(await saveBytes(`${safeName}-${name}`, bytes, type));

  return (
    <>
      <Topbar projectId={id} projectName={project.name} />
      <main className="main">
        <h1 className="section-title">完整导出中心</h1>
        <p className="section-desc">所有格式来自同一份项目数据与统计结果。导出前仍执行来源、数值、单位和口径校验。</p>
        <div className={`issue ${exportable ? "issue-ok" : "issue-error"}`}>{exportable ? `校验通过：${dataPoints.length} 个数据点，${sources.length} 个来源` : `存在 ${issues.filter((issue) => issue.level === "error").length} 个错误，请先在数据管理中修复`}</div>
        <section className="card">
          <div className="form-grid">
            <div className="field col-6"><label>纳入问卷分析结果</label><select className="select" value={(datasets.find((item) => item.id === datasetId) ?? datasets[0])?.id ?? ""} onChange={(event) => setDatasetId(event.target.value)}><option value="">不纳入</option>{datasets.filter((item) => item.analysis).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
            <div className="field col-6"><label>纳入趋势图 / 对比图</label><select className="select" value={selectedChart?.key ?? ""} onChange={(event) => setChartKey(event.target.value)}>{!charts.length && <option value="">暂无可生成图表的数据</option>}{charts.map((chart) => <option key={chart.key} value={chart.key}>{chart.title} · {chart.scopeLabels.join(" / ")}</option>)}</select></div>
          </div>
          <div className="export-grid">
            <button className="export-action" disabled={!exportable || Boolean(busy)} onClick={() => run("xlsx", async () => save("研究数据.xlsx", await exportExcel({ ...baseInput, evidence, analysis }), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))}><strong>Excel 工作簿</strong><span>数据、来源、证据、统计、回归与清洗日志</span></button>
            <button className="export-action" disabled={!exportable || Boolean(busy)} onClick={() => run("csv", async () => save("入选数据.csv", exportCsv({ ...baseInput, analysis }), "text/csv;charset=utf-8"))}><strong>CSV 数据表</strong><span>UTF-8 BOM，公式注入防护</span></button>
            <button className="export-action" disabled={!exportable || Boolean(busy)} onClick={() => run("docx", async () => save("研究数据报告.docx", await wordBytes(), "application/vnd.openxmlformats-officedocument.wordprocessingml.document"))}><strong>Word 研究数据报告</strong><span>宋体小四、1.25 倍行距、图表与来源链接</span></button>
            <button className="export-action" disabled={!exportable || Boolean(busy)} onClick={() => run("md", async () => save("研究数据报告.md", markdown(), "text/markdown;charset=utf-8"))}><strong>Markdown</strong><span>适合继续编辑与版本管理</span></button>
            <button className="export-action" disabled={!exportable || Boolean(busy)} onClick={() => run("html", async () => save("研究数据报告.html", html(), "text/html;charset=utf-8"))}><strong>独立 HTML</strong><span>无外部依赖，可打印或存档</span></button>
            <button className="export-action" disabled={!selectedChart || Boolean(busy)} onClick={() => run("png", async () => { const png = await chartPng(); if (png) await save("图表.png", png, "image/png"); })}><strong>PNG 图表</strong><span>3200 × 1800，标题、单位、预测与来源</span></button>
            <button className="export-action" disabled={!selectedChart || Boolean(busy)} onClick={() => run("svg", async () => { if (selectedChart && chartNotes()) await save("图表.svg", await renderChartForExport(selectedChart.option, "svg", chartNotes()!), "image/svg+xml"); })}><strong>SVG 图表</strong><span>可编辑矢量图，附来源脚注</span></button>
          </div>
          <button className="btn btn-primary" style={{ marginTop: 20 }} disabled={!exportable || Boolean(busy)} onClick={() => run("zip", async () => {
            const { default: JSZip } = await import("jszip");
            const zip = new JSZip();
            const png = await chartPng();
            zip.file(`${safeName}-研究数据报告.docx`, await wordBytes());
            zip.file(`${safeName}-研究数据.xlsx`, await exportExcel({ ...baseInput, evidence, analysis }));
            zip.file(`${safeName}-入选数据.csv`, exportCsv({ ...baseInput, analysis }));
            zip.file(`${safeName}-研究数据报告.md`, markdown());
            zip.file(`${safeName}-研究数据报告.html`, html());
            if (png) zip.file(`${safeName}-图表.png`, png);
            if (selectedChart && chartNotes()) zip.file(`${safeName}-图表.svg`, await renderChartForExport(selectedChart.option, "svg", chartNotes()!));
            zip.file("导出说明.json", JSON.stringify({ product: "Industry Research Studio", exportedAt: new Date().toISOString(), project: project.name, dataPoints: dataPoints.length, sources: sources.length, evidence: evidence.length, analysisIncluded: Boolean(analysis), aiSummaryIncluded: Boolean(aiSummary), note: "AI 摘要不是数据来源；所有数值请对照原始证据复核。" }, null, 2));
            await save("完整研究包.zip", await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" }), "application/zip");
          })}>{busy === "zip" ? "正在打包…" : "一键导出完整研究包 ZIP"}</button>
        </section>
        <section className="card">
          <div className="section-heading-row"><div><h2 className="section-title">AI 辅助摘要（可选）</h2><p className="section-desc">只整理已入选数据，不允许模型新增数字、事实或文献；摘要将明确标记。</p></div><button className="btn" disabled={Boolean(busy) || !desktopBridge()} onClick={() => run("ai", async () => {
            const bridge = desktopBridge(); if (!bridge) return;
            const compact = dataPoints.slice(0, 120).map((point) => ({ ...point, source: sources.find((source) => source.id === point.sourceId)?.title }));
            const result = await bridge.chat(getActiveModel(), [{ role: "system", content: "你是数据报告编辑。只能根据用户给出的数据摘要，不得补充任何数字、事实、文献或因果结论。逐项保留单位、时间、口径和来源名称；数据不足直接说明。输出 4 段中文，不使用 Markdown 标题。" }, { role: "user", content: JSON.stringify({ project: { name: project.name, industry: project.industry, region: project.region, periodRange: project.periodRange }, data: compact }) }]);
            setAiSummary(result);
          })}>基于真实数据生成摘要</button></div>
          {aiSummary ? <div className="ai-summary">{aiSummary}</div> : <p className="muted">未使用 AI 也能导出全部格式。</p>}
        </section>
        {(busy || message) && <div className="issue issue-info" role="status">{busy ? `正在处理：${busy}` : message}</div>}
      </main>
    </>
  );
}
