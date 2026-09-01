import assert from "node:assert/strict"
import fs from "node:fs"
import { IniDocument } from "../src/ini.ts"
import { drawNineSliceImage } from "../src/preview.ts"
import { tilePreviewInnerRect, updateTileSlice } from "../src/tiles.ts"

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

assert.deepEqual(
  tilePreviewInnerRect(
    [305, 0, 91, 92],
    [340, 40, 20, 20],
    { x: 12, y: 10, width: 182, height: 184 },
  ),
  { x: 82, y: 90, width: 40, height: 40 },
  "TIL 的绝对 INNER_RECT 应映射到选中切片的放大预览",
)

const tiles = IniDocument.parse("[IMG1]\r\nSOURCE_RECT=305,0,91,92\r\nINNER_RECT=340,40,20,20\r\n")
updateTileSlice(tiles, { index: 1, source: [305, 0, 91, 92] })
assert.equal(tiles.get("IMG1", "INNER_RECT"), undefined, "清空 INNER_RECT 字段后应删除原配置")

const main = fs.readFileSync("src/main.ts", "utf8")
assert.match(
  main,
  /if \(slice\.inner && \(archive\?\.format === "bda" \|\| selected\)\)/,
  "图集应为选中的普通 TIL 切片绘制 INNER_RECT 辅助线",
)
assert.match(
  main,
  /if \(slice\.inner\) \{[\s\S]{0,160}tilePreviewInnerRect\(slice\.source, slice\.inner, destination\)/,
  "切片放大预览不应再把 INNER_RECT 限制为 BDA 格式",
)

console.log("✓ 九宫格切片先离屏合成，再一次绘制到预览画布")
