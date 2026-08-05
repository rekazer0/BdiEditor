import assert from "node:assert/strict"
import test from "node:test"
import { gestureDirection, rectToString } from "../src/layout.ts"
import { IniDocument } from "../src/ini.ts"
import { isAdditiveSelection, previewBackground, previewFallbackText, previewItems, previewSelectionVisible, previewSurfaceColor, shouldDrawFallbackKeyChrome, shouldDrawItemBackground } from "../src/preview.ts"

test("classifies click, hold and directional gestures", () => {
  assert.equal(gestureDirection(2, 3, 100, true), "center")
  assert.equal(gestureDirection(2, 3, 500, true), "hold")
  assert.equal(gestureDirection(40, 5, 100, false), "right")
  assert.equal(gestureDirection(3, -40, 100, false), "up")
})

test("rounds a preview rectangle for config output", () => {
  assert.equal(rectToString({ x: 1.2, y: 2.8, width: 99.6, height: 40.4 }), "1,3,100,40")
})

test("discovers every configured section with a VIEW_RECT", () => {
  const document = IniDocument.parse(
    "[PANEL]\nVIEW_RECT=0,0,100,20\n[KEY1]\nVIEW_RECT=0,20,50,40\n",
  )
  assert.deepEqual(previewItems(document).map((item) => item.section), ["PANEL", "KEY1"])
})

test("lays out candidate toolbar components with their real anchors", () => {
  const document = IniDocument.parse(
    "[CAND]\nBACK_STYLE=1\n[ICON1]\nBACK_STYLE=2\nSIZE=133,133\nFIX_SIZE=36,36\nANCHOR_TYPE=1\nPOS=30,0\nKEY=F31\n[ICON2]\nSIZE=133,133\nANCHOR_TYPE=3\nPOS=-160,0\n",
  )
  const items = previewItems(document, 1125, 133)
  assert.deepEqual(items.map((item) => item.section), ["CAND", "ICON1"])
  assert.equal(items.every((item) => !item.editable), true)
  assert.deepEqual(items[0].rect, { x: 0, y: 0, width: 1125, height: 133 })
  assert.deepEqual(items[1].rect, { x: 30, y: 0, width: 133, height: 133 })
  assert.deepEqual(items[1].foreRect, { x: 78.5, y: 48.5, width: 36, height: 36 })
  assert.equal(items[0].show, "")
})

test("lays out vertically centred candidate toolbar anchors", () => {
  const document = IniDocument.parse(
    "[CAND]\nBACK_STYLE=16\n[ICON1]\nFORE_STYLE=27\nSIZE=200,100\nANCHOR_TYPE=4\nPOS=0,-50\n[ICON2]\nFORE_STYLE=28\nSIZE=200,100\nANCHOR_TYPE=6\nPOS=-200,-50\n",
  )
  const items = previewItems(document, 1125, 100)
  assert.deepEqual(items[1].rect, { x: 0, y: 0, width: 200, height: 100 })
  assert.deepEqual(items[2].rect, { x: 925, y: 0, width: 200, height: 100 })
})

test("keeps every configured foreground layer for phone rendering", () => {
  const document = IniDocument.parse(
    "[KEY5]\nVIEW_RECT=178,12,187,143\nFORE_STYLE=731,401\nPOS_TYPE=140,142,143\nSHOW=q\n",
  )
  const item = previewItems(document)[0] as unknown as {
    foreStyles: string[]
    positionTypes: string[]
  }
  assert.deepEqual(item.foreStyles, ["731", "401"])
  assert.deepEqual(item.positionTypes, ["140", "142", "143"])
})

