# Preview Navigation Fixes

## Scope

Fix four existing editor behaviors without changing the archive format or adding dependencies:

1. Keep the sidebar selection synchronized with the keyboard page shown by interactive preview.
2. Count only letter keys in the 9-key layout summary.
3. Replace the sidebar title with an Overview / Source Files segmented control.
4. Close Settings and About dialogs when their backdrop is clicked.

## Navigation

The preview's current file remains the source of truth. Clicking a key first selects the file currently rendered by the preview. When an action switches to another keyboard page, the editor opens that target through the existing file-selection path so the preview, inspector, source document, and sidebar update together.

The sidebar prefers an Overview entry for files represented there, such as `py_9.ini`, `py_26.ini`, candidate/toolbars, numeric keyboards, and symbol panels. For preview pages that only exist in the source tree, it switches to Source Files and reveals that file.

## Letter Count

A letter key is a `KEY<number>` section whose trimmed `CENTER` action contains only ASCII letters. Function codes, state codes, explicit page actions, caps lock, delete, punctuation, and blank keys are excluded. This supports both single-letter 26-key layouts and grouped-letter 9-key layouts.

## Sidebar Views

The sidebar heading becomes a two-button segmented control: Overview and Source Files. Overview contains the curated navigation already present. Source Files contains the complete archive tree. The selected view is editor UI state only and is not persisted.

## Dialogs

Settings and About use the same native-dialog backdrop rule as image preview: close only when the dialog element itself is clicked. Clicks inside the form do not close it; Escape and the existing close button keep their native behavior.

## Verification

- Unit-test the letter-key counting rule.
- Add structural regression checks for preview/sidebar synchronization, the segmented sidebar, and backdrop closing.
- Run all frontend tests, TypeScript checks, and the production build.
