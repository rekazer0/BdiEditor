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
