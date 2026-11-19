"use client";

import { useMemo, useState } from "react";
import { analyzeSurvey } from "@/lib/stats/survey";
import { SurveyResults } from "./SurveyResults";
import type { CellValue, QuestionnaireDataset, SurveyAnalysisResult } from "@/lib/research-types";

function numericColumns(rows: Array<Record<string, CellValue>>, columns: string[]): string[] {
  return columns.filter((column) => {
    const valid = rows.map((row) => row[column]).filter((value) => value !== null && value !== undefined && String(value).trim() !== "");
    return valid.length > 0 && valid.filter((value) => Number.isFinite(Number(value))).length / valid.length >= 0.8;
  });
}

export function SurveyAnalyzer({ dataset, onSaved }: { dataset: QuestionnaireDataset; onSaved: (result: SurveyAnalysisResult) => void }) {
  const columns = useMemo(() => dataset.variables.map((variable) => variable.name), [dataset.variables]);
  const numeric = useMemo(() => numericColumns(dataset.rows, columns), [dataset, columns]);
  const [variables, setVariables] = useState<string[]>(numeric);
  const [min, setMin] = useState(1);
  const [max, setMax] = useState(5);
  const [straightline, setStraightline] = useState(true);
  const [reliability, setReliability] = useState(true);
  const [validity, setValidity] = useState(true);
  const [useMediation, setUseMediation] = useState(false);
  const [x, setX] = useState("");
  const [m, setM] = useState("");
  const [y, setY] = useState("");
  const [controls, setControls] = useState("");
  const [bootstrap, setBootstrap] = useState(2000);
  const [result, setResult] = useState<SurveyAnalysisResult | undefined>(dataset.analysis);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const analyze = async () => {
    setBusy(true); setMessage("");
    await new Promise((resolve) => setTimeout(resolve, 30));
    try {
      const next = analyzeSurvey({
        rows: dataset.rows, variables, min, max, checkStraightline: straightline, reliability, validity,
        mediation: useMediation ? { x, m, y, controls: controls.split(/[，,]/).map((item) => item.trim()).filter(Boolean), bootstrapIterations: bootstrap } : undefined,
      });
      setResult(next); onSaved(next);
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  };

  return (
    <>
      <section className="card">
        <h2 className="section-title">{dataset.name}</h2>
        <p className="section-desc">{dataset.rows.length} 行 × {columns.length} 列；识别到 {numeric.length} 个主要数值字段</p>
        <details><summary>预览原始数据（前 8 行）</summary><div className="table-scroll"><table className="data-table"><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{dataset.rows.slice(0, 8).map((row, index) => <tr key={index}>{columns.map((column) => <td key={column}>{String(row[column] ?? "")}</td>)}</tr>)}</tbody></table></div></details>
        <h3 style={{ marginTop: 20 }}>选择量表与分析字段</h3>
        <div className="variable-grid">
          {columns.map((column) => <label key={column} className="checkbox-field"><input type="checkbox" checked={variables.includes(column)} onChange={() => setVariables((current) => current.includes(column) ? current.filter((item) => item !== column) : [...current, column])} />{column}{!numeric.includes(column) ? "（非主要数值）" : ""}</label>)}
        </div>
        <div className="form-grid" style={{ marginTop: 16 }}>
          <div className="field col-3"><label>量表最小值</label><input className="input" type="number" value={min} onChange={(event) => setMin(Number(event.target.value))} /></div>
          <div className="field col-3"><label>量表最大值</label><input className="input" type="number" value={max} onChange={(event) => setMax(Number(event.target.value))} /></div>
          <label className="field col-3 checkbox-field"><input type="checkbox" checked={straightline} onChange={(event) => setStraightline(event.target.checked)} />排除直线作答</label>
          <label className="field col-3 checkbox-field"><input type="checkbox" checked={reliability} onChange={(event) => setReliability(event.target.checked)} />Cronbach α</label>
          <label className="field col-3 checkbox-field"><input type="checkbox" checked={validity} onChange={(event) => setValidity(event.target.checked)} />KMO / Bartlett</label>
          <label className="field col-3 checkbox-field"><input type="checkbox" checked={useMediation} onChange={(event) => setUseMediation(event.target.checked)} />Bootstrap 中介效应</label>
        </div>
        {useMediation && (
          <div className="form-grid mediation-config">
            <div className="field col-3"><label>自变量 X</label><select className="select" value={x} onChange={(event) => setX(event.target.value)}><option value="">请选择</option>{variables.map((variable) => <option key={variable}>{variable}</option>)}</select></div>
            <div className="field col-3"><label>中介变量 M</label><select className="select" value={m} onChange={(event) => setM(event.target.value)}><option value="">请选择</option>{variables.map((variable) => <option key={variable}>{variable}</option>)}</select></div>
            <div className="field col-3"><label>因变量 Y</label><select className="select" value={y} onChange={(event) => setY(event.target.value)}><option value="">请选择</option>{variables.map((variable) => <option key={variable}>{variable}</option>)}</select></div>
            <div className="field col-6"><label>控制变量（逗号分隔）</label><input className="input" value={controls} onChange={(event) => setControls(event.target.value)} /></div>
            <div className="field col-3"><label>Bootstrap 次数</label><select className="select" value={bootstrap} onChange={(event) => setBootstrap(Number(event.target.value))}><option value={1000}>1000</option><option value={2000}>2000</option><option value={5000}>5000</option></select></div>
          </div>
        )}
        <button className="btn btn-primary" disabled={busy || variables.length < 2 || (useMediation && (!x || !m || !y))} onClick={analyze}>{busy ? "正在计算真实数据…" : "运行统计分析"}</button>
        {message && <div className="issue issue-error" style={{ marginTop: 12 }}>{message}</div>}
      </section>
      {result && <SurveyResults result={result} />}
    </>
  );
}
