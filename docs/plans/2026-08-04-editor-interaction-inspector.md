# Editor Interaction and Inspector Implementation Plan

**Goal:** Make preview and editing modes unambiguous, improve key-action and image editing, restore keyboard toolbar visibility, add structured source navigation, and protect unsaved work during New/Open.

**Architecture:** Keep the dependency-free Tauri + DOM + Canvas architecture. The main keyboard canvas remains the selectable editing surface, a second read-only canvas renders the configured candidate/toolbar strip, and pure helpers own page navigation, source-folder metadata, image-path resolution, and unsaved-action decisions so behavior is testable without controlling the desktop.

**Tech Stack:** Tauri 2, TypeScript, native HTML/CSS, Canvas 2D, Node test runner.

---

### Task 1: Diagnose and fix page-return actions

**Files:**
- Modify: `src/actions.ts`
- Modify: `src/main.ts`
- Test: `tests/actions.test.ts`

**Steps:**
1. Add failing tests proving `F4` and `F15` return from number/symbol/English pages to the selected base layout, including 26-key mode.
2. Run `npm test` and confirm the new assertions fail.
3. Extend `previewPageTarget(code, currentName, baseName)` and pass the current 9/26 selection from `main.ts`.
4. Run `npm test` and confirm the action suite passes.

### Task 2: Replace canvas dragging with explicit modes

**Files:**
- Modify: `src/preview.ts`
- Modify: `src/main.ts`
- Modify: `index.html`
- Modify: `src/style.css`
- Test: `tests/preview.test.ts`

**Steps:**
1. Add a pure mode test showing edit mode selects while preview mode emits gestures and neither mode mutates geometry through pointer movement.
2. Remove move/resize handling and resize handles from `Preview`; keep Command/Ctrl/Shift multi-selection in edit mode.
3. Replace the mode `<select>` with a glass segmented control ordered “交互预览 / 编辑模式”.
4. In preview mode, make source text, inspector fields, image replacement, layout actions, and theme/layout editing modules read-only.
5. Run `npm test && npm run build`.

### Task 3: Clarify keyboard-versus-key inspection

**Files:**
- Modify: `index.html`
- Modify: `src/main.ts`
- Modify: `src/style.css`

**Steps:**
1. Hide whole-keyboard fields whenever one or more keys are selected.
2. Rebuild “文字与动作” as a two-column display/input row plus a directional pad for up/down/left/right/hold.
3. Add a glass layout-context card containing 9/26-key and light/dark segmented controls.
4. Keep numeric geometry, spacing, style, and action changes inspector-driven now that dragging is removed.
5. Run `npm run build`.

### Task 4: Restore configured toolbar rendering and editing entry points

**Files:**
- Modify: `index.html`
- Modify: `src/main.ts`
- Modify: `src/style.css`
- Test: `tests/preview.test.ts`

**Steps:**
1. Add fixture tests for `cand1.cnd`/`cand.cnd` and `hint1.pop`/`hint.pop` path fallback.
2. Add a toolbar canvas above the keyboard canvas and render the layout named by `gen.ini` `[CAND] LAYOUT_NAME` using the existing Atlas resolver.
3. Make the toolbar strip read-only in interaction preview; clicking it in edit mode opens its configuration in the primary editor.
4. Fix semantic navigation to show the real candidate, hint, logo, and shared-style files from current iOS/Android samples.
5. Run `npm test && npm run build` and verify all 17 real samples.

### Task 5: Add image thumbnails and source jumps

**Files:**
- Create: `src/resources.ts`
- Modify: `index.html`
- Modify: `src/main.ts`
- Modify: `src/style.css`
- Test: `tests/resources.test.ts`

**Steps:**
1. Add failing tests for resolving `name,tile` specifications to orientation-specific or shared PNG paths.
2. Implement the minimal resolver.
3. Add image thumbnail buttons beside keyboard and key normal/pressed image fields.
4. On Command-click (Ctrl-click on Windows), select the corresponding PNG under Advanced Sources; leave preview mode read-only.
5. Run `npm test && npm run build`.

### Task 6: Build a documented source-folder tree

**Files:**
- Create: `src/source-tree.ts`
- Modify: `src/main.ts`
- Modify: `src/style.css`
- Test: `tests/source-tree.test.ts`

**Steps:**
1. Add tests for folder descriptions such as theme, `port`, `land`, `res`, and `logo`.
2. Replace the flat Advanced Sources list with recursive `<details>` folders.
3. Show a small purpose description under each folder name and preserve file selection/highlighting.
4. Run `npm test && npm run build`.

### Task 7: Save-before-New/Open workflow

**Files:**
- Create: `src/unsaved.ts`
- Modify: `src/main.ts`
- Test: `tests/unsaved.test.ts`

**Steps:**
1. Add tests for Save, Don’t Save, and Cancel decisions.
2. Use the dialog plugin’s custom Yes/No/Cancel buttons with labels “保存 / 不保存 / 取消”.
3. Before New, Open, Finder-open, and close, save when requested; abort replacement if saving or Save As is cancelled.
4. Keep browser fallback behavior safe.
5. Run `npm test && npm run build`.

### Task 8: Toolbar icon polish, regression, and app-only build

**Files:**
- Modify: `index.html`
- Modify: `src/style.css`
- Modify: `README.md`
- Modify: `docs/release-notes-0.1.md`

**Steps:**
1. Replace Open, Undo, and Redo glyphs with restrained inline SVG icons.
2. Run `npm test`, `cargo test --manifest-path src-tauri/Cargo.toml`, and all 17 real-sample round trips.
3. Build only the application with `CI=true npm run tauri build -- --bundles app`.
4. Verify with `codesign --verify --deep --strict --verbose=2 <app>`.
5. Report only the `.app` path. Git commits are deferred because this workspace currently has no `.git` repository metadata.
