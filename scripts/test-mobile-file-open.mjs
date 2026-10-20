// OS picker filtering still needs a device; verify the options and browser import flow here.
import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { createServer } from 'vite'
import { ssfFixture } from '../tests/helpers/ssf-fixture.mjs'

const server = await createServer({ root: new URL('..', import.meta.url).pathname, logLevel: 'error', server: { host: '127.0.0.1', port: 41932, strictPort: false } })
await server.listen()
let browser
try {
  browser = await chromium.launch()
  for (const platform of ['Android', 'iPhone', 'desktop']) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 }, bypassCSP: true,
      userAgent: platform === 'desktop' ? undefined : `Mozilla/5.0 (${platform}) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36`,
    })
    try {
      const page = await context.newPage()
      const errors = []
      page.on('pageerror', (error) => errors.push(error.message))
      await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/`)
      await page.waitForSelector('.template-card')
      const input = page.locator('#browser-open')
      assert.equal(await input.getAttribute('accept'), platform === 'desktop' ? '.bdi,.bds,.bda,.ssf,.mssf,.sxi' : null)
      if (platform === 'Android') {
        const picker = page.waitForEvent('filechooser')
        await page.locator('#welcome-recent-open').click()
        await (await picker).setFiles({ name: '安卓搜狗.ssf', mimeType: 'application/octet-stream', buffer: Buffer.from(ssfFixture()) })
        await page.waitForFunction(() => document.querySelector('#document-name').textContent === '安卓搜狗.ssf' && !document.querySelector('#open').disabled)
        assert.ok(await page.locator('#preview').evaluate((canvas) => canvas.getBoundingClientRect().height > 20))
        await input.setInputFiles({ name: '无效.txt', mimeType: 'text/plain', buffer: Buffer.from('invalid') })
        await page.waitForFunction(() => document.querySelector('#event-log').dataset.kind === 'error')
        assert.match(await page.locator('#event-log').textContent(), /仅支持/)
        assert.equal(await page.locator('#document-name').textContent(), '安卓搜狗.ssf')
      }
      assert.deepEqual(errors, [])
      console.log(`PASS: ${platform} file picker${platform === 'Android' ? ', SSF import and invalid-file rejection' : ''}`)
    } finally {
      await context.close()
    }
  }
} finally {
  await browser?.close()
  await server.close()
}
