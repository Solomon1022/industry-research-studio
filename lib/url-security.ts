import { promises as dns } from "node:dns";
import { isIP } from "node:net";

function privateAddress(address: string): boolean {
  const normalized = address.toLowerCase().replace(/^::ffff:/, "");
  if (["0.0.0.0", "127.0.0.1", "localhost", "::1", "::"].includes(normalized)) return true;
  if (/^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(normalized)) return true;
  if (/^(fc|fd|fe80)/.test(normalized)) return true;
  if (/^0\./.test(normalized) || /^224\./.test(normalized) || /^255\./.test(normalized)) return true;
  return false;
}

export async function validatePublicUrl(raw: string): Promise<URL> {
  const url = new URL(raw);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("只允许 http/https 公开链接");
  if (url.username || url.password) throw new Error("链接中不允许包含账号或密码");
  if (isIP(url.hostname) && privateAddress(url.hostname)) throw new Error("不允许访问本机或内网地址");
  if (!isIP(url.hostname)) {
    const records = await dns.lookup(url.hostname, { all: true, verbatim: true });
    if (!records.length || records.some((record) => privateAddress(record.address))) throw new Error("目标域名解析到本机或内网地址，已阻止访问");
  }
  return url;
}
