import assert from "node:assert/strict"
import fs from "node:fs"
import { inspectorGroupPositionPercent } from "../src/inspector-groups.ts"
import { IniDocument } from "../src/ini.ts"
import { resolveStylePropertyLayers } from "../src/style-properties.ts"

assert.equal(
  inspectorGroupPositionPercent(120, 0, 600, 200, -90),
  35,
  "从分组栏顶部拖动时，分组栏中心应与鼠标保持原始距离",
)

assert.equal(
  inspectorGroupPositionPercent(-100, 0, 600, 200, -90),
  100 / 600 * 100,
  "分组栏不应被拖出检查器顶部",
)

const css = fs.readFileSync("src/style.css", "utf8")
const main = fs.readFileSync("src/main.ts", "utf8")
const html = fs.readFileSync("index.html", "utf8")
const styleLayers = resolveStylePropertyLayers(IniDocument.parse(`
[STYLE16]
SHOW=H
[STYLE32]
SHOW=&
`), "16,32", "SHOW")
assert.deepEqual(styleLayers, [
  { section: "STYLE16", value: "H" },
  { section: "STYLE32", value: "&" },
], "属性检查器应分别解析 FORE_STYLE 每一层的 CSS 显示内容")
assert.match(html, /id="primary-css-fields"/, "常用分组应包含 CSS 属性容器")
assert.match(main, /来自 CSS · \$\{source\.section\}/, "CSS 属性应注明来源样式")
assert.match(
  css,
  /#quick-inspector:has\(> #mobile-inspector-groups\[hidden\]\):not\(\[hidden\]\) \{\s*grid-template-columns:\s*minmax\(0, 1fr\);/,
  "移动端分组栏隐藏后不应保留右侧空列",
)
assert.match(
  css,
  /#quick-inspector:has\(> #mobile-inspector-groups\[hidden\]\):not\(\[hidden\]\) \{\s*padding-right:\s*13px;/,
  "桌面端分组栏隐藏后不应保留右侧空白",
)
assert.match(
  css,
  /@media \(min-width: 761px\)[\s\S]*?#quick-inspector\[data-inspector-group-display="grouped"\]:not\(\[hidden\]\) \{\s*display:\s*grid;/,
  "桌面端分组模式应保留网格高度约束，使属性内容可以滚动",
)
assert.match(
  css,
  /@media \(min-width: 761px\)[\s\S]*?#mobile-inspector-groups \{[\s\S]*?grid-row:\s*1;[\s\S]*?align-self:\s*start;/,
  "桌面端分组栏应固定在分组网格的可见行内，避免高度塌缩",
)
assert.doesNotMatch(
  css,
  /@media \(max-width: 1060px\)[\s\S]*?\.source\s*\{\s*display:\s*none;/,
  "窄桌面窗口不应隐藏右侧属性检查器",
)
assert.match(
  css,
  /@media \(max-width: 1060px\)[\s\S]*?main\s*\{\s*grid-template-columns:\s*190px minmax\(0, 1fr\) 4px min\(var\(--inspector-width, 340px\), 40vw\);/,
  "窄桌面窗口应收缩画布和检查器，避免右侧属性检查器溢出视口",
)
assert.match(css, /#quick-inspector,[\s\S]*?touch-action:\s*pan-y;[\s\S]*?-webkit-overflow-scrolling:\s*touch;/)
assert.doesNotMatch(main, /mainWorkspace\.setPointerCapture\(/, "移动面板切换不应预先抢占属性区纵向滚动")
assert.match(main, /Math\.abs\(deltaY\) > 12 && Math\.abs\(deltaY\) > Math\.abs\(deltaX\)/)
assert.match(html, /appearance-visual-styles[\s\S]*appearance-layout-fields[\s\S]*appearance-typography-fields[\s\S]*appearance-sound-field/, "样式检查器应按视觉、排布、文字和音效分组")
assert.match(main, /\["colors", "状态颜色"[\s\S]*\["typography", "字体"[\s\S]*\["content", "内容与说明"[\s\S]*\["advanced", "边框与扩展"/, "样式资源属性应按用途分组")
assert.match(css, /\.style-detail-group-fields \{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/, "样式属性分组内部应保留紧凑双列")
assert.match(css, /@container \(max-width: 520px\)[\s\S]*?#style-detail-fields \{\s*grid-template-columns:\s*minmax\(0, 1fr\);/, "窄检查器中的样式属性分组应折成单列")
assert.match(css, /\.appearance-reference-grid \{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\);/, "背景和前景样式引用应各占一行")
assert.doesNotMatch(css, /\.key-appearance-fields \.style-reference-input > input,[\s\S]*?height:\s*62px;/, "BDI、BDS 按键样式预览应复用 BDA 的通用高度")
assert.match(css, /\.style-picker-trigger \{[\s\S]*?height:\s*92px;/, "BDA、BDI、BDS 样式预览应统一使用通用高度")
assert.match(main, /item\.dataset\.styleState = highlighted \? "highlighted" : "normal"/, "正常与按下缩略图应为独立点击目标")
assert.match(main, /openStyleReferenceStateImage\(input, key, highlighted\)/, "两个状态应分别编辑 NM_IMG 与 HL_IMG")
assert.match(css, /\.key-appearance-fields \.style-reference-input\.sound-style-reference > input,[\s\S]*?height:\s*36px;/, "按键音效引用不应占用视觉预览高度")

console.log("✓ 检查器分组栏布局正常，属性区纵向滚动不被面板手势抢占")
