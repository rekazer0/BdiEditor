import assert from "node:assert/strict"
import fs from "node:fs"
import {
  applyDecodedBdaAppearancePart,
  applyDecodedBdaSource,
  bdaAppearancePath,
  bdaDecodedSourceEditable,
  decodeBdaAppearance,
  decodedBdaAppearancePart,
  decodedBdaEditorSource,
  decodedBdaSource,
  updateBdaImageInnerRect,
} from "../src/bda.ts"
import { bdaAnimationDurations, bdaLayoutStyleGroups } from "../src/bda-editor.ts"
import { highlightJson, jsonPropertyRanges } from "../src/highlight.ts"
import { SkinArchive } from "../src/skin.ts"

const archive = SkinArchive.open(fs.readFileSync("public/default-template.bda"), "bda")
const appearancePath = bdaAppearancePath(archive, "light", "port")!
const appearanceBytes = archive.getBytes(appearancePath)!
const source = JSON.parse(decodedBdaSource(appearancePath, appearanceBytes))

assert.equal(source.designWidth, 1080)
assert.ok(Array.isArray(source.$protobuf) && source.$protobuf.length > 0, "工作区解码源码应保留完整 protobuf 字段树")
const editorSource = JSON.parse(decodedBdaEditorSource(appearancePath, appearanceBytes))
assert.ok(!("$protobuf" in editorSource), "应用内普通源码不应显示内部 protobuf 备份")
assert.ok(editorSource.panels.py_9.keys.KEY_AS, "应用内普通源码仍应包含完整语义配置")
assert.equal(bdaDecodedSourceEditable(appearancePath), true, "已确认 schema 的 appearanceConfig 应允许源码编辑")
assert.equal(bdaDecodedSourceEditable("light/skin/port/animationConfig"), true, "已确认 schema 的 animationConfig 应允许源码编辑")
assert.equal(bdaDecodedSourceEditable("light/skin/soundConfig"), true, "已确认 schema 的 soundConfig 应允许源码编辑")
assert.equal(bdaDecodedSourceEditable("light/skin/switchConfig"), false, "未知 schema 配置必须保持只读")
assert.equal(bdaDecodedSourceEditable("light/skin/stickerConfig"), false, "贴纸配置没有官方字段证据前必须保持只读")
assert.equal(bdaDecodedSourceEditable("light/skin/sceneConfig"), false, "场景配置没有官方字段证据前必须保持只读")
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

