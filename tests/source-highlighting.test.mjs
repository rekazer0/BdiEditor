import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { StreamLanguage, syntaxTree } from '@codemirror/language'
import { properties } from '@codemirror/legacy-modes/mode/properties'
import { EditorState } from '@codemirror/state'
import { highlightTree, classHighlighter } from '@lezer/highlight'

const source = fs.readFileSync(new URL('../src/source-editor.ts', import.meta.url), 'utf8')
const ast = ts.createSourceFile('source-editor.ts', source, ts.ScriptTarget.Latest, true)
const declaration = ast.statements.flatMap(s => s.declarationList?.declarations ?? []).find(d => d.name.getText(ast) === 'iniLanguage')
const language = vm.runInNewContext(ts.transpile(declaration.initializer.getText(ast)), { StreamLanguage, properties })

test('INI highlights sections, keys, numeric values, actions, colors and text', () => {
  for (const [doc, value, style] of [
    ['[KEYBOARD]', '[KEYBOARD]', 'tok-heading'],
    ['PADDING = 6', 'PADDING', 'tok-variableName tok-definition'],
    ['PADDING = 6', '=', 'tok-operator'],
    ['VIEW_RECT = 0,0,1080,641', '0,0,1080,641', 'tok-number'],
    ['FONT_SIZE = -1.5', '-1.5', 'tok-number'],
    ['NM_COLOR = #FF1B1E23', '#FF1B1E23', 'tok-number'],
    ['CENTER = F1', 'F1', 'tok-number'],
    ['UP = S12', 'S12', 'tok-number'],
    ['FONT_NAME = PingFang SC', 'PingFang SC', 'tok-string'],
    ['BACK_IMAGE = key_normal.png', 'key_normal.png', 'tok-string'],
    ['SHOW = 分词', '分词', 'tok-string'],
    ['; comment', '; comment', 'tok-comment'],
    ['HOLD =\nSHOW = 分词', '分词', 'tok-string'],
  ]) {
    const state = EditorState.create({ doc, extensions: [language] })
    const spans = []
    highlightTree(syntaxTree(state), classHighlighter, (from, to, classes) => spans.push({ text: doc.slice(from, to).trim(), classes }))
    assert(spans.some(s => s.text === value && s.classes === style), JSON.stringify({ doc, value, style, spans }))
  }
})
