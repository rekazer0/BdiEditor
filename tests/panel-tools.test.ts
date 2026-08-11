import assert from "node:assert/strict"
import test from "node:test"
import { IniDocument } from "../src/ini.ts"
import {
  availableSkinStates,
  canvasFitWidth,
  copiedResourceBase,
  copyablePanelPaths,
  mergePanelStyles,
  panelConversionPaths,
  panelStyleIDs,
  previewScalePercent,
  rewritePanelStyleIDs,
  rewriteStyleImageBases,
  scalePanelDocument,
  scaleIniDocument,
  stateStyleValue,
  validPanelFilename,
} from "../src/panel-tools.ts"

test("reads the S states used by official Baidu layouts", () => {
  const document = IniDocument.parse([
    "[KEY1]",
    "STAT_STYLE=S34_8",
    "[KEY2]",
    "STAT_STYLE=S11_4|S17_1|S23_2|S27_3|S21_5",
  ].join("\n"))
  assert.deepEqual(availableSkinStates(document), [11, 17, 21, 23, 27, 34])
  assert.equal(stateStyleValue("S11_4|S17_1", 17), 1)
  assert.equal(stateStyleValue("S11_4|S17_1", 4), undefined)
})

test("resolves TIP sections only for supported active states", async () => {
  const tools = await import("../src/panel-tools.ts") as typeof import("../src/panel-tools.ts") & {
    stateTipSection?: (value: string | undefined, state: number | undefined) => number | undefined
  }

  assert.equal(tools.stateTipSection?.("S4_2|S17_5", 4), 2)
  assert.equal(tools.stateTipSection?.("S4_2|S17_5", 17), 5)
  assert.equal(tools.stateTipSection?.("S4_2", 0), undefined)
  assert.equal(tools.stateTipSection?.("S4_2", 100), undefined)
  assert.equal(tools.stateTipSection?.("S4_2", undefined), undefined)
})

test("combines S states from every layout in the current skin", () => {
  const keyboard = IniDocument.parse(
    "[KEY1]\nSTAT_STYLE=S1_2|S4_3|S100_7\nCENTER=S9_2\n[KEY2]\nCENTER=S0\n",
  )
  const symbols = IniDocument.parse("[KEY1]\nSTAT_STYLE=S6_2|S8_3\nCENTER=S99\n")
  assert.deepEqual(availableSkinStates(keyboard, symbols), [1, 4, 6, 8, 9, 99])
})

test("reports the actual panel-to-canvas scale", () => {
  assert.equal(previewScalePercent(960, 313, 1920, 626), 50)
  assert.equal(previewScalePercent(800, 500, 1125, 595), 71)
})

test("fits the candidate toolbar and panel with one shared scale", () => {
  assert.equal(canvasFitWidth(1200, 900, 1080, 704), 1080)
  assert.equal(canvasFitWidth(900, 900, 1080, 704), 900)
  assert.equal(canvasFitWidth(1200, 528, 1080, 704), 810)
})

test("scales official panel geometry with independent horizontal and vertical ratios", () => {
  const scaled = scaleIniDocument(IniDocument.parse([
    "[PANEL]",
    "SIZE=1080,600",
    "[KEY1]",
    "VIEW_RECT=100,50,200,100",
    "TOUCH_RECT=90,40,220,120",
    "FORE_OFFSET=-10,20;30,-40",
    "[LIST]",
    "CELL_SIZE=120,80",
    "PADDING=10,20,30,40",
  ].join("\n")), 16 / 9, 1.2)
  assert.equal(scaled.get("PANEL", "SIZE"), "1920,720")
  assert.equal(scaled.get("KEY1", "VIEW_RECT"), "178,60,356,120")
  assert.equal(scaled.get("KEY1", "TOUCH_RECT"), "160,48,391,144")
  assert.equal(scaled.get("KEY1", "FORE_OFFSET"), "-18,24;53,-48")
  assert.equal(scaled.get("LIST", "CELL_SIZE"), "213,96")
  assert.equal(scaled.get("LIST", "PADDING"), "18,24,53,48")
})

test("scaled panel owns its configured target size instead of inheriting gen.ini", () => {
  const scaled = scalePanelDocument(
    IniDocument.parse("[PANEL]\nKEY_NUM=1\n[KEY1]\nVIEW_RECT=100,50,200,100\n"),
    800 / 1080,
    400 / 635,
    800,
    400,
  )
  assert.equal(scaled.get("PANEL", "SIZE"), "800,400")
  assert.equal(scaled.get("KEY1", "VIEW_RECT"), "74,31,148,63")
})

test("plans a complete portrait-to-landscape theme conversion", () => {
  const names = [
    "light/skin/port/gen.ini",
    "light/skin/port/py_26.ini",
    "light/skin/port/res/key.png",
    "light/skin/res/shared.png",
    "dark/skin/port/gen.ini",
  ]
  assert.deepEqual(panelConversionPaths(names, ["light"]), [
    { source: "light/skin/port/gen.ini", target: "light/skin/land/gen.ini" },
    { source: "light/skin/port/py_26.ini", target: "light/skin/land/py_26.ini" },
    { source: "light/skin/port/res/key.png", target: "light/skin/land/res/key.png" },
  ])
})

