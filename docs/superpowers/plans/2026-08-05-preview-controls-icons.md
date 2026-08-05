# Preview Controls and Icon Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复透明工具栏黑块，并加入苹方 UI、统一 SF Symbols 风格图标、预览缩放以及新的方向/外观顶栏控件。

**Architecture:** 保持现有 TypeScript + Canvas + DOM 架构。`Preview` 继续忠实绘制皮肤层，手机键盘底材由稳定 CSS 提供；隐藏 `select` 继续作为状态源，新的分段控件只负责触发选择；缩放只改变 `device-shell` 的 CSS 尺寸。

**Tech Stack:** TypeScript, Canvas 2D, CSS, Tauri 2, AppKit SF Symbols bridge, Node/Rust test runners

## Global Constraints

- 不改变皮肤文件的颜色、alpha、图片和字体语义。
- 编辑器 UI 使用 `PingFang SC`；皮肤字体保持皮肤声明。
- 缩放范围 50%–150%，步进 10%，默认 100%，不得改变 Canvas 逻辑坐标。
- 不新增前端运行时依赖；Apple 符号通过 macOS AppKit 运行时获取，不打包字体或导出 glyph。
- 左侧“九键”显示为“9键”，右侧删除 9/26 布局滑块。

---

### Task 1: 透明工具栏与手机材质

**Files:**
- Modify: `src/style.css`
- Modify: `src/preview.ts` only if the regression test proves a Canvas background is still painted
- Test: `tests/preview.test.ts`
- Test: `tests/ui-structure.test.ts`

**Interfaces:**
- Consumes: `previewSurfaceColor(theme, transparent)` and `isTransparentColor()`.
- Produces: stable transparent toolbar over a semi-transparent keyboard material.

- [ ] Add failing tests asserting transparent toolbar/canvas, stable semi-transparent dock material without ancestor blur, a visible top highlight, and a non-near-black dark phone base.
- [ ] Run `node --test tests/preview.test.ts tests/ui-structure.test.ts` and confirm the new assertions fail for the intended rules.
- [ ] Apply the minimum rendering/CSS change; preserve nonzero skin alpha rendering.
- [ ] Run the focused tests and confirm they pass.

### Task 2: Top controls and preview zoom

**Files:**
- Create: `src/zoom.ts`
- Modify: `index.html`
- Modify: `src/main.ts`
- Modify: `src/style.css`
- Create: `tests/zoom.test.ts`
- Modify: `tests/ui-structure.test.ts`

**Interfaces:**
- Produces: `clampZoom(value: number): number` and `stepZoom(value: number, direction: -1 | 1): number`.
- Uses hidden `#orientation`, `#theme`, and existing `selectChoice()` as state sources.

- [ ] Add failing unit tests for 50–150 clamping and 10-point stepping, plus structure tests for orientation/theme segmented controls and removal of the inspector layout control.
- [ ] Run `node --test tests/zoom.test.ts tests/ui-structure.test.ts` and confirm failure.
- [ ] Add the zoom helper and top-toolbar DOM; wire minus/plus controls and percentage output in `main.ts`.
- [ ] Make `device-shell` sizing respect `--preview-zoom` while preserving the canvas dimensions and hit testing.
- [ ] Move theme buttons to the canvas toolbar, replace orientation select UI with segmented buttons, remove inspector layout/theme UI, and retain hidden state selects.
- [ ] Rename the left navigation label to `9键`.
- [ ] Run focused tests and confirm pass.

### Task 3: PingFang and unified symbols

**Files:**
- Modify: `index.html`
- Modify: `src/main.ts`
- Modify: `src/style.css`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/lib.rs`
- Modify: `tests/ui-structure.test.ts`

**Interfaces:**
- Produces: macOS `sf_symbol(name: String) -> Result<Vec<u8>, String>` and front-end `createSymbolIcon(name: string, className?: string): HTMLElement`.
- Uses: `SkinArchive.isText()` and `SkinArchive.isImage()` for source-tree icon selection.

- [ ] Add failing structure/Rust tests for `PingFang SC`, AppKit `systemSymbolName` lookup, source tree folder/file icons, and replacement of text glyphs in the phone UI.
- [ ] Run `node --test tests/ui-structure.test.ts` and confirm failure.
- [ ] Add a macOS-only AppKit command that resolves approved SF Symbol names to transparent PNG bytes, with an explicit allowlist and an error for unknown names.
- [ ] Add `createSymbolIcon()` and a cached front-end loader that applies native PNGs as `currentColor` masks; keep a self-drawn fallback for browser development.
- [ ] Replace static toolbar/phone glyphs and prepend consistent symbols to navigation, folders, text files, images, and unknown files.
- [ ] Remove CSS/Unicode placeholder icons; keep icon elements pointer-events disabled and `aria-hidden`.
- [ ] Set the editor UI font stack to `PingFang SC` without changing canvas skin font resolution.
- [ ] Run `cargo test --manifest-path src-tauri/Cargo.toml` and the focused Node tests; confirm pass.

### Task 4: Integration verification

**Files:**
- Modify only files required by discovered integration failures.

- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run `npx tsc --noEmit`.
- [ ] Start the app against the referenced sample and visually verify light/dark, portrait/landscape, 50/100/150% zoom, source-tree icons, and transparent toolbar composition.
- [ ] Review the diff for unrelated changes and remaining Unicode placeholder icons.
