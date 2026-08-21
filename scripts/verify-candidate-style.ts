import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import type { VisualResolver } from "../src/atlas.ts"
import {
  candidateInputForegroundStyle,
  resolveCandidateInputStyle,
  resolveCandidateTextVisuals,
} from "../src/candidate-style.ts"
import { keyboardPreviewGeometry } from "../src/devices.ts"
import { IniDocument } from "../src/ini.ts"
import { resolvePanelConfig } from "../src/keyboard.ts"
import { candidatePreview } from "../src/simulation.ts"

function resolver(fontSize?: number): VisualResolver {
  return {
    async resolve() { return undefined },
    resolveText() { return fontSize ? { fontSize } : undefined },
    async resolveToolbarImages() { return [] },
  }
}

const ios = IniDocument.parse(`
[INPUT]
BACK_STYLE=240
FORE_STYLE=241
`)
assert.deepEqual(resolveCandidateInputStyle(ios, resolver(60), 1125), {
  foregroundStyle: "241",
  height: 76,
})

const scandOverride = IniDocument.parse(`
[INPUT]
BACK_STYLE=240
FORE_STYLE=241
[SCAND]
BACK_STYLE=250,251
INPUT_STYLE=252,253
`)
assert.deepEqual(resolveCandidateInputStyle(scandOverride, resolver(54), 1125), {
  foregroundStyle: "252,253",
  height: 70,
})

const legacyScand = IniDocument.parse(`
[SCAND]
FORE_STYLE=1
`)
assert.equal(candidateInputForegroundStyle(legacyScand), "1")
assert.deepEqual(resolveCandidateInputStyle(legacyScand, resolver(46), 1125), {
  foregroundStyle: "1",
  height: 62,
})
assert.equal(resolveCandidateInputStyle(ios, resolver(), 1125).height, 0)

const generalPanel = IniDocument.parse("[PANEL]\nSIZE=480,312\n")
const inheritedSymbolPanel = resolvePanelConfig(
  IniDocument.parse("[PANEL]\nKEY_NUM=7\n"),
  generalPanel,
  IniDocument.parse(""),
  372,
)
assert.equal(inheritedSymbolPanel.height, 372)
const sizedSymbolPanel = resolvePanelConfig(
  IniDocument.parse("[PANEL]\nSIZE=480,372\n"),
  generalPanel,
  IniDocument.parse(""),
  372,
)
assert.equal(sizedSymbolPanel.height, 372)
const undersizedSymbolPanel = resolvePanelConfig(
  IniDocument.parse("[PANEL]\nSIZE=480,350\n"),
  generalPanel,
  IniDocument.parse(""),
  372,
)
assert.equal(undersizedSymbolPanel.height, 372)

const geometry = keyboardPreviewGeometry(
  { width: 1206, height: 2622, family: "iphone" },
  "port",
  1125,
  595,
  194,
  61,
)
const scale = 1206 / 1125
assert.equal(geometry.topInsetHeight, 38)
assert.equal(Math.round((geometry.candidateHeight - geometry.topInsetHeight) / scale), 194)
assert.equal(Math.round(geometry.candidateInsetHeight / scale), 61)
assert.equal(Math.round(geometry.candidateContentHeight / scale), 133)
assert.equal(
  geometry.totalHeight,
  keyboardPreviewGeometry(
    { width: 1206, height: 2622, family: "iphone" },
    "port",
    1125,
    595,
    194,
    0,
  ).totalHeight,
)
assert.equal(
  geometry.totalHeight,
  keyboardPreviewGeometry(
    { width: 1206, height: 2622, family: "iphone" },
    "port",
    1125,
    595 + 194,
    0,
    0,
  ).totalHeight,
)

const candidate = IniDocument.parse(`
[CAND]
FORE_STYLE=10
FIRST_FORE=20
`)
const general = IniDocument.parse("[SCAND]\nSCAND_STYLE=30\n")
const textResolver = {
  ...resolver(),
  resolveText(style: string) { return style ? { color: style } : undefined },
}
assert.deepEqual(resolveCandidateTextVisuals(candidate, general, textResolver), {
  normal: { color: "10" },
  first: { color: "20" },
})
assert.deepEqual(resolveCandidateTextVisuals(undefined, general, textResolver), {
  normal: { color: "30" },
  first: undefined,
})

