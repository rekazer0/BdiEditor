/*
 * 检查器的通用交互（结构规范见 DESIGN.md §10）：
 *   · 分组标题可折叠，折叠状态按分组名记住；
 *   · 本次选择后改过的属性行带标记，对象头里的「重置」一次恢复；
 *   · 未选对象时的空状态、手势行的「已配置」状态。
 * 只负责呈现，不写配置：重置也是把输入框改回基线再派发 input / change，由 main.ts 写回。
 */

import { createIcon, symbolIcon } from "./icons"

type InspectorInput = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
type Row = { el: HTMLElement; inputs: InspectorInput[] }

const SECTION_HINTS: Record<string, string> = {
  布局: "VIEW_RECT / PADDING",
  样式: "BACK_STYLE / FORE_STYLE / SOUND_STYLE",
  文字: "SHOW / FONT_* / NM_COLOR / HL_COLOR",
  手势: "CENTER / HOLD / UP / DOWN / LEFT / RIGHT",
  皮肤信息: "Info.txt",
  候选栏与工具栏: "CAND",
}
const SECTION_SELECTOR = ":is(.inspector-group, .document-property-section, .bda-inspector-section)"
const COLLAPSED_KEY = "inspector-collapsed-sections"
const collapsed = new Set<string>(readCollapsed())
const baselines = new WeakMap<HTMLElement, string>()
let rows: Row[] = []

function readCollapsed(): string[] {
  try { return JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? "[]") as string[] } catch { return [] }
}

function inspector(): HTMLElement | null {
  return document.getElementById("quick-inspector")
}

function valueOf(input: InspectorInput): string {
  return input instanceof HTMLInputElement && input.type === "checkbox" ? String(input.checked) : input.value
}

/* —— 分组折叠 —— */
function sectionName(section: HTMLElement): string {
  return section.dataset.inspectorGroupLabel
    || section.querySelector(":scope > h3 .document-section-title")?.textContent?.trim()
    || section.querySelector(":scope > h3")?.textContent?.replace(/\s+/g, " ").trim()
    || ""
}

function decorateSections(): void {
  const root = inspector()
  if (!root) return
  for (const section of Array.from(root.querySelectorAll<HTMLElement>(SECTION_SELECTOR))) {
    const heading = section.querySelector<HTMLElement>(":scope > h3")
    if (!heading) continue
    const name = sectionName(section)
    section.toggleAttribute("data-collapsed", collapsed.has(name))
    heading.setAttribute("aria-expanded", String(!collapsed.has(name)))
    if (heading.dataset.collapsible) continue
    heading.dataset.collapsible = "true"
    heading.tabIndex = 0
    heading.setAttribute("role", "button")
    if (SECTION_HINTS[name]) heading.title = SECTION_HINTS[name]
    heading.prepend(createIcon("chevron-down", 12))
  }
}

function toggleSection(heading: HTMLElement): void {
  const section = heading.parentElement
  if (!section?.matches(SECTION_SELECTOR)) return
  const name = sectionName(section)
  if (collapsed.has(name)) collapsed.delete(name)
  else collapsed.add(name)
  localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...collapsed]))
  decorateSections()
}

function onSectionHeading(event: Event): void {
  const heading = (event.target as Element | null)?.closest<HTMLElement>("h3[data-collapsible]")
  // 标题里的控件（状态切换、按钮）自己处理点击，不触发折叠。
  if (!heading || (event.target as Element).closest("button, input, select, a")) return
  if (event instanceof KeyboardEvent && event.key !== "Enter" && event.key !== " ") return
  event.preventDefault()
  toggleSection(heading)
}

/* —— 改动标记与重置 —— */
function objectActions(): HTMLElement | null {
  return document.querySelector<HTMLElement>(".inspector-object-actions")
}

function ensureResetControls(): void {
  const actions = objectActions()
  if (!actions || actions.querySelector(".inspector-changes")) return
  const status = document.createElement("span")
  status.className = "inspector-changes ui-badge"
  status.setAttribute("role", "status")
  status.hidden = true
  const reset = document.createElement("button")
  reset.type = "button"
  reset.className = "inspector-reset ui-button"
  reset.dataset.size = "sm"
  reset.dataset.variant = "quiet"
  reset.title = "恢复本次选择后的所有修改"
  reset.textContent = "重置"
  reset.hidden = true
  reset.addEventListener("click", resetAll)
  actions.prepend(status, reset)
}

function rowValue(row: Row): string {
  return JSON.stringify(row.inputs.map(valueOf))
}

function collectRows(): void {
  const root = inspector()
  if (!root) return
  rows = Array.from(root.querySelectorAll<HTMLElement>("label")).flatMap((el) => {
    const inputs = Array.from(el.querySelectorAll<InspectorInput>("input, select, textarea"))
    if (!inputs.length) return []
    const row = { el, inputs }
    if (!baselines.has(el)) baselines.set(el, rowValue(row))
    return [row]
  })
}

function markRow(row: Row, modified: boolean): void {
  row.el.toggleAttribute("data-modified", modified)
}

