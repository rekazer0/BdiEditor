import assert from "node:assert/strict"
import test from "node:test"
import { IniDocument } from "../src/ini.ts"
import {
  availableSkinStates,
  panelConversionPaths,
  previewScalePercent,
  scaleIniDocument,
  stateStyleValue,
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
