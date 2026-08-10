# S State Preview and Synchronization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with verification checkpoints.

**Goal:** Implement faithful S0-S99 preview states, TIP-based style overrides, and bidirectional synchronization between the state selector and preview keyboard actions while improving legacy LIST, candidate, and touch-area rendering.

**Architecture:** Keep `main.ts` as the single owner of the selected state. Add pure parsing and effective-item helpers to the existing `actions.ts`, `panel-tools.ts`, and `preview.ts` modules. The existing Canvas renderer, toolbar Canvas, DOM candidate simulation, BDA resolver, and device layout remain in place.

**Tech Stack:** TypeScript, Canvas 2D, native DOM, Node `node:test`, existing `IniDocument` and resolver APIs.

## Global Constraints

- Support only `S0` through `S99`; `S0` is the default state.
- `S4` and `S4_2` both select state 4; non-S actions do not change state.
- Do not add dependencies or replace the renderer with a scene graph or full-image compositor.
- Invalid third-party skin fields must fall back to current behavior without throwing.

### Task 1: Parse and Normalize State Actions

**Files:**
- Modify: `src/actions.ts`
- Test: `tests/actions.test.ts`

**Interfaces:**
- Produce `previewStateFromAction(code: string): number | undefined`, returning `0` for `S0`, `1..99` for valid actions, and `undefined` for non-state or invalid actions.

- [ ] **Step 1: Write the failing tests**

```ts
test("parses only supported S0-S99 preview state actions", async () => {
  const actions = await import("../src/actions.ts") as typeof import("../src/actions.ts") & {
    previewStateFromAction?: (code: string) => number | undefined
  }
  assert.equal(actions.previewStateFromAction?.("S0"), 0)
  assert.equal(actions.previewStateFromAction?.("S4"), 4)
  assert.equal(actions.previewStateFromAction?.("S4_2"), 4)
  assert.equal(actions.previewStateFromAction?.("S99_12"), 99)
  assert.equal(actions.previewStateFromAction?.("S100"), undefined)
  assert.equal(actions.previewStateFromAction?.("S4_extra"), undefined)
  assert.equal(actions.previewStateFromAction?.("F4"), undefined)
})
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `node --test tests/actions.test.ts`

Expected: FAIL because `previewStateFromAction` is not exported.

- [ ] **Step 3: Implement the minimal parser**

```ts
export function previewStateFromAction(code: string): number | undefined {
  const match = code.trim().match(/^S(\d{1,2})(?:_\d+)?$/)
  if (!match) return
  const state = Number(match[1])
  return state <= 99 ? state : undefined
}
```

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `node --test tests/actions.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/actions.ts tests/actions.test.ts
git commit -m "feat: parse preview S-state actions"
```

### Task 2: Resolve TIP Overrides and Touch Geometry

**Files:**
- Modify: `src/panel-tools.ts`
- Modify: `src/preview.ts`
- Test: `tests/panel-tools.test.ts`
- Test: `tests/preview.test.ts`

**Interfaces:**
- Produce `stateTipSection(value: string | undefined, state: number | undefined): number | undefined` in `panel-tools.ts`.
- Produce `effectivePreviewItem(document: IniDocument, item: PreviewItem, state?: number): PreviewItem` in `preview.ts`.
- Add optional `touchRect?: Rect` to `PreviewItem`; pointer hit testing uses it before `rect`.

- [ ] **Step 1: Write failing tests for TIP resolution and touch rectangles**

```ts
test("resolves a matching TIP section without changing absent properties", () => {
  const document = IniDocument.parse(
    "[KEY1]\nVIEW_RECT=0,0,100,100\nBACK_STYLE=211\nFORE_STYLE=81,180\nPOS_TYPE=2,3\nSTAT_STYLE=S4_2\n" +
    "[TIP2]\nBACK_STYLE=214\nFORE_STYLE=252\n",
  )
  const item = previewItems(document)[0]
  const effective = effectivePreviewItem(document, item, 4)
  assert.equal(effective.backStyle, "214")
  assert.deepEqual(effective.foreStyles, ["252"])
  assert.deepEqual(effective.positionTypes, ["2", "3"])
})

