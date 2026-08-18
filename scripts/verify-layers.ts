import assert from "node:assert/strict"
import { IniDocument } from "../src/ini.ts"
import { effectivePreviewItem, previewHitItem, previewItems } from "../src/preview.ts"

// 用真实皮肤里的结构验证：KEY4 通过 STAT_STYLE 切换到 TIP1/TIP2 的前景图层，
// 同时保留 KEY4 自身的 VIEW_RECT。
const document = IniDocument.parse(`
[KEY4]
VIEW_RECT=800,450,196,150
BACK_STYLE=38
FORE_STYLE=89,31,432
STAT_STYLE=S1_1|S2_2
CENTER=F15
UP=F10

[TIP1]
BACK_STYLE=38
FORE_STYLE=89,360
UP=F11

[TIP2]
BACK_STYLE=38
FORE_STYLE=89,361
UP=F11

[KEY9]
VIEW_RECT=496,285,250,150
FORE_STYLE=65,62,102,30,432
STAT_STYLE=S0
`)

const key: Parameters<typeof effectivePreviewItem>[1] = {
  section: "KEY4",
  sections: ["KEY4"],
  rect: { x: 800, y: 450, width: 196, height: 150 },
  editable: true,
  show: "",
  center: "F15",
  up: "F10",
  down: "",
  left: "",
  right: "",
  hold: "",
  backStyle: "38",
  foreStyle: "89",
  foreStyles: ["89", "31", "432"],
  foreOffsets: [],
  positionTypes: [],
  statStyle: "S1_1|S2_2",
  foreAnimStyles: [],
}

assert.deepEqual(effectivePreviewItem(document, key, undefined).foreStyles, ["89", "31", "432"])
assert.deepEqual(effectivePreviewItem(document, key, 1).foreStyles, ["89", "360"])
assert.equal(effectivePreviewItem(document, key, 1).rect.width, 196)
assert.equal(effectivePreviewItem(document, key, 1).up, "F11")
assert.equal(effectivePreviewItem(document, key, 1).center, "F15", "TIP 未定义 CENTER 时应继承按键自身动作")
assert.deepEqual(effectivePreviewItem(document, key, 2).foreStyles, ["89", "361"])

const noStateKey: Parameters<typeof effectivePreviewItem>[1] = {
  ...key,
  section: "KEY9",
  sections: ["KEY9"],
  foreStyles: ["65", "62", "102", "30", "432"],
  statStyle: "S0",
}
assert.deepEqual(effectivePreviewItem(document, noStateKey, 1).foreStyles, noStateKey.foreStyles)

console.log("✓ STAT_STYLE→TIP 状态换层：S0 不换、S1→TIP1、S2→TIP2、几何继承")

// 蒋·Grid M：全屏背景 KEY99 写在字母键之后，命中必须落到前景键。
const stacked = IniDocument.parse(`
[PANEL]
SIZE=1242,631

[KEY3]
VIEW_RECT=0,0,1242,631
BACK_STYLE=170

[KEY4]
VIEW_RECT=0,0,1242,631
BACK_STYLE=171
STAT_STYLE=S0

[KEY6]
VIEW_RECT=25,285,179,150
BACK_STYLE=220
FORE_STYLE=222,280,436
STAT_STYLE=S14_2|S2_2|S4_3
CENTER=F10
BACK_ANIM_STYLE=235

[KEY83]
VIEW_RECT=26,5,119,150
BACK_STYLE=175
FORE_STYLE=281,250,290,280,436
STAT_STYLE=S0
CENTER=q
BACK_ANIM_STYLE=235

[KEY99]
VIEW_RECT=0,0,1242,631
BACK_STYLE=171
STAT_STYLE=S0
`)

const stackedItems = previewItems(stacked, 1242, 631)
const q = previewHitItem(stackedItems, { x: 80, y: 80 }, "edit", 1242, 631)
assert.equal(q?.section, "KEY83", "编辑模式点 q 不能落到全屏 KEY99")
assert.equal(
  previewHitItem(stackedItems, { x: 80, y: 80 }, "preview", 1242, 631)?.section,
  "KEY83",
  "交互预览点 q 不能落到全屏 KEY99",
)
assert.equal(
  previewHitItem(stackedItems, { x: 100, y: 360 }, "preview", 1242, 631)?.section,
  "KEY6",
  "叠在全屏背景上的状态键可点",
)
assert.equal(
  previewHitItem(stackedItems, { x: 80, y: 80 }, "edit", 1242, 631)?.center,
  "q",
)
assert.equal(
  previewHitItem(stackedItems, { x: 100, y: 360 }, "preview", 1242, 631)?.backAnimStyle,
  "235",
  "点到前景键才能播 BACK_ANIM_STYLE",
)

console.log("✓ 叠层命中：全屏背景让路，编辑/预览都能点到前景键")

const touchTrap = IniDocument.parse(`
[KEY83]
VIEW_RECT=26,5,119,150
CENTER=q
BACK_ANIM_STYLE=235

[KEY91]
VIEW_RECT=774,450,119,150
CENTER=，
TOUCH_RECT=0,0,0,0
BACK_ANIM_STYLE=235
`)
const touchItems = previewItems(touchTrap, 1242, 631)
assert.equal(
  previewHitItem(touchItems, { x: 80, y: 80 }, "preview", 1242, 631)?.section,
  "KEY83",
  "TOUCH_RECT=0,0,0,0 不能扩张成全屏热区",
)
console.log("✓ TOUCH_RECT=0,0,0,0 忽略，不吞点击")
