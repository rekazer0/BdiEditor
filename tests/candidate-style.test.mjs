import { test } from 'node:test'
import assert from 'node:assert/strict'
import { IniDocument } from '../src/ini.ts'
import { candidateInputBackgroundStyle, inputBarBox, resolveCandidateInputStyle } from '../src/candidate-style.ts'

test('input code background comes from the candidate layout, then the general config', () => {
  const general = IniDocument.parse('[INPUT]\nBACK_STYLE=127\nFORE_STYLE=128\n')
  assert.equal(candidateInputBackgroundStyle(general), '127')
  assert.equal(candidateInputBackgroundStyle(general, IniDocument.parse('[INPUT]\nBACK_STYLE=200,201\n')), '200')
  assert.equal(candidateInputBackgroundStyle(general, IniDocument.parse('[CAND]\nBACK_STYLE=117\n')), '127')
  assert.equal(candidateInputBackgroundStyle(IniDocument.parse('[INPUT]\nFORE_STYLE=128\n')), '')
  assert.equal(candidateInputBackgroundStyle(undefined), '')
})

// Baidu Android InputBarView: L = trunc(2.5dp), the code starts 6dp in and ends two Ls before the edge.
test('input code bar wraps the code and fills the panel when the code is wider', () => {
  const resolver = { resolveText: () => ({ fontSize: 28 }) }
  const metrics = resolveCandidateInputStyle(IniDocument.parse('[INPUT]\nFORE_STYLE=128\n'), resolver, 480)
  assert.deepEqual({ height: metrics.height, inset: metrics.inset, textLeft: metrics.textLeft }, { height: 34, inset: 3, textLeft: 9 })
  assert.deepEqual(inputBarBox(100, metrics, 480), { width: 115, paddingStart: 9, paddingEnd: 6 })
  assert.deepEqual(inputBarBox(470, metrics, 480), { width: 480, paddingStart: 3, paddingEnd: 3 })
  const wide = resolveCandidateInputStyle(undefined, resolver, 1080)
  assert.deepEqual({ inset: wide.inset, textLeft: wide.textLeft }, { inset: 8, textLeft: 19 })
})