test("expands the LIST definition into the four phone punctuation cells", () => {
  const document = IniDocument.parse(
    "[PANEL]\nKEY_NUM=100\n[LIST]\nCELL_SIZE=147,103\nPOS=23,19\nLIST_NUM=4\nNAMES=， 。 ？ ！ ～ 、 .\n[KEY4]\nVIEW_RECT=14,12,165,429\nBACK_STYLE=1231\n",
  )
  const list = previewItems(document).filter((item) => item.section.startsWith("LIST:"))
  assert.deepEqual(list.map((item) => item.show), ["，", "。", "？", "！"])
  assert.deepEqual(list.map((item) => item.rect), [
    { x: 23, y: 19, width: 147, height: 103 },
    { x: 23, y: 122, width: 147, height: 103 },
    { x: 23, y: 225, width: 147, height: 103 },
    { x: 23, y: 328, width: 147, height: 103 },
  ])
})

test("interaction preview hides editor-only labels and gesture annotations", async () => {
  const module = await import("../src/preview.ts") as typeof import("../src/preview.ts") & {
    previewFallbackText?: (
      item: ReturnType<typeof previewItems>[number],
      mode: "edit" | "preview",
      hasForeground: boolean,
    ) => string
    previewAnnotationsVisible?: (mode: "edit" | "preview") => boolean
  }
  const blank = previewItems(IniDocument.parse("[KEY4]\nVIEW_RECT=14,12,165,429\n"))[0]
  const labelled = previewItems(IniDocument.parse("[KEY5]\nVIEW_RECT=178,12,187,143\nSHOW=q\n"))[0]
  assert.equal(typeof module.previewFallbackText, "function")
  assert.equal(typeof module.previewAnnotationsVisible, "function")
  assert.equal(module.previewFallbackText?.(blank, "preview", false), "")
  assert.equal(module.previewFallbackText?.(blank, "edit", false), "")
  assert.equal(module.previewFallbackText?.(labelled, "preview", true), "")
  assert.equal(module.previewAnnotationsVisible?.("preview"), false)
  assert.equal(module.previewAnnotationsVisible?.("edit"), true)
})

test("places the second foreground image at the phone key's upper-right slot", async () => {
  const module = await import("../src/preview.ts") as typeof import("../src/preview.ts") & {
    foregroundLayerRect?: (
      key: { x: number; y: number; width: number; height: number },
      source: [number, number, number, number] | undefined,
      layer: number,
    ) => { x: number; y: number; width: number; height: number }
  }
  assert.equal(typeof module.foregroundLayerRect, "function")
  assert.deepEqual(
    module.foregroundLayerRect?.({ x: 178, y: 12, width: 187, height: 143 }, [0, 0, 50, 50], 1),
    { x: 307, y: 18, width: 50, height: 50 },
  )
})

test("does not draw a color-only phone foreground visual", async () => {
  const module = await import("../src/preview.ts") as typeof import("../src/preview.ts") & {
    phoneForegroundVisual?: (visual: { color?: string }) => unknown
  }
  assert.equal(typeof module.phoneForegroundVisual, "function")
  assert.equal(module.phoneForegroundVisual?.({ color: "#333333" }), undefined)
})

test("keeps a phone foreground image while removing its rectangular color", async () => {
  const module = await import("../src/preview.ts") as typeof import("../src/preview.ts") & {
    phoneForegroundVisual?: (visual: {
      image?: ImageBitmap
      imagePath?: string
      source?: [number, number, number, number]
      inner?: [number, number, number, number]
      color?: string
    }) => unknown
  }
  const image = {} as ImageBitmap
  assert.equal(typeof module.phoneForegroundVisual, "function")
  assert.deepEqual(
    module.phoneForegroundVisual?.({
      image,
      imagePath: "skin/res/foreground.png",
      source: [1, 2, 30, 40],
      inner: [3, 4, 5, 6],
      color: "#333333",
    }),
    {
      image,
      imagePath: "skin/res/foreground.png",
      source: [1, 2, 30, 40],
      inner: [3, 4, 5, 6],
    },
  )
})

