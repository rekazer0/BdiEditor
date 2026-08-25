import assert from "node:assert/strict"
import fs from "node:fs"
import { bdaAppearancePath, decodedBdaSource } from "../src/bda.ts"
import { bdaAnimationDurations } from "../src/bda-editor.ts"
import { SkinArchive } from "../src/skin.ts"

const archive = SkinArchive.open(fs.readFileSync("public/default-template.bda"), "bda")
const appearancePath = bdaAppearancePath(archive, "light", "port")!
const appearanceBytes = archive.getBytes(appearancePath)!
const source = JSON.parse(decodedBdaSource(appearancePath, appearanceBytes))

assert.equal(source.designWidth, 1080)
assert.ok(source.panels.py_9.keys.KEY_AS, "解码源码应包含包内真实按键")
assert.equal(source.colorStyles[93].normalColor, "FFFFFFFF")
assert.ok(!("highlightColor" in source.colorStyles[93]), "包内缺失的高亮颜色不应出现在解码源码")
assert.ok(!("alpha" in source.imageStyles[294].normalImage), "包内缺失的图片透明度不应被默认值伪造")

const panelSource = JSON.parse(decodedBdaSource(appearancePath, appearanceBytes, "py_9.ini"))
assert.equal(panelSource.panel, "py_9")
assert.ok(panelSource.keys.KEY_AS)
assert.ok(!("imageStyles" in panelSource), "布局源码应只显示实际面板，不应泄露内置骨骼布局")

const main = fs.readFileSync("src/main.ts", "utf8")
const editor = fs.readFileSync("src/bda-editor.ts", "utf8")
const styles = fs.readFileSync("src/style.css", "utf8")
assert.match(main, /decodedBdaSource\(info\.path, info\.bytes, path\.split/)
assert.doesNotMatch(main, /BDA 官方基础布局（只读几何）/)
assert.match(main, /group\.hidden = bdaSelected \|\|/)
assert.match(main, /const states = bdaSkin \? \[\] : availableSkinStates/)
assert.match(main, /if \(archive\.format !== "bda"\)[\s\S]*label: "按键音效"/)
assert.match(editor, /renderBdaLayoutEditor/)
assert.match(editor, /stylePreview/)
assert.match(editor, /picker\.type = "color"/)
assert.match(editor, /range\.type = "range"/)
assert.deepEqual(bdaAnimationDurations([
  {},
  { duration: 0 },
  { duration: 33 },
]), [100, 16, 33])
assert.match(editor, /bda-animation-player/)
assert.match(editor, /bda-frame-resource-button/)
assert.match(main, /openBdaAnimationResourceChooser/)
assert.doesNotMatch(styles.match(/\.bda-frame-strip \{[\s\S]*?\}/)?.[0] ?? "", /grid-auto-flow:\s*column/)

console.log("✓ BDA 实际字段、纵向动画帧、资源选择与播放时序检查通过")
