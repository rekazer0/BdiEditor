// Palm `skin.json` drawn the way the Palm keyboard draws it, read from the JSON itself.
//
// Palm keeps Baidu's skin model under its own field names: a board's `board`/`keys`/`list`/`offset`
// override `defaultGlobal`, a key's `b` names its back (`base_b`), foreground layers (`base_f`) and
// their offsets (`base_o`), and `fix_a` swaps in a `key_fix` entry while a keyboard state holds.
// Styles (`ss_1`) are text (`s_1`), image (`s_2`, "tile file,IMG index") or border (`s_3`); tiles
// (`info`) give the image's source rect and the stretchable `rect2`. An orientation's `s_port` /
// `s_land` sets override `s_info`, and its own `res` folder wins over the shared one.

import { pngBitmap, type Visual } from "../atlas.ts"
import { argbColor, imageAt, sceneKey, type NativeScene, type SceneKey, type SceneLayer, type SceneLayers, type SceneText } from "../native-scene.ts"
import { stateTipSection } from "../panel-tools.ts"
import { isFullPanelPreviewItem, type Rect } from "../preview-items.ts"
import type { SkinArchive } from "../skin.ts"
import { asObject, rectParts, tipsText, type Json, type JsonObject } from "./sxi-ini.ts"

export type PalmTheme = "default" | "night"
export type PalmOrientation = "port" | "land"

type Paint = { visual?: Visual; fill?: string; border?: { color: string; width: number }; text?: Omit<SceneText, "x" | "y" | "text"> & { text?: string } }
type Base = { back?: Json; fores: Json[]; offsets: Json[] }

const THEME_DIRECTORY: Record<PalmTheme, string> = { default: "light", night: "dark" }
// What shows through a transparent skin: the Palm keyboard's own backdrop, sampled from Palm previews.
const BACKDROP: Record<PalmTheme, string> = { default: "#d0d3d9", night: "#212121" }
// Android's toolbar draws these functions with IMG<n> of `a_m` (pop_menu_icons): 表情 26, 输入方式 27,
// 语音 29, 搜索 31, 编辑 25, 剪贴板 50 (Baidu LogoIconSource); the real list lives on the phone.
const ANDROID_TOOLBAR_TILES = [26, 27, 29, 31, 25, 50]

function numbers(value: Json): number[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === "number") ? value as number[] : undefined
}

function rectOf(value: Json): Rect | undefined {
  const parts = rectParts(value)
  if (!parts || parts[2] <= 0 || parts[3] <= 0) return
  return { x: parts[0], y: parts[1], width: parts[2], height: parts[3] }
}

function list(value: Json): Json[] {
  return Array.isArray(value) ? value : value === undefined ? [] : [value]
}

/** The styles, tiles and images one theme and orientation of a Palm skin draws with. */
export class PalmStyles {
  private readonly archive: SkinArchive
  private readonly roots: string[]
  private readonly styles: JsonObject
  private readonly tiles: JsonObject
  private readonly paints = new Map<string, Promise<Paint | undefined>>()

  constructor(archive: SkinArchive, skin: JsonObject, theme: PalmTheme, orientation: PalmOrientation, tiles?: JsonObject) {
    this.archive = archive
    const struct = asObject(skin[theme]) ?? {}
    const shared = asObject(struct.s_info) ?? {}
    const own = asObject(struct[orientation === "port" ? "s_port" : "s_land"]) ?? {}
    this.styles = { ...asObject(shared.ss_1), ...asObject(own.ss_1) }
    const directory = THEME_DIRECTORY[theme]
    // The toolbar atlas (`a_m`) is its own tile map, for res/logo/pop_menu_icons.png.
    this.tiles = tiles ?? { ...asObject(shared.info), ...asObject(own.info) }
    this.roots = tiles ? [`${directory}/skin/res/logo`] : [`${directory}/skin/${orientation}/res`, `${directory}/skin/res`]
  }

