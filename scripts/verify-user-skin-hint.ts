import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { SkinArchive } from "../src/skin.ts"
import { IniDocument } from "../src/ini.ts"
import { parseLegacyHint } from "../src/preview.ts"

// 测试用户提供的皮肤文件
const userSkinPath = "/Users/kaze/.proma/agent-workspaces/bdi-edit/06d3f7e9-2ace-4885-9f2f-27878a0c519c/attachments/Bagan - 丨 Amk-3.bds"
const userSkin = SkinArchive.open(readFileSync(userSkinPath))

console.log("皮肤格式:", userSkin.format)
console.log("包含的 .pop 文件:")
for (const name of userSkin.names()) {
  if (name.endsWith(".pop")) {
    console.log(`  ${name}`)
  }
}

// 解析竖屏气泡
const portHintPath = "port/hint1.pop"
if (userSkin.isText(portHintPath)) {
  const portHintText = userSkin.getText(portHintPath)
  console.log("\n竖屏气泡配置内容:")
  console.log(portHintText)
  
  const portHint = parseLegacyHint(IniDocument.parse(portHintText))
  console.log("\n解析结果:")
  console.log("  holdIcon:", portHint?.holdIcon)
  console.log("  barIcon:", portHint?.barIcon)
  console.log("  arrowIcon:", portHint?.arrowIcon)
  console.log("  upIcon:", portHint?.upIcon)
  console.log("  定义的图标数量:", portHint?.icons.size)
  
  assert.ok(portHint, "竖屏气泡应能正确解析")
  console.log("\n✓ 用户皮肤的气泡配置解析成功")
} else {
  console.log("\n⚠ 竖屏未找到 hint1.pop")
}

// 解析横屏气泡
const landHintPath = "land/hint1.pop"
if (userSkin.isText(landHintPath)) {
  const landHintText = userSkin.getText(landHintPath)
  console.log("\n横屏气泡配置内容:")
  console.log(landHintText)
  
  const landHint = parseLegacyHint(IniDocument.parse(landHintText))
  console.log("\n解析结果:")
  console.log("  holdIcon:", landHint?.holdIcon)
  console.log("  barIcon:", landHint?.barIcon)
  console.log("  arrowIcon:", landHint?.arrowIcon)
  console.log("  upIcon:", landHint?.upIcon)
  console.log("  定义的图标数量:", landHint?.icons.size)
  
  assert.ok(landHint, "横屏气泡应能正确解析")
}

console.log("\n✓ 所有气泡配置验证完成")
