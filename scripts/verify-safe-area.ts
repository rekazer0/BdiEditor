import assert from "node:assert/strict"
import fs from "node:fs"
import { isKeyboardViewportOpen, resolveViewportFrame } from "../src/safe-area.ts"

const css = fs.readFileSync("src/style.css", "utf8")
const main = fs.readFileSync("src/main.ts", "utf8")
const moduleSource = fs.readFileSync("src/safe-area.ts", "utf8")

assert.equal(isKeyboardViewportOpen({ viewportHeight: 430, baselineHeight: 844 }), true)
assert.equal(isKeyboardViewportOpen({ viewportHeight: 780, baselineHeight: 844 }), false)
assert.equal(isKeyboardViewportOpen({ viewportHeight: 844, baselineHeight: 844 }), false)

assert.deepEqual(
  resolveViewportFrame({
    viewportHeight: 420,
    viewportOffsetTop: 47,
    viewportOffsetLeft: 0,
    viewportWidth: 390,
    layoutHeight: 844,
    layoutWidth: 390,
  }),
  { height: 420, width: 390, offsetTop: 47, offsetLeft: 0 },
)

assert.match(css, /--safe-area-top:\s*env\(safe-area-inset-top, 0px\)/)
assert.match(css, /@media \(max-width: 760px\) and \(orientation: portrait\)[\s\S]*--titlebar-height:\s*calc\(50px \+ var\(--safe-area-top\)\)/)
assert.doesNotMatch(
  css.slice(css.indexOf("@media (max-width: 760px) and (orientation: portrait)")),
  /--safe-area-top:\s*24px|--titlebar-height:\s*96px/,
  "移动端标题栏不应硬编码顶部安全区或总高度",
)
assert.match(css, /:root\[data-app-theme="dark"\]\s*\{\s*background:\s*#1c1f22/)
assert.match(css, /--titlebar-height:\s*calc\(52px \+ var\(--safe-area-top\)\)/)
assert.match(css, /padding:\s*calc\(6px \+ var\(--safe-area-top\)\)/)
assert.match(css, /height:\s*calc\(100vh - var\(--titlebar-height\)\)/)
assert.doesNotMatch(css, /height:\s*calc\(var\(--app-height, 100dvh\) - var\(--titlebar-height\)\)/)
assert.doesNotMatch(css, /:root\[data-keyboard-open="true"\] \.workspace/)
assert.doesNotMatch(css, /:root\[data-keyboard-open="true"\] \.mobile-workspace-tabs/)
assert.doesNotMatch(css, /:root\[data-keyboard-open="true"\] :is\(aside, \.source\)/)
assert.doesNotMatch(css, /--titlebar-height:\s*calc\([^)]*env\(safe-area-inset-top/)
assert.doesNotMatch(css, /padding(?:-top)?:\s*calc\([^)]*env\(safe-area-inset-top/)
assert.doesNotMatch(css, /\.titlebar \{[^}]*position:\s*sticky/)

assert.match(main, /import \{ installSafeAreaLock \} from "\.\/safe-area\.ts"/)
assert.match(main, /installSafeAreaLock\(\)/)
assert.match(moduleSource, /visualViewport/)
assert.doesNotMatch(moduleSource, /setProperty\("--safe-area-top"/)
assert.match(moduleSource, /dataset\.keyboardOpen/)
assert.match(moduleSource, /scroller\.scrollTop/)
assert.match(moduleSource, /keyboardWasOpen && !keyboardOpen/)
assert.match(moduleSource, /active\.blur\(\)/)
assert.match(moduleSource, /window\.scrollTo\(0, 0\)/)
assert.match(moduleSource, /\[0, 120, 360\]/)
assert.doesNotMatch(moduleSource, /scrollIntoView/)
assert.doesNotMatch(moduleSource, /--app-height|--vv-top|--vv-left|--vv-width/)

console.log("✓ 输入法弹出时保持预览与安全区，收起后复位顶部点击区域")
