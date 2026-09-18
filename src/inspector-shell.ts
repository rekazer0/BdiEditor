/*
 * Inspector shell behaviour — the interaction layer of the new inspector design.
 *
 * Design source: /Users/kaze/Downloads/属性检查器.pen · 属性检查器 · 重设计 (aUC2J)
 *   对象身份 → 分组 → 分区行 → 常驻动作条
 *   非默认值显示色点，悬停显示重置；BDS/BDI 用 $sel，BDA 用 $brand
 *
 * The module is presentation-only: it never writes configuration values, it only
 * restores a value the user changed in this session back to its session baseline.
 */

import { inspectorIcon } from "./inspector-icons"

type InspectorInput = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement

type Row = {
  el: HTMLElement
  input: InspectorInput | null
  inputs: InspectorInput[]
  label: string
  baseline: string
}

const SECTION_HINTS: Record<string, string> = {
  布局: "keys.*.layout",
  位置与尺寸: "keys.*.layout",
  内边距: "padding",
  样式: "BACK_STYLE / FORE_STYLE",
  视觉样式: "BACK_STYLE / FORE_STYLE",
  文字: "SHOW / NM_COLOR",
  动作: "CENTER",
  手势与动作: "CENTER",
  点击动作: "CENTER",
  滑动与长按: "UP DOWN LEFT RIGHT HOLD CENTER",
  手势盘: "CENTER UP DOWN LEFT RIGHT HOLD",
  皮肤信息: "skin.info",
  候选栏与工具栏: "toolbar",
  高级排布: "FORE_OFFSET",
}


const baselines = new WeakMap<HTMLElement, string>()
let rows: Row[] = []

function inspector(): HTMLElement | null {
  return document.getElementById("quick-inspector")
}

function valueOf(input: InspectorInput | null): string {
  if (!input) return ""
  if (input instanceof HTMLInputElement && input.type === "checkbox") return String(input.checked)
  return input.value
}

function rowLabel(row: HTMLElement): string {
  const clone = row.cloneNode(true) as HTMLElement
  clone.querySelectorAll("input, select, textarea, button, small, svg, .style-picker-trigger, .sound-style-main-meta, .pin-reset, .pin-dot").forEach((node) => node.remove())
  return (clone.textContent ?? "").replace(/\s+/g, " ").trim()
}

function sectionLabel(section: HTMLElement): string {
  const heading = section.querySelector("h3, h4, .inspector-card-heading strong, summary, strong")
  return (heading?.textContent ?? "").replace(/\s+/g, " ").trim()
}

/* ------------------------------------------------------------------ *
 * Chrome injection: sticky action bar
 * ------------------------------------------------------------------ */
function buildActions(): HTMLElement {
  const actions = document.createElement("div")
  actions.className = "pin-actions"
  actions.innerHTML = [
    '<span class="pin-actions-slot"></span>',
    '<span class="pin-actions-meta" data-count="0" role="status">已改 0</span>',
    '<button class="pin-reset-all" type="button" title="恢复本次选择后的所有修改" hidden>重置</button>',
  ].join("")
  return actions
}

function ensureChrome(): { actions: HTMLElement } | null {
  const root = inspector()
  if (!root) return null
  let actions = root.querySelector<HTMLElement>(":scope > .pin-actions")
  if (!actions) {
    actions = buildActions()
    root.prepend(actions)
  }
  return { actions }
}

/**
 * Mirror the app's key action toolbar (复制 / 交换 / 删除) into the sticky action bar.
 * The original toolbar stays in place; clicks are forwarded so the app handlers run.
 */
function mountKeyToolbar(actions: HTMLElement): void {
  const slot = actions.querySelector<HTMLElement>(".pin-actions-slot")
  const toolbar = document.querySelector<HTMLElement>(".key-toolbar")
  if (!slot || !toolbar) return
  const source = Array.from(toolbar.querySelectorAll<HTMLButtonElement>("button"))
  if (!source.length) return
  const buttons = source.map((original) => {
    const button = document.createElement("button")
    button.type = "button"
    button.className = "pin-action"
    const icon = original.dataset.keyMode === "select" ? "mouse-pointer-2"
      : original.dataset.keyMode === "move" ? "move"
      : original.dataset.keyAction === "copy" ? "copy"
      : original.dataset.keyAction === "swap" ? "arrow-left-right" : "trash-2"
    button.append(inspectorIcon(icon, original.dataset.keyMode ? 13 : 14))
    button.title = original.title
    button.setAttribute("aria-label", original.getAttribute("aria-label") ?? original.title)
    if (original.dataset.keyAction === "delete") button.classList.add("is-danger")
    button.addEventListener("click", () => original.click())
    return button
  })
  const modes = document.createElement("div")
  modes.className = "inspector-mode-segment"
  modes.setAttribute("role", "group")
  modes.setAttribute("aria-label", "按键操作模式")
  modes.append(...buttons.slice(0, 2))
  slot.replaceChildren(modes, ...buttons.slice(2))
  const mirror = (): void => {
    source.forEach((original, index) => {
      if (buttons[index].disabled !== original.disabled) buttons[index].disabled = original.disabled
      buttons[index].classList.toggle("active", original.classList.contains("active"))
      if (original.dataset.keyMode) {
        buttons[index].dataset.keyModeMirror = original.dataset.keyMode
        buttons[index].setAttribute("aria-pressed", String(original.classList.contains("active")))
      }
    })
  }
  mirror()
  new MutationObserver(mirror).observe(toolbar, {
    attributes: true,
    attributeFilter: ["disabled", "class"],
    subtree: true,
  })
}

