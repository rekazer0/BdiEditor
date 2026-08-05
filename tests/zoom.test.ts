import assert from "node:assert/strict"
import test from "node:test"
import { clampZoom, stepZoom } from "../src/zoom.ts"

test("clamps zoom to the supported 50% through 150% range", () => {
  assert.equal(clampZoom(40), 50)
  assert.equal(clampZoom(50), 50)
  assert.equal(clampZoom(100), 100)
  assert.equal(clampZoom(150), 150)
  assert.equal(clampZoom(160), 150)
})

test("steps zoom by 10 points without crossing either limit", () => {
  assert.equal(stepZoom(100, -1), 90)
  assert.equal(stepZoom(100, 1), 110)
  assert.equal(stepZoom(55, -1), 50)
  assert.equal(stepZoom(145, 1), 150)
})
