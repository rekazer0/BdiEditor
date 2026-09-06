// Run with the existing Vite server: npm run dev -- --host 127.0.0.1
import assert from 'node:assert/strict'
import path from 'node:path'
import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 960 })
  await page.goto(process.env.BDI_TEST_URL || 'http://127.0.0.1:1420', { waitUntil: 'networkidle0' })
  await (await page.$('#browser-open')).uploadFile(path.resolve('public/default-template.bds'))
  await page.waitForFunction(() => !document.querySelector('[data-inspector-tab="source"]').disabled)
  await page.select('#mode', 'edit')
  await page.click('.nav-layout')
  await page.click('[data-inspector-tab="properties"]')
  const canvas = await page.$('#preview')
  const bounds = await canvas.boundingBox()
  await page.mouse.click(bounds.x + bounds.width * .5, bounds.y + bounds.height * .5)
  await page.waitForFunction(() => !document.querySelector('#inspector-layout-back').hidden)
  await page.evaluate(() => [...document.querySelectorAll('#mobile-inspector-groups button')].find(b => b.textContent === '动作').click())
  for (const width of [1440, 390, 320]) {
    await page.setViewport({ width, height: 960 })
    if (width < 761) await page.evaluate(() => document.querySelector('[data-mobile-pane="inspector"]').click())
    for (const theme of ['light', 'dark']) {
      await page.select('#app-theme', theme)
      await page.click('[data-inspector-tab="properties"]')
      await new Promise(resolve => setTimeout(resolve, 400))
      const state = await page.evaluate(() => {
        const pane = document.querySelector('.source')
        const style = getComputedStyle(pane)
        const quick = document.querySelector('#quick-inspector')
        const field = quick.querySelector('[data-key-field="CENTER"]')
        return {
          text: style.color,
          themeText: getComputedStyle(document.documentElement).color,
          overflow: pane.scrollWidth - pane.clientWidth,
          groupOverflow: quick.scrollWidth - quick.clientWidth,
          fieldVisible: field.getBoundingClientRect().height > 0,
          rootScroll: window.scrollY,
        }
      })
      assert.ok(state.overflow <= 1 && state.groupOverflow <= 1, JSON.stringify({width, theme, ...state}))
      assert.ok(state.fieldVisible)
      assert.equal(state.text, state.themeText)
      assert.equal(state.rootScroll, 0)
      if (width === 1440 && theme === 'dark') await page.screenshot({ path: '/tmp/bdi-inspector-dark.png' })
      if (width === 390 && theme === 'light') await page.screenshot({ path: '/tmp/bdi-inspector-mobile.png' })
    }
  }
  await page.$eval('.key-gesture-fields', e => { e.scrollTop = e.scrollHeight })
  assert.ok(await page.$eval('[data-key-field="DOWN"]', e => {
    const field = e.getBoundingClientRect()
    const group = e.closest('.key-gesture-fields').getBoundingClientRect()
    return field.top >= group.top && field.bottom <= group.bottom
  }), '窄屏下应能滚动到下滑动作')
  await page.click('#inspector-layout-back')
  await page.waitForFunction(() => document.querySelector('#selected-key-preview').hidden)
  assert.equal(await page.$eval('#selected-key-preview', e => e.hidden), true)
  assert.equal(await page.$eval('.key-inspector-title > .key-toolbar', e => getComputedStyle(e).display), 'none')
  assert.ok(await page.$eval('#selected-key', e => e.textContent.includes('整体布局')))
  assert.equal(await page.$eval('#mobile-inspector-groups button.active', e => e.dataset.mobileInspectorGroup), '0')
  console.log('✓ 深浅主题、1440/390/320 宽度、动作分类及返回整体布局验证通过')
} finally {
  await browser.close()
}
