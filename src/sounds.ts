import { IniDocument } from "./ini.ts"

export const SOUND_ACCEPT = ".ogg,.wav,.aiff,.aif,audio/ogg,audio/wav,audio/x-aiff"

export type IniSoundStyle = {
  styleID: string
  filename: string
}

export type DecodedSound = {
  channelData: Float32Array[]
  samplesDecoded: number
  sampleRate: number
}

export function isSoundPath(path: string): boolean {
  return /\.(?:ogg|wav|aiff?|caf)$/i.test(path)
}

export function soundMimeType(path: string): string {
  if (/\.ogg$/i.test(path)) return "audio/ogg"
  if (/\.wav$/i.test(path)) return "audio/wav"
  if (/\.aiff?$/i.test(path)) return "audio/x-aiff"
  if (/\.caf$/i.test(path)) return "audio/x-caf"
  return "application/octet-stream"
}

export function decodeAiffPcm(bytes: Uint8Array): DecodedSound {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const text = (offset: number, length: number) => new TextDecoder("ascii").decode(bytes.subarray(offset, offset + length))
  if (bytes.length < 12 || text(0, 4) !== "FORM" || !/^AIF[FC]$/.test(text(8, 4))) {
    throw new Error("不是有效的 AIFF 文件")
  }
  let channels = 0
  let frames = 0
  let bits = 0
  let sampleRate = 0
  let littleEndian = false
  let soundOffset = -1
  let soundLength = 0
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const id = text(offset, 4)
    const size = view.getUint32(offset + 4)
    const start = offset + 8
    if (start + size > bytes.length) throw new Error("AIFF 数据块不完整")
    if (id === "COMM" && size >= 18) {
      channels = view.getUint16(start)
      frames = view.getUint32(start + 2)
      bits = view.getUint16(start + 6)
      const exponent = ((bytes[start + 8] & 0x7f) << 8) | bytes[start + 9]
      const mantissa = view.getUint32(start + 10) * 2 ** 32 + view.getUint32(start + 14)
      sampleRate = mantissa * 2 ** (exponent - 16383 - 63)
      const compression = size >= 22 ? text(start + 18, 4) : "NONE"
      if (compression !== "NONE" && compression !== "sowt") throw new Error(`不支持的 AIFC 编码：${compression}`)
      littleEndian = compression === "sowt"
    } else if (id === "SSND" && size >= 8) {
      const dataOffset = view.getUint32(start)
      soundOffset = start + 8 + dataOffset
      soundLength = size - 8 - dataOffset
    }
    offset = start + size + (size & 1)
  }
  if (!channels || !frames || !sampleRate || soundOffset < 0 || ![8, 16, 24, 32].includes(bits)) {
    throw new Error("AIFF 缺少可播放的 PCM 数据")
  }
  const bytesPerSample = bits / 8
  const samplesDecoded = Math.min(frames, Math.floor(soundLength / (channels * bytesPerSample)))
  const channelData = Array.from({ length: channels }, () => new Float32Array(samplesDecoded))
  for (let frame = 0; frame < samplesDecoded; frame++) {
    for (let channel = 0; channel < channels; channel++) {
      const offset = soundOffset + (frame * channels + channel) * bytesPerSample
      let sample: number
      if (bits === 8) sample = view.getInt8(offset) / 128
      else if (bits === 16) sample = view.getInt16(offset, littleEndian) / 32768
      else if (bits === 24) {
        const value = littleEndian
          ? bytes[offset] | bytes[offset + 1] << 8 | bytes[offset + 2] << 16
          : bytes[offset] << 16 | bytes[offset + 1] << 8 | bytes[offset + 2]
        sample = ((value & 0x800000) ? value | 0xff000000 : value) / 8388608
      } else sample = view.getInt32(offset, littleEndian) / 2147483648
      channelData[channel][frame] = sample
    }
  }
  return { channelData, samplesDecoded, sampleRate }
}

export function soundResourcePaths(
  names: readonly string[],
  theme: string,
  orientation: string,
): string[] {
  const roots = [`${theme}/skin/${orientation}/res/`, `${theme}/skin/res/`]
  const relative = new Set<string>()
  return roots.flatMap((root) => names
    .filter((path) => path.startsWith(root) && isSoundPath(path))
    .sort()
    .flatMap((path) => {
      const name = path.slice(root.length)
      if (relative.has(name)) return []
      relative.add(name)
      return [path]
    }))
}

export function soundPathForFilename(
  names: readonly string[],
  theme: string,
  orientation: string,
  filename: string,
): string | undefined {
  const clean = filename.trim().split(/[\\/]/).pop()
  if (!clean) return
  const stem = clean.replace(/\.(?:ogg|wav|aiff?|caf)$/i, "")
  return soundResourcePaths(names, theme, orientation).find((path) => {
    const name = path.split("/").pop() ?? path
    return name.toLowerCase() === clean.toLowerCase()
      || name.replace(/\.(?:ogg|wav|aiff?|caf)$/i, "").toLowerCase() === stem.toLowerCase()
  })
}

export function iniSoundStyles(styles: IniDocument): IniSoundStyle[] {
  return styles.sections().flatMap((section) => {
    const styleID = section.match(/^STYLE(.+)$/i)?.[1]
    const filename = styles.get(section, "PRESS_SOUND_PATH")?.trim()
    return styleID && filename ? [{ styleID, filename }] : []
  })
}

export function soundStyleForKey(
  layout: IniDocument,
  section: string,
  general?: IniDocument,
): string | undefined {
  return layout.get(section, "SOUND_STYLE")?.trim()
    || layout.get("PANEL", "SOUND_STYLE")?.trim()
    || general?.get("PANEL", "SOUND_STYLE")?.trim()
    || undefined
}

export function soundFilenameForKey(
  layout: IniDocument,
  section: string,
  styles: IniDocument,
  general?: IniDocument,
): string | undefined {
  const styleID = soundStyleForKey(layout, section, general)
  return styleID ? styles.get(`STYLE${styleID}`, "PRESS_SOUND_PATH")?.trim() || undefined : undefined
}

export function nextSoundStyleID(styles: IniDocument): string {
  const ids = styles.sections()
    .map((section) => Number(section.match(/^STYLE(\d+)$/i)?.[1]))
    .filter(Number.isSafeInteger)
  return String((ids.length ? Math.max(...ids) : -1) + 1)
}

export function setIniSoundStyle(styles: IniDocument, styleID: string, filename: string): void {
  const section = `STYLE${styleID}`
  if (!styles.sections().includes(section)) styles.appendSection(section, [])
  styles.set(section, "PRESS_SOUND_PATH", filename)
  const maximum = Number(styles.get("GLOBAL", "STYLE_NUM") ?? -1)
  const numeric = Number(styleID)
  if (!Number.isFinite(maximum) || numeric > maximum) styles.set("GLOBAL", "STYLE_NUM", styleID)
}
