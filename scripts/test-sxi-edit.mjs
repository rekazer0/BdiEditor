import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { chromium } from 'playwright'
import { SkinArchive } from '../src/skin.ts'
import { buildSxiZip } from '../src/palm/palm-export.ts'
import { bdsFixture } from '../tests/helpers/baidu-fixture.mjs'

const bytes = buildSxiZip(SkinArchive.open(bdsFixture())).bytes
const server = await createServer({ logLevel: 'error', server: { host: '127.0.0.1', port: 41829, strictPort: false, hmr: false } })
await server.listen()
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
page.on('dialog', (dialog) => dialog.accept())
const state = () => page.evaluate(async () => {
  const { appState } = await import('/src/app/state.ts')
  const { source } = await import('/src/app/canvas-interaction.ts')
  const skin = JSON.parse(appState.archive.getText('skin.json'))
  return { skin, source: source.value, undo: appState.undoStack.length, refs: appState.layoutDocument.get('KEY1', 'FORE_STYLE') }
})
const selectKey = async (id) => {
  const point = await page.evaluate(async (id) => {
    const { preview } = await import('/src/app/canvas-interaction.ts')
    const key = preview.keys.find((item) => item.section === `KEY${id}`)
    const box = preview.canvas.getBoundingClientRect()
    return { x: box.x + (key.rect.x + key.rect.width / 2) * box.width / preview.panelWidth, y: box.y + (key.rect.y + key.rect.height / 2) * box.height / preview.panelHeight }
  }, id)
  await page.mouse.click(point.x, point.y)
  await page.waitForFunction(async (id) => {
    const { appState } = await import('/src/app/state.ts')
    return appState.selectedKeySections[0] === `KEY${id}` && !appState.selectionInspectorSyncPending
  }, id)
}
const undoRedo = async (action) => page.evaluate(async (action) => {
  const history = await import('/src/app/edit-history.ts')
  history[action]()
}, action)
try {
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}`)
  await page.locator('#browser-open').setInputFiles({ name: 'test.sxi', mimeType: 'application/octet-stream', buffer: Buffer.from(bytes) })
  await page.waitForFunction(() => !document.querySelector('#open').disabled)
  const close = page.locator('#file-operation-dialog[open] #file-operation-close')
  if (await close.isVisible()) await close.click()
  await page.getByRole('button', { name: '编辑模式', exact: true }).click()
  await page.evaluate(async () => {
    const { selectFile } = await import('/src/app/navigation.ts')
    selectFile('light/skin/port/py_26.ini')
  })
  await selectKey(1)
  const original = (await state()).skin
  await page.locator('[data-inspector-tab="source"]').click()
  await selectKey(2)
  await page.waitForFunction(() => [...document.querySelectorAll('.cm-source-selected')].some((line) => /"id"\s*:\s*"2"/.test(line.textContent)))
  assert.match((await state()).source, /"keys"/)
  await page.locator('[data-inspector-tab="properties"]').click()
  await selectKey(1)
  await page.locator('#mobile-inspector-groups').getByRole('button', { name: '样式', exact: true }).click()
  const add = page.locator('.style-reference-add')
  await add.click()
  await page.locator('#style-picker-dialog').waitFor({ state: 'visible' })
  await page.locator('#style-picker-grid > button').filter({ hasText: '样式 120' }).click()
  await page.locator('#style-library-apply').click()
  assert.equal((await state()).refs, '3,4,120', 'existing image style can be appended')
  await undoRedo('undo')
  assert.deepEqual((await state()).skin, original)
  await page.locator('#mobile-inspector-groups').getByRole('button', { name: '样式', exact: true }).click()
  await add.click()
  await page.locator('#style-picker-dialog').waitFor({ state: 'visible' })
  await page.locator('[data-style-library-mode="images"]').click()
  await page.locator('#style-picker-grid > button').first().click()
  await page.locator('#style-library-apply').click()
  await page.locator('#style-image-dialog').waitFor({ state: 'visible' })
  await page.waitForFunction(async () => {
    const { appState } = await import('/src/app/state.ts')
    return appState.pickerImage?.naturalWidth > 0
  })
  const sliceCanvas = page.locator('#style-image-picker-canvas')
  const sliceBox = await sliceCanvas.boundingBox()
  await sliceCanvas.click({ position: { x: sliceBox.width / 2, y: sliceBox.height / 2 } })
  const added = await state()
  const id = added.refs.split(',').at(-1)
  assert.equal(added.refs.split(',').length, 3)
  assert.equal(added.undo, 1, 'image creation and foreground append are one undo step')
  assert.deepEqual(added.skin.default.port_layout.b.full26Pinyin.keys.find((item) => item.id === '1').b.base_f, [3, 4, Number(id)])
  assert.ok(added.skin.default.s_info.ss_1[id].s_2.normal)
  assert.match(added.source, /"keys"/, 'inspector changes retain JSON in the source editor')
  await page.locator('#style-image-close').click()
  await undoRedo('undo')
  assert.deepEqual((await state()).skin, original)
  await undoRedo('redo')
  assert.deepEqual((await state()).skin, added.skin)
  await page.locator('#mobile-inspector-groups').getByRole('button', { name: '样式', exact: true }).click()
  const normal = page.locator('[data-key-field="FORE_STYLE"]').locator('..').locator('.style-reference-row').last().locator('[data-style-state="normal"]')
  await normal.click()
  await page.locator('#style-image-dialog').waitFor({ state: 'visible' })
  await page.evaluate(async () => {
    const { appState } = await import('/src/app/state.ts')
    const { updateSelectedImageReference } = await import('/src/app/image-pickers.ts')
    if (!updateSelectedImageReference(appState.pickerTarget, 'btn,1')) throw new Error('state image edit failed')
  })
  assert.equal((await state()).skin.default.s_info.ss_1[id].s_2.normal, 'btn,1')
  await page.locator('#style-image-close').click()
  const saved = await page.evaluate(async () => {
    const { appState } = await import('/src/app/state.ts')
    return Array.from(appState.archive.toBytes('sxi'))
  })
  const reopened = SkinArchive.open(new Uint8Array(saved), 'sxi')
  assert.deepEqual(JSON.parse(reopened.getText('skin.json')), (await state()).skin)
  assert.deepEqual(errors, [])
  console.log('SXI editing: canvas → JSON location, add foreground image, one-step undo/redo, image state update and save/reopen passed')
} catch (error) {
  await page.screenshot({ path: '/tmp/bdi-sxi-edit-failure.png' }).catch(() => {})
  throw error
} finally {
  await browser.close()
  await server.close()
}
