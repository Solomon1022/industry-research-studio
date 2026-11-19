import type { ChatMessage, ModelProfile } from "../../lib/research-types";
import { getSecret } from "./store";
import { fetchWithNetwork } from "./http";

function endpointFor(profile: ModelProfile): string {
  const base = profile.baseUrl.trim().replace(/\/+$/, "");
  if (!base) throw new Error("请填写 Base URL");
  const parsed = new URL(base);
  const loopback = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && loopback)) {
    throw new Error("远程模型接口必须使用 HTTPS；HTTP 仅允许本机回环地址");
  }
  if (profile.apiStyle === "anthropic") return base.endsWith("/messages") ? base : `${base}/messages`;
  return base.endsWith("/chat/completions") ? base : `${base}/chat/completions`;
}

export async function chatWithModel(profile: ModelProfile, messages: ChatMessage[], requireJson = false): Promise<string> {
  if (!profile.model.trim()) throw new Error("请填写模型名或接入点 ID");
  if (!messages.length || messages.some((item) => !item.content.trim())) throw new Error("模型消息不能为空");
  const { apiKey, network } = await getSecret("model", profile.id);
  if (!apiKey) throw new Error(`尚未配置 ${profile.name} 的 API Key`);
  const guardedMessages = requireJson
    ? [{ role: "system" as const, content: "只输出一个合法 JSON 值，不要使用 Markdown 代码围栏，不要添加解释。" }, ...messages]
    : messages;
  const response = await fetchWithNetwork(endpointFor(profile), {
    method: "POST",
    headers: profile.apiStyle === "anthropic"
      ? { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" }
      : { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(profile.apiStyle === "anthropic" ? {
      model: profile.model.trim(), max_tokens: 4096,
      system: guardedMessages.filter((item) => item.role === "system").map((item) => item.content).join("\n\n"),
      messages: guardedMessages.filter((item) => item.role !== "system").map((item) => ({ role: item.role, content: item.content })),
    } : {
      model: profile.model.trim(), messages: guardedMessages, temperature: 0.1, stream: false,
    }),
  }, network);
  if (!response.ok) throw new Error(`${profile.name} 请求失败（HTTP ${response.status}）`);
  const data = await response.json() as {
    choices?: Array<{ message?: { content?: string | Array<{ type: string; text?: string }> } }>;
    content?: Array<{ type: string; text?: string }>;
  };
  const content = profile.apiStyle === "anthropic"
    ? (data.content ?? []).filter((item) => item.type === "text").map((item) => item.text ?? "").join("\n")
    : data.choices?.[0]?.message?.content;
  const text = Array.isArray(content) ? content.map((item) => item.text ?? "").join("\n") : content;
  if (!text?.trim()) throw new Error("模型返回了空内容或无法识别的响应结构");
  return text.trim();
}
