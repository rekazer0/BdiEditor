import assert from "node:assert/strict"
import test from "node:test"
import { previewPageTarget } from "../src/actions.ts"

test("preview page resolves explicit and supported keyboard actions", () => {
  assert.equal(previewPageTarget("Z+num2", "py_9.ini", "py_9.ini"), "num2.ini")
  assert.equal(previewPageTarget("F6", "py_9.ini", "py_9.ini"), "num_9.ini")
  assert.equal(previewPageTarget("F6", "num_9.ini", "py_9.ini"), "py_9.ini")
  assert.equal(previewPageTarget("F1", "py_26.ini", "py_26.ini"), "symbol.ini")
  assert.equal(previewPageTarget("F4", "symbol.ini", "py_26.ini"), "py_26.ini")
  assert.equal(previewPageTarget("F16", "py_9.ini", "py_9.ini"), "en_26.ini")
  assert.equal(previewPageTarget("F15", "en_26.ini", "py_9.ini"), "py_9.ini")
  assert.equal(previewPageTarget("F99", "py_9.ini", "py_9.ini"), undefined)
})
