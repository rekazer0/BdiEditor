import assert from "node:assert/strict"
import { actionDescription, previewStateFromAction, skinStateLabel } from "../src/actions.ts"
import { IniDocument } from "../src/ini.ts"
import { availableSkinStates, stateTipSection } from "../src/panel-tools.ts"
import {
  effectivePreviewHitItem,
  effectivePreviewItem,
  isFullPanelPreviewItem,
  previewHitItem,
  previewItems,
} from "../src/preview.ts"

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
  holdSymbols: "",
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
assert.deepEqual(effectivePreviewItem(IniDocument.parse(`${document.toString()}\n[TIP0]\nFORE_STYLE=999`), key, 0).foreStyles, ["89", "31", "432"])

const noStateKey: Parameters<typeof effectivePreviewItem>[1] = {
  ...key,
  section: "KEY9",
  sections: ["KEY9"],
  foreStyles: ["65", "62", "102", "30", "432"],
  statStyle: "S0",
}
assert.deepEqual(effectivePreviewItem(document, noStateKey, 1).foreStyles, noStateKey.foreStyles)

const officialFallbacks = IniDocument.parse(`
[KEY1]
VIEW_RECT=0,0,100,100
CENTER=a
HOLDSYM=aāá
STAT_STYLE=S1_1

[TIP1]
CENTER=A
HOLDSYM=AĀÁ
`)
const fallbackItem = previewItems(officialFallbacks, 100, 100)[0]
assert.equal(fallbackItem.down, "a", "官方解析器在 DOWN 缺失时回退 CENTER")
assert.equal(fallbackItem.holdSymbols, "aāá")
const fallbackStateItem = effectivePreviewItem(officialFallbacks, fallbackItem, 1)
assert.equal(fallbackStateItem.center, "A")
assert.equal(fallbackStateItem.down, "A", "TIP 覆盖 CENTER 时，缺失 DOWN 也应跟随新的 CENTER")
assert.equal(fallbackStateItem.holdSymbols, "AĀÁ")

const stateActionDocument = IniDocument.parse(`
[PANEL]
SIZE=1080,532

[KEY27]
VIEW_RECT=5,266,131,133
CENTER=F91
STAT_STYLE=S38_27

[TIP27]
CENTER=F4
`)
const stateActionItems = previewItems(stateActionDocument, 1080, 532)
assert.equal(
  effectivePreviewHitItem(
    stateActionDocument,
    stateActionItems,
    { x: 50, y: 300 },
    "preview",
    1080,
    532,
    38,
  )?.center,
  "F4",
  "状态层生效后，交互必须读取 TIP 动作而不是原始 KEY 动作",
)
assert.equal(
  effectivePreviewHitItem(
    stateActionDocument,
    stateActionItems,
    { x: 50, y: 300 },
    "edit",
    1080,
    532,
    38,
  )?.center,
  "F91",
  "编辑模式仍应选中并编辑原始 KEY 定义",
)

console.log("✓ STAT_STYLE→TIP 状态换层：渲染和交互均使用 TIP，编辑仍定位原始 KEY")

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

assert.equal(
  isFullPanelPreviewItem(
    { rect: { x: 0, y: 0, width: 1242, height: 634 } },
    1242,
    631,
  ),
  true,
  "略大于面板的背景层仍应按全屏层处理，否则会遮住先绘制的底排空格键",
)
console.log("✓ 覆盖面板的超尺寸背景层按全屏层处理")

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

const tipGeometry = IniDocument.parse(`
[KEY1]
VIEW_RECT=170,0,248,149
CENTER=1
STAT_STYLE=S1_7

[TIP7]
VIEW_RECT=183,0,230,99
CENTER=1
`)
assert.deepEqual(
  previewItems(tipGeometry).map((item) => item.section),
  ["KEY1"],
  "带 VIEW_RECT 的 TIP 是状态替换定义，不能作为独立按键叠加绘制",
)
console.log("✓ TIP 状态定义即使带 VIEW_RECT 也不作为独立按键渲染")

const extendedStates = IniDocument.parse(`
[KEY1]
STAT_STYLE=S122_7
CENTER=S101
`)
assert.equal(previewStateFromAction("S122_7"), 122)
assert.equal(previewStateFromAction("S123"), undefined)
assert.equal(stateTipSection("S122_7", 122), 7)
assert.ok(availableSkinStates(extendedStates).includes(95), "应包含 APK 已知状态")
assert.ok(availableSkinStates(extendedStates).includes(122), "应保留皮肤自定义状态")
assert.equal(skinStateLabel(2), "S2（大写锁定）")
assert.equal(actionDescription("S27"), "百度状态码 S27（回车键：发送）")
console.log("✓ S 状态：覆盖 S1-S122、补齐 APK 状态并显示中文说明")
