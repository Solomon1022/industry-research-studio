"use client";

/** 报告导出：预览 → 保真校验门禁 → 导出 Markdown / 打印版 HTML / 浏览器打印 PDF */

import { use, useMemo, useState } from "react";
import { Topbar } from "@/components/Topbar";
import { exportMarkdown, summarize } from "@/lib/export/markdown";
import { exportPrintHtml } from "@/lib/export/print-html";
import { canExport, validateProject } from "@/lib/validation";
import { downloadTextFile, useDataPoints, useProject, useSources } from "@/lib/use-data";
import { DIMENSION_LABELS } from "@/lib/types";

export default function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { project } = useProject(id);
  const { dataPoints } = useDataPoints(id);
  const { sources } = useSources();
  const [preview, setPreview] = useState<"summary" | "markdown">("summary");

  const ready = project && dataPoints && sources;
  const issues = useMemo(
    () => (ready ? validateProject({ project, dataPoints, sources }) : []),
    [ready, project, dataPoints, sources]
  );
  const exportable = canExport(issues);
  const stats = useMemo(
    () => (ready ? summarize({ project, dataPoints, sources }) : null),
    [ready, project, dataPoints, sources]
  );
  const markdown = useMemo(
    () => (ready ? exportMarkdown({ project, dataPoints, sources }) : ""),
    [ready, project, dataPoints, sources]
  );

  if (!ready) {
    return <><Topbar projectId={id} projectName={project?.name} /><main className="main"><div className="empty">正在载入…</div></main></>;
  }

  const safeName = project.name.replace(/[\\/:*?"<>|]/g, "_");
  const errorCount = issues.filter((i) => i.level === "error").length;
  const warningCount = issues.filter((i) => i.level === "warning").length;

  const doExportMd = () =>
    downloadTextFile(`${safeName}-行业背调报告.md`, markdown);
  const doExportHtml = () =>
    downloadTextFile(`${safeName}-行业背调报告.html`, exportPrintHtml({ project, dataPoints, sources }), "text/html");

  return (
    <>
      <Topbar projectId={id} projectName={project.name} />
      <main className="main">
        <div style={{ marginBottom: 16 }}>
          <h1 className="section-title">报告导出</h1>
          <p className="section-desc" style={{ marginBottom: 0 }}>
            导出前自动执行数据保真校验：存在错误级问题（缺来源/缺数值/缺口径）时必须修复后才能导出。
          </p>
        </div>

        {/* 校验门禁 */}
        <div className="card no-print" style={{ borderLeft: `3px solid ${exportable ? "var(--ok)" : "var(--danger)"}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div>
              <strong>{exportable ? "✓ 校验通过，可以导出" : `✗ 存在 ${errorCount} 个错误，修复后才能导出`}</strong>
              <span style={{ marginLeft: 12, fontSize: 13, color: "var(--muted)" }}>
                错误 {errorCount} · 警告 {warningCount} · 提示 {issues.length - errorCount - warningCount}
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-primary" disabled={!exportable} onClick={doExportMd}>导出 Markdown</button>
              <button className="btn" disabled={!exportable} onClick={doExportHtml}>下载打印版 HTML</button>
              <button className="btn" disabled={!exportable} onClick={() => window.print()}>打印 / 存为 PDF</button>
            </div>
          </div>
          {issues.length > 0 && (
            <div className="issue-list" style={{ marginTop: 12 }}>
              {issues.slice(0, 10).map((iss, i) => (
                <div key={i} className={`issue issue-${iss.level}`}>
                  <span className={`badge ${iss.level === "error" ? "badge-error" : iss.level === "warning" ? "badge-warning" : "badge-info"}`}>
                    {iss.level === "error" ? "错误" : iss.level === "warning" ? "警告" : "提示"}
                  </span>
                  <span style={{ flex: 1 }}>{iss.message}</span>
                  <span className="issue-rule">{iss.rule}</span>
                </div>
              ))}
              {issues.length > 10 && <p style={{ fontSize: 12, color: "var(--muted)" }}>… 其余 {issues.length - 10} 条见数据录入页</p>}
            </div>
          )}
        </div>

        {/* 预览切换 */}
        <div className="dim-tabs no-print" style={{ marginTop: 20 }}>
          <button className={`dim-tab${preview === "summary" ? " active" : ""}`} onClick={() => setPreview("summary")}>报告概览</button>
          <button className={`dim-tab${preview === "markdown" ? " active" : ""}`} onClick={() => setPreview("markdown")}>Markdown 预览</button>
        </div>

        {preview === "summary" && stats && (
          <div className="report-preview">
            <h1>{project.name} · 行业背调报告</h1>
            <p className="report-meta">
              {project.industry} · {project.region} · {project.periodRange} · 生成于 {new Date().toISOString().slice(0, 10)}
            </p>
            <p>
              全报告共 <strong>{stats.total}</strong> 个数据点（含预测 <strong>{stats.forecastCount}</strong> 个），
              引用来源 <strong>{sources.length}</strong> 个（A 级 {stats.sourceTierCount.A} / B 级 {stats.sourceTierCount.B} / C 级 {stats.sourceTierCount.C}）。
            </p>
            <h2>维度覆盖</h2>
            <div className="table-wrap">
              <table className="data">
                <colgroup><col style={{ width: "30%" }} /><col style={{ width: "20%" }} /><col style={{ width: "50%" }} /></colgroup>
                <thead><tr><th>维度</th><th>数据点</th><th>状态</th></tr></thead>
                <tbody>
                  {project.dimensions.map((d) => (
                    <tr key={d}>
                      <td>{DIMENSION_LABELS[d]}</td>
                      <td className="num">{stats.byDimension[d] ?? 0}</td>
                      <td>{(stats.byDimension[d] ?? 0) > 0 ? "✓ 有数据" : "— 待补充"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h2>导出内容约定</h2>
            <ul style={{ fontSize: 13.5, lineHeight: 1.9 }}>
              <li>每个数值含单位、时间与口径标签；预测值标注「E」；</li>
              <li>同一指标的多种口径并列呈现并解释差异，不混用；</li>
              <li>完整来源列表（分级、报告名、日期、链接）与免责声明自动附加；</li>
              <li>Markdown 适合粘贴到飞书/语雀/Notion；打印版 HTML 可直接「打印为 PDF」。</li>
            </ul>
          </div>
        )}

        {preview === "markdown" && (
          <div className="report-preview">
            <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "var(--font-mono)", fontSize: 12.5, margin: 0 }}>
              {markdown}
            </pre>
          </div>
        )}
      </main>
    </>
  );
}
