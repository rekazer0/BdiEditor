import assert from "node:assert/strict"
import { bdaLayoutDocument, decodeBdaAnimation, decodeBdaAppearance } from "../src/bda.ts"
import { IniDocument } from "../src/ini.ts"
import { bdaAnimationBindingsForKey, bdaParticleEmitter, legacyParticleFrames, previewItems } from "../src/preview.ts"

function join(...parts: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(parts.reduce((size, part) => size + part.length, 0))
  let offset = 0
  for (const part of parts) {
    output.set(part, offset)
    offset += part.length
  }
  return output
}

function varint(value: number): Uint8Array {
  const output: number[] = []
  do {
    output.push((value & 0x7f) | (value > 0x7f ? 0x80 : 0))
    value >>>= 7
  } while (value)
  return Uint8Array.from(output)
}

function scalar(number: number, value: number): Uint8Array {
  return join(varint(number * 8), varint(value))
}

function bytes(number: number, value: Uint8Array | string): Uint8Array {
  const payload = typeof value === "string" ? new TextEncoder().encode(value) : value
  return join(varint(number * 8 + 2), varint(payload.length), payload)
}

function float(number: number, value: number): Uint8Array {
  const payload = new Uint8Array(4)
  new DataView(payload.buffer).setFloat32(0, value, true)
  return join(varint(number * 8 + 5), payload)
}

function style(type: number, key: number): Uint8Array {
  return join(scalar(1, type), scalar(2, key))
}

function stringMap(number: number, key: string, value: Uint8Array): Uint8Array {
  return bytes(number, join(bytes(1, key), bytes(2, value)))
}

function numberMap(number: number, key: number, value: Uint8Array): Uint8Array {
  return bytes(number, join(scalar(1, key), bytes(2, value)))
}

const offset = join(float(1, 0.25), float(2, -0.5))
const key = join(
  bytes(1, style(0, 10)),
  bytes(2, style(2, 20)),
  bytes(2, style(2, 21)),
  bytes(3, new Uint8Array()),
  bytes(3, offset),
  bytes(4, style(0, 11)),
)
const list = join(
  bytes(1, style(0, 30)),
  bytes(2, style(0, 31)),
  bytes(3, style(2, 32)),
  bytes(4, style(0, 33)),
  bytes(5, offset),
)
const hint = join(
  bytes(1, offset),
  bytes(2, style(0, 40)),
  bytes(3, style(0, 41)),
  bytes(4, offset),
  bytes(5, style(2, 42)),
  bytes(6, style(0, 43)),
)
const cand = join(
  bytes(1, style(0, 50)),
  bytes(2, style(0, 51)),
  bytes(3, style(0, 52)),
  bytes(4, style(2, 53)),
  bytes(5, style(2, 54)),
  stringMap(10, "KEY_F14", key),
  stringMap(12, "KEY_F15", key),
  bytes(13, key),
  bytes(14, style(0, 55)),
)
const panel = join(
  stringMap(1, "port", hint),
  stringMap(2, "port", list),
  stringMap(3, "KEY_A", key),
  bytes(4, cand),
  bytes(5, join(bytes(1, style(0, 60)), bytes(2, style(2, 61)))),
  bytes(6, join(bytes(1, style(0, 62)), bytes(2, style(2, 63)), bytes(3, style(0, 64)))),
  bytes(7, style(0, 65)),
  scalar(8, 1),
  scalar(9, 0xff00ff00),
  bytes(10, style(0, 66)),
  scalar(11, 1),
  bytes(12, style(0, 67)),
)
const fontInfo = join(
  scalar(1, 28),
  scalar(2, 0xff010203),
  scalar(3, 0xff040506),
  bytes(4, "A"),
  bytes(5, offset),
  scalar(6, 2),
)
const imageStyle = bytes(3, fontInfo)
const gamePanel = join(
  bytes(1, style(0, 70)),
  bytes(4, bytes(1, style(0, 71))),
  stringMap(5, "KEY_F86", key),
)
const appearanceBytes = join(
  numberMap(1, 9, imageStyle),
  stringMap(4, "py_26", panel),
  bytes(5, join(scalar(1, 0xff112233), scalar(5, 0xff445566))),
  scalar(6, 1080),
  bytes(7, gamePanel),
  bytes(8, bytes(1, style(0, 72))),
)

const appearance = decodeBdaAppearance(appearanceBytes)
const decodedPanel = appearance.panels.get("py_26")!

