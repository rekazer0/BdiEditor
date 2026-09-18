// AI 设计面板预览棚：从 index.html 抽取真实的 #ai-design-panel 结构，
// 用真实的 connectAiChat 驱动一段脚本化的对话，用于在浏览器里迭代视觉。
// 打开 ?auto=1 会自动跑一轮，方便截图对比。
import "./style.css"
import "./pen-design-application.css"
import "./pen-sidebar.css"
import "./pen-components.css"
import "./inspector.css"
import "./pen-inspector-sections.css"
import "./pen-inspector-rows.css"
import "./pen-inspector-panels.css"
import "./pen-inspector.css"
import "./inspector-fidelity.css"
import "./design-workbench.css"
import { connectAiChat, type AiChatRun, type AiChatController } from "./ai-chat"

type StepKind = "thinking" | "reading" | "editing" | "done"

const mount = document.querySelector<HTMLElement>("#preview-mount")!
const hud = document.querySelector<HTMLElement>("#preview-hud")!

const source = document.createElement("section")
source.className = "source"
source.innerHTML = `
  <div class="pane-heading source-heading">
    <div class="inspector-context"><h2>检查器</h2><span id="source-name">配置文本</span><strong id="mobile-inspector-selection"></strong></div>
    <div class="ai-design-heading"><strong>AI 设计</strong><span>描述想法，一起完善皮肤</span></div>
    <div class="inspector-view-controls">
      <div class="inspector-title key-inspector-title">
        <span id="selected-key-preview" class="key-inspector-preview" aria-hidden="true" hidden>ABC</span>
        <div class="key-inspector-copy"><strong id="selected-key">选择画布中的按键</strong><span id="selected-key-context">更改会自动写回配置</span></div>
      </div>
      <div class="inspector-tabs" aria-label="检查器视图">
        <button class="active" data-inspector-tab="properties">属性</button>
        <button data-inspector-tab="source">源代码</button>
        <button data-inspector-tab="ai" type="button">AI 设计</button>
      </div>
    </div>
  </div>`
mount.append(source)

// 直接复用 index.html 的面板结构，保证预览与真实界面不会漂移。
const html = await fetch("/index.html").then((response) => response.text())
const doc = new DOMParser().parseFromString(html, "text/html")
const panel = doc.querySelector<HTMLElement>("#ai-design-panel")
if (!panel) throw new Error("index.html 中找不到 #ai-design-panel")
panel.hidden = false
source.append(panel)

document.querySelector("#ai-context-key")!.textContent = "按键"
const model = document.querySelector<HTMLSelectElement>("#ai-design-model")!
model.replaceChildren(new Option("gpt-5.6-terra", "0"))
model.disabled = false
const settings = document.querySelector<HTMLElement>(".ai-design-settings")
if (settings) settings.textContent = "模型设置"

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const steps: Array<[StepKind, string]> = [
  ["thinking", "AI 正在分析当前皮肤…"],
  ["reading", "读取 project.bds…"],
  ["reading", "读取 keys.ini…"],
  ["thinking", "正在比对按键的普通与按下状态…"],
  ["editing", "写入 keys.ini 草稿"],
  ["done", "已完成分析，正在校验修改…"],
]

const run: AiChatRun = async (prompt, { signal, onStatus, onThinking, onTextDelta }) => {
  const check = () => {
    if (signal.aborted) throw new DOMException("已停止生成", "AbortError")
  }
  let reasoning = "用户希望调整当前皮肤的视觉样式。\n先读取项目结构，确认可编辑的配置文件，再对比按键的普通与按下状态。\n"
  await sleep(150)
  for (const [kind, text] of steps) {
    check()
    onStatus?.(text, kind)
    await sleep(140)
    if (kind === "thinking") {
      reasoning += `· ${text}\n`
      await onThinking?.(reasoning)
    }
  }
  check()
  const answer = `已根据「${prompt.slice(0, 18)}」生成 2 个文件的修改草稿：\n\n`
    + "1. `keys.ini` — 背景色改为 #101626，文字对比度提升到 7.4:1\n"
    + "2. `project.bds` — 统一圆角为 12px，阴影收敛到 1 层\n\n"
    + "确认后可以一次性写入，也可以整体撤销。"
  for (const chunk of answer.match(/[\s\S]{1,6}/g) ?? []) {
    check()
    await onTextDelta?.(chunk)
    await sleep(6)
  }
  return { fallback: "", summary: "" }
}

