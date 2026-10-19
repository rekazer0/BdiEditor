import { test } from "node:test"
import assert from "node:assert/strict"
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate"
import { SkinArchive } from "../src/skin.ts"
import { buildSxiZip } from "../src/palm/palm-export.ts"
import { canExport, exportFormatFromPath } from "../src/export.ts"
import { compactPalmJSON } from "../src/palm/palm-json.ts"
import { applySxiFragments, encodeSkinJson, parseSkinJson, setSxiFragment, sxiDerivedFiles, sxiFragmentPath } from "../src/palm/sxi-projection.ts"

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

function sourceBds() {
  return SkinArchive.open(zipSync({
    "Info.txt": strToU8("Name=测试皮肤\nAuthor=me\nSupportDarkMode=1\n"),
    "light/port/gen.ini": strToU8("[PANEL]\nSIZE=1080,600\nBACK_STYLE=1\n[CAND]\nLAYOUT_NAME=cand1\n[HINT]\nLAYOUT_NAME=hint1\n"),
    "light/port/py_26.ini": strToU8([
      "[PANEL]", "SIZE=1080,600", "NO_BLUR=1",
      "[KEY1]", "BACK_STYLE=2", "FORE_STYLE=3,4", "POS_TYPE=0,5", "VIEW_RECT=10,0,100,120", "CENTER=q", "UP=F38", "STAT_STYLE=S1_1",
      "[KEY2]", "BACK_STYLE=2", "VIEW_RECT=120,0,100,120", "CENTER=F36",
      "[TIP1]", "BACK_STYLE=5", "CENTER=F39",
      "[LIST]", "POS=0,0", "CELL_SIZE=100,50", "NAMES=a b c", "LIST_ORDER=1",
    ].join("\n")),
    "light/port/cand1.cnd": strToU8("[CAND]\nBACK_STYLE=6\nVIEW_RECT=0,0,1080,120\nPADDING=1,2,3,4\n[ICON0]\nPOS=0,0\nSIZE=10,10\nKEY=F31\nFIX_SIZE=10,10\n"),
    "light/port/hint1.pop": strToU8("[HINT]\nBACK_ICON=0\n[ICON0]\nPOS=1,2\nSIZE=3,4\n"),
    "light/res/default.css": strToU8("[STYLE1]\nNM_IMG=bg,0\n[STYLE3]\nSHOW=中\nFONT_SIZE=40\nNM_COLOR=FF000000\n"),
    "light/res/anim.ini": strToU8("[ANIM1]\nCATEGORY=0\nTYPE=1\nDURATION=200\nFROM=0\nTO=1\n"),
    "light/res/bg.til": strToU8("[IMG0]\nSOURCE_RECT=0,0,10,10\nINNER_RECT=2,2,6,6\n"),
    "light/res/bg.png": PNG,
  }))
}

function sxiArchive() {
  return SkinArchive.open(buildSxiZip(sourceBds()).bytes, "sxi")
}