  /** "tile file,IMG index" as a drawable slice; `IMG<n>` is matched by id, Android atlases start at IMG0. */
  async image(reference: Json): Promise<Visual | undefined> {
    if (typeof reference !== "string") return
    const [name, index] = reference.split(",").map((part) => part.trim())
    const tile = list(this.tiles[name]).map(asObject).find((item) => item?.id === `IMG${index}`)
    const source = rectParts(tile?.rect1 ?? null)
    const path = this.roots.map((root) => `${root}/${name}.png`).find((candidate) => this.archive.getBytes(candidate))
    const bitmap = path && source && await pngBitmap(this.archive.getBytes(path)!)
    if (!bitmap || !source) return
    const inner = rectParts(tile?.rect2 ?? null)
    return {
      image: bitmap,
      imagePath: path,
      source,
      // A zero-sized rect2 does not stretch.
      ...inner && inner[2] > 0 && inner[3] > 0 ? { inner: [inner[0] - source[0], inner[1] - source[1], inner[2], inner[3]] as [number, number, number, number] } : {},
    }
  }

  paint(id: Json, pressed: boolean): Promise<Paint | undefined> {
    const key = `${id}|${pressed}`
    let paint = this.paints.get(key)
    if (!paint) this.paints.set(key, paint = this.resolve(id, pressed))
    return paint
  }

  private async resolve(id: Json, pressed: boolean): Promise<Paint | undefined> {
    const style = typeof id === "number" || typeof id === "string" ? asObject(this.styles[String(id)]) : undefined
    if (!style) return
    const textStyle = asObject(style.s_1)
    const image = asObject(style.s_2)
    const border = asObject(style.s_3)
    const paint: Paint = {}
    if (image) paint.visual = await this.image((pressed ? image.hl : undefined) ?? image.normal)
    const color = argbColor((pressed ? textStyle?.c_hl : undefined) ?? textStyle?.c_normal)
    // `for_back` makes the text colour a fill: the style is a solid background.
    if (textStyle?.for_back === true) paint.fill = color
    else if (textStyle && color && typeof textStyle.f_s === "number") {
      paint.text = {
        ...typeof textStyle.text === "string" ? { text: textStyle.text } : {},
        size: textStyle.f_s,
        color,
        ...typeof textStyle.f_w === "number" ? { weight: textStyle.f_w } : {},
        ...typeof textStyle.f_n === "string" ? { font: textStyle.f_n } : {},
      }
    }
    const borderColor = argbColor(border?.color)
    if (typeof border?.size === "number" && border.size > 0 && borderColor) paint.border = { color: borderColor, width: border.size }
    return paint
  }

  /** A back style filling `rect`. */
  async back(id: Json, pressed: boolean, rect: Rect): Promise<SceneLayer[]> {
    const paint = await this.paint(id, pressed)
    if (!paint) return []
    return [
      ...paint.fill ? [{ kind: "fill", rect, color: paint.fill } as const] : [],
      ...paint.visual ? [{ kind: "image", rect, visual: paint.visual } as const] : [],
      ...paint.border ? [{ kind: "border", rect, ...paint.border } as const] : [],
    ]
  }

  /** A foreground layer at its own size, centred on the key and moved by its offset. */
  async fore(id: Json, pressed: boolean, rect: Rect, offset: [number, number] | undefined, label?: string): Promise<SceneLayer | undefined> {
    const paint = await this.paint(id, pressed)
    const x = rect.x + rect.width / 2 + (offset?.[0] ?? 0)
    const y = rect.y + rect.height / 2 + (offset?.[1] ?? 0)
    if (paint?.visual) return imageAt(paint.visual, x, y)
    const text = paint?.text?.text ?? label
    if (paint?.text && text) return { kind: "text", text: { ...paint.text, text, x, y } }
  }
}

