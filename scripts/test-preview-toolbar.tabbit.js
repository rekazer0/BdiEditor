// Run: ~/.local/bin/tabbit-cli nodejs --task toolbar-check < scripts/test-preview-toolbar.tabbit.js
page.on('dialog', dialog => dialog.accept());
await page.setViewportSize({ width: 1280, height: 900 });
for (const template of ['default-android', 'official-android-bds']) {
  await page.goto('http://127.0.0.1:1420', { waitUntil: 'networkidle' });
  await page.locator(`.template-card[data-template="${template}"]`).click();
  await expect(page.locator('#skin-state')).toBeVisible();
  assert.equal(await page.locator('#skin-state option').count(), 124);
  await page.locator('#skin-state').selectOption('0');
  await page.locator('[data-theme-choice="dark"]').click();
  await expect(page.locator('#skin-state')).toHaveValue('0');
  await expect(page.locator('.skin-state-value')).toHaveText('S0');
  await page.locator('#skin-state').selectOption('4');
  await expect(page.locator('.skin-state-value')).toHaveText('S4');
  await page.locator('[data-theme-choice="light"]').click();
  const centers = await page.locator('#toggle-guides, .preview-choice button').evaluateAll(nodes => nodes.map(node => {
    const button = node.getBoundingClientRect();
    const icon = node.querySelector('svg').getBoundingClientRect();
    return {
      dx: icon.x + icon.width / 2 - button.x - button.width / 2,
      dy: icon.y + icon.height / 2 - button.y - button.height / 2,
    };
  }));
  assert(centers.every(({ dx, dy }) => Math.abs(dx) < 0.6 && Math.abs(dy) < 0.6), 'toolbar icons must be centered');
}
return { passed: true, checks: ['BDA and BDS state dropdown', 'S0 survives theme changes', 'S4 selection', 'centered toolbar icons'] };