assert.equal(appearance.designWidth, 1080)
assert.deepEqual(appearance.imageStyles.get(9)?.fontInfo, {
  fontSize: 28,
  normalColor: 0xff010203,
  highlightColor: 0xff040506,
  contentText: "A",
  scaledOffset: { x: 0.25, y: -0.5 },
  drawType: 2,
})
assert.equal(appearance.colorPalette?.labelColor, 0xff112233)
assert.equal(appearance.colorPalette?.brandColor, 0xff445566)
assert.equal(appearance.gamePanel?.backStyle?.key, 70)
assert.equal(appearance.gamePanel?.functionBar?.backStyle?.key, 71)
assert.equal(appearance.gamePanel?.keys.get("KEY_F86")?.foreStyles[0]?.key, 20)
assert.equal(appearance.dragBar?.backStyle?.key, 72)
assert.equal(decodedPanel.hints.get("port")?.foreStyle?.key, 42)
assert.equal(decodedPanel.lists.get("port")?.foreStyles[0]?.key, 33)
assert.equal(decodedPanel.cand?.candBarStyle?.key, 50)
assert.equal(decodedPanel.cand?.candKeys.get("KEY_F14")?.backStyle?.key, 10)
assert.equal(decodedPanel.cand?.menuKeys.get("KEY_F15")?.backStyleState?.key, 11)
assert.equal(decodedPanel.cand?.aiIcon?.foreStyles[0]?.key, 20)
assert.equal(decodedPanel.input?.textStyle?.key, 61)
assert.equal(decodedPanel.more?.cellForeStyle?.key, 63)
assert.equal(decodedPanel.shouldBgBlur, true)
assert.equal(decodedPanel.shouldKeySlotting, true)
assert.equal(decodedPanel.trackColor, 0xff00ff00)
assert.deepEqual(decodedPanel.keys.get("KEY_A")?.foreStyleOffsets, [
  { x: 0, y: 0 },
  { x: 0.25, y: -0.5 },
])

const layout = bdaLayoutDocument(IniDocument.parse(`[PANEL]\nBACK_STYLE=1\n[INPUT]\n[MORE]\n[LIST]\n[KEY1]\nCENTER=a\nVIEW_RECT=0,0,100,50\nSTAT_STYLE=S7_1\n[TIP1]\n`), appearance, "py_26")
assert.equal(layout.get("PANEL", "BACK_STYLE"), "1000065")
assert.equal(layout.get("INPUT", "BACK_STYLE"), "1000060")
assert.equal(layout.get("INPUT", "FORE_STYLE"), "3000061")
assert.equal(layout.get("MORE", "FORE_STYLE"), "3000063")
assert.equal(layout.get("KEY1", "BACK_STYLE"), "1000010")
assert.equal(layout.get("KEY1", "FORE_STYLE"), "3000020,3000021")
assert.equal(layout.get("KEY1", "FORE_OFFSET"), "0,0;25,-25")
assert.equal(layout.get("KEY1", "HL_BACK_STYLE"), "1000011")
assert.equal(previewItems(layout)[0]?.highlightBackStyle, "1000011")

decodedPanel.keys.set("KEY_A_S7", {
  ...decodedPanel.keys.get("KEY_A")!,
  backStyle: { type: "color", key: 80 },
})
const stateLayout = bdaLayoutDocument(layout, appearance, "py_26")
assert.equal(stateLayout.get("TIP1", "BACK_STYLE"), "2000080")

decodedPanel.cand!.candKeys.set("CAND_F14", decodedPanel.keys.get("KEY_A")!)
const candidate = bdaLayoutDocument(IniDocument.parse(`[CAND]\n[SWITCH]\n[ICON1]\nKEY=F14\nSIZE=100,50\n`), appearance, "py_26")
assert.equal(candidate.get("CAND", "BACK_STYLE"), "1000050")
assert.equal(candidate.get("CAND", "FORE_STYLE"), "3000053")
assert.equal(candidate.get("CAND", "FIRST_FORE"), "3000054")
assert.equal(candidate.get("ICON1", "BACK_STYLE"), "1000010")
assert.equal(candidate.get("ICON1", "FORE_STYLE"), "3000020,3000021")

const hintDocument = bdaLayoutDocument(IniDocument.parse(`[GLOBAL]\n[HINT]\nBACK_ICON=1\n[BAR]\nBACK_ICON=3\nARROW_ICON=2\n[ICON1]\nSIZE=200,100\n[ICON2]\nSIZE=50,20\n[ICON3]\nSIZE=50,20\n`), appearance, "py_26")
assert.equal(hintDocument.get("ICON1", "BACK_STYLE"), "1000040")
assert.equal(hintDocument.get("ICON1", "FORE_STYLE"), "3000042")
assert.equal(hintDocument.get("ICON1", "POS"), "50,-50")
assert.equal(hintDocument.get("ICON3", "BACK_STYLE"), "1000040")
assert.equal(hintDocument.get("ICON3", "POS"), "12,-10")
assert.equal(hintDocument.get("ICON2", "BACK_STYLE"), "1000041")
assert.equal(hintDocument.get("ICON2", "POS"), "12,-10")
assert.equal(hintDocument.get("BAR", "CELL_STYLE"), "1000043")

