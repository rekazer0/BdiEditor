import assert from "node:assert/strict"

Object.assign(globalThis, { window: {} })

const { diagnosticError, sanitizeDiagnosticText } = await import("../src/client-log.ts")

assert.equal(sanitizeDiagnosticText("open /Users/alice/private/skin.bdi failed"), "open [path]/skin.bdi failed")
assert.equal(sanitizeDiagnosticText("content://secret/document/42"), "content://[redacted]")
const failure = diagnosticError(new Error("parse /Users/alice/private/skin.bdi"))
assert.equal(failure.message, "parse [path]/skin.bdi")
assert(!JSON.stringify(failure).includes("/Users/alice/private"))

console.log("client logging checks passed")
