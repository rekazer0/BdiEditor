import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const reviewSource = readFileSync(new URL('../src/ai-draft-review.ts', import.meta.url), 'utf8')
const review = vm.createContext({ exports: {} })
vm.runInContext(ts.transpile(reviewSource, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }), review)
const { changedJsonSections, draftExcerpt } = review.exports

test('compact BDA JSON reports only modified, added and removed blocks', () => {
  assert.equal(JSON.stringify(changedJsonSections('{"a":1,"b":2,"gone":true}', '{"a":1,"b":3,"new":true}')), '["b","gone","new"]')
})
test('escaped JSON keys do not throw and unchanged JSON yields no sections', () => {
  const before = JSON.stringify({ 'key"name': 'old' })
  const after = JSON.stringify({ 'key"name': 'new' })
  assert.equal(changedJsonSections(before, after)[0], 'key"name')
  assert.equal(changedJsonSections(before, before).length, 0)
})
test('review excerpt preserves final changes instead of silently showing only four lines', () => {
  const before = 'same\n' + Array.from({ length: 12 }, (_, i) => `old${i}`).join('\n') + '\nend'
  const after = before.replaceAll('old', 'new')
  const result = draftExcerpt(before, after)
  assert.match(result.text, /new11/)
  assert.equal(result.omitted, false)
})
test('large and long-line diffs explicitly disclose truncation', () => {
  assert.equal(draftExcerpt('a', 'x'.repeat(501)).omitted, true)
  const result = draftExcerpt('', Array.from({ length: 80 }, (_, i) => String(i)).join('\n'))
  assert.equal(result.omitted, true)
  assert.match(result.text, /完整内容/)
})

const main = ts.createSourceFile('main.ts', readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true)
const functions = main.statements.filter(node => ts.isFunctionDeclaration(node) && ['applyAiDesignDraft', 'validatedAiChanges'].includes(node.name?.text)).map(node => node.getText(main)).join('\n')
function setup(editing = true, stale = false) {
  const target = { format: 'bdi', getBytes: () => undefined }
  const draft = { target, changes: [{}], drafts: [{ path: 'keys.ini', syntax: 'ini', before: 'old', after: 'new' }], conversation: ['accepted'] }
  let commits = 0
  const context = vm.createContext({
    archive: target, aiDesignDraft: draft, aiDesignBusy: false, aiDesignConversation: [],
    aiDesignStatus: { textContent: '' }, aiDesignPanel: { dataset: {} },
    isEditing: () => editing, source: { commit() {} },
    aiEditableProjectFiles: () => [{ path: 'keys.ini', syntax: 'ini', text: stale ? 'manual edit' : 'old' }],
    commitBatch: () => { commits++ },
    setAiDesignDraft: value => { context.aiDesignDraft = value },
    aiDesignErrorMessage: error => error.message,
    selectedPath: '', layoutPath: '', renderFiles() {}, refreshPreview() {}, populateKeyInspector() {}, updateDirty() {},
  })
  vm.runInContext(ts.transpile(functions, { target: ts.ScriptTarget.ES2022 }), context)
  return { context, draft, commits: () => commits }
}
test('applying stale draft preserves manual edits and retains review', () => {
  const s = setup(true, true)
  s.context.applyAiDesignDraft()
  assert.equal(s.commits(), 0)
  assert.equal(s.context.aiDesignDraft, s.draft)
  assert.match(s.context.aiDesignStatus.textContent, /文件已变化/)
  assert.equal(s.context.aiDesignConversation.length, 0)
})
test('read-only mode cannot apply a draft', () => {
  const s = setup(false)
  s.context.applyAiDesignDraft()
  assert.equal(s.commits(), 0)
  assert.equal(s.context.aiDesignDraft, s.draft)
})
test('accepted draft commits once and advances the conversation', () => {
  const s = setup()
  s.context.applyAiDesignDraft()
  s.context.applyAiDesignDraft()
  assert.equal(s.commits(), 1)
  assert.equal(s.context.aiDesignDraft, undefined)
  assert.equal(s.context.aiDesignConversation[0], 'accepted')
})
test('project switch drops old draft without writing to new project', () => {
  const s = setup()
  s.context.archive = {}
  s.context.applyAiDesignDraft()
  assert.equal(s.commits(), 0)
  assert.equal(s.context.aiDesignDraft, undefined)
})
