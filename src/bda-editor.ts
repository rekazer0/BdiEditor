import type { Visual, VisualResolver } from "./atlas.ts"
import {
  bdaColorHex,
  bdaStyleID,
  decodeBdaAnimation,
  decodeBdaAppearance,
  decodeBdaSoundConfig,
  type BdaAppearance,
  type BdaAnimationFrame,
  type BdaKey,
  type BdaStyleRef,
} from "./bda.ts"

export type BdaStyleChange = (ref: BdaStyleRef, property: string, value: string) => void

type LayoutEditorOptions = {
  appearance: BdaAppearance
  panelName: string
  keys: Array<{ name: string; key: BdaKey }>
  resolver?: VisualResolver
  editable: boolean
  onStyleChange: BdaStyleChange
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
  canvas.width = 128 * scale
  canvas.height = 76 * scale
  const context = canvas.getContext("2d")!
  context.scale(scale, scale)
  context.clearRect(0, 0, 128, 76)
  if (visual?.color) {
    context.fillStyle = visual.color
    context.fillRect(8, 8, 112, 60)
  }
  if (!visual?.image) return
  const source = visual.source ?? [0, 0, visual.image.width, visual.image.height]
  const ratio = Math.min(112 / source[2], 60 / source[3])
  const width = source[2] * ratio
  const height = source[3] * ratio
  context.drawImage(
    visual.image,
    source[0], source[1], source[2], source[3],
    64 - width / 2, 38 - height / 2, width, height,
  )
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

function stylePreview(ref: BdaStyleRef, resolver: VisualResolver | undefined): HTMLElement {
  const preview = element("div", "bda-style-preview")
  for (const [highlighted, label] of [[false, "正常"], [true, "按下"]] as const) {
    const state = element("figure")
    const canvas = element("canvas")
    const caption = element("figcaption")
    caption.textContent = label
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

function styleCard(
  ref: BdaStyleRef,
  label: string,
  appearance: BdaAppearance,
  resolver: VisualResolver | undefined,
  editable: boolean,
  onChange: BdaStyleChange,
): HTMLElement | undefined {
  const card = element("article", "bda-style-card")
  card.append(heading(label, `${ref.type} · ${ref.key}`), stylePreview(ref, resolver))
  const controls = element("div", "bda-style-controls")
  if (ref.type === "image") {
    const style = appearance.imageStyles.get(ref.key)
    if (!style) return
    if (style.normalImage?.resource) {
      controls.append(textField("正常图片", style.normalImage.resource.resourceID, !editable, (value) => onChange(ref, "NM_IMG", value)))
    }
    if (style.highlightImage?.resource) {
      controls.append(textField("按下图片", style.highlightImage.resource.resourceID, !editable, (value) => onChange(ref, "HL_IMG", value)))
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
  }
  if (controls.childElementCount) card.append(controls)
  return card
}

export function renderBdaLayoutEditor(container: HTMLElement, options: LayoutEditorOptions): void {
  container.replaceChildren()
  const panel = options.appearance.panels.get(options.panelName.replace(/\.ini$/i, ""))
  if (!panel) return
  const refs: Array<{ ref: BdaStyleRef; label: string }> = []
  if (options.keys.length) {
    for (const { name, key } of options.keys) {
      if (key.backStyle) refs.push({ ref: key.backStyle, label: `${name} · 背景` })
      key.foreStyles.forEach((ref, index) => refs.push({ ref, label: `${name} · 前景 ${index + 1}` }))
      if (key.backStyleState) refs.push({ ref: key.backStyleState, label: `${name} · 状态背景` })
    }
  } else {
    if (panel.wholeBackStyle) refs.push({ ref: panel.wholeBackStyle, label: "面板整体背景" })
    if (panel.backStyle) refs.push({ ref: panel.backStyle, label: "面板背景" })
    if (panel.inputRegionBackStyle) refs.push({ ref: panel.inputRegionBackStyle, label: "输入区背景" })
  }
  const unique = [...new Map(refs.map((item) => [`${item.ref.type}:${item.ref.key}`, item])).values()]
  const summary = element("div", "bda-editor-summary")
  summary.append(heading(options.keys.length ? `已选 ${options.keys.length} 个 BDA 按键` : options.panelName.replace(/\.ini$/i, ""), `${unique.length} 个实际样式引用`))
  container.append(summary)
  for (const item of unique) {
    const card = styleCard(item.ref, item.label, options.appearance, options.resolver, options.editable, options.onStyleChange)
    if (card) container.append(card)
  }
  if (!unique.length) {
    const empty = element("p", "bda-editor-empty")
    empty.textContent = "当前对象没有可编辑的 BDA 样式字段。"
    container.append(empty)
  }
}

export function renderBdaConfigEditor(container: HTMLElement, options: ConfigEditorOptions): void {
  container.replaceChildren()
  const name = options.path.split("/").pop() ?? options.path
  if (/^\d*appearanceConfig$/i.test(name)) {
    const appearance = decodeBdaAppearance(options.bytes)
    const summary = element("div", "bda-editor-summary")
    summary.append(heading("外观配置", `${appearance.panels.size} 个布局 · ${appearance.imageStyles.size + appearance.textStyles.size + appearance.colorStyles.size} 个样式`))
    if (appearance.designWidth !== undefined) {
      summary.append(rangeField("设计宽度", appearance.designWidth, 320, 2160, !options.editable, options.onDesignWidth))
    }
    const panels = element("div", "bda-panel-list")
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
    for (const sequence of animation.sequences.values()) {
      const card = element("article", "bda-animation-card")
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
    return
  }
  if (/^\d*soundConfig$/i.test(name)) {
    const sound = decodeBdaSoundConfig(options.bytes)
    const list = element("div", "bda-sound-list")
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
  const card = element("article", "bda-metadata-card")
  card.append(heading("皮肤信息", `${options.entries.length} 个实际字段`))
  const controls = element("div", "bda-style-controls")
  for (const entry of options.entries) {
    controls.append(textField(labels[entry.key] ?? entry.key, entry.value, !options.editable, (value) => options.onChange(entry.key, value)))
  }
  card.append(controls)
  container.append(card)
}