/* ------------------------------------------------------------------ *
 * Rows: baseline capture, modified markers, reset
 * ------------------------------------------------------------------ */
function rowValue(row: Row): string {
  return JSON.stringify(row.inputs.map(valueOf))
}

function restoreRow(row: Row): void {
  const values = JSON.parse(baselines.get(row.el) ?? row.baseline) as string[]
  // Set every component before dispatching updates for compound fields.
  row.inputs.forEach((input, index) => {
    if (input instanceof HTMLInputElement && input.type === "checkbox") input.checked = values[index] === "true"
    else input.value = values[index] ?? ""
  })
  row.inputs.forEach((input) => {
    input.dispatchEvent(new Event("input", { bubbles: true }))
    input.dispatchEvent(new Event("change", { bubbles: true }))
  })
}

function collectRows(): void {
  const root = inspector()
  if (!root) return
  rows = Array.from(root.querySelectorAll<HTMLElement>("label")).flatMap((el) => {
    const inputs = Array.from(el.querySelectorAll<InspectorInput>("input, select, textarea"))
    if (!inputs.length) return []
    const row = { el, input: inputs[0], inputs, label: rowLabel(el), baseline: JSON.stringify(inputs.map(valueOf)) }
    if (!baselines.has(el)) baselines.set(el, row.baseline)
    return [row]
  })
}

/** Re-snapshot every row: called after the app renders new values (selection / state). */
function refreshBaselines(): void {
  collectRows()
  for (const row of rows) {
    baselines.set(row.el, rowValue(row))
    row.el.classList.remove("pin-modified")
    row.el.querySelector(".pin-dot")?.remove()
    row.el.querySelector(".pin-reset")?.remove()
  }
  updateMeta()
}

function markRow(row: Row, modified: boolean): void {
  if (modified) {
    row.el.classList.add("pin-modified")
    if (!row.el.querySelector(".pin-dot")) {
      const dot = document.createElement("span")
      dot.className = "pin-dot"
      dot.setAttribute("aria-hidden", "true")
      row.el.prepend(dot)
    }
    // Keep the modified marker, but use global undo rather than per-field buttons.
    row.el.querySelector(".pin-reset")?.remove()
  } else {
    row.el.classList.remove("pin-modified")
    row.el.querySelector(".pin-dot")?.remove()
    row.el.querySelector(".pin-reset")?.remove()
  }
}

function modifiedRows(): Row[] {
  return rows.filter((row) => row.el.classList.contains("pin-modified"))
}

function updateMeta(): void {
  const root = inspector()
  const meta = root?.querySelector<HTMLElement>(":scope > .pin-actions .pin-actions-meta")
  const resetAll = root?.querySelector<HTMLElement>(":scope > .pin-actions .pin-reset-all")
  const count = modifiedRows().length
  if (meta) {
    meta.dataset.count = String(count)
    meta.textContent = count ? `已改 ${count}` : "未修改"
  }
  if (resetAll) resetAll.hidden = count === 0

}

function resetAll(): void {
  for (const row of modifiedRows()) {
    restoreRow(row)
    markRow(row, false)
  }
  updateMeta()
}

function onInspectorInput(event: Event): void {
  const target = event.target as Element | null
  const rowEl = target?.closest?.("label")
  if (!rowEl) return
  const row = rows.find((candidate) => candidate.el === rowEl)
  if (!row) return
  const baseline = baselines.get(row.el) ?? ""
  markRow(row, rowValue(row) !== baseline)
  updateMeta()
}

