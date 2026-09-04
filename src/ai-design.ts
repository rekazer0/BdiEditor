import { Agent, type AgentEvent, type AgentTool } from "@earendil-works/pi-agent-core"
import {
  Type,
  createModels,
  createProvider,
  envApiKeyAuth,
  type Api,
  type Model,
  type ProviderStreams,
} from "@earendil-works/pi-ai"
import { anthropicMessagesApi } from "@earendil-works/pi-ai/api/anthropic-messages.lazy"
import { googleGenerativeAIApi } from "@earendil-works/pi-ai/api/google-generative-ai.lazy"
import { openAICompletionsApi } from "@earendil-works/pi-ai/api/openai-completions.lazy"
import { openAIResponsesApi } from "@earendil-works/pi-ai/api/openai-responses.lazy"
import { AiSkinWorkspace, type AiSkinDraftChange, type AiSkinEditableFile } from "./ai-skin-workspace.ts"
import type { ModelProtocol } from "./model-providers.ts"

export type AiDesignConfiguration = {
  provider: string
  protocol: ModelProtocol
  apiUrl: string
  model: string
  apiKey: string
}

export type AiDesignProject = {
  format: "bdi" | "bds" | "bda"
  theme: string
  orientation: string
  layout: string
  selectedPath?: string
  selectedTarget: string
  selectedSections: readonly string[]
  files: readonly AiSkinEditableFile[]
}

export type AiDesignResult = {
  changes: AiSkinDraftChange[]
  response: string
  toolCalls: number
}

type StatusKind = "thinking" | "reading" | "editing" | "done"

const MAX_TOOL_CALLS = 80
const MAX_TURNS = 12

function jsonResult(details: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(details) }],
    details,
  }
}

function normalizedUrl(value: string): string {
  return value.trim().replace(/\/+$/, "")
}

function modelApi(protocol: ModelProtocol): Api {
  if (protocol === "anthropic") return "anthropic-messages"
  if (protocol === "google") return "google-generative-ai"
  if (protocol === "openai-responses") return "openai-responses"
  return "openai-completions"
}

function apiStreams(protocol: ModelProtocol): ProviderStreams {
  if (protocol === "anthropic") return anthropicMessagesApi()
  if (protocol === "google") return googleGenerativeAIApi()
  if (protocol === "openai-responses") return openAIResponsesApi()
  return openAICompletionsApi()
}

function configuredModel(config: AiDesignConfiguration): Model<Api> {
  const api = modelApi(config.protocol)
  return {
    id: config.model.trim(),
    name: config.model.trim(),
    api,
    provider: "bdi-editor",
    baseUrl: normalizedUrl(config.apiUrl),
    reasoning: /^(?:o\d|gpt-5|claude-(?:3-7|4)|gemini-2\.5)/i.test(config.model.trim()),
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128_000,
    maxTokens: 8_192,
  }
}

function systemPrompt(project: AiDesignProject): string {
  const selection = project.selectedSections.length ? project.selectedSections.join(", ") : "无"
  return `你是百度输入法皮肤编辑器中的受限修复代理。你只能通过下列工具查询和修改当前打开的皮肤项目，不能访问磁盘、网络、命令行或项目外文件。

当前项目：格式 ${project.format.toUpperCase()}，主题 ${project.theme}，方向 ${project.orientation}，布局 ${project.layout}，当前文件 ${project.selectedPath ?? "无"}，用户当前选择“${project.selectedTarget}”，对应配置节 ${selection}。

选择范围要求：如果存在选中的按键或配置节，用户的设计要求默认只作用于这些对象；不得顺带重做未选按键或整个布局。只有当前没有局部选择，或用户明确要求全局调整时，才把任务理解为当前布局整体修改。

可用修复接口：
1. inspect_project：查看项目上下文、权限和硬限制。每次任务先调用它。
2. list_project_files：列出允许读取或修改的配置文件，可按相对路径前缀筛选。
3. read_project_file：分页读取一个明确列出的文件。修改前必须先读取目标片段。
4. set_ini_value：在已有 INI 配置节中新增配置键，或修改已有键。适用于 BDI/BDS 的 .ini/.css 配置。
5. remove_ini_value：删除已有 INI 配置键。只有用户需求明确要求删除时才使用。
6. replace_project_text：在 BDA JSON 中做唯一、精确的小片段替换；必须提供预期出现次数。不要用它重写整个文件。

安全要求：
- 不存在创建或删除文件、图片、二进制资源、配置节以及执行 shell 的接口，不要尝试这些操作。
- 所有路径必须来自 list_project_files，禁止猜测路径、绝对路径和 ..。
- 保持当前按键布局时，不得改几何、按键数量、动作或配置节结构。
- 优先修改少量颜色、字号、字体、样式引用和已有属性；保留未知字段及现有命名。
- 工具修改只进入草稿，编辑器会在结束后统一校验并作为一次可撤销操作提交。
- 完成后用简短中文总结修改了哪些文件和视觉效果；如果无法安全完成，说明原因且不要做近似破坏性修改。`
}

