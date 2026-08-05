import assert from "node:assert/strict"
import test from "node:test"
import {
  exportFormatFromPath,
  exportName,
  exportPath,
  type ExportFormat,
} from "../src/export.ts"

test("detects bdi and bds export formats independently", () => {
  assert.equal(exportFormatFromPath("/tmp/skin.bdi"), "bdi")
  assert.equal(exportFormatFromPath("/tmp/skin.BDS"), "bds")
  assert.equal(exportFormatFromPath("/tmp/skin.zip"), undefined)
})

test("replaces the destination extension with the selected export format", () => {
  const cases: Array<[string, ExportFormat, string]> = [
    ["/tmp/skin.bdi", "bds", "/tmp/skin.bds"],
    ["/tmp/skin.bds", "bdi", "/tmp/skin.bdi"],
    ["/tmp/skin", "bdi", "/tmp/skin.bdi"],
  ]
  for (const [path, format, expected] of cases) assert.equal(exportPath(path, format), expected)
})

test("creates a matching default export filename", () => {
  assert.equal(exportName("my-skin.bdi", "bds"), "my-skin.bds")
  assert.equal(exportName("未命名皮肤", "bdi"), "未命名皮肤.bdi")
})
