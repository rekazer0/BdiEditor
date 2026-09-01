import assert from "node:assert/strict"
import { IniDocument } from "../src/ini.ts"
import { parseLegacyHint, legacyHintIconID, legacyHintText } from "../src/preview.ts"

// 测试完整的四向滑动气泡解析
const fullDirectionalHint = parseLegacyHint(IniDocument.parse(`
[DRAW]
ICON_UP=1
ICON_DN=2
ICON_LT=3
ICON_RT=4
[HINT]
BACK_ICON=5
[BAR]
BACK_ICON=6
ARROW_ICON=7
CELL_STYLE=10
[ICON1]
BACK_STYLE=11
FORE_STYLE=12
SIZE=100,100
[ICON2]
BACK_STYLE=21
FORE_STYLE=22
SIZE=100,100
[ICON3]
BACK_STYLE=31
FORE_STYLE=32
SIZE=100,100
[ICON4]
BACK_STYLE=41
FORE_STYLE=42
SIZE=100,100
[ICON5]
BACK_STYLE=51
FORE_STYLE=52
SIZE=100,100
[ICON6]
BACK_STYLE=61
FORE_STYLE=62
SIZE=100,100
[ICON7]
BACK_STYLE=71
FORE_STYLE=72
SIZE=100,100
`))

assert.ok(fullDirectionalHint)
assert.equal(fullDirectionalHint.upIcon, "1")
assert.equal(fullDirectionalHint.downIcon, "2")
assert.equal(fullDirectionalHint.leftIcon, "3")
assert.equal(fullDirectionalHint.rightIcon, "4")
assert.equal(fullDirectionalHint.holdIcon, "5")
assert.equal(fullDirectionalHint.barIcon, "6")
assert.equal(fullDirectionalHint.arrowIcon, "7")
assert.equal(fullDirectionalHint.cellStyle, "10")

assert.equal(legacyHintIconID(fullDirectionalHint, "up"), "1")
assert.equal(legacyHintIconID(fullDirectionalHint, "down"), "2")
assert.equal(legacyHintIconID(fullDirectionalHint, "left"), "3")
assert.equal(legacyHintIconID(fullDirectionalHint, "right"), "4")
assert.equal(legacyHintIconID(fullDirectionalHint, "hold"), "5")
assert.equal(legacyHintIconID(fullDirectionalHint, "center"), "5", "点击时使用长按图标")
assert.equal(legacyHintText({ center: "a", up: "A", down: "。", left: "，", right: "？", hold: "", holdSymbols: "" }, "center"), "a")
assert.equal(legacyHintText({ center: "a", up: "A", down: "。", left: "，", right: "？", hold: "", holdSymbols: "" }, "down"), "。")

console.log("✓ 四向滑动气泡、长按气泡和箭头图标均可正确解析")
