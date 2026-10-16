import { Agent, type AgentEvent, type AgentMessage, type AgentTool, type ThinkingLevel } from "@earendil-works/pi-agent-core"
import {
  Type,
  createModels,
  createProvider,
  envApiKeyAuth,
  type Api,
  type ImageContent,
  type Model,
  type ProviderStreams,
} from "@earendil-works/pi-ai"
import { anthropicMessagesApi } from "@earendil-works/pi-ai/api/anthropic-messages.lazy"
import { googleGenerativeAIApi } from "@earendil-works/pi-ai/api/google-generative-ai.lazy"
import { openAICompletionsApi } from "@earendil-works/pi-ai/api/openai-completions.lazy"
import { openAIResponsesApi } from "@earendil-works/pi-ai/api/openai-responses.lazy"
import { Channel, invoke } from "@tauri-apps/api/core"
import { AiSkinImages, base64, type AiSkinImageFile } from "./ai-skin-images.ts"
import { aiSkinSkill } from "./ai-skin-skill.ts"
import { AiSkinWorkspace, type AiSkinDraftChange, type AiSkinEditableFile } from "./ai-skin-workspace.ts"
import type { ModelProtocol } from "./model-providers.ts"

type AiDesignConfiguration = {
  provider: string
  protocol: ModelProtocol
  apiUrl: string
  model: string
  apiKey: string
}

type AiDesignProject = {
  format: "bdi" | "bds" | "bda" | "ssf"
  skinName: string
  skinPath: string
  theme: string
  orientation: string
  layout: string
  keyboard: string
  panelPath: string
  panelScope: "panel" | "project"
  selectedKey: {
    label: string
    sections: string[]
    values: Record<string, string>
  }
  preview?: ImageContent
  files: readonly AiSkinEditableFile[]
  /** PNG assets (BDI/BDS/SSF) the AI may view, recolour or regenerate. */
  images?: readonly AiSkinImageFile[]
}

type AiDesignResult = {
  changes: AiSkinDraftChange[]
  response: string
  toolCalls: number
  conversation: AiDesignConversation
  variants?: AiDesignVariant[]
}

type AiDesignVariant = {
  id: string
  title: string
  changes: AiSkinDraftChange[]
  response: string
  toolCalls: number
  conversation: AiDesignConversation
}

export type AiDesignConversation = AgentMessage[]

type AiDesignAttachments = { images: ImageContent[]; text: string }

const ATTACHMENT_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"])
const ATTACHMENT_IMAGE_BYTES = 8 * 1024 * 1024
const ATTACHMENT_TEXT_CHARS = 60_000

/** Turns pasted/dropped files into model input: images as image parts, UTF-8 text files inlined into the prompt. */
export async function aiDesignAttachments(files: readonly File[]): Promise<AiDesignAttachments> {
  const images: ImageContent[] = []
  const texts: string[] = []
  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer())
    if (ATTACHMENT_IMAGE_TYPES.has(file.type)) {
      if (bytes.length > ATTACHMENT_IMAGE_BYTES) throw new Error(`图片过大（超过 8MB）：${file.name}`)
      images.push({ type: "image", data: base64(bytes), mimeType: file.type })
      continue
    }
    let text: string
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
    } catch {
      throw new Error(`暂不支持该附件，请附加图片或文本文件：${file.name}`)
    }
    if (text.includes("\0")) throw new Error(`暂不支持该附件，请附加图片或文本文件：${file.name}`)
    const clipped = text.length > ATTACHMENT_TEXT_CHARS ? `${text.slice(0, ATTACHMENT_TEXT_CHARS)}\n…（已截断）` : text
    texts.push(`附件「${contextText(file.name, 120)}」：\n\`\`\`\n${clipped}\n\`\`\``)
  }
  return { images, text: texts.join("\n\n") }
}

type StatusKind = "thinking" | "reading" | "editing" | "done"
type ModelHttpEvent =
  | { type: "headers"; status: number; headers: Array<[string, string]> }
  | { type: "chunk"; body: number[] }
  | { type: "end" }

function jsonResult(details: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(details) }],
    details,
  }
}

function normalizedUrl(value: string): string {
  return value.trim().replace(/\/+$/, "")
}

