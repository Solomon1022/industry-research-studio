"use client";

/** 来源管理：A/B/C 分级登记、引用计数、失效链接标注、防误删 */

import { use, useState } from "react";
import { Topbar } from "@/components/Topbar";
import { deleteSourceIfUnused, upsertSource } from "@/lib/db";
import { useProject, useSourceRefCounts, useSources } from "@/lib/use-data";
import { SOURCE_TIERS, SOURCE_TIER_LABELS, type Source, type SourceTier } from "@/lib/types";

interface SourceFormState {
  id?: string;
  name: string;
  title: string;
  publisher: string;
  publishedAt: string;
  url: string;
  tier: SourceTier;
  linkStatus: Source["linkStatus"];
  note: string;
}

const emptySource: SourceFormState = {
  name: "", title: "", publisher: "", publishedAt: "", url: "",
  tier: "B", linkStatus: "unknown", note: "",
};

function SourceForm({
  initial, onClose, onSaved,
}: { initial: SourceFormState; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState(initial);
  const [error, setError] = useState("");
  const set = <K extends keyof SourceFormState>(k: K, v: SourceFormState[K]) =>
    setF((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!f.name.trim()) return setError("请填写来源名称（如：网经社电数宝）");
    if (!f.title.trim()) return setError("请填写报告/文件全名");
    await upsertSource({
      ...(f.id ? { id: f.id } : {}),
      name: f.name.trim(), title: f.title.trim(),
      publisher: f.publisher.trim() || undefined,
      publishedAt: f.publishedAt.trim() || undefined,
      url: f.url.trim() || undefined,
      tier: f.tier, linkStatus: f.linkStatus,
      note: f.note.trim() || undefined,
    });
    onSaved();
  };

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="来源编辑">
        <h3>{f.id ? "编辑来源" : "登记来源"}</h3>
        <div className="form-grid">
          <div className="field col-6">
            <label htmlFor="src-name">来源名称 *</label>
            <input id="src-name" className="input" placeholder="如：网经社电数宝 / 快手财报" value={f.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="field col-6">
            <label htmlFor="src-title">报告/文件全名 *</label>
            <input id="src-title" className="input" placeholder="如：2025年度中国直播电商市场数据报告" value={f.title} onChange={(e) => set("title", e.target.value)} />
          </div>
          <div className="field col-6">
            <label htmlFor="src-publisher">发布机构</label>
            <input id="src-publisher" className="input" placeholder="与来源名称不同时填写" value={f.publisher} onChange={(e) => set("publisher", e.target.value)} />
          </div>
          <div className="field col-6">
            <label htmlFor="src-date">发布日期</label>
            <input id="src-date" className="input" placeholder="如：2026-03 / 2025-11-11" value={f.publishedAt} onChange={(e) => set("publishedAt", e.target.value)} />
          </div>
          <div className="field col-8">
            <label htmlFor="src-url">链接</label>
            <input id="src-url" className="input" placeholder="https://…" value={f.url} onChange={(e) => set("url", e.target.value)} />
          </div>
          <div className="field col-4">
            <label htmlFor="src-status">链接状态</label>
            <select id="src-status" className="select" value={f.linkStatus} onChange={(e) => set("linkStatus", e.target.value as Source["linkStatus"])}>
              <option value="unknown">未核验</option>
              <option value="ok">可访问</option>
              <option value="dead">已失效</option>
            </select>
          </div>
          <div className="field col-12">
            <label>可靠度分级 *</label>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              {SOURCE_TIERS.map((t) => (
                <label key={t} className="checkbox-row">
                  <input type="radio" name="tier" checked={f.tier === t} onChange={() => set("tier", t)} />
                  <span className={`badge badge-tier-${t}`}>[{t}]</span> {SOURCE_TIER_LABELS[t]}
                </label>
              ))}
            </div>
            <span className="hint">关键数据优先 A 级；C 级仅作线索，须有 A/B 级佐证</span>
          </div>
          <div className="field col-12">
            <label htmlFor="src-note">备注</label>
            <textarea id="src-note" className="textarea" placeholder="口径说明、样本量、访问限制等" value={f.note} onChange={(e) => set("note", e.target.value)} />
          </div>
        </div>
        {error && <p style={{ color: "var(--danger)", fontSize: 13 }}>{error}</p>}
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={submit}>保存</button>
        </div>
      </div>
    </div>
  );
}

export default function SourcesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { project } = useProject(id);
  const { sources } = useSources();
  const refCounts = useSourceRefCounts() ?? new Map<string, number>();
  const [form, setForm] = useState<SourceFormState | null>(null);

  const onDelete = async (s: Source) => {
    const used = refCounts.get(s.id) ?? 0;
    if (used > 0) {
      window.alert(`来源「${s.name}」仍被 ${used} 条数据引用，不能删除。\n请先把相关数据点改挂到其他来源。`);
      return;
    }
    if (!window.confirm(`删除来源「${s.name}」？`)) return;
    const res = await deleteSourceIfUnused(s.id);
    if (!res.ok) {
      window.alert(`删除失败：来源正被 ${res.referencedBy} 条数据引用。`);
    }
  };

  const toForm = (s: Source): SourceFormState => ({
    id: s.id, name: s.name, title: s.title, publisher: s.publisher ?? "",
    publishedAt: s.publishedAt ?? "", url: s.url ?? "", tier: s.tier,
    linkStatus: s.linkStatus, note: s.note ?? "",
  });

  return (
    <>
      <Topbar projectId={id} projectName={project?.name} />
      <main className="main">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 className="section-title">来源库</h1>
            <p className="section-desc" style={{ marginBottom: 0 }}>
              全局共享，跨项目复用。分级约定：A 级官方统计与财报，B 级机构研究，C 级媒体线索（仅作线索，须 A/B 级佐证）。
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => setForm(emptySource)}>+ 登记来源</button>
        </div>

        {!sources || sources.length === 0 ? (
          <div className="empty">
            <div className="empty-title">来源库为空</div>
            <p>每条数据都必须可追溯到来源。先登记一个 A/B 级来源。</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <colgroup>
                <col style={{ width: "7%" }} /><col style={{ width: "18%" }} /><col style={{ width: "26%" }} />
                <col style={{ width: "10%" }} /><col style={{ width: "9%" }} /><col style={{ width: "10%" }} />
                <col style={{ width: "12%" }} /><col style={{ width: "8%" }} />
              </colgroup>
              <thead>
                <tr><th>分级</th><th>来源</th><th>报告 / 链接</th><th>发布日期</th><th>链接状态</th><th>被引用</th><th>备注</th><th>操作</th></tr>
              </thead>
              <tbody>
                {[...sources].sort((a, b) => a.tier.localeCompare(b.tier)).map((s) => (
                  <tr key={s.id}>
                    <td><span className={`badge badge-tier-${s.tier}`}>[{s.tier}]</span></td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{s.name}</div>
                      {s.publisher && <div style={{ fontSize: 12, color: "var(--muted)" }}>{s.publisher}</div>}
                    </td>
                    <td>
                      <div>{s.title}</div>
                      {s.url && (
                        <a href={s.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, wordBreak: "break-all" }}>
                          {s.url.length > 48 ? `${s.url.slice(0, 48)}…` : s.url}
                        </a>
                      )}
                    </td>
                    <td>{s.publishedAt ?? "—"}</td>
                    <td>
                      {s.linkStatus === "ok" && <span className="badge badge-tier-A">可访问</span>}
                      {s.linkStatus === "dead" && <span className="badge badge-error">已失效</span>}
                      {s.linkStatus === "unknown" && <span className="badge badge-info">未核验</span>}
                    </td>
                    <td className="num">{refCounts.get(s.id) ?? 0} 条</td>
                    <td style={{ fontSize: 12, color: "var(--muted)" }}>{s.note ?? ""}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <button className="btn btn-sm" onClick={() => setForm(toForm(s))}>编辑</button>{" "}
                      <button className="btn btn-sm btn-danger" onClick={() => onDelete(s)}>删</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
      {form && <SourceForm initial={form} onClose={() => setForm(null)} onSaved={() => { setForm(null); }} />}
    </>
  );
}
