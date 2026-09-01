import assert from "node:assert/strict"
import fs from "node:fs"

const manifest = JSON.parse(fs.readFileSync("dist/.vite/manifest.json", "utf8"))
const entry = manifest["index.html"]
assert.ok(entry?.file, "构建清单应包含主页面入口")
assert.ok(
  entry.dynamicImports?.includes("src/source-editor.ts"),
  "源码编辑器应作为主页面的动态入口",
)

const entryBytes = fs.statSync(`dist/${entry.file}`).size
assert.ok(entryBytes < 500 * 1024, `主页面入口过大：${(entryBytes / 1024).toFixed(1)} KiB`)

const editor = manifest["src/source-editor.ts"]
assert.ok(editor?.isDynamicEntry && editor.file, "构建清单应包含独立的源码编辑器 chunk")

console.log(`✓ 主入口 ${(entryBytes / 1024).toFixed(1)} KiB，CodeMirror 已延迟加载`)