test("uses only drawable phone foregrounds to suppress fallback text", async () => {
  const module = await import("../src/preview.ts") as typeof import("../src/preview.ts") & {
    phoneForegroundLayers?: (visuals: Array<{
      image?: ImageBitmap
      source?: [number, number, number, number]
      color?: string
    } | undefined>) => Array<unknown>
  }
  const show = previewItems(IniDocument.parse("[KEY1]\nVIEW_RECT=0,0,100,100\nSHOW=q\n"))[0]
  const center = previewItems(IniDocument.parse("[KEY2]\nVIEW_RECT=0,0,100,100\nCENTER=空格\n"))[0]
  const image = {} as ImageBitmap

  assert.equal(typeof module.phoneForegroundLayers, "function")
  assert.equal(
    previewFallbackText(show, "preview", module.phoneForegroundLayers?.([{ color: "#333333" }]).some(Boolean) ?? true),
    "q",
  )
  assert.equal(
    previewFallbackText(center, "edit", module.phoneForegroundLayers?.([{ color: "#333333" }]).some(Boolean) ?? true),
    "空格",
  )
  assert.equal(
    previewFallbackText(show, "preview", module.phoneForegroundLayers?.([{ image, source: [0, 0, 20, 20] }]).some(Boolean) ?? false),
    "",
  )
})

test("uses the invisible ICON2 rectangle as the three-slot phone toolbar", async () => {
  const module = await import("../src/preview.ts") as typeof import("../src/preview.ts") & {
    dynamicToolbarRect?: (
      document: IniDocument,
      width: number,
      height: number,
    ) => { x: number; y: number; width: number; height: number } | undefined
  }
  const document = IniDocument.parse(
    "[ICON2]\nSIZE=790,133\nANCHOR_TYPE=2\nPOS=-395,0\nKEY=F14\n",
  )
  assert.equal(typeof module.dynamicToolbarRect, "function")
  assert.deepEqual(module.dynamicToolbarRect?.(document, 1125, 133), {
    x: 167.5,
    y: 0,
    width: 790,
    height: 133,
  })
})

test("uses Command, Ctrl, or Shift for additive selection", () => {
  assert.equal(isAdditiveSelection({ metaKey: true, ctrlKey: false, shiftKey: false }), true)
  assert.equal(isAdditiveSelection({ metaKey: false, ctrlKey: true, shiftKey: false }), true)
  assert.equal(isAdditiveSelection({ metaKey: false, ctrlKey: false, shiftKey: true }), true)
  assert.equal(isAdditiveSelection({ metaKey: false, ctrlKey: false, shiftKey: false }), false)
})

test("uses the selected preview theme for the canvas fallback", () => {
  assert.equal(previewBackground("light"), "#d1d4da")
  assert.equal(previewBackground("dark"), "#1c1c1e")
})

test("keeps the phone canvas transparent so translucent skins show the app beneath", () => {
  assert.equal(previewSurfaceColor("dark", true), undefined)
  assert.equal(previewSurfaceColor("dark", false), "#1c1c1e")
})

test("does not composite a full-panel skin background twice", () => {
  const item = previewItems(IniDocument.parse("[KEY1]\nVIEW_RECT=0,0,1125,595\nBACK_STYLE=1103\n"))[0]
  assert.equal(shouldDrawItemBackground(item, "1103", 1125, 595), false)
  assert.equal(shouldDrawItemBackground(item, "1102", 1125, 595), true)
})

test("uses fallback key chrome only when a key has no resolved background", () => {
  assert.equal(shouldDrawFallbackKeyChrome(true, false), true)
  assert.equal(shouldDrawFallbackKeyChrome(true, true), false)
  assert.equal(shouldDrawFallbackKeyChrome(false, false), false)
})

test("hides editor selection outlines in interaction preview", () => {
  assert.equal(previewSelectionVisible("preview", true), false)
  assert.equal(previewSelectionVisible("edit", true), true)
})
