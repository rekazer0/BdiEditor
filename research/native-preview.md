# 手心 / 搜狗皮肤原生预览

2026-10-21，分支 `feat/sxi-native-preview`。验收标准：预览与皮肤包内的示例图一致。

## 改动

此前两种格式都先转成百度 INI 再交给百度渲染器：手心把 `skin.json` 投影成 `default.css` / `*.til` / `*.ini`，搜狗把 `phoneSkin.ini` 的外观转成百度样式、套在官方骨架上。现在画布直接读皮肤自己的文件绘制：

- `src/native-scene.ts`：与格式无关的场景（背景层 + 每个按键的正常 / 按下两组「背景、前景」层），由预览的主绘制循环逐键绘制，按键动画、气泡、粒子、选中描边照旧。
- `src/palm/palm-scene.ts`：直接读 `skin.json`。`defaultGlobal` 与各键盘的 `board` / `offset` / `list` 逐字段回退；`base_b` / `base_f` / `base_o`；`fix_a` → `key_fix` 的状态换层；`ss_1` 的 `s_1`（含百度投影里没有的 `f_w` 字重、`for_back` 纯色背景）、`s_2` 图片（`info` 切片，`rect2` 九宫格）、`s_3` 描边；候选栏 `icon_list` 的锚点、`keep`、`f_size`，工具栏功能取 `menu` 里位于 toolbar 的项或 Android `a_m` 图集。
- `src/ssf/ssf-scene.ts`：直接读 `phoneSkin.ini` / `keys.ini`。RootView（旧皮肤为 `[Keyboard]`）背景同时铺在候选栏和键盘后面；按键背景按 Android 九宫格拉伸；`FG_IMAGES` 按 `FG_RECT` 等比放入；`ICON` 原尺寸居中；没有前景的键用官方骨架的内置文字 / 字形，按皮肤的 TextStyle 上色、取字号字体，放进 FG_STYLE 的 `LABEL_POSITION` / `MINOR_LABEL_POSITION`。
- 键位几何仍来自布局视图（手心即 `skin.json` 自身的数值；搜狗皮肤不含键位，来自 APK 提取的官方骨架），区块名不变，选中、检查器和编辑不受影响。

## 依据

| 规则 | 依据 |
| --- | --- |
| 手心透明键盘背景下露出 `#D0D3D9` / `#212121` | 鸿蒙模板 `background_port_2.png` 全透明，示例图亮 / 暗两版此处取样 |
| 手心 `f_w` 字重 | 鸿蒙模板文字 300，示例图为细体；百度投影不含此字段 |
| 搜狗拼音键盘字母大写 | 既有 `ssf-look.ts`：拼音布局字母键 `S_FLAG=1`；「拟物」示例图 |
| 九键数字副标签 2–9 | 「拟物」`FGStyle_Phone` 开启 `MINOR_LABEL_VISIBLE` 与示例图 |
| 无 TEXT_SIZE 的标签按框尽量大、默认粗体 | 「拟物」ABC / 2、「森」中英在示例图中的实测尺寸；两张示例图的标签均为粗体 |
| 中英键白字、两框分放 | 「拟物」`FGStyle_Switch_Py9`、`TextStyle_Switch` 与示例图 |
| 皮肤自己的 `LABEL` / `MINOR_LABEL` 替换内置文字 | 「森」`Key_SwitchToEN LABEL=中 MINOR_LABEL=英`，示例图无斜杠 |

APK 下载地址在本环境被网络策略拒绝，未能重新反编译；上表最后三行的默认 FG_STYLE 对应关系（字母键 `FGStyle_Phone` / `FGStyle_Qwerty`，符号 `FGStyle_SymbolTable_*`，中英 `FGStyle_Switch_Py9` / `FGStyle_SwitchToCh_En9`）以皮肤自身覆盖的同名区块和示例图为准，其余键保留骨架位置。

## 与示例图对照（用户提供的 5 个皮肤 + 内置鸿蒙模板）

一致：键位、按键背景与切图、前景图位置、标签文字 / 颜色 / 字号 / 字重、数字副标签、符号列、候选栏背景、键盘背景。

仍不一致，且无法从皮肤数据得出：

- **键盘高度**：两张搜狗示例图的键盘比官方布局高约 16%，鸿蒙示例图约 17%，是生成示例图的设备 / 用户高度设置。
- **工具栏功能**：手心示例图的工具栏是作者手机上自选的功能（懒人模式、剪贴板等），`skin.json` 标为 toolbar 的是另一组；鸿蒙模板没有工具栏图标，示例图是手心内置图标；搜狗「拟物」示例图用的是旧版搜狗内置线框图标。
- **输入中状态**：「超快乐A」示例图是输入中（S4）截图，分词 / 全键和吉祥物动画来自该状态；画布切到 S4 即可看到 `key_fix` 换层。
- 「Write26 乱序十七」「Write2026 14键」的示例图是系列宣传图（26 键），与这两套皮肤的默认布局不同；切到 26 键后按键与示例图一致。
- 鸿蒙模板示例图的回车「完成」、清空「重输」、符号「符」与 `skin.json` 不同（数据为蓝底「换行」、「清空」、「符号」）。

## 验证

```sh
npm run typecheck
npm test
npm run test:e2e   # 新增 scripts/test-native-preview.mjs
```
