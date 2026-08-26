import assert from "node:assert/strict"
import { drawNineSliceImage } from "../src/preview.ts"

const sourceCalls: unknown[][] = []
const destinationCalls: unknown[][] = []
const buffer = {
  width: 0,
  height: 0,
  getContext: () => ({
    drawImage: (...args: unknown[]) => sourceCalls.push(args),
  }),
} as unknown as HTMLCanvasElement
const context = {
  drawImage: (...args: unknown[]) => destinationCalls.push(args),
} as unknown as CanvasRenderingContext2D

drawNineSliceImage(
  context,
  {
    image: {} as ImageBitmap,
    source: [10, 20, 106, 151],
    inner: [52, 64, 2, 17],
  },
  { x: 13, y: 12, width: 110, height: 143 },
  () => buffer,
)

assert.equal(sourceCalls.length, 9, "离屏画布应完整拼合九个切片")
assert.equal(destinationCalls.length, 1, "主预览画布应一次绘制完整图像，避免切片独立插值")
assert.deepEqual(destinationCalls[0]?.slice(1), [0, 0, 110, 143, 13, 12, 110, 143])

console.log("✓ 九宫格切片先离屏合成，再一次绘制到预览画布")
