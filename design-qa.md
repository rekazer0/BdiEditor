# Design QA

- Source visual truth: `/var/folders/67/r7lgztzs46ggm1c3zc3lh6580000gn/T/codex-clipboard-fc3520f6-8931-44fd-b0b0-f6c2b6e37876.jpg`
- Test skin: `/Users/kaze/Downloads/孤岛记录_特别版智能深色-26+9键.bdi`
- Browser viewport: 1395 x 768 px
- Source pixels: 1206 x 2622; focused source keyboard crop: 1206 x 1130; implementation shown at 56% editor preview scale
- State: dark theme, iPhone 17 Pro portrait, imported user skin, active pinyin composition

## Findings

- No actionable P0/P1/P2 mismatch remains for the requested dock geometry.
- Root cause: the preview accounted for candidate content, the skin panel, and the iPhone bottom safe area, but omitted the iPhone keyboard's 38px rounded top cap. The phone itself was not adding an unexplained lift.
- The iPhone portrait geometry now includes a separate 38px top inset. It extends the glass upward and adds the intended space above pinyin without moving the candidate words or skin panel.
- The dock top radius is 6.65%, matching the reference's rounded shoulder more closely.
- The dock has a continuous 1px, 34%-white edge highlight. It remains much quieter than the removed broad reflection layer.
- The existing dark frosted glass, three-color background, imported key artwork, labels, and bottom safe area remain unchanged.
- Fonts/copy and image quality are inherited from the imported skin and were not changed in this iteration.

## Verification

- Loaded the supplied skin in the running editor and switched to iPhone 17 Pro portrait and dark appearance.
- Activated pinyin composition and compared the rounded top, pinyin inset, candidate row, panel position, and bottom safe area with the supplied iOS reference.
- Focused comparison was required because these differences are not readable in a full-phone fit-to-window capture.
- `npm run build`: passed.
- `npm run verify:candidate-style`: passed.

## Comparison history

- Earlier P1: the keyboard was too short and the top radius was too flat because the iPhone top cap was missing from the geometry model.
- Fix: added a 38px iPhone portrait top inset as a distinct grid row, restored the 6.65% radius, and added the requested thin edge highlight.
- Post-fix verification confirmed the glass extends upward while the candidate words and key panel retain their previous alignment.

final result: passed
