import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8")
const css = readFileSync(new URL("../src/style.css", import.meta.url), "utf8")
const main = readFileSync(new URL("../src/main.ts", import.meta.url), "utf8")
const ios26 = readFileSync(new URL("../src/ios26.ts", import.meta.url), "utf8")
const preview = readFileSync(new URL("../src/preview.ts", import.meta.url), "utf8")
const vite = readFileSync(new URL("../vite.config.ts", import.meta.url), "utf8")
const pickerHtml = readFileSync(new URL("../picker.html", import.meta.url), "utf8")
const pickerMain = readFileSync(new URL("../src/picker-window.ts", import.meta.url), "utf8")
const pickerCss = readFileSync(new URL("../src/picker.css", import.meta.url), "utf8")
const capabilities = readFileSync(new URL("../src-tauri/capabilities/default.json", import.meta.url), "utf8")

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
  assert.match(dialog, /name="project-template"[^>]*value="default-android"[^>]*checked/)
  assert.match(dialog, /百度官方 Android BDA 默认皮肤/)
  assert.match(dialog, /value="official-android-bds"/)
  assert.equal((dialog.match(/name="project-template"/g) ?? []).length, 7)
  assert.match(dialog, /内置皮肤为互联网搜集整理，仅限技术交流请勿用于商业用途。如有侵权请联系作者下架。/)
  for (const [id, label] of [
    ["oppo-swipe-down", "OPPO皮肤加下滑功能"],
    ["oppo-dual-color", "OPPO默认双色皮肤"],
    ["iqoo-rounded-black", "IQOO提取圆角黑色"],
    ["xiaomi-unified-rounded-blur", "小米默认皮肤\\(统一颜色键盘版3\\)_适配圆角模糊"],
    ["huawei-swipe-symbols-1080", "华为提取上滑符号1080"],
  ] as const) {
    assert.match(dialog, new RegExp(`value="${id}"`))
    assert.match(dialog, new RegExp(label))
  }
  assert.doesNotMatch(dialog, /imitation-ios-15|dust-|仿ios|尘埃/)
  assert.match(dialog, /value="cancel"/)
  assert.match(dialog, /value="create"/)
  assert.match(main, /newProjectDialog\.showModal\(\)/)
  assert.match(main, /loadBuiltInProjectTemplate\(templateID\)/)
})

