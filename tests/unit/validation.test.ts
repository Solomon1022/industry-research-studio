/**
 * 校验引擎单元测试：覆盖每条保真红线
 */

import { describe, expect, it } from "vitest";
import { canExport, detectScopeConflicts, validateDataPoint, validateProject } from "@/lib/validation";
import type { DataPoint, Project, Source } from "@/lib/types";

const now = Date.now();

const baseSource: Source = {
  id: "src-1", name: "测试机构", title: "测试报告", tier: "B",
  linkStatus: "ok", createdAt: now, updatedAt: now,
};

const basePoint: DataPoint = {
  id: "dp-1", projectId: "p-1", dimension: "market",
  metric: "市场规模", value: 100, unit: "亿元", period: "2025",
  kind: "gmv", scope: { label: "GMV口径" }, forecast: false,
  sourceId: "src-1", createdAt: now, updatedAt: now,
};

const project: Project = {
  id: "p-1", name: "测试项目", industry: "测试行业", region: "中国",
  periodRange: "2020-2025", dimensions: ["market"], status: "draft",
  createdAt: now, updatedAt: now,
};

const sourceMap = new Map([[baseSource.id, baseSource]]);

describe("validateDataPoint：红线规则", () => {
  it("合规数据点不报任何问题", () => {
    const issues = validateDataPoint(basePoint, sourceMap);
    expect(issues.filter((i) => i.level === "error")).toHaveLength(0);
  });

  it("缺来源 → error（数据保真第一红线）", () => {
    const dp = { ...basePoint, sourceId: "" };
    const issues = validateDataPoint(dp, sourceMap);
    expect(issues.some((i) => i.rule === "missing-source" && i.level === "error")).toBe(true);
  });

  it("引用不存在的来源 → error", () => {
    const dp = { ...basePoint, sourceId: "ghost" };
    const issues = validateDataPoint(dp, sourceMap);
    expect(issues.some((i) => i.rule === "dangling-source")).toBe(true);
  });

  it("数值型缺数值 → error；缺单位 → error", () => {
    const noValue = validateDataPoint({ ...basePoint, value: null }, sourceMap);
    expect(noValue.some((i) => i.rule === "missing-value")).toBe(true);
    const noUnit = validateDataPoint({ ...basePoint, unit: " " }, sourceMap);
    expect(noUnit.some((i) => i.rule === "missing-unit")).toBe(true);
  });

  it("文本条目内容为空 → error", () => {
    const dp: DataPoint = { ...basePoint, kind: "text", value: null, text: "  " };
    const issues = validateDataPoint(dp, sourceMap);
    expect(issues.some((i) => i.rule === "missing-text")).toBe(true);
  });

  it("缺口径标签 → error（口径必须显式声明）", () => {
    const dp = { ...basePoint, scope: { label: "" } };
    const issues = validateDataPoint(dp, sourceMap);
    expect(issues.some((i) => i.rule === "missing-scope" && i.level === "error")).toBe(true);
  });

  it("来源链接失效 → warning", () => {
    const dead: Source = { ...baseSource, linkStatus: "dead" };
    const issues = validateDataPoint(basePoint, new Map([[dead.id, dead]]));
    expect(issues.some((i) => i.rule === "dead-link" && i.level === "warning")).toBe(true);
  });

  it("仅有 C 级来源 → warning（须有 A/B 级佐证）", () => {
    const c: Source = { ...baseSource, tier: "C" };
    const issues = validateDataPoint(basePoint, new Map([[c.id, c]]));
    expect(issues.some((i) => i.rule === "tier-c-only" && i.level === "warning")).toBe(true);
  });

  it("预测值来源缺发布日期 → info", () => {
    const dp = { ...basePoint, forecast: true };
    const issues = validateDataPoint(dp, sourceMap);
    expect(issues.some((i) => i.rule === "forecast-no-date" && i.level === "info")).toBe(true);
  });
});

describe("detectScopeConflicts：口径冲突检测", () => {
  it("同一指标两种口径 → warning 且列出全部口径", () => {
    const a = { ...basePoint, id: "a", scope: { label: "GMV口径" } };
    const b = { ...basePoint, id: "b", scope: { label: "支付口径" } };
    const issues = detectScopeConflicts([a, b]);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain("GMV口径");
    expect(issues[0].message).toContain("支付口径");
  });

  it("同一口径不报警", () => {
    const a = { ...basePoint, id: "a" };
    const b = { ...basePoint, id: "b", period: "2024" };
    expect(detectScopeConflicts([a, b])).toHaveLength(0);
  });

  it("文本条目不参与口径冲突检测", () => {
    const a = { ...basePoint, id: "a" };
    const t: DataPoint = { ...basePoint, id: "t", kind: "text", value: null, scope: { label: "其他" } };
    expect(detectScopeConflicts([a, t])).toHaveLength(0);
  });
});

describe("validateProject 与导出门禁", () => {
  it("error 排序在前，canExport 阻断", () => {
    const bad: DataPoint = { ...basePoint, id: "bad", sourceId: "" };
    const good: DataPoint = { ...basePoint, id: "good", forecast: true };
    const issues = validateProject({ project, dataPoints: [good, bad], sources: [baseSource] });
    expect(issues[0].level).toBe("error");
    expect(canExport(issues)).toBe(false);
  });

  it("全部合规时允许导出", () => {
    const issues = validateProject({ project, dataPoints: [basePoint], sources: [baseSource] });
    expect(canExport(issues)).toBe(true);
  });

  it("启用维度无数据 → info 提示", () => {
    const issues = validateProject({ project, dataPoints: [], sources: [] });
    expect(issues.some((i) => i.rule === "dimension-empty")).toBe(true);
  });
});
