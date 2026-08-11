# Add Downloaded Built-In Skins Design

## Goal

Add the five supplied BDS files as built-in New Project templates and disclose that these skins were collected from internet downloads.

## Templates

Display each supplied filename without its `.bds` extension:

- `OPPO皮肤加下滑功能`
- `OPPO默认双色皮肤`
- `IQOO提取圆角黑色`
- `小米默认皮肤(统一颜色键盘版3)_适配圆角模糊`
- `华为提取上滑符号1080`

Store the payloads under `public/templates/` with stable ASCII filenames. Keep both existing Baidu official templates and keep `default-android` selected by default.

## Behavior

The New Project dialog keeps its existing static radio-list design. Add the following notice above the choices:

> 内置皮肤为互联网下载整理，如有侵权请联系作者下架。

Each new radio ID maps through the existing `loadBuiltInProjectTemplate` lookup to one bundled BDS file. Unknown IDs continue through the existing error path. No dynamic manifest or new abstraction is needed.

## Documentation and Verification

- Update README claims to mention the five internet-collected built-in BDS skins and the infringement notice.
- Test all seven choices in the dialog and the exact notice text.
- Test all five loader mappings.
- Open each bundled payload with `SkinArchive` and assert that it is a BDS archive.
- Run focused tests, the full test suite, and the production build.

## Non-Goals

- Do not modify the supplied archives.
- Do not add downloading, updating, attribution metadata, categories, or a dynamic template registry.
- Do not change archive compatibility or the two existing official templates.
