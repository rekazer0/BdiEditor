import assert from "node:assert/strict"
import test from "node:test"
import { alphaMask, detectGridCells } from "../src/layout-scan.ts"

function maskFromRects(width: number, height: number, rects: Array<[number, number, number, number]>): Uint8Array {
  const mask = new Uint8Array(width * height)
  for (const [x, y, w, h] of rects) {
    for (let yy = y; yy < y + h; yy += 1) {
      for (let xx = x; xx < x + w; xx += 1) {
        mask[yy * width + xx] = 1
      }
    }
  }
  return mask
}

test("alphaMask keeps only pixels above the alpha threshold", () => {
  const pixels = new Uint8ClampedArray(2 * 2 * 4)
  pixels[3] = 255 // (0,0) opaque
  pixels[7] = 3 // (0,1) nearly transparent
  const mask = alphaMask(pixels, 2, 2)
  assert.deepEqual(Array.from(mask), [1, 0, 0, 0])
})

test("detectGridCells splits a transparent-gap key grid into reading-order cells", () => {
  // 10x10 grid: three 3px keys per row with 1px transparent gaps, two rows with 1px gap
  const mask = maskFromRects(14, 9, [
    [0, 0, 3, 3], [4, 0, 3, 3], [8, 0, 3, 3],
    [0, 4, 3, 3], [4, 4, 3, 3], [8, 4, 3, 3],
  ])
  const cells = detectGridCells(mask, 14, 9)
  assert.deepEqual(cells, [
    [0, 0, 3, 3], [4, 0, 3, 3], [8, 0, 3, 3],
    [0, 4, 3, 3], [4, 4, 3, 3], [8, 4, 3, 3],
  ])
})

test("detectGridCells ignores rows with different key counts", () => {
  const mask = maskFromRects(14, 9, [
    [0, 0, 3, 3], [4, 0, 3, 3], [8, 0, 3, 3],
    [0, 4, 3, 3], [4, 4, 3, 3],
  ])
  const cells = detectGridCells(mask, 14, 9)
  assert.deepEqual(cells, [
    [0, 0, 3, 3], [4, 0, 3, 3], [8, 0, 3, 3],
    [0, 4, 3, 3], [4, 4, 3, 3],
  ])
})

test("detectGridCells handles a single filled band without gaps", () => {
  const mask = maskFromRects(8, 5, [[0, 0, 8, 5]])
  assert.deepEqual(detectGridCells(mask, 8, 5), [[0, 0, 8, 5]])
})

test("detectGridCells filters out thin noise bands", () => {
  const mask = maskFromRects(8, 5, [[0, 0, 8, 1]]) // 1px tall band < minSpan 3
  assert.deepEqual(detectGridCells(mask, 8, 5), [])
})

test("detectGridCells returns empty for an empty mask", () => {
  assert.deepEqual(detectGridCells(new Uint8Array(0), 10, 10), [])
})
