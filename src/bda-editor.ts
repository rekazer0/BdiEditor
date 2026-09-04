import { drawVisualText, type Visual, type VisualResolver } from "./atlas.ts"
import {
  bdaColorHex,
  bdaStyleID,
  decodeBdaAnimation,
  decodeBdaAppearance,
  decodeBdaSoundConfig,
  type BdaAppearance,
  type BdaAnimationFrame,
  type BdaKey,
  type BdaPanel,
  type BdaStyleRef,
} from "./bda.ts"

export type BdaStyleChange = (ref: BdaStyleRef, property: string, value: string) => void
export type BdaLayoutScope = "panel" | "candidate"

type LayoutEditorOptions = {
  appearance: BdaAppearance
  panelName: string
  keys: Array<{ name: string; key: BdaKey }>
  scope?: BdaLayoutScope
  resolver?: VisualResolver
  editable: boolean
  onStyleChange: BdaStyleChange
  onPanelPropertyChange: (property: "shouldBgBlur" | "shouldKeySlotting" | "trackColor", value: boolean | string) => void
  onStyleRefChange?: (paths: string[][], ref: BdaStyleRef, field: HTMLElement) => void
  onStyleRefAction?: (
    paths: string[][],
    ref: BdaStyleRef,
    field: string,
    action: "replace" | "edit",
    owner: HTMLElement,
  ) => void
}

// label 是中文说明，field 是 BDA appearanceConfig 解码源码里的真实字段名，
// path 指向单个样式引用；多选时 paths 汇总所有同步写回位置。
export type BdaLayoutStyleItem = {
  ref: BdaStyleRef
  label: string
  field: string
  path: string[]
  paths?: string[][]
  owner?: string
}
export type BdaLayoutStyleGroup = { key: string; title: string; items: BdaLayoutStyleItem[] }

function uniqueStyleItems(items: BdaLayoutStyleItem[]): BdaLayoutStyleItem[] {
  return [...new Map(items.map((item) => [item.path.join("."), item])).values()]
}

function keyStyleItems(name: string, key: BdaKey, path: string[]): BdaLayoutStyleItem[] {
  return [
    ...(key.backStyle ? [{ ref: key.backStyle, label: "背景样式", field: "backStyle", path: [...path, "backStyle"], owner: name }] : []),
    ...key.foreStyles.map((ref, index) => ({
      ref,
      label: `前景样式 ${index + 1}`,
      field: `foreStyles[${index}]`,
      path: [...path, "foreStyles", String(index)],
      owner: name,
    })),
    ...(key.backStyleState ? [{ ref: key.backStyleState, label: "状态背景样式", field: "backStyleState", path: [...path, "backStyleState"], owner: name }] : []),
  ]
}

