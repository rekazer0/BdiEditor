// `.sxi` (Palm skin) export.
//
// Ports `PalmSkinConverter.convertSkin` from the Swift reference: the archive payload is
// mirrored into the converter's temporary input folder, the INI/CSS/plist resources are
// parsed into Palm's `PalmSkin` model tree, and the result is repacked as `skin.json`,
// `info.json`, the bundled `native.layout` and the surviving resource files.
//
// Deliberate differences from the Swift tool:
// - `i` (the Info.txt URL) uses the archive's canonical relative path instead of the
//   exporter's absolute temporary path, so the output is machine independent.
// - `dir`/`root` stay empty, `platform` is always "ia", `tool_version` is 3 and
//   `layoutSupport` is true (BdiEditor ships no converter config).
// - "B<x>" button shorthands resolve in `SkinButtonType` order; the Swift build depends on
//   dictionary ordering there and is not reproducible.
// - Zip entries are written in sorted converter-relative order and emptied directories keep
//   an explicit entry, matching the layout the Palm app expects.

import { zipSync } from "fflate"
import type { SkinArchive } from "../skin.ts"
import { buildAnimationWrap } from "./palm-animation.ts"
import { boardTypeFromIniCode, boardTypeFromIniFileName } from "./palm-board-types.ts"
import { NATIVE_LAYOUT_JSON } from "./palm-native-layout.ts"
import {
  actionCode,
  decodeSkinText,
  parseIniSections,
  toBool,
  toCharacters,
  toDouble,
  toDoubleArray,
  toInsets,
  toInt,
  toIntArray,
  toLastInt,
  toPoint,
  toRect,
  stripSpaces,
  toTipsMap,
  type IniSection,
  type PalmInsets,
} from "./palm-ini.ts"
import { encodePalmJSON, type PalmJSONValue } from "./palm-json.ts"
import { parseXmlPlist, type PalmPlistValue } from "./palm-plist.ts"
import { fixTouchRects } from "./palm-touch-rect.ts"
import {
  PalmVirtualRoot,
  comparePalmDirectoryPaths,
  normalizePalmPath,
  palmBaseName,
  palmJoinPath,
} from "./palm-vfs.ts"

type Json = PalmJSONValue
type Ini = Record<string, string>

// `deleteFiles(matchExt:)` from both `PalmSkin.convert` and `PalmSkinConverter`.
const DELETED_EXTENSIONS = new Set(["ini", "pop", "cnd", "css", "txt", "bdi", "til", "plist"])

// `renamePreviewImage` only rewrites `demo.png` directly inside these folders.
const PREVIEW_DIRECTORIES = new Set(["", "dark/", "light/", "dark/skin/", "light/skin/"])

const PREVIEW_PREFIX = "file:///"

type ConverterEntry = {
  path: string
  directory: boolean
  bytes?: Uint8Array
}

type SkinStruct = {
  dir: string
  themeSkinDir: string
  info: string
  land?: string[]
  port?: string[]
  res?: string[]
  portRes?: string[]
  landRes?: string[]
  logo: string[]
}

type ExportContext = {
  root: PalmVirtualRoot
  warnings: string[]
  sections: Map<string, IniSection[] | undefined>
}

/* ------------------------------------------------------------------ helpers */

function unique(values: number[]): number[] {
  const seen = new Set<number>()
  const result: number[] = []
  for (const value of values) {
    if (seen.has(value)) continue
    seen.add(value)
    result.push(value)
  }
  return result
}

function fileExtension(path: string): string {
  const name = palmBaseName(path)
  const separator = name.lastIndexOf(".")
  return separator <= 0 ? "" : name.slice(separator + 1).toLowerCase()
}

function stripExtension(path: string): string {
  const name = palmBaseName(path)
  const separator = name.lastIndexOf(".")
  return separator <= 0 ? name : name.slice(0, separator)
}

// CoreGraphics values encode as nested arrays: points as `[x, y]`, rects as
// `[[x, y], [w, h]]`.
function pointJson(value: [number, number] | undefined): Json {
  return value === undefined ? undefined : [value[0], value[1]]
}

function rectJson(value: [[number, number], [number, number]] | undefined): Json {
  return value === undefined ? undefined : [[value[0][0], value[0][1]], [value[1][0], value[1][1]]]
}

function insetsJson(value: PalmInsets | undefined): Json {
  return value === undefined
    ? undefined
    : { top: value.top, left: value.left, bottom: value.bottom, right: value.right }
}

// `SkinButtonType`, in declaration order. The order is what makes the "B<x>" shorthand
// deterministic: Swift iterates a dictionary there.
const BUTTON_TYPES: Array<[number, string]> = [
  [0, "UP"],
  [1, "DOWN"],
  [2, "LEFT"],
  [3, "RIGHT"],
  [4, "CENTER"],
  [5, "SHOW"],
  [6, "HOLD"],
  [7, "HOLDSYM"],
  [8, "BAR_SYM"],
  [9, "BAR_SYM_SEL"],
]

const SHOW_TYPE = 5

function buttonValues(entries: Ini): Array<[number, string]> {
  const resolved: Array<string | undefined> = new Array(BUTTON_TYPES.length).fill(undefined)
  for (const [type, iniKey] of BUTTON_TYPES) {
    const raw = entries[iniKey]
    if (raw === undefined) continue
    resolved[type] = actionCode(raw) ?? raw
  }
  for (const [type] of BUTTON_TYPES) {
    const value = resolved[type]
    if (value === undefined || value.length !== 2 || !value.startsWith("B")) continue
    resolved[type] = value.replace(/B/g, "")
    resolved[SHOW_TYPE] = resolved[type]
  }
  const result: Array<[number, string]> = []
  for (const [type] of BUTTON_TYPES) {
    const value = resolved[type]
    if (value !== undefined) result.push([type, value])
  }
  return result
}

