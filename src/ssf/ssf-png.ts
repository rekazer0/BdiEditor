// Minimal PNG codec for skin conversion: Sogou foregrounds need transparent padding and Baidu atlas
// slices need cropping into standalone files. Conversion also runs in Node tests, so it cannot rely on
// canvas. Decoding covers every PNG colour type, bit depth and Adam7; encoding always writes RGBA8.

import { unzlibSync, zlibSync } from "fflate"

export type RgbaImage = { width: number; height: number; data: Uint8Array }

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10]
const MAX_PIXELS = 4096 * 4096
const ADAM7 = [
  [0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8], [2, 0, 4, 4],
  [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2],
] as const

export function isPng(bytes: Uint8Array): boolean {
  return bytes.length >= 24 && SIGNATURE.every((byte, index) => bytes[index] === byte)
}

export function pngSize(bytes: Uint8Array): [number, number] | undefined {
  if (!isPng(bytes)) return
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return [view.getUint32(16), view.getUint32(20)]
}

function channels(colorType: number): number {
  const count = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType]
  if (!count) throw new Error(`不支持的 PNG 颜色类型：${colorType}`)
  return count
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
}

/** Reverses the scanline filters of one (sub)image in place and returns its raw rows. */
function unfilter(data: Uint8Array, offset: number, width: number, height: number, bitsPerPixel: number): { rows: Uint8Array; end: number } {
  const stride = Math.ceil(width * bitsPerPixel / 8)
  const bpp = Math.max(1, bitsPerPixel >> 3)
  const rows = new Uint8Array(stride * height)
  for (let y = 0; y < height; y++) {
    const filter = data[offset++]
    if (offset + stride > data.length) throw new Error("PNG 数据不完整")
    const row = y * stride
    const previous = row - stride
    for (let x = 0; x < stride; x++) {
      const raw = data[offset + x]
      const left = x >= bpp ? rows[row + x - bpp] : 0
      const up = y ? rows[previous + x] : 0
      const upLeft = y && x >= bpp ? rows[previous + x - bpp] : 0
      const predictor = filter === 0 ? 0
        : filter === 1 ? left
          : filter === 2 ? up
            : filter === 3 ? (left + up) >> 1
              : filter === 4 ? paeth(left, up, upLeft)
                : -1
      if (predictor < 0) throw new Error(`PNG 滤波类型无效：${filter}`)
      rows[row + x] = (raw + predictor) & 0xff
    }
    offset += stride
  }
  return { rows, end: offset }
}

