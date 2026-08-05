# 皮肤预览与编辑交互修复实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复皮肤透明渲染、模拟输入、样式预览、字体、键盘移动、导出入口与内置默认模板，并只生成 macOS `.app`。

**Architecture:** 保留现有 Tauri + TypeScript + Canvas/DOM 架构。把完整皮肤渲染与轻量模拟输入更新分离；扩展现有图集解析结果以支持真实切片缩略图和复合字体属性；所有编辑继续写回现有 INI 文档与撤销栈。

**Tech Stack:** TypeScript 5.9、Vite 7、Tauri 2、Canvas 2D、Node 内置测试运行器、fflate（现有依赖）。

## Global Constraints

- 不新增运行时依赖。
- 不按浅色或深色模式硬编码工具栏颜色。
- `.bdi` 是 iOS 格式，`.bds` 是 Android 格式。
- 应用包含固定内置默认模板，用户不能设置或替换默认模板。
- 不实现真实拼音词库、百度功能码执行或真实输入引擎。
- 只交付 macOS `.app`，不输出 DMG 或其他安装包。

---

### Task 1: 修复透明样式与复合字体解析

**Files:**
- Modify: `src/atlas.ts`
- Modify: `tests/atlas.test.ts`

**Interfaces:**
- Produces: `isTransparentColor(color?: string): boolean`
- Produces: `canvasFontFamily(fontName?: string): string`
- Extends: `Visual` with `imagePath?: string`
- Changes: `resolveTextVisual(styles, foreground, highlighted)` independently merges `fontSize`, `fontName`, and `color` across exact and encoded styles.

- [ ] **Step 1: Add failing tests for transparent colors and split text properties**

Add literal fixtures proving `00FFFFFF` is transparent, `80010203` is not, and `FONT_NAME`, `FONT_SIZE`, `NM_COLOR` can come from separate foreground style tokens.

- [ ] **Step 2: Run `node --test tests/atlas.test.ts` and verify the new tests fail for missing exports/incorrect early return**

- [ ] **Step 3: Implement minimal merged-property parsing and system-font normalization**

Keep the original font name in parsed data. Map `.SFUI*` and `.SFNS*` to `system-ui` only when constructing the Canvas font family. Return `imagePath` from `AtlasResolver.resolve` when a PNG atlas is resolved.

- [ ] **Step 4: Run `node --test tests/atlas.test.ts` and verify all atlas tests pass**

---

### Task 2: 修复候选语言、标点与退格状态

**Files:**
- Modify: `src/simulation.ts`
- Modify: `tests/simulation.test.ts`

**Interfaces:**
- Changes: `candidatePreview(value, caret, language)` where `language` is `"zh" | "en"`.
- Produces: `compositionBeforeCaret(value, caret): string`.

- [ ] **Step 1: Add failing tests for caret-aware composition**

Cover `ni'hao`, `ni'hao，`, `hello!`, a caret in the middle of text, and English mode. Expected Chinese candidates appear only for a non-empty Chinese composition; punctuation ends composition; English mode never returns Chinese words.

- [ ] **Step 2: Run `node --test tests/simulation.test.ts` and verify failures describe the old trim-based behavior**

- [ ] **Step 3: Implement the trailing Latin-token parser and language-specific candidate output**

Use only the text before the caret and match the final `[A-Za-z']+` token. Preserve the existing `insertText` and Unicode-safe `deleteBackward` behavior.

- [ ] **Step 4: Run `node --test tests/simulation.test.ts` and verify all simulation tests pass**

---

### Task 3: 移除 KEY 名称并支持方向键移动

**Files:**
- Modify: `src/preview.ts`
- Modify: `src/layout.ts`
- Modify: `src/main.ts`
- Modify: `tests/preview.test.ts`
- Modify: `tests/layout.test.ts`

**Interfaces:**
- Changes: `previewFallbackText` never returns a config section name.
- Produces: `moveRects(rects, dx, dy): LayoutRect[]`.
- Produces: `isTextEditingTarget(target): boolean` in a small testable UI helper if needed.

- [ ] **Step 1: Change the existing preview expectation so blank editable keys remain blank in edit mode**

- [ ] **Step 2: Add failing layout tests for moving single and multiple rectangles without mutating inputs**

- [ ] **Step 3: Run `node --test tests/preview.test.ts tests/layout.test.ts` and verify failures**

- [ ] **Step 4: Implement `moveRects` and remove the section-name fallback**

- [ ] **Step 5: Wire Arrow keys in `src/main.ts`**

Only act in edit mode with a non-empty selection and when focus is not an input, textarea, select, button, or contenteditable element. Move 1 unit normally or 10 with Shift; update all selected `VIEW_RECT` values as one undo change and refresh the inspector/preview.

- [ ] **Step 6: Run the focused tests and `npx tsc --noEmit`**

---

### Task 4: 分离轻量输入刷新，消除闪烁

**Files:**
- Modify: `src/main.ts`
- Modify: `tests/ui-structure.test.ts`

**Interfaces:**
- Produces: `refreshSimulationState()` which only updates composition/candidate DOM and toolbar visibility.
- Keeps: `refreshPreview()` for skin/config/layout changes.

- [ ] **Step 1: Add a structural test that the simulated input handler calls the lightweight state updater rather than full preview refresh**

- [ ] **Step 2: Run `node --test tests/ui-structure.test.ts` and verify the test fails**

- [ ] **Step 3: Extract the lightweight updater and replace typing, clear, insertion, and deletion call sites**

Determine language from the actual `layoutPath` basename (`en_*.ini` is English; otherwise Chinese). Preserve the caret after programmatic updates.

