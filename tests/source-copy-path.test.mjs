import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const source = ts.createSourceFile('main.ts', readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true)
const fn = source.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === 'sourceCopyPath')
const context = vm.createContext({})
vm.runInContext(ts.transpile(fn.getText(source), { target: ts.ScriptTarget.ES2022 }), context)

test('pasting a copy onto its own location gets a Finder-style 副本 name', () => {
  const taken = new Set(['light/skin/res/a.png', 'light/skin/res/a 副本.png'])
  assert.equal(context.sourceCopyPath('light/skin/res/b.png', (path) => taken.has(path)), 'light/skin/res/b 副本.png')
  assert.equal(context.sourceCopyPath('light/skin/res/a.png', (path) => taken.has(path)), 'light/skin/res/a 副本 2.png')
  assert.equal(context.sourceCopyPath('Info.txt', () => false), 'Info 副本.txt')
  assert.equal(context.sourceCopyPath('light/skin/port', () => false), 'light/skin/port 副本')
  assert.equal(context.sourceCopyPath('.hidden', () => false), '.hidden 副本')
})