function toolsFor(workspace: AiSkinWorkspace, project: AiDesignProject): AgentTool[] {
  let inspected = false
  const requireInspection = (): void => {
    if (!inspected) throw new Error("必须先调用 inspect_project 检查项目权限")
  }
  const inspectProjectSchema = Type.Object({})
  const inspectProject: AgentTool<typeof inspectProjectSchema> = {
    name: "inspect_project",
    label: "检查皮肤项目",
    description: "返回当前皮肤格式、选择状态、可用修复接口和修改限制。开始修复时必须先调用。",
    parameters: inspectProjectSchema,
    executionMode: "sequential",
    execute: async () => {
      inspected = true
      return jsonResult({
        format: project.format,
        theme: project.theme,
        orientation: project.orientation,
        layout: project.layout,
        selectedPath: project.selectedPath,
        selectedTarget: project.selectedTarget,
        selectedSections: project.selectedSections,
        permissions: {
          filesystem: false,
          shell: false,
          createFile: false,
          deleteFile: false,
          editExistingTextOnly: true,
          maxChangedFiles: 8,
          maxMutations: 64,
        },
      })
    },
  }

  const listFilesSchema = Type.Object({
    prefix: Type.Optional(Type.String({ description: "可选的项目相对路径前缀" })),
  })
  const listFiles: AgentTool<typeof listFilesSchema> = {
    name: "list_project_files",
    label: "列出皮肤配置",
    description: "列出模型获准访问的现有文本配置。返回的精确相对路径才能用于其他工具。",
    parameters: listFilesSchema,
    executionMode: "sequential",
    execute: async (_id, { prefix }) => {
      requireInspection()
      return jsonResult(workspace.listFiles(prefix ?? ""))
    },
  }

  const readFileSchema = Type.Object({
    path: Type.String({ description: "list_project_files 返回的精确相对路径" }),
    offset: Type.Optional(Type.Integer({ minimum: 0 })),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 40_000 })),
  })
  const readFile: AgentTool<typeof readFileSchema> = {
    name: "read_project_file",
    label: "读取皮肤配置",
    description: "分页读取一个已授权配置文件，单次最多返回 40000 字符。",
    parameters: readFileSchema,
    executionMode: "sequential",
    execute: async (_id, { path, offset, limit }) => {
      requireInspection()
      return jsonResult(workspace.readFile(path, offset, limit))
    },
  }

  const setIniValueSchema = Type.Object({
    path: Type.String({ description: "已授权的 INI/CSS 配置路径" }),
    section: Type.String({ description: "已有配置节名称；全局配置用空字符串" }),
    key: Type.String({ description: "配置键名称" }),
    value: Type.String({ description: "新的单行配置值" }),
  })
  const setIniValue: AgentTool<typeof setIniValueSchema> = {
    name: "set_ini_value",
    label: "设置皮肤配置值",
    description: "在已有 INI 配置节中新增键或修改键值；不能创建配置节或文件。",
    parameters: setIniValueSchema,
    executionMode: "sequential",
    execute: async (_id, { path, section, key, value }) => {
      requireInspection()
      return jsonResult({ status: workspace.setIniValue(path, section, key, value), path, section, key })
    },
  }

  const removeIniValueSchema = Type.Object({
    path: Type.String({ description: "已授权的 INI/CSS 配置路径" }),
    section: Type.String({ description: "已有配置节名称；全局配置用空字符串" }),
    key: Type.String({ description: "要删除的配置键名称" }),
  })
  const removeIniValue: AgentTool<typeof removeIniValueSchema> = {
    name: "remove_ini_value",
    label: "删除皮肤配置值",
    description: "删除已有 INI 配置键；仅在用户明确要求删除该属性时使用，不能删除节或文件。",
    parameters: removeIniValueSchema,
    executionMode: "sequential",
    execute: async (_id, { path, section, key }) => {
      requireInspection()
      return jsonResult({ removed: workspace.removeIniValue(path, section, key), path, section, key })
    },
  }

  const replaceProjectTextSchema = Type.Object({
    path: Type.String({ description: "已授权的 BDA JSON 配置路径" }),
    oldText: Type.String({ minLength: 1, maxLength: 50_000 }),
    newText: Type.String({ maxLength: 50_000 }),
    expectedOccurrences: Type.Integer({ minimum: 1, maximum: 20 }),
  })
  const replaceProjectText: AgentTool<typeof replaceProjectTextSchema> = {
    name: "replace_project_text",
    label: "精确修改 BDA JSON",
    description: "只对已授权 BDA JSON 做精确小片段替换。替换后必须仍是 JSON 对象，不能重写整个文件。",
    parameters: replaceProjectTextSchema,
    executionMode: "sequential",
    execute: async (_id, { path, oldText, newText, expectedOccurrences }) => {
      requireInspection()
      const file = workspace.listFiles().find((entry) => entry.path === path)
      if (file?.syntax !== "json") throw new Error("精确文本替换只允许用于 BDA JSON 配置")
      return jsonResult({
        replacements: workspace.replaceText(path, oldText, newText, expectedOccurrences),
        path,
      })
    },
  }

  return [inspectProject, listFiles, readFile, setIniValue, removeIniValue, replaceProjectText]
}

