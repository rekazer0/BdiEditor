# Resource Configuration Atlas Editor Design

## Goal

Merge the left navigation entries for `gen.ini`, `default.css`, and PNG resources into one `资源配置` entry. Selecting it shows all theme/orientation PNG resources in the inspector; selecting an image opens it on the canvas with editable `.til` slice rectangles.

## Scope

- Keep one `资源配置` navigation entry for the existing configuration/resource area.
- Preserve `gen.ini` and `default.css` editing through the existing source-code inspector tab, but remove their standalone navigation entries.
- Show PNG thumbnails, filenames, dimensions, and whether a matching `.til` exists.
- Open the selected PNG in the central canvas.
- Add a canvas grid toggle. When enabled, read the matching `.til` and draw every `SOURCE_RECT` with its `IMGn` label.
- Select an existing slice and edit `x`, `y`, `width`, and `height`.
- Create a new slice by dragging on the image; assign the next available `IMGn` number.
- Treat `INNER_RECT` as an optional editable parameter. Existing values remain unchanged unless the user edits them. New slices omit it by default.
- Save only the matching `.til`; PNG bytes remain unchanged.

## Data Flow

```text
资源配置
  -> image.png
  -> image.til
      -> [IMGn]
          -> SOURCE_RECT
          -> INNER_RECT (optional)
```

`SOURCE_RECT` uses absolute PNG coordinates. `INNER_RECT`, when present, remains in the existing TIL coordinate convention and is displayed/edited without being synthesized for new slices.

## Interaction

- The resource list is the selection source for the image canvas.
- Grid visibility is a canvas toolbar state and defaults to off.
- Existing slice rectangles are selectable; one selected rectangle is editable in the inspector.
- Dragging an empty image area creates a pending new rectangle. Saving commits it as the next free `IMGn`.
- Invalid or out-of-bounds rectangles are rejected in the editor; malformed third-party TIL entries remain readable and are not silently rewritten.

## Compatibility

- Use the existing `SkinArchive`, `IniDocument`, PNG detection, and TIL parsing patterns.
- Keep orientation-local resources preferred over shared resources, matching `AtlasResolver`.
- Do not add dependencies or alter archive formats.

## Verification

- Unit-test resource listing and matching PNG/TIL paths.
- Unit-test TIL parsing/writing, including optional `INNER_RECT`, next-index allocation, and unchanged PNG bytes.
- Verify existing keyboard/style/source editing tests remain green.
