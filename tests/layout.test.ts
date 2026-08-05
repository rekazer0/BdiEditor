import assert from "node:assert/strict"
import test from "node:test"
import { applyLayoutAction, moveRects, resizeRect, setExactGap, type LayoutRect } from "../src/layout.ts"

const rects: LayoutRect[] = [
  { section: "KEY1", x: 2, y: 5, width: 100, height: 80 },
  { section: "KEY2", x: 140, y: 10, width: 120, height: 70 },
  { section: "KEY3", x: 300, y: 20, width: 80, height: 60 },
]

test("aligns and sizes selected keys without mutating input", () => {
  assert.deepEqual(applyLayoutAction(rects, "left").map((rect) => rect.x), [2, 2, 2])
  assert.deepEqual(applyLayoutAction(rects, "same-height").map((rect) => rect.height), [80, 80, 80])
  assert.equal(rects[1].x, 140)
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
