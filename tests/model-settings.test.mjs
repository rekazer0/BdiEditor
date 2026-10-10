import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

function load(name, globals = {}) {
  const context = vm.createContext({ exports: {}, URL, ...globals })
  const text = readFileSync(new URL(`../src/${name}.ts`, import.meta.url), 'utf8')
  vm.runInContext(ts.transpile(text, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }), context)
  return context.exports
}
const providers = load('model-providers')
const { validateModelConfigurations } = load('model-settings', { require: (id) => id.includes('model-providers') ? providers : {} })
const model = (patch = {}) => ({ provider: 'openai', protocol: 'openai-chat', apiUrl: 'https://api.openai.com/v1', model: 'gpt-5', apiKey: 'sk', ...patch })

test('model list validation points at the first incomplete or duplicate entry', () => {
  assert.equal(validateModelConfigurations([model(), model({ model: 'gpt-5-mini' })]), undefined)
  assert.equal(validateModelConfigurations([]), undefined)
  assert.deepEqual({ ...validateModelConfigurations([model(), model({ apiKey: '' })]) }, { index: 1, message: '请填写 API 密钥' })
  assert.equal(validateModelConfigurations([model({ apiUrl: 'ftp://x' })]).index, 0)
  assert.equal(validateModelConfigurations([model(), model()]).message, '已存在相同服务商、地址和名称的模型')
})
