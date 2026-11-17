"use client";

/** 项目工作台 · 数据录入：六维切换 + 维度指南 + 数据点表格 + 录入/编辑表单 + 实时校验 */

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { Topbar } from "@/components/Topbar";
import { deleteDataPoint, upsertDataPoint } from "@/lib/db";
import { DIMENSION_GUIDES } from "@/lib/framework";
import { useDataPoints, useProject, useSources } from "@/lib/use-data";
import { validateProject } from "@/lib/validation";
import {
  DIMENSION_LABELS, METRIC_KINDS, METRIC_KIND_LABELS,
  type DataPoint, type Dimension, type MetricKind, type Source,
} from "@/lib/types";

// ============ 数据点表单 ============

interface FormState {
  id?: string;
  metric: string;
  subject: string;
  kind: MetricKind;
  value: string;
  unit: string;
  currency: string;
  period: string;
  scopeLabel: string;
  scopeDetail: string;
  forecast: boolean;
  sourceId: string;
  text: string;
  note: string;
}

const emptyForm = (dim: Dimension, sourceId: string): FormState => ({
  metric: "", subject: "", kind: dim === "policy" || dim === "investment" ? "text" : "gmv",
  value: "", unit: "亿元", currency: "CNY", period: "",
  scopeLabel: "", scopeDetail: "", forecast: false, sourceId, text: "", note: "",
});

function DataPointForm({
  projectId, dimension, sources, initial, onClose, onSaved,
}: {
  projectId: string;
  dimension: Dimension;
  sources: Source[];
  initial: FormState;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState<FormState>(initial);
  const [error, setError] = useState("");
  const isText = f.kind === "text";
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!f.metric.trim()) return setError("请填写指标名称");
    if (!f.period.trim()) return setError("请填写时间（年份或日期，如 2025 / 2024-06-18）");
    if (!f.scopeLabel.trim()) return setError("请填写口径标签（如 GMV口径 / 支付口径 / MAU去重）");
    if (!f.sourceId) return setError("必须选择来源——每个数据都必须可追溯");
    if (isText) {
      if (!f.text.trim()) return setError("文本条目需要填写内容");
    } else {
      if (f.value.trim() === "" || Number.isNaN(Number(f.value))) return setError("请填写有效数值");
      if (!f.unit.trim()) return setError("请填写单位（亿元 / % / 亿人次…）");
    }
    await upsertDataPoint({
      ...(f.id ? { id: f.id } : {}),
      projectId, dimension,
      metric: f.metric.trim(),
      subject: f.subject.trim() || undefined,
      kind: f.kind,
      value: isText ? null : Number(f.value),
      unit: isText ? "" : f.unit.trim(),
      currency: f.currency || "CNY",
      period: f.period.trim(),
      scope: { label: f.scopeLabel.trim(), detail: f.scopeDetail.trim() || undefined },
      forecast: f.forecast,
      sourceId: f.sourceId,
      text: isText ? f.text.trim() : undefined,
      note: f.note.trim() || undefined,
    });
    onSaved();
  };

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="数据点编辑">
        <h3>{f.id ? "编辑数据点" : "新增数据点"} · {DIMENSION_LABELS[dimension]}</h3>
        <div className="form-grid">
          <div className="field col-8">
            <label htmlFor="dp-metric">指标名称 *</label>
            <input id="dp-metric" className="input" placeholder="如：直播电商市场规模" value={f.metric} onChange={(e) => set("metric", e.target.value)} />
          </div>
          <div className="field col-4">
            <label htmlFor="dp-kind">指标类型 *</label>
            <select id="dp-kind" className="select" value={f.kind} onChange={(e) => set("kind", e.target.value as MetricKind)}>
              {METRIC_KINDS.map((k) => <option key={k} value={k}>{METRIC_KIND_LABELS[k]}</option>)}
            </select>
          </div>
          <div className="field col-6">
            <label htmlFor="dp-subject">主体（可选）</label>
            <input id="dp-subject" className="input" placeholder="竞争格局常用，如：抖音 / 京东云言犀" value={f.subject} onChange={(e) => set("subject", e.target.value)} />
          </div>
          <div className="field col-6">
            <label htmlFor="dp-period">时间 *</label>
            <input id="dp-period" className="input" placeholder="年份 2025，或日期 2024-06-18" value={f.period} onChange={(e) => set("period", e.target.value)} />
          </div>
          {!isText && (
            <>
              <div className="field col-4">
                <label htmlFor="dp-value">数值 *</label>
                <input id="dp-value" className="input" inputMode="decimal" placeholder="如：69461" value={f.value} onChange={(e) => set("value", e.target.value)} />
              </div>
              <div className="field col-4">
                <label htmlFor="dp-unit">单位 *</label>
                <input id="dp-unit" className="input" placeholder="亿元 / % / 亿人次" value={f.unit} onChange={(e) => set("unit", e.target.value)} />
              </div>
              <div className="field col-4">
                <label htmlFor="dp-currency">币种</label>
                <input id="dp-currency" className="input" value={f.currency} onChange={(e) => set("currency", e.target.value)} />
              </div>
            </>
          )}
          <div className="field col-6">
            <label htmlFor="dp-scope">口径标签 *</label>
            <input id="dp-scope" className="input" placeholder="如：GMV口径（含退货/店播）" value={f.scopeLabel} onChange={(e) => set("scopeLabel", e.target.value)} />
            <span className="hint">同一指标的不同口径会拆分为独立序列，绝不混用</span>
          </div>
          <div className="field col-6">
            <label htmlFor="dp-source">来源 *</label>
            <select id="dp-source" className="select" value={f.sourceId} onChange={(e) => set("sourceId", e.target.value)}>
              <option value="">— 选择来源（必填） —</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>[{s.tier}] {s.name}《{s.title}》</option>
              ))}
            </select>
            <span className="hint">没有合适来源？先到「来源管理」登记</span>
          </div>
          {isText && (
            <div className="field col-12">
              <label htmlFor="dp-text">内容 *</label>
              <textarea id="dp-text" className="textarea" placeholder="政策条文、案例描述、观点…" value={f.text} onChange={(e) => set("text", e.target.value)} />
            </div>
          )}
          <div className="field col-12">
            <label htmlFor="dp-note">备注</label>
            <input id="dp-note" className="input" placeholder="样本量、调研方式、口径冲突说明等" value={f.note} onChange={(e) => set("note", e.target.value)} />
          </div>
          <div className="col-12" style={{ marginBottom: 12 }}>
            <label className="checkbox-row">
              <input type="checkbox" checked={f.forecast} onChange={(e) => set("forecast", e.target.checked)} />
              这是机构预测值（报告中标注「E」，图表以虚线区分）
            </label>
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

