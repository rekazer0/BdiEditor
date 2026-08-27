import assert from "node:assert/strict"
import fs from "node:fs"

const main = fs.readFileSync("src/main.ts", "utf8")
const bda = fs.readFileSync("src/bda.ts", "utf8")

for (const [kind, group] of [
  ["animation", "动画效果"],
  ["lightAnimation", "轻量动画"],
  ["sound", "按键音效"],
  ["switch", "开关配置"],
  ["sticker", "贴纸配置"],
  ["scene", "场景配置"],
] as const) {
  assert.match(main, new RegExp(`\\["${kind}",\\s*"${group}"`), `${kind} 应有独立的文件名分组`)
}

assert.match(main, /for \(const panelName of appearance\.panels\.keys\(\)\)/, "BDA 面板样式选项应直接来自 appearance.panels")
assert.match(main, /\["imageStyles",\s*"图片样式"[\s\S]*?\["textStyles",\s*"文字样式"[\s\S]*?\["colorStyles",\s*"颜色样式"/, "样式下拉菜单应提供图片、文字和颜色样式")
assert.doesNotMatch(main, /label: "图片样式"[\s\S]{0,180}?meta: "全部资源"/, "图片样式不应指向整个 appearanceConfig 资源入口")
assert.match(main, /decodedBdaAppearancePart/, "appearance 虚拟入口应只解析所选片段")
assert.match(main, /applyDecodedBdaAppearancePart/, "appearance 虚拟入口源码应双向写回")
assert.match(main, /renderBdaStyleResourceGallery/, "appearance 样式片段应渲染全部样式列表")
assert.match(main, /group: "资源配置",\s*label: "样式配置"[\s\S]{0,220}?path: bdaAppearanceStylePath\(selectedBdaStyleGroup\)[\s\S]{0,160}?navMode: "style"/, "BDA 样式配置应合并到资源配置并复用样式检查器")
assert.match(main, /resourceCategory\.replaceChildren\(\.\.\.bdaAppearanceStyleGroups\.map/, "BDA 样式配置应通过下拉菜单切换样式类型")
assert.match(main, /selectFile\(bdaAppearanceStylePath\(group\), "overview", "style"\)/, "切换 BDA 样式类型时应打开对应 appearance 样式片段")
assert.match(main, /bdaAppearancePart\(selectedPath\)/, "appearance 样式片段应参与属性检查器可用性判断")
assert.doesNotMatch(main, /inspectorTab = appearancePart\.kind === "styles" \? "source" : "properties"/, "样式片段不应强制打开源代码")
assert.match(main, /group: "资源配置",\s*label: "图片资源"[\s\S]*?navMode: "resource"/, "BDA 概览应提供图片资源入口")
assert.match(main, /group: "资源配置",\s*label: "声音资源"[\s\S]*?navMode: "sound"/, "BDA 概览应提供声音资源入口")
assert.match(main, /const bdaLayoutRank: Record<string, number> = \{[\s\S]*?"py_9": 0[\s\S]*?"py_26": 1[\s\S]*?"en_26": 2/, "BDA 面板应按常用性排序")
for (const [name, label] of [
  ["sym_26_en.ini", "英文 26 键符号"],
  ["voice.ini", "语音键盘"],
  ["dial.ini", "拨号键盘"],
  ["email.ini", "邮箱键盘"],
  ["net.ini", "网络键盘"],
  ["net_shifts.ini", "网络键盘 Shift"],
  ["sel_ch_h.ini", "中文选择栏（加高）"],
  ["sel_en_h.ini", "英文选择栏（加高）"],
  ["sym_26_cn_h.ini", "中文 26 键符号（加高）"],
  ["sym_26_en_h.ini", "英文 26 键符号（加高）"],
  ["symbol_h.ini", "符号面板（加高）"],
] as const) {
  assert.match(main, new RegExp(`"${name.replace(".", "\\.")}": \\{[^}]*label: "${label}"`), `${name} 应显示中文名称`)
}
assert.match(main, /\["皮肤信息", "资源配置", "面板样式"/, "BDA 资源配置应位于面板样式上方")
assert.doesNotMatch(main, /\? \["皮肤信息", "样式配置", "资源配置"/, "BDA 不应保留独立的样式配置分组")
assert.match(main, /const candidatePath = archive\.format === "bda" \? undefined : toolbarConfigPath\(\)/, "候选栏文件入口只应来自皮肤源码")
assert.doesNotMatch(main, /archive\.format !== "bda" \|\| isBdaVirtualTextPath\(candidatePath\)/, "BDA 不应把基础包 cand1.cnd 暴露为虚拟源码文件")
assert.match(main, /const panelName = path\.split\("\/"\)\.pop\(\)\?\.replace\(\/\\\.ini\$\/i, ""\)/, "BDA 检查器标题也不应泄露虚拟 ini 后缀")
assert.match(bda, /"sticker"\s*\|\s*"scene"/, "BDA 配置发现应覆盖 stickerConfig 和 sceneConfig")
assert.doesNotMatch(main, /group: "扩展配置"[\s\S]{0,240}bdaConfigPaths/, "BDA 配置不应继续放入扩展配置")

console.log("✓ BDA 概览按配置文件名分组")
