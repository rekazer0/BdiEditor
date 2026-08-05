# 预览工作区与设备显示修复实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复组件预览缩放模糊、设备底部附件、默认画布、顶部工具栏、新建项目、图片资源预览和 Info 检查器。

**Architecture:** 保留现有 DOM + Canvas 渲染架构。把“组件面板覆盖通用面板”的规则放进现有键盘配置模块，把对象 URL 生命周期放进一个小型图片预览模块；`main.ts` 只负责把这些结果同步到设备壳、中央工作区和检查器。

**Tech Stack:** TypeScript 5.9、Vite 7、Tauri 2、Canvas 2D、Node 内置测试运行器、现有 `fflate`。

## Global Constraints

- 不新增运行时依赖。
- 当前布局或组件中有效的 `[PANEL] SIZE` 和 `BACK_STYLE` 分别优先于 `gen.ini`；缺失或无效属性逐项回退。
- 同一最终面板尺寸必须同时用于 Canvas 和设备几何。
- 地球和麦克风只在 iPhone 竖屏预览中显示；Android、横屏和画布模式不显示且不保留附件高度。
- 设备默认值和显示文字均为“画布”。
- 完整删除预览缩放，不影响按键尺寸编辑。
- 当前只提供真实存在的 `public/default-template.bdi`，不生成第二个模板。
- 图片预览只支持归档内 PNG，不开放本地文件协议或 SVG。
- 删除共同作者输入框，但保留归档中的 `Authors=` 元数据。
- 必须保留工作区开始时已有的“新建项目”未提交实现，并在测试覆盖后纳入成果。

---

### Task 1: 修复组件面板尺寸与设备几何

**Files:**
- Modify: `src/keyboard.ts`
- Modify: `src/devices.ts`
- Modify: `src/main.ts`
- Modify: `src/style.css`
- Modify: `tests/keyboard.test.ts`
- Modify: `tests/devices.test.ts`
- Modify: `tests/ui-structure.test.ts`

**Interfaces:**
- Produces: `resolvePanelConfig(layout: IniDocument, gen: IniDocument, styles: IniDocument): KeyboardConfig`
- Keeps: `keyboardConfig(gen, styles): KeyboardConfig` for general inspector reads.
- Produces: `showsKeyboardAccessories(device: DeviceSpec | undefined, orientation: "port" | "land"): boolean`
- Changes: `refreshPreview()` uses one resolved panel config for `Preview.setPanel()` and `keyboardPreviewGeometry()`.

- [ ] **Step 1: Write failing component-panel tests**

Add to `tests/keyboard.test.ts`:

```ts
test("component panel size and style override the general keyboard panel", () => {
  const layout = IniDocument.parse("[PANEL]\nSIZE=1125,728\nBACK_STYLE=1104\n")
  const gen = IniDocument.parse("[PANEL]\nSIZE=1125,595\nBACK_STYLE=1103\n")
  const styles = IniDocument.parse("[STYLE1104]\nNM_IMG=symbol,1\n")
  assert.deepEqual(resolvePanelConfig(layout, gen, styles), {
    width: 1125,
    height: 728,
    styleID: "1104",
    normalImage: "symbol,1",
    pressedImage: "",
    normalColor: "",
    pressedColor: "",
  })
})

test("invalid component panel properties fall back independently", () => {
  const layout = IniDocument.parse("[PANEL]\nSIZE=bad,0\n")
  const gen = IniDocument.parse("[PANEL]\nSIZE=1125,595\nBACK_STYLE=1103\n")
  const styles = IniDocument.parse("[STYLE1103]\nNM_COLOR=80112233\n")
  const result = resolvePanelConfig(layout, gen, styles)
  assert.equal(result.width, 1125)
  assert.equal(result.height, 595)
  assert.equal(result.styleID, "1103")
})
```

- [ ] **Step 2: Run `node --test tests/keyboard.test.ts` and verify `resolvePanelConfig` is missing**

- [ ] **Step 3: Implement independent component overrides**

Use a positive finite size parser and resolve visual fields from the final style ID. Do not mutate either input document.

- [ ] **Step 4: Write failing device-accessory tests**

Add literal assertions to `tests/devices.test.ts` proving only `iphone + port` returns true and proving Android and landscape geometries have `safeBottomHeight === 0`.

- [ ] **Step 5: Run `node --test tests/devices.test.ts` and verify the accessory helper is missing**

- [ ] **Step 6: Implement geometry synchronization**

In `main.ts`, resolve the panel from `layoutDocument`, `gen`, and styles. Recompute all five CSS variables for every known device and both orientations. For canvas, remove device-specific variables. Set a `data-accessories="visible|hidden"` state and hide the third Grid row when hidden.