// `SkinButtonType.valueMapFrom` never returns nil, and both encoders open a nested
// unkeyed container unconditionally, so an empty map still writes `[]`.
function valuesJson(pairs: Array<[number, string]>): Json {
  const flat: Array<number | string> = []
  for (const [type, value] of pairs) {
    flat.push(type, value)
  }
  return flat
}

function indexKey(sectionName: string, prefix: string): number | undefined {
  return toInt(sectionName.split(prefix).join(""))
}

/* --------------------------------------------------------------- ini access */

function sectionsOf(context: ExportContext, path: string): IniSection[] | undefined {
  if (context.sections.has(path)) return context.sections.get(path)
  const bytes = context.root.bytes(path)
  let sections: IniSection[] | undefined
  if (bytes !== undefined) {
    const text = decodeSkinText(bytes)
    if (text === undefined) {
      context.warnings.push(`无法解析文本文件：${path}`)
    } else {
      sections = parseIniSections(text)
    }
  }
  context.sections.set(path, sections)
  return sections
}

function findResource(res: string[] | undefined, name: string): string | undefined {
  return res?.find((path) => palmBaseName(path) === name)
}

function readResource(context: ExportContext, resource: string[] | undefined, name: string): IniSection[] | undefined {
  const path = findResource(resource, name)
  return path === undefined ? undefined : sectionsOf(context, path)
}

/* ------------------------------------------------------------------- models */

// `SkinBaseModel.init(entries:)`.
function baseModel(entries: Ini): Json {
  const foreStyle = entries["FORE_STYLE"] === undefined ? undefined : unique(toIntArray(entries["FORE_STYLE"]))
  const offsets = entries["POS_TYPE"] === undefined ? undefined : toIntArray(entries["POS_TYPE"])
  return {
    base_b: toInt(entries["BACK_STYLE"]),
    base_f: foreStyle,
    base_s: toInt(entries["SOUND_STYLE"]),
    asi: toLastInt(entries["ANIM_STYLE"]),
    base_ba: toInt(entries["BACK_ANIM_STYLE"]),
    base_o: offsets === undefined ? undefined : offsets.slice(0, foreStyle?.length ?? 0),
    base_pa: toInt(entries["PANEL_ANIM_STYLE"]),
    base_fa: entries["FORE_ANIM_STYLE"] === undefined ? undefined : toIntArray(entries["FORE_ANIM_STYLE"]),
    base_a: toLastInt(entries["FORE_ANIM_STYLE"]),
  }
}

function constModel(entries: Ini): Json {
  return { s_full: toBool(entries["SYMBOL_FULL_SCREEN"]) }
}

// `SkinComposeModel` ([INPUT]).
function composeModel(entries: Ini): Json {
  return {
    b: baseModel(entries),
    type: toInt(entries["TYPE"]),
    pos: pointJson(toPoint(entries["POS"])),
    size: pointJson(toPoint(entries["SIZE"])),
    f_size: pointJson(toPoint(entries["FIX_SIZE"])),
    insets: insetsJson(toInsets(entries["PADDING"])),
  }
}

// `SkinCandidateModel.setupWithEntries` ([CAND], shared with `*.cnd`).
function candidateModel(entries: Ini): Record<string, Json> {
  return {
    b: baseModel(entries),
    f_size: pointJson(toPoint(entries["FIX_SIZE"])),
    rect: rectJson(toRect(entries["VIEW_RECT"])),
    insets: insetsJson(toInsets(entries["PADDING"])),
    gap: toDouble(entries["CELL_W"]),
    f_gap: toDouble(entries["FIRST_GAP"]),
    more_width: toDouble(entries["MORE_W"]),
    i_cell: undefined,
    i_mask: toInt(entries["MASK_STYLE"]),
    i_f_b: toInt(entries["FIRST_BACK"]),
    i_f_f: toInt(entries["FIRST_FORE"]),
    switch: undefined,
    icon_list: undefined,
    fix: undefined,
    file: entries["LAYOUT_NAME"],
    i_cand: toIntArray(entries["FORE_STYLE"])[0],
  }
}

// `SkinCandidateModel(fileURL:)` for `*.cnd`.
function candidateModelFromFile(context: ExportContext, path: string): Json {
  const sections = sectionsOf(context, path) ?? []
  const model: Record<string, Json> = { b: undefined, fix: undefined, switch: undefined, icon_list: [] }
  const icons: Json[] = []
  const tips: Record<string, Json> = {}
  for (const section of sections) {
    if (section.name === "CAND") {
      // Keep earlier sections: `setupWithEntries` only owns the keys it writes.
      for (const [key, value] of Object.entries(candidateModel(section.entries))) {
        if (value !== undefined) model[key] = value
      }
    } else if (section.name === "SWITCH") {
      model.switch = candidateSwitchModel(section.entries)
    } else if (section.name.startsWith("ICON")) {
      icons.push(candidateIconModel(section.entries))
    } else if (section.name.startsWith("TIP")) {
      const index = indexKey(section.name, "TIP")
      if (index !== undefined) tips[String(index)] = buttonFixModel(section.entries)
    }
  }
  model.icon_list = icons.some((icon) => (icon as Record<string, Json>).f_size !== undefined) ? icons : []
  // `SkinCandidateModel(fileURL:)` assigns `tips` unconditionally, empty included.
  model.fix = tips
  return model
}