export function bdaLayoutStyleGroups(
  panel: BdaPanel,
  keys: Array<{ name: string; key: BdaKey }>,
  scope: BdaLayoutScope = "panel",
): BdaLayoutStyleGroup[] {
  const group = (key: string, title: string, items: BdaLayoutStyleItem[]): BdaLayoutStyleGroup | undefined => {
    const unique = uniqueStyleItems(items)
    return unique.length ? { key, title, items: unique } : undefined
  }
  if (keys.length) {
    const items = keys.flatMap(({ name, key }) => keyStyleItems(name, key, ["keys", name]))
    const merged = keys.length === 1 ? items : [...items.reduce((result, item) => {
      const current = result.get(item.field)
      if (current) current.paths!.push(item.path)
      else result.set(item.field, { ...item, owner: undefined, paths: [item.path] })
      return result
    }, new Map<string, BdaLayoutStyleItem>()).values()]
    const selection = group("selection", `已选按键（${keys.length}）`, merged)
    return selection ? [selection] : []
  }

  // 候选栏样式属于候选栏对象，不混入面板整体设置。
  if (scope === "candidate") {
    const candidate: BdaLayoutStyleItem[] = []
    const cand = panel.cand
    if (!cand) return []
    for (const [ref, label, field] of [
      [cand.candBarStyle, "候选栏背景", "candBarStyle"], [cand.candOnBarStyle, "候选上屏状态", "candOnBarStyle"],
      [cand.cellBackStyle, "候选单元背景", "cellBackStyle"], [cand.cellForeStyle, "候选文字", "cellForeStyle"],
      [cand.firstCellBackStyle, "首候选背景", "firstCellBackStyle"], [cand.firstCellForeStyle, "首候选文字", "firstCellForeStyle"],
      [cand.subCandBackStyle, "子候选栏背景", "subCandBackStyle"], [cand.subCandCellBackStyle, "子候选单元背景", "subCandCellBackStyle"],
      [cand.subCandCellForeStyle, "子候选文字", "subCandCellForeStyle"], [cand.accessoryBackStyle, "候选附件背景", "accessoryBackStyle"],
      [cand.gridLeftForeStyle, "候选网格左图标", "gridLeftForeStyle"], [cand.gridRightForeStyle, "候选网格右图标", "gridRightForeStyle"],
    ] as const) if (ref) candidate.push({ ref, label, field, path: ["cand", field] })
    const switchItems: BdaLayoutStyleItem[] = []
    if (cand.switch) {
      for (const [ref, label, field] of [
        [cand.switch.normalBack, "候选切换 · 正常背景", "normalBack"], [cand.switch.selectBack, "候选切换 · 选中背景", "selectBack"],
        [cand.switch.normalFore, "候选切换 · 正常前景", "normalFore"], [cand.switch.selectFore, "候选切换 · 选中前景", "selectFore"],
      ] as const) if (ref) switchItems.push({ ref, label, field: `switch.${field}`, path: ["cand", "switch", field] })
    }
    const candKeys = [...cand.candKeys].flatMap(([name, value]) =>
      keyStyleItems(`候选键 ${name}`, value, ["cand", "candKeys", name]))
    const menuKeys = [...cand.menuKeys].flatMap(([name, value]) =>
      keyStyleItems(`候选菜单 ${name}`, value, ["cand", "menuKeys", name]))
    const aiIcon = cand.aiIcon ? keyStyleItems("AI 图标", cand.aiIcon, ["cand", "aiIcon"]) : []
    return [
      group("candidate", "候选栏", candidate),
      group("candidateSwitch", "候选切换", switchItems),
      group("candidateKeys", "候选键", candKeys),
      group("candidateMenu", "候选菜单", [...menuKeys, ...aiIcon]),
    ].filter((value): value is BdaLayoutStyleGroup => Boolean(value))
  }

  const groups = [
    group("panel", "面板", [
      ...(panel.wholeBackStyle ? [{ ref: panel.wholeBackStyle, label: "面板整体背景", field: "wholeBackStyle", path: ["wholeBackStyle"] }] : []),
      ...(panel.backStyle ? [{ ref: panel.backStyle, label: "面板背景", field: "backStyle", path: ["backStyle"] }] : []),
      ...(panel.inputRegionBackStyle ? [{ ref: panel.inputRegionBackStyle, label: "输入区整体背景", field: "inputRegionBackStyle", path: ["inputRegionBackStyle"] }] : []),
    ]),
    group("input", "输入区", [
      ...(panel.input?.backStyle ? [{ ref: panel.input.backStyle, label: "输入区背景", field: "input.backStyle", path: ["input", "backStyle"] }] : []),
      ...(panel.input?.textStyle ? [{ ref: panel.input.textStyle, label: "输入区文字", field: "input.textStyle", path: ["input", "textStyle"] }] : []),
    ]),
    group("more", "更多面板", [
      ...(panel.more?.backStyle ? [{ ref: panel.more.backStyle, label: "更多面板背景", field: "more.backStyle", path: ["more", "backStyle"] }] : []),
      ...(panel.more?.cellBackStyle ? [{ ref: panel.more.cellBackStyle, label: "更多面板单元背景", field: "more.cellBackStyle", path: ["more", "cellBackStyle"] }] : []),
      ...(panel.more?.cellForeStyle ? [{ ref: panel.more.cellForeStyle, label: "更多面板单元前景", field: "more.cellForeStyle", path: ["more", "cellForeStyle"] }] : []),
    ]),
    group("hints", "按键提示", [...panel.hints].flatMap(([name, hint]) => [
      ...(hint.backStyle ? [{ ref: hint.backStyle, label: `${name} · 背景`, field: "backStyle", path: ["hints", name, "backStyle"] }] : []),
      ...(hint.barStyle ? [{ ref: hint.barStyle, label: `${name} · 提示条`, field: "barStyle", path: ["hints", name, "barStyle"] }] : []),
      ...(hint.foreStyle ? [{ ref: hint.foreStyle, label: `${name} · 前景`, field: "foreStyle", path: ["hints", name, "foreStyle"] }] : []),
      ...(hint.cellStyle ? [{ ref: hint.cellStyle, label: `${name} · 单元背景`, field: "cellStyle", path: ["hints", name, "cellStyle"] }] : []),
    ])),
    group("lists", "列表", [...panel.lists].flatMap(([name, list]) => [
      ...(list.backStyle ? [{ ref: list.backStyle, label: `${name} · 背景`, field: "backStyle", path: ["lists", name, "backStyle"] }] : []),
      ...(list.cellBackStyle ? [{ ref: list.cellBackStyle, label: `${name} · 单元背景`, field: "cellBackStyle", path: ["lists", name, "cellBackStyle"] }] : []),
      ...(list.cellForeStyle ? [{ ref: list.cellForeStyle, label: `${name} · 单元文字`, field: "cellForeStyle", path: ["lists", name, "cellForeStyle"] }] : []),
      ...list.foreStyles.map((ref, index) => ({
        ref,
        label: `${name} · 前景 ${index + 1}`,
        field: `foreStyles[${index}]`,
        path: ["lists", name, "foreStyles", String(index)],
      })),
    ])),
  ]
  return groups.filter((value): value is BdaLayoutStyleGroup => Boolean(value))
}

