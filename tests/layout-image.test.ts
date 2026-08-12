import assert from "node:assert/strict"
import test from "node:test"
import { IniDocument } from "../src/ini.ts"
import {
  applyCandidateImageStyles,
  applyLayoutImageRects,
  applyLayoutImageStyles,
  layoutKeyRects,
  matchLayoutKeysToCells,
  nextStyleID,
  nextTileIndex,
  planLayoutImage,
  planLayoutImageSlices,
  validateKeyRects,
} from "../src/layout-image.ts"
import { tileSlices, updateTileSlice } from "../src/tiles.ts"

const layoutText =
  "[PANEL]\nSIZE=1000,400\nBACK_STYLE=5\n" +
  "[KEY1]\nVIEW_RECT=10,20,100,50\nBACK_STYLE=6\nFORE_STYLE=7,8\n" +
  "[KEY2]\nVIEW_RECT=120,20,100,50\nBACK_STYLE=6\nFORE_STYLE=8\n" +
  "[KEY3]\nVIEW_RECT=230,20,100,50\nBACK_STYLE=9\n"

test("reads KEY sections and filters by selection", () => {
  const layout = IniDocument.parse(layoutText)
  assert.deepEqual(layoutKeyRects(layout).map((key) => key.section), ["KEY1", "KEY2", "KEY3"])
  assert.deepEqual(layoutKeyRects(layout, ["KEY2"]).map((key) => key.section), ["KEY2"])
  assert.deepEqual(layoutKeyRects(layout, ["KEY9"]), [])
})

test("ignores malformed VIEW_RECT sections", () => {
  const layout = IniDocument.parse("[KEY1]\nVIEW_RECT=1,2\n[KEY2]\nVIEW_RECT=1,2,3,4\n[LIST]\nVIEW_RECT=0,0,9,9\n")
  assert.deepEqual(layoutKeyRects(layout), [{ section: "KEY2", rect: [1, 2, 3, 4] }])
})

test("ignores a full-panel pseudo key", () => {
  const layout = IniDocument.parse("[KEY1]\nVIEW_RECT=0,0,1080,641\n[KEY36]\nVIEW_RECT=12,26,101,130\n")
  assert.deepEqual(layoutKeyRects(layout, [], [1080, 641]), [{ section: "KEY36", rect: [12, 26, 101, 130] }])
})

test("matches layout key count to detected cells", () => {
  const fewer = IniDocument.parse(layoutText)
  const kept = matchLayoutKeysToCells(fewer, layoutKeyRects(fewer), [[0, 0, 50, 30], [60, 0, 50, 30]])
  assert.deepEqual(kept.map((key) => key.section), ["KEY1", "KEY2"])
  assert.equal(fewer.sections().includes("KEY3"), false)

  const more = IniDocument.parse(layoutText)
  const added = matchLayoutKeysToCells(more, layoutKeyRects(more), [[0, 0, 50, 30], [60, 0, 50, 30], [120, 0, 50, 30], [180, 0, 50, 30]])
  assert.deepEqual(added.map((key) => key.section), ["KEY1", "KEY2", "KEY3", "KEY4"])
  assert.equal(more.get("KEY4", "VIEW_RECT"), "180,0,50,30")
  assert.equal(more.get("KEY4", "BACK_STYLE"), "9")
})

test("rejects key rects outside panel bounds", () => {
  assert.equal(validateKeyRects([{ section: "KEY1", rect: [0, 0, 100, 50] }], 1000, 400), undefined)
  assert.match(validateKeyRects([{ section: "KEY1", rect: [990, 0, 100, 50] }], 1000, 400) ?? "", /KEY1/)
  assert.match(validateKeyRects([{ section: "KEY2", rect: [0, 0, 0, 50] }], 1000, 400) ?? "", /KEY2/)
})

test("tile index allocation skips occupied holes and appends past max", () => {
  const tiles = IniDocument.parse("[IMG1]\nSOURCE_RECT=0,0,1,1\n[IMG7]\nSOURCE_RECT=0,0,1,1\n")
  const first = nextTileIndex(tiles)
  assert.equal(first, 2)
  const plan = planLayoutImage("key-normal", [{ section: "KEY1", rect: [0, 0, 10, 10] }, { section: "KEY2", rect: [10, 0, 10, 10] }], tiles, 100, 50)
  assert.deepEqual(plan.slices.map((slice) => slice.index), [2, 3])
})

test("panel plan creates one full-image slice", () => {
  const plan = planLayoutImage("panel", [], IniDocument.parse(""), 1000, 400)
  assert.deepEqual(plan.slices, [{ index: 1, source: [0, 0, 1000, 400] }])
  assert.equal(plan.panelIndex, 1)
})

test("style id allocation stays above existing sections and STYLE_NUM", () => {
  const styles = IniDocument.parse("[GLOBAL]\nSTYLE_NUM=4\n[STYLE1]\nNM_IMG=a,1\n[STYLE3]\n")
  assert.equal(nextStyleID(styles), 5)
  assert.equal(nextStyleID(IniDocument.parse("[STYLE2]\n")), 3)
})

