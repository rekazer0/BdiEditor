import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { IniDocument } from "../src/ini.ts"
import { SkinArchive } from "../src/skin.ts"

function zipMethod(bytes: Uint8Array, path: string): number | undefined {
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let end = bytes.length - 22
  while (end >= 0 && data.getUint32(end, true) !== 0x06054b50) end -= 1
  if (end < 0) return
  const count = data.getUint16(end + 10, true)
  let offset = data.getUint32(end + 16, true)
  const decoder = new TextDecoder()
  for (let index = 0; index < count; index += 1) {
    const nameLength = data.getUint16(offset + 28, true)
    const extraLength = data.getUint16(offset + 30, true)
    const commentLength = data.getUint16(offset + 32, true)
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength))
    if (name === path) return data.getUint16(offset + 10, true)
    offset += 46 + nameLength + extraLength + commentLength
  }
}

const additive = SkinArchive.fromSourceFiles([
  { path: "Info.txt", data: new TextEncoder().encode("Name=test") },
  { path: "port/gen.ini", data: new TextEncoder().encode("[PANEL]\nSIZE=1,1") },
  { path: "res/base.png", data: new Uint8Array([1]) },
])
assert.equal(zipMethod(additive.toBytes(), "Info.txt"), 0)
additive.setBytes("light/skin/res/added.png", new Uint8Array([2]))
const additiveBytes = additive.toBytes()
assert.equal(zipMethod(additiveBytes, "Info.txt"), 0, "新增资源不应重压缩原 ZIP 条目")
assert.deepEqual(SkinArchive.open(additiveBytes).getBytes("light/skin/res/added.png"), new Uint8Array([2]))

const paths = process.argv.slice(2)
if (!paths.length) throw new Error("用法：npm run verify:samples -- <皮肤.bdi> [皮肤.bds]")

for (const path of paths) {
  const original = SkinArchive.open(readFileSync(path))
  const names = original.names()
  assert(names.length > 0, `${path}: 空皮肤`)
  const pristine = new Map(names.map((name) => [name, original.getBytes(name)]))

  const themes = ["light", "dark"].filter((theme) =>
    names.some((name) => name.startsWith(`${theme}/skin/`)),
  )
  assert(themes.length > 0, `${path}: 缺少浅色或深色主题`)
  for (const theme of themes) {
    for (const orientation of ["port", "land"]) {
      assert(
        names.includes(`${theme}/skin/${orientation}/py_9.ini`),
        `${path}: 缺少 ${theme}/${orientation}/九键`,
      )
      assert(
        names.includes(`${theme}/skin/${orientation}/py_26.ini`),
        `${path}: 缺少 ${theme}/${orientation}/26键`,
      )
    }
  }

  const editedPath = `${themes[0]}/skin/port/py_9.ini`
  const layout = IniDocument.parse(original.getText(editedPath))
  layout.set("KEY1", "VIEW_RECT", "12,15,224,160")
  layout.set("KEY1", "SHOW", "W")
  layout.set("KEY1", "CENTER", "q")
  original.setText(editedPath, layout.toString())

  const stylePath = [`${themes[0]}/skin/port/res/default.css`, `${themes[0]}/skin/res/default.css`].find(
    (path) => names.includes(path),
  )!
  assert(stylePath, `${path}: 缺少按键样式配置`)
  const styles = IniDocument.parse(original.getText(stylePath))
  styles.set("STYLE7", "FONT_SIZE", "46")
  styles.set("STYLE7", "NM_COLOR", "cc102030")
  original.setText(stylePath, styles.toString())

  const pngPaths = names.filter((name) => name.toLowerCase().endsWith(".png"))
  assert(pngPaths.length >= 2, `${path}: PNG 资源不足`)
  const replacedImagePath = pngPaths[0]
  const replacementBytes = original.getBytes(pngPaths[1])!
  original.setBytes(replacedImagePath, replacementBytes)

  const reopened = SkinArchive.open(original.toBytes())
  assert.deepEqual(reopened.names(), names)
  assert.equal(reopened.getText(editedPath), layout.toString())
  assert.equal(reopened.getText(stylePath), styles.toString())
  assert.deepEqual(reopened.getBytes(replacedImagePath), replacementBytes)
  const edited = new Set([editedPath, stylePath, replacedImagePath])
  for (const name of names) {
    if (!edited.has(name)) assert.deepEqual(reopened.getBytes(name), pristine.get(name))
  }
  console.log(
    `✓ ${path}: ${names.length} files, 9/26 × ${themes.join("+")} × port/land, layout/action/style/PNG round-trip`,
  )
}
