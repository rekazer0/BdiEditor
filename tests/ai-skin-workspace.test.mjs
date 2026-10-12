import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AiSkinWorkspace } from '../src/ai-skin-workspace.ts'

test('read_ini_sections returns named style sections and unlocks writes', () => {
  const css = '[GLOBAL]\nSTYLE_NUM=72\n[STYLE72]\nSHOW=ABC\nNM_COLOR=333333\n'
  const workspace = new AiSkinWorkspace([{ path: 'light/skin/port/res/default.css', syntax: 'ini', text: css }])
  const path = 'light/skin/port/res/default.css'
  assert.throws(() => workspace.setIniValue(path, 'STYLE72', 'SHOW', '你好'))
  assert.deepEqual(workspace.readIniSections(path, ['STYLE72', 'STYLE1']), {
    sections: { STYLE72: { SHOW: 'ABC', NM_COLOR: '333333' } },
    missing: ['STYLE1'],
  })
  assert.equal(workspace.setIniValue(path, 'STYLE72', 'SHOW', '你好'), 'updated')
  assert.match(workspace.changes()[0].after, /SHOW=你好/)
})

test('add_ini_section and remove_ini_sections keep KEY numbering and counters in sync', () => {
  const ini = '[PANEL]\nKEY_NUM=2\n[KEY1]\nVIEW_RECT=0,0,10,10\n[KEY2]\nVIEW_RECT=10,0,10,10\n'
  const css = '[GLOBAL]\nSTYLE_NUM=72\n[STYLE72]\nSHOW=ABC\n'
  const workspace = new AiSkinWorkspace([
    { path: 'p/py_9.ini', syntax: 'ini', text: ini },
    { path: 'p/default.css', syntax: 'ini', text: css },
  ])
  assert.throws(() => workspace.addIniSection('p/py_9.ini', 'KEY9', []))
  workspace.readFile('p/py_9.ini')
  workspace.readFile('p/default.css')
  assert.equal(workspace.addIniSection('p/py_9.ini', 'KEY9', [{ key: 'VIEW_RECT', value: '20,0,10,10' }]), 'KEY3')
  assert.throws(() => workspace.addIniSection('p/py_9.ini', 'KEY3', []))
  assert.deepEqual(workspace.removeIniSections('p/py_9.ini', ['KEY1']), { KEY2: 'KEY1', KEY3: 'KEY2' })
  assert.equal(workspace.addIniSection('p/default.css', 'STYLE80', [{ key: 'SHOW', value: 'QW' }]), 'STYLE80')
  const [layout, styles] = workspace.changes().sort((a, b) => b.path.localeCompare(a.path))
  assert.equal(layout.after, '[PANEL]\nKEY_NUM=2\n[KEY1]\nVIEW_RECT=10,0,10,10\n[KEY2]\nVIEW_RECT=20,0,10,10\n')
  assert.match(styles.after, /STYLE_NUM=80/)
})
