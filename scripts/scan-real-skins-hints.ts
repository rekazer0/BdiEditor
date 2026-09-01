import { readFileSync, readdirSync } from "node:fs"
import { SkinArchive } from "../src/skin.ts"
import { IniDocument } from "../src/ini.ts"
import { parseLegacyHint } from "../src/preview.ts"

const skinDir = "/Users/kaze/work/bd"
const skins = readdirSync(skinDir).filter(name => /\.bd[sia]$/.test(name)).slice(0, 15)

console.log(`扫描 ${skins.length} 个皮肤文件...\n`)

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

for (const skinName of skins) {
  stats.total++
  try {
    const skinPath = `${skinDir}/${skinName}`
    const skin = SkinArchive.open(readFileSync(skinPath))
    
    const hintPaths = skin.names().filter(name => name.endsWith(".pop"))
    if (hintPaths.length === 0) {
      console.log(`⚠ ${skinName} - 无气泡配置`)
      continue
    }
    
    stats.withHint++
    let hasAnyDirectional = false
    
    for (const hintPath of hintPaths) {
      const orientation = hintPath.includes("/port/") ? "竖屏" : 
                         hintPath.includes("/land/") ? "横屏" : "未知"
      const hintText = skin.getText(hintPath)
      const hint = parseLegacyHint(IniDocument.parse(hintText))
      
      if (!hint) {
        console.log(`  ✗ ${orientation} 解析失败`)
        continue
      }
      
      const features: string[] = []
      if (hint.holdIcon) features.push("长按")
      if (hint.barIcon) features.push("多选栏")
      if (hint.upIcon) { features.push("上滑"); stats.withUpIcon++; hasAnyDirectional = true }
      if (hint.downIcon) { features.push("下滑"); stats.withDownIcon++; hasAnyDirectional = true }
      if (hint.leftIcon) { features.push("左滑"); stats.withLeftIcon++; hasAnyDirectional = true }
      if (hint.rightIcon) { features.push("右滑"); stats.withRightIcon++; hasAnyDirectional = true }
      if (hint.arrowIcon) { features.push("箭头"); stats.withArrowIcon++ }
      
      const iconCount = hint.icons.size
      if (hasAnyDirectional || hint.arrowIcon) {
        console.log(`✓ ${skinName}`)
        console.log(`  ${orientation}: ${features.join("、")} | ${iconCount}个图标定义`)
      }
    }
    
    if (!hasAnyDirectional) {
      console.log(`○ ${skinName} - 仅基础气泡（长按/多选栏）`)
    }
    
  } catch (error) {
    stats.parseErrors++
    console.log(`✗ ${skinName} - 加载失败: ${error instanceof Error ? error.message : String(error)}`)
  }
}

console.log("\n" + "=".repeat(60))
console.log("统计结果:")
console.log(`  总计扫描: ${stats.total} 个皮肤`)
console.log(`  包含气泡: ${stats.withHint} 个`)
console.log(`  配置上滑气泡: ${stats.withUpIcon} 个`)
console.log(`  配置下滑气泡: ${stats.withDownIcon} 个`)
console.log(`  配置左滑气泡: ${stats.withLeftIcon} 个`)
console.log(`  配置右滑气泡: ${stats.withRightIcon} 个`)
console.log(`  配置箭头图标: ${stats.withArrowIcon} 个`)
console.log(`  加载失败: ${stats.parseErrors} 个`)
