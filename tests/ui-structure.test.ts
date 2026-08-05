import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8")
const css = readFileSync(new URL("../src/style.css", import.meta.url), "utf8")
const main = readFileSync(new URL("../src/main.ts", import.meta.url), "utf8")
const preview = readFileSync(new URL("../src/preview.ts", import.meta.url), "utf8")

test("new project command opens an accessible built-in template chooser", () => {
  assert.match(
    html,
    /<button id="new"[^>]*title="新建项目"[^>]*aria-label="新建项目"[\s\S]*?<span>新建项目<\/span>/,
  )
  const dialog = html.slice(
    html.indexOf('<dialog id="new-project-dialog"'),
    html.indexOf("</dialog>", html.indexOf('<dialog id="new-project-dialog"')) + 9,
  )
  assert.match(dialog, /<h2[^>]*>新建项目<\/h2>/)
  assert.match(dialog, /name="project-template"[^>]*value="default-ios"[^>]*checked/)
  assert.match(dialog, /value="cancel"/)
  assert.match(dialog, /value="create"/)
  assert.match(main, /newProjectDialog\.showModal\(\)/)
  assert.match(main, /loadBuiltInProjectTemplate\(templateID\)/)
})

test("visible static editor chrome declares the requested system symbols", () => {
  for (const name of [
    "plus",
    "folder",
    "square.and.arrow.down",
    "arrow.uturn.backward",
    "arrow.uturn.forward",
    "ellipsis",
    "keyboard",
    "cellularbars",
    "wifi",
    "battery.100",
    "chevron.left",
    "square.and.arrow.up",
    "checkmark",
    "globe",
    "mic",
  ]) {
    assert.match(html, new RegExp(`data-system-symbol="${name.replaceAll(".", "\\.")}"`))
  }
})

test("static and dynamic system symbol elements are decorative and retain inline SVG fallbacks", () => {
  const staticSymbols = html.match(/<span\b[^>]*data-system-symbol="[^"]+"[^>]*>/g) ?? []
  assert.ok(staticSymbols.length > 0)
  for (const symbol of staticSymbols) assert.match(symbol, /aria-hidden="true"/)
  assert.equal(
    (html.match(/class="system-symbol-fallback"/g) ?? []).length,
    staticSymbols.length,
  )
  assert.match(main, /symbol\.dataset\.systemSymbol = name/)
  assert.match(main, /symbol\.ariaHidden = "true"/)
  assert.match(main, /createElementNS\([^\n]+"svg"\)/)
})

