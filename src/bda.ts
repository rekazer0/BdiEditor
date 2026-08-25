type ProtoField = {
  number: number
  wire: number
  varint?: number
  fixed32?: number
  bytes?: Uint8Array
}

export type BdaResource = { type: number; resourceID: string }
export type BdaStyleRef = { type: "image" | "color" | "text"; key: number }
export type BdaRect = { x: number; y: number; width: number; height: number }
export type BdaScaledOffset = { x: number; y: number }
export type BdaFontAdaptInfo = {
  fontSize?: number
  normalColor?: number
  highlightColor?: number
  contentText?: string
  scaledOffset?: BdaScaledOffset
  drawType?: number
}
export type BdaImageAtom = {
  resource?: BdaResource
  innerRect?: BdaRect
  contentInset?: { top: number; left: number; bottom: number; right: number }
  alpha?: number
  filterColor?: number
}
export type BdaImageStyle = {
  normalImage?: BdaImageAtom
  highlightImage?: BdaImageAtom
  fontInfo?: BdaFontAdaptInfo
}
export type BdaTextStyle = {
  resource?: BdaResource
  fontName?: string
  fontSize?: number
  normalColor?: number
  highlightColor?: number
  contentText?: string
}
export type BdaColorStyle = { normalColor?: number; highlightColor?: number }
export type BdaKey = {
  backStyle?: BdaStyleRef
  foreStyles: BdaStyleRef[]
  foreStyleOffsets: Array<{ x: number; y: number }>
  backStyleState?: BdaStyleRef
}
export type BdaBar = { backStyle?: BdaStyleRef }
export type BdaTab = {
  backStyle?: BdaStyleRef
  cellForeStyle?: BdaStyleRef
  cellBackStyle?: BdaStyleRef
  decoratorBackStyle?: BdaStyleRef
}
export type BdaCorpusList = {
  backStyle?: BdaStyleRef
  cellForeStyle?: BdaStyleRef
  cellBackStyle?: BdaStyleRef
  corpusSecondTab?: BdaTab
}
export type BdaGamePanel = {
  backStyle?: BdaStyleRef
  corpusFirstTab?: BdaTab
  corpusList?: BdaCorpusList
  functionBar?: BdaBar
  keys: Map<string, BdaKey>
}
export type BdaSwitch = {
  normalBack?: BdaStyleRef
  selectBack?: BdaStyleRef
  normalFore?: BdaStyleRef
  selectFore?: BdaStyleRef
}
export type BdaCand = {
  candBarStyle?: BdaStyleRef
  candOnBarStyle?: BdaStyleRef
  cellBackStyle?: BdaStyleRef
  cellForeStyle?: BdaStyleRef
  firstCellForeStyle?: BdaStyleRef
  firstCellBackStyle?: BdaStyleRef
  subCandCellForeStyle?: BdaStyleRef
  subCandCellBackStyle?: BdaStyleRef
  switch?: BdaSwitch
  candKeys: Map<string, BdaKey>
  subCandBackStyle?: BdaStyleRef
  menuKeys: Map<string, BdaKey>
  aiIcon?: BdaKey
  accessoryBackStyle?: BdaStyleRef
  gridLeftForeStyle?: BdaStyleRef
  gridRightForeStyle?: BdaStyleRef
}
export type BdaList = {
  backStyle?: BdaStyleRef
  cellBackStyle?: BdaStyleRef
  cellForeStyle?: BdaStyleRef
  foreStyles: BdaStyleRef[]
  foreStyleOffsets: BdaScaledOffset[]
}
export type BdaHint = {
  offset?: BdaScaledOffset
  backStyle?: BdaStyleRef
  barStyle?: BdaStyleRef
  barOffset?: BdaScaledOffset
  foreStyle?: BdaStyleRef
  cellStyle?: BdaStyleRef
}
export type BdaInputTile = { backStyle?: BdaStyleRef; textStyle?: BdaStyleRef }
export type BdaGrid = {
  backStyle?: BdaStyleRef
  cellForeStyle?: BdaStyleRef
  cellBackStyle?: BdaStyleRef
}
export type BdaPanel = {
  hints: Map<string, BdaHint>
  lists: Map<string, BdaList>
  keys: Map<string, BdaKey>
  cand?: BdaCand
  input?: BdaInputTile
  more?: BdaGrid
  backStyle?: BdaStyleRef
  shouldBgBlur?: boolean
  wholeBackStyle?: BdaStyleRef
  shouldKeySlotting?: boolean
  inputRegionBackStyle?: BdaStyleRef
  trackColor?: number
}
export type BdaColorPalette = {
  labelColor?: number
  secondaryLabelColor?: number
  tertiaryLabelColor?: number
  quaternaryLabelColor?: number
  brandColor?: number
  systemBackgroundColor?: number
  secondarySystemBackgroundColor?: number
  tertiarySystemBackgroundColor?: number
  elevatedSystemBackgroundColor?: number
  secondaryElevatedSystemBackgroundColor?: number
  tertiaryElevatedSystemBackgroundColor?: number
  systemGroupedBackgroundColor?: number
  secondarySystemGroupedBackgroundColor?: number
  tertiarySystemGroupedBackgroundColor?: number
  separatorColor?: number
  opaqueSeparatorColor?: number
  systemFillColor?: number
  secondarySystemFillColor?: number
  tertiarySystemFillColor?: number
  quaternarySystemFillColor?: number
  maskColor?: number
  maskBlurColor?: number
  bulletWindowColor?: number
  opaqueBulletWindowColor?: number
  editBlueColor?: number
  editDeepBlueColor?: number
  editRedColor?: number
}
export type BdaAppearance = {
  designWidth?: number
  imageStyles: Map<number, BdaImageStyle>
  textStyles: Map<number, BdaTextStyle>
  colorStyles: Map<number, BdaColorStyle>
  panels: Map<string, BdaPanel>
  colorPalette?: BdaColorPalette
  gamePanel?: BdaGamePanel
  dragBar?: BdaBar
}
export type BdaAnimationFrame = { resourceID?: string; duration?: number }
export type BdaAnimationSequence = { name: string; frames: BdaAnimationFrame[] }
export type BdaAnimation = {
  targets: string[]
  sequences: Map<string, BdaAnimationSequence>
  bindings: Map<string, string>
}
export type BdaSoundConfig = {
  keySounds: Map<string, BdaResource>
  iosKeySounds: Map<string, BdaResource>
}
export type BdaConfigKind = "appearance" | "animation" | "lightAnimation" | "sound" | "switch"

const STYLE_BASE = { image: 1_000_000, color: 2_000_000, text: 3_000_000 } as const

export function bdaStyleID(style: BdaStyleRef | undefined): string {
  return style ? String(STYLE_BASE[style.type] + style.key) : ""
}

export function bdaStyleRef(styleID: string): BdaStyleRef | undefined {
  const value = Number(styleID)
  if (!Number.isInteger(value)) return
  for (const type of ["image", "color", "text"] as const) {
    const key = value - STYLE_BASE[type]
    if (key >= 0 && key < 1_000_000) return { type, key }
  }
}

