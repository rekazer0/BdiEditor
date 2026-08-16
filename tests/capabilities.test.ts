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

test("bundle identity stays stable across application updates", () => {
  const config = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8"))
  assert.equal(config.productName, "BdiEditor")
  assert.equal(config.identifier, "io.github.rekazer0.bdiedit")
  assert.doesNotMatch(config.productName, /\d+\.\d+\.\d+/)
})

test("macOS uses a transparent native frosted window background", () => {
  const config = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8"))
  assert.equal(config.app.macOSPrivateApi, true)
  assert.equal(config.app.windows[0].titleBarStyle, "Overlay")
  assert.equal(config.app.windows[0].transparent, true)
  assert.deepEqual(config.app.windows[0].backgroundColor, [0, 0, 0, 0])
  assert.deepEqual(config.app.windows[0].windowEffects.effects, ["sidebar"])
})

test("Windows uses a transparent system Acrylic material instead of exposing the desktop", () => {
  const config = JSON.parse(readFileSync("src-tauri/tauri.windows.conf.json", "utf8"))
  assert.equal(config.app.windows[0].transparent, true)
  assert.deepEqual(config.app.windows[0].windowEffects.effects, ["acrylic"])
})

test("native window material can be changed without restarting", () => {
  const rust = readFileSync("src-tauri/src/lib.rs", "utf8")
  assert.match(rust, /fn set_window_material\(window: tauri::WebviewWindow, enabled: bool\)/)
  assert.match(rust, /window\.set_effects\(None\)/)
  assert.match(rust, /Effect::Sidebar/)
  assert.match(rust, /Effect::Acrylic/)
  assert.match(rust, /set_window_material[\s\S]*?tauri::generate_handler!/)
})

test("Windows installer tolerates WebView2 already-existing after a missed detection", () => {
  const config = JSON.parse(readFileSync("src-tauri/tauri.windows.conf.json", "utf8"))
  assert.deepEqual(config.bundle.windows.webviewInstallMode, { type: "downloadBootstrapper" })
  assert.equal(config.bundle.windows.nsis.template, "./windows/installer.nsi")

  const template = readFileSync("src-tauri/windows/installer.nsi", "utf8")
  assert.match(template, /\$1 = -2147024713/)
})

test("Windows release entrypoint hides the console subsystem", () => {
  const entrypoint = readFileSync("src-tauri/src/main.rs", "utf8")
  assert.match(entrypoint, /#!\[cfg_attr\(not\(debug_assertions\), windows_subsystem = "windows"\)\]/)
})

test("tagged releases build and upload a signed Android APK", () => {
  const workflow = readFileSync(".github/workflows/release.yml", "utf8")
  assert.match(workflow, /build-android:/)
  assert.match(workflow, /android build --apk --ci/)
  assert.match(workflow, /ANDROID_KEYSTORE_BASE64/)
  assert.match(workflow, /gh release upload[\s\S]*android\.apk/)
})
