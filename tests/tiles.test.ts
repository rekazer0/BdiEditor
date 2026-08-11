import assert from "node:assert/strict"
import test from "node:test"
import { IniDocument } from "../src/ini.ts"
import {
  boundedTileRect,
  duplicateTileSlice,
  moveTileRect,
  nextTileIndex,
  removeTileSlice,
  tileSliceAt,
  tilePreviewDestination,
  tileSlices,
  updateTileSlice,
} from "../src/tiles.ts"

test("reads valid IMG source rectangles and optional inner rectangles", () => {
  const document = IniDocument.parse(
    "; keep\n[IMG1]\nSOURCE_RECT=10,20,30,40\nINNER_RECT=12,24,20,30\n\n" +
    "[IMG3]\nSOURCE_RECT=1,2,3,4\n[OTHER]\nSOURCE_RECT=9,9,9,9\n",
  )

  assert.deepEqual(tileSlices(document), [
    { index: 1, source: [10, 20, 30, 40], inner: [12, 24, 20, 30] },
    { index: 3, source: [1, 2, 3, 4] },
  ])
  assert.equal(nextTileIndex(document), 2)
})

test("updates one slice without changing its inner rectangle", () => {
  const document = IniDocument.parse("[IMG1]\r\nSOURCE_RECT=1,2,3,4\r\nINNER_RECT=2,3,1,2\r\n")

  updateTileSlice(document, { index: 1, source: [5, 6, 7, 8] })

  assert.equal(
    document.toString(),
    "[IMG1]\r\nSOURCE_RECT=5,6,7,8\r\nINNER_RECT=2,3,1,2\r\n",
  )
})

test("appends a new slice and only writes inner rectangle when supplied", () => {
  const document = IniDocument.parse("[IMG1]\nSOURCE_RECT=1,2,3,4\n")

  updateTileSlice(document, { index: 2, source: [10, 20, 30, 40] })
  updateTileSlice(document, { index: 3, source: [50, 60, 70, 80], inner: [55, 65, 60, 70] })

  assert.equal(document.get("IMG2", "SOURCE_RECT"), "10,20,30,40")
  assert.equal(document.get("IMG2", "INNER_RECT"), undefined)
  assert.equal(document.get("IMG3", "INNER_RECT"), "55,65,60,70")
})

test("normalizes and clips a dragged rectangle to image bounds", () => {
  assert.deepEqual(boundedTileRect({ x: 120, y: 70 }, { x: 10, y: -5 }, 100, 50), [10, 0, 90, 50])
  assert.equal(boundedTileRect({ x: 2, y: 2 }, { x: 2, y: 10 }, 100, 50), undefined)
})

test("selects the last overlapping slice at a point", () => {
  const slices = [
    { index: 1, source: [0, 0, 100, 100] as [number, number, number, number] },
    { index: 2, source: [20, 20, 30, 30] as [number, number, number, number] },
  ]

  assert.equal(tileSliceAt(slices, { x: 25, y: 25 })?.index, 2)
  assert.equal(tileSliceAt(slices, { x: 110, y: 25 }), undefined)
})

test("removes only the selected IMG section", () => {
  const document = IniDocument.parse(
    "[IMG1]\nSOURCE_RECT=1,2,3,4\n[IMG2]\nSOURCE_RECT=5,6,7,8\n[OTHER]\nVALUE=keep\n",
  )

  assert.equal(removeTileSlice(document, 1), true)
  assert.deepEqual(document.sections(), ["IMG2", "OTHER"])
  assert.equal(document.get("OTHER", "VALUE"), "keep")
})

test("moves a rectangle while keeping it inside the image", () => {
  assert.deepEqual(moveTileRect([90, 40, 20, 20], 5, 5, 100, 50), [80, 30, 20, 20])
  assert.deepEqual(moveTileRect([10, 10, 20, 20], -15, -20, 100, 50), [0, 0, 20, 20])
})

test("duplicates source and inner rectangles under a new index", () => {
  const original = { index: 2, source: [1, 2, 30, 40], inner: [3, 4, 20, 30] } as const

  assert.deepEqual(duplicateTileSlice(original, 5), {
    index: 5,
    source: [1, 2, 30, 40],
    inner: [3, 4, 20, 30],
  })
})

test("fits a selected slice into 80 percent of a square preview", () => {
  assert.deepEqual(tilePreviewDestination(100, 50, 240), {
    x: 24, y: 72, width: 192, height: 96,
  })
  assert.deepEqual(tilePreviewDestination(50, 100, 240), {
    x: 72, y: 24, width: 96, height: 192,
  })
})
