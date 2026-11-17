/**
 * 导出逻辑单元测试：Markdown 与打印版 HTML 的结构与口径标注
 */

import { describe, expect, it } from "vitest";
import { exportMarkdown, summarize } from "@/lib/export/markdown";
import { exportPrintHtml } from "@/lib/export/print-html";
import type { DataPoint, Project, Source } from "@/lib/types";

const now = Date.now();

const project: Project = {
  id: "p-1", name: "直播电商与 AI 虚拟主播", industry: "直播电商", region: "中国",
  periodRange: "2017-2025", dimensions: ["market", "policy"], status: "done",
  createdAt: now, updatedAt: now,
};

const sources: Source[] = [
  {
    id: "s-1", name: "网经社电数宝", title: "2025年度报告", tier: "B",
    linkStatus: "ok", publishedAt: "2026-03", url: "https://www.100ec.cn/",
    createdAt: now, updatedAt: now,
  },
];

const points: DataPoint[] = [
  {
    id: "d-1", projectId: "p-1", dimension: "market", metric: "市场规模",
    value: 53256, unit: "亿元", period: "2024", kind: "gmv",
    scope: { label: "GMV口径" }, forecast: false, sourceId: "s-1",
    createdAt: now, updatedAt: now,
  },
  {
    id: "d-2", projectId: "p-1", dimension: "market", metric: "市场规模",
    value: 69461, unit: "亿元", period: "2025", kind: "gmv",
    scope: { label: "GMV口径" }, forecast: true, sourceId: "s-1",
    createdAt: now, updatedAt: now,
  },
  {
    id: "d-3", projectId: "p-1", dimension: "policy", metric: "监管框架",
    value: null, unit: "", period: "2024", kind: "text",
    scope: { label: "法规原文" }, forecast: false, sourceId: "s-1",
    text: "《电子商务法》覆盖直播营销。",
    createdAt: now, updatedAt: now,
  },
];

describe("exportMarkdown", () => {
  const md = exportMarkdown({ project, dataPoints: points, sources });

  it("含标题、项目元信息与维度章节", () => {
    expect(md).toContain("# 直播电商与 AI 虚拟主播 · 行业背调报告");
    expect(md).toContain("## 市场规模与增速");
    expect(md).toContain("## 政策与监管");
  });

  it("预测值标注（E），数值带单位", () => {
    expect(md).toContain("53,256 亿元");
    expect(md).toContain("69,461 亿元（E）");
  });

  it("口径列与来源列完整", () => {
    expect(md).toContain("GMV口径");
    expect(md).toContain("网经社电数宝 · 2026-03");
  });

  it("文本条目以列表呈现", () => {
    expect(md).toContain("《电子商务法》覆盖直播营销。");
  });

  it("附来源列表（含分级）与免责声明", () => {
    expect(md).toContain("## 数据来源");
    expect(md).toContain("**[B]** 网经社电数宝");
    expect(md).toContain("不构成投资建议");
    expect(md).toContain("未生成、修改或虚构任何原始统计数据");
  });

  it("表格管道符转义", () => {
    const tricky: DataPoint = { ...points[0], id: "d-x", metric: "含|管道符" };
    const out = exportMarkdown({ project, dataPoints: [tricky], sources });
    expect(out).toContain("含\\|管道符");
  });
});

describe("summarize", () => {
  it("统计总数、预测数、维度分布与来源分级", () => {
    const s = summarize({ project, dataPoints: points, sources });
    expect(s.total).toBe(3);
    expect(s.forecastCount).toBe(1);
    expect(s.byDimension.market).toBe(2);
    expect(s.byDimension.policy).toBe(1);
    expect(s.sourceTierCount.B).toBe(1);
  });
});

describe("exportPrintHtml", () => {
  const html = exportPrintHtml({ project, dataPoints: points, sources });

  it("是自包含 HTML（含内联样式、无外部资源引用）", () => {
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain("<style>");
    expect(html).not.toContain('src="http');
    expect(html).not.toContain('href="http://fonts');
  });

  it("预测值以 E 徽标渲染", () => {
    expect(html).toContain('<span class="forecast">E</span>');
  });

  it("HTML 特殊字符被转义", () => {
    const evil: DataPoint = { ...points[2], id: "d-e", text: '<script>alert("x")</script>' };
    const out = exportPrintHtml({ project, dataPoints: [evil], sources });
    expect(out).not.toContain('<script>alert');
    expect(out).toContain("&lt;script&gt;");
  });

  it("含打印样式与免责声明", () => {
    expect(html).toContain("@media print");
    expect(html).toContain("免责声明");
  });
});
