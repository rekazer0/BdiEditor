import assert from "node:assert/strict"
import test from "node:test"
import { candidatePreview, compositionBeforeCaret, insertText } from "../src/simulation.ts"

test("inserts at the current selection and leaves the caret after inserted text", () => {
  assert.deepEqual(insertText("abcd", 2, 2, "X"), { value: "abXcd", caret: 3 })
  assert.deepEqual(insertText("abcd", 1, 3, "XY"), { value: "aXYd", caret: 3 })
})

test("clamps stale selection offsets", () => {
  assert.deepEqual(insertText("abc", 99, 99, "!"), { value: "abc!", caret: 4 })
})

test("deletes the selection or one complete character before the caret", async () => {
  const module = await import("../src/simulation.ts") as typeof import("../src/simulation.ts") & {
    deleteBackward?: (value: string, start: number, end: number) => { value: string; caret: number }
  }
  assert.equal(typeof module.deleteBackward, "function")
  assert.deepEqual(module.deleteBackward?.("abcd", 1, 3), { value: "ad", caret: 1 })
  assert.deepEqual(module.deleteBackward?.("a😀b", 3, 3), { value: "ab", caret: 1 })
  assert.deepEqual(module.deleteBackward?.("abc", 0, 0), { value: "abc", caret: 0 })
})

test("switches the keyboard candidate area from toolbar to composing state", async () => {
  const module = await import("../src/simulation.ts") as typeof import("../src/simulation.ts") & {
    candidatePreview?: (value: string) => { composing: boolean; input: string; candidates: string[] }
  }
  assert.equal(typeof module.candidatePreview, "function")
  assert.deepEqual(module.candidatePreview?.("", 0, "zh"), { composing: false, input: "", candidates: [] })
  assert.deepEqual(module.candidatePreview?.("ni'hao", 6, "zh"), {
    composing: true,
    input: "ni'hao",
    candidates: ["你好", "不会", "不回", "不好", "你会"],
  })
})

test("uses only the Latin composition immediately before the caret", () => {
  assert.equal(compositionBeforeCaret("前文 ni'hao 后文", 9), "ni'hao")
  assert.equal(compositionBeforeCaret("ni'hao，", 7), "")
  assert.equal(compositionBeforeCaret("hello!", 6), "")
})

test("English layouts never show Chinese simulated candidates", () => {
  assert.deepEqual(candidatePreview("hello", 5, "en"), {
    composing: true,
    input: "hello",
    candidates: ["hello"],
  })
  assert.deepEqual(candidatePreview("hello!", 6, "en"), {
    composing: false,
    input: "",
    candidates: [],
  })
})
