"use client";

import * as echarts from "echarts";
import type { EChartsOption } from "echarts";

export async function renderChartForExport(
  option: EChartsOption,
  format: "png" | "svg",
  notes: { title: string; unit?: string; source: string },
): Promise<Uint8Array> {
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-20000px;top:0;width:1600px;height:900px;background:#fff";
  document.body.appendChild(host);
  try {
    const chart = echarts.init(host, undefined, { renderer: format === "svg" ? "svg" : "canvas" });
    const exportOption: EChartsOption = {
      ...option,
      backgroundColor: "#ffffff",
      animation: false,
      title: {
        ...(typeof option.title === "object" && !Array.isArray(option.title) ? option.title : {}),
        text: notes.title,
        subtext: `${notes.unit ? `单位：${notes.unit}  ·  ` : ""}预测值以 E / 虚线标注`,
        left: 24, top: 12,
        textStyle: { fontSize: 22, fontWeight: 600, color: "#17202a" },
        subtextStyle: { fontSize: 14, color: "#6b7686" },
      },
      graphic: [{
        type: "text", left: 24, bottom: 12,
        style: { text: `数据来源：${notes.source}`, fontSize: 13, fill: "#596579" },
      }],
    };
    chart.setOption(exportOption, { notMerge: true });
    await new Promise((resolve) => setTimeout(resolve, 60));
    if (format === "svg") {
      const svg = chart.renderToSVGString();
      chart.dispose();
      return new TextEncoder().encode(svg);
    }
    const dataUrl = chart.getDataURL({ type: "png", pixelRatio: 2, backgroundColor: "#ffffff" });
    chart.dispose();
    const base64 = dataUrl.split(",")[1];
    const binary = atob(base64);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } finally {
    host.remove();
  }
}
