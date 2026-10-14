/*
 * 检查器的通用交互（结构规范见 DESIGN.md §10）：
 *   · 分组标题可折叠，折叠状态按分组名记住；Alt + 点击标题一次折叠 / 展开全部分组；
 *   · 筛选框按标签、属性名过滤属性行，换选择对象后仍然生效；
 *   · 本次选择后改过的属性行带标记，点标记恢复这一行，对象头里的「重置」一次恢复全部；
 *   · 数值的标签与单位前缀可以左右拖动调整（交互在 number-input-wheel.ts，这里只标出把手）；
 *   · 未选对象时的空状态、手势行的「已配置」状态。
 * 只负责呈现，不写配置：恢复也是把输入框改回基线再派发 input / change，由各模块写回。
 */

import { createIcon } from "./icons"
import { scrubbableField } from "./number-input-wheel"

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
/** 一条属性行：筛选、改动标记和恢复都以它为单位。 */
const ROW_SELECTOR = ".ui-field, .document-property-field, .bda-text-field, .bda-readonly-field, .bda-range-field, .bda-color-field, .fore-style-reference-field, .inspector-gesture"
const SCRUB_HANDLES = ".ui-input > .ui-input-affix, .ui-field > span:first-child, .document-field-caption"
const COLLAPSED_KEY = "inspector-collapsed-sections"
const collapsed = new Set<string>(readCollapsed())
const baselines = new WeakMap<HTMLElement, string>()
let rows: Row[] = []
let filterQuery = ""

function readCollapsed(): string[] {
  try { return JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? "[]") as string[] } catch { return [] }
}

function inspector(): HTMLElement | null {
  return document.getElementById("quick-inspector")
}

function valueOf(input: InspectorInput): string {
  return input instanceof HTMLInputElement && input.type === "checkbox" ? String(input.checked) : input.value
}

function isHidden(el: Element, within: Element): boolean {
  const hidden = el.closest("[hidden]")
  return Boolean(hidden && within.contains(hidden))
}

/* —— 分组折叠 —— */
function sectionName(section: HTMLElement): string {
  return section.dataset.inspectorGroupLabel
    || section.querySelector(":scope > h3 .document-section-title")?.textContent?.trim()
    || section.querySelector(":scope > h3")?.textContent?.replace(/\s+/g, " ").trim()
    || ""
}

function headedSections(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(SECTION_SELECTOR)).filter((section) => section.querySelector(":scope > h3"))
}

function decorateSections(): void {
  const root = inspector()
  if (!root) return
  for (const section of headedSections(root)) {
    const heading = section.querySelector<HTMLElement>(":scope > h3")
    if (!heading) continue
    const name = sectionName(section)
    section.toggleAttribute("data-collapsed", collapsed.has(name))
    heading.setAttribute("aria-expanded", String(!collapsed.has(name)))
    if (heading.dataset.collapsible) continue
    heading.dataset.collapsible = "true"
    heading.tabIndex = 0
    heading.setAttribute("role", "button")
    heading.title = [SECTION_HINTS[name], "Alt + 点击：折叠或展开全部分组"].filter(Boolean).join("\n")
    heading.prepend(createIcon("chevron-down", 12))
  }
  for (const handle of Array.from(root.querySelectorAll<HTMLElement>(SCRUB_HANDLES))) {
    handle.toggleAttribute("data-scrub", Boolean(scrubbableField(handle)))
  }
}

function toggleSection(heading: HTMLElement, all: boolean): void {
  const section = heading.parentElement
  const root = inspector()
  if (!root || !section?.matches(SECTION_SELECTOR)) return
  const collapse = !collapsed.has(sectionName(section))
  const targets = all ? headedSections(root).filter((item) => !isHidden(item, root)) : [section]
  for (const name of targets.map(sectionName)) {
    if (collapse) collapsed.add(name)
    else collapsed.delete(name)
  }
  localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...collapsed]))
  decorateSections()
}

function onSectionHeading(event: Event): void {
  const heading = (event.target as Element | null)?.closest<HTMLElement>("h3[data-collapsible]")
  // 标题里的控件（状态切换、按钮）自己处理点击，不触发折叠。
  if (!heading || (event.target as Element).closest("button, input, select, a")) return
  if (event instanceof KeyboardEvent && event.key !== "Enter" && event.key !== " ") return
  event.preventDefault()
  toggleSection(heading, (event as MouseEvent | KeyboardEvent).altKey)
}

