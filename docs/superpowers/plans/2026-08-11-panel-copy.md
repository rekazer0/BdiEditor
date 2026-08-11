# Panel Copy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace portrait-to-landscape conversion with one-panel copy across themes/orientations, including referenced visuals and optional configurable resolution scaling.

**Architecture:** Keep `SkinArchive` as the only archive writer and reuse `IniDocument`, `scaleIniDocument()`, and the existing PNG resize path. Add small pure helpers in `panel-tools.ts` for panel-path validation and style-reference collection/rewriting; keep archive-specific resource resolution and staged writes in `main.ts` beside the existing operation.

**Tech Stack:** TypeScript, native HTML dialog/form controls, Canvas image resize, Node test runner, Vite, Tauri 2.

## Global Constraints

- Copy exactly one real `.ini` panel; never copy a whole theme directory.
- Source and target can cross light/dark and port/land.
- Target accepts an existing filename or a new safe `.ini` filename.
- Copy every referenced `STYLEn` section and every referenced PNG/TIL pair.
- Preserve identical target data; rename only conflicting style/resource identifiers.
- Scaling is off by default. When on, source dimensions are detected/read-only and target dimensions are editable.
- Validate and prepare all output bytes before the first `SkinArchive.set*()` call.
- No new dependency, generic migration framework, atlas repacking, or BDA base materialization.
- Follow ponytail full and TDD: the smallest test that proves each non-trivial branch precedes implementation.

---

### Task 1: Panel paths and style-reference rewriting

**Files:**
- Modify: `src/panel-tools.ts`
- Modify: `tests/panel-tools.test.ts`

**Interfaces:**
- Produces: `copyablePanelPaths(names)` for real `light|dark/skin/port|land/*.ini` entries except `gen.ini`.
- Produces: `validPanelFilename(value)` for safe basename validation.
- Produces: `panelStyleIDs(document)` collecting numeric IDs from `*_STYLE` and `STAT_STYLE` fields.
- Produces: `rewritePanelStyleIDs(document, replacements)` returning a rewritten clone.

- [ ] **Step 1: Write failing path/filename tests**

Require sorted panel paths, exclusion of `gen.ini`, nested/resource files, non-INI files, and rejection of separators, traversal names, and wrong extensions.

- [ ] **Step 2: Run RED**

Run: `node --test tests/panel-tools.test.ts`

Expected: FAIL because the new exports do not exist.

- [ ] **Step 3: Implement minimum path/filename helpers**

Use anchored regular expressions and `localeCompare`; do not add a path library or validator class.

- [ ] **Step 4: Write failing style-reference tests**

Cover `BACK_STYLE`, `FORE_STYLE`, `CELL_STYLE`, another numeric `*_STYLE`, and `STAT_STYLE=S34_7|S99_18`. Verify deduplication, numeric ordering, and exact rewrite of style IDs without changing state numbers or unrelated values.

- [ ] **Step 5: Run RED, implement, and verify GREEN**

Run: `node --test tests/panel-tools.test.ts`

Expected: all panel-tool tests pass.

### Task 2: Replace the conversion dialog with panel-copy controls

**Files:**
- Modify: `index.html`
- Modify: `src/main.ts`
- Modify: `src/style.css`
- Modify: `tests/ui-structure.test.ts`

**Interfaces:**
- Renames toolbar action/title to `面板复制`.
- Produces source path, target theme, target orientation, target filename/datalist, optional-scaling checkbox, read-only source size, editable target size, summary, and copy button controls.
- Produces: `openPanelCopyDialog()` and a small `updatePanelCopyForm()` state synchronizer.

- [ ] **Step 1: Write failing structure tests**

Require the new labels/controls, `datalist`, safe input attributes, `缩放分辨率` unchecked by default, hidden/disabled scale fields while unchecked, and absence of “竖转横” / “同时转换浅色与深色”.

- [ ] **Step 2: Run RED**

Run: `node --test tests/ui-structure.test.ts`

Expected: FAIL on the old conversion dialog.

- [ ] **Step 3: Implement minimal markup and form synchronization**

Populate the source selector from `copyablePanelPaths(archive.names())`. Default to the currently selected eligible panel, then current theme/orientation and source basename. Refresh existing target filename suggestions when theme/orientation changes. Detect source size from the selected panel, falling back to its directory `gen.ini`. Toggle the scale grid through `hidden` and disabled inputs.

