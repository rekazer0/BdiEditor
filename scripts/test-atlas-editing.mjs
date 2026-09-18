import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resizeTileSlice, updateTileSlice, tileSlices, duplicateTileSlice } from '../src/tiles.ts'
import { IniDocument } from '../src/ini.ts'

test('corner resizing stays in the image and clips nine-slice bounds', () => {
  const slice = { index: 1, source: [10, 20, 100, 80], inner: [30, 40, 60, 40] }
  assert.deepEqual(resizeTileSlice(slice, 0, { x: -10, y: -20 }, 200, 200).source, [0, 0, 110, 100])
  const shrunk = resizeTileSlice(slice, 3, { x: 50, y: 60 }, 200, 200)
  assert.deepEqual(shrunk, { index: 1, source: [10, 20, 40, 40], inner: [30, 40, 20, 20] })
  assert.deepEqual(resizeTileSlice(slice, 3, { x: 500, y: 500 }, 200, 200).source, [10, 20, 190, 180])
  assert.deepEqual(resizeTileSlice(slice, 0, { x: 500, y: 500 }, 200, 200).source, [109, 99, 1, 1])
  assert.deepEqual(slice.inner, [30, 40, 60, 40])
})

test('nine-slice toggle, duplicate, and resize survive TIL serialization', () => {
  const doc = IniDocument.parse('')
  const slice = { index: 1, source: [10, 20, 100, 80], inner: [30, 40, 60, 40] }
  updateTileSlice(doc, slice)
  const copied = duplicateTileSlice(slice, 2)
  updateTileSlice(doc, copied)
  updateTileSlice(doc, { index: 1, source: slice.source })
  const restored = tileSlices(IniDocument.parse(doc.toString()))
  assert.equal(restored[0].inner, undefined)
  assert.deepEqual(restored[1], copied)
})
