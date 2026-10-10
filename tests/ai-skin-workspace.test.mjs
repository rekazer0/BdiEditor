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