const slicedRef = { type: "image", key: 14 } as const
const slicedStyle = decodeBdaAppearance(appearanceBytes).imageStyles.get(slicedRef.key)
assert.ok(slicedStyle?.normalImage?.innerRect, "测试样式应包含 BDA innerRect")
const slicedBytes = updateBdaImageInnerRect(appearanceBytes, slicedRef, false, [1, 2, 3, 4])
const slicedAppearance = decodeBdaAppearance(slicedBytes)
assert.deepEqual(
  slicedAppearance.imageStyles.get(slicedRef.key)?.normalImage?.innerRect,
  { x: 1, y: 2, width: 3, height: 4 },
  "图片切片工具应把 innerRect 写回 BDA 正常状态图片原子",
)
assert.deepEqual(
  slicedAppearance.imageStyles.get(slicedRef.key)?.highlightImage,
  slicedStyle.highlightImage,
  "修改正常状态切片不应影响按下状态图片原子",
)
assert.equal(
  slicedAppearance.imageStyles.get(slicedRef.key)?.normalImage?.resource?.resourceID,
  slicedStyle.normalImage?.resource?.resourceID,
  "修改 BDA 切片不应改变图片资源引用",
)
assert.throws(
  () => updateBdaImageInnerRect(appearanceBytes, slicedRef, false, [-1, 0, 10, 10]),
  /非负整数/,
  "BDA 切片区域不应接受负数",
)

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
  ["panel", "input", "more", "hints", "lists"],
  "面板整体设置只展示面板自身组件，不应混入候选栏或全部按键样式",
)
assert.deepEqual(
  bdaLayoutStyleGroups(panel, [], "candidate").map((group) => group.key),
  ["candidate", "candidateSwitch", "candidateKeys"],
  "候选栏样式应属于候选栏作用域，且空分组不占位",
)
assert.ok(
  bdaLayoutStyleGroups(panel, [], "candidate").every((group) =>
    group.items.every((item) => item.path[0] === "cand")),
  "候选栏样式写回路径应指向 appearanceConfig 的 cand 字段",
)
assert.deepEqual(
  bdaLayoutStyleGroups(panel, [{ name: "KEY_AS", key: panel.keys.get("KEY_AS")! }])[0].items[0].path,
  ["keys", "KEY_AS", "backStyle"],
  "按键样式应携带指向 appearanceConfig 的写回路径",
)
const selectedKeyStyleItems = bdaLayoutStyleGroups(
  panel,
  [{ name: "KEY_AS", key: panel.keys.get("KEY_AS")! }],
)[0].items
assert.ok(
  selectedKeyStyleItems.every((item) => item.owner === "KEY_AS"),
  "同一按键的背景和前景样式应归入同一个按键块",
)
assert.deepEqual(
  selectedKeyStyleItems.map((item) => item.label),
  ["背景样式", ...selectedKeyStyleItems.slice(1).map((_, index) => `前景样式 ${index + 1}`)],
  "按键块内应使用背景样式和前景样式作为字段名",
)
const mergedKeyStyleItems = bdaLayoutStyleGroups(panel, [
  { name: "KEY_AS", key: panel.keys.get("KEY_AS")! },
  { name: "KEY_Q", key: panel.keys.get("KEY_Q")! },
])[0].items
assert.equal(
  mergedKeyStyleItems.filter((item) => item.field === "backStyle").length,
  1,
  "多选 BDA 按键后应重叠为一组样式字段",
)
assert.deepEqual(
  mergedKeyStyleItems.find((item) => item.field === "backStyle")?.paths,
  [["keys", "KEY_AS", "backStyle"], ["keys", "KEY_Q", "backStyle"]],
  "合并字段应保留全部按键的写回路径",
)
assert.ok(
  mergedKeyStyleItems.every((item) => !item.owner),
  "多选合并字段不应再按单个按键分块",
)
assert.ok(groups.every((group) => group.items.length > 0), "实际存在的组件分组不应为空")
assert.deepEqual(
  bdaLayoutStyleGroups(panel, [{ name: "KEY_AS", key: panel.keys.get("KEY_AS")! }]).map((group) => group.key),
  ["selection"],
  "选择按键后应聚焦显示所选按键样式",
)