- [ ] **Step 7: Add a structural integration assertion**

Update `tests/ui-structure.test.ts` to require `resolvePanelConfig(layoutDocument, context.gen, context.styles)`, the actual `orientation.value` passed to geometry, and a CSS rule that hides `.keyboard-accessories` for the hidden state.

- [ ] **Step 8: Run focused tests and type-check**

Run: `node --test tests/keyboard.test.ts tests/devices.test.ts tests/ui-structure.test.ts && npx tsc --noEmit`

Expected: all focused tests pass and TypeScript exits 0.

- [ ] **Step 9: Commit**

```bash
git add src/keyboard.ts src/devices.ts src/main.ts src/style.css tests/keyboard.test.ts tests/devices.test.ts tests/ui-structure.test.ts
git commit -m "fix: preserve component preview geometry"
```

---

### Task 2: 整理应用壳、新建项目和 Info 表单

**Files:**
- Modify: `index.html`
- Modify: `src/main.ts`
- Modify: `src/operations.ts`
- Modify: `src/style.css`
- Modify: `src-tauri/src/lib.rs`
- Delete: `src/zoom.ts`
- Delete: `tests/zoom.test.ts`
- Modify: `tests/operations.test.ts`
- Modify: `tests/ui-structure.test.ts`
- Modify: `tests/ini.test.ts`

**Interfaces:**
- Keeps: `loadBuiltInProjectTemplate(id, fetcher): Promise<Uint8Array>`.
- Removes: all preview zoom state, controls, CSS and the `minus` SF Symbol allowlist entry.
- Changes: initial device is `canvas`; the titlebar uses 12px left padding.

- [ ] **Step 1: Change UI tests to express the requested shell**

Update `tests/ui-structure.test.ts` so the preview toolbar test requires:

```ts
assert.match(html, /<option value="canvas" selected>画布<\/option>/)
assert.doesNotMatch(html, /id="zoom-(?:out|in)"|id="zoom-value"/)
assert.doesNotMatch(main, /applyZoom|stepZoom|clampZoom|--preview-zoom/)
assert.doesNotMatch(css, /zoom:\s*var\(--preview-zoom\)/)
assert.doesNotMatch(html, /data-skin-field="Authors"/)
```

Also assert the initial device shell has `data-device="canvas"` and `canvas-only`, and `.titlebar` uses `padding: 6px 12px`.

- [ ] **Step 2: Run `node --test tests/ui-structure.test.ts` and verify failures describe the current iPhone default, zoom controls, 76px padding and Authors field**

- [ ] **Step 3: Add template failure coverage**

In `tests/operations.test.ts`, call `loadBuiltInProjectTemplate("default-ios", fetcher)` with `{ ok: false }` and assert rejection with `无法加载内置默认皮肤模板`. Keep the existing path and unknown-ID assertions.

- [ ] **Step 4: Add metadata preservation coverage**

In `tests/ini.test.ts`, parse an Info document containing `Author=` and `Authors=`, edit `Author`, and assert `Authors=` remains byte-for-byte in the serialized document.

- [ ] **Step 5: Run the three focused tests and verify the new assertions fail only for missing behavior**

Run: `node --test tests/ui-structure.test.ts tests/operations.test.ts tests/ini.test.ts`

- [ ] **Step 6: Apply the minimal shell changes**

Set the selected device option to `<option value="canvas" selected>画布</option>`, initialize the shell as `canvas-only`, remove zoom DOM/runtime/CSS/files, change titlebar padding to `6px 12px`, and delete only the Authors label.

Preserve the existing new-project dialog. It remains a radio chooser backed by `loadBuiltInProjectTemplate`; cancellation returns without unsaved confirmation or document replacement. Do not add fake template assets.

- [ ] **Step 7: Remove dead native symbol configuration**

Remove only `minus` from the Rust SF Symbol allowlist and its Rust unit-test list; keep `plus` because new project still uses it.

- [ ] **Step 8: Run focused tests, TypeScript and Rust tests**

Run: `node --test tests/ui-structure.test.ts tests/operations.test.ts tests/ini.test.ts && npx tsc --noEmit && cargo test --manifest-path src-tauri/Cargo.toml`

Expected: all commands exit 0.

- [ ] **Step 9: Commit**

```bash
git add index.html src/main.ts src/operations.ts src/style.css src-tauri/src/lib.rs tests/operations.test.ts tests/ui-structure.test.ts tests/ini.test.ts
git add -u src/zoom.ts tests/zoom.test.ts
git commit -m "fix: simplify preview workspace controls"
```

---

### Task 3: Add central and inspector PNG previews

