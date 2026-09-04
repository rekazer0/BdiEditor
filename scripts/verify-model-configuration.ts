import assert from "node:assert/strict"
import fs from "node:fs"

const html = fs.readFileSync("index.html", "utf8")
const main = fs.readFileSync("src/main.ts", "utf8")
const native = fs.readFileSync("src-tauri/src/lib.rs", "utf8")
const providers = fs.readFileSync("src/model-providers.ts", "utf8")

const providerIDs = [
  "anthropic",
  "anthropic-compatible",
  "openai",
  "openai-responses",
  "chatgpt-codex",
  "xai-subscription",
  "deepseek",
  "google",
  "kimi-api",
  "kimi-coding-plan",
  "opencode-go",
  "zhipu-ai",
  "zhipu-coding-plan",
  "zhipu-coding-plan-team",
  "volcengine-agent-plan",
  "volcengine-coding-plan",
  "volcengine-api",
  "minimax",
  "qwen",
]

for (const id of providerIDs) {
  assert.match(providers, new RegExp(`id:\\s*["']${id}["']`), `缺少模型服务格式：${id}`)
}

for (const id of [
  "model-provider",
  "model-api-url",
  "model-name",
  "model-list",
  "model-api-key",
  "refresh-model-list",
  "test-model-connection",
  "save-model-configuration",
  "model-configuration-status",
]) {
  assert.match(html, new RegExp(`id=["']${id}["']`), `大模型设置缺少控件：${id}`)
}

assert.doesNotMatch(main, /localStorage\.setItem\(["']model-api-key["']/, "API 密钥不得写入 localStorage")
for (const command of [
  "load_model_configuration",
  "save_model_configuration",
  "fetch_model_list",
  "test_model_connection",
]) {
  assert.match(native, new RegExp(`(?:fn|async fn)\\s+${command}\\b`), `原生端缺少命令：${command}`)
  assert.match(native, new RegExp(`generate_handler![\\s\\S]*\\b${command}\\b`), `原生命令未注册：${command}`)
}
assert.match(native, /model-config\.json/, "模型配置必须写入独立 JSON 文件")
assert.match(native, /set_permissions/, "Unix 平台必须收紧配置文件权限")

console.log(`✓ ${providerIDs.length} 种模型服务格式、配置落盘与连接测试契约完整`)