test("lists real copyable panels and validates target basenames", () => {
  assert.deepEqual(copyablePanelPaths([
    "light/skin/port/gen.ini",
    "light/skin/port/py_9.ini",
    "dark/skin/land/en_26.ini",
    "dark/skin/land/res/default.css",
    "dark/skin/land/nested/ignored.ini",
    "light/skin/port/cand1.cnd",
  ]), [
    "dark/skin/land/en_26.ini",
    "light/skin/port/py_9.ini",
  ])
  assert.equal(validPanelFilename("custom.ini"), true)
  assert.equal(validPanelFilename("../custom.ini"), false)
  assert.equal(validPanelFilename("folder/custom.ini"), false)
  assert.equal(validPanelFilename("gen.ini"), false)
  assert.equal(validPanelFilename("custom.txt"), false)
})

test("collects and rewrites every panel style reference", () => {
  const source = IniDocument.parse([
    "[PANEL]",
    "BACK_STYLE=186",
    "CELL_STYLE=318",
    "[KEY1]",
    "BACK_STYLE=118",
    "FORE_STYLE=69,191",
    "STAT_STYLE=S34_7|S99_18",
    "CENTER=F36",
  ].join("\n"))

  assert.deepEqual(panelStyleIDs(source), [7, 18, 69, 118, 186, 191, 318])
  const rewritten = rewritePanelStyleIDs(source, new Map([
    [7, 701],
    [69, 702],
    [186, 703],
    [318, 704],
  ]))
  assert.equal(rewritten.get("PANEL", "BACK_STYLE"), "703")
  assert.equal(rewritten.get("PANEL", "CELL_STYLE"), "704")
  assert.equal(rewritten.get("KEY1", "BACK_STYLE"), "118")
  assert.equal(rewritten.get("KEY1", "FORE_STYLE"), "702,191")
  assert.equal(rewritten.get("KEY1", "STAT_STYLE"), "S34_701|S99_18")
  assert.equal(rewritten.get("KEY1", "CENTER"), "F36")
  assert.equal(source.get("PANEL", "BACK_STYLE"), "186")
})

test("merges missing and identical styles but renumbers conflicts", () => {
  const panel = IniDocument.parse("[KEY1]\nBACK_STYLE=1\nFORE_STYLE=2,3\n")
  const source = IniDocument.parse([
    "[GLOBAL]",
    "STYLE_NUM=3",
    "[STYLE1]",
    "NM_COLOR=FFFFFF",
    "[STYLE2]",
    "NM_IMG=btn,1",
    "[STYLE3]",
    "NM_COLOR=333333",
  ].join("\n"))
  const target = IniDocument.parse([
    "[GLOBAL]",
    "STYLE_NUM=4",
    "[STYLE1]",
    "NM_COLOR=FFFFFF",
    "[STYLE2]",
    "NM_IMG=other,1",
    "[STYLE4]",
    "NM_COLOR=444444",
  ].join("\n"))

  const merged = mergePanelStyles(panel, source, target)
  assert.deepEqual([...merged.styleIDs], [[1, 1], [2, 5], [3, 3]])
  assert.equal(merged.panel.get("KEY1", "BACK_STYLE"), "1")
  assert.equal(merged.panel.get("KEY1", "FORE_STYLE"), "5,3")
  assert.deepEqual(merged.styles.entries("STYLE5"), [{ section: "STYLE5", key: "NM_IMG", value: "btn,1" }])
  assert.deepEqual(merged.styles.entries("STYLE3"), [{ section: "STYLE3", key: "NM_COLOR", value: "333333" }])
  assert.equal(merged.styles.get("GLOBAL", "STYLE_NUM"), "5")
})

test("rewrites copied style atlas names without touching other sections", () => {
  const source = IniDocument.parse([
    "[STYLE1]",
    "NM_IMG=btn,1",
    "HL_IMG=btn,4",
    "[STYLE2]",
    "NM_IMG=other,1",
  ].join("\n"))
  const rewritten = rewriteStyleImageBases(source, [1], new Map([["btn", "btn_copy2"]]))
  assert.equal(rewritten.get("STYLE1", "NM_IMG"), "btn_copy2,1")
  assert.equal(rewritten.get("STYLE1", "HL_IMG"), "btn_copy2,4")
  assert.equal(rewritten.get("STYLE2", "NM_IMG"), "other,1")
})

test("reuses identical resource pairs and allocates deterministic conflict names", () => {
  const png = new Uint8Array([1, 2, 3])
  const til = new Uint8Array([4, 5])
  const existing = new Map([
    ["btn", { png: png.slice(), til: til.slice() }],
    ["key", { png: new Uint8Array([9]), til: new Uint8Array([9]) }],
    ["key_copy2", { png: new Uint8Array([8]), til: new Uint8Array([8]) }],
  ])
  assert.equal(copiedResourceBase("btn", png, til, existing), "btn")
  assert.equal(copiedResourceBase("btn", png, til, existing, true), "btn_copy2")
  assert.equal(copiedResourceBase("key", png, til, existing), "key_copy3")
  assert.equal(copiedResourceBase("new", png, til, existing), "new")
})
