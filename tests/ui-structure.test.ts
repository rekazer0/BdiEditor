import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8")
const css = readFileSync(new URL("../src/style.css", import.meta.url), "utf8")
const main = readFileSync(new URL("../src/main.ts", import.meta.url), "utf8")
const preview = readFileSync(new URL("../src/preview.ts", import.meta.url), "utf8")
const vite = readFileSync(new URL("../vite.config.ts", import.meta.url), "utf8")

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
  assert.match(dialog, /内置皮肤为互联网下载整理，如有侵权请联系作者下架。/)
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
    (html.match(/class="system-symbol-fallback"/g) ?? []).length,
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
  assert.match(main, /"py_9\.ini": \{ group: "键盘布局"/)
  assert.match(main, /"py_26\.ini": \{ group: "键盘布局"/)
})

test("single-theme skins disable unavailable theme choices", () => {
  assert.match(main, /button\.disabled = Boolean\(archive\).*button\.dataset\.themeChoice/s)
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
  assert.match(main, /saveNative\(true, format\)/)
  assert.match(main, /saveNative\(false, currentExportFormat\(\)\)/)
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
  assert.equal((html.match(/data-color-picker-for=/g) ?? []).length, 4)
  assert.equal((html.match(/data-color-alpha-for=/g) ?? []).length, 4)
  assert.match(main, /alpha\.value = String\(Number\.parseInt\(hex\.slice\(0, 2\), 16\) \/ 255\)/)
  assert.match(main, /field\.value = `\$\{Math\.round\(Math\.max\(0, Math\.min\(1, alphaValue\)\) \* 255\)/)
  assert.match(main, /syncColorControl\(field\)/)
  assert.doesNotMatch(main, /colorDialog\.showModal\(\)/)
  assert.equal((html.match(/class="color-pair-field"/g) ?? []).length, 2)
  assert.match(css, /\.color-pair-field\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/s)
  assert.match(css, /\.color-control\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) 28px/s)
  assert.match(css, /\.color-control input\[type="color"\]\s*\{[^}]*width:\s*28px[^}]*height:\s*28px/s)
})

test("key image fields preview processed atlas slices in a dialog", () => {
  assert.match(html, /data-image-preview="normal"/)
  assert.match(html, /data-image-preview="highlighted"/)
  assert.match(html, /id="style-image-dialog"/)
  assert.match(main, /updateImagePreviews\(\)/)
  assert.match(main, /drawVisualPreview\(styleImagePreview, visuals, false\)/)
  assert.doesNotMatch(main, /styleImageDialog\.showModal\(\)/)
  assert.match(main, /styleImageDialog\.show\(\)/)
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

test("image preview is a non-modal panel closed by an explicit control", () => {
  const dialog = html.slice(html.indexOf('<dialog id="style-image-dialog"'), html.indexOf("</dialog>", html.indexOf('<dialog id="style-image-dialog"')))
  assert.match(dialog, /id="style-image-close"[^>]*aria-label="关闭图片预览"/)
  assert.match(main, /styleImageClose\.addEventListener\("click", \(\) => styleImageDialog\.close\(\)\)/)
  assert.doesNotMatch(css, /\.style-image-dialog::backdrop\s*\{[^}]*background:/s)
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

test("inspector contains previews for resolved background and foreground styles", () => {
  assert.match(html, /data-style-preview="back:normal"/)
  assert.match(html, /data-style-preview="back:highlighted"/)
  assert.match(html, /data-style-preview="fore:normal"/)
  assert.match(html, /data-style-preview="fore:highlighted"/)
  assert.equal((html.match(/data-style-preview="[^"]+"[^>]*>\s*<canvas/g) ?? []).length, 4)
  assert.match(css, /\.style-preview-button\s*\{[^}]*width:\s*36px/s)
})

test("interaction preview starts a press instead of returning after selection", () => {
  assert.doesNotMatch(preview, /this\.mode === "edit" \|\| !this\.selected\.has\(key\.section\)/)
  assert.match(preview, /this\.active = \{\s*key,/)
})

test("Shift selects the complete key range from the anchor", () => {
  assert.match(preview, /event\.shiftKey && this\.selectionAnchor/)
  assert.match(preview, /sections\.slice\(Math\.min\(from, to\), Math\.max\(from, to\) \+ 1\)/)
})

test("canvas mode shrinks below parsed panel width but never enlarges past it", () => {
  assert.match(main, /toolbarCanvas\.style\.setProperty\("--toolbar-width", String\(width\)\)/)
  assert.match(main, /toolbarCanvas\.style\.setProperty\("--toolbar-height", String\(height\)\)/)
  assert.match(main, /deviceShell\.style\.setProperty\("--canvas-width", `\$\{width\}px`\)/)
  assert.doesNotMatch(main, /canvasMaximumWidth/)
  assert.match(main, /function updateCanvasPanelStatus\(/)
  assert.match(css, /\.device-shell\.canvas-only\s*\{[^}]*width:\s*min\(100%, var\(--canvas-fit-width, var\(--canvas-width, 1080px\)\)\)/s)
  assert.doesNotMatch(css, /\.device-shell\.canvas-only\s*\{[^}]*920px/s)
  assert.match(
    css,
    /\.device-shell\.canvas-only #toolbar-preview\s*\{[^}]*aspect-ratio:\s*var\(--toolbar-width\)\s*\/\s*var\(--toolbar-height\)[^}]*height:\s*auto/s,
  )
  assert.match(
    css,
    /\.device-shell\.canvas-only #preview\s*\{[^}]*width:\s*100%[^}]*max-height:\s*none/s,
  )
  assert.match(html, /<div id="panel-viewport">\s*<canvas id="preview"/)
  assert.match(
    css,
    /\.device-shell\.canvas-only #panel-viewport\s*\{[^}]*aspect-ratio:\s*calc\(var\(--canvas-width\)\s*\/\s*1px\)\s*\/\s*var\(--panel-visible-height\)[^}]*overflow:\s*hidden/s,
  )
  assert.match(css, /\.device-shell\.canvas-only #preview\s*\{[^}]*transform:\s*translateY\(var\(--panel-crop-offset\)\)/s)
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
  assert.match(html, /data-context-action="delete"/)
  assert.match(main, /function copySelectedKeys\(\)/)
  assert.match(main, /function deleteSelectedKeys\(\)/)
})

test("window and about names match the GitHub project and include the version", () => {
  assert.match(html, /<title>BdiEditor v0\.6\.1<\/title>/)
  assert.match(html, /关于 BdiEditor v0\.6\.1/)
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
  assert.match(html, /id="about-update"[^>]*data-current-version="0\.6\.1"/)
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
  assert.match(html, /id="delete-tile"/)
  assert.match(html, /data-tile-mode="select"/)
  assert.match(html, /data-tile-mode="move"/)
  assert.match(main, /function moveSelectedTile\(/)
  assert.match(main, /duplicateTileSlice\(/)
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
  for (const id of ["resource-back", "select-tile", "move-tile", "new-tile", "delete-tile"]) {
    assert.match(html, new RegExp(`<button id="${id}" class="[^"]*toolbar-button[^"]*"[^>]*aria-label=`))
    assert.match(html, new RegExp(`<button id="${id}"[\\s\\S]*?<span class="[^"]*icon[^"]*system-symbol`))
  }
  assert.match(main, /function drawTilePreview\(/)
  assert.match(css, /#tile-preview-wrap\s*\{[^}]*width:\s*100%/s)
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

test("image style properties use large previews and text styles can be hidden", () => {
  assert.match(html, /data-background-style-field="NM_IMG"[^>]*\/>/)
  assert.match(html, /data-background-style-field="HL_IMG"[^>]*\/>/)
  assert.match(html, /data-text-style/)
  assert.match(main, /textStyleLabels/)
  assert.match(css, /\.image-resource-field[\s\S]*\.image-preview-button/)
  assert.match(css, /\.style-field\s*\{[^}]*grid-template-columns:\s*30% minmax\(0, 70%\)/s)
  assert.match(css, /\.compact-style-preview\s*\{[^}]*width:\s*100%[^}]*height:\s*44px/s)
  assert.match(css, /\.style-preview-pair \.style-preview-button\s*\{[^}]*flex:\s*1/s)
  assert.doesNotMatch(css, /\.image-resource-field \.style-field\s*\{[^}]*grid-template-columns:/s)
})

test("image previews preserve aspect ratio and open the TIL slice picker", () => {
  assert.match(main, /function openImageSlicePicker\(/)
  assert.match(main, /tileSliceAt\(pickerSlices/)
  assert.match(main, /styleImagePickerCanvas/)
  assert.match(main, /const scale = Math\.min\(canvas\.width \/ sourceWidth, canvas\.height \/ sourceHeight\)/)
  assert.match(main, /styleImagePickerCanvas\.height = Math\.max\(1, Math\.round\(pickerImage\.naturalHeight \* scale\)\)/)
  assert.match(css, /#style-image-picker-canvas/)
  assert.match(css, /#style-image-picker-canvas\s*\{[^}]*width:\s*auto[^}]*max-width:\s*80%/s)
  assert.match(css, /\.style-image-dialog\s*\{[^}]*width:\s*min\(80vw, 1200px\)/s)
  assert.match(main, /Math\.min\(960 \/ pickerImage\.naturalWidth, 640 \/ pickerImage\.naturalHeight\)/)
  assert.match(css, /#style-image-preview\[hidden\],[\s\S]*#style-image-picker\[hidden\]\s*\{\s*display:\s*none/s)
  assert.match(css, /\.style-image-dialog\s*\{[^}]*z-index:\s*200/s)
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
  assert.match(cleanup, /if \(styleImageDialog\.open\) styleImageDialog\.close\(\)/)
  assert.match(main, /async function loadArchive[\s\S]*?clearImageSlicePicker\(\)\s*archive = nextArchive/)
  assert.match(main, /styleImageDialog\.addEventListener\("close", clearImageSlicePicker\)/)
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

test("source file clicks open text files in the source inspector", () => {
  assert.match(main, /button\.addEventListener\("click", \(\) => selectFile\(path, "source"\)\)/)
  assert.match(main, /preferredSidebarView === "source" && \(archive\?\.isText\(path\) \|\| archive\?\.isBdaConfig\(path\)\)/)
})

test("every overview text document exposes editable non-key properties", () => {
  assert.match(html, /class="inspector-group document-fields" hidden/)
  assert.match(html, /id="document-fields"/)
  assert.match(main, /function populateDocumentInspector\(\)/)
  assert.match(main, /!\/\^KEY\\d\+\$\/\.test\(entry\.section\)/)
  assert.match(main, /selectedDocument\.set\(section, key, input\.value\)/)
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
  assert.match(main, /document\.documentElement\.classList\.toggle\("windows", navigator\.userAgent\.includes\("Windows"\)\)/)
  assert.match(css, /#skin-state-control\s*\{[^}]*left:\s*45px[^}]*transform:\s*none/s)
  assert.match(css, /#skin-state-control\[hidden\]\s*\{[^}]*display:\s*none\s*!important/s)
  assert.match(css, /\.source\s*\{[^}]*background:\s*var\(--sidebar\)[^}]*blur\(28px\)/s)
  assert.match(css, /\.workspace-status\s*\{[^}]*border-top:[^}]*background:\s*var\(--toolbar\)[^}]*font:\s*10px/s)
  assert.match(css, /#event-log\s*\{[^}]*background:\s*transparent[^}]*font:\s*inherit/s)
  assert.match(css, /#panel-status\s*\{[^}]*color:\s*inherit[^}]*font:\s*inherit/s)
  assert.match(css, /:root\.macos\[data-window-material="on"\][\s\S]*?\.app-dialog[\s\S]*?backdrop-filter:/)
  assert.match(css, /:root\.windows\[data-window-material="on"\]\s+\*\s*\{[^}]*backdrop-filter:\s*none\s*!important/s)
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
  assert.ok(html.indexOf('id="panel-scale"') < html.indexOf('class="toolbar-divider"'))
  assert.match(main, /availableSkinStates\(\.\.\.skinStateDocuments\(\)\)/)
  assert.doesNotMatch(css, /#preview\s*\{[^}]*aspect-ratio:\s*1125\s*\/\s*650/s)
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
  assert.match(main, /document\.documentElement\.classList\.toggle\("macos", navigator\.userAgent\.includes\("Macintosh"\)\)/)
  assert.match(css, /:root\.macos\s*\{[^}]*--titlebar-height:\s*86px/s)
  assert.match(html, /<header class="titlebar" data-tauri-drag-region>/)
  assert.match(html, /<div class="document-title" data-tauri-drag-region>/)
  assert.match(html, /<span class="spacer" data-tauri-drag-region><\/span>/)
})
