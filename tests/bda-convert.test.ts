import assert from "node:assert/strict"
import test from "node:test"
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate"
import { convertBdaArchive } from "../src/bda-convert.ts"
import { SkinArchive } from "../src/skin.ts"

const concat = (...parts: Uint8Array[]) => {
  const output = new Uint8Array(parts.reduce((size, part) => size + part.length, 0))
  let offset = 0
  for (const part of parts) {
    output.set(part, offset)
    offset += part.length
  }
  return output
}
const varint = (value: number) => {
  const output: number[] = []
  do {
    const byte = value & 0x7f
    value = Math.floor(value / 128)
    output.push(byte | (value ? 0x80 : 0))
  } while (value)
  return Uint8Array.from(output)
}
const scalar = (number: number, value: number) => concat(varint(number * 8), varint(value))
const message = (number: number, value: Uint8Array) => concat(varint(number * 8 + 2), varint(value.length), value)
const string = (number: number, value: string) => message(number, new TextEncoder().encode(value))

function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24)
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10])
  bytes.set([73, 72, 68, 82], 12)
  const view = new DataView(bytes.buffer)
  view.setUint32(16, width)
  view.setUint32(20, height)
  return bytes
}

const styleRef = concat(scalar(1, 0), scalar(2, 7))
const imageResource = string(2, "image_1")
const imageStyle = message(1, message(1, imageResource))
const imageMap = concat(scalar(1, 7), message(2, imageStyle))
const key = message(1, styleRef)
const keyMap = concat(string(1, "KEY_B"), message(2, key))
const panel = message(3, keyMap)
const panelMap = concat(string(1, "py_9"), message(2, panel))
const appearance = concat(
  message(1, imageMap),
  message(4, panelMap),
  message(4, concat(string(1, "dial"), message(2, new Uint8Array()))),
  scalar(6, 1080),
)

const frame = concat(message(1, string(2, "frame_0")), scalar(2, 16))
const sequence = concat(message(5, frame))
const animation = concat(
  message(1, concat(string(1, "MAIN_KEY"), message(2, new Uint8Array()))),
  message(9, concat(string(1, "image_1"), message(2, sequence))),
)

const source = SkinArchive.open(zipSync({
  "Info.txt": strToU8("Name=Converted\nSkinType=1\n"),
  "light/port/appearanceConfig": appearance,
  "light/port/animationConfig": animation,
  "light/res/frame_0.png": png(40, 20),
}))
const base = SkinArchive.open(zipSync({
  "light/skin/port/gen.ini": strToU8("[PANEL]\nSIZE=1080,640\n"),
  "light/skin/port/py_9.ini": strToU8("[KEY1]\nCENTER=b\nVIEW_RECT=0,0,100,100\n"),
  "light/skin/port/unused.ini": strToU8("[KEY1]\nCENTER=x\n"),
}))

test("converts one BDA appearance into importable BDS and BDI archives", () => {
  const result = convertBdaArchive(source, base)
  const bdsBytes = result.archive.toBytes("bds")
  const bdiBytes = result.archive.toBytes("bdi")
  const bds = unzipSync(bdsBytes)
  const bdi = unzipSync(bdiBytes)

  assert.ok(bds["light/port/py_9.ini"])
  assert.equal(bds["light/port/unused.ini"], undefined)
  assert.ok(bds["light/res/default.css"])
  assert.ok(bds["light/res/frame_0.png"])
  assert.ok(bds["light/res/frame_0.til"])
  assert.ok(bdi["skin/light/skin/port/py_9.ini"])
  assert.equal(SkinArchive.open(bdsBytes).format, "bds")
  assert.equal(SkinArchive.open(bdiBytes).format, "bdi")
})

test("maps BDA image styles and degrades animation sequences to their first frame", () => {
  const result = convertBdaArchive(source, base)
  const css = strFromU8(unzipSync(result.archive.toBytes("bds"))["light/res/default.css"])
  const layout = strFromU8(unzipSync(result.archive.toBytes("bds"))["light/port/py_9.ini"])

  assert.match(css, /\[STYLE1000007\]/)
  assert.match(css, /NM_IMG=frame_0,1/)
  assert.match(layout, /BACK_STYLE=1000007/)
  assert.ok(result.warnings.some((warning) => /1 个序列帧动画/.test(warning)))
  assert.ok(result.warnings.some((warning) => /dial/.test(warning)))
})

test("does not mutate the native BDA while converting", () => {
  const before = source.toBytes("bda")
  convertBdaArchive(source, base)
  assert.deepEqual(source.toBytes("bda"), before)
})
