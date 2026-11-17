"use client";

/** 首页：项目仪表盘 —— 项目列表 + 新建/删除/复制 + 产品方法论语 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Topbar } from "@/components/Topbar";
import {
  createProject, deleteProject, duplicateProject,
} from "@/lib/db";
import { useProjects, useProjectStats, useSeedOnBoot } from "@/lib/use-data";
import { DIMENSIONS, DIMENSION_LABELS, type Dimension, type Project } from "@/lib/types";

function NewProjectModal({ onClose, onCreated }: { onClose: () => void; onCreated: (p: Project) => void }) {
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [region, setRegion] = useState("中国");
  const [periodRange, setPeriodRange] = useState("");
  const [dims, setDims] = useState<Dimension[]>([...DIMENSIONS]);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const toggleDim = (d: Dimension) =>
    setDims((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  const submit = async () => {
    if (!name.trim()) return setError("请填写研究对象名称");
    if (!industry.trim()) return setError("请填写行业/赛道边界");
    if (!periodRange.trim()) return setError("请填写研究时间范围（如 2017-2025）");
    if (dims.length === 0) return setError("至少选择一个研究维度");
    const p = await createProject({
      name: name.trim(), industry: industry.trim(), region: region.trim() || "中国",
      periodRange: periodRange.trim(), dimensions: dims, status: "draft", note: note.trim() || undefined,
    });
    onCreated(p);
  };

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="新建研究项目">
        <h3>新建研究项目</h3>
        <div className="field">
          <label htmlFor="np-name">研究对象 *</label>
          <input id="np-name" className="input" placeholder="如：直播电商与 AI 虚拟主播" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="form-grid">
          <div className="field col-6">
            <label htmlFor="np-industry">行业/赛道边界 *</label>
            <input id="np-industry" className="input" placeholder="如：直播电商 / 数字人技术应用" value={industry} onChange={(e) => setIndustry(e.target.value)} />
          </div>
          <div className="field col-3">
            <label htmlFor="np-region">地域范围</label>
            <input id="np-region" className="input" value={region} onChange={(e) => setRegion(e.target.value)} />
          </div>
          <div className="field col-3">
            <label htmlFor="np-period">研究时段 *</label>
            <input id="np-period" className="input" placeholder="如：2017-2025" value={periodRange} onChange={(e) => setPeriodRange(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label>研究维度（默认六维全集）</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {DIMENSIONS.map((d) => (
              <label key={d} className="checkbox-row">
                <input type="checkbox" checked={dims.includes(d)} onChange={() => toggleDim(d)} />
                {DIMENSION_LABELS[d]}
              </label>
            ))}
          </div>
        </div>
        <div className="field">
          <label htmlFor="np-note">备注</label>
          <textarea id="np-note" className="textarea" placeholder="研究目的、口径约定等（可选）" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        {error && <p style={{ color: "var(--danger)", fontSize: 13 }}>{error}</p>}
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={submit}>创建项目</button>
        </div>
      </div>
    </div>
  );
}

interface ProjectCardProps {
  project: Project;
}

function ProjectCard({ project }: ProjectCardProps) {
  const stats = useProjectStats(project.id);

  const onDelete = async () => {
    if (!window.confirm(`确定删除项目「${project.name}」及其全部数据点？此操作不可恢复。`)) return;
    await deleteProject(project.id);
  };
  const onDuplicate = async () => {
    await duplicateProject(project.id);
  };

  return (
    <article className="project-card">
      <h3><Link href={`/projects/${project.id}`}>{project.name}</Link></h3>
      <div className="p-meta">{project.industry} · {project.region} · {project.periodRange}</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {project.dimensions.map((d) => (
          <span key={d} className="badge badge-dim">{DIMENSION_LABELS[d]}</span>
        ))}
      </div>
      <div className="p-stats">
        <span>数据点 <strong>{stats?.count ?? "…"}</strong></span>
        <span>引用来源 <strong>{stats?.sources ?? "…"}</strong></span>
        <span>{project.status === "done" ? "已完成" : project.status === "active" ? "进行中" : "草稿"}</span>
      </div>
      <div className="p-actions">
        <Link className="btn btn-sm btn-primary" href={`/projects/${project.id}`}>进入工作台</Link>
        <button className="btn btn-sm" onClick={onDuplicate}>复制</button>
        <button className="btn btn-sm btn-danger" onClick={onDelete}>删除</button>
      </div>
    </article>
  );
}

export default function Home() {
  const seeded = useSeedOnBoot();
  const { projects, loading } = useProjects();
  const [showNew, setShowNew] = useState(false);
  const router = useRouter();

  return (
    <>
      <Topbar />
      <main className="main">
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
          <div>
            <h1 className="section-title" style={{ fontSize: 22 }}>研究项目</h1>
            <p className="section-desc" style={{ marginBottom: 0 }}>
              六维行业背调：结构化录入 → 来源分级与口径管控 → 可视化 → 一键导出报告。数据仅存于本机浏览器。
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowNew(true)}>+ 新建研究项目</button>
        </div>

        {!seeded || loading ? (
          <div className="empty"><div className="empty-title">正在载入…</div></div>
        ) : projects && projects.length > 0 ? (
          <div className="project-grid">
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        ) : (
          <div className="empty">
            <div className="empty-title">还没有研究项目</div>
            <p>点击「新建研究项目」，按六大维度开始一次可追溯的行业背调。</p>
          </div>
        )}

        <section className="card" style={{ marginTop: 28 }}>
          <h2 className="section-title">方法论：六维背调框架</h2>
          <p className="section-desc">
            本产品将开源技能 <a href="https://github.com/Solomon1022/industry-research" target="_blank" rel="noreferrer">industry-research</a> 的工作流产品化：每条数据强制绑定来源，口径显式声明，预测值强制标 E，导出前通过保真校验。
          </p>
          <div className="dim-tabs" style={{ marginBottom: 0 }}>
            {DIMENSIONS.map((d) => (
              <span key={d} className="badge">{DIMENSION_LABELS[d]}</span>
            ))}
          </div>
        </section>
      </main>
      <footer className="footer">
        <span>Industry Research Studio · 开源（MIT）· 数据本地存储，不上传服务器</span>
        <span>示例数据：直播电商与 AI 虚拟主播（公开可溯源数据）</span>
      </footer>
      {showNew && <NewProjectModal onClose={() => setShowNew(false)} onCreated={(p) => { setShowNew(false); router.push(`/projects/${p.id}`); }} />}
    </>
  );
}
