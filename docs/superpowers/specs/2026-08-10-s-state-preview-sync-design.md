# S State Preview and Synchronization Design

## Goal

Make legacy BDI/BDS S-state rendering match Baidu panel semantics and keep the preview controls synchronized with state-changing keyboard actions. Improve the related LIST, candidate toolbar, and touch-area preview behavior without replacing the existing Canvas and DOM architecture.

## Scope

- Support S states from `S0` through `S99` only.
- Treat `S0` as the default state with no TIP override.
- Accept keyboard action forms `S4` and `S4_2`; both select `S4`.
- Ignore malformed actions, negative states, and states above `S99` without changing the current state.
- Apply state changes to the selector, keyboard canvas, candidate toolbar canvas, and status text through one shared update function.
- Resolve `STAT_STYLE` entries through the referenced `TIPn` section for ordinary keys and candidate toolbar icons.
- Improve legacy LIST styling and layout, candidate text geometry, candidate icon persistence, and pointer hit testing.

The work does not replace the current renderer with PanelsPreviewer's single composited image model. BDA rendering, animation, device frames, gesture handling, page transitions, and simulated input remain intact.

## State Model

`main.ts` owns the selected state as the existing `skin-state` control value. A single `applySkinState(state)` function normalizes and applies every state change:

- `undefined` or `0` selects the default state.
- Integers from `1` through `99` select the matching S state.
- Other values leave the current state unchanged.

Manual selector changes and preview action events both call this function. It updates the selector, main `Preview`, toolbar `Preview`, and event log together.

When the active theme, orientation, layout, or archive changes, the available-state list is rebuilt from relevant `.ini` and `.cnd` text documents. The selected state is retained when still available and reset to default otherwise.

## Action Parsing

A pure action parser recognizes only complete state actions:

```text
S0       -> default
S4       -> S4
S4_2     -> S4
S99_12   -> S99
S100     -> ignored
S-1      -> ignored
S4_extra -> ignored
```

The optional suffix is preserved as part of the skin action format but does not affect the selected preview state. Non-S actions do not change the selected state.

## TIP Resolution

For each rendered key or candidate icon:

1. Read its base `BACK_STYLE`, `FORE_STYLE`, and `POS_TYPE`.
2. Split `STAT_STYLE` on `|` and parse exact `S<state>_<tip>` entries.
3. When the entry state matches the current state, read section `TIP<tip>` from the same document.
4. Override only properties present in that TIP section:
   - `BACK_STYLE`
   - `FORE_STYLE`
   - `POS_TYPE`
5. Render normally with the resulting values. Press interaction still selects `HL_IMG` and `HL_COLOR` within the effective styles.

Missing TIP sections, malformed entries, or absent override properties fall back to the base key without failing the preview.

## Legacy Preview Fidelity

### LIST

LIST values in the active layout take precedence over values inherited from `gen.ini`. The preview uses:

- `BACK_STYLE` for the list surface.
- `CELL_STYLE` for each cell background.
- `FORE_STYLE` for cell text and foreground styling.
- `CELL_SIZE`, `POS`, `LIST_NUM`, and `NAMES` for content and geometry.
- `PADDING`, `LIST_ORDER`, and `TYPE` where they affect the supported row or column arrangement.

Unknown LIST modes retain the existing vertical fallback rather than preventing rendering.

### Candidate Toolbar and Text

Candidate toolbar icons continue to use the existing anchored Canvas renderer. `PERSIST` determines the default mutually exclusive icon, and `STAT_STYLE/TIP` can replace its effective background and foreground styles.

The simulated candidate DOM continues to provide interactive text. Candidate configuration values `FIRST_FORE`, `CELL_STYLE`, `FIRST_GAP`, `CELL_W`, `MORE_W`, and `PADDING` are translated into the existing DOM styles and CSS variables instead of introducing a second candidate renderer.

### Pointer Geometry

Each key retains `VIEW_RECT` for drawing and gains an optional `TOUCH_RECT` for pointer hit testing. When `TOUCH_RECT` is missing or invalid, hit testing falls back to `VIEW_RECT`.

## Error Handling

All parsers are tolerant of incomplete third-party skins. Invalid numeric fields, missing styles, missing TIP sections, and unsupported modes use existing values or existing fallback behavior. State actions outside `S0` through `S99` are ignored and do not clear a valid current state.

## Testing

Focused tests will cover:

- State actions `S0`, `S4`, `S4_2`, and `S99_12`.
- Rejection of malformed and out-of-range state actions.
- TIP overrides and base-property fallback.
- Correct separation of S-state selection from pressed/highlighted style selection.
- State application to main and toolbar previews through the shared controller path.
- Candidate icon TIP resolution and persistence.
- LIST default merging, styles, padding, and supported ordering.
- `TOUCH_RECT` hit testing with `VIEW_RECT` fallback.

The full Node test suite and production build must pass before completion.

## Deliberate Deferrals

- No new rendering abstraction or intermediate scene graph.
- No Qt-style full-panel compositing rewrite.
- No implementation of legacy fields such as `FONT_PATH` or `BORDER_SIZE` without a failing project sample.
- No new dependencies.
