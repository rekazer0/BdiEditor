import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

test("desktop capability permits every dialog used by the editor", () => {
  const capability = JSON.parse(readFileSync("src-tauri/capabilities/default.json", "utf8"))
  assert.deepEqual(
    [...capability.permissions].filter((permission: string) => permission.startsWith("dialog:")),
    ["dialog:allow-open", "dialog:allow-save", "dialog:allow-message"],
  )
})

test("macOS bundle deployment floor supports the SF Symbols runtime API", () => {
  const config = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8"))
  assert.equal(config.bundle.macOS.minimumSystemVersion, "11.0")
})

test("Windows uses a transparent system Mica material instead of a black title frame", () => {
  const config = JSON.parse(readFileSync("src-tauri/tauri.windows.conf.json", "utf8"))
  assert.equal(config.app.windows[0].transparent, true)
  assert.deepEqual(config.app.windows[0].windowEffects.effects, ["mica"])
})
