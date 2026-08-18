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
  sections: string[]
  rect: Rect
  touchRect?: Rect
  foreRect?: Rect
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
  animStyle?: string
  backAnimStyle?: string
  foreAnimStyle?: string
  foreAnimStyles: string[]
}

type LegacyAnimationFrame = {
  type: "opacity" | "translate" | "scale"
  start: number
  duration: number
  delay: number
  repeat: number
  reverse: boolean
  easing: readonly [number, number]
  from: readonly [number, number]
  to: readonly [number, number]
}

export type LegacyAnimation = Map<string, LegacyAnimationFrame[]>

function animationEasing(type: number, progress: number): number {
  if (type === 1) return progress * progress
  if (type === 2) return 1 - (1 - progress) ** 2
  if (type === 3) return Math.cos((progress + 1) * Math.PI) / 2 + 0.5
  if (type === 4) {
    const bounce = (value: number) => value * value * 8
    const value = progress * 1.1226
    if (value < 0.3535) return bounce(value)
    if (value < 0.7408) return bounce(value - 0.54719) + 0.7
    if (value < 0.9644) return bounce(value - 0.8526) + 0.9
    return bounce(value - 1.0435) + 0.95
  }
  return progress
}

function animationDuration(frame: LegacyAnimationFrame): number {
  return frame.duration * frame.repeat * (frame.reverse ? 2 : 1)
}

function scalePair(value: string | undefined): [number, number] | undefined {
  const parts = value?.split(",").map(Number)
  if (!parts || parts.length < 2 || parts.some((part) => !Number.isFinite(part))) return
  return [parts[0] / 100, parts[1] / 100]
}

function pixelPair(value: string | undefined): [number, number] | undefined {
  const parts = value?.split(",").map(Number)
  if (!parts || parts.length < 2 || parts.some((part) => !Number.isFinite(part))) return
  return [parts[0], parts[1]]
}

function opacityPair(value: string | undefined): [number, number] | undefined {
  const number = Number(value)
  if (!Number.isFinite(number)) return
  const opacity = Math.max(0, Math.min(1, number / 255))
  return [opacity, opacity]
}

export function parseLegacyAnimation(
  styles: IniDocument,
  animations: IniDocument,
): LegacyAnimation {
  const result: LegacyAnimation = new Map()
  for (const section of styles.sections()) {
    const styleID = section.match(/^STYLE(.+)$/)?.[1]
    const animationID = styles.get(section, "PRESS_ANIM") ?? styles.get(section, "SHOW_ANIM")
    if (!styleID || !animationID) continue
    const build = `ANIM${animationID}`
    const ids = (animations.get(build, "BUILD_LIST") ?? animationID)
      .split(",").map((value) => value.trim()).filter(Boolean)
    const parallel = animations.get(build, "BUILD_METHOD") === "0"
    let start = 0
    const frames = ids.flatMap((id) => {
      const frame = `ANIM${id}`
      const type = animations.get(frame, "TYPE")
      const from = type === "0"
        ? opacityPair(animations.get(frame, "FROM"))
        : type === "2"
          ? pixelPair(animations.get(frame, "FROM_PX") ?? animations.get(frame, "FROM"))
          : scalePair(animations.get(frame, "FROM"))
      const to = type === "0"
        ? opacityPair(animations.get(frame, "TO"))
        : type === "2"
          ? pixelPair(animations.get(frame, "TO_PX") ?? animations.get(frame, "TO"))
          : scalePair(animations.get(frame, "TO"))
      if (!["0", "2", "3", "4"].includes(type ?? "") || !from || !to) return []
      const duration = Math.max(0, Number(animations.get(frame, "DURATION")) || 0)
      const delay = Math.max(0, Number(animations.get(frame, "DELAY")) || 0)
      const repeat = Math.max(1, Number(animations.get(frame, "REPEAT_CNT")) || 1)
      const reverse = animations.get(frame, "REPEAT_MODE") === "1"
      const easingValues = (animations.get(frame, "INTPOL") ?? "0")
        .split(",").map((value) => Number(value.trim()) || 0)
      const parsed = {
        type: type === "0" ? "opacity" as const : type === "2" ? "translate" as const : "scale" as const,
        start: parallel ? 0 : start,
        duration,
        delay,
        repeat,
        reverse,
        easing: [easingValues[0] ?? 0, easingValues[1] ?? easingValues[0] ?? 0] as const,
        from,
        to,
      }
      if (!parallel) start += delay + animationDuration(parsed)
      return [parsed]
    })
    if (frames.length) result.set(styleID, frames)
  }
  return result
}

export const parseLegacyScaleAnimation = parseLegacyAnimation

