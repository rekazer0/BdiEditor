import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate"
import { SkinArchive } from "../src/skin.ts"
import { buildSxiZip } from "../src/palm/palm-export.ts"
import { convertSxiToBaidu, convertSxiToBda, sxiToBaiduArchive } from "../src/palm/sxi-to-baidu.ts"
import { canExport } from "../src/export.ts"
import { IniDocument } from "../src/ini.ts"
import { bdsFixture } from "./helpers/baidu-fixture.mjs"

function sxi() {
  return SkinArchive.open(buildSxiZip(SkinArchive.open(bdsFixture())).bytes, "sxi")
}

test("an .sxi exports to BDI, BDS and BDA; SSF stays unreachable", () => {
  assert.ok(canExport("sxi", "bdi"))
  assert.ok(canExport("sxi", "bds"))
  assert.ok(canExport("sxi", "bda"))
  assert.ok(canExport("sxi", "sxi"))
  assert.ok(!canExport("sxi", "ssf"))
  assert.ok(canExport("bds", "sxi"))
})

test("an .sxi becomes a BDS package with the same layouts, styles and resources", async () => {
  const archive = sxi()
  const converted = sxiToBaiduArchive(archive)
  assert.equal(converted.format, "bds")
  for (const path of ["light/skin/port/py_26.ini", "light/skin/port/gen.ini", "light/skin/port/cand1.cnd", "light/skin/res/default.css", "light/skin/res/list_cell.png", "light/skin/res/list_cell.til"]) {
    assert.ok(converted.names().includes(path), path)
  }
  const keyboard = IniDocument.parse(converted.getText("light/skin/port/py_26.ini"))
  assert.equal(keyboard.get("PANEL", "KEY_NUM"), "2")
  assert.equal(keyboard.get("PANEL", "TIP_NUM"), "1")
  const gen = IniDocument.parse(converted.getText("light/skin/port/gen.ini"))
  assert.equal(gen.get("MORE", "SYM_LAYOUT"), "symbol")
  // The list cell background the source BDS designed keeps its style, tile map and image.
  assert.equal(gen.get("LIST", "CELL_STYLE"), "120")
  const styles = IniDocument.parse(converted.getText("light/skin/res/default.css"))
  assert.equal(styles.get("STYLE120", "NM_IMG"), "list_cell,1")
  assert.equal(styles.get("STYLE120", "HL_IMG"), "list_cell,0")

  const bytes = await converted.platformBytesAsync("bds")
  const reopened = SkinArchive.open(bytes, "bds")
  assert.equal(reopened.getText("Info.txt").includes("SupportPlatform=A"), true)
  assert.equal(reopened.getText("Info.txt").includes("Name=测试皮肤"), true)
})

test("an .sxi exports to BDI as an iOS package", async () => {
  const { bytes, warnings } = await convertSxiToBaidu(sxi(), "bdi")
  assert.deepEqual(warnings, [])
  const reopened = SkinArchive.open(bytes, "bdi")
  assert.equal(reopened.format, "bdi")
  assert.equal(reopened.getText("Info.txt").includes("SupportPlatform=I"), true)
  assert.ok(reopened.names().includes("light/skin/port/py_26.ini"))
})

test("an .sxi exports to BDA on the official template", async () => {
  const template = SkinArchive.open(new Uint8Array(readFileSync(new URL("../public/default-template.bda", import.meta.url))), "bda")
  const { bytes, warnings } = await convertSxiToBda(sxi(), template)
  assert.deepEqual(warnings, ["百度按键动画在搜狗皮肤中没有对应，已忽略"])
  const reopened = SkinArchive.open(bytes, "bda")
  assert.equal(reopened.format, "bda")
  assert.ok(reopened.names().some((path) => /appearanceConfig$/.test(path)))
})
