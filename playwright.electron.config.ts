import { defineConfig } from "@playwright/test";

process.env.ELECTRON_DEV_URL = "http://localhost:3100";

export default defineConfig({
  testDir: "./tests/electron",
  timeout: 90_000,
  workers: 1,
  use: { viewport: { width: 1440, height: 900 }, locale: "zh-CN" },
  webServer: {
    command: "npm run dev -- --port 3100",
    url: "http://localhost:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
