import assert from "node:assert/strict"
import fs from "node:fs"
import { IniDocument } from "../src/ini.ts"
import { Preview, previewFallbackText, previewItems } from "../src/preview.ts"

assert.equal(
  previewFallbackText({ show: "9" } as Parameters<typeof previewFallbackText>[0], false),
  "",
  "键级 SHOW 是按键数组名，前景缺失时也不能作为键帽文字绘制",
)

const runtimeList = IniDocument.parse(`
[LIST]
TYPE=2
CELL_SIZE=107,73
POS=0,0
LIST_NUM=11
BACK_STYLE=243
FORE_STYLE=235

[KEY1]
VIEW_RECT=216,0,216,133
CENTER=1
`)
assert.deepEqual(
  previewItems(runtimeList, 1080, 532).map((item) => item.section),
  ["KEY1"],
  "TYPE=2 的运行时滚动列表不能作为静态预览层覆盖按键",
)

const inheritedList = IniDocument.parse(`
[KEY1]
VIEW_RECT=216,0,216,133
CENTER=1
`)
const listDefaults = IniDocument.parse(`
[LIST]
TYPE=0
CELL_SIZE=150,123
POS=15,21
LIST_NUM=4
NAMES=， 。 ？ ！
`)
assert.deepEqual(
  previewItems(inheritedList, 1080, 640, listDefaults).map((item) => item.section),
  ["KEY1"],
  "布局未声明 LIST 时不能把 gen.ini 的列表模板覆盖到键盘上",
)

const previewSource = fs.readFileSync("src/preview.ts", "utf8")
assert.match(previewSource, /private draw\(\): void[\s\S]+queueMicrotask/, "同步预览状态更新应合并绘制")
assert.match(previewSource, /setResolver\([\s\S]+this\.draw\(\)/, "切换解析器应走合并绘制")

const staticList = IniDocument.parse(`
[LIST]
TYPE=0
CELL_SIZE=135,73
POS=960,120
LIST_NUM=2
NAMES=+ -
BACK_STYLE=0
FORE_STYLE=235
`)
assert.deepEqual(
  previewItems(staticList, 1080, 532).map((item) => item.section),
  ["LIST", "LIST:1", "LIST:2"],
  "TYPE=0 的静态列表仍应显示候选单元",
)
assert.equal(
  previewFallbackText(previewItems(staticList, 1080, 532)[1], false),
  "+",
  "NAMES 应作为静态列表单元的预览文字",
)

const horizontalList = IniDocument.parse(`
[LIST]
TYPE=1
LIST_ORDER=1
CELL_SIZE=217,87
POS=0,0
LIST_NUM=5
NAMES=, 。 ？ / :
`)
const horizontalItems = previewItems(horizontalList, 1080, 680)
assert.deepEqual(
  horizontalItems.map(({ section, rect }) => ({ section, rect })),
  [
    { section: "LIST", rect: { x: 0, y: 0, width: 1085, height: 87 } },
    { section: "LIST:1", rect: { x: 0, y: 0, width: 217, height: 87 } },
    { section: "LIST:2", rect: { x: 217, y: 0, width: 217, height: 87 } },
    { section: "LIST:3", rect: { x: 434, y: 0, width: 217, height: 87 } },
    { section: "LIST:4", rect: { x: 651, y: 0, width: 217, height: 87 } },
    { section: "LIST:5", rect: { x: 868, y: 0, width: 217, height: 87 } },
  ],
  "TYPE=1 的静态列表应横向排列",
)

const verticalConditionalList = IniDocument.parse(`
[LIST]
TYPE=1
LIST_ORDER=0
CELL_SIZE=80,60
POS=900,100
LIST_NUM=2
NAMES=， 。
`)
assert.deepEqual(
  previewItems(verticalConditionalList, 1080, 680)
    .filter(({ section }) => section.startsWith("LIST"))
    .map(({ section, rect }) => ({ section, rect })),
  [
    { section: "LIST", rect: { x: 900, y: 100, width: 80, height: 120 } },
    { section: "LIST:1", rect: { x: 900, y: 100, width: 80, height: 60 } },
    { section: "LIST:2", rect: { x: 900, y: 160, width: 80, height: 60 } },
  ],
  "TYPE=1 只控制显示条件，LIST_ORDER=0 仍应纵向排列",
)

const legacyList = IniDocument.parse(`
[LIST]
CELL_SIZE=116,47
POS=7,6
LIST_NUM=2
NAMES=， 。
`)
assert.deepEqual(
  previewItems(legacyList, 1080, 532).map((item) => item.section),
  ["LIST", "LIST:1", "LIST:2"],
  "缺少 TYPE 的旧版静态列表仍应兼容",
)

const candidateSkin = IniDocument.parse(`
[CAND]
BACK_STYLE=226
FORE_STYLE=234

[ICON1]
FORE_STYLE=361
SIZE=100,100
ANCHOR_TYPE=1
POS=120,9
KEY=你
PERSIST=1

[ICON2]
FORE_STYLE=287
SIZE=100,100
ANCHOR_TYPE=6
POS=-122,-50
KEY=F9
PERSIST=2
`)
const candidateItems = previewItems(candidateSkin, 1080, 119)
assert.equal(candidateItems.find((item) => item.section === "ICON1")?.center, "你")
assert.equal(candidateItems.some((item) => item.section === "ICON2"), false)
assert.deepEqual(
  previewItems(candidateSkin, 1080, 119, undefined, true).map((item) => item.section),
  ["ICON2"],
  "输入时只应保留 PERSIST=2 的最右侧工具图标",
)

Object.defineProperty(globalThis, "ResizeObserver", {
  value: class {
    observe(): void {}
  },
})
const scheduledPreview = new Preview(
  { addEventListener() {} } as unknown as HTMLCanvasElement,
  () => {},
  () => {},
)
let renders = 0
const internalPreview = scheduledPreview as unknown as { render: () => Promise<void> }
internalPreview.render = async () => { renders++ }
scheduledPreview.setTheme("dark")
scheduledPreview.setTransparent(true)
await Promise.resolve()
assert.equal(renders, 1, "同一事件循环中的多次 draw 应只渲染一次")

internalPreview.render = async () => {
  renders++
  if (renders === 2) scheduledPreview.setTheme("light")
}
scheduledPreview.setTheme("dark")
await Promise.resolve()
await Promise.resolve()
await Promise.resolve()
assert.equal(renders, 3, "渲染期间触发的新 draw 不应丢失")

console.log("✓ LIST 和 CAND/ICON 静态内容按皮肤配置解析，运行时层不伪装成静态内容")