/* —— 筛选：按标签文字、属性名（INI 键）与分组名过滤属性行 —— */
function filterInput(): HTMLInputElement | null {
  return document.getElementById("inspector-filter") as HTMLInputElement | null
}

function rowText(row: HTMLElement): string {
  const parts = [row.textContent ?? "", row.title]
  for (const input of Array.from(row.querySelectorAll<HTMLElement>("input, select, textarea"))) {
    parts.push(input.getAttribute("aria-label") ?? "", ...Object.values(input.dataset).map(String))
  }
  return parts.join(" ").toLowerCase()
}

function applyFilter(): void {
  const root = inspector()
  if (!root) return
  const query = filterQuery.trim().toLowerCase()
  root.toggleAttribute("data-filtering", Boolean(query))
  let matches = 0
  for (const section of headedSections(root)) {
    const sectionHit = !query || sectionName(section).toLowerCase().includes(query)
    const sectionRows = Array.from(section.querySelectorAll<HTMLElement>(ROW_SELECTOR))
    const hits = new Set(sectionRows.filter((row) => sectionHit || rowText(row).includes(query)))
    // 外层行没命中、里面的子行命中时，外层也要留着。
    for (const row of hits) {
      for (let outer = row.parentElement?.closest<HTMLElement>(ROW_SELECTOR); outer && section.contains(outer); outer = outer.parentElement?.closest<HTMLElement>(ROW_SELECTOR)) hits.add(outer)
    }
    for (const row of sectionRows) {
      row.toggleAttribute("data-filter-miss", !hits.has(row))
      if (query && hits.has(row)) row.closest("details")?.setAttribute("open", "")
    }
    for (const details of Array.from(section.querySelectorAll("details"))) {
      details.toggleAttribute("data-filter-miss", !sectionRows.some((row) => hits.has(row) && details.contains(row)))
    }
    const visibleHits = [...hits].filter((row) => !isHidden(row, section)).length
    section.toggleAttribute("data-filter-miss", Boolean(query) && !sectionHit && visibleHits === 0)
    if (!isHidden(section, root)) matches += visibleHits
  }
  const empty = root.querySelector<HTMLElement>(".inspector-filter-empty")
  if (empty) {
    empty.hidden = !query || matches > 0
    empty.textContent = `没有与“${filterQuery.trim()}”匹配的属性`
  }
}

function setFilterOpen(open: boolean): void {
  const root = inspector()
  const input = filterInput()
  if (!root || !input) return
  root.toggleAttribute("data-filter-open", open)
  if (open) {
    input.focus()
    input.select()
    return
  }
  input.value = ""
  filterQuery = ""
  applyFilter()
}

function bindFilter(root: HTMLElement): void {
  const input = filterInput()
  if (!input) return
  input.addEventListener("input", () => {
    filterQuery = input.value
    applyFilter()
  })
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return
    event.preventDefault()
    event.stopPropagation()
    if (input.value) {
      input.value = ""
      filterQuery = ""
      applyFilter()
    } else {
      setFilterOpen(false)
      input.blur()
    }
  })
  input.addEventListener("blur", () => { if (!input.value) setFilterOpen(false) })
  root.querySelector(".inspector-filter-open")?.addEventListener("click", () => setFilterOpen(true))
  root.querySelector(".inspector-filter-close")?.addEventListener("pointerdown", (event) => {
    // 先于输入框失焦处理，避免按钮在点击前被收起。
    event.preventDefault()
    setFilterOpen(false)
  })
  // 属性视图打开时 Ctrl/⌘ + F 筛选属性；源代码视图里仍是查找（editing-controls.ts）。
  window.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() !== "f" || !(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return
    if (root.hidden || !root.getClientRects().length) return
    event.preventDefault()
    setFilterOpen(true)
  })
}

/* —— 改动标记与恢复 —— */
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
  const grouped = new Map<HTMLElement, InspectorInput[]>()
  for (const input of Array.from(root.querySelectorAll<InspectorInput>("input, select, textarea"))) {
    if (input.id === "inspector-filter") continue
    const el = input.closest<HTMLElement>(ROW_SELECTOR) ?? input.closest("label")
    if (!el) continue
    grouped.set(el, [...(grouped.get(el) ?? []), input])
  }
  rows = Array.from(grouped, ([el, inputs]) => {
    const row = { el, inputs }
    if (!baselines.has(el)) baselines.set(el, rowValue(row))
    return row
  })
}

