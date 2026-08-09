import assert from "node:assert/strict"
import test from "node:test"
import {
  bdaLayoutNames,
  bdaResourceIDs,
  decodeBdaAppearance,
  describeBdaConfig,
} from "../src/bda.ts"

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
const styleRef = scalar(2, 7)
const key = message(1, styleRef)
const keyMap = concat(string(1, "KEY1"), message(2, key))
const panel = message(3, keyMap)
const panelMap = (name: string, value: Uint8Array) => concat(string(1, name), message(2, value))
const bytes = concat(
  message(1, imageMap),
  message(4, panelMap("py_9", panel)),
  message(4, panelMap("en_26", new Uint8Array())),
  scalar(6, 1080),
)

test("reads layout names from a BDA appearanceConfig", () => {
  assert.deepEqual(bdaLayoutNames(bytes), ["py_9", "en_26"])
})

test("decodes official BDA appearance style, panel and resource fields", () => {
  const appearance = decodeBdaAppearance(bytes)
  assert.equal(appearance.designWidth, 1080)
  assert.equal(appearance.imageStyles.get(7)?.normalImage?.resource?.resourceID, "key/normal.png")
  assert.deepEqual(appearance.panels.get("py_9")?.keys.get("KEY1")?.backStyle, {
    type: "image",
    key: 7,
  })
  assert.deepEqual(appearance.panels.get("py_9")?.keys.get("KEY1")?.foreStyleOffsets, [])
  assert.deepEqual(bdaResourceIDs(bytes), ["key/normal.png"])
})

test("describes BDA protobuf configuration without exposing editable binary text", () => {
  const summary = describeBdaConfig("light/skin/port/appearanceConfig", bytes)
  assert.match(summary, /图片样式：1/)
  assert.match(summary, /设计宽度：1080/)
  assert.match(summary, /- py_9（1 个按键）/)
  assert.match(summary, /官方 protobuf 字段/)
})
