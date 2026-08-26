import assert from "node:assert/strict"
import fs from "node:fs"

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8")) as {
  dependencies?: Record<string, string>
}
const html = fs.readFileSync("index.html", "utf8")
const main = fs.readFileSync("src/main.ts", "utf8")
const editor = fs.readFileSync("src/source-editor.ts", "utf8")

assert.ok(packageJson.dependencies?.["@codemirror/view"], "源码编辑器应引入 CodeMirror 6")
assert.match(html, /<div id="source"[^>]*><\/div>/, "源码区应提供 CodeMirror 挂载节点")
assert.doesNotMatch(html, /id="source-highlight"|id="source-line-numbers"/, "源码区不应保留全文高亮覆盖层")
assert.match(editor, /class SourceCodeEditor/, "应通过独立适配器封装 CodeMirror")
assert.match(editor, /StreamLanguage\.define\(properties\)/, "BDS 和 BDI 源码应使用 INI 模式")
assert.match(editor, /language === "json" \? json\(\) : iniLanguage/, "BDA 解码源码应切换为 JSON 模式")
assert.match(editor, /EditorView\.decorations/, "源码选区和搜索应使用视口化装饰")
assert.match(editor, /scrollIntoView/, "源码定位应交给 CodeMirror")
assert.match(editor, /commit\(\): void \{[\s\S]*?dispatchEvent\(new Event\("change"\)\)/, "源码编辑器应能在导航前显式提交待处理修改")
assert.match(main, /new SourceCodeEditor/, "主界面应初始化 CodeMirror 适配器")
assert.doesNotMatch(main, /sourceHighlight\.innerHTML|sourceLineNumbers\.textContent/, "主界面不应重建全文源码 DOM")

console.log("✓ CodeMirror 源码编辑器集成契约验证通过")
