import assert from "node:assert/strict"
import fs from "node:fs"
import { archiveCopyPaths, archivePathOptions } from "../src/panel-tools.ts"

const names = [
  "light/skin/port/a.ini",
  "light/skin/port/res/key.png",
  "dark/skin/port/b.ini",
]

assert.deepEqual(archivePathOptions(names), [
  "dark/",
  "dark/skin/",
  "dark/skin/port/",
  "dark/skin/port/b.ini",
  "light/",
  "light/skin/",
  "light/skin/port/",
  "light/skin/port/a.ini",
  "light/skin/port/res/",
  "light/skin/port/res/key.png",
])
assert.deepEqual(archiveCopyPaths(names, "light/skin/port/a.ini", "copies/a.ini"), [
  { source: "light/skin/port/a.ini", target: "copies/a.ini" },
])
assert.deepEqual(archiveCopyPaths(names, "light/skin/port/a.ini", "copies/"), [
  { source: "light/skin/port/a.ini", target: "copies/a.ini" },
])
assert.deepEqual(archiveCopyPaths(names, "light/skin/port/a.ini", "new-directory"), [
  { source: "light/skin/port/a.ini", target: "new-directory/a.ini" },
])
assert.deepEqual(archiveCopyPaths(names, "light/skin/port", "copies/port"), [
  { source: "light/skin/port/a.ini", target: "copies/port/a.ini" },
  { source: "light/skin/port/res/key.png", target: "copies/port/res/key.png" },
])
assert.throws(() => archiveCopyPaths(names, "missing", "copies"), /不存在/)
assert.throws(() => archiveCopyPaths(names, "../light", "copies"), /无效归档路径/)
assert.match(
  fs.readFileSync("index.html", "utf8"),
  /<button value="cancel" formnovalidate>取消<\/button><button class="primary" value="copy">复制<\/button>/,
  "面板复制的取消按钮必须绕过必填字段校验",
)

console.log("✓ 面板复制支持文件、目录、新目录与安全路径校验")