export function bdaAppearancePath(
  archive: SkinArchive,
  theme: string,
  orientation: string,
): string | undefined {
  return bdaConfigPath(archive, theme, orientation, "appearance")
}

export function bdaConfigPath(
  archive: SkinArchive,
  theme: string,
  orientation: string,
  kind: BdaConfigKind,
): string | undefined {
  const prefix = `${theme}/skin/${orientation}/`
  const config = new RegExp(`^\\d*${kind}Config$`)
  return archive.names().find((path) => path.startsWith(prefix) && config.test(path.slice(prefix.length)))
}

export function bdaPanelKeyName(action: string): string {
  return `KEY_${action.trim().toUpperCase()}`
}

function bdaCandKeyName(action: string): string {
  return `CAND_${action.trim().toUpperCase()}`
}

function setBdaStyle(document: IniDocument, section: string, property: string, style: BdaStyleRef | undefined): void {
  if (style) document.set(section, property, bdaStyleID(style))
}

function applyBdaKey(document: IniDocument, section: string, key: BdaKey): void {
  setBdaStyle(document, section, "BACK_STYLE", key.backStyle)
  setBdaStyle(document, section, "HL_BACK_STYLE", key.backStyleState)
  if (key.foreStyles.length) document.set(section, "FORE_STYLE", key.foreStyles.map(bdaStyleID).join(","))
  if (!key.foreStyleOffsets.length) return
  const rect = (document.get(section, "VIEW_RECT") ?? document.get(section, "SIZE"))?.split(",").map(Number)
  const width = rect?.at(-2) ?? 0
  const height = rect?.at(-1) ?? 0
  document.set(section, "FORE_OFFSET", key.foreStyleOffsets
    .map(({ x, y }) => `${Math.trunc(x * width)},${Math.trunc(y * height)}`)
    .join(";"))
}

function applyBdaStateKeys(
  document: IniDocument,
  sections: string[],
  keys: Map<string, BdaKey>,
  name: (action: string) => string,
): void {
  for (const section of sections) {
    const action = document.get(section, /^ICON|^TIP/.test(section) ? "KEY" : "CENTER") ??
      document.get(section, "DOWN")
    const states = document.get(section, "STAT_STYLE")
    if (!action || !states) continue
    for (const match of states.matchAll(/S(\d+)_(\d+)/g)) {
      const key = keys.get(`${name(action)}_S${match[1]}`)
      if (key) applyBdaKey(document, `TIP${match[2]}`, key)
    }
  }
}

export function bdaLayoutDocument(base: IniDocument, appearance: BdaAppearance, layout: string): IniDocument {
  const document = IniDocument.parse(base.toString())
  const panel = appearance.panels.get(layout.replace(/\.ini$/i, ""))
  if (!panel) return document
  const sections = document.sections()
  const keySections = sections.filter((name) => /^KEY\d+$/.test(name))
  for (const section of keySections) {
    const actions = [document.get(section, "CENTER"), document.get(section, "DOWN")]
      .filter((value): value is string => Boolean(value))
    const key = actions.map(bdaPanelKeyName).map((name) => panel.keys.get(name)).find(Boolean)
    if (key) applyBdaKey(document, section, key)
  }
  applyBdaStateKeys(document, keySections, panel.keys, bdaPanelKeyName)

  setBdaStyle(document, "PANEL", "BACK_STYLE", panel.backStyle)
  setBdaStyle(document, "INPUT", "BACK_STYLE", panel.input?.backStyle)
  setBdaStyle(document, "INPUT", "FORE_STYLE", panel.input?.textStyle)
  setBdaStyle(document, "MORE", "BACK_STYLE", panel.more?.backStyle)
  setBdaStyle(document, "MORE", "FORE_STYLE", panel.more?.cellForeStyle)
  setBdaStyle(document, "MORE", "CELL_STYLE", panel.more?.cellBackStyle)

  const list = panel.lists.get("port") ?? panel.lists.values().next().value
  setBdaStyle(document, "LIST", "BACK_STYLE", list?.backStyle)
  setBdaStyle(document, "LIST", "FORE_STYLE", list?.cellForeStyle)
  setBdaStyle(document, "LIST", "CELL_STYLE", list?.cellBackStyle)

  const cand = panel.cand
  setBdaStyle(document, "CAND", "BACK_STYLE", cand?.candBarStyle)
  setBdaStyle(document, "CAND", "FORE_STYLE", cand?.cellForeStyle)
  setBdaStyle(document, "CAND", "CELL_STYLE", cand?.cellBackStyle)
  setBdaStyle(document, "CAND", "FIRST_FORE", cand?.firstCellForeStyle)
  setBdaStyle(document, "SWITCH", "NML_BACK_STYLE", cand?.switch?.normalBack)
  setBdaStyle(document, "SWITCH", "SEL_BACK_STYLE", cand?.switch?.selectBack)
  setBdaStyle(document, "SWITCH", "NML_FONT_STYLE", cand?.switch?.normalFore)
  setBdaStyle(document, "SWITCH", "SEL_FONT_STYLE", cand?.switch?.selectFore)
  const candSections = sections.filter((name) => /^(?:ICON|TIP)\d+$/.test(name))
  for (const section of candSections) {
    const action = document.get(section, "KEY")
    const key = action && cand?.candKeys.get(bdaCandKeyName(action))
    if (key) applyBdaKey(document, section, key)
  }
  if (cand) applyBdaStateKeys(document, candSections, cand.candKeys, bdaCandKeyName)

  const fallbackHint = panel.hints.get("port") ?? panel.hints.values().next().value
  const shortHint = panel.hints.get("short") ?? fallbackHint
  const longHint = panel.hints.get("long") ?? fallbackHint
  if ((shortHint || longHint) && sections.includes("GLOBAL")) {
    const backIcon = document.get("HINT", "BACK_ICON")
    if (backIcon && shortHint) {
      const section = `ICON${backIcon}`
      setBdaStyle(document, section, "BACK_STYLE", shortHint.backStyle)
      setBdaStyle(document, section, "FORE_STYLE", shortHint.foreStyle)
      const size = document.get(section, "SIZE")?.split(",").map(Number)
      if (shortHint.offset && size?.length === 2) {
        document.set(section, "POS", `${Math.trunc(shortHint.offset.x * size[0])},${Math.trunc(shortHint.offset.y * size[1])}`)
      }
    }
    const longIcon = document.get("BAR", "BACK_ICON")
    if (longIcon && longHint) {
      const section = `ICON${longIcon}`
      setBdaStyle(document, section, "BACK_STYLE", longHint.backStyle)
      setBdaStyle(document, section, "FORE_STYLE", longHint.foreStyle)
      const size = document.get(section, "SIZE")?.split(",").map(Number)
      if (longHint.offset && size?.length === 2) {
        document.set(section, "POS", `${Math.trunc(longHint.offset.x * size[0])},${Math.trunc(longHint.offset.y * size[1])}`)
      }
    }
    const barIcon = document.get("BAR", "ARROW_ICON")
    if (barIcon && longHint) {
      const section = `ICON${barIcon}`
      setBdaStyle(document, section, "BACK_STYLE", longHint.barStyle)
      const size = document.get(section, "SIZE")?.split(",").map(Number)
      if (longHint.barOffset && size?.length === 2) {
        document.set(section, "POS", `${Math.trunc(longHint.barOffset.x * size[0])},${Math.trunc(longHint.barOffset.y * size[1])}`)
      }
    }
    setBdaStyle(document, "BAR", "CELL_STYLE", longHint?.cellStyle)
  }
  return document
}

