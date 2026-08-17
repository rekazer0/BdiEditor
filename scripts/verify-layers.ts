import assert from "node:assert/strict"
import { IniDocument } from "../src/ini.ts"
import { effectivePreviewItem } from "../src/preview.ts"

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
