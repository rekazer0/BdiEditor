import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { createServer } from 'vite'

const root = new URL('..', import.meta.url).pathname
const server = await createServer({ root, logLevel: 'error', server: { host: '127.0.0.1', port: 41921, strictPort: false } })
await server.listen()
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 }, bypassCSP: true })
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
const sample = process.env.BDI_SKIN_PATH ?? `${root}/public/templates/xiaomi-unified-rounded-blur.bds`
try {
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/`)
  await page.locator('#browser-open').setInputFiles({ name: sample.split('/').pop(), mimeType: 'application/octet-stream', buffer: readFileSync(sample) })
  await page.waitForFunction(() => !document.querySelector('#open').disabled)
  const close = page.locator('#file-operation-dialog[open] #file-operation-close')
  if (await close.isVisible()) await close.click()
  const compose = (value) => page.evaluate(async (value) => {
    const { setSimulatedComposition } = await import('/src/app/canvas-interaction.ts')
    const { refreshPreview } = await import('/src/app/preview-render.ts')
    setSimulatedComposition(value)
    refreshPreview()
  }, value)
  const measure = () => page.evaluate(() => {
    const rect = (id) => {
      const r = document.getElementById(id).getBoundingClientRect()
      return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom, right: r.right }
    }
    const canvas = document.getElementById('candidate-input-background')
    return { input: rect('candidate-input'), box: rect('candidate-input-box'), text: rect('candidate-input-text'), area: rect('candidate-area'), words: rect('candidate-words'), background: [...canvas.getContext('2d').getImageData(1, 1, 1, 1).data], hidden: document.getElementById('candidate-input').hidden }
  })
  const settle = () => page.waitForFunction(async () => {
    const { appState } = await import('/src/app/state.ts')
    return Boolean(appState.candidateInputBar?.visual) && document.getElementById('candidate-input-background').getContext('2d').getImageData(1, 1, 1, 1).data[3] > 0
  })
  await page.locator('#device').selectOption('pixel-10-pro')
  await compose('ni')
  await settle()
  const short = await measure()
  assert.ok(short.box.width < short.area.width / 2, 'Android popup wraps short input')
  assert.ok(Math.abs(short.input.bottom - short.area.y) < 2, 'Android popup sits above candidates')
  await compose("ni'hao")
  await page.waitForFunction((width) => document.getElementById('candidate-input-box').getBoundingClientRect().width > width, short.box.width)
  const longer = await measure()
  assert.ok(longer.box.width > short.box.width, 'popup grows with the typed code')
  await compose('nihao'.repeat(80))
  await page.waitForFunction(() => Math.abs(document.getElementById('candidate-input-box').clientWidth - document.getElementById('candidate-area').clientWidth) < 2)
  const long = await measure()
  assert.ok(long.text.width > long.box.width, 'long input keeps its natural text width')
  assert.ok(long.text.right <= long.box.right, 'long input keeps the newest characters in view')
  await compose("ni'hao")
  await page.locator('#device').selectOption('iphone-17-pro')
  await settle()
  const iphone = await measure()
  assert.ok(Math.abs(iphone.box.width - iphone.area.width) < 2, 'iPhone input background fills the row')
  assert.ok(iphone.input.y >= iphone.area.y && iphone.input.bottom <= iphone.words.y + 2, 'iPhone input occupies the row before candidates')
  await page.locator('[data-theme-choice="dark"]').click()
  await settle()
  await page.screenshot({ path: '/tmp/bdi-input-iphone.png' })
  await page.locator('#device').selectOption('pixel-10-pro')
  await settle()
  await page.screenshot({ path: '/tmp/bdi-input-android.png' })
  await compose('')
  assert.equal((await measure()).hidden, true, 'clearing input hides the bar')
  assert.deepEqual(errors, [])
  console.log('Input bar phone geometry and background checks passed')
} finally {
  await browser.close()
  await server.close()
}
