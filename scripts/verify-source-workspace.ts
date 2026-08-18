import assert from "node:assert/strict"
import fs from "node:fs"
import { SkinArchive } from "../src/skin.ts"

for (const path of ["public/default-template.bds", "public/default-template.bda"]) {
  const archive = SkinArchive.open(fs.readFileSync(path))
  const reopened = SkinArchive.fromSourceFiles(archive.sourceFiles())
  assert.equal(reopened.format, archive.format, `${path} 源码往返后格式应保持不变`)
  const names = archive.names().filter((name) => !name.endsWith("/"))
  assert.deepEqual(reopened.names().filter((name) => !name.endsWith("/")), names, `${path} 源码往返后文件路径应保持不变`)
  for (const name of names) {
    assert.deepEqual(reopened.getBytes(name), archive.getBytes(name), `${path}: ${name} 内容应保持不变`)
  }
}

const bda = SkinArchive.open(fs.readFileSync("public/default-template.bda"))
const raw = bda.sourceFiles().find((file) => /appearanceConfig$/.test(file.path))?.path
assert.ok(raw, "BDA 应包含 appearanceConfig 源码")
const canonical = bda.canonicalSourcePath(raw)
assert.equal(bda.sourcePath(canonical), raw, "BDA 原始路径与编辑路径应双向映射")

const darkDirectory = SkinArchive.fromSourceFiles([
  { path: "dark/land/py_26.ini", data: new Uint8Array() },
])
assert.equal(darkDirectory.format, "bds", "dark 子目录补全主题前缀后应识别为双主题源码结构")
assert.ok(darkDirectory.names().includes("dark/skin/land/py_26.ini"))

const html = fs.readFileSync("index.html", "utf8")
assert.match(html, /<button id="open" class="toolbar-button"[^>]*>/)
assert.doesNotMatch(html, /open-menu|open-source-folder/)
assert.match(html, /id="source-directory"/)
console.log("✓ 源码工作区格式、路径映射与 UI 入口验证通过")