function legacyAnimationPair(
  animation: LegacyAnimation | undefined,
  styleID: string | undefined,
  elapsed: number,
  type: "opacity" | "translate" | "scale",
): readonly [number, number] | undefined {
  const frames = styleID ? animation?.get(styleID) : undefined
  if (!frames) return
  const total = Math.max(...frames.map((frame) => frame.start + frame.delay + animationDuration(frame)))
  if (elapsed > total) return
  let previous: (typeof frames)[number] | undefined
  for (const frame of frames.filter((frame) => frame.type === type)) {
    const start = frame.start + frame.delay
    const duration = animationDuration(frame)
    const end = start + duration
    if (elapsed < start) return previous ? (previous.reverse ? previous.from : previous.to) : frame.from
    if (elapsed <= end) {
      let progress = duration ? (elapsed - start) / duration : 1
      if (progress < 1 && frame.repeat > 1) progress = (progress * frame.repeat) % 1
      if (frame.reverse) {
        progress *= 2
        if (progress > 1) progress = 2 - progress
      }
      const x = animationEasing(frame.easing[0], progress)
      const y = animationEasing(frame.easing[1], progress)
      return [
        frame.from[0] + (frame.to[0] - frame.from[0]) * x,
        frame.from[1] + (frame.to[1] - frame.from[1]) * y,
      ]
    }
    previous = frame
  }
  return previous ? (previous.reverse ? previous.from : previous.to) : undefined
}

export function legacyAnimationScale(
  animation: LegacyAnimation | undefined,
  styleID: string | undefined,
  elapsed: number,
): readonly [number, number] | undefined {
  return legacyAnimationPair(animation, styleID, elapsed, "scale")
}

export function legacyAnimationTranslation(
  animation: LegacyAnimation | undefined,
  styleID: string | undefined,
  elapsed: number,
): readonly [number, number] | undefined {
  return legacyAnimationPair(animation, styleID, elapsed, "translate")
}

export function legacyAnimationOpacity(
  animation: LegacyAnimation | undefined,
  styleID: string | undefined,
  elapsed: number,
): number | undefined {
  return legacyAnimationPair(animation, styleID, elapsed, "opacity")?.[0]
}

export function previewStateActive(item: PreviewItem, state: number | undefined): boolean {
  return state !== undefined && stateStyleValue(item.statStyle, state) !== undefined
}

function duplicateKeySignature(item: PreviewItem): string | undefined {
  if (!item.editable || !/^KEY\d+$/i.test(item.section)) return
  const actions = [item.show, item.center, item.up, item.down, item.left, item.right, item.hold]
  if (!actions.some(Boolean)) return
  return [item.rect.x, item.rect.y, item.rect.width, item.rect.height, ...actions].join("\u0000")
}

export function visiblePreviewItems(
  items: readonly PreviewItem[],
  state?: number,
): PreviewItem[] {
  const groups = new Map<string, PreviewItem[]>()
  for (const item of items) {
    const signature = duplicateKeySignature(item)
    if (signature) groups.set(signature, [...(groups.get(signature) ?? []), item])
  }
  const handled = new Set<PreviewItem>()
  const visible: PreviewItem[] = []
  for (const item of items) {
    if (handled.has(item)) continue
    const signature = duplicateKeySignature(item)
    const group = signature ? groups.get(signature) ?? [item] : [item]
    const stateGroup = group.filter((candidate) => candidate.statStyle)
    const fallbackGroup = group.filter((candidate) => !candidate.statStyle)
    if (stateGroup.length && fallbackGroup.length) {
      group.forEach((candidate) => handled.add(candidate))
      const selected = stateGroup.find((candidate) =>
        stateStyleValue(candidate.statStyle, state ?? 0) !== undefined
      ) ?? fallbackGroup[0] ?? stateGroup[0]
      visible.push({
        ...selected,
        sections: group.flatMap((candidate) => candidate.sections),
      })
    } else {
      handled.add(item)
      visible.push(item)
    }
  }
  return visible
}

