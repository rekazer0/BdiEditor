import assert from "node:assert/strict"
import test from "node:test"
import { unsavedDecision } from "../src/unsaved.ts"

test("normalizes save, discard and cancel dialog results", () => {
  assert.equal(unsavedDecision("保存"), "save")
  assert.equal(unsavedDecision("Yes"), "save")
  assert.equal(unsavedDecision("不保存"), "discard")
  assert.equal(unsavedDecision("No"), "discard")
  assert.equal(unsavedDecision("取消"), "cancel")
  assert.equal(unsavedDecision("Cancel"), "cancel")
})
