import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { SkinArchive } from "../src/skin.ts"
import { IniDocument } from "../src/ini.ts"
import { parseLegacyHint, legacyHintIconID } from "../src/preview.ts"

// 测试从真实皮肤文件加载 .pop 配置
const defaultTemplatePath = "public/default-template.bds"
const defaultTemplate = SkinArchive.open(readFileSync(defaultTemplatePath))

// 验证皮肤包含 hint 文件
const portHintPath = "port/hint1.pop"
const landHintPath = "land/hint1.pop"
assert.ok(defaultTemplate.isText(portHintPath), "默认模板应包含竖屏气泡配置")
assert.ok(defaultTemplate.isText(landHintPath), "默认模板应包含横屏气泡配置")

// 解析竖屏气泡
const portHint = parseLegacyHint(IniDocument.parse(defaultTemplate.getText(portHintPath)))
assert.ok(portHint, "竖屏气泡配置应能正确解析")
assert.ok(portHint.holdIcon, "竖屏气泡应配置长按图标")
assert.ok(portHint.barIcon, "竖屏气泡应配置多候选栏图标")
assert.ok(portHint.arrowIcon, "竖屏气泡应解析已配置的箭头图标")
assert.ok(portHint.icons.size >= 2, "竖屏气泡应定义至少2个图标")

// 解析横屏气泡
const landHint = parseLegacyHint(IniDocument.parse(defaultTemplate.getText(landHintPath)))
assert.ok(landHint, "横屏气泡配置应能正确解析")
assert.ok(landHint.holdIcon, "横屏气泡应配置长按图标")
assert.ok(landHint.barIcon, "横屏气泡应配置多候选栏图标")
assert.ok(landHint.arrowIcon, "横屏气泡应解析已配置的箭头图标")

// 验证图标映射
assert.equal(legacyHintIconID(portHint, "hold"), portHint.holdIcon)
assert.equal(legacyHintIconID(portHint, "center"), portHint.holdIcon, "点击时应使用长按图标")

// 验证图标配置完整性
const holdIconConfig = portHint.icons.get(portHint.holdIcon!)
const arrowIconConfig = portHint.icons.get(portHint.arrowIcon!)
assert.ok(holdIconConfig, "长按图标应有完整配置")
assert.ok(arrowIconConfig, "箭头图标应有完整配置")
assert.ok(holdIconConfig.size[0] > 0 && holdIconConfig.size[1] > 0, "图标尺寸应为正数")
assert.ok(holdIconConfig.backStyle, "图标应配置背景样式")
assert.ok(holdIconConfig.foreStyle, "图标应配置前景样式")
assert.equal(holdIconConfig.padding.length, 4, "图标内边距应为4个值")

console.log("✓ 真实皮肤的气泡配置能正确加载、解析和映射")
