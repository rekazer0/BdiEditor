// ~/.local/bin/tabbit-cli nodejs --task inspector-pen-spec < scripts/test-inspector-pen-spec.tabbit.js
await page.goto('http://127.0.0.1:1420/inspector-redesign.html?edit=1&v=pen-spec-10', { waitUntil: 'networkidle' })
await page.setViewportSize({ width: 1280, height: 900 })
await page.waitForFunction(() => window.__inspectorPreviewReady === true, null, { timeout: 15000 })
const chip = page.locator('.pin-mode-chip')
await expect(chip).toBeVisible()
await expect(chip).toHaveText('可编辑')
await expect(page.locator('#quick-inspector')).toHaveAttribute('data-inspector-kind', 'bds')
await expect(page.locator('.key-layout-fields > h3')).toHaveAttribute('title', 'keys.*.layout')
await expect(page.locator('#inspector-search')).toHaveCount(0)
const x = page.locator('[data-key-field=x]')
await expect(x).toBeVisible()
const metrics = await page.evaluate(() => {
  const input = document.querySelector('[data-key-field=x]')
  const row = input?.closest('label')
  const hint = document.querySelector('.geometry-fields .pin-hint')
  const inspector = document.querySelector('#quick-inspector')
  return {
    rowH: row ? Math.round(row.getBoundingClientRect().height) : 0,
    inputH: input ? Math.round(input.getBoundingClientRect().height) : 0,
    align: input ? getComputedStyle(input).textAlign : '',
    meta: document.querySelector('.pin-actions-meta')?.textContent ?? '',
    hint: hint?.textContent ?? '',
    hintSize: hint ? getComputedStyle(hint).fontSize : '',
    hintFamily: hint ? getComputedStyle(hint).fontFamily : '',
    overflow: inspector ? inspector.scrollWidth <= inspector.clientWidth : false,
  }
})
expect(metrics.rowH).toBeGreaterThanOrEqual(44)
expect(metrics.rowH).toBeLessThanOrEqual(56)
expect(metrics.inputH).toBe(30)
expect(metrics.align).toBe('right')
expect(metrics.meta).toMatch(/已改/)
expect(metrics.hint).toBe('keys.*.layout')
expect(metrics.hintSize).toBe('9.5px')
expect(metrics.hintFamily.toLowerCase()).toMatch(/jetbrains|mono/)
expect(metrics.overflow).toBe(true)
await expect(page.locator('.pin-actions')).toBeVisible()
const icons = await page.locator('#mobile-inspector-groups svg').evaluateAll(nodes => nodes.map(node => ({
  name: node.dataset.penIcon,
  width: node.getBoundingClientRect().width,
  height: node.getBoundingClientRect().height,
  stroke: getComputedStyle(node).strokeWidth,
})))
expect(icons.map(icon => icon.name)).toEqual(['layout-grid', 'palette', 'type', 'zap'])
for (const icon of icons) {
  expect(icon.width).toBe(15)
  expect(icon.height).toBe(15)
  expect(icon.stroke).toBe('1.5px')
}
await expect(page.locator('#selected-key-preview [data-pen-icon=key-round]')).toBeVisible()
await expect(page.locator('.key-layout-fields .pin-chevron svg').first()).toBeVisible()
await page.locator('#mobile-inspector-groups').getByRole('button', { name: '动作', exact: true }).click()
const up = page.locator('[data-key-field=UP]')
await up.fill('F12')
await expect(page.locator('[data-gesture=UP]')).toHaveClass(/configured/)
await expect(up).toHaveValue('F12')
const dark = await page.evaluate(() => {
  document.documentElement.setAttribute('data-app-theme', 'dark')
  const panel = document.querySelector('#quick-inspector')
  const panelStyle = panel ? getComputedStyle(panel) : null
  const parse = (c) => (c.match(/\d+/g) || []).map(Number)
  const [pr, pg, pb] = parse(panelStyle?.backgroundColor ?? '')
  return {
    pinInk: panelStyle?.getPropertyValue('--pin-ink').trim() ?? '',
    panelBg: panelStyle?.backgroundColor ?? '',
    panelLuma: 0.2126 * pr + 0.7152 * pg + 0.0722 * pb,
  }
})
expect(dark.pinInk).toBe('#f2f4f8')
expect(dark.panelLuma).toBeLessThan(80)
await page.setViewportSize({ width: 390, height: 844 })
expect(await page.locator('#quick-inspector').evaluate(n => n.scrollWidth <= n.clientWidth)).toBe(true)
return { passed: true, checks: ['mode chip', 'kind=bds', 'section tooltip', '30px field', 'right-aligned number', '9.5px hint', 'action meta', 'visible Pen Lucide icons', 'live gesture preview', 'dark tokens', '390 overflow'], metrics, icons, dark }