function rowLabel(row: HTMLElement): string {
  return row.querySelector(":scope > span:first-child, .document-field-caption")?.textContent?.trim()
    || row.querySelector("[aria-label]")?.getAttribute("aria-label")
    || "这一项"
}

function markRow(row: Row, modified: boolean): void {
  row.el.toggleAttribute("data-modified", modified)
  let revert = row.el.querySelector<HTMLButtonElement>(":scope > .inspector-revert")
  if (modified && !revert) {
    revert = document.createElement("button")
    revert.type = "button"
    revert.className = "inspector-revert"
    revert.title = "已修改。点击恢复为选择时的值"
    revert.setAttribute("aria-label", `恢复${rowLabel(row.el)}`)
    revert.append(createIcon("undo-2", 12))
    // 绝对定位在行左侧的留白里，追加在末尾，不打乱标签列。
    row.el.append(revert)
  }
  if (revert) revert.hidden = !modified
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
  // 折叠起来的分组也能看出里面有改动。
  const root = inspector()
  if (!root) return
  for (const section of headedSections(root)) {
    section.querySelector(":scope > h3")?.toggleAttribute("data-modified", Boolean(section.querySelector(":scope > :not(h3) [data-modified], :scope > [data-modified]:not(h3)")))
  }
}

function revertRow(row: Row): void {
  const values = JSON.parse(baselines.get(row.el) ?? "[]") as string[]
  const restore = () => row.inputs.forEach((input, index) => {
    if (input instanceof HTMLInputElement && input.type === "checkbox") input.checked = values[index] === "true"
    else input.value = values[index] ?? ""
  })
  // 组合字段（X/Y、色块 + 色值 + 透明度）：每派发一个分量前都把所有分量写回基线，
  // 前一个分量写回配置后检查器会重绘，其余分量会被刷成配置里的当前值。
  for (const input of row.inputs) {
    restore()
    input.dispatchEvent(new Event("input", { bubbles: true }))
    input.dispatchEvent(new Event("change", { bubbles: true }))
  }
  markRow(row, false)
}

function resetAll(): void {
  for (const row of rows.filter((item) => item.el.hasAttribute("data-modified"))) revertRow(row)
  updateStatus()
}

function onRevertClick(event: Event): void {
  const button = (event.target as Element | null)?.closest?.(".inspector-revert")
  if (!button) return
  event.preventDefault()
  const row = rows.find((candidate) => candidate.el === button.parentElement)
  if (!row) return
  revertRow(row)
  updateStatus()
  syncGestures()
}

function onInspectorInput(event: Event): void {
  const target = event.target as Element | null
  if (target?.id === "inspector-filter") return
  const rowEl = target?.closest?.(ROW_SELECTOR) ?? target?.closest?.("label")
  const row = rows.find((candidate) => candidate.el === rowEl)
  if (!row) return
  markRow(row, rowValue(row) !== baselines.get(row.el))
  updateStatus()
  syncGestures()
}

/** 标签被截断时悬停显示全文。 */
function revealTruncatedLabel(event: Event): void {
  const label = (event.target as Element | null)?.closest?.<HTMLElement>(".ui-field > span:first-child, .document-field-caption, .bda-style-reference-label")
  if (!label || label.title || label.scrollWidth <= label.clientWidth) return
  label.title = label.textContent?.trim() ?? ""
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
  for (const [label, key] of [["撤销", mac ? "⌘Z" : "Ctrl Z"], ["重做", mac ? "⇧⌘Z" : "Ctrl Shift Z"], ["筛选属性", mac ? "⌘F" : "Ctrl F"], ["保存皮肤", mac ? "⌘S" : "Ctrl S"]]) {
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

export function initInspectorShell(): void {
  renderEmptyState()
  ensureResetControls()
  decorateSections()
  collectRows()
  const root = inspector()
  if (!root) return
  bindFilter(root)
  root.addEventListener("click", onRevertClick)
  root.addEventListener("click", onSectionHeading)
  root.addEventListener("keydown", onSectionHeading)
  root.addEventListener("pointerover", revealTruncatedLabel)
  root.addEventListener("pointerdown", collectRows, true)
  root.addEventListener("focusin", collectRows)
  root.addEventListener("input", onInspectorInput, true)
  root.addEventListener("change", onInspectorInput, true)

  let scheduled = false
  const observer = new MutationObserver(() => {
    if (scheduled) return
    scheduled = true
    requestAnimationFrame(() => {
      scheduled = false
      decorateSections()
      if (filterQuery) applyFilter()
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
