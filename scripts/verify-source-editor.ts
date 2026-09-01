import assert from "node:assert/strict"
import fs from "node:fs"

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8")) as {
  dependencies?: Record<string, string>
}
const html = fs.readFileSync("index.html", "utf8")
const main = fs.readFileSync("src/main.ts", "utf8")
const editor = fs.readFileSync("src/source-editor.ts", "utf8")
const lazyEditor = fs.readFileSync("src/lazy-source-editor.ts", "utf8")
const style = fs.readFileSync("src/style.css", "utf8")
const tauri = JSON.parse(fs.readFileSync("src-tauri/tauri.conf.json", "utf8"))

assert.ok(packageJson.dependencies?.["@codemirror/view"], "源码编辑器应引入 CodeMirror 6")
assert.match(html, /<div id="source"[^>]*><\/div>/, "源码区应提供 CodeMirror 挂载节点")
assert.doesNotMatch(html, /id="source-highlight"|id="source-line-numbers"/, "源码区不应保留全文高亮覆盖层")
assert.match(editor, /class SourceCodeEditor/, "应通过独立适配器封装 CodeMirror")
assert.match(editor, /sourceCompletions\(/, "源码编辑器应使用区分键和值的语义补全")
assert.match(editor, /StreamLanguage\.define\(properties\)/, "BDS 和 BDI 源码应使用 INI 模式")
assert.match(editor, /language === "json" \? json\(\) : iniLanguage/, "BDA 解码源码应切换为 JSON 模式")
assert.match(editor, /EditorView\.decorations/, "源码选区和搜索应使用视口化装饰")
assert.match(editor, /Decoration\.line\(\{ class: "cm-source-selected" \}\)/, "源码业务选区应使用整行装饰")
assert.match(editor, /scrollIntoView/, "源码定位应交给 CodeMirror")
assert.match(editor, /collapseSelection\(\): void/, "取消按键选择应能折叠源码文字选区")
assert.match(editor, /commit\(\): void \{[\s\S]*?dispatchEvent\(new Event\("change"\)\)/, "源码编辑器应能在导航前显式提交待处理修改")
assert.match(lazyEditor, /import\("\.\/source-editor\.ts"\)/, "轻量代理应按需加载 CodeMirror 适配器")
assert.match(main, /import \{ LazySourceCodeEditor \} from "\.\/lazy-source-editor\.ts"/, "主界面应只静态引入轻量源码代理")
assert.match(main, /new LazySourceCodeEditor/, "主界面应初始化轻量源码代理")
assert.match(main, /source\.load\(\)/, "源码面板显示时应加载 CodeMirror")
assert.doesNotMatch(main, /import \{ SourceCodeEditor \} from "\.\/source-editor\.ts"/, "主入口不应静态包含 CodeMirror")
assert.doesNotMatch(main, /sourceHighlight\.innerHTML|sourceLineNumbers\.textContent/, "主界面不应重建全文源码 DOM")
assert.match(
  main,
  /import \{[^}]*\bsourceValueRanges\b[^}]*\} from "\.\/source-value-ranges\.ts"/,
  "值提示应复用独立解析器",
)
assert.doesNotMatch(html, /settings-switch" hidden><span>源代码(?:补全|值解析|当前行)/, "源码辅助设置应在设置界面可见")
assert.match(html, /<dialog id="style-image-dialog"/, "点击源码样式预览应使用原生模态弹窗")
assert.match(html, /<input id="source-color-picker"[^>]*type="color"/, "点击源码颜色应提供专用颜色调节器")
assert.match(editor, /anchor: \{ left: bounds\.left, bottom: bounds\.bottom \}/, "源码值点击事件应携带被点击值的位置")
assert.match(main, /sourceColorPicker\.style\.left[\s\S]*sourceColorPicker\.style\.top[\s\S]*sourceColorPicker\.showPicker\(\)/, "源码颜色调节器应先锚定到被点击值再打开")
assert.doesNotMatch(style, /\.source-color-picker\s*\{[^}]*\b(?:right|bottom):/, "源码颜色调节器不应固定在窗口右下角")
assert.match(html, /id="style-image-more"[\s\S]{0,300}data-system-symbol="square\.grid\.2x2"/, "样式预览应提供更多样式图标")
assert.match(html, /id="style-image-gallery"[^>]*aria-label="全部样式"/, "样式预览应包含可扩展的全部样式区域")
assert.match(main, /styleImageDialog\.showModal\(\)/, "样式预览应通过模态 API 打开")
assert.match(
  main,
  /detail\.kind === "color"\) openSourceColorPicker\(detail\)[\s\S]*else if \(detail\.kind === "style"\) openSourceStylePreview\(detail\)/,
  "源码颜色与样式点击应分别进入颜色调节器和样式预览",
)
assert.match(main, /styleImageMore\.addEventListener\("click", toggleStyleImageGallery\)/, "更多样式图标应切换扩展视图")
assert.match(main, /button\.addEventListener\("click", \(\) => showSourceStylePreview\(styleID\)\)/, "点击全部样式卡片应回到对应样式预览")
assert.match(style, /\.style-image-dialog::backdrop/, "样式预览弹窗应提供新版遮罩层")
assert.doesNotMatch(
  style,
  /\.style-image-dialog\s*\{[^}]*\b(?:top|right):/,
  "样式预览弹窗不应沿用右上角固定浮层布局",
)
assert.match(
  tauri.app.security.csp,
  /style-src[^;]*'unsafe-inline'/,
  "打包版应允许 CodeMirror 注入运行时基础样式",
)

console.log("✓ CodeMirror 源码编辑器集成契约验证通过")
