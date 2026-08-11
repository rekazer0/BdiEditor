# Slice, Source, Picker, and Responsive Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make slice editing source-aware and non-modal while keeping candidate and toolbar previews proportional across window sizes and archive formats.

**Architecture:** Reuse the existing atlas, INI highlighting, picker, and preview code. Add only small shared setters/resolvers where two existing paths currently diverge, and use intrinsic canvas dimensions plus CSS aspect-ratio behavior instead of a new layout system.

**Tech Stack:** TypeScript, DOM Canvas 2D, CSS Grid, native HTML color input/dialog, Node test runner.

## Global Constraints

- The selected slice preview is square; its image is centered, aspect-preserving, and occupies at most 80% of the preview.
- Clicking a real slice opens source and highlights the matching `[IMGn]`; clicking empty atlas space does not open source.
- Entering `资源配置` enables slice guides, while the guide toggle remains user-controllable afterward.
- Color and image-slice selection must not make the editor inert or draw a full-window backdrop.
- Candidate/toolbar previews preserve the logical width/height ratio from configuration at every window size.
- BDI/BDS and BDA use the same device keyboard geometry application and clear stale geometry when unavailable.
- Do not add dependencies, change archive formats, redesign the inspector, or implement multiple `[CAND]` occurrence selection.
- Follow ponytail full: reuse existing code, keep the diff minimal, and leave one runnable check for each non-trivial behavior.

---

### Task 1: Slice preview, guides, and source selection

**Files:**
- Modify: `src/tiles.ts`
- Modify: `tests/tiles.test.ts`
- Modify: `index.html`
- Modify: `src/main.ts`
- Modify: `src/style.css`
- Modify: `tests/ui-structure.test.ts`

**Interfaces:**
- Produces: `tilePreviewDestination(sourceWidth: number, sourceHeight: number, canvasSize: number): { x: number; y: number; width: number; height: number }`.
- Produces: `setGuidesVisible(enabled: boolean): void` as the only writer of guide UI/preview state.
- Produces: `selectedSourceSections(): string[]`, returning the current `IMGn` in resource detail or selected keyboard sections for the active layout.

- [ ] **Step 1: Write the failing preview geometry test**

Add to `tests/tiles.test.ts`:

```ts
test("fits a selected slice into 80 percent of a square preview", () => {
  assert.deepEqual(tilePreviewDestination(100, 50, 240), {
    x: 24, y: 72, width: 192, height: 96,
  })
  assert.deepEqual(tilePreviewDestination(50, 100, 240), {
    x: 72, y: 24, width: 96, height: 192,
  })
})
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/tiles.test.ts`

Expected: FAIL because `tilePreviewDestination` is not exported.

- [ ] **Step 3: Implement the minimum preview geometry**

Add to `src/tiles.ts`:

```ts
export function tilePreviewDestination(sourceWidth: number, sourceHeight: number, canvasSize: number) {
  const scale = Math.min(canvasSize / sourceWidth, canvasSize / sourceHeight) * 0.8
  const width = sourceWidth * scale
  const height = sourceHeight * scale
  return { x: (canvasSize - width) / 2, y: (canvasSize - height) / 2, width, height }
}
```

Use the returned rectangle in `drawTilePreview()`. Change `#tile-preview` intrinsic dimensions to `240×240`; make `#tile-preview-wrap` square with `aspect-ratio: 1`, `width: min(100%, 240px)`, `height: auto`, and `box-sizing: border-box`.

- [ ] **Step 4: Write failing structure tests for guide/source integration**

Add focused assertions to `tests/ui-structure.test.ts` that require:

