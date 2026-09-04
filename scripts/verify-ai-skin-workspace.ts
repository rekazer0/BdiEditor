import assert from "node:assert/strict"
import { AiSkinWorkspace, type AiSkinEditableFile } from "../src/ai-skin-workspace.ts"

const files: AiSkinEditableFile[] = [
  {
    path: "light/skin/port/py_9.ini",
    syntax: "ini",
    text: "[GLOBAL]\nNAME=demo\n\n[KEY1]\nSHOW=1\nCOLOR=#ffffff\n",
  },
  {
    path: "light/skin/port/appearanceConfig",
    syntax: "json",
    text: JSON.stringify({ designWidth: 1080, colorStyles: { 1: { normalColor: "#ffffff" } } }, null, 2),
  },
]

const workspace = new AiSkinWorkspace(files, {
  maxChangedFiles: 2,
  maxMutations: 4,
  maxReadChars: 24,
  maxTotalChars: 10_000,
})

assert.deepEqual(workspace.listFiles(), [
  { path: "light/skin/port/appearanceConfig", syntax: "json", chars: files[1].text.length },
  { path: "light/skin/port/py_9.ini", syntax: "ini", chars: files[0].text.length },
])

const partial = workspace.readFile("light/skin/port/py_9.ini", 0, 1_000)
assert.equal(partial.text.length, 24)
assert.equal(partial.truncated, true)
assert.throws(() => workspace.readFile("../Info.txt"), /不允许访问/)

assert.equal(workspace.setIniValue("light/skin/port/py_9.ini", "KEY1", "SHOW", "A"), "updated")
assert.equal(workspace.setIniValue("light/skin/port/py_9.ini", "KEY1", "FONT_SIZE", "42"), "created")
const editedIni = Array.from({ length: 4 }, (_, index) =>
  workspace.readFile("light/skin/port/py_9.ini", index * 24, 24).text,
).join("")
assert.match(editedIni, /FONT_SIZE=42/)
assert.throws(
  () => workspace.setIniValue("light/skin/port/appearanceConfig", "KEY1", "SHOW", "x"),
  /INI 配置/,
)
assert.throws(
  () => workspace.setIniValue("light/skin/port/py_9.ini", "MISSING", "SHOW", "x"),
  /配置节不存在/,
)

assert.equal(workspace.removeIniValue("light/skin/port/py_9.ini", "KEY1", "COLOR"), true)
workspace.readFile("light/skin/port/appearanceConfig")
assert.equal(
  workspace.replaceText(
    "light/skin/port/appearanceConfig",
    '"normalColor": "#ffffff"',
    '"normalColor": "#202124"',
  ),
  1,
)
assert.throws(
  () => workspace.replaceText("light/skin/port/appearanceConfig", '"designWidth": 1080', "not-json"),
  /JSON/,
)
assert.throws(
  () => workspace.replaceText("light/skin/port/appearanceConfig", "", "anything"),
  /不能为空/,
)

const changes = workspace.changes()
assert.equal(changes.length, 2)
assert.equal(changes[0].path, "light/skin/port/py_9.ini")
assert.equal(changes[1].path, "light/skin/port/appearanceConfig")
assert.equal(changes[0].before, files[0].text)
assert.notEqual(changes[0].after, changes[0].before)

assert.throws(
  () => workspace.setIniValue("light/skin/port/py_9.ini", "KEY1", "EXTRA", "1"),
  /修改次数上限/,
)

const tiny = new AiSkinWorkspace(files, { maxChangedFiles: 1 })
assert.throws(
  () => tiny.setIniValue("light/skin/port/py_9.ini", "KEY1", "SHOW", "B"),
  /先读取文件/,
)
tiny.readFile("light/skin/port/py_9.ini")
tiny.setIniValue("light/skin/port/py_9.ini", "KEY1", "SHOW", "B")
tiny.readFile("light/skin/port/appearanceConfig")
assert.throws(
  () => tiny.replaceText(
    "light/skin/port/appearanceConfig",
    '"normalColor": "#ffffff"',
    '"normalColor": "#000000"',
  ),
  /文件数量上限/,
)

assert.throws(
  () => new AiSkinWorkspace([{ path: "../outside.ini", syntax: "ini", text: "A=1\n" }]),
  /路径无效/,
)

console.log("✓ AI 皮肤工作区限制路径、读取和单轮修改配额")
