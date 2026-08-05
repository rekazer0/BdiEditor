import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8")
const css = readFileSync(new URL("../src/style.css", import.meta.url), "utf8")
const main = readFileSync(new URL("../src/main.ts", import.meta.url), "utf8")
const preview = readFileSync(new URL("../src/preview.ts", import.meta.url), "utf8")

test("phone preview contains recognizable globe and microphone system icons", () => {
  assert.match(html, /data-system-icon="globe"/)
  assert.match(html, /data-system-icon="microphone"/)
})

test("phone keyboard surface clips its translucent content to rounded corners", () => {
  const dockRule = css.match(/\.keyboard-dock\s*\{[^}]+\}/s)?.[0] ?? ""
  assert.match(dockRule, /border-radius:/)
  assert.match(dockRule, /backdrop-filter:/)
})

test("transparent candidate preview is not painted by a native button", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8")
  assert.match(html, /<div id="toolbar-strip"[^>]*><canvas id="toolbar-preview"/)
  assert.doesNotMatch(html, /<button id="toolbar-strip"/)
})

test("typing updates simulation state without rebuilding the complete skin preview", () => {
  assert.match(main, /simulatedOutput\.addEventListener\("input", refreshSimulationState\)/)
  assert.doesNotMatch(main, /simulatedOutput\.addEventListener\("input", \(\) => refreshPreview\(\)\)/)
})

test("toolbar availability is invalidated before lightweight typing refreshes", () => {
  assert.match(
    main,
    /if \(!archive \|\| !path \|\| !archive\.isText\(path\)\) \{\s*delete toolbarStrip\.dataset\.path\s*toolbarStrip\.hidden = true/s,
  )
})

test("a full preview refresh shares one atlas resolver with the toolbar", () => {
  assert.match(main, /const resolver = new AtlasResolver\(archive, theme\.value, orientation\.value\)/)
  assert.match(main, /refreshToolbarPreview\(composing, resolver\)/)
  assert.match(main, /preview\.setResolver\(resolver\)/)
  assert.doesNotMatch(main, /function refreshToolbarPreview[\s\S]*?toolbarPreview\.setResolver\(new AtlasResolver/)
})

test("export menu exposes direct readable iOS and Android actions", () => {
  assert.match(html, /data-export-format="bdi"[^>]*>[^<]*导出 iOS 皮肤/)
  assert.match(html, /data-export-format="bds"[^>]*>[^<]*导出 Android 皮肤/)
  assert.doesNotMatch(html, /id="export-format"/)
  assert.doesNotMatch(html, /id="save-as"/)
  assert.match(main, /saveNative\(true, format\)/)
  assert.match(main, /saveNative\(false, currentExportFormat\(\)\)/)
})

test("default template is built in and cannot be replaced from the interface", () => {
  assert.doesNotMatch(html, /id="set-default"/)
  assert.doesNotMatch(main, /defaultTemplate|setDefaultTemplate|setDefaultButton|browserTemplate/)
  assert.match(main, /fetch\("\/default-template\.bdi"\)/)
})

test("inspector contains previews for resolved background and foreground styles", () => {
  assert.match(html, /data-style-preview="back:normal"/)
  assert.match(html, /data-style-preview="back:highlighted"/)
  assert.match(html, /data-style-preview="fore:normal"/)
  assert.match(html, /data-style-preview="fore:highlighted"/)
  assert.equal((html.match(/data-style-preview="[^"]+"[^>]*>\s*<canvas/g) ?? []).length, 4)
  assert.match(css, /\.style-preview-button\s*\{[^}]*width:\s*36px/s)
})

test("candidate DOM and key canvas apply the merged skin font family and weight", () => {
  assert.match(main, /candidateInput\.style\.fontFamily/)
  assert.match(main, /candidateInput\.style\.fontWeight/)
  assert.match(main, /candidateWords\.style\.fontFamily/)
  assert.match(main, /candidateWords\.style\.fontWeight/)
  assert.match(preview, /textVisual\?\.fontWeight/)
})

test("compound foreground inspector exposes weight and writes each property to its resolved source", () => {
  assert.match(html, /data-style-field="FONT_WEIGHT"/)
  assert.match(main, /resolveStylePropertySources/)
  assert.match(main, /for \(const section of new Set\(context\.sources\.map\(\(source\) => source\.section\)\)\)/)
})