test("visible static editor chrome declares the requested system symbols", () => {
  for (const name of [
    "plus",
    "folder",
    "externaldrive",
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
    (html.match(/class="system-symbol-fallback"/g) ?? []).length +
      (html.match(/class="system-symbol"[^>]*data-system-symbol="magnifyingglass"/g) ?? []).length,
    staticSymbols.length,
  )
  assert.match(main, /symbol\.dataset\.systemSymbol = name/)
  assert.match(main, /symbol\.ariaHidden = "true"/)
  assert.match(main, /createElementNS\([^\n]+"svg"\)/)
})

test("system symbols remain inline SVG so they render at the display resolution", () => {
  assert.doesNotMatch(main, /invoke<number\[\]>\("sf_symbol"/)
  assert.doesNotMatch(main, /systemSymbolURLs/)
  assert.doesNotMatch(css, /\.system-symbol-native/)
})

test("source tree assigns semantic system symbols to navigation, folders, and file kinds", () => {
  assert.match(main, /"nav-overview":\s*"info\.circle"/)
  assert.match(main, /"nav-layout":\s*"keyboard"/)
  assert.match(main, /"nav-component":\s*"square\.grid\.2x2"/)
  assert.match(main, /"nav-style":\s*"paintpalette"/)
  assert.match(main, /createSystemSymbol\("folder"\)/)
  assert.match(main, /archive\?\.isText\(path\) \|\| archive\?\.isBdaConfig\(path\)\s*\?\s*"doc\.text"/s)
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

test("preview canvas provides mouse-wheel and button zoom controls", () => {
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
  assert.doesNotMatch(html, /iphone-15-pro/)
  assert.match(html, /id="preview-zoom-out"/)
  assert.match(html, /id="preview-zoom-fit"/)
  assert.match(html, /id="preview-zoom-in"/)
  assert.match(main, /event\.metaKey \|\| event\.ctrlKey/)
  assert.match(main, /function applyPreviewZoom\(value: number, anchor\?: \{ x: number; y: number \}\)/)
  assert.match(main, /anchor\.x - \(after\.left \+ anchorX \* after\.width\)/)
  assert.match(main, /event\.key !== " "/)
  assert.match(main, /canvasWrap\.setPointerCapture\(event\.pointerId\)/)
  assert.match(main, /previewPanStart\.panX \+ event\.clientX - previewPanStart\.x/)
  assert.match(main, /const renderedWidth = width \* previewZoom/)
  assert.match(main, /scale\(\$\{device\.value === "canvas" \? 1 : previewZoom\}\)/)
  assert.doesNotMatch(main, /phoneFitSize/)
  assert.match(html, /id="device-shell" class="device-shell canvas-only" data-device="canvas"/)
  assert.match(css, /\.device-shell\s*\{[^}]*place-self:\s*safe center/s)
  assert.match(css, /\.canvas-wrap\.preview-pan-ready\s*\{[^}]*cursor:\s*grab/s)
  const titlebar = css.match(/\.titlebar\s*\{[^}]+\}/s)?.[0] ?? ""
  assert.match(titlebar, /padding:\s*6px 12px/)
  assert.doesNotMatch(html, /data-skin-field="Authors"/)
})

test("iPhone preview uses per-model physical frame geometry", () => {
  assert.match(main, /const frame = spec\.frame/)
  assert.match(main, /frame\.width/)
  assert.match(main, /--device-screen-inset-x/)
  assert.match(main, /--device-island-width/)
  assert.match(main, /const bodyRadius = frame\.width \* 0\.26/)
  assert.match(main, /bodyRadius \/ frame\.width \* 100}% \/ \$\{bodyRadius \/ frame\.height \* 100}%/)
  assert.doesNotMatch(main, /--device-body-radius[^\n]+shortUnit/)
  assert.match(css, /\.device-shell\[data-family="iphone"\][\s\S]*?corner-shape:\s*squircle/)
  assert.doesNotMatch(css, /data-device="iphone-15-pro"/)
})

test("iPhone editing chrome follows the native Notes composition", () => {
  assert.match(html, /class="phone-editing-toolbar"/)
  assert.match(html, /data-system-symbol="list\.bullet"/)
  assert.match(html, /data-system-symbol="paperclip"/)
  assert.match(css, /\.device-status\s*\{[^}]*font-size:\s*11px/s)
  assert.match(css, /\.phone-nav-round,[\s\S]*?width:\s*32px/s)
  assert.match(css, /\.phone-editing-toolbar\s*\{[^}]*border-radius:\s*999px/s)
})

test("layout remains hidden state while preview controls replace inspector layout controls", () => {
  assert.match(html, /<select id="orientation" hidden>/)
  assert.match(html, /<select id="theme" hidden>/)
  assert.match(html, /<select id="layout" hidden>/)
  assert.doesNotMatch(html, /id="layout-context"/)
  assert.doesNotMatch(html, /data-layout-choice/)
  assert.match(main, /"py_9\.ini": \{ group: "键盘布局"/)
  assert.match(main, /"py_26\.ini": \{ group: "键盘布局"/)
})

test("desktop editor grid keeps the inspector beside the workspace", () => {
  const editor = html.slice(html.indexOf("<main>"), html.indexOf("</main>") + 7)
  assert.match(
    editor,
    /<aside class="sidebar">[\s\S]*?<section class="workspace">[\s\S]*?<div class="inspector-resize-handle"[\s\S]*?<section class="source">/,
  )
  assert.match(
    css,
    /main\s*\{[^}]*grid-template-columns:\s*220px minmax\(500px, 1fr\) 4px var\(--inspector-width, 340px\)/s,
  )
  assert.match(
    css,
    /@media \(max-width: 1060px\)[\s\S]*?\.inspector-resize-handle,\s*\.source\s*\{[^}]*display:\s*none/s,
  )
  assert.match(
    css,
    /@media \(max-width: 600px\)[\s\S]*?main\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)[\s\S]*?aside\s*\{[^}]*display:\s*none/s,
  )
  assert.match(main, /classList\.toggle\("macos", isTauri\(\) && navigator\.userAgent\.includes\("Macintosh"\)\)/)
})

test("single-theme skins keep missing theme choices available for creation", () => {
  assert.doesNotMatch(main, /button\.disabled = Boolean\(archive\).*button\.dataset\.themeChoice/s)
  assert.match(main, /if \(!availableThemes\.includes\(theme\.value\)\)[^\n]+\n\s*syncSegmentedControls\(\)/)
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

test("canvas typing preserves the scaled candidate row height", () => {
  assert.match(css, /\.device-shell\.canvas-only #candidate-area:has\(#candidate-composition:not\(\[hidden\]\)\)\s*\{[^}]*height:\s*var\(--toolbar-viewport-height, 133px\)[^}]*grid-template-rows:\s*40fr 93fr/s)
})

test("toolbar availability is invalidated before lightweight typing refreshes", () => {
  assert.match(
    main,
    /const document = path \? textDocument\(path\) : undefined\s*if \(!archive \|\| !path \|\| !document\) \{\s*delete toolbarStrip\.dataset\.path\s*toolbarStrip\.hidden = true/s,
  )
})

test("BDA candidate toolbar reads its virtual official configuration", () => {
  assert.match(main, /const source = archive\.format === "bda" \? bdaBase : archive/)
  assert.match(main, /const document = path \? textDocument\(path\) : undefined/)
})

test("a full preview refresh shares one format-aware resolver with the toolbar", () => {
  assert.match(main, /const resolver = visualResolver\(\)/)
  assert.match(main, /refreshToolbarPreview\(composing, resolver\)/)
  assert.match(main, /preview\.setResolver\(resolver\)/)
  assert.doesNotMatch(main, /function refreshToolbarPreview[\s\S]*?toolbarPreview\.setResolver\(new AtlasResolver/)
})

test("legacy LIST defaults and candidate geometry reach the existing preview surfaces", () => {
  assert.match(main, /preview\.setDefaults\(context\?\.gen \?\? bdaGen\)/)
  assert.match(main, /toolbarPreview\.setDefaults\(gen\)/)
  for (const property of ["--candidate-padding", "--candidate-first-gap", "--candidate-cell-width", "--candidate-more-width"]) {
    assert.match(main, new RegExp(`setProperty\\("${property}"`))
    assert.match(css, new RegExp(`var\\(${property}`))
  }
})

test("device preview preserves resolved candidate geometry across formats", () => {
  assert.match(main, /resolvePanelConfig\(layoutDocument,\s*context\.gen,\s*context\.styles\)/)
  assert.match(main, /function applyDeviceKeyboardGeometry\(/)
  assert.match(
    main,
    /applyDeviceKeyboardGeometry\(config\.width, config\.height, toolbarSize\?\.height \?\? 0, composing\)/,
  )
  assert.match(
    main,
    /applyDeviceKeyboardGeometry\(panelWidth, panelHeight, toolbarSize\?\.height \?\? 0, composing\)/,
  )
  assert.match(
    main,
    /if \(!spec[^)]*\) \{\s*for \(const property of deviceGeometryProperties\) deviceShell\.style\.removeProperty\(property\)/s,
  )
  assert.match(main, /updateDevicePreview\(\)\s*syncSegmentedControls\(\)\s*refreshPreview\(\)/s)
  assert.match(
    css,
    /\.device-shell\[data-accessories="hidden"\] \.keyboard-accessories\s*\{[^}]*display:\s*none/s,
  )
})

test("export menu exposes direct readable BDI, BDS and BDA actions", () => {
  assert.match(html, /data-export-format="bdi"[^>]*>[^<]*导出 iOS 皮肤/)
  assert.match(html, /data-export-format="bds"[^>]*>[^<]*导出 Android 皮肤/)
  assert.match(html, /data-export-format="bda"[^>]*>[^<]*导出新版 Android 皮肤/)
  assert.doesNotMatch(html, /id="export-format"/)
  assert.doesNotMatch(html, /id="save-as"/)
  assert.match(main, /saveArchive\(true, format\)/)
  assert.match(main, /saveArchive\(false, currentExportFormat\(\)\)/)
})

test("BDA exports reuse one conversion path without disabling BDI or BDS", () => {
  assert.match(main, /import \{ convertBdaArchive \} from "\.\/bda-convert\.ts"/)
  assert.match(main, /function exportArchive\(format: ExportFormat\)/)
  assert.match(main, /convertBdaArchive\(archive, bdaBase\)/)
  assert.doesNotMatch(main, /archive\.format === "bda" \? format !== "bda"/)
})

test("BDA overview derives layouts and special configs from the actual archive", () => {
  assert.match(main, /bdaLayoutNames\(appearanceBytes\)/)
  assert.match(main, /\["animation", "序列帧动画"\]/)
  assert.match(main, /bdaConfigPath\(archive, theme\.value, orientation\.value, kind\)/)
  assert.doesNotMatch(main, /const layoutNames = archive\.format === "bda" \? bdaBase\?\.names\(\)/)
})

test("BDA animation frames have a minimal native inspector", () => {
  assert.match(html, /class="inspector-group bda-config-fields" hidden/)
  assert.match(html, /id="bda-config-fields"/)
  assert.match(main, /decodeBdaAnimation\(/)
  assert.match(main, /updateBdaAnimationFrame\(/)
})

test("BDA files are accepted by browser and native open flows", () => {
  assert.match(html, /accept="[^"]*\.bda/)
  assert.match(main, /extensions: \["bdi", "bds", "bda", "zip"\]/)
})

test("toolbar configurations expose parsed inspector fields", () => {
  assert.match(html, /class="inspector-group toolbar-fields" hidden/)
  for (const field of ["VIEW_RECT", "BACK_STYLE", "FORE_STYLE", "PADDING", "FIRST_FORE", "FIRST_BACK", "ICON1.FORE_STYLE", "ICON2.FORE_STYLE", "ICON3.FORE_STYLE"]) {
    assert.match(html, new RegExp(`data-toolbar-field="${field.replace(".", "\\.")}"`))
  }
  assert.match(main, /isToolbarPath\(selectedPath\)/)
  assert.match(main, /selectedDocument\?\.get\(key \? section : "CAND"/)
  assert.match(main, /field\.addEventListener\("change", \(\) => updateToolbar\(field\)\)/)
  assert.match(main, /candidateArea\.addEventListener\("click"/)
})

test("color controls preserve ARGB alpha while using native color inputs", () => {
  assert.equal((html.match(/data-color-picker-for=/g) ?? []).length, 2)
  assert.equal((html.match(/data-color-alpha-for=/g) ?? []).length, 2)
  assert.match(main, /alpha\.value = String\(Number\.parseInt\(hex\.slice\(0, 2\), 16\) \/ 255\)/)
  assert.match(main, /field\.value = `\$\{Math\.round\(Math\.max\(0, Math\.min\(1, alphaValue\)\) \* 255\)/)
  assert.match(main, /syncColorControl\(field\)/)
  assert.doesNotMatch(main, /colorDialog\.showModal\(\)/)
  assert.equal((html.match(/class="color-pair-field"/g) ?? []).length, 1)
  assert.match(css, /\.color-pair-field\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/s)
  assert.match(css, /\.color-control\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) 28px/s)
  assert.match(css, /\.color-control input\[type="color"\]\s*\{[^}]*width:\s*28px[^}]*height:\s*28px/s)
})

test("image slice picker remains available for style resource editing", () => {
  assert.doesNotMatch(html, /data-image-preview=/)
  assert.match(main, /new WebviewWindow\(label,/)
  assert.match(main, /showPickerWindow\("image-picker", "image", "图片切片"/)
  assert.match(pickerHtml, /id="picker-canvas"/)
  assert.match(pickerHtml, /href="\/src\/picker\.css"/)
  assert.match(capabilities, /"image-picker"/)
})

test("selected key source is highlighted only in the source view", () => {
  assert.doesNotMatch(html, /id="selected-key-source"/)
  assert.match(main, /highlightIni\(source\.value, selectedSourceSections\(\)\)/)
})

test("export moved left and more menu opens settings and about dialogs", () => {
  assert.match(html, /data-app-dialog="settings"/)
  assert.match(html, /data-app-dialog="about"/)
  assert.match(html, /id="settings-dialog"/)
  assert.match(html, /id="about-dialog"/)
  assert.match(main, /dialog\.showModal\(\)/)
  assert.match(html, /https:\/\/github\.com\/rekazer0\/BdiEditor/)
})

test("image and resource pickers are peer native windows", () => {
  const showPicker = main.slice(main.indexOf("async function showPickerWindow"), main.indexOf("function openResourcePickerWindow"))
  assert.match(main, /showPickerWindow\("image-picker", "image"/)
  assert.match(main, /showPickerWindow\("resource-picker", "resource"/)
  assert.match(showPicker, /url: `picker\.html\?mode=\$\{mode\}`/)
  assert.doesNotMatch(showPicker, /parent:/)
  assert.match(pickerMain, /emitTo\("main", "resource-picker-open"\)/)
  assert.match(pickerMain, /emitTo\("main", "resource-picker-select"/)
})

test("export menu stays above the workspace and source cursor uses matching font metrics", () => {
  const titlebar = css.match(/\.titlebar\s*\{[^}]+\}/s)?.[0] ?? ""
  const menu = css.match(/\.toolbar-menu\s*\{[^}]+\}/s)?.[0] ?? ""
  assert.match(titlebar, /z-index:\s*20/)
  assert.match(menu, /z-index:\s*100/)
  assert.match(menu, /background:\s*var\(--menu\)/)
  assert.match(css, /--menu:\s*rgb\(255 255 255 \/ 92%\)/)
  assert.match(css, /#source-highlight code\s*\{[^}]*font:\s*inherit/s)
  assert.doesNotMatch(css, /\.token-section\s*\{[^}]*font-weight/s)
})

test("default template is built in and cannot be replaced from the interface", () => {
  assert.doesNotMatch(html, /id="set-default"/)
  assert.doesNotMatch(main, /defaultTemplate|setDefaultTemplate|setDefaultButton|browserTemplate/)
})

test("inspector removes duplicate normal and pressed preview pairs", () => {
  assert.doesNotMatch(html, /data-style-preview=/)
  assert.doesNotMatch(html, /style-preview-pair/)
  assert.doesNotMatch(main, /processedPreviewVisuals|fallbackBackgroundStyleID/)
})

test("interaction preview starts a press instead of returning after selection", () => {
  assert.doesNotMatch(preview, /this\.mode === "edit" \|\| !this\.selected\.has\(key\.section\)/)
  assert.match(preview, /this\.active = \{\s*key,/)
})

test("Shift selects the complete key range from the anchor", () => {
  assert.match(preview, /event\.shiftKey && this\.selectionAnchor/)
  assert.match(preview, /sections\.slice\(Math\.min\(from, to\), Math\.max\(from, to\) \+ 1\)/)
})

test("clicking an already selected key in edit mode deselects it", () => {
  assert.match(preview, /\} else if \(this\.mode === "edit" && this\.editTool === "select"\) \{\s*this\.selected\.delete\(key\.section\)/s)
})

test("panel tools disable in interactive preview mode", () => {
  assert.match(main, /panelScaleButton\.disabled = !editing \|\| fileOperationRunning \|\| !archive/)
  assert.match(main, /replaceLayoutImageButton\.disabled = !editing \|\| fileOperationRunning \|\| !archive \|\| archive\.format === "bda"/)
  assert.match(main, /adaptIos26Button\.disabled = !editing \|\| fileOperationRunning \|\| !archive \|\| archive\.format === "bda"/)
  assert.match(main, /updatePanelToolButtons\(\)/)
})

test("iOS 26 adaptation leaves auxiliary screens unchanged", () => {
  assert.match(main, /staged\.set\(candidatePath, adapted\.candidate\)/)
  assert.doesNotMatch(main, /adaptIos26Candidate|adaptIos26Panel/)
  assert.doesNotMatch(ios26, /general, "PANEL", "BACK_STYLE"|iOS26透明主输入区/)
})

test("canvas mode auto-fits while allowing manual enlargement", () => {
  assert.match(main, /toolbarCanvas\.style\.setProperty\("--toolbar-width", String\(width\)\)/)
  assert.match(main, /toolbarCanvas\.style\.setProperty\("--toolbar-height", String\(height\)\)/)
  assert.match(main, /deviceShell\.style\.setProperty\("--canvas-width", `\$\{width\}px`\)/)
  assert.match(main, /deviceShell\.style\.setProperty\("--canvas-ratio-width", String\(width\)\)/)
  assert.match(main, /new ResizeObserver\(scheduleFitCanvasPreview\)\.observe\(canvasWrap\)/)
  assert.doesNotMatch(main, /canvasMaximumWidth/)
  assert.match(main, /function updateCanvasPanelStatus\(/)
  assert.match(css, /\.device-shell\.canvas-only\s*\{[^}]*width:\s*var\(--canvas-fit-width, var\(--canvas-width, 1080px\)\)[^}]*max-width:\s*none/s)
  assert.doesNotMatch(css, /\.device-shell\.canvas-only\s*\{[^}]*920px/s)
  assert.match(
    css,
    /\.device-shell\.canvas-only #toolbar-preview\s*\{[^}]*height:\s*var\(--toolbar-viewport-height, auto\)/s,
  )
  assert.match(
    css,
    /\.device-shell\.canvas-only #preview\s*\{[^}]*width:\s*100%[^}]*max-height:\s*none/s,
  )
  assert.match(html, /<div id="panel-viewport">\s*<canvas id="preview"/)
  assert.match(
    css,
    /\.device-shell\.canvas-only #panel-viewport\s*\{[^}]*height:\s*var\(--panel-viewport-height, auto\)[^}]*overflow:\s*hidden/s,
  )
  assert.match(css, /\.device-shell\.canvas-only\s*\{[^}]*transition:\s*none/s)
  assert.match(css, /\.device-shell\.canvas-only #preview\s*\{[^}]*transform:\s*none/s)
  assert.match(
    css,
    /\.device-shell\.canvas-only \.device-screen\s*\{[^}]*height:\s*auto[^}]*overflow:\s*visible/s,
  )
  assert.doesNotMatch(
    css,
    /\.device-shell\.canvas-only #candidate-area\s*\{[^}]*grid-template-rows:\s*40px 93px/s,
  )
  assert.match(preview, /private fitCanvas\(\): void \{\s*const width = Math\.ceil\(this\.panelWidth\)\s*const height = Math\.ceil\(this\.panelHeight\)/s)
  assert.doesNotMatch(preview, /private fitCanvas\(\): void \{[^}]*this\.keys\.map/s)
  assert.match(css, /@media \(max-width:\s*1060px\)/)
})

test("selected source scrolls to a full-row highlight", () => {
  assert.match(main, /function scrollSelectedSource\(\)/)
  assert.match(main, /line \* lineHeight - source\.clientHeight \/ 3/)
  assert.match(css, /\.token-selected::before\s*\{[^}]*width:\s*calc\(100vw \+ 16px\)/s)
  assert.match(css, /\.token-selected::before\s*\{[^}]*box-shadow:\s*inset 3px 0/s)
  assert.doesNotMatch(css, /\.token-selected(?:\s|::before)*\s*\{[^}]*text-decoration/s)
})

test("settings expose canvas backgrounds and edit mode exposes key context actions", () => {
  assert.match(html, /id="canvas-background"/)
  assert.match(html, /value="glass">玻璃/)
  assert.match(html, /value="checkerboard">马赛克/)
  assert.match(html, /value="white" selected>白色/)
  assert.doesNotMatch(html, /value="default">默认/)
  assert.match(main, /savedCanvasBackground === "default" \? "glass" : savedCanvasBackground \?\? "white"/)
  assert.match(css, /\.canvas-wrap\[data-background="glass"\]\s*\{[^}]*backdrop-filter:/s)
  assert.match(html, /data-context-action="copy"/)
  assert.match(html, /data-context-action="swap"/)
  assert.match(html, /data-context-action="delete"/)
  assert.match(main, /function copySelectedKeys\(\)/)
  assert.match(main, /function deleteSelectedKeys\(\)/)
  assert.match(main, /event\.key === "Delete" \|\| event\.key === "Backspace"[\s\S]*deleteSelectedKeys\(\)/)
  assert.match(main, /createSystemSymbol\("doc\.on\.doc"\)/)
  assert.match(main, /createSystemSymbol\("arrow\.left\.and\.right"\)/)
  assert.match(main, /createSystemSymbol\("trash"\)/)
  assert.match(css, /\.edit-context-menu button\s*\{[^}]*font-size:\s*11px[^}]*font-weight:\s*400[^}]*color:\s*var\(--secondary\)/s)
})

test("key layout supports select, drag-move, merge, and wheel-adjusted geometry fields", () => {
  assert.match(html, /class="inspector-title key-inspector-title"[\s\S]*class="tile-toolbar key-toolbar key-only"[\s\S]*class="tile-mode-control key-mode-control"[^>]*aria-label="按键操作模式"/)
  assert.ok(html.indexOf('class="tile-toolbar key-toolbar key-only"') < html.indexOf('<summary>布局</summary>'))
  assert.match(html, /data-key-mode="select"/)
  assert.match(html, /data-key-mode="move"/)
  assert.match(html, /data-layout-action="merge"[^>]*>合并</)
  assert.match(main, /preview\.setEditTool\(keyMode\)/)
  assert.match(main, /function mergeSelectedKeys\(\)/)
  assert.match(preview, /canvas\.addEventListener\("pointermove"/)
  assert.match(preview, /this\.onMove\(\[\.\.\.this\.selected\], Math\.round\(dx\), Math\.round\(dy\)\)/)
  assert.match(css, /\.geometry-fields input\s*\{[^}]*text-align:\s*left/s)
  assert.match(main, /field\.type === "number"[\s\S]*field\.addEventListener\("wheel"[\s\S]*field\.stepUp\(\)[\s\S]*field\.stepDown\(\)/)
})

test("window and about names match the GitHub project and include the version", () => {
  assert.match(html, /<title>BdiEditor v0\.8\.33<\/title>/)
  assert.match(html, /关于 BdiEditor v0\.8\.33/)
  assert.match(html, /<strong>技术交流与反馈<\/strong><br><button id="copy-qq-group"[^>]*>QQ群：228040912<\/button>/)
})

test("application dialogs share one compact typography scale", () => {
  assert.match(css, /font-family:\s*"PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC"/)
  assert.match(css, /\.app-dialog h2\s*\{[^}]*font-size:\s*15px[^}]*font-weight:\s*600/s)
  assert.match(css, /\.app-dialog header button\s*\{[^}]*font-size:\s*11px/s)
  assert.match(css, /\.app-dialog label\s*\{[^}]*font-size:\s*11px/s)
  assert.match(css, /\.app-dialog select\s*\{[^}]*font-size:\s*12px/s)
  assert.match(css, /\.about-update button\s*\{[^}]*font-size:\s*11px/s)
})

test("deleting a mixed inspector value clears every selected key through its input handler", () => {
  assert.match(main, /quickInspector\.addEventListener\("keydown"/)
  assert.match(main, /shouldClearMixedInput\(event\.key, field\.placeholder, field\.disabled\)/)
  assert.match(main, /field\.value = ""[\s\S]*?field\.dispatchEvent\(new Event\("input", \{ bubbles: true \}\)\)/)
})

test("about dialog automatically checks the canonical GitHub project for updates", () => {
  assert.match(html, /id="about-update"[^>]*data-current-version="0\.8\.33"/)
  assert.match(html, /id="check-update"/)
  assert.match(html, /id="update-status"[^>]*aria-live="polite"/)
  assert.match(html, /id="download-update"[^>]*https:\/\/github\.com\/rekazer0\/BdiEditor\/releases["']/)
  assert.match(main, /checkForUpdate\(aboutUpdate\.dataset\.currentVersion/)
  assert.match(main, /invoke<string>\("fetch_release_page"\)/)
  assert.match(main, /:\s*fetch\s*\n/)
  assert.match(main, /if \(dialog === aboutDialog\) void refreshUpdateStatus\(\)/)
  assert.match(main, /void refreshUpdateStatus\(\)/)
})

test("production assets use a relative base for repository subpath hosting", () => {
  assert.match(vite, /base:\s*"\.\/"/)
})

test("QQ group control copies its number without navigating away", () => {
  assert.match(html, /id="copy-qq-group"[^>]*type="button"/)
  assert.match(main, /copyQqGroupButton\.addEventListener\("click"/)
  assert.match(main, /navigator\.clipboard\.writeText\(value\)/)
})

test("canvas accepts native and browser skin file drops", () => {
  assert.match(main, /canvasWrap\.addEventListener\("dragover"/)
  assert.match(main, /canvasWrap\.addEventListener\("drop"/)
  assert.match(main, /loadDroppedFile\(file\)/)
  assert.match(main, /listen<\{ paths\?: string\[\] \} \| string\[\]>\("tauri:\/\/drag-drop"/)
  assert.match(main, /return \/\\\.\(bdi\|bds\|bda\)\$\/i\.test\(path\)/)
  assert.match(css, /\.canvas-wrap\.drop-target\s*\{[^}]*box-shadow:/s)
})

test("new-project chooser excludes removed legacy templates", () => {
  assert.doesNotMatch(html, /imitation-ios-15|dust-|仿ios|尘埃/)
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

test("PNG resources share a central atlas canvas and inspector preview", () => {
  assert.match(
    html,
    /<figure id="workspace-image-figure" hidden>[\s\S]*?<img id="workspace-image" alt="" hidden \/>[\s\S]*?<canvas id="atlas-canvas"[^>]*>[\s\S]*?<figcaption id="workspace-image-error" hidden>无法预览此 PNG<\/figcaption>[\s\S]*?<\/figure>/,
  )
  assert.match(html, /<img id="asset-image" alt="皮肤资源预览" \/>/)
  assert.match(main, /workspaceImage\.src = assetURL/)
  assert.match(main, /assetImage\.src = assetURL/)
  assert.match(main, /workspaceImage\.addEventListener\("load", clearImagePreviewError\)/)
  assert.match(main, /workspaceImage\.addEventListener\("error", showImagePreviewError\)/)
  assert.match(css, /#atlas-canvas\s*\{[^}]*object-fit:\s*contain/s)
  assert.doesNotMatch(css, /#asset img\s*\{[^}]*image-rendering:\s*pixelated/s)
})

test("selecting a PNG opens Properties and disables Source", () => {
  assert.match(main, /if \(archive\?\.isImage\(path\)\) \{\s*inspectorTab = "properties"\s*selectedDocument = undefined/s)
  assert.match(main, /resourceConfigActive[\s\S]*?tab === "properties" \|\| tab === "source"/)
  assert.match(main, /:\s*!imageSelected && Boolean\(selectedPath\)/)
})

test("resource detail exposes slice navigation and editing controls", () => {
  assert.match(html, /id="resource-back"/)
  assert.match(html, /id="new-tile"/)
  assert.match(html, /id="duplicate-tile"/)
  assert.match(html, /id="delete-tile"/)
  assert.match(html, /data-tile-mode="select"/)
  assert.match(html, /data-tile-mode="move"/)
  assert.match(main, /function moveSelectedTile\(/)
  assert.match(main, /duplicateTileSlice\(/)
  assert.match(main, /function duplicateSelectedTile\(\)[\s\S]*?commitTile\(duplicateTileSlice\(existing, nextTileIndex\(tileDocument\)\)\)/)
  assert.match(main, /deleteSelectedTile\(/)
})

test("resource editing keeps mode switching and TIL source context working", () => {
  assert.match(main, /mode\.addEventListener\("change", \(\) => \{\s*applyModeState\(\)/)
  assert.match(main, /sourceName\.textContent = tilePath/)
  assert.match(main, /setSourceValue\(tileDocument\.toString\(\)\)/)
  assert.match(main, /function selectResourceImage[\s\S]*?showImage\(path\)\s*loadTiles\(path\)/)
  assert.match(main, /sourceName\.textContent = inspectorTab === "source" && selectedResourcePath \? tilePath : selectedResourcePath \|\| selectedPath/)
})

test("resource detail uses icon tools and previews the selected slice", () => {
  assert.match(html, /<canvas id="tile-preview"/)
  for (const id of ["resource-back", "select-tile", "move-tile", "new-tile", "duplicate-tile", "delete-tile"]) {
    assert.match(html, new RegExp(`<button id="${id}" class="[^"]*toolbar-button[^"]*"[^>]*aria-label=`))
    assert.match(html, new RegExp(`<button id="${id}"[\\s\\S]*?<span class="[^"]*icon[^"]*system-symbol`))
  }
  assert.match(main, /function drawTilePreview\(/)
  assert.match(main, /strokeRect\(destination\.x \+ 1, destination\.y \+ 1, destination\.width - 2, destination\.height - 2\)/)
  assert.match(css, /#tile-preview-wrap\s*\{[^}]*width:\s*100%/s)
})

test("action fields offer every Baidu function code while remaining editable", () => {
  assert.equal((html.match(/list="baidu-action-codes"/g) ?? []).length, 6)
  assert.match(html, /<datalist id="baidu-action-codes"><\/datalist>/)
  assert.match(main, /Array\.from\(\{ length: 99 \}/)
  assert.match(main, /new Option\(actionDescription\(value\), value\)/)
  assert.match(main, /shouldSuggestActionCodes\(field\.value\)[\s\S]*field\.setAttribute\("list", "baidu-action-codes"\)[\s\S]*field\.removeAttribute\("list"\)/)
})

test("resource gallery adds columns with inspector width and caps cards at 180px", () => {
  assert.match(css, /\.resource-gallery\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fit, minmax\(140px, 1fr\)\)/s)
  assert.match(css, /\.resource-item\s*\{[^}]*width:\s*100%[^}]*max-width:\s*180px/s)
  assert.match(css, /\.resource-item\s*\{[^}]*grid-template-rows:\s*60px auto auto/s)
  assert.match(html, /id="resource-search"[^>]*type="search"/)
  assert.match(main, /resourceSearch\.value\.trim\(\)\.toLowerCase\(\)/)
  assert.match(css, /#resource-list-view \.inspector-title\s*\{[^}]*grid-template-columns:\s*auto minmax\(160px, 1fr\) auto/s)
  assert.match(css, /#resource-list-view \.inspector-title \.search-control\s*\{[^}]*height:\s*26px/s)
  assert.match(css, /\.search-control:focus-within\s*\{[^}]*border-color:\s*color-mix/s)
  assert.match(main, /Math\.round\(window\.innerWidth \* 0\.28\)/)
  assert.match(main, /inspectorWidthV3/)
})

test("resource slices keep guides and source selection in sync", () => {
  assert.match(main, /function setGuidesVisible\(enabled: boolean\)/)
  assert.match(main, /resourceMode[\s\S]*?setGuidesVisible\(true\)/)
  assert.match(main, /function selectedSourceSections\(\): string\[\]/)
  assert.match(main, /selectedTileIndex === undefined \? \[\] : \[`IMG\$\{selectedTileIndex\}`\]/)
  const pointerdown = main.match(/atlasCanvas\.addEventListener\("pointerdown", \(event\) => \{\n([\s\S]*?)\n}\)/)?.[1] ?? ""
  assert.doesNotMatch(pointerdown, /inspectorTab = "source"|updateInspectorView\(\)/)
  assert.match(pointerdown, /updateSourceHighlight\(\)/)
  assert.match(pointerdown, /requestAnimationFrame\(scrollSelectedSource\)/)
  assert.match(html, /id="tile-preview" width="240" height="240"/)
  assert.match(css, /#tile-preview-wrap\s*\{[^}]*aspect-ratio:\s*1[^}]*box-sizing:\s*border-box/s)
})

test("atlas slice selection does not depend on visible guides", () => {
  const pointerdown = main.match(/atlasCanvas\.addEventListener\("pointerdown", \(event\) => \{\n([\s\S]*?)\n}\)/)?.[1] ?? ""
  const entryGuard = pointerdown.split("\n")[0]
  assert.match(entryGuard, /!resourceConfigActive/)
  assert.doesNotMatch(entryGuard, /guidesVisible/)
})

test("hiding guides cancels active slice drawing", () => {
  const setter = main.match(/function setGuidesVisible\(enabled: boolean\): void \{\n([\s\S]*?)\n}/)?.[1] ?? ""
  assert.match(setter, /if \(!enabled\) setDrawingTile\(false\)/)
})

test("key inspector keeps style references together and text styles can be hidden", () => {
  const advanced = html.match(/<summary>样式引用、文字与图片<\/summary>([\s\S]*?)<\/details>/)?.[1] ?? ""
  assert.doesNotMatch(advanced, /正常状态图片|按下状态图片|data-background-style-field=/)
  assert.match(advanced, /背景样式引用[\s\S]*前景样式引用/)
  assert.match(css, /\.appearance-fields\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/s)
  assert.match(html, /data-text-style/)
  assert.match(main, /textStyleLabels/)
  assert.match(css, /\.style-field\s*\{\s*display:\s*block/s)
})

test("image previews preserve aspect ratio and open the TIL slice picker", () => {
  assert.match(main, /function openImageSlicePicker\(/)
  assert.match(main, /tileSliceAt\(pickerSlices/)
  assert.match(pickerMain, /const selected = tileSliceAt\(imagePayload\.slices, point\)/)
  assert.match(main, /const scale = Math\.min\(canvas\.width \/ sourceWidth, canvas\.height \/ sourceHeight\)/)
  assert.match(main, /styleImagePickerCanvas\.height = Math\.max\(1, Math\.round\(pickerImage\.naturalHeight \* scale\)\)/)
  assert.match(pickerCss, /#picker-canvas/)
  assert.match(pickerCss, /#picker-canvas\s*\{[^}]*width:\s*auto[^}]*max-width:\s*100%/s)
  assert.match(main, /width: 1100, 760|"图片切片", 1100, 760/)
  assert.match(main, /Math\.min\(960 \/ pickerImage\.naturalWidth, 640 \/ pickerImage\.naturalHeight\)/)
  assert.match(css, /#style-image-preview\[hidden\],[\s\S]*#style-image-picker\[hidden\]\s*\{\s*display:\s*none/s)
  assert.match(capabilities, /core:webview:allow-create-webview-window/)
})

test("browser image picker opens a searchable resource layer without losing the slice target", () => {
  assert.match(html, /id="style-image-resource-open"[^>]*>选择图片资源<\/button>/)
  assert.match(html, /id="style-image-resource-picker"[\s\S]*id="style-image-resource-search"[\s\S]*id="style-image-img-list"/)
  assert.match(html, /id="style-image-resource-count"/)
  assert.match(html, /id="style-image-resource-empty"[^>]*hidden>没有匹配的图片资源/)
  assert.match(main, /function openStyleImageResourcePicker\(\): void \{[\s\S]*if \(isTauri\(\) \|\| !archive \|\| !pickerTarget\) return/)
  assert.match(main, /function renderStyleImageResources\(\): void \{[\s\S]*path\.toLowerCase\(\)\.includes\(query\)/)
  assert.match(main, /button\.addEventListener\("click", \(\) => \{[\s\S]*closeStyleImageResourcePicker\(\)[\s\S]*openImageSlicePicker\(path, pickerTarget\)/)
  const closePicker = main.match(/function closeStyleImageResourcePicker\(\): void \{\n([\s\S]*?)\n\}/)?.[1] ?? ""
  assert.doesNotMatch(closePicker, /clearImageSlicePicker|pickerTarget = undefined/)
  assert.match(css, /\.style-image-resource-picker\s*\{[^}]*position:\s*absolute[^}]*inset:\s*0/s)
  assert.match(css, /\.style-image-img-list\s*\{[^}]*overflow-y:\s*auto/s)
  assert.match(css, /\.style-image-img-list img\s*\{[^}]*object-fit:\s*contain/s)
})

test("interaction preview cannot change an image slice reference", () => {
  const pickerClick = main.match(/styleImagePickerCanvas\.addEventListener\("click", \(event\) => \{\n([\s\S]*?)\n}\)/)?.[1] ?? ""
  assert.match(pickerClick.split("\n")[0], /if \(!isEditing\(\)\) return/)
  assert.match(pickerClick, /updateSelectedImageReference\(/)
})

test("loading another archive closes and fully resets the image slice picker", () => {
  const cleanup = main.match(/function clearImageSlicePicker\(\): void \{\n([\s\S]*?)\n\}/)?.[1] ?? ""
  assert.match(cleanup, /if \(pickerURL\) URL\.revokeObjectURL\(pickerURL\)/)
  assert.match(cleanup, /pickerURL = ""/)
  assert.match(cleanup, /pickerImage = undefined/)
  assert.match(cleanup, /pickerSlices = \[\]/)
  assert.match(cleanup, /pickerPath = ""/)
  assert.match(cleanup, /pickerTarget = undefined/)
  assert.match(cleanup, /pickerSelectedIndex = undefined/)
  assert.match(cleanup, /styleImagePicker\.hidden = true/)
  assert.match(cleanup, /styleImagePreview\.hidden = false/)
  assert.match(cleanup, /closeStyleImageResourcePicker\(\)/)
  assert.match(cleanup, /styleImageImgList\.replaceChildren\(\)/)
  assert.match(cleanup, /WebviewWindow\.getByLabel\(label\).*pickerWindow\?\.close\(\)/s)
  assert.match(main, /async function loadArchive[\s\S]*?clearImageSlicePicker\(\)\s*archive = nextArchive/)
})

test("key inspector keeps common fields visible and collapses advanced controls", () => {
  const common = html.slice(html.indexOf('class="inspector-group key-only primary-key-fields"'), html.indexOf("</div>\n          </div>", html.indexOf('class="inspector-group key-only primary-key-fields"')))
  assert.match(common, /data-key-field="SHOW"[\s\S]*?data-key-field="CENTER"/)
  assert.match(html, /<details class="inspector-group inspector-disclosure key-only" open>\s*<summary>布局<\/summary>/)
  assert.match(html, /选中按键后，可使用方向键移动；按住 Shift 每次移动 10 像素。/)
  assert.match(html, /<details class="inspector-group inspector-disclosure key-only" open>\s*<summary>样式引用、文字与图片<\/summary>/)
  assert.match(html, /<summary>滑动与长按<\/summary>/)
  assert.match(css, /\.inspector-disclosure > summary/)
})

test("ordinary configuration navigation clears key selection", () => {
  assert.match(main, /if \(path !== layoutPath\)[\s\S]*selectedKeySections = \[\][\s\S]*preview\.setSelected\(\[\]\)/)
  assert.match(main, /function populateKeyInspector\(\): void \{\s*if \(selectedPath !== layoutPath && selectedKeySections\.length\)[\s\S]*preview\.setSelected\(\[\]\)/)
  assert.match(main, /const hasSelection = Boolean\(document && sections\.length && selectedPath === layoutPath\)/)
})

test("common document sections open by default", () => {
  assert.match(main, /\["PANEL", "INPUT", "CAND"\]\.includes\(section\)/)
  assert.match(css, /\.document-property-section > summary:hover/)
})

test("layout actions include right and bottom alignment", () => {
  assert.match(html, /data-layout-action="right"[^>]*title="右对齐"/)
  assert.match(html, /data-layout-action="bottom"[^>]*title="底对齐"/)
  assert.match(html, /data-layout-action="swap"[^>]*title="交换位置"/)
})

test("unnamed saves and exports use the shared naming dialog", () => {
  assert.match(html, /<dialog id="skin-name-dialog" class="project-dialog"/)
  assert.match(html, /id="skin-name-input"[^>]*required/)
  assert.match(html, /value="cancel" formnovalidate>取消<\/button><button class="primary" value="confirm">确认<\/button>/)
  assert.match(main, /async function saveArchive\(saveAs: boolean, format: ExportFormat\)/)
  assert.match(main, /isUnnamedSkinName\(currentName\)[\s\S]*chooseSkinName\(format\)/)
  assert.match(main, /saveNative\(saveAs \|\| unnamed, format, suggestedName\)/)
  assert.match(main, /prepareDocumentReplacement\(\)[\s\S]*saveArchive\(false, currentExportFormat\(\)\)/)
})

test("text fields, search fields, and dialogs share the rounded control style", () => {
  assert.match(html, /id="resource-search"[^>]*type="search"[^>]*results="0"/)
  assert.match(html, /id="style-image-resource-search"[^>]*type="search"[^>]*results="0"/)
  assert.match(html, /id="style-picker-search"[^>]*type="search"[^>]*results="0"/)
  assert.match(pickerHtml, /id="resource-search"[^>]*type="search"[^>]*results="0"/)
  assert.match(css, /input\[type="search"\]\s*\{[^}]*border-radius:\s*999px[^}]*background:\s*color-mix/s)
  assert.match(css, /#skin-name-input\s*\{[^}]*border-radius:\s*999px[^}]*background:\s*color-mix/s)
  assert.match(css, /\.app-dialog\s*\{[^}]*border-radius:\s*18px/s)
  assert.match(css, /\.project-dialog\s*\{[^}]*border-radius:\s*18px/s)
  assert.match(pickerCss, /\.picker-toolbar input\s*\{[^}]*border-radius:\s*999px[^}]*background:\s*color-mix/s)
  assert.equal((html.match(/class="search-control"/g) ?? []).length, 3)
  assert.match(main, /querySelectorAll<HTMLElement>\("\.system-symbol\[data-system-symbol\]:empty"\)/)
})

test("visible Chinese UI text contains no replacement characters", () => {
  assert.doesNotMatch(`${html}\n${main}\n${pickerHtml}\n${pickerMain}`, /�/)
  assert.match(html, /皮肤图片/)
  assert.match(main, /naturalWidth} × \$\{image\.naturalHeight}/)
})

test("preview interactions keep the sidebar on the rendered keyboard file", () => {
  assert.match(main, /if \(selectedPath !== layoutPath\) selectFile\(layoutPath,\s*"overview"\)/)
  assert.match(main, /if \(target\)[\s\S]*?selectFile\(path\)/)
})

test("sidebar heading switches between overview and source files", () => {
  assert.match(html, /class="sidebar-view-control[^"]*"[^>]*aria-label="左侧视图"/)
  assert.match(html, /data-sidebar-view="overview"[^>]*>概览/)
  assert.match(html, /data-sidebar-view="source"[^>]*>源文件/)
  assert.match(main, /function setSidebarView\(/)
})

test("app dialogs close only when their backdrop is clicked", () => {
  assert.match(main, /for \(const dialog of \[settingsDialog, aboutDialog\]\)/)
  assert.match(main, /if \(event\.target === dialog\) dialog\.close\(\)/)
})

test("overview classifies ini files and uses a consistent filename row", () => {
  for (const category of ["键盘布局", "数字与符号", "手写与选择", "键盘组件", "资源配置"]) {
    assert.match(main, new RegExp(`group: "${category}"`))
  }
  for (const icon of ["keyboard", "square.grid.2x2", "asterisk", "pencil", "list.bullet", "gearshape"]) {
    assert.match(main, new RegExp(`icon: "${icon.replaceAll(".", "\\.")}"`))
  }
  assert.match(main, /metaNode\.textContent = path\.split\("\/"\)\.pop\(\) \?\? path/)
  assert.match(main, /button\.className = `nav-item \$\{className\}`/)
})

test("overview hides default layouts, leads with Chinese layouts, and keeps stroke input last", () => {
  assert.match(main, /const hiddenLayouts = new Set\(\["def_9\.ini", "def_26\.ini"\]\)/)
  assert.match(main, /if \(hiddenLayouts\.has\(name\)\) continue/)
  assert.doesNotMatch(main, /"def_(?:9|26)\.ini": \{ group: "键盘布局"/)
  assert.match(main, /const layoutRank: Record<string, number> = \{ "py_9\.ini": 0, "py_26\.ini": 1, "bh\.ini": 3 \}/)
  assert.match(main, /\(layoutRank\[aName\] \?\? 2\) - \(layoutRank\[bName\] \?\? 2\)/)
})

test("overview groups are collapsible and resource configuration precedes keyboard layouts", () => {
  assert.match(main, /const disclosure = document\.createElement\("details"\)/)
  assert.match(main, /disclosure\.open = overviewGroupState\.get\(title\) \?\? true/)
  assert.match(main, /summary\.className = "nav-section"/)
  assert.match(main, /\["皮肤", "资源配置", "键盘布局"/)
  assert.match(main, /group: "资源配置", label: "图片资源"[\s\S]*navMode: "resource"/)
  assert.match(main, /group: "资源配置", label: "样式配置"[\s\S]*navMode: "style"/)
  assert.match(main, /"gen\.ini": \{ group: "资源配置", label: "通用配置", className: "nav-style", icon: "gearshape" \}/)
  assert.doesNotMatch(main, /if \(name\.toLowerCase\(\) === "gen\.ini"\) continue/)
  assert.doesNotMatch(main, /genConfigSections|isGenConfig/)
  assert.match(main, /button\.dataset\.navMode = navMode/)
  assert.match(css, /\.nav-group\[open\] > summary > \.source-disclosure/)
})

test("style reference inputs share one searchable preview picker", () => {
  assert.match(html, /id="style-picker-dialog"[\s\S]*id="style-picker-search"[\s\S]*id="style-picker-grid"/)
  assert.match(main, /function decorateStyleReferenceInput\(/)
  assert.match(main, /for \(const input of \[\.\.\.keyboardFields, \.\.\.toolbarFields, \.\.\.keyFields\]\) decorateStyleReferenceInput\(input\)/)
  assert.match(main, /decorateStyleReferenceInput\(input, entry\.key\)/)
  assert.match(main, /IniDocument\.parse\(archive\.getText\(path\)\)\.sections\(\)/)
  assert.match(main, /resolver\.resolve\(styleID, false\)/)
  assert.match(main, /resolver\.resolve\(styleID, true\)/)
  assert.match(main, /stylePickerTarget\.dispatchEvent\(new Event\("change", \{ bubbles: true \}\)\)/)
  assert.match(css, /\.style-picker-previews canvas\s*\{[^}]*aspect-ratio:\s*64 \/ 44/s)
})

test("style thumbnails change on click and edit on command click", () => {
  assert.match(main, /button\.className = "style-picker-trigger"/)
  assert.match(main, /previews\.className = "style-picker-states"/)
  assert.match(main, /for \(let index = 0; index < 2; index \+= 1\)/)
  assert.match(main, /Promise\.all\(\[false, true\]\.map/)
  assert.match(main, /if \(event\.metaKey \|\| event\.ctrlKey\) openStyleReferenceEditor/)
  assert.match(main, /else openStylePicker\(input\)/)
  assert.match(main, /if \(event\.metaKey \|\| event\.ctrlKey\) \{\s*stylePickerDialog\.close\(\)\s*openStyleReferenceEditor\(styleID\)/s)
  assert.match(main, /selectFile\(path, "overview", "style"\)/)
  assert.match(main, /function refreshStyleReferenceThumbnail\(/)
  assert.match(main, /styleReferenceDrawIDs\.get\(button\)/)
  assert.match(main, /function refreshStyleReferenceThumbnails\(\)/)
  assert.match(main, /if \(isStyleReferenceKey\(entry\.key\)\) label\.classList\.add\("style-reference-field"\)/)
  assert.match(css, /\.style-reference-field\s*\{[^}]*grid-column:\s*1 \/ -1/s)
  assert.match(css, /\.style-picker-trigger\s*\{[^}]*width:\s*auto[^}]*height:\s*92px/s)
  assert.match(css, /\.style-picker-states\s*\{[^}]*grid-template-columns:\s*repeat\(2,/s)
  assert.match(css, /\.style-picker-state canvas\s*\{[^}]*display:\s*block/)
  assert.doesNotMatch(css, /\.style-picker-state small\s*\{/)
  assert.match(html, /单击应用 · Command\/Ctrl 单击编辑/)
})

test("style detail returns to the configuration that opened it", () => {
  assert.match(main, /let styleReturnPath = ""/)
  assert.match(main, /let styleReturnSelection: string\[\] = \[\]/)
  assert.match(main, /let styleReturnScrollTop = 0/)
  assert.match(main, /let styleReturnDisclosures: boolean\[\] = \[\]/)
  assert.match(main, /function openStyleReferenceEditor\(styleID: string\): void \{[\s\S]*const returnSelection = \[\.\.\.selectedKeySections\][\s\S]*const returnScrollTop = quickInspector\.scrollTop[\s\S]*const returnDisclosures = keyInspectorDisclosures\.map[\s\S]*selectFile\(path, "overview", "style"\)[\s\S]*styleReturnSelection = returnSelection/s)
  assert.match(main, /resourceBackButton\.addEventListener\("click", \(\) => \{[\s\S]*const selection = \[\.\.\.styleReturnSelection\][\s\S]*selectFile\(path, "overview"\)[\s\S]*selectedKeySections = selection[\s\S]*preview\.setSelected\(selection\)[\s\S]*quickInspector\.scrollTop = scrollTop[\s\S]*revealSourceFile\(path\)/s)
})

test("style picker uses the shared glass dialog and selected-card styling", () => {
  assert.match(html, /id="style-picker-dialog" class="style-picker-dialog glass-module"/)
  assert.match(main, /button\.classList\.toggle\("selected", stylePickerTarget\?\.value\.split\(","\)\[0\]\?\.trim\(\) === styleID\)/)
  assert.match(css, /\.style-picker-dialog\s*\{[^}]*border-radius:\s*18px[^}]*background:\s*var\(--menu\)/s)
  assert.match(css, /\.style-picker-item\.selected\s*\{[^}]*border-color:\s*var\(--accent\)/s)
  assert.match(css, /\.style-picker-previews\s*\{[^}]*gap:\s*0[^}]*overflow:\s*hidden/s)
})

test("style reference preview is enlarged inside one input control", () => {
  const wrapper = css.match(/\.style-reference-input\s*\{[^}]+\}/s)?.[0] ?? ""
  const input = css.match(/\.style-reference-input > input,\s*\.inspector-grid \.style-reference-input > input\s*\{[^}]+\}/s)?.[0] ?? ""
  const trigger = css.match(/\.style-picker-trigger\s*\{[^}]+\}/s)?.[0] ?? ""
  const canvas = css.match(/\.style-picker-state canvas\s*\{[^}]+\}/s)?.[0] ?? ""
  assert.match(wrapper, /border:\s*1px solid var\(--line\)/)
  assert.match(wrapper, /overflow:\s*hidden/)
  assert.match(input, /border:\s*0/)
  assert.match(trigger, /width:\s*auto/)
  assert.match(trigger, /border:\s*0/)
  assert.match(canvas, /width:\s*100%/)
  assert.match(canvas, /max-width:\s*100%/)
  assert.match(canvas, /height:\s*76px/)
  assert.match(canvas, /background-image:\s*linear-gradient/)
  assert.doesNotMatch(main, /label\.textContent = state/)
})

test("gap inputs share one taller split control", () => {
  const gaps = css.match(/\.gap-fields\s*\{[^}]+\}/s)?.[0] ?? ""
  assert.match(gaps, /grid-template-columns:\s*repeat\(2, 1fr\)/)
  assert.match(gaps, /border:\s*1px solid var\(--line\)/)
  assert.match(gaps, /overflow:\s*hidden/)
  assert.match(css, /\.gap-fields label \+ label\s*\{[^}]*border-left:\s*1px solid var\(--line-soft\)/s)
  assert.match(css, /\.gap-fields input,[\s\S]*?\.inspector-grid\.gap-fields input\s*\{[^}]*height:\s*40px[^}]*border:\s*0/s)
  assert.match(css, /\.gap-fields input,[\s\S]*?\.inspector-grid\.gap-fields input\s*\{[^}]*text-align:\s*center/s)
})

test("missing theme and orientation switches offer to create the target variant", () => {
  assert.doesNotMatch(main, /button\.disabled = Boolean\(archive\).*button\.dataset\.themeChoice/s)
  assert.match(main, /function createMissingVariant\(/)
  assert.match(main, /window\.confirm\(`当前皮肤没有\$\{label\}，是否从当前配置创建？`\)/)
  assert.match(main, /variantCopyPaths\(archive\.names\(\), sourceTheme, sourceOrientation, targetTheme, targetOrientation\)/)
  assert.match(main, /for \(const \{ source, target \} of copies\) archive\.setBytes\(target, archive\.getBytes\(source\)!\.slice\(\)\)/)
  assert.match(main, /if \(control !== layout && !createMissingVariant\(path\)\) return/)
})

test("layout inspector omits the redundant whole-keyboard form", () => {
  assert.match(html, /<div class="keyboard-fields" hidden><\/div>/)
  assert.doesNotMatch(html, /<h3>整个键盘<\/h3>|data-keyboard-field=/)
})

test("style configuration reuses the resource gallery and opens an editable detail", () => {
  assert.match(html, /id="style-add"[\s\S]*id="resource-gallery"/)
  assert.match(html, /id="style-resource-detail"[\s\S]*id="style-detail-normal"[\s\S]*id="style-detail-highlighted"/)
  assert.match(html, /id="image-resource-detail"[\s\S]*?<\/div>\s*<div id="style-resource-detail" hidden>/)
  assert.match(main, /resourceInspectorMode: "image" \| "style"/)
  assert.match(main, /async function renderStyleResourceGallery\(\)/)
  assert.match(main, /button\.className = "resource-item style-resource-item"/)
  assert.match(main, /drawVisualPreview\(canvas, \[await resolver\.resolve\(styleID, highlighted\)/)
  assert.match(main, /button\.addEventListener\("click"[\s\S]*selectGalleryItem\(`STYLE\$\{styleID\}`/)
  assert.match(main, /button\.addEventListener\("dblclick"[\s\S]*selectStyleResource\(styleID\)/)
  assert.match(main, /function renderStyleResourceDetail\(/)
  assert.match(main, /const common = \["NM_COLOR", "HL_COLOR", "FONT_NAME", "FONT_WEIGHT", "FONT_SIZE", "SHOW", "INFO"\]/)
  assert.match(main, /key !== "NM_IMG" && key !== "HL_IMG"/)
  assert.match(main, /function chooseStyleImageSlice\(/)
  assert.match(html, /data-style-image-property="NM_IMG"/)
  assert.match(html, /data-style-image-property="HL_IMG"/)
  assert.match(main, /styleDetailImageButtons[\s\S]*chooseStyleImageSlice\(/)
  assert.match(main, /styleAddButton\.addEventListener\("click"[\s\S]*!archive\?\.isText\(styleConfigPath\(\)\) \|\| !isEditing\(\)\) return/)
  assert.match(main, /function styleSectionTarget\([\s\S]*sections: \[`STYLE\$\{styleID\}`\]/)
  assert.match(main, /openImageSlicePicker\(imagePath, target\)/)
  assert.match(css, /\.resource-style-previews\s*\{[^}]*grid-template-columns:\s*repeat\(2,/s)
})

test("resource toolbar shows only actions supported by each resource mode", () => {
  assert.match(main, /renderStyleResourceGallery[\s\S]*resourceUploadButton\.hidden = true[\s\S]*styleAddButton\.hidden = false[\s\S]*resourceDownloadButton\.hidden = true/)
  assert.match(main, /resourceUploadButton\.hidden = false[\s\S]*styleAddButton\.hidden = true[\s\S]*resourceDownloadButton\.hidden = false/)
  assert.match(css, /\.resource-actions \.toolbar-button\[hidden\]\s*\{[^}]*display:\s*none/s)
})

test("new styles use the next numeric ID while allowing a custom ID", () => {
  assert.match(html, /id="new-style-dialog"[\s\S]*id="new-style-id"/)
  assert.doesNotMatch(html, /new-style-image/)
  assert.match(main, /function nextStyleID\(\): string/)
  assert.match(main, /Math\.max\(\.\.\.ids\)/)
  assert.match(main, /if \(!\/\^\\d\+\$\/\.test\(styleID\)\)/)
  assert.match(main, /if \(availableStyleIDs\(\)\.includes\(styleID\)\)/)
  assert.match(main, /stylesDocument\.appendSection\(`STYLE\$\{styleID\}`, \[\]\)/)
  assert.match(main, /stylesDocument\.set\("GLOBAL", "STYLE_NUM", styleID\)/)
  assert.match(main, /selectStyleResource\(styleID\)/)
  assert.match(css, /\.new-style-dialog footer \.primary\s*\{[^}]*border-color:\s*var\(--accent\)[^}]*background:\s*var\(--accent\)/s)
})

test("style detail edits every field with typed color and slice pickers", () => {
  assert.match(main, /function parseStyleColor\(/)
  assert.match(main, /function bindStyleDetailColor\(/)
  assert.match(main, /key\.endsWith\("COLOR"\)/)
  assert.match(main, /key !== "NM_IMG" && key !== "HL_IMG"/)
  assert.match(main, /colorControl\.className = "color-control"/)
  assert.match(main, /picker\.type = "color"/)
  assert.match(main, /textInput\.dispatchEvent\(new Event\("change", \{ bubbles: true \}\)\)/)
  assert.match(main, /openStyleImageResourceChooser\(target\)/)
  assert.match(css, /\.resource-detail-heading\s*\{[^}]*position:\s*sticky[^}]*top:\s*-14px/s)
  assert.match(css, /\.resource-detail-heading\s*\{[^}]*background:\s*var\(--inspector\)/s)
  assert.match(css, /#resource-list-view \.inspector-title\s*\{[^}]*position:\s*sticky[^}]*top:\s*-14px/s)
  assert.match(css, /#style-detail-fields\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/s)
  assert.match(main, /selectedStyleID = styleID[\s\S]*resourceInspector\.scrollTop = 0/)
})

test("source file clicks open text files in the source inspector", () => {
  assert.match(main, /button\.addEventListener\("click", \(\) => selectFile\(path, "source"\)\)/)
  assert.match(main, /preferredSidebarView === "source" && \(archive\?\.isText\(path\) \|\| archive\?\.isBdaConfig\(path\)\)/)
})

test("every overview text document exposes editable non-key properties", () => {
  assert.match(html, /class="inspector-group document-fields" hidden/)
  assert.match(html, /id="document-fields"/)
  assert.doesNotMatch(html, /<h3>文档配置<\/h3>/)
  assert.match(main, /function populateDocumentInspector\(\)/)
  assert.match(main, /!\/\^KEY\\d\+\$\/\.test\(entry\.section\)/)
  assert.match(main, /selectedDocument\.set\(section, key, input\.value\)/)
  assert.match(main, /function translatedConfigLabel\(key: string\)/)
  assert.match(main, /documentFieldLabels\[key\] \?\? "扩展配置"/)
  assert.match(main, /function translatedSectionLabel\(section: string\)/)
  assert.match(main, /function isHiddenConfigEntry\(section: string, key: string\)/)
  assert.match(main, /!isHiddenConfigEntry\(entry\.section, entry\.key\)/)
  assert.match(main, /documentSectionLabels\[section\] \?\? "扩展区域"/)
  assert.match(main, /caption\.textContent = translatedConfigLabel\(entry\.key\)/)
  assert.match(main, /preferredSidebarView === "overview"[\s\S]*?inspectorTab = "properties"/)
  assert.match(css, /\.document-property-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,/s)
  assert.match(css, /\.document-property-field\.wide\s*\{[^}]*grid-column:\s*1 \/ -1/s)
  assert.match(main, /!\/\(\^\|\\\/\)gen\\\.ini\$\/i\.test\(path\)/)
})

test("source files use Finder-style rows and keyboard navigation", () => {
  assert.match(main, /sourceFiles\.setAttribute\("role", "tree"\)/)
  assert.match(main, /folderSummary\.className = "source-tree-row source-folder-row"/)
  assert.match(main, /button\.className = "source-tree-row source-file-row"/)
  assert.match(main, /folderSummary\.addEventListener\("dblclick"/)
  assert.match(main, /sourceFiles\.addEventListener\("keydown"/)
  assert.match(main, /case "ArrowDown"/)
  assert.match(main, /case "ArrowRight"/)
  assert.doesNotMatch(main, /description\.textContent = sourceFolderDescription/)
  assert.match(css, /\.source-tree-row\s*\{[^}]*min-height:\s*26px/s)
  assert.match(css, /\.source-tree-row\.selected\s*\{[^}]*background:/s)
  assert.match(css, /\.source-file-row\s*\{[^}]*gap:\s*10px/s)
  assert.match(css, /#files \.source-file-row > \.system-symbol\s*\{[^}]*position:\s*static/s)
})

test("preview toolbar centers the device selector and toggles canvas guides", () => {
  assert.match(html, /id="toggle-guides"[^>]*aria-label="辅助线"[^>]*title="辅助线"[^>]*aria-pressed="false"[^>]*>[\s\S]*?data-system-symbol="ruler"/)
  assert.match(main, /preview\.setGuides\(guidesVisible\)/)
  assert.match(main, /toolbarPreview\.setGuides\(guidesVisible\)/)
  assert.match(preview, /setGuides\(enabled: boolean\)/)
  assert.match(css, /\.preview-toolbar\s*\{[^}]*position:\s*relative/s)
  assert.match(css, /\.field-control\s*\{[^}]*left:\s*50%[^}]*translateX\(-50%\)/s)
})

test("platform materials and toolbar status surfaces stay visually consistent", () => {
  assert.match(main, /document\.documentElement\.classList\.toggle\("windows", isTauri\(\) && navigator\.userAgent\.includes\("Windows"\)\)/)
  assert.match(css, /#skin-state-control\s*\{[^}]*left:\s*45px[^}]*transform:\s*none/s)
  assert.match(css, /#skin-state-control\[hidden\]\s*\{[^}]*display:\s*none\s*!important/s)
  assert.match(css, /\.source\s*\{[^}]*background:\s*var\(--sidebar\)[^}]*blur\(28px\)/s)
  assert.match(css, /\.workspace-status\s*\{[^}]*border-top:[^}]*background:\s*var\(--toolbar\)[^}]*font:\s*10px/s)
  assert.match(css, /#event-log\s*\{[^}]*background:\s*transparent[^}]*font:\s*inherit/s)
  assert.match(css, /#panel-status\s*\{[^}]*color:\s*inherit[^}]*font:\s*inherit/s)
  assert.match(css, /:root\.macos\[data-window-material="on"\][\s\S]*?\.app-dialog[\s\S]*?backdrop-filter:/)
  assert.match(css, /:root\.windows\[data-window-material="on"\]\s+\*\s*\{[^}]*backdrop-filter:\s*none\s*!important/s)
  assert.match(css, /:root\.windows\[data-window-material="on"\]\s*\{[^}]*--window:\s*rgb\(255 255 255 \/ 92%\)[^}]*--content:\s*rgb\(245 247 249 \/ 82%\)/s)
  assert.match(css, /:root\.windows\[data-app-theme="dark"\]\[data-window-material="on"\]\s*\{[^}]*--window:\s*rgb\(23 25 27 \/ 92%\)[^}]*--content:\s*rgb\(25 28 31 \/ 84%\)/s)
})

test("panel tools expose S-state and configurable one-panel copying", () => {
  assert.match(html, /id="panel-scale"[^>]*title="面板复制"/)
  assert.match(html, /id="skin-state"[^>]*aria-label="皮肤 S 状态"/)
  assert.match(html, /id="panel-status"[^>]*>面板：-- × -- · 预览缩放：--%/)
  assert.match(html, /id="panel-scale-dialog"[^>]*aria-labelledby="panel-scale-title"/)
  assert.match(html, /id="panel-scale-title">面板复制</)
  assert.match(html, /id="panel-copy-source"/)
  assert.match(html, /id="panel-target-theme"[\s\S]*?value="light">浅色[\s\S]*?value="dark">深色/)
  assert.match(html, /id="panel-target-orientation"[\s\S]*?value="port">竖屏[\s\S]*?value="land">横屏/)
  assert.match(html, /id="panel-target-existing"[^>]*aria-label="选择目标路径下的 INI"/)
  assert.match(html, /id="panel-target-file"[^>]*required/)
  assert.doesNotMatch(html, /<datalist id="panel-target-files">/)
  assert.match(html, /id="panel-scale-enabled" type="checkbox"/)
  assert.match(html, /id="panel-scale-options"[^>]*hidden/)
  assert.doesNotMatch(html, /竖转横|同时转换浅色与深色/)
  assert.match(main, /availableSkinStates\(\.\.\.skinStateDocuments\(\)\)/)
  assert.match(main, /copyablePanelPaths\(archive\.names\(\)\)/)
  assert.match(main, /function openPanelCopyDialog\(\)/)
  assert.match(main, /function updatePanelCopyForm\(\)/)
  assert.match(main, /panelTargetExisting\.replaceChildren\([\s\S]*?copyablePanelPaths\(archive\.names\(\)\)/)
  assert.match(main, /panelTargetExisting\.addEventListener\("change"/)
  assert.match(main, /async function copyPanel\(\)/)
  assert.match(main, /validPanelFilename\(panelTargetFile\.value\.trim\(\)\)/)
  assert.match(main, /const staged = new Map<string, Uint8Array>\(\)/)
  assert.match(main, /window\.confirm\([^)]*覆盖/s)
  assert.match(main, /runFileOperation\("复制面板", copyPanel\)/)
  assert.doesNotMatch(main, /convertPortraitPanels|panelConversionPaths/)
})

test("preview S actions route through one shared state setter for both canvases", () => {
  assert.match(main, /import \{[^}]*previewPageTransition[^}]*previewStateFromAction[^}]*\} from "\.\/actions\.ts"/s)
  assert.match(main, /function applySkinState\(state\?: number, message\?: string\)/)
  assert.match(main, /const state = previewStateFromAction\(code\)/)
  assert.match(main, /applySkinState\(\s*state \|\| undefined,/)
  assert.match(main, /preview\.setSkinState\(state\)/)
  assert.match(main, /toolbarPreview\.setSkinState\(state\)/)
})

test("panel tools keep their toolbar order and each layout's native aspect ratio", () => {
  assert.ok(html.indexOf('class="toolbar-divider"') < html.indexOf('id="panel-scale"'))
  assert.ok(html.indexOf('id="panel-scale"') < html.indexOf('id="replace-layout-image"'))
  assert.match(main, /availableSkinStates\(\.\.\.skinStateDocuments\(\)\)/)
  assert.doesNotMatch(css, /#preview\s*\{[^}]*aspect-ratio:\s*1125\s*\/\s*650/s)
})

test("layout image replacement adds a divider, dialog, and png-only drag handling", () => {
  assert.match(html, /id="replace-layout-image"[^>]*title="替换键盘样式"/)
  assert.match(html, /id="layout-image-dialog"[^>]*aria-labelledby="layout-image-title"/)
  assert.match(html, /id="layout-image-file"[^>]*type="button"/)
  assert.match(html, /id="layout-image-preview"[^>]*hidden/)
  assert.match(html, /id="layout-image-open"[^>]*accept="\.png,image\/png"/)
  assert.match(html, /name="layout-image-target"[^>]*value="panel"/)
  assert.match(html, /name="layout-image-target"[^>]*value="key-normal"/)
  assert.match(html, /name="layout-image-target"[^>]*value="key-highlight"/)
  assert.match(html, /name="layout-image-target"[^>]*value="fore-normal"/)
  assert.match(html, /name="layout-image-target"[^>]*value="fore-highlight"/)
  assert.match(html, /name="layout-image-target"[^>]*value="candidate"/)
  assert.match(html, /layout-image-targets[\s\S]*>键盘背景<\/strong>/)
  assert.match(html, /layout-image-targets[\s\S]*>按键按下前景<\/strong>/)
  assert.match(html, /layout-image-targets[\s\S]*>候选栏背景样式<\/strong>/)
  assert.match(main, /applyLayoutImageStyles[\s\S]*planLayoutImage[\s\S]*fitPngTo/)
  assert.match(main, /applyCandidateImageStyles\(stylesDoc, candDoc, plan/)
  assert.match(main, /case "candidate": return "候选栏背景样式"/)
  assert.match(main, /replaceLayoutImageButton\.addEventListener\("click", openLayoutImageDialog\)/)
  assert.match(main, /\/\\\.png\$\/i/)
  assert.match(main, /setLayoutImageHighlight\(Boolean\(/)
  assert.match(main, /layoutImageDialog\.showModal\(\)/)
  assert.match(main, /case "fore-highlight": return "按键按下前景"/)
  assert.match(main, /commitBatch\(\[[\s\S]*kind: "bytes"[\s\S]*kind: "text"/)
  assert.match(css, /\.canvas-wrap\.layout-image-target\s*\{[^}]*box-shadow:/s)
})

test("layout image dialog offers a three-way layout config slider", () => {
  assert.match(html, /<fieldset id="layout-image-config"[^>]*>\s*<legend>布局配置<\/legend>/)
  assert.match(html, /data-layout-image-config="none">无跟随/)
  assert.match(html, /data-layout-image-config="image-follows-layout">图片跟随布局/)
  assert.match(html, /data-layout-image-config="layout-follows-image">布局跟随图片/)
  assert.match(html, /id="layout-image-config-desc"/)
  assert.match(css, /\.layout-image-config-control button\.active\s*\{/)
  assert.match(main, /function syncLayoutImageConfig\(\)/)
  assert.match(main, /layoutImageConfigFieldset\.disabled = layoutImageTarget === "panel" \|\| layoutImageTarget === "candidate"/)
  assert.match(main, /decodePngMask\(layoutImageBytes\)[\s\S]*detectGridCells\(scan\.mask/)
  assert.match(main, /planLayoutImageSlices\(layoutImageTarget, matchedKeys, cells/)
  assert.match(main, /matchLayoutKeysToCells\(layoutDoc, keys, cells\)/)
  assert.match(main, /applyLayoutImageRects\(layoutDoc, plan\.keys, plan\.slices\.map/)
  assert.doesNotMatch(main, /cells\.length !== keys\.length/)
})

test("selection clears across layout switches so edits default to all keys", () => {
  assert.match(main, /selectedKeySections = \[\]\s*preview\.setSelected\(\[\]\)/s)
  assert.match(main, /kind: "batch"; changes: Change\[\]/)
})

test("toolbar menus use a readable frosted surface", () => {
  assert.match(css, /\.toolbar-menu\s*\{[^}]*background:\s*var\(--menu\)/s)
})

test("checkerboard canvas has no compositing seam", () => {
  const checkerboard = css.match(/\.canvas-wrap\[data-background="checkerboard"\]\s*\{[^}]+\}/s)?.[0] ?? ""
  assert.match(checkerboard, /background-image:\s*linear-gradient/)
  assert.doesNotMatch(checkerboard, /repeating-conic-gradient/)
})

test("scrollbars and segmented controls use compact animated glass styling", () => {
  assert.match(css, /scrollbar-width:\s*thin/)
  assert.match(css, /::-webkit-scrollbar\s*\{[^}]*width:\s*6px[^}]*height:\s*6px/s)
  assert.match(css, /::-webkit-scrollbar-thumb\s*\{[^}]*background:\s*rgb\(255 255 255 \/ 48%\)/s)
  assert.match(css, /\.mode-control button,[\s\S]*?\.inspector-tabs button\s*\{[^}]*transition:/s)
})

test("settings provide a persistent system-aware application theme", () => {
  assert.match(html, /<select id="app-theme">[\s\S]*?value="system">跟随系统[\s\S]*?value="light">浅色[\s\S]*?value="dark">深色/)
  assert.match(main, /const appTheme = \$\("#app-theme"\)/)
  assert.match(main, /localStorage\.getItem\("app-theme"\)/)
  assert.match(main, /document\.documentElement\.dataset\.appTheme = resolved/)
  assert.match(main, /matchMedia\("\(prefers-color-scheme: dark\)"\)/)
  assert.match(main, /systemTheme\.addEventListener\("change", applyAppTheme\)/)
  assert.match(css, /:root\[data-app-theme="dark"\]\s*\{/)
})

test("settings can persistently disable native and CSS window materials", () => {
  assert.match(html, /<input id="window-material" type="checkbox"[^>]*role="switch"[^>]*checked/)
  assert.match(main, /const windowMaterial = \$\("#window-material"\)/)
  assert.match(main, /localStorage\.getItem\("window-material"\)/)
  assert.match(main, /localStorage\.setItem\("window-material", windowMaterial\.checked \? "on" : "off"\)/)
  assert.match(main, /document\.documentElement\.dataset\.windowMaterial = enabled \? "on" : "off"/)
  assert.match(main, /invoke\("set_window_material", \{ enabled \}\)/)
  assert.match(css, /:root\[data-window-material="off"\][\s\S]*?background:\s*#f4f5f6/)
  assert.match(css, /:root\[data-window-material="off"\]\s+\*\s*\{[^}]*backdrop-filter:\s*none\s*!important/s)
  assert.match(css, /\.settings-switch input\s*\{[^}]*appearance:\s*none[^}]*border-radius:\s*999px/s)
  assert.match(css, /\.settings-switch input:checked\s*\{[^}]*background:\s*var\(--accent\)/s)
})

test("every toolbar menu closes when clicking elsewhere", () => {
  assert.match(main, /const toolbarMenus = Array\.from\(document\.querySelectorAll<HTMLDetailsElement>\("\.toolbar-more"\)\)/)
  assert.match(main, /for \(const menu of toolbarMenus\)[\s\S]*?!menu\.contains\(event\.target as Node\)[\s\S]*?menu\.open = false/)
  assert.match(main, /dialog\.showModal\(\)[\s\S]*?menu\.open = false/)
})

test("top, sidebar, menus and segmented controls share animated glass materials", () => {
  for (const selector of [".titlebar", "aside", ".source", ".preview-toolbar", ".toolbar-menu", ".glass-module"]) {
    assert.match(css, new RegExp(`${selector.replace(".", "\\.")}\\s*\\{[^}]*backdrop-filter:`, "s"))
  }
  assert.match(css, /\.mode-control button\.active,[\s\S]*?\.inspector-tabs button\.active\s*\{[^}]*box-shadow:/s)
  assert.match(css, /\.canvas-wrap\s*\{[^}]*background:\s*var\(--canvas\)/s)
  assert.doesNotMatch(css.match(/\.canvas-only canvas\s*\{[^}]*\}/s)?.[0] ?? "", /border:|box-shadow:/)
  assert.match(css, /@keyframes glass-select/)
  assert.match(main, /document\.documentElement\.classList\.toggle\("macos", isTauri\(\) && navigator\.userAgent\.includes\("Macintosh"\)\)/)
  assert.match(css, /:root\.macos\s*\{[^}]*--titlebar-height:\s*86px/s)
  assert.match(html, /<header class="titlebar" data-tauri-drag-region>/)
  assert.match(html, /<div class="document-title" data-tauri-drag-region>/)
  assert.match(html, /<span class="spacer" data-tauri-drag-region><\/span>/)
})
