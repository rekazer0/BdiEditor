# BDA Native Editing and Conversion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve native BDA editing/export, expose only BDA-owned configuration, parse BDA-only animation data, and allow lossy BDS/BDI export.

**Architecture:** Keep the opened BDA archive as the only persistent project state. For BDS/BDI export, build a temporary canonical archive from `public/bda-base.bds`, overlay decoded BDA appearance/resources, then reuse `SkinArchive.toBytes`; BDA-only animation remains in the original archive and degrades to its first frame in converted output.

**Tech Stack:** TypeScript, existing protobuf wire helpers, `fflate`, `IniDocument`, Node test runner, Vite/Tauri.

## Global Constraints

- Add no dependency.
- Do not expose base-layout files unless the BDA appearance config contains the corresponding panel.
- Preserve unknown protobuf fields and the original BDA ZIP records on BDA save.
- BDS/BDI conversion is lossy and must not clear the original BDA dirty state.
- Update version `0.4.7` only after all tests and the production build pass; this bugfix/compatibility change increments the third number to `0.4.8`.

---

### Task 1: Parse BDA-owned animation and configuration presence

**Files:**
- Modify: `src/bda.ts`
- Modify: `tests/bda.test.ts`

**Interfaces:**
- Consumes: existing `ProtoField`, `fields()`, `rawFields()`, `bdaAppearancePath()`.
- Produces: `BdaAnimationFrame`, `BdaAnimationSequence`, `decodeBdaAnimation(bytes)`, `updateBdaAnimationFrame(bytes, sequenceName, frameIndex, property, value)`, `bdaConfigPath(archive, theme, orientation, kind)`, and richer `describeBdaConfig()` output.

- [ ] **Step 1: Write failing animation/config tests**

Add a compact protobuf fixture using the existing `scalar`, `message`, and `string` test helpers:

```ts
const animation = concat(
  message(1, concat(string(1, "MAIN_KEY"), message(2, string(3, "image_1")))),
  message(9, concat(
    string(1, "image_1"),
    message(2, message(5, concat(string(2, "frame_0"), scalar(2, 16)))),
  )),
)

test("decodes BDA animation targets and frame resources", () => {
  const decoded = decodeBdaAnimation(animation)
  assert.deepEqual(decoded.targets, ["MAIN_KEY"])
  assert.deepEqual(decoded.sequences.get("image_1")?.frames, [
    { resourceID: "frame_0", duration: 16 },
  ])
})
```

Also assert `bdaConfigPath()` returns only a real `animationConfig` entry and `describeBdaConfig()` reports its target/sequence/frame counts.

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `node --test tests/bda.test.ts`

Expected: FAIL because the animation exports do not exist.

- [ ] **Step 3: Add the smallest schema-specific decoder**

Decode only the stable fields present in the supplied BDA and keep raw update logic unchanged:

```ts
export type BdaAnimationFrame = { resourceID: string; duration: number }
export type BdaAnimationSequence = { name: string; frames: BdaAnimationFrame[] }
export type BdaAnimation = {
  targets: string[]
  sequences: Map<string, BdaAnimationSequence>
}

export function bdaConfigPath(
  archive: SkinArchive,
  theme: string,
  orientation: string,
  kind: "appearance" | "animation" | "lightAnimation" | "sound" | "switch",
): string | undefined

export function decodeBdaAnimation(bytes: Uint8Array): BdaAnimation

export function updateBdaAnimationFrame(
  bytes: Uint8Array,
  sequenceName: string,
  frameIndex: number,
  property: "resourceID" | "duration",
  value: string | number,
): Uint8Array
```

Use existing protobuf field traversal rather than generated schema code. Treat missing/reordered optional fields as empty values and throw only for invalid wire data.

`updateBdaAnimationFrame()` must replace only the selected nested wire field. Extend the test to change one frame resource/duration and assert an unrelated unknown field remains byte-present.

- [ ] **Step 4: Extend BDA config summaries**

Make `describeBdaConfig()` dispatch by the actual filename:

```ts
if (/^\d*animationConfig$/.test(name)) {
  const animation = decodeBdaAnimation(bytes)
  const frameCount = [...animation.sequences.values()]
    .reduce((sum, sequence) => sum + sequence.frames.length, 0)
  return [header, "", `动画目标：${animation.targets.length}`,
    `动画序列：${animation.sequences.size}`, `序列帧：${frameCount}`].join("\n")
}
```

For sound/switch configs, report decoded top-level scalar/string values without presenting binary source as editable JSON.

