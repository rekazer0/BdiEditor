import assert from "node:assert/strict"
import test from "node:test"
import { shouldClearMixedInput } from "../src/mixed-input.ts"

test("Delete and Backspace clear an enabled mixed inspector input", () => {
  assert.equal(shouldClearMixedInput("Delete", "混合", false), true)
  assert.equal(shouldClearMixedInput("Backspace", "混合", false), true)
})

test("ordinary and disabled inputs keep their existing keyboard behavior", () => {
  assert.equal(shouldClearMixedInput("Delete", "", false), false)
  assert.equal(shouldClearMixedInput("Enter", "混合", false), false)
  assert.equal(shouldClearMixedInput("Delete", "混合", true), false)
})
