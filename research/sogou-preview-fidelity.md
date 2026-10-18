# 搜狗 SSF 画布修复依据

输入包：`SogouInput_20.17.0_android_sweb.apk`（20.17.0）。APK 的 SHA-256 与提取路径保存在 `public/sogou-template.bds` 内的 `sogou-source.json`。

## 工具栏与符号列

- “好柿花生”没有 `logo.png`，其带底座的 S 图标实际是 `ime_function_multimedia.png`。APK 的 `1080/layout/cands.ini` 保留 `IME_Function_Multimedia` 槽位；预览在缺少独立 logo 时使用皮肤的这个资源，同时保留独立 logo 的优先级。
- 同一官方配置把 `CandidateCodeView.TEXT_STYLE` 指向 `TextStyle_Text`。`TextStyle_Popup_Code` 属于气泡文字，不应用于常驻符号列。
- 官方 `layout/template.ini` 中 `TextStyle_Text.TEXT_SIZE=0.039`，字体为 `DROIDSANSFALLBACK.ttf`。“好柿花生”提供了自定义同名字体，必须加载包内字体，不能只取文字颜色。
- 列表的背景和单元格背景分别由 `BG_IMAGE`、`BG_IMAGES` 控制，骨架须同时保留两个引用。

## 布局变体

- `port/py_9_double_input.ini` 通过 `REAL_KEY` 使用 `Key_Space_py9_DP` 与 `Key_PunctPY_DP`。它们仍应映射为空格、首键功能，不能根据 `CODES=32/0x31` 当普通字符绘制。
- 反编译的 `com.sogou.theme.parse.parseimpl.r`、`f0` 确认 `REAL_KEY` 选择实际按键定义，槽位只覆盖尺寸与位置。
- `port/big_9.ini` 的第一行只包含 ABC、DEF、退格；`FirstCandidateContainer` 使用左上区域，符号列从第二行开始。这是官方大九键的结构，不应凭普通九键截图补一个按键。
- 大回车的双行高度来自 `py_9_big_enter_double_input.ini` 中 `Key_Enter.H=0.48602`；普通九键回车素材在该区域内的伸展属于皮肤素材适配边界。

## 前景区域

- 反编译的 `com.sogou.theme.parse.parseimpl.a` 把 `FG_RECT` 交给 `parse.utils.f.m`。
- `f.m` 按顺序写入 Android `RectF.left/top/right/bottom`。
- `data.foreground.c.X` 把这个矩形传给前景绘制；`ViewMeasureUtil.f` 用 `left * width`、`top * height`、`right * width`、`bottom * height` 计算边界，并在边界内保持原图比例。
- 因此 `FG_RECT=0.25,0.1,0.75,0.9` 的宽高比例为 `0.5,0.8`。读取、百度转搜狗的输出、属性字段方向标签与 AI 编辑说明须使用同一含义。

## 回归入口

```sh
node scripts/extract-sogou-template.mjs /path/to/SogouInput.apk
npm run typecheck
npm test
npm run test:e2e
SSF_SKIN_PATH=/path/to/好柿花生.ssf node scripts/test-ssf-preview.mjs
npm run test:ui
```

测试覆盖图标正常/按下资源、列表字体与颜色、双拼功能键身份、前景四边坐标和等比绘制、全部侧栏布局的横竖屏/明暗组合，以及预览不修改 SSF 源文件。
