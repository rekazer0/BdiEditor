# Panel Copy Design

## Goal

Replace “面板缩放与竖转横” with a general panel-copy tool. Users choose one source panel and one target panel anywhere in the skin, optionally scale it to a configured target resolution, and keep the copied panel visually self-contained.

## Scope

- Copy one `.ini` panel at a time.
- Source and target may use any existing light/dark theme and port/land orientation.
- The target may be an existing panel or a new `.ini` filename.
- Copy the source panel's referenced style sections, PNG atlases, and TIL slice definitions.
- Resolve style and resource name conflicts without changing unrelated target panels.
- Resolution scaling is optional and disabled by default.
- When scaling is enabled, source width and height are read from the source panel and remain read-only; target width and height are user-configurable.
- After success, switch the editor to and select the copied target panel.

## User Interface

The existing toolbar button remains in place but is renamed “面板复制”. Its dialog contains:

1. A source-panel selector listing complete archive paths.
2. Target theme and orientation selectors.
3. A target filename input with existing filenames offered through a native `datalist`; a new valid `.ini` filename is also accepted.
4. A “缩放分辨率” checkbox, off by default.
5. Read-only source width/height and editable target width/height, shown only while scaling is enabled.
6. A summary of the complete target path and a “复制” action.

Choosing a source updates the detected source size and defaults the target filename to the source basename. Choosing an existing target requires one confirmation before its panel content is replaced. Invalid paths, missing source dimensions when scaling is enabled, and non-positive target dimensions block the operation with the existing error presentation.

## Copy Model

Reuse `IniDocument`, `SkinArchive`, `scaleIniDocument()`, and the existing PNG resize function. The operation runs in this order:

1. Parse the source panel.
2. Resolve the source and target `default.css` using the same orientation-first, shared-resource fallback used by `AtlasResolver`.
3. Collect style IDs referenced by panel style fields, including `BACK_STYLE`, `FORE_STYLE`, and state-style mappings.
4. Merge those `STYLEn` sections into the target stylesheet.
5. For every copied style image reference, locate its `.png` and same-base `.til` in the source resource roots and copy them beside the target stylesheet.
6. Write the rewritten panel document to the selected target path.

The tool copies complete PNG/TIL atlas pairs instead of repacking individual slices. This preserves every referenced tile number, inner rectangle, and nine-slice boundary while keeping the implementation small and deterministic.

## Conflict Handling

- If a target `STYLEn` section is absent, retain the original style ID.
- If it exists with identical content, reuse it.
- If it differs, allocate the next unused numeric style ID and rewrite only the copied panel's references.
- If a target PNG/TIL pair is absent, retain the source base name.
- If both target files are byte-identical to the source pair, reuse them.
- Otherwise append `_copy2`, `_copy3`, and so on, then rewrite image references in the copied style sections.
- Existing target stylesheet sections and unrelated resources are never deleted.

All conflict decisions are computed before archive writes so a validation failure cannot leave a partially copied panel.

## Optional Scaling

With scaling disabled, panel, TIL, and PNG bytes retain their source dimensions.

With scaling enabled:

- Read source dimensions from the source panel's `[PANEL] SIZE`; if absent, use that directory's `gen.ini` `[PANEL] SIZE`.
- Calculate independent horizontal and vertical ratios from the configured target width and height.
- Scale the copied panel through `scaleIniDocument()`.
- Scale copied TIL geometry through the same function.
- Resize copied PNG atlases by the same ratios.
- Do not change target stylesheet colors, font sizes, or unrelated resources.

## Archive Boundary

The source list contains real text `.ini` files exposed by `SkinArchive`. BDS and BDI archives are fully supported. BDA virtual base-package panels are not materialized by this feature; only real editable `.ini` entries in the open BDA overlay are eligible. This avoids silently copying immutable base data into a different archive model.

## Error Handling

- Reject target filenames containing path separators, `.`/`..`, or a non-`.ini` extension.
- Reject source and target paths that are identical.
- Reject missing source stylesheet sections or referenced PNG/TIL pairs instead of producing a visually incomplete copy.
- Confirm before replacing an existing target panel.
- Keep the archive unchanged until validation and resource planning complete.
- Surface failures through the existing `runFileOperation()` and `showError()` path.

## Verification

- Unit-test panel style-reference discovery and conflict rewriting.
- Unit-test identical-resource reuse and conflicting-resource renaming.
- Unit-test optional geometry scaling and invalid target filenames.
- Structure-test the renamed toolbar/dialog, cross-theme/orientation controls, target datalist, and disabled-by-default scaling controls.
- Integration-test a synthetic archive copy across theme/orientation boundaries and verify the target panel resolves the copied visual resources.
- Run the complete test suite and production build.
- Build the ARM64 macOS application and exercise source selection, new/existing targets, cross-theme copy, scaling off, scaling on, and overwrite confirmation in the real UI.

## Non-Goals

- No whole-theme or whole-directory copying.
- No atlas repacking or unused-slice pruning.
- No dependency or generic resource-migration framework.
- No creation of missing themes or skin directory structures beyond the chosen target panel/resource paths.
