# Design QA

- Source visual truth: `/var/folders/67/r7lgztzs46ggm1c3zc3lh6580000gn/T/codex-clipboard-7e0a6441-b2c0-458f-9e63-1bd5585e582d.png`
- Browser implementation: `/Users/kaze/work/bdi-edit/implementation-subtle-color-background.png`
- Full browser capture: `/Users/kaze/work/bdi-edit/implementation-subtle-color-full.png`
- Combined comparison: `/Users/kaze/work/bdi-edit/design-qa-subtle-color-comparison.png`
- Browser viewport: 1280 x 720 CSS px, device scale factor 2
- Source pixels: 432 x 886; implementation crop: 264 x 574; source normalized to 280 x 574 for comparison
- State: light theme, imported `default-template.bda`, iPhone 17 Pro portrait

## Findings

- No actionable P0/P1/P2 mismatch remains for the requested background intensity and layering.
- Fonts and copy: the existing Notes chrome and imported skin labels remain unchanged; this iteration does not alter typography or content.
- Spacing and layout: phone proportions, toolbar position, dock height, radii, and keyboard geometry are unchanged.
- Colors and tokens: the page is predominantly neutral white/gray. Low-opacity blue, warm, and green light is limited to the middle and lower background, matching the reference's restrained intensity.
- Image quality: the existing keyboard-cleared Notes asset remains sharp and is not duplicated behind the generated keyboard.
- Glass: `.keyboard-dock` stays transparent. Its pseudo-element uses `rgba(241, 243, 247, 0.42)` with `saturate(1.45) blur(22px)`, so the keyboard color comes from the page background underneath.

## Verification

- Primary interaction: imported the sample skin and switched the device to iPhone 17 Pro.
- Browser console errors: 0.
- Focused comparison was required because the subtle background color and keyboard translucency are difficult to judge in a full editor screenshot.
- `npm run build`: passed.
- `npm run verify:candidate-style`: passed.

## Comparison history

- Earlier P1: blue, yellow, pink, and green light covered the entire phone at high opacity and was substantially stronger than the new reference.
- Fix: removed the top light sources, reduced the light-theme color opacity to 10-12%, and concentrated the three broad light sources around the middle/lower background.
- Post-fix evidence: `design-qa-subtle-color-comparison.png` shows a mostly neutral page with restrained warm color above the toolbar and faint blue/green color continuing through the translucent keyboard.

final result: passed
