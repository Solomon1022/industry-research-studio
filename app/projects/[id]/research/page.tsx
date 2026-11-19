"use client";

import { use, useMemo, useState } from "react";
import { Topbar } from "@/components/Topbar";
import { SearchPanel } from "@/components/research/SearchPanel";
import { TableMapper } from "@/components/research/TableMapper";
import type { ExtractedPayload } from "@/lib/desktop";
import { ingestEvidence } from "@/lib/research-workflow";
import type { EvidenceMethod } from "@/lib/research-types";
import { useEvidence, useProject, useSources } from "@/lib/use-data";

export default function ResearchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { project } = useProject(id);
  const { sources = [] } = useSources();
  const { evidence = [] } = useEvidence(id);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tableId, setTableId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const selected = evidence.find((item) => item.id === selectedId) ?? evidence[0];
  const sourceMap = useMemo(() => new Map(sources.map((source) => [source.id, source])), [sources]);
  const source = selected ? sourceMap.get(selected.sourceId) : undefined;
  const table = tableId === "text" ? undefined : selected?.tables.find((item) => item.id === tableId) ?? (tableId ? undefined : selected?.tables[0]);

  const ingest = async (payload: ExtractedPayload, method: EvidenceMethod) => {
    const result = await ingestEvidence(id, payload, method);
    setSelectedId(result.evidence.id);
    setTableId(result.evidence.tables[0]?.id ?? null);
    setNotice(`证据已保存：${result.evidence.title}`);
  };

  return (
    <>
      <Topbar projectId={id} projectName={project?.name} />
      <main className="main research-main">
        <h1 className="section-title">研究中心</h1>
        <p className="section-desc">检索 → 提取原文 → 保存证据 → 逐行选数 → 进入图表与报告。没有证据原文的内容不会被标为已核验。</p>
        {project && <SearchPanel projectName={project.name} industry={project.industry} onIngest={ingest} />}
        {notice && <div className="issue issue-ok" style={{ marginTop: 16 }}>{notice}</div>}

        <div className="research-workspace">
          <aside className="evidence-list">
            <div className="section-heading-row"><h2>证据库</h2><span className="badge">{evidence.length}</span></div>
            {!evidence.length && <p className="muted">暂无证据。先搜索、提取链接或导入文件。</p>}
            {evidence.map((item) => (
              <button key={item.id} className={`evidence-item${selected?.id === item.id ? " active" : ""}`} onClick={() => { setSelectedId(item.id); setTableId(item.tables[0]?.id ?? null); }}>
                <strong>{item.title}</strong>
                <span>{item.publisher || item.url || "本地文件"}</span>
                <small>{item.method} · {item.tables.length} 表 · {new Date(item.acquiredAt).toLocaleString("zh-CN")}</small>
              </button>
            ))}
          </aside>

          <section className="evidence-viewer">
            {!selected && <div className="empty"><h3>证据原文会显示在这里</h3><p>所有表格、来源定位和校验值都会随项目保存在本机。</p></div>}
            {selected && (
              <>
                <div className="evidence-header">
                  <div><h2>{selected.title}</h2><p>{selected.publisher} {selected.publishedAt ? `· ${selected.publishedAt}` : ""}</p></div>
                  {selected.url && <a className="btn btn-sm" href={selected.url} target="_blank" rel="noreferrer">打开原始来源</a>}
                </div>
                <div className="evidence-meta">
                  <span className={`badge badge-tier-${source?.tier ?? "C"}`}>{source?.tier ?? "C"} 级来源</span>
                  <span className="badge">{selected.mediaType}</span>
                  <span className="badge">{selected.method}</span>
                  <span className="hash">SHA-256 {selected.checksum}</span>
                </div>
                {selected.metadata.warning && <div className="issue issue-warning">{selected.metadata.warning}</div>}
                <div className="dim-tabs">
                  <button className={`dim-tab${!table ? " active" : ""}`} onClick={() => setTableId("text")}>正文</button>
                  {selected.tables.map((item, index) => <button key={item.id} className={`dim-tab${table?.id === item.id ? " active" : ""}`} onClick={() => setTableId(item.id)}>表格 {index + 1}</button>)}
                </div>
                {!table && <pre className="evidence-text">{selected.rawText.slice(0, 120000) || "没有可显示的正文"}</pre>}
                {table && source && <TableMapper key={table.id} projectId={id} table={table} source={source} onSaved={(count) => setNotice(`已把 ${count} 行转为入选数据，可在「数据管理」中继续编辑与导出。`)} />}
                {table && !source && <div className="issue issue-error">找不到该证据对应的来源记录，请重新导入。</div>}
              </>
            )}
          </section>
        </div>
      </main>
    </>
  );
}