export function effectivePreviewItem(
  document: IniDocument,
  item: PreviewItem,
  state?: number,
): PreviewItem {
  const tip = stateTipSection(item.statStyle, state)
  if (tip === undefined) return item
  const section = `TIP${tip}`
  if (!/^ICON\d+$/i.test(item.section)) {
    const value = (name: string): string | undefined => document.get(section, name)
    const backStyle = value("BACK_STYLE")
    const foreStyle = value("FORE_STYLE")
    const positionType = value("POS_TYPE")
    const foreOffset = value("FORE_OFFSET")
    const foreAnimStyle = value("FORE_ANIM_STYLE")
    const backAnimStyle = value("BACK_ANIM_STYLE")
    const animStyle = value("ANIM_STYLE")
    const foreStyles = foreStyle === undefined
      ? item.foreStyles
      : foreStyle.split(",").map((token) => token.trim()).filter(Boolean)
    return {
      ...item,
      show: value("SHOW") ?? item.show,
      center: value("CENTER") ?? item.center,
      up: value("UP") ?? item.up,
      down: value("DOWN") ?? item.down,
      left: value("LEFT") ?? item.left,
      right: value("RIGHT") ?? item.right,
      hold: value("HOLD") ?? item.hold,
      backStyle: backStyle === undefined ? item.backStyle : backStyle.split(",")[0],
      foreStyle: foreStyles[0] ?? "",
      foreStyles,
      foreOffsets: foreOffset === undefined
        ? item.foreOffsets
        : foreOffset.split(";").map(parseOffset),
      positionTypes: positionType === undefined
        ? item.positionTypes
        : positionType.split(",").map((token) => token.trim()).filter(Boolean),
      animStyle: animStyle ?? item.animStyle,
      backAnimStyle: backAnimStyle ?? item.backAnimStyle,
      foreAnimStyle: foreAnimStyle === undefined
        ? item.foreAnimStyle
        : foreAnimStyle.split(",")[0],
      foreAnimStyles: foreAnimStyle === undefined
        ? item.foreAnimStyles
        : foreAnimStyle.split(",").map((token) => token.trim()).filter(Boolean),
    }
  }
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

export function isFullPanelPreviewItem(
  item: Pick<PreviewItem, "rect">,
  panelWidth: number,
  panelHeight: number,
): boolean {
  return item.rect.x === 0 && item.rect.y === 0 &&
    item.rect.width === panelWidth && item.rect.height === panelHeight
}

export function shouldDrawItemBackground(
  item: PreviewItem,
  panelStyle: string,
  panelWidth: number,
  panelHeight: number,
): boolean {
  return !(item.backStyle === panelStyle && isFullPanelPreviewItem(item, panelWidth, panelHeight))
}

export function previewHitItem(
  items: readonly PreviewItem[],
  point: { x: number; y: number },
  mode: "edit" | "preview",
  panelWidth: number,
  panelHeight: number,
  state?: number,
): PreviewItem | undefined {
  let best: PreviewItem | undefined
  let fallback: PreviewItem | undefined
  for (const item of [...visiblePreviewItems(items, state)].reverse()) {
    if (!item.editable) continue
    const target = previewHitRect(item, mode)
    if (
      point.x < target.x ||
      point.x > target.x + target.width ||
      point.y < target.y ||
      point.y > target.y + target.height
    ) continue
    if (isFullPanelPreviewItem(item, panelWidth, panelHeight)) {
      fallback ??= item
      continue
    }
    const area = item.rect.width * item.rect.height
    const bestArea = best ? best.rect.width * best.rect.height : Infinity
    if (area < bestArea) best = item
  }
  return best ?? fallback
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
  offset?: [number, number],
): Rect {
  if (!source || !offset) return key
  const [, , width, height] = source
  return {
    x: key.x + (key.width - width) / 2 + offset[0],
    y: key.y + (key.height - height) / 2 + offset[1],
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

export function isTouchLongPress(pointerType: string, duration: number, distance: number): boolean {
  return pointerType === "touch" && duration >= 450 && distance <= 12
}

export function previewHitRect(item: PreviewItem, mode: "edit" | "preview"): Rect {
  if (mode === "edit" || !item.touchRect) return item.rect
  const x = Math.min(item.rect.x, item.touchRect.x)
  const y = Math.min(item.rect.y, item.touchRect.y)
  const right = Math.max(item.rect.x + item.rect.width, item.touchRect.x + item.touchRect.width)
  const bottom = Math.max(item.rect.y + item.rect.height, item.touchRect.y + item.touchRect.height)
  return { x, y, width: right - x, height: bottom - y }
}

function parseRect(value: string | undefined): Rect | undefined {
  const parts = value?.split(",").map(Number)
  if (!parts || parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) return
  const [x, y, width, height] = parts
  if (width <= 0 || height <= 0) return
  return { x, y, width, height }
}

function parseOffset(value: string | undefined): [number, number] | undefined {
  const parts = value?.split(",").map(Number)
  if (!parts || parts.length !== 2 || parts.some((part) => !Number.isFinite(part))) return
  return parts as [number, number]
}

// gen.ini 的 OFFSET 段既有 POS=x,y 也有 R_POS=x,y（部分 Android 皮肤）。
// 两者同义，解析时优先 POS、回退 R_POS。
export function offsetFromSection(document: IniDocument | undefined, section: string): [number, number] | undefined {
  if (!document) return
  return parseOffset(
    document.get(section, "POS") ?? document.get(section, "R_POS"),
  )
}

function itemFromSection(document: IniDocument, section: string): PreviewItem | undefined {
  const rect = parseRect(document.get(section, "VIEW_RECT"))
  if (!rect) return
  const value = (name: string) => document.get(section, name) ?? ""
  const foreStyles = value("FORE_STYLE").split(",").map((token) => token.trim()).filter(Boolean)
  return {
    section,
    sections: [section],
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
    animStyle: value("ANIM_STYLE"),
    backAnimStyle: value("BACK_ANIM_STYLE"),
    foreAnimStyle: value("FORE_ANIM_STYLE").split(",")[0],
    foreAnimStyles: value("FORE_ANIM_STYLE").split(",").map((token) => token.trim()).filter(Boolean),
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
  // 每个标点只负责文字渲染，不可单独选中
  const cells: PreviewItem[] = names.slice(0, count).map((show, index) => ({
    section: `LIST:${index + 1}`,
    sections: [`LIST:${index + 1}`],
    rect: {
      x: position[0],
      y: position[1] + index * cell[1],
      width: cell[0],
      height: cell[1],
    },
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
    foreAnimStyles: [],
  }))
  // 整个候选栏是一个可选中按钮
  const bar: PreviewItem = {
    section: "LIST",
    sections: ["LIST"],
    rect: {
      x: position[0],
      y: position[1],
      width: cell[0],
      height: cell[1] * count,
    },
    editable: true,
    show: "",
    center: "",
    up: "",
    down: "",
    left: "",
    right: "",
    hold: "",
    backStyle: value("BACK_STYLE")?.split(",")[0] ?? "",
    foreStyle: "",
    foreStyles: [],
    foreOffsets: [],
    positionTypes: [],
    statStyle: "",
    foreAnimStyles: [],
  }
  return [bar, ...cells]
}

export function dynamicToolbarRect(
  document: IniDocument,
  panelWidth: number,
  panelHeight: number,
): Rect | undefined {
  const section = document.sections().find((name) =>
    /^ICON\d+$/i.test(name) && document.get(name, "KEY")?.trim().toUpperCase() === "F14"
  )
  if (!section) return
  const size = document.get(section, "SIZE")?.split(",").map(Number)
  const position = document.get(section, "POS")?.split(",").map(Number)
  const anchor = Number(document.get(section, "ANCHOR_TYPE"))
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
    if (/^TIP\d+$/i.test(section)) return []
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
      sections: [section],
      rect: { x, y, width, height },
      foreRect,
      editable: false,
      show: document.get(section, "SHOW") ?? "",
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
      animStyle: value("ANIM_STYLE"),
      foreAnimStyles: [],
    }]
  }), ...list]
}

