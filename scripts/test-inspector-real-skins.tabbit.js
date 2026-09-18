// npm run build; npm exec vite -- preview --host 127.0.0.1 --port 4189
// ~/.local/bin/tabbit-cli nodejs --task inspector-real-skins --request-id regression < scripts/test-inspector-real-skins.tabbit.js
const fs = await import('node:fs/promises');
await page.goto('http://127.0.0.1:4189/', { waitUntil: 'networkidle' });
await page.setViewportSize({ width: 1440, height: 1000 });
await page.locator('#browser-open').setInputFiles({
  name: '好可爱蛙_智能深色-18键.bds', mimeType: 'application/octet-stream',
  buffer: await fs.readFile('/Users/kaze/work/bd/好可爱蛙_智能深色-18键.bds'),
});
await expect(page.locator('[data-document-key=NO_BLUR]')).toHaveCount(1, { timeout: 30000 });
const close = page.locator('#file-operation-dialog[open]').getByRole('button', { name: '关闭', exact: true });
if (await close.isVisible()) await close.click();
await page.getByRole('button', { name: '编辑模式', exact: true }).click();
const root = page.locator('#quick-inspector');
const toggle = page.locator('[data-document-key=NO_BLUR] input');
await expect(toggle).toBeEnabled();
const original = await toggle.isChecked();
await toggle.setChecked(!original);
await page.locator('[data-document-key=NO_BLUR]').hover();
await page.locator('[data-document-key=NO_BLUR] .pin-reset').click({timeout:5000});
await expect(toggle).toBeChecked({checked:original});
await expect(root.locator('.document-field-code')).toHaveCount(0);
const rootBox = await root.boundingBox();
const railBox = await page.locator('#mobile-inspector-groups').boundingBox();
expect(Math.abs(rootBox.x + rootBox.width - railBox.x - railBox.width)).toBeLessThan(2);
expect(railBox.width).toBeLessThan(85);
await page.locator('#preview').click({ position: { x: 220, y: 120 } });
await expect(page.locator('.key-layout-fields')).toBeVisible();
await expect(page.locator('.document-fields')).not.toBeVisible();
const x = page.locator('[data-key-field=x]');
const originalX = await x.inputValue();
await x.fill(String(Number(originalX) + 1));
await x.press('Tab');
await expect(x).toHaveValue(String(Number(originalX) + 1));
await x.fill(originalX);
await x.press('Tab');
await page.locator('#mobile-inspector-groups').getByRole('button', { name: '样式', exact: true }).click();
await expect(page.locator('.key-appearance-fields')).toBeVisible();
await page.setViewportSize({ width: 390, height: 844 });
await page.locator('[data-mobile-pane=inspector]').first().click();
expect(await root.evaluate(n => n.scrollWidth <= n.clientWidth)).toBe(true);
await page.setViewportSize({ width: 1440, height: 1000 });
return { passed: true, checks: ['BDS actual fields', 'checkbox reset', 'Chinese captions', 'right category sidebar', 'panel/key separation', 'geometry edit', 'style category', '390px overflow'] };
