// npm run build; npm exec vite -- preview --host 127.0.0.1 --port 4189
// ~/.local/bin/tabbit-cli nodejs --task inspector-real-skins --request-id regression < scripts/test-inspector-real-skins.tabbit.js
const fs = await import('node:fs/promises');
await page.goto('http://127.0.0.1:4189/', { waitUntil: 'networkidle' });
await page.setViewportSize({ width: 1440, height: 1000 });
// 真实皮肤路径可用 REAL_BDS 覆盖。
const skin = process.env.REAL_BDS ?? '/Users/kaze/work/bd/孤岛记录_特别版智能深色-26+9键.bds';
await page.locator('#browser-open').setInputFiles({
  name: skin.split('/').pop(), mimeType: 'application/octet-stream',
  buffer: await fs.readFile(skin),
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
// 文档字段没有逐行重置，用标题栏「撤销」恢复。
await page.locator('#desktop-undo').click();
await expect(toggle).toBeChecked({checked:original});
// 原始键名只保留在提示里，不显示在界面上。
await expect(root.locator('.document-field-code:visible')).toHaveCount(0);
const rootBox = await root.boundingBox();
const railBox = await page.locator('#mobile-inspector-groups').boundingBox();
// 分类轨是贴右缘、留少量内边距的悬浮条。
const railInset = rootBox.x + rootBox.width - railBox.x - railBox.width;
expect(railInset).toBeGreaterThanOrEqual(0);
expect(railInset).toBeLessThanOrEqual(12);
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
return { passed: true, checks: ['BDS actual fields', 'checkbox undo', 'Chinese captions', 'right category sidebar', 'panel/key separation', 'geometry edit', 'style category', '390px overflow'] };