function baseOf(owner: JsonObject | undefined): Base {
  const base = asObject(owner?.b ?? null) ?? {}
  return { back: base.base_b, fores: list(base.base_f), offsets: list(base.base_o) }
}

/** Baidu's TIP replacement: each field the active `key_fix` entry sets replaces the key's own. */
function stateBase(key: JsonObject, fixes: JsonObject, state: number | undefined): Base {
  const own = baseOf(key)
  const tip = stateTipSection(tipsText(key.fix_a ?? null), state)
  const fix = tip === undefined ? undefined : asObject(fixes[String(tip)])
  const replaced = asObject(fix?.b ?? null)
  if (!replaced) return own
  return {
    back: "base_b" in replaced ? replaced.base_b : own.back,
    fores: "base_f" in replaced ? list(replaced.base_f) : own.fores,
    offsets: "base_o" in replaced ? list(replaced.base_o) : own.offsets,
  }
}

async function keyLayers(styles: PalmStyles, base: Base, rect: Rect, offsets: (id: Json) => [number, number] | undefined, pressed: boolean): Promise<SceneLayers> {
  const fore: SceneLayer[] = []
  for (const [index, id] of base.fores.entries()) {
    const layer = await styles.fore(id, pressed, rect, offsets(base.offsets[index]))
    if (layer) fore.push(layer)
  }
  return { back: base.back === undefined ? [] : await styles.back(base.back, pressed, rect), fore }
}

/** The symbol column (`list`): one bar, then a cell per title; `t` 2 is a runtime scrolling list. */
async function listKeys(styles: PalmStyles, own: JsonObject | undefined, global: JsonObject | undefined): Promise<SceneKey[]> {
  if (!own) return []
  const value = (field: string) => own[field] ?? global?.[field]
  const cell = numbers(value("size") ?? null)
  const position = numbers(value("pos") ?? null)
  const count = value("count")
  if (value("t") === 2 || cell?.length !== 2 || position?.length !== 2 || typeof count !== "number" || count <= 0) return []
  const horizontal = value("order") === true
  const base = baseOf(asObject(value("b") ?? null) ? { b: value("b")! } : undefined)
  const titles = list(value("titles") ?? null).filter((title): title is string => typeof title === "string").slice(0, count)
  const bar = rectOf(value("rect") ?? null) ?? {
    x: position[0],
    y: position[1],
    width: cell[0] * (horizontal ? count : 1),
    height: cell[1] * (horizontal ? 1 : count),
  }
  const keys = [await sceneKey("LIST", bar, async (pressed) => ({ back: base.back === undefined ? [] : await styles.back(base.back, pressed, bar), fore: [] }))]
  for (const [index, title] of titles.entries()) {
    const rect = {
      x: position[0] + (horizontal ? index * cell[0] : 0),
      y: position[1] + (horizontal ? 0 : index * cell[1]),
      width: cell[0],
      height: cell[1],
    }
    keys.push(await sceneKey(`LIST:${index + 1}`, rect, async (pressed) => {
      const back = value("i_cell")
      const label = base.fores[0] === undefined ? undefined : await styles.fore(base.fores[0], pressed, rect, undefined, title)
      return { back: back === undefined ? [] : await styles.back(back, pressed, rect), fore: label ? [label] : [] }
    }))
  }
  return keys
}

