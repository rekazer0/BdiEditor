# Windows WebView2 Install Skip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent the Windows installer from running the WebView2 installer by configuring Tauri to use the system runtime.

**Architecture:** Add the supported Tauri `bundle.windows.webviewInstallMode` setting to the Windows-only configuration. Protect it with the existing configuration test suite.

**Tech Stack:** Tauri 2 JSON configuration, Node.js test runner, TypeScript

## Global Constraints

- Use `webviewInstallMode.type` value `skip`.
- Do not add custom NSIS scripts or dependencies.
- Do not change macOS packaging behavior.

---

### Task 1: Skip bundled WebView2 installation on Windows

**Files:**
- Modify: `tests/capabilities.test.ts`
- Modify: `src-tauri/tauri.windows.conf.json`

**Interfaces:**
- Consumes: Tauri 2 `bundle.windows.webviewInstallMode` configuration schema.
- Produces: Windows installer configuration with `{ "type": "skip" }`.

- [ ] **Step 1: Write the failing configuration test**

```ts
test("Windows installer uses the system WebView2 runtime", () => {
  const config = JSON.parse(readFileSync("src-tauri/tauri.windows.conf.json", "utf8"))
  assert.deepEqual(config.bundle.windows.webviewInstallMode, { type: "skip" })
})
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `node --test tests/capabilities.test.ts`

Expected: FAIL because `config.bundle` is absent.

- [ ] **Step 3: Add the minimal Windows-only configuration**

```json
"bundle": {
  "windows": {
    "webviewInstallMode": {
      "type": "skip"
    }
  }
}
```

- [ ] **Step 4: Verify the focused test and project**

Run: `node --test tests/capabilities.test.ts`

Expected: all capability/configuration tests PASS.

Run: `npm test`

Expected: complete test suite PASS.

Run: `npm run build`

Expected: frontend production build exits successfully.

Run: `npm run tauri build -- --no-bundle`

Expected: Tauri accepts the merged configuration and builds the application binary successfully.

- [ ] **Step 5: Commit the implementation**

```bash
git add docs/superpowers/plans/2026-08-10-webview2-install-skip.md tests/capabilities.test.ts src-tauri/tauri.windows.conf.json
git commit -m "fix: skip redundant WebView2 installation"
```
