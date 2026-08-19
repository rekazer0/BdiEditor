import assert from "node:assert/strict"
import { IniDocument } from "../src/ini.ts"
import { previewItems } from "../src/preview.ts"

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

console.log("✓ LIST TYPE=2 不覆盖键盘，TYPE=0/缺省类型静态列表保持显示")