function candidateSwitchModel(entries: Ini): Json {
  return {
    b: baseModel(entries),
    i_normal: toInt(entries["NML_BACK_STYLE"]),
    i_select: toInt(entries["SEL_BACK_STYLE"]),
    i_font: toInt(entries["NML_FONT_STYLE"]),
    i_font_select: toInt(entries["SEL_FONT_STYLE"]),
    insets: toDouble(entries["PADDING"]),
  }
}

function candidateIconModel(entries: Ini): Json {
  const anchor = toInt(entries["ANCHOR_TYPE"]) ?? 4
  return {
    t: toTipsMap(entries["STAT_STYLE"]),
    b: baseModel(entries),
    p: pointJson(toPoint(entries["POS"])),
    s: pointJson(toPoint(entries["SIZE"])),
    k: actionCode(entries["KEY"] ?? ""),
    keep: toInt(entries["PERSIST"]),
    anchor: anchor >= 1 && anchor <= 9 ? anchor : undefined,
    offset: pointJson(toPoint(entries["OFFSET"])),
    f_size: pointJson(toPoint(entries["FIX_SIZE"])),
    hot_fix: toBool(entries["CAN_PATCHED"]),
  }
}

function bubbleIconModel(entries: Ini): Json {
  const anchor = toInt(entries["ANCHOR_TYPE"]) ?? 4
  return {
    b: baseModel(entries),
    anchor: anchor >= 1 && anchor <= 9 ? anchor : undefined,
    i_cell: toInt(entries["CELL_STYLE"]),
    pos: pointJson(toPoint(entries["POS"])),
    size: pointJson(toPoint(entries["SIZE"])),
    c_size: pointJson(toPoint(entries["CELL_SIZE"])),
    insets: insetsJson(toInsets(entries["PADDING"])),
  }
}

// `SkinBubbleModel(entries:)` ([HINT]).
function bubbleModel(entries: Ini): Json {
  return {
    b: baseModel(entries),
    anchor: toInt(entries["ANCHOR_TYPE"]),
    hint: toInt(entries["TYPE"]),
    file: entries["LAYOUT_NAME"],
    bar_a: toInt(entries["FORE_ANIM_STYLE"]),
    info: undefined,
    icon_info: undefined,
    i_cell: undefined,
  }
}

const BUBBLE_TYPES: Array<[number, string]> = [
  [0, "hint"],
  [1, "bar"],
  [2, "up"],
  [3, "down"],
  [4, "left"],
  [5, "right"],
]

// `SkinBubbleModel(fileURL:)` for `*.pop`: the index map is stored as a flat array.
function bubbleModelFromFile(context: ExportContext, path: string): Json {
  const sections = sectionsOf(context, path) ?? []
  const model: Record<string, Json> = {}
  const indexes = new Map<number, number>()
  const icons: Record<string, Json> = {}
  for (const section of sections) {
    const entries = section.entries
    if (section.name === "HINT") {
      const index = toInt(entries["BACK_ICON"])
      if (index !== undefined) indexes.set(0, index)
    } else if (section.name === "DRAW") {
      const up = toInt(entries["ICON_UP"])
      const down = toInt(entries["ICON_DN"])
      const left = toInt(entries["ICON_LT"])
      const right = toInt(entries["ICON_RT"])
      if (up !== undefined) indexes.set(2, up)
      if (down !== undefined) indexes.set(3, down)
      if (left !== undefined) indexes.set(4, left)
      if (right !== undefined) indexes.set(5, right)
    } else if (section.name === "BAR") {
      const index = toInt(entries["BACK_ICON"])
      if (index !== undefined) indexes.set(1, index)
      const cell = toInt(entries["CELL_STYLE"])
      if (cell !== undefined) model.i_cell = cell
    } else if (section.name.startsWith("ICON")) {
      const index = indexKey(section.name, "ICON")
      if (index !== undefined) icons[String(index)] = bubbleIconModel(entries)
    }
  }
  const flat: number[] = []
  for (const [type] of BUBBLE_TYPES) {
    const index = indexes.get(type)
    if (index === undefined) continue
    flat.push(type, index)
  }
  // `SkinBubbleModel.encode` always writes both maps once `parse(url:)` ran.
  model.info = flat
  model.icon_info = icons
  return model
}

// `SkinEmoticonModel` + its two `SkinEmojiIconModel`s ([EMOJI]).
function emoticonModel(entries: Ini): Json {
  const icon: Json = { b: baseModel(entries), i_text: toInt(entries["TEXT_STYLE_INDEX"]) }
  return {
    b: baseModel(entries),
    i_text: toInt(entries["PANEL_BACK_STYLE_INDEX"]),
    index_t: toInt(entries["TAB_BACK_STYLE_INDEX"]),
    t_icon: icon,
    p_icon: icon,
    file: entries["LAYOUT_NAME"],
    b_line: toInt(entries["BOTTOM_LINE"]),
  }
}

