import assert from "node:assert/strict"
import test from "node:test"
import { zipSync } from "fflate"
import {
  BdaResolver,
  bdaConfigPath,
  bdaLayoutDocument,
  bdaLayoutNames,
  bdaResourceIDs,
  bdaStyleID,
  decodeBdaAnimation,
  decodeBdaAppearance,
  describeBdaConfig,
  updateBdaAnimationFrame,
  updateBdaStyle,
} from "../src/bda.ts"
import { IniDocument } from "../src/ini.ts"
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
  return new Uint8Array(output)
}
const scalar = (number: number, value: number) => concat(varint(number * 8), varint(value))
const message = (number: number, value: Uint8Array) => concat(varint(number * 8 + 2), varint(value.length), value)
const string = (number: number, value: string) => message(number, new TextEncoder().encode(value))

const resource = string(2, "key/normal.png")
const imageStyle = message(1, message(1, resource))
const imageMap = concat(scalar(1, 7), message(2, imageStyle))
const textStyle = concat(string(2, "Old"), scalar(3, 60), scalar(4, 0xff112233), scalar(99, 42))
const textMap = concat(scalar(1, 8), message(2, textStyle))
const styleRef = scalar(2, 7)
const key = message(1, styleRef)
const keyMap = concat(string(1, "KEY_B"), message(2, key))
const panel = message(3, keyMap)
const panelMap = (name: string, value: Uint8Array) => concat(string(1, name), message(2, value))
const bytes = concat(
  message(1, imageMap),
  message(2, textMap),
  message(4, panelMap("py_9", panel)),
  message(4, panelMap("en_26", new Uint8Array())),
  scalar(6, 1080),
)

const animationFrame = (resourceID: string, duration: number) =>
  concat(message(1, string(2, resourceID)), scalar(2, duration))
const animationSequence = concat(
  scalar(1, 1),
  scalar(4, 1),
  message(5, animationFrame("frame_0", 16)),
  message(5, animationFrame("frame_1", 24)),
  scalar(99, 42),
)
const animation = concat(
  message(1, concat(string(1, "MAIN_KEY"), message(2, new Uint8Array()))),
  message(9, concat(string(1, "image_1"), message(2, animationSequence))),
)

test("reads layout names from a BDA appearanceConfig", () => {
  assert.deepEqual(bdaLayoutNames(bytes), ["py_9", "en_26"])
})

test("decodes official BDA appearance style, panel and resource fields", () => {
  const appearance = decodeBdaAppearance(bytes)
  assert.equal(appearance.designWidth, 1080)
  assert.equal(appearance.imageStyles.get(7)?.normalImage?.resource?.resourceID, "key/normal.png")
  assert.deepEqual(appearance.panels.get("py_9")?.keys.get("KEY_B")?.backStyle, {
    type: "image",
    key: 7,
  })
  assert.deepEqual(appearance.panels.get("py_9")?.keys.get("KEY_B")?.foreStyleOffsets, [])
  assert.deepEqual(bdaResourceIDs(bytes), ["key/normal.png"])
})

test("maps official layout actions to BDA semantic keys", () => {
  const layout = bdaLayoutDocument(
    IniDocument.parse("[KEY1]\nVIEW_RECT=1,2,3,4\nCENTER=b\n"),
    decodeBdaAppearance(bytes),
    "py_9.ini",
  )
  assert.equal(layout.get("KEY1", "BACK_STYLE"), bdaStyleID({ type: "image", key: 7 }))
  assert.equal(layout.get("KEY1", "VIEW_RECT"), "1,2,3,4")
})

test("updates a BDA protobuf style without dropping unknown fields", () => {
  const updated = updateBdaStyle(bytes, { type: "text", key: 8 }, "FONT_SIZE", "72")
  assert.equal(decodeBdaAppearance(updated).textStyles.get(8)?.fontSize, 72)
  assert.notEqual(Buffer.from(updated).indexOf(Buffer.from(scalar(99, 42))), -1)
})

test("describes BDA protobuf configuration without exposing editable binary text", () => {
  const summary = describeBdaConfig("light/skin/port/appearanceConfig", bytes)
  assert.match(summary, /图片样式：1/)
  assert.match(summary, /设计宽度：1080/)
  assert.match(summary, /- py_9（1 个按键）/)
  assert.match(summary, /官方 protobuf 字段/)
})

test("resolves raw style IDs used by the official BDA candidate configuration", () => {
  const resolver = new BdaResolver({} as never, bytes)
  assert.equal(resolver.resolveText("8", false)?.fontName, "Old")
})

test("decodes BDA animation targets and frame resources", () => {
  const decoded = decodeBdaAnimation(animation)
  assert.deepEqual(decoded.targets, ["MAIN_KEY"])
  assert.deepEqual(decoded.sequences.get("image_1")?.frames, [
    { resourceID: "frame_0", duration: 16 },
    { resourceID: "frame_1", duration: 24 },
  ])
})

test("updates one BDA animation frame without dropping unknown fields", () => {
  const resourceUpdated = updateBdaAnimationFrame(animation, "image_1", 1, "resourceID", "pressed_1")
  const durationUpdated = updateBdaAnimationFrame(resourceUpdated, "image_1", 1, "duration", 32)
  assert.deepEqual(decodeBdaAnimation(durationUpdated).sequences.get("image_1")?.frames[1], {
    resourceID: "pressed_1",
    duration: 32,
  })
  assert.notEqual(Buffer.from(durationUpdated).indexOf(Buffer.from(scalar(99, 42))), -1)
})

test("finds only BDA configuration files that actually exist", () => {
  const archive = SkinArchive.open(zipSync({
    "light/port/appearanceConfig": bytes,
    "light/port/animationConfig": animation,
  }))
  assert.equal(bdaConfigPath(archive, "light", "port", "animation"), "light/skin/port/animationConfig")
  assert.equal(bdaConfigPath(archive, "light", "port", "sound"), undefined)
})

test("describes BDA animation targets, sequences and frames", () => {
  const summary = describeBdaConfig("light/skin/port/animationConfig", animation)
  assert.match(summary, /动画目标：1/)
  assert.match(summary, /动画序列：1/)
  assert.match(summary, /序列帧：2/)
})