type StyleEditorOptions = {
  appearance: BdaAppearance
  ref: BdaStyleRef
  resolver?: VisualResolver
  editable: boolean
  onStyleChange: BdaStyleChange
  onImageAction?: (ref: BdaStyleRef, highlighted: boolean, action: "replace" | "slice") => void
}

type ConfigEditorOptions = {
  path: string
  bytes: Uint8Array
  resolver?: VisualResolver
  editable: boolean
  onDesignWidth: (value: number) => void
  onAnimationFrame: (sequence: string, frame: number, property: "resourceID" | "duration", value: string | number) => void
  onPickAnimationResource: (sequence: string, frame: number) => void
}

type MetadataEditorOptions = {
  entries: Array<{ key: string; value: string }>
  editable: boolean
  onChange: (key: string, value: string) => void
}

function element<K extends keyof HTMLElementTagNameMap>(name: K, className?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(name)
  if (className) node.className = className
  return node
}

function inspectorSection<T extends HTMLElement>(node: T, label: string): T {
  node.classList.add("bda-inspector-section")
  node.dataset.inspectorGroupLabel = label
  return node
}

function heading(title: string, detail?: string): HTMLElement {
  const header = element("header", "bda-card-heading")
  const strong = element("strong")
  strong.textContent = title
  header.append(strong)
  if (detail) {
    const small = element("small")
    small.textContent = detail
    header.append(small)
  }
  return header
}

function drawVisual(canvas: HTMLCanvasElement, visual: Visual | undefined): void {
  const scale = Math.max(1, window.devicePixelRatio || 1)
  const bounds = canvas.getBoundingClientRect()
  const width = Math.max(1, Math.round(bounds.width || 128))
  const height = Math.max(1, Math.round(bounds.height || 76))
  canvas.width = width * scale
  canvas.height = height * scale
  const context = canvas.getContext("2d")!
  context.setTransform(scale, 0, 0, scale, 0, 0)
  context.clearRect(0, 0, width, height)
  if (visual?.color) {
    context.fillStyle = visual.color
    context.fillRect(0, 0, width, height)
  }
  if (visual?.image) {
    const source = visual.source ?? [0, 0, visual.image.width, visual.image.height]
    const ratio = Math.min(width / source[2], height / source[3])
    const imageWidth = source[2] * ratio
    const imageHeight = source[3] * ratio
    context.drawImage(
      visual.image,
      source[0], source[1], source[2], source[3],
      (width - imageWidth) / 2, (height - imageHeight) / 2, imageWidth, imageHeight,
    )
  }
  if (visual) drawVisualText(context, visual, { x: 0, y: 0, width, height })
}

export function bdaAnimationDurations(frames: BdaAnimationFrame[]): number[] {
  return frames.map((frame) => Math.max(16, frame.duration ?? 100))
}

function animationPlayer(frames: BdaAnimationFrame[], resolver: VisualResolver | undefined): HTMLElement {
  const player = element("section", "bda-animation-player")
  const canvas = element("canvas")
  const controls = element("div")
  const play = element("button")
  const status = element("output")
  const durations = bdaAnimationDurations(frames)
  let timer: number | undefined
  let run = 0

  const show = (index: number) => {
    status.value = frames.length ? `第 ${index + 1} / ${frames.length} 帧` : "没有动画帧"
    const resourceID = frames[index]?.resourceID
    if (!resourceID) return drawVisual(canvas, undefined)
    void resolver?.resolveResource?.(resourceID)
      .then((visual) => { if (canvas.isConnected) drawVisual(canvas, visual) })
      .catch(() => {})
  }
  const stop = (label: string) => {
    run += 1
    if (timer !== undefined) window.clearTimeout(timer)
    timer = undefined
    play.textContent = label
  }
  const start = () => {
    if (!frames.length) return
    if (timer !== undefined) return stop("播放预览")
    const currentRun = ++run
    let index = 0
    play.textContent = "停止"
    const advance = () => {
      if (currentRun !== run || !player.isConnected) return
      show(index)
      timer = window.setTimeout(() => {
        index += 1
        if (index < frames.length) advance()
        else stop("重新播放")
      }, durations[index])
    }
    advance()
  }

  play.type = "button"
  play.textContent = "播放预览"
  play.disabled = !frames.length
  play.addEventListener("click", start)
  show(0)
  controls.append(play, status)
  player.append(canvas, controls)
  return player
}