function headingLabel(head: HTMLElement): string {
  const strong = head.querySelector("strong")
  if (strong?.textContent) return strong.textContent.replace(/\s+/g, " ").trim()
  const clone = head.cloneNode(true) as HTMLElement
  clone.querySelectorAll(".pin-hint, .pin-chevron, .pin-summary, small, svg").forEach((node) => node.remove())
  return (clone.textContent ?? "").replace(/\s+/g, " ").trim()
}

function decorateHead(head: HTMLElement, fallback = ""): void {
  const label = headingLabel(head) || fallback
  const hint = SECTION_HINTS[label] || SECTION_HINTS[fallback]
  if (hint) head.title = hint
  // Technical names remain available on hover; only real disclosures get arrows.
  if (head.tagName === "SUMMARY" && !head.querySelector(".pin-chevron")) {
    const chevron = document.createElement("span")
    chevron.className = "pin-chevron"
    chevron.append(inspectorIcon("chevron-down", 12))
    head.append(chevron)
  }
}

function decorateSections(): void {
  const root = inspector()
  if (!root) return
  for (const section of root.querySelectorAll<HTMLElement>(".inspector-group")) {
    const title = section.querySelector<HTMLElement>(":scope > h3")
    if (!title) continue
    const label = sectionLabel(section) || section.dataset.inspectorGroupLabel || ""
    const hint = SECTION_HINTS[label] || SECTION_HINTS[section.dataset.inspectorGroupLabel ?? ""]
    if (hint) title.title = hint
  }
  for (const head of root.querySelectorAll<HTMLElement>(".inspector-card-heading, .appearance-section-heading, .inspector-padding-section > h4, details.inspector-advanced > summary")) {
    if (head.dataset.pinReady === "true") continue
    head.dataset.pinReady = "true"
    decorateHead(head)
  }
}


/* ------------------------------------------------------------------ *
 * Wiring
 * ------------------------------------------------------------------ */
function bindChrome(chrome: { actions: HTMLElement }): void {
  const resetAllButton = chrome.actions.querySelector<HTMLElement>(".pin-reset-all")
  resetAllButton?.addEventListener("click", resetAll)

  const root = inspector()
  root?.addEventListener("pointerdown", collectRows, true)
  root?.addEventListener("focusin", collectRows)
  root?.addEventListener("input", onInspectorInput, true)
  root?.addEventListener("change", onInspectorInput, true)
  root?.addEventListener("focusout", () => {
    window.setTimeout(() => {
      decorateSections()
      updateMeta()
    }, 60)
  })
}

/** Keep the sticky action bar's key actions in sync with the app's own visibility. */
function syncActionBar(source: HTMLElement): void {
  const slot = source.querySelector<HTMLElement>(".pin-actions-slot")
  const group = document.querySelector<HTMLElement>(".key-layout-fields")
  if (!slot || !group) return
  const visible = !group.hidden && !group.closest("[hidden]")
  // This attribute is observed below; rewriting it would schedule another frame forever.
  if (slot.hidden !== !visible) slot.hidden = !visible
}

export function initInspectorShell(): void {
  decorateInspectorDetails()
  const chrome = ensureChrome()
  if (!chrome) return
  collectRows()
  for (const row of rows) baselines.set(row.el, rowValue(row))
  decorateSections()
  mountKeyToolbar(chrome.actions)
  bindChrome(chrome)
  updateMeta()

  const root = inspector()
  if (root) {
    let scheduled = false
    const observer = new MutationObserver(() => {
      if (scheduled) return
      scheduled = true
      window.requestAnimationFrame(() => {
        scheduled = false
        decorateSections()
        syncActionBar(chrome.actions)
      })
    })
    observer.observe(root, { attributes: true, attributeFilter: ["hidden", "class", "data-inspector-group-display"], subtree: true })
    syncActionBar(chrome.actions)
  }


}

export function setInspectorKind(kind: "bds" | "bda" | ""): void {
  const root = inspector()
  const source = document.querySelector(".source")
  for (const el of [root, source]) {
    if (!el) continue
    if (kind) el.setAttribute("data-inspector-kind", kind)
    else el.removeAttribute("data-inspector-kind")
  }
}

let selectionContext = ""
/** Capture the rendered controls before the first pointer or keyboard edit. */
export function syncInspectorRows(context: string): void {
  if (context !== selectionContext) {
    selectionContext = context
    refreshBaselines()
  } else collectRows()
  syncInspectorDetails()
}

const gestureDirections = [
  ["UP", "上滑", "arrow-up"], ["DOWN", "下滑", "arrow-down"],
  ["LEFT", "左滑", "arrow-left"], ["RIGHT", "右滑", "arrow-right"],
  ["HOLD", "长按", "circle-dot"], ["CENTER", "点击", "mouse-pointer-2"],
] as const

