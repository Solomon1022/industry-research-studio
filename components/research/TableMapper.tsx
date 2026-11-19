"use client";

import { useMemo, useState } from "react";
import { assessCandidate } from "@/lib/evidence-score";
import { saveCandidateRows } from "@/lib/research-workflow";
import type { CandidateMapping, CellValue, EvidenceTable } from "@/lib/research-types";
import { DIMENSIONS, DIMENSION_LABELS, type Dimension, type Source } from "@/lib/types";

function asText(value: CellValue | undefined): string { return String(value ?? ""); }
function asNumber(value: CellValue | undefined): number | null {
  const number = Number(asText(value).replace(/,/g, "").replace(/%$/, ""));
  return Number.isFinite(number) && asText(value) ? number : null;
}

export function TableMapper({ projectId, table, source, onSaved }: {
  projectId: string;
  table: EvidenceTable;
  source: Source;
  onSaved: (count: number) => void;
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [mapping, setMapping] = useState<CandidateMapping>({ dimension: "market", metric: 0, period: 1, value: 2, unit: -1, scope: -1, subject: -1, forecast: false });
  const [defaultUnit, setDefaultUnit] = useState("");
  const [defaultScope, setDefaultScope] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const firstAssessment = useMemo(() => {
    const index = [...selected][0];
    if (index === undefined) return null;
    const row = table.rows[index];
    return assessCandidate({
      source, period: asText(row[mapping.period]), value: mapping.dimension === "policy" ? asText(row[mapping.value]) : asNumber(row[mapping.value]),
      unit: mapping.dimension === "policy" ? "文本" : mapping.unit >= 0 ? asText(row[mapping.unit]) : defaultUnit,
      scope: mapping.scope >= 0 ? asText(row[mapping.scope]) : defaultScope,
    });
  }, [selected, table.rows, mapping, source, defaultUnit, defaultScope]);

  const columnSelect = (label: string, key: keyof CandidateMapping, optional = false) => (
    <div className="field col-3">
      <label>{label}</label>
      <select className="select" aria-label={label} value={Number(mapping[key])} onChange={(event) => setMapping({ ...mapping, [key]: Number(event.target.value) })}>
        {optional && <option value={-1}>使用统一填写 / 不使用</option>}
        {table.headers.map((header, index) => <option key={`${header}-${index}`} value={index}>{index + 1}. {header || `列 ${index + 1}`}</option>)}
      </select>
    </div>
  );

  const toggle = (index: number) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index); else next.add(index);
      return next;
    });
  };

  const save = async () => {
    setBusy(true); setMessage("");
    try {
      const result = await saveCandidateRows({ projectId, source, headers: table.headers, rows: table.rows, selectedIndexes: [...selected], mapping, defaultUnit, defaultScope });
      setMessage(`已入选 ${result.saved.length} 个数据点。${result.skipped.length ? `跳过：${result.skipped.join("；")}` : ""}`);
      onSaved(result.saved.length);
      setSelected(new Set());
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  };

  return (
    <div className="mapper">
      <div className="issue issue-info">
        先选行，再告诉系统每一列是什么。论文可用性按“来源可追溯、时间明确、数值可解析、单位与口径齐全”逐项检查；A 级只是来源优先级，不代表内容自动正确。
      </div>
      <div className="table-scroll mapper-table">
        <table className="data-table">
          <thead><tr><th>选用</th><th>原行</th>{table.headers.map((header, index) => <th key={index}>{header || `列 ${index + 1}`}</th>)}</tr></thead>
          <tbody>
            {table.rows.slice(0, 150).map((row, index) => (
              <tr key={index}>
                <td><input type="checkbox" aria-label={`选择原表第 ${index + 2} 行`} checked={selected.has(index)} onChange={() => toggle(index)} /></td>
                <td>{index + 2}</td>
                {table.headers.map((_, column) => <td key={column}>{asText(row[column])}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {table.rows.length > 150 && <p className="hint">预览前 150 行；保存逻辑仍处理所有已选行。</p>}
      <div className="form-grid" style={{ marginTop: 16 }}>
        <div className="field col-3">
          <label>论文章节 / 行业维度</label>
          <select className="select" aria-label="论文章节或行业维度" value={mapping.dimension} onChange={(event) => setMapping({ ...mapping, dimension: event.target.value as Dimension })}>
            {DIMENSIONS.map((dimension) => <option key={dimension} value={dimension}>{DIMENSION_LABELS[dimension]}</option>)}
          </select>
        </div>
        {columnSelect("指标列", "metric")}
        {columnSelect("时间列", "period")}
        {columnSelect("数值列", "value")}
        {columnSelect("单位列", "unit", true)}
        {columnSelect("统计口径列", "scope", true)}
        {columnSelect("主体列（可选）", "subject", true)}
        <div className="field col-3">
          <label>统一单位</label>
          <input className="input" aria-label="统一单位" placeholder="例如：亿元 / % / 万人" value={defaultUnit} onChange={(event) => setDefaultUnit(event.target.value)} disabled={mapping.unit >= 0} />
        </div>
        <div className="field col-6">
          <label>统一统计口径</label>
          <input className="input" aria-label="统一统计口径" placeholder="例如：中国大陆；2025 全年；GMV 口径" value={defaultScope} onChange={(event) => setDefaultScope(event.target.value)} disabled={mapping.scope >= 0} />
        </div>
        <label className="field col-3 checkbox-field"><input type="checkbox" checked={mapping.forecast} onChange={(event) => setMapping({ ...mapping, forecast: event.target.checked })} /> 机构预测（标记 E）</label>
      </div>
      {firstAssessment && (
        <div className={`issue issue-${firstAssessment.verdict === "recommended" ? "ok" : firstAssessment.verdict === "review" ? "warning" : "error"}`}>
          首条选中记录：{firstAssessment.verdict === "recommended" ? "字段完整，可入选" : firstAssessment.verdict === "review" ? "需复核，但允许人工入选" : "缺关键字段，将阻止入选"}（{firstAssessment.score}/100）
          <ul>{firstAssessment.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
        </div>
      )}
      <button className="btn btn-primary" disabled={busy || !selected.size} onClick={save}>{busy ? "保存中…" : `保存为入选数据（${selected.size}）`}</button>
      {message && <div className="issue issue-info" style={{ marginTop: 12 }} role="status">{message}</div>}
    </div>
  );
}
