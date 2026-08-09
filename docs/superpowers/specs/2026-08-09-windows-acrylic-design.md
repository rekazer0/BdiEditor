# Windows Acrylic Window Design

## Goal

Replace the Windows Mica backdrop with native Acrylic so the desktop is blurred and tinted instead of directly visible through the editor window.

## Design

- Change only `src-tauri/tauri.windows.conf.json` from `mica` to `acrylic`.
- Keep `transparent: true`, which Tauri requires for native window effects.
- Keep macOS window effects and application CSS unchanged.
- Add a regression assertion in `tests/capabilities.test.ts` for the Windows Acrylic effect.
- Do not add dependencies or emulate the effect with CSS.

## Verification

- Prove the regression test fails while Windows still uses Mica.
- Change the Windows effect to Acrylic and run the full test suite.
- Run the production frontend build and validate the Tauri configuration.
- Visual confirmation must be performed on Windows because this workspace is macOS.

## Versioning

Increment the patch version only after the fix is verified. The expected next version is `0.4.8` on the main branch.