const decoder = new TextDecoder("utf-8", { fatal: true })

function fields(bytes: Uint8Array): ProtoField[] {
  const result: ProtoField[] = []
  let offset = 0
  const varint = () => {
    let value = 0n
    let shift = 0n
    for (let count = 0; offset < bytes.length && count < 10; count++) {
      const byte = bytes[offset++]
      value |= BigInt(byte & 0x7f) << shift
      if (!(byte & 0x80)) {
        return value <= BigInt(Number.MAX_SAFE_INTEGER)
          ? Number(value)
          : Number(BigInt.asIntN(32, value))
      }
      shift += 7n
    }
    throw new Error("无效的 protobuf varint")
  }
  while (offset < bytes.length) {
    const tag = varint()
    const number = Math.floor(tag / 8)
    const wire = tag & 7
    if (!number) throw new Error("无效的 protobuf 字段")
    if (wire === 0) result.push({ number, wire, varint: varint() })
    else if (wire === 1) {
      offset += 8
      result.push({ number, wire })
    } else if (wire === 2) {
      const length = varint()
      if (offset + length > bytes.length) throw new Error("不完整的 protobuf 字段")
      result.push({ number, wire, bytes: bytes.slice(offset, offset + length) })
      offset += length
    } else if (wire === 5) {
      if (offset + 4 > bytes.length) throw new Error("不完整的 protobuf 字段")
      result.push({ number, wire, fixed32: new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getFloat32(0, true) })
      offset += 4
    } else throw new Error(`不支持的 protobuf wire type：${wire}`)
    if (offset > bytes.length) throw new Error("不完整的 protobuf 字段")
  }
  return result
}

function message(field: ProtoField | undefined): ProtoField[] {
  return field?.bytes ? fields(field.bytes) : []
}

function string(field: ProtoField | undefined): string {
  if (!field?.bytes) return ""
  try {
    return decoder.decode(field.bytes)
  } catch {
    return ""
  }
}

function first(items: ProtoField[], number: number): ProtoField | undefined {
  return items.find((field) => field.number === number)
}

function mapEntries(items: ProtoField[], number: number): ProtoField[][] {
  return items
    .filter((field) => field.number === number && field.wire === 2)
    .map(message)
}

function resource(field: ProtoField | undefined): BdaResource | undefined {
  const value = message(field)
  if (!value.length) return
  return {
    type: first(value, 1)?.varint ?? 0,
    resourceID: string(first(value, 2)),
  }
}

function styleRef(field: ProtoField | undefined): BdaStyleRef | undefined {
  const value = message(field)
  if (!value.length) return
  const types = ["image", "color", "text"] as const
  return { type: types[first(value, 1)?.varint ?? 0] ?? "image", key: first(value, 2)?.varint ?? 0 }
}

function styleRefs(value: ProtoField[], number: number): BdaStyleRef[] {
  return value.filter((item) => item.number === number).flatMap((item) => {
    const style = styleRef(item)
    return style ? [style] : []
  })
}

function float(value: ProtoField[], number: number): number {
  return first(value, number)?.fixed32 ?? 0
}

function scaledOffset(field: ProtoField | undefined): BdaScaledOffset | undefined {
  if (!field) return
  const value = message(field)
  return { x: float(value, 1), y: float(value, 2) }
}

function stringMap<T>(value: ProtoField[], number: number, decode: (field: ProtoField | undefined) => T): Map<string, T> {
  return new Map(mapEntries(value, number).map((entry) => [
    string(first(entry, 1)),
    decode(first(entry, 2)),
  ]))
}

function rect(field: ProtoField | undefined): BdaRect | undefined {
  const value = message(field)
  if (!value.length) return
  const original = message(first(value, 1))
  const size = message(first(value, 2))
  return {
    x: first(original, 1)?.varint ?? float(original, 3),
    y: first(original, 2)?.varint ?? float(original, 4),
    width: first(size, 1)?.varint ?? float(size, 3),
    height: first(size, 2)?.varint ?? float(size, 4),
  }
}

function imageAtom(field: ProtoField | undefined): BdaImageAtom | undefined {
  const value = message(field)
  if (!value.length) return
  const inset = message(first(value, 3))
  return {
    resource: resource(first(value, 1)),
    innerRect: rect(first(value, 2)),
    contentInset: inset.length ? {
      top: float(inset, 1),
      left: float(inset, 2),
      bottom: float(inset, 3),
      right: float(inset, 4),
    } : undefined,
    alpha: first(value, 4)?.fixed32,
    filterColor: first(value, 5)?.varint,
  }
}

function imageStyle(field: ProtoField | undefined): BdaImageStyle {
  const value = message(field)
  const font = message(first(value, 3))
  return {
    normalImage: imageAtom(first(value, 1)),
    highlightImage: imageAtom(first(value, 2)),
    fontInfo: font.length ? {
      fontSize: first(font, 1)?.varint,
      normalColor: first(font, 2)?.varint,
      highlightColor: first(font, 3)?.varint,
      contentText: first(font, 4) ? string(first(font, 4)) : undefined,
      scaledOffset: scaledOffset(first(font, 5)),
      drawType: first(font, 6)?.varint,
    } : undefined,
  }
}

function textStyle(field: ProtoField | undefined): BdaTextStyle {
  const value = message(field)
  return {
    resource: resource(first(value, 1)),
    fontName: first(value, 2) ? string(first(value, 2)) : undefined,
    fontSize: first(value, 3)?.varint,
    normalColor: first(value, 4)?.varint,
    highlightColor: first(value, 5)?.varint,
    contentText: first(value, 6) ? string(first(value, 6)) : undefined,
  }
}

function colorStyle(field: ProtoField | undefined): BdaColorStyle {
  const value = message(field)
  return {
    normalColor: first(value, 1)?.varint,
    highlightColor: first(value, 2)?.varint,
  }
}

function key(field: ProtoField | undefined): BdaKey {
  const value = message(field)
  return {
    backStyle: styleRef(first(value, 1)),
    foreStyles: styleRefs(value, 2),
    foreStyleOffsets: value.filter((item) => item.number === 3).flatMap((item) => {
      const offset = scaledOffset(item)
      return offset ? [offset] : []
    }),
    backStyleState: styleRef(first(value, 4)),
  }
}

function bar(field: ProtoField | undefined): BdaBar | undefined {
  const value = message(field)
  return value.length ? { backStyle: styleRef(first(value, 1)) } : undefined
}

function tab(field: ProtoField | undefined): BdaTab | undefined {
  const value = message(field)
  return value.length ? {
    backStyle: styleRef(first(value, 1)),
    cellForeStyle: styleRef(first(value, 2)),
    cellBackStyle: styleRef(first(value, 3)),
    decoratorBackStyle: styleRef(first(value, 4)),
  } : undefined
}

