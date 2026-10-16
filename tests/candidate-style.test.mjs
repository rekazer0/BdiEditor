import { test } from 'node:test'
import assert from 'node:assert/strict'
import { IniDocument } from '../src/ini.ts'
import { candidateInputBackgroundStyle } from '../src/candidate-style.ts'

test('input code background comes from the candidate layout, then the general config', () => {
  const general = IniDocument.parse('[INPUT]\nBACK_STYLE=127\nFORE_STYLE=128\n')
  assert.equal(candidateInputBackgroundStyle(general), '127')
  assert.equal(candidateInputBackgroundStyle(general, IniDocument.parse('[INPUT]\nBACK_STYLE=200,201\n')), '200')
  assert.equal(candidateInputBackgroundStyle(general, IniDocument.parse('[CAND]\nBACK_STYLE=117\n')), '127')
  assert.equal(candidateInputBackgroundStyle(IniDocument.parse('[INPUT]\nFORE_STYLE=128\n')), '')
  assert.equal(candidateInputBackgroundStyle(undefined), '')
})
