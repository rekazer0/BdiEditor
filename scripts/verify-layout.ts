import assert from "node:assert/strict"
import fs from "node:fs"
import { pushChange, type Change } from "../src/history.ts"
import { layoutImageTileBytes, layoutImageTileDocument, planLayoutImageSlices } from "../src/layout-image.ts"
import { applyLayoutAction, gestureDirection, snapPointToRects, snapRectDelta, type LayoutRect } from "../src/layout.ts"
import { IniDocument } from "../src/ini.ts"
import { legacyHintCandidates, legacyHintIconID, legacyHintText, parseLegacyHint, previewItems, setCanvasSize } from "../src/preview.ts"

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

const mainSource = fs.readFileSync("src/main.ts", "utf8")
const styleSource = fs.readFileSync("src/style.css", "utf8")
assert.match(
  mainSource,
  /function schedulePreviewPan\([\s\S]+requestAnimationFrame[\s\S]+setPreviewPan/,
  "画布拖动应按渲染帧合并 transform 更新",
)
assert.match(
  styleSource,
  /\.canvas-wrap\.preview-pan-ready \.device-shell\s*\{[^}]*will-change:\s*transform/,
  "开始拖动时应提前把预览键盘提升到合成层",
)
assert.match(
  mainSource,
  /function schedulePointerCoordinates\([\s\S]+canvasWrap\.addEventListener\("pointermove"[\s\S]+schedulePointerCoordinates\(event, previewCanvas, previewCanvas\)/,
  "画布拖动期间应按帧更新跟手十字线",
)
assert.match(
  mainSource,
  /preview\.setPointerInteractionLocked\(true\)[\s\S]+preview\.setPointerInteractionLocked\(false\)/,
  "画布拖动期间应锁定按键交互，结束后恢复",
)
assert.match(
  mainSource,
  /function finishPreviewPan\(\)[\s\S]+flushPreviewPan\(\)/,
  "拖动结束时应同步最后一个平移位置",
)

console.log("✓ 预览画布拖动逐帧合并更新，十字轴保持跟手")

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

const swipeKey = previewItems(IniDocument.parse(`
[KEY9]
VIEW_RECT=438,155,250,143
CENTER=k
UP=5
DOWN=.
LEFT=j
RIGHT=l
`), 1125, 595)[0]
assert.deepEqual(
  [swipeKey.center, swipeKey.up, swipeKey.down, swipeKey.left, swipeKey.right],
  ["k", "5", ".", "j", "l"],
)
assert.deepEqual(
  [[0, -40], [0, 40], [-40, 0], [40, 0]].map(([x, y]) => gestureDirection(x, y, 100, false)),
  ["up", "down", "left", "right"],
)

console.log("✓ 自定义按键的上下左右动作均被解析并用于拖动预览")

const shortHint = parseLegacyHint(IniDocument.parse(`
[DRAW]
ICON_UP=2
ICON_DN=3
ICON_LT=4
ICON_RT=5
[BAR]
BACK_ICON=1
CELL_STYLE=24
[ICON1]
BACK_STYLE=23
FORE_STYLE=21
SIZE=170,175
POS=0,-15
PADDING=45,42,42,40
[ICON2]
BACK_STYLE=25
FORE_STYLE=22
SIZE=190,205
`))
assert.ok(shortHint)
assert.equal(shortHint.barIcon, "1")
assert.equal(shortHint.cellStyle, "24")
assert.equal(legacyHintIconID(shortHint, "center"), undefined)
assert.equal(legacyHintIconID(shortHint, "up"), "2")
assert.equal(legacyHintIconID(shortHint, "down"), undefined)
assert.equal(legacyHintIconID(shortHint, "left"), undefined)
assert.equal(legacyHintIconID(shortHint, "right"), undefined)
assert.equal(legacyHintIconID(shortHint, "hold"), undefined)
assert.deepEqual(shortHint.icons.get("1")?.padding, [45, 42, 42, 40])

const noSwipeHint = parseLegacyHint(IniDocument.parse(`
[BAR]
BACK_ICON=1
[ICON1]
BACK_STYLE=23
SIZE=175,180
`))
assert.equal(legacyHintIconID(noSwipeHint, "up"), undefined)
assert.equal(legacyHintIconID(noSwipeHint, "left"), undefined)
assert.equal(noSwipeHint?.upIcon, undefined)
assert.equal(noSwipeHint?.barIcon, "1")

const longHint = parseLegacyHint(IniDocument.parse(`
[HINT]
BACK_ICON=2
[BAR]
BACK_ICON=1
[ICON1]
BACK_STYLE=23
SIZE=170,175
[ICON2]
BACK_STYLE=25
SIZE=190,205
`))
assert.equal(legacyHintIconID(longHint, "center"), undefined)
assert.equal(legacyHintIconID(longHint, "hold"), "2")

const nineKey = { up: "9", left: "w", center: "x", right: "y", down: "z", hold: "", holdSymbols: "" }
assert.equal(legacyHintText(nineKey, "up"), "9")
assert.deepEqual(legacyHintCandidates(nineKey, "up"), ["9", "w", "x", "y", "z"])
assert.deepEqual(legacyHintCandidates({ ...nineKey, holdSymbols: "a,ā,á" }, "hold"), ["a", "ā", "á"])
assert.deepEqual(
  legacyHintCandidates({ up: "6", left: "m", center: "n", right: "o", down: "n", hold: "", holdSymbols: "" }, "hold", true),
  ["m", "n", "o", "6", "M", "N", "O"],
)
assert.deepEqual(
  legacyHintCandidates({ up: "*", left: "", center: "j", right: "", down: "j", hold: "", holdSymbols: "" }, "hold", true),
  ["J", "*", "j"],
)

let canvasResets = 0
const stableCanvas = {
  get width() { return 100 },
  set width(_value: number) { canvasResets++ },
  get height() { return 50 },
  set height(_value: number) { canvasResets++ },
}
assert.equal(setCanvasSize(stableCanvas, 100, 50), false)
assert.equal(canvasResets, 0)

console.log("✓ 仅上滑气泡和长按气泡图标映射被正确解析")

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
assert.deepEqual(singleKeyPlan.slices.map(({ source }) => source), [singleKeySlice])
assert.deepEqual([...singleKeyPlan.indices.values()], [1, 1])

console.log("✓ 单个按键素材会复用到所有目标按键")

const generatedAndroidTiles = layoutImageTileDocument(singleKeyPlan, 1).toString()
assert.match(generatedAndroidTiles, /^\[GLOBAL\]\r\nUSE_ALPHA=1\r\nTILE_NUM=1\r\n\r\n\[IMG1\]\r\n/)
assert.doesNotMatch(generatedAndroidTiles, /(^|[^\r])\n/)

const generatedIosTiles = layoutImageTileDocument(singleKeyPlan, 2).toString()
assert.match(generatedIosTiles, /^\[GLOBAL\]\r\nUSE_ALPHA=2\r\nTILE_NUM=1\r\n\r\n\[IMG1\]\r\n/)
assert.doesNotMatch(generatedIosTiles, /(^|[^\r])\n/)
assert.deepEqual([...layoutImageTileBytes(singleKeyPlan, 1).slice(0, 3)], [0xef, 0xbb, 0xbf])

console.log("✓ 一键替换按 Android/iOS 平台生成正确 alpha 模式的 TIL 文件")