function contextText(value: string, max = 160): string {
  return value.replace(/[\r\n]+/g, " ").trim().slice(0, max) || "未提供"
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

function configuredModel(config: AiDesignConfiguration, thinkingLevel: ThinkingLevel): Model<Api> {
  const api = modelApi(config.protocol)
  return {
    id: config.model.trim(),
    name: config.model.trim(),
    api,
    provider: "bdi-editor",
    baseUrl: normalizedUrl(config.apiUrl),
    // The user picks the effort; "off" sends no reasoning parameters at all.
    reasoning: thinkingLevel !== "off",
    input: ["text", "image"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128_000,
    // DeepSeek-style APIs count reasoning inside max_tokens; 8K truncates a long think before any tool call.
    maxTokens: thinkingLevel === "off" ? 8_192 : 32_768,
  }
}

function imageGuide(project: AiDesignProject, canGenerate: boolean): string {
  if (!project.images?.length) return "当前格式不支持修改图片像素；不要因此拒绝整轮设计，先用已有样式、颜色、字体和引用完成可行调整，并说明未改动图片。"
  if (project.format === "ssf") {
    return `按键背景、前景图和图标的颜色画在 PNG 里。先按格式技能从按键类找到 NORMAL/PRESSED 引用的图片（\`图片.png,左,右,上,下\` 的第一项），用 view_image 确认（只查看目标按键实际引用的图片），再用 recolor_image 改色${canGenerate ? "；需要新图案或新风格时用 generate_image 生成" : "；当前未配置生图模型，用户要求新图案时直接告诉用户“未配置生图模型，请在 设置 > 大模型 > 生图模型 中配置”"}。同一张图片常被多个按键类共享，常态与按下态通常要一起改。可授权图片：${project.images.map((image) => image.path).join("、")}。`
  }
  return `按键背景、图标的颜色常常直接画在 PNG 里，样式表没有颜色字段可改。此时先用 NM_IMG/HL_IMG 找到 \`图片名,切片序号\`，对应 res/图片名.png 的 IMG切片序号，用 view_image 确认（只查看目标按键实际引用的图片，不要逐张浏览全部资源），再用 recolor_image 改色${canGenerate ? "；需要新图案、新风格或质感重绘时用 generate_image 生成" : "。当前未配置生图模型：纯改色仍可用 recolor_image 完成；用户明确要求生成、重绘或编辑图片的图案/风格时，不要用改色或叠加色凑合，直接告诉用户“未配置生图模型，请在 设置 > 大模型 > 生图模型 中配置”"}。同一张图片的切片可能被多个样式共享，改前在样式表里确认引用范围；常态与按下态（NM_IMG/HL_IMG）通常要一起改。可授权图片：${project.images.map((image) => image.path).join("、")}。`
}

function systemPrompt(project: AiDesignProject, canGenerate: boolean): string {
  const selected = project.selectedKey.sections.length
    ? `${contextText(project.selectedKey.label, 80)}（配置节：${project.selectedKey.sections.map((section) => contextText(section, 80)).join("、")}）`
    : "当前没有选中的按键"
  const selectedValues = Object.entries(project.selectedKey.values)
    .filter(([, value]) => value.trim())
    .map(([key, value]) => `${contextText(key, 80)}=${contextText(value)}`)
    .join("；")
  return `你是输入法皮肤编辑器中的受限修复代理。你只能通过下列工具查询和修改当前打开的皮肤项目，不能访问磁盘、网络、命令行或项目外文件。

当前项目：皮肤“${contextText(project.skinName, 120)}”（${contextText(project.skinPath, 120)}），格式 ${contextText(project.format, 20).toUpperCase()}，当前预览主题 ${contextText(project.theme, 20)}，方向 ${contextText(project.orientation, 20)}，布局 ${contextText(project.layout, 80)}，键盘设备 ${contextText(project.keyboard, 80)}。
当前选择：${selected}${selectedValues ? `；已暴露字段：${selectedValues}` : ""}。
当前打开面板：${contextText(project.panelPath, 160)}。本轮范围：${project.panelScope === "project" ? "整个皮肤项目（用户明确要求了全局范围）" : "当前打开的面板及其引用的全局配置与样式表"}。除非用户明确说“整个皮肤”“全局”或“所有面板”，不要修改其他面板的布局文件。
${project.preview ? "本轮请求附带当前画布预览图（候选栏与面板），你可以直接观察现有图片资源的实际颜色、纹理、层次和可读性；图像仅供观察，不能据此猜测不存在的配置字段。" : "当前没有可用的画布预览图。"}

已授权的配置文件（无需先枚举）：${project.files.map((file) => `${file.path} [${file.syntax}]`).join("、") || "无"}。

视觉修改指南（请先阅读配置，再用最少的精确修改实现）：
- 配色：优先沿用现有颜色字段和明暗语义，保证普通/高亮/禁用状态有足够对比度；纯配色调整不要新建配置节。
${project.format === "ssf" ? "- 文字：只调整已有 TEXT_COLOR、TEXT_COLOR_PRESSED 等颜色字段（0xAARRGGBB），保持按键类和引用结构不变。" : "- 字体：只调整已有 FONT_NAME、FONT_SIZE、NM_COLOR、HL_COLOR 等字段，保持按键动作、数量和几何不变。"}
- 质感：通过已有背景样式、边框、圆角、阴影或样式引用统一风格。
- 图片资源：${imageGuide(project, canGenerate)}
${project.format === "ssf" ? "- 布局：搜狗皮肤不含按键位置和数量，排布由搜狗输入法决定；用户要求改布局时用一句话说明做不到，只完成视觉部分。" : `- 布局：用户说“保留布局”时禁止修改位置、尺寸、间距、按键数量、动作和配置节结构；只改视觉属性。
- 重排布局（例如“改为14键”“加一个按键”“去掉某键”）：这是允许的。先读完当前布局所有 KEY 节，规划新网格；用 set_ini_value 改已有按键的 VIEW_RECT/TOUCH_RECT/动作，用 add_ini_section 新增按键（复制相邻同类按键的全部字段，只改几何、动作和样式引用），用 remove_ini_sections 删掉多余按键。新按键需要新文字时，复制一个现有文字样式节为新的 STYLEn 并改 SHOW，再让按键 FORE_STYLE 指向它。按键之间不得重叠，整体不超出 [PANEL] SIZE。`}
- 范围：默认只修改当前打开面板及其引用的样式；用户说“整个皮肤/全局/所有面板”时才检查全部相关配置。
- 不要因为某个字段不在当前布局文件里就放弃：先按下面的格式技能追踪样式引用，到样式表中找到真正的来源。
- 验证：每次写入前必须 read_project_file；修改完成后复读关键片段并在总结中说明影响范围。

${aiSkinSkill(project.format)}

可用修复接口：
1. read_project_file：分页读取一个已授权配置文件。修改前必须先读取目标片段。
2. read_ini_sections：按配置节名直接读取 INI/CSS 中的若干节，适合在大样式表中定位 [STYLEN]。读取后即可修改该文件。
3. set_ini_value：在已有 INI 配置节中新增配置键，或修改已有键。适用于 BDI/BDS 的 .ini/.css 与搜狗皮肤的 .ini 配置。
4. remove_ini_value：删除已有 INI 配置键。只有用户需求明确要求删除时才使用。
5. add_ini_section / remove_ini_sections：新增或删除整个 INI 配置节，仅用于用户要求增删按键、重排布局或需要新样式时。
6. replace_project_text：在 BDA JSON 中做唯一、精确的小片段替换；必须提供预期出现次数。不要用它重写整个文件。
${project.images?.length ? `7. view_image：查看一张已授权 PNG 或其中一个切片，返回尺寸、切片列表、平均色和缩略图。
8. recolor_image：把整张图或某个切片重新着色为目标颜色，保留明暗、光泽和透明度；默认不改灰白黑像素（如白色图标）。
${canGenerate ? "9. generate_image：用图片生成模型按描述画一张新图，填入整张图或某个切片；默认按原切片的透明轮廓裁剪，保持按键形状。\n" : ""}` : ""}
安全要求：
- 不存在创建或删除文件、新建图片文件以及执行 shell 的接口，不要尝试这些操作；已有图片只能通过图片工具修改像素。
- 只能使用上面已授权的相对路径，禁止绝对路径和 ..。
- 用户没有要求改布局时，不得改几何、按键数量、动作或配置节结构。
- 优先修改少量颜色、字号、字体、样式引用和已有属性；保留未知字段及现有命名。
- 工具修改只进入草稿，编辑器会在结束后统一校验并作为一次可撤销操作提交。
- 如果无法安全完成，说明原因且不要做近似破坏性修改。
- 需求中工具做不到的部分（例如 BDA 格式增删按键、按键动画、未配置生图模型时的新图案）用一句话说明，然后直接完成可行部分，不要反复权衡。
- 用户要求整体换风格时，改动共享的样式或图片切片是预期行为，在总结中点明影响即可，不必为此犹豫。

最终回复（给普通用户看）：
- 用 1–3 句简短中文说明看得到的效果，例如“回车键已改为橙色，按下态同步调整”。
- 只有当修改会影响其他按键或面板时，用一句话点明。
- 不要列出文件路径、配置节、字段名、工具步骤、思考过程，不要写“说明与限制”之类的标题或长列表；编辑器会单独展示草稿明细。`
}

function toolsFor(workspace: AiSkinWorkspace, images: AiSkinImages, imageModel?: AiDesignConfiguration): AgentTool[] {
  const readFileSchema = Type.Object({
    path: Type.String({ description: "系统提示中已授权的项目相对路径" }),
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
      return jsonResult(workspace.readFile(path, offset, limit))
    },
  }

  const readIniSectionsSchema = Type.Object({
    path: Type.String({ description: "已授权的 INI/CSS 配置路径" }),
    sections: Type.Array(Type.String(), { minItems: 1, maxItems: 40, description: "配置节名称，例如 STYLE72" }),
  })
  const readIniSections: AgentTool<typeof readIniSectionsSchema> = {
    name: "read_ini_sections",
    label: "读取配置节",
    description: "按名称读取 INI/CSS 配置节的全部键值，返回不存在的节名列表。",
    parameters: readIniSectionsSchema,
    executionMode: "sequential",
    execute: async (_id, { path, sections }) => {
      return jsonResult({ path, ...workspace.readIniSections(path, sections) })
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
      return jsonResult({ removed: workspace.removeIniValue(path, section, key), path, section, key })
    },
  }

  const addIniSectionSchema = Type.Object({
    path: Type.String({ description: "已授权的 INI/CSS 配置路径" }),
    section: Type.String({ description: "新配置节名称，例如 KEY15 或 STYLE300" }),
    entries: Type.Array(Type.Object({ key: Type.String(), value: Type.String() }), { maxItems: 80, description: "按顺序写入的键值" }),
  })
  const addIniSection: AgentTool<typeof addIniSectionSchema> = {
    name: "add_ini_section",
    label: "新增配置节",
    description: "在 INI/CSS 末尾新增一个配置节（新按键 KEYn、新样式 STYLEn 等）。KEY 节会自动连续编号并同步 [PANEL] KEY_NUM，STYLE 节会同步 STYLE_NUM；返回实际节名。",
    parameters: addIniSectionSchema,
    executionMode: "sequential",
    execute: async (_id, { path, section, entries }) => {
      return jsonResult({ section: workspace.addIniSection(path, section, entries), path })
    },
  }

  const removeIniSectionsSchema = Type.Object({
    path: Type.String({ description: "已授权的 INI/CSS 配置路径" }),
    sections: Type.Array(Type.String(), { minItems: 1, maxItems: 80 }),
  })
  const removeIniSections: AgentTool<typeof removeIniSectionsSchema> = {
    name: "remove_ini_sections",
    label: "删除配置节",
    description: "删除已有配置节（例如重排布局时去掉多余按键）。KEY 节删除后会重新连续编号并同步 KEY_NUM，返回 旧节名→新节名 映射。",
    parameters: removeIniSectionsSchema,
    executionMode: "sequential",
    execute: async (_id, { path, sections }) => {
      return jsonResult({ renamed: workspace.removeIniSections(path, sections), path })
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
      const file = workspace.listFiles().find((entry) => entry.path === path)
      if (file?.syntax !== "json") throw new Error("精确文本替换只允许用于 BDA JSON 配置")
      return jsonResult({
        replacements: workspace.replaceText(path, oldText, newText, expectedOccurrences),
        path,
      })
    },
  }

  const tools: AgentTool[] = [readFile, readIniSections, setIniValue, removeIniValue, addIniSection, removeIniSections, replaceProjectText]
  if (!images.paths().length) return tools

  const imagePath = Type.String({ description: "已授权的 PNG 路径" })
  const slice = Type.Optional(Type.Integer({ minimum: 0, description: "切片序号（.til 中 IMGn 的 n）；省略表示整张图" }))
  const viewImageSchema = Type.Object({ path: imagePath, slice })
  const viewImage: AgentTool<typeof viewImageSchema> = {
    name: "view_image",
    label: "查看图片",
    description: "查看 PNG 或其中一个切片：返回尺寸、切片列表、平均色和缩略图。",
    parameters: viewImageSchema,
    executionMode: "sequential",
    execute: async (_id, { path, slice }) => {
      const { info, png } = await images.view(path, slice)
      return { content: [{ type: "text" as const, text: JSON.stringify(info) }, { type: "image" as const, data: png, mimeType: "image/png" }], details: info }
    },
  }

  const recolorImageSchema = Type.Object({
    path: imagePath,
    slice,
    color: Type.String({ description: "目标颜色 RRGGBB" }),
    preserveNeutral: Type.Optional(Type.Boolean({ description: "默认 true：保留灰、白、黑像素（图标、文字、阴影）" })),
  })
  const recolorImage: AgentTool<typeof recolorImageSchema> = {
    name: "recolor_image",
    label: "图片改色",
    description: "把整张 PNG 或一个切片改成目标颜色，保留明暗、光泽和透明度。",
    parameters: recolorImageSchema,
    executionMode: "sequential",
    execute: async (_id, { path, slice, color, preserveNeutral }) => {
      const pixels = await images.recolor(path, color, slice, preserveNeutral ?? true)
      return jsonResult({ path, slice, color, recoloredPixels: pixels, note: pixels ? undefined : "没有可着色的彩色像素；如需改灰白图请设 preserveNeutral=false" })
    },
  }
  if (!imageModel) return [...tools, viewImage, recolorImage]

  const generateImageSchema = Type.Object({
    path: imagePath,
    slice,
    prompt: Type.String({ minLength: 1, maxLength: 2_000, description: "画面描述（英文效果更好），说明主体、配色、质感，以及纯色或透明背景" }),
    keepShape: Type.Optional(Type.Boolean({ description: "默认 true：按原图透明轮廓裁剪（保持圆角按键形状）" })),
  })
  const generateImage: AgentTool<typeof generateImageSchema> = {
    name: "generate_image",
    label: "生成图片",
    description: "调用图片生成模型绘制新图，缩放填入整张 PNG 或一个切片。",
    parameters: generateImageSchema,
    executionMode: "sequential",
    execute: async (_id, { path, slice, prompt, keepShape }, signal) => {
      const reference = imageModel.protocol === "google" ? (await images.view(path, slice)).png : undefined
      const picture = await requestImage(imageModel, prompt, reference, signal)
      await images.paint(path, picture, slice, keepShape ?? true)
      return jsonResult({ path, slice, painted: true })
    },
  }
  return [...tools, viewImage, recolorImage, generateImage]
}

function decodeBase64(data: string): Uint8Array {
  return Uint8Array.from(atob(data), (char) => char.charCodeAt(0))
}

async function responseJson(response: Response): Promise<any> {
  const text = await response.text()
  if (!response.ok) throw new Error(`图片模型返回 ${response.status}：${text.slice(0, 300)}`)
  return JSON.parse(text)
}

/** Calls an OpenAI-compatible images endpoint or Gemini generateContent; runs under nativeModelFetch. */
async function requestImage(config: AiDesignConfiguration, prompt: string, reference: string | undefined, signal?: AbortSignal): Promise<Uint8Array> {
  const base = normalizedUrl(config.apiUrl)
  if (config.provider === "minimax-image") {
    const body = await responseJson(await fetch(`${base}/image_generation`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${config.apiKey.trim()}` },
      body: JSON.stringify({ model: config.model.trim(), prompt, aspect_ratio: "1:1", response_format: "base64", n: 1 }),
      signal,
    }))
    if (body?.base_resp?.status_code) throw new Error(`图片模型返回错误：${body.base_resp.status_msg ?? body.base_resp.status_code}`)
    const data = body?.data?.image_base64?.[0]
    if (typeof data !== "string") throw new Error("图片模型没有返回图片")
    return decodeBase64(data)
  }
  if (config.protocol === "google") {
    const parts: unknown[] = [{ text: prompt }]
    if (reference) parts.push({ inlineData: { mimeType: "image/png", data: reference } })
    const body = await responseJson(await fetch(`${base}/models/${encodeURIComponent(config.model.trim())}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": config.apiKey.trim() },
      body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: { responseModalities: ["TEXT", "IMAGE"] } }),
      signal,
    }))
    const data = body?.candidates?.[0]?.content?.parts?.find((part: any) => part?.inlineData?.data)?.inlineData?.data
    if (typeof data !== "string") throw new Error("图片模型没有返回图片")
    return decodeBase64(data)
  }
  const model = config.model.trim()
  const body = await responseJson(await fetch(`${base}/images/generations`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${config.apiKey.trim()}` },
    // gpt-image models always return base64 and reject response_format.
    body: JSON.stringify({ model, prompt, n: 1, size: "1024x1024", ...(/gpt-image/i.test(model) ? {} : { response_format: "b64_json" }) }),
    signal,
  }))
  const item = body?.data?.[0]
  if (typeof item?.b64_json === "string") return decodeBase64(item.b64_json)
  // The native proxy only reaches saved API hosts, so CDN links (e.g. CogView) cannot be downloaded.
  if (typeof item?.url === "string") throw new Error("该图片模型只返回图片链接，暂不支持；请换用能返回 b64_json 的模型")
  throw new Error("图片模型没有返回图片")
}

const TOOL_LABELS: Record<string, string> = {
  read_project_file: "读取当前面板配置",
  read_ini_sections: "读取样式配置节",
  set_ini_value: "写入 INI 样式草稿",
  remove_ini_value: "写入删除属性草稿",
  add_ini_section: "新增配置节草稿",
  remove_ini_sections: "删除配置节草稿",
  replace_project_text: "写入 BDA 精确替换草稿",
  dispatch_subagents: "派发子代理并行处理",
  view_image: "查看图片",
  recolor_image: "图片改色草稿",
  generate_image: "生成图片草稿",
}
const EDIT_TOOLS = new Set(["set_ini_value", "remove_ini_value", "add_ini_section", "remove_ini_sections", "replace_project_text", "recolor_image", "generate_image"])

function eventStatus(event: AgentEvent): { kind: StatusKind; text: string } | undefined {
  if (event.type === "agent_start") return { kind: "thinking", text: "AI 正在分析当前皮肤…" }
  if (event.type === "tool_execution_start") {
    const path = typeof event.args?.path === "string" ? ` · ${event.args.path}` : ""
    return { kind: EDIT_TOOLS.has(event.toolName) ? "editing" : "reading", text: `AI ${TOOL_LABELS[event.toolName] ?? "处理项目"}${path}…` }
  }
  // A successful tool end only repeats its start step; failures are worth a row.
  if (event.type === "tool_execution_end" && event.isError) {
    return { kind: EDIT_TOOLS.has(event.toolName) ? "editing" : "reading", text: `AI 操作失败：${TOOL_LABELS[event.toolName] ?? event.toolName}` }
  }
  if (event.type === "agent_end") return { kind: "done", text: "AI 已完成分析，正在校验修改…" }
  return undefined
}

const SUBAGENT_GUIDE = `子代理：
- 任务复杂、可拆成互不重叠的部分时（例如重排整个布局并为多组按键新建样式、同时调整多块区域的配色与图片），用 dispatch_subagents 一次并行派发 2–4 个子任务以提速；简单任务直接自己完成，不要派发。
- 子代理与你共享同一份草稿。派发前先读配置定好整体方案，在每个子任务说明里写清它负责的文件、配置节（或节号范围）、具体数值和目标效果；不同子任务不得修改同一个配置节或同一张图片的同一切片。
- 新建配置节时给每个子任务分配不同的节号段（例如 STYLE300–319、STYLE320–339），避免撞号。
- 子代理返回后复读关键配置节核对结果，必要时自己补齐，再给出最终回复。`

const SUBAGENT_RULES = `你现在是主代理派发的子代理：只完成下面分配的子任务，只修改分配给你的配置节或图片，不要碰其他部分，不能再派发子代理。完成后用 1–3 句话汇报实际改了哪些配置节或图片及结果；无法完成时说明原因。`

function subagentTool(
  run: (tasks: Array<{ title: string; instructions: string }>, signal?: AbortSignal) => Promise<unknown>,
): AgentTool {
  const schema = Type.Object({
    tasks: Type.Array(Type.Object({
      title: Type.String({ description: "子任务的简短标题" }),
      instructions: Type.String({ description: "完整、自包含的子任务说明：负责的文件与配置节、具体修改和目标效果" }),
    }), { minItems: 1, maxItems: 4 }),
  })
  const tool: AgentTool<typeof schema> = {
    name: "dispatch_subagents",
    label: "派发子代理",
    description: "把互不重叠的子任务并行派发给子代理，子代理拥有与你相同的读写工具并共享草稿；返回每个子任务的汇报。",
    parameters: schema,
    executionMode: "sequential",
    execute: async (_id, { tasks }, signal) => jsonResult({ results: await run(tasks, signal) }),
  }
  return tool as unknown as AgentTool
}

function finalResponse(agent: Agent): string {
  const message = [...agent.state.messages].reverse().find((entry) => entry.role === "assistant")
  if (!message || message.role !== "assistant") return ""
  const text = message.content.flatMap((content) => content.type === "text" ? [content.text] : []).join("\n").trim()
  if (text || message.stopReason !== "length") return text
  return "模型输出达到长度上限（多半是思考过长），本轮没有完成修改。请调低思考强度或拆小需求后重试。"
}

function recentConversation(messages: readonly AgentMessage[]): AgentMessage[] {
  const conversational = messages.flatMap<AgentMessage>((message) => {
    if (message.role === "user") return [message]
    if (message.role !== "assistant" || message.stopReason === "toolUse") return []
    const content = message.content.filter((part) => part.type === "text")
    return content.length ? [{ ...message, content }] : []
  })
  return conversational.slice(-6)
}

async function nativeModelFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const url = input instanceof Request ? input.url : String(input)
  const headers = new Headers(input instanceof Request ? input.headers : undefined)
  new Headers(init.headers).forEach((value, name) => headers.set(name, value))
  if (init.body != null && typeof init.body !== "string") throw new Error("模型请求体格式不受支持")
  const signal = init.signal ?? (input instanceof Request ? input.signal : undefined)
  signal?.throwIfAborted()
  return new Promise<Response>((resolve, reject) => {
    let stream: ReadableStreamDefaultController<Uint8Array>
    let finished = false
    const finish = (error?: unknown) => {
      if (finished) return
      finished = true
      signal?.removeEventListener("abort", abort)
      if (error) { stream.error(error); reject(error) }
      else stream.close()
    }
    const abort = () => finish(new DOMException("AI 设计已取消", "AbortError"))
    const body = new ReadableStream<Uint8Array>({
      start(controller) { stream = controller },
      cancel() { finished = true; signal?.removeEventListener("abort", abort) },
    })
    const events = new Channel<ModelHttpEvent>()
    events.onmessage = (event) => {
      if (finished) return
      if (event.type === "headers") {
        resolve(new Response([204, 205, 304].includes(event.status) ? null : body, { status: event.status, headers: event.headers }))
      } else if (event.type === "chunk") stream.enqueue(new Uint8Array(event.body))
      else finish()
    }
    signal?.addEventListener("abort", abort, { once: true })
    if (signal?.aborted) { abort(); return }
    void invoke("model_http_request", {
      request: { url, method: init.method ?? (input instanceof Request ? input.method : "POST"), headers: [...headers], body: init.body ?? null },
      events,
    }).catch((error) => finish(new Error(String(error))))
  })
}

export async function runAiSkinDesign(
  config: AiDesignConfiguration,
  project: AiDesignProject,
  prompt: string,
  options: {
    history?: readonly AgentMessage[]
    variantCount?: number
    thinkingLevel?: ThinkingLevel
    /** Saved image-generation model; without it the AI can only view and recolour images. */
    imageModel?: AiDesignConfiguration
    /** Files the user pasted or dropped into the composer. */
    attachments?: AiDesignAttachments
    signal?: AbortSignal
    onStatus?: (kind: StatusKind, text: string) => void
    onTextDelta?: (delta: string) => void | Promise<void>
    onThinking?: (text: string) => void | Promise<void>
  } = {},
): Promise<AiDesignResult> {
  if (options.signal?.aborted) throw new DOMException("AI 设计已取消", "AbortError")
  if (!normalizedUrl(config.apiUrl)) throw new Error("请先配置模型 API 地址")
  if (!config.model.trim()) throw new Error("请先配置模型名称")
  if (!config.apiKey.trim()) throw new Error("请先配置模型 API 密钥")
  if (!project.files.length) throw new Error("当前皮肤没有可供 AI 编辑的配置文件")

  const variantCount = Math.max(1, Math.min(3, Math.trunc(options.variantCount ?? 1)))
  if (variantCount > 1) {
    const directions = [
      ["bright", "明快高对比"],
      ["quiet", "低饱和沉浸"],
      ["bold", "大胆材质层次"],
    ] as const
    const variants: AiDesignVariant[] = []
    for (const [index, [id, title]] of directions.slice(0, variantCount).entries()) {
      const result = await runAiSkinDesign(config, project, `${prompt.trim()}\n\n请制作第 ${index + 1} 个独立方案「${title}」。只修改当前授权范围，保留用户明确要求保留的布局和动作。`, {
        ...options,
        history: [],
        variantCount: 1,
        onTextDelta: undefined,
        onThinking: undefined,
        onStatus: async (kind, text) => options.onStatus?.(kind, `方案 ${index + 1} · ${text}`),
      })
      variants.push({ id, title, changes: result.changes, response: result.response, toolCalls: result.toolCalls, conversation: result.conversation })
    }
    return { changes: [], response: "", toolCalls: variants.reduce((sum, variant) => sum + variant.toolCalls, 0), conversation: [], variants }
  }

  const workspace = new AiSkinWorkspace(project.files)
  const thinkingLevel = options.thinkingLevel ?? "off"
  const model = configuredModel(config, thinkingLevel)
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

  const imageAssets = new AiSkinImages(project.images ?? [])
  const tools = toolsFor(workspace, imageAssets, options.imageModel)
  let toolCalls = 0
  const createAgent = (systemPrompt: string, agentTools: AgentTool[], messages: AgentMessage[]) => {
    const allowedTools = new Set(agentTools.map((tool) => tool.name))
    return new Agent({
      initialState: { systemPrompt, model, thinkingLevel, tools: agentTools, messages },
      streamFn: models.streamSimple.bind(models),
      getApiKey: () => config.apiKey.trim(),
      toolExecution: "sequential",
      beforeToolCall: async ({ toolCall }) => {
        toolCalls += 1
        if (!allowedTools.has(toolCall.name)) return { block: true, reason: "该工具未获皮肤编辑器授权", terminate: true }
        return undefined
      },
      maxRetryDelayMs: 10_000,
    })
  }
  const baseSystemPrompt = systemPrompt(project, Boolean(options.imageModel))
  const images = [...(project.preview ? [project.preview] : []), ...(options.attachments?.images ?? [])]
  const subagents = subagentTool(async (tasks, signal) => Promise.all(tasks.map(async (task, index) => {
    // Subagents share this run's workspace, so their edits land in the same draft.
    const child = createAgent(`${baseSystemPrompt}\n\n${SUBAGENT_RULES}`, tools, [])
    const label = `子任务 ${index + 1}「${contextText(task.title, 24)}」`
    const unsubscribeChild = child.subscribe((event) => {
      const status = eventStatus(event)
      if (status && status.kind !== "done") options.onStatus?.(status.kind, `${label} · ${status.text.replace(/^AI\s*/, "")}`)
    })
    const abortChild = () => child.abort()
    signal?.addEventListener("abort", abortChild, { once: true })
    try {
      await child.prompt(`子任务：${task.title}\n\n${task.instructions}`, images.length ? images : undefined)
      return { title: task.title, error: child.state.errorMessage || undefined, report: finalResponse(child) }
    } finally {
      signal?.removeEventListener("abort", abortChild)
      unsubscribeChild()
    }
  })))
  const agent = createAgent(`${baseSystemPrompt}\n\n${SUBAGENT_GUIDE}`, [...tools, subagents], [...(options.history ?? [])])
  let thinking = ""
  const unsubscribe = agent.subscribe(async (event) => {
    if (event.type === "message_update" && event.assistantMessageEvent.type === "thinking_delta") {
      thinking += event.assistantMessageEvent.delta
      await options.onThinking?.(thinking)
    }
    const status = eventStatus(event)
    if (status) options.onStatus?.(status.kind, status.text)
    if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
      await options.onTextDelta?.(event.assistantMessageEvent.delta)
    }
  })
  const abort = () => agent.abort()
  if (options.signal?.aborted) abort()
  else options.signal?.addEventListener("abort", abort, { once: true })
  const webviewFetch = globalThis.fetch
  // ponytail: one AI run is allowed at a time; replace fetch only for that run so every provider avoids WebView CORS.
  globalThis.fetch = nativeModelFetch
  try {
    const referenceCount = options.attachments?.images.length ?? 0
    const referenceNote = referenceCount ? `用户附带了 ${referenceCount} 张参考图片${project.preview ? "（排在当前画布预览图之后）" : ""}。` : ""
    const text = [prompt.trim(), referenceNote, options.attachments?.text].filter(Boolean).join("\n\n")
    await agent.prompt(text, images.length ? images : undefined)
    if (options.signal?.aborted) throw new DOMException("AI 设计已取消", "AbortError")
    if (agent.state.errorMessage) throw new Error(agent.state.errorMessage)
    return {
      changes: [...workspace.changes(), ...imageAssets.changes()],
      response: finalResponse(agent),
      toolCalls,
      conversation: recentConversation(agent.state.messages),
    }
  } finally {
    globalThis.fetch = webviewFetch
    options.signal?.removeEventListener("abort", abort)
    unsubscribe()
  }
}
