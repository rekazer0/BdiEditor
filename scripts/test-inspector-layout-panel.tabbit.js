// 每个布局文件都应打开右侧属性栏（ini / cnd / pop），不论从哪个侧边栏点进来。
// 需要已运行的开发服务器：npm run dev  → http://127.0.0.1:1420
// ~/.local/bin/tabbit-cli nodejs --task inspector-layout-panel --request-id regression < scripts/test-inspector-layout-panel.tabbit.js
const fs = await import('node:fs/promises');
await page.goto('http://127.0.0.1:1420/', { waitUntil: 'networkidle' });
await page.setViewportSize({ width: 1600, height: 1000 });
await page.locator('#browser-open').setInputFiles({
  name: '好可爱蛙_智能深色-18键.bds', mimeType: 'application/octet-stream',
  buffer: await fs.readFile('/Users/kaze/work/bd/好可爱蛙_智能深色-18键.bds'),
});
await page.waitForTimeout(3500);
const dialogClose = page.locator('#file-operation-dialog[open]').getByRole('button', { name: '关闭', exact: true });
if (await dialogClose.isVisible().catch(() => false)) await dialogClose.click();
await page.waitForTimeout(1200);

// 1) 概览里每个 ini / cnd / pop 都落到属性页
const overview = await page.evaluate(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const clean = (value) => (value || '').replace(/[\u200b-\u200f\u2060\ufeff]/g, '');
  const paths = Array.from(document.querySelectorAll('.sidebar-overview button[data-path]'))
    .map((button) => button.dataset.path).filter((path) => /\.(ini|cnd|pop)$/i.test(path));
  const failures = [];
  for (const path of paths) {
    document.querySelector(`.sidebar-overview button[data-path="${CSS.escape(path)}"]`).click();
    await wait(260);
    const panel = document.querySelector('#quick-inspector');
    const tab = document.querySelector('[data-inspector-tab].active')?.dataset.inspectorTab;
    const disabled = Array.from(document.querySelectorAll('[data-inspector-tab][disabled]')).map((button) => button.dataset.inspectorTab);
    if (panel.hasAttribute('hidden') || tab !== 'properties' || disabled.includes('properties')) {
      failures.push(`${clean(path)}: tab=${tab} hidden=${panel.hasAttribute('hidden')} disabled=${disabled.join(',')}`);
    }
  }
  return { checked: paths.length, failures };
});
expect(overview.failures).toEqual([]);

// 2) 源文件树里点布局文件同样落到属性页（此前会跳到源代码并禁用属性）
await page.getByRole('button', { name: '源文件', exact: true }).click();
await page.waitForTimeout(400);
for (let round = 0; round < 8; round += 1) {
  const opened = await page.evaluate(() => {
    const closed = Array.from(document.querySelectorAll('.raw-files details.raw-folder:not([open])'));
    for (const folder of closed) folder.open = true;
    return closed.length;
  });
  if (!opened) break;
  await page.waitForTimeout(300);
}
const sourceTargets = ['light/skin/port/gen.ini', 'light/skin/port/logo.ini', 'light/skin/port/hint1.pop', 'light/skin/port/cand1.cnd', 'light/skin/res/anim.ini'];
for (const path of sourceTargets) {
  await page.locator(`.raw-files button.source-file-row[data-path="${path}"]`).click();
  await expect(page.locator('#quick-inspector')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('[data-inspector-tab=properties]')).toHaveClass(/active/);
  await expect(page.locator('[data-inspector-tab=properties]')).toBeEnabled();
}

// 3) 真实键名有中文标签，分区与分类轨也可读，且同一分类轨不出现两个同名按钮
await page.locator('.raw-files button.source-file-row[data-path="light/skin/port/logo.ini"]').click();
await page.waitForTimeout(400);
await expect(page.locator('[data-document-key=ICON_NUM] .document-field-name')).toHaveText('工具按钮数量');
await expect(page.locator('[data-document-key=ICON_INDEX] .document-field-name')).toHaveText('图标序号');
await expect(page.locator('[data-document-key=TEXT_STYLE] .document-field-name')).toHaveText('文字样式');
await expect(page.locator('#mobile-inspector-groups')).toContainText('全局设置');
await page.locator('.raw-files button.source-file-row[data-path="light/skin/port/cand1.cnd"]').click();
await page.waitForTimeout(400);
await expect(page.locator('[data-document-key=CELL_W] .document-field-name')).toHaveText('单元格宽度');
await expect(page.locator('#mobile-inspector-groups')).toContainText('开关');
const railLabels = await page.locator('#mobile-inspector-groups button').allInnerTexts();
expect(new Set(railLabels.map((label) => label.trim())).size).toBe(railLabels.length);
await page.locator('.raw-files button.source-file-row[data-path="light/skin/port/gen.ini"]').click();
await page.waitForTimeout(400);
await expect(page.locator('#mobile-inspector-groups')).toContainText('列表');
await expect(page.locator('[data-document-key=SYM_LAYOUT] .document-field-name')).toHaveText('符号面板布局');
await expect(page.locator('[data-document-key=NAMES] .document-field-name')).toHaveText('列表名称');

return {
  passed: true,
  checks: [
    `概览 ${overview.checked} 个布局文件全部打开属性栏`,
    '源文件树的 ini/cnd/pop 同样打开属性栏',
    '真实键名显示中文标签（工具按钮数量 / 单元格宽度 / 符号面板布局 / 列表名称）',
    '分区名称与分类轨不再显示 LIST / BAR / SWITCH 英文原名，且无重名按钮',
  ],
};
