import assert from "node:assert/strict"
import fs from "node:fs"
import { isKeyboardViewportOpen, resolveSafeAreaTop, resolveViewportFrame } from "../src/safe-area.ts"

const css = fs.readFileSync("src/style.css", "utf8")
const main = fs.readFileSync("src/main.ts", "utf8")
const moduleSource = fs.readFileSync("src/safe-area.ts", "utf8")

assert.equal(resolveSafeAreaTop({ measured: 47, cached: 0 }).top, 47)
assert.equal(resolveSafeAreaTop({ measured: 47, cached: 0 }).cached, 47)
assert.equal(resolveSafeAreaTop({ measured: 0, cached: 47 }).top, 47)
assert.equal(resolveSafeAreaTop({ measured: 34, cached: 47 }).top, 34)
assert.equal(resolveSafeAreaTop({ measured: 0, cached: 0 }).top, 0)

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
assert.match(moduleSource, /dataset\.keyboardOpen/)
assert.match(moduleSource, /scroller\.scrollTop/)
assert.match(moduleSource, /keyboardWasOpen && !keyboardOpen/)
assert.match(moduleSource, /active\.blur\(\)/)
assert.match(moduleSource, /window\.scrollTo\(0, 0\)/)
assert.match(moduleSource, /\[0, 120, 360\]/)
assert.doesNotMatch(moduleSource, /scrollIntoView/)
assert.doesNotMatch(moduleSource, /--app-height|--vv-top|--vv-left|--vv-width/)

console.log("✓ 输入法弹出时保持预览与安全区，收起后复位顶部点击区域")
