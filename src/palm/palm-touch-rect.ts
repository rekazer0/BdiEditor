// `PalmSkin.fixTouchRect()` — widen every key's touch rect so neighbouring keys meet.
//
// The shipping PalmSkinConverter runs this for every export: `ConvertFileManager`
// defaults `fixTouchRect` to true and the setting is what produced the `.sxi` files in
// the wild, so the port keeps it on. Boards outside the Swift `modifyBoard` list are
// left untouched, and so are their keys.

import type { PalmJSONValue } from "./palm-json.ts"

type Json = PalmJSONValue
type PalmRect = [[number, number], [number, number]]

// `SkinBoardType` cases the Swift extension re-lays out, spelled as their raw values.
const TOUCH_RECT_BOARDS = new Set<string>([
  "full26Default",
  "full26DefaultNoSwipe",
  "full26EnglishLower",
  "full26EnglishLowerNoSwipe",
  "full26EnglishUpper",
  "full26EnglishUpperNoSwipe",
  "full14Pinyin",
  "full18Pinyin",
  "full26Pinyin",
  "full26PinyinNoSwipe",
  "full26Number",
  "numSymbolEn26",
  "en26WithNumbers",
  "en26UpperWithNumbers",
  "numSymbolCn26Pad",
  "numSymbolCn26PadHigh",
  "numSymbolEn26Pad",
  "numSymbolEn26PadHigh",
  "full26PinyinTopNumbers",
  "full26EnglishLowerTopNumbers",
  "full26EnglishUpperTopNumbers",
  "full26DefaultTopNumbers",
])

function asRecord(value: Json): Record<string, Json> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, Json>)
    : undefined
}

function rectOf(key: Json, field: string): PalmRect | undefined {
  const record = asRecord(key)
  const value = record?.[field]
  if (!Array.isArray(value) || value.length !== 2) return undefined
  const [origin, size] = value
  if (!Array.isArray(origin) || !Array.isArray(size) || origin.length !== 2 || size.length !== 2) {
    return undefined
  }
  const [x, y, width, height] = [origin[0], origin[1], size[0], size[1]]
  if (typeof x !== "number" || typeof y !== "number" || typeof width !== "number" || typeof height !== "number") {
    return undefined
  }
  return [[x, y], [width, height]]
}

function minX(touchRect: PalmRect | undefined): number {
  return touchRect?.[0][0] ?? 0
}

function maxX(touchRect: PalmRect | undefined): number {
  const rect = touchRect
  return rect === undefined ? 0 : rect[0][0] + rect[1][0]
}

// `updateTouchHoriztonalMinX`: move the left edge, keeping the right edge fixed.
function setTouchMinX(key: Json, offset: number): void {
  const record = asRecord(key)
  if (record === undefined) return
  const rect = rectOf(key, "hit_rect")
  if (rect === undefined) return
  record["hit_rect"] = [[rect[0][0] + offset, rect[0][1]], [rect[1][0] - offset, rect[1][1]]]
}

// `updateTouchHoriztonalMaxX`: widen the rect.
function extendTouchMaxX(key: Json, offset: number): void {
  const record = asRecord(key)
  if (record === undefined) return
  const rect = rectOf(key, "hit_rect")
  if (rect === undefined) return
  record["hit_rect"] = [[rect[0][0], rect[0][1]], [rect[1][0] + offset, rect[1][1]]]
}

// `groupButtonByViewRectMinY`: rows are the distinct `Int(viewRect.minY)` values in first
// appearance order. Buttons without a view rect are dropped, exactly as in Swift.
function groupByViewRectMinY(keys: Json[]): Json[][] {
  const groups = new Map<number, Json[]>()
  const order: number[] = []
  for (const key of keys) {
    const viewRect = rectOf(key, "rect")
    if (viewRect === undefined) continue
    const row = Math.trunc(viewRect[0][1])
    if (!groups.has(row)) order.push(row)
    const buttons = groups.get(row)
    if (buttons === undefined) groups.set(row, [key])
    else buttons.push(key)
  }
  return order.map((row) => groups.get(row) ?? [])
}

// `fixHorizontalButttons`: sort a row by touch rect, then stretch the outer edges to the
// panel and let both sides of every interior gap grow by half of it.
function fixHorizontalButtons(buttons: Json[], width: number): Json[] {
  const sorted = [...buttons].sort((a, b) => minX(rectOf(a, "hit_rect")) - minX(rectOf(b, "hit_rect")))
  for (let j = 1; j < sorted.length; j += 1) {
    const i = j - 1
    if (i === 0) {
      setTouchMinX(sorted[i], -minX(rectOf(sorted[i], "hit_rect")))
    } else if (j === sorted.length - 1) {
      extendTouchMaxX(sorted[j], width - maxX(rectOf(sorted[j], "hit_rect")))
    }

    const gap = minX(rectOf(sorted[j], "hit_rect")) - maxX(rectOf(sorted[i], "hit_rect"))
    if (gap > 2) {
      extendTouchMaxX(sorted[i], gap / 2)
      setTouchMinX(sorted[j], -gap / 2)
    }
  }
  return sorted
}

function fixBoardKeys(board: Json, fallbackSize: [number, number]): void {
  const record = asRecord(board)
  if (record === undefined) return
  const keys = record["keys"]
  if (!Array.isArray(keys)) return

  const boardDraw = asRecord(record["board"])
  const size = boardDraw?.["size"]
  const width = Array.isArray(size) && typeof size[0] === "number" ? size[0] : fallbackSize[0]

  const rows = groupByViewRectMinY(keys as Json[])
  record["keys"] = rows.flatMap((row) => fixHorizontalButtons(row, width))
}

// `fixTouchRect(maps:)` over one layout's board map.
export function fixTouchRects(maps: Record<string, Json>): void {
  const size = asRecord(asRecord(maps["defaultGlobal"])?.["board"])?.["size"]
  const fallbackSize: [number, number] =
    Array.isArray(size) && typeof size[0] === "number" && typeof size[1] === "number"
      ? [size[0], size[1]]
      : [0, 0]

  for (const name of Object.keys(maps)) {
    if (TOUCH_RECT_BOARDS.has(name)) fixBoardKeys(maps[name], fallbackSize)
  }
}