function eventStatus(event: AgentEvent): { kind: StatusKind; text: string } | undefined {
  if (event.type === "agent_start") return { kind: "thinking", text: "AI 正在分析当前皮肤…" }
  if (event.type === "tool_execution_start") {
    const editing = ["set_ini_value", "remove_ini_value", "replace_project_text"].includes(event.toolName)
    return { kind: editing ? "editing" : "reading", text: editing ? "AI 正在生成受限修改草稿…" : "AI 正在读取项目配置…" }
  }
  if (event.type === "agent_end") return { kind: "done", text: "AI 已完成分析，正在校验修改…" }
  return undefined
}

function finalResponse(agent: Agent): string {
  const message = [...agent.state.messages].reverse().find((entry) => entry.role === "assistant")
  if (!message || message.role !== "assistant") return ""
  return message.content.flatMap((content) => content.type === "text" ? [content.text] : []).join("\n").trim()
}

export async function runAiSkinDesign(
  config: AiDesignConfiguration,
  project: AiDesignProject,
  prompt: string,
  options: {
    signal?: AbortSignal
    onStatus?: (kind: StatusKind, text: string) => void
  } = {},
): Promise<AiDesignResult> {
  if (!normalizedUrl(config.apiUrl)) throw new Error("请先配置模型 API 地址")
  if (!config.model.trim()) throw new Error("请先配置模型名称")
  if (!config.apiKey.trim()) throw new Error("请先配置模型 API 密钥")
  if (!project.files.length) throw new Error("当前皮肤没有可供 AI 编辑的配置文件")

  const workspace = new AiSkinWorkspace(project.files)
  const model = configuredModel(config)
  const api = apiStreams(config.protocol)
  const models = createModels()
  models.setProvider(createProvider({
    id: model.provider,
    name: "BdiEditor configured provider",
    baseUrl: model.baseUrl,
    auth: { apiKey: envApiKeyAuth("API key", []) },
    models: [model],
    api,
  }))

  const allowedTools = new Set([
    "inspect_project",
    "list_project_files",
    "read_project_file",
    "set_ini_value",
    "remove_ini_value",
    "replace_project_text",
  ])
  let toolCalls = 0
  let turns = 0
  const agent = new Agent({
    initialState: {
      systemPrompt: systemPrompt(project),
      model,
      thinkingLevel: model.reasoning ? "medium" : "off",
      tools: toolsFor(workspace, project),
    },
    streamFn: models.streamSimple.bind(models),
    getApiKey: () => config.apiKey.trim(),
    toolExecution: "sequential",
    beforeToolCall: async ({ toolCall }) => {
      toolCalls += 1
      if (!allowedTools.has(toolCall.name)) return { block: true, reason: "该工具未获皮肤编辑器授权", terminate: true }
      if (toolCalls > MAX_TOOL_CALLS) return { block: true, reason: "已达到本轮工具调用上限", terminate: true }
      return undefined
    },
    shouldStopAfterTurn: async () => {
      turns += 1
      return turns >= MAX_TURNS
    },
    maxRetryDelayMs: 10_000,
  })
  const unsubscribe = agent.subscribe((event) => {
    const status = eventStatus(event)
    if (status) options.onStatus?.(status.kind, status.text)
  })
  const abort = () => agent.abort()
  if (options.signal?.aborted) abort()
  else options.signal?.addEventListener("abort", abort, { once: true })
  try {
    await agent.prompt(prompt.trim())
    if (options.signal?.aborted) throw new DOMException("AI 设计已取消", "AbortError")
    if (agent.state.errorMessage) throw new Error(agent.state.errorMessage)
    return { changes: workspace.changes(), response: finalResponse(agent), toolCalls }
  } finally {
    options.signal?.removeEventListener("abort", abort)
    unsubscribe()
  }
}
