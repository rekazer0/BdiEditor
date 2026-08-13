import assert from "node:assert/strict"
import test from "node:test"
import { adaptIos26KeyboardLayout, adaptIos26Variant, isIos26Adapted } from "../src/ios26.ts"

test("adapts iOS 26 candidate backgrounds without touching the shared panel", () => {
  const cand = "[CAND]\nBACK_STYLE=117\nPADDING=0,6,150,0\n"
  const gen = "[PANEL]\nBACK_STYLE=116\nSIZE=1080,573\n\n[CAND]\nLAYOUT_NAME=cand1\n"
  const styles = "[STYLE117]\nNM_COLOR=ffd0d4db\nHL_COLOR=ffd0d4db\n"

  const adapted = adaptIos26Variant(cand, gen, styles)

  assert.match(adapted.candidate, /\[CAND\]\nBACK_STYLE=118/)
  assert.match(adapted.general, /\[PANEL\]\nBACK_STYLE=116\nSIZE=1080,573/)
  assert.match(adapted.general, /\[SCAND\]\nBACK_STYLE=118/)
  assert.match(adapted.styles, /\[STYLE118\][\s\S]*NM_COLOR=00d0d4db[\s\S]*HL_COLOR=00d0d4db/)
  assert.match(adapted.styles, /\[STYLE119\][\s\S]*NM_COLOR=01d0d4db[\s\S]*HL_COLOR=01d0d4db/)
  assert.equal(isIos26Adapted(adapted.candidate, adapted.general), true)
  assert.equal(isIos26Adapted(cand, gen), false)
})

test("adapts keyboard layouts but preserves auxiliary panels", () => {
  const layout = "[PANEL]\nBACK_STYLE=1103\nKEY_NUM=100\n"

  for (const name of ["py_9.ini", "en_26.ini", "tool_26.ini", "bh.ini", "hw_full.ini"]) {
    assert.match(adaptIos26KeyboardLayout(name, layout, "119"), /BACK_STYLE=119/)
  }
  for (const name of ["help.ini", "symbol.ini", "sel_ch.ini", "logo.ini", "gen.ini"]) {
    assert.equal(adaptIos26KeyboardLayout(name, layout, "119"), layout)
  }
})
