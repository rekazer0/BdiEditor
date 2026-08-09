# Windows WebView2 Already-Exists Handling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install WebView2 only when detection misses it, while accepting `0x800700B7` as an already-installed result.

**Architecture:** Keep Tauri's `downloadBootstrapper` detection and installation flow. Use the matching official NSIS template with one additional accepted WebView2 installer exit code, protected by the existing configuration test suite.

**Tech Stack:** Tauri 2 JSON configuration, Node.js test runner, TypeScript

## Global Constraints

- Use `webviewInstallMode.type` value `downloadBootstrapper`.
- Accept only `-2147024713` in addition to success; preserve failure behavior for other codes.
- Do not change macOS packaging behavior.

---

### Task 1: Tolerate an already-existing WebView2 runtime

**Files:**
- Modify: `tests/capabilities.test.ts`
- Modify: `src-tauri/tauri.windows.conf.json`
- Create: `src-tauri/windows/installer.nsi`

**Interfaces:**
- Consumes: Tauri 2 `bundle.windows.webviewInstallMode` configuration schema.
- Produces: A detecting/downloading installer that accepts `0x800700B7` as nonfatal.

- [ ] **Step 1: Write the failing configuration test**

```ts
test("Windows installer tolerates WebView2 already-existing after a missed detection", () => {
  const config = JSON.parse(readFileSync("src-tauri/tauri.windows.conf.json", "utf8"))
  assert.deepEqual(config.bundle.windows.webviewInstallMode, { type: "downloadBootstrapper" })
  assert.equal(config.bundle.windows.nsis.template, "./windows/installer.nsi")

  const template = readFileSync("src-tauri/windows/installer.nsi", "utf8")
  assert.match(template, /\$1 = -2147024713/)
})
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `node --test tests/capabilities.test.ts`

Expected: FAIL because the existing configuration uses `skip` and has no custom template.

- [ ] **Step 3: Add the minimal Windows-only configuration**

```json
"bundle": {
  "windows": {
    "webviewInstallMode": {
      "type": "downloadBootstrapper"
    },
    "nsis": {
      "template": "./windows/installer.nsi"
    }
  }
}
```

Copy the official Tauri CLI 2.11.4 `installer.nsi` into `src-tauri/windows/installer.nsi` and change only the WebView2 installer result branch:

```nsi
${If} $1 = 0
  DetailPrint "$(webview2InstallSuccess)"
${ElseIf} $1 = -2147024713
  DetailPrint "$(webview2InstallSuccess)"
${Else}
  DetailPrint "$(webview2InstallError)"
  Abort "$(webview2AbortError)"
${EndIf}
```

- [ ] **Step 4: Verify the focused test and project**

Run: `node --test tests/capabilities.test.ts`

Expected: all capability/configuration tests PASS.

Run: `npm test`

Expected: complete test suite PASS.

Run: `npm run build`

Expected: frontend production build exits successfully.

Run: `npm run tauri build -- --runner cargo-xwin --target x86_64-pc-windows-msvc --bundles nsis`

Expected: Windows CI compiles the custom NSIS template and produces the setup executable successfully.

- [ ] **Step 5: Commit the implementation**

```bash
git add docs/superpowers/plans/2026-08-10-webview2-install-skip.md tests/capabilities.test.ts src-tauri/tauri.windows.conf.json src-tauri/windows/installer.nsi
git commit -m "fix: tolerate existing WebView2 runtime"
```
