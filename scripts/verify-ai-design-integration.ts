import assert from "node:assert/strict"
import fs from "node:fs"

const html = fs.readFileSync("index.html", "utf8")
const main = fs.readFileSync("src/main.ts", "utf8")
const design = fs.readFileSync("src/ai-design.ts", "utf8")

assert.match(html, /id="ai-design-form"/, "AI 设计面板应包含表单")
assert.match(html, /id="ai-design-cancel"[^>]*hidden/, "AI 运行时应提供取消入口")
assert.match(main, /import\("\.\/ai-design\.ts"\)/, "AI 代理依赖应延迟加载")
assert.match(main, /currentModelConfiguration\(\)/, "AI 设计应使用已配置模型")
assert.match(main, /aiEditableProjectFiles/, "AI 设计只能读取允许的皮肤文本配置")
assert.match(main, /validatedAiChanges/, "AI 草稿应用前必须重新校验")
assert.match(main, /commitBatch\(changes\)/, "AI 修改应作为可撤销批次提交")
const submitHandler = main.slice(
  main.indexOf('aiDesignForm.addEventListener("submit"'),
  main.indexOf("function setSourceDirectoryState"),
)
assert.equal(submitHandler.match(/commitBatch\(changes\)/g)?.length, 1, "一轮 AI 修改必须只提交一个历史批次")
assert.match(submitHandler, /archive !== target/, "提交前必须确认仍是原皮肤项目")
assert.match(main, /AbortController/, "AI 设计应支持取消")
assert.match(main, /editable\.text !== draft\.before/, "提交前必须检查文件没有并发变化")
assert.match(main, /function validatedAiChanges[\s\S]*applyDecodedBdaSource/, "BDA 草稿必须经过解码源码写回校验")
assert.match(design, /class AiSkinWorkspace|new AiSkinWorkspace/, "AI 代理应通过受限工作区修改项目")
assert.match(design, /MAX_TOOL_CALLS/, "AI 代理应限制工具调用次数")
assert.match(design, /getApiKey:\s*\(\)\s*=>\s*config\.apiKey/, "AI 请求应使用已加载密钥")
assert.match(design, /toolExecution:\s*"sequential"/, "AI 工具必须串行执行")
assert.match(design, /必须先调用 inspect_project/, "模型必须先检查项目权限")
assert.doesNotMatch(design, /from\s+"(?:node:)?(?:fs|child_process|process|os)"/, "AI 适配器不得访问文件系统或进程")

console.log("✓ AI 设计接入模型配置并限制在可撤销的皮肤草稿工作区")

assert.ok(submitHandler.indexOf("const project =") < submitHandler.indexOf('await import'),
  "AI 设计必须在异步加载前快照选择范围")
assert.doesNotMatch(html, /ai-design-style|ai-design-keep-layout/, "聊天不应保留风格和布局开关")
assert.match(main, /querySelectorAll<[^>]+>\("input, textarea, button, select"\)/,
  "运行期间也必须锁定风格选择")
assert.match(html, /<select id="model-list"/, "API 模型列表必须使用可操作的原生下拉框")
assert.match(main, /modelList\.addEventListener\("change"[\s\S]*modelName\.value = modelList\.value/,
  "下拉选择必须写回模型名称")
assert.match(main, /modelName\.hidden = models\.length > 0[\s\S]*modelList\.hidden = models\.length === 0/,
  "模型输入框和下拉框不能同时显示")
assert.match(design, /conversationContext\(options\.history \?\? \[\]\)/,
  "同一皮肤的后续请求必须携带最近对话上下文")
assert.match(design, /globalThis\.fetch = nativeModelFetch[\s\S]*globalThis\.fetch = webviewFetch/,
  "AI 对话必须通过原生网络请求并在结束后恢复 WebView fetch")
assert.match(fs.readFileSync("src-tauri/src/lib.rs", "utf8"), /async fn model_http_request[\s\S]*generate_handler![\s\S]*model_http_request/,
  "原生端必须注册模型对话网络命令")