// `SkinAdditionModel` ([MORE]).
function additionModel(entries: Ini): Json {
  const grid = toPoint(entries["GRID"])
  const layoutName = entries["LAYOUT_NAME"]
  const mapped = layoutName === undefined ? undefined : boardTypeFromIniCode(layoutName)
  const row = grid === undefined ? undefined : Math.trunc(grid[0])
  const col = grid === undefined ? undefined : Math.trunc(grid[1])
  return {
    b: baseModel(entries),
    row,
    col,
    i_h: toInt(entries["H_LINE_STYLE_INDEX"]),
    i_v: toInt(entries["V_LINE_STYLE_INDEX"]),
    i_c: toInt(entries["CELL_STYLE_INDEX"]),
    i_l: toInt(entries["LOCK_STYLE_INDEX"]),
    i_b: toInt(entries["BORDER_STYLE_INDEX"]),
    file_info: {},
    file: mapped ?? layoutName,
    l_color: entries["LINE_COLOR"],
  }
}

// `SkinTableModel` ([LIST] / [SEGMENT]).
function tableModel(entries: Ini): Json {
  return {
    b: baseModel(entries),
    order: toBool(entries["LIST_ORDER"]),
    side: toBool(entries["SCROLL_SIDE"]),
    t: toInt(entries["TYPE"]),
    count: toInt(entries["LIST_NUM"]),
    i_cell: toInt(entries["CELL_STYLE"]),
    i_last: undefined,
    i_scroll: toInt(entries["SCROLL_STYLE"]),
    pos: pointJson(toPoint(entries["POS"])),
    size: pointJson(toPoint(entries["SIZE"] ?? entries["CELL_SIZE"])),
    rect: rectJson(toRect(entries["VIEW_RECT"])),
    insets: insetsJson(toInsets(entries["PADDING"])),
    titles: entries["NAMES"] === undefined ? undefined : toCharacters(stripSpaces(entries["NAMES"])),
    values: entries["VALUES"] === undefined ? undefined : toCharacters(stripSpaces(entries["VALUES"])),
  }
}

// `SkinHelpCandModel` ([SCAND]).
function helpCandModel(entries: Ini): Json {
  return {
    b: baseModel(entries),
    i_i: toInt(entries["INPUT_STYLE"]),
    s_i: toInt(entries["SCAND_STYLE"]),
    insets: insetsJson(toInsets(entries["PADDING"])),
    rect: rectJson(toRect(entries["VIEW_RECT"])),
  }
}

// `SkinBoardDrawModel` ([PANEL]).
function boardDrawModel(entries: Ini): Json {
  const base = baseModel(entries)
  const borderStyle = toInt(entries["BORDER_ANIM_STYLE"]) ?? toInt(entries["PANEL_ANIM_STYLE"])
  const ranges = entries["BORDER_RANGE"]
  const border = borderStyle !== undefined && ranges !== undefined
    ? { a: borderStyle, r: borderRangesJson(ranges) }
    : undefined
  const model: Record<string, Json> = {
    b: base,
    exact: toBool(entries["NO_BLUR"]),
    right: toBool(entries["NO_F3_FIX"]),
    c_rect: toBool(entries["CUSTOM_RECT"]),
    top_o: undefined,
    size: pointJson(toPoint(entries["SIZE"])),
    f_size: pointJson(toPoint(entries["FIX_SIZE"])),
    i_b: undefined,
    i_f: undefined,
    extend: toInt(entries["ANIM_EXTEND"]),
    level: toInt(entries["ANIM_LEVEL"]),
    a_insets: insetsJson(toInsets(entries["PANEL_ANIM_INSET"])),
    bd: border === undefined ? undefined : { b: border },
  }
  const baseRecord = base as Record<string, Json>
  if (baseRecord.base_ba === undefined || baseRecord.base_ba === null) {
    baseRecord.base_ba = toInt(entries["ANIM_STYLE"])
  }
  return model
}

function borderRangesJson(text: string): Json {
  const ranges = text.split(";").flatMap((item) => {
    const parts = item.split(",")
    if (parts.length !== 2) return []
    const x = toDouble(parts[0])
    const y = toDouble(parts[1])
    if (x === undefined || y === undefined) return []
    return [[Math.min(Math.max(x, 0), 1), Math.min(Math.max(y, -1), 2)]]
  })
  return ranges.length === 0 ? undefined : ranges
}

// `SkinButtonModel` ([KEY*]).
function buttonModel(entries: Ini, sectionName: string): Json {
  const viewRect = toRect(entries["VIEW_RECT"])
  const touchRect = toRect(entries["TOUCH_RECT"]) ?? viewRect
  return {
    b: baseModel(entries),
    hasU: undefined,
    f: undefined,
    h_style: undefined,
    rect: rectJson(viewRect),
    hit_rect: rectJson(touchRect),
    offset: undefined,
    fix_b: undefined,
    id: sectionName.replace(/KEY/g, ""),
    values: valuesJson(buttonValues(entries)),
    fix_a: toTipsMap(entries["STAT_STYLE"]),
  }
}

// `SkinButtonFixModel` ([TIP*]) — the key is resolved through the action code table.
function buttonFixModel(entries: Ini): Json {
  const key = entries["KEY"]
  return {
    b: baseModel(entries),
    k: key === undefined ? undefined : actionCode(key) ?? key,
    v: valuesJson(buttonValues(entries)),
  }
}

// `SkinPosFixModel` ([OFFSET*]) — integers only, without trimming.
function posFixModel(entries: Ini): Json {
  const text = entries["POS"]
  if (text === undefined) return {}
  const parts = text.split(",")
  if (parts.length !== 2) return {}
  const x = toInt(parts[0])
  const y = toInt(parts[1])
  return x === undefined || y === undefined ? {} : { p: [x, y] }
}

