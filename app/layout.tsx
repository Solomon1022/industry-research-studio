import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Industry Research Studio · 行业研究工作台",
    template: "%s · Industry Research Studio",
  },
  description:
    "六维行业背调工作台：结构化录入、来源分级与口径管控、可视化与一键报告导出。数据保真，全程可追溯。开源（MIT）。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="app-shell">{children}</div>
      </body>
    </html>
  );
}
