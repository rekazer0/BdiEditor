import assert from "node:assert/strict"
import test from "node:test"
import {
  candidateBackgroundLogicalHeight,
  deviceSpec,
  keyboardPreviewGeometry,
  showsKeyboardAccessories,
} from "../src/devices.ts"

test("uses verified physical display resolutions for common phones", () => {
  assert.equal(deviceSpec("iphone-15-pro"), undefined)
  assert.deepEqual(deviceSpec("iphone-17-pro"), {
    width: 1206,
    height: 2622,
    family: "iphone",
    frame: {
      width: 68.98,
      height: 150.01,
      screenWidth: 66.67,
      screenHeight: 147.61,
      viewportWidth: 402,
      viewportHeight: 874,
    },
  })
  assert.deepEqual(deviceSpec("iphone-17-pro-max"), {
    width: 1320,
    height: 2868,
    family: "iphone",
    frame: {
      width: 74.86,
      height: 163.43,
      screenWidth: 72.56,
      screenHeight: 161.03,
      viewportWidth: 440,
      viewportHeight: 956,
    },
  })
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
  assert.equal(Math.round(geometry.candidateHeight), 213)
  assert.equal(Math.round(geometry.panelHeight), 638)
  assert.equal(Math.round(geometry.safeBottomHeight), 236)
  assert.equal(Math.round(geometry.totalHeight), 1087)
})

test("keeps the iPhone candidate area fixed while composing", () => {
  const idle = keyboardPreviewGeometry(
    deviceSpec("iphone-17-pro")!,
    "port",
    1125,
    595,
    133,
  )
  const composing = keyboardPreviewGeometry(
    deviceSpec("iphone-17-pro")!,
    "port",
    1125,
    595,
    133,
  )
  assert.equal(Math.round(idle.candidateInsetHeight), 71)
  assert.deepEqual(composing, idle)
})

test("keeps height-limited keyboard geometry fixed while composing", () => {
  const device = { width: 1125, height: 800, family: "iphone" as const }
  const idle = keyboardPreviewGeometry(device, "port", 1125, 595, 133)
  const composing = keyboardPreviewGeometry(device, "port", 1125, 595, 133)

  assert.deepEqual(composing, idle)
})

test("extends the candidate skin background by a stable iPhone candidate inset", () => {
  assert.equal(candidateBackgroundLogicalHeight(deviceSpec("iphone-17-pro"), "port", 109), 175)
  assert.equal(candidateBackgroundLogicalHeight(deviceSpec("iphone-17-pro"), "land", 109), 109)
  assert.equal(candidateBackgroundLogicalHeight(deviceSpec("xiaomi-17"), "port", 109), 109)
  assert.equal(candidateBackgroundLogicalHeight(undefined, "port", 109), 109)
})

test("shows keyboard accessories only for an iPhone in portrait", () => {
  assert.equal(showsKeyboardAccessories(deviceSpec("iphone-17-pro"), "port"), true)
  assert.equal(showsKeyboardAccessories(deviceSpec("iphone-17-pro"), "land"), false)
  assert.equal(showsKeyboardAccessories(deviceSpec("xiaomi-17"), "port"), false)
  assert.equal(showsKeyboardAccessories(undefined, "port"), false)
})

test("Android portrait geometry reserves a gesture-navigation bottom inset", () => {
  assert.equal(
    Math.round(keyboardPreviewGeometry(deviceSpec("xiaomi-17")!, "port", 1125, 595, 133).safeBottomHeight),
    73,
  )
  assert.equal(
    Math.round(keyboardPreviewGeometry(deviceSpec("pixel-10-pro")!, "port", 1125, 595, 133).safeBottomHeight),
    77,
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
