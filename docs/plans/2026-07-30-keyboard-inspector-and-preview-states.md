# Keyboard Inspector and Preview States Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the device preview match the supplied iPhone references and expose real skin, keyboard, batch-image, height, scrolling, and swipe-page configuration in the inspector.

**Architecture:** Keep the existing dependency-free TypeScript UI and map every editor control to the existing INI/style files. Add small pure helpers for keyboard metadata and preview page targets, then let `main.ts` coordinate archive writes and `Preview` render the resolved panel background and page state.

**Tech Stack:** Tauri 2, TypeScript, HTML/CSS, Canvas 2D, Node test runner.

---

### Task 1: Parse and edit sectionless skin metadata

**Files:**
- Modify: `src/ini.ts`
- Modify: `tests/ini.test.ts`
- Modify: `index.html`
- Modify: `src/main.ts`

**Step 1: Write the failing test**

Add a test which parses `Name=...` before any section, updates existing metadata, and inserts a missing `Version` field without adding a fake section header.

**Step 2: Run test to verify it fails**

Run: `npm test -- --test-name-pattern="sectionless"`
Expected: FAIL because `IniDocument.set("", ...)` cannot insert a missing field.

**Step 3: Write minimal implementation**

Teach `IniDocument.set` to insert sectionless entries before the first section. Add inspector fields for name, description, author(s), version/platform, and bind them to the selected overview document.

**Step 4: Run test to verify it passes**

Run: `npm test -- --test-name-pattern="sectionless"`
Expected: PASS.

### Task 2: Model global keyboard configuration

**Files:**
- Create: `src/keyboard.ts`
- Create: `tests/keyboard.test.ts`
- Modify: `src/main.ts`
- Modify: `index.html`

**Step 1: Write the failing test**

Cover reading and updating `[PANEL] SIZE`, `BACK_STYLE`, and style image/color fields in `gen.ini` plus `default.css`.

**Step 2: Run test to verify it fails**

Run: `npm test -- --test-name-pattern="keyboard config"`
Expected: FAIL because the helper does not exist.

**Step 3: Write minimal implementation**

Implement pure helpers that preserve panel width while changing height, resolve `STYLE<n>`, and update normal/pressed image and color values. Show these controls whenever a 9-key or 26-key layout is selected.

**Step 4: Run test to verify it passes**

Run: `npm test -- --test-name-pattern="keyboard config"`
Expected: PASS.

### Task 3: Render the keyboard panel background

**Files:**
- Modify: `src/preview.ts`
- Modify: `src/main.ts`
- Modify: `tests/preview.test.ts`

**Step 1: Write the failing test**

Add a pure assertion that the configured panel style is resolved from `[PANEL] BACK_STYLE`.

**Step 2: Run test to verify it fails**

Run: `npm test -- --test-name-pattern="panel background"`
Expected: FAIL.

**Step 3: Write minimal implementation**

Pass the selected panel style to `Preview` and draw its resolved image/color over the full canvas before drawing keys.

**Step 4: Run test to verify it passes**

Run: `npm test -- --test-name-pattern="panel background"`
Expected: PASS.

### Task 4: Batch-edit selected key images

**Files:**
- Modify: `index.html`
- Modify: `src/main.ts`
- Modify: `src/style.css`
- Modify: `tests/keyboard.test.ts`

**Step 1: Write the failing test**

Cover collecting unique `BACK_STYLE` sections from multiple selected keys and updating each style's `NM_IMG`/`HL_IMG`.

**Step 2: Run test to verify it fails**

Run: `npm test -- --test-name-pattern="batch key images"`
Expected: FAIL.

**Step 3: Write minimal implementation**

Add normal/pressed key-image controls, mixed-value display, and one undoable update that changes every selected background style section.

**Step 4: Run test to verify it passes**

Run: `npm test -- --test-name-pattern="batch key images"`
Expected: PASS.

### Task 5: Match the supplied phone preview and restore inspector scrolling

**Files:**
- Modify: `index.html`
- Modify: `src/style.css`

**Step 1: Apply the minimal structural change**

Add a status/editor area, the reference toolbar above the keyboard, and globe/microphone accessory row. Keep the keyboard full-width and bottom-aligned in both orientations.

**Step 2: Fix the scroll containment**

Set `min-height: 0` and explicit overflow containment on the inspector grid and scrolling child.

**Step 3: Verify without controlling the desktop**

Run: `npm run build`
Expected: TypeScript and Vite build succeed.

### Task 6: Preview explicit swipe page transitions

**Files:**
- Create: `src/actions.ts`
- Create: `tests/actions.test.ts`
- Modify: `src/main.ts`
- Modify: `src/preview.ts`

**Step 1: Write the failing test**

Cover explicit named-layout actions such as `Z+num2` and only documented page actions found in the sample; unknown `Fxx` must remain an event log instead of executing internal behavior.

**Step 2: Run test to verify it fails**

Run: `npm test -- --test-name-pattern="preview page"`
Expected: FAIL.

**Step 3: Write minimal implementation**

Resolve an action to an archive layout path, select that preview document after a swipe, and show the resulting page in the status area. Preserve logging for unsupported internal actions.

**Step 4: Run test to verify it passes**

Run: `npm test -- --test-name-pattern="preview page"`
Expected: PASS.

### Task 7: Automated regression and release build

**Files:**
- Modify: `README.md`
- Modify: `docs/release-notes-0.1.md`

**Step 1: Run all automated checks**

Run: `npm test && npm run build && cargo check --manifest-path src-tauri/Cargo.toml`
Expected: all tests pass, frontend builds, Rust checks cleanly.

**Step 2: Verify archive compatibility**

Run the existing sample round-trip tests against both provided `.bdi` and `.bds` fixtures.
Expected: exported archives retain entries and compatibility metadata.

**Step 3: Build release artifacts**

Run: `npm run tauri build`
Expected: a new macOS app and DMG under `src-tauri/target/release/bundle`.

**Step 4: Report artifacts**

Record the exact latest paths and SHA-256. Do not upload to GitHub until the user requests the final sync.