export function previewContentVerticalBounds(
  items: readonly Pick<PreviewItem, "rect">[],
  panelWidth: number,
  panelHeight: number,
): { top: number; height: number } {
  const content = items.filter(({ rect }) =>
    rect.width > 0 && rect.height > 0 &&
    !(rect.x <= 0 && rect.y <= 0 && rect.width >= panelWidth && rect.height >= panelHeight),
  )
  if (!content.length) return { top: 0, height: panelHeight }
  const top = Math.max(0, Math.min(...content.map(({ rect }) => rect.y)))
  const bottom = Math.max(...content.map(({ rect }) => rect.y + rect.height))
  return { top, height: Math.max(1, bottom - top) }
}

export class Preview {
  private readonly canvas: HTMLCanvasElement
  private readonly onEvent: (event: PreviewEvent) => void
  private readonly onSelect: (sections: string[]) => void
  private readonly onMove: (sections: string[], deltaX: number, deltaY: number) => void
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
  private editTool: "select" | "move" = "select"
  private editDrag?: {
    pointerId: number
    startX: number
    startY: number
    original: Map<string, Rect>
  }
  private editTouch?: {
    pointerId: number
    pointerType: string
    key: PreviewItem
    startX: number
    startY: number
    clientX: number
    clientY: number
    startedAt: number
    longPress: boolean
    longPressTimer?: number
  }
  private active?: {
    key: PreviewItem
    startX: number
    startY: number
    startedAt: number
  }
  private selected = new Set<string>()
  private mobileMultiSelect = false
  private selectionAnchor?: string
  private guides = false
  private skinState?: number
  private animation?: BdaAnimation
  private animationVisual?: { key: PreviewItem; visual: Visual }
  private animationTimer?: number
  private legacyAnimation?: LegacyAnimation
  private legacyAnimationState?: { key: PreviewItem; startedAt: number }
  private legacyAnimationTimer?: number
  private drawID = 0

