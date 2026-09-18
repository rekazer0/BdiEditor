await page.goto('http://127.0.0.1:1420');
await page.waitForSelector('#source-section-scrollbar', { state: 'attached' });
await page.evaluate(async () => {
  const { SourceCodeEditor } = await import('/src/source-editor.ts');
  document.querySelector('#source').removeAttribute('id');
  const host = document.createElement('div');
  host.id = 'source';
  host.style.cssText = 'position:fixed;inset:60px auto auto 60px;width:600px;height:400px;z-index:99999';
  document.body.append(host);
  const editor = new SourceCodeEditor(host);
  editor.disabled = false;
  editor.value = ['; [ignored]', 'VALUE=[ignored]', ...Array.from({length: 6}, (_, i) => `[TIP${i}]\n${'VALUE=1\n'.repeat(30)}`)].join('\n');
  window.sectionTestEditor = editor;
});
const nav = page.locator('#source .source-section-scrollbar');
await expect(nav.locator('button')).toHaveCount(6);
await expect(nav).toHaveCSS('opacity', '0');
await page.locator('#source .cm-scroller').hover();
await page.mouse.wheel(0, 100);
await expect(nav).toHaveCSS('opacity', '1');
await nav.getByRole('button', {name: '[TIP3] · 第 99 行', exact: true}).click();
await expect(nav.locator('[aria-current="true"]')).toHaveAttribute('title', '[TIP3] · 第 99 行');
assert(await page.evaluate(() => window.sectionTestEditor.view.scrollDOM.scrollTop > 500));
await expect(nav).toHaveCSS('opacity', '0');
await page.evaluate(() => {
  const control = document.querySelector('#source-section-scrollbar');
  control.checked = false;
  control.dispatchEvent(new Event('change', {bubbles:true}));
});
await expect(nav).toHaveCSS('display', 'none');
await page.evaluate(() => {
  const control = document.querySelector('#source-section-scrollbar');
  control.checked = true;
  control.dispatchEvent(new Event('change', {bubbles:true}));
  window.sectionTestEditor.setLanguage('json');
});
await expect(nav.locator('button')).toHaveCount(0);
await page.evaluate(() => {
  window.sectionTestEditor.setLanguage('ini');
  window.sectionTestEditor.value = '[NEW]\nVALUE=1';
});
await expect(nav.locator('button')).toHaveCount(1);
await expect(nav.locator('button')).toHaveAttribute('title', '[NEW] · 第 1 行');
return {passed: true, checks: ['section parsing', 'scroll reveal and idle hide', 'click navigation', 'active section', 'setting toggle', 'JSON fallback', 'document updates']};
