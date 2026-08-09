import assert from "node:assert/strict"
import test from "node:test"
import {
  AtlasResolver,
  canvasFontFamily,
  isTransparentColor,
  resolveTextVisual,
  resolveVisualSpec,
} from "../src/atlas.ts"
import { IniDocument } from "../src/ini.ts"
import { SkinArchive } from "../src/skin.ts"
import { strToU8, zipSync } from "fflate"

test("resolves normal and highlighted atlas entries", () => {
  const styles = IniDocument.parse(
    "[STYLE211]\nNM_IMG=btn,1\nHL_IMG=btn,2\nNM_COLOR=ff102030\n",
  )

  assert.deepEqual(resolveVisualSpec(styles, "211", false), {
    imageName: "btn",
    tile: 1,
    color: "rgba(16, 32, 48, 1)",
  })
  assert.deepEqual(resolveVisualSpec(styles, "211", true), {
    imageName: "btn",
    tile: 2,
    color: "rgba(16, 32, 48, 1)",
  })
})

test("decodes Baidu AARRGGBB transparency into a canvas-safe color", () => {
  const styles = IniDocument.parse(`
[STYLE1102]
NM_COLOR=00FFFFFF
[STYLE1103]
NM_COLOR=80010203
`)

  assert.equal(resolveVisualSpec(styles, "1102", false)?.color, "rgba(255, 255, 255, 0)")
  assert.equal(resolveVisualSpec(styles, "1103", false)?.color, "rgba(1, 2, 3, 0.502)")
  assert.equal(isTransparentColor(resolveVisualSpec(styles, "1102", false)?.color), true)
  assert.equal(isTransparentColor(resolveVisualSpec(styles, "1103", false)?.color), false)
})

test("ignores unknown style identifiers", () => {
  const styles = IniDocument.parse("[STYLE1161]\nINFO=transparent key\n")

  assert.deepEqual(resolveVisualSpec(styles, "1161", false), {
    imageName: undefined,
    tile: undefined,
    color: undefined,
  })
  assert.equal(resolveVisualSpec(styles, "9999", false), undefined)
  assert.equal(resolveVisualSpec(styles, "S11_3", false), undefined)
})

test("resolves encoded foreground style text properties", () => {
  const styles = IniDocument.parse(
    "[STYLE703]\nNM_IMG=letters,3\n\n[STYLE7]\nFONT_SIZE=45\nFONT_NAME=.SFUIDisplay-Regular\nNM_COLOR=ff102030\nHL_COLOR=ffffffff\n",
  )

  assert.deepEqual(resolveTextVisual(styles, "703,704", false), {
    fontSize: 45,
    fontName: ".SFUIDisplay-Regular",
    color: "rgba(16, 32, 48, 1)",
  })
  assert.equal(resolveTextVisual(styles, "703", true)?.color, "rgba(255, 255, 255, 1)")
})

test("merges font name, weight, size and color from separate foreground style tokens", () => {
  const styles = IniDocument.parse(`
[STYLE701]
FONT_NAME=.SFUIDisplay-Regular
[STYLE702]
FONT_SIZE=36
[STYLE703]
NM_COLOR=ff334455
[STYLE704]
FONT_WEIGHT=550
`)

  assert.deepEqual(resolveTextVisual(styles, "701,702,703,704", false), {
    fontName: ".SFUIDisplay-Regular",
    fontSize: 36,
    color: "rgba(51, 68, 85, 1)",
    fontWeight: 550,
  })
  assert.equal(resolveTextVisual(styles, "", false), undefined)
})

test("atlas resolver exposes the resolved resource path and tile source rectangle", async () => {
  const archive = SkinArchive.open(zipSync({
    "light/skin/port/res/default.css": strToU8("[STYLE211]\nNM_IMG=btn,1\n"),
    "light/skin/res/btn.png": new Uint8Array([1, 2, 3]),
    "light/skin/res/btn.til": strToU8("[IMG1]\nSOURCE_RECT=10,20,30,40\n"),
  }))
  const previous = globalThis.createImageBitmap
  Object.defineProperty(globalThis, "createImageBitmap", {
    configurable: true,
    value: async () => ({ width: 64, height: 64 }),
  })
  try {
    const visual = await new AtlasResolver(archive, "light", "port").resolve("211", false)
    assert.equal(visual?.imagePath, "light/skin/res/btn.png")
    assert.deepEqual(visual?.source, [10, 20, 30, 40])
  } finally {
    Object.defineProperty(globalThis, "createImageBitmap", {
      configurable: true,
      value: previous,
    })
  }
})

test("draws a resolved atlas visual from its SOURCE_RECT instead of the whole image", async () => {
  const module = await import("../src/atlas.ts") as typeof import("../src/atlas.ts") & {
    drawVisualSource?: (
      context: Pick<CanvasRenderingContext2D, "drawImage">,
      visual: {
        image: ImageBitmap
        source: [number, number, number, number]
      },
      destination: { x: number; y: number; width: number; height: number },
    ) => void
  }
  const calls: unknown[][] = []
  const context = {
    drawImage: (...args: unknown[]) => calls.push(args),
  } as unknown as Pick<CanvasRenderingContext2D, "drawImage">
  const image = { width: 1080, height: 650 } as ImageBitmap

  assert.equal(typeof module.drawVisualSource, "function")
  module.drawVisualSource?.(
    context,
    { image, source: [159, 453, 122, 151] },
    { x: 3, y: 4, width: 36, height: 28 },
  )

  assert.deepEqual(calls, [[image, 159, 453, 122, 151, 3, 4, 36, 28]])
})

test("maps unavailable iOS system font aliases only at canvas rendering time", () => {
  assert.equal(canvasFontFamily(".SFUIDisplay-Regular"), "system-ui")
  assert.equal(canvasFontFamily("PingFang SC"), '"PingFang SC", system-ui')
  assert.equal(canvasFontFamily(undefined), "system-ui")
})

test("reads the three iPhone toolbar image slots from the skin plist", async () => {
  const module = await import("../src/atlas.ts") as typeof import("../src/atlas.ts") & {
    toolbarImagePaths?: (plist: string, limit?: number) => string[]
  }
  const plist = `<?xml version="1.0"?><plist><array>
    <dict><key>Position</key><string>toolbar</string><key>Images</key><dict><key>Normal</key><dict><key>Normal</key><string>1.0/toolbarMenuItem_KBSwitch_Normal</string></dict></dict></dict>
    <dict><key>Position</key><string>toolbar</string><key>Images</key><dict><key>Normal</key><dict><key>Normal</key><string>1.0/toolbarMenuItem_MoveCursor_Normal</string></dict></dict></dict>
    <dict><key>Position</key><string>menu</string><key>Images</key><dict><key>Normal</key><dict><key>Normal</key><string>1.0/menu_item</string></dict></dict></dict>
    <dict><key>Position</key><string>toolbar</string><key>Images</key><dict><key>Normal</key><dict><key>Normal</key><string>1.0/toolbarMenuItem_Search_Normal</string></dict></dict></dict>
    <dict><key>Position</key><string>toolbar</string><key>Images</key><dict><key>Normal</key><dict><key>Normal</key><string>1.0/toolbarMenuItem_Emoji_Normal</string></dict></dict></dict>
  </array></plist>`
  assert.equal(typeof module.toolbarImagePaths, "function")
  assert.deepEqual(module.toolbarImagePaths?.(plist, 3), [
    "1.0/toolbarMenuItem_KBSwitch_Normal",
    "1.0/toolbarMenuItem_MoveCursor_Normal",
    "1.0/toolbarMenuItem_Search_Normal",
  ])
})
