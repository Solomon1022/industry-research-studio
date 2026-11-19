import { BrowserWindow, session, shell } from "electron";
import { extractHtml } from "./extract";
import type { ExtractedPayload } from "../../lib/desktop";

const authorizedWindows = new Set<BrowserWindow>();
let permissionsConfigured = false;

function validateNavigation(raw: string): string {
  const url = new URL(raw);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("授权浏览器仅支持 http/https");
  return url.toString();
}

function securePreferences(): Electron.WebPreferences {
  return { nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, partition: "persist:research-browser" };
}

function track(window: BrowserWindow): void {
  authorizedWindows.add(window);
  window.on("closed", () => authorizedWindows.delete(window));
  window.webContents.on("will-navigate", (event, url) => {
    try { validateNavigation(url); } catch { event.preventDefault(); }
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    try {
      validateNavigation(url);
      return { action: "allow", overrideBrowserWindowOptions: { autoHideMenuBar: true, webPreferences: securePreferences() } };
    } catch { return { action: "deny" }; }
  });
}

export async function openAuthorized(rawUrl: string): Promise<{ opened: boolean }> {
  if (!permissionsConfigured) {
    const browserSession = session.fromPartition("persist:research-browser");
    browserSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    permissionsConfigured = true;
  }
  const window = new BrowserWindow({
    width: 1180, height: 820, autoHideMenuBar: true,
    title: "授权采集 · 请由本人登录",
    webPreferences: securePreferences(),
  });
  track(window);
  window.webContents.on("did-create-window", (child) => track(child));
  await window.loadURL(validateNavigation(rawUrl));
  return { opened: true };
}

export async function captureAuthorized(): Promise<ExtractedPayload> {
  const focused = BrowserWindow.getFocusedWindow();
  const window = focused && authorizedWindows.has(focused) ? focused : [...authorizedWindows].at(-1);
  if (!window || window.isDestroyed()) throw new Error("没有打开的授权采集窗口");
  const html = await window.webContents.executeJavaScript("document.documentElement.outerHTML", true) as string;
  if (html.length > 10_000_000) throw new Error("当前页面过大，请打开具体报告或表格页后重试");
  const payload = extractHtml(html, window.webContents.getURL());
  payload.metadata.capture = "用户主动触发 · 授权浏览器";
  payload.metadata.session = "Cookie 与登录凭据未发送到主界面或模型";
  return payload;
}

export async function openExternal(rawUrl: string): Promise<void> {
  await shell.openExternal(validateNavigation(rawUrl));
}