function stylePreview(
  ref: BdaStyleRef,
  resolver: VisualResolver | undefined,
  editable = false,
  onImageAction?: StyleEditorOptions["onImageAction"],
  imageResourceNames?: readonly [string | undefined, string | undefined],
): HTMLElement {
  const preview = element("div", "bda-style-preview")
  for (const [index, [highlighted, label]] of ([[false, "正常"], [true, "按下"]] as const).entries()) {
    const state = ref.type === "image" && onImageAction ? element("button") : element("figure")
    if (state instanceof HTMLButtonElement) {
      state.type = "button"
      state.disabled = !editable
      state.title = "点击更换图片；Command/Ctrl 点击进入切片工具"
      state.setAttribute("aria-label", `${label}状态图片：点击更换图片，Command/Ctrl 点击进入切片工具`)
      state.addEventListener("click", (event) => {
        onImageAction?.(ref, highlighted, event.metaKey || event.ctrlKey ? "slice" : "replace")
      })
    }
    const canvas = element("canvas")
    const caption = ref.type === "image" ? element("span") : element("figcaption")
    caption.className = "bda-style-reference-state-label"
    caption.textContent = label
    const resourceName = imageResourceNames?.[index]
    if (resourceName) {
      const name = element("span", "bda-style-resource-name")
      name.textContent = resourceName
      name.title = resourceName
      state.append(name)
    }
    state.append(canvas, caption)
    preview.append(state)
    void resolver?.resolve(bdaStyleID(ref), highlighted)
      .then((visual) => { if (canvas.isConnected) drawVisual(canvas, visual) })
      .catch(() => {})
  }
  return preview
}

function colorField(
  label: string,
  value: number,
  disabled: boolean,
  onChange: (value: string) => void,
): HTMLElement {
  const field = element("label", "bda-color-field")
  const caption = element("span")
  caption.textContent = label
  const controls = element("span", "bda-color-controls")
  const hex = bdaColorHex(value)
  const picker = element("input")
  picker.type = "color"
  picker.value = `#${hex.slice(2)}`
  picker.disabled = disabled
  const alpha = element("input")
  alpha.type = "range"
  alpha.min = "0"
  alpha.max = "255"
  alpha.value = String(Number.parseInt(hex.slice(0, 2), 16))
  alpha.disabled = disabled
  const output = element("output")
  const commit = () => {
    const next = `${Number(alpha.value).toString(16).padStart(2, "0")}${picker.value.slice(1)}`.toUpperCase()
    output.value = next
    onChange(next)
  }
  output.value = hex
  picker.addEventListener("change", commit)
  alpha.addEventListener("change", commit)
  controls.append(picker, alpha, output)
  field.append(caption, controls)
  return field
}

function rangeField(
  label: string,
  value: number,
  min: number,
  max: number,
  disabled: boolean,
  onChange: (value: number) => void,
): HTMLElement {
  const field = element("label", "bda-range-field")
  const caption = element("span")
  caption.textContent = label
  const row = element("span")
  const range = element("input")
  range.type = "range"
  range.min = String(min)
  range.max = String(Math.max(max, value))
  range.value = String(value)
  range.disabled = disabled
  const output = element("output")
  output.value = String(value)
  range.addEventListener("input", () => { output.value = range.value })
  range.addEventListener("change", () => onChange(Number(range.value)))
  row.append(range, output)
  field.append(caption, row)
  return field
}

function textField(
  label: string,
  value: string,
  disabled: boolean,
  onChange: (value: string) => void,
): HTMLElement {
  const field = element("label", "bda-text-field")
  const caption = element("span")
  caption.textContent = label
  const input = element("input")
  input.value = value
  input.disabled = disabled
  input.addEventListener("change", () => onChange(input.value))
  field.append(caption, input)
  return field
}

