import assert from "node:assert/strict"
import test from "node:test"
import { applyLayoutAction, isListCell, listCellIndex, listCellRect, listCellValue, mergeLayoutRects, moveRects, resizeRect, setExactGap, setListCellValue, type LayoutRect } from "../src/layout.ts"
import { IniDocument } from "../src/ini.ts"

const rects: LayoutRect[] = [
  { section: "KEY1", x: 2, y: 5, width: 100, height: 80 },
  { section: "KEY2", x: 140, y: 10, width: 120, height: 70 },
  { section: "KEY3", x: 300, y: 20, width: 80, height: 60 },
]

test("aligns and sizes selected keys without mutating input", () => {
  assert.deepEqual(applyLayoutAction(rects, "left").map((rect) => rect.x), [2, 2, 2])
  assert.deepEqual(applyLayoutAction(rects, "right").map((rect) => rect.x + rect.width), [380, 380, 380])
  assert.deepEqual(applyLayoutAction(rects, "bottom").map((rect) => rect.y + rect.height), [85, 85, 85])
  assert.deepEqual(applyLayoutAction(rects, "same-height").map((rect) => rect.height), [80, 80, 80])
  assert.equal(rects[1].x, 140)
})

test("swaps only the positions of exactly two selected keys", () => {
  const swapped = applyLayoutAction(rects.slice(0, 2), "swap")
  assert.deepEqual(swapped, [
    { section: "KEY1", x: 140, y: 10, width: 100, height: 80 },
    { section: "KEY2", x: 2, y: 5, width: 120, height: 70 },
  ])
  assert.deepEqual(applyLayoutAction(rects, "swap"), rects)
})

test("merges two key bounds while retaining the first key identity", () => {
  assert.deepEqual(mergeLayoutRects(rects[0], rects[1]), {
    section: "KEY1",
    x: 2,
    y: 5,
    width: 258,
    height: 80,
  })
})

test("distributes keys within their original outer bounds", () => {
  const distributed = applyLayoutAction(rects, "horizontal-gap")
  assert.deepEqual(distributed.map((rect) => rect.x), [2, 141, 300])
})

test("sets an exact horizontal gap", () => {
  const spaced = setExactGap(rects, "horizontal", 24)
  assert.deepEqual(spaced.map((rect) => rect.x), [2, 126, 270])
})

test("resizes a key while enforcing the minimum size", () => {
  assert.deepEqual(resizeRect(rects[0], 20, -100), {
    section: "KEY1",
    x: 2,
    y: 5,
    width: 120,
    height: 20,
  })
})

test("moves one or more selected keys without mutating the original rectangles", () => {
  const single = moveRects([rects[0]], 3, -2)
  assert.deepEqual(single, [{ section: "KEY1", x: 5, y: 3, width: 100, height: 80 }])

  const moved = moveRects(rects.slice(0, 2), -1, 10)
  assert.deepEqual(moved, [
    { section: "KEY1", x: 1, y: 15, width: 100, height: 80 },
    { section: "KEY2", x: 139, y: 20, width: 120, height: 70 },
  ])
  assert.deepEqual(rects[0], { section: "KEY1", x: 2, y: 5, width: 100, height: 80 })
})

const listLayout = IniDocument.parse(
  "[LIST]\nBACK_STYLE=121\nCELL_STYLE=120\nFORE_STYLE=130\nCELL_SIZE=71,59\nPOS=5,4\nLIST_NUM=4\nNAMES=， 。 ？ ！\nVALUES=， 。 ？ ！\n",
)

test("recognises the LIST section and its cell placeholders", () => {
  assert.equal(isListCell("LIST"), true)
  assert.equal(isListCell("LIST:2"), true)
  assert.equal(isListCell("KEY1"), false)
  assert.equal(listCellIndex("LIST"), 0)
  assert.equal(listCellIndex("LIST:4"), 3)
  assert.equal(listCellIndex("KEY1"), 0)
})

test("maps the whole LIST candidate bar fields onto the [LIST] section", () => {
  assert.equal(listCellValue(listLayout, "LIST", "SHOW"), "， 。 ？ ！")
  assert.equal(listCellValue(listLayout, "LIST", "CENTER"), "， 。 ？ ！")
  assert.equal(listCellValue(listLayout, "LIST", "BACK_STYLE"), "121")
  assert.equal(listCellValue(listLayout, "LIST", "FORE_STYLE"), "130")
  assert.equal(listCellValue(listLayout, "LIST", "x"), "5")
  assert.equal(listCellValue(listLayout, "LIST", "y"), "4")
  assert.equal(listCellValue(listLayout, "LIST", "width"), "71")
  assert.equal(listCellValue(listLayout, "LIST", "height"), "236")
  assert.equal(listCellValue(listLayout, "LIST", "UP"), "")
})

test("computes the LIST rectangle as the whole candidate bar", () => {
  assert.deepEqual(listCellRect(listLayout, "LIST"), { section: "LIST", x: 5, y: 4, width: 71, height: 236 })
})

test("writes whole LIST edits back to the [LIST] section", () => {
  const layout = IniDocument.parse(listLayout.toString())
  setListCellValue(layout, "LIST", "width", "90")
  assert.equal(layout.get("LIST", "CELL_SIZE"), "90,59")

  setListCellValue(layout, "LIST", "height", "300")
  assert.equal(layout.get("LIST", "CELL_SIZE"), "90,75")

  setListCellValue(layout, "LIST", "y", "12")
  assert.equal(layout.get("LIST", "POS"), "5,12")

  setListCellValue(layout, "LIST", "BACK_STYLE", "99")
  assert.equal(layout.get("LIST", "BACK_STYLE"), "99")

  setListCellValue(layout, "LIST", "FORE_STYLE", "77")
  assert.equal(layout.get("LIST", "FORE_STYLE"), "77")

  setListCellValue(layout, "LIST", "SHOW", "？")
  assert.equal(layout.get("LIST", "NAMES"), "？")

  setListCellValue(layout, "LIST", "CENTER", "， 。 ？ ！ ～")
  assert.equal(layout.get("LIST", "VALUES"), "， 。 ？ ！ ～")

  assert.equal(listCellValue(layout, "LIST", "height"), "300")
  assert.equal(listCellValue(layout, "LIST", "y"), "12")
})
