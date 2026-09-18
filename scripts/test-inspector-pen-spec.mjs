import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const shell = readFileSync(new URL('../src/inspector-shell.ts', import.meta.url), 'utf8')
const fidelity = readFileSync(new URL('../src/inspector-fidelity.css', import.meta.url), 'utf8')
const css = [
  readFileSync(new URL('../src/pen-inspector.css', import.meta.url), 'utf8'),
  fidelity,
  readFileSync(new URL('../src/pen-design-application.css', import.meta.url), 'utf8'),
].join('\n')
const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')
const icons = readFileSync(new URL('../src/inspector-icons.ts', import.meta.url), 'utf8')

test('inspector shell maps Pen spec kinds and section hints', () => {
  assert.match(shell, /export function setInspectorKind/)
  assert.match(shell, /keys\.\*\.layout/)
  assert.match(shell, /已改 \$\{count\}/)
  assert.match(shell, /if \(hint\) head\.title = hint/)
  assert.match(shell, /chevron-down/)
  assert.doesNotMatch(shell, /document.createElement\("details"\)/)
  assert.match(fidelity, /pin-mode-chip.*display: none/)
})

test('main wires BDS/BDA kind onto the inspector', () => {
  assert.match(main, /setInspectorKind\(archive\?\.format === "bda" \? "bda" : archive \? "bds" : ""\)/)
})

test('CSS locks 30px rows and BDS/BDA chips from 属性检查器.pen', () => {
  assert.match(css, /--inspector-row-height: 30px/)
  assert.match(css, /--inspector-field-height: 30px/)
  assert.match(css, /--inspector-hint-size: 9.5px/)
  assert.match(css, /data-inspector-kind="bds"/)
  assert.match(css, /data-inspector-kind="bda"/)
  assert.match(css, /--pin-sel: #ff6b2c/)
  assert.match(css, /--pin-accent: #2f6bff/)
  assert.match(css, /\.pin-hint/)
  assert.match(css, /\.pin-mode-chip/)
  assert.match(css, /height: 30px !important/)
  assert.match(css, /font: 400 9\.5px\/1 var\(--font-mono\)/)
  assert.doesNotMatch(fidelity, /geometry-fields[\s\S]{0,400}height: 34px/)
})

test('rail icons match 属性检查器.pen lucide names', () => {
  assert.match(icons, /"layout-grid": LayoutGrid/)
  assert.match(icons, /palette: Palette/)
  assert.match(icons, /type: Type/)
  assert.match(icons, /zap: Zap/)
  assert.match(icons, /images: Images/)
})