const animationItem = join(bytes(1, join(scalar(1, 1), bytes(2, "spark_1"))), scalar(2, 80))
const imageAnimation = bytes(5, animationItem)
const baseAnimation = join(scalar(1, 2), scalar(3, 1), bytes(4, "spark"), scalar(5, 1))
const scaleBinding = join(scalar(1, 2), scalar(2, 2), bytes(4, "press_scale"), scalar(5, 1))
const emitterBinding = join(scalar(1, 0), scalar(2, 2), bytes(3, "stars"), scalar(4, 1))
const animationList = join(bytes(1, baseAnimation), bytes(1, scaleBinding), bytes(2, emitterBinding))
const random = (min: number, max: number) => join(scalar(1, min), scalar(2, max))
const point = (x: Uint8Array, y: Uint8Array) => join(bytes(1, x), bytes(2, y))
const range = (location: number, length: number) => join(float(1, location), float(2, length))
const pressScale = join(
  scalar(1, 1), bytes(5, point(random(100, 100), random(100, 100))),
  bytes(6, point(random(85, 85), random(85, 85))), scalar(7, 50),
)
const stars = join(
  float(6, 1.5), scalar(7, 12), scalar(8, 24),
  bytes(12, join(float(1, 0), float(2, 0), float(3, 1), float(4, 1))),
  bytes(13, join(scalar(1, 0), bytes(2, "star"))), bytes(14, range(800, 200)),
  bytes(17, range(0.5, 0.5)), bytes(19, range(180, 75)), bytes(21, range(20, 10)),
)
const animation = decodeBdaAnimation(join(
  stringMap(1, "KEY_A", animationList),
  stringMap(5, "press_scale", pressScale),
  stringMap(9, "spark", imageAnimation),
  stringMap(10, "stars", stars),
  stringMap(11, "badge", join(scalar(1, 2), bytes(3, join(scalar(1, 7), bytes(2, "badge_json"))))),
  stringMap(13, "movie", join(scalar(1, 1), bytes(3, join(scalar(1, 3), bytes(2, "movie_mp4"))))),
  scalar(12, 1242),
))
assert.deepEqual(animation.targets, ["KEY_A"])
assert.equal(animation.bindings.get("KEY_A"), "spark")
assert.deepEqual(animation.sequences.get("spark")?.frames, [{ resourceID: "spark_1", duration: 80 }])
assert.equal(animation.designWidth, 1242)
assert.deepEqual(animation.targetBindings.get("KEY_A")?.map(({ kind, key, scope, isolated }) => ({ kind, key, scope, isolated })), [
  { kind: "image", key: "spark", scope: 2, isolated: false },
  { kind: "scale", key: "press_scale", scope: 2, isolated: false },
  { kind: "emitter", key: "stars", scope: 0, isolated: true },
])
assert.deepEqual(animation.effects.get("scale:press_scale"), {
  kind: "scale", key: "press_scale", repeatCount: 1, repeatMode: 0, delay: 0,
  removeOnFinish: false, duration: 50, interpolation: 0,
  from: [[100, 100], [100, 100]], to: [[85, 85], [85, 85]], relative: true,
})
assert.deepEqual(animation.effects.get("emitter:stars"), {
  kind: "emitter", key: "stars", repeatCount: 0, repeatMode: 0, removeOnFinish: false,
  duration: 1.5, birthRate: 12, totalNumber: 24, emitRegion: [0, 0, 1, 1],
  resources: [{ type: 0, resourceID: "star" }], life: [800, 1000], rotation: [0, 0],
  spin: [0, 0], scale: [0.5, 1], scaleSpeed: [0, 0], alpha: [180, 255], alphaSpeed: [0, 0],
  velocity: [20, 30], velocityDirection: [0, 0], acceleration: [0, 0], accelerationDirection: [0, 0],
})
assert.equal(animation.effects.get("lottie:badge")?.kind, "lottie")
assert.equal(animation.effects.get("video:movie")?.kind, "video")
const emitter = animation.effects.get("emitter:stars")
assert.ok(emitter?.kind === "emitter")
const particleFrames = legacyParticleFrames(bdaParticleEmitter(emitter), 500, 100, 50)
assert.ok(particleFrames.length > 0)
assert.ok(particleFrames.every((frame) => frame.styleID === "star" && Number.isFinite(frame.x) && Number.isFinite(frame.y)))
animation.targets.push("MAIN_KEY")
animation.targetBindings.set("MAIN_KEY", animation.targetBindings.get("KEY_A")!)
assert.deepEqual(bdaAnimationBindingsForKey(animation, { section: "KEY1", center: "a", down: "" } as never).map(({ kind }) => kind), ["image", "scale", "emitter"])

console.log("✓ 官方 BDA appearanceConfig 与 10 类 animationConfig 字段解析通过")
