// Sogou's encrypted skin container, the other `.ssf` / `.mssf` layout besides a plain ZIP:
//
//   "Skin" · uint32 version (3) · AES-256-CBC( uint32 inflated size · zlib( payload ) )
//   payload = uint32 payload size · uint32 table bytes · uint32 offsets[]
//             then per file: uint32 name bytes · UTF-16LE name · uint32 size · body
//
// Format and the public key / IV from frg2089/unSSF (MIT, commit 68cfeab), matching the
// ssf-extractor tool the conversion is checked against. Most such packages are PC skins (skin.ini);
// SsfPackage decides from the unpacked files, not from the container.

import { Unzlib } from "fflate"
import { MAX_ARCHIVE_BYTES, MAX_FILES, MAX_UNPACKED_BYTES, safePath } from "../skin-zip.ts"

const KEY = "5236461AD38503669045162879033623DDBE6F03FF04E3CAD57FFCA350E49ED9"
const IV = "E07AAD35E090AA038A51FD05DF8C5D0F"
const MAX_NAME_BYTES = 16_384
const BROKEN = "搜狗皮肤加密包已损坏"

const hexBytes = (hex: string) => Uint8Array.from(hex.match(/../g)!, (pair) => Number.parseInt(pair, 16))

export function isSkinContainer(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && String.fromCharCode(...bytes.subarray(0, 4)) === "Skin"
}

async function decrypt(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
  try {
    const key = await crypto.subtle.importKey("raw", hexBytes(KEY), "AES-CBC", false, ["decrypt"])
    return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-CBC", iv: hexBytes(IV) }, key, bytes))
  } catch {
    throw new Error(`${BROKEN}：无法解密`)
  }
}

/** Inflates exactly `declared` bytes, stopping as soon as the stream claims more. */
function inflate(data: Uint8Array, declared: number): Uint8Array {
  const out = new Uint8Array(declared)
  let total = 0
  const inflater = new Unzlib((chunk) => {
    if (total + chunk.length > declared) throw new Error(`${BROKEN}：解压大小与声明不符`)
    out.set(chunk, total)
    total += chunk.length
  })
  try {
    inflater.push(data, true)
  } catch (error) {
    throw error instanceof Error && error.message.startsWith(BROKEN) ? error : new Error(`${BROKEN}：解压失败`)
  }
  if (total !== declared) throw new Error(`${BROKEN}：解压大小与声明不符`)
  return out
}

/** Unpacks a version-3 encrypted container into its files. */
export async function unpackSkinContainer(bytes: Uint8Array): Promise<Map<string, Uint8Array>> {
  if (bytes.length > MAX_ARCHIVE_BYTES) throw new Error("皮肤文件超过 64 MB")
  const header = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (bytes.length < 24 || header.getUint32(4, true) !== 3) throw new Error("不支持这个版本的搜狗皮肤加密包")
  const plain = await decrypt(bytes.slice(8))
  if (plain.length < 12) throw new Error(BROKEN)
  const declared = new DataView(plain.buffer, plain.byteOffset, plain.byteLength).getUint32(0, true)
  if (declared > MAX_UNPACKED_BYTES) throw new Error("皮肤解压后超过 256 MB")
  const raw = inflate(plain.subarray(4), declared)
  const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength)
  const u32 = (offset: number) => view.getUint32(offset, true)
  if (raw.length < 8) throw new Error(BROKEN)
  const tableBytes = u32(4)
  if (u32(0) !== raw.length || !tableBytes || tableBytes % 4 || tableBytes / 4 > MAX_FILES || 8 + tableBytes > raw.length) {
    throw new Error(`${BROKEN}：文件表无效`)
  }
  const files = new Map<string, Uint8Array>()
  const seen = new Set<string>()
  const decoder = new TextDecoder("utf-16le")
  let end = 8 + tableBytes
  for (let index = 0; index < tableBytes / 4; index++) {
    const offset = u32(8 + index * 4)
    // Files follow the table in order and never overlap.
    if (offset < end || offset + 4 > raw.length) throw new Error(`${BROKEN}：文件偏移无效`)
    const nameBytes = u32(offset)
    const body = offset + 8 + nameBytes
    if (!nameBytes || nameBytes % 2 || nameBytes > MAX_NAME_BYTES || body > raw.length) throw new Error(`${BROKEN}：文件名无效`)
    const name = decoder.decode(raw.subarray(offset + 4, offset + 4 + nameBytes)).replace(/\\/g, "/")
    end = body + u32(body - 4)
    if (end > raw.length) throw new Error(`${BROKEN}：${name} 被截断`)
    if (!safePath(name)) throw new Error(`皮肤包含不安全路径：${name}`)
    if (seen.has(name.toLowerCase())) throw new Error(`皮肤包含重复文件：${name}`)
    seen.add(name.toLowerCase())
    files.set(name, raw.subarray(body, end))
  }
  return files
}