let controller: AiChatController | undefined
async function ready(): Promise<AiChatController> {
  if (!controller) {
    controller = await connectAiChat(document.querySelector<HTMLElement>("#ai-design-chat")!, run)
  }
  return controller
}
// 主题必须在 connectAiChat 之前切换；之后再切则用来验证变量是否实时生效。
if (new URLSearchParams(location.search).get("theme") === "dark") {
  document.documentElement.dataset.appTheme = "dark"
  document.body.style.background = "#0f1115"
}
await ready()
document.querySelector("#ai-new-session")?.addEventListener("click", () => controller?.clear())

async function send(text: string): Promise<void> {
  const chat = document.querySelector<any>("#ai-design-chat")!
  await ready()
  if (typeof chat.submitUserMessage === "function") chat.submitUserMessage({ text })
  else chat.addMessage({ role: "user", text })
}

const actions: Array<[string, () => void | Promise<void>]> = [
  ["发送一条消息", () => send("把皮肤改成低饱和蓝色，保留现有按键布局。")],
  ["草稿面板", () => {
    const draft = document.querySelector<HTMLElement>("#ai-draft-panel")!
    draft.hidden = !draft.hidden
  }],
  ["清空", async () => (await ready()).clear()],
  ["深色", () => {
    const dark = document.documentElement.dataset.appTheme === "dark"
    document.documentElement.dataset.appTheme = dark ? "light" : "dark"
    document.body.style.background = dark ? "#edeef2" : "#0f1115"
  }],
]
for (const [label, action] of actions) {
  const button = document.createElement("button")
  button.type = "button"
  button.textContent = label
  button.onclick = () => void action()
  hud.append(button)
}
hud.dataset.ready = "true"

const params = new URLSearchParams(location.search)
if (params.has("auto")) {
  await sleep(400)
  await send(params.get("prompt") || "把皮肤改成低饱和蓝色，保留现有按键布局。")
  await sleep(Number(params.get("auto") || 4200))
  hud.dataset.scenario = "done"
  document.body.dataset.scenario = "done"
}
if (params.has("draft")) {
  document.querySelector<HTMLElement>("#ai-draft-panel")!.hidden = false
  document.querySelector<HTMLElement>("#ai-draft-summary")!.textContent = "涉及 2 个文件 · 3 个配置块"
  const files = document.querySelector<HTMLElement>("#ai-draft-files")!
  files.innerHTML = `
    <li>
      <div class="ai-draft-file-head"><span>keys.ini</span><em>INI</em></div>
      <pre class="ai-draft-diff">[background]
<del>- image = key_bg_dark.png</del>
<ins>+ image = key_bg_blue.png</ins></pre>
    </li>
    <li>
      <div class="ai-draft-file-head"><span>project.bds</span><em>BDS</em></div>
      <pre class="ai-draft-diff"><del>- CornerRadius = 8</del>
<ins>+ CornerRadius = 12</ins></pre>
    </li>`
}
if (params.get("theme") === "dark") document.documentElement.dataset.appTheme = "dark"
if (params.has("typed")) {
  const input = document.querySelector("#ai-design-chat")!.shadowRoot!.querySelector<HTMLElement>("#text-input")!
  input.innerText = "把按键文字调大一点，背景更暗一些"
  input.dispatchEvent(new Event("input", { bubbles: true }))
}
