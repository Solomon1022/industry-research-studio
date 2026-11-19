import { expect, test, _electron as electron } from "@playwright/test";

test("安全桌面壳加载并暴露受限桥接", async () => {
  // 外层环境（桌面壳 / CI）可能设置了 ELECTRON_RUN_AS_NODE=1，会让 electron.exe 退化为 node，
  // 导致 require("electron") 拿不到 app/BrowserWindow 而启动失败，这里显式移除。
  const launchEnv = { ...process.env, ELECTRON_DEV_URL: "http://localhost:3100" } as { [key: string]: string };
  delete launchEnv.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({ args: ["."], env: launchEnv });
  app.process().stdout?.on("data", (chunk) => console.log("ELECTRON:", String(chunk)));
  app.process().stderr?.on("data", (chunk) => console.error("ELECTRON ERROR:", String(chunk)));
  try {
    const page = await app.firstWindow();
    page.on("console", (m) => { if (m.type() === "error") console.error("PAGE CONSOLE ERROR:", m.text()); });
    page.on("pageerror", (e) => console.error("PAGE ERROR:", e.message));
    await page.getByText("直播电商与 AI 虚拟主播").first().waitFor({ timeout: 30_000 });
    const security = await page.evaluate(async () => ({
      hasRequire: typeof (window as unknown as { require?: unknown }).require !== "undefined",
      hasProcess: typeof (window as unknown as { process?: unknown }).process !== "undefined",
      runtime: await window.researchDesktop?.runtime(),
    }));
    expect(security.hasRequire).toBe(false);
    expect(security.hasProcess).toBe(false);
    expect(security.runtime?.isDesktop).toBe(true);
    expect(security.runtime?.platform).toBe(process.platform);
    await page.getByRole("link", { name: "进入工作台" }).first().click();
    await page.getByRole("link", { name: "研究中心" }).click();
    await expect(page.getByRole("button", { name: "搜索", exact: true })).toBeEnabled();
    await expect(page.getByRole("button", { name: "导入文件" })).toBeEnabled();
  } finally {
    await app.close();
  }
});
