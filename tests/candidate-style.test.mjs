import { test } from 'node:test'
import assert from 'node:assert/strict'
import { drawInputBarBackground } from '../src/preview-draw.ts'
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

function backgroundCalls(visual) {
  const calls = []
  const context = Object.fromEntries(['fillRect', 'drawImage', 'beginPath', 'moveTo', 'lineTo', 'stroke'].map((name) => [name, (...args) => calls.push([name, ...args])]))
  drawInputBarBackground(context, visual, 120, 40)
  return calls
}

test('input background uses nonzero ARGB colour before an image, including transparent nonblack', () => {
  const image = { image: {}, source: [0, 0, 12, 4] }
  assert.deepEqual(backgroundCalls({ ...image, color: '#123456' }), [['fillRect', 0, 0, 120, 40]])
  assert.deepEqual(backgroundCalls({ ...image, color: 'rgba(255, 0, 0, 0)' }), [])
  for (const color of [undefined, 'rgba(0, 0, 0, 0)']) {
    const calls = backgroundCalls({ ...image, color })
    assert.equal(calls.length, 1)
    assert.equal(calls[0][0], 'drawImage')
    assert.deepEqual(calls[0].slice(2), [0, 0, 12, 4, 0, 0, 120, 40])
  }
})

test('input background has a border on the left, top and right, with no bottom edge', () => {
  assert.deepEqual(backgroundCalls({ borderColor: '#123456' }), [
    ['beginPath'], ['moveTo', 0.5, 40], ['lineTo', 0.5, 0.5],
    ['lineTo', 119.5, 0.5], ['lineTo', 119.5, 40], ['stroke'],
  ])
  assert.deepEqual(backgroundCalls({ borderColor: 'rgba(0, 0, 0, 0)' }), [])
  assert.deepEqual(backgroundCalls(undefined), [])
})
