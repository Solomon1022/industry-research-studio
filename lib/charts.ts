/**
 * ECharts 配置生成器（纯函数，不含渲染，便于单元测试）
 *
 * 规则：
 * - 时间序列自动按 period 排序
 * - 预测值数据点用虚线+浅色渲染，tooltip 标注「预测」
 * - 同 metric 多口径拆分为多条 series，绝不混画
 */

import type { EChartsOption, SeriesOption } from "echarts";
import type { DataPoint } from "./types";

export interface ChartSpec {
  /** 图表唯一键（dimension::metric::scope） */
  key: string;
  title: string;
  dimension: string;
  metric: string;
  scopeLabels: string[];
  pointCount: number;
  hasForecast: boolean;
  option: EChartsOption;
}

const PALETTE = ["#0f5ea8", "#e0632f", "#2f8f5b", "#7a5ea8", "#b8860b", "#c0405e"];

function isYearLike(period: string): boolean {
  return /^\d{4}$/.test(period);
}

function sortPeriods(values: string[]): string[] {
  return [...values].sort((a, b) => {
    if (isYearLike(a) && isYearLike(b)) return Number(a) - Number(b);
    return a.localeCompare(b);
  });
}

/** 把数值型数据点按 metric+口径 分组，每组生成一张折线/柱状混合图 */
export function buildTimeSeriesCharts(dataPoints: DataPoint[]): ChartSpec[] {
  const numerics = dataPoints.filter(
    (d) => d.kind !== "text" && d.value !== null && isYearLike(d.period)
  );
  const groups = new Map<string, DataPoint[]>();
  for (const dp of numerics) {
    const key = `${dp.dimension}::${dp.metric}::${dp.scope.label}`;
    const list = groups.get(key) ?? [];
    list.push(dp);
    groups.set(key, list);
  }

  const specs: ChartSpec[] = [];
  let colorIdx = 0;

  for (const [key, list] of groups) {
    if (list.length < 2) continue; // 少于两个点不成趋势，跳过
    const [dimension, metric, scopeLabel] = key.split("::");
    const periods = sortPeriods([...new Set(list.map((d) => d.period))]);
    const byPeriod = new Map(list.map((d) => [d.period, d]));

    const actual: (number | null)[] = [];
    const forecast: (number | null)[] = [];
    for (const p of periods) {
      const dp = byPeriod.get(p);
      const v = dp ? dp.value : null;
      if (dp?.forecast) {
        actual.push(null);
        forecast.push(v);
      } else {
        actual.push(v);
        forecast.push(null);
      }
    }
    // 让预测虚线与实际线在最后实际点处衔接
    let lastActualIdx = -1;
    for (let i = 0; i < actual.length; i++) {
      if (actual[i] !== null) lastActualIdx = i;
    }
    if (lastActualIdx >= 0 && forecast.some((v) => v !== null)) {
      forecast[lastActualIdx] = actual[lastActualIdx] as number;
    }

    const unit = list[0].unit;
    const color = PALETTE[colorIdx++ % PALETTE.length];
    const hasForecast = list.some((d) => d.forecast);

    const series: SeriesOption[] = [
      {
        name: "实际值",
        type: "line",
        data: actual,
        connectNulls: false,
        smooth: false,
        symbolSize: 7,
        lineStyle: { width: 2.5, color },
        itemStyle: { color },
        areaStyle: { opacity: 0.06, color },
      } as SeriesOption,
    ];
    if (hasForecast) {
      series.push({
        name: "预测值（E）",
        type: "line",
        data: forecast,
        connectNulls: false,
        symbol: "emptyCircle",
        symbolSize: 7,
        lineStyle: { width: 2, type: "dashed", color },
        itemStyle: { color, borderColor: color },
      } as SeriesOption);
    }

    specs.push({
      key,
      title: `${metric}（${unit}）`,
      dimension,
      metric,
      scopeLabels: [scopeLabel],
      pointCount: list.length,
      hasForecast,
      option: {
        title: { text: metric, subtext: `单位：${unit} · 口径：${scopeLabel}`, left: 0, textStyle: { fontSize: 15 } },
        tooltip: {
          trigger: "axis",
          valueFormatter: (v) => (typeof v === "number" ? `${v.toLocaleString("zh-CN")} ${unit}` : "—"),
        },
        legend: hasForecast ? { bottom: 0 } : undefined,
        grid: { left: 8, right: 16, top: 72, bottom: hasForecast ? 48 : 24, containLabel: true },
        xAxis: { type: "category", data: periods, boundaryGap: false },
        yAxis: { type: "value", scale: true },
        series,
      },
    });
  }
  return specs.sort((a, b) => a.key.localeCompare(b.key));
}

/** 主体对比柱状图（竞争格局维度：同一 metric 下不同 subject 的横向对比） */
export function buildSubjectCompareCharts(dataPoints: DataPoint[]): ChartSpec[] {
  const numerics = dataPoints.filter(
    (d) => d.kind !== "text" && d.value !== null && d.subject && !isYearLike(d.period)
  );
  const groups = new Map<string, DataPoint[]>();
  for (const dp of numerics) {
    const key = `${dp.dimension}::${dp.metric}::${dp.period}::${dp.scope.label}`;
    const list = groups.get(key) ?? [];
    list.push(dp);
    groups.set(key, list);
  }

  const specs: ChartSpec[] = [];
  for (const [key, list] of groups) {
    if (list.length < 2) continue;
    const [dimension, metric, period, scopeLabel] = key.split("::");
    const sorted = [...list].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    const unit = list[0].unit;

    specs.push({
      key,
      title: `${metric}（${period}，${unit}）`,
      dimension,
      metric,
      scopeLabels: [scopeLabel],
      pointCount: list.length,
      hasForecast: false,
      option: {
        title: { text: metric, subtext: `${period} · 单位：${unit} · 口径：${scopeLabel}`, left: 0, textStyle: { fontSize: 15 } },
        tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
        grid: { left: 8, right: 32, top: 72, bottom: 8, containLabel: true },
        xAxis: { type: "value" },
        yAxis: { type: "category", data: sorted.map((d) => d.subject ?? ""), inverse: true },
        series: [
          {
            type: "bar",
            data: sorted.map((d, i) => ({
              value: d.value,
              itemStyle: { color: PALETTE[i % PALETTE.length] },
            })),
            barMaxWidth: 28,
            label: { show: true, position: "right", formatter: (p) => `${p.value} ${unit}` },
          } as SeriesOption,
        ],
      },
    });
  }
  return specs.sort((a, b) => a.key.localeCompare(b.key));
}

/** 汇总一个项目可出的全部图表 */
export function buildAllCharts(dataPoints: DataPoint[]): ChartSpec[] {
  return [...buildTimeSeriesCharts(dataPoints), ...buildSubjectCompareCharts(dataPoints)];
}
