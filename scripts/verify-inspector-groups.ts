import assert from "node:assert/strict"
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

console.log("✓ 检查器分组栏拖动保持鼠标抓取位置")
