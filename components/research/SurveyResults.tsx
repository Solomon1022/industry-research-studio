"use client";

import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { EChart } from "@/components/EChart";
import type { SurveyAnalysisResult } from "@/lib/research-types";

function format(value: number, digits = 4): string { return Number.isFinite(value) ? value.toFixed(digits) : "—"; }

export function SurveyResults({ result }: { result: SurveyAnalysisResult }) {
  const heatmapOption = useMemo<EChartsOption | null>(() => {
    if (!result.correlations.length) return null;
    const vars = result.descriptive.map((item) => item.variable);
    const data: Array<[number, number, number]> = [];
    vars.forEach((left, i) => vars.forEach((right, j) => {
      const value = i === j ? 1 : result.correlations.find((item) => (item.x === left && item.y === right) || (item.x === right && item.y === left))?.r;
      if (value !== undefined) data.push([j, i, value]);
    }));
    return {
      tooltip: {}, grid: { left: 110, right: 80, top: 20, bottom: 100 },
      xAxis: { type: "category", data: vars, axisLabel: { rotate: 45 } },
      yAxis: { type: "category", data: vars },
      visualMap: { min: -1, max: 1, calculable: true, orient: "vertical", right: 0, top: "center", inRange: { color: ["#315a8c", "#f5f7fa", "#b94a48"] } },
      series: [{ type: "heatmap", data }],
    };
  }, [result]);

  return (
    <>
      <section className="card">
        <h2 className="section-title">分析摘要</h2>
        <div className="kpi-grid"><div className="kpi"><b>{result.originalN}</b><span>原始样本</span></div><div className="kpi"><b>{result.analysisN}</b><span>分析样本</span></div><div className="kpi"><b>{result.exclusions.length}</b><span>规则排除</span></div><div className="kpi"><b>{result.reliability ? format(result.reliability.alpha) : "—"}</b><span>Cronbach α</span></div><div className="kpi"><b>{result.validity ? format(result.validity.kmo) : "—"}</b><span>KMO</span></div></div>
        {result.warnings.map((warning) => <div className="issue issue-warning" key={warning}>{warning}</div>)}
        <div className="table-scroll"><table className="data-table"><thead><tr><th>变量</th><th>N</th><th>缺失</th><th>均值</th><th>标准差</th><th>中位数</th><th>最小</th><th>最大</th></tr></thead><tbody>{result.descriptive.map((item) => <tr key={item.variable}><td>{item.variable}</td><td>{item.n}</td><td>{item.missing}</td><td>{format(item.mean)}</td><td>{format(item.sd)}</td><td>{format(item.median)}</td><td>{item.min}</td><td>{item.max}</td></tr>)}</tbody></table></div>
      </section>
      {heatmapOption && <section className="card"><h2 className="section-title">Pearson 相关矩阵</h2><EChart option={heatmapOption} height={Math.max(360, result.descriptive.length * 38 + 160)} /><div className="table-scroll"><table className="data-table"><thead><tr><th>变量 1</th><th>变量 2</th><th>N</th><th>r</th><th>p</th></tr></thead><tbody>{result.correlations.map((item) => <tr key={`${item.x}-${item.y}`}><td>{item.x}</td><td>{item.y}</td><td>{item.n}</td><td>{format(item.r)}</td><td>{format(item.p, 6)}</td></tr>)}</tbody></table></div></section>}
      {result.validity && <section className="card"><h2 className="section-title">效度检验</h2><p>KMO = {format(result.validity.kmo)}；Bartlett χ²({result.validity.bartlettDf}) = {format(result.validity.bartlettChiSquare, 3)}，p = {format(result.validity.bartlettP, 8)}。统计量仅按当前入选字段和完整样本计算。</p></section>}
      {result.mediation && <section className="card"><h2 className="section-title">Bootstrap 中介效应</h2><p>{result.mediation.x} → {result.mediation.m} → {result.mediation.y}</p><div className="kpi-grid"><div className="kpi"><b>{format(result.mediation.a)}</b><span>a：X → M</span></div><div className="kpi"><b>{format(result.mediation.b)}</b><span>b：M → Y（控制 X）</span></div><div className="kpi"><b>{format(result.mediation.indirect)}</b><span>间接效应 a×b</span></div><div className="kpi"><b>[{format(result.mediation.indirectCi95[0])}, {format(result.mediation.indirectCi95[1])}]</b><span>百分位 95% CI · {result.mediation.bootstrapIterations} 次</span></div></div><div className={`issue ${result.mediation.indirectCi95[0] * result.mediation.indirectCi95[1] > 0 ? "issue-ok" : "issue-warning"}`}>{result.mediation.indirectCi95[0] * result.mediation.indirectCi95[1] > 0 ? "置信区间不包含 0；仍需结合研究设计、共线性和稳健性检查解释。" : "置信区间包含 0，不应宣称间接效应显著。"}</div><div className="table-scroll"><table className="data-table"><thead><tr><th>模型</th><th>因变量</th><th>变量</th><th>系数</th><th>标准误</th><th>t</th><th>p</th><th>R²</th></tr></thead><tbody>{Object.entries(result.mediation.regressions).flatMap(([name, model]) => model.coefficients.map((item) => <tr key={`${name}-${item.variable}`}><td>{name}</td><td>{model.dependent}</td><td>{item.variable}</td><td>{format(item.coefficient)}</td><td>{format(item.standardError)}</td><td>{format(item.t)}</td><td>{format(item.p, 6)}</td><td>{format(model.r2)}</td></tr>))}</tbody></table></div></section>}
      <section className="card"><h2 className="section-title">清洗排除日志</h2><p className="section-desc">行号对应原始导入文件，表头为第 1 行。</p><div className="table-scroll"><table className="data-table"><thead><tr><th>原文件行号</th><th>原因</th></tr></thead><tbody>{result.exclusions.map((item) => <tr key={item.rowNumber}><td>{item.rowNumber}</td><td>{item.reasons.join("；")}</td></tr>)}</tbody></table></div></section>
    </>
  );
}
