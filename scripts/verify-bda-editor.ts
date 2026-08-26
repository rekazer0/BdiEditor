import assert from "node:assert/strict"
import fs from "node:fs"
import {
  applyDecodedBdaAppearancePart,
  applyDecodedBdaSource,
  bdaAppearancePath,
  decodeBdaAppearance,
  decodedBdaAppearancePart,
  decodedBdaSource,
} from "../src/bda.ts"
import { bdaAnimationDurations, bdaLayoutStyleGroups } from "../src/bda-editor.ts"
import { highlightJson, jsonPropertyRanges } from "../src/highlight.ts"
import { SkinArchive } from "../src/skin.ts"

const archive = SkinArchive.open(fs.readFileSync("public/default-template.bda"), "bda")
const appearancePath = bdaAppearancePath(archive, "light", "port")!
const appearanceBytes = archive.getBytes(appearancePath)!
const source = JSON.parse(decodedBdaSource(appearancePath, appearanceBytes))

assert.equal(source.designWidth, 1080)
assert.ok(Array.isArray(source.$protobuf) && source.$protobuf.length > 0, "解码源码应保留完整 protobuf 字段树")
assert.equal(
  source.$protobuf.map((field: { encodedHex: string }) => field.encodedHex).join(""),
  Buffer.from(appearanceBytes).toString("hex"),
  "解码源码中的顶层字段必须能 100% 还原原始 protobuf",
)
assert.deepEqual(
  applyDecodedBdaSource(appearancePath, appearanceBytes, JSON.stringify(source)),
  appearanceBytes,
  "未修改的解码源码回写后必须逐字节不变",
)
assert.ok(source.panels.py_9.keys.KEY_AS, "解码源码应包含包内真实按键")
assert.equal(source.colorStyles[93].normalColor, "FFFFFFFF")
assert.ok(!("highlightColor" in source.colorStyles[93]), "包内缺失的高亮颜色不应出现在解码源码")
assert.ok(!("alpha" in source.imageStyles[294].normalImage), "包内缺失的图片透明度不应被默认值伪造")

const externalSource = structuredClone(source)
externalSource.designWidth = 1079
externalSource.colorStyles[93].normalColor = "FF010203"
const externalBytes = applyDecodedBdaSource(appearancePath, appearanceBytes, JSON.stringify(externalSource))
const externalAppearance = decodeBdaAppearance(externalBytes)
assert.equal(externalAppearance.designWidth, 1079, "外部 JSON 应能写回 BDA 设计宽度")
assert.equal(externalAppearance.colorStyles.get(93)?.normalColor, 0xFF010203, "外部 JSON 应能写回 BDA 颜色")
const unsupportedSource = structuredClone(source)
unsupportedSource.panels.py_9.unsupportedField = true
assert.throws(
  () => applyDecodedBdaSource(appearancePath, appearanceBytes, JSON.stringify(unsupportedSource)),
  /暂不支持/,
  "不支持的外部 JSON 改动不应损坏 protobuf",
)

const panelText = decodedBdaSource(appearancePath, appearanceBytes, "py_9.ini")
const panelSource = JSON.parse(panelText)
assert.equal(panelSource.panel, "py_9")
assert.ok(panelSource.keys.KEY_AS)
assert.ok(!("imageStyles" in panelSource), "布局源码应只显示实际面板，不应泄露内置骨骼布局")
const keyRange = jsonPropertyRanges(panelText, ["KEY_AS"])[0]
assert.ok(keyRange, "BDA 按键应能定位到解码源码")
assert.match(panelText.slice(...keyRange), /"backStyle"/, "BDA 按键源码范围应覆盖完整按键配置")
assert.match(highlightJson(panelText, "", -1, ["KEY_AS"]), /class="token-selected"/, "BDA 按键应复用源码选中高亮样式")

const colorPart = { kind: "styles", group: "colorStyles" } as const
const colorPartSource = JSON.parse(decodedBdaAppearancePart(appearanceBytes, colorPart))
assert.deepEqual(Object.keys(colorPartSource), ["colorStyles"], "颜色样式入口应只显示颜色样式源码")
colorPartSource.colorStyles[93].normalColor = "FF112233"
const colorPartBytes = applyDecodedBdaAppearancePart(
  appearancePath,
  appearanceBytes,
  JSON.stringify(colorPartSource),
  colorPart,
)
assert.equal(decodeBdaAppearance(colorPartBytes).colorStyles.get(93)?.normalColor, 0xFF112233, "颜色样式片段应写回 appearanceConfig")

