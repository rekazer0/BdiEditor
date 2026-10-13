// 检查器结构规范（DESIGN.md §10）：模式切换 → 对象头 → 可折叠分组 → 属性行；分类栏只做导航。
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
const html = read("index.html")
const shell = read("src/inspector-shell.ts")
const main = read("src/main.ts")
const pane = html.slice(html.indexOf('<section class="source">'), html.indexOf('<div id="resource-inspector"'))

test("pane header: segmented mode switch above the object header", () => {
  const tabs = pane.indexOf('class="inspector-tabs ui-segmented"')
  const title = pane.indexOf('class="inspector-title key-inspector-title"')
  assert.ok(tabs > 0 && title > tabs, "模式切换在对象头之上")
  for (const tab of ["properties", "source", "ai"]) assert.match(pane, new RegExp(`data-inspector-tab="${tab}"`))
})

test("object-level actions live in the object header, pointer modes on the canvas toolbar", () => {
  const actions = pane.slice(pane.indexOf("inspector-object-actions"), pane.indexOf('<div id="quick-inspector"'))
  for (const action of ["copy", "swap", "delete"]) assert.match(actions, new RegExp(`data-key-action="${action}"`))
  assert.doesNotMatch(pane, /data-key-mode=/, "选择 / 移动属于画布工具栏")
  const toolbar = html.slice(html.indexOf('class="preview-toolbar-start"'), html.indexOf('class="preview-toolbar-end"'))
  assert.match(toolbar, /data-key-mode="select"/)
  assert.match(toolbar, /data-key-mode="move"/)
})

test("properties are flat sections of rows inside one form scope", () => {
  assert.match(pane, /<div id="quick-inspector" class="ui-form" hidden>/)
  assert.doesNotMatch(pane, /inspector-card|appearance-section-heading|inspector-padding-box/, "不再使用卡片套卡片")
  assert.doesNotMatch(pane, /<svg\b/)
  for (const group of ["key-layout-fields", "key-appearance-fields", "key-typography-fields", "key-gesture-fields"]) {
    assert.match(pane, new RegExp(`<section class="inspector-group key-only ${group}"[^>]*>\\s*<h3>`))
  }
})

test("batch arrange tools only exist for multi-selection", () => {
  assert.match(pane, /id="inspector-multi-layout"[^>]*hidden/)
  assert.match(main, /multiLayout\.hidden = !multiAvailable/)
})

test("the category rail only navigates: there is no grouped display mode", () => {
  assert.doesNotMatch(html, /inspector-grouped-display/)
  assert.doesNotMatch(main, /inspectorGroupedDisplay/)
})

test("sections collapse and remember it; edits can be reset from the object header", () => {
  assert.match(shell, /inspector-collapsed-sections/)
  assert.match(shell, /function resetAll/)
  assert.match(shell, /export function setInspectorKind/)
  assert.match(main, /setInspectorKind\(archive\?\.format === "bda" \? "bda" : archive \? "bds" : ""\)/)
})
