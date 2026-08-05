import assert from "node:assert/strict"
import test from "node:test"
import {
  deviceSpec,
  keyboardPreviewGeometry,
  showsKeyboardAccessories,
} from "../src/devices.ts"

test("uses verified physical display resolutions for common phones", () => {
  assert.deepEqual(deviceSpec("iphone-17-pro"), { width: 1206, height: 2622, family: "iphone" })
  assert.deepEqual(deviceSpec("iphone-17-pro-max"), { width: 1320, height: 2868, family: "iphone" })
  assert.deepEqual(deviceSpec("xiaomi-17"), { width: 1220, height: 2656, family: "android" })
  assert.deepEqual(deviceSpec("pixel-10-pro"), { width: 1280, height: 2856, family: "android" })
  assert.deepEqual(deviceSpec("galaxy-s25-ultra"), {
    width: 1440,
    height: 3120,
    family: "android",
  })
})

test("maps Baidu skin coordinates to the iPhone 17 Pro bottom keyboard", () => {
  const geometry = keyboardPreviewGeometry(
    deviceSpec("iphone-17-pro")!,
    "port",
    1125,
    595,
    133,
  )
  assert.equal(Math.round(geometry.candidateHeight), 244)
  assert.equal(Math.round(geometry.panelHeight), 638)
  assert.equal(Math.round(geometry.safeBottomHeight), 236)
  assert.equal(Math.round(geometry.totalHeight), 1118)
})

test("keeps the iPhone keyboard height fixed while composing", () => {
  const idle = keyboardPreviewGeometry(
    deviceSpec("iphone-17-pro")!,
    "port",
    1125,
    595,
    133,
    false,
  )
  const composing = keyboardPreviewGeometry(
    deviceSpec("iphone-17-pro")!,
    "port",
    1125,
    595,
    133,
    true,
  )
  assert.deepEqual(composing, idle)
})

test("shows keyboard accessories only for an iPhone in portrait", () => {
  assert.equal(showsKeyboardAccessories(deviceSpec("iphone-17-pro"), "port"), true)
  assert.equal(showsKeyboardAccessories(deviceSpec("iphone-17-pro"), "land"), false)
  assert.equal(showsKeyboardAccessories(deviceSpec("xiaomi-17"), "port"), false)
  assert.equal(showsKeyboardAccessories(undefined, "port"), false)
})

test("Android and landscape geometries do not reserve a safe bottom area", () => {
  assert.equal(
    keyboardPreviewGeometry(deviceSpec("xiaomi-17")!, "port", 1125, 595, 133)
      .safeBottomHeight,
    0,
  )
  assert.equal(
    keyboardPreviewGeometry(deviceSpec("iphone-17-pro")!, "land", 1125, 595, 133)
      .safeBottomHeight,
    0,
  )
})

test("never lets a landscape keyboard overflow the screen height", () => {
  for (const id of [
    "iphone-17-pro",
    "iphone-17-pro-max",
    "xiaomi-17",
    "pixel-10-pro",
    "galaxy-s25-ultra",
  ]) {
    const device = deviceSpec(id)!
    const geometry = keyboardPreviewGeometry(device, "land", 1125, 595, 133)
    assert.ok(
      geometry.totalHeight <= device.width,
      `${id} landscape keyboard ${geometry.totalHeight} exceeds screen height ${device.width}`,
    )
  }
  const geometry = keyboardPreviewGeometry(
    deviceSpec("iphone-17-pro")!,
    "land",
    1125,
    595,
    133,
  )
  assert.equal(Math.round(geometry.totalHeight), 1206)
})

test("keeps the keyboard within the portrait screen height", () => {
  const device = deviceSpec("iphone-17-pro")!
  const geometry = keyboardPreviewGeometry(device, "port", 1125, 595, 133)
  assert.ok(geometry.totalHeight <= device.height)
})
