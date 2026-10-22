// 面板复制 for `.sxi`: the layouts, styles and tile maps the editor lists as files are views of
// `skin.json`, so copying one copies the JSON part it was projected from to the part the target path
// stands for. A theme, orientation or `res` folder copies its whole part, including what the
// projection does not show (resource lists, other style tables). Images are ordinary files.

import { boardTypeFromIniFileName } from "./palm-board-types.ts"
import { asObject, type Json, type JsonObject } from "./sxi-ini.ts"
import { encodeSkinJson, parseSkinJson, sxiFragment } from "./sxi-projection.ts"

const THEME_KEYS: Record<string, string> = { light: "default", dark: "night" }
const PART_KINDS: Record<string, string> = { ini: "b", cnd: "c", pop: "h" }
const RECT_FIELDS = new Set(["rect", "hit_rect", "rect1", "rect2"])
// Baidu's SIZE, POS, CELL_SIZE, FIX_SIZE; `p` / `s` are the offset table's and icons' POS / SIZE.
const POINT_FIELDS = new Set(["size", "pos", "c_size", "f_size", "p", "s"])

/** The skin.json part a file of the `.sxi` tree is saved in; undefined for paths Palm has no place for. */
export function sxiFilePointer(path: string): string[] | undefined {
  const part = /^(light|dark)\/skin\/(port|land)\/([^/]+)\.(ini|cnd|pop)$/.exec(path)
  if (part) {
    const [, theme, orientation, name, extension] = part
    const key = extension === "ini" ? boardTypeFromIniFileName(`${name}.ini`) ?? name : name
    return [THEME_KEYS[theme], `${orientation}_layout`, PART_KINDS[extension], key]
  }
  const style = /^(light|dark)\/skin\/(?:(port|land)\/)?res\/([^/]+)\.(css|ini|til)$/.exec(path)
  if (!style) return
  const [, theme, orientation, name, extension] = style
  const table = [THEME_KEYS[theme], orientation ? `s_${orientation}` : "s_info"]
  if (extension === "til") return [...table, "info", name]
  if (`${name}.${extension}` === "default.css") return [...table, "ss_1"]
  if (`${name}.${extension}` === "anim.ini") return [...table, "ss_2"]
}

/**
 * A folder copied as one part: a theme (`light/skin`), an orientation (`light/skin/port`, its layouts,
 * own style table and resource list) or a style folder (`light/skin/res`, `light/skin/port/res`).
 */
export function sxiFolderParts(path: string): string[][] | undefined {
  const match = /^(light|dark)\/skin(?:\/(port|land))?(\/res)?\/?$/.exec(path)
  if (!match) return
  const [, theme, orientation, res] = match
  const key = THEME_KEYS[theme]
  if (!orientation) return res ? [[key, "s_info"], [key, "r_info"]] : [[key]]
  return res
    ? [[key, `s_${orientation}`], [key, `r_${orientation}`]]
    : [[key, `${orientation}_layout`], [key, `s_${orientation}`], [key, `r_${orientation}`]]
}

function setPart(skin: JsonObject, pointer: readonly string[], value: Json | undefined): void {
  let owner = skin
  for (const key of pointer.slice(0, -1)) owner = asObject(owner[key] ?? null) ?? (owner[key] = {}) as JsonObject
  const leaf = pointer[pointer.length - 1]
  if (value === undefined) delete owner[leaf]
  else owner[leaf] = value
}

const round = (value: number) => Math.round(value * 100) / 100

function scalePair(value: Json, xRatio: number, yRatio: number): Json {
  return Array.isArray(value) && value.length === 2 && value.every((item) => typeof item === "number")
    ? [round(value[0] as number * xRatio), round(value[1] as number * yRatio)]
    : value
}

