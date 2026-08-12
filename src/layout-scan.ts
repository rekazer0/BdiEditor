import type { TileRect } from "./tiles.ts"

// 替换键盘样式用的图像分析：把 PNG 像素按 alpha 通道转成墨迹掩码，
// 再按“空白行/空白列”切出按键网格单元。纯函数，node 可直接测试。

export function alphaMask(pixels: Uint8ClampedArray, width: number, height: number, threshold = 8): Uint8Array {
  const mask = new Uint8Array(width * height)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      mask[y * width + x] = pixels[(y * width + x) * 4 + 3] > threshold ? 1 : 0
    }
  }
  return mask
}

function bandSpans(values: Uint8Array, length: number, minSpan: number): Array<[number, number]> {
  const spans: Array<[number, number]> = []
  let start = -1
  for (let i = 0; i <= length; i += 1) {
    const filled = i < length && values[i] > 0
    if (filled && start < 0) start = i
    if (!filled && start >= 0) {
      if (i - start >= minSpan) spans.push([start, i])
      start = -1
    }
  }
  return spans
}

export function detectGridCells(mask: Uint8Array, width: number, height: number, minSpan = 3): TileRect[] {
  if (!mask.length || width <= 0 || height <= 0) return []
  // 水平投影：某一行有墨迹记为 1，无墨迹（整行透明）即为行间空白
  const rowFilled = new Uint8Array(height)
  for (let y = 0; y < height; y += 1) {
    let filled = 0
    for (let x = 0; x < width; x += 1) {
      if (mask[y * width + x]) { filled = 1; break }
    }
    rowFilled[y] = filled
  }
  const rows = bandSpans(rowFilled, height, minSpan)
  const cells: TileRect[] = []
  for (const [top, bottom] of rows) {
    // 带内垂直投影：列有墨迹为 1，列间空白分开按键
    const colFilled = new Uint8Array(width)
    for (let x = 0; x < width; x += 1) {
      let filled = 0
      for (let y = top; y < bottom; y += 1) {
        if (mask[y * width + x]) { filled = 1; break }
      }
      colFilled[x] = filled
    }
    for (const [left, right] of bandSpans(colFilled, width, minSpan)) {
      cells.push([left, top, right - left, bottom - top])
    }
  }
  return cells
}
