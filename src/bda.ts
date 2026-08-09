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

export function describeBdaConfig(path: string, bytes: Uint8Array): string {
  const name = path.split("/").pop() ?? path
  const header = `${name} · BDA Protocol Buffers · ${bytes.length} 字节`
  if (!/^\d*appearanceConfig$/.test(name)) return `${header}\n\n二进制配置将按原字节保存。`
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
