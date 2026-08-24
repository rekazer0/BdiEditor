import assert from "node:assert/strict"
import { IniDocument } from "../src/ini.ts"
import { previewFallbackText, previewItems } from "../src/preview.ts"

assert.equal(
  previewFallbackText({ show: "9" } as Parameters<typeof previewFallbackText>[0], "preview", false),
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

console.log("✓ LIST 和 CAND/ICON 静态内容按皮肤配置解析，运行时层不伪装成静态内容")