// `SkinMotiveModel` ([FORCE*]).
function motiveModel(entries: Ini): Json {
  return {
    start: toDouble(entries["BEGIN"]),
    finish: toDouble(entries["END"]),
    value: toDouble(entries["VALUE"]),
  }
}

// `SkinLogoInfoModel` ([LOGO]) — `layoutName` is not part of the encoded model.
function logoModel(context: ExportContext, entries: Ini, filePath: string): Json {
  const base = baseModel(entries)
  const layoutName = entries["LAYOUT_NAME"]
  if (layoutName === undefined) return { b: base }
  const directory = filePath.slice(0, Math.max(0, filePath.lastIndexOf("/")))
  const logoPath = palmJoinPath(directory, `${layoutName}.ini`)
  const sections = sectionsOf(context, logoPath)
  if (sections === undefined) {
    context.warnings.push(`找不到 logo 布局：${logoPath} (from ${filePath})`)
    return { b: base }
  }
  let iconIndex: number | undefined
  let panelBase = base
  for (const section of sections) {
    if (section.name !== "PANEL") continue
    panelBase = baseModel(section.entries)
    iconIndex = toInt(section.entries["ICON_INDEX"])
  }
  const model: Record<string, Json> = { b: panelBase }
  if (iconIndex === undefined) return model
  for (const section of sections) {
    if (section.name !== `ICON${iconIndex}`) continue
    model.b_b = toInt(section.entries["BACK_STYLE"])
    model.b_f = toInt(section.entries["FORE_STYLE"])
    model.b_t = toInt(section.entries["TEXT_STYLE"])
  }
  return model
}

// `SkinTileInfoModel` (`.til` tile maps).
function tileModel(entries: Ini, sectionName: string, alpha: number | undefined): Json {
  return {
    info: toBool(entries["SCALABLE"]),
    alpha: alpha !== undefined ? alpha : toInt(entries["USE_ALPHA"]),
    mode: toInt(entries["TILE_MODE"]),
    t_s: toInt(entries["THEME_SCALE_STYLE"]),
    rect1: rectJson(toRect(entries["SOURCE_RECT"])),
    rect2: rectJson(toRect(entries["INNER_RECT"])),
    insets: insetsJson(toInsets(entries["PADDING"])),
    scale: undefined,
    scales: toDoubleArray(entries["SCALE"]),
    id: sectionName,
  }
}

function tileModels(sections: IniSection[]): Json[] {
  const models: Json[] = []
  let useAlpha: number | undefined
  for (const section of sections) {
    if (section.name === "GLOBAL") {
      const model = tileModel(section.entries, section.name, useAlpha)
      useAlpha = (model as Record<string, Json>).alpha as number | undefined
    } else if (section.name.startsWith("IMG")) {
      models.push(tileModel(section.entries, section.name, useAlpha))
    }
  }
  return models
}

/* -------------------------------------------------------------- skin layout */

function keyboardModel(context: ExportContext, path: string, type: string): Json {
  const sections = sectionsOf(context, path) ?? []
  const model: Record<string, Json> = {}
  const keys: Json[] = []
  const tips: Record<string, Json> = {}
  const offsets: Record<string, Json> = {}
  const forces: Json[] = []
  for (const section of sections) {
    const name = section.name
    if (name === "GLOBAL") model.comm = constModel(section.entries)
    else if (name === "INPUT") model.input = composeModel(section.entries)
    else if (name === "CAND") model.cand = candidateModel(section.entries)
    else if (name === "PANEL") model.board = boardDrawModel(section.entries)
    else if (name === "HINT") model.hint = bubbleModel(section.entries)
    else if (name === "LOGO") model.logo = logoModel(context, section.entries, path)
    else if (name === "EMOJI") model.emoji = emoticonModel(section.entries)
    else if (name === "MORE") model.more = additionModel(section.entries)
    else if (name === "LIST") model.list = tableModel(section.entries)
    else if (name === "SEGMENT") model.seg = tableModel(section.entries)
    else if (name === "SCAND") model.top_cand = helpCandModel(section.entries)
    else if (name.startsWith("KEY")) keys.push(buttonModel(section.entries, name))
    else if (name.startsWith("TIP")) {
      const index = indexKey(name, "TIP")
      if (index !== undefined) tips[String(index)] = buttonFixModel(section.entries)
    } else if (name.startsWith("OFFSET")) {
      const index = indexKey(name, "OFFSET")
      if (index !== undefined) offsets[String(index)] = posFixModel(section.entries)
    } else if (name.startsWith("FORCE")) {
      forces.push(motiveModel(section.entries))
    }
  }
  model.keys = keys
  model.key_fix = tips
  model.offset = offsets
  model.force = forces
  model.type = type
  return model
}

function layoutJson(context: ExportContext, paths: string[] | undefined): Json {
  if (paths === undefined) return undefined
  const maps: Record<string, Json> = {}
  const cands: Record<string, Json> = {}
  const hints: Record<string, Json> = {}
  for (const path of paths) {
    if (path.endsWith(".ini")) {
      const name = palmBaseName(path)
      const type = boardTypeFromIniFileName(name) ?? name.replace(/\.ini/g, "")
      maps[type] = keyboardModel(context, path, type)
    } else if (path.endsWith(".cnd")) {
      cands[stripExtension(path)] = candidateModelFromFile(context, path)
    } else if (path.endsWith(".pop")) {
      hints[stripExtension(path)] = bubbleModelFromFile(context, path)
    }
  }
  fixTouchRects(maps)
  return { b: maps, c: cands, h: hints }
}