test("panel target clones the resolved style and repoints the layout only", () => {
  const layout = IniDocument.parse(layoutText)
  const styles = IniDocument.parse("[GLOBAL]\nSTYLE_NUM=9\n[STYLE5]\nNM_IMG=old,1\nHL_IMG=old,2\n")
  const plan = planLayoutImage("panel", [], IniDocument.parse(""), 1000, 400)
  applyLayoutImageStyles("panel", layout, styles, plan, "new_base")
  assert.equal(layout.get("PANEL", "BACK_STYLE"), "10")
  assert.equal(styles.get("STYLE5", "NM_IMG"), "old,1")
  assert.equal(styles.get("STYLE10", "NM_IMG"), "new_base,1")
  assert.equal(styles.get("STYLE10", "HL_IMG"), "new_base,1")
  assert.equal(styles.get("GLOBAL", "STYLE_NUM"), "10")
})

test("key background clones each key style so shared styles stay untouched", () => {
  const layout = IniDocument.parse(layoutText)
  const styles = IniDocument.parse(
    "[GLOBAL]\nSTYLE_NUM=9\n[STYLE6]\nNM_IMG=old,1\n[STYLE9]\nNM_IMG=keep,1\n",
  )
  const keys = layoutKeyRects(layout, ["KEY1", "KEY2"])
  const plan = planLayoutImage("key-highlight", keys, IniDocument.parse(""), 1000, 400)
  applyLayoutImageStyles("key-highlight", layout, styles, plan, "hl")
  assert.equal(layout.get("KEY1", "BACK_STYLE"), "10")
  assert.equal(layout.get("KEY2", "BACK_STYLE"), "11")
  assert.equal(layout.get("KEY3", "BACK_STYLE"), "9")
  assert.equal(styles.get("STYLE6", "HL_IMG"), undefined)
  assert.equal(styles.get("STYLE6", "NM_IMG"), "old,1")
  assert.equal(styles.get("STYLE10", "HL_IMG"), "hl,1")
  assert.equal(styles.get("STYLE11", "HL_IMG"), "hl,2")
  assert.equal(styles.get("GLOBAL", "STYLE_NUM"), "11")
})

test("normal background writes NM_IMG only", () => {
  const layout = IniDocument.parse(layoutText)
  const styles = IniDocument.parse("[GLOBAL]\nSTYLE_NUM=9\n[STYLE9]\nNM_IMG=old,1\nHL_IMG=old,2\n")
  const keys = layoutKeyRects(layout, ["KEY3"])
  const plan = planLayoutImage("key-normal", keys, IniDocument.parse(""), 1000, 400)
  applyLayoutImageStyles("key-normal", layout, styles, plan, "nm")
  assert.equal(styles.get("STYLE10", "NM_IMG"), "nm,1")
  assert.equal(styles.get("STYLE10", "HL_IMG"), "old,2")
})

test("foreground targets append a fresh style and keep existing layers", () => {
  const layout = IniDocument.parse(layoutText)
  const styles = IniDocument.parse("[GLOBAL]\nSTYLE_NUM=9\n[STYLE7]\nSHOW=问\n")
  const keys = layoutKeyRects(layout, ["KEY1", "KEY2"])
  const plan = planLayoutImage("fore-normal", keys, IniDocument.parse(""), 1000, 400)
  applyLayoutImageStyles("fore-normal", layout, styles, plan, "fore")
  assert.equal(layout.get("KEY1", "FORE_STYLE"), "7,8,10")
  assert.equal(layout.get("KEY2", "FORE_STYLE"), "8,11")
  assert.equal(styles.get("STYLE10", "NM_IMG"), "fore,1")
  assert.equal(styles.get("STYLE11", "NM_IMG"), "fore,2")
  assert.equal(styles.get("STYLE7", "SHOW"), "问")
})

test("pressed foreground writes HL_IMG and empty FORE_STYLE gains one layer", () => {
  const layout = IniDocument.parse("[KEY4]\nVIEW_RECT=0,0,50,50\n")
  const styles = IniDocument.parse("")
  const keys = layoutKeyRects(layout)
  const plan = planLayoutImage("fore-highlight", keys, IniDocument.parse(""), 1000, 400)
  applyLayoutImageStyles("fore-highlight", layout, styles, plan, "fore")
  assert.equal(layout.get("KEY4", "FORE_STYLE"), "1")
  assert.equal(styles.get("STYLE1", "HL_IMG"), "fore,1")
  assert.equal(styles.get("GLOBAL", "STYLE_NUM"), "1")
})

