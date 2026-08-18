# iPhone preview design QA

- Source visual truth: `/var/folders/67/r7lgztzs46ggm1c3zc3lh6580000gn/T/codex-clipboard-4467ace6-fdde-4656-b9fe-55decd07fbc3.jpg` and `/var/folders/67/r7lgztzs46ggm1c3zc3lh6580000gn/T/codex-clipboard-74892e15-0e2a-4a93-9000-7f65dd9a109d.png`
- Implementation screenshot: `/Users/kaze/work/bdi-edit/implementation-iphone-preview.png`
- Viewport: 1280 × 720 browser viewport; iPhone preview 275 × 575 CSS px before final 0.8 preview zoom.
- Source pixels: 942 × 2048 and 942 × 2048. Implementation pixels: 1280 × 720. Compared by normalized phone-width proportions.
- State: iPhone 17 Pro, portrait, light, Chinese 9-key layout.

## Full-view comparison

The phone now uses one symmetric squircle radius for all four body corners. The white editing surface, status bar, circular navigation controls, pill action group and bottom editing toolbar match the reference composition. The keyboard remains the selected skin preview by design.

## Focused-region comparison

Focused checks covered the top status/navigation area, bottom editing toolbar and all four phone corners. Icons reuse the editor's existing SF Symbols bridge rather than replacement artwork.

## Comparison history

1. P1: first implementation used oversized navigation controls and retained the decorative preview gradient. Fixed by reducing control sizes to the screenshot proportions and applying the native white editing surface.
2. P2: placeholder and simulation labels were visible although absent in the reference. Fixed by hiding those labels in iPhone presentation while preserving the editable textarea.
3. Post-fix evidence: `implementation-iphone-preview.png` shows symmetric upper/lower corners and the corrected non-keyboard chrome.

## Fidelity surfaces

- Typography: SF/PingFang system stack, weights and compact status text retained.
- Spacing: top controls, editing void, bottom toolbar and keyboard stack follow the reference proportions.
- Colors: native white surface, faint gray borders and yellow completion control match the light reference.
- Image quality: skin keyboard remains canvas-rendered; UI icons use existing system-symbol assets.
- Copy: time, Format label and editor controls match the visible reference state.

## Findings

No actionable P0/P1/P2 mismatches remain within the requested scope. The keyboard itself intentionally follows the loaded skin instead of the reference keyboard.

final result: passed
