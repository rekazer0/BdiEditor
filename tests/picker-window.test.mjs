import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const html = readFileSync(new URL("../picker.html", import.meta.url), "utf8")
const script = readFileSync(new URL("../src/picker-window.ts", import.meta.url), "utf8")
const css = readFileSync(new URL("../src/picker.css", import.meta.url), "utf8")
const main = readFileSync(new URL("../src/main.ts", import.meta.url), "utf8")

test("图片切片窗口把图片名居中，并在其上显示样式名", () => {
  assert.match(html, /<span id="picker-style" hidden><\/span>/)
  assert.match(script, /styleName\.textContent = payload\.styleName \?\? ""/)
  // 标题栏用网格把标题真正居中，左右两列留给返回与搜索。
  assert.match(css, /\.picker-toolbar \{\s*display: grid;\s*grid-template-columns: minmax\(0, 1fr\) auto minmax\(0, 1fr\);/)
  assert.match(main, /styleName: imagePickerStyleName\(target\)/)
})

test("左侧返回项在切片窗口与全部图片列表之间切换", () => {
  assert.match(html, /<button id="picker-back"[\s\S]{0,400}全部图片/)
  assert.match(script, /if \(view === "image"\) showResourceList\(\)/)
  assert.match(script, /backLabel\.textContent = "图片切片"/)
  assert.match(script, /emitTo\("main", "image-picker-resources-request"\)/)
  assert.match(main, /listen\("image-picker-resources-request"/)
})

test("全部图片列表复用现有窗口，不再新建资源窗口", () => {
  assert.doesNotMatch(main, /"resource-picker"/)
  assert.doesNotMatch(main, /picker\.html\?mode=/)
  assert.match(main, /function openImagePickerList\(\): void \{[\s\S]{0,220}showPickerWindow\("list"/)
  assert.match(main, /WebviewWindow\.getByLabel\("image-picker"\)/)
  assert.match(main, /emitTo\("image-picker", "image-picker-show-list"\)/)
  assert.match(script, /listen\("image-picker-show-list", \(\) => showResourceList\(\)\)/)
  // 列表项只上报选择，选完由主窗口决定是切图还是关窗。
  assert.doesNotMatch(script.replace(/.*event\.key === "Escape".*getCurrentWindow\(\)\.close\(\).*/, ""), /getCurrentWindow\(\)\.close\(\)/)
})

test("切片窗口不再提供右侧的选择图片资源按钮", () => {
  assert.doesNotMatch(html, /choose-resource/)
  assert.doesNotMatch(script, /choose-resource/)
  assert.doesNotMatch(main, /resource-picker-open/)
})

test("桌面端样式库在切片窗口内作为原生视图打开，切片返回直接切到全部样式", () => {
  assert.match(main, /if \(isTauri\(\)\) \{\s*void showPickerWindow\("styles", "全部样式"/)
  assert.match(main, /listen\("image-picker-back-styles", \(\) => void emitStyleLibrary\(true\)\)/)
  assert.match(main, /styleLibrary: Boolean\(stylePickerTarget\),/)
  assert.match(script, /listen<StyleLibraryPayload>\("style-library-data"/)
  assert.match(html, /<section id="style-library-view"/)
})

test("没有 TIL 切片时整张图可像切片一样选中，引用写成不带序号的图片名", () => {
  const canvas = readFileSync(new URL("../src/slice-picker-canvas.ts", import.meta.url), "utf8")
  assert.match(canvas, /slices\.length \? slices : \[\{ index: WHOLE_IMAGE_INDEX, source: \[0, 0, image\.naturalWidth, image\.naturalHeight\] \}\]/)
  assert.match(script, /tileSliceAt\(pickableSlices\(imagePayload\.slices, image\), point\)/)
  assert.match(main, /return index === WHOLE_IMAGE_INDEX \? name : `\$\{name\},\$\{index\}`/)
  // 底部说明栏已删除，画布区域铺满窗口。
  assert.doesNotMatch(html, /picker-meta/)
})
