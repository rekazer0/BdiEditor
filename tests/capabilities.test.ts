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

test("desktop capability permits dragging the custom titlebar while focused", () => {
  const capability = JSON.parse(readFileSync("src-tauri/capabilities/default.json", "utf8"))
  assert.ok(capability.permissions.includes("core:window:allow-start-dragging"))
})

test("macOS bundle deployment floor supports the SF Symbols runtime API", () => {
  const config = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8"))
  assert.equal(config.bundle.macOS.minimumSystemVersion, "11.0")
})

test("macOS uses a transparent native frosted window background", () => {
  const config = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8"))
  assert.equal(config.app.macOSPrivateApi, true)
  assert.equal(config.app.windows[0].titleBarStyle, "Overlay")
  assert.equal(config.app.windows[0].transparent, true)
  assert.deepEqual(config.app.windows[0].backgroundColor, [0, 0, 0, 0])
  assert.deepEqual(config.app.windows[0].windowEffects.effects, ["sidebar"])
})

test("Windows uses a transparent system Mica material instead of a black title frame", () => {
  const config = JSON.parse(readFileSync("src-tauri/tauri.windows.conf.json", "utf8"))
  assert.equal(config.app.windows[0].transparent, true)
  assert.deepEqual(config.app.windows[0].windowEffects.effects, ["mica"])
})
