import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const source = ts.createSourceFile('main.ts', readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true)
const names = new Set(['renderStyleReferenceRows', 'refreshStyleReferenceThumbnail', 'styleReferenceForeground'])
const code = source.statements.filter(node => ts.isFunctionDeclaration(node) && names.has(node.name?.text)).map(node => node.getText(source)).join('\n')
class Element {
  children = []
  dataset = {}
  classList = { toggle() {} }
  listeners = {}
  value = ''
  constructor(tag = '') { this.tag = tag }
  append(...items) { this.children.push(...items) }
  replaceChildren() { this.children = [] }
  setAttribute() {}
  removeAttribute() {}
  addEventListener(name, callback) { this.listeners[name] = callback }
  dispatchEvent(event) { this.listeners[event.type]?.(event) }
  closest() { return this }
  cloneNode() { return new Element('input') }
  querySelectorAll(tag) { return this.children.flatMap(child => [...(child.tag === tag ? [child] : []), ...child.querySelectorAll(tag)]) }
}
const drawn = []
let pickerTarget
const context = vm.createContext({
  document: { createElement: tag => new Element(tag) },
  retinaThumbnail: canvas => canvas,
  styleReferenceDrawIDs: new WeakMap(),
  visualResolver: () => ({ resolve: async (id, highlighted) => ({ id, highlighted }) }),
  drawVisualPreview: (canvas, layers) => drawn.push(layers),
  openStylePicker: target => { pickerTarget = target },
  Event,
})
vm.runInContext(ts.transpile(code, { target: ts.ScriptTarget.ES2022 }), context)
for (const key of ['FORE_STYLE', 'BACK_STYLE']) {
  const input = new Element('input')
  input.value = '11, 22,11'
  const button = new Element('span')
  drawn.length = 0
  await context.refreshStyleReferenceThumbnail(button, input, key)
  assert.equal(button.children.length, 3)
  assert.deepEqual(drawn.map(layers => layers.map(visual => visual.id).join(',')), ['11', '11', '22', '22', '11', '11'])
  assert.deepEqual(Array.from(button.children, row => row.children[0].value), ['11', '22', '11'])
  button.children[1].children[1].children[0].listeners.click({})
  assert.equal(pickerTarget.value, '22')
  pickerTarget.value = '33'
  pickerTarget.dispatchEvent(new Event('change'))
  assert.equal(input.value, '11,33,11')
  const numberInput = button.children[0].children[0]
  numberInput.value = '55'
  numberInput.dispatchEvent(new Event('change'))
  assert.equal(input.value, '55,33,11')
  input.value = '44'
  await context.refreshStyleReferenceThumbnail(button, input, key)
  assert.equal(button.children.length, 1)
}
console.log('Style reference rows: foreground/background, duplicate refs, independent replacement and row refresh passed')
