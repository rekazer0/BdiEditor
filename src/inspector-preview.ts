import { inspectorIcon, inspectorGroupIcon } from "./inspector-icons"
import "./inspector-fidelity.css"
/*
 * Inspector preview harness (development only).
 *
 * Loads the real inspector markup, seeds representative values, mirrors the app's
 * grouped category display and boots the real shell module, so the redesign can be
 * reviewed at http://127.0.0.1:1420/inspector-redesign.html without opening a skin.
 * Add ?debug=1 to print the resolved grid/row metrics.
 */

function showFailure(message: string): void {
  let node = document.getElementById("preview-error")
  if (!node) {
    node = document.createElement("pre")
    node.id = "preview-error"
    node.style.cssText =
      "position:fixed;left:0;top:0;z-index:200;background:#b00020;color:#fff;font:11px/1.4 monospace;margin:0;padding:8px;white-space:pre-wrap;max-width:100vw"
    document.body.append(node)
  }
  node.textContent += message + String.fromCharCode(10)
}

window.addEventListener("error", (event) => showFailure("error: " + event.message))
window.addEventListener("unhandledrejection", (event) => showFailure("rejection: " + String(event.reason)))

const CATEGORIES: [string, string][] = [
  ["布局", "key-layout-fields"],
  ["样式", "key-appearance-fields"],
  ["文字", "key-typography-fields"],
  ["动作", "key-gesture-fields"],
]

const SAMPLE_VALUES: Record<string, string> = {
  BACK_STYLE: "186",
  FORE_STYLE: "318",
  STAT_STYLE: "",
  FORE_OFFSET: "14",
  POS_TYPE: "0",
  SOUND_STYLE: "",
  SHOW: "G",
  FONT_NAME: "PingFang SC",
  FONT_WEIGHT: "500",
  FONT_SIZE: "24",
  NM_COLOR: "#3e5542",
  HL_COLOR: "#ffffff",
  CENTER: "a",
  x: "583",
  y: "153",
  width: "140",
  height: "143",
}

function mountFragment(markup: string): HTMLElement {
  const mount = document.getElementById("preview-mount")
  if (!mount) throw new Error("preview mount missing")
  const parsed = new DOMParser().parseFromString(markup, "text/html")
  const source = parsed.querySelector("section.source")
  mount.innerHTML = source ? source.outerHTML : markup
  const inspector = document.getElementById("quick-inspector")
  if (!inspector) throw new Error("inspector missing")
  return inspector
}


function seedValues(): void {
  for (const [key, value] of Object.entries(SAMPLE_VALUES)) {
    for (const input of Array.from(
      document.querySelectorAll<HTMLInputElement>(`[data-key-field="${key}"], [data-style-field="${key}"]`),
    )) {
      input.value = value
    }
  }
  const name = document.getElementById("selected-key")
  if (name) name.textContent = "KEY12 · 小键盘"
  const context = document.getElementById("selected-key-context")
  if (context) context.textContent = "light/skin/port/py_9.ini"
  const chip = document.getElementById("selected-key-preview")
  if (chip) {
    chip.hidden = false
    chip.replaceChildren(inspectorIcon("key-round"))
  }
  const back = document.getElementById("inspector-back")
  if (back instanceof HTMLButtonElement) back.disabled = false
}

function mountRail(): void {
  const rail = document.getElementById("mobile-inspector-groups")
  const inspector = document.getElementById("quick-inspector")
  if (!rail || !inspector) return
  const show = (index: number): void => {
    const active = CATEGORIES[index]?.[1] ?? ""
    for (const group of Array.from(inspector.querySelectorAll<HTMLElement>(".inspector-group"))) {
      const isKey = CATEGORIES.some(([, className]) => group.classList.contains(className))
      group.hidden = !isKey || !group.classList.contains(active)
      group.classList.toggle("mobile-inspector-active", isKey && group.classList.contains(active))
    }
    rail.querySelectorAll("button").forEach((button, buttonIndex) => {
      button.classList.toggle("active", buttonIndex === index)
    })
  }
  rail.replaceChildren(
    ...CATEGORIES.map(([label], index) => {
      const button = document.createElement("button")
      button.type = "button"
      button.append(inspectorGroupIcon(label), Object.assign(document.createElement("span"), { textContent: label, className: "inspector-group-label" }))
      button.addEventListener("click", () => show(index))
      return button
    }),
  )
  show(0)
}

function mountDebug(inspector: HTMLElement): void {
  if (!location.search.includes("debug")) return
  const newline = String.fromCharCode(10)
  const style = getComputedStyle(inspector)
  const rows = Array.from(inspector.children).map((child) => {
    const childStyle = getComputedStyle(child)
    const id = child.id || child.className
    return `${id} | area=${childStyle.gridArea} | h=${child.getBoundingClientRect().height.toFixed(0)}`
  })
  const pre = document.createElement("pre")
  pre.style.cssText =
    "position:fixed;left:6px;bottom:6px;z-index:99;background:#fff;color:#111;font:10px/1.4 monospace;padding:8px;border:1px solid #333;white-space:pre-wrap;max-width:660px"
  pre.textContent = [`rows=${style.gridTemplateRows}`, `cols=${style.gridTemplateColumns}`, `display=${style.display}`]
    .concat(rows)
    .join(newline)
  document.body.append(pre)
}

/** ?q=<text> seeds the search field so the filter state can be reviewed. */
function applySearchQuery(): void {
  const query = new URLSearchParams(location.search).get("q")
  if (!query) return
  const input = document.querySelector<HTMLInputElement>("#quick-inspector > .pin-toolbar input")
  if (!input) return
  input.value = query
  input.dispatchEvent(new Event("input", { bubbles: true }))
}

/** ?edit=1 simulates a user edit so the modified dot, counter and filter show up. */
function simulateEdit(): void {
  if (!new URLSearchParams(location.search).has("edit")) return
  const inputs = Array.from(document.querySelectorAll<HTMLInputElement>("#quick-inspector [data-key-field='x'], #quick-inspector [data-key-field='width']"))
  for (const input of inputs) {
    input.value = String(Number(input.value || "0") + 4)
    input.dispatchEvent(new Event("input", { bubbles: true }))
  }
  if (new URLSearchParams(location.search).get("edit") === "filter") {
    document.querySelector<HTMLButtonElement>("#quick-inspector > .pin-toolbar .pin-filter")?.click()
  }
}

async function main(): Promise<void> {
  const response = await fetch("/index.html")

  const markup = await response.text()
  const inspector = mountFragment(markup)
  inspector.hidden = false
  inspector.dataset.inspectorGroupDisplay = "grouped"
  seedValues()
  mountRail()
  const shell = await import("./inspector-shell.ts")
  shell.initInspectorShell()
  shell.setInspectorKind("bds")
  simulateEdit()
  applySearchQuery()
  mountDebug(inspector)
  ;(window as unknown as { __inspectorPreviewReady?: boolean }).__inspectorPreviewReady = true
}


void main()