function readonlyField(label: string, value: string | number): HTMLElement {
  const field = element("label", "bda-readonly-field")
  const caption = element("span")
  caption.textContent = label
  const output = element("output")
  output.value = String(value)
  field.append(caption, output)
  return field
}

function booleanField(
  label: string,
  value: boolean,
  disabled: boolean,
  onChange: (value: boolean) => void,
  technicalName?: string,
): HTMLElement {
  const field = element("label", "document-property-field wide inspector-switch bda-boolean-field")
  const caption = element("span")
  const accessibleLabel = technicalName ? `${label}（${technicalName}）` : label
  caption.textContent = label
  caption.title = accessibleLabel
  const input = element("input")
  input.type = "checkbox"
  input.setAttribute("aria-label", accessibleLabel)
  input.setAttribute("role", "switch")
  input.checked = value
  input.disabled = disabled
  input.addEventListener("change", () => onChange(input.checked))
  field.append(caption, input)
  return field
}

function styleCard(
  ref: BdaStyleRef,
  label: string,
  appearance: BdaAppearance,
  resolver: VisualResolver | undefined,
  editable: boolean,
  onChange: BdaStyleChange,
  onImageAction?: StyleEditorOptions["onImageAction"],
): HTMLElement | undefined {
  const imageStyle = ref.type === "image" ? appearance.imageStyles.get(ref.key) : undefined
  if (ref.type === "image" && !imageStyle) return
  const imageResourceNames = imageStyle
    ? [imageStyle.normalImage?.resource?.resourceID, imageStyle.highlightImage?.resource?.resourceID] as const
    : undefined
  const card = element("article", "bda-style-card")
  card.append(
    heading(label, `${ref.type} · ${ref.key}`),
    stylePreview(ref, resolver, editable, onImageAction, imageResourceNames),
  )
  const controls = element("div", "bda-style-controls")
  if (ref.type === "image") {
    const style = imageStyle!
    const advanced = element("div", "bda-style-controls bda-advanced-fields")
    const atomFields = (prefix: string, atom: typeof style.normalImage) => {
      if (!atom) return
      if (atom.innerRect) advanced.append(readonlyField(`${prefix}切片区域`, `${atom.innerRect.x}, ${atom.innerRect.y}, ${atom.innerRect.width}, ${atom.innerRect.height}`))
      if (atom.contentInset) advanced.append(readonlyField(`${prefix}内容边距`, `${atom.contentInset.top}, ${atom.contentInset.left}, ${atom.contentInset.bottom}, ${atom.contentInset.right}`))
      if (atom.alpha !== undefined) advanced.append(readonlyField(`${prefix}透明度`, atom.alpha))
      if (atom.filterColor !== undefined) advanced.append(readonlyField(`${prefix}滤色`, bdaColorHex(atom.filterColor)))
    }
    atomFields("正常", style.normalImage)
    atomFields("按下", style.highlightImage)
    if (style.fontInfo) {
      const font = style.fontInfo
      if (font.contentText !== undefined) advanced.append(readonlyField("图片内文字", font.contentText))
      if (font.fontSize !== undefined) advanced.append(readonlyField("图片内字号", font.fontSize))
      if (font.normalColor !== undefined) advanced.append(readonlyField("图片内正常文字色", bdaColorHex(font.normalColor)))
      if (font.highlightColor !== undefined) advanced.append(readonlyField("图片内按下文字色", bdaColorHex(font.highlightColor)))
      if (font.scaledOffset) advanced.append(readonlyField("图片内文字偏移", `${font.scaledOffset.x}, ${font.scaledOffset.y}`))
      if (font.drawType !== undefined) advanced.append(readonlyField("图片内文字绘制方式", font.drawType))
    }
    if (advanced.childElementCount) {
      const note = element("p", "bda-advanced-note")
      note.textContent = "高级图片字段（只读）"
      card.append(note, advanced)
    }
  } else if (ref.type === "color") {
    const style = appearance.colorStyles.get(ref.key)
    if (!style) return
    if (style.normalColor !== undefined) controls.append(colorField("正常颜色", style.normalColor, !editable, (value) => onChange(ref, "NM_COLOR", value)))
    if (style.highlightColor !== undefined) controls.append(colorField("按下颜色", style.highlightColor, !editable, (value) => onChange(ref, "HL_COLOR", value)))
  } else {
    const style = appearance.textStyles.get(ref.key)
    if (!style) return
    if (style.fontName !== undefined) controls.append(textField("字体", style.fontName, !editable, (value) => onChange(ref, "FONT_NAME", value)))
    if (style.fontSize !== undefined) controls.append(rangeField("字号", style.fontSize, 1, 160, !editable, (value) => onChange(ref, "FONT_SIZE", String(value))))
    if (style.normalColor !== undefined) controls.append(colorField("正常文字", style.normalColor, !editable, (value) => onChange(ref, "NM_COLOR", value)))
    if (style.highlightColor !== undefined) controls.append(colorField("按下文字", style.highlightColor, !editable, (value) => onChange(ref, "HL_COLOR", value)))
    if (style.resource) controls.append(readonlyField("字体资源", `${style.resource.type}:${style.resource.resourceID}`))
    if (style.contentText !== undefined) controls.append(readonlyField("固定文字", style.contentText))
  }
  if (controls.childElementCount) card.append(controls)
  return card
}