function corpusList(field: ProtoField | undefined): BdaCorpusList | undefined {
  const value = message(field)
  return value.length ? {
    backStyle: styleRef(first(value, 1)),
    cellForeStyle: styleRef(first(value, 2)),
    cellBackStyle: styleRef(first(value, 3)),
    corpusSecondTab: tab(first(value, 4)),
  } : undefined
}

function gamePanel(field: ProtoField | undefined): BdaGamePanel | undefined {
  const value = message(field)
  return value.length ? {
    backStyle: styleRef(first(value, 1)),
    corpusFirstTab: tab(first(value, 2)),
    corpusList: corpusList(first(value, 3)),
    functionBar: bar(first(value, 4)),
    keys: stringMap(value, 5, key),
  } : undefined
}

function switchStyle(field: ProtoField | undefined): BdaSwitch | undefined {
  const value = message(field)
  return value.length ? {
    normalBack: styleRef(first(value, 1)),
    selectBack: styleRef(first(value, 2)),
    normalFore: styleRef(first(value, 3)),
    selectFore: styleRef(first(value, 4)),
  } : undefined
}

function cand(field: ProtoField | undefined): BdaCand | undefined {
  const value = message(field)
  return value.length ? {
    candBarStyle: styleRef(first(value, 1)),
    candOnBarStyle: styleRef(first(value, 2)),
    cellBackStyle: styleRef(first(value, 3)),
    cellForeStyle: styleRef(first(value, 4)),
    firstCellForeStyle: styleRef(first(value, 5)),
    firstCellBackStyle: styleRef(first(value, 6)),
    subCandCellForeStyle: styleRef(first(value, 7)),
    subCandCellBackStyle: styleRef(first(value, 8)),
    switch: switchStyle(first(value, 9)),
    candKeys: stringMap(value, 10, key),
    subCandBackStyle: styleRef(first(value, 11)),
    menuKeys: stringMap(value, 12, key),
    aiIcon: first(value, 13) ? key(first(value, 13)) : undefined,
    accessoryBackStyle: styleRef(first(value, 14)),
    gridLeftForeStyle: styleRef(first(value, 15)),
    gridRightForeStyle: styleRef(first(value, 16)),
  } : undefined
}

function list(field: ProtoField | undefined): BdaList {
  const value = message(field)
  return {
    backStyle: styleRef(first(value, 1)),
    cellBackStyle: styleRef(first(value, 2)),
    cellForeStyle: styleRef(first(value, 3)),
    foreStyles: styleRefs(value, 4),
    foreStyleOffsets: value.filter((item) => item.number === 5).flatMap((item) => {
      const offset = scaledOffset(item)
      return offset ? [offset] : []
    }),
  }
}

function hint(field: ProtoField | undefined): BdaHint {
  const value = message(field)
  return {
    offset: scaledOffset(first(value, 1)),
    backStyle: styleRef(first(value, 2)),
    barStyle: styleRef(first(value, 3)),
    barOffset: scaledOffset(first(value, 4)),
    foreStyle: styleRef(first(value, 5)),
    cellStyle: styleRef(first(value, 6)),
  }
}

function inputTile(field: ProtoField | undefined): BdaInputTile | undefined {
  const value = message(field)
  return value.length ? {
    backStyle: styleRef(first(value, 1)),
    textStyle: styleRef(first(value, 2)),
  } : undefined
}

function grid(field: ProtoField | undefined): BdaGrid | undefined {
  const value = message(field)
  return value.length ? {
    backStyle: styleRef(first(value, 1)),
    cellForeStyle: styleRef(first(value, 2)),
    cellBackStyle: styleRef(first(value, 3)),
  } : undefined
}

function panel(field: ProtoField | undefined): BdaPanel {
  const value = message(field)
  return {
    hints: stringMap(value, 1, hint),
    lists: stringMap(value, 2, list),
    keys: stringMap(value, 3, key),
    cand: cand(first(value, 4)),
    input: inputTile(first(value, 5)),
    more: grid(first(value, 6)),
    backStyle: styleRef(first(value, 7)),
    shouldBgBlur: first(value, 8) ? first(value, 8)?.varint !== 0 : undefined,
    trackColor: first(value, 9)?.varint,
    wholeBackStyle: styleRef(first(value, 10)),
    shouldKeySlotting: first(value, 11) ? first(value, 11)?.varint !== 0 : undefined,
    inputRegionBackStyle: styleRef(first(value, 12)),
  }
}

const paletteFields = [
  "labelColor", "secondaryLabelColor", "tertiaryLabelColor", "quaternaryLabelColor", "brandColor",
  "systemBackgroundColor", "secondarySystemBackgroundColor", "tertiarySystemBackgroundColor",
  "elevatedSystemBackgroundColor", "secondaryElevatedSystemBackgroundColor", "tertiaryElevatedSystemBackgroundColor",
  "systemGroupedBackgroundColor", "secondarySystemGroupedBackgroundColor", "tertiarySystemGroupedBackgroundColor",
  "separatorColor", "opaqueSeparatorColor", "systemFillColor", "secondarySystemFillColor", "tertiarySystemFillColor",
  "quaternarySystemFillColor", "maskColor", "maskBlurColor", "bulletWindowColor", "opaqueBulletWindowColor",
  "editBlueColor", "editDeepBlueColor", "editRedColor",
] as const satisfies readonly (keyof BdaColorPalette)[]

function colorPalette(field: ProtoField | undefined): BdaColorPalette | undefined {
  const value = message(field)
  if (!value.length) return
  const result: BdaColorPalette = {}
  paletteFields.forEach((name, index) => {
    const color = first(value, index + 1)?.varint
    if (color !== undefined) result[name] = color
  })
  return result
}

function numericMap<T>(root: ProtoField[], number: number, decode: (field: ProtoField | undefined) => T): Map<number, T> {
  return new Map(mapEntries(root, number).map((entry) => [
    first(entry, 1)?.varint ?? 0,
    decode(first(entry, 2)),
  ]))
}

export function decodeBdaAppearance(bytes: Uint8Array): BdaAppearance {
  const root = fields(bytes)
  return {
    designWidth: first(root, 6)?.varint,
    imageStyles: numericMap(root, 1, imageStyle),
    textStyles: numericMap(root, 2, textStyle),
    colorStyles: numericMap(root, 3, colorStyle),
    panels: new Map(mapEntries(root, 4).map((entry) => [
      string(first(entry, 1)),
      panel(first(entry, 2)),
    ])),
    colorPalette: colorPalette(first(root, 5)),
    gamePanel: gamePanel(first(root, 7)),
    dragBar: bar(first(root, 8)),
  }
}