const css = readFileSync(new URL("../src/style.css", import.meta.url), "utf8")
const main = readFileSync(new URL("../src/main.ts", import.meta.url), "utf8")
assert.equal(
  [...main.matchAll(/(?:generalConfig\.height|generalPanelHeight) \+ candidateContentHeight \+ symbolInputHeight/g)].length,
  2,
)
assert.match(main, /const layoutSize = layoutDocument\.get\("PANEL", "SIZE"\)/)
assert.match(
  css,
  /#candidate-area\[hidden\] \+ #panel-viewport #preview \{[^}]*width:\s*100%;[^}]*height:\s*100%;/s,
)
const candidateWordsCss = [...css.matchAll(/#candidate-words \{([^}]*)}/g)]
  .map((match) => match[1])
  .find((rule) => rule.includes("display: flex")) ?? ""
assert.match(candidateWordsCss, /align-items:\s*center/)
assert.match(candidateWordsCss, /gap:\s*var\(--candidate-cell-width,\s*0\)/)
assert.match(css, /margin-inline-start:\s*calc\(var\(--candidate-first-gap,[^)]*\) \+ var\(--candidate-cell-inset,/)
assert.doesNotMatch(css, /#candidate-words > span \{[^}]*flex:/s)
assert.match(
  main,
  /function devicePreviewTransparent\(\): boolean \{\s*return true\s*\}/,
)
assert.match(css, /\.keyboard-dock \{[^}]*background:\s*var\(--phone-keyboard-glass\)/s)
assert.match(css, /\.keyboard-dock \{[^}]*backdrop-filter:\s*saturate\(165%\) blur\(20px\)/s)
assert.match(
  css,
  /\.device-shell\.canvas-only \.keyboard-dock \{[^}]*background:\s*transparent;[^}]*box-shadow:\s*none;[^}]*backdrop-filter:\s*none;/s,
)
assert.doesNotMatch(main, /candidateInputBackground/)
assert.match(main, /const REFERENCE_PHONE_WIDTH_SCALE = 1/)
assert.match(main, /spec\.width \* REFERENCE_PHONE_WIDTH_SCALE/)
assert.match(
  main,
  /const referenceFrame = spec\?\.family === "iphone" && orientation\.value === "port"/,
)
assert.doesNotMatch(
  main,
  /const referenceFrame = [^\n]*theme\.value/,
)
assert.match(
  css,
  /data-reference-frame="true"[^}]*\.device-screen \{[^}]*inset:\s*0;[^}]*border-radius:\s*14% \/ 6\.44%;/s,
)
assert.match(css, /data-reference-frame="true"[^}]*::after \{[^}]*box-shadow:\s*inset 0 0 0 4px/s)
assert.match(
  css,
  /data-reference-frame="true"[^}]*\.device-screen::before \{[^}]*height:\s*3\.65%;[^}]*top:\s*1\.89%;[^}]*border-radius:\s*999px;/s,
)
assert.match(css, /data-reference-frame="true"\]\[data-theme="light"\][^{]*\.device-reference-background \{[^}]*iphone-notes-reference-blank\.png/s)
assert.match(css, /data-reference-frame="true"\]\[data-theme="dark"\][^{]*\.device-reference-background \{[^}]*iphone-notes-reference-dark-blank\.png/s)
assert.doesNotMatch(css, /iphone-keyboard-ambient/)
assert.doesNotMatch(css, /data-reference-frame="true"[^}]*\.keyboard-dock::before/s)
assert.match(
  css,
  /data-reference-frame="true"\]\[data-theme="light"\][^{]*\.device-reference-background \{[^}]*radial-gradient[^}]*iphone-notes-reference-blank\.png/s,
)
assert.match(
  css,
  /data-reference-frame="true"\]\[data-theme="dark"\][^{]*\.device-reference-background \{[^}]*radial-gradient[^}]*iphone-notes-reference-dark-blank\.png/s,
)
assert.match(css, /data-reference-frame="true"[^}]*\.keyboard-dock::after \{[^}]*backdrop-filter:\s*saturate\(118%\) blur\(34px\)/s)
assert.match(css, /data-reference-frame="true"[^}]*\.keyboard-dock::after \{[^}]*border:\s*1px solid rgb\(255 255 255 \/ 34%\)/s)
assert.match(css, /data-reference-frame="true"[^}]*\.keyboard-dock::after \{[^}]*border-radius:\s*inherit;[^}]*box-sizing:\s*border-box;/s)
assert.match(css, /data-reference-frame="true"[^}]*\.keyboard-accessories \{[^}]*visibility:\s*visible;[^}]*background:\s*transparent;/s)

assert.deepEqual(candidatePreview("ni", 2, "zh"), {
  composing: true,
  input: "ni",
  candidates: ["你好", "不会", "不回", "不好", "你会"],
})
assert.deepEqual(candidatePreview("中文", 2, "zh"), {
  composing: true,
  input: "中文",
  candidates: ["你好", "不会", "不回", "不好", "你会"],
})

console.log("✓ 拼音和候选字按官方样式及几何规则渲染")