const panelPart = { kind: "panel", name: "py_9" } as const
const panelPartSource = JSON.parse(decodedBdaAppearancePart(appearanceBytes, panelPart))
assert.equal(panelPartSource.panel, "py_9")
assert.ok(!("panels" in panelPartSource), "面板入口应只显示当前面板源码")
panelPartSource.keys.KEY_AS.backStyle.key += 1
panelPartSource.shouldBgBlur = false
panelPartSource.trackColor = "FF112233"
const panelPartBytes = applyDecodedBdaAppearancePart(
  appearancePath,
  appearanceBytes,
  JSON.stringify(panelPartSource),
  panelPart,
)
const patchedPanel = decodeBdaAppearance(panelPartBytes).panels.get("py_9")
assert.equal(
  patchedPanel?.keys.get("KEY_AS")?.backStyle?.key,
  panelPartSource.keys.KEY_AS.backStyle.key,
  "面板片段中的样式引用应写回 appearanceConfig",
)
assert.equal(patchedPanel?.shouldBgBlur, false, "背景模糊选项应写回 appearanceConfig")
assert.equal(patchedPanel?.trackColor, 0xFF112233, "轨迹颜色应写回 appearanceConfig")

const panel = decodeBdaAppearance(appearanceBytes).panels.get("py_9")!
const groups = bdaLayoutStyleGroups(panel, [])
assert.deepEqual(
  groups.map((group) => group.key),
  ["panel", "candidate", "input", "more", "hints", "lists", "keys"],
  "未选择按键时应展示全部已确认的 BDA 面板组件",
)
assert.ok(groups.every((group) => group.items.length > 0), "实际存在的组件分组不应为空")
assert.deepEqual(
  bdaLayoutStyleGroups(panel, [{ name: "KEY_AS", key: panel.keys.get("KEY_AS")! }]).map((group) => group.key),
  ["selection"],
  "选择按键后应聚焦显示所选按键样式",
)

const main = fs.readFileSync("src/main.ts", "utf8")
const editor = fs.readFileSync("src/bda-editor.ts", "utf8")
const styles = fs.readFileSync("src/style.css", "utf8")
assert.match(main, /decodedBdaSource\(info\.path, info\.bytes, (?:selectedPath\.split|panelName)/)
assert.match(main, /source\.\$bdiEditorRaw = encodeBase64\(bytes\)/, "BDA 源码工作区应保存可编辑 JSON")
assert.match(main, /applyDecodedBdaSource\(canonical, before/, "外部 BDA JSON 改动应编译回 protobuf")
const bdaSourceSelection = main.match(/else if \(archive\?\.isBdaConfig\(path\)\) \{[\s\S]*?\n  \} else \{/)?.[0] ?? ""
assert.match(bdaSourceSelection, /source\.disabled = false/, "编辑模式应允许编辑 BDA 解码 JSON")
assert.match(main, /function commitBdaSourceEdit\([\s\S]*?applyDecodedBdaSource[\s\S]*?commitBytes/, "应用内 BDA JSON 应编译回 protobuf 后再提交")
assert.match(main, /applyDecodedBdaAppearancePart/, "虚拟 appearance 片段应合并写回真实配置")
assert.match(main, /jsonPropertyRanges\(source\.value, selectedBdaSourceKeys\(\)\)/, "BDA 按键选中范围应传给 CodeMirror 装饰")
assert.doesNotMatch(main, /BDA 官方基础布局（只读几何）/)
assert.match(main, /group\.hidden = bdaSelected \|\|/)
assert.match(main, /const states = bdaSkin \? \[\] : availableSkinStates/)
assert.match(main, /if \(stylePath && archive\.format !== "bda"\)[\s\S]*label: "按键音效"/)
assert.match(editor, /renderBdaLayoutEditor/)
assert.match(editor, /stylePreview/)
assert.match(editor, /picker\.type = "color"/)
assert.match(editor, /range\.type = "range"/)
assert.match(editor, /高级图片字段（只读）/)
assert.match(editor, /onPanelPropertyChange/)
assert.match(editor, /bda-component-section/)
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