- [ ] **Step 4: Verify Task 2 GREEN**

Run: `node --test tests/ui-structure.test.ts tests/panel-tools.test.ts`

Expected: all focused tests pass.

### Task 3: Stage and apply panel/style/resource copies

**Files:**
- Modify: `src/main.ts`
- Modify: `src/panel-tools.ts` only if a tiny section comparison/image-reference helper is needed by tests
- Modify: `tests/panel-tools.test.ts`
- Modify: `tests/ui-structure.test.ts`

**Interfaces:**
- Replaces: `convertPortraitPanels()` with `copyPanel()`.
- Reuses: the orientation-first/shared fallback resource-root order from `AtlasResolver`.
- Produces staged `Map<string, Uint8Array>` writes, applied only after validation and optional resizing finish.

- [ ] **Step 1: Write failing conflict tests**

Use small `IniDocument` fixtures to prove:

- missing target `STYLEn` keeps its ID;
- identical target `STYLEn` reuses its ID;
- conflicting target `STYLEn` gets the next unused ID and rewrites the copied panel;
- identical PNG/TIL pairs reuse their name;
- conflicting pairs receive `_copy2` then `_copy3` and copied style image values are rewritten.

Keep the test surface on small pure helpers; do not build a mock UI or a second archive implementation.

- [ ] **Step 2: Run RED**

Run: `node --test tests/panel-tools.test.ts tests/ui-structure.test.ts`

Expected: FAIL because copy planning and the new submit path are absent.

- [ ] **Step 3: Implement style merging**

Parse source/target styles, collect source style IDs, compare section entries, allocate numeric IDs only on conflicts, append copied sections, rewrite the copied panel, and update `[GLOBAL] STYLE_NUM` to at least the highest resulting ID.

- [ ] **Step 4: Implement resource-pair copying**

For `NM_IMG` and `HL_IMG` in copied styles, locate complete source PNG/TIL pairs. Compare both target files byte-for-byte; reuse identical pairs or allocate the first free `_copyN` base. Rewrite only the copied style sections. Missing pairs are a hard validation error.

- [ ] **Step 5: Implement optional scaling and atomic application**

When enabled, calculate X/Y ratios, scale the copied panel and copied TIL documents with `scaleIniDocument()`, and await PNG resizing. Put the panel, stylesheet, TIL, and PNG outputs in the staged map, then apply all writes together. Scaling a resource already present in the target must allocate a copy so the source/unrelated panels are not modified.

- [ ] **Step 6: Wire overwrite confirmation and post-copy selection**

Confirm once if the target panel exists. After success, set theme/orientation, render files, select the target, refresh previews, mark dirty, and report the copied file/resource count. Use `runFileOperation("复制面板", copyPanel)`.

- [ ] **Step 7: Verify Task 3 GREEN**

Run: `node --test tests/panel-tools.test.ts tests/ui-structure.test.ts`

Expected: all focused tests pass.

### Task 4: Full verification, ARM64 build, and real UI debugging

**Files:**
- Modify only files required by failures found during verification.

- [ ] **Step 1: Run full automated verification**

Run: `npm test`

Expected: zero failures.

Run: `npm run build`

Expected: production build exits 0.

- [ ] **Step 2: Build the ARM64 macOS app**

Run: `npm run tauri -- build --target aarch64-apple-darwin`

Expected output: `src-tauri/target/aarch64-apple-darwin/release/bundle/macos/BdiEditor.app`, version `0.6.1`, arm64 executable.

- [ ] **Step 3: Exercise the built app**

Open the ARM64 bundle and verify with a real BDS skin:

1. source selector defaults correctly;
2. new target copy within one directory;
3. existing target overwrite confirmation;
4. light/port to dark/land copy;
5. scaling disabled preserves dimensions;
6. scaling enabled uses detected source and configured target dimensions;
7. copied panel previews with its PNG/TIL styles intact;
8. source panel and unrelated target panels remain unchanged.

- [ ] **Step 4: Iterate on observed failures**

For each UI/runtime failure, add the smallest reproducing automated check where practical, fix the root cause, rerun focused tests, rebuild, and repeat the real-app scenario until stable.

- [ ] **Step 5: Final verification evidence**

Record full test count, build result, executable architecture/version, tested skin/scenarios, and final app path. Do not claim completion without fresh outputs from every command.