const html = fs.readFileSync("index.html", "utf8")
const main = fs.readFileSync("src/main.ts", "utf8")
const editor = fs.readFileSync("src/bda-editor.ts", "utf8")
const styles = fs.readFileSync("src/style.css", "utf8")
assert.match(main, /decodedBdaSource\(info\.path, info\.bytes, (?:selectedPath\.split|panelName)/)
assert.match(main, /source\.\$bdiEditorRaw = encodeBase64\(bytes\)/, "BDA 源码工作区应保存可编辑 JSON")
assert.match(main, /setSourceValue\(decodedBdaEditorSource\(/, "应用内源码视图应隐藏 protobuf 备份")
assert.match(main, /applyDecodedBdaSource\(canonical, before/, "外部 BDA JSON 改动应编译回 protobuf")
const bdaSourceSelection = main.match(/else if \(archive\?\.isBdaConfig\(path\)\) \{[\s\S]*?\n  \} else \{/)?.[0] ?? ""
assert.match(bdaSourceSelection, /source\.disabled = !bdaDecodedSourceEditable\(path\)/, "未知 schema 的 BDA 解码 JSON 应保持只读")
assert.match(main, /function commitBdaSourceEdit\([\s\S]*?applyDecodedBdaSource[\s\S]*?commitBytes/, "应用内 BDA JSON 应编译回 protobuf 后再提交")
assert.match(main, /applyDecodedBdaAppearancePart/, "虚拟 appearance 片段应合并写回真实配置")
assert.match(main, /jsonPropertyRanges\(source\.value, selectedBdaSourceKeys\(\)\)/, "BDA 按键选中范围应传给 CodeMirror 装饰")
assert.doesNotMatch(main, /BDA 官方基础布局（只读几何）/)
assert.doesNotMatch(main, /group\.hidden = bdaSelected \|\|/, "BDA 选中具体按键时应复用标准按键检查器")
assert.match(html, /key-only key-appearance-fields/, "BDA 按键样式应使用 BDS\/BDI 的标准样式分组")
assert.match(main, /bdaSelected && group !== keyAppearanceFieldsGroup/, "BDA 按键只应显示实际存在的样式分组")
assert.match(main, /const bdaKeyProperties = new Set\(\["FORE_OFFSET"\]\)/, "BDA 按键的旧检查器不应再展示合成样式编号")
for (const [field, caption] of [
  ["BACK_STYLE", "背景样式（backStyle）"],
  ["FORE_STYLE", "前景样式（foreStyles）"],
  ["FORE_OFFSET", "前景样式偏移（foreStyleOffsets）"],
  ["FONT_NAME", "字体名称（fontName）"],
  ["FONT_SIZE", "字体大小（fontSize）"],
  ["NM_COLOR", "正常文字颜色（normalColor）"],
  ["HL_COLOR", "高亮文字颜色（highlightColor）"],
] as const) {
  assert.match(main, new RegExp(`${field}: "${caption}"`), `${field} 应显示 appearanceConfig 的真实字段说明`)
}
assert.match(main, /function bdaImageTiles/, "BDA 图片资源应从 appearanceConfig 图片样式构建切片引用")
assert.match(main, /updateBdaImageInnerRect\(info\.bytes, usage\.ref, usage\.highlighted, rect\)/, "BDA 切片检查器应写回选中样式状态的 innerRect")
assert.match(html, /id="tile-source-fields"[\s\S]{0,200}data-tile-source="0"/, "TIL SOURCE_RECT 字段组应可与 BDA innerRect 字段分开控制")
assert.match(main, /tileSourceFieldsGroup\.hidden = bdaSelected/, "BDA 不应展示并不存在于 appearanceConfig 中的 SOURCE_RECT 字段")
assert.match(styles, /\.geometry-fields\[hidden\]/, "隐藏的 SOURCE_RECT 字段组不应被 grid 布局重新显示")
assert.match(main, /archive\?\.format === "bda"[\s\S]*?newTileButton\.hidden/, "BDA 不适用的 TIL 新建操作应隐藏")
assert.match(html, /id="bda-tile-usage"/, "BDA 图片被多个样式引用时应可选择具体样式状态")
assert.match(main, /BDA 切片由 appearanceConfig 管理/, "BDA 图片资源不应暴露不存在的 TIL 源码")
assert.match(main, /bdaUsageCounts/, "BDA 资源列表应批量统计样式引用，避免逐图片重复解码")
assert.match(main, /syncBdaKeyFieldLabels\(bdaSelected\)/, "BDA 与 BDS\/BDI 应切换各自的按键字段说明")
assert.match(main, /bdaSelected[\s\S]*?selectedBdaKeyNames\(\)\.join/, "BDA 按键标题应使用 appearanceConfig 中的实际键名")
assert.match(main, /bdaStyleHasProperty/, "BDA 文字属性应按源码字段是否真实存在决定显隐")
assert.match(main, /function updateBdaAppearanceStyleRef/, "BDA 样式引用应可写回 appearanceConfig")
assert.match(main, /applyDecodedBdaAppearancePart\(info\.path, info\.bytes, JSON\.stringify\(source\), part\)/, "BDA 样式引用写回应编译回 protobuf")
const updateBdaStyleRef = main.match(/function updateBdaAppearanceStyleRef\([\s\S]*?\n\}/)?.[0] ?? ""
assert.match(updateBdaStyleRef, /for \(const path of paths\)/, "修改合并字段应在一次提交中同步全部选中按键")
assert.match(updateBdaStyleRef, /refreshBdaStyleReferenceField\(owner, ref, visualResolver\(\)\)/, "修改样式引用后应只重绘当前预览字段")
assert.doesNotMatch(updateBdaStyleRef, /populateKeyInspector\(\)/, "修改一个样式引用不应重建全部 BDA 预览")
assert.doesNotMatch(main, /bdaEditableKeyFields/, "BDA 按键样式引用不应继续走旧格式输入框")
assert.match(main, /if \(selectedCandidate && selectedPath === layoutPath\) return \["cand"\]/, "BDA 候选栏应定位当前面板源码中的 cand 字段")
assert.match(main, /scope: selectedCandidate \? "candidate" : "panel"/, "选中候选栏时应渲染候选栏作用域的样式")
const candidateSelection = main.match(/candidateArea\.addEventListener\("click"[\s\S]*?\n\}\)/)?.[0] ?? ""
const bdaCandidateSelection = candidateSelection.match(/if \(archive\?\.format === "bda"\) \{[\s\S]*?\n  \}/)?.[0] ?? ""
assert.match(candidateSelection, /if \(!isEditing\(\)\) return/, "候选栏应与画布按键一样只在编辑模式下选中")
assert.match(bdaCandidateSelection, /selectedPath !== layoutPath[\s\S]*?selectFile\(layoutPath, "overview"\)/, "候选栏选中时应保持在当前面板")
assert.match(bdaCandidateSelection, /selectedCandidate = true[\s\S]*?selectedKeySections = \[\]/, "候选栏与按键选择应互斥")
assert.doesNotMatch(bdaCandidateSelection, /toolbarStrip\.dataset\.path|selectFile\(path\)/, "BDA 候选栏不应选择基础包中的虚拟 cand1.cnd")
assert.match(styles, /#candidate-area\.candidate-selected::after/, "候选栏选中时应显示与按键一致的强调框")
assert.match(editor, /caption\.title = `\$\{item\.label\}（\$\{item\.field\}）`/, "按键说明应标注 BDA 源码字段名")
assert.doesNotMatch(editor, /typeSelect\.value = item\.ref\.type/, "BDA 样式引用默认不应显示 type")
assert.match(editor, /keyInput\.value = String\(item\.ref\.key\)/, "BDA 样式引用应直接显示源码中的 key")
assert.doesNotMatch(editor, /keyInput\.type = "number"/, "BDA 样式引用不是数值输入框，不应响应鼠标滚轮")
assert.match(editor, /querySelector<HTMLInputElement>\("\.document-property-input"\)/, "局部刷新应按样式输入框类名更新 key")
assert.doesNotMatch(editor, /input\.value = bdaStyleID\(item\.ref\)/, "BDA 属性值不应显示人为合成的样式编号")
assert.match(editor, /style-reference-input bda-style-reference-input/, "BDA 样式引用应复用 BDS 的 key 与预览容器")
assert.match(editor, /style-picker-trigger[\s\S]*?style-picker-states/, "BDA 样式引用应复用 BDS 的双状态预览样式")
assert.match(editor, /const bounds = canvas\.getBoundingClientRect\(\)/, "BDA 预览应使用实际渲染尺寸设置画布")
assert.match(editor, /context\.fillRect\(0, 0, width, height\)/, "BDA 颜色预览应铺满整个预览框")
assert.doesNotMatch(editor, /fillRect\(8, 8, 112, 60\)/, "BDA 预览不应继续保留固定内边距")
assert.match(editor, /fore-styles-reference-field[\s\S]*?bda-fore-styles-grid/, "foreStyles 应按集合渲染为一组对应预览")
assert.doesNotMatch(editor, /const forePreview/, "foreStyles 应复用背景样式的正常、按下双状态预览")
assert.doesNotMatch(editor, /isForeStyle\s*\?\s*control\.append/, "foreStyles 应与背景样式一样横向排列 key 和预览")
assert.match(editor, /onStyleRefAction\?\.\([\s\n]*item\.paths \?\? \[item\.path\],[\s\n]*currentRef\(\),/, "局部更新后再次点击应使用当前 key 和全部合并路径")
assert.match(styles, /\.bda-fore-styles-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/s, "foreStyles 应逐行使用横向样式引用")
assert.doesNotMatch(styles, /\.bda-fore-styles-grid \.bda-style-reference-input\s*\{/, "foreStyles 不应覆盖共用的横向样式布局")
assert.doesNotMatch(styles, /\.bda-style-reference-input > \.style-picker-trigger\s*\{/, "BDA 预览应复用 BDI、BDS 的高度和内边距")
assert.doesNotMatch(styles, /\.style-reference-input\.bda-style-reference-input > input\s*\{/, "BDA key 输入框应复用 BDI、BDS 的高度")
assert.doesNotMatch(styles, /\.bda-style-reference-input \.style-picker-state canvas\s*\{/, "BDA 缩略图应复用 BDI、BDS 的画布样式")
assert.match(editor, /event\.metaKey \|\| event\.ctrlKey \? "edit" : "replace"/, "BDA 样式预览应按修饰键区分更换和编辑")
assert.match(main, /function openBdaStyleReferencePicker[\s\S]*?openStylePicker\(input\)/, "普通点击 BDA 样式预览应复用标准样式选择器")
assert.match(main, /onStyleRefAction:[\s\S]*?openStyleReferenceEditor\(bdaStyleID\(ref\)\)/, "修饰键点击 BDA 样式预览应复用标准样式编辑入口")
assert.match(main, /function stylePickerLabel[\s\S]*?bdaStyleRef\(styleID\)\?\.key/, "BDA 样式选择器应隐藏内部合成编号并显示原始 key")
assert.match(main, /input\.dataset\.bdaStyleType = ref\.type[\s\S]*?bdaStyleRef\(styleID\)\?\.type !== bdaTargetType/, "隐藏 type 时选择器应只展示当前引用同类型的样式，避免重复 key 歧义")
assert.match(editor, /booleanField\("背景模糊"[\s\S]*?"shouldBgBlur"\)/, "面板开关应通过技术字段名标注 BDA 源码字段")
assert.match(main, /const selectedKeys = selectedBdaKeyNames\(\)[\s\S]*?keys: selectedKeys/, "选中 BDA 按键后应使用统一的源码样式引用组件")
assert.match(main, /const states = bdaSkin \? \[\] : availableSkinStates/)
assert.match(main, /if \(stylePath && archive\.format !== "bda"\)[\s\S]*label: "按键音效"/)
assert.match(editor, /renderBdaLayoutEditor/)
assert.match(editor, /stylePreview/)
assert.match(editor, /event\.metaKey \|\| event\.ctrlKey \? "slice" : "replace"/, "BDA 图片样式预览应按修饰键区分换图和切片")
assert.match(editor, /state\.title = "点击更换图片；Command\/Ctrl 点击进入切片工具"/, "BDA 图片样式预览应说明两种交互")
assert.match(main, /function replaceBdaStyleImage\([\s\S]*?openBdaStyleImageResourceChooser/, "普通点击 BDA 状态图片应打开资源选择器")
assert.match(main, /if \(!pickerTarget\) \{[\s\S]*?styleImageDialog\.hidden = false/, "直接更换 BDA 图片时应显示资源选择对话框")
assert.match(main, /function editBdaStyleImageSlice\([\s\S]*?selectResourceImage\(path\)/, "修饰键点击 BDA 状态图片应进入图片切片工具")
assert.match(main, /onImageAction: \(ref, highlighted, action\)/, "BDA 样式编辑器应把图片状态操作接入主工作流")
assert.match(editor, /picker\.type = "color"/)
assert.match(editor, /range\.type = "range"/)
assert.match(editor, /高级图片字段（只读）/)
assert.match(editor, /onPanelPropertyChange/)
assert.match(editor, /document-property-section bda-panel-property-section/, "BDA 面板应复用 BDS\/BDI 的标准属性分区")
assert.match(editor, /bda-key-style-block/, "同一 BDA 按键的背景和前景引用应渲染在一个按键块中")
assert.match(editor, /document-property-field wide style-reference-field/, "BDA 样式引用应复用标准属性字段与预览逻辑")
assert.match(editor, /bda-style-reference-label/, "BDA 样式引用名称应有独立语义，便于与控件和预览对齐")
assert.match(editor, /bda-style-reference-state-label/, "正常与按下状态应使用专用的紧凑标签")
assert.match(editor, /imageResourceNames\?\.\[index\]/, "BDA 图片资源名应显示在对应状态预览中")
assert.match(editor, /state\.append\(name\)[\s\S]*?state\.append\(canvas, caption\)/, "BDA 图片资源名应位于预览图上方")
assert.doesNotMatch(editor, /textField\("(?:正常|按下)图片"/, "BDA 图片资源名不应作为可编辑输入框显示")
assert.match(styles, /\.bda-style-resource-name\s*\{[^}]*text-overflow:\s*ellipsis/s, "长图片资源名应在预览上方安全截断")
assert.match(styles, /\.bda-style-resource-name\s*\{[^}]*text-align:\s*center/s, "图片资源名应在预览上方居中显示")
assert.doesNotMatch(editor, /group\("keys", "全部按键样式"/, "整体设置不应列出具体按键样式")
assert.match(editor, /dataset\.inspectorGroupLabel = label/, "BDA 属性块应提供统一检查器分组标签")
assert.match(main, /group === bdaConfigFieldsGroup[\s\S]*?bda-inspector-section/, "BDA 属性块应接入与 BDS\/BDI 相同的检查器分组栏")
assert.match(main, /availableStyleIDs\(\)[\s\S]*?archive\.format === "bda"[\s\S]*?bdaStyleID/, "BDA 样式引用应复用标准样式预览和编辑入口")
assert.match(main, /archive\?\.format === "bda"[\s\S]*?styleDetailPreviews\.hidden = true/, "BDA 样式详情应隐藏 BDI\/BDS 的 NM_IMG、HL_IMG 状态预览")
assert.match(styles, /:is\(\.document-fields, \.bda-config-fields\):has\(\.mobile-inspector-managed\)/, "BDA 分组应复用检查器的 grouped 布局")
assert.match(styles, /\.style-detail-previews\[hidden\]\s*\{\s*display:\s*none/, "隐藏的 BDI\/BDS 状态预览不应被 grid 样式强制显示")
assert.match(styles, /#style-detail-fields\s*>\s*\.bda-style-card\s*\{[^}]*grid-column:\s*1\s*\/\s*-1/, "BDA 样式编辑卡应铺满详情区的两列网格")
assert.match(styles, /\.app-dialog \.settings-switch,\s*\.inspector-switch/, "BDA 面板开关应复用通用开关样式")
assert.match(styles, /\.bda-panel-property-section \.document-property-grid\s*\{[^}]*gap:\s*0[^}]*border:\s*1px solid var\(--line-soft\)/s, "BDA 引用应组成连续属性列表而不是重复卡片")
assert.match(styles, /\.bda-panel-property-section \.style-reference-field\s*\{[^}]*grid-template-columns:\s*minmax\(112px, 0\.72fr\) minmax\(0, 2\.28fr\)/s, "宽屏 BDA 引用行应明确分配名称与编辑内容")
assert.doesNotMatch(styles, /\n\.style-reference-field\s*\{[^}]*grid-template-columns/s, "普通 BDS/BDI 样式字段的标题应位于控件上方")
assert.match(styles, /@container \(max-width: 520px\)[\s\S]*?\.style-reference-field\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/s, "窄检查器中的 BDA 引用行应折成单列")
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