/** Geometry of a skin.json part at another panel size: rects, sizes, positions and insets. */
export function scaleSxiPart(value: Json, xRatio: number, yRatio: number): Json {
  if (Array.isArray(value)) return value.map((item) => scaleSxiPart(item, xRatio, yRatio))
  const object = asObject(value)
  if (!object) return value
  return Object.fromEntries(Object.entries(object).map(([key, item]) => {
    if (RECT_FIELDS.has(key) && Array.isArray(item) && item.length === 2) {
      return [key, [scalePair(item[0], xRatio, yRatio), scalePair(item[1], xRatio, yRatio)]]
    }
    if (POINT_FIELDS.has(key)) return [key, scalePair(item, xRatio, yRatio)]
    const insets = asObject(item)
    if (key === "insets" && insets) {
      return [key, Object.fromEntries(Object.entries(insets).map(([side, inset]) =>
        [side, typeof inset === "number" ? round(inset * (side === "left" || side === "right" ? xRatio : yRatio)) : inset]))]
    }
    return [key, scaleSxiPart(item, xRatio, yRatio)]
  }))
}

/**
 * Resource lists (`r_info`, `r_port`…) name files by their package path, `light/res/…` or Palm's own
 * nested `light/skin/res/…`; a copied folder lists the copies.
 */
function movedResources(value: Json, folders: { source: string; target: string }): Json {
  const flat = (folder: string) => folder.replace(/^(light|dark)\/skin\//, "$1/")
  const moves = [[folders.source, folders.target], [flat(folders.source), flat(folders.target)]]
  return Array.isArray(value)
    ? value.map((item) => {
        const move = typeof item === "string" ? moves.find(([source]) => item.startsWith(source)) : undefined
        return move ? `${move[1]}${(item as string).slice(move[0].length)}` : item
      })
    : value
}

function withMovedResources(value: Json, pointer: readonly string[], folders: { source: string; target: string }): Json {
  if (/^r_/.test(pointer.at(-1)!)) return movedResources(value, folders)
  const object = asObject(value)
  if (pointer.length > 1 || !object) return value
  return Object.fromEntries(Object.entries(object).map(([key, item]) => [key, /^r_/.test(key) ? movedResources(item, folders) : item]))
}

export type SxiCopy = { source: string[]; target: string[] }

/**
 * The skin.json parts a copy writes. `derived` gives the part a listed file was projected from;
 * `folders` (with a trailing slash) are given when a folder is copied, and two folders of the same
 * kind copy as one part.
 */
export function sxiCopyParts(
  copies: ReadonlyArray<{ source: string; target: string }>,
  folders: { source: string; target: string } | undefined,
  derived: (path: string) => string[] | undefined,
): SxiCopy[] {
  const sourceParts = folders && sxiFolderParts(folders.source)
  const targetParts = folders && sxiFolderParts(folders.target)
  if (sourceParts && targetParts && sourceParts.length === targetParts.length && sourceParts[0].length === targetParts[0].length) {
    return sourceParts.map((source, index) => ({ source, target: targetParts[index] }))
  }
  return copies.flatMap(({ source, target }) => {
    const pointer = derived(source)
    if (!pointer) return []
    const destination = sxiFilePointer(target)
    if (!destination) throw new Error(`手心皮肤没有保存 ${target} 的位置，请复制到 light/dark 主题的 port/land 布局或 res 样式目录`)
    return [{ source: pointer, target: destination }]
  })
}

/**
 * `skin.json` with each part copied: scaled when the ratios are not 1, resource lists following
 * `folders` (the copied folders, with a trailing slash). A part the source does not have is removed
 * from the target, so an orientation without its own style table falls back to the shared one again.
 */
export function applySxiCopies(text: string, parts: readonly SxiCopy[], xRatio = 1, yRatio = 1, folders?: { source: string; target: string }): string {
  const skin = parseSkinJson(text)
  const values = parts.map(({ source }) => sxiFragment(skin, source))
  for (const [index, { source, target }] of parts.entries()) {
    let value = values[index] === undefined ? undefined : structuredClone(values[index])
    if (value !== undefined && (xRatio !== 1 || yRatio !== 1)) value = scaleSxiPart(value, xRatio, yRatio)
    if (value !== undefined && folders) value = withMovedResources(value, source, folders)
    setPart(skin, target, value)
  }
  return encodeSkinJson(skin)
}
