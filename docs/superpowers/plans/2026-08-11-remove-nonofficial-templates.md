# Remove Non-Official Built-In Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove every bundled non-official skin and leave exactly the two Baidu-official project templates.

**Architecture:** Delete the five payloads and remove their presentation/loading references. Keep the existing official loader and unknown-ID error path; no replacement abstraction is needed.

**Tech Stack:** TypeScript, HTML, Markdown, Node test runner, Vite.

## Global Constraints

- Keep `public/default-template.bda` and `public/default-template.bds` unchanged.
- Delete all five files under `public/templates/` and leave no empty template directory.
- The New Project dialog contains exactly `default-android` and `official-android-bds`.
- Removed IDs use the existing unknown-template error path.
- Do not change support for user-opened third-party archives or historical compatibility records.
- Add no dependency or replacement template system.

---

### Task 1: Remove non-official built-in templates

**Files:**
- Modify: `index.html`
- Modify: `src/operations.ts`
- Modify: `tests/ui-structure.test.ts`
- Modify: `tests/operations.test.ts`
- Modify: `tests/skin.test.ts`
- Modify: `README.md`
- Delete: `public/templates/imitation-ios-15.bdi`
- Delete: `public/templates/dust-ios-14.bdi`
- Delete: `public/templates/dust-android-26-9.bds`
- Delete: `public/templates/dust-ios-26-9.bdi`
- Delete: `public/templates/dust-ios-18.bdi`

**Interfaces:**
- Keeps: `loadBuiltInProjectTemplate(id, fetcher)` with only two valid IDs.
- Keeps: existing `未知的内置项目模板` rejection for every removed ID.

- [ ] **Step 1: Write failing official-only tests**

Update `tests/ui-structure.test.ts` so the new-project dialog must contain exactly two `name="project-template"` inputs, must contain both official IDs, and must not contain `imitation-ios-15`, `dust-`, `仿ios`, or `尘埃`.

Update `tests/operations.test.ts` to load both official IDs and assert:

```ts
await assert.rejects(
  () => loadBuiltInProjectTemplate("imitation-ios-15"),
  /未知的内置项目模板/,
)
```

Replace the non-official payload test in `tests/skin.test.ts` with assertions that `public/templates` does not exist and both official payloads retain their existing native format checks.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test tests/ui-structure.test.ts tests/operations.test.ts tests/skin.test.ts`

Expected: FAIL because the UI, loader mapping, and payload directory still include non-official templates.

- [ ] **Step 3: Remove code and documentation references**

- Delete the five non-official `<label class="project-template-option">` entries from `index.html`.
- Delete their five path entries from `builtInProjectTemplatePaths` in `src/operations.ts`.
- Update README quick-start and feature text to name only the two official templates.
- Leave `docs/compatibility.md` unchanged.

- [ ] **Step 4: Delete the five payload files**

Delete the exact five files listed above. Remove `public/templates/` after confirming it is empty. These files remain recoverable from Git history.

- [ ] **Step 5: Verify GREEN and absence**

Run: `node --test tests/ui-structure.test.ts tests/operations.test.ts tests/skin.test.ts`

Expected: all focused tests pass.

Run: `rg -n "imitation-ios-15|dust-|仿ios|尘埃" index.html src tests public README.md`

Expected: no output.

Run: `test ! -e public/templates`

Expected: exit 0.

- [ ] **Step 6: Complete verification**

Run: `npm test`

Expected: all tests pass.

Run: `npm run build`

Expected: Vite production build exits 0 and `dist/templates` does not exist.

- [ ] **Step 7: Commit**

```bash
git add index.html src/operations.ts tests/ui-structure.test.ts tests/operations.test.ts tests/skin.test.ts README.md public/templates
git commit -m "chore: remove non-official skin templates"
```