test("native system symbol PNG masks are cached by name and hide browser fallbacks", () => {
  assert.match(main, /new Map<string, Promise<string>>\(\)/)
  assert.match(main, /systemSymbolURLs\.get\(name\)/)
  assert.match(main, /invoke<number\[\]>\("sf_symbol", \{ name \}\)/)
  assert.match(main, /URL\.createObjectURL\(new Blob/)
  assert.match(main, /style\.maskImage = `url\("\$\{url\}"\)`/)
  assert.match(main, /classList\.add\("system-symbol-native"\)/)
  assert.match(css, /\.system-symbol-native\s*\{[^}]*background:\s*currentColor/s)
  assert.match(css, /\.system-symbol-native \.system-symbol-fallback\s*\{[^}]*display:\s*none/s)
})

test("source tree assigns semantic system symbols to navigation, folders, and file kinds", () => {
  assert.match(main, /"nav-overview":\s*"info\.circle"/)
  assert.match(main, /"nav-layout":\s*"keyboard"/)
  assert.match(main, /"nav-component":\s*"square\.grid\.2x2"/)
  assert.match(main, /"nav-style":\s*"paintpalette"/)
  assert.match(main, /createSystemSymbol\("folder"\)/)
  assert.match(main, /archive\?\.isText\(path\)\s*\?\s*"doc\.text"/s)
  assert.match(main, /archive\?\.isImage\(path\)\s*\?\s*"photo"/s)
  assert.match(main, /:\s*"doc"/)
})

test("editor UI uses PingFang while source and skin preview fonts stay specialized", () => {
  assert.match(css, /:root\s*\{\s*font-family:\s*"PingFang SC",/s)
  assert.match(css, /#source,\s*#source-highlight\s*\{[^}]*ui-monospace/s)
  assert.match(main, /style\.fontFamily = canvasFontFamily\(/)
})

test("form inputs inherit the editor font while the source editor stays monospace", () => {
  const formControls = css.match(/button,\s*input,\s*select,\s*textarea\s*\{[^}]+\}/s)?.[0] ?? ""
  const inspectorInput = css.match(/\.inspector-grid input\s*\{[^}]+\}/s)?.[0] ?? ""
  const sourceEditor = css.match(/#source,\s*#source-highlight\s*\{[^}]+\}/s)?.[0] ?? ""

  assert.match(formControls, /font:\s*inherit/)
  assert.doesNotMatch(inspectorInput, /ui-monospace/)
  assert.match(sourceEditor, /ui-monospace/)
})

test("placeholder icon glyphs are absent from editor chrome and CSS", () => {
  for (const placeholder of ["•••", "⌨", "▧", "◇", "◐", "◎", "● ᯤ ▰", "↶　↷", "⇧　•••", "‹"]) {
    assert.doesNotMatch(`${html}\n${css}`, new RegExp(placeholder))
  }
})

test("preview toolbar defaults to a canvas shell without zoom controls", () => {
  const toolbar = html.slice(
    html.indexOf('<div class="preview-toolbar">'),
    html.indexOf('<div class="canvas-wrap empty">'),
  )

  assert.ok(toolbar.indexOf('id="device"') < toolbar.indexOf('data-orientation-choice="port"'))
  assert.ok(toolbar.indexOf('data-orientation-choice="port"') < toolbar.indexOf('data-theme-choice="light"'))
  assert.match(toolbar, /data-orientation-choice="port"[^>]*>竖屏/)
  assert.match(toolbar, /data-orientation-choice="land"[^>]*>横屏/)
  assert.match(toolbar, /data-theme-choice="light"[^>]*>浅色/)
  assert.match(toolbar, /data-theme-choice="dark"[^>]*>深色/)
  assert.match(html, /<option value="canvas" selected>画布<\/option>/)
  assert.doesNotMatch(html, /id="zoom-(?:out|in)"|id="zoom-value"/)
  assert.doesNotMatch(main, /applyZoom|stepZoom|clampZoom|--preview-zoom/)
  assert.doesNotMatch(css, /zoom:\s*var\(--preview-zoom\)/)
  assert.match(html, /id="device-shell" class="device-shell canvas-only" data-device="canvas"/)
  const titlebar = css.match(/\.titlebar\s*\{[^}]+\}/s)?.[0] ?? ""
  assert.match(titlebar, /padding:\s*6px 12px/)
  assert.doesNotMatch(html, /data-skin-field="Authors"/)
})

test("layout remains hidden state while preview controls replace inspector layout controls", () => {
  assert.match(html, /<select id="orientation" hidden>/)
  assert.match(html, /<select id="theme" hidden>/)
  assert.match(html, /<select id="layout" hidden>/)
  assert.doesNotMatch(html, /id="layout-context"/)
  assert.doesNotMatch(html, /data-layout-choice/)
  assert.match(main, /addNavButton\(\s*files,\s*"9键",/s)
})

test("phone keyboard surface clips its translucent material to rounded corners", () => {
  const dockRule = css.match(/\.keyboard-dock\s*\{[^}]+\}/s)?.[0] ?? ""
  assert.match(dockRule, /border-radius:/)
})

test("phone keyboard keeps transparent toolbar and canvas over a stable translucent dock", () => {
  const dockRule = css.match(/\.keyboard-dock\s*\{[^}]+\}/s)?.[0] ?? ""
  const toolbarRule = css.match(/#toolbar-strip\s*\{[^}]+\}/s)?.[0] ?? ""
  const canvasRule = css.match(/(?:^|\n)canvas\s*\{[^}]+\}/s)?.[0] ?? ""
  const darkScreenRule = css.match(/\.device-shell\[data-theme="dark"\] \.device-screen\s*\{[^}]+\}/s)?.[0] ?? ""

  assert.match(toolbarRule, /background:\s*transparent/)
  assert.match(canvasRule, /background:\s*transparent/)
  assert.match(dockRule, /background:\s*rgb\(209 212 218 \/ 62%\)/)
  assert.doesNotMatch(dockRule, /(?:-webkit-)?backdrop-filter:/)
  assert.match(dockRule, /box-shadow:\s*inset 0 1px 0 rgb\(255 255 255 \/ 46%\)/)
  assert.match(darkScreenRule, /#2c2c30/)
  assert.doesNotMatch(darkScreenRule, /#101012/)
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
