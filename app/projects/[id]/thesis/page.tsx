"use client";

import { use, useMemo, useState } from "react";
import { Topbar } from "@/components/Topbar";
import { buildThesisDataPlan } from "@/lib/evidence-score";
import { updateProject } from "@/lib/db";
import { useDataPoints, useProject, useSources } from "@/lib/use-data";
import type { Project } from "@/lib/types";

function splitTerms(value: string): string[] { return value.split(/[，,\n]/).map((item) => item.trim()).filter(Boolean); }

function ThesisEditor({ project }: { project: Project }) {
  const { dataPoints } = useDataPoints(project.id);
  const { sources } = useSources();
  const [question, setQuestion] = useState(project.thesis?.researchQuestions.join("\n") ?? "");
  const [x, setX] = useState(project.thesis?.independentVar ?? "");
  const [m, setM] = useState(project.thesis?.mediator ?? "");
  const [y, setY] = useState(project.thesis?.dependentVar ?? "");
  const [controls, setControls] = useState(project.thesis?.controls.join("，") ?? "");
  const [references, setReferences] = useState(project.thesis?.fixedReferences.join("\n") ?? "");
  const [message, setMessage] = useState("");
  const plan = useMemo(() => buildThesisDataPlan(dataPoints ?? [], sources ?? []), [dataPoints, sources]);

  const save = async () => {
    await updateProject(project.id, { thesis: {
      researchQuestions: question.split("\n").map((item) => item.trim()).filter(Boolean), independentVar: x.trim(), mediator: m.trim(),
      dependentVar: y.trim(), controls: splitTerms(controls), fixedReferences: references.split("\n").map((item) => item.trim()).filter(Boolean),
    } });
    setMessage("研究配置已保存；既有数据点、来源与图表未被修改");
  };

  return (
    <>
      <section className="card">
        <h2 className="section-title">研究问题与变量</h2>
        <p className="section-desc">这里管理论文需要哪些数据，不自动编造论文正文、问卷样本或参考文献。</p>
        <div className="field"><label htmlFor="thesis-question">论文题目 / 研究问题</label><textarea id="thesis-question" className="textarea" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="例如：AI 虚拟主播的直播互动性如何影响消费者购买意愿？" /></div>
        <div className="form-grid">
          <div className="field col-6"><label htmlFor="thesis-x">自变量 X</label><input id="thesis-x" className="input" value={x} onChange={(event) => setX(event.target.value)} placeholder="互动性、信息性、娱乐性" /></div>
          <div className="field col-6"><label htmlFor="thesis-m">中介变量 M</label><input id="thesis-m" className="input" value={m} onChange={(event) => setM(event.target.value)} placeholder="社会临场感" /></div>
          <div className="field col-6"><label htmlFor="thesis-y">因变量 Y</label><input id="thesis-y" className="input" value={y} onChange={(event) => setY(event.target.value)} placeholder="购买意愿" /></div>
          <div className="field col-6"><label htmlFor="thesis-controls">控制变量</label><input id="thesis-controls" className="input" value={controls} onChange={(event) => setControls(event.target.value)} placeholder="性别、年龄、观看频率" /></div>
        </div>
        <button className="btn btn-primary" onClick={save}>保存研究配置</button>
        {message && <div className="issue issue-ok" style={{ marginTop: 12 }}>{message}</div>}
      </section>

      <section className="card">
        <h2 className="section-title">论文数据清单</h2>
        <p className="section-desc">二手数据用于研究背景、行业现状和变量关系的外部证据；一手问卷用于信效度、相关、回归和中介检验，两者不能互相替代。</p>
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>模块</th><th>研究用途</th><th>当前入选</th><th>时间范围</th><th>来源数</th><th>仍需处理</th></tr></thead>
            <tbody>{plan.map((row) => <tr key={row.dimension}><td>{row.dimensionLabel}</td><td>{row.recommendedUse}</td><td>{row.pointCount}</td><td>{row.periods.join("、") || "—"}</td><td>{row.sourceCount}</td><td>{row.gaps.join("；")}</td></tr>)}</tbody>
          </table>
        </div>
        <div className="guide" style={{ marginTop: 16 }}>
          <h4>一条数据进入论文前</h4>
          <ol>
            <li>回到原文核对指标名称、年份、单位、样本范围和统计口径，不能只看搜索摘要。</li>
            <li>同一趋势图尽量使用同一机构、同一口径；跨来源并列时必须分别标注，不能拼成连续时间序列。</li>
            <li>预测值标 E；无法确认口径或原文不可访问时保留证据，但不要写成确定事实。</li>
            <li>二手行业数据不能替代你自己的问卷样本；真实问卷导入后到「问卷分析」运行统计。</li>
          </ol>
        </div>
      </section>

      <section className="card">
        <h2 className="section-title">用户固定文献清单</h2>
        <p className="section-desc">只有你已经提供并确认的文献才能粘贴在这里。系统不自动生成文献，也不把搜索标题当参考文献。</p>
        <textarea className="textarea fixed-references" value={references} onChange={(event) => setReferences(event.target.value)} placeholder="每行一条完整、真实的文献记录；留空则导出时不生成固定文献清单" />
        <button className="btn" style={{ marginTop: 12 }} onClick={save}>保存固定文献</button>
      </section>
    </>
  );
}

export default function ThesisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { project } = useProject(id);
  return <><Topbar projectId={id} projectName={project?.name} /><main className="main"><h1 className="section-title">论文数据工作台</h1><p className="section-desc">把研究问题、变量、证据和真实问卷放在同一条可复核的数据链路中。</p>{project && <ThesisEditor project={project} />}</main></>;
}