function updateStatus(): void {
  const count = rows.filter((row) => row.el.hasAttribute("data-modified")).length
  const actions = objectActions()
  const status = actions?.querySelector<HTMLElement>(".inspector-changes")
  const reset = actions?.querySelector<HTMLElement>(".inspector-reset")
  if (status) {
    status.hidden = count === 0
    status.textContent = `已改 ${count}`
  }
  if (reset) reset.hidden = count === 0
}

function resetAll(): void {
  for (const row of rows.filter((item) => item.el.hasAttribute("data-modified"))) {
    const values = JSON.parse(baselines.get(row.el) ?? "[]") as string[]
    // 先把组合字段的每个分量都写回，再统一派发事件。
    row.inputs.forEach((input, index) => {
      if (input instanceof HTMLInputElement && input.type === "checkbox") input.checked = values[index] === "true"
      else input.value = values[index] ?? ""
    })
    for (const input of row.inputs) {
      input.dispatchEvent(new Event("input", { bubbles: true }))
      input.dispatchEvent(new Event("change", { bubbles: true }))
    }
    markRow(row, false)
  }
  updateStatus()
}

function onInspectorInput(event: Event): void {
  const rowEl = (event.target as Element | null)?.closest?.("label")
  const row = rows.find((candidate) => candidate.el === rowEl)
  if (!row) return
  markRow(row, rowValue(row) !== baselines.get(row.el))
  updateStatus()
  syncGestures()
}

/* —— 空状态与手势 —— */
function renderEmptyState(): void {
  const pane = inspector()?.closest(".source")
  if (!pane || pane.querySelector(".inspector-empty")) return
  const empty = document.createElement("section")
  empty.className = "inspector-empty"
  const title = document.createElement("strong")
  title.textContent = "未选择对象"
  const hint = document.createElement("p")
  hint.textContent = "在画布或左侧概览中选择按键、面板或样式，属性会显示在这里。"
  const shortcuts = document.createElement("dl")
  const mac = /Mac/.test(navigator.platform)
  for (const [label, key] of [["撤销", mac ? "⌘Z" : "Ctrl Z"], ["重做", mac ? "⇧⌘Z" : "Ctrl Shift Z"], ["保存皮肤", mac ? "⌘S" : "Ctrl S"]]) {
    const term = document.createElement("dt")
    term.textContent = label
    const value = document.createElement("dd")
    value.textContent = key
    shortcuts.append(term, value)
  }
  empty.append(createIcon("mouse-pointer-2", 20), title, hint, shortcuts)
  pane.append(empty)
}

function syncGestures(): void {
  for (const cell of Array.from(document.querySelectorAll<HTMLElement>("#quick-inspector [data-gesture]"))) {
    const code = cell.querySelector<HTMLInputElement>("input")?.value ?? ""
    cell.classList.toggle("configured", Boolean(code && code !== "None"))
  }
}

/*
 * 图片、文档与 BDA 面板的工具按钮仍由 main.ts 用平台符号名生成；这里换成 Lucide，
 * 保持整列图标同一族。全局图标统一后（DESIGN.md §5）删除这一步。
 */
function decoratePanelIcons(): void {
  for (const symbol of Array.from(document.querySelectorAll<HTMLElement>("#quick-inspector .system-symbol[data-system-symbol], #resource-inspector .system-symbol[data-system-symbol]"))) {
    if (symbol.dataset.inspectorGlyph === "true") continue
    const icon = symbolIcon(symbol.dataset.systemSymbol ?? "")
    if (!icon) continue
    icon.classList.add("system-symbol-fallback")
    symbol.dataset.inspectorGlyph = "true"
    symbol.replaceChildren(icon)
  }
}

export function initInspectorShell(): void {
  renderEmptyState()
  ensureResetControls()
  decorateSections()
  decoratePanelIcons()
  collectRows()
  const root = inspector()
  root?.addEventListener("click", onSectionHeading)
  root?.addEventListener("keydown", onSectionHeading)
  root?.addEventListener("pointerdown", collectRows, true)
  root?.addEventListener("focusin", collectRows)
  root?.addEventListener("input", onInspectorInput, true)
  root?.addEventListener("change", onInspectorInput, true)

  let scheduled = false
  const observer = new MutationObserver((records) => {
    if (scheduled || records.every((record) => record.type === "attributes" && record.attributeName === "data-modified")) return
    scheduled = true
    requestAnimationFrame(() => {
      scheduled = false
      decorateSections()
      decoratePanelIcons()
    })
  })
  for (const view of Array.from(document.querySelectorAll("#quick-inspector, #resource-inspector"))) {
    observer.observe(view, { childList: true, subtree: true })
  }
}

export function setInspectorKind(kind: "bds" | "bda" | ""): void {
  for (const el of [inspector(), document.querySelector(".source")]) {
    if (!el) continue
    if (kind) el.setAttribute("data-inspector-kind", kind)
    else el.removeAttribute("data-inspector-kind")
  }
}

let selectionContext = ""
/** 渲染出新值后调用：换了选择对象就重拍基线，否则只清掉已回到基线的标记（撤销 / 重做不触发 input）。 */
export function syncInspectorRows(context: string): void {
  const fresh = context !== selectionContext
  selectionContext = context
  collectRows()
  for (const row of rows) {
    if (fresh) baselines.set(row.el, rowValue(row))
    if (fresh || rowValue(row) === baselines.get(row.el)) markRow(row, false)
  }
  updateStatus()
  syncGestures()
}
