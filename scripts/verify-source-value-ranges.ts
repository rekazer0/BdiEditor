import assert from "node:assert/strict"
import { replacedSourceColor, sourceValueRanges } from "../src/source-value-ranges.ts"

assert.equal(replacedSourceColor("FF000000", "#1a2b3c"), "FF1A2B3C", "8 位颜色调节后应保留 alpha")
assert.equal(replacedSourceColor("#FFFF00", "#123456"), "#123456", "6 位颜色调节后应保留井号前缀")
assert.equal(replacedSourceColor("invalid", "#123456"), undefined, "无效颜色不应写回源码")

const ini = [
  "[KEY1]",
  "BACK_STYLE=119",
  "FORE_STYLE=248, 408,380,381",
  "CENTER=F38",
  "STAT_STYLE=S5_1",
  "POS_TYPE=18,53,63,64",
  "NM_COLOR=cc808080",
  "LINE_COLOR=#FFFF00",
  "VALUE=1234567",
  "OTHER=119",
].join("\n")

const ranges = sourceValueRanges(ini, "ini")
const summaries = ranges.map(({ value, kind, color }) => ({ value, kind, color }))

assert.deepEqual(
  summaries,
  [
    { value: "119", kind: "style", color: undefined },
    { value: "248", kind: "style", color: undefined },
    { value: "408", kind: "style", color: undefined },
    { value: "380", kind: "style", color: undefined },
    { value: "381", kind: "style", color: undefined },
    { value: "F38", kind: "action", color: undefined },
    { value: "S5_1", kind: "action", color: undefined },
    { value: "cc808080", kind: "color", color: "rgba(128, 128, 128, 0.8)" },
    { value: "#FFFF00", kind: "color", color: "#FFFF00" },
    { value: "1234567", kind: "style", color: undefined },
  ],
  "应按字段语义识别短样式 ID、样式列表、动作与颜色，且不误判普通数字",
)

for (const range of ranges) {
  assert.equal(ini.slice(range.from, range.to), range.value, `范围应精确覆盖 ${range.value}`)
}

const json = JSON.stringify({
  backStyle: 119,
  foreStyles: "248",
  normalColor: "cc808080",
  action: "F38",
  position: 119,
}, null, 2)
const jsonRanges = sourceValueRanges(json, "json").map(({ value, kind }) => ({ value, kind }))
assert.deepEqual(jsonRanges, [
  { value: "119", kind: "style" },
  { value: "248", kind: "style" },
  { value: "cc808080", kind: "color" },
  { value: "F38", kind: "action" },
])

console.log("✓ 源码值解析与缩略图范围验证通过")
