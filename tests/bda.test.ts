import assert from "node:assert/strict"
import test from "node:test"
import { zipSync } from "fflate"
import {
  BdaResolver,
  bdaConfigPath,
  bdaFilterColor,
  bdaLayoutDocument,
  bdaLayoutNames,
  bdaResourceIDs,
  bdaSoundResourceType,
  bdaStyleID,
  decodeBdaAnimation,
  decodeBdaAppearance,
  decodeBdaSoundConfig,
  describeBdaConfig,
  updateBdaAnimationFrame,
  updateBdaDesignWidth,
  updateBdaKeySound,
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
const fixed32 = (number: number, value: number) => {
  const output = new Uint8Array(5)
  output[0] = number * 8 + 5
  new DataView(output.buffer).setFloat32(1, value, true)
  return output
}
const message = (number: number, value: Uint8Array) => concat(varint(number * 8 + 2), varint(value.length), value)
const string = (number: number, value: string) => message(number, new TextEncoder().encode(value))

test("decodes and updates BDA key sounds without dropping unknown fields", () => {
  const soundResource = concat(scalar(1, 5), string(2, "10001"), scalar(99, 7))
  const soundEntry = concat(string(1, "KEY_A"), message(2, soundResource))
  const bytes = concat(message(1, soundEntry), scalar(88, 9))
  const decoded = decodeBdaSoundConfig(bytes)
  assert.deepEqual(decoded.keySounds.get("KEY_A"), { type: 5, resourceID: "10001" })
  const updated = updateBdaKeySound(bytes, "KEY_A", { type: 4, resourceID: "key.wav" })
  assert.deepEqual(decodeBdaSoundConfig(updated).keySounds.get("KEY_A"), { type: 4, resourceID: "key.wav" })
  assert.ok([...updated].includes(7))
  assert.ok([...updated].includes(9))
  const added = updateBdaKeySound(updated, "KEY_B", { type: 10, resourceID: "space.aiff" })
  assert.equal(decodeBdaSoundConfig(added).keySounds.get("KEY_B")?.resourceID, "space.aiff")
  assert.equal(bdaSoundResourceType("key.ogg"), 5)
})

const resource = string(2, "key/normal.png")
const imageStyle = message(1, message(1, resource))
const imageMap = concat(scalar(1, 7), message(2, imageStyle))
const textStyle = concat(string(2, "Old"), scalar(3, 60), scalar(4, 0xff112233), string(6, "ABC"), scalar(99, 42))
const textMap = concat(scalar(1, 8), message(2, textStyle))
const styleRef = scalar(2, 7)
const textStyleRef = concat(scalar(1, 2), scalar(2, 8))
const foreOffset = concat(fixed32(1, 0.1), fixed32(2, -0.25))
const key = concat(message(1, styleRef), message(2, textStyleRef), message(3, foreOffset))
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
  assert.deepEqual(appearance.panels.get("py_9")?.keys.get("KEY_B")?.foreStyleOffsets, [
    { x: 0.10000000149011612, y: -0.25 },
  ])
  assert.deepEqual(bdaResourceIDs(bytes), ["key/normal.png"])
})

test("maps official layout actions to BDA semantic keys", () => {
  const layout = bdaLayoutDocument(
    IniDocument.parse("[KEY1]\nVIEW_RECT=1,2,10,20\nCENTER=b\n"),
    decodeBdaAppearance(bytes),
    "py_9.ini",
  )
  assert.equal(layout.get("KEY1", "BACK_STYLE"), bdaStyleID({ type: "image", key: 7 }))
  assert.equal(layout.get("KEY1", "VIEW_RECT"), "1,2,10,20")
  assert.equal(layout.get("KEY1", "FORE_STYLE"), bdaStyleID({ type: "text", key: 8 }))
  const offset = layout.get("KEY1", "FORE_OFFSET")?.split(",").map(Number)
  assert.ok(offset)
  assert.ok(Math.abs(offset[0] - 1) < 0.0001)
  assert.equal(offset[1], -5)
})

test("updates a BDA protobuf style without dropping unknown fields", () => {
  const updated = updateBdaStyle(bytes, { type: "text", key: 8 }, "FONT_SIZE", "72")
  assert.equal(decodeBdaAppearance(updated).textStyles.get(8)?.fontSize, 72)
  assert.notEqual(Buffer.from(updated).indexOf(Buffer.from(scalar(99, 42))), -1)
})

test("updates BDA design width for a scaled target panel", () => {
  const updated = updateBdaDesignWidth(bytes, 1920)
  assert.equal(decodeBdaAppearance(updated).designWidth, 1920)
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
  assert.equal(resolver.resolveStyleText?.("8", false), undefined)
  assert.deepEqual(resolver.resolveStyleText?.(bdaStyleID({ type: "text", key: 8 }), false), {
    text: "ABC",
    fontName: "Old",
    fontSize: 60,
    color: "rgba(17, 34, 51, 1)",
  })
})

test("treats BDA filterColor as a tint, dropping opaque white and zero", () => {
  assert.equal(bdaFilterColor(0), undefined)
  assert.equal(bdaFilterColor(0xffffffff), undefined)
  assert.equal(bdaFilterColor(0x80ff0000), "rgba(255, 0, 0, 0.502)")
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
