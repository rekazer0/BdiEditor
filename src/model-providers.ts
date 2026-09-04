export type ModelProtocol = "anthropic" | "openai-chat" | "openai-responses" | "google"

export interface ModelProviderPreset {
  id: string
  label: string
  protocol: ModelProtocol
  apiUrl: string
  model: string
}

export const MODEL_PROVIDER_PRESETS: readonly ModelProviderPreset[] = [
  { id: "anthropic", label: "Anthropic", protocol: "anthropic", apiUrl: "https://api.anthropic.com/v1", model: "claude-sonnet-4-20250514" },
  { id: "anthropic-compatible", label: "Anthropic 兼容格式", protocol: "anthropic", apiUrl: "", model: "" },
  { id: "openai", label: "OpenAI", protocol: "openai-chat", apiUrl: "https://api.openai.com/v1", model: "gpt-5" },
  { id: "openai-responses", label: "OpenAI Responses 格式", protocol: "openai-responses", apiUrl: "https://api.openai.com/v1", model: "gpt-5" },
  { id: "chatgpt-codex", label: "ChatGPT 订阅 (Codex)", protocol: "openai-responses", apiUrl: "https://api.openai.com/v1", model: "gpt-5-codex" },
  { id: "xai-subscription", label: "xAI 订阅 (Grok)", protocol: "openai-chat", apiUrl: "https://api.x.ai/v1", model: "grok-4" },
  { id: "deepseek", label: "DeepSeek", protocol: "openai-chat", apiUrl: "https://api.deepseek.com/v1", model: "deepseek-chat" },
  { id: "google", label: "Google", protocol: "google", apiUrl: "https://generativelanguage.googleapis.com/v1beta", model: "gemini-2.5-pro" },
  { id: "kimi-api", label: "Kimi API", protocol: "openai-chat", apiUrl: "https://api.moonshot.cn/v1", model: "moonshot-v1-8k" },
  { id: "kimi-coding-plan", label: "Kimi Coding Plan", protocol: "anthropic", apiUrl: "https://api.kimi.com/coding/v1", model: "kimi-for-coding" },
  { id: "opencode-go", label: "OpenCode Go (OpenAI 协议)", protocol: "openai-chat", apiUrl: "https://opencode.ai/zen/v1", model: "" },
  { id: "zhipu-ai", label: "智谱 AI", protocol: "openai-chat", apiUrl: "https://open.bigmodel.cn/api/paas/v4", model: "glm-4.5" },
  { id: "zhipu-coding-plan", label: "智谱 Coding Plan", protocol: "openai-chat", apiUrl: "https://open.bigmodel.cn/api/coding/paas/v4", model: "glm-4.5" },
  { id: "zhipu-coding-plan-team", label: "智谱 Coding Plan 团队版", protocol: "openai-chat", apiUrl: "https://open.bigmodel.cn/api/coding/paas/v4", model: "glm-4.5" },
  { id: "volcengine-agent-plan", label: "火山方舟 Agent Plan", protocol: "openai-chat", apiUrl: "https://ark.cn-beijing.volces.com/api/v3", model: "" },
  { id: "volcengine-coding-plan", label: "火山方舟 Coding Plan", protocol: "openai-chat", apiUrl: "https://ark.cn-beijing.volces.com/api/coding/v3", model: "" },
  { id: "volcengine-api", label: "火山引擎 API", protocol: "openai-chat", apiUrl: "https://ark.cn-beijing.volces.com/api/v3", model: "" },
  { id: "minimax", label: "MiniMax (API & 编程包)", protocol: "openai-chat", apiUrl: "https://api.minimaxi.com/v1", model: "MiniMax-M2" },
  { id: "qwen", label: "通义千问", protocol: "openai-chat", apiUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen3-coder-plus" },
]

export function modelProviderPreset(id: string): ModelProviderPreset {
  return MODEL_PROVIDER_PRESETS.find((provider) => provider.id === id) ?? MODEL_PROVIDER_PRESETS[2]
}
