import { canvasFontFamily, isTransparentColor, type StyleTextVisual, type TextVisual, type Visual, type VisualResolver } from "./atlas.ts"
import { IniDocument } from "./ini.ts"
import { gestureDirection } from "./layout.ts"
import { stateStyleValue, stateTipSection } from "./panel-tools.ts"
import type { BdaAnimation, BdaAnimationSequence } from "./bda.ts"

export type PreviewEvent = {
  section: string
  direction: "center" | "hold" | "up" | "down" | "left" | "right"
  code: string
}

type Rect = { x: number; y: number; width: number; height: number }
export type PreviewItem = {
  section: string
  rect: Rect
  touchRect?: Rect
  foreRect?: Rect
  fontSize?: number
  editable: boolean
  show: string
  center: string
  up: string
  down: string
  left: string
  right: string
  hold: string
  backStyle: string
  foreStyle: string
  foreStyles: string[]
  foreOffsets: Array<[number, number] | undefined>
  positionTypes: string[]
  statStyle: string
}

export function previewStateActive(item: PreviewItem, state: number | undefined): boolean {
  return state !== undefined && stateStyleValue(item.statStyle, state) !== undefined
}

export function effectivePreviewItem(
  document: IniDocument,
  item: PreviewItem,
  state?: number,
): PreviewItem {
  const tip = stateTipSection(item.statStyle, state)
  if (tip === undefined) return item
  const section = `TIP${tip}`
  const backStyle = document.get(section, "BACK_STYLE")
  const foreStyle = document.get(section, "FORE_STYLE")
  const positionType = document.get(section, "POS_TYPE")
  const foreStyles = foreStyle === undefined
    ? item.foreStyles
    : foreStyle.split(",").map((token) => token.trim()).filter(Boolean)
  return {
    ...item,
    backStyle: backStyle === undefined ? item.backStyle : backStyle.split(",")[0],
    foreStyle: foreStyles[0] ?? "",
    foreStyles,
    positionTypes: positionType === undefined
      ? item.positionTypes
      : positionType.split(",").map((token) => token.trim()).filter(Boolean),
  }
}

export function animationSequenceForKey(
  animation: BdaAnimation | undefined,
  item: PreviewItem,
): BdaAnimationSequence | undefined {
  if (!animation) return
  const candidates = [item.section, item.center, item.down, `KEY_${item.center}`]
    .map((value) => value.trim().toUpperCase()).filter(Boolean)
  const target = animation.targets.find((value) => candidates.includes(value.toUpperCase()))
  if (target) return animation.sequences.get(target) ?? animation.sequences.get(target.replace(/^KEY_/, ""))
  if (animation.sequences.size === 1) return animation.sequences.values().next().value
}

export function previewBackground(theme: "light" | "dark"): string {
  return theme === "dark" ? "#1c1c1e" : "#d1d4da"
}

export function previewSurfaceColor(theme: "light" | "dark", transparent: boolean): string | undefined {
  return transparent ? undefined : previewBackground(theme)
}

export function shouldDrawItemBackground(
  item: PreviewItem,
  panelStyle: string,
  panelWidth: number,
  panelHeight: number,
): boolean {
  return !(
    item.backStyle === panelStyle &&
    item.rect.x === 0 &&
    item.rect.y === 0 &&
    item.rect.width === panelWidth &&
    item.rect.height === panelHeight
  )
}

export function previewSelectionVisible(mode: "edit" | "preview", selected: boolean): boolean {
  return mode === "edit" && selected
}

export function previewFallbackText(
  item: PreviewItem,
  mode: "edit" | "preview",
  hasForeground: boolean,
): string {
  if (hasForeground) return ""
  return item.show
}

export function foregroundLayerRect(
  key: Rect,
  source: [number, number, number, number] | undefined,
  layer: number,
  offset?: [number, number],
): Rect {
  if (!source) return key
  const [, , width, height] = source
  if (offset) {
    return {
      x: key.x + (key.width - width) / 2 + offset[0],
      y: key.y + (key.height - height) / 2 + offset[1],
      width,
      height,
    }
  }
  if (layer === 0) return key
  return {
    x: key.x + key.width - width - 8,
    y: key.y + 6,
    width,
    height,
  }
}