/** One keyboard board (`t9Pinyin`, `full26Pinyin`…) of a theme and orientation, in a keyboard state. */
export async function palmBoardScene(
  archive: SkinArchive,
  skin: JsonObject,
  theme: PalmTheme,
  orientation: PalmOrientation,
  type: string,
  state?: number,
): Promise<NativeScene & { width: number; height: number }> {
  const layout = asObject(asObject(skin[theme])?.[`${orientation}_layout`]) ?? {}
  const boards = asObject(layout.b) ?? {}
  const board = asObject(boards[type]) ?? {}
  const global = asObject(boards.defaultGlobal) ?? {}
  const styles = new PalmStyles(archive, skin, theme, orientation)
  // Each `board` field falls back to `defaultGlobal` on its own, like a layout's [PANEL] over gen.ini's.
  const panel = (field: string) => asObject(board.board)?.[field] ?? asObject(global.board)?.[field]
  const [width, height] = numbers(panel("size") ?? null) ?? [0, 0]
  const offsetTable = { ...asObject(global.offset), ...asObject(board.offset) }
  const offsets = (id: Json) => {
    const point = numbers(asObject(offsetTable[String(id)])?.p ?? null)
    return point?.length === 2 ? point as [number, number] : undefined
  }
  const fixes = asObject(board.key_fix) ?? {}
  const keys = await Promise.all(list(board.keys).map(asObject).flatMap((key) => {
    const rect = key && rectOf(key.rect ?? null)
    if (!key || !rect) return []
    const base = stateBase(key, fixes, state)
    return [sceneKey(`KEY${key.id ?? ""}`, rect, (pressed) => keyLayers(styles, base, rect, offsets, pressed))]
  }))
  // A key covering the whole panel is a backdrop: Baidu draws it below the others.
  keys.sort((left, right) => Number(!isFullPanelPreviewItem(left, width, height)) - Number(!isFullPanelPreviewItem(right, width, height)))
  const back = asObject(asObject(board.board)?.b ?? null)?.base_b ?? asObject(asObject(global.board)?.b ?? null)?.base_b
  // Keys below the panel (a navigation-bar row) grow the surface; the backdrop covers it too.
  const surface = Math.max(height, ...keys.filter((key) => /^KEY/.test(key.section)).map((key) => key.rect.y + key.rect.height))
  return {
    width,
    height,
    background: [
      { kind: "fill", rect: { x: 0, y: 0, width, height: Math.ceil(surface) }, color: BACKDROP[theme] },
      ...back === undefined ? [] : await styles.back(back, false, { x: 0, y: 0, width, height: Math.ceil(surface) }),
    ],
    keys: [...keys, ...await listKeys(styles, asObject(board.list), asObject(global.list))],
  }
}


async function fileImage(archive: SkinArchive, path: string | undefined): Promise<Visual | undefined> {
  const bytes = path && archive.getBytes(path)
  const bitmap = bytes && await pngBitmap(bytes)
  return bitmap ? { image: bitmap, imagePath: path, source: [0, 0, bitmap.width, bitmap.height] } : undefined
}

/** The toolbar functions' icons: iOS menu items placed on the toolbar, else the Android atlas tiles. */
async function toolbarImages(archive: SkinArchive, skin: JsonObject, theme: PalmTheme): Promise<Visual[]> {
  const struct = asObject(skin[theme]) ?? {}
  const logo = `${THEME_DIRECTORY[theme]}/skin/res/logo`
  const menus = list(struct.menu).filter(Array.isArray) as Json[][]
  const menu = menus.find((items) => items.some((item) => asObject(item)?.Position === "toolbar")) ?? menus[0]
  const visuals = menu
    ? await Promise.all(menu.map(asObject).filter((item) => item?.Position === "toolbar").map((item) => {
        const name = asObject(asObject(item?.Images ?? null)?.Normal ?? null)?.Normal
        const path = typeof name === "string"
          ? [`${logo}/${name}_iphone@3x.png`, `${logo}/${name}@3x.png`, `${logo}/${name}.png`].find((candidate) => archive.getBytes(candidate))
          : undefined
        return fileImage(archive, path)
      }))
    : Array.isArray(struct.a_m)
      ? await Promise.all(ANDROID_TOOLBAR_TILES.map((tile) =>
          new PalmStyles(archive, skin, theme, "port", { pop_menu_icons: struct.a_m }).image(`pop_menu_icons,${tile}`)))
      : []
  return visuals.filter((visual): visual is Visual => Boolean(visual))
}

