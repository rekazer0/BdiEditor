// 检查器结构规范（DESIGN.md §10）：模式切换 → 对象头 → 可折叠分组 → 属性行；分类栏只做导航。
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { appSource } from "./helpers/app-source.mjs"

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
const html = read("index.html")
const shell = read("src/inspector-shell.ts")
const main = appSource()
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

test("sections collapse and remember it; edits can be reset from the rail", () => {
  assert.match(shell, /inspector-collapsed-sections/)
  assert.match(shell, /function resetAll/)
  assert.match(shell, /export function setInspectorKind/)
  assert.match(main, /setInspectorKind\(appState\.archive\?\.format === "bda" \? "bda" : appState\.archive \? "bds" : ""\)/)
})

test("the right rail: filter on top, groups with icon and label, edits count and reset at the bottom", () => {
  const rail = pane.slice(pane.indexOf('<aside class="inspector-rail"'), pane.indexOf("</aside>"))
  assert.ok(rail.indexOf("inspector-filter-open") < rail.indexOf('<nav id="mobile-inspector-groups"'), "筛选在分组之上")
  assert.match(pane, /id="inspector-filter"[^>]*aria-label="筛选属性"/)
  const css = read("src/inspector.css")
  assert.match(css, /\.source \.inspector-rail \{[^}]*position: sticky;[^}]*float: right;/)
  assert.match(read("src/app/mobile-layout.ts"), /button\.append\(groupIcon\(label\), text\)/)
  assert.match(shell, /rail\.append\(reset\)/)
  // 导航标签与分组标题同名
  for (const [, label, heading] of html.matchAll(/data-inspector-group-label="([^"]+)">\s*<h3>([^<]+)<\/h3>/g)) assert.equal(label, heading)
})

test("style references are one shared card: number and kind on the left, normal | pressed previews on the right", () => {
  assert.match(read("src/app/style-references.ts"), /meta\.className = "style-reference-meta"/)
  assert.match(read("src/bda-editor.ts"), /element\("span", "style-reference-meta"\)/)
  assert.match(read("src/inspector.css"), /:is\(\.style-reference-row, \.bda-style-reference-input\) \{/)
})

test("the text group picks one of the skin's font files as GLOBAL FONT_PATH", () => {
  assert.match(pane, /<select id="font-file-select"/)
  assert.match(read("src/app/key-inspector.ts"), /document\.set\("GLOBAL", "FONT_PATH", value\)/)
})

test("gestures form a cross: tap in the middle, swipes around it, long press below", () => {
  const css = read("src/inspector.css")
  assert.match(css, /grid-template-areas: "\. up \." "left center right" "\. down \." "hold hold hold";/)
  for (const gesture of ["CENTER", "HOLD", "UP", "DOWN", "LEFT", "RIGHT"]) assert.match(pane, new RegExp(`data-gesture="${gesture}"`))
})

test("filter, collapse-all, per-row revert and scrub handles live in the shared inspector shell", () => {
  assert.match(shell, /function applyFilter/)
  assert.match(shell, /data-filter-miss/)
  assert.match(shell, /toggleSection\(heading, \(event as MouseEvent \| KeyboardEvent\)\.altKey\)/)
  assert.match(shell, /function revertRow/)
  assert.match(shell, /className = "inspector-revert"/)
  assert.match(shell, /toggleAttribute\("data-scrub", Boolean\(scrubbableField\(handle\)\)\)/)
})
