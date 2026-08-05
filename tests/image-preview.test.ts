import assert from "node:assert/strict"
import test from "node:test"
import { releaseImagePreviewURL, replaceImagePreviewURL } from "../src/image-preview.ts"

test("replaces and revokes the previous PNG preview URL", () => {
  const revoked: string[] = []
  const created: Blob[] = []
  const next = replaceImagePreviewURL(
    "blob:old",
    Uint8Array.from([137, 80, 78, 71]),
    (blob) => { created.push(blob); return "blob:new" },
    (url) => revoked.push(url),
  )
  assert.equal(next, "blob:new")
  assert.deepEqual(revoked, ["blob:old"])
  assert.equal(created[0].type, "image/png")
})

test("releases the active preview URL", () => {
  const revoked: string[] = []
  assert.equal(releaseImagePreviewURL("blob:active", (url) => revoked.push(url)), "")
  assert.deepEqual(revoked, ["blob:active"])
})
