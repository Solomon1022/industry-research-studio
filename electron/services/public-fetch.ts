import robotsParser from "robots-parser";
import { validatePublicUrl } from "../../lib/url-security";
import { fetchWithNetwork } from "./http";
import { extractHtml, extractPdf } from "./extract";
import type { ExtractedPayload } from "../../lib/desktop";

const USER_AGENT = "IndustryResearchStudio/0.2 (+local research tool; user-initiated fetch)";
const MAX_HTML = 10 * 1024 * 1024;
const MAX_PDF = 25 * 1024 * 1024;

async function readLimited(response: Response, maxBytes: number): Promise<Buffer> {
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > maxBytes) throw new Error(`文件超过 ${Math.round(maxBytes / 1024 / 1024)}MB 限制`);
  if (!response.body) return Buffer.from(await response.arrayBuffer());
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) { await reader.cancel(); throw new Error("响应体超过大小限制"); }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
}

async function responseFor(url: URL, method = "GET"): Promise<Response> {
  let current = url;
  for (let redirects = 0; redirects < 5; redirects += 1) {
    await validatePublicUrl(current.toString());
    const response = await fetchWithNetwork(current.toString(), {
      method, redirect: "manual", headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/pdf,*/*;q=0.8" },
    }, { mode: "system" });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get("location");
    if (!location) return response;
    current = new URL(location, current);
  }
  throw new Error("重定向次数过多");
}

async function assertRobotsAllowed(url: URL): Promise<string> {
  const robotsUrl = new URL("/robots.txt", url.origin);
  try {
    const response = await responseFor(robotsUrl);
    if (response.status === 404) return "robots.txt 不存在";
    if ([401, 403].includes(response.status)) throw new Error("站点拒绝访问 robots.txt，已停止自动抓取");
    if (!response.ok) return `robots.txt 返回 ${response.status}，未执行额外页面请求`;
    const body = (await readLimited(response, 512 * 1024)).toString("utf8");
    const robots = robotsParser(robotsUrl.toString(), body);
    if (robots.isAllowed(url.toString(), "IndustryResearchStudio") === false) {
      throw new Error("目标页面被 robots.txt 禁止自动采集；可由你本人通过授权浏览器查看并手动整理");
    }
    return "已检查 robots.txt";
  } catch (error) {
    if (error instanceof Error && /robots\.txt|禁止自动采集/.test(error.message)) throw error;
    return "robots.txt 暂时不可达；仅执行本次用户主动请求";
  }
}

export async function extractPublicUrl(raw: string): Promise<ExtractedPayload> {
  const initial = await validatePublicUrl(raw);
  const robotsNote = await assertRobotsAllowed(initial);
  const response = await responseFor(initial);
  if (!response.ok) throw new Error(`网页请求失败（HTTP ${response.status}）`);
  const finalUrl = new URL(response.url || initial.toString());
  await validatePublicUrl(finalUrl.toString());
  const contentType = response.headers.get("content-type")?.toLowerCase() || "";
  const buffer = await readLimited(response, contentType.includes("pdf") ? MAX_PDF : MAX_HTML);
  if (contentType.includes("pdf") || buffer.subarray(0, 4).toString() === "%PDF") {
    const payload = await extractPdf(buffer, finalUrl.pathname.split("/").pop() || "document.pdf", finalUrl.toString());
    payload.metadata.robots = robotsNote;
    return payload;
  }
  if (contentType && !contentType.includes("html") && !contentType.startsWith("text/")) {
    throw new Error(`暂不支持直接提取 ${contentType}，请下载后通过文件导入`);
  }
  const payload = extractHtml(buffer.toString("utf8"), finalUrl.toString());
  payload.metadata.robots = robotsNote;
  payload.checksum = (await import("./extract")).checksum(buffer);
  return payload;
}
