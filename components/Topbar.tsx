"use client";

/** 顶栏：品牌 + 项目内导航（有 projectId 时显示） */

import Link from "next/link";
import { usePathname } from "next/navigation";

interface TopbarProps {
  projectId?: string;
  projectName?: string;
}

export function Topbar({ projectId, projectName }: TopbarProps) {
  const pathname = usePathname();
  const tabs = projectId
    ? [
        { href: `/projects/${projectId}/research`, label: "研究中心" },
        { href: `/projects/${projectId}/thesis`, label: "论文数据" },
        { href: `/projects/${projectId}/survey`, label: "问卷分析" },
        { href: `/projects/${projectId}`, label: "数据管理" },
        { href: `/projects/${projectId}/sources`, label: "来源" },
        { href: `/projects/${projectId}/charts`, label: "图表" },
        { href: `/projects/${projectId}/export`, label: "完整导出" },
        { href: `/projects/${projectId}/settings`, label: "模型设置" },
      ]
    : [];

  return (
    <header className="topbar">
      <Link href="/" className="brand">
        <span className="brand-mark">◧</span> Industry Research Studio
      </Link>
      {projectId && (
        <nav aria-label="项目导航">
          {tabs.map((t) => {
            const active = pathname === t.href;
            return (
              <Link key={t.href} href={t.href} className={active ? "active" : ""}>
                {t.label}
              </Link>
            );
          })}
        </nav>
      )}
      <span className="spacer" />
      {projectName && (
        <span style={{ color: "var(--muted)", fontSize: 13 }}>{projectName}</span>
      )}
      <a
        href="https://github.com/Solomon1022/industry-research-studio"
        target="_blank"
        rel="noreferrer"
        style={{ fontSize: 13 }}
      >
        GitHub
      </a>
    </header>
  );
}
