import assert from "node:assert/strict"
import fs from "node:fs"
import { inspectorGroupPositionPercent } from "../src/inspector-groups.ts"

assert.equal(
  inspectorGroupPositionPercent(120, 0, 600, 200, -90),
  35,
  "从分组栏顶部拖动时，分组栏中心应与鼠标保持原始距离",
)

assert.equal(
  inspectorGroupPositionPercent(-100, 0, 600, 200, -90),
  100 / 600 * 100,
  "分组栏不应被拖出检查器顶部",
)

const css = fs.readFileSync("src/style.css", "utf8")
assert.match(
  css,
  /#quick-inspector:has\(> #mobile-inspector-groups\[hidden\]\):not\(\[hidden\]\) \{\s*grid-template-columns:\s*minmax\(0, 1fr\);/,
  "移动端分组栏隐藏后不应保留右侧空列",
)
assert.match(
  css,
  /#quick-inspector:has\(> #mobile-inspector-groups\[hidden\]\):not\(\[hidden\]\) \{\s*padding-right:\s*13px;/,
  "桌面端分组栏隐藏后不应保留右侧空白",
)

console.log("✓ 检查器分组栏拖动正常，隐藏后属性区占满宽度")
