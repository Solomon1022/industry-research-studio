import { expect, test } from "@playwright/test";

async function openProject(page: import("@playwright/test").Page) {
  page.on("pageerror", (error) => console.error("PAGE ERROR:", error.message));
  page.on("console", (message) => { if (message.type() === "error") console.error("BROWSER ERROR:", message.text()); });
  await page.goto("/");
  await page.getByRole("link", { name: "进入工作台" }).first().click();
  await expect(page).toHaveURL(/\/projects\/[^/]+$/);
  // 等待客户端导航完成（工作台渲染出「新增数据点」）后再取项目 ID，避免取到中间态 URL
  await expect(page.getByRole("button", { name: "+ 新增数据点" })).toBeVisible();
  return new URL(page.url()).pathname.split("/")[2];
}

test.describe("0.2 主动研究工作流", () => {
  test("研究中心展示采集入口与公开来源目录", async ({ page }) => {
    const id = await openProject(page);
    await page.goto(`/projects/${id}/research`);
    await expect(page.getByRole("heading", { name: "研究中心", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "AI 规划检索词" })).toBeDisabled();
    await expect(page.getByText(/公开来源目录/)).toBeVisible();
    await expect(page.getByText("暂无证据。先搜索、提取链接或导入文件。")).toBeVisible();
  });

  test("论文研究配置保存后刷新仍保留", async ({ page }) => {
    const id = await openProject(page);
    await page.goto(`/projects/${id}/thesis`);
    await page.getByLabel("论文题目 / 研究问题").fill("AI 虚拟主播互动性如何影响购买意愿？");
    await page.getByLabel("自变量 X").fill("直播互动性");
    await page.getByLabel("中介变量 M").fill("社会临场感");
    await page.getByLabel("因变量 Y").fill("购买意愿");
    await page.getByRole("button", { name: "保存研究配置" }).click();
    await expect(page.getByText(/研究配置已保存/)).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("自变量 X")).toHaveValue("直播互动性");
    await expect(page.getByRole("heading", { name: "论文数据清单" })).toBeVisible();
  });

  test("模型中心支持自定义中转与三种网络模式", async ({ page }) => {
    const id = await openProject(page);
    await page.goto(`/projects/${id}/settings`);
    await page.getByRole("button", { name: "AI 模型中心" }).click();
    await page.getByRole("button", { name: /自定义.*OpenAI.*兼容/ }).click();
    await page.getByLabel("Base URL").fill("https://relay.example.com/v1");
    await page.getByLabel("模型名 / 接入点 ID").fill("my-model");
    await page.getByLabel("网络方式").selectOption("custom");
    await expect(page.getByLabel("代理地址")).toBeVisible();
    await page.getByLabel("代理地址").fill("http://127.0.0.1:7890");
    await expect(page.getByRole("button", { name: "保存并设为当前模型" })).toBeDisabled();
  });

  test("完整导出中心生成 Markdown、Word 与 Excel 下载", async ({ page }) => {
    const id = await openProject(page);
    await page.goto(`/projects/${id}/export`);
    await expect(page.getByText(/校验通过：/)).toBeVisible();
    for (const [name, extension] of [["Markdown", ".md"], ["Word 研究数据报告", ".docx"], ["Excel 工作簿", ".xlsx"]] as const) {
      const pending = page.waitForEvent("download");
      await page.getByRole("button", { name: new RegExp(name) }).click();
      const download = await pending;
      expect(download.suggestedFilename()).toContain(extension);
    }
  });

  test("移动视口无整页横向溢出，主要导航可访问", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const id = await openProject(page);
    await page.goto(`/projects/${id}/research`);
    await expect(page.getByRole("heading", { name: "研究中心", exact: true })).toBeVisible();
    const dimensions = await page.evaluate(() => ({ body: document.body.scrollWidth, viewport: window.innerWidth }));
    expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport + 1);
  });
});