export function foregroundTextPoint(rect: Rect, offset?: [number, number]): { x: number; y: number } {
  return {
    x: rect.x + rect.width / 2 + (offset?.[0] ?? 0),
    y: rect.y + rect.height / 2 + (offset?.[1] ?? 0),
  }
}

export function phoneForegroundVisual(visual: Visual | undefined): Visual | undefined {
  if (!visual?.image || !visual.source) return
  const { color: _, ...imageVisual } = visual
  return imageVisual
}

export function phoneForegroundLayers(visuals: Array<Visual | undefined>): Array<Visual | undefined> {
  return visuals.map(phoneForegroundVisual)
}

export function isAdditiveSelection(
  event: Pick<MouseEvent, "metaKey" | "ctrlKey" | "shiftKey">,
): boolean {
  return event.metaKey || event.ctrlKey || event.shiftKey
}

function parseRect(value: string | undefined): Rect | undefined {
  const parts = value?.split(",").map(Number)
  if (!parts || parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) return
  const [x, y, width, height] = parts
  return { x, y, width, height }
}

function parseOffset(value: string | undefined): [number, number] | undefined {
  const parts = value?.split(",").map(Number)
  if (!parts || parts.length !== 2 || parts.some((part) => !Number.isFinite(part))) return
  return parts as [number, number]
}

function itemFromSection(document: IniDocument, section: string): PreviewItem | undefined {
  const rect = parseRect(document.get(section, "VIEW_RECT"))
  if (!rect) return
  const value = (name: string) => document.get(section, name) ?? ""
  const foreStyles = value("FORE_STYLE").split(",").map((token) => token.trim()).filter(Boolean)
  return {
    section,
    rect,
    touchRect: parseRect(document.get(section, "TOUCH_RECT")),
    editable: true,
    show: value("SHOW"),
    center: value("CENTER"),
    up: value("UP"),
    down: value("DOWN"),
    left: value("LEFT"),
    right: value("RIGHT"),
    hold: value("HOLD"),
    backStyle: value("BACK_STYLE").split(",")[0],
    foreStyle: foreStyles[0] ?? "",
    foreStyles,
    foreOffsets: value("FORE_OFFSET").split(";").map(parseOffset),
    positionTypes: value("POS_TYPE").split(",").map((token) => token.trim()).filter(Boolean),
    statStyle: value("STAT_STYLE"),
  }
}

function listItems(document: IniDocument, defaults?: IniDocument): PreviewItem[] {
  const value = (name: string) => document.get("LIST", name) ?? defaults?.get("LIST", name)
  const cell = value("CELL_SIZE")?.split(",").map(Number)
  const position = value("POS")?.split(",").map(Number)
  const count = Number(value("LIST_NUM"))
  const names = value("NAMES")?.trim().split(/\s+/) ?? []
  if (
    !cell || cell.length !== 2 || cell.some((value) => !Number.isFinite(value) || value <= 0) ||
    !position || position.length !== 2 || position.some((value) => !Number.isFinite(value)) ||
    !Number.isFinite(count) || count <= 0
  ) return []
  const foreStyles = value("FORE_STYLE")?.split(",").map((token) => token.trim()).filter(Boolean) ?? []
  const cells: PreviewItem[] = names.slice(0, count).map((show, index) => ({
    section: `LIST:${index + 1}`,
    rect: {
      x: position[0],
      y: position[1] + index * cell[1],
      width: cell[0],
      height: cell[1],
    },
    fontSize: Math.min(cell[0], cell[1]) * 0.36,
    editable: false,
    show,
    center: "",
    up: "",
    down: "",
    left: "",
    right: "",
    hold: "",
    backStyle: value("CELL_STYLE")?.split(",")[0] ?? "",
    foreStyle: foreStyles[0] ?? "",
    foreStyles,
    foreOffsets: [],
    positionTypes: [],
    statStyle: "",
  }))
  if (!cells.length) return []
  const backStyle = value("BACK_STYLE")?.split(",")[0]
  if (!backStyle) return cells
  return [{
    ...cells[0],
    section: "LIST:SURFACE",
    rect: {
      x: position[0],
      y: position[1],
      width: cell[0],
      height: cell[1] * count,
    },
    show: "",
    backStyle,
    foreStyle: "",
    foreStyles: [],
  }, ...cells]
}

