import assert from "node:assert/strict"
import fs from "node:fs"
import { resolveSafeAreaTop } from "../src/safe-area.ts"

const css = fs.readFileSync("src/style.css", "utf8")
const main = fs.readFileSync("src/main.ts", "utf8")
const moduleSource = fs.readFileSync("src/safe-area.ts", "utf8")

assert.equal(resolveSafeAreaTop({ measured: 47, cached: 0, keyboardOpen: false }).top, 47)
assert.equal(resolveSafeAreaTop({ measured: 47, cached: 0, keyboardOpen: false }).cached, 47)
assert.equal(resolveSafeAreaTop({ measured: 0, cached: 47, keyboardOpen: true }).top, 47)
assert.equal(resolveSafeAreaTop({ measured: 0, cached: 47, keyboardOpen: false }).top, 0)
assert.equal(resolveSafeAreaTop({ measured: 34, cached: 47, keyboardOpen: true }).top, 34)
assert.equal(resolveSafeAreaTop({ measured: 0, cached: 0, keyboardOpen: true }).top, 0)

assert.match(css, /--safe-area-top:\s*env\(safe-area-inset-top, 0px\)/)
assert.match(css, /--titlebar-height:\s*calc\(52px \+ var\(--safe-area-top\)\)/)
assert.match(css, /padding:\s*calc\(6px \+ var\(--safe-area-top\)\)/)
assert.match(css, /\.titlebar \{[\s\S]*?position:\s*sticky;[\s\S]*?padding-top:\s*calc\(6px \+ var\(--safe-area-top\)\)/)
assert.doesNotMatch(css, /--titlebar-height:\s*calc\([^)]*env\(safe-area-inset-top/)
assert.doesNotMatch(css, /padding(?:-top)?:\s*calc\([^)]*env\(safe-area-inset-top/)

assert.match(main, /import \{ installSafeAreaLock \} from "\.\/safe-area\.ts"/)
assert.match(main, /installSafeAreaLock\(\)/)
assert.match(moduleSource, /visualViewport/)
assert.match(moduleSource, /isTextInput\(document\.activeElement\)/)

console.log("✓ 输入法弹出后仍保持顶部安全区避让")
