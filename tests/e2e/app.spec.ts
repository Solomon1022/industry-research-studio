/**
 * e2e 关键流程：示例数据自动注入 → 六维浏览 → 校验门禁 → 报告导出
 */

import { expect, test } from "@playwright/test";

test.describe("行业研究工作台核心流程", () => {
  test("首页展示示例项目与方法论", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "研究项目" })).toBeVisible();
    // 示例数据自动注入
    await expect(page.getByText("直播电商与 AI 虚拟主播").first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("六维背调框架")).toBeVisible();
  });

  test("进入工作台：六维导航 + 维度指南 + 数据表", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "进入工作台" }).first().click();
    await expect(page).toHaveURL(/\/projects\//);
    // 六维 tab 齐全
    for (const dim of ["市场规模与增速", "竞争格局与玩家", "政策与监管", "消费者与用户", "技术趋势", "投融资"]) {
      await expect(page.getByRole("button", { name: new RegExp(dim) })).toBeVisible();
    }
    // 市场维度默认显示：含真实数据行
    await expect(page.getByText("直播电商市场规模").first()).toBeVisible();
    await expect(page.getByText("69,461 亿元")).toBeVisible();
    // 维度指南可见
    await expect(page.getByText(/要回答的问题/)).toBeVisible();
  });

  test("切换到竞争格局维度：双11 用户规模数据", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "进入工作台" }).first().click();
    await page.getByRole("button", { name: /竞争格局与玩家/ }).click();
    await expect(page.getByText("双11期间App用户规模").first()).toBeVisible();
    await expect(page.getByText("6.32 亿")).toBeVisible();
  });

  test("新增数据点强制校验：缺来源被拦截", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "进入工作台" }).first().click();
    await page.getByRole("button", { name: "+ 新增数据点" }).click();
    // 填表但故意不选来源
    await page.getByLabel("指标名称 *").fill("测试指标");
    await page.getByLabel("时间 *").fill("2025");
    await page.getByLabel("数值 *").fill("100");
    await page.getByLabel("口径标签 *").fill("测试口径");
    await page.locator("#dp-source").selectOption("");
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("必须选择来源——每个数据都必须可追溯")).toBeVisible();
  });

  test("完整新增一条数据点并出现在表格中", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "进入工作台" }).first().click();
    await page.getByRole("button", { name: "+ 新增数据点" }).click();
    await page.getByLabel("指标名称 *").fill("端到端测试指标");
    await page.getByLabel("时间 *").fill("2026");
    await page.getByLabel("数值 *").fill("888");
    await page.getByLabel("口径标签 *").fill("测试口径");
    // 选择第一个真实来源
    await page.locator("#dp-source").selectOption({ index: 1 });
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("端到端测试指标")).toBeVisible();
    await expect(page.getByText("888 亿元")).toBeVisible();
  });

  test("可视化页：自动生成趋势图与对比图", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "进入工作台" }).first().click();
    await page.getByRole("link", { name: "可视化" }).click();
    // 市场规模趋势图（含预测徽标）与双11对比图
    await expect(page.getByText("直播电商市场规模（亿元）")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("canvas").first()).toBeVisible();
    await expect(page.getByText(/双11期间App用户规模/).first()).toBeVisible();
  });

  test("报告页：校验通过可导出，概览统计正确", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "进入工作台" }).first().click();
    await page.getByRole("link", { name: "报告导出" }).click();
    await expect(page.getByText("✓ 校验通过，可以导出")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/全报告共/).first()).toBeVisible();
    // 导出 Markdown 触发下载
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "导出 Markdown" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain("行业背调报告");
    expect(download.suggestedFilename()).toContain(".md");
  });

  test("Markdown 预览含来源与免责声明", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "进入工作台" }).first().click();
    await page.getByRole("link", { name: "报告导出" }).click();
    await page.getByRole("button", { name: "Markdown 预览" }).click();
    await expect(page.getByText("## 数据来源")).toBeVisible();
    await expect(page.getByText(/不构成投资建议/)).toBeVisible();
  });

  test("来源管理：展示分级与被引用计数，防误删", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "进入工作台" }).first().click();
    await page.getByRole("link", { name: "来源管理" }).click();
    await expect(page).toHaveURL(/\/projects\/[^/]+\/sources$/);
    await expect(page.getByRole("row", { name: /网经社电数宝/ })).toBeVisible();
    await expect(page.getByRole("row", { name: /QuestMobile/ })).toBeVisible();
    // 被引用的来源删除时应被拦截（dialog）
    page.once("dialog", async (d) => {
      expect(d.message()).toContain("仍被");
      await d.accept();
    });
    await page
      .getByRole("row", { name: /网经社电数宝/ })
      .getByRole("button", { name: "删" })
      .click();
  });
});