```ts
assert.match(main, /function setGuidesVisible\(enabled: boolean\)/)
assert.match(main, /resourceMode[\s\S]*?setGuidesVisible\(true\)/)
assert.match(main, /function selectedSourceSections\(\): string\[\]/)
assert.match(main, /selectedTileIndex === undefined \? \[\] : \[`IMG\$\{selectedTileIndex\}`\]/)
assert.match(main, /if \(hit\)[\s\S]*?inspectorTab = "source"[\s\S]*?updateInspectorView\(\)/)
assert.match(html, /id="tile-preview" width="240" height="240"/)
assert.match(css, /#tile-preview-wrap\s*\{[^}]*aspect-ratio:\s*1[^}]*box-sizing:\s*border-box/s)
```

- [ ] **Step 5: Run the focused structure test and verify RED**

Run: `node --test tests/ui-structure.test.ts`

Expected: FAIL on the missing shared setter/resolver and square preview markup/styles.

- [ ] **Step 6: Implement guide and source integration**

In `src/main.ts`:

- Move the current guide click-handler body into `setGuidesVisible(enabled)` and make the click handler call `setGuidesVisible(!guidesVisible)`.
- Call `setGuidesVisible(true)` when entering resource mode. Replace `toggleGuides.click()` in new-slice behavior with the setter.
- Implement `selectedSourceSections()` and pass its result to `highlightIni()` and source scrolling.
- On a real atlas hit, set `inspectorTab = "source"`, refresh the inspector/highlight, and request source scrolling. On empty space, clear selection without switching tabs.
- Refresh source highlighting after commit/delete/load operations that change `selectedTileIndex`.

- [ ] **Step 7: Verify Task 1 GREEN**

Run: `node --test tests/tiles.test.ts tests/highlight.test.ts tests/ui-structure.test.ts`

Expected: all focused tests pass with no warnings.

- [ ] **Step 8: Commit Task 1**

```bash
git add src/tiles.ts tests/tiles.test.ts index.html src/main.ts src/style.css tests/ui-structure.test.ts
git commit -m "fix: align slice preview and source selection"
```

### Task 2: Non-modal color and image-slice selection

**Files:**
- Modify: `index.html`
- Modify: `src/main.ts`
- Modify: `src/style.css`
- Modify: `tests/ui-structure.test.ts`

**Interfaces:**
- Consumes unchanged: `drawImageSlicePicker()`, `tileSliceAt()`, and `updateSelectedImageReference()`.
- Produces: one reusable non-modal `#style-image-dialog` with an explicit `#style-image-close` control.
- Produces: native `<input type="color">` behavior that writes RGB through `writeColorControl()` while retaining the existing alpha value.

- [ ] **Step 1: Write failing non-modal structure tests**

Add assertions to `tests/ui-structure.test.ts`:

```ts
assert.doesNotMatch(main, /colorDialog\.showModal\(\)/)
assert.doesNotMatch(main, /styleImageDialog\.showModal\(\)/)
assert.match(main, /styleImageDialog\.show\(\)/)
assert.match(html, /id="style-image-close"[^>]*aria-label="关闭图片预览"/)
assert.match(main, /styleImageClose\.addEventListener\("click", \(\) => styleImageDialog\.close\(\)\)/)
assert.doesNotMatch(css, /\.style-image-dialog::backdrop\s*\{[^}]*background:/s)
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/ui-structure.test.ts`

Expected: FAIL because both selector paths currently call `showModal()` and the slice selector lacks a close control.

- [ ] **Step 3: Implement native color selection**

Remove the color-picker click interception and `colorDialog.showModal()` path. Keep the existing `input` listener and hidden alpha control so browser-native selection calls `writeColorControl(picker, alpha)` and preserves the `AA` prefix. Remove the now-unused custom color-dialog bindings and markup only when no remaining call site needs them.

- [ ] **Step 4: Implement the non-modal slice selector**

Add the close button to the existing style-image dialog header. Replace each `styleImageDialog.showModal()` with:

```ts
if (!styleImageDialog.open) styleImageDialog.show()
```

Position it as a compact fixed panel adjacent to the inspector, remove its active backdrop styling, and keep all current picker rendering/hit-testing/write-back functions unchanged.