**Files:**
- Create: `src/image-preview.ts`
- Create: `tests/image-preview.test.ts`
- Modify: `index.html`
- Modify: `src/main.ts`
- Modify: `src/style.css`
- Modify: `tests/ui-structure.test.ts`

**Interfaces:**
- Produces: `replaceImagePreviewURL(previous: string, bytes: Uint8Array, createURL?, revokeURL?): string`
- Produces: `releaseImagePreviewURL(current: string, revokeURL?): ""`
- Changes: both `#workspace-image` and `#asset-image` use the same current Blob URL.

- [ ] **Step 1: Write failing object-URL lifecycle tests**

Create `tests/image-preview.test.ts`:

```ts
test("replaces and revokes the previous PNG preview URL", () => {
  const revoked: string[] = []
  const created: Blob[] = []
  const next = replaceImagePreviewURL(
    "blob:old",
    Uint8Array.from([137, 80, 78, 71]),
    (blob) => { created.push(blob); return "blob:new" },
    (url) => revoked.push(url),
  )
  assert.equal(next, "blob:new")
  assert.deepEqual(revoked, ["blob:old"])
  assert.equal(created[0].type, "image/png")
})

test("releases the active preview URL", () => {
  const revoked: string[] = []
  assert.equal(releaseImagePreviewURL("blob:active", (url) => revoked.push(url)), "")
  assert.deepEqual(revoked, ["blob:active"])
})
```

- [ ] **Step 2: Run `node --test tests/image-preview.test.ts` and verify the module is missing**

- [ ] **Step 3: Implement the minimal URL lifecycle module**

Revoke a non-empty previous URL before creating the new PNG Blob URL. Releasing an empty URL is a no-op.

- [ ] **Step 4: Add failing workspace structure assertions**

In `tests/ui-structure.test.ts`, require a hidden central figure with `#workspace-image`, a visible error state, CSS `object-fit: contain`, and `main.ts` assignments that set both image elements to the same `assetURL`. Require image selection to activate Properties and disable Source.

- [ ] **Step 5: Run focused tests and verify the DOM integration assertions fail**

- [ ] **Step 6: Integrate the image workspace**

Add the central image figure as a sibling of `#device-shell`. When selecting a PNG, set `inspectorTab = "properties"`, update the shared URL, hide the device shell and show both previews. When selecting text, hide the central image figure and restore the device shell without clearing `layoutDocument`.

On image `load`, clear the error state. On image `error`, hide the failed image and show `无法预览此 PNG`. Loading a new archive releases the old URL. Replacing an image refreshes both preview elements and the full skin preview.

- [ ] **Step 7: Style central and inspector images without pixelated scaling**

Use stable maximum dimensions and `object-fit: contain`. Remove `image-rendering: pixelated` from the right inspector because arbitrary source dimensions should not be forced into nearest-neighbor scaling.

- [ ] **Step 8: Run focused tests and type-check**

Run: `node --test tests/image-preview.test.ts tests/ui-structure.test.ts tests/skin.test.ts && npx tsc --noEmit`

Expected: all commands exit 0.

- [ ] **Step 9: Commit**

```bash
git add src/image-preview.ts tests/image-preview.test.ts index.html src/main.ts src/style.css tests/ui-structure.test.ts
git commit -m "feat: preview source images in the workspace"
```

---

### Task 4: 完整验证与视觉验收

**Files:**
- Modify only if verification exposes an in-scope regression.

**Interfaces:**
- Verifies the complete approved design without adding new behavior.

- [ ] **Step 1: Run all automated checks**

```bash
npm test
npx tsc --noEmit
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
```

Expected: every command exits 0 with no failed tests or compile errors.

- [ ] **Step 2: Start the Vite development server**

Run `npm run dev -- --host 127.0.0.1` on an available port and keep the session active for browser verification.

- [ ] **Step 3: Verify desktop screenshots**

Open the app at a 2000x1250 desktop viewport. Verify the initial empty state uses “画布”, controls do not overlap, zoom is absent, and file buttons are left aligned.

Load `public/default-template.bdi` through the file input. Capture and inspect:

- 画布模式的 9 键页面；
- iPhone 17 Pro 竖屏，地球和麦克风可见；
- Xiaomi 17 竖屏，地球和麦克风不可见；
- 符号面板，面板高度使用 728 且底栏不被压缩；
- 源文件 PNG，中央和右侧同时显示同一图片。

- [ ] **Step 4: Run fresh final checks after any visual fix**

Re-run the commands from Step 1 after the last code change.

- [ ] **Step 5: Commit only if verification required a fix**

Use a narrowly scoped `fix:` commit containing the regression test and minimal correction.
