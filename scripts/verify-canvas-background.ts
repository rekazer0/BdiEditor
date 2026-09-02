import assert from "node:assert/strict"
import {
  canvasBackgroundFromDevice,
  canvasDeviceValue,
  effectiveDeviceValue,
} from "../src/canvas-background.ts"

for (const background of ["glass", "checkerboard", "white", "gray", "dark"] as const) {
  const value = canvasDeviceValue(background)
  assert.equal(canvasBackgroundFromDevice(value), background)
  assert.equal(effectiveDeviceValue(value), "canvas")
}

assert.equal(canvasBackgroundFromDevice("iphone-17-pro"), undefined)
assert.equal(effectiveDeviceValue("iphone-17-pro"), "iphone-17-pro")
assert.equal(effectiveDeviceValue("canvas"), "canvas")

console.log("✓ 设备下拉框中的画布背景选项可映射回画布预览")
