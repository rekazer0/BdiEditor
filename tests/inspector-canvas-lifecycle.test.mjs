import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const source = ts.createSourceFile('inspector-shell.ts', readFileSync(new URL('../src/inspector-shell.ts', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true)

test('inspector removals release detached bitmaps without clearing canvases reused in the same update', () => {
  const cleanup = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'releaseRemovedCanvases')
  assert.ok(cleanup, 'removed inspector canvases need explicit bitmap disposal')
  class Element {
    constructor(children = [], isConnected = false) { this.children = children; this.isConnected = isConnected }
    querySelectorAll() { return this.children }
  }
  class Canvas extends Element { width = 256; height = 128 }
  const context = vm.createContext({ Element, HTMLCanvasElement: Canvas })
  vm.runInContext(ts.transpile(cleanup.getText(source)), context)
  const nested = new Canvas(), direct = new Canvas(), reused = new Canvas([], true)
  context.releaseRemovedCanvases([
    { removedNodes: [new Element([nested, reused]), direct, { nodeType: 3 }] },
  ])
  for (const canvas of [nested, direct]) assert.equal(canvas.width * canvas.height, 0)
  assert.equal(reused.width * reused.height, 256 * 128, 'synchronous thumbnail recycling keeps the current pixels')
})

test('canvas disposal runs for every mutation batch, including batches sharing a decoration frame', () => {
  const init = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'initInspectorShell')
  const calls = [], frames = []
  let notify
  const root = { addEventListener() {} }
  const context = vm.createContext({
    renderEmptyState() {}, decorateSections() {}, collectRows() {}, bindFilter() {}, revealTruncatedLabel() {},
    onInspectorInput() {}, inspector: () => root, filterQuery: '',
    document: { querySelectorAll: () => [root] },
    releaseRemovedCanvases: records => calls.push(records),
    requestAnimationFrame: callback => frames.push(callback),
    MutationObserver: class { constructor(callback) { notify = callback } observe() {} },
  })
  vm.runInContext(ts.transpile(init.getText(source).replace(/^export /, '')), context)
  context.initInspectorShell()
  const first = [{ removedNodes: [] }], second = [{ removedNodes: [] }]
  notify(first)
  notify(second)
  assert.deepEqual(calls, [first, second])
  assert.equal(frames.length, 1, 'decoration still coalesces into one frame')
})
