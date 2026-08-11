# Add Downloaded Built-In Skins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bundle the five supplied BDS skins as New Project templates and show the requested internet-source infringement notice.

**Architecture:** Reuse the existing static HTML radio list, `builtInProjectTemplatePaths` lookup, and `public/templates/` asset convention. Add no manifest, dynamic discovery, dependency, or new runtime abstraction.

**Tech Stack:** TypeScript, HTML, Markdown, Node test runner, Vite.

## Global Constraints

- Display each supplied filename without its `.bds` extension.
- Show exactly: `内置皮肤为互联网下载整理，如有侵权请联系作者下架。`
- Keep `default-android` selected by default and preserve both existing Baidu official templates.
- Copy the supplied archives without modifying their bytes.
- Add no downloading, updating, attribution metadata, categories, or dynamic registry.

---

### Task 1: Add the five built-in BDS templates

**Files:**
- Create: `public/templates/oppo-swipe-down.bds`
- Create: `public/templates/oppo-dual-color.bds`
- Create: `public/templates/iqoo-rounded-black.bds`
- Create: `public/templates/xiaomi-unified-rounded-blur.bds`
- Create: `public/templates/huawei-swipe-symbols-1080.bds`
- Modify: `index.html`
- Modify: `src/operations.ts`
- Modify: `tests/ui-structure.test.ts`
- Modify: `tests/operations.test.ts`
- Modify: `tests/skin.test.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes: `loadBuiltInProjectTemplate(id: string, fetcher?: ProjectTemplateFetcher): Promise<Uint8Array>`.
- Produces: five new accepted IDs: `oppo-swipe-down`, `oppo-dual-color`, `iqoo-rounded-black`, `xiaomi-unified-rounded-blur`, and `huawei-swipe-symbols-1080`.

- [x] **Step 1: Write failing UI, loader, and payload tests**

In `tests/ui-structure.test.ts`, require seven template radios, the exact notice, and all five new labels and IDs:

```ts
assert.equal((dialog.match(/name="project-template"/g) ?? []).length, 7)
assert.match(dialog, /内置皮肤为互联网下载整理，如有侵权请联系作者下架。/)
for (const [id, label] of [
  ["oppo-swipe-down", "OPPO皮肤加下滑功能"],
  ["oppo-dual-color", "OPPO默认双色皮肤"],
  ["iqoo-rounded-black", "IQOO提取圆角黑色"],
  ["xiaomi-unified-rounded-blur", "小米默认皮肤\\(统一颜色键盘版3\\)_适配圆角模糊"],
  ["huawei-swipe-symbols-1080", "华为提取上滑符号1080"],
] as const) {
  assert.match(dialog, new RegExp(`value="${id}"`))
  assert.match(dialog, new RegExp(label))
}
```

In `tests/operations.test.ts`, verify the exact ID-to-path mappings:

```ts
const templates = {
  "oppo-swipe-down": "/templates/oppo-swipe-down.bds",
  "oppo-dual-color": "/templates/oppo-dual-color.bds",
  "iqoo-rounded-black": "/templates/iqoo-rounded-black.bds",
  "xiaomi-unified-rounded-blur": "/templates/xiaomi-unified-rounded-blur.bds",
  "huawei-swipe-symbols-1080": "/templates/huawei-swipe-symbols-1080.bds",
}
for (const [id, expectedPath] of Object.entries(templates)) {
  await loadBuiltInProjectTemplate(id, async (path) => {
    assert.equal(path, expectedPath)
    return { ok: true, async arrayBuffer() { return new ArrayBuffer(0) } }
  })
}
```

In `tests/skin.test.ts`, replace the obsolete no-template-directory assertion with one loop that checks each file exists and opens as BDS:

```ts
for (const name of [
  "oppo-swipe-down.bds",
  "oppo-dual-color.bds",
  "iqoo-rounded-black.bds",
  "xiaomi-unified-rounded-blur.bds",
  "huawei-swipe-symbols-1080.bds",
]) {
  const url = new URL(`../public/templates/${name}`, import.meta.url)
  assert.equal(existsSync(url), true)
  assert.equal(SkinArchive.open(new Uint8Array(readFileSync(url))).format, "bds")
}
```

- [x] **Step 2: Run focused tests and verify RED**

Run: `node --test tests/ui-structure.test.ts tests/operations.test.ts tests/skin.test.ts`

Expected: FAIL because the new choices, mappings, and payloads do not exist.

- [x] **Step 3: Copy the five payloads without changing their bytes**

Copy the supplied files to their exact destinations, then verify each source and destination pair has the same SHA-256 digest with `shasum -a 256`.

- [x] **Step 4: Add the minimal UI and loader mappings**

Add the notice and five `project-template-option` labels to the existing New Project dialog in `index.html`. Add these entries to `builtInProjectTemplatePaths` in `src/operations.ts`:

```ts
"oppo-swipe-down": "/templates/oppo-swipe-down.bds",
"oppo-dual-color": "/templates/oppo-dual-color.bds",
"iqoo-rounded-black": "/templates/iqoo-rounded-black.bds",
"xiaomi-unified-rounded-blur": "/templates/xiaomi-unified-rounded-blur.bds",
"huawei-swipe-symbols-1080": "/templates/huawei-swipe-symbols-1080.bds",
```

- [x] **Step 5: Update README**

Update Quick Start and the feature list to mention the five internet-collected built-in BDS skins and repeat the exact infringement notice. Do not change compatibility claims.

- [x] **Step 6: Run focused tests and verify GREEN**

Run: `node --test tests/ui-structure.test.ts tests/operations.test.ts tests/skin.test.ts`

Expected: all focused tests pass.

- [x] **Step 7: Complete verification**

Run: `npm test`

Expected: all tests pass.

Run: `npm run build`

Expected: Vite production build exits 0 and `dist/templates/` contains the five BDS files.

Run: `git diff --check`

Expected: exit 0 with no output.

- [x] **Step 8: Commit**

```bash
git add index.html src/operations.ts tests/ui-structure.test.ts tests/operations.test.ts tests/skin.test.ts README.md public/templates docs/superpowers/plans/2026-08-11-add-downloaded-built-in-skins.md
git commit -m "feat: add downloaded built-in skins"
```
