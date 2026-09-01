import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { retryAsync } from "../src/retry.ts"

let attempts = 0
const result = await retryAsync(async () => {
  attempts += 1
  if (attempts < 3) throw new Error("transient")
  return "ok"
}, { attempts: 4, delayMs: 0 })

assert.equal(result, "ok")
assert.equal(attempts, 3, "成功后应停止重试")

attempts = 0
await assert.rejects(
  retryAsync(async () => {
    attempts += 1
    throw new Error("permanent")
  }, { attempts: 3, delayMs: 0 }),
  /permanent/,
)
assert.equal(attempts, 3, "永久失败应执行指定总次数并传播最后一次错误")

const main = readFileSync("src/main.ts", "utf8")
const applyWindowMaterial = main.match(/async function applyWindowMaterial\(\)[\s\S]*?\n}\nfunction applyWindowMaterialWithRetry/)?.[0] ?? ""
assert.match(applyWindowMaterial, /await invoke\("set_window_material"/, "窗口材质调用应保持异步错误可传播")
assert.doesNotMatch(applyWindowMaterial, /catch/, "底层窗口材质调用不应吞掉错误")
assert.match(main, /retryAsync\(applyWindowMaterial, \{ attempts: 4, delayMs: 100 \}\)/, "窗口材质应使用受测的重试函数")

console.log("✓ 异步操作会重试瞬时失败，并传播最终错误")
