import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { BdaResolver, bdaAppearancePath, bdaConfigPaths, bdaLayoutDocument, bdaStyleID, bdaStyleRef, decodeBdaAnimation, decodeBdaAppearance, decodedBdaSource } from "../src/bda.ts"
import { IniDocument } from "../src/ini.ts"
import { previewItems } from "../src/preview.ts"
import { SkinArchive } from "../src/skin.ts"

const skin = SkinArchive.open(readFileSync("public/default-template.bda"), "bda")
const base = SkinArchive.open(readFileSync("public/bda-base.bds"), "bds")
assert.notEqual(base.getText("light/skin/port/en_26.ini"), base.getText("light/skin/port/en_26s.ini"), "小写与 Shift 大写布局不能混用")
let panels = 0
let adaptedStyles = 0

for (const orientation of ["port", "land"]) {
  const appearancePath = bdaAppearancePath(skin, "light", orientation)
  assert.ok(appearancePath)
  const appearance = decodeBdaAppearance(skin.getBytes(appearancePath)!)
  const resolver = new BdaResolver(skin, skin.getBytes(appearancePath)!, base, "light", orientation)
  const textStyle = appearance.textStyles.entries().next().value
  const colorStyle = appearance.colorStyles.entries().next().value
  assert.ok(textStyle && (await resolver.resolve(bdaStyleID({ type: "text", key: textStyle[0] }), false))?.text, `${orientation} 文字样式应生成文字预览`)
  assert.ok(colorStyle && (await resolver.resolve(bdaStyleID({ type: "color", key: colorStyle[0] }), false))?.color, `${orientation} 颜色样式应生成颜色预览`)
  const source = JSON.parse(decodedBdaSource(appearancePath, skin.getBytes(appearancePath)!))
  assert.ok(source.panels?.py_26?.cand, `${orientation} 官方候选字段应出现在源码视图`)
  assert.ok(source.panels?.py_26?.hints?.short, `${orientation} 官方提示字段应出现在源码视图`)
  const documents = ["gen.ini", "cand1.cnd", "hint1.pop"]
  for (const [panelName, panel] of appearance.panels) {
    const layoutPath = `light/skin/${orientation}/${panelName}.ini`
    if (!base.isText(layoutPath)) continue
    panels++
    for (const path of [layoutPath, ...documents.map((name) => `light/skin/${orientation}/${name}`)]) {
      if (!base.isText(path)) continue
      const document = bdaLayoutDocument(IniDocument.parse(base.getText(path)), appearance, panelName)
      if (path === layoutPath && panel.keys.size) {
        assert.ok(previewItems(document).length, `${orientation}/${panelName} 应生成预览项`)
      }
      for (const { key, value } of document.entries()) {
        if (!/(?:BACK|FORE|CELL)_STYLE|FIRST_FORE|FONT_STYLE/.test(key)) continue
        for (const token of value.split(",")) {
          const ref = bdaStyleRef(token.trim())
          if (!ref) continue
          adaptedStyles++
          const styles = ref.type === "image" ? appearance.imageStyles : ref.type === "text" ? appearance.textStyles : appearance.colorStyles
          assert.ok(styles.has(ref.key), `${orientation}/${panelName} 引用了不存在的 ${ref.type} 样式 ${ref.key}`)
        }
      }
    }
  }
}

assert.ok(panels >= 40, `官方横竖屏布局覆盖不足：${panels}`)
assert.ok(adaptedStyles >= 1000, `官方样式适配覆盖不足：${adaptedStyles}`)
const whalePath = "/Users/kaze/Downloads/3鲸鱼IOS.bda"
if (existsSync(whalePath)) {
  const whale = SkinArchive.open(readFileSync(whalePath), "bda")
  const paths = bdaConfigPaths(whale, "dark", "port", "animation")
  assert.deepEqual(paths.map((path) => path.split("/").pop()), ["animationConfig", "2animationConfig"])
  for (const path of paths) assert.ok(decodeBdaAnimation(whale.getBytes(path)!).effects.size >= 3)
}
console.log(`✓ 官方 BDA ${panels} 个横竖屏布局与 ${adaptedStyles} 个样式引用可通过共享预览模型解析`)
