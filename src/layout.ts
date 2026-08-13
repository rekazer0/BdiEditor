import { IniDocument } from "./ini.ts"

export type LayoutRect = {
  section: string
  x: number
  y: number
  width: number
  height: number
}

export type LayoutAction =
  | "left"
  | "right"
  | "top"
  | "bottom"
  | "same-width"
  | "same-height"
  | "horizontal-gap"
  | "vertical-gap"
  | "swap"

export function rectToString(rect: Omit<LayoutRect, "section">): string {
  return [rect.x, rect.y, rect.width, rect.height].map(Math.round).join(",")
}

// 检查器里的 LIST 是 [LIST] 段的整体候选栏（画布上作为一个可选中按钮）：
// 位置来自 POS、尺寸来自 CELL_SIZE × LIST_NUM、样式来自 BACK_STYLE/FORE_STYLE。
// LIST:n 仅为预览渲染的标点占位，不可单独选中。
const listCellUnit = /^LIST:(\d+)$/

export function isListCell(section: string): boolean {
  return section === "LIST" || listCellUnit.test(section)
}

export function listCellIndex(section: string): number {
  const match = section.match(listCellUnit)
  return match ? Number(match[1]) - 1 : 0
}

function listPair(layout: IniDocument, key: string): [number, number] | undefined {
  const parts = layout.get("LIST", key)?.split(",").map(Number)
  if (!parts || parts.length !== 2 || parts.some((part) => !Number.isFinite(part))) return
  return [parts[0], parts[1]]
}

function setListPair(layout: IniDocument, key: string, pair: [number, number]): void {
  layout.set("LIST", key, pair.map(Math.round).join(","))
}

export function listCellValue(layout: IniDocument, section: string, name: string, countOverride?: number): string {
  if (!isListCell(section)) return layout.get(section, name) ?? ""
  if (name === "x" || name === "y") {
    const pair = listPair(layout, "POS") ?? [0, 0]
    return String(Math.round(pair[name === "x" ? 0 : 1]))
  }
  if (name === "width") {
    const cell = listPair(layout, "CELL_SIZE") ?? [0, 0]
    return String(Math.round(cell[0]))
  }
  if (name === "height") {
    const cell = listPair(layout, "CELL_SIZE") ?? [0, 0]
    const count = countOverride ?? (Number(layout.get("LIST", "LIST_NUM")) || 1)
    return String(Math.round(cell[1] * count))
  }
  if (name === "SHOW") return layout.get("LIST", "NAMES") ?? ""
  if (name === "CENTER") return layout.get("LIST", "VALUES") ?? ""
  return layout.get("LIST", name) ?? ""
}

export function listCellRect(layout: IniDocument, section: string): LayoutRect | undefined {
  if (!isListCell(section)) return
  const position = listPair(layout, "POS")
  const cell = listPair(layout, "CELL_SIZE")
  const count = Number(layout.get("LIST", "LIST_NUM"))
  if (!position || !cell || cell.some((value) => value <= 0) || !Number.isFinite(count) || count <= 0) return
  return {
    section,
    x: position[0],
    y: position[1],
    width: cell[0],
    height: cell[1] * count,
  }
}

export function setListCellValue(layout: IniDocument, section: string, name: string, value: string, countOverride?: number): void {
  if (!isListCell(section)) {
    layout.set(section, name, value)
    return
  }
  if (name === "x" || name === "y") {
    const pair = listPair(layout, "POS") ?? [0, 0]
    const number = Number(value)
    if (!Number.isFinite(number)) return
    pair[name === "x" ? 0 : 1] = number
    setListPair(layout, "POS", pair)
    return
  }
  if (name === "width") {
    const pair = listPair(layout, "CELL_SIZE") ?? [0, 0]
    const number = Number(value)
    if (!Number.isFinite(number) || number <= 0) return
    pair[0] = number
    setListPair(layout, "CELL_SIZE", pair)
    return
  }
  if (name === "height") {
    // 整体高度 = CELL_SIZE 高度 × LIST_NUM，编辑整体高度换算回单元高度
    const pair = listPair(layout, "CELL_SIZE") ?? [0, 0]
    const number = Number(value)
    if (!Number.isFinite(number) || number <= 0) return
    const count = countOverride ?? (Number(layout.get("LIST", "LIST_NUM")) || 1)
    pair[1] = Math.max(1, Math.round(number / count))
    setListPair(layout, "CELL_SIZE", pair)
    return
  }
  // SHOW 对应 NAMES、CENTER 对应 VALUES；方向键对候选栏无意义，不写回
  if (name === "SHOW") {
    layout.set("LIST", "NAMES", value)
    return
  }
  if (name === "CENTER") {
    layout.set("LIST", "VALUES", value)
    return
  }
  if (name === "UP" || name === "DOWN" || name === "LEFT" || name === "RIGHT" || name === "HOLD") return
  layout.set("LIST", name, value)
}

