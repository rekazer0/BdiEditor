export type LayoutRect = {
  section: string
  x: number
  y: number
  width: number
  height: number
}

export type LayoutAction =
  | "left"
  | "top"
  | "same-width"
  | "same-height"
  | "horizontal-gap"
  | "vertical-gap"

export function rectToString(rect: Omit<LayoutRect, "section">): string {
  return [rect.x, rect.y, rect.width, rect.height].map(Math.round).join(",")
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

export function applyLayoutAction(rects: LayoutRect[], action: LayoutAction): LayoutRect[] {
  const next = rects.map((rect) => ({ ...rect }))
  if (next.length < 2) return next
  if (action === "left") {
    const x = Math.min(...next.map((rect) => rect.x))
    next.forEach((rect) => (rect.x = x))
  } else if (action === "top") {
    const y = Math.min(...next.map((rect) => rect.y))
    next.forEach((rect) => (rect.y = y))
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
