import { IniDocument } from "./ini.ts"
import type { TileRect, TileSlice } from "./tiles.ts"

export type LayoutKeyGeometry = { section: string; rect: TileRect }
export type LayoutImageTarget = "panel" | "key-normal" | "key-highlight" | "fore-normal" | "fore-highlight" | "candidate"
export type LayoutImagePlan = {
  target: LayoutImageTarget
  keys: LayoutKeyGeometry[]
  slices: TileSlice[]
  indices: Map<string, number>
  panelIndex?: number
}

export function layoutKeyRects(layout: IniDocument, selected: readonly string[] = [], panelSize?: readonly [number, number]): LayoutKeyGeometry[] {
  const filter = selected.length ? new Set(selected) : undefined
  const size = panelSize ?? layout.get("PANEL", "SIZE")?.split(",").map(Number)
  return layout.sections().flatMap((section) => {
    if (!/^KEY\d+$/.test(section) || (filter && !filter.has(section))) return []
    const values = layout.get(section, "VIEW_RECT")?.split(",").map(Number)
    if (!values || values.length !== 4 || values.some((value) => !Number.isFinite(value))) return []
    if (size?.length === 2 && values[0] <= 0 && values[1] <= 0 && values[2] >= size[0] * 0.9 && values[3] >= size[1] * 0.9) return []
    return [{ section, rect: values as TileRect }]
  })
}

export function validateKeyRects(keys: readonly LayoutKeyGeometry[], panelWidth: number, panelHeight: number): string | undefined {
  for (const { section, rect: [x, y, width, height] } of keys) {
    if (![x, y, width, height].every(Number.isInteger) || width <= 0 || height <= 0 || x < 0 || y < 0 || x + width > panelWidth || y + height > panelHeight) {
      return `${section} 的 VIEW_RECT 超出键盘面板范围`
    }
  }
}

export function nextTileIndex(tiles: IniDocument): number {
  const used = new Set(tiles.sections().flatMap((section) => {
    const match = section.match(/^IMG(\d+)$/i)
    return match ? [Number(match[1])] : []
  }))
  let index = 1
  while (used.has(index)) index += 1
  return index
}

export function nextStyleID(styles: IniDocument): number {
  const ids = styles.sections().flatMap((section) => {
    const match = section.match(/^STYLE(\d+)$/)
    return match ? [Number(match[1])] : []
  })
  const counter = Number(styles.get("GLOBAL", "STYLE_NUM"))
  return Math.max(0, ...ids, Number.isFinite(counter) ? counter : 0) + 1
}

export function planLayoutImage(target: LayoutImageTarget, keys: readonly LayoutKeyGeometry[], tileDocument: IniDocument, panelWidth: number, panelHeight: number): LayoutImagePlan {
  const start = nextTileIndex(tileDocument)
  const slices: TileSlice[] = []
  const indices = new Map<string, number>()
  let index = start
  if (target === "panel" || target === "candidate") {
    slices.push({ index, source: [0, 0, panelWidth, panelHeight] })
    return { target, keys: [], slices, indices, panelIndex: index }
  }
  for (const key of keys) {
    indices.set(key.section, index)
    slices.push({ index, source: key.rect })
    index += 1
  }
  return { target, keys: [...keys], slices, indices }
}

// 图片跟随布局 / 布局跟随图片：切片源改为图像里检测到的网格单元，按键按索引取对应切片
// 布局文件里的 KEY 顺序不一定是屏幕阅读顺序（大小写锁定键常排在 Z 附近之外），
// 先按坐标（y 优先、x 次之）排序再与阅读顺序的网格单元配对。
function keysInReadingOrder(keys: readonly LayoutKeyGeometry[]): LayoutKeyGeometry[] {
  return [...keys].sort((a, b) => a.rect[1] - b.rect[1] || a.rect[0] - b.rect[0])
}

export function matchLayoutKeysToCells(layout: IniDocument, keys: readonly LayoutKeyGeometry[], cells: readonly TileRect[]): LayoutKeyGeometry[] {
  const ordered = keysInReadingOrder(keys)
  if (cells.length < ordered.length) {
    layout.removeSections(ordered.slice(cells.length).map((key) => key.section))
    return ordered.slice(0, cells.length)
  }
  if (cells.length === ordered.length || !ordered.length) return ordered

  let number = Math.max(0, ...layout.sections().flatMap((section) => {
    const match = section.match(/^KEY(\d+)$/)
    return match ? [Number(match[1])] : []
  })) + 1
  const template = ordered.at(-1)!
  const entries = layout.entries(template.section)
  for (const cell of cells.slice(ordered.length)) {
    const section = `KEY${number++}`
    layout.appendSection(section, entries.map(({ key, value }) => ({
      key,
      value: key === "VIEW_RECT" ? cell.map(Math.round).join(",") : value,
    })))
    ordered.push({ section, rect: cell })
  }
  return ordered
}

