# Slice, Source, Picker, and Responsive Preview Design

## Goal

Make atlas slicing behave like keyboard selection, keep image/color selection non-modal, and preserve the official candidate/toolbar aspect ratio at every window size.

## Scope

- Entering `资源配置` automatically enables slice guides.
- The selected slice preview is a square. The slice image is centered, preserves its aspect ratio, and fits within 80% of the square. The preview border is inside the square.
- Clicking a slice selects it, switches the inspector to `源代码`, highlights the matching `[IMGn]` block, and scrolls that block into view.
- The color control uses the browser's native non-modal color picker while preserving the existing alpha byte.
- The image slice selector remains available without making the editor inert or drawing a full-window backdrop.
- Candidate and toolbar previews preserve the logical width/height ratio read from their configuration at every window size.
- BDI/BDS and BDA previews apply the same device keyboard geometry path, with stale geometry cleared when unavailable.
- The three-column workspace collapses before its declared minimum widths can overlap.

## Architecture

Reuse the existing state and rendering paths. A shared `setGuidesVisible()` owns the guide button and both preview canvases. A shared source-section resolver returns either selected keyboard sections or the current `IMGn`, allowing the existing INI highlighter and scroll logic to work for both tools.

Keep picker data flow unchanged: `drawImageSlicePicker()`, `tileSliceAt()`, and `updateSelectedImageReference()` continue to render, hit-test, and write TIL references. Only the presentation changes from modal to non-modal. Native `<input type="color">` handles color selection; the current synchronization logic preserves the `AA` prefix.

Candidate geometry continues to come from the APK-derived INI/CND data or BDA base package. CSS renders the toolbar canvas using that intrinsic ratio instead of stretching it into a fixed-height row. A shared device-geometry function applies the same CSS variables in legacy and BDA branches.

## Interaction Details

- Resource mode calls `setGuidesVisible(true)` on entry. Users may still turn guides off afterward.
- Clicking empty atlas space clears the slice selection and remains in the properties view; only a real slice hit opens source.
- Selecting, creating, duplicating, moving, or deleting a slice refreshes the shared source highlight state so stale `[IMGn]` highlights cannot remain.
- The non-modal slice selector has an explicit close control. Opening another image-preview field updates the existing selector target rather than opening a second panel.
- Window resizing changes preview scale, never the configured aspect ratio.

## APK Parsing Boundary

The official geometry remains sourced from `assets/skin/phone/1080/{port,land}` through `bda-base.bds`, while BDA appearance protobuf data supplies styles and panel mappings. This change does not alter archive parsing. Multiple same-named `[CAND]` occurrences and runtime selection between them are outside this scope because they can select a different candidate layout but cannot cause continuous window-size distortion.

## Error Handling

- Missing images or TIL files keep the current empty/disabled behavior.
- Invalid and out-of-bounds tile rectangles remain rejected by the existing commit guard.
- If device geometry is unavailable, all related CSS variables are removed so values cannot leak from the previously opened skin.
- The slice selector releases its object URL when its target changes or the archive is replaced.

## Verification

- Unit-test the square 80% preview destination for landscape and portrait slices.
- Test that resource mode enables guides through the shared setter.
- Test that a selected slice resolves to `[IMGn]`, opens source, highlights the entire section, and scrolls to it; empty-space selection must not open source.
- Test that color and image-slice pickers do not call `showModal()` or use an active backdrop.
- Test candidate aspect-ratio layout with `1125×133`, BDA `1080×102`, and landscape `1920×145` inputs.
- Test that both legacy and BDA refresh paths apply device geometry and clear stale variables.
- Run the complete test suite and production build.

## Non-Goals

- No new dependency or reusable overlay framework.
- No archive-format or APK extraction change.
- No redesign of the whole inspector or candidate-state model.
