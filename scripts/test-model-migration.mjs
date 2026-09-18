import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const source = ts.createSourceFile('main.ts', readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true)
const names = new Set(['initializeModelConfiguration', 'persistModelConfiguration'])
const code = ts.transpile(source.statements.filter(node => ts.isFunctionDeclaration(node) && names.has(node.name?.text)).map(node => node.getText(source)).join('\n'), { target: ts.ScriptTarget.ES2022 })

test('legacy credentials survive read/write failures and are removed only after a successful save', async () => {
  for (const failure of ['load', 'save', 'none']) {
    const legacy = new Map([['model-provider', 'openai'], ['model-api-url', 'https://example.invalid'], ['model-name', 'test-model'], ['model-api-key', 'FAKE-TEST-KEY']])
    const storage = new Map(legacy)
    let configuration
    let fail = failure
    let saved
    const context = vm.createContext({
      isTauri: () => true,
      modelProviderPreset: () => ({ id: 'openai', protocol: 'openai-completions', apiUrl: 'https://example.invalid', model: 'test-model' }),
      applyModelConfiguration: value => { configuration = value },
      currentModelConfiguration: () => configuration,
      savedModels: [], editingModelIndex: -1, modelConfigurationPath: {},
      syncModelProfiles: () => {}, setModelConfigurationStatus: () => {}, setModelConfigurationBusy: () => {},
      localStorage: { getItem: key => storage.get(key) ?? null, removeItem: key => storage.delete(key) },
      invoke: async (command, args) => {
        if (command.startsWith(fail + '_')) throw new Error('simulated failure')
        if (command === 'save_model_configuration') saved = args.configuration
        return { path: 'mock-config.json' }
      },
    })
    vm.runInContext(code, context)
    await context.initializeModelConfiguration()
    if (failure !== 'none') {
      assert.deepEqual(storage, legacy, failure)
      fail = 'none'
      // A failed write can be retried via the existing Save button.
      if (failure === 'save') await context.persistModelConfiguration()
      else await context.initializeModelConfiguration()
    }
    assert.equal(saved.apiKey, legacy.get('model-api-key'))
    assert.equal(storage.size, 0)
  }
})