/**
 * The candidate bar of a board: its backdrop, and the `.cnd` icons (`ICON<n>`) placed by anchor
 * (1–9, a 3×3 grid over the bar) and offset. `keep` is Baidu's PERSIST: 1 without a composition,
 * 2 while composing, 3 always. The switch container (F14) holds the toolbar functions, evenly spaced
 * and only ever shrunk.
 */
export async function palmCandidateScene(
  archive: SkinArchive,
  skin: JsonObject,
  theme: PalmTheme,
  orientation: PalmOrientation,
  type: string,
  state?: number,
): Promise<{ bar: SceneLayer[]; icons: NativeScene }> {
  const layout = asObject(asObject(skin[theme])?.[`${orientation}_layout`]) ?? {}
  const boards = asObject(layout.b) ?? {}
  const own = asObject(asObject(boards[type])?.cand) ?? {}
  const global = asObject(asObject(boards.defaultGlobal)?.cand) ?? {}
  const value = (field: string) => own[field] ?? global[field]
  const rect = rectOf(value("rect") ?? null)
  const file = value("file")
  const cand = typeof file === "string" ? asObject(asObject(layout.c)?.[file]) : undefined
  if (!rect) return { bar: [], icons: { background: [], keys: [] } }
  const styles = new PalmStyles(archive, skin, theme, orientation)
  const bar = { x: 0, y: 0, width: rect.width, height: rect.height }
  const back = baseOf(cand).back ?? baseOf(own).back ?? baseOf(global).back
  const composing = state === 4
  const fixes = asObject(cand?.fix ?? null) ?? {}
  const keys = await Promise.all(list(cand?.icon_list ?? null).map(asObject).flatMap((icon, index) => {
    const size = numbers(icon?.s ?? null)
    if (!icon || size?.length !== 2) return []
    const keep = icon.keep ?? 1
    if (keep === 0 || keep !== 3 && composing !== (keep === 2)) return []
    const [x, y] = numbers(icon.p ?? null) ?? [0, 0]
    const anchor = typeof icon.anchor === "number" ? icon.anchor : 1
    const column = (anchor - 1) % 3
    const row = Math.ceil(anchor / 3) - 1
    const place = { x: column * bar.width / 2 + x, y: row * bar.height / 2 + y, width: size[0], height: size[1] }
    // iOS gives FIX_SIZE in points; the bar's layout units are @3x pixels.
    const fixed = numbers(icon.f_size ?? null)?.map((value) => value * 3)
    const base = stateBase({ ...icon, fix_a: icon.t ?? null }, fixes, state)
    const section = `ICON${index + 1}`
    if (icon.k === "switchContainer") {
      return [toolbarImages(archive, skin, theme).then((images) => sceneKey(section, place, async () => {
        const slot = place.width / Math.max(1, images.length)
        return { back: [], fore: images.flatMap((visual, at) => {
          const [, , width, height] = visual.source!
          const scale = Math.min(1, slot / width, place.height / height)
          return [{ kind: "image", visual, rect: {
            x: place.x + at * slot + (slot - width * scale) / 2,
            y: place.y + (place.height - height * scale) / 2,
            width: width * scale,
            height: height * scale,
          } } as const]
        }) }
      }))]
    }
    return [sceneKey(section, place, async (pressed) => {
      const fore: SceneLayer[] = []
      for (const id of base.fores) {
        const layer = await styles.fore(id, pressed, place, undefined)
        if (!layer) continue
        fore.push(fixed?.length === 2 && layer.kind === "image"
          ? { ...layer, rect: { x: place.x + (place.width - fixed[0]) / 2, y: place.y + (place.height - fixed[1]) / 2, width: fixed[0], height: fixed[1] } }
          : layer)
      }
      return { back: base.back === undefined ? [] : await styles.back(base.back, pressed, place), fore }
    })]
  }))
  return { bar: back === undefined ? [] : await styles.back(back, false, bar), icons: { background: [], keys } }
}
