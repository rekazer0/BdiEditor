import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const fidelity = readFileSync(new URL("../src/inspector-fidelity.css", import.meta.url), "utf8")
const penInspector = readFileSync(new URL("../src/pen-inspector.css", import.meta.url), "utf8")

test("section spacing skips a collapsed previous section", () => {
  // 分类轨同一时刻只显示一个分区，其余分区由 `display: none` 收起；
  // 相邻兄弟选择器仍然成立，会在这个被收起的分区之后补上 20px 间距，
  // 于是切到非首个分类时属性内容整体下移（面板 / 更多按钮之间看得到跳动）。
  assert.match(
    fidelity,
    /:is\(\.document-property-section, \.bda-inspector-section\):not\(\.mobile-inspector-managed:not\(\.mobile-inspector-active\)\)\s*\+\s*:is\(\.document-property-section, \.bda-inspector-section\)\s*\{\s*margin-top: 20px !important;/,
  )
  // 无条件给相邻分区加间距的老写法会让隐藏分区继续占位。
  assert.doesNotMatch(fidelity, /:is\(\.document-property-section, \.bda-inspector-section\)\s*\+\s*:is\(\.document-property-section, \.bda-inspector-section\)\s*\{/)
  // 被排除的正是分类轨收起的那一类分区，两个文件必须继续对得上。
  assert.match(
    penInspector,
    /\[data-inspector-group-display="grouped"\] \.mobile-inspector-managed:not\(\.mobile-inspector-active\) \{ display: none !important; \}/,
  )
})

test("a visible section keeps no leading margin", () => {
  // 兜底：即使相邻兄弟规则不再命中，分区本身也不能自带 margin-top。
  assert.match(
    readFileSync(new URL("../src/pen-inspector-panels.css", import.meta.url), "utf8"),
    /#document-fields\s*>\s*:is\(\.document-property-section, \.particle-property-section\)[\s\S]{0,200}?margin: 0 !important;/,
  )
})
