import { strFromU8, strToU8, unzipSync, zipSync } from "fflate"
import type { ExportFormat } from "./export.ts"

const TEXT_EXTENSIONS = new Set(["ini", "css", "til", "cnd", "pop", "txt", "plist"])
const MAX_FILES = 5_000
const MAX_ARCHIVE_BYTES = 64 * 1024 * 1024
const MAX_UNPACKED_BYTES = 256 * 1024 * 1024
const LOCAL_SIGNATURE = 0x04034b50
const CENTRAL_SIGNATURE = 0x02014b50
const END_SIGNATURE = 0x06054b50

type ZipEntry = {
  name: string
  central: Uint8Array
  local: Uint8Array
  flags: number
  method: number
  compressedSize: number
  uncompressedSize: number
}

type PackageLayout =
  | "bdi-dual"
  | "bdi-single"
  | "bds-dual"
  | "bds-single"
  | "bda-dual"
  | "bda-single"
  | "legacy-ios"

const view = (bytes: Uint8Array) =>
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)

function findEnd(bytes: Uint8Array): number {
  const data = view(bytes)
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65_557); offset--) {
    if (data.getUint32(offset, true) === END_SIGNATURE) return offset
  }
  throw new Error("无效的 ZIP：找不到中央目录")
}

function parseZip(bytes: Uint8Array): { entries: ZipEntry[]; end: Uint8Array } {
  const data = view(bytes)
  const endOffset = findEnd(bytes)
  const centralOffset = data.getUint32(endOffset + 16, true)
  const count = data.getUint16(endOffset + 10, true)
  const decoder = new TextDecoder()
  const partial: Array<Omit<ZipEntry, "local"> & { localOffset: number }> = []
  let offset = centralOffset
  for (let index = 0; index < count; index++) {
    if (data.getUint32(offset, true) !== CENTRAL_SIGNATURE) {
      throw new Error("无效的 ZIP 中央目录")
    }
    const nameLength = data.getUint16(offset + 28, true)
    const extraLength = data.getUint16(offset + 30, true)
    const commentLength = data.getUint16(offset + 32, true)
    const length = 46 + nameLength + extraLength + commentLength
    const central = bytes.slice(offset, offset + length)
    partial.push({
      name: decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength)),
      central,
      localOffset: data.getUint32(offset + 42, true),
      flags: data.getUint16(offset + 8, true),
      method: data.getUint16(offset + 10, true),
      compressedSize: data.getUint32(offset + 20, true),
      uncompressedSize: data.getUint32(offset + 24, true),
    })
    offset += length
  }
  const byOffset = [...partial].sort((a, b) => a.localOffset - b.localOffset)
  const localEnds = new Map<string, number>()
  byOffset.forEach((entry, index) => {
    localEnds.set(entry.name, byOffset[index + 1]?.localOffset ?? centralOffset)
  })
  return {
    entries: partial.map(({ localOffset, ...entry }) => {
      if (data.getUint32(localOffset, true) !== LOCAL_SIGNATURE) {
        throw new Error(`无效的 ZIP 本地条目：${entry.name}`)
      }
      return { ...entry, local: bytes.slice(localOffset, localEnds.get(entry.name)) }
    }),
    end: bytes.slice(endOffset),
  }
}

function writeUint32(bytes: Uint8Array, offset: number, value: number): void {
  view(bytes).setUint32(offset, value, true)
}

function compressedPayload(data: Uint8Array, level: 0 | 6): {
  crc: number
  compressed: Uint8Array
} {
  const packed = zipSync({ x: [data, { level, mtime: new Date(1980, 0, 1) }] })
  const packedView = view(packed)
  const nameLength = packedView.getUint16(26, true)
  const extraLength = packedView.getUint16(28, true)
  const size = packedView.getUint32(18, true)
  const start = 30 + nameLength + extraLength
  return { crc: packedView.getUint32(14, true), compressed: packed.slice(start, start + size) }
}