export function dynamicToolbarRect(
  document: IniDocument,
  panelWidth: number,
  panelHeight: number,
): Rect | undefined {
  const size = document.get("ICON2", "SIZE")?.split(",").map(Number)
  const position = document.get("ICON2", "POS")?.split(",").map(Number)
  const anchor = Number(document.get("ICON2", "ANCHOR_TYPE"))
  if (
    !size || size.length !== 2 || size.some((value) => !Number.isFinite(value) || value <= 0) ||
    !position || position.length !== 2 || position.some((value) => !Number.isFinite(value))
  ) return
  const column = ((anchor - 1) % 3) + 1
  const row = Math.ceil(anchor / 3)
  return {
    x: (column === 2 ? panelWidth / 2 : column === 3 ? panelWidth : 0) + position[0],
    y: (row === 2 ? panelHeight / 2 : row === 3 ? panelHeight : 0) + position[1],
    width: size[0],
    height: size[1],
  }
}

export function previewItems(
  document: IniDocument,
  panelWidth = 1125,
  panelHeight = 133,
  defaults?: IniDocument,
): PreviewItem[] {
  const list = listItems(document, defaults)
  const real = document.sections().flatMap((section) => {
    const item = itemFromSection(document, section)
    return item ? [item] : []
  })
  if (real.length) return [...real, ...list]

  const sections = document.sections().filter((section) =>
    /^(CAND|SWITCH|PANEL|LIST|MORE|ICON\d+|TIP\d+)$/.test(section),
  )
  if (!sections.length) return list
  return [...sections.flatMap((section) => {
    if (/^TIP\d+$/.test(section) || document.get(section, "PERSIST") === "2") return []
    const backStyle = document.get(section, "BACK_STYLE")?.split(",")[0] ?? ""
    const foreStyles = document.get(section, "FORE_STYLE")?.split(",").map((token) => token.trim()).filter(Boolean) ?? []
    const foreStyle = foreStyles[0] ?? ""
    if (section !== "CAND" && (!document.get(section, "SIZE") || (!backStyle && !foreStyle))) return []
    const size = document.get(section, "SIZE")?.split(",").map(Number)
    const width = section === "CAND" ? panelWidth : size?.[0] ?? 0
    const height = section === "CAND" ? panelHeight : size?.[1] ?? 0
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return []
    const position = document.get(section, "POS")?.split(",").map(Number) ?? [0, 0]
    const anchor = Number(document.get(section, "ANCHOR_TYPE"))
    const xAnchor = ((anchor - 1) % 3) + 1
    const yAnchor = Math.ceil(anchor / 3)
    const x = section === "CAND"
      ? 0
      : xAnchor === 2
        ? panelWidth / 2 + (position[0] || 0)
        : xAnchor === 3
          ? panelWidth + (position[0] || 0)
          : position[0] || 0
    const y = section === "CAND"
      ? 0
      : yAnchor === 2
        ? panelHeight / 2 + (position[1] || 0)
        : yAnchor === 3
          ? panelHeight + (position[1] || 0)
          : position[1] || 0
    const fixed = document.get(section, "FIX_SIZE")?.split(",").map(Number)
    const foreRect = fixed?.length === 2 && fixed.every(Number.isFinite)
      ? {
          x: x + (width - fixed[0]) / 2,
          y: y + (height - fixed[1]) / 2,
          width: fixed[0],
          height: fixed[1],
        }
      : undefined
    const value = (name: string) => document.get(section, name) ?? ""
    return [{
      section,
      rect: { x, y, width, height },
      foreRect,
      editable: false,
      show: section === "CAND" ? "" : section,
      center: value("KEY") || value("CENTER"),
      up: value("UP"),
      down: value("DOWN"),
      left: value("LEFT"),
      right: value("RIGHT"),
      hold: value("HOLD"),
      backStyle,
      foreStyle,
      foreStyles,
      foreOffsets: [],
      positionTypes: document.get(section, "POS_TYPE")?.split(",").map((token) => token.trim()).filter(Boolean) ?? [],
      statStyle: value("STAT_STYLE"),
    }]
  }), ...list]
}

