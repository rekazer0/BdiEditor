import assert from "node:assert/strict"
import { strToU8, zipSync } from "fflate"
import { SkinArchive } from "../src/skin.ts"

function setCentralFlags(bytes: Uint8Array, path: string, flags: number): Uint8Array {
  const output = bytes.slice()
  const data = new DataView(output.buffer, output.byteOffset, output.byteLength)
  let end = output.length - 22
  while (data.getUint32(end, true) !== 0x06054b50) end -= 1
  let offset = data.getUint32(end + 16, true)
  const count = data.getUint16(end + 10, true)
  for (let index = 0; index < count; index += 1) {
    const nameLength = data.getUint16(offset + 28, true)
    const extraLength = data.getUint16(offset + 30, true)
    const commentLength = data.getUint16(offset + 32, true)
    const name = new TextDecoder().decode(output.subarray(offset + 46, offset + 46 + nameLength))
    if (name === path) {
      data.setUint16(offset + 8, flags, true)
      return output
    }
    offset += 46 + nameLength + extraLength + commentLength
  }
  throw new Error(`ZIP 条目不存在：${path}`)
}

const files = {
  "Info.txt": strToU8("SupportPlatform=I\nAtomSkinName=morning,midnight\n"),
  "themes/morning/Info.txt": strToU8("SupportPlatform=I\n"),
  "themes/morning/port/appearanceConfig": new Uint8Array(),
  "themes/morning/land/appearanceConfig": new Uint8Array(),
  "themes/morning/res/key.png": new Uint8Array([1]),
  "themes/midnight/Info.txt": strToU8("SupportPlatform=I\n"),
  "themes/midnight/port/appearanceConfig": new Uint8Array(),
  "themes/midnight/land/appearanceConfig": new Uint8Array(),
  "themes/midnight/res/key.png": new Uint8Array([2]),
  "themes/midnight/res/morning/port/appearanceConfig": new Uint8Array(),
}

const archive = SkinArchive.open(zipSync(files), "bda")
assert.equal(archive.format, "bda")
assert.equal(archive.sourcePath("light/skin/port/appearanceConfig"), "themes/morning/port/appearanceConfig")
assert.equal(archive.sourcePath("dark/skin/port/appearanceConfig"), "themes/midnight/port/appearanceConfig")
assert.deepEqual(archive.getBytes("light/skin/res/key.png"), new Uint8Array([1]))
assert.deepEqual(archive.getBytes("dark/skin/res/key.png"), new Uint8Array([2]))
archive.setBytes("dark/skin/res/key.png", new Uint8Array([3]))
const reopened = SkinArchive.open(archive.toBytes(), "bda")
assert.deepEqual(reopened.getBytes("dark/skin/res/key.png"), new Uint8Array([3]), "任意主题目录编辑后应写回原路径")

const contentDetected = SkinArchive.open(zipSync(files))
assert.equal(contentDetected.format, "bda", "源码工作区没有文件后缀时仍应按关键文件识别 BDA")

const mismatchedPath = "themes/morning/port/appearanceConfig"
const mismatched = SkinArchive.open(setCentralFlags(zipSync(files), mismatchedPath, 9), "bda")
mismatched.setBytes("light/skin/port/appearanceConfig", new Uint8Array([1]))
assert.deepEqual(
  SkinArchive.open(mismatched.toBytes(), "bda").getBytes("light/skin/port/appearanceConfig"),
  new Uint8Array([1]),
  "中央目录与本地头 flags 不一致时仍应可导出",
)

assert.throws(
  () => SkinArchive.open(zipSync({ "Info.txt": strToU8("SupportPlatform=I\n") }), "bda"),
  /appearanceConfig/,
  "BDA 后缀不能绕过包内关键文件校验",
)

console.log("✓ BDA 后缀与关键文件共同识别任意主题目录")
