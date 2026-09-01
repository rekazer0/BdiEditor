import assert from "node:assert/strict"
import { IniDocument } from "../src/ini.ts"
import { isLegacyHintInputKey, parseLegacyHint, legacyHintIconID } from "../src/preview.ts"

console.log("测试气泡显示逻辑...")

// 模拟一个有长按气泡的配置
const hintWithHold = parseLegacyHint(IniDocument.parse(`
[HINT]
BACK_ICON=1
[ICON1]
BACK_STYLE=23
FORE_STYLE=21
SIZE=100,100
`))

assert.ok(hintWithHold, "应该能解析配置")
assert.equal(hintWithHold.holdIcon, "1", "应该有长按图标")

// 测试各种方向的图标返回
console.log("\n方向图标映射:")
console.log("  center:", legacyHintIconID(hintWithHold, "center"), "（应该是 '1' - 点击时使用长按图标）")
console.log("  hold:", legacyHintIconID(hintWithHold, "hold"), "（应该是 '1'）")
console.log("  up:", legacyHintIconID(hintWithHold, "up"), "（应该是 undefined）")

assert.equal(legacyHintIconID(hintWithHold, "center"), "1", "点击时应该返回长按图标")
assert.equal(legacyHintIconID(hintWithHold, "hold"), "1", "长按时应该返回长按图标")
assert.equal(legacyHintIconID(hintWithHold, "up"), undefined, "上滑无配置时应该返回 undefined")

// 模拟气泡显示条件判断
function shouldShowHint(hintConfig: any, hintDirection: string): boolean {
  if (!hintConfig) return false
  
  return Boolean(
    (hintDirection === "hold" && hintConfig.holdIcon) ||
    (hintDirection === "up" && hintConfig.upIcon) ||
    (hintDirection === "down" && hintConfig.downIcon) ||
    (hintDirection === "left" && hintConfig.leftIcon) ||
    (hintDirection === "right" && hintConfig.rightIcon) ||
    (hintDirection === "center" && hintConfig.holdIcon)
  )
}

console.log("\n气泡显示判断:")
console.log("  center:", shouldShowHint(hintWithHold, "center"), "（应该是 true）")
console.log("  hold:", shouldShowHint(hintWithHold, "hold"), "（应该是 true）")
console.log("  up:", shouldShowHint(hintWithHold, "up"), "（应该是 false）")

assert.equal(shouldShowHint(hintWithHold, "center"), true, "点击时应该显示气泡")
assert.equal(shouldShowHint(hintWithHold, "hold"), true, "长按时应该显示气泡")
assert.equal(shouldShowHint(hintWithHold, "up"), false, "上滑无配置时不应显示气泡")

// 验证图标 ID 返回
const centerIconId = legacyHintIconID(hintWithHold, "center")
const holdIconId = legacyHintIconID(hintWithHold, "hold")
console.log("\n图标 ID 返回:")
console.log("  center 图标:", centerIconId, "（应该是 '1'）")
console.log("  hold 图标:", holdIconId, "（应该是 '1'）")
console.log("  图标配置:", hintWithHold.icons.get(centerIconId!), "（应该有完整配置）")

assert.ok(hintWithHold.icons.get(centerIconId!), "点击时应该能获取图标配置")

const directionalOnlyHint = parseLegacyHint(IniDocument.parse(`
[DRAW]
ICON_UP=2
ICON_DN=2
ICON_LT=2
ICON_RT=2
[ICON2]
BACK_STYLE=23
FORE_STYLE=21
SIZE=170,185
`))
assert.equal(legacyHintIconID(directionalOnlyHint, "center"), "2", "没有专用点击图标时应回退到上滑图标")
assert.equal(isLegacyHintInputKey({ section: "KEY9", center: "k" }), true, "字符输入键应显示气泡")
assert.equal(isLegacyHintInputKey({ section: "KEY14", center: "F36" }), false, "功能键不应显示气泡")
assert.equal(isLegacyHintInputKey({ section: "LIST:0", center: "，" }), false, "列表项不应显示气泡")

console.log("\n✓ 所有气泡显示逻辑测试通过")
console.log("✓ 点击和长按都能正确判断应该显示气泡")
