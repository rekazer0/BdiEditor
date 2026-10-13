// 检查器重设计原型：演示新结构（模式切换 → 对象头 → 可折叠分组 → 属性行）。
// 只用于评审，确认后按此结构重写 src 里的检查器，并删除整个 prototype/ 目录。
import { createIcon } from "../src/icons.ts"

type Gesture = "CENTER" | "HOLD" | "UP" | "DOWN" | "LEFT" | "RIGHT"
interface Key {
  id: string; label: string; area: string
  x: number; y: number; w: number; h: number; padding: [number, number, number, number]
  back: number; fore: number; sound: string
  font: string; size: number; weight: number; color: string; pressedColor: string; bg: string
  gestures: Record<Gesture, string>
  statStyle: string; foreOffset: string; posType: string
}

const styles: Record<number, { name: string; bg: string }> = {
  118: { name: "白色圆角", bg: "#ffffff" }, 119: { name: "浅灰功能键", bg: "#c4c8d0" },
  120: { name: "强调蓝", bg: "#3a6df0" }, 121: { name: "深灰", bg: "#4a4e57" },
}
const gestureMeta: [Gesture, string, string][] = [
  ["CENTER", "点击", "circle-dot"], ["HOLD", "长按", "hand"], ["UP", "上滑", "arrow-up"],
  ["DOWN", "下滑", "arrow-down"], ["LEFT", "左滑", "arrow-left"], ["RIGHT", "右滑", "arrow-right"],
]
const actionMeaning = (code: string) => !code ? "" : /^\d+$/.test(code) ? `功能码 ${code}` : `输入「${code}」`

let nextID = 0
function key(label: string, area: string, back = 118, center = label.toLowerCase()): Key {
  nextID += 1
  return {
    id: `KEY${nextID}`, label, area, x: 60 + nextID * 4, y: 12 + nextID * 3, w: 104, h: 64, padding: [0, 0, 0, 0],
    back, fore: back === 120 ? 118 : back, sound: "", font: "默认字体", size: label.length > 3 ? 16 : 20, weight: 500,
    color: back === 120 ? "#ffffff" : "#121419", pressedColor: "#121419", bg: styles[back].bg,
    gestures: { CENTER: center, HOLD: "", UP: nextID < 10 ? String(nextID) : "", DOWN: "", LEFT: "", RIGHT: "" },
    statStyle: "", foreOffset: "0,0", posType: "0",
  }
}
const keys: Key[] = [
  key("，。？！", "1 / 1 / 4 / 2", 119, "，"), key("分词", "1 / 2", 118, "'"), key("ABC", "1 / 3"), key("DEF", "1 / 4"), key("⌫", "1 / 5", 119, "8"),
  key("GHI", "2 / 2"), key("JKL", "2 / 3"), key("MNO", "2 / 4"), key("重输", "2 / 5", 119, "2001"),
  key("PQRS", "3 / 2"), key("TUV", "3 / 3"), key("WXYZ", "3 / 4"), key("0", "3 / 5", 119),
  key("符", "4 / 1", 119, "2002"), key("123", "4 / 2", 119, "2003"), key("空格", "4 / 3", 118, "32"), key("中/英", "4 / 4", 119, "2004"), key("↵", "4 / 5", 120, "13"),
]

let selection: Key[] = [keys[6]]
let mode: "properties" | "source" | "ai" = "properties"
let pressedState = false
const collapsed = new Set<string>(["更多"])

/* —— DOM 小工具 —— */
type Child = Node | string | false | null | undefined
function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  for (const [name, value] of Object.entries(props)) {
    if (value === undefined || value === false) continue
    if (name.startsWith("on")) el.addEventListener(name.slice(2), value as EventListener)
    else if (name in el && !name.startsWith("aria") && !name.startsWith("data")) (el as unknown as Record<string, unknown>)[name] = value
    else el.setAttribute(name, value === true ? "" : String(value))
  }
  el.append(...children.filter((c): c is Node | string => Boolean(c)))
  return el
}
const icon = (name: string, size = 14) => createIcon(name, size)