export class Preview {
  private readonly canvas: HTMLCanvasElement
  private readonly onEvent: (event: PreviewEvent) => void
  private readonly onSelect: (sections: string[]) => void
  private readonly toolbarSlots: boolean
  private document?: IniDocument
  private defaults?: IniDocument
  private offsets?: IniDocument
  private resolver?: VisualResolver
  private panelStyle = ""
  private panelWidth = 1125
  private panelHeight = 650
  private theme: "light" | "dark" = "light"
  private transparent = false
  private keys: PreviewItem[] = []
  private mode: "edit" | "preview" = "edit"
  private active?: {
    key: PreviewItem
    startX: number
    startY: number
    startedAt: number
  }
  private selected = new Set<string>()
  private selectionAnchor?: string
  private guides = false
  private skinState?: number
  private animation?: BdaAnimation
  private animationVisual?: { key: PreviewItem; visual: Visual }
  private animationTimer?: number
  private drawID = 0

  constructor(
    canvas: HTMLCanvasElement,
    onEvent: (event: PreviewEvent) => void,
    onSelect: (sections: string[]) => void,
    toolbarSlots = false,
    onContextMenu?: (section: string, event: MouseEvent) => void,
  ) {
    this.canvas = canvas
    this.onEvent = onEvent
    this.onSelect = onSelect
    this.toolbarSlots = toolbarSlots
    canvas.addEventListener("pointerdown", (event) => this.pointerDown(event))
    canvas.addEventListener("pointerup", (event) => this.pointerUp(event))
    canvas.addEventListener("contextmenu", (event) => {
      const key = this.hit(this.point(event))
      if (!key || !onContextMenu) return
      event.preventDefault()
      onContextMenu(key.section, event)
    })
    canvas.addEventListener("pointercancel", () => {
      this.active = undefined
      void this.draw()
    })
  }

  setMode(mode: "edit" | "preview"): void {
    this.mode = mode
    this.active = undefined
    this.canvas.style.cursor = mode === "edit" ? "default" : "pointer"
    void this.draw()
  }

  setSelected(sections: readonly string[]): void {
    this.selected = new Set(sections)
    void this.draw()
  }

  setResolver(resolver?: VisualResolver): void {
    this.resolver = resolver
    void this.draw()
  }

  setOffsets(offsets?: IniDocument): void {
    this.offsets = offsets
    void this.draw()
  }

  setDefaults(defaults?: IniDocument): void {
    this.defaults = defaults
    this.keys = this.document
      ? previewItems(this.document, this.panelWidth, this.panelHeight, defaults)
      : []
    this.fitCanvas()
    void this.draw()
  }

  setTheme(theme: "light" | "dark"): void {
    this.theme = theme
    void this.draw()
  }

  setTransparent(transparent: boolean): void {
    this.transparent = transparent
    void this.draw()
  }

  setGuides(enabled: boolean): void {
    this.guides = enabled
    void this.draw()
  }

  setSkinState(state?: number): void {
    this.skinState = state
    void this.draw()
  }

  setAnimation(animation?: BdaAnimation): void {
    this.animation = animation
    this.animationVisual = undefined
    if (this.animationTimer) window.clearTimeout(this.animationTimer)
    void this.draw()
  }

  setPanel(styleID: string, width: number, height: number): void {
    this.panelStyle = styleID
    this.panelWidth = width
    this.panelHeight = height
    this.keys = this.document ? previewItems(this.document, width, height, this.defaults) : []
    this.fitCanvas()
    void this.draw()
  }