- [ ] **Step 4: Run focused tests and type-check**

---

### Task 5: 修复工具栏透明合成

**Files:**
- Modify: `src/preview.ts`
- Modify: `src/main.ts`
- Modify: `src/style.css`
- Modify: `tests/preview.test.ts`
- Modify: `tests/ui-structure.test.ts`

**Interfaces:**
- Produces: `shouldPaintVisualColor(color?: string): boolean` or equivalent shared predicate.
- Changes: toolbar preview Canvas and its DOM container never provide a theme-dependent opaque fallback when the skin declares transparency.

- [ ] **Step 1: Add failing tests proving a zero-alpha style is skipped and transparent toolbar containers have no black/white background fallback**

- [ ] **Step 2: Run focused tests and verify failures**

- [ ] **Step 3: Trace the sample skin's `CAND BACK_STYLE` through `default.css` and `.til` files, recording the resolved alpha/source values in the test fixture**

- [ ] **Step 4: Make the minimal root-cause fix**

Skip zero-alpha color fills while retaining nontransparent image layers. Reuse one `AtlasResolver` per full preview refresh and do not paint a toolbar DOM background over the Canvas.

- [ ] **Step 5: Run focused tests and type-check**

---

### Task 6: 显示背景/前景样式切片缩略图与正确字体

**Files:**
- Modify: `index.html`
- Modify: `src/main.ts`
- Modify: `src/style.css`
- Modify: `src/atlas.ts`
- Modify: `tests/atlas.test.ts`
- Modify: `tests/ui-structure.test.ts`

**Interfaces:**
- Produces: inspector preview buttons for `BACK_STYLE` normal/pressed layers and `FORE_STYLE` composite layers.
- Consumes: `Visual.imagePath`, `Visual.source`, `resolveTextVisual`, `canvasFontFamily`.

- [ ] **Step 1: Add failing tests for style-preview controls and source metadata**

- [ ] **Step 2: Run focused tests and verify failures**

- [ ] **Step 3: Add compact preview buttons beside background and foreground style fields**

Draw the resolved source rectangle into a small Canvas or data URL without adding a library. Composite multiple foreground visuals in configured order. Command/Ctrl click selects the resolved resource path and reveals it in the source tree.

- [ ] **Step 4: Use the merged text visual and normalized Canvas font family for key labels and inspector values**

- [ ] **Step 5: Run focused tests and type-check**

---

### Task 7: 固定导出按钮与内置默认模板

**Files:**
- Modify: `index.html`
- Modify: `src/main.ts`
- Modify: `src/style.css`
- Modify: `src-tauri/tauri.conf.json`
- Create: `public/default-template.bdi`
- Modify: `tests/ui-structure.test.ts`
- Modify: `tests/skin.test.ts`

**Interfaces:**
- Produces: two explicit buttons with `data-export-format="bdi"` and `data-export-format="bds"`.
- Produces: `loadBuiltInTemplate(): Promise<Uint8Array>` using the bundled `/default-template.bdi` resource.

- [ ] **Step 1: Add failing UI tests for two visible export buttons and the absence of `set-default`**

- [ ] **Step 2: Add a fixture test that the chosen built-in template opens as a valid `SkinArchive` and contains `Info.txt`, light layout, and required resources**

- [ ] **Step 3: Run focused tests and verify failures**

- [ ] **Step 4: Bundle the verified supplied iOS template as `public/default-template.bdi`**

Use `/Users/kaze/Downloads/ios_v0.2.2_14键(二改@物哀文本+原作者@纳兰飞彐).bdi`; preserve its metadata and attribution. Do not expose any user preference for changing it.

- [ ] **Step 5: Replace the export select with direct format buttons**

Clicking either button closes the menu and invokes Save As using that exact format. Add `-webkit-app-region: no-drag`, pointer events, visible text color, hover, active, focus-visible, and disabled states.

- [ ] **Step 6: Replace localStorage/file-picker default-template logic with bundled template loading**

New documents are unsaved copies. Remove `browserTemplate`, `setDefaultButton`, `setDefaultTemplate`, duplicate listeners, and all `defaultTemplate` localStorage access.

- [ ] **Step 7: Run focused tests and type-check**

---

### Task 8: 完整验证、仅构建 `.app`、同步 GitHub

**Files:**
- Modify: `src-tauri/tauri.conf.json`
- Modify: `docs/release-notes-0.1.md`
- Modify: `docs/release-checklist.md`

**Interfaces:**
- Produces: `src-tauri/target/release/bundle/macos/BDI 皮肤编辑器.app`.

- [ ] **Step 1: Run `npm test`**

Expected: all Node tests pass without failures.

- [ ] **Step 2: Run `npx tsc --noEmit` and `npm run build`**

Expected: both commands exit 0 without TypeScript or Vite errors.

- [ ] **Step 3: Run sample compatibility verification**

Run `npm run verify:samples` against the supplied `.bdi`/`.bds` sample set and verify both export formats reopen successfully.

- [ ] **Step 4: Set Tauri bundle target to `app`/macOS only and run `npm run tauri build -- --bundles app`**

Expected: only the `.app` bundle is created for user testing.

- [ ] **Step 5: Re-run the complete verification suite after packaging**

- [ ] **Step 6: Initialize or reconnect Git history safely, inspect the remote `rekazer0/bdi-edit`, commit the scoped changes, push, and publish/update release `0.1`**

Do not overwrite unrelated remote history. If GitHub authentication tooling is unavailable, report the exact blocker after completing the local `.app`.
