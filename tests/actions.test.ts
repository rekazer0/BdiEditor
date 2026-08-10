import assert from "node:assert/strict"
import test from "node:test"
import { previewPageTarget, previewPageTransition } from "../src/actions.ts"
import { IniDocument } from "../src/ini.ts"

test("preview page resolves explicit and supported keyboard actions", () => {
  assert.equal(previewPageTarget("Z+num2", "py_9.ini", "py_9.ini"), "num2.ini")
  assert.equal(previewPageTarget("F6", "py_9.ini", "py_9.ini"), "num_9.ini")
  assert.equal(previewPageTarget("F6", "num_9.ini", "py_9.ini"), "py_9.ini")
  assert.equal(previewPageTarget("F1", "py_26.ini", "py_26.ini"), "symbol.ini")
  assert.equal(previewPageTarget("F4", "symbol.ini", "py_26.ini"), "py_26.ini")
  assert.equal(previewPageTarget("F16", "py_9.ini", "py_9.ini"), "en_26.ini")
  assert.equal(previewPageTarget("F15", "en_26.ini", "py_9.ini"), "py_9.ini")
  assert.equal(previewPageTarget("F99", "py_9.ini", "py_9.ini"), undefined)
})

test("preview page returns to the keyboard layout that opened a transient page", () => {
  const english = previewPageTransition("F16", "py_9.ini", "py_26.ini")
  assert.deepEqual(english, { target: "en_26.ini", returnName: "py_9.ini" })
  assert.deepEqual(previewPageTransition("F16", english.target!, english.returnName), {
    target: "py_9.ini",
    returnName: "py_9.ini",
  })

  const symbols = previewPageTransition("F1", "py_26.ini", "py_9.ini")
  assert.deepEqual(symbols, { target: "symbol.ini", returnName: "py_26.ini" })
  assert.deepEqual(previewPageTransition("F4", symbols.target!, symbols.returnName), {
    target: "py_26.ini",
    returnName: "py_26.ini",
  })
})

test("parses only supported S0-S99 preview state actions", async () => {
  const actions = await import("../src/actions.ts") as typeof import("../src/actions.ts") & {
    previewStateFromAction?: (code: string) => number | undefined
  }

  assert.equal(actions.previewStateFromAction?.("S0"), 0)
  assert.equal(actions.previewStateFromAction?.("S4"), 4)
  assert.equal(actions.previewStateFromAction?.("S4_2"), 4)
  assert.equal(actions.previewStateFromAction?.("S99_12"), 99)
  assert.equal(actions.previewStateFromAction?.("S100"), undefined)
  assert.equal(actions.previewStateFromAction?.("S4_extra"), undefined)
  assert.equal(actions.previewStateFromAction?.("F4"), undefined)
})

test("9-key summary counts grouped letter keys but excludes state and delete keys", async () => {
  const actions = await import("../src/actions.ts") as typeof import("../src/actions.ts") & {
    layoutLetterKeyCount?: (document: IniDocument) => number
  }
  const document = IniDocument.parse(
    "[KEY1]\nCENTER=QW\n[KEY2]\nCENTER=ER\n[KEY3]\nCENTER=S4_2\n[KEY4]\nCENTER=F36\n[KEY5]\nCENTER=Z+symbol\n",
  )

  assert.equal(typeof actions.layoutLetterKeyCount, "function")
  assert.equal(actions.layoutLetterKeyCount?.(document), 2)
})
