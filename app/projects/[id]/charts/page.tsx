"use client";

/** 可视化：自动从数据点生成图表，按维度分组，预测虚线区分 */

import { use, useMemo, useState } from "react";
import { Topbar } from "@/components/Topbar";
import { EChart } from "@/components/EChart";
import { buildAllCharts } from "@/lib/charts";
import { useDataPoints, useProject } from "@/lib/use-data";
import { DIMENSION_LABELS, type Dimension } from "@/lib/types";

export default function ChartsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { project } = useProject(id);
  const { dataPoints } = useDataPoints(id);
  const [dimFilter, setDimFilter] = useState<Dimension | "all">("all");

  const specs = useMemo(() => {
    const points = (dataPoints ?? []).filter(
      (d) => dimFilter === "all" || d.dimension === dimFilter
    );
    return buildAllCharts(points);
  }, [dataPoints, dimFilter]);

  const dims = project?.dimensions ?? [];

  return (
    <>
      <Topbar projectId={id} projectName={project?.name} />
      <main className="main">
        <div style={{ marginBottom: 16 }}>
          <h1 className="section-title">可视化</h1>
          <p className="section-desc" style={{ marginBottom: 0 }}>
            图表自动从数据点生成：时间序列按年份排序，预测段以虚线标注「E」；同一指标的不同口径拆分为独立图表，绝不混画。
          </p>
        </div>

        <nav className="dim-tabs" aria-label="按维度筛选图表">
          <button className={`dim-tab${dimFilter === "all" ? " active" : ""}`} onClick={() => setDimFilter("all")}>
            全部
          </button>
          {dims.map((d) => (
            <button key={d} className={`dim-tab${dimFilter === d ? " active" : ""}`} onClick={() => setDimFilter(d)}>
              {DIMENSION_LABELS[d]}
            </button>
          ))}
        </nav>

        {specs.length === 0 ? (
          <div className="empty">
            <div className="empty-title">暂无可生成的图表</div>
            <p>图表需要至少两个数值型数据点：时间序列图要求年份格式（如 2025），主体对比图要求同一指标下有两个以上主体。先到「数据录入」补充数据。</p>
          </div>
        ) : (
          <div className="chart-grid two-col">
            {specs.map((spec) => (
              <div key={spec.key} className="chart-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8 }}>
                  <strong style={{ fontSize: 14 }}>{spec.title}</strong>
                  <span style={{ display: "flex", gap: 6 }}>
                    <span className="badge badge-dim">{DIMENSION_LABELS[spec.dimension as Dimension] ?? spec.dimension}</span>
                    {spec.hasForecast && <span className="badge badge-forecast">含预测 E</span>}
                  </span>
                </div>
                <EChart option={spec.option} />
                <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--muted)" }}>
                  口径：{spec.scopeLabels.join(" / ")} · 数据点 {spec.pointCount} 个
                </p>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