function changedLocal(entry: ZipEntry, data: Uint8Array): {
  local: Uint8Array
  crc: number
  compressedSize: number
} {
  const localView = view(entry.local)
  const nameLength = localView.getUint16(26, true)
  const extraLength = localView.getUint16(28, true)
  const dataOffset = 30 + nameLength + extraLength
  const trailerOffset = dataOffset + entry.compressedSize
  const { crc, compressed } = compressedPayload(data, entry.method === 0 ? 0 : 6)
  const header = entry.local.slice(0, dataOffset)
  const trailer = entry.local.slice(trailerOffset)
  if (entry.flags & 8) {
    const descriptorOffset = view(trailer).getUint32(0, true) === 0x08074b50 ? 4 : 0
    writeUint32(trailer, descriptorOffset, crc)
    writeUint32(trailer, descriptorOffset + 4, compressed.length)
    writeUint32(trailer, descriptorOffset + 8, data.length)
  } else {
    writeUint32(header, 14, crc)
    writeUint32(header, 18, compressed.length)
    writeUint32(header, 22, data.length)
  }
  const output = new Uint8Array(header.length + compressed.length + trailer.length)
  output.set(header)
  output.set(compressed, header.length)
  output.set(trailer, header.length + compressed.length)
  return { local: output, crc, compressedSize: compressed.length }
}

function safePath(path: string): boolean {
  return (
    path.length > 0 &&
    !path.startsWith("/") &&
    !path.startsWith("\\") &&
    !/^[A-Za-z]:/.test(path) &&
    !path.split(/[\\/]/).includes("..")
  )
}

function validateArchiveLimits(bytes: Uint8Array): void {
  if (bytes.byteLength > MAX_ARCHIVE_BYTES) throw new Error("皮肤文件超过 64 MB")
  const data = view(bytes)
  const endOffset = findEnd(bytes)
  const count = data.getUint16(endOffset + 10, true)
  if (count > MAX_FILES) throw new Error(`皮肤包含过多文件（${count}）`)
  const decoder = new TextDecoder()
  let offset = data.getUint32(endOffset + 16, true)
  let total = 0
  for (let index = 0; index < count; index++) {
    if (offset + 46 > endOffset || data.getUint32(offset, true) !== CENTRAL_SIGNATURE) {
      throw new Error("无效的 ZIP 中央目录")
    }
    const nameLength = data.getUint16(offset + 28, true)
    const extraLength = data.getUint16(offset + 30, true)
    const commentLength = data.getUint16(offset + 32, true)
    const length = 46 + nameLength + extraLength + commentLength
    if (offset + length > endOffset) throw new Error("无效的 ZIP 中央目录")
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength))
    if (!safePath(name)) throw new Error(`皮肤包含不安全路径：${name}`)
    total += data.getUint32(offset + 24, true)
    if (total > MAX_UNPACKED_BYTES) throw new Error("皮肤解压后超过 256 MB")
    offset += length
  }
}

