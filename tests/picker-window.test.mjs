import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const html = readFileSync(new URL("../picker.html", import.meta.url), "utf8")
const script = readFileSync(new URL("../src/picker-window.ts", import.meta.url), "utf8")
const main = readFileSync(new URL("../src/main.ts", import.meta.url), "utf8")

test("图片切片窗口把图片名居中，并在其上显示样式名", () => {
  assert.match(html, /<span id="picker-style" hidden><\/span>/)
  assert.match(script, /styleName\.textContent = payload\.styleName \?\? ""/)
  // 标题栏用网格把标题真正居中，左右两列留给返回与搜索。
  const css = readFileSync(new URL("../src/picker.css", import.meta.url), "utf8")
  assert.match(css, /body\[data-picker-mode="image"\] \.picker-toolbar \{\s*display: grid;\s*grid-template-columns: minmax\(0, 1fr\) auto minmax\(0, 1fr\);/)
  assert.match(script, /document\.body\.dataset\.pickerMode = mode/)
  assert.match(main, /styleName: imagePickerStyleName\(target\)/)
})

test("左侧返回项在切片窗口与全部样式列表之间切换", () => {
  assert.match(html, /<button id="picker-back"[\s\S]{0,400}全部样式/)
  assert.match(script, /if \(view === "image"\) showResourceList\(\)/)
  assert.match(script, /backLabel\.textContent = imagePayload \? "图片切片" : "全部样式"/)
  assert.match(script, /emitTo\("main", "image-picker-resources-request"\)/)
  assert.match(main, /listen\("image-picker-resources-request"/)
})

test("切片窗口不再提供右侧的选择图片资源按钮", () => {
  assert.doesNotMatch(html, /choose-resource/)
  assert.doesNotMatch(script, /choose-resource/)
  assert.doesNotMatch(main, /"resource-picker-open"/)
})
