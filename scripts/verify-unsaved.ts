import assert from "node:assert/strict"
import { unsavedDecision } from "../src/unsaved.ts"

assert.equal(unsavedDecision("save"), "save")
assert.equal(unsavedDecision("discard"), "discard")
assert.equal(unsavedDecision("cancel"), "cancel")
assert.equal(unsavedDecision("Yes"), "save")
assert.equal(unsavedDecision("No"), "discard")

console.log("✓ Web 与 Tauri 的未保存选择使用同一决策映射")
