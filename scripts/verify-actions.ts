import assert from "node:assert/strict"
import {
  actionDescription,
  knownFunctionCodes,
  previewPageTarget,
  previewPageTransition,
  previewStateTransitionFromAction,
  previewToggleStateFromAction,
} from "../src/actions.ts"

const expectedFunctionCodes = [
  1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17,
  21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32,
  36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56,
  61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80,
  81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 99,
].map((value) => `F${value}`)
assert.deepEqual(knownFunctionCodes, expectedFunctionCodes)
for (const code of expectedFunctionCodes) assert.match(actionDescription(code), /.+/)
assert.equal(knownFunctionCodes.includes("F2"), false)

const files = ["letters.ini", "numbers.ini", "symbols-custom.ini", "base.ini"]
const symbolFiles = ["py_26.ini", "symbol.ini", "sym_26_cn.ini"]
const namedSymbolFiles = ["py_26.ini", "num_9.ini", "num_symbol_cn26.ini"]

assert.equal(
  previewPageTarget("F1", "base.ini", "base.ini", files, "symbols-custom"),
  "symbols-custom.ini",
)
assert.equal(previewPageTarget("F6", "base.ini", "base.ini", files), "numbers.ini")
assert.equal(previewPageTarget("F16", "base.ini", "base.ini", files), "letters.ini")
assert.equal(previewPageTarget("Z+letters", "base.ini", "base.ini", files), "letters.ini")
assert.equal(previewPageTarget("Z+missing", "base.ini", "base.ini", files), undefined)
assert.equal(
  previewPageTarget("F1", "py_26.ini", "py_26.ini", namedSymbolFiles),
  "num_symbol_cn26.ini",
)
assert.equal(
  previewPageTarget("F90", "num_9.ini", "py_9.ini", namedSymbolFiles),
  "num_symbol_cn26.ini",
)
assert.equal(
  previewPageTarget("F90", "symbol.ini", "py_26.ini", symbolFiles, "sym_26_cn"),
  "sym_26_cn.ini",
  "F90 应进入 SYM_LAYOUT，而不是在两个符号文件之间互换",
)
assert.equal(
  previewPageTarget("F90", "sym_26_cn.ini", "py_26.ini", symbolFiles, "sym_26_cn"),
  "sym_26_cn.ini",
)
assert.equal(
  previewPageTarget("F91", "sym_26_cn.ini", "py_26.ini", symbolFiles, "sym_26_cn"),
  undefined,
)
assert.equal(
  previewToggleStateFromAction("F91"),
  38,
)
assert.equal(previewToggleStateFromAction("F90"), undefined)
assert.equal(previewToggleStateFromAction("S38"), undefined)
assert.equal(previewStateTransitionFromAction("F10"), 1)
assert.equal(previewStateTransitionFromAction("F10", 1), 2)
assert.equal(previewStateTransitionFromAction("F11"), 1)
assert.equal(previewStateTransitionFromAction("F11", 1), 2)
assert.equal(previewStateTransitionFromAction("F11", 2), null)
assert.equal(previewStateTransitionFromAction("F25"), 3)
assert.equal(previewStateTransitionFromAction("F25", 3), null)
assert.equal(previewStateTransitionFromAction("F27"), 6)
assert.equal(previewStateTransitionFromAction("F27", 6), null)

const entered = previewPageTransition("F6", "base.ini", "base.ini", files)
assert.deepEqual(entered, { target: "numbers.ini", returnName: "base.ini" })
assert.deepEqual(
  previewPageTransition("F6", "numbers.ini", entered.returnName, files),
  { target: "numbers.ini", returnName: "base.ini" },
)
assert.deepEqual(
  previewPageTransition("F4", "numbers.ini", entered.returnName, files),
  { target: "base.ini", returnName: "base.ini" },
)
assert.deepEqual(
  previewPageTransition("F91", "sym_26_cn.ini", "py_26.ini", symbolFiles, "sym_26_cn"),
  { target: undefined, returnName: "py_26.ini" },
)
assert.deepEqual(
  previewPageTransition("F90", "py_26.ini", "py_9.ini", symbolFiles, "sym_26_cn"),
  { target: "sym_26_cn.ini", returnName: "py_26.ini" },
  "F90 与 F1 一样进入临时符号页，F4 应能返回来源布局",
)

console.log("✓ 预览切页按实际布局文件解析，支持自定义名称并避免跳转到不存在文件")
