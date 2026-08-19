import assert from "node:assert/strict"
import type { VisualResolver } from "../src/atlas.ts"
import { resolveCandidateInputStyle } from "../src/candidate-style.ts"
import { IniDocument } from "../src/ini.ts"
import { candidatePreview } from "../src/simulation.ts"

function resolver(fontSize?: number, sourceHeight?: number): VisualResolver {
  return {
    async resolve() { return undefined },
    resolveText() { return fontSize ? { fontSize } : undefined },
    sourceSize() { return sourceHeight ? { width: 1080, height: sourceHeight } : undefined },
    async resolveToolbarImages() { return [] },
  }
}

const ios = IniDocument.parse(`
[INPUT]
BACK_STYLE=240
FORE_STYLE=241
`)
assert.deepEqual(resolveCandidateInputStyle(ios, resolver(60), 119), {
  backgroundStyle: "240",
  foregroundStyle: "241",
  height: 65,
})

const scandOverride = IniDocument.parse(`
[INPUT]
BACK_STYLE=240
FORE_STYLE=241
[SCAND]
BACK_STYLE=250,251
INPUT_STYLE=252,253
`)
assert.deepEqual(resolveCandidateInputStyle(scandOverride, resolver(54, 80), 119), {
  backgroundStyle: "250",
  foregroundStyle: "252,253",
  height: 59,
})

assert.equal(resolveCandidateInputStyle(ios, resolver(undefined, 72), 119).height, 72)
assert.equal(resolveCandidateInputStyle(ios, resolver(), 119).height, 119)

assert.deepEqual(candidatePreview("ni", 2, "zh"), {
  composing: true,
  input: "ni",
  candidates: ["你好", "不会", "不回", "不好", "你会"],
})
assert.deepEqual(candidatePreview("中文", 2, "zh"), {
  composing: true,
  input: "中文",
  candidates: ["你好", "不会", "不回", "不好", "你会"],
})

console.log("✓ 拼音输入栏按官方优先级解析皮肤样式和高度")
