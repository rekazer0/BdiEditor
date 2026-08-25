import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { bdaAppearancePath, bdaLayoutDocument, bdaStyleRef, decodeBdaAppearance, decodedBdaSource } from "../src/bda.ts"
import { IniDocument } from "../src/ini.ts"
import { previewItems } from "../src/preview.ts"
import { SkinArchive } from "../src/skin.ts"

const skin = SkinArchive.open(readFileSync("public/default-template.bda"), "bda")
const base = SkinArchive.open(readFileSync("public/bda-base.bds"), "bds")
let panels = 0
let adaptedStyles = 0

for (const orientation of ["port", "land"]) {
  const appearancePath = bdaAppearancePath(skin, "light", orientation)
  assert.ok(appearancePath)
  const appearance = decodeBdaAppearance(skin.getBytes(appearancePath)!)
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
console.log(`✓ 官方 BDA ${panels} 个横竖屏布局与 ${adaptedStyles} 个样式引用可通过共享预览模型解析`)
