/**
 * README 截图：对本地 dev 服务器截取四个核心页面
 * 运行前提：dev 服务器已在 3100 端口运行
 */

import { test } from "@playwright/test";
import path from "node:path";

const shots = path.resolve(__dirname, "../../docs/screenshots");

test.describe.configure({ mode: "serial" });

test("截取 README 用图", async ({ page }) => {
  await page.goto("/");
  await page.getByText("直播电商与 AI 虚拟主播").first().waitFor({ timeout: 15000 });
  await page.screenshot({ path: path.join(shots, "01-dashboard.png"), fullPage: false });

  await page.getByRole("link", { name: "进入工作台" }).first().click();
  await page.getByText("69,461 亿元").waitFor();
  await page.screenshot({ path: path.join(shots, "02-workbench.png"), fullPage: false });

  await page.getByRole("link", { name: "可视化" }).click();
  await page.locator("canvas").first().waitFor();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(shots, "03-charts.png"), fullPage: false });

  await page.getByRole("link", { name: "报告导出" }).click();
  await page.getByText("✓ 校验通过，可以导出").waitFor();
  await page.screenshot({ path: path.join(shots, "04-report.png"), fullPage: false });
});