/* -------------------------------------------------------------------- style */

// `SkinInfoModel` ([STYLE*]).
function infoModel(entries: Ini, sectionName: string): Json {
  return {
    f: 0,
    id: sectionName,
    s_1: textStyleModel(entries),
    s_2: imageStyleModel(entries),
    s_3: borderStyleModel(entries),
    s_4: soundStyleModel(entries),
    s_5: animationStyleModel(entries),
  }
}

function textStyleModel(entries: Ini): Json {
  const keys = ["SHOW", "FONT_CLEARTYPE", "FONT_SIZE", "FONT_WEIGHT", "FONT_NAME", "NM_COLOR", "HL_COLOR", "FONT_PATH"]
  if (keys.every((key) => entries[key] === undefined)) return undefined
  const backKeys = ["SHOW", "FONT_CLEARTYPE", "FONT_SIZE", "FONT_WEIGHT", "FONT_NAME", "FONT_PATH"]
  return {
    text: entries["SHOW"],
    c_type: toInt(entries["FONT_CLEARTYPE"]),
    f_s: toDouble(entries["FONT_SIZE"]),
    f_w: toInt(entries["FONT_WEIGHT"]),
    f_n: entries["FONT_NAME"],
    c_normal: entries["NM_COLOR"],
    c_hl: entries["HL_COLOR"],
    file: entries["FONT_PATH"],
    for_back: backKeys.every((key) => entries[key] === undefined),
  }
}

function imageStyleModel(entries: Ini): Json {
  if (entries["NM_IMG"] === undefined && entries["HL_IMG"] === undefined) return undefined
  return { normal: entries["NM_IMG"], hl: entries["HL_IMG"] }
}

function borderStyleModel(entries: Ini): Json {
  const size = toDouble(entries["BORDER_SIZE"])
  if (size === undefined) return undefined
  return { size, color: entries["BORDER_COLOR"] }
}

function soundStyleModel(entries: Ini): Json {
  const path1 = entries["PRESS_SOUND_PATH"]
  const path2 = entries["PANEL_SHOW_SOUND_PATH"]
  const path3 = entries["PANEL_HIDE_SOUND_PATH"]
  if (path1 === undefined && path2 === undefined && path3 === undefined) return undefined
  return { path_1: path1, path_2: path2, path_3: path3 }
}

function animationStyleModel(entries: Ini): Json {
  const press = toInt(entries["PRESS_ANIM"])
  const release = toInt(entries["RELEASE_ANIM"])
  const show = toInt(entries["SHOW_ANIM"])
  const hide = toInt(entries["HIDE_ANIM"])
  const hold = toInt(entries["HOLD_ANIM"])
  if (press === undefined && release === undefined && show === undefined && hold === undefined && hide === undefined) {
    return undefined
  }
  return { "1": press, "2": release, "3": show, "4": hide, "5": hold }
}

// `SkinStyle` (s_info / s_land / s_port).
function styleJson(context: ExportContext, res: string[] | undefined): Json {
  const skinStyles: Record<string, Json> = {}
  const animStyles: Record<string, Json> = {}
  let skinTileMap: Record<string, Json> | undefined

  for (const section of readResource(context, res, "default.css") ?? []) {
    if (!section.name.startsWith("STYLE")) continue
    const index = indexKey(section.name, "STYLE")
    if (index === undefined) continue
    skinStyles[String(index)] = infoModel(section.entries, section.name)
  }

  for (const section of readResource(context, res, "anim.ini") ?? []) {
    if (!section.name.startsWith("ANIM") && !section.name.startsWith("BUILD_NUM")) continue
    const wrap = buildAnimationWrap(section)
    if (wrap === undefined) continue
    const index = indexKey(section.name, "ANIM")
    if (index === undefined) continue
    animStyles[String(index)] = wrap
  }

  if (res !== undefined) {
    const map: Record<string, Json> = {}
    for (const path of res) {
      if (!palmBaseName(path).toLowerCase().endsWith(".til")) continue
      const sections = sectionsOf(context, path)
      if (sections === undefined) continue
      map[stripExtension(path)] = tileModels(sections)
    }
    skinTileMap = map
  }

  return { ss_1: skinStyles, ss_2: animStyles, ss_3: [], ss_4: [], ss_5: [], info: skinTileMap }
}

/* ------------------------------------------------------------------ toolbar */

function toolbarItem(value: PalmPlistValue): Json | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined
  const record = value as Record<string, PalmPlistValue>
  const position = record["Position"]
  const name = record["Name"]
  const titles = record["Titles"]
  const images = record["Images"]
  if (typeof position !== "string" || typeof name !== "string") return undefined
  if (typeof titles !== "object" || titles === null || Array.isArray(titles)) return undefined
  const normalTitle = (titles as Record<string, PalmPlistValue>)["Normal"]
  if (typeof normalTitle !== "object" || normalTitle === null || Array.isArray(normalTitle)) return undefined
  const titleDetail = normalTitle as Record<string, PalmPlistValue>
  if (typeof titleDetail["Normal"] !== "string" || typeof titleDetail["Selected"] !== "string") return undefined
  if (typeof images !== "object" || images === null || Array.isArray(images)) return undefined
  const imageRecord = images as Record<string, PalmPlistValue>
  const normal = imageDetail(imageRecord["Normal"])
  const theme = imageDetail(imageRecord["Theme"])
  if (normal === undefined || theme === undefined) return undefined
  return {
    Position: position,
    Name: name,
    Titles: { Normal: { Normal: titleDetail["Normal"], Selected: titleDetail["Selected"] } },
    Images: { Normal: normal, Theme: theme },
  }
}

