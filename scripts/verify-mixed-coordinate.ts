import assert from "node:assert/strict"
import { moveRects, type LayoutRect } from "../src/layout.ts"
import { mixedCoordinateDelta } from "../src/mixed-input.ts"

const rects: LayoutRect[] = [
  { section: "KEY1", x: 10, y: 20, width: 30, height: 40 },
  { section: "KEY2", x: 50, y: 80, width: 30, height: 40 },
]
const [deltaX, deltaY] = mixedCoordinateDelta("x", "混合", false, 1)!
const moved = moveRects(rects, deltaX, deltaY)
const [verticalX, verticalY] = mixedCoordinateDelta("y", "混合", false, -1)!
const movedVertically = moveRects(rects, verticalX, verticalY)

assert.deepEqual(moved.map(({ x, y }) => [x, y]), [[11, 20], [51, 80]])
assert.equal(moved[1].x - moved[0].x, rects[1].x - rects[0].x)
assert.deepEqual(movedVertically.map(({ x, y }) => [x, y]), [[10, 19], [50, 79]])
assert.equal(movedVertically[1].y - movedVertically[0].y, rects[1].y - rects[0].y)
assert.equal(mixedCoordinateDelta("width", "混合", false, 1), undefined)
assert.equal(mixedCoordinateDelta("x", "", false, 1), undefined)

console.log("✓ 混合 X/Y 步进保持多选按键的相对位置")
