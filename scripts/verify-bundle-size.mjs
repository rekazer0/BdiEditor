import fs from "node:fs"
import { gzipSync } from "node:zlib"

const manifest = JSON.parse(fs.readFileSync("dist/.vite/manifest.json", "utf8"))
const main = manifest["index.html"]
const editor = manifest["src/source-editor.ts"]
if (!main?.file || !editor?.file || !editor.isDynamicEntry) {
  throw new Error("构建产物未将 CodeMirror 生成为动态 chunk")
}
if (!main.dynamicImports?.includes("src/source-editor.ts")) {
  throw new Error("主入口未通过动态导入加载 CodeMirror")
}

const bytes = fs.readFileSync(`dist/${main.file}`)
const gzipBytes = gzipSync(bytes)
if (bytes.length > 400 * 1024 || gzipBytes.length > 130 * 1024) {
  throw new Error(`主包超过限制：${(bytes.length / 1024).toFixed(2)} KiB / ${(gzipBytes.length / 1024).toFixed(2)} KiB gzip`)
}

console.log(`✓ 主包 ${(bytes.length / 1024).toFixed(2)} KiB / ${(gzipBytes.length / 1024).toFixed(2)} KiB gzip，CodeMirror 已懒加载`)