export function decodeBdaAnimation(bytes: Uint8Array): BdaAnimation {
  const root = fields(bytes)
  const sequences = mapEntries(root, 9).map((entry) => {
    const name = string(first(entry, 1))
    const sequence = message(first(entry, 2))
    const frames = sequence.filter((field) => field.number === 5).map((field) => {
      const frame = message(field)
      return {
        resourceID: first(message(first(frame, 1)), 2)
          ? string(first(message(first(frame, 1)), 2))
          : undefined,
        duration: first(frame, 2)?.varint,
      }
    })
    return [name, { name, frames }] as const
  })
  const animationMap = mapEntries(root, 1).map((entry) => {
    const target = string(first(entry, 1))
    const list = message(first(entry, 2))
    const base = list.filter((field) => field.number === 1).map(message)
      .find((item) => first(item, 3)?.varint === 1)
    const isolated = list.filter((field) => field.number === 2).map(message)
      .find((item) => first(item, 2)?.varint === 1)
    return {
      target,
      sequence: string(first(base ?? [], 4)) || string(first(isolated ?? [], 3)),
      delegate: string(first(list, 3)),
    }
  }).filter(({ target }) => Boolean(target))
  const direct = new Map(animationMap.flatMap(({ target, sequence }) => sequence ? [[target, sequence] as const] : []))
  const delegates = new Map(animationMap.flatMap(({ target, delegate }) => delegate ? [[target, delegate] as const] : []))
  const binding = (target: string, seen = new Set<string>()): string | undefined => {
    if (seen.has(target)) return
    const sequence = direct.get(target)
    if (sequence) return sequence
    seen.add(target)
    const delegate = delegates.get(target)
    return delegate ? binding(delegate, seen) : undefined
  }
  return {
    targets: animationMap.map(({ target }) => target),
    sequences: new Map(sequences.filter(([name]) => Boolean(name))),
    bindings: new Map(animationMap.flatMap(({ target }) => {
      const sequence = binding(target)
      return sequence ? [[target, sequence] as const] : []
    })),
  }
}

export function decodeBdaSoundConfig(bytes: Uint8Array): BdaSoundConfig {
  const root = fields(bytes)
  const soundMap = (fieldNumber: number) => new Map(mapEntries(root, fieldNumber).flatMap((entry) => {
    const key = string(first(entry, 1))
    const value = resource(first(entry, 2))
    return key && value ? [[key, value] as const] : []
  }))
  return {
    keySounds: soundMap(1),
    iosKeySounds: soundMap(3),
  }
}

export function bdaLayoutNames(bytes: Uint8Array): string[] {
  return [...decodeBdaAppearance(bytes).panels.keys()]
}

export function bdaResourceIDs(bytes: Uint8Array): string[] {
  const appearance = decodeBdaAppearance(bytes)
  return [...new Set([
    ...[...appearance.imageStyles.values()].flatMap((style) => [
      style.normalImage?.resource?.resourceID,
      style.highlightImage?.resource?.resourceID,
    ]),
    ...[...appearance.textStyles.values()].map((style) => style.resource?.resourceID),
  ].filter((value): value is string => Boolean(value)))]
}

export function bdaColorHex(value: number): string {
  return (value >>> 0).toString(16).padStart(8, "0").toUpperCase()
}

function bdaCssColor(value: number): string | undefined {
  if (!value) return
  const hex = bdaColorHex(value)
  const alpha = Number.parseInt(hex.slice(0, 2), 16) / 255
  const red = Number.parseInt(hex.slice(2, 4), 16)
  const green = Number.parseInt(hex.slice(4, 6), 16)
  const blue = Number.parseInt(hex.slice(6, 8), 16)
  return `rgba(${red}, ${green}, ${blue}, ${Number(alpha.toFixed(3))})`
}

// BDA filterColor 是叠加在图片之上的颜色滤镜（tint），不是背景填充。
// 0 与 0xFFFFFFFF（不透明白）都表示「无滤镜」。
export function bdaFilterColor(value: number): string | undefined {
  const unsigned = value >>> 0
  if (!unsigned || unsigned === 0xffffffff) return
  return bdaCssColor(unsigned)
}

function pngBlob(bytes: Uint8Array): Blob {
  const copy = new Uint8Array(bytes)
  return new Blob([copy.buffer], { type: "image/png" })
}

function pngSize(bytes: Uint8Array): { width: number; height: number } | undefined {
  if (bytes.length < 24 || bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) return
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return { width: view.getUint32(16), height: view.getUint32(20) }
}

export class BdaResolver implements VisualResolver {
  private readonly appearance: BdaAppearance
  private readonly images = new Map<string, Promise<ImageBitmap>>()
  private readonly archive: SkinArchive
  private readonly fallback?: SkinArchive
  private readonly theme: string
  private readonly orientation: string

  constructor(
    archive: SkinArchive,
    appearanceBytes: Uint8Array,
    fallback?: SkinArchive,
    theme = "light",
    orientation = "port",
  ) {
    this.archive = archive
    this.fallback = fallback
    this.theme = theme
    this.orientation = orientation
    this.appearance = decodeBdaAppearance(appearanceBytes)
  }

  private resource(resourceID: string): { archive: SkinArchive; path: string } | undefined {
    resourceID = resourceID.replace(/\.png$/i, "")
    const paths = [
      `${this.theme}/skin/${this.orientation}/res/${resourceID}.png`,
      `${this.theme}/skin/res/${resourceID}.png`,
      `light/skin/res/${resourceID}.png`,
    ]
    for (const archive of [this.archive, this.fallback]) {
      if (!archive) continue
      const path = paths.find((candidate) => archive.isImage(candidate))
      if (path) return { archive, path }
    }
  }

  private bitmap(archive: SkinArchive, path: string): Promise<ImageBitmap> {
    let image = this.images.get(path)
    if (!image) {
      image = createImageBitmap(pngBlob(archive.getBytes(path)!))
      this.images.set(path, image)
    }
    return image
  }

  sourceSize(styleID: string, highlighted: boolean): { width: number; height: number } | undefined {
    const rawKey = Number(styleID)
    const ref = bdaStyleRef(styleID) ?? (
      Number.isInteger(rawKey) && this.appearance.imageStyles.has(rawKey)
        ? { type: "image" as const, key: rawKey }
        : undefined
    )
    if (ref?.type !== "image") return
    const style = this.appearance.imageStyles.get(ref.key)
    const atom = highlighted ? style?.highlightImage ?? style?.normalImage : style?.normalImage
    const found = atom?.resource?.resourceID ? this.resource(atom.resource.resourceID) : undefined
    return found ? pngSize(found.archive.getBytes(found.path)!) : undefined
  }

  async resolve(styleID: string, highlighted: boolean): Promise<Visual | undefined> {
    const rawKey = Number(styleID)
    const ref = bdaStyleRef(styleID) ?? (
      Number.isInteger(rawKey)
        ? this.appearance.imageStyles.has(rawKey)
          ? { type: "image" as const, key: rawKey }
          : this.appearance.colorStyles.has(rawKey)
            ? { type: "color" as const, key: rawKey }
            : undefined
        : undefined
    )
    if (!ref) return
    if (ref.type === "color") {
      const style = this.appearance.colorStyles.get(ref.key)
      const normalColor = style?.normalColor ?? 0
      return style ? { color: bdaCssColor(highlighted ? style.highlightColor ?? normalColor : normalColor) } : undefined
    }
    if (ref.type === "text") return
    const style = this.appearance.imageStyles.get(ref.key)
    const atom = highlighted ? style?.highlightImage ?? style?.normalImage : style?.normalImage
    const found = atom?.resource?.resourceID ? this.resource(atom.resource.resourceID) : undefined
    if (!found) return { filterColor: bdaFilterColor(atom?.filterColor ?? 0) }
    const image = await this.bitmap(found.archive, found.path)
    return {
      image,
      imagePath: found.archive === this.archive ? found.path : undefined,
      source: [0, 0, image.width, image.height],
      inner: atom?.innerRect
        ? [atom.innerRect.x, atom.innerRect.y, atom.innerRect.width, atom.innerRect.height]
        : undefined,
      filterColor: bdaFilterColor(atom?.filterColor ?? 0),
    }
  }