  constructor(
    canvas: HTMLCanvasElement,
    onEvent: (event: PreviewEvent) => void,
    onSelect: (sections: string[]) => void,
    toolbarSlots = false,
    onMove: (sections: string[], deltaX: number, deltaY: number) => void = () => {},
  ) {
    this.canvas = canvas
    this.onEvent = onEvent
    this.onSelect = onSelect
    this.onMove = onMove
    this.toolbarSlots = toolbarSlots
    canvas.addEventListener("pointerdown", (event) => this.pointerDown(event))
    canvas.addEventListener("pointermove", (event) => this.pointerMove(event))
    canvas.addEventListener("pointerup", (event) => this.pointerUp(event))
    canvas.addEventListener("contextmenu", (event) => event.preventDefault())
    canvas.addEventListener("pointercancel", () => {
      this.active = undefined
      this.cancelEditTouch()
      this.cancelEditDrag()
      this.updateCursor()
      void this.draw()
    })
  }

  setMode(mode: "edit" | "preview"): void {
    this.mode = mode
    this.mobileMultiSelect = false
    this.active = undefined
    this.cancelEditTouch()
    this.cancelEditDrag()
    this.updateCursor()
    void this.draw()
  }

  cancelPointerInteraction(): void {
    this.active = undefined
    this.cancelEditTouch()
    this.cancelEditDrag()
    this.updateCursor()
    void this.draw()
  }

  setEditTool(tool: "select" | "move"): void {
    this.editTool = tool
    this.cancelEditTouch()
    this.cancelEditDrag()
    this.updateCursor()
    void this.draw()
  }