function imageDetail(value: PalmPlistValue | undefined): Json | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined
  const record = value as Record<string, PalmPlistValue>
  const normal = record["Normal"]
  if (typeof normal !== "string") return undefined
  const highlight = record["Highlight"]
  const selected = record["Selected"]
  return {
    Normal: normal,
    Highlight: typeof highlight === "string" ? highlight : undefined,
    Selected: typeof selected === "string" ? selected : undefined,
  }
}

function toolbarMenu(context: ExportContext, logo: string[]): Json {
  // `menu` is positional rather than a set, so it has to replay the converter's own
  // directory order instead of the sorted order `childPaths()` hands out elsewhere.
  const paths = logo
    .filter((path) => path.includes("toolbarMenuItems"))
    .sort(comparePalmDirectoryPaths)
  if (paths.length === 0) return undefined
  const result: Json[] = []
  for (const path of paths) {
    const bytes = context.root.bytes(path.slice(1))
    const plist = bytes === undefined ? undefined : parseXmlPlist(bytes)
    if (!Array.isArray(plist)) return undefined
    const items: Json[] = []
    for (const value of plist) {
      const item = toolbarItem(value)
      if (item === undefined) return undefined
      items.push(item)
    }
    result.push(items)
  }
  return result.length === 0 ? undefined : result
}

function menuIcon(context: ExportContext, logo: string[], name: string): Json {
  const path = logo.find((entry) => entry.includes(name))
  if (path === undefined) return undefined
  const sections = sectionsOf(context, path.slice(1))
  return sections === undefined ? undefined : tileModels(sections)
}

/* ------------------------------------------------------------------- struct */

function structModel(context: ExportContext, dir: string): SkinStruct {
  const skinDir = context.root.isDirectory(palmJoinPath(dir, "skin")) ? palmJoinPath(dir, "skin") : dir
  const res = filesPathInDirectory(context.root, palmJoinPath(skinDir, "res"))
  let portRes = filesPathInDirectory(context.root, palmJoinPath(skinDir, "port/res"))
  let landRes = filesPathInDirectory(context.root, palmJoinPath(skinDir, "land/res"))
  if (res !== undefined && res.length > 0) {
    if (portRes !== undefined) portRes = [...portRes, ...res]
    if (landRes !== undefined) landRes = [...landRes, ...res]
  }
  return {
    dir,
    themeSkinDir: skinDir,
    info: palmJoinPath(dir, "Info.txt"),
    land: context.root.filesInDirectory(palmJoinPath(skinDir, "land")),
    port: context.root.filesInDirectory(palmJoinPath(skinDir, "port")),
    res,
    portRes,
    landRes,
    logo: context.root.allFiles(palmJoinPath(skinDir, "res/logo")).map((path) => `/${path}`),
  }
}

// `FileManager.filesPathInDirectory(atURL:rootDir:)`: immediate children relative to root.
function filesPathInDirectory(root: PalmVirtualRoot, folder: string): string[] | undefined {
  if (!root.isDirectory(folder)) return undefined
  return root.childPaths(folder)
}

// `SkinFile.removeUselessPath()`.
function removeUselessPath(res: string[] | undefined): string[] | undefined {
  return res?.filter((path) => !path.endsWith(".til"))
}

function skinFileJson(context: ExportContext, struct: SkinStruct): Json {
  const res = removeUselessPath(struct.res)
  const portRes = removeUselessPath(struct.portRes)
  const landRes = removeUselessPath(struct.landRes)
  const logo = struct.logo.filter((path) => !path.endsWith(".plist"))
  const model: Record<string, Json> = {
    land_layout: layoutJson(context, struct.land),
    port_layout: layoutJson(context, struct.port),
    r_info: res,
    r_logo: logo,
    r_land: landRes,
    r_port: portRes,
    // The converter mirrors its temporary input folder, so `i` stays converter relative.
    i: PREVIEW_PREFIX + struct.info,
    s_info: styleJson(context, struct.res),
    dir: "",
    // `menu`/`a_m`/`a_i` are built during `parseINIFiles`, before `removeUselessPath()`
    // drops the `.plist` entries from `r_logo`, so they see the unfiltered list.
    menu: toolbarMenu(context, struct.logo),
    a_m: menuIcon(context, struct.logo, "pop_menu_icons.til"),
    a_i: menuIcon(context, struct.logo, "pop_input_icons.til"),
  }
  if (struct.portRes !== undefined) model.s_port = styleJson(context, struct.portRes)
  if (struct.landRes !== undefined) model.s_land = styleJson(context, struct.landRes)
  return model
}

/* --------------------------------------------------------------- info.json */

