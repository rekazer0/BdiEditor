import assert from "node:assert/strict"
import test from "node:test"
import { firstExistingPath, imagePathForSpec, resourceImagePaths } from "../src/resources.ts"

test("resolves orientation-specific and shared image specifications", () => {
  const names = [
    "light/skin/port/res/keys.png",
    "light/skin/res/panel.png",
  ]
  assert.equal(imagePathForSpec(names, "light", "port", "keys,12"), names[0])
  assert.equal(imagePathForSpec(names, "light", "port", "panel,1"), names[1])
  assert.equal(imagePathForSpec(names, "light", "port", "missing,1"), undefined)
})

test("uses current component filename variants", () => {
  const names = ["light/skin/port/cand1.cnd", "light/skin/port/hint1.pop"]
  assert.equal(
    firstExistingPath(names, "light/skin/port", ["cand.cnd", "cand1.cnd"]),
    names[0],
  )
  assert.equal(
    firstExistingPath(names, "light/skin/port", ["hint.pop", "hint1.pop"]),
    names[1],
  )
})

test("lists orientation resources before shared resources without duplicate relative names", () => {
  const names = [
    "light/skin/port/res/key.png",
    "light/skin/port/res/local.png",
    "light/skin/res/key.png",
    "light/skin/res/shared.png",
    "dark/skin/res/ignored.png",
  ]

  assert.deepEqual(resourceImagePaths(names, "light", "port"), [
    "light/skin/port/res/key.png",
    "light/skin/port/res/local.png",
    "light/skin/res/shared.png",
  ])
})