export function decodePng(bytes: Uint8Array): RgbaImage {
  if (!isPng(bytes)) throw new Error("不是有效的 PNG")
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let width = 0
  let height = 0
  let depth = 0
  let colorType = 0
  let interlace = 0
  let palette: Uint8Array = new Uint8Array()
  let transparency: Uint8Array = new Uint8Array()
  const idat: Uint8Array[] = []
  for (let offset = 8; offset + 12 <= bytes.length;) {
    const length = view.getUint32(offset)
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8))
    const body = bytes.subarray(offset + 8, offset + 8 + length)
    if (body.length !== length) throw new Error("PNG 数据不完整")
    if (type === "IHDR") {
      width = view.getUint32(offset + 8)
      height = view.getUint32(offset + 12)
      depth = body[8]
      colorType = body[9]
      interlace = body[12]
    } else if (type === "PLTE") palette = body
    else if (type === "tRNS") transparency = body
    else if (type === "IDAT") idat.push(body)
    else if (type === "IEND") break
    offset += 12 + length
  }
  if (!width || !height || width * height > MAX_PIXELS) throw new Error("PNG 尺寸无效")
  const sampleCount = channels(colorType)
  const bitsPerPixel = sampleCount * depth
  const compressed = new Uint8Array(idat.reduce((total, part) => total + part.length, 0))
  idat.reduce((offset, part) => (compressed.set(part, offset), offset + part.length), 0)
  const inflated = unzlibSync(compressed)
  const output = new Uint8Array(width * height * 4)
  const maxSample = (1 << Math.min(depth, 8)) - 1
  const transparentKey = transparency.length >= 2 && colorType !== 3
    ? Array.from({ length: colorType === 2 ? 3 : 1 }, (_, index) => (transparency[index * 2] << 8) | transparency[index * 2 + 1])
    : undefined

  const sample = (rows: Uint8Array, rowStart: number, index: number): number => {
    if (depth === 16) return (rows[rowStart + index * 2] << 8) | rows[rowStart + index * 2 + 1]
    if (depth === 8) return rows[rowStart + index]
    const bit = index * depth
    return (rows[rowStart + (bit >> 3)] >> (8 - depth - (bit & 7))) & maxSample
  }
  const to8 = (value: number) => depth === 16 ? value >> 8 : depth === 8 ? value : Math.round(value * 255 / maxSample)

  const writePixel = (rows: Uint8Array, rowStart: number, x: number, target: number) => {
    const first = x * sampleCount
    const v0 = sample(rows, rowStart, first)
    if (colorType === 3) {
      output[target] = palette[v0 * 3] ?? 0
      output[target + 1] = palette[v0 * 3 + 1] ?? 0
      output[target + 2] = palette[v0 * 3 + 2] ?? 0
      output[target + 3] = transparency[v0] ?? 255
    } else if (colorType === 0 || colorType === 4) {
      output[target] = output[target + 1] = output[target + 2] = to8(v0)
      output[target + 3] = colorType === 4 ? to8(sample(rows, rowStart, first + 1)) : transparentKey?.[0] === v0 ? 0 : 255
    } else {
      const v1 = sample(rows, rowStart, first + 1)
      const v2 = sample(rows, rowStart, first + 2)
      output[target] = to8(v0)
      output[target + 1] = to8(v1)
      output[target + 2] = to8(v2)
      output[target + 3] = colorType === 6 ? to8(sample(rows, rowStart, first + 3))
        : transparentKey && transparentKey[0] === v0 && transparentKey[1] === v1 && transparentKey[2] === v2 ? 0 : 255
    }
  }

  if (interlace === 1) {
    let offset = 0
    for (const [startX, startY, stepX, stepY] of ADAM7) {
      const passWidth = Math.ceil((width - startX) / stepX)
      const passHeight = Math.ceil((height - startY) / stepY)
      if (passWidth <= 0 || passHeight <= 0) continue
      const pass = unfilter(inflated, offset, passWidth, passHeight, bitsPerPixel)
      offset = pass.end
      const stride = Math.ceil(passWidth * bitsPerPixel / 8)
      for (let y = 0; y < passHeight; y++) {
        for (let x = 0; x < passWidth; x++) {
          writePixel(pass.rows, y * stride, x, ((startY + y * stepY) * width + startX + x * stepX) * 4)
        }
      }
    }
  } else {
    const { rows } = unfilter(inflated, 0, width, height, bitsPerPixel)
    const stride = Math.ceil(width * bitsPerPixel / 8)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) writePixel(rows, y * stride, x, (y * width + x) * 4)
    }
  }
  return { width, height, data: output }
}

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  return value >>> 0
})

function crc32(bytes: Uint8Array): number {
  let value = 0xffffffff
  for (const byte of bytes) value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8)
  return (value ^ 0xffffffff) >>> 0
}

function chunk(type: string, body: Uint8Array): Uint8Array {
  const output = new Uint8Array(12 + body.length)
  const view = new DataView(output.buffer)
  view.setUint32(0, body.length)
  for (let index = 0; index < 4; index++) output[4 + index] = type.charCodeAt(index)
  output.set(body, 8)
  view.setUint32(8 + body.length, crc32(output.subarray(4, 8 + body.length)))
  return output
}

