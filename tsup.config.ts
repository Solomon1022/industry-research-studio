import { defineConfig } from "tsup";

export default defineConfig({
  entry: { main: "electron/main.ts", preload: "electron/preload.ts" },
  outDir: "dist-electron",
  format: ["cjs"],
  target: "node22",
  platform: "node",
  bundle: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: false,
  external: ["electron"],
  // 排除 electron：electron 必须由宿主运行时提供（require("electron") 才能拿到 app/BrowserWindow），
  // 若被打包进 main.js，其 index.js 会在启动时误判“未安装”并退出。
  noExternal: [/^(?!electron$).*/],
  esbuildOptions(options) { options.mainFields = ["module", "main"]; },
});