  async resolveResource(resourceID: string): Promise<Visual | undefined> {
    const found = this.resource(resourceID)
    if (!found) return
    const image = await this.bitmap(found.archive, found.path)
    return { image, imagePath: found.path, source: [0, 0, image.width, image.height] }
  }

  resolveText(foreground: string, highlighted: boolean): TextVisual | undefined {
    const ref = foreground.split(",").map((value) => {
      const encoded = bdaStyleRef(value)
      if (encoded?.type === "text") return encoded
      const key = Number(value)
      return Number.isInteger(key) && this.appearance.textStyles.has(key)
        ? { type: "text" as const, key }
        : undefined
    }).find(Boolean)
    if (!ref) return
    const style = this.appearance.textStyles.get(ref.key)
    const normalColor = style?.normalColor ?? 0
    return style ? {
      fontName: style.fontName || undefined,
      fontSize: style.fontSize || undefined,
      color: bdaCssColor(highlighted ? style.highlightColor ?? normalColor : normalColor),
    } : undefined
  }

  resolveStyleText(styleID: string, highlighted: boolean): StyleTextVisual | undefined {
    const ref = bdaStyleRef(styleID)
    if (ref?.type !== "text") return
    const style = this.appearance.textStyles.get(ref.key)
    if (!style?.contentText) return
    return { text: style.contentText, ...this.resolveText(styleID, highlighted) }
  }

  async resolveToolbarImages(): Promise<Visual[]> {
    return []
  }
}

type RawField = ProtoField & { start: number; end: number; payloadStart: number; payloadEnd: number }

function rawFields(bytes: Uint8Array): RawField[] {
  const result: RawField[] = []
  let offset = 0
  const varint = () => {
    let value = 0n
    let shift = 0n
    for (let count = 0; offset < bytes.length && count < 10; count++) {
      const byte = bytes[offset++]
      value |= BigInt(byte & 0x7f) << shift
      if (!(byte & 0x80)) return Number(value)
      shift += 7n
    }
    throw new Error("无效的 protobuf varint")
  }
  while (offset < bytes.length) {
    const start = offset
    const tag = varint()
    const number = Math.floor(tag / 8)
    const wire = tag & 7
    let payloadStart = offset
    let payloadEnd = offset
    let value: Pick<ProtoField, "varint" | "fixed32" | "bytes"> = {}
    if (wire === 0) {
      const varintValue = varint()
      payloadEnd = offset
      value.varint = varintValue
    } else if (wire === 1) payloadEnd = offset += 8
    else if (wire === 2) {
      const length = varint()
      payloadStart = offset
      payloadEnd = offset += length
      value.bytes = bytes.slice(payloadStart, payloadEnd)
    } else if (wire === 5) payloadEnd = offset += 4
    else throw new Error(`不支持的 protobuf wire type：${wire}`)
    if (offset > bytes.length) throw new Error("不完整的 protobuf 字段")
    result.push({ number, wire, start, end: offset, payloadStart, payloadEnd, ...value })
  }
  return result
}

function encodeVarint(value: number): Uint8Array {
  let current = BigInt(value >>> 0)
  const output: number[] = []
  do {
    let byte = Number(current & 0x7fn)
    current >>= 7n
    if (current) byte |= 0x80
    output.push(byte)
  } while (current)
  return Uint8Array.from(output)
}

function join(parts: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let offset = 0
  for (const part of parts) {
    output.set(part, offset)
    offset += part.length
  }
  return output
}

function encodedField(number: number, wire: 0 | 2, payload: Uint8Array): Uint8Array {
  return join([encodeVarint(number * 8 + wire), ...(wire === 2 ? [encodeVarint(payload.length)] : []), payload])
}

function replaceField(bytes: Uint8Array, number: number, wire: 0 | 2, payload: Uint8Array): Uint8Array {
  const field = rawFields(bytes).find((item) => item.number === number)
  const replacement = encodedField(number, wire, payload)
  return field
    ? join([bytes.slice(0, field.start), replacement, bytes.slice(field.end)])
    : join([bytes, replacement])
}

export function updateBdaDesignWidth(bytes: Uint8Array, width: number): Uint8Array {
  if (!Number.isFinite(width) || width <= 0) throw new Error("BDA 设计宽度必须是正数")
  return replaceField(bytes, 6, 0, encodeVarint(Math.round(width)))
}

export function bdaSoundResourceType(filename: string): number {
  if (/\.wav$/i.test(filename)) return 4
  if (/\.ogg$/i.test(filename)) return 5
  if (/\.aiff?$/i.test(filename)) return 10
  throw new Error("BDA 按键音仅支持 OGG、WAV 或 AIFF")
}

export function updateBdaKeySound(
  bytes: Uint8Array,
  key: string,
  sound: BdaResource,
  ios = false,
): Uint8Array {
  const fieldNumber = ios ? 3 : 1
  const existing = rawFields(bytes).find((field) => {
    if (field.number !== fieldNumber || !field.bytes) return false
    return rawString(rawFields(field.bytes).find((item) => item.number === 1)) === key
  })
  const encodeResource = (original: Uint8Array = new Uint8Array()) => replaceField(
    replaceField(original, 1, 0, encodeVarint(sound.type)),
    2,
    2,
    new TextEncoder().encode(sound.resourceID),
  )
  if (existing?.bytes) {
    const original = rawFields(existing.bytes).find((field) => field.number === 2)?.bytes
    const entry = replaceField(existing.bytes, 2, 2, encodeResource(original))
    return join([
      bytes.slice(0, existing.start),
      encodedField(fieldNumber, 2, entry),
      bytes.slice(existing.end),
    ])
  }
  const entry = join([
    encodedField(1, 2, new TextEncoder().encode(key)),
    encodedField(2, 2, encodeResource()),
  ])
  return join([bytes, encodedField(fieldNumber, 2, entry)])
}

function updateMapValue(
  bytes: Uint8Array,
  fieldNumber: number,
  key: number,
  update: (value: Uint8Array) => Uint8Array,
): Uint8Array {
  const field = rawFields(bytes).find((item) => {
    if (item.number !== fieldNumber || !item.bytes) return false
    return rawFields(item.bytes).find((entry) => entry.number === 1)?.varint === key
  })
  if (!field?.bytes) throw new Error(`BDA 样式不存在：${key}`)
  const entryValue = rawFields(field.bytes).find((item) => item.number === 2)?.bytes
  if (!entryValue) throw new Error(`BDA 样式缺少值：${key}`)
  const entry = replaceField(field.bytes, 2, 2, update(entryValue))
  return join([bytes.slice(0, field.start), encodedField(fieldNumber, 2, entry), bytes.slice(field.end)])
}

