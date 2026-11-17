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
        { href: `/projects/${projectId}`, label: "数据录入" },
        { href: `/projects/${projectId}/sources`, label: "来源管理" },
        { href: `/projects/${projectId}/charts`, label: "可视化" },
        { href: `/projects/${projectId}/report`, label: "报告导出" },
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
