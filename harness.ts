import "./src/style.css"
import "./src/pen-design-application.css"
import "./src/pen-sidebar.css"
import "./src/pen-components.css"
import { renderBdaLayoutEditor } from "./src/bda-editor.ts"
import type { BdaAppearance, BdaPanel, Visual } from "./src/bda.ts"

const panel: BdaPanel = {
  hints: new Map(),
  lists: new Map(),
  keys: new Map(),
  input: { backStyle: { type: "color", key: 242 }, textStyle: { type: "text", key: 5 } },
  more: { backStyle: { type: "color", key: 241 } },
  backStyle: { type: "color", key: 240 },
  shouldBgBlur: false,
  shouldKeySlotting: false,
}

const appearance: BdaAppearance = {
  designWidth: 1080,
  imageStyles: new Map(),
  textStyles: new Map([[5, { fontName: "PingFangSC-Regular", fontSize: 40, normalColor: 0xff3a7bd5, highlightColor: 0xff3a7bd5, contentText: "Aa" }]]),
  colorStyles: new Map([
    [240, { normalColor: 0xff101114, highlightColor: 0xff101114 }],
    [241, { normalColor: 0xffffffff, highlightColor: 0xffeef0f4 }],
    [242, { normalColor: 0xfff2f3f5, highlightColor: 0xffe6e8ec }],
  ]),
  panels: new Map([["py_9", panel]]),
}

const resolver = {
  async resolve(styleID: string, highlighted: boolean): Promise<Visual | undefined> {
    const key = Number(styleID)
    if (key === 240) return { color: "#101114" }
    if (key === 241) return { color: highlighted ? "#e6e9f0" : "#ffffff" }
    if (key === 242) return { color: highlighted ? "#d8dbe2" : "#f2f3f5" }
    if (key === 5) return { text: { text: "Aa", color: "#3a7bd5", fontName: "PingFangSC-Regular" } }
    return undefined
  },
  resolveText: () => undefined,
  async resolveResource(): Promise<Visual | undefined> { return undefined },
  async resolveToolbarImages(): Promise<Visual[]> { return [] },
}

const container = document.querySelector<HTMLElement>("#bda-config-fields")!
renderBdaLayoutEditor(container, {
  appearance,
  panelName: "py_9",
  keys: [],
  scope: "panel",
  resolver,
  editable: true,
  onStyleChange: () => {},
  onPanelPropertyChange: () => {},
})

const rail = document.querySelector<HTMLElement>("#mobile-inspector-groups")!
const sections = Array.from(container.querySelectorAll<HTMLElement>(":scope > .bda-inspector-section"))
for (const section of sections) {
  const button = document.createElement("button")
  button.type = "button"
  button.append(document.createTextNode(section.dataset.inspectorGroupLabel ?? "分组"))
  rail.append(button)
}
rail.querySelector("button")?.classList.add("active")
for (const section of sections) {
  section.classList.add("mobile-inspector-managed")
  if (section.dataset.inspectorGroupLabel === "输入区") section.classList.add("mobile-inspector-active")
}

const pane = document.querySelector<HTMLElement>(".source")!
const width = Number(new URL(location.href).searchParams.get("w") ?? 525)
pane.style.width = `${width}px`
pane.style.height = "100vh"
pane.style.overflow = "auto"

const report = document.querySelector<HTMLElement>("#report")!
const emit = (text: string) => {
  const line = document.createElement("div")
  line.textContent = text
  report.append(line)
}
const rect = (node: Element | null) => {
  if (!node) return "missing"
  const box = node.getBoundingClientRect()
  return `${Math.round(box.width)}x${Math.round(box.height)}@${Math.round(box.left)},${Math.round(box.top)}`
}
const css = (node: Element | null, props: string[]) => {
  if (!node) return "missing"
  const style = getComputedStyle(node)
  return props.map((prop) => `${prop}=${style.getPropertyValue(prop)}`).join(" ")
}

emit(`HARNESS viewport ${window.innerWidth}x${window.innerHeight} dpr ${window.devicePixelRatio} wide=${matchMedia("(min-width: 761px)").matches}`)
emit(`HARNESS pane ${rect(pane)} inspector ${rect(document.querySelector("#quick-inspector"))} rail ${rect(rail)}`)
const rows = Array.from(document.querySelectorAll<HTMLElement>(".style-reference-field"))
emit(`HARNESS rows=${rows.length}`)
rows.forEach((row, index) => {
  const label = row.querySelector(".bda-style-reference-label")
  if (!row.getClientRects().length) return
  emit(`R${index} label=${label?.textContent ?? "?"}`)
  emit(`R${index} field ${rect(row)} ${css(row, ["display", "grid-template-columns", "gap", "min-height", "padding", "font-size"])}`)
  emit(`R${index} caption ${rect(label)} ${css(label, ["font-size", "font-weight", "color"])}`)
  const control = row.querySelector(".style-reference-input")
  emit(`R${index} control ${rect(control)} ${css(control, ["display", "grid-template-columns", "min-height", "border-top-width", "background-color"])}`)
  const input = row.querySelector("input")
  emit(`R${index} input ${rect(input)} ${css(input, ["height", "font-size", "padding-left", "text-align", "background-color"])}`)
  const trigger = row.querySelector(".style-picker-trigger")
  emit(`R${index} trigger ${rect(trigger)} ${css(trigger, ["height", "min-height", "padding", "border-left-width"])}`)
  const states = row.querySelector(".style-picker-states")
  emit(`R${index} states ${rect(states)} ${css(states, ["display", "grid-template-columns", "height"])}`)
  row.querySelectorAll(".style-picker-state").forEach((state, stateIndex) => {
    emit(`R${index} state${stateIndex} ${rect(state)} ${css(state, ["display", "height"])}`)
  })
  row.querySelectorAll("canvas").forEach((canvas, canvasIndex) => {
    emit(`R${index} canvas${canvasIndex} ${rect(canvas)} ${css(canvas, ["height", "width", "border-top-width", "background-color"])} bitmap=${canvas.width}x${canvas.height}`)
  })
})
