import { readFileSync, readdirSync } from "node:fs"
import { SkinArchive } from "../src/skin.ts"
import { IniDocument } from "../src/ini.ts"
import { parseLegacyHint } from "../src/preview.ts"

const skinDir = "/Users/kaze/work/bd"
const skins = readdirSync(skinDir).filter(name => /\.bd[sia]$/.test(name))

console.log(`完整扫描 ${skins.length} 个皮肤...\n`)

const stats = {
  total: 0,
  withHint: 0,
  withUpIcon: 0,
  withDownIcon: 0,
  withLeftIcon: 0,
  withRightIcon: 0,
  withArrowIcon: 0,
  parseErrors: 0,
}

const directionalSkins: string[] = []

for (const skinName of skins) {
  stats.total++
  try {
    const skinPath = `${skinDir}/${skinName}`
    const skin = SkinArchive.open(readFileSync(skinPath))
    
    const hintPaths = skin.names().filter(name => name.endsWith(".pop"))
    if (hintPaths.length === 0) continue
    
    stats.withHint++
    let hasDirectional = false
    
    for (const hintPath of hintPaths) {
      const hint = parseLegacyHint(IniDocument.parse(skin.getText(hintPath)))
      if (!hint) continue
      
      if (hint.upIcon) { stats.withUpIcon++; hasDirectional = true }
      if (hint.downIcon) { stats.withDownIcon++; hasDirectional = true }
      if (hint.leftIcon) { stats.withLeftIcon++; hasDirectional = true }
      if (hint.rightIcon) { stats.withRightIcon++; hasDirectional = true }
      if (hint.arrowIcon) stats.withArrowIcon++
    }
    
    if (hasDirectional) directionalSkins.push(skinName)
    
  } catch (error) {
    stats.parseErrors++
  }
}

console.log("统计结果:")
console.log(`  总计: ${stats.total} 个皮肤`)
console.log(`  包含气泡配置: ${stats.withHint} 个`)
console.log(`  使用四向滑动: ${directionalSkins.length} 个`)
console.log(`  配置上滑: ${stats.withUpIcon} 次`)
console.log(`  配置下滑: ${stats.withDownIcon} 次`)
console.log(`  配置左滑: ${stats.withLeftIcon} 次`)
console.log(`  配置右滑: ${stats.withRightIcon} 次`)
console.log(`  配置箭头: ${stats.withArrowIcon} 次`)
console.log(`  加载失败: ${stats.parseErrors} 个`)

if (directionalSkins.length > 0) {
  console.log("\n使用四向滑动的皮肤:")
  directionalSkins.forEach(name => console.log(`  - ${name}`))
}
