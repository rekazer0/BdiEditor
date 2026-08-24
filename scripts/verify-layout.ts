import assert from "node:assert/strict"
import { pushChange, type Change } from "../src/history.ts"
import { planLayoutImageSlices } from "../src/layout-image.ts"
import { applyLayoutAction, snapPointToRects, snapRectDelta, type LayoutRect } from "../src/layout.ts"
import { IniDocument } from "../src/ini.ts"

const first: LayoutRect = { section: "KEY1", x: 10, y: 20, width: 80, height: 40 }
const second: LayoutRect = { section: "KEY2", x: 120, y: 100, width: 140, height: 100 }

const swapped = applyLayoutAction([first, second], "swap")

assert.deepEqual(swapped, [
  { ...first, x: 150, y: 130 },
  { ...second, x: -20, y: -10 },
])
assert.deepEqual(
  swapped.map((rect) => [rect.x + rect.width / 2, rect.y + rect.height / 2]),
  [
    [second.x + second.width / 2, second.y + second.height / 2],
    [first.x + first.width / 2, first.y + first.height / 2],
  ],
  "不同尺寸按键应交换中心位置",
)
assert.deepEqual([swapped[0].width, swapped[0].height], [first.width, first.height])
assert.deepEqual([swapped[1].width, swapped[1].height], [second.width, second.height])
assert.deepEqual(first, { section: "KEY1", x: 10, y: 20, width: 80, height: 40 })
assert.deepEqual(second, { section: "KEY2", x: 120, y: 100, width: 140, height: 100 })

console.log("✓ 不同尺寸按键交换中心位置，且保持各自尺寸不变")

const history: Change[] = []
pushChange(history, { kind: "text", path: "layout.ini", before: "x=0", after: "x=1" })
pushChange(history, { kind: "text", path: "layout.ini", before: "x=1", after: "x=2" }, true)
assert.deepEqual(history, [
  { kind: "text", path: "layout.ini", before: "x=0", after: "x=2" },
])
pushChange(history, { kind: "text", path: "layout.ini", before: "x=2", after: "x=3" })
assert.equal(history.length, 2)

console.log("✓ 方向键自动重复移动合并为一次撤销记录")

assert.deepEqual(
  snapPointToRects({ x: 118, y: 148 }, [second], { x: 4, y: 4 }),
  { x: 120, y: 150 },
)
assert.deepEqual(
  snapRectDelta([first], [second], { x: 24, y: 34 }, { x: 6, y: 6 }),
  { x: 30, y: 40 },
)
assert.deepEqual(
  snapRectDelta([first], [second], { x: 24, y: 34 }, { x: 5, y: 5 }),
  { x: 24, y: 34 },
)
assert.deepEqual(
  snapRectDelta([{ ...first, x: 31 }], [first], { x: 0, y: 0 }, { x: 8, y: 8 }),
  { x: 0, y: 0 },
)

console.log("✓ 十字轴与拖动分别吸附到按键边缘和中心关键点")

const singleKeySlice = [2, 3, 40, 20] as [number, number, number, number]
const singleKeyPlan = planLayoutImageSlices(
  "key-normal",
  [
    { section: "KEY1", rect: [10, 20, 80, 40] },
    { section: "KEY2", rect: [120, 20, 80, 40] },
  ],
  [singleKeySlice],
  IniDocument.parse(""),
)
assert.deepEqual(singleKeyPlan.slices.map(({ source }) => source), [singleKeySlice, singleKeySlice])

console.log("✓ 单个按键素材会复用到所有目标按键")
