# Source Highlight and Device Themes Implementation Plan

**Goal:** Add dependency-free INI syntax highlighting, verified phone-resolution templates, correct dark device preview, and a brighter macOS UI with restrained sidebar/toolbar blur.

**Architecture:** Keep the editable source as a native textarea and place a synchronized highlighted `<pre>` beneath it so editing and caret behavior remain stable. Store verified device pixels in a small pure data module, drive the device aspect ratio from that data, and use a preview theme attribute for all phone chrome colors.

**Tech Stack:** Tauri 2, TypeScript, HTML/CSS, Canvas 2D, Node test runner.

---

### Task 1: Dependency-free INI syntax highlighting

**Files:**
- Create: `src/highlight.ts`
- Create: `tests/highlight.test.ts`
- Modify: `index.html`
- Modify: `src/main.ts`
- Modify: `src/style.css`

**Steps:**
1. Write tests for sections, keys, comments, numbers and `Fxx/Sxx/Z+` action tokens.
2. Run `npm test` and confirm the missing module fails.
3. Implement escaped HTML token rendering.
4. Put a synchronized `<pre>` behind the source textarea and update it on every source assignment, input and scroll.
5. Run `npm test && npm run build`.

### Task 2: Verified device templates

**Files:**
- Create: `src/devices.ts`
- Create: `tests/devices.test.ts`
- Modify: `index.html`
- Modify: `src/main.ts`
- Modify: `src/style.css`

**Steps:**
1. Add tests for iPhone 17 Pro 1206×2622, iPhone 17 Pro Max 1320×2868, Xiaomi 17 1220×2656, Pixel 10 Pro 1280×2856 and Galaxy S25 Ultra 1440×3120.
2. Implement the fixed device catalog.
3. Drive portrait/landscape aspect ratios from the catalog rather than hardcoded CSS.
4. Run `npm test && npm run build`.

### Task 3: Dark device theme and simplified phone preview

**Files:**
- Modify: `index.html`
- Modify: `src/main.ts`
- Modify: `src/style.css`

**Steps:**
1. Trace theme selection into the device shell with `data-theme`.
2. Add dark colors for the screen, simulated editor, navigation, status, accessories and placeholder.
3. Remove the user-marked simulated-candidate and formatting-toolbar block.
4. Run `npm run build`.

### Task 4: Brighter macOS UI with selective material

**Files:**
- Modify: `src/style.css`

**Steps:**
1. Change the window, workspace, content and inspector palette to white/off-white.
2. Apply `backdrop-filter` only to the titlebar and left sidebar with translucent white backgrounds.
3. Keep controls and separators quiet and readable in light/dark system appearance.
4. Run `npm run build`.

### Task 5: Automated verification and app-only output

**Files:**
- Modify: `README.md`
- Modify: `docs/release-notes-0.1.md`

**Steps:**
1. Run all Node and Rust tests.
2. Verify both provided real skin samples.
3. Build only the macOS app bundle with `npm run tauri build -- --bundles app`.
4. Verify the app signature and report only the `.app` path.
