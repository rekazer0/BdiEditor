# Compatibility, Device Preview, and Editing Interaction Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修复百度输入法导入兼容性、组件预览、编辑/交互模式与窗口关闭问题，并加入手机模板、横竖屏联动、模拟输入和 Command 多选。

**Architecture:** 保持现有 Tauri 2 + 原生 HTML/CSS/TypeScript 架构，不增加运行时依赖。归档层负责兼容地保留 ZIP 元数据，预览层统一渲染带 `VIEW_RECT` 的配置组件，应用层只编排设备外框、模式、选区与模拟输入。

**Tech Stack:** Tauri 2, TypeScript, Vite, Canvas 2D, Rust, fflate, Node test runner

---

### Task 1: Reproduce and diagnose archive compatibility

**Files:**
- Create: `scripts/inspect-archive.ts`
- Modify: `src/skin.test.ts`
- Inspect: `src/skin.ts`

1. Add a failing round-trip test that records original and exported ZIP header metadata.
2. Compare archive order, compression method, extraction version, flags, timestamps, extras and comments for both real samples.
3. Identify the smallest metadata difference correlated with Baidu rejecting the archive.
4. Run `npm test -- src/skin.test.ts` and retain the failing evidence before changing the writer.

### Task 2: Make exported BDI/BDS archives compatible

**Files:**
- Modify: `src/skin.ts`
- Modify: `src/skin.test.ts`
- Modify: `scripts/verify-samples.ts`

1. Preserve the original container bytes when no entry changed.
2. Implement the smallest compatible writer behavior required by the diagnosis.
3. Verify edited entries change while all untouched entries remain byte-identical after reopen.
4. Verify both supplied samples with `npm run verify:samples`.

### Task 3: Render candidate, symbol, toolbar, and other configured panels

**Files:**
- Modify: `src/preview.ts`
- Modify: `src/main.ts`
- Modify: `src/preview.test.ts`
- Modify: `index.html`
- Modify: `src/style.css`

1. Add a failing test for discovering any section with a valid `VIEW_RECT`, not only `KEY<n>`.
2. Generalize canvas items to configured component sections with sensible label fallbacks.
3. Make semantic navigation switch the canvas document to the selected component.
4. Show a clear empty explanation only when a component truly has no renderable rectangles.
5. Verify keyboard, candidate, symbols and toolbar component navigation.

### Task 4: Fix modes, multi-selection, and native close

**Files:**
- Modify: `src/preview.ts`
- Modify: `src/main.ts`
- Modify: `src/preview.test.ts`
- Modify: `index.html`

1. Add tests for Command/Ctrl additive selection and preview gesture event generation.
2. Make edit mode drag/resize and preview mode press/swipe visibly distinct.
3. Accept Command on macOS and Ctrl on Windows for multi-selection while retaining Shift.
4. Prevent native close synchronously, ask with the native dialog only when dirty, then destroy the window after confirmation.

### Task 5: Add phone templates and simulated input

**Files:**
- Modify: `index.html`
- Modify: `src/style.css`
- Modify: `src/main.ts`
- Modify: `src/preview.ts`
- Modify: `src/main.test.ts`

1. Add iPhone 17 Pro and Xiaomi 17 Pro screen templates as CSS data presets.
2. Place the canvas at the bottom of a device screen with a compact simulated input and candidate area.
3. Rotate the complete device shell when portrait/landscape changes.
4. Convert preview events into safe simulated text for literal characters, space and newline; log unsupported Fxx/Sxx actions without executing them.
5. Add clear/reset controls and verify switching devices preserves skin state.

### Task 6: Complete regression and package verification

**Files:**
- Modify: `README.md`
- Modify: `docs/release-checklist.md`
- Modify: `release/SHA256SUMS.txt`

1. Run `npm test`, `npx tsc --noEmit`, `npm run build`, `cargo check`, and both real-sample round trips.
2. Build and launch the Tauri debug app; test open, edit, Command multi-select, interaction preview, component panels, orientation, device templates, save and close.
3. Capture a final screenshot.
4. Rebuild the release app and DMG, validate signing and archive contents, and refresh checksums.