export function renderBdaStyleEditor(
  container: HTMLElement,
  options: StyleEditorOptions,
): void {
  container.replaceChildren()
  const card = styleCard(
    options.ref,
    `STYLE ${options.ref.key}`,
    options.appearance,
    options.resolver,
    options.editable,
    options.onStyleChange,
    options.onImageAction,
  )
  if (card) container.append(inspectorSection(card, "样式"))
}

export function renderBdaLayoutEditor(container: HTMLElement, options: LayoutEditorOptions): void {
  container.replaceChildren()
  const panel = options.appearance.panels.get(options.panelName.replace(/\.ini$/i, ""))
  if (!panel) return
  const scope = options.scope ?? "panel"
  const groups = bdaLayoutStyleGroups(panel, options.keys, scope)

  const styleReferenceField = (item: BdaLayoutStyleItem): HTMLElement => {
    const isForeStyle = /^foreStyles\[\d+\]$/.test(item.field)
    const field = element("div", `document-property-field wide style-reference-field${isForeStyle ? " fore-style-reference-field" : ""}`)
    field.dataset.bdaStylePath = item.path.join(".")
    const caption = element("span")
    caption.className = "bda-style-reference-label"
    caption.textContent = item.label
    // 说明与源码字段对应，避免展示 INI 字段名造成误导。
    caption.title = `${item.label}（${item.field}）`
    const control = element("span", "style-reference-input bda-style-reference-input")
    const keyInput = element("input")
    keyInput.className = "document-property-input"
    keyInput.value = String(item.ref.key)
    keyInput.disabled = !options.editable
    keyInput.setAttribute("aria-label", `${item.label} key`)
    const currentRef = (): BdaStyleRef => ({ type: item.ref.type, key: Number(keyInput.value) })
    const commit = () => {
      const key = Number(keyInput.value)
      if (!Number.isInteger(key) || key < 0) return
      options.onStyleRefChange?.(item.paths ?? [item.path], {
        type: item.ref.type,
        key,
      }, field)
    }
    keyInput.addEventListener("change", commit)
    const preview = element("button", "style-picker-trigger bda-style-reference-preview")
    preview.type = "button"
    preview.disabled = !options.editable
    preview.title = "点击更换样式；Command/Ctrl 点击编辑样式"
    preview.setAttribute("aria-label", `${item.label}：点击更换样式，Command/Ctrl 点击编辑样式`)
    const states = element("span", "style-picker-states")
    for (const [highlighted, label] of [[false, "正常"], [true, "按下"]] as const) {
      const state = element("span", "style-picker-state")
      const canvas = element("canvas")
      canvas.setAttribute("aria-label", `${label}状态`)
      state.append(canvas)
      states.append(state)
      void options.resolver?.resolve(bdaStyleID(item.ref), highlighted)
        .then((visual) => { if (canvas.isConnected) drawVisual(canvas, visual) })
        .catch(() => {})
    }
    preview.append(states)
    preview.addEventListener("click", (event) => {
      options.onStyleRefAction?.(
        item.paths ?? [item.path],
        currentRef(),
        item.field,
        event.metaKey || event.ctrlKey ? "edit" : "replace",
        field,
      )
    })
    control.append(keyInput, preview)
    field.append(caption, control)
    return field
  }

  const appendStyleReferences = (grid: HTMLElement, items: BdaLayoutStyleItem[]) => {
    const appendItems = (container: HTMLElement, ownedItems: BdaLayoutStyleItem[]) => {
      for (let index = 0; index < ownedItems.length;) {
        const item = ownedItems[index]
        if (!/^foreStyles\[\d+\]$/.test(item.field)) {
          container.append(styleReferenceField(item))
          index += 1
          continue
        }
        const collectionPath = item.path.slice(0, -2).join(".")
        const collection: BdaLayoutStyleItem[] = []
        while (index < ownedItems.length) {
          const next = ownedItems[index]
          if (!/^foreStyles\[\d+\]$/.test(next.field) || next.path.slice(0, -2).join(".") !== collectionPath) break
          collection.push(next)
          index += 1
        }
        const field = element("div", "document-property-field wide style-reference-field fore-styles-reference-field")
        const strip = element("div", "bda-fore-styles-grid")
        strip.append(...collection.map((entry, itemIndex) => {
          const row = styleReferenceField(entry)
          const rowCaption = row.querySelector<HTMLElement>(".bda-style-reference-label")
          if (rowCaption) {
            rowCaption.replaceChildren()
            rowCaption.append(document.createTextNode(
              itemIndex === 0 ? "前景样式 · 主" : itemIndex === 1 ? "前景样式 · 辅" : `前景样式 · 辅 ${itemIndex}`,
            ))
          }
          return row
        }))
        field.append(strip)
        container.append(field)
      }
    }
    for (let index = 0; index < items.length;) {
      const owner = items[index].owner
      if (!owner) {
        const unowned: BdaLayoutStyleItem[] = []
        while (index < items.length && !items[index].owner) {
          unowned.push(items[index])
          index += 1
        }
        appendItems(grid, unowned)
        continue
      }
      const block = element("section", "bda-key-style-block")
      const title = element("h4")
      title.textContent = owner
      block.append(title)
      const owned: BdaLayoutStyleItem[] = []
      while (index < items.length && items[index].owner === owner) {
        owned.push(items[index])
        index += 1
      }
      appendItems(block, owned)
      grid.append(block)
    }
  }

  for (const group of groups) {
    const section = inspectorSection(element("section", "document-property-section bda-panel-property-section"), group.title)
    const title = element("h3")
    title.textContent = group.title
    const grid = element("div", "document-property-grid")
    if (scope === "panel" && !options.keys.length && group.key === "panel") {
      if (panel.shouldBgBlur !== undefined) grid.append(booleanField("背景模糊", panel.shouldBgBlur, !options.editable, (value) => options.onPanelPropertyChange("shouldBgBlur", value), "shouldBgBlur"))
      if (panel.shouldKeySlotting !== undefined) grid.append(booleanField("按键开槽", panel.shouldKeySlotting, !options.editable, (value) => options.onPanelPropertyChange("shouldKeySlotting", value), "shouldKeySlotting"))
      if (panel.trackColor !== undefined) {
        const field = colorField("滑动轨迹颜色（trackColor）", panel.trackColor, !options.editable, (value) => options.onPanelPropertyChange("trackColor", value))
        field.classList.add("document-property-field", "wide")
        grid.append(field)
      }
    }
    appendStyleReferences(grid, group.items)
    section.append(title, grid)
    container.append(section)
  }
  if (!groups.length) {
    const empty = element("p", "bda-editor-empty")
    empty.textContent = scope === "candidate"
      ? "当前面板的 appearanceConfig 里没有候选栏样式。"
      : "当前对象没有可编辑的 BDA 面板属性。"
    container.append(empty)
  }
}

