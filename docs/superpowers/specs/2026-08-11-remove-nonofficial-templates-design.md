# Remove Non-Official Built-In Templates Design

## Goal

Ship only the two Baidu-official built-in project templates and remove all non-official skin payloads from the application package.

## Keep

- `public/default-template.bda` — Baidu official Android BDA default skin.
- `public/default-template.bds` — Baidu official Android BDS legacy default skin.
- Compatibility documentation that records previously verified third-party samples; those records are not bundled templates.

## Remove

- New-project choices for `imitation-ios-15`, `dust-ios-14`, `dust-android-26-9`, `dust-ios-26-9`, and `dust-ios-18`.
- Their loader mappings and tests.
- README claims that these skins are built in.
- The five payload files under `public/templates/`:
  - `imitation-ios-15.bdi`
  - `dust-ios-14.bdi`
  - `dust-android-26-9.bds`
  - `dust-ios-26-9.bdi`
  - `dust-ios-18.bdi`
- The empty `public/templates/` directory after its contents are removed.

## Behavior

The New Project dialog contains exactly two radio options. `default-android` remains selected by default; `official-android-bds` remains the alternative. Requests for removed IDs continue through the existing unknown-template error path.

## Verification

- Test that the dialog exposes exactly the two official template IDs and contains no removed labels or IDs.
- Test that the loader maps only the official BDA and BDS IDs and rejects a removed ID.
- Test that both official payloads remain readable in their native formats.
- Verify no tracked or built file references `imitation-ios-15` or `dust-*`.
- Run the full test suite and production build.

## Non-Goals

- Do not change archive compatibility for user-opened third-party BDI/BDS files.
- Do not remove historical compatibility documentation about third-party samples.
- Do not change the two official payloads.
