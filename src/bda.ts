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
export type BdaImageAtom = {
  resource?: BdaResource
  innerRect?: BdaRect
  contentInset?: { top: number; left: number; bottom: number; right: number }
  alpha: number
  filterColor: number
}
export type BdaImageStyle = {
  normalImage?: BdaImageAtom
  highlightImage?: BdaImageAtom
}
export type BdaTextStyle = {
  resource?: BdaResource
  fontName: string
  fontSize: number
  normalColor: number
  highlightColor: number
  contentText: string
}
export type BdaColorStyle = { normalColor: number; highlightColor: number }
export type BdaKey = {
  backStyle?: BdaStyleRef
  foreStyles: BdaStyleRef[]
  foreStyleOffsets: Array<{ x: number; y: number }>
  backStyleState?: BdaStyleRef
}
export type BdaPanel = {
  keys: Map<string, BdaKey>
  backStyle?: BdaStyleRef
  wholeBackStyle?: BdaStyleRef
  inputRegionBackStyle?: BdaStyleRef
  trackColor: number
}
export type BdaAppearance = {
  designWidth: number
  imageStyles: Map<number, BdaImageStyle>
  textStyles: Map<number, BdaTextStyle>
  colorStyles: Map<number, BdaColorStyle>
  panels: Map<string, BdaPanel>
}
export type BdaAnimationFrame = { resourceID: string; duration: number }
export type BdaAnimationSequence = { name: string; frames: BdaAnimationFrame[] }
export type BdaAnimation = {
  targets: string[]
  sequences: Map<string, BdaAnimationSequence>
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

export function bdaLayoutDocument(base: IniDocument, appearance: BdaAppearance, layout: string): IniDocument {
  const document = IniDocument.parse(base.toString())
  const panel = appearance.panels.get(layout.replace(/\.ini$/i, ""))
  if (!panel) return document
  for (const section of document.sections().filter((name) => /^KEY\d+$/.test(name))) {
    const actions = [document.get(section, "CENTER"), document.get(section, "DOWN")]
      .filter((value): value is string => Boolean(value))
    const key = actions.map(bdaPanelKeyName).map((name) => panel.keys.get(name)).find(Boolean)
    if (!key) continue
    document.set(section, "BACK_STYLE", bdaStyleID(key.backStyle))
    document.set(section, "FORE_STYLE", key.foreStyles.map(bdaStyleID).join(","))
    if (key.foreStyleOffsets.length) {
      document.set(section, "FORE_OFFSET", key.foreStyleOffsets.map(({ x, y }) => `${x},${y}`).join(";"))
    }
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

function float(value: ProtoField[], number: number): number {
  return first(value, number)?.fixed32 ?? 0
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
    alpha: float(value, 4),
    filterColor: first(value, 5)?.varint ?? 0,
  }
}

function imageStyle(field: ProtoField | undefined): BdaImageStyle {
  const value = message(field)
  return {
    normalImage: imageAtom(first(value, 1)),
    highlightImage: imageAtom(first(value, 2)),
  }
}

function textStyle(field: ProtoField | undefined): BdaTextStyle {
  const value = message(field)
  return {
    resource: resource(first(value, 1)),
    fontName: string(first(value, 2)),
    fontSize: first(value, 3)?.varint ?? 0,
    normalColor: first(value, 4)?.varint ?? 0,
    highlightColor: first(value, 5)?.varint ?? 0,
    contentText: string(first(value, 6)),
  }
}

function colorStyle(field: ProtoField | undefined): BdaColorStyle {
  const value = message(field)
  return {
    normalColor: first(value, 1)?.varint ?? 0,
    highlightColor: first(value, 2)?.varint ?? 0,
  }
}

function key(field: ProtoField | undefined): BdaKey {
  const value = message(field)
  return {
    backStyle: styleRef(first(value, 1)),
    foreStyles: value.filter((item) => item.number === 2).flatMap((item) => {
      const style = styleRef(item)
      return style ? [style] : []
    }),
    foreStyleOffsets: value.filter((item) => item.number === 3).map((item) => {
      const offset = message(item)
      return { x: float(offset, 1), y: float(offset, 2) }
    }),
    backStyleState: styleRef(first(value, 4)),
  }
}

function panel(field: ProtoField | undefined): BdaPanel {
  const value = message(field)
  return {
    keys: new Map(mapEntries(value, 3).map((entry) => [
      string(first(entry, 1)),
      key(first(entry, 2)),
    ])),
    backStyle: styleRef(first(value, 7)),
    trackColor: first(value, 9)?.varint ?? 0,
    wholeBackStyle: styleRef(first(value, 10)),
    inputRegionBackStyle: styleRef(first(value, 12)),
  }
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
    designWidth: first(root, 6)?.varint ?? 0,
    imageStyles: numericMap(root, 1, imageStyle),
    textStyles: numericMap(root, 2, textStyle),
    colorStyles: numericMap(root, 3, colorStyle),
    panels: new Map(mapEntries(root, 4).map((entry) => [
      string(first(entry, 1)),
      panel(first(entry, 2)),
    ])),
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
        resourceID: string(first(message(first(frame, 1)), 2)),
        duration: first(frame, 2)?.varint ?? 0,
      }
    })
    return [name, { name, frames }] as const
  })
  return {
    targets: mapEntries(root, 1).map((entry) => string(first(entry, 1))).filter(Boolean),
    sequences: new Map(sequences.filter(([name]) => Boolean(name))),
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

function pngBlob(bytes: Uint8Array): Blob {
  const copy = new Uint8Array(bytes)
  return new Blob([copy.buffer], { type: "image/png" })
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
      return style ? { color: bdaCssColor(highlighted ? style.highlightColor || style.normalColor : style.normalColor) } : undefined
    }
    if (ref.type === "text") return
    const style = this.appearance.imageStyles.get(ref.key)
    const atom = highlighted ? style?.highlightImage ?? style?.normalImage : style?.normalImage
    const found = atom?.resource?.resourceID ? this.resource(atom.resource.resourceID) : undefined
    if (!found) return { color: bdaCssColor(atom?.filterColor ?? 0) }
    const image = await this.bitmap(found.archive, found.path)
    return {
      image,
      imagePath: found.archive === this.archive ? found.path : undefined,
      source: [0, 0, image.width, image.height],
      inner: atom?.innerRect
        ? [atom.innerRect.x, atom.innerRect.y, atom.innerRect.width, atom.innerRect.height]
        : undefined,
      color: bdaCssColor(atom?.filterColor ?? 0),
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
    return style ? {
      fontName: style.fontName || undefined,
      fontSize: style.fontSize || undefined,
      color: bdaCssColor(highlighted ? style.highlightColor || style.normalColor : style.normalColor),
    } : undefined
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
    ...appearance.panels.keys().map((layout) => `- ${layout}（${appearance.panels.get(layout)?.keys.size ?? 0} 个按键）`),
    "",
    "已按百度官方 protobuf 字段解析；保存时保留原始配置和未知字段。",
  ].join("\n")
}
import type { TextVisual, Visual, VisualResolver } from "./atlas.ts"
import { IniDocument } from "./ini.ts"
import { SkinArchive } from "./skin.ts"