function skinInfoJson(context: ExportContext, infoPath: string): Json {
  const bytes = context.root.bytes(infoPath)
  const text = bytes === undefined ? undefined : decodeSkinText(bytes)
  if (text === undefined) {
    return {
      name: "default",
      description: "",
      author: "",
      platform: "ia",
      tool_version: 3,
      core_ability: 0,
      dark_mode: true,
      layoutSupport: true,
      splitImage: false,
    }
  }
  let name = ""
  let description = ""
  let author = ""
  let darkMode: boolean | undefined
  let ability: number | undefined
  for (const line of text.replace(/\r\n/g, "\n").split("\n")) {
    const parts = line.split("=")
    if (parts.length !== 2) continue
    const key = parts[0].trim()
    const value = parts[1].trim()
    if (key === "Name") name = value
    else if (key === "Description") description = value
    else if (key === "Author") author = value
    else if (key === "SupportDarkMode") darkMode = toBool(value) ?? false
    else if (key === "MinImeCode") ability = toInt(value) ?? 0
  }
  return {
    name,
    description,
    author,
    platform: "ia",
    tool_version: 3,
    core_ability: ability ?? 0,
    dark_mode: darkMode ?? false,
    layoutSupport: true,
    splitImage: false,
  }
}

/* ------------------------------------------------------------------- output */

function collectConverterEntries(archive: SkinArchive): ConverterEntry[] {
  const raws = archive.names().map((canonical) => {
    const raw = archive.sourcePath(canonical)
    return { canonical, raw, normalized: normalizePalmPath(raw), directory: raw.endsWith("/") }
  })
  const usesSkinRoot = raws.some(({ normalized }) => normalized === "skin" || normalized.startsWith("skin/"))
  const entries: ConverterEntry[] = []
  for (const item of raws) {
    let path = item.normalized
    if (usesSkinRoot) {
      if (!path.startsWith("skin/")) continue
      path = path.slice("skin/".length)
    }
    if (!path) continue
    entries.push({
      path,
      directory: item.directory,
      bytes: item.directory ? undefined : archive.getBytes(item.canonical),
    })
  }
  return entries
}

// Folders that survive the deletion passes with no file left inside them still need an
// explicit zip entry: the real `.sxi` keeps, for example, `light/skin/land/`.
function emptyDirectories(entries: ConverterEntry[], written: Iterable<string>): string[] {
  const directories = new Set<string>()
  for (const entry of entries) {
    const parts = entry.path.split("/")
    const parentParts = entry.directory ? parts : parts.slice(0, -1)
    let parent = ""
    for (const part of parentParts) {
      parent = parent ? `${parent}/${part}` : part
      directories.add(parent)
    }
  }
  const populated = new Set<string>()
  for (const path of written) {
    const parts = path.split("/")
    let current = ""
    for (const part of parts.slice(0, -1)) {
      current = current ? `${current}/${part}` : part
      populated.add(current)
    }
  }
  return [...directories].filter((directory) => !populated.has(directory)).sort()
}

export function buildSxiZip(archive: SkinArchive): { bytes: Uint8Array; warnings: string[] } {
  if (archive.format === "bda") {
    // BDA packages carry protobuf panels instead of an INI layout tree, so a caller that
    // reaches this point must convert the archive first (see `convertBdaToBaseLayout`).
    throw new Error("BDA 皮肤需要先转换为 BDI/BDS 布局再导出手心皮肤（.sxi）")
  }

  const entries = collectConverterEntries(archive)
  const warnings: string[] = []
  const context: ExportContext = {
    root: new PalmVirtualRoot(entries.map((entry) => ({ path: entry.path, bytes: entry.bytes }))),
    warnings,
    sections: new Map(),
  }

  const skinDir = context.root.isDirectory("skin") ? "skin" : ""
  const infoPath = palmJoinPath(skinDir, "Info.txt")
  const lightStruct = structModel(context, palmJoinPath(skinDir, "light"))
  const darkStruct = structModel(context, palmJoinPath(skinDir, "dark"))
  const hasLight = context.root.isDirectory(palmJoinPath(skinDir, "light"))
  const hasDark = context.root.isDirectory(palmJoinPath(skinDir, "dark"))

  const skin: Record<string, Json> = {
    root: "",
    default: skinFileJson(context, hasLight ? lightStruct : structModel(context, skinDir)),
    night: hasDark ? skinFileJson(context, darkStruct) : undefined,
    info: skinInfoJson(context, infoPath),
    demo: undefined,
  }

  const files: Record<string, Uint8Array> = {
    "skin.json": new TextEncoder().encode(encodePalmJSON(skin)),
    "info.json": new TextEncoder().encode(encodePalmJSON(skinJsonInfo(skin))),
  }
  const written = new Set<string>()
  for (const entry of entries) {
    if (entry.directory) continue
    if (DELETED_EXTENSIONS.has(fileExtension(entry.path))) continue
    const preview = previewPath(entry.path)
    const name = preview !== undefined && files[preview] === undefined ? preview : entry.path
    files[name] = entry.bytes ?? new Uint8Array()
    written.add(name)
  }
  for (const directory of emptyDirectories(entries, written)) {
    files[`${directory}/`] = new Uint8Array()
  }

  // `copyLayoutIfNeed` copies the bundled `native_325.json` into the output folder so a
  // standalone skin can resolve its `native` specify-layout. The Swift call is `try?`, so a
  // source file already named `native.layout` survives untouched.
  if (files["native.layout"] === undefined) {
    files["native.layout"] = new TextEncoder().encode(NATIVE_LAYOUT_JSON)
  }

  return { bytes: zipSync(files, { level: 6 }), warnings }
}

function skinJsonInfo(skin: Record<string, Json>): Json {
  return skin.info
}

function previewPath(path: string): string | undefined {
  const separator = path.lastIndexOf("/")
  const parent = separator < 0 ? "" : path.slice(0, separator + 1)
  if (path.slice(parent.length) !== "demo.png") return undefined
  return PREVIEW_DIRECTORIES.has(parent) ? `${parent}preview.png` : undefined
}
