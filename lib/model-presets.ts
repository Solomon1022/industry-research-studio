import type { ModelProfile, ModelProvider } from "./research-types";

/** 预设只减少配置工作；模型名与可用区域以各服务商后台为准，均可修改。 */
export const MODEL_PRESETS: Record<ModelProvider, ModelProfile> = {
  openai: { id: "openai", name: "OpenAI", baseUrl: "https://api.openai.com/v1", model: "gpt-4.1-mini", apiStyle: "openai" },
  deepseek: { id: "deepseek", name: "DeepSeek", baseUrl: "https://api.deepseek.com", model: "deepseek-flash", apiStyle: "openai" },
  qwen: { id: "qwen", name: "通义千问", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-plus", apiStyle: "openai" },
  doubao: { id: "doubao", name: "豆包 / 火山方舟", baseUrl: "https://ark.cn-beijing.volces.com/api/v3", model: "", apiStyle: "openai" },
  moonshot: { id: "moonshot", name: "Kimi / Moonshot", baseUrl: "https://api.moonshot.cn/v1", model: "moonshot-v1-8k", apiStyle: "openai" },
  zhipu: { id: "zhipu", name: "智谱 GLM", baseUrl: "https://open.bigmodel.cn/api/paas/v4", model: "glm-4-flash", apiStyle: "openai" },
  gemini: { id: "gemini", name: "Google Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-2.0-flash", apiStyle: "openai" },
  anthropic: { id: "anthropic", name: "Anthropic Claude", baseUrl: "https://api.anthropic.com/v1", model: "", apiStyle: "anthropic" },
  openrouter: { id: "openrouter", name: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", model: "", apiStyle: "openai" },
  custom: { id: "custom", name: "自定义 / OpenAI 兼容中转", baseUrl: "", model: "", apiStyle: "openai" },
};

export const MODEL_PROVIDER_ORDER = Object.keys(MODEL_PRESETS) as ModelProvider[];