function decorateInspectorDetails(): void {
  const root = inspector()
  if (!root) return
  const source = root.closest(".source")
  if (source && !source.querySelector(".inspector-empty")) {
    const empty = document.createElement("section")
    empty.className = "inspector-empty"
    const ring = document.createElement("div")
    ring.className = "inspector-empty-ring"
    ring.append(inspectorIcon("mouse-pointer-2", 22))
    const title = document.createElement("strong")
    title.textContent = "未选择对象"
    const hint = document.createElement("p")
    hint.textContent = "在画布或左侧概览中选择一个按键、面板或样式，属性会显示在这里。"
    const kinds = document.createElement("div")
    kinds.className = "inspector-empty-kinds"
    for (const label of ["按键", "面板", "候选栏", "样式", "资源"]) {
      const chip = document.createElement("span")
      chip.textContent = label
      kinds.append(chip)
    }
    const shortcuts = document.createElement("dl")
    const mac = /Mac/.test(navigator.platform)
    for (const [label, key] of [["撤销", mac ? "⌘Z" : "Ctrl Z"], ["重做", mac ? "⇧⌘Z" : "Ctrl Shift Z"], ["保存皮肤", mac ? "⌘S" : "Ctrl S"]]) {
      const term = document.createElement("dt")
      term.textContent = label
      const value = document.createElement("dd")
      value.textContent = key
      shortcuts.append(term, value)
    }
    empty.append(ring, title, hint, kinds, shortcuts)
    source.append(empty)
  }
  const layouts: Record<string, string> = { left: "align-start-vertical", right: "align-end-vertical", top: "align-start-horizontal", bottom: "align-end-horizontal", "same-width": "arrow-left-right", "same-height": "arrow-up-down", "horizontal-gap": "fold-horizontal", "vertical-gap": "fold-vertical", swap: "arrow-left-right", merge: "square-stack" }
  for (const button of root.querySelectorAll<HTMLElement>("[data-layout-action]")) {
    const old = button.querySelector(".system-symbol")
    if (old) old.replaceWith(inspectorIcon(layouts[button.dataset.layoutAction!] ?? "move", 14))
  }
  const layout = root.querySelector(".key-layout-fields")
  if (layout && !layout.querySelector(".inspector-selection-chips")) {
    const chips = document.createElement("div")
    chips.className = "inspector-selection-chips"
    chips.setAttribute("aria-label", "已选对象")
    layout.querySelector("h3")?.after(chips)
  }
  const gestures = root.querySelector(".key-gesture-fields")
  const pad = gestures?.querySelector(".direction-editor")
  if (pad) {
    pad.classList.add("inspector-gesture-pad")
    const click = root.querySelector("[data-key-field=\"CENTER\"]")?.closest("label")
    if (click && click.parentElement !== pad) {
      click.classList.add("direction-center", "inspector-gesture-center")
      pad.append(click)
    }
    gestures?.querySelector(".primary-actions")?.remove()
    gestures?.querySelector(".inspector-gesture-preview")?.remove()
  }
  for (const [field, caption, icon] of gestureDirections) {
    const label = root.querySelector(`[data-key-field="${field}"]`)?.closest("label")
    if (!label) continue
    label.dataset.gesture = field
    let text = label.querySelector(":scope > span")
    if (!text) {
      text = document.createElement("span")
      label.prepend(text)
    }
    text.replaceChildren(inspectorIcon(icon, 12), document.createTextNode(caption))
  }
  const gestureHint = gestures?.querySelector(".inspector-group-subtitle")
  if (gestureHint) gestureHint.textContent = "方向格即输入区，留空表示未配置。"
  decorateSections()
  root.addEventListener("input", syncInspectorDetails)
  syncInspectorDetails()
}

function syncInspectorDetails(): void {
  const root = inspector()
  if (!root) return
  const chips = root.querySelector<HTMLElement>(".inspector-selection-chips")
  const count = Number(root.dataset.selectionCount || 0)
  const names = JSON.parse(root.dataset.selectionNames || "[]") as string[]
  if (chips) {
    chips.hidden = count < 2
    chips.replaceChildren(...Array.from({ length: Math.min(count, 6) }, (_, index) => {
      const chip = document.createElement("span")
      chip.textContent = index === 5 && count > 6 ? `+${count - 5}` : names[index] ?? String(index + 1)
      return chip
    }))
  }
  for (const [field] of gestureDirections) {
    const cell = root.querySelector<HTMLElement>(`[data-gesture="${field}"]`)
    const input = root.querySelector<HTMLInputElement>(`[data-key-field="${field}"]`)
    if (!cell) continue
    const code = input?.value ?? ""
    cell.classList.toggle("configured", Boolean(code && code !== "None"))
  }
}
