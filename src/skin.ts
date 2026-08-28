import { strFromU8, strToU8, Unzip, UnzipInflate, unzip, unzipSync, zipSync } from "fflate"
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

type BdaTheme = "light" | "dark"
type PackageInfo = { layout: PackageLayout; bdaRoots?: Map<BdaTheme, string> }

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
    const central = bytes.subarray(offset, offset + length)
    partial.push({
      name: decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength)),
      central,
      localOffset: data.getUint32(offset + 42, true),
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
      return { ...entry, local: bytes.subarray(localOffset, localEnds.get(entry.name)) }
    }),
    end: bytes.subarray(endOffset),
  }
}

function writeUint32(bytes: Uint8Array, offset: number, value: number): void {
  view(bytes).setUint32(offset, value, true)
}

function writeUint16(bytes: Uint8Array, offset: number, value: number): void {
  view(bytes).setUint16(offset, value, true)
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
  if (localView.getUint16(6, true) & 8) {
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

async function unzipWithProgress(
  bytes: Uint8Array,
  onProgress: (value: number) => void,
): Promise<Record<string, Uint8Array>> {
  const expected = view(bytes).getUint16(findEnd(bytes) + 10, true)
  const files: Record<string, Uint8Array> = {}
  let completed = 0
  let inputProgress = 0
  let inputDone = false
  let settled = false
  let resolveResult!: (files: Record<string, Uint8Array>) => void
  let rejectResult!: (error: unknown) => void
  const result = new Promise<Record<string, Uint8Array>>((resolve, reject) => {
    resolveResult = resolve
    rejectResult = reject
  })
  const finish = () => {
    onProgress(inputProgress * 0.7 + (expected ? completed / expected : 1) * 0.3)
    if (inputDone && completed === expected && !settled) {
      settled = true
      resolveResult(files)
    }
  }
  const unzipper = new Unzip((file) => {
    const chunks: Uint8Array[] = []
    let length = 0
    file.ondata = (error, chunk, final) => {
      if (settled) return
      if (error) {
        settled = true
        rejectResult(error)
        return
      }
      chunks.push(chunk)
      length += chunk.length
      if (!final) return
      const data = new Uint8Array(length)
      let offset = 0
      for (const part of chunks) {
        data.set(part, offset)
        offset += part.length
      }
      files[file.name] = data
      completed++
      finish()
    }
    file.start()
  })
  unzipper.register(UnzipInflate)
  const chunkSize = 256 * 1024
  try {
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      const end = Math.min(bytes.length, offset + chunkSize)
      unzipper.push(bytes.subarray(offset, end), end === bytes.length)
      inputProgress = end / bytes.length
      inputDone = end === bytes.length
      finish()
      if (!inputDone) await new Promise<void>((resolve) => setTimeout(resolve, 0))
    }
  } catch (error) {
    settled = true
    rejectResult(error)
  }
  return result
}

function bdaThemeRoots(files: Map<string, Uint8Array>): Map<BdaTheme, string> | undefined {
  const names = [...files.keys()]
  const roots = [...new Set(names.flatMap((name) => {
    const match = name.match(/^(?:(.*)\/)?(?:land|port)\/\d*appearanceConfig$/)
    return match ? [match[1] ?? ""] : []
  }))]
  if (!roots.length) return

  // A complete skin copied below another skin is a resource, not another editable theme.
  const candidates = roots.filter((root) => !roots.some((parent) => parent !== root && (!parent || root.startsWith(`${parent}/`))))
  const result = new Map<BdaTheme, string>()
  for (const theme of ["light", "dark"] as const) {
    if (candidates.includes(theme)) result.set(theme, theme)
  }

  const infoPaths = ["Info.txt", ...candidates.filter(Boolean).map((root) => `${root}/Info.txt`)]
  const declared = infoPaths.flatMap((path) => {
    const bytes = files.get(path)
    const value = bytes && strFromU8(bytes).match(/^AtomSkinName=(.*)$/mi)?.[1]
    return value ? value.split(",").map((item) => item.trim()).filter(Boolean) : []
  })
  const declaredRoots = [...new Set(declared.flatMap((value) => {
    const root = candidates.find((candidate) => candidate === value || candidate.split("/").pop() === value)
    return root === undefined ? [] : [root]
  }))]
  for (const [index, theme] of (["light", "dark"] as const).entries()) {
    if (!result.has(theme) && declaredRoots[index] !== undefined) result.set(theme, declaredRoots[index])
  }

  const used = new Set(result.values())
  // ponytail: undeclared theme semantics use stable path order; add a theme picker if such packages appear.
  const remaining = candidates.filter((root) => !used.has(root)).sort()
  for (const theme of ["light", "dark"] as const) {
    if (!result.has(theme) && remaining.length) result.set(theme, remaining.shift()!)
  }
  return result
}

function packageInfo(files: Map<string, Uint8Array>, formatHint?: ExportFormat): PackageInfo {
  const names = [...files.keys()]
  const bdaRoots = bdaThemeRoots(files)
  if (formatHint === "bda" && !bdaRoots) throw new Error("BDA 皮肤缺少 port/land appearanceConfig")
  if (bdaRoots) return { layout: bdaRoots.size > 1 ? "bda-dual" : "bda-single", bdaRoots }
  if (names.some((name) => /^skin\/(?:dark|light)\/skin\//.test(name))) return { layout: "bdi-dual" }
  if (names.some((name) => /^skin\/(?:land|port|res)\//.test(name))) return { layout: "bdi-single" }
  if (names.some((name) => /^(?:dark|light)\/(?:land|port|res)\//.test(name))) return { layout: "bds-dual" }
  if (names.some((name) => /^(?:land|port|res)\//.test(name))) return { layout: "bds-single" }
  return { layout: "legacy-ios" }
}

function canonicalPath(path: string, layout: PackageLayout, bdaRoots?: Map<BdaTheme, string>): string {
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
  if (layout === "bda-dual" || layout === "bda-single") {
    for (const [theme, root] of bdaRoots ?? []) {
      if (root && path === `${root}/`) return `${theme}/skin/`
      if (root && path.startsWith(`${root}/`)) return `${theme}/skin/${path.slice(root.length + 1)}`
      if (!root && path !== "Info.txt" && path !== "demo.png") return `${theme}/skin/${path}`
    }
    return path
  }
  if (layout === "bds-dual") {
    const themed = path.match(/^(dark|light)(?:\/(.*))?$/)
    if (themed) return `${themed[1]}/skin/${themed[2] ?? ""}`
  }
  if (layout === "bds-single") {
    if (path === "Info.txt" || path === "demo.png") return path
    return `light/skin/${path}`
  }
  return path
}

function rawPath(path: string, layout: PackageLayout, bdaRoots?: Map<BdaTheme, string>): string {
  if (layout === "bdi-dual") {
    if (path === "Info.txt" || path === "demo.png") return `skin/${path}`
    return path.replace(/^(dark|light)\/skin\//, "skin/$1/skin/")
  }
  if (layout === "bdi-single") {
    if (path === "Info.txt" || path === "demo.png") return `skin/${path}`
    return path.replace(/^light\/skin\//, "skin/")
  }
  if (layout === "bda-dual" || layout === "bda-single") {
    const themed = path.match(/^(light|dark)\/skin\/(.*)$/)
    if (!themed) return path
    const root = bdaRoots?.get(themed[1] as BdaTheme) ?? ""
    return root ? `${root}/${themed[2]}` : themed[2]
  }
  if (layout === "bds-dual") {
    return path.replace(/^(dark|light)\/skin\//, "$1/")
  }
  if (layout === "bds-single") {
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
  private bdaRoots?: Map<BdaTheme, string>
  private canonicalToRaw = new Map<string, string>()
  private cachedNames?: string[]
  private changedRaw = new Set<string>()
  readonly changed = new Set<string>()

  private constructor(files: Map<string, Uint8Array>, sourceBytes: Uint8Array, formatHint?: ExportFormat) {
    this.files = files
    this.originals = new Map(files)
    this.sourceBytes = sourceBytes.slice()
    const info = packageInfo(files, formatHint)
    this.layout = info.layout
    this.bdaRoots = info.bdaRoots
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
      const canonical = canonicalPath(raw, this.layout, this.bdaRoots)
      if (canonical && !this.canonicalToRaw.has(canonical)) this.canonicalToRaw.set(canonical, raw)
    }
  }

  get format(): ExportFormat {
    if (this.layout.startsWith("bda")) return "bda"
    return this.layout.startsWith("bds") ? "bds" : "bdi"
  }

  static open(bytes: Uint8Array, formatHint?: ExportFormat): SkinArchive {
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
    return new SkinArchive(files, bytes, formatHint)
  }

  static async openAsync(
    bytes: Uint8Array,
    formatHint?: ExportFormat,
    onProgress?: (value: number) => void,
  ): Promise<SkinArchive> {
    validateArchiveLimits(bytes)
    const unpacked = onProgress
      ? await unzipWithProgress(bytes, (value) => onProgress(value * 0.85))
      : await new Promise<Record<string, Uint8Array>>((resolve, reject) => {
        unzip(bytes, (error, files) => error ? reject(error) : resolve(files))
      })
    const names = Object.keys(unpacked)
    if (names.length > MAX_FILES) throw new Error(`皮肤包含过多文件（${names.length}）`)

    let total = 0
    const files = new Map<string, Uint8Array>()
    for (const [index, name] of names.entries()) {
      if (!safePath(name)) throw new Error(`皮肤包含不安全路径：${name}`)
      total += unpacked[name].byteLength
      if (total > MAX_UNPACKED_BYTES) throw new Error("皮肤解压后超过 256 MB")
      files.set(name, unpacked[name])
      if (onProgress && ((index + 1) % 50 === 0 || index + 1 === names.length)) {
        onProgress(0.85 + (index + 1) / names.length * 0.1)
        await new Promise<void>((resolve) => setTimeout(resolve, 0))
      }
    }
    const archive = new SkinArchive(files, bytes, formatHint)
    onProgress?.(1)
    return archive
  }

  static fromSourceFiles(files: Array<{ path: string; data: Uint8Array }>): SkinArchive {
    return SkinArchive.open(zipSync(Object.fromEntries(files.map((file) => [file.path, file.data])), { level: 0 }))
  }

  names(): string[] {
    this.cachedNames ??= [...this.canonicalToRaw.keys()].sort()
    return this.cachedNames.slice()
  }

  sourceFiles(): Array<{ path: string; data: Uint8Array }> {
    return [...this.files.entries()]
      .filter(([path]) => !path.endsWith("/"))
      .map(([path, data]) => ({ path, data: data.slice() }))
  }

  zipEncryptedPaths(): string[] {
    return this.sourceZip?.entries.filter((entry) => view(entry.central).getUint16(8, true) & 1).map((entry) => entry.name) ?? []
  }

  normalizedBytes(): Uint8Array {
    return zipSync(Object.fromEntries(this.files), { level: 6 })
  }

  sourcePath(path: string): string {
    return this.canonicalToRaw.get(path) ?? rawPath(path, this.layout, this.bdaRoots)
  }

  getSourceBytes(path: string): Uint8Array | undefined {
    return this.files.get(path)
  }

  canonicalSourcePath(path: string): string {
    return canonicalPath(path, this.layout, this.bdaRoots)
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
    const raw = this.canonicalToRaw.get(path) ?? rawPath(path, this.layout, this.bdaRoots)
    const current = this.files.get(raw)
    if (current && current.length === bytes.length && current.every((byte, index) => byte === bytes[index])) {
      return
    }
    const isNewPath = !this.canonicalToRaw.has(path)
    this.files.set(raw, bytes)
    this.canonicalToRaw.set(path, raw)
    if (isNewPath) this.cachedNames = undefined
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
    this.cachedNames = undefined
    if (this.originals.has(raw)) {
      this.changed.add(path)
    } else {
      this.changed.delete(path)
    }
    this.changedRaw.delete(raw)
  }

  markSaved(bytes?: Uint8Array, format = this.format): void {
    if (bytes) {
      if (format !== this.format || this.layout === "legacy-ios") {
        const reopened = SkinArchive.open(bytes, format)
        this.files = reopened.files
        this.originals = reopened.originals
        this.sourceBytes = reopened.sourceBytes
        this.sourceZip = reopened.sourceZip
        this.layout = reopened.layout
        this.bdaRoots = reopened.bdaRoots
        this.canonicalToRaw = reopened.canonicalToRaw
        this.cachedNames = undefined
      } else {
        // The decoded files and paths do not change when saving in place.
        this.originals = new Map(this.files)
        this.sourceBytes = bytes.slice()
        this.sourceZip = parseZip(bytes)
      }
      this.changedRaw.clear()
      this.changed.clear()
      return
    }
    this.originals = new Map(this.files)
    this.changedRaw.clear()
    this.changed.clear()
  }

  private packagedFiles(format: ExportFormat): Record<string, Uint8Array> {
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

    return Object.fromEntries(output)
  }

  private packagedBytes(format: ExportFormat): Uint8Array {
    return zipSync(this.packagedFiles(format), { level: 6 })
  }

  async toBytesAsync(format?: ExportFormat): Promise<Uint8Array> {
    if (format && (format === "bda" || this.format === "bda") && format !== this.format) {
      throw new Error("BDA 与 BDI/BDS 使用不同配置格式，不能转换")
    }
    if (this.changed.size === 0 && (!format || (format === this.format && this.layout !== "legacy-ios"))) {
      return this.sourceBytes.slice()
    }
    // Avoid fflate's one-worker-per-large-file async ZIP path, which can exhaust WebView workers.
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    return this.toBytes(format)
  }

  toBytes(format?: ExportFormat): Uint8Array {
    if (format && (format === "bda" || this.format === "bda") && format !== this.format) {
      throw new Error("BDA 与 BDI/BDS 使用不同配置格式，不能转换")
    }
    if (format && (format !== this.format || this.layout === "legacy-ios")) {
      return this.packagedBytes(format)
    }
    if (this.changed.size === 0) return this.sourceBytes.slice()
    if (!this.sourceZip) {
      return zipSync(Object.fromEntries(this.files), { level: 6 })
    }

    const locals: Uint8Array[] = []
    const centrals: Uint8Array[] = []
    let localOffset = 0
    const sourceNames = new Set(this.sourceZip.entries.map((entry) => entry.name))
    const added = [...this.files.entries()]
      .filter(([name]) => !sourceNames.has(name))
      .map(([name, data]) => parseZip(zipSync({
        [name]: [data, { level: 6, mtime: new Date(1980, 0, 1) }],
      })).entries[0])
    const entries = [
      ...this.sourceZip.entries.filter((entry) => this.files.has(entry.name)),
      ...added,
    ]
    for (const entry of entries) {
      let local = entry.local
      let crc: number | undefined
      let compressedSize: number | undefined
      if (sourceNames.has(entry.name) && this.changedRaw.has(entry.name)) {
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
    writeUint16(end, 8, entries.length)
    writeUint16(end, 10, entries.length)
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
