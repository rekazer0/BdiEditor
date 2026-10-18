import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { createServer } from 'vite'
import { SkinArchive } from '../src/skin.ts'
import { IniDocument } from '../src/ini.ts'

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
  await page.evaluate(async () => { globalThis.inputBarTestState = (await import('/src/app/state.ts')).appState })
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
  const settle = () => page.waitForFunction(() => {
    return Boolean(globalThis.inputBarTestState.candidateInputBar?.visual) && document.getElementById('candidate-input-background').getContext('2d').getImageData(1, 1, 1, 1).data[3] > 0
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

  // Make INPUT and SCAND visibly different so a wrong platform branch cannot pass on geometry alone.
  const fixture = SkinArchive.open(new Uint8Array(readFileSync(`${root}/public/templates/xiaomi-unified-rounded-blur.bds`)))
  for (const path of fixture.names().filter((path) => path.endsWith('/gen.ini') || path.endsWith('/default.css'))) {
    const document = IniDocument.parse(fixture.getText(path))
    if (path.endsWith('/gen.ini')) {
      document.set('INPUT', 'BACK_STYLE', '9001')
      document.set('INPUT', 'FORE_STYLE', '9003')
      document.set('SCAND', 'BACK_STYLE', '9002')
      document.set('SCAND', 'INPUT_STYLE', '9004')
    } else {
      for (const [id, color, size] of [[9001, 'FF123456'], [9002, 'FF456789'], [9003, 'FF111111', 45], [9004, 'FF92B5BF', 90]]) {
        document.appendSection(`STYLE${id}`, [{ key: 'NM_COLOR', value: color }, ...(size ? [{ key: 'FONT_SIZE', value: String(size) }] : [])])
      }
    }
    fixture.setText(path, document.toString())
  }
  await page.locator('#browser-open').setInputFiles({ name: 'input-scand.bds', mimeType: 'application/octet-stream', buffer: Buffer.from(fixture.toBytes('bds')) })
  await page.waitForFunction(() => document.querySelector('#document-name').textContent === 'input-scand.bds' && !document.querySelector('#open').disabled)
  if (await close.isVisible()) await close.click()
  for (const [device, color, size] of [['pixel-10-pro', [18, 52, 86, 255], 90], ['iphone-17-pro', [69, 103, 137, 255], 45]]) {
    await page.locator('#device').selectOption(device)
    await compose("ni'hao")
    await page.waitForFunction((expected) => {
      const canvas = document.getElementById('candidate-input-background')
      return globalThis.inputBarTestState.candidateInputBar?.visual && [...canvas.getContext('2d').getImageData(1, 1, 1, 1).data].every((value, i) => value === expected[i])
    }, color)
    const rendered = await page.evaluate(async () => {
      const { appState } = await import('/src/app/state.ts')
      const area = document.getElementById('candidate-area')
      return parseFloat(getComputedStyle(document.getElementById('candidate-input')).fontSize) * appState.candidateTextWidth / area.clientWidth
    })
    assert.ok(Math.abs(rendered - size) < 0.2, `${device}: input font size is ${size}, got ${rendered}`)
    await compose('')
    const idle = await measure()
    assert.equal(idle.hidden, device !== 'iphone-17-pro', `${device}: only the iPhone keeps its empty input background`)
    assert.deepEqual(idle.background, color, 'clearing input preserves the configured background pixels')
    assert.equal(await page.locator('#candidate-input-background').isVisible(), device === 'iphone-17-pro')
    assert.equal(await page.locator('#candidate-words').isVisible(), false, 'idle state shows toolbar instead of candidate words')
    assert.equal(await page.locator('#candidate-input-text').textContent(), '', 'clearing input removes the code text')
  }
  assert.deepEqual(errors, [])
  console.log('Input bar phone geometry and background checks passed')
} finally {
  await browser.close()
  await server.close()
}
