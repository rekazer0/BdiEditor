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
const { validateModelProviders, groupModelConfigurations, flattenModelProviders } = load('model-settings', { require: (id) => id.includes('model-providers') ? providers : {} })
const model = (patch = {}) => ({ provider: 'openai', protocol: 'openai-chat', apiUrl: 'https://api.openai.com/v1', model: 'gpt-5', apiKey: 'sk', ...patch })
const group = (patch = {}) => ({ provider: 'openai', protocol: 'openai-chat', apiUrl: 'https://api.openai.com/v1', apiKey: 'sk', models: ['gpt-5'], ...patch })

test('saved models group by provider account and flatten back in order', () => {
  const saved = [model(), model({ provider: 'deepseek', apiUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' }), model({ model: 'gpt-5-mini' })]
  const groups = JSON.parse(JSON.stringify(groupModelConfigurations(saved)))
  assert.deepEqual(groups.map((g) => g.models), [['gpt-5', 'gpt-5-mini'], ['deepseek-chat']])
  assert.deepEqual(flattenModelProviders(groups).map((m) => m.model), ['gpt-5', 'gpt-5-mini', 'deepseek-chat'])
  assert.equal(groupModelConfigurations([model(), model({ apiKey: 'other' })]).length, 2)
})

test('provider validation points at the first incomplete or duplicate entry', () => {
  assert.equal(validateModelProviders([group(), group({ provider: 'deepseek' })]), undefined)
  assert.equal(validateModelProviders([]), undefined)
  assert.deepEqual({ ...validateModelProviders([group(), group({ apiKey: '' })]) }, { index: 1, message: '请填写 API 密钥' })
  assert.equal(validateModelProviders([group({ apiUrl: 'ftp://x' })]).index, 0)
  assert.equal(validateModelProviders([group({ models: [] })]).message, '请至少选择一个模型')
  assert.equal(validateModelProviders([group(), group({ apiKey: 'other' })]).index, 1)
})

test('image model validation requires address, key and model only when one is configured', () => {
  const { validateImageModel } = load('model-settings', { require: (id) => id.includes('model-providers') ? providers : {} })
  const image = { provider: 'volcengine-image', protocol: 'openai-chat', apiUrl: 'https://ark.cn-beijing.volces.com/api/v3', model: 'doubao-seedream-4-0-250828', apiKey: 'k', kind: 'image' }
  assert.equal(validateImageModel(undefined), undefined)
  assert.equal(validateImageModel(image), undefined)
  assert.match(validateImageModel({ ...image, apiKey: '' }), /密钥/)
  assert.match(validateImageModel({ ...image, apiUrl: 'ark' }), /http/)
  assert.equal(providers.imageModelPreset('minimax-image').model, 'image-01')
})