export async function refreshBdaStyleReferenceField(
  field: HTMLElement,
  ref: BdaStyleRef,
  resolver?: VisualResolver,
): Promise<void> {
  const input = field.querySelector<HTMLInputElement>(".document-property-input")
  if (input) input.value = String(ref.key)
  if (!resolver) return
  const canvases = [...field.querySelectorAll<HTMLCanvasElement>("canvas")]
  const highlighted = canvases.length > 1 ? [false, true] : [false]
  await Promise.all(canvases.map(async (canvas, index) => {
    const visual = await resolver.resolve(bdaStyleID(ref), highlighted[index] ?? false).catch(() => undefined)
    if (canvas.isConnected) drawVisual(canvas, visual)
  }))
}

export function renderBdaConfigEditor(container: HTMLElement, options: ConfigEditorOptions): void {
  container.replaceChildren()
  const name = options.path.split("/").pop() ?? options.path
  if (/^\d*appearanceConfig$/i.test(name)) {
    const appearance = decodeBdaAppearance(options.bytes)
    const summary = inspectorSection(element("div", "bda-editor-summary"), "外观")
    summary.append(heading("外观配置", `${appearance.panels.size} 个布局 · ${appearance.imageStyles.size + appearance.textStyles.size + appearance.colorStyles.size} 个样式`))
    if (appearance.designWidth !== undefined) {
      summary.append(rangeField("设计宽度", appearance.designWidth, 320, 2160, !options.editable, options.onDesignWidth))
    }
    const panels = inspectorSection(element("div", "bda-panel-list"), "布局")
    for (const [panelName, panel] of appearance.panels) {
      const card = element("article")
      card.append(heading(panelName, `${panel.keys.size} 个按键`))
      panels.append(card)
    }
    container.append(summary, panels)
    return
  }
  if (/animationConfig$/i.test(name)) {
    const animation = decodeBdaAnimation(options.bytes)
    const summary = inspectorSection(element("article", "bda-animation-card"), "动画")
    const kinds = new Set([...animation.effects.values()].map((effect) => effect.kind))
    summary.append(heading("动画配置", `${animation.targets.length} 个目标 · ${animation.effects.size} 个定义 · ${[...kinds].join(" / ") || "无动画"}`))
    container.append(summary)
    for (const sequence of animation.sequences.values()) {
      const card = inspectorSection(element("article", "bda-animation-card"), sequence.name)
      card.append(heading(sequence.name, `${sequence.frames.length} 帧`), animationPlayer(sequence.frames, options.resolver))
      const strip = element("div", "bda-frame-strip")
      sequence.frames.forEach((frame, index) => {
        const item = element("article", "bda-frame-card")
        item.append(heading(`第 ${index + 1} 帧`, frame.resourceID))
        const row = element("div", "bda-frame-row")
        const controls = element("div", "bda-frame-controls")
        if (frame.resourceID !== undefined) {
          const preview = element("button", "bda-frame-resource-button")
          const canvas = element("canvas")
          const caption = element("span")
          preview.type = "button"
          preview.disabled = !options.editable
          preview.setAttribute("aria-label", `更换第 ${index + 1} 帧图片资源`)
          caption.textContent = options.editable ? "点击更换图片" : "图片资源"
          preview.append(canvas, caption)
          preview.addEventListener("click", () => options.onPickAnimationResource(sequence.name, index))
          void options.resolver?.resolveResource?.(frame.resourceID)
            .then((visual) => { if (canvas.isConnected) drawVisual(canvas, visual) })
            .catch(() => {})
          row.append(preview)
          controls.append(textField("图片资源", frame.resourceID, !options.editable, (value) => options.onAnimationFrame(sequence.name, index, "resourceID", value)))
        }
        if (frame.duration !== undefined) {
          controls.append(rangeField("时长（毫秒）", frame.duration, 0, 2000, !options.editable, (value) => options.onAnimationFrame(sequence.name, index, "duration", value)))
        }
        row.append(controls)
        item.append(row)
        strip.append(item)
      })
      card.append(strip)
      container.append(card)
    }
    for (const effect of animation.effects.values()) {
      if (effect.kind === "image") continue
      const card = inspectorSection(element("article", "bda-animation-card"), effect.key)
      const resource = "resource" in effect ? effect.resource?.resourceID : effect.kind === "emitter"
        ? effect.resources.map((item) => item.resourceID).join("、")
        : effect.kind === "group" ? effect.items.map((item) => `${item.kind}:${item.key}`).join("、") : undefined
      card.append(heading(effect.key, `${effect.kind}${resource ? ` · ${resource}` : ""}`))
      container.append(card)
    }
    return
  }
  if (/^\d*soundConfig$/i.test(name)) {
    const sound = decodeBdaSoundConfig(options.bytes)
    const list = inspectorSection(element("div", "bda-sound-list"), "声音")
    for (const [key, resource] of [...sound.keySounds, ...sound.iosKeySounds]) {
      const card = element("article")
      card.append(heading(key, resource.resourceID))
      list.append(card)
    }
    container.append(list)
    return
  }
  const empty = element("p", "bda-editor-empty")
  empty.textContent = "这个源文件已解码，但当前没有受支持的可视化编辑项。"
  container.append(empty)
}

export function renderBdaMetadataEditor(container: HTMLElement, options: MetadataEditorOptions): void {
  container.replaceChildren()
  const labels: Record<string, string> = {
    Name: "皮肤名称",
    Description: "描述",
    Author: "作者",
    Version: "版本",
    MinImeCode: "最低输入法版本",
    SupportPlatform: "支持平台",
    SupportDarkMode: "支持深色模式",
    AtomSkinName: "主题目录",
  }
  const card = inspectorSection(element("article", "bda-metadata-card"), "皮肤")
  card.append(heading("皮肤信息", `${options.entries.length} 个实际字段`))
  const controls = element("div", "bda-style-controls")
  for (const entry of options.entries) {
    controls.append(textField(labels[entry.key] ?? entry.key, entry.value, !options.editable, (value) => options.onChange(entry.key, value)))
  }
  card.append(controls)
  container.append(card)
}
