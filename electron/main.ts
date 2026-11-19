import { app, BrowserWindow, dialog, ipcMain, session, shell, utilityProcess } from "electron";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createServer } from "node:net";
import { MODEL_PROVIDER_ORDER } from "../lib/model-presets";
import type { ModelProfile, NetworkConfig, SearchProvider } from "../lib/research-types";
import { saveSecret, saveProfile, secretStatus } from "./services/store";
import { searchWeb } from "./services/search";
import { chatWithModel } from "./services/ai";
import { extractPublicUrl } from "./services/public-fetch";
import { extractPdf, extractTabular } from "./services/extract";
import { captureAuthorized, openAuthorized, openExternal } from "./services/browser";
import { friendlyNetworkError } from "./services/http";

let mainWindow: BrowserWindow | null = null;
let nextServer: ReturnType<typeof utilityProcess.fork> | null = null;
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();

function handle(channel: string, callback: (_event: Electron.IpcMainInvokeEvent, ...args: never[]) => unknown): void {
  ipcMain.handle(channel, async (event, ...args) => {
    try { return await callback(event, ...(args as never[])); }
    catch (error) { throw new Error(friendlyNetworkError(error)); }
  });
}

function registerIpc(): void {
  handle("runtime", () => ({ isDesktop: true, platform: process.platform, versions: { electron: process.versions.electron, chrome: process.versions.chrome } }));
  handle("search:save", async (_e, provider: SearchProvider, apiKey: string, network: NetworkConfig) => saveSecret("search", provider, apiKey, network));
  handle("search:status", async () => secretStatus("search", ["tavily", "brave"]));
  handle("search:query", async (_e, provider: SearchProvider, query: string, maxResults: number) => searchWeb(provider, query, maxResults));
  handle("model:save", async (_e, profile: ModelProfile, apiKey: string, network: NetworkConfig) => {
    await saveProfile(profile);
    return saveSecret("model", profile.id, apiKey, network);
  });
  handle("model:status", async () => secretStatus("model", MODEL_PROVIDER_ORDER));
  handle("model:chat", async (_e, profile: ModelProfile, messages: Array<{ role: "system" | "user" | "assistant"; content: string }>, requireJson: boolean) => chatWithModel(profile, messages, requireJson));
  handle("model:test", async (_e, profile: ModelProfile) => {
    const reply = await chatWithModel(profile, [{ role: "user", content: "连接测试。只回复 OK，不要输出其他内容。" }]);
    return { ok: true, message: `连接成功，模型返回：${reply.slice(0, 80)}` };
  });
  handle("extract:url", async (_e, url: string) => extractPublicUrl(url));
  handle("extract:file", async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "导入公开报告或真实数据文件", properties: ["openFile"],
      filters: [{ name: "研究与数据文件", extensions: ["pdf", "csv", "txt", "xlsx", "xlsm", "sav", "zsav"] }],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const filePath = result.filePaths[0];
    const stat = await fs.stat(filePath);
    if (stat.size > 50 * 1024 * 1024) throw new Error("单个文件不能超过 50MB");
    const buffer = await fs.readFile(filePath);
    return path.extname(filePath).toLowerCase() === ".pdf" ? extractPdf(buffer, path.basename(filePath)) : extractTabular(buffer, path.basename(filePath));
  });
  handle("auth:open", async (_e, url: string) => openAuthorized(url));
  handle("auth:capture", async () => captureAuthorized());
  handle("file:save", async (_e, fileName: string, bytes: Uint8Array) => {
    if (!mainWindow) return { saved: false };
    const safeName = path.basename(fileName);
    const result = await dialog.showSaveDialog(mainWindow, { title: "保存研究产物", defaultPath: safeName });
    if (result.canceled || !result.filePath) return { saved: false };
    await fs.writeFile(result.filePath, Buffer.from(bytes));
    return { saved: true, path: result.filePath };
  });
  handle("external:open", async (_e, url: string) => { await openExternal(url); return { opened: true }; });
}

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") { server.close(); reject(new Error("无法分配本地端口")); return; }
      const port = address.port;
      server.close(() => resolve(port));
    });
  });
}

async function startNextServer(): Promise<string> {
  const port = await freePort();
  const serverPath = path.join(process.resourcesPath, "next-standalone", "server.js");
  nextServer = utilityProcess.fork(serverPath, [], {
    env: { ...process.env, NODE_ENV: "production", HOSTNAME: "127.0.0.1", PORT: String(port) },
    stdio: "pipe",
  });
  const url = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try { const response = await fetch(url); if (response.ok) return url; } catch { /* server is starting */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("本地研究服务启动超时");
}

async function createWindow(): Promise<void> {
  const url = process.env.ELECTRON_DEV_URL || await startNextServer();
  mainWindow = new BrowserWindow({
    width: 1440, height: 940, minWidth: 1060, minHeight: 700,
    title: "Industry Research Studio", autoHideMenuBar: true,
    backgroundColor: "#fafbfc", show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true,
    },
  });
  mainWindow.once("ready-to-show", () => mainWindow?.show());
  const origin = new URL(url).origin;
  mainWindow.webContents.on("will-navigate", (event, target) => {
    if (new URL(target).origin !== origin) { event.preventDefault(); void shell.openExternal(target); }
  });
  mainWindow.webContents.setWindowOpenHandler(({ url: target }) => { void shell.openExternal(target); return { action: "deny" }; });
  await mainWindow.loadURL(url);
}

if (gotLock) {
  app.on("second-instance", () => { if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); } });
  app.whenReady().then(() => {
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    registerIpc();
    return createWindow();
  }).catch((error) => {
    dialog.showErrorBox("启动失败", friendlyNetworkError(error));
    app.quit();
  });
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) void createWindow(); });
  app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
  app.on("before-quit", () => { nextServer?.kill(); });
}
