import { defineConfig } from "@playwright/test";

/**
 * e2e：对 `next dev` 起的关键流程测试
 * 每次运行独立浏览器 profile，IndexedDB 为空 → 自动注入示例数据
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45_000,
  retries: 0,
  use: {
    baseURL: "http://localhost:3100",
    viewport: { width: 1440, height: 900 },
    locale: "zh-CN",
  },
  webServer: {
    command: "npm run dev -- --port 3100",
    url: "http://localhost:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
