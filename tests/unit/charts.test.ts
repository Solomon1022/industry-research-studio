/**
 * 图表配置生成器单元测试：分组、排序、预测虚线、多口径拆分
 */

import { describe, expect, it } from "vitest";
import { buildAllCharts, buildSubjectCompareCharts, buildTimeSeriesCharts } from "@/lib/charts";
import type { DataPoint } from "@/lib/types";

const now = Date.now();
let n = 0;

function dp(partial: Partial<DataPoint>): DataPoint {
  return {
    id: `t-${++n}`, projectId: "p", dimension: "market",
    metric: "市场规模", value: 1, unit: "亿元", period: "2024",
    kind: "gmv", scope: { label: "GMV口径" }, forecast: false, sourceId: "s",
    createdAt: now, updatedAt: now, ...partial,
  };
}

describe("buildTimeSeriesCharts", () => {
  it("年份序列升序排列", () => {
    const data = [
      dp({ period: "2023", value: 49168 }),
      dp({ period: "2025", value: 69461 }),
      dp({ period: "2024", value: 53256 }),
    ];
    const [spec] = buildTimeSeriesCharts(data);
    expect(spec).toBeDefined();
    const xAxis = spec.option.xAxis as { data: string[] };
    expect(xAxis.data).toEqual(["2023", "2024", "2025"]);
  });

  it("少于两个点不生成图表", () => {
    expect(buildTimeSeriesCharts([dp({ period: "2025" })])).toHaveLength(0);
  });

  it("预测点独立虚线 series，且与实际线衔接", () => {
    const data = [
      dp({ period: "2023", value: 100 }),
      dp({ period: "2024", value: 120 }),
      dp({ period: "2030", value: 200, forecast: true }),
    ];
    const [spec] = buildTimeSeriesCharts(data);
    expect(spec.hasForecast).toBe(true);
    const series = spec.option.series as Array<{ name: string; data: (number | null)[]; lineStyle?: { type?: string } }>;
    expect(series).toHaveLength(2);
    const forecastSeries = series.find((s) => s.name.includes("预测"))!;
    expect(forecastSeries.lineStyle?.type).toBe("dashed");
    // 衔接点：最后一个实际年份的预测序列值等于实际值（120）
    expect(forecastSeries.data[1]).toBe(120);
    expect(forecastSeries.data[2]).toBe(200);
  });

  it("同指标不同口径拆分为独立图表", () => {
    const data = [
      dp({ period: "2023", value: 1, scope: { label: "GMV口径" } }),
      dp({ period: "2024", value: 2, scope: { label: "GMV口径" } }),
      dp({ period: "2023", value: 10, scope: { label: "支付口径" } }),
      dp({ period: "2024", value: 20, scope: { label: "支付口径" } }),
    ];
    const specs = buildTimeSeriesCharts(data);
    expect(specs).toHaveLength(2);
    const scopes = specs.map((s) => s.scopeLabels[0]).sort();
    expect(scopes).toEqual(["GMV口径", "支付口径"]);
  });

  it("非年份时间（如 2024-11）不进时间序列图", () => {
    const data = [
      dp({ period: "2024-06", value: 1 }),
      dp({ period: "2024-11", value: 2 }),
    ];
    expect(buildTimeSeriesCharts(data)).toHaveLength(0);
  });
});

describe("buildSubjectCompareCharts", () => {
  it("同指标多主体生成柱状图并按值降序", () => {
    const data = [
      dp({ dimension: "competition", metric: "用户规模", subject: "淘宝", value: 5.08, period: "2024-11", kind: "users", unit: "亿" }),
      dp({ dimension: "competition", metric: "用户规模", subject: "抖音", value: 6.32, period: "2024-11", kind: "users", unit: "亿" }),
      dp({ dimension: "competition", metric: "用户规模", subject: "京东", value: 2.27, period: "2024-11", kind: "users", unit: "亿" }),
    ];
    const [spec] = buildSubjectCompareCharts(data);
    expect(spec).toBeDefined();
    const yAxis = spec.option.yAxis as { data: string[] };
    expect(yAxis.data[0]).toBe("抖音"); // inverse: true 下首个为最大值
  });

  it("单主体不生成对比图", () => {
    const data = [dp({ subject: "抖音", period: "2024-11", kind: "users" })];
    expect(buildSubjectCompareCharts(data)).toHaveLength(0);
  });
});

describe("buildAllCharts", () => {
  it("汇总时间序列与主体对比，文本条目不生成图表", () => {
    const data = [
      dp({ period: "2023", value: 1 }),
      dp({ period: "2024", value: 2 }),
      dp({ id: "txt", kind: "text", value: null, text: "案例" }),
    ];
    const specs = buildAllCharts(data);
    expect(specs).toHaveLength(1);
    expect(specs[0].metric).toBe("市场规模");
  });
});