- [ ] **Step 5: Run focused tests**

Run: `node --test tests/bda.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit parser work**

```bash
git add src/bda.ts tests/bda.test.ts
git commit -m "feat: parse BDA animation configuration"
```

### Task 2: Build a temporary BDS/BDI-compatible archive

**Files:**
- Create: `src/bda-convert.ts`
- Create: `tests/bda-convert.test.ts`
- Modify: `src/skin.ts`

**Interfaces:**
- Consumes: `SkinArchive`, `decodeBdaAppearance()`, `decodeBdaAnimation()`, `bdaLayoutDocument()`, `bdaStyleID()`, `IniDocument`.
- Produces: `convertBdaArchive(source: SkinArchive, base: SkinArchive): { archive: SkinArchive; warnings: string[] }`.
- Produces: `SkinArchive.clone(): SkinArchive` as a byte-preserving public clone helper.

- [ ] **Step 1: Write a failing conversion test**

Create a minimal BDA ZIP with `Info.txt`, one appearance config, one PNG resource and one animation config. Use a minimal base BDS ZIP with `light/skin/port/py_9.ini` and assert:

```ts
const result = convertBdaArchive(source, base)
const bds = unzipSync(result.archive.toBytes("bds"))
const bdi = unzipSync(result.archive.toBytes("bdi"))

assert.ok(bds["light/port/py_9.ini"])
assert.ok(bds["light/res/default.css"])
assert.ok(bdi["skin/light/skin/port/py_9.ini"])
assert.match(strFromU8(bds["light/res/default.css"]), /STYLE1000007/)
assert.ok(result.warnings.some((warning) => /序列帧/.test(warning)))
```

Reopen both outputs with `SkinArchive.open()` to prove they remain importable.

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `node --test tests/bda-convert.test.ts`

Expected: FAIL because `convertBdaArchive` does not exist.

- [ ] **Step 3: Add a public clone helper and temporary converter**

Add only:

```ts
clone(): SkinArchive {
  return SkinArchive.open(this.toBytes(this.format))
}
```

Implement `convertBdaArchive()` by cloning the base, copying only source themes/orientations that have an appearance config, and applying `bdaLayoutDocument()` to panel names present in that appearance. Do not add a general conversion abstraction.

- [ ] **Step 4: Materialize BDA styles with existing BDS primitives**

Generate `${theme}/skin/res/default.css` directly from decoded styles:

```ini
[STYLE1000007]
NM_IMG=key/normal,1
HL_IMG=key/pressed,1

[STYLE2000008]
NM_COLOR=FF112233
HL_COLOR=FF445566

[STYLE3000009]
FONT_NAME=Roboto
FONT_SIZE=60
NM_COLOR=FFFFFFFF
HL_COLOR=FFFFFFFF
```

For every referenced PNG, copy it under the same canonical resource root and create a one-image `.til`. Read width/height from the PNG IHDR with `DataView`; write:

```ini
[GLOBAL]
IMG_NUM=1

[IMG1]
SOURCE_RECT=0,0,<width>,<height>
```

Use `innerRect` for `INNER_RECT` when present. This avoids atlas generation and image dependencies while remaining compatible with the existing BDS resolver.

- [ ] **Step 5: Apply deterministic animation degradation**

Resolve each BDA animation sequence's first frame. When it corresponds to a style state, use that resource as the BDS normal/pressed image. Keep no animation protobuf in the converted archive and append one warning summarizing the number of dropped sequences.

- [ ] **Step 6: Preserve metadata and validate failure safety**

Copy actual BDA `Info.txt`/`demo.png` when present. Throw before returning if the base lacks a required layout or a referenced PNG is malformed; the source archive remains untouched because conversion mutates only the clone.

- [ ] **Step 7: Run conversion and archive tests**

Run: `node --test tests/bda-convert.test.ts tests/skin.test.ts`

Expected: PASS, including original BDA byte-preserving export.

- [ ] **Step 8: Commit conversion work**

```bash
git add src/bda-convert.ts src/skin.ts tests/bda-convert.test.ts
git commit -m "feat: convert BDA skins to BDS and BDI"
```

### Task 3: Filter BDA UI to owned configuration and connect all exports

**Files:**
- Modify: `src/main.ts`
- Modify: `index.html`
- Modify: `src/style.css`
- Modify: `tests/ui-structure.test.ts`

**Interfaces:**
- Consumes: `convertBdaArchive()`, `bdaLayoutNames()`, `bdaConfigPath()`, existing `saveNative()` and `downloadArchive()`.
- Produces: `exportArchive(format): { bytes: Uint8Array; converted: boolean; warnings: string[] }`, used by both save paths.

- [ ] **Step 1: Write failing UI/export structure tests**

Assert that BDA export buttons are no longer disabled by format and that both native/browser export paths call the shared conversion helper. Assert `renderFiles()` derives BDA layout entries from `bdaLayoutNames(appearanceBytes)` instead of every file in `bdaBase.names()`. Assert the inspector contains one `#bda-config-fields` container.