function rawString(field: RawField | undefined): string {
  if (!field?.bytes) return ""
  try {
    return decoder.decode(field.bytes)
  } catch {
    return ""
  }
}

export function updateBdaAnimationFrame(
  bytes: Uint8Array,
  sequenceName: string,
  frameIndex: number,
  property: "resourceID" | "duration",
  value: string | number,
): Uint8Array {
  const entryField = rawFields(bytes).find((field) => {
    if (field.number !== 9 || !field.bytes) return false
    return rawString(rawFields(field.bytes).find((item) => item.number === 1)) === sequenceName
  })
  if (!entryField?.bytes) throw new Error(`BDA 动画序列不存在：${sequenceName}`)
  const entryFields = rawFields(entryField.bytes)
  const sequenceField = entryFields.find((field) => field.number === 2)
  if (!sequenceField?.bytes) throw new Error(`BDA 动画序列缺少值：${sequenceName}`)
  const frames = rawFields(sequenceField.bytes).filter((field) => field.number === 5)
  const frameField = frames[frameIndex]
  if (!frameField?.bytes) throw new Error(`BDA 动画帧不存在：${frameIndex}`)

  let frame = frameField.bytes
  if (property === "resourceID") {
    const resource = rawFields(frame).find((field) => field.number === 1)?.bytes ?? new Uint8Array()
    frame = replaceField(frame, 1, 2, replaceField(resource, 2, 2, new TextEncoder().encode(String(value))))
  } else {
    const duration = Number(value)
    if (!Number.isInteger(duration) || duration < 0) throw new Error("BDA 动画帧时长无效")
    frame = replaceField(frame, 2, 0, encodeVarint(duration))
  }

  const sequence = join([
    sequenceField.bytes.slice(0, frameField.start),
    encodedField(5, 2, frame),
    sequenceField.bytes.slice(frameField.end),
  ])
  const entry = replaceField(entryField.bytes, 2, 2, sequence)
  return join([
    bytes.slice(0, entryField.start),
    encodedField(9, 2, entry),
    bytes.slice(entryField.end),
  ])
}