export function planLayoutImageSlices(target: LayoutImageTarget, keys: readonly LayoutKeyGeometry[], cells: readonly TileRect[], tileDocument: IniDocument): LayoutImagePlan {
  const start = nextTileIndex(tileDocument)
  const ordered = keysInReadingOrder(keys)
  const slices: TileSlice[] = []
  const indices = new Map<string, number>()
  let index = start
  for (let i = 0; i < ordered.length; i += 1) {
    const cell = cells[i] ?? ordered[i].rect
    indices.set(ordered[i].section, index)
    slices.push({ index, source: cell })
    index += 1
  }
  return { target, keys: ordered, slices, indices }
}

// 布局跟随图片：把按键 VIEW_RECT 改写为检测到的网格单元，并把面板尺寸改为图片尺寸
export function applyLayoutImageRects(layout: IniDocument, keys: readonly LayoutKeyGeometry[], cells: readonly TileRect[], panelWidth: number, panelHeight: number): void {
  const ordered = keysInReadingOrder(keys)
  for (let i = 0; i < ordered.length; i += 1) {
    const cell = cells[i]
    if (!cell) continue
    layout.set(ordered[i].section, "VIEW_RECT", cell.map(Math.round).join(","))
  }
  layout.set("PANEL", "SIZE", `${Math.round(panelWidth)},${Math.round(panelHeight)}`)
}

function cloneStyle(styles: IniDocument, sourceID: string, nextID: number): string {
  const source = styles.entries(sourceID).map(({ key, value }) => ({ key, value }))
  styles.appendSection(`STYLE${nextID}`, source)
  return `STYLE${nextID}`
}

function updateStyleCounter(styles: IniDocument): void {
  const ids = styles.sections().flatMap((section) => {
    const match = section.match(/^STYLE(\d+)$/)
    return match ? [Number(match[1])] : []
  })
  if (!ids.length) return
  if (!styles.sections().includes("GLOBAL")) styles.appendSection("GLOBAL", [])
  styles.set("GLOBAL", "STYLE_NUM", String(Math.max(...ids)))
}

function cloneBackground(styles: IniDocument, config: IniDocument, section: string, plan: LayoutImagePlan, base: string): void {
  const nextID = nextStyleID(styles)
  const source = config.get(section, "BACK_STYLE") ?? "STYLE0"
  const cloned = cloneStyle(styles, source, nextID)
  styles.set(cloned, "NM_IMG", `${base},${plan.panelIndex}`)
  styles.set(cloned, "HL_IMG", `${base},${plan.panelIndex}`)
  config.set(section, "BACK_STYLE", cloned.replace("STYLE", ""))
  updateStyleCounter(styles)
}

export function applyCandidateImageStyles(styles: IniDocument, cand: IniDocument, plan: LayoutImagePlan, base: string): void {
  cloneBackground(styles, cand, "CAND", plan, base)
}

export function applyLayoutImageStyles(target: LayoutImageTarget, layout: IniDocument, styles: IniDocument, plan: LayoutImagePlan, base: string): void {
  let nextID = nextStyleID(styles)
  if (target === "panel") {
    cloneBackground(styles, layout, "PANEL", plan, base)
    return
  }
  for (const key of plan.keys) {
    const index = plan.indices.get(key.section)
    if (index === undefined) continue
    if (target === "key-normal" || target === "key-highlight") {
      const sourceID = `STYLE${layout.get(key.section, "BACK_STYLE") ?? "0"}`
      const cloned = cloneStyle(styles, sourceID, nextID++)
      styles.set(cloned, target === "key-normal" ? "NM_IMG" : "HL_IMG", `${base},${index}`)
      layout.set(key.section, "BACK_STYLE", cloned.replace("STYLE", ""))
    } else {
      const cloned = `STYLE${nextID++}`
      styles.appendSection(cloned, [{ key: target === "fore-normal" ? "NM_IMG" : "HL_IMG", value: `${base},${index}` }])
      const existing = layout.get(key.section, "FORE_STYLE")?.trim()
      layout.set(key.section, "FORE_STYLE", existing ? `${existing},${cloned.replace("STYLE", "")}` : cloned.replace("STYLE", ""))
    }
  }
  updateStyleCounter(styles)
}