- [ ] **Step 2: Run the focused UI test and confirm failure**

Run: `node --test tests/ui-structure.test.ts`

Expected: FAIL on disabled-format and base-layout assertions.

- [ ] **Step 3: Show only configuration owned by the BDA**

In `renderFiles()`:

- Add layout entries only for names returned by the current `appearanceConfig`.
- Add animation, sound and switch entries only when `bdaConfigPath()` finds the real archive path.
- Add preview/info/resources only when their real paths exist.
- Keep `bdaBase` private to preview/geometry lookup; do not enumerate all of its layouts in the sidebar.

The source tree already enumerates only `archive.names()` and remains unchanged.

- [ ] **Step 4: Add the minimal BDA-only configuration editor**

Add one reusable inspector group instead of separate panels per protobuf type:

```html
<div class="inspector-group bda-config-fields" hidden>
  <h3>BDA 专属配置</h3>
  <div id="bda-config-fields" class="inspector-grid action-fields"></div>
</div>
```

When an actual `animationConfig` is selected, populate fields for target names and every decoded frame. Target names are read-only; frame resource IDs and durations are editable. On `change`, call `updateBdaAnimationFrame()`, commit with the existing byte undo/redo path, refresh the summary and preview, and preserve unknown fields. Sound/switch configs show their decoded values read-only until a stable writable field mapping is known; do not invent labels or mutation rules.

Use existing `.inspector-grid`, `label`, and `input` styles; add CSS only if the generated frame list needs wrapping.

- [ ] **Step 5: Enable BDS/BDI export for BDA without changing normal save**

Use one helper in both desktop and browser save paths:

```ts
function exportArchive(format: ExportFormat) {
  if (!archive) throw new Error("当前没有可保存的皮肤")
  if (archive.format !== "bda" || format === "bda") {
    return { bytes: archive.toBytes(format), converted: false, warnings: [] }
  }
  if (!bdaBase) throw new Error("无法加载 BDA 官方基础布局")
  const result = convertBdaArchive(archive, bdaBase)
  return { bytes: result.archive.toBytes(format), converted: true, warnings: result.warnings }
}
```

Show `window.confirm()` once when warnings exist. Canceling returns without writing a file. Never call `archive.markSaved(convertedBytes)` for BDS/BDI export; only native BDA save clears BDA dirty state.

- [ ] **Step 6: Run focused tests**

Run: `node --test tests/ui-structure.test.ts tests/bda-convert.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit UI/export work**

```bash
git add src/main.ts src/style.css index.html tests/ui-structure.test.ts
git commit -m "feat: expose BDA-owned settings and converted exports"
```

### Task 4: Verify, bump patch version, and build

**Files:**
- Modify via script: `package.json`, `package-lock.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock` as already handled by `scripts/bump-version.mjs`.

**Interfaces:**
- Consumes: completed Tasks 1–3.
- Produces: verified version `0.4.8` and production artifacts.

- [ ] **Step 1: Run all tests before changing the version**

Run: `npm test`

Expected: all tests PASS.

- [ ] **Step 2: Run production verification**

Run: `npm run build`

Expected: Vite production build succeeds with no TypeScript errors.

- [ ] **Step 3: Verify the supplied BDA sample**

Run the existing sample verifier and add the supplied BDA path if supported:

```bash
npm run verify:samples
```

Expected: BDA opens; native BDA, BDS and BDI output all reopen successfully; warnings mention animation degradation.

- [ ] **Step 4: Increment only the patch number**

Run: `npm run version:bugfix`

Expected: every application version changes from `0.4.7` to `0.4.8` and no second-number increment occurs.

- [ ] **Step 5: Re-run tests and build after the version change**

Run: `npm test && npm run build`

Expected: PASS.

- [ ] **Step 6: Commit the verified change**

```bash
git add src tests package.json package-lock.json src-tauri
git commit -m "release: add BDA native editing and converted exports"
```
