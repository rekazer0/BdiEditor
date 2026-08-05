import assert from "node:assert/strict"
import test from "node:test"
import {
  backgroundStyleSections,
  keyboardConfig,
  resolvePanelConfig,
  setKeyboardHeight,
  setStyleField,
} from "../src/keyboard.ts"
import { IniDocument } from "../src/ini.ts"

test("keyboard config reads panel size and background style", () => {
  const gen = IniDocument.parse("[PANEL]\nSIZE=1125,648\nBACK_STYLE=14\n")
  const styles = IniDocument.parse("[STYLE14]\nNM_COLOR=80010203\nHL_COLOR=40040506\n")
  assert.deepEqual(keyboardConfig(gen, styles), {
    width: 1125,
    height: 648,
    styleID: "14",
    normalImage: "",
    pressedImage: "",
    normalColor: "80010203",
    pressedColor: "40040506",
  })
})

test("keyboard config changes only the panel height", () => {
  const gen = IniDocument.parse("[PANEL]\nSIZE=1125,648\nBACK_STYLE=14\n")
  assert.equal(setKeyboardHeight(gen, 720), true)
  assert.equal(gen.get("PANEL", "SIZE"), "1125,720")
})

test("component panel size and style override the general keyboard panel", () => {
  const layout = IniDocument.parse("[PANEL]\nSIZE=1125,728\nBACK_STYLE=1104\n")
  const gen = IniDocument.parse("[PANEL]\nSIZE=1125,595\nBACK_STYLE=1103\n")
  const styles = IniDocument.parse("[STYLE1104]\nNM_IMG=symbol,1\n")
  assert.deepEqual(resolvePanelConfig(layout, gen, styles), {
    width: 1125,
    height: 728,
    styleID: "1104",
    normalImage: "symbol,1",
    pressedImage: "",
    normalColor: "",
    pressedColor: "",
  })
})

test("invalid component panel properties fall back independently", () => {
  const layout = IniDocument.parse("[PANEL]\nSIZE=bad,0\n")
  const gen = IniDocument.parse("[PANEL]\nSIZE=1125,595\nBACK_STYLE=1103\n")
  const styles = IniDocument.parse("[STYLE1103]\nNM_COLOR=80112233\n")
  const result = resolvePanelConfig(layout, gen, styles)
  assert.equal(result.width, 1125)
  assert.equal(result.height, 595)
  assert.equal(result.styleID, "1103")
})

test("batch key images updates every unique background style", () => {
  const layout = IniDocument.parse(
    "[KEY1]\nBACK_STYLE=211\n[KEY2]\nBACK_STYLE=212,99\n[KEY3]\nBACK_STYLE=211\n",
  )
  const styles = IniDocument.parse(
    "[STYLE211]\nNM_IMG=old,1\n[STYLE212]\nNM_IMG=old,2\n",
  )
  const sections = backgroundStyleSections(layout, ["KEY1", "KEY2", "KEY3"])
  assert.deepEqual(sections, ["STYLE211", "STYLE212"])
  assert.equal(setStyleField(styles, sections, "NM_IMG", "btn,7"), true)
  assert.equal(styles.get("STYLE211", "NM_IMG"), "btn,7")
  assert.equal(styles.get("STYLE212", "NM_IMG"), "btn,7")
})