function packageLayout(files: Map<string, Uint8Array>): PackageLayout {
  const names = [...files.keys()]
  if (names.some((name) => /^(?:dark|light)\/(?:land|port)\/\d*appearanceConfig$/.test(name))) {
    return "bda-dual"
  }
  if (names.some((name) => /^(?:land|port)\/\d*appearanceConfig$/.test(name))) {
    return "bda-single"
  }
  if (names.some((name) => /^skin\/(?:dark|light)\/skin\//.test(name))) return "bdi-dual"
  if (names.some((name) => /^skin\/(?:land|port|res)\//.test(name))) return "bdi-single"
  if (names.some((name) => /^(?:dark|light)\/(?:land|port|res)\//.test(name))) return "bds-dual"
  if (names.some((name) => /^(?:land|port|res)\//.test(name))) return "bds-single"
  return "legacy-ios"
}

function canonicalPath(path: string, layout: PackageLayout): string {
  if (layout === "bdi-dual") {
    if (path === "skin/") return ""
    if (path === "skin/Info.txt") return "Info.txt"
    if (path === "skin/demo.png") return "demo.png"
    const themed = path.match(/^skin\/(dark|light)\/skin(?:\/(.*))?$/)
    if (themed) return `${themed[1]}/skin/${themed[2] ?? ""}`
    const themeDirectory = path.match(/^skin\/(dark|light)\/$/)
    if (themeDirectory) return `${themeDirectory[1]}/skin/`
    return path.replace(/^skin\//, "")
  }
  if (layout === "bdi-single") {
    if (path === "skin/") return "light/skin/"
    if (path === "skin/Info.txt") return "Info.txt"
    if (path === "skin/demo.png") return "demo.png"
    return path.startsWith("skin/") ? `light/skin/${path.slice(5)}` : path
  }
  if (layout === "bds-dual" || layout === "bda-dual") {
    const themed = path.match(/^(dark|light)(?:\/(.*))?$/)
    if (themed) return `${themed[1]}/skin/${themed[2] ?? ""}`
  }
  if (layout === "bds-single" || layout === "bda-single") {
    if (path === "Info.txt" || path === "demo.png") return path
    return `light/skin/${path}`
  }
  return path
}

function rawPath(path: string, layout: PackageLayout): string {
  if (layout === "bdi-dual") {
    if (path === "Info.txt" || path === "demo.png") return `skin/${path}`
    return path.replace(/^(dark|light)\/skin\//, "skin/$1/skin/")
  }
  if (layout === "bdi-single") {
    if (path === "Info.txt" || path === "demo.png") return `skin/${path}`
    return path.replace(/^light\/skin\//, "skin/")
  }
  if (layout === "bds-dual" || layout === "bda-dual") {
    return path.replace(/^(dark|light)\/skin\//, "$1/")
  }
  if (layout === "bds-single" || layout === "bda-single") {
    return path.replace(/^light\/skin\//, "")
  }
  return path
}

function setInfoField(bytes: Uint8Array, key: string, value: string): Uint8Array {
  let text = strFromU8(bytes)
  const eol = text.includes("\r\n") ? "\r\n" : "\n"
  const field = new RegExp(`^${key}=.*$`, "mi")
  if (field.test(text)) text = text.replace(field, `${key}=${value}`)
  else text = `${text}${text && !text.endsWith("\n") && !text.endsWith("\r") ? eol : ""}${key}=${value}${eol}`
  return strToU8(text)
}

function removeInfoField(bytes: Uint8Array, key: string): Uint8Array {
  const text = strFromU8(bytes).replace(new RegExp(`^${key}=.*(?:\\r?\\n|$)`, "mi"), "")
  return strToU8(text)
}

function targetPath(path: string, format: ExportFormat, single: boolean): string | undefined {
  if (format === "bdi") {
    if (path === "Info.txt" || path === "demo.png") return `skin/${path}`
    const themed = path.match(/^(dark|light)\/skin\/(.*)$/)
    if (single && themed?.[1] === "light") return `skin/${themed[2]}`
    return themed ? `skin/${themed[1]}/skin/${themed[2]}` : `skin/${path}`
  }
  if (/^(?:dark|light)\/skin\/(?:Info\.txt|demo\.png)$/.test(path)) return
  const themed = path.match(/^(dark|light)\/skin\/(.*)$/)
  if (single && themed?.[1] === "light") return themed[2]
  return themed ? `${themed[1]}/${themed[2]}` : path
}

export class SkinArchive {
  private files: Map<string, Uint8Array>
  private originals: Map<string, Uint8Array>
  private sourceBytes: Uint8Array
  private sourceZip?: ReturnType<typeof parseZip>
  private layout: PackageLayout
  private canonicalToRaw = new Map<string, string>()
  private changedRaw = new Set<string>()
  readonly changed = new Set<string>()

  private constructor(files: Map<string, Uint8Array>, sourceBytes: Uint8Array) {
    this.files = files
    this.originals = new Map(files)
    this.sourceBytes = sourceBytes.slice()
    this.layout = packageLayout(files)
    this.rebuildPathMap()
    try {
      this.sourceZip = parseZip(this.sourceBytes)
    } catch {
      this.sourceZip = undefined
    }
  }

  private rebuildPathMap(): void {
    this.canonicalToRaw.clear()
    for (const raw of this.files.keys()) {
      const canonical = canonicalPath(raw, this.layout)
      if (canonical && !this.canonicalToRaw.has(canonical)) this.canonicalToRaw.set(canonical, raw)
    }
  }

  get format(): ExportFormat {
    if (this.layout.startsWith("bda")) return "bda"
    return this.layout.startsWith("bds") ? "bds" : "bdi"
  }

  static open(bytes: Uint8Array): SkinArchive {
    validateArchiveLimits(bytes)
    const unpacked = unzipSync(bytes)
    const names = Object.keys(unpacked)
    if (names.length > MAX_FILES) throw new Error(`皮肤包含过多文件（${names.length}）`)

    let total = 0
    const files = new Map<string, Uint8Array>()
    for (const name of names) {
      if (!safePath(name)) throw new Error(`皮肤包含不安全路径：${name}`)
      total += unpacked[name].byteLength
      if (total > MAX_UNPACKED_BYTES) throw new Error("皮肤解压后超过 256 MB")
      files.set(name, unpacked[name])
    }
    return new SkinArchive(files, bytes)
  }

  static fromSourceFiles(files: Array<{ path: string; data: Uint8Array }>): SkinArchive {
    return SkinArchive.open(zipSync(Object.fromEntries(files.map((file) => [file.path, file.data])), { level: 0 }))
  }

  names(): string[] {
    return [...this.canonicalToRaw.keys()].sort()
  }

  sourceFiles(): Array<{ path: string; data: Uint8Array }> {
    return [...this.files.entries()]
      .filter(([path]) => !path.endsWith("/"))
      .map(([path, data]) => ({ path, data: data.slice() }))
  }

  sourcePath(path: string): string {
    return this.canonicalToRaw.get(path) ?? rawPath(path, this.layout)
  }

  getSourceBytes(path: string): Uint8Array | undefined {
    return this.files.get(path)
  }

  canonicalSourcePath(path: string): string {
    return canonicalPath(path, this.layout)
  }

  isText(path: string): boolean {
    const extension = path.split(".").pop()?.toLowerCase() ?? ""
    return this.getBytes(path) !== undefined && TEXT_EXTENSIONS.has(extension)
  }

  isImage(path: string): boolean {
    return this.getBytes(path) !== undefined && path.toLowerCase().endsWith(".png")
  }

  isBdaConfig(path: string): boolean {
    return this.format === "bda" && /\/\d*(?:appearance|animation|lightAnimation|sound|switch|sticker|scene)Config$/.test(path)
  }

  getBytes(path: string): Uint8Array | undefined {
    return this.files.get(this.canonicalToRaw.get(path) ?? path)
  }

  getText(path: string): string {
    const bytes = this.getBytes(path)
    if (!bytes) throw new Error(`文件不存在：${path}`)
    return strFromU8(bytes)
  }

  setText(path: string, text: string): void {
    this.setBytes(path, strToU8(text))
  }

  setBytes(path: string, bytes: Uint8Array): void {
    const raw = this.canonicalToRaw.get(path) ?? rawPath(path, this.layout)
    const current = this.files.get(raw)
    if (current && current.length === bytes.length && current.every((byte, index) => byte === bytes[index])) {
      return
    }
    this.files.set(raw, bytes)
    this.canonicalToRaw.set(path, raw)
    const original = this.originals.get(raw)
    if (original && original.length === bytes.length && original.every((byte, index) => byte === bytes[index])) {
      this.changed.delete(path)
      this.changedRaw.delete(raw)
    } else {
      this.changed.add(path)
      this.changedRaw.add(raw)
    }
  }

  delete(path: string): void {
    const raw = this.canonicalToRaw.get(path)
    if (!raw) return
    this.files.delete(raw)
    this.canonicalToRaw.delete(path)
    if (this.originals.has(raw)) {
      this.changed.add(path)
    } else {
      this.changed.delete(path)
    }
    this.changedRaw.delete(raw)
  }

  markSaved(bytes?: Uint8Array): void {
    if (bytes) {
      const reopened = SkinArchive.open(bytes)
      this.files = reopened.files
      this.originals = reopened.originals
      this.sourceBytes = reopened.sourceBytes
      this.sourceZip = reopened.sourceZip
      this.layout = reopened.layout
      this.canonicalToRaw = reopened.canonicalToRaw
      this.changedRaw.clear()
      this.changed.clear()
      return
    }
    this.originals = new Map(this.files)
    this.changedRaw.clear()
    this.changed.clear()
  }

  private packagedBytes(format: ExportFormat): Uint8Array {
    const output = new Map<string, Uint8Array>()
    const single = this.layout.endsWith("single")
    const add = (name: string, data: Uint8Array) => {
      const parts = name.split("/")
      for (let index = 1; index < parts.length; index++) {
        const directory = `${parts.slice(0, index).join("/")}/`
        if (!output.has(directory)) output.set(directory, new Uint8Array())
      }
      output.set(name, data)
    }

    for (const path of this.names()) {
      if (path.endsWith("/")) continue
      const destination = targetPath(path, format, single)
      const source = this.getBytes(path)
      if (!destination || !source) continue
      let data = source
      if (path === "Info.txt" || /\/(?:Info\.txt)$/.test(path)) {
        data = setInfoField(data, "SupportPlatform", format === "bdi" ? "I" : "A")
        if (format === "bds" && path === "Info.txt") data = setInfoField(data, "Style", "default")
        if (format === "bdi") data = removeInfoField(data, "Style")
      }
      add(destination, data)
    }

    return zipSync(Object.fromEntries(output), { level: 6 })
  }

  toBytes(format?: ExportFormat): Uint8Array {
    if (format && (format === "bda" || this.format === "bda") && format !== this.format) {
      throw new Error("BDA 与 BDI/BDS 使用不同配置格式，不能转换")
    }
    if (format && (format !== this.format || this.layout === "legacy-ios")) {
      return this.packagedBytes(format)
    }
    if (this.changed.size === 0) return this.sourceBytes.slice()
    if (
      !this.sourceZip ||
      this.sourceZip.entries.length !== this.files.size ||
      this.sourceZip.entries.some((entry) => !this.files.has(entry.name))
    ) {
      return zipSync(Object.fromEntries(this.files), { level: 6 })
    }

    const locals: Uint8Array[] = []
    const centrals: Uint8Array[] = []
    let localOffset = 0
    for (const entry of this.sourceZip.entries) {
      let local = entry.local
      let crc: number | undefined
      let compressedSize: number | undefined
      if (this.changedRaw.has(entry.name)) {
        const changed = changedLocal(entry, this.files.get(entry.name)!)
        local = changed.local
        crc = changed.crc
        compressedSize = changed.compressedSize
      }
      const central = entry.central.slice()
      writeUint32(central, 42, localOffset)
      if (crc !== undefined && compressedSize !== undefined) {
        writeUint32(central, 16, crc)
        writeUint32(central, 20, compressedSize)
        writeUint32(central, 24, this.files.get(entry.name)!.length)
      }
      locals.push(local)
      centrals.push(central)
      localOffset += local.length
    }
    const centralSize = centrals.reduce((total, bytes) => total + bytes.length, 0)
    const end = this.sourceZip.end.slice()
    writeUint32(end, 12, centralSize)
    writeUint32(end, 16, localOffset)
    const total = localOffset + centralSize + end.length
    const output = new Uint8Array(total)
    let offset = 0
    for (const part of [...locals, ...centrals, end]) {
      output.set(part, offset)
      offset += part.length
    }
    return output
  }
}
