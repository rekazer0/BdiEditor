import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
import vm from 'node:vm'
const ast = ts.createSourceFile('preview.ts', fs.readFileSync(new URL('../src/preview.ts', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true)
const preview = ast.statements.find(n => ts.isClassDeclaration(n) && n.name.text === 'Preview')
const method = (name, params) => vm.runInNewContext(ts.transpile(`(function(${params}) ${preview.members.find(n => n.name?.getText(ast) === name).body.getText(ast)})`))
const startRender = method('startRender', '')
const setLocked = method('setPointerInteractionLocked', 'locked')

test('canvas pan defers repaints and paints once when it ends', () => {
  const calls = []
  const target = { renderDeferred: false, renderPending: false, cancelPointerInteraction: () => calls.push('cancel'), draw: () => calls.push('draw'), render: () => (calls.push('render'), Promise.resolve()) }
  setLocked.call(target, true)
  startRender.call(target)
  startRender.call(target)
  assert.deepEqual(calls, ['cancel'])
  assert.equal(target.renderPending, false)
  setLocked.call(target, false)
  assert.deepEqual(calls, ['cancel', 'draw'])
  setLocked.call(target, false)
  assert.deepEqual(calls, ['cancel', 'draw'])
  startRender.call(target)
  assert.deepEqual(calls, ['cancel', 'draw', 'render'])
})

test('a pan with nothing to repaint does not redraw on release', () => {
  const calls = []
  const target = { renderDeferred: false, cancelPointerInteraction() {}, draw: () => calls.push('draw') }
  setLocked.call(target, true)
  setLocked.call(target, false)
  assert.deepEqual(calls, [])
})