  setDocument(document?: IniDocument): void {
    this.document = document
    this.keys = document ? previewItems(document, this.panelWidth, this.panelHeight, this.defaults) : []
    const available = new Set(this.keys.map((key) => key.section))
    this.selected = new Set([...this.selected].filter((section) => available.has(section)))
    this.fitCanvas()
    void this.draw()
  }

  private point(event: Pick<MouseEvent, "clientX" | "clientY">): { x: number; y: number } {
    const bounds = this.canvas.getBoundingClientRect()
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * this.canvas.width,
      y: ((event.clientY - bounds.top) / bounds.height) * this.canvas.height,
    }
  }

  private hit(point: { x: number; y: number }): PreviewItem | undefined {
    return [...this.keys].reverse().find(({ editable, rect, touchRect }) => {
      const target = touchRect ?? rect
      return (
        editable &&
        point.x >= target.x &&
        point.x <= target.x + target.width &&
        point.y >= target.y &&
        point.y <= target.y + target.height
      )
    })
  }

  private pointerDown(event: PointerEvent): void {
    const point = this.point(event)
    const key = this.hit(point)
    if (!key) {
      if (this.mode === "edit") {
        this.selected.clear()
        this.onSelect([])
        void this.draw()
      }
      return
    }
    if (this.mode === "edit" && event.shiftKey && this.selectionAnchor) {
      const sections = this.keys.filter((item) => item.editable).map((item) => item.section)
      const from = sections.indexOf(this.selectionAnchor)
      const to = sections.indexOf(key.section)
      if (from >= 0 && to >= 0) {
        this.selected = new Set(sections.slice(Math.min(from, to), Math.max(from, to) + 1))
      }
    } else if (this.mode === "edit" && isAdditiveSelection(event)) {
      if (this.selected.has(key.section)) this.selected.delete(key.section)
      else this.selected.add(key.section)
    } else if (!this.selected.has(key.section) || this.mode === "preview") {
      this.selected = new Set([key.section])
    }
    if (this.mode === "edit" && !event.shiftKey) this.selectionAnchor = key.section
    this.onSelect([...this.selected])
    if (this.mode === "edit") {
      void this.draw()
      return
    }
    this.canvas.setPointerCapture(event.pointerId)
    this.active = {
      key,
      startX: point.x,
      startY: point.y,
      startedAt: Date.now(),
    }
    void this.playAnimation(key)
    void this.draw()
  }

  private async playAnimation(key: PreviewItem): Promise<void> {
    const sequence = animationSequenceForKey(this.animation, key)
    if (!sequence?.frames.length || !this.resolver?.resolveResource) return
    if (this.animationTimer) window.clearTimeout(this.animationTimer)
    const play = async (index: number) => {
      const frame = sequence.frames[index]
      if (!frame) {
        this.animationVisual = undefined
        void this.draw()
        return
      }
      const visual = await this.resolver?.resolveResource?.(frame.resourceID)
      if (!visual) return
      this.animationVisual = { key, visual }
      void this.draw()
      this.animationTimer = window.setTimeout(() => void play(index + 1), Math.max(16, frame.duration))
    }
    await play(0)
  }

  private pointerUp(event: PointerEvent): void {
    if (!this.active) return
    const point = this.point(event)
    const { key, startX, startY, startedAt } = this.active
    const dx = point.x - startX
    const dy = point.y - startY
    const direction = gestureDirection(dx, dy, Date.now() - startedAt, Boolean(key.hold))
    const code = key[direction]
    this.onEvent({ section: key.section, direction, code })
    this.active = undefined
    void this.draw()
  }

  private fitCanvas(): void {
    const width = Math.ceil(this.panelWidth)
    const height = Math.ceil(this.panelHeight)
    if (this.canvas.width !== width) this.canvas.width = width
    if (this.canvas.height !== height) this.canvas.height = height
  }

  private drawNineSlice(
    context: CanvasRenderingContext2D,
    visual: Visual,
    destination: Rect,
  ): void {
    if (!visual.image || !visual.source || !visual.inner) return
    const [sx, sy, sw, sh] = visual.source
    const [ix, iy, iw, ih] = visual.inner
    const xs = [0, ix, ix + iw, sw]
    const ys = [0, iy, iy + ih, sh]
    const dx = [
      destination.x,
      destination.x + ix,
      destination.x + destination.width - (sw - ix - iw),
      destination.x + destination.width,
    ]
    const dy = [
      destination.y,
      destination.y + iy,
      destination.y + destination.height - (sh - iy - ih),
      destination.y + destination.height,
    ]
    for (let row = 0; row < 3; row++) {
      for (let column = 0; column < 3; column++) {
        const sourceWidth = xs[column + 1] - xs[column]
        const sourceHeight = ys[row + 1] - ys[row]
        const targetWidth = dx[column + 1] - dx[column]
        const targetHeight = dy[row + 1] - dy[row]
        if (sourceWidth <= 0 || sourceHeight <= 0 || targetWidth <= 0 || targetHeight <= 0) continue
        context.drawImage(
          visual.image,
          sx + xs[column],
          sy + ys[row],
          sourceWidth,
          sourceHeight,
          dx[column],
          dy[row],
          targetWidth,
          targetHeight,
        )
      }
    }
  }

  private drawVisual(
    context: CanvasRenderingContext2D,
    visual: Visual | undefined,
    destination: Rect,
    stretch: boolean,
  ): void {
    if (!visual) return
    if (visual.color && !isTransparentColor(visual.color)) {
      context.fillStyle = visual.color
      context.fillRect(destination.x, destination.y, destination.width, destination.height)
    }
    if (!visual.image || !visual.source) return
    if (stretch && visual.inner) {
      this.drawNineSlice(context, visual, destination)
      return
    }
    const [sx, sy, sw, sh] = visual.source
    if (stretch) {
      context.drawImage(
        visual.image,
        sx,
        sy,
        sw,
        sh,
        destination.x,
        destination.y,
        destination.width,
        destination.height,
      )
    } else {
      context.drawImage(
        visual.image,
        sx,
        sy,
        sw,
        sh,
        destination.x + (destination.width - sw) / 2,
        destination.y + (destination.height - sh) / 2,
        sw,
        sh,
      )
    }
  }

  private async draw(): Promise<void> {
    const drawID = ++this.drawID
    const keys = this.keys.map((key) =>
      this.document ? effectivePreviewItem(this.document, key, this.skinState) : key,
    )
    const [panel, visuals, toolbarImages] = await Promise.all([
      this.resolver?.resolve(this.panelStyle, false),
      Promise.all(keys.map(async (key) => {
        const highlighted = this.active?.key.section === key.section
        return {
          back: await this.resolver?.resolve(key.backStyle, highlighted),
          fore: await Promise.all(
            key.foreStyles.map((style) => this.resolver?.resolve(style, highlighted)),
          ),
          text: this.resolver?.resolveText(key.foreStyles.join(","), highlighted),
          styleTexts: key.foreStyles.map((style) =>
            this.resolver?.resolveStyleText?.(style, highlighted)
          ),
        }
      })),
      this.toolbarSlots
        ? this.resolver?.resolveToolbarImages() ?? Promise.resolve([])
        : Promise.resolve([]),
    ])
    if (drawID !== this.drawID) return
    const context = this.canvas.getContext("2d")
    if (!context) return
    context.clearRect(0, 0, this.canvas.width, this.canvas.height)
    const surfaceColor = previewSurfaceColor(this.theme, this.transparent)
    if (surfaceColor) {
      context.fillStyle = surfaceColor
      context.fillRect(0, 0, this.canvas.width, this.canvas.height)
    }
    this.drawVisual(
      context,
      panel,
      { x: 0, y: 0, width: this.canvas.width, height: this.canvas.height },
      true,
    )

    for (const [index, key] of keys.entries()) {
      const active = this.active?.key.section === key.section
      const selected = previewSelectionVisible(this.mode, this.selected.has(key.section))
      const foregrounds = phoneForegroundLayers(visuals[index].fore)
      const styleTexts = visuals[index].styleTexts
      const hasForeground = foregrounds.some(Boolean) || styleTexts.some(Boolean)
      if (shouldDrawItemBackground(key, this.panelStyle, this.panelWidth, this.panelHeight)) {
        this.drawVisual(context, visuals[index].back, key.rect, true)
      }
      for (const [layer, fore] of foregrounds.entries()) {
        const offset = key.foreOffsets[layer] ?? parseOffset(
          this.offsets?.get(`OFFSET${key.positionTypes[layer] ?? ""}`, "POS"),
        )
        const destination = key.foreRect ?? foregroundLayerRect(key.rect, fore?.source, layer, offset)
        this.drawVisual(context, fore, destination, false)
      }

      for (const [layer, styleText] of styleTexts.entries()) {
        if (!styleText || foregrounds[layer]) continue
        const offset = key.foreOffsets[layer] ?? parseOffset(
          this.offsets?.get(`OFFSET${key.positionTypes[layer] ?? ""}`, "POS"),
        )
        const point = foregroundTextPoint(key.foreRect ?? key.rect, offset)
        this.drawStyleText(context, styleText, point)
      }

      if (selected) {
        context.strokeStyle = "#087ff5"
        context.lineWidth = 4
        context.strokeRect(key.rect.x + 2, key.rect.y + 2, key.rect.width - 4, key.rect.height - 4)
      }

      const textVisual: TextVisual | undefined = visuals[index].text
      context.fillStyle = textVisual?.color ?? (this.theme === "dark" ? "#f5f5f7" : "#17191c")
      const fontSize =
        key.fontSize ?? textVisual?.fontSize ?? Math.max(18, Math.min(42, key.rect.height * 0.25))
      const fontWeight = textVisual?.fontWeight ? `${textVisual.fontWeight} ` : ""
      context.font = `${fontWeight}${fontSize}px ${canvasFontFamily(textVisual?.fontName)}`
      context.textAlign = "center"
      context.textBaseline = "middle"
      const fallbackText = previewFallbackText(key, this.mode, hasForeground)
      if (fallbackText) {
        context.fillText(
          fallbackText,
          key.rect.x + key.rect.width / 2,
          key.rect.y + key.rect.height / 2,
        )
      }

    }

    if (this.animationVisual) {
      this.drawVisual(context, this.animationVisual.visual, this.animationVisual.key.rect, false)
    }

    const toolbarRect = this.document
      ? dynamicToolbarRect(this.document, this.panelWidth, this.panelHeight)
      : undefined
    if (toolbarRect && toolbarImages.length) {
      const slotWidth = toolbarRect.width / toolbarImages.length
      toolbarImages.forEach((visual, index) => {
        this.drawVisual(context, visual, {
          x: toolbarRect.x + index * slotWidth,
          y: toolbarRect.y,
          width: slotWidth,
          height: toolbarRect.height,
        }, false)
      })
    }

    if (this.guides) {
      context.save()
      context.setLineDash([7, 5])
      context.lineWidth = 1.5
      context.font = "15px system-ui"
      context.textAlign = "left"
      context.textBaseline = "top"
      for (const key of this.keys) {
        context.strokeStyle = this.selected.has(key.section) ? "#087ff5" : "#ef3e52"
        context.fillStyle = context.strokeStyle
        context.strokeRect(key.rect.x + 0.75, key.rect.y + 0.75, key.rect.width - 1.5, key.rect.height - 1.5)
        context.fillText(key.section, key.rect.x + 4, key.rect.y + 4)
      }
      context.restore()
    }
  }

  private drawStyleText(
    context: CanvasRenderingContext2D,
    visual: StyleTextVisual,
    point: { x: number; y: number },
  ): void {
    context.fillStyle = visual.color ?? (this.theme === "dark" ? "#f5f5f7" : "#17191c")
    const weight = visual.fontWeight ? `${visual.fontWeight} ` : ""
    context.font = `${weight}${visual.fontSize ?? 24}px ${canvasFontFamily(visual.fontName)}`
    context.textAlign = "center"
    context.textBaseline = "middle"
    context.fillText(visual.text, point.x, point.y)
  }
}