test("uses TOUCH_RECT for interaction and VIEW_RECT as fallback", () => {
  const document = IniDocument.parse(
    "[KEY1]\nVIEW_RECT=20,20,20,20\nTOUCH_RECT=0,0,100,100\n",
  )
  const item = previewItems(document)[0]
  assert.deepEqual(item.touchRect, { x: 0, y: 0, width: 100, height: 100 })
})
```

- [ ] **Step 2: Run focused tests and verify they fail**

Run: `node --test tests/panel-tools.test.ts tests/preview.test.ts`

Expected: FAIL because TIP overrides and `touchRect` are not implemented.

- [ ] **Step 3: Implement pure TIP and touch parsing**

Use the existing `stateStyleValue` parser, restrict state values to `1..99` for TIP lookup, read only present `TIPn` properties, and parse `TOUCH_RECT` with the existing rectangle validator. Update `Preview.hit()` to test `key.touchRect ?? key.rect`.

- [ ] **Step 4: Run focused tests and verify they pass**

Run: `node --test tests/panel-tools.test.ts tests/preview.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/panel-tools.ts src/preview.ts tests/panel-tools.test.ts tests/preview.test.ts
git commit -m "feat: resolve TIP state overrides in preview"
```

### Task 3: Render Legacy LIST and Candidate State Data

**Files:**
- Modify: `src/preview.ts`
- Modify: `src/main.ts`
- Modify: `src/style.css`
- Test: `tests/preview.test.ts`
- Test: `tests/ui-structure.test.ts`

**Interfaces:**
- Extend `previewItems(document, panelWidth, panelHeight, defaults?)` to resolve LIST values from the active document first and the supplied `gen.ini` defaults second.
- Keep `Preview.setOffsets()` for position offsets and add `Preview.setDefaults(document?)` for LIST fallback values.
- Apply `effectivePreviewItem()` to ordinary keys and candidate ICON items, including toolbar `Preview`.

- [ ] **Step 1: Write failing tests for LIST styles, defaults, candidate state, and selector coverage**

```ts
test("uses gen LIST styles when the layout only supplies list content", () => {
  const defaults = IniDocument.parse("[LIST]\nBACK_STYLE=476\nFORE_STYLE=130\nCELL_STYLE=247\n")
  const layout = IniDocument.parse(
    "[LIST]\nCELL_SIZE=150,124\nPOS=0,0\nLIST_NUM=2\nNAMES=a b\n",
  )
  const list = previewItems(layout, 300, 248, defaults).filter((item) => item.section.startsWith("LIST:"))
  assert.equal(list[0].backStyle, "247")
  assert.deepEqual(list[0].foreStyles, ["130"])
})

test("candidate icons use TIP overrides for the selected state", () => {
  const document = IniDocument.parse(
    "[CAND]\nBACK_STYLE=1\n[ICON1]\nBACK_STYLE=2\nFORE_STYLE=3\nSIZE=100,100\nSTAT_STYLE=S4_5\n" +
    "[TIP5]\nBACK_STYLE=7\nFORE_STYLE=8\n",
  )
  const icon = previewItems(document, 300, 100).find((item) => item.section === "ICON1")!
  assert.equal(effectivePreviewItem(document, icon, 4).backStyle, "7")
})
```

- [ ] **Step 2: Run focused tests and verify they fail**

Run: `node --test tests/preview.test.ts tests/ui-structure.test.ts`

Expected: FAIL because LIST styles/defaults and candidate state application are missing.

- [ ] **Step 3: Implement the smallest compatible rendering changes**

Merge LIST values with `defaults`, emit a list-surface item when `BACK_STYLE` exists, use `CELL_STYLE` for cell backgrounds and `FORE_STYLE` for text, preserve vertical `TYPE=0/LIST_ORDER=0`, and add the existing fallback for unsupported arrangements. Add candidate `PERSIST` selection and apply TIP-resolved effective items before resolver calls. Add CSS custom properties for candidate `PADDING`, `FIRST_GAP`, `CELL_W`, and `MORE_W` without creating another renderer.

- [ ] **Step 4: Run focused tests and verify they pass**

Run: `node --test tests/preview.test.ts tests/ui-structure.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/preview.ts src/main.ts src/style.css tests/preview.test.ts tests/ui-structure.test.ts
git commit -m "feat: improve legacy list and candidate preview rendering"
```

### Task 4: Wire Bidirectional State Synchronization

**Files:**
- Modify: `src/main.ts`
- Modify: `src/preview.ts`
- Test: `tests/actions.test.ts`
- Test: `tests/ui-structure.test.ts`

**Interfaces:**
- Produce one `applySkinState(state?: number, message?: string)` path in `main.ts` that updates `skinState`, `preview`, `toolbarPreview`, and `eventLog`.
- `handlePreviewEvent()` calls `previewStateFromAction(event.code)` before the existing page/function/text handling. A returned `0` clears the state; `1..99` selects it; `undefined` leaves it unchanged.

- [ ] **Step 1: Write failing integration-shape tests**

```ts
test("preview event handling routes S actions through the shared state setter", () => {
  assert.match(main, /previewStateFromAction\(code\)/)
  assert.match(main, /applySkinState\([^\n]*state/)
  assert.match(main, /toolbarPreview\.setSkinState/)
})
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `node --test tests/ui-structure.test.ts`

Expected: FAIL because preview events currently return for every `Sxx` action without updating either preview.

- [ ] **Step 3: Implement the shared setter and event wiring**

Replace the direct selector listener and direct `preview.setSkinState()` calls with `applySkinState()`. Call it from `handlePreviewEvent()` for valid S actions, preserving existing event logging and page/function behavior for all other codes. Call `toolbarPreview.setSkinState()` whenever the main preview state changes.

- [ ] **Step 4: Run the complete verification suite**

Run: `npm test && npm run build`

Expected: 0 test failures and a successful production build.

- [ ] **Step 5: Commit**

```bash
git add src/main.ts src/preview.ts tests/actions.test.ts tests/ui-structure.test.ts
git commit -m "feat: synchronize S state with preview actions"
```

## Final Verification

- [ ] Run `npm test` and confirm the complete test count passes.
- [ ] Run `npm run build` and confirm exit code 0.
- [ ] Inspect `git diff --check` and `git status --short`.
- [ ] Manually verify `S4_2`, `S0`, and an ordinary `Fxx` operation in the running preview.
