import assert from "node:assert/strict"
import { sourceCompletions } from "../src/source-completion.ts"

const key = sourceCompletions("CENT", "ini")
assert.equal(key?.kind, "key")
assert.equal(key?.replaceLength, 4)
assert.deepEqual(
  key?.items.find((item) => item.label === "CENTER"),
  { label: "CENTER", detail: "点击动作", kind: "key", apply: "CENTER=" },
)
assert.equal(key?.items.some((item) => item.label === "F1"), false, "键名位置不应提供功能码值")

const action = sourceCompletions("CENTER=F3", "ini")
assert.equal(action?.kind, "value")
assert.equal(action?.replaceLength, 2)
assert.match(action?.items.find((item) => item.label === "F36")?.detail ?? "", /退格/)
assert.equal(action?.items.every((item) => item.kind === "value"), true)

const state = sourceCompletions("STAT_STYLE=S1", "ini")
assert.equal(state?.kind, "value")
assert.match(state?.items.find((item) => item.label === "S1")?.detail ?? "", /英文首字母大写/)

assert.equal(sourceCompletions("VIEW_RECT=F", "ini"), undefined, "非动作字段不应提供功能码")
assert.deepEqual(
  sourceCompletions("NO_BLUR=", "ini")?.items.map(({ label, detail }) => ({ label, detail })),
  [{ label: "0", detail: "模糊输入" }, { label: "1", detail: "精确输入" }],
)

const manualKeys = sourceCompletions("", "ini", true)
assert.equal(manualKeys?.kind, "key")
assert.equal(manualKeys?.items.some((item) => item.label === "VIEW_RECT" && /显示区域/.test(item.detail)), true)
assert.equal(manualKeys?.items.some((item) => item.label === "TIP_NUM" && /补丁数量/.test(item.detail)), true)
assert.equal(manualKeys?.items.some((item) => item.label === "INNER_RECT" && /内切拉伸区域/.test(item.detail)), true)

const jsonKey = sourceCompletions('{"back', "json")
assert.deepEqual(
  jsonKey?.items.find((item) => item.label === "backStyle"),
  { label: "backStyle", detail: "背景样式", kind: "key", apply: 'backStyle": ' },
)
const jsonValue = sourceCompletions('"action": "F3', "json")
assert.equal(jsonValue?.kind, "value")
assert.match(jsonValue?.items.find((item) => item.label === "F36")?.detail ?? "", /退格/)

console.log("✓ 源代码补全可区分键和值，并为候选提供中文说明")
