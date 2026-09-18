// Run: ~/.local/bin/tabbit-cli nodejs --task crosshair-inspector < scripts/test-crosshair-inspector.tabbit.js
page.on('dialog', dialog => dialog.accept());
await page.goto('http://127.0.0.1:1420', { waitUntil: 'networkidle' });
await page.setViewportSize({ width: 1280, height: 900 });
await page.locator('.template-card[data-template="official-android-bds"]').click();
await page.getByRole('button', { name: '编辑模式', exact: true }).click();
await page.locator('#preview').click({ position: { x: 220, y: 120 } });
const wrap = await page.locator('.canvas-wrap').boundingBox();
const x = wrap.x + 30, y = wrap.y + 60;
const checkPointer = async (x, y) => {
  await page.waitForFunction(({ x, y }) => {
    const overlay = document.querySelector('#preview-coordinates');
    const rect = document.querySelector('.canvas-wrap').getBoundingClientRect();
    return !overlay.hidden && Math.abs(parseFloat(overlay.style.getPropertyValue('--crosshair-x')) - (x - rect.left)) < 1 && Math.abs(parseFloat(overlay.style.getPropertyValue('--crosshair-y')) - (y - rect.top)) < 1;
  }, { x, y });
};
await page.mouse.move(x, y);
await checkPointer(x, y);
await page.mouse.down();
await page.mouse.move(x + 90, y + 70, { steps: 12 });
await checkPointer(x + 90, y + 70);
await page.mouse.up();
await page.mouse.move(x + 120, y + 90);
await checkPointer(x + 120, y + 90);
const tabs = page.locator('#mobile-inspector-groups');
for (const name of ['样式', '文字', '动作', '布局']) {
  await tabs.getByRole('button', { name, exact: true }).click();
  await expect(tabs.getByRole('button', { name, exact: true })).toHaveClass(/active/);
}
await expect(page.locator('.geometry-fields .pin-chevron')).toHaveCount(0);
await expect(page.locator('.geometry-fields .pin-hint')).toHaveCount(0);
for (const width of [1280, 390]) {
  await page.setViewportSize({ width, height: 900 });
  if (width === 390) await page.locator('[data-mobile-pane="inspector"]').first().click();
  await expect(page.locator('[data-key-field="x"]')).toBeVisible();
  assert(await page.locator('#quick-inspector').evaluate(n => n.scrollWidth <= n.clientWidth), 'inspector must not overflow');
  const buttons = await tabs.locator('button:visible').evaluateAll(nodes => nodes.map(n => n.getBoundingClientRect().top));
  assert(buttons.every(top => Math.abs(top - buttons[0]) < 1), 'categories share one row');
}
return { passed: true, checks: ['blank canvas tracking', 'captured pan tracking', 'tracking after release', 'category switching', 'compact headings', 'desktop and mobile overflow'] };