export function gestureDirection(
  deltaX: number,
  deltaY: number,
  duration: number,
  hasHold: boolean,
): "center" | "hold" | "left" | "right" | "up" | "down" {
  if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 20) {
    return duration >= 450 && hasHold ? "hold" : "center"
  }
  if (Math.abs(deltaX) > Math.abs(deltaY)) return deltaX > 0 ? "right" : "left"
  return deltaY > 0 ? "down" : "up"
}

export function resizeRect(
  rect: LayoutRect,
  deltaX: number,
  deltaY: number,
  minimum = 20,
): LayoutRect {
  return {
    ...rect,
    width: Math.max(minimum, rect.width + deltaX),
    height: Math.max(minimum, rect.height + deltaY),
  }
}

export function moveRects(rects: LayoutRect[], deltaX: number, deltaY: number): LayoutRect[] {
  return rects.map((rect) => ({ ...rect, x: rect.x + deltaX, y: rect.y + deltaY }))
}

export function mergeLayoutRects(first: LayoutRect, second: LayoutRect): LayoutRect {
  const x = Math.min(first.x, second.x)
  const y = Math.min(first.y, second.y)
  return {
    ...first,
    x,
    y,
    width: Math.max(first.x + first.width, second.x + second.width) - x,
    height: Math.max(first.y + first.height, second.y + second.height) - y,
  }
}

export function applyLayoutAction(rects: LayoutRect[], action: LayoutAction): LayoutRect[] {
  const next = rects.map((rect) => ({ ...rect }))
  if (next.length < 2) return next
  if (action === "swap") {
    if (next.length !== 2) return next
    ;[next[0].x, next[1].x] = [next[1].x, next[0].x]
    ;[next[0].y, next[1].y] = [next[1].y, next[0].y]
  } else if (action === "left") {
    const x = Math.min(...next.map((rect) => rect.x))
    next.forEach((rect) => (rect.x = x))
  } else if (action === "right") {
    const right = Math.max(...next.map((rect) => rect.x + rect.width))
    next.forEach((rect) => (rect.x = right - rect.width))
  } else if (action === "top") {
    const y = Math.min(...next.map((rect) => rect.y))
    next.forEach((rect) => (rect.y = y))
  } else if (action === "bottom") {
    const bottom = Math.max(...next.map((rect) => rect.y + rect.height))
    next.forEach((rect) => (rect.y = bottom - rect.height))
  } else if (action === "same-width") {
    next.forEach((rect) => (rect.width = next[0].width))
  } else if (action === "same-height") {
    next.forEach((rect) => (rect.height = next[0].height))
  } else {
    const horizontal = action === "horizontal-gap"
    next.sort((a, b) => (horizontal ? a.x - b.x : a.y - b.y))
    const start = horizontal ? next[0].x : next[0].y
    const last = next.at(-1)!
    const end = horizontal ? last.x + last.width : last.y + last.height
    const size = next.reduce(
      (sum, rect) => sum + (horizontal ? rect.width : rect.height),
      0,
    )
    const gap = (end - start - size) / (next.length - 1)
    setExactGapInPlace(next, horizontal, gap)
  }
  return next
}

export function setExactGap(
  rects: LayoutRect[],
  direction: "horizontal" | "vertical",
  gap: number,
): LayoutRect[] {
  const next = rects.map((rect) => ({ ...rect }))
  next.sort((a, b) => (direction === "horizontal" ? a.x - b.x : a.y - b.y))
  setExactGapInPlace(next, direction === "horizontal", gap)
  return next
}

function setExactGapInPlace(rects: LayoutRect[], horizontal: boolean, gap: number): void {
  let position = horizontal ? rects[0].x : rects[0].y
  for (const rect of rects) {
    if (horizontal) {
      rect.x = position
      position += rect.width + gap
    } else {
      rect.y = position
      position += rect.height + gap
    }
  }
}