test("an .sxi opens natively with read-only INI views derived from skin.json", () => {
  const archive = sxiArchive()
  assert.equal(archive.format, "sxi")
  assert.ok(archive.names().includes("light/skin/port/gen.ini"))
  assert.ok(archive.names().includes("light/skin/res/bg.png"))
  const keyboard = archive.getText("light/skin/port/py_26.ini")
  assert.match(keyboard, /\[KEY1\][^[]*VIEW_RECT=10,0,100,120/)
  assert.match(keyboard, /UP=F38/)
  assert.match(keyboard, /STAT_STYLE=S1_1/)
  assert.match(archive.getText("light/skin/res/default.css"), /\[STYLE3\][^[]*SHOW=中/)
  assert.match(archive.getText("light/skin/res/bg.til"), /INNER_RECT=2,2,6,6/)
  assert.match(archive.getText("Info.txt"), /Name=测试皮肤/)
  assert.deepEqual(archive.derivedPointer("light/skin/port/py_26.ini"), ["default", "port_layout", "b", "full26Pinyin"])
  assert.equal(archive.derivedPointer("skin.json"), undefined)
  assert.ok(archive.isText("skin.json"))
  assert.throws(() => archive.setText("light/skin/port/py_26.ini", "[PANEL]\n"), /skin\.json/)
})

test("re-exporting the derived views reproduces every layout and style model", () => {
  const files = unzipSync(buildSxiZip(sourceBds()).bytes)
  const skin = parseSkinJson(strFromU8(files["skin.json"]))
  const tree = { "light/res/bg.png": PNG }
  for (const [path, file] of sxiDerivedFiles(skin)) tree[path.replace(/^light\/skin\//, "light/")] = strToU8(file.text)
  const again = parseSkinJson(strFromU8(unzipSync(buildSxiZip(SkinArchive.open(zipSync(tree))).bytes)["skin.json"]))
  for (const group of ["b", "c", "h"]) {
    assert.equal(compactPalmJSON(again.default.port_layout[group]), compactPalmJSON(skin.default.port_layout[group]), group)
  }
  for (const part of ["ss_1", "ss_2", "info"]) {
    assert.equal(compactPalmJSON(again.default.s_info[part]), compactPalmJSON(skin.default.s_info[part]), part)
  }
  assert.equal(compactPalmJSON(again.info), compactPalmJSON(skin.info))
})

test("editing a skin.json fragment updates the views and saves only skin.json and info.json", () => {
  const archive = sxiArchive()
  const original = archive.toBytes()
  const before = archive.getText("skin.json")
  assert.equal(encodeSkinJson(parseSkinJson(before)), before)

  const skin = parseSkinJson(before)
  setSxiFragment(skin, ["info", "name"], "改名")
  const key = skin.default.port_layout.b.full26Pinyin.keys.find((item) => item.id === "1")
  key.rect = [[10, 0], [90, 120]]
  archive.setText("skin.json", encodeSkinJson(skin))

  assert.match(archive.getText("light/skin/port/py_26.ini"), /VIEW_RECT=10,0,90,120/)
  assert.match(archive.getText("Info.txt"), /Name=改名/)
  assert.equal(parseSkinJson(archive.getText("info.json")).name, "改名")
  assert.deepEqual([...archive.changed].sort(), ["info.json", "skin.json"])

  const saved = unzipSync(archive.toBytes("sxi"))
  const untouched = unzipSync(original)
  assert.equal(parseSkinJson(strFromU8(saved["skin.json"])).info.name, "改名")
  assert.deepEqual(saved["native.layout"], untouched["native.layout"])
  assert.ok(!Object.keys(saved).some((name) => /\.(?:ini|css|til|cnd|pop|txt)$/.test(name)))
})

test("an opened .sxi only saves as .sxi", () => {
  const archive = sxiArchive()
  assert.equal(exportFormatFromPath("skin.SXI"), "sxi")
  assert.ok(canExport("sxi", "sxi"))
  assert.ok(!canExport("sxi", "bds"))
  assert.ok(canExport("bds", "sxi"))
  assert.ok(!canExport("bds", "bda"))
  assert.ok(canExport("ssf", "bda"))
  assert.ok(!canExport("ssf", "sxi"))
  assert.ok(!canExport("sxi", "ssf"))
  assert.equal(exportFormatFromPath("skin.mssf"), "ssf")
  assert.throws(() => archive.toBytes("bds"), /\.sxi/)
})

test("Palm's nested light/skin tree is read as it is, new files stay nested", () => {
  const nested = SkinArchive.open(zipSync({
    "skin.json": strToU8("{}"),
    "Info.txt": strToU8("Name=嵌套"),
    "light/skin/res/bg.png": PNG,
    "light/skin/port/py_9.ini": strToU8("[PANEL]\nSIZE=480,320"),
  }))
  assert.equal(nested.format, "sxi")
  assert.equal(nested.getText("light/skin/port/py_9.ini"), "[PANEL]\nSIZE=480,320")
  assert.deepEqual(nested.getBytes("light/skin/res/bg.png"), PNG)
  assert.equal(nested.sourcePath("light/skin/res/bg.png"), "light/skin/res/bg.png")
  nested.setText("light/skin/res/extra.txt", "x")
  assert.deepEqual(nested.sourceFiles().map((file) => file.path).sort(), [
    "Info.txt",
    "light/skin/port/py_9.ini",
    "light/skin/res/bg.png",
    "light/skin/res/extra.txt",
    "skin.json",
  ])
  // 本编辑器从 BDI/BDS 转出的 .sxi 是扁平的 `light/` 树，仍要映射到同一个规范路径。
  const flat = SkinArchive.open(zipSync({
    "skin.json": strToU8("{}"),
    "Info.txt": strToU8("Name=扁平"),
    "light/res/bg.png": PNG,
    "light/port/py_9.ini": strToU8("[PANEL]\nSIZE=480,320"),
  }))
  assert.deepEqual(flat.getBytes("light/skin/res/bg.png"), PNG)
  assert.equal(flat.sourcePath("light/skin/res/bg.png"), "light/res/bg.png")
})

test("AI fragment drafts merge back into one skin.json edit", () => {
  const archive = sxiArchive()
  const before = archive.getText("skin.json")
  const skin = parseSkinJson(before)
  const board = skin.default.port_layout.b.full26Pinyin
  board.keys[0].b.base_b = 7
  const after = applySxiFragments(before, [
    { path: sxiFragmentPath(["default", "port_layout", "b", "full26Pinyin"]), text: JSON.stringify(board, null, 2) },
    { path: sxiFragmentPath(["info", "name"]), text: '"新名字"' },
  ])
  archive.setText("skin.json", after)
  assert.match(archive.getText("light/skin/port/py_26.ini"), /\[KEY1\]\nBACK_STYLE=7/)
  assert.match(archive.getText("Info.txt"), /Name=新名字/)
})