function colorValue(value: string): number {
  const hex = value.trim().replace(/^#/, "")
  if (!/^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(hex)) throw new Error("颜色应为 RRGGBB 或 AARRGGBB")
  return Number.parseInt(hex.length === 6 ? `FF${hex}` : hex, 16) >>> 0
}

export function updateBdaStyle(
  bytes: Uint8Array,
  ref: BdaStyleRef,
  property: string,
  value: string,
): Uint8Array {
  const rootField = { image: 1, text: 2, color: 3 }[ref.type]
  return updateMapValue(bytes, rootField, ref.key, (style) => {
    if (ref.type === "image") {
      const state = property === "HL_IMG" ? 2 : property === "NM_IMG" ? 1 : 0
      if (!state) throw new Error(`BDA 图片样式不支持：${property}`)
      const atom = rawFields(style).find((item) => item.number === state)?.bytes ?? new Uint8Array()
      const resource = rawFields(atom).find((item) => item.number === 1)?.bytes ?? new Uint8Array()
      const nextResource = replaceField(resource, 2, 2, new TextEncoder().encode(value.split(",")[0].trim()))
      return replaceField(style, state, 2, replaceField(atom, 1, 2, nextResource))
    }
    if (ref.type === "color") {
      const field = property === "HL_COLOR" ? 2 : property === "NM_COLOR" ? 1 : 0
      if (!field) throw new Error(`BDA 颜色样式不支持：${property}`)
      return replaceField(style, field, 0, encodeVarint(colorValue(value)))
    }
    const field = { FONT_NAME: 2, FONT_SIZE: 3, NM_COLOR: 4, HL_COLOR: 5 }[property]
    if (!field) throw new Error(`BDA 文字样式不支持：${property}`)
    if (property === "FONT_NAME") return replaceField(style, field, 2, new TextEncoder().encode(value))
    const numeric = property === "FONT_SIZE" ? Number(value) : colorValue(value)
    if (!Number.isFinite(numeric) || numeric < 0) throw new Error("BDA 数值无效")
    return replaceField(style, field, 0, encodeVarint(numeric))
  })
}

function mapObject<K extends string | number, V>(
  values: Map<K, V>,
  encode: (value: V) => unknown = (value) => value,
): Record<string, unknown> {
  return Object.fromEntries([...values].map(([key, value]) => [String(key), encode(value)]))
}

function decodedAppearanceSource(appearance: BdaAppearance, panelName?: string): Record<string, unknown> {
  const styleRef = (value: BdaStyleRef | undefined) => value && { type: value.type, key: value.key }
  const imageAtomSource = (value: BdaImageAtom | undefined) => value && {
    resource: value.resource,
    innerRect: value.innerRect,
    contentInset: value.contentInset,
    alpha: value.alpha,
    filterColor: value.filterColor === undefined ? undefined : bdaColorHex(value.filterColor),
  }
  const keySource = (value: BdaKey) => ({
    backStyle: styleRef(value.backStyle),
    foreStyles: value.foreStyles.length ? value.foreStyles.map(styleRef) : undefined,
    foreStyleOffsets: value.foreStyleOffsets.length ? value.foreStyleOffsets : undefined,
    backStyleState: styleRef(value.backStyleState),
  })
  const hintSource = (value: BdaHint) => ({
    offset: value.offset,
    backStyle: styleRef(value.backStyle),
    barStyle: styleRef(value.barStyle),
    barOffset: value.barOffset,
    foreStyle: styleRef(value.foreStyle),
    cellStyle: styleRef(value.cellStyle),
  })
  const listSource = (value: BdaList) => ({
    backStyle: styleRef(value.backStyle),
    cellBackStyle: styleRef(value.cellBackStyle),
    cellForeStyle: styleRef(value.cellForeStyle),
    foreStyles: value.foreStyles.length ? value.foreStyles.map(styleRef) : undefined,
    foreStyleOffsets: value.foreStyleOffsets.length ? value.foreStyleOffsets : undefined,
  })
  const candSource = (value: BdaCand | undefined) => value && ({
    candBarStyle: styleRef(value.candBarStyle),
    candOnBarStyle: styleRef(value.candOnBarStyle),
    cellBackStyle: styleRef(value.cellBackStyle),
    cellForeStyle: styleRef(value.cellForeStyle),
    firstCellForeStyle: styleRef(value.firstCellForeStyle),
    firstCellBackStyle: styleRef(value.firstCellBackStyle),
    subCandCellForeStyle: styleRef(value.subCandCellForeStyle),
    subCandCellBackStyle: styleRef(value.subCandCellBackStyle),
    switch: value.switch && {
      normalBack: styleRef(value.switch.normalBack), selectBack: styleRef(value.switch.selectBack),
      normalFore: styleRef(value.switch.normalFore), selectFore: styleRef(value.switch.selectFore),
    },
    candKeys: mapObject(value.candKeys, keySource),
    subCandBackStyle: styleRef(value.subCandBackStyle),
    menuKeys: mapObject(value.menuKeys, keySource),
    aiIcon: value.aiIcon && keySource(value.aiIcon),
    accessoryBackStyle: styleRef(value.accessoryBackStyle),
    gridLeftForeStyle: styleRef(value.gridLeftForeStyle),
    gridRightForeStyle: styleRef(value.gridRightForeStyle),
  })
  const panelSource = (value: BdaPanel) => ({
    hints: mapObject(value.hints, hintSource),
    lists: mapObject(value.lists, listSource),
    backStyle: styleRef(value.backStyle),
    wholeBackStyle: styleRef(value.wholeBackStyle),
    inputRegionBackStyle: styleRef(value.inputRegionBackStyle),
    shouldBgBlur: value.shouldBgBlur,
    shouldKeySlotting: value.shouldKeySlotting,
    trackColor: value.trackColor === undefined ? undefined : bdaColorHex(value.trackColor),
    keys: mapObject(value.keys, keySource),
    cand: candSource(value.cand),
    input: value.input && { backStyle: styleRef(value.input.backStyle), textStyle: styleRef(value.input.textStyle) },
    more: value.more && {
      backStyle: styleRef(value.more.backStyle),
      cellForeStyle: styleRef(value.more.cellForeStyle),
      cellBackStyle: styleRef(value.more.cellBackStyle),
    },
  })
  if (panelName) {
    const panel = appearance.panels.get(panelName.replace(/\.ini$/i, ""))
    return panel ? { panel: panelName.replace(/\.ini$/i, ""), ...panelSource(panel) } : { panel: panelName }
  }
  return {
    designWidth: appearance.designWidth,
    imageStyles: mapObject(appearance.imageStyles, (style) => ({
      normalImage: imageAtomSource(style.normalImage),
      highlightImage: imageAtomSource(style.highlightImage),
      fontInfo: style.fontInfo && {
        ...style.fontInfo,
        normalColor: style.fontInfo.normalColor === undefined ? undefined : bdaColorHex(style.fontInfo.normalColor),
        highlightColor: style.fontInfo.highlightColor === undefined ? undefined : bdaColorHex(style.fontInfo.highlightColor),
      },
    })),
    textStyles: mapObject(appearance.textStyles, (style) => ({
      resource: style.resource,
      fontName: style.fontName,
      fontSize: style.fontSize,
      normalColor: style.normalColor === undefined ? undefined : bdaColorHex(style.normalColor),
      highlightColor: style.highlightColor === undefined ? undefined : bdaColorHex(style.highlightColor),
      contentText: style.contentText,
    })),
    colorStyles: mapObject(appearance.colorStyles, (style) => ({
      normalColor: style.normalColor === undefined ? undefined : bdaColorHex(style.normalColor),
      highlightColor: style.highlightColor === undefined ? undefined : bdaColorHex(style.highlightColor),
    })),
    panels: mapObject(appearance.panels, panelSource),
    colorPalette: appearance.colorPalette && Object.fromEntries(Object.entries(appearance.colorPalette)
      .map(([name, color]) => [name, bdaColorHex(color)])),
    gamePanel: appearance.gamePanel && {
      backStyle: styleRef(appearance.gamePanel.backStyle),
      corpusFirstTab: appearance.gamePanel.corpusFirstTab,
      corpusList: appearance.gamePanel.corpusList,
      functionBar: appearance.gamePanel.functionBar,
      keys: mapObject(appearance.gamePanel.keys, keySource),
    },
    dragBar: appearance.dragBar && { backStyle: styleRef(appearance.dragBar.backStyle) },
  }
}

function genericBdaSource(bytes: Uint8Array): unknown[] {
  return fields(bytes).map((field) => ({
    field: field.number,
    wire: field.wire,
    value: field.varint ?? field.fixed32 ?? (
      field.bytes
        ? string(field) || `<${field.bytes.length} bytes>`
        : undefined
    ),
  }))
}

export function decodedBdaSource(path: string, bytes: Uint8Array, panelName?: string): string {
  const name = path.split("/").pop() ?? path
  let value: unknown
  if (/^\d*appearanceConfig$/i.test(name)) {
    value = decodedAppearanceSource(decodeBdaAppearance(bytes), panelName)
  } else if (/animationConfig$/i.test(name)) {
    const animation = decodeBdaAnimation(bytes)
    value = {
      targets: animation.targets.length ? animation.targets : undefined,
      bindings: animation.bindings.size ? mapObject(animation.bindings) : undefined,
      sequences: mapObject(animation.sequences, (sequence) => ({ frames: sequence.frames })),
    }
  } else if (/^\d*soundConfig$/i.test(name)) {
    const sound = decodeBdaSoundConfig(bytes)
    value = {
      keySounds: mapObject(sound.keySounds),
      iosKeySounds: sound.iosKeySounds.size ? mapObject(sound.iosKeySounds) : undefined,
    }
  } else {
    value = { fields: genericBdaSource(bytes) }
  }
  return JSON.stringify(value, null, 2)
}

export function describeBdaConfig(path: string, bytes: Uint8Array): string {
  const name = path.split("/").pop() ?? path
  const header = `${name} · BDA Protocol Buffers · ${bytes.length} 字节`
  if (/^\d*animationConfig$/.test(name)) {
    const animation = decodeBdaAnimation(bytes)
    const frames = [...animation.sequences.values()].reduce((sum, sequence) => sum + sequence.frames.length, 0)
    return [
      header,
      "",
      `动画目标：${animation.targets.length}`,
      `动画序列：${animation.sequences.size}`,
      `序列帧：${frames}`,
      ...[...animation.sequences.values()].map((sequence) => `- ${sequence.name}（${sequence.frames.length} 帧）`),
      "",
      "保存时保留原始配置和未知字段。",
    ].join("\n")
  }
  if (!/^\d*appearanceConfig$/.test(name)) {
    const values = fields(bytes).flatMap((field) => {
      if (field.varint !== undefined) return [`字段 ${field.number}：${field.varint}`]
      const value = string(field)
      return value ? [`字段 ${field.number}：${value}`] : []
    })
    return [header, "", ...values, "", "保存时保留原始配置和未知字段。"].join("\n")
  }
  const appearance = decodeBdaAppearance(bytes)
  const resources = bdaResourceIDs(bytes)
  return [
    header,
    "",
    `设计宽度：${appearance.designWidth || "未配置"}`,
    `图片样式：${appearance.imageStyles.size}`,
    `文字样式：${appearance.textStyles.size}`,
    `颜色样式：${appearance.colorStyles.size}`,
    `资源引用：${resources.length}`,
    `布局：${appearance.panels.size}`,
    ...[...appearance.panels.keys()].map((layout) => `- ${layout}（${appearance.panels.get(layout)?.keys.size ?? 0} 个按键）`),
    "",
    "已按百度官方 protobuf 字段解析；保存时保留原始配置和未知字段。",
  ].join("\n")
}
import type { StyleTextVisual, TextVisual, Visual, VisualResolver } from "./atlas.ts"
import { IniDocument } from "./ini.ts"
import { SkinArchive } from "./skin.ts"
