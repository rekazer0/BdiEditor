import { IniDocument } from "./ini.ts"

export type TileRect = [number, number, number, number]

export type TileSlice = {
  index: number
  source: TileRect
  inner?: TileRect
}

export type TilePoint = { x: number; y: number }

function rect(value: string | undefined): TileRect | undefined {
  const values = value?.split(",").map(Number)
  if (!values || values.length !== 4 || values.some((item) => !Number.isFinite(item))) return
  return values as TileRect
}

export function tileSlices(document: IniDocument): TileSlice[] {
  return document.sections().flatMap((section) => {
    const match = section.match(/^IMG(\d+)$/i)
    const source = rect(document.get(section, "SOURCE_RECT"))
    if (!match || !source) return []
    const inner = rect(document.get(section, "INNER_RECT"))
    return [{ index: Number(match[1]), source, ...(inner ? { inner } : {}) }]
  }).sort((a, b) => a.index - b.index)
}

export function nextTileIndex(document: IniDocument): number {
  const used = new Set(tileSlices(document).map((slice) => slice.index))
  let index = 1
  while (used.has(index)) index++
  return index
}

export function updateTileSlice(document: IniDocument, slice: TileSlice): void {
  const section = `IMG${slice.index}`
  if (!document.sections().includes(section)) {
    document.appendSection(section, [
      { key: "SOURCE_RECT", value: slice.source.join(",") },
      ...(slice.inner ? [{ key: "INNER_RECT", value: slice.inner.join(",") }] : []),
    ])
    return
  }
  document.set(section, "SOURCE_RECT", slice.source.join(","))
  if (slice.inner) document.set(section, "INNER_RECT", slice.inner.join(","))
}

export function boundedTileRect(
  start: TilePoint,
  end: TilePoint,
  width: number,
  height: number,
): TileRect | undefined {
  const left = Math.max(0, Math.min(start.x, end.x, width))
  const top = Math.max(0, Math.min(start.y, end.y, height))
  const right = Math.max(0, Math.min(Math.max(start.x, end.x), width))
  const bottom = Math.max(0, Math.min(Math.max(start.y, end.y), height))
  if (right <= left || bottom <= top) return
  return [left, top, right - left, bottom - top].map(Math.round) as TileRect
}

export function tileSliceAt(slices: readonly TileSlice[], point: TilePoint): TileSlice | undefined {
  return [...slices].reverse().find(({ source: [x, y, width, height] }) =>
    point.x >= x && point.x <= x + width && point.y >= y && point.y <= y + height)
}

export function removeTileSlice(document: IniDocument, index: number): boolean {
  return document.removeSections([`IMG${index}`])
}

export function moveTileRect(
  source: TileRect,
  deltaX: number,
  deltaY: number,
  imageWidth: number,
  imageHeight: number,
): TileRect {
  const [x, y, width, height] = source
  return [
    Math.max(0, Math.min(x + deltaX, imageWidth - width)),
    Math.max(0, Math.min(y + deltaY, imageHeight - height)),
    width,
    height,
  ].map(Math.round) as TileRect
}

export function duplicateTileSlice(
  slice: { source: readonly [number, number, number, number]; inner?: readonly [number, number, number, number] },
  index: number,
): TileSlice {
  return {
    index,
    source: [...slice.source],
    ...(slice.inner ? { inner: [...slice.inner] as TileRect } : {}),
  }
}
