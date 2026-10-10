import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseHexColor, tintPixels } from '../src/ai-skin-images.ts'

test('tintPixels turns a blue key orange but keeps its white glyph, shading and alpha', () => {
  // blue, darker blue, white glyph, transparent
  const data = new Uint8ClampedArray([0, 120, 255, 255, 0, 80, 200, 255, 255, 255, 255, 255, 0, 0, 255, 0])
  assert.equal(tintPixels(data, parseHexColor('FF7A00')), 2)
  assert.ok(data[0] > data[2] && data[0] > 200, 'first pixel is orange')
  assert.ok(data[4] < data[0], 'darker pixel stays darker')
  assert.deepEqual([...data.slice(8, 16)], [255, 255, 255, 255, 0, 0, 255, 0])
})

test('parseHexColor accepts AARRGGBB and rejects junk', () => {
  assert.deepEqual(parseHexColor('#80FF7A00'), [255, 122, 0])
  assert.throws(() => parseHexColor('orange'))
})
