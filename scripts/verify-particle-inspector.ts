import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const main = readFileSync(new URL("../src/main.ts", import.meta.url), "utf8")
const preview = readFileSync(new URL("../src/preview.ts", import.meta.url), "utf8")
const style = readFileSync(new URL("../src/style.css", import.meta.url), "utf8")

assert.match(main, /particleFieldGroups/)
assert.match(main, /particle-preview-toolbar/)
assert.match(main, /particle-slider-input/)
assert.match(main, /particle-range-inputs/)
assert.match(main, /particle-image-previews/)
assert.match(main, /preview\.setParticlePreview\(parseLegacyParticleEmitter/)
assert.match(preview, /setParticlePreview\(emitter\?: LegacyParticleEmitter\)/)
assert.match(preview, /emitter\.velocity/)
assert.match(style, /\.particle-preview-toolbar/)

console.log("✓ 粒子检查器：画布重播、滑杆、范围控件与图片预览已接入")
