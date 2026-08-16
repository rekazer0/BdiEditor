import assert from "node:assert/strict"
import test from "node:test"
import { gestureDirection, rectToString } from "../src/layout.ts"
import { IniDocument } from "../src/ini.ts"
import { animationSequenceForKey, effectivePreviewItem, foregroundTextPoint, isAdditiveSelection, isTouchLongPress, legacyAnimationOpacity, legacyAnimationScale, legacyAnimationTranslation, offsetFromSection, parseLegacyAnimation, Preview, previewBackground, previewFallbackText, previewHitRect, previewItems, previewSelectionVisible, previewStateActive, previewSurfaceColor, shouldDrawItemBackground, visiblePreviewItems, type PreviewEvent } from "../src/preview.ts"

test("classifies click, hold and directional gestures", () => {
  assert.equal(gestureDirection(2, 3, 100, true), "center")
  assert.equal(gestureDirection(2, 3, 500, true), "hold")
  assert.equal(gestureDirection(40, 5, 100, false), "right")
  assert.equal(gestureDirection(3, -40, 100, false), "up")
})

test("hit testing includes resized visual bounds and configured touch bounds", () => {
  const item = previewItems(IniDocument.parse("[KEY1]\nVIEW_RECT=0,0,200,100\nTOUCH_RECT=0,0,100,50\n"))[0]
  assert.deepEqual(previewHitRect(item, "edit"), item.rect)
  assert.deepEqual(previewHitRect(item, "preview"), item.rect)
  const extendedTouch = previewItems(IniDocument.parse("[KEY1]\nVIEW_RECT=20,20,50,50\nTOUCH_RECT=0,0,100,80\n"))[0]
  assert.deepEqual(previewHitRect(extendedTouch, "preview"), { x: 0, y: 0, width: 100, height: 80 })
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

test("candidate toolbar renders only its default mutually exclusive state", () => {
  const document = IniDocument.parse(
    "[CAND]\nBACK_STYLE=1\n[ICON3]\nFORE_STYLE=2\nSIZE=100,100\nPERSIST=1\n" +
    "[ICON4]\nFORE_STYLE=3\nSIZE=100,100\nPERSIST=2\n[TIP1]\nFORE_STYLE=4\nSIZE=100,100\n",
  )
  assert.deepEqual(previewItems(document).map((item) => item.section), ["CAND", "ICON3"])
})

test("candidate toolbar never displays internal ICON section names", () => {
  const items = previewItems(IniDocument.parse(
    "[CAND]\nBACK_STYLE=1\n[ICON1]\nFORE_STYLE=2\nSIZE=100,100\n",
  ))
  assert.equal(items.find((item) => item.section === "ICON1")?.show, "")
})

test("symbol preview renders only content present in the skin files", () => {
  const document = IniDocument.parse(
    "[MORE]\nGRID=4,4\n[LIST]\nCELL_SIZE=200,100\nPOS=0,0\nLIST_NUM=5\nNAMES=， 。 ？ ！ ～\n" +
    "[KEY1]\nVIEW_RECT=200,0,800,400\nCENTER=F55\n",
  )
  const defaults = IniDocument.parse("[MORE]\nCELL_STYLE=148\nFORE_STYLE=2\n")
  const items = previewItems(document, 1000, 500, defaults)
  assert.equal(items.some((item) => item.section.startsWith("MORE:")), false)
  assert.deepEqual(
    items.filter((item) => item.section.startsWith("LIST:")).map((item) => item.show),
    ["，", "。", "？", "！", "～"],
  )
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

test("activates a key only when its official STAT_STYLE contains the selected S state", () => {
  const item = previewItems(IniDocument.parse(
    "[KEY35]\nVIEW_RECT=0,0,100,100\nSTAT_STYLE=S11_4|S17_1|S23_2\n",
  ))[0]
  assert.equal(previewStateActive(item, 17), true)
  assert.equal(previewStateActive(item, 4), false)
  assert.equal(previewStateActive(item, undefined), false)
})

test("renders one logical key from a state key and its fallback alias", () => {
  const items = previewItems(IniDocument.parse(
    "[KEY1]\nVIEW_RECT=0,0,100,100\nSHOW=a\nCENTER=a\nSTAT_STYLE=S0_1|S4_2\n" +
    "[KEY2]\nVIEW_RECT=0,0,100,100\nSHOW=a\nCENTER=a\n",
  ))

  const defaultKeys = visiblePreviewItems(items)
  assert.deepEqual(defaultKeys.map((item) => item.section), ["KEY1"])
  assert.deepEqual(defaultKeys[0].sections, ["KEY1", "KEY2"])
  assert.deepEqual(visiblePreviewItems(items, 4).map((item) => item.section), ["KEY1"])
  assert.deepEqual(visiblePreviewItems(items, 7).map((item) => item.section), ["KEY2"])
})

test("preview pointer events hit the active state key without selecting it", async () => {
  const document = IniDocument.parse(
    "[KEY1]\nVIEW_RECT=0,0,1080,595\n" +
    "[KEY9]\nVIEW_RECT=662,296,247,149\nSHOW=9\nCENTER=x\nSTAT_STYLE=S4_12|S0_1\n" +
    "[KEY29]\nVIEW_RECT=662,296,247,149\nSHOW=9\nCENTER=x\n",
  )
  const canvas = {
    width: 1080,
    height: 595,
    style: { cursor: "" },
    addEventListener: () => {},
    setPointerCapture: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1080, height: 595 }),
  } as unknown as HTMLCanvasElement
  const events: PreviewEvent[] = []
  const selections: string[][] = []
  const preview = new Preview(canvas, (event) => events.push(event), (sections) => selections.push(sections)) as unknown as {
    keys: ReturnType<typeof previewItems>
    skinState?: number
    mode: "preview"
    draw: () => Promise<void>
    playAnimation: () => Promise<void>
    pointerDown: (event: PointerEvent) => void
    pointerUp: (event: PointerEvent) => void
    active?: unknown
  }
  preview.keys = previewItems(document, 1080, 595)
  preview.mode = "preview"
  preview.draw = async () => {}
  preview.playAnimation = async () => {}
  const pointer = {
    clientX: 785.5,
    clientY: 370.5,
    pointerId: 1,
    pointerType: "mouse",
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
  } as PointerEvent

  for (const [state, section] of [[undefined, "KEY9"], [4, "KEY9"], [8, "KEY29"]] as const) {
    preview.skinState = state
    preview.pointerDown(pointer)
    preview.pointerUp(pointer)
    assert.equal(events.at(-1)?.section, section)
    assert.equal(events.at(-1)?.code, "x")
  }
  assert.deepEqual(selections, [])

  const touch = { ...pointer, pointerId: 2, pointerType: "touch" } as PointerEvent
  preview.pointerDown(touch)
  preview.pointerUp(touch)
  assert.ok(preview.active, "touch press remains visible after a quick tap")
  await new Promise((resolve) => setTimeout(resolve, 90))
  assert.equal(preview.active, undefined)
})

test("does not merge ordinary keys that happen to share actions", () => {
  const items = previewItems(IniDocument.parse(
    "[KEY1]\nVIEW_RECT=0,0,100,100\nSHOW=a\nCENTER=a\n" +
    "[KEY2]\nVIEW_RECT=0,0,100,100\nSHOW=a\nCENTER=a\n",
  ))
  assert.deepEqual(visiblePreviewItems(items).map((item) => item.section), ["KEY1", "KEY2"])
})

test("does not apply key-bubble TIP styling to keyboard keys", () => {
  const document = IniDocument.parse(
    "[KEY1]\nVIEW_RECT=0,0,100,100\nBACK_STYLE=1\nSTAT_STYLE=S0_3\n" +
    "[TIP3]\nBACK_STYLE=9\n",
  )
  assert.equal(effectivePreviewItem(document, previewItems(document)[0], 0).backStyle, "1")
})

test("resolves a matching candidate ICON TIP without changing absent properties", async () => {
  const module = await import("../src/preview.ts") as typeof import("../src/preview.ts") & {
    effectivePreviewItem?: (
      document: IniDocument,
      item: ReturnType<typeof previewItems>[number],
      state?: number,
    ) => ReturnType<typeof previewItems>[number]
  }
  const document = IniDocument.parse(
    "[ICON1]\nSIZE=100,100\nBACK_STYLE=211\nFORE_STYLE=81,180\nPOS_TYPE=2,3\nSTAT_STYLE=S4_2\n" +
    "[TIP2]\nBACK_STYLE=214\nFORE_STYLE=252\n",
  )
  const item = previewItems(document)[0]
  const effective = module.effectivePreviewItem?.(document, item, 4)

  assert.equal(effective?.backStyle, "214")
  assert.deepEqual(effective?.foreStyles, ["252"])
  assert.deepEqual(effective?.positionTypes, ["2", "3"])
})

test("keeps TOUCH_RECT separate from the visible key rectangle", () => {
  const item = previewItems(IniDocument.parse(
    "[KEY1]\nVIEW_RECT=20,20,20,20\nTOUCH_RECT=0,0,100,100\n",
  ))[0]

  assert.deepEqual(item.rect, { x: 20, y: 20, width: 20, height: 20 })
  assert.deepEqual(item.touchRect, { x: 0, y: 0, width: 100, height: 100 })
})

test("binds a BDA frame animation to its semantic key target", () => {
  const item = previewItems(IniDocument.parse(
    "[KEY1]\nVIEW_RECT=0,0,100,100\nCENTER=b\n",
  ))[0]
  const sequence = { name: "press", frames: [{ resourceID: "frame_1", duration: 16 }] }
  assert.equal(animationSequenceForKey({
    targets: ["KEY_B"],
    sequences: new Map([["KEY_B", sequence], ["press", sequence]]),
  }, item), sequence)
})

test("parses BDS and BDI press transforms for each foreground layer", () => {
  const styles = IniDocument.parse("[STYLE218]\nPRESS_ANIM=9\n[STYLE219]\nPRESS_ANIM=12\n")
  const animations = IniDocument.parse(
    "[ANIM9]\nBUILD_LIST=10,11\n" +
    "[ANIM10]\nTYPE=4\nDURATION=100\nFROM=100,100\nTO=91,91\n" +
    "[ANIM11]\nTYPE=4\nDURATION=100\nFROM=100,100\nTO=109,109\n" +
    "[ANIM12]\nTYPE=2\nDURATION=120\nFROM_PX=0,19\nTO_PX=0,0\n",
  )
  const parsed = parseLegacyAnimation(styles, animations)
  const item = previewItems(IniDocument.parse(
    "[KEY8]\nVIEW_RECT=0,0,100,100\nBACK_ANIM_STYLE=218\nFORE_ANIM_STYLE=218,219\n",
  ))[0]

  assert.equal(item.backAnimStyle, "218")
  assert.equal(item.foreAnimStyle, "218")
  assert.deepEqual(item.foreAnimStyles, ["218", "219"])
  assert.ok(Math.abs(legacyAnimationScale(parsed, item.backAnimStyle, 50)![0] - 0.955) < 1e-9)
  assert.ok(Math.abs(legacyAnimationScale(parsed, item.foreAnimStyle, 150)![0] - 1.045) < 1e-9)
  assert.equal(legacyAnimationScale(parsed, item.foreAnimStyle, 201), undefined)
  assert.deepEqual(legacyAnimationTranslation(parsed, item.foreAnimStyles[1], 60), [0, 9.5])
})

test("composes dynamic ANIM_STYLE opacity, scale and translation tracks", () => {
  const styles = IniDocument.parse("[STYLE446]\nSHOW_ANIM=5\n")
  const animations = IniDocument.parse(
    "[ANIM5]\nBUILD_LIST=7,8,9\nBUILD_METHOD=0\n" +
    "[ANIM7]\nTYPE=0\nDURATION=120\nFROM=0\nTO=255\n" +
    "[ANIM8]\nTYPE=3\nDURATION=120\nFROM=0,0\nTO=100,100\n" +
    "[ANIM9]\nTYPE=2\nDURATION=120\nFROM=0,35\nTO=0,0\n",
  )
  const parsed = parseLegacyAnimation(styles, animations)
  const item = previewItems(IniDocument.parse(
    "[KEY1]\nVIEW_RECT=0,0,100,100\nANIM_STYLE=446\n",
  ))[0]

  assert.equal(item.animStyle, "446")
  assert.equal(legacyAnimationOpacity(parsed, item.animStyle, 60), 0.5)
  assert.deepEqual(legacyAnimationScale(parsed, item.animStyle, 60), [0.5, 0.5])
  assert.deepEqual(legacyAnimationTranslation(parsed, item.animStyle, 60), [0, 17.5])
})

test("matches Baidu repeat, reverse and interpolator timing", () => {
  const parsed = parseLegacyAnimation(
    IniDocument.parse("[STYLE1]\nPRESS_ANIM=9\n"),
    IniDocument.parse(
      "[ANIM9]\nTYPE=3\nDURATION=100\nDELAY=50\nFROM=100,100\nTO=80,80\n" +
      "INTPOL=2,3\nREPEAT_CNT=2\nREPEAT_MODE=1\n",
    ),
  )

  assert.deepEqual(legacyAnimationScale(parsed, "1", 49), [1, 1])
  const eased = legacyAnimationScale(parsed, "1", 100)!
  assert.ok(Math.abs(eased[0] - 0.85) < 1e-9)
  assert.ok(Math.abs(eased[1] - 0.9) < 1e-9)
  assert.deepEqual(legacyAnimationScale(parsed, "1", 150), [0.8, 0.8])
  assert.deepEqual(legacyAnimationScale(parsed, "1", 250), [1, 1])
  assert.deepEqual(legacyAnimationScale(parsed, "1", 450), [1, 1])
  assert.equal(legacyAnimationScale(parsed, "1", 451), undefined)
})

test("renders the LIST candidate bar as one selectable button with label cells", () => {
  const document = IniDocument.parse(
    "[PANEL]\nKEY_NUM=100\n[LIST]\nCELL_SIZE=147,103\nPOS=23,19\nLIST_NUM=4\nNAMES=， 。 ？ ！ ～ 、 .\n[KEY4]\nVIEW_RECT=14,12,165,429\nBACK_STYLE=1231\n",
  )
  const bar = previewItems(document).find((item) => item.section === "LIST")!
  assert.ok(bar, "the whole candidate bar is present")
  assert.equal(bar.editable, true, "the whole candidate bar is selectable on the canvas")
  assert.deepEqual(bar.rect, { x: 23, y: 19, width: 147, height: 412 })
  const cells = previewItems(document).filter((item) => /^LIST:\d+$/.test(item.section))
  assert.deepEqual(cells.map((item) => item.show), ["，", "。", "？", "！"])
  assert.deepEqual(cells.map((item) => item.rect), [
    { x: 23, y: 19, width: 147, height: 103 },
    { x: 23, y: 122, width: 147, height: 103 },
    { x: 23, y: 225, width: 147, height: 103 },
    { x: 23, y: 328, width: 147, height: 103 },
  ])
  assert.equal(cells.every((item) => !item.editable), true, "individual punctuation cells are not separately selectable")
})

test("uses gen LIST styles when the layout only supplies list content", () => {
  const defaults = IniDocument.parse("[LIST]\nBACK_STYLE=476\nFORE_STYLE=130\nCELL_STYLE=247\n")
  const layout = IniDocument.parse(
    "[LIST]\nCELL_SIZE=150,124\nPOS=0,0\nLIST_NUM=2\nNAMES=a b\n",
  )
  const items = previewItems(layout, 300, 248, defaults)
  const bar = items.find((item) => item.section === "LIST")!
  assert.equal(bar.backStyle, "476")
  const cell = items.find((item) => item.section === "LIST:1")!
  assert.equal(cell.backStyle, "247")
  assert.deepEqual(cell.foreStyles, ["130"])
  assert.equal("fontSize" in cell, false)
})

test("candidate icons use TIP overrides for the selected state", () => {
  const document = IniDocument.parse(
    "[CAND]\nBACK_STYLE=1\n[ICON1]\nBACK_STYLE=2\nFORE_STYLE=3\nSIZE=100,100\nSTAT_STYLE=S4_5\n" +
    "[TIP5]\nBACK_STYLE=7\nFORE_STYLE=8\n",
  )
  const icon = previewItems(document, 300, 100).find((item) => item.section === "ICON1")!
  assert.equal(effectivePreviewItem(document, icon, 4).backStyle, "7")
})

test("editing preserves the skin rendering without gesture annotations", async () => {
  const module = await import("../src/preview.ts")
  const blank = previewItems(IniDocument.parse("[KEY4]\nVIEW_RECT=14,12,165,429\n"))[0]
  const labelled = previewItems(IniDocument.parse("[KEY5]\nVIEW_RECT=178,12,187,143\nSHOW=q\n"))[0]
  assert.equal(module.previewFallbackText(blank, "preview", false), "")
  assert.equal(module.previewFallbackText(blank, "edit", false), "")
  assert.equal(module.previewFallbackText(labelled, "preview", true), "")
  assert.equal("previewAnnotationsVisible" in module, false)
  assert.equal("shouldDrawFallbackKeyChrome" in module, false)
})

test("preview text never falls back from missing SHOW to CENTER action text", () => {
  const item = previewItems(IniDocument.parse(
    "[KEY3]\nVIEW_RECT=0,0,100,100\nCENTER=e\n",
  ))[0]

  assert.equal(previewFallbackText(item, "preview", false), "")
})

test("positions foreground images only from parsed offsets", async () => {
  const module = await import("../src/preview.ts") as typeof import("../src/preview.ts") & {
    foregroundLayerRect?: (
      key: { x: number; y: number; width: number; height: number },
      source: [number, number, number, number] | undefined,
      offset?: [number, number],
    ) => { x: number; y: number; width: number; height: number }
  }
  assert.equal(typeof module.foregroundLayerRect, "function")
  assert.deepEqual(
    module.foregroundLayerRect?.({ x: 178, y: 12, width: 187, height: 143 }, [0, 0, 50, 50]),
    { x: 178, y: 12, width: 187, height: 143 },
  )
  assert.deepEqual(
    module.foregroundLayerRect?.({ x: 0, y: 0, width: 110, height: 140 }, [0, 0, 50, 40], [-6, 16]),
    { x: 24, y: 66, width: 50, height: 40 },
  )
})

test("positions text-only foreground layers with the configured style offset", () => {
  assert.deepEqual(
    foregroundTextPoint({ x: 12, y: 0, width: 100, height: 127 }, [0, -42]),
    { x: 62, y: 21.5 },
  )
})

test("reads foreground offsets from both POS and R_POS gen sections", () => {
  const offsets = IniDocument.parse(
    "[OFFSET1]\nPOS=0,25\n[OFFSET75]\nR_POS=0,-32\n",
  )

  assert.deepEqual(offsetFromSection(offsets, "OFFSET1"), [0, 25])
  assert.deepEqual(offsetFromSection(offsets, "OFFSET75"), [0, -32])
  assert.equal(offsetFromSection(offsets, "OFFSET90"), undefined)
  assert.equal(offsetFromSection(undefined, "OFFSET1"), undefined)
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

test("uses only SHOW for fallback text and drawable foregrounds suppress it", async () => {
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
    "",
  )
  assert.equal(
    previewFallbackText(show, "preview", module.phoneForegroundLayers?.([{ image, source: [0, 0, 20, 20] }]).some(Boolean) ?? false),
    "",
  )
})

test("uses the F14 icon rectangle as the three-slot phone toolbar", async () => {
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

  const reordered = IniDocument.parse(
    "[ICON2]\nSIZE=130,133\nANCHOR_TYPE=3\nPOS=-130,0\nKEY=F8\n" +
    "[ICON4]\nSIZE=700,120\nANCHOR_TYPE=5\nPOS=-350,-60\nKEY=F14\n",
  )
  assert.deepEqual(module.dynamicToolbarRect?.(reordered, 1125, 133), {
    x: 212.5,
    y: 6.5,
    width: 700,
    height: 120,
  })
})

test("uses Command, Ctrl, or Shift for additive selection", () => {
  assert.equal(isAdditiveSelection({ metaKey: true, ctrlKey: false, shiftKey: false }), true)
  assert.equal(isAdditiveSelection({ metaKey: false, ctrlKey: true, shiftKey: false }), true)
  assert.equal(isAdditiveSelection({ metaKey: false, ctrlKey: false, shiftKey: true }), true)
  assert.equal(isAdditiveSelection({ metaKey: false, ctrlKey: false, shiftKey: false }), false)
})

test("treats a stationary mobile long press as additive selection", () => {
  assert.equal(isTouchLongPress("touch", 450, 12), true)
  assert.equal(isTouchLongPress("touch", 449, 0), false)
  assert.equal(isTouchLongPress("touch", 600, 13), false)
  assert.equal(isTouchLongPress("mouse", 600, 0), false)
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

test("hides editor selection outlines in interaction preview", () => {
  assert.equal(previewSelectionVisible("preview", true), false)
  assert.equal(previewSelectionVisible("edit", true), true)
})