- [ ] **Step 5: Verify Task 2 GREEN**

Run: `node --test tests/ui-structure.test.ts tests/tiles.test.ts`

Expected: all focused tests pass with no warnings.

- [ ] **Step 6: Commit Task 2**

```bash
git add index.html src/main.ts src/style.css tests/ui-structure.test.ts
git commit -m "fix: keep image and color pickers non-modal"
```

### Task 3: Preserve candidate geometry across formats and window sizes

**Files:**
- Modify: `src/main.ts`
- Modify: `src/style.css`
- Modify: `tests/ui-structure.test.ts`
- Modify: `tests/devices.test.ts` only if shared geometry behavior needs an additional numeric assertion.

**Interfaces:**
- Produces: `applyDeviceKeyboardGeometry(panelWidth: number, panelHeight: number, candidateHeight: number, composing: boolean): void`.
- Produces: CSS custom properties `--toolbar-width` and `--toolbar-height` from the resolved candidate configuration.

- [ ] **Step 1: Write failing candidate-geometry structure tests**

Replace the obsolete fixed-row assertions in `tests/ui-structure.test.ts` with assertions requiring:

```ts
assert.match(main, /function applyDeviceKeyboardGeometry\(/)
assert.match(main, /toolbarCanvas\.style\.setProperty\("--toolbar-width", String\(width\)\)/)
assert.match(main, /toolbarCanvas\.style\.setProperty\("--toolbar-height", String\(height\)\)/)
assert.match(css, /\.device-shell\.canvas-only #toolbar-preview\s*\{[^}]*aspect-ratio:\s*var\(--toolbar-width\)\s*\/\s*var\(--toolbar-height\)[^}]*height:\s*auto/s)
assert.doesNotMatch(css, /\.device-shell\.canvas-only #candidate-area\s*\{[^}]*grid-template-rows:\s*40px 93px/s)
```

Also require both legacy and BDA refresh branches to call `applyDeviceKeyboardGeometry(...)`, and require the no-device path to remove every entry in `deviceGeometryProperties`.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/ui-structure.test.ts tests/devices.test.ts`

Expected: FAIL because toolbar display height is fixed and the BDA branch does not apply device geometry.

- [ ] **Step 3: Implement proportional toolbar rendering**

In `refreshToolbarPreview()`, assign the resolved logical width and height to the toolbar canvas CSS properties. In canvas-only mode, render the toolbar canvas at `width: 100%`, `height: auto`, and its configured `aspect-ratio`. Let the candidate row size from its content instead of forcing `40px 93px`; preserve the composing layout separately.

- [ ] **Step 4: Share and clear device keyboard geometry**

Extract the existing `keyboardPreviewGeometry()` call and CSS-variable writes into `applyDeviceKeyboardGeometry()`. Call it from both the legacy and BDA preview branches with the resolved panel and candidate sizes. When no physical device is selected or geometry cannot be computed, remove all `deviceGeometryProperties` so archive-to-archive state cannot leak.

- [ ] **Step 5: Fix the real workspace breakpoint**

Change the two-column breakpoint from `1000px` to at least the declared three-column minimum (`1060px`) so the `220px + 500px + 340px` tracks cannot overlap before the inspector hides.

- [ ] **Step 6: Verify Task 3 GREEN**

Run: `node --test tests/ui-structure.test.ts tests/devices.test.ts tests/preview.test.ts`

Expected: all focused tests pass with no warnings.

- [ ] **Step 7: Run complete verification**

Run: `npm test`

Expected: all tests pass, zero failures.

Run: `npm run build`

Expected: TypeScript/Vite production build exits 0 without errors.

- [ ] **Step 8: Commit Task 3**

```bash
git add src/main.ts src/style.css tests/ui-structure.test.ts tests/devices.test.ts
git commit -m "fix: preserve candidate preview geometry"
```