export function encodePng(image: RgbaImage): Uint8Array {
  const { width, height, data } = image
  if (data.length !== width * height * 4) throw new Error("RGBA 数据长度与尺寸不一致")
  const header = new Uint8Array(13)
  const view = new DataView(header.buffer)
  view.setUint32(0, width)
  view.setUint32(4, height)
  header.set([8, 6, 0, 0, 0], 8)
  // Filter 1 (Sub) on every row: cheap and compresses flat key art far better than no filter.
  const stride = width * 4
  const raw = new Uint8Array((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    const target = y * (stride + 1)
    raw[target] = 1
    for (let x = 0; x < stride; x++) {
      const value = data[y * stride + x]
      raw[target + 1 + x] = (value - (x >= 4 ? data[y * stride + x - 4] : 0)) & 0xff
    }
  }
  const parts = [new Uint8Array(SIGNATURE), chunk("IHDR", header), chunk("IDAT", zlibSync(raw, { level: 6 })), chunk("IEND", new Uint8Array())]
  const output = new Uint8Array(parts.reduce((total, part) => total + part.length, 0))
  parts.reduce((offset, part) => (output.set(part, offset), offset + part.length), 0)
  return output
}

/** Places `image` on a transparent canvas of the given size, clipping anything outside it. */
export function placeImage(image: RgbaImage, width: number, height: number, x: number, y: number): RgbaImage {
  const data = new Uint8Array(width * height * 4)
  for (let row = 0; row < image.height; row++) {
    const targetY = row + y
    if (targetY < 0 || targetY >= height) continue
    const startX = Math.max(0, x)
    const endX = Math.min(width, x + image.width)
    if (startX >= endX) continue
    const source = (row * image.width + (startX - x)) * 4
    data.set(image.data.subarray(source, source + (endX - startX) * 4), (targetY * width + startX) * 4)
  }
  return { width, height, data }
}

export function cropImage(image: RgbaImage, x: number, y: number, width: number, height: number): RgbaImage {
  return placeImage(image, width, height, -x, -y)
}

/** Bilinear resize on premultiplied alpha, so transparent edges do not bleed dark fringes. */
export function resizeImage(image: RgbaImage, width: number, height: number): RgbaImage {
  if (width === image.width && height === image.height) return image
  const data = new Uint8Array(width * height * 4)
  const source = image.data
  for (let y = 0; y < height; y++) {
    const sy = Math.min(image.height - 1, Math.max(0, (y + 0.5) * image.height / height - 0.5))
    const y0 = Math.floor(sy)
    const y1 = Math.min(image.height - 1, y0 + 1)
    const fy = sy - y0
    for (let x = 0; x < width; x++) {
      const sx = Math.min(image.width - 1, Math.max(0, (x + 0.5) * image.width / width - 0.5))
      const x0 = Math.floor(sx)
      const x1 = Math.min(image.width - 1, x0 + 1)
      const fx = sx - x0
      const corners = [
        [(y0 * image.width + x0) * 4, (1 - fx) * (1 - fy)],
        [(y0 * image.width + x1) * 4, fx * (1 - fy)],
        [(y1 * image.width + x0) * 4, (1 - fx) * fy],
        [(y1 * image.width + x1) * 4, fx * fy],
      ]
      let alpha = 0
      let red = 0
      let green = 0
      let blue = 0
      for (const [offset, weight] of corners) {
        const a = source[offset + 3] * weight
        alpha += a
        red += source[offset] * a
        green += source[offset + 1] * a
        blue += source[offset + 2] * a
      }
      const target = (y * width + x) * 4
      if (alpha > 0) {
        data[target] = Math.round(red / alpha)
        data[target + 1] = Math.round(green / alpha)
        data[target + 2] = Math.round(blue / alpha)
      }
      data[target + 3] = Math.round(alpha)
    }
  }
  return { width, height, data }
}

/** Source-over composite of `top` onto `bottom`; both must have the same size. */
export function compositeImage(bottom: RgbaImage, top: RgbaImage): RgbaImage {
  if (bottom.width !== top.width || bottom.height !== top.height) throw new Error("合成图片尺寸不一致")
  const data = new Uint8Array(bottom.data.length)
  for (let offset = 0; offset < data.length; offset += 4) {
    const topAlpha = top.data[offset + 3] / 255
    const bottomAlpha = bottom.data[offset + 3] / 255
    const alpha = topAlpha + bottomAlpha * (1 - topAlpha)
    for (let channel = 0; channel < 3; channel++) {
      data[offset + channel] = alpha
        ? Math.round((top.data[offset + channel] * topAlpha + bottom.data[offset + channel] * bottomAlpha * (1 - topAlpha)) / alpha)
        : 0
    }
    data[offset + 3] = Math.round(alpha * 255)
  }
  return { width: bottom.width, height: bottom.height, data }
}

/** Recolours every pixel to `argb` (AARRGGBB hex), keeping the image's own alpha as the glyph mask. */
export function tintImage(image: RgbaImage, argb: string): RgbaImage {
  const value = Number.parseInt(argb, 16) >>> 0
  const alpha = (value >>> 24) / 255
  const data = new Uint8Array(image.data.length)
  for (let offset = 0; offset < data.length; offset += 4) {
    data[offset] = (value >>> 16) & 0xff
    data[offset + 1] = (value >>> 8) & 0xff
    data[offset + 2] = value & 0xff
    data[offset + 3] = Math.round(image.data[offset + 3] * alpha)
  }
  return { width: image.width, height: image.height, data }
}
