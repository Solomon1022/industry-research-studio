/**
 * 示例数据集完整性测试：保证内置示例自身通过保真校验、数据未被篡改
 */

import { describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import { ensureSeedData, ResearchDB } from "@/lib/db";
import { seedDataPoints, seedProject, seedSources } from "@/lib/seed-data";
import { canExport, validateProject } from "@/lib/validation";

describe("seed 数据集", () => {
  it("并发初始化不会重复写入或产生主键冲突", async () => {
    const database = new ResearchDB();
    const results = await Promise.all([ensureSeedData(database), ensureSeedData(database)]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await database.projects.count()).toBe(1);
    expect(await database.sources.count()).toBe(seedSources.length);
    expect(await database.dataPoints.count()).toBe(seedDataPoints.length);
    database.close();
    await database.delete();
  });

  it("项目启用六维全集", () => {
    expect(seedProject.dimensions).toHaveLength(6);
  });

  it("每个数据点都绑定了存在的来源（第一红线）", () => {
    const ids = new Set(seedSources.map((s) => s.id));
    for (const dp of seedDataPoints) {
      expect(dp.sourceId, `数据点 ${dp.metric} 缺来源`).toBeTruthy();
      expect(ids.has(dp.sourceId), `数据点 ${dp.metric} 引用了不存在的来源`).toBe(true);
    }
  });

  it("数值型条目有数值与单位；文本条目有内容", () => {
    for (const dp of seedDataPoints) {
      if (dp.kind === "text") {
        expect(dp.text?.trim().length, dp.metric).toBeGreaterThan(0);
      } else {
        expect(dp.value, dp.metric).not.toBeNull();
        expect(dp.unit.trim().length, dp.metric).toBeGreaterThan(0);
      }
    }
  });

  it("预测值已标注 forecast（2030E）", () => {
    const forecasts = seedDataPoints.filter((d) => d.forecast);
    expect(forecasts.length).toBeGreaterThan(0);
    for (const f of forecasts) expect(f.period).toBe("2030");
  });

  it("整包通过保真校验且无 error，允许导出", () => {
    const issues = validateProject({
      project: seedProject, dataPoints: seedDataPoints, sources: seedSources,
    });
    const errors = issues.filter((i) => i.level === "error");
    expect(errors, JSON.stringify(errors, null, 2)).toHaveLength(0);
    expect(canExport(issues)).toBe(true);
  });

  it("市场规模序列与原始来源一致（防篡改锚点）", () => {
    const sizes = seedDataPoints
      .filter((d) => d.metric === "直播电商市场规模")
      .sort((a, b) => Number(a.period) - Number(b.period));
    expect(sizes.map((d) => d.value)).toEqual([
      196.4, 1354.1, 4437.5, 12850, 23615.1, 35000, 49168, 53256, 69461,
    ]);
  });

  it("双11 用户规模对比包含六大平台", () => {
    const d11 = seedDataPoints.filter((d) => d.metric === "双11期间App用户规模");
    expect(d11.map((d) => d.subject).sort()).toEqual(
      ["京东", "小红书", "拼多多", "快手", "抖音", "淘宝"].sort()
    );
  });
});