/** 多选时取共同值；不一致返回 undefined（显示为“混合”）。 */
function common<T>(read: (k: Key) => T): T | undefined {
  const values = (selection.length ? selection : keys.slice(0, 1)).map(read)
  return values.every((v) => v === values[0]) ? values[0] : undefined
}
function update(write: (k: Key) => void): void {
  for (const k of selection) write(k)
  renderKeyboard()
}

function numberInput(prefix: string, read: (k: Key) => number, write: (k: Key, v: number) => void, label: string) {
  const value = common(read)
  return h("label", { className: "ui-input", "aria-label": label, ...(value === undefined ? { "data-mixed": true } : {}) },
    h("span", { className: "ui-input-affix" }, prefix),
    h("input", { type: "number", value: value ?? "", placeholder: value === undefined ? "混合" : "", oninput: (e: Event) => {
      const v = Number((e.target as HTMLInputElement).value)
      if (Number.isFinite(v)) update((k) => write(k, v))
    } }))
}
function textInput(read: (k: Key) => string, write: (k: Key, v: string) => void, label: string, extra: Record<string, unknown> = {}) {
  const value = common(read)
  return h("label", { className: "ui-input", "aria-label": label, ...extra },
    h("input", { value: value ?? "", placeholder: value === undefined ? "混合" : "未配置", oninput: (e: Event) => update((k) => write(k, (e.target as HTMLInputElement).value)) }))
}
function colorInput(read: (k: Key) => string, write: (k: Key, v: string) => void, label: string) {
  const value = common(read) ?? "#000000"
  const hex = h("input", { value: value.toUpperCase(), "aria-label": `${label}色值`, oninput: (e: Event) => {
    const v = (e.target as HTMLInputElement).value
    if (/^#[0-9a-f]{6}$/i.test(v)) { swatch.value = v; update((k) => write(k, v)) }
  } })
  const swatch = h("input", { type: "color", value, "aria-label": label, oninput: (e: Event) => {
    const v = (e.target as HTMLInputElement).value
    hex.value = v.toUpperCase(); update((k) => write(k, v))
  } })
  return h("div", { className: "ui-input ui-color", "data-mono": true }, swatch, hex, h("span", { className: "ui-input-affix" }, "100%"))
}
const field = (label: string, ...controls: Child[]) => h("div", { className: "ui-field" }, h("span", {}, label), controls.length > 1 ? h("div", { className: "ui-field-pair" }, ...controls) : controls[0])

function section(title: string, body: Child[], actions?: Child) {
  const isCollapsed = collapsed.has(title)
  return h("section", { className: "ui-section", ...(isCollapsed ? { "data-collapsed": true } : {}) },
    h("header", {},
      h("button", { type: "button", className: "ui-section-toggle", "aria-expanded": String(!isCollapsed), onclick: () => {
        if (collapsed.has(title)) collapsed.delete(title); else collapsed.add(title)
        renderInspector()
      } }, icon("chevron-down", 12), title),
      actions),
    h("div", { className: "ui-section-body" }, ...body))
}

/* —— 样式引用：缩略图 + 名称 + 更换 —— */
function styleRef(label: string, read: (k: Key) => number, write: (k: Key, id: number) => void) {
  const id = common(read)
  const style = id === undefined ? undefined : styles[id]
  const thumb = h("span", { className: "ui-thumb" })
  if (style) thumb.style.background = style.bg
  const menu = h("div", { className: "ui-menu proto-menu", hidden: true },
    ...Object.entries(styles).map(([sid, s]) => {
      const swatch = h("span", { className: "ui-thumb" }); swatch.style.background = s.bg
      return h("button", { type: "button", className: "ui-list-item", "aria-selected": String(Number(sid) === id), onclick: () => {
        update((k) => { write(k, Number(sid)); if (label === "背景") k.bg = s.bg })
        renderInspector()
      } }, swatch, h("span", { className: "ui-list-item-text" }, s.name, h("small", {}, `样式 ${sid}`)))
    }))
  return h("div", { className: "ui-field proto-ref" }, h("span", {}, label),
    h("div", { className: "inspector-asset" }, thumb,
      h("span", { className: "inspector-asset-text" }, style ? style.name : "混合", h("small", {}, id === undefined ? "多个样式" : `#${id}`)),
      h("button", { type: "button", className: "ui-button", "data-size": "sm", onclick: () => { menu.hidden = !menu.hidden } }, "更换"),
      menu))
}

/* —— 各对象的属性 —— */
function keySections(): HTMLElement[] {
  const multi = selection.length > 1
  const sections: HTMLElement[] = []
  if (multi) {
    const tool = (name: string, label: string) => h("button", { type: "button", className: "ui-icon-button", "aria-label": label, title: label }, icon(name))
    sections.push(section("排列", [
      h("div", { className: "inspector-tools" },
        tool("align-start-vertical", "左对齐"), tool("align-end-vertical", "右对齐"), tool("align-start-horizontal", "顶对齐"), tool("align-end-horizontal", "底对齐"),
        tool("fold-horizontal", "水平均分"), tool("fold-vertical", "垂直均分")),
      field("尺寸", h("button", { type: "button", className: "ui-button" }, "等宽"), h("button", { type: "button", className: "ui-button" }, "等高")),
      field("间距", numberInput("水平", () => 8, () => {}, "水平间距"), numberInput("垂直", () => 8, () => {}, "垂直间距")),
      selection.length === 2 && field("两个按键", h("button", { type: "button", className: "ui-button" }, icon("arrow-left-right"), "交换"), h("button", { type: "button", className: "ui-button" }, icon("square-stack"), "合并")),
    ]))
  }
  sections.push(section("布局", [
    field("位置", numberInput("X", (k) => k.x, (k, v) => { k.x = v }, "X 位置"), numberInput("Y", (k) => k.y, (k, v) => { k.y = v }, "Y 位置")),
    field("尺寸", numberInput("W", (k) => k.w, (k, v) => { k.w = v }, "宽度"), numberInput("H", (k) => k.h, (k, v) => { k.h = v }, "高度")),
    h("div", { className: "ui-field" }, h("span", {}, "内边距"), h("div", { className: "ui-field-pair", style: "--_columns: 4" },
      ...(["上", "右", "下", "左"] as const).map((side, i) => numberInput(side, (k) => k.padding[i], (k, v) => { k.padding[i] = v }, `${side}内边距`)))),
    h("p", { className: "ui-field-note" }, "方向键微调 1 px，按住 Shift 调 10 px"),
  ]))
  const stateSwitch = h("div", { className: "ui-segmented", "data-size": "sm", role: "group", "aria-label": "按键状态" },
    ...(["正常", "按下"] as const).map((label, i) => h("button", { type: "button", "aria-pressed": String(pressedState === (i === 1)), onclick: () => {
      pressedState = i === 1; renderKeyboard(); renderInspector()
    } }, label)))
  sections.push(section("外观", [
    styleRef("背景", (k) => k.back, (k, v) => { k.back = v }),
    styleRef("前景", (k) => k.fore, (k, v) => { k.fore = v }),
    h("div", { className: "ui-field" }, h("span", {}, "音效"), h("div", { className: "inspector-asset" },
      h("span", { className: "ui-thumb proto-sound" }, icon("music")), h("span", { className: "inspector-asset-text" }, "未选择", h("small", {}, "按键音效")),
      h("button", { type: "button", className: "ui-button", "data-size": "sm" }, "选择"))),
    h("button", { type: "button", className: "inspector-more", "aria-expanded": String(!collapsed.has("更多")), onclick: () => {
      if (collapsed.has("更多")) collapsed.delete("更多"); else collapsed.add("更多"); renderInspector()
    } }, icon(collapsed.has("更多") ? "chevron-right" : "chevron-down", 12), "更多排布"),
    !collapsed.has("更多") && field("状态样式", textInput((k) => k.statStyle, (k, v) => { k.statStyle = v }, "状态样式", { "data-mono": true })),
    !collapsed.has("更多") && field("前景偏移", textInput((k) => k.foreOffset, (k, v) => { k.foreOffset = v }, "前景偏移", { "data-mono": true })),
    !collapsed.has("更多") && field("位置类型", textInput((k) => k.posType, (k, v) => { k.posType = v }, "位置类型", { "data-mono": true })),
  ], stateSwitch))
  sections.push(section("文字", [
    !multi && field("内容", textInput((k) => k.label, (k, v) => { k.label = v }, "显示内容")),
    field("字体", h("label", { className: "ui-input ui-select" }, h("select", { "aria-label": "字体" }, h("option", {}, "默认字体"), h("option", {}, "PingFang SC"), h("option", {}, "思源黑体")))),
    field("字号", numberInput("pt", (k) => k.size, (k, v) => { k.size = v }, "字号"), numberInput("字重", (k) => k.weight, (k, v) => { k.weight = v }, "字重")),
    pressedState
      ? field("按下颜色", colorInput((k) => k.pressedColor, (k, v) => { k.pressedColor = v }, "按下颜色"))
      : field("颜色", colorInput((k) => k.color, (k, v) => { k.color = v }, "文字颜色")),
  ]))
  if (!multi) {
    sections.push(section("手势", gestureMeta.map(([g, label, iconName]) => {
      const meaning = h("span", { className: "ui-input-affix" }, actionMeaning(selection[0].gestures[g]))
      return h("label", { className: "inspector-gesture" }, icon(iconName),
        h("span", { className: "ui-input", "aria-label": label }, h("span", { className: "ui-input-affix" }, label),
          h("input", { value: selection[0].gestures[g], placeholder: "未配置", oninput: (e: Event) => {
            selection[0].gestures[g] = (e.target as HTMLInputElement).value; meaning.textContent = actionMeaning(selection[0].gestures[g])
          } }),
          meaning))
    })))
  }
  return sections
}

function panelSections(): HTMLElement[] {
  const panel = { w: 1080, h: 573 }
  return [
    section("面板", [
      field("尺寸", numberInput("W", () => panel.w, () => {}, "面板宽度"), numberInput("H", () => panel.h, () => {}, "面板高度")),
      h("label", { className: "ui-field" }, h("span", {}, "精确输入"), h("input", { type: "checkbox", role: "switch", className: "ui-switch" })),
      field("按键数量", h("span", { className: "ui-badge" }, String(keys.length))),
    ]),
    section("背景", [
      styleRef("面板背景", () => 121, () => {}),
      styleRef("手写背景", () => 119, () => {}),
    ]),
    section("气泡", [field("布局名称", textInput(() => "hint1", () => {}, "气泡布局", { "data-mono": true })), field("类型", textInput(() => "0", () => {}, "气泡类型", { "data-mono": true }))]),
    section("列表", [
      field("单元格", numberInput("W", () => 165, () => {}, "单元格宽"), numberInput("H", () => 101, () => {}, "单元格高")),
      field("位置", numberInput("X", () => 19, () => {}, "列表 X"), numberInput("Y", () => 4, () => {}, "列表 Y")),
    ]),
  ]
}

function objectHeader(): HTMLElement {
  if (!selection.length) {
    return h("div", { className: "inspector-object" }, h("span", { className: "inspector-object-icon" }, icon("layout-grid", 16)),
      h("span", { className: "inspector-object-text" }, h("strong", {}, "整体布局"), h("small", {}, "light/skin/port/py_9.ini")))
  }
  const one = selection.length === 1
  return h("div", { className: "inspector-object" },
    h("span", { className: "inspector-object-icon" }, icon(one ? "key-round" : "square-stack", 16)),
    h("span", { className: "inspector-object-text" },
      h("button", { type: "button", className: "inspector-crumb", onclick: () => { selection = []; renderAll() } }, icon("chevron-left", 12), "整体布局"),
      h("strong", {}, one ? `按键 · ${selection[0].label}` : `${selection.length} 个按键`),
      h("small", {}, one ? `py_9.ini · ${selection[0].id}` : "只显示共同属性")),
    h("button", { type: "button", className: "ui-icon-button", "aria-label": "复制", title: "复制（⌘D）" }, icon("copy")),
    h("button", { type: "button", className: "ui-icon-button", "aria-label": "删除", title: "删除（⌫）" }, icon("trash-2")))
}

function renderInspector(): void {
  const root = document.getElementById("inspector")!
  const modes = h("div", { className: "inspector-mode" }, h("div", { className: "ui-segmented", "data-fill": true, role: "tablist" },
    ...([["properties", "属性"], ["source", "源代码"], ["ai", "AI 设计"]] as const).map(([value, label]) =>
      h("button", { type: "button", role: "tab", "aria-selected": String(mode === value), onclick: () => { mode = value; renderInspector() } }, label))))
  let body: HTMLElement
  if (mode === "properties") body = h("div", { className: "inspector-body" }, ...(selection.length ? keySections() : panelSections()))
  else if (mode === "source") body = h("div", { className: "inspector-body" }, h("pre", { className: "proto-source" }, sourceText()))
  else body = h("div", { className: "inspector-body inspector-empty" }, icon("wand-sparkles", 20), "AI 设计面板保持现状，只换成统一的外壳")
  root.replaceChildren(modes, objectHeader(), body)
}

function sourceText(): string {
  if (!selection.length) return "[PANEL]\nRECT=0,0,1080,573\nKEY_NUM=18"
  return selection.map((k) => `[${k.id}]\nVIEW_RECT=${k.x},${k.y},${k.w},${k.h}\nBACK_STYLE=${k.back}\nFORE_STYLE=${k.fore}\nSHOW=${k.label}\nCENTER=${k.gestures.CENTER}`).join("\n\n")
}

function renderKeyboard(): void {
  const board = document.getElementById("keyboard")!
  board.replaceChildren(...keys.map((k) => {
    const selected = selection.includes(k)
    const el = h("button", { type: "button", className: "proto-key", "aria-selected": String(selected), onclick: (e: MouseEvent) => {
      e.stopPropagation()
      if (e.metaKey || e.shiftKey || e.ctrlKey) selection = selected ? selection.filter((s) => s !== k) : [...selection, k]
      else selection = [k]
      renderAll()
    } }, k.label)
    el.style.gridArea = k.area
    el.style.setProperty("--_bg", pressedState && selected ? `color-mix(in srgb, ${k.bg} 80%, black)` : k.bg)
    el.style.setProperty("--_fg", pressedState && selected ? k.pressedColor : k.color)
    el.style.setProperty("--_size", `${k.size}px`)
    el.style.setProperty("--_weight", String(k.weight))
    return el
  }))
}

function renderAll(): void { renderKeyboard(); renderInspector() }

document.addEventListener("pointerdown", (e) => {
  if (!(e.target as Element).closest(".proto-ref")) for (const menu of document.querySelectorAll<HTMLElement>(".proto-menu")) menu.hidden = true
})
document.getElementById("canvas")!.addEventListener("click", () => { selection = []; renderAll() })
for (const button of document.querySelectorAll<HTMLButtonElement>("#theme-switch button")) {
  button.addEventListener("click", () => {
    document.documentElement.dataset.appTheme = button.dataset.theme
    for (const other of document.querySelectorAll("#theme-switch button")) other.setAttribute("aria-pressed", String(other === button))
  })
}
renderAll()