test("planned slices serialize into a fresh TIL document", () => {
  const tiles = IniDocument.parse("")
  const plan = planLayoutImage("key-normal", [{ section: "KEY1", rect: [10, 20, 100, 50] }], tiles, 1000, 400)
  for (const slice of plan.slices) updateTileSlice(tiles, slice)
  assert.deepEqual(tileSlices(tiles), [{ index: 1, source: [10, 20, 100, 50] }])
})

test("candidate target clones the CAND style and repoints the candidate config", () => {
  const styles = IniDocument.parse("[GLOBAL]\nSTYLE_NUM=9\n[STYLE5]\nNM_IMG=old,1\nHL_IMG=old,2\n")
  const cand = IniDocument.parse("[CAND]\nBACK_STYLE=5\n")
  const plan = planLayoutImage("candidate", [], IniDocument.parse(""), 1125, 133)
  assert.deepEqual(plan.slices, [{ index: 1, source: [0, 0, 1125, 133] }])
  applyCandidateImageStyles(styles, cand, plan, "cand_base")
  assert.equal(cand.get("CAND", "BACK_STYLE"), "10")
  assert.equal(styles.get("STYLE10", "NM_IMG"), "cand_base,1")
  assert.equal(styles.get("STYLE10", "HL_IMG"), "cand_base,1")
  assert.equal(styles.get("STYLE5", "NM_IMG"), "old,1")
  assert.equal(styles.get("GLOBAL", "STYLE_NUM"), "10")
})

test("planLayoutImageSlices maps detected cells onto keys in order", () => {
  const keys = layoutKeyRects(IniDocument.parse(layoutText), ["KEY1", "KEY2", "KEY3"])
  const cells = [[5, 6, 40, 20], [50, 6, 40, 20], [95, 6, 40, 20]]
  const plan = planLayoutImageSlices("key-normal", keys, cells, IniDocument.parse(""))
  assert.deepEqual(plan.slices, [
    { index: 1, source: [5, 6, 40, 20] },
    { index: 2, source: [50, 6, 40, 20] },
    { index: 3, source: [95, 6, 40, 20] },
  ])
  assert.deepEqual(plan.indices, new Map([["KEY1", 1], ["KEY2", 2], ["KEY3", 3]]))
})

test("applyLayoutImageRects rewrites key rects and panel size from detected cells", () => {
  const layout = IniDocument.parse(layoutText)
  const keys = layoutKeyRects(layout, ["KEY1", "KEY2"])
  applyLayoutImageRects(layout, keys, [[0, 0, 50, 30], [60, 0, 50, 30]], 120, 40)
  assert.equal(layout.get("KEY1", "VIEW_RECT"), "0,0,50,30")
  assert.equal(layout.get("KEY2", "VIEW_RECT"), "60,0,50,30")
  assert.equal(layout.get("KEY3", "VIEW_RECT"), "230,20,100,50")
  assert.equal(layout.get("PANEL", "SIZE"), "120,40")
})

test("caps lock keys map by screen order even when listed out of order in the file", () => {
  // 文件顺序错乱：KEY30（大小写锁定键，y=126 行最左）排到 y=187 行的按键之后
  const scrambled =
    "[PANEL]\nSIZE=820,250\n" +
    "[KEY10]\nVIEW_RECT=718,5,77,56\n" +
    "[KEY27]\nVIEW_RECT=184,187,88,56\n" +
    "[KEY30]\nVIEW_RECT=4,126,76,56\n" +
    "[KEY20]\nVIEW_RECT=82,126,77,56\n" +
    "[KEY31]\nVIEW_RECT=638,126,157,56\n" +
    "[KEY32]\nVIEW_RECT=4,187,88,56\n"
  const keys = layoutKeyRects(IniDocument.parse(scrambled))
  // 图片里按阅读顺序的网格单元：y=5 行 → y=126 行（caps、Z、backspace）→ y=187 行
  const cells: Array<[number, number, number, number]> = [
    [718, 5, 77, 56], // KEY10（y=5 行）
    [4, 126, 76, 56], // KEY30 caps（y=126 行最左）
    [82, 126, 77, 56], // KEY20 Z
    [638, 126, 157, 56], // KEY31 backspace
    [4, 187, 88, 56], // KEY32
    [184, 187, 88, 56], // KEY27
  ]
  const plan = planLayoutImageSlices("key-normal", keys, cells, IniDocument.parse(""))
  assert.equal(plan.indices.get("KEY30"), 2) // caps 键按屏幕顺序拿到 y=126 行第 1 个单元
  assert.deepEqual(plan.slices[1].source, [4, 126, 76, 56]) // KEY30 的切片取自 y=126 行最左
  assert.deepEqual(plan.slices[2].source, [82, 126, 77, 56]) // KEY20 Z 紧随其后
  const layout = IniDocument.parse(scrambled)
  applyLayoutImageRects(layout, keys, cells, 820, 250)
  assert.equal(layout.get("KEY30", "VIEW_RECT"), "4,126,76,56")
  assert.equal(layout.get("KEY27", "VIEW_RECT"), "184,187,88,56")
})