// ============ 页面 ============

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { project, loading: pLoading } = useProject(id);
  const { dataPoints } = useDataPoints(id);
  const { sources } = useSources();
  const [activeDim, setActiveDim] = useState<Dimension>("market");
  const [form, setForm] = useState<FormState | null>(null);

  const issues = useMemo(() => {
    if (!project || !dataPoints || !sources) return [];
    return validateProject({ project, dataPoints, sources });
  }, [project, dataPoints, sources]);

  if (pLoading || project === undefined) {
    return <><Topbar /><main className="main"><div className="empty">正在载入…</div></main></>;
  }
  if (project === null) {
    return <><Topbar /><main className="main"><div className="empty"><div className="empty-title">项目不存在</div><p><Link href="/">返回项目列表</Link></p></div></main></>;
  }

  const dims = project.dimensions.includes(activeDim)
    ? project.dimensions
    : [...project.dimensions, activeDim];
  const points = (dataPoints ?? []).filter((d) => d.dimension === activeDim);
  const sourceMap = new Map((sources ?? []).map((s) => [s.id, s]));
  const guide = DIMENSION_GUIDES.find((g) => g.dimension === activeDim);
  const dimIssues = issues.filter((i) => {
    if (!i.dataPointId) return i.rule === "dimension-empty" && i.message.includes(DIMENSION_LABELS[activeDim]);
    return points.some((p) => p.id === i.dataPointId);
  });

  const toForm = (dp: DataPoint): FormState => ({
    id: dp.id, metric: dp.metric, subject: dp.subject ?? "", kind: dp.kind,
    value: dp.value === null ? "" : String(dp.value), unit: dp.unit, currency: dp.currency ?? "CNY",
    period: dp.period, scopeLabel: dp.scope.label, scopeDetail: dp.scope.detail ?? "",
    forecast: dp.forecast, sourceId: dp.sourceId, text: dp.text ?? "", note: dp.note ?? "",
  });

  return (
    <>
      <Topbar projectId={id} projectName={project.name} />
      <main className="main">
        <nav className="dim-tabs" aria-label="研究维度">
          {dims.map((d) => {
            const count = (dataPoints ?? []).filter((x) => x.dimension === d).length;
            return (
              <button key={d} className={`dim-tab${d === activeDim ? " active" : ""}`} onClick={() => setActiveDim(d)}>
                {DIMENSION_LABELS[d]}<span className="count">{count}</span>
              </button>
            );
          })}
        </nav>

        {guide && (
          <div className="guide" style={{ marginBottom: 16 }}>
            <h4>{DIMENSION_LABELS[activeDim]} · 要回答的问题</h4>
            <p style={{ margin: "4px 0" }}>{guide.questions.join(" / ")}</p>
            <ul>
              {guide.keyMetrics.map((m) => (
                <li key={m.name}><strong>{m.name}</strong> <span className="plain">— {m.plain}</span></li>
              ))}
            </ul>
            <p className="plain" style={{ margin: "6px 0 0" }}>
              ⚠ 口径陷阱：{guide.pitfalls.join("；")}<br />
              来源指向：{guide.sourceHints.join("、")}
            </p>
          </div>
        )}

        {dimIssues.length > 0 && (
          <div className="issue-list" style={{ marginBottom: 16 }}>
            {dimIssues.slice(0, 5).map((iss, i) => (
              <div key={i} className={`issue issue-${iss.level}`}>
                <span className={`badge ${iss.level === "error" ? "badge-error" : iss.level === "warning" ? "badge-warning" : "badge-info"}`}>{iss.level === "error" ? "错误" : iss.level === "warning" ? "警告" : "提示"}</span>
                <span style={{ flex: 1 }}>{iss.message}</span>
                <span className="issue-rule">{iss.rule}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h1 className="section-title" style={{ fontSize: 16, margin: 0 }}>
            数据点 <span style={{ color: "var(--muted)", fontWeight: 400 }}>({points.length})</span>
          </h1>
          <button
            className="btn btn-primary"
            onClick={() => setForm(emptyForm(activeDim, sources?.[0]?.id ?? ""))}
          >
            + 新增数据点
          </button>
        </div>

        {points.length === 0 ? (
          <div className="empty">
            <div className="empty-title">本维度暂无数据点</div>
            <p>点击「新增数据点」，每条数据都需要绑定来源并声明口径。</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <colgroup>
                <col style={{ width: "9%" }} /><col style={{ width: "22%" }} /><col style={{ width: "13%" }} />
                <col style={{ width: "18%" }} /><col style={{ width: "16%" }} /><col style={{ width: "14%" }} /><col style={{ width: "8%" }} />
              </colgroup>
              <thead>
                <tr><th>时间</th><th>指标 / 内容</th><th>数值</th><th>口径</th><th>来源</th><th>备注</th><th>操作</th></tr>
              </thead>
              <tbody>
                {[...points]
                  .sort((a, b) => String(a.period).localeCompare(String(b.period)))
                  .map((dp) => {
                    const src = dp.sourceId ? sourceMap.get(dp.sourceId) : undefined;
                    return (
                      <tr key={dp.id}>
                        <td>{dp.period}</td>
                        <td>
                          <div>{dp.metric}{dp.subject ? `（${dp.subject}）` : ""}</div>
                          {dp.text && <div style={{ color: "var(--muted)", fontSize: 12 }}>{dp.text.length > 60 ? `${dp.text.slice(0, 60)}…` : dp.text}</div>}
                        </td>
                        <td className="num">
                          {dp.value === null ? "—" : `${dp.value.toLocaleString("zh-CN")} ${dp.unit}`}
                          {dp.forecast && <> <span className="badge badge-forecast">E</span></>}
                        </td>
                        <td><span className="tag-scope">{dp.scope.label}</span></td>
                        <td>
                          {src ? (
                            <span className={`badge badge-tier-${src.tier}`} title={src.title}>[{src.tier}] {src.name}</span>
                          ) : (
                            <span className="badge badge-error">⚠ 缺来源</span>
                          )}
                        </td>
                        <td style={{ fontSize: 12, color: "var(--muted)" }}>{dp.note ?? ""}</td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          <button className="btn btn-sm" onClick={() => setForm(toForm(dp))}>编辑</button>{" "}
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={async () => {
                              if (window.confirm("删除该数据点？")) { await deleteDataPoint(dp.id); }
                            }}
                          >删</button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </main>
      {form && (
        <DataPointForm
          projectId={id}
          dimension={activeDim}
          sources={sources ?? []}
          initial={form}
          onClose={() => setForm(null)}
          onSaved={() => { setForm(null); }}
        />
      )}
    </>
  );
}
