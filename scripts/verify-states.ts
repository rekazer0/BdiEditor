import assert from "node:assert/strict"
import {
  MAX_SKIN_STATE,
  MIN_SKIN_STATE,
  knownSkinStates,
  previewStateFromAction,
  skinStateFallbackText,
  skinStateLabel,
} from "../src/actions.ts"
import { IniDocument } from "../src/ini.ts"
import { availableSkinStates, effectivePanelSection, stateTipSection } from "../src/panel-tools.ts"
import { effectivePreviewItem, previewItems, previewStateImpact } from "../src/preview.ts"
import {
  candidatePreview,
  compositionSkinState,
  deleteForward,
  moveCaret,
  moveCaretVertical,
} from "../src/simulation.ts"

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

const inspectorTarget = IniDocument.parse(`
[KEY17]
STAT_STYLE=S38_17
FORE_STYLE=104

[TIP17]
FORE_STYLE=130
`)
assert.equal(effectivePanelSection(inspectorTarget, "KEY17", 38), "TIP17")
assert.equal(effectivePanelSection(inspectorTarget, "KEY17", 37), "KEY17")
assert.equal(effectivePanelSection(IniDocument.parse("[KEY17]\nSTAT_STYLE=S38_17"), "KEY17", 38), "KEY17")
console.log("✓ 状态编辑目标解析到已存在的 TIP，未命中或缺失 TIP 时保留原 KEY")

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

assert.deepEqual(candidatePreview("hello", 5, "en"), {
  composing: true,
  input: "",
  candidates: ["hello", "Hello", "world", "thanks", "good"],
}, "英文状态不显示拼音，但展示硬编码英文候选")
assert.deepEqual(candidatePreview("ni", 2, "zh"), {
  composing: true,
  input: "ni",
  candidates: ["你好", "不会", "不回", "不好", "你会"],
}, "中文输入码展示硬编码中文候选")
assert.deepEqual(candidatePreview("", 0, "zh", 4), {
  composing: true,
  input: "ni",
  candidates: ["你好", "不会", "不回", "不好", "你会"],
}, "S4 使用固定中文输入示例")
assert.equal(compositionSkinState("ni"), 4, "中文输入码应进入 S4")
assert.equal(compositionSkinState("", 4), undefined, "清空输入码应退出 S4")
assert.equal(compositionSkinState("", 38), 38, "清空输入码不应清除其他手动状态")
console.log("✓ 中文和英文候选使用固定预览数据，英文候选不显示拼音")

assert.deepEqual(deleteForward("A😀B", 1, 1), { value: "AB", caret: 1 })
assert.deepEqual(deleteForward("abc", 0, 2), { value: "c", caret: 0 })
assert.deepEqual(moveCaret("A😀B", 3, 3, -1), { start: 1, end: 1 })
assert.deepEqual(moveCaret("A😀B", 1, 1, 1), { start: 3, end: 3 })
assert.deepEqual(moveCaret("abcd", 1, 3, -1), { start: 1, end: 1 })
assert.deepEqual(moveCaret("abcd", 1, 3, 1), { start: 3, end: 3 })
assert.deepEqual(moveCaretVertical("ab\nc😀d\nxy", 6, 6, -1), { start: 2, end: 2 })
assert.deepEqual(moveCaretVertical("ab\nc😀d\nxy", 1, 1, 1), { start: 4, end: 4 })
assert.deepEqual(moveCaretVertical("abcd\nx", 3, 3, 1), { start: 6, end: 6 })
console.log("✓ APK 编辑功能码所需的删除、清输入码和光标移动遵循 Unicode/选区边界")
