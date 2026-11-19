import { net } from "electron";
import { fetch as undiciFetch, ProxyAgent } from "undici";
import type { NetworkConfig } from "../../lib/research-types";

export async function fetchWithNetwork(
  url: string,
  init: RequestInit,
  network: NetworkConfig,
): Promise<Response> {
  const timeout = AbortSignal.timeout(30_000);
  if (network.mode === "custom") {
    if (!network.proxyUrl) throw new Error("自定义代理模式需要填写代理地址");
    const proxy = new URL(network.proxyUrl);
    if (!["http:", "https:"].includes(proxy.protocol)) throw new Error("代理地址仅支持 http/https");
    return undiciFetch(url, { ...init, body: init.body as never, signal: timeout, dispatcher: new ProxyAgent(network.proxyUrl) }) as unknown as Response;
  }
  if (network.mode === "system") return net.fetch(url, { ...init, signal: timeout });
  return fetch(url, { ...init, signal: timeout });
}

export function friendlyNetworkError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/401|unauthorized/i.test(message)) return "认证失败：请检查 API Key 是否正确、是否已开通对应服务";
  if (/403|forbidden/i.test(message)) return "访问被拒绝：请检查账号权限、服务区域与平台使用条款";
  if (/429|rate.?limit/i.test(message)) return "请求过于频繁或额度不足：请稍后重试并检查套餐用量";
  if (/timeout|timed out|abort/i.test(message)) return "连接超时：可切换直连、系统代理或自定义代理后重试";
  if (/ENOTFOUND|EAI_AGAIN|dns/i.test(message)) return "域名解析失败：请检查网络、DNS 或代理设置";
  if (/ECONNREFUSED|ECONNRESET|socket|TLS|certificate/i.test(message)) return "连接被重置或 TLS 校验失败：请检查代理地址与证书环境";
  return message.slice(0, 300);
}
