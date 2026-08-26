import assert from "node:assert/strict"
import fs from "node:fs"
import { resolveSafeAreaTop, resolveViewportFrame } from "../src/safe-area.ts"

const css = fs.readFileSync("src/style.css", "utf8")
const main = fs.readFileSync("src/main.ts", "utf8")
const moduleSource = fs.readFileSync("src/safe-area.ts", "utf8")

assert.equal(resolveSafeAreaTop({ measured: 47, cached: 0, keyboardOpen: false }).top, 47)
assert.equal(resolveSafeAreaTop({ measured: 47, cached: 0, keyboardOpen: false }).cached, 47)
assert.equal(resolveSafeAreaTop({ measured: 0, cached: 47, keyboardOpen: true }).top, 47)
assert.equal(resolveSafeAreaTop({ measured: 0, cached: 47, keyboardOpen: false }).top, 0)
assert.equal(resolveSafeAreaTop({ measured: 34, cached: 47, keyboardOpen: true }).top, 34)
assert.equal(resolveSafeAreaTop({ measured: 0, cached: 0, keyboardOpen: true }).top, 0)
assert.equal(resolveSafeAreaTop({ measured: 0, cached: 47, keyboardOpen: true, viewportOffsetTop: 47 }).top, 47)

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
assert.doesNotMatch(moduleSource, /scrollIntoView/)
assert.doesNotMatch(moduleSource, /window\.scrollTo\(0, 0\)/)

console.log("✓ 输入法弹出后保持顶部安全区，并给输入框让出可视区域")
