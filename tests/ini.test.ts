import assert from "node:assert/strict"
import test from "node:test"
import { IniDocument } from "../src/ini.ts"

test("updates one value without rewriting surrounding text", () => {
  const source = "; keep\r\n[KEY1]\r\nVIEW_RECT = 1,2,3,4\r\nUNKNOWN=x\r\n"
  const document = IniDocument.parse(source)

  assert.equal(document.set("KEY1", "VIEW_RECT", "5,6,7,8"), true)
  assert.equal(
    document.toString(),
    "; keep\r\n[KEY1]\r\nVIEW_RECT = 5,6,7,8\r\nUNKNOWN=x\r\n",
  )
})

test("reads sections and entries while preserving a UTF-8 BOM", () => {
  const document = IniDocument.parse("\uFEFF[GLOBAL]\nSTYLE_NUM=220\n\n[STYLE1]\nFONT_SIZE=45\n")

  assert.deepEqual(document.sections(), ["GLOBAL", "STYLE1"])
  assert.equal(document.get("STYLE1", "FONT_SIZE"), "45")
  assert.equal(document.toString().startsWith("\uFEFF"), true)
})

test("does not dirty an unchanged value", () => {
  const document = IniDocument.parse("[KEY1]\nCENTER=a\n")
  assert.equal(document.set("KEY1", "CENTER", "a"), false)
})

test("adds a missing value inside an existing section", () => {
  const document = IniDocument.parse("[KEY1]\r\nCENTER=q\r\n[KEY2]\r\nCENTER=w\r\n")
  assert.equal(document.set("KEY1", "HOLD", "F72"), true)
  assert.equal(document.toString(), "[KEY1]\r\nCENTER=q\r\nHOLD=F72\r\n[KEY2]\r\nCENTER=w\r\n")
})

test("adds a missing sectionless skin information value", () => {
  const document = IniDocument.parse("Name=示例\r\nAuthor=作者\r\n[EXTRA]\r\nValue=1\r\n")
  assert.equal(document.set("", "Version", "0.1"), true)
  assert.equal(
    document.toString(),
    "Name=示例\r\nAuthor=作者\r\nVersion=0.1\r\n[EXTRA]\r\nValue=1\r\n",
  )
})
