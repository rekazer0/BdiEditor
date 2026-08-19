import assert from "node:assert/strict"
import {
  MAX_SKIN_STATE,
  MIN_SKIN_STATE,
  knownSkinStates,
  previewStateFromAction,
  skinStateFallbackText,
  skinStateForcesComposition,
  skinStateLabel,
} from "../src/actions.ts"
import { IniDocument } from "../src/ini.ts"
import { availableSkinStates, stateTipSection } from "../src/panel-tools.ts"
import { effectivePreviewItem, previewItems, previewStateImpact } from "../src/preview.ts"
import { candidatePreview } from "../src/simulation.ts"

assert.equal(knownSkinStates.length, 122)
assert.equal(knownSkinStates[0], MIN_SKIN_STATE)
assert.equal(knownSkinStates.at(-1), MAX_SKIN_STATE)
for (let state = MIN_SKIN_STATE; state <= MAX_SKIN_STATE; state += 1) {
  assert.equal(previewStateFromAction(`S${state}`), state, `S${state} 应可解析`)
  assert.equal(previewStateFromAction(`S${state}_999`), state, `S${state}_TIP 应可解析`)
  assert.ok(skinStateLabel(state).startsWith(`S${state}`), `S${state} 应有稳定标签`)
}
assert.equal(previewStateFromAction("S0"), undefined)
assert.equal(previewStateFromAction("S123"), undefined)
assert.deepEqual(availableSkinStates(IniDocument.parse("[KEY1]\nSTAT_STYLE=S122_1")), knownSkinStates)
console.log("✓ S1-S122 全量解析、标签和发现契约")

const generated = IniDocument.parse([
  "[KEY1]",
  "VIEW_RECT=0,0,100,100",
  "FORE_STYLE=default",
  `STAT_STYLE=${knownSkinStates.map((state) => `S${state}_${state}`).join("|")}`,
  "CENTER=F39",
  ...knownSkinStates.flatMap((state) => [
    "",
    `[TIP${state}]`,
    `FORE_STYLE=state-${state}`,
    "CENTER=F39",
  ]),
].join("\n"))
const generatedKey = previewItems(generated, 100, 100)[0]
for (const state of knownSkinStates) {
  assert.equal(stateTipSection(generatedKey.statStyle, state), state)
  assert.deepEqual(effectivePreviewItem(generated, generatedKey, state).foreStyles, [`state-${state}`])
  assert.deepEqual(previewStateImpact(generated, state), { mapped: true, resolved: true })
}
console.log("✓ S1-S122 每个状态仅命中自己的 STAT_STYLE/TIP")

const returnKey = IniDocument.parse(`
[KEY5]
VIEW_RECT=0,0,240,100
BACK_STYLE=100
FORE_STYLE=return
CENTER=F39
STAT_STYLE=S11_4|S17_1|S23_2|S27_3|S21_5

[TIP1]
FORE_STYLE=next
[TIP2]
FORE_STYLE=go
[TIP3]
FORE_STYLE=send
[TIP4]
FORE_STYLE=enter
[TIP5]
FORE_STYLE=search
`)
const returnItem = previewItems(returnKey, 240, 100)[0]
for (const [state, style] of [[11, "enter"], [17, "next"], [21, "search"], [23, "go"], [27, "send"]] as const) {
  assert.deepEqual(effectivePreviewItem(returnKey, returnItem, state).foreStyles, [style])
  assert.deepEqual(previewStateImpact(returnKey, state), { mapped: true, resolved: true })
}
console.log("✓ APK 回车状态组 S11/S17/S21/S23/S27 完整换层")

const missingReturnTips = IniDocument.parse(`
[KEY5]
VIEW_RECT=0,0,240,100
FORE_STYLE=return
CENTER=F39
STAT_STYLE=S11_4|S17_1|S23_2|S27_3|S21_5
`)
const missingReturnItem = previewItems(missingReturnTips, 240, 100)[0]
for (const state of [11, 17, 21, 23, 27]) {
  const item = effectivePreviewItem(missingReturnTips, missingReturnItem, state)
  assert.equal(item.show, skinStateFallbackText(state))
  assert.deepEqual(item.foreStyles, [])
  assert.deepEqual(previewStateImpact(missingReturnTips, state), { mapped: true, resolved: true })
}
console.log("✓ 缺失 TIP 的旧皮肤回车状态使用语义文字兜底")

assert.equal(skinStateForcesComposition(4), true)
assert.equal(candidatePreview("", 0, "zh").composing, false)
assert.deepEqual(candidatePreview("", 0, "zh", 4), {
  composing: true,
  input: "ni",
  candidates: ["你好", "不会", "不回", "不好", "你会"],
})
assert.equal(candidatePreview("hello", 5, "en", 4).input, "hello", "真实输入优先于 S4 示例")
console.log("✓ S4 强制展示输入编码与候选，但不覆盖真实模拟输入")
