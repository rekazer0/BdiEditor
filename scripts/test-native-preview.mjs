// Palm `.sxi` and Sogou `.ssf` documents are drawn from their own files (skin.json, phoneSkin.ini),
// not from Baidu styles: a Palm canvas lists skin.json's keys, a Sogou canvas the official skeleton's
// with no converted look. Scenes must name exactly the keys the canvas lists, follow the keyboard
// state, and draw what the skin's own data says.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { createServer } from 'vite'
import { COLORS, ssfFixture } from '../tests/helpers/ssf-fixture.mjs'

const server = await createServer({ root: new URL('..', import.meta.url).pathname, logLevel: 'error', server: { port: 41833, strictPort: false, host: '127.0.0.1', hmr: false } })
await server.listen()
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, bypassCSP: true })
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
page.on('dialog', (dialog) => dialog.accept())

const open = async (name, bytes) => {
  await page.locator('#browser-open').setInputFiles({ name, mimeType: 'application/octet-stream', buffer: Buffer.from(bytes) })
  await page.waitForFunction(() => !document.querySelector('#open').disabled)
  const close = page.locator('#file-operation-dialog[open] #file-operation-close')
  if (await close.isVisible().catch(() => false)) await close.click()
}
const selectLayout = (path) => page.evaluate(async (path) => {
  const { selectFile } = await import('/src/app/navigation.ts')
  selectFile(path)
}, path)
/** The panel scene for the current state: its texts, whether its sections match the canvas, and a pixel. */
const scene = (state, point) => page.evaluate(async ({ state, point }) => {
  const { preview } = await import('/src/app/canvas-interaction.ts')
  const { applySkinState } = await import('/src/app/canvas-interaction.ts')
  applySkinState(state)
  const built = await preview.sceneForState()
  await preview.whenDrawn()
  const sections = new Set(preview.keys.map((key) => key.section))
  const texts = Object.fromEntries(built.keys.map((key) => [key.section, key.layers(false).fore.flatMap((layer) => layer.kind === 'text' ? [{ text: layer.text.text, weight: layer.text.weight, color: layer.text.color }] : [])]))
  const pixel = point && [...preview.canvas.getContext('2d').getImageData(
    Math.round(point[0] * preview.canvas.width / preview.panelWidth),
    Math.round(point[1] * preview.canvas.height / preview.surfaceHeight), 1, 1).data]
  return { unknown: built.keys.map((key) => key.section).filter((section) => !sections.has(section)), texts, pixel, background: built.background.length }
}, { state, point })

try {
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/`)

  // Palm: the harmony template's keyboard image is transparent, so the Palm backdrop shows through.
  await open('palm-harmony.sxi', readFileSync(new URL('../public/templates/palm-harmony.sxi', import.meta.url)))
  await selectLayout('light/skin/port/py_9.ini')
  const palm = await scene(undefined, [3, 300])
  assert.deepEqual(palm.unknown, [], 'every Palm scene key is a canvas key section')
  // The canvas lists skin.json's own keys and reads no projected layout.
  const listed = await page.evaluate(async () => {
    const { preview } = await import('/src/app/canvas-interaction.ts')
    const { appState } = await import('/src/app/state.ts')
    const board = JSON.parse(appState.archive.getText('skin.json')).default.port_layout.b.t9Pinyin
    return {
      document: preview.stateDocument === undefined,
      keys: preview.keys.filter((key) => /^KEY/.test(key.section)).map((key) => key.section).sort(),
      skin: board.keys.filter((key) => key.rect).map((key) => `KEY${key.id}`).sort(),
    }
  })
  assert.ok(listed.document, 'the Palm canvas has no layout document')
  assert.deepEqual(listed.keys, listed.skin)
  assert.deepEqual(palm.pixel.slice(0, 3), [208, 211, 217], 'transparent board shows the Palm backdrop')
  assert.deepEqual(palm.texts.KEY2.map(({ text }) => text), ['ABC', '2'])
  // `f_w` is Palm-only: the Baidu projection drops it, the scene keeps the skin's light weight.
  assert.equal(palm.texts.KEY2[0].weight, 300)
  assert.deepEqual(palm.texts.KEY12.map(({ text }) => text), ['清空'])
  // 9-key pinyin swaps 123 for 分 while composing (fix_a S4 → key_fix 10).
  const composing = await scene(4)
  assert.deepEqual(composing.texts.KEY14.map(({ text }) => text), ['分'])
  const toolbar = await page.evaluate(async () => {
    const { candidateBackgroundPreview } = await import('/src/app/canvas-interaction.ts')
    return (await candidateBackgroundPreview.sceneForState()).background.length
  })
  assert.ok(toolbar > 0, 'the candidate bar draws its own backdrop')

  // Sogou: nine-key labels are upper case on pinyin boards (S_FLAG); keys.ini glyphs replace them.
  await open('fixture.ssf', ssfFixture())
  await selectLayout('light/skin/port/py_9.ini')
  const sogou = await scene(undefined)
  assert.deepEqual(sogou.unknown, [], 'every Sogou scene key is a canvas key section')
  assert.ok(sogou.background > 0, 'the Sogou keyboard background is drawn')
  // The skeleton laid over the skin carries no converted copy of its look.
  const converted = await page.evaluate(async () => {
    const { appState } = await import('/src/app/state.ts')
    return appState.archive.names().filter((name) => /\/res\/ssf\d+\.png$/.test(name))
  })
  assert.deepEqual(converted, [])
  // KEY2 carries the fixture's keys.ini glyph, so it draws no built-in label.
  assert.deepEqual(sogou.texts.KEY2, [])
  assert.deepEqual(sogou.texts.KEY3.map(({ text }) => text), ['DEF'])
  assert.deepEqual(sogou.texts.KEY16.map(({ text }) => text), ['中', '/英'])
  assert.deepEqual(sogou.texts['LIST:1'].map(({ text }) => text), ['，'])
  const keyboard = await scene(undefined, [3, 3])
  assert.ok(keyboard.pixel[3] > 0, 'the keyboard background covers the panel')
  assert.notDeepEqual(keyboard.pixel.slice(0, 3), COLORS.light.letterKey)
  assert.deepEqual(errors, [])
  console.log('native preview: Palm and Sogou scenes match the canvas keys and the skins’ own data')
} finally {
  await browser.close()
  await server.close()
}
