import { test } from 'node:test'
import assert from 'node:assert/strict'
import { drawNineSliceImage } from '../src/preview.ts'

// Model the shared scratch canvas: resizing clears it and drawing replaces pixels.
function setup() {
  let width = 0
  let height = 0
  let slices = []
  const buffer = {
    get width() { return width },
    set width(value) { width = value; slices = [] },
    get height() { return height },
    set height(value) { height = value; slices = [] },
    getContext: () => ({ drawImage: (...args) => slices.push(args) }),
  }
  const frames = []
  const context = {
    drawImage(canvas, ...args) {
      frames.push({ width: canvas.width, height: canvas.height, slices: [...slices], args })
    },
  }
  return {
    frames,
    draw(image, width, height) {
      drawNineSliceImage(context, {
        image, source: [10, 20, 106, 151], inner: [52, 64, 2, 17],
      }, { x: 13, y: 12, width, height }, () => buffer)
    },
  }
}

test('nine-slice backgrounds remain complete after alternating sizes', () => {
  const { draw, frames } = setup()
  const image = {}
  draw(image, 110, 143)
  draw(image, 160, 400)
  draw(image, 110, 143)
  assert.deepEqual(frames[2], frames[0])
  assert.equal(frames[0].slices.length, 9)
  assert.deepEqual(frames[0].args, [0, 0, 110, 143, 13, 12, 110, 143])
})

test('different bitmap objects and repeated frames keep their own background', () => {
  const { draw, frames } = setup()
  const first = {}
  const second = {}
  draw(first, 110, 143)
  draw(second, 110, 143)
  draw(first, 110, 143)
  for (const [index, image] of [first, second, first].entries()) {
    assert.equal(frames[index].slices.length, 9)
    for (const slice of frames[index].slices) assert.equal(slice[0], image)
  }
})