  setSelected(sections: readonly string[]): void {
    this.selected = new Set(sections)
    if (!sections.length) this.mobileMultiSelect = false
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

  expandSections(sections: readonly string[]): string[] {
    const requested = new Set(sections)
    return visiblePreviewItems(this.keys, this.skinState).flatMap((item) =>
      item.sections.some((section) => requested.has(section)) ? item.sections : []
    )
  }

  setAnimation(animation?: BdaAnimation): void {
    this.animation = animation
    this.animationVisual = undefined
    if (this.animationTimer) window.clearTimeout(this.animationTimer)
    void this.draw()
  }

  setLegacyAnimation(animation?: LegacyAnimation): void {
    this.legacyAnimation = animation
    this.legacyAnimationState = undefined
    if (this.legacyAnimationTimer) window.cancelAnimationFrame(this.legacyAnimationTimer)
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
    return previewHitItem(
      this.keys,
      point,
      this.mode,
      this.panelWidth,
      this.panelHeight,
      this.skinState,
    )
  }

  private itemSelected(item: PreviewItem): boolean {
    return item.sections.some((section) => this.selected.has(section))
  }

  private pointerDown(event: PointerEvent): void {
    const point = this.point(event)
    const key = this.hit(point)
    if (!key) {
      if (this.mode === "edit") {
        this.selected.clear()
        this.mobileMultiSelect = false
        this.onSelect([])
        void this.draw()
      }
      return
    }
    if (this.mode === "edit" && this.editTool === "select" && event.pointerType === "touch") {
      this.editTouch = {
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        key,
        startX: point.x,
        startY: point.y,
        clientX: event.clientX,
        clientY: event.clientY,
        startedAt: Date.now(),
        longPress: false,
      }
      const touch = this.editTouch
      touch.longPressTimer = window.setTimeout(() => {
        if (this.editTouch !== touch) return
        touch.longPress = true
        this.mobileMultiSelect = true
        this.selected.add(key.section)
        this.selectionAnchor = key.section
        this.onSelect([...this.selected])
        void this.draw()
      }, 450)
      this.canvas.setPointerCapture(event.pointerId)
      return
    }
    if (this.mode === "edit") {
      this.selectKey(key, event)
      if (this.editTool === "move" && !key.section.startsWith("LIST")) {
        const selectedSections = new Set(
          visiblePreviewItems(this.keys, this.skinState)
            .filter((item) => this.itemSelected(item) && !item.section.startsWith("LIST"))
            .flatMap((item) => item.sections),
        )
        const selectedKeys = this.keys.filter((item) => selectedSections.has(item.section))
        this.editDrag = {
          pointerId: event.pointerId,
          startX: point.x,
          startY: point.y,
          original: new Map(selectedKeys.map((item) => [item.section, { ...item.rect }])),
        }
        event.stopPropagation()
        this.canvas.setPointerCapture(event.pointerId)
        this.canvas.style.cursor = "grabbing"
      }
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

  private selectKey(
    key: PreviewItem,
    event: Pick<PointerEvent, "metaKey" | "ctrlKey" | "shiftKey">,
  ): void {
    if (this.mode === "edit" && event.shiftKey && this.selectionAnchor) {
      const sections = visiblePreviewItems(this.keys, this.skinState)
        .filter((item) => item.editable).map((item) => item.section)
      const from = sections.indexOf(this.selectionAnchor)
      const to = sections.indexOf(key.section)
      if (from >= 0 && to >= 0) {
        this.selected = new Set(sections.slice(Math.min(from, to), Math.max(from, to) + 1))
      }
    } else if (this.mode === "edit" && isAdditiveSelection(event)) {
      if (this.itemSelected(key)) key.sections.forEach((section) => this.selected.delete(section))
      else this.selected.add(key.section)
    } else if (!this.itemSelected(key) || this.mode === "preview") {
      this.selected = new Set([key.section])
    } else if (this.mode === "edit" && this.editTool === "select") {
      key.sections.forEach((section) => this.selected.delete(section))
    }
    if (this.mobileMultiSelect && !this.selected.size) this.mobileMultiSelect = false
    if (this.mode === "edit" && !event.shiftKey) this.selectionAnchor = key.section
    this.onSelect([...this.selected])
  }

  private pointerMove(event: PointerEvent): void {
    if (this.editTouch?.pointerId === event.pointerId && !this.editTouch.longPress) {
      const distance = Math.hypot(event.clientX - this.editTouch.clientX, event.clientY - this.editTouch.clientY)
      if (distance > 12 && this.editTouch.longPressTimer !== undefined) {
        window.clearTimeout(this.editTouch.longPressTimer)
        this.editTouch.longPressTimer = undefined
      }
    }
    if (!this.editDrag || this.editDrag.pointerId !== event.pointerId) return
    const point = this.point(event)
    const dx = Math.round(point.x - this.editDrag.startX)
    const dy = Math.round(point.y - this.editDrag.startY)
    for (const key of this.keys) {
      const original = this.editDrag.original.get(key.section)
      if (original) key.rect = { ...original, x: original.x + dx, y: original.y + dy }
    }
    void this.draw()
  }

  private async playAnimation(key: PreviewItem): Promise<void> {
    this.playLegacyAnimation(key)
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

  private playLegacyAnimation(key: PreviewItem): void {
    const styles = [key.animStyle, key.backAnimStyle, ...key.foreAnimStyles].filter(Boolean) as string[]
    const duration = Math.max(0, ...styles.flatMap((style) => {
      const frames = this.legacyAnimation?.get(style)
      return frames ? [Math.max(...frames.map((frame) => frame.start + frame.delay + animationDuration(frame)))] : []
    }))
    if (!duration) return
    if (this.legacyAnimationTimer) window.cancelAnimationFrame(this.legacyAnimationTimer)
    this.legacyAnimationState = { key, startedAt: Date.now() }
    const tick = () => {
      const elapsed = Date.now() - this.legacyAnimationState!.startedAt
      if (elapsed >= duration) this.legacyAnimationState = undefined
      void this.draw()
      if (elapsed < duration) this.legacyAnimationTimer = window.requestAnimationFrame(tick)
    }
    tick()
  }

  private pointerUp(event: PointerEvent): void {
    if (this.editTouch?.pointerId === event.pointerId) {
      const touch = this.editTouch
      this.cancelEditTouch()
      const distance = Math.hypot(event.clientX - touch.clientX, event.clientY - touch.clientY)
      const longPress = touch.longPress || isTouchLongPress(
        touch.pointerType,
        Date.now() - touch.startedAt,
        distance,
      )
      if (longPress) {
        this.mobileMultiSelect = true
        this.selected.add(touch.key.section)
        this.selectionAnchor = touch.key.section
        this.onSelect([...this.selected])
      } else {
        this.selectKey(touch.key, {
          metaKey: event.metaKey,
          ctrlKey: event.ctrlKey || this.mobileMultiSelect,
          shiftKey: event.shiftKey,
        })
      }
      void this.draw()
      return
    }
    if (this.editDrag?.pointerId === event.pointerId) {
      const drag = this.editDrag
      const point = this.point(event)
      const dx = point.x - drag.startX
      const dy = point.y - drag.startY
      this.editDrag = undefined
      this.updateCursor()
      if (Math.round(dx) || Math.round(dy)) {
        this.onMove([...drag.original.keys()], Math.round(dx), Math.round(dy))
      }
      else void this.draw()
      return
    }
    if (!this.active) return
    const point = this.point(event)
    const active = this.active
    const { key, startX, startY, startedAt } = active
    const dx = point.x - startX
    const dy = point.y - startY
    const clearOnHold = key.center.trim() === "F36"
    const direction = gestureDirection(dx, dy, Date.now() - startedAt, Boolean(key.hold) || clearOnHold)
    const code = direction === "hold" && clearOnHold ? "F48" : key[direction]
    this.onEvent({ section: key.section, direction, code })
    const release = () => {
      if (this.active !== active) return
      this.active = undefined
      void this.draw()
    }
    if (event.pointerType === "touch") globalThis.setTimeout(release, 80)
    else release()
  }

  private cancelEditDrag(): void {
    if (!this.editDrag) return
    for (const key of this.keys) {
      const original = this.editDrag.original.get(key.section)
      if (original) key.rect = original
    }
    this.editDrag = undefined
  }

  private cancelEditTouch(): void {
    if (this.editTouch?.longPressTimer !== undefined) window.clearTimeout(this.editTouch.longPressTimer)
    this.editTouch = undefined
  }

  private updateCursor(): void {
    this.canvas.style.cursor = this.mode === "preview" ? "pointer" : this.editTool === "move" ? "grab" : "default"
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
    if (!visual.image || !visual.source) {
      this.strokeBorder(context, visual, destination)
      return
    }
    if (stretch && visual.inner) {
      this.drawNineSlice(context, visual, destination)
    } else {
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
    // BDA filterColor 是叠加在图片之上的颜色滤镜（tint），在图片之后绘制。
    if (visual.filterColor && !isTransparentColor(visual.filterColor)) {
      context.save()
      context.globalAlpha = this.filterAlpha(visual.filterColor)
      context.fillStyle = this.filterRgb(visual.filterColor)
      context.fillRect(destination.x, destination.y, destination.width, destination.height)
      context.restore()
    }
    this.strokeBorder(context, visual, destination)
  }

  private filterRgb(color: string): string {
    const match = color.match(/^rgba\(([^,]+),([^,]+),([^,]+),/)
    return match ? `rgb(${match[1]}, ${match[2]}, ${match[3]})` : color
  }

  private filterAlpha(color: string): number {
    const match = color.match(/rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/)
    return match ? Math.max(0, Math.min(1, Number(match[1]))) : 1
  }

  private strokeBorder(
    context: CanvasRenderingContext2D,
    visual: Visual,
    destination: Rect,
  ): void {
    if (!visual.borderColor || isTransparentColor(visual.borderColor)) return
    context.strokeStyle = visual.borderColor
    context.lineWidth = 1
    context.strokeRect(destination.x + 0.5, destination.y + 0.5, destination.width - 1, destination.height - 1)
  }

  private withTransform(
    context: CanvasRenderingContext2D,
    rect: Rect,
    scale: readonly [number, number] | undefined,
    translation: readonly [number, number] | undefined,
    opacity: number | undefined,
    draw: () => void,
  ): void {
    if (!scale && !translation && opacity === undefined) {
      draw()
      return
    }
    const centerX = rect.x + rect.width / 2
    const centerY = rect.y + rect.height / 2
    context.save()
    if (opacity !== undefined) context.globalAlpha *= opacity
    if (translation) context.translate(translation[0], translation[1])
    if (scale) {
      context.translate(centerX, centerY)
      context.scale(scale[0], scale[1])
      context.translate(-centerX, -centerY)
    }
    draw()
    context.restore()
  }

  private async draw(): Promise<void> {
    const drawID = ++this.drawID
    const keys = visiblePreviewItems(this.keys, this.skinState)
      .map((key) =>
        this.document ? effectivePreviewItem(this.document, key, this.skinState ?? 0) : key,
      )
      .sort((left, right) => {
        const leftFull = isFullPanelPreviewItem(left, this.panelWidth, this.panelHeight)
        const rightFull = isFullPanelPreviewItem(right, this.panelWidth, this.panelHeight)
        return leftFull === rightFull ? 0 : leftFull ? -1 : 1
      })
    const [panel, visuals, toolbarImages] = await Promise.all([
      this.resolver?.resolve(this.panelStyle, false),
      Promise.all(keys.map(async (key) => {
        const highlighted = this.active?.key.section === key.section ||
          this.legacyAnimationState?.key.section === key.section
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
      const selected = previewSelectionVisible(this.mode, this.itemSelected(key))
      const animationElapsed = this.legacyAnimationState?.key.section === key.section
        ? Date.now() - this.legacyAnimationState.startedAt
        : -1
      const backAnimationStyle = key.backAnimStyle || key.animStyle
      const backScale = animationElapsed >= 0
        ? legacyAnimationScale(this.legacyAnimation, backAnimationStyle, animationElapsed)
        : undefined
      const backTranslation = animationElapsed >= 0
        ? legacyAnimationTranslation(this.legacyAnimation, backAnimationStyle, animationElapsed)
        : undefined
      const backOpacity = animationElapsed >= 0
        ? legacyAnimationOpacity(this.legacyAnimation, backAnimationStyle, animationElapsed)
        : undefined
      const foregrounds = phoneForegroundLayers(visuals[index].fore)
      const styleTexts = visuals[index].styleTexts
      const hasForeground = foregrounds.some(Boolean) || styleTexts.some(Boolean)
      if (shouldDrawItemBackground(key, this.panelStyle, this.panelWidth, this.panelHeight)) {
        this.withTransform(context, key.rect, backScale, backTranslation, backOpacity, () => {
          this.drawVisual(context, visuals[index].back, key.rect, true)
        })
      }
      for (const [layer, fore] of foregrounds.entries()) {
        const animationStyle = key.foreAnimStyles[layer] || key.foreAnimStyle || key.animStyle
        const foreScale = animationElapsed >= 0
          ? legacyAnimationScale(this.legacyAnimation, animationStyle, animationElapsed)
          : undefined
        const foreTranslation = animationElapsed >= 0
          ? legacyAnimationTranslation(this.legacyAnimation, animationStyle, animationElapsed)
          : undefined
        const foreOpacity = animationElapsed >= 0
          ? legacyAnimationOpacity(this.legacyAnimation, animationStyle, animationElapsed)
          : undefined
        const offset = key.foreOffsets[layer] ?? offsetFromSection(
          this.offsets,
          `OFFSET${key.positionTypes[layer] ?? ""}`,
        )
        const destination = key.foreRect ?? foregroundLayerRect(key.rect, fore?.source, offset)
        this.withTransform(context, key.rect, foreScale, foreTranslation, foreOpacity, () => {
          this.drawVisual(context, fore, destination, false)
        })
      }

      for (const [layer, styleText] of styleTexts.entries()) {
        if (!styleText || foregrounds[layer]) continue
        const animationStyle = key.foreAnimStyles[layer] || key.foreAnimStyle || key.animStyle
        const foreScale = animationElapsed >= 0
          ? legacyAnimationScale(this.legacyAnimation, animationStyle, animationElapsed)
          : undefined
        const foreTranslation = animationElapsed >= 0
          ? legacyAnimationTranslation(this.legacyAnimation, animationStyle, animationElapsed)
          : undefined
        const foreOpacity = animationElapsed >= 0
          ? legacyAnimationOpacity(this.legacyAnimation, animationStyle, animationElapsed)
          : undefined
        const offset = key.foreOffsets[layer] ?? offsetFromSection(
          this.offsets,
          `OFFSET${key.positionTypes[layer] ?? ""}`,
        )
        const point = foregroundTextPoint(key.foreRect ?? key.rect, offset)
        this.withTransform(context, key.rect, foreScale, foreTranslation, foreOpacity, () => {
          this.drawStyleText(context, styleText, point)
        })
      }

      if (selected) {
        context.strokeStyle = "#087ff5"
        context.lineWidth = 4
        context.strokeRect(key.rect.x + 2, key.rect.y + 2, key.rect.width - 4, key.rect.height - 4)
      }

      const textVisual: TextVisual | undefined = visuals[index].text
      context.fillStyle = textVisual?.color ?? (this.theme === "dark" ? "#f5f5f7" : "#17191c")
      const fontSize = textVisual?.fontSize ?? Math.max(18, Math.min(42, key.rect.height * 0.25))
      const fontWeight = textVisual?.fontWeight ? `${textVisual.fontWeight} ` : ""
      context.font = `${fontWeight}${fontSize}px ${canvasFontFamily(textVisual?.fontName)}`
      context.textAlign = "center"
      context.textBaseline = "middle"
      const fallbackText = previewFallbackText(key, this.mode, hasForeground)
      if (fallbackText) {
        const animationStyle = key.foreAnimStyle || key.animStyle
        const foreScale = animationElapsed >= 0
          ? legacyAnimationScale(this.legacyAnimation, animationStyle, animationElapsed)
          : undefined
        const foreTranslation = animationElapsed >= 0
          ? legacyAnimationTranslation(this.legacyAnimation, animationStyle, animationElapsed)
          : undefined
        const foreOpacity = animationElapsed >= 0
          ? legacyAnimationOpacity(this.legacyAnimation, animationStyle, animationElapsed)
          : undefined
        this.withTransform(context, key.rect, foreScale, foreTranslation, foreOpacity, () => {
          context.fillText(
            fallbackText,
            key.rect.x + key.rect.width / 2,
            key.rect.y + key.rect.height / 2,
          )
        })
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
      for (const key of visiblePreviewItems(this.keys, this.skinState)) {
        context.strokeStyle = this.itemSelected(key) ? "#087ff5" : "#ef3e52"
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
