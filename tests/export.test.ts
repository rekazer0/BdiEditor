import assert from "node:assert/strict"
import test from "node:test"
import {
  exportFormatFromPath,
  exportName,
  exportPath,
  isUnnamedSkinName,
  type ExportFormat,
} from "../src/export.ts"

test("detects bdi, bds and bda export formats independently", () => {
  assert.equal(exportFormatFromPath("/tmp/skin.bdi"), "bdi")
  assert.equal(exportFormatFromPath("/tmp/skin.BDS"), "bds")
  assert.equal(exportFormatFromPath("/tmp/skin.bda"), "bda")
  assert.equal(exportFormatFromPath("/tmp/skin.zip"), undefined)
})

test("recognises browser and project placeholder skin names", () => {
  assert.equal(isUnnamedSkinName("未命名.bds"), true)
  assert.equal(isUnnamedSkinName("未命名 (6).bdi"), true)
  assert.equal(isUnnamedSkinName("未命名皮肤.bda"), true)
  assert.equal(isUnnamedSkinName("我的皮肤.bdi"), false)
})

test("replaces the destination extension with the selected export format", () => {
  const cases: Array<[string, ExportFormat, string]> = [
    ["/tmp/skin.bdi", "bds", "/tmp/skin.bds"],
    ["/tmp/skin.bds", "bdi", "/tmp/skin.bdi"],
    ["/tmp/skin.bds", "bda", "/tmp/skin.bda"],
    ["/tmp/skin", "bdi", "/tmp/skin.bdi"],
  ]
  for (const [path, format, expected] of cases) assert.equal(exportPath(path, format), expected)
})

test("creates a matching default export filename", () => {
  assert.equal(exportName("my-skin.bdi", "bds"), "my-skin.bds")
  assert.equal(exportName("未命名皮肤", "bdi"), "未命名皮肤.bdi")
  assert.equal(exportName("new-skin", "bda"), "new-skin.bda")
})
