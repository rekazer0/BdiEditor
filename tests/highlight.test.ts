import assert from "node:assert/strict"
import test from "node:test"
import { highlightIni } from "../src/highlight.ts"

test("highlights INI sections, keys, comments, numbers and action codes", () => {
  const html = highlightIni(
    "; comment\n[KEY1]\nVIEW_RECT=0,5,224,160\nUP=F16\nSTATE=S4_2\nCENTER=Z+num2\n",
  )
  assert.match(html, /token-comment/)
  assert.match(html, /token-section/)
  assert.match(html, /token-key/)
  assert.match(html, /token-number/)
  assert.match(html, /token-action/)
  assert.equal(html.includes("<script>"), false)
})

test("escapes source text before highlighting", () => {
  assert.match(highlightIni("CENTER=<script>"), /&lt;script&gt;/)
})

test("marks every line in the selected section", () => {
  const html = highlightIni("[KEY1]\nCENTER=a\nUP=b\n[KEY2]\nCENTER=c", ["KEY1"])
  assert.equal((html.match(/class="token-selected"/g) ?? []).length, 3)
})
