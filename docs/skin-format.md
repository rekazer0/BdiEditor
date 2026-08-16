# 百度输入法皮肤格式规范

本文档定义 BdiEditor 在解析、预览、编辑和保存百度输入法皮肤时必须遵守的格式规则。内容依据官方 Android 输入法安装包内的皮肤资源与真实用户皮肤样本（iOS `.bdi` 与 Android `.bds`）交叉比对整理，是编辑器渲染与写回行为的唯一权威依据。

> 规范中标注 **[未实现]** 的条目表示当前编辑器尚未支持，但必须保留原字段/原字节，不得在保存时破坏。

---

## 1. 容器与目录

三种皮肤都是 ZIP 容器，仅扩展名不同。编辑器把平台目录规范化为统一的内部路径（`{theme}/skin/{orientation}/...`），导出时恢复目标平台结构。

### 1.1 iOS `.bdi`

- 顶层：`Info.txt`、`demo.png`；
- 主题目录：`skin/light/skin/`、`skin/dark/skin/`；
- 方向目录：`skin/{light,dark}/skin/{port,land}/`；
- 共享资源：`skin/{light,dark}/skin/res/`；
- `Info.txt` 标记 `SupportPlatform=I`。

### 1.2 Android `.bds`（旧 INI 格式）

- 顶层：`Info.txt`、`demo.png`；
- 主题目录：`light/`、`dark/`；
- 方向目录：`light/{port,land}/`，共享资源 `light/res/`；
- `Info.txt` 标记 `SupportPlatform=A`、`Style=default`。

### 1.3 Android `.bda`（新版 protobuf 格式）

- 方向目录含 `appearanceConfig`、`animationConfig`，另有 `layoutConfig`（见 §6）；
- 资源为 `res/*.png`（无 `.til`，图元描述在 `appearanceConfig` 内）；
- 无独立 `default.css`/`gen.ini`。

---

## 2. INI 解析约定

- 键值格式 `KEY=value`；`;` 与 `#` 开头为注释；空行、注释、字段顺序、BOM、换行风格必须原样保留；
- section 名大小写不敏感识别，但写回保持原拼写；
- 未知 section 与未知键一律保留。

## 3. 布局文档（`py_9.ini`、`def_26.ini` 等面板）

| Section | 关键字段 | 语义 |
|---|---|---|
| `PANEL` | `KEY_NUM`、`TIP_NUM`、`NO_BLUR` | 面板元信息 |
| `CAND` | （占位，几何/样式来自 gen.ini 或 `.cnd`） | 候选栏 |
| `SCAND` | （同上） | 拼音输入区 |
| `KEY{n}` | `VIEW_RECT`、`TOUCH_RECT`、`BACK_STYLE`、`FORE_STYLE`、`FORE_OFFSET`、`POS_TYPE`、`STAT_STYLE`、`BACK_ANIM_STYLE`、`FORE_ANIM_STYLE`、`ANIM_STYLE`、`SHOW`、`CENTER`、`UP`/`DOWN`/`LEFT`/`RIGHT`、`HOLD` | 按键几何、样式、动作与手势 |
| `TIP{n}` | 同 `KEY{n}` 的样式/动作字段 | 按下态覆盖（见 §4.3） |
| `ICON{n}` | `SIZE`、`POS`、`ANCHOR_TYPE`、`FIX_SIZE`、`PERSIST`、`KEY`/`CENTER` | 候选栏/工具栏图标 |
| `LIST` | `CELL_SIZE`、`POS`、`LIST_NUM`、`NAMES`、`VALUES`、`PADDING` | 候选词条列表 |
| `MORE` | `GRID`、`LAYOUT_NAME`、`SYM_LAYOUT`、`CELL_STYLE`、`FORE_STYLE` | 更多/符号页 |
| `HINT` | `LAYOUT_NAME`、`TYPE` | 提示条 |
| `LOGO` / `EMOJI` | `LAYOUT_NAME` | 品牌/表情区 |

### 3.1 坐标与九宫格锚点

`ANCHOR_TYPE` 取值 1–9，映射到面板九宫格：

```
1  2  3
4  5  6
7  8  9
```

`POS` 是相对锚点的偏移：列 1/2/3 分别对应 x 起点 0 / 半宽 / 全宽，行 1/2/3 对应 y 起点 0 / 半高 / 全高。`CAND` 固定锚在原点。`FIX_SIZE` 提供前景的居中固定尺寸。

### 3.2 候选栏 `LIST`

- 整体栏（画布上可选中）几何 = `POS` 原点 + `CELL_SIZE` 宽 × `LIST_NUM` 高；
- 每个词条 `LIST:{i}` 只负责文字渲染，不可单独选中；
- 几何字段（`POS`/`CELL_SIZE`）可能定义在布局自身或 `gen.ini`（候选栏几何常全局共享），读取时布局优先、回退到 `gen.ini`。

### 3.3 动作与手势

- `CENTER`/`UP`/`DOWN`/`LEFT`/`RIGHT`/`HOLD` 分别对应点按、上滑、下滑、左滑、右滑、长按；
- `Fxx`/`Sxx` 是功能码/状态码，编辑器只展示含义，不执行内部逻辑；
- 按键的实际动作码是 `CENTER`（点按）与 `DOWN`（滑下）的语义名。

---

## 4. 样式文档（`default.css`）

`[GLOBAL]` 下 `STYLE_NUM` 记录样式计数。`STYLE{n}` 每节描述一个样式，`BACK_STYLE`/`FORE_STYLE` 中的数字就是 `n`。

### 4.1 字段

| 字段 | 语义 | 编辑器处理 |
|---|---|---|
| `NM_IMG` / `HL_IMG` | 正常/按下图元 `资源名,图块号` | 解析图集切片 |
| `NM_COLOR` / `HL_COLOR` | 正常/按下颜色（`AARRGGBB` 或 `RRGGBB`） | 背景填充色 |
| `FONT_SIZE` | 字号 | 文字渲染 |
| `FONT_NAME` | 字体名（`.SF*` 映射为系统字体） | 文字渲染 |
| `FONT_WEIGHT` | 字重（1–1000） | 文字渲染 |
| `FONT_CLEARTYPE` | ClearType 渲染提示 | 解析保留；canvas 无法逐像素 ClearType，仅记录 |
| `SHOW` | 文字型前景的内容文本 | 文字前景 |
| `INFO` | 备注 | 忽略展示 |
| `BORDER_COLOR` | 键描边色 | 描边渲染 |
| `BG_IMG` | 样式背景图 | **[未实现]** 解析保留 |

### 4.2 多 token 前景

`FORE_STYLE` 是逗号分隔的样式 ID 列表，每个 token 是前景的一层（`POS_TYPE` 一一对应）。文字前景样式通过 `SHOW` 直接给文本；`FONT_SIZE`/`FONT_NAME`/`FONT_WEIGHT` 可分散在多个 token 中，解析时合并（首次出现的值优先）。

### 4.3 状态样式 `STAT_STYLE`

格式 `S{state}_{styleID}`，以 `|` 分隔多个状态。状态值 1–99。例如 `S11_3|S10_3|S26_4`。处于状态 `state` 时，样式 `styleID` 生效；命中状态会转而读取 `TIP{styleID}` section 的 `BACK_STYLE`/`FORE_STYLE`/`POS_TYPE` 作为覆盖。

---

## 5. 图集 `.til`

`.til` 与同名 `.png` 配对，描述 PNG 内的图块切片。

```
[GLOBAL]
USE_ALPHA=1
TILE_NUM=N

[IMG{n}]
SOURCE_RECT=x,y,w,h
INNER_RECT=x,y,w,h   ; 可选，九宫格内缩区，绝对坐标
SCALE=a,b,c,d,e      ; 可选，5 段伸缩标志
```

规则：

- `SOURCE_RECT` 是图块在图集内的源矩形；
- `INNER_RECT` 是**绝对坐标**的内缩矩形，用于九宫格拉伸；无 `INNER_RECT` 时整体拉伸；
- `SCALE` 是 5 值伸缩标志（对应九宫格可拉伸区），实测样本均为 `1,1,1,1,1`（全部拉伸）；**[未实现]** 非 1 值的逐区伸缩语义需真实样本进一步验证，编辑器必须解析并原样保留该字段；
- 资源查找顺序：`{theme}/skin/{orientation}/res/` 优先，回退 `{theme}/skin/res/`。

---

## 6. BDA protobuf（`appearanceConfig` / `animationConfig` / `layoutConfig`）

### 6.1 `appearanceConfig`

顶层字段（protobuf 字段号）：

| 字段号 | 语义 |
|---|---|
| 1 | `imageStyles` map（key → ImageStyle） |
| 2 | `textStyles` map |
| 3 | `colorStyles` map |
| 4 | `panels` map（布局名 → Panel） |
| 6 | `designWidth` 设计宽度 |

- `ImageStyle`：1=`normalImage`、2=`highlightImage`，各为 `ImageAtom`；
- `ImageAtom`：1=`resource`（{type, resourceID}）、2=`innerRect`、3=`contentInset`、4=`alpha`、5=`filterColor`；
- `TextStyle`：1=`resource`、2=`fontName`、3=`fontSize`、4=`normalColor`、5=`highlightColor`、6=`contentText`；
- `ColorStyle`：1=`normalColor`、2=`highlightColor`；
- `Panel`：3=`keys` map（动作名 → Key）、7=`backStyle`、9=`trackColor`、10=`wholeBackStyle`、12=`inputRegionBackStyle`；
- `Key`：1=`backStyle`、2=`foreStyles`(repeat)、3=`foreStyleOffsets`(repeat)、4=`backStyleState`。

样式 ID 编码：图片 `1000000+key`、颜色 `2000000+key`、文字 `3000000+key`。

### 6.2 `filterColor` 语义

`filterColor` 是叠加在图片**之上**的颜色滤镜（tint），不是背景填充：

- 值为 `0` 或 `0xFFFFFFFF`（不透明白）视为「无滤镜」；
- 其他值按 `AARRGGBB` 解释为半透明叠加色。

**[已修复]** 此前被误当作背景矩形绘制，会把白色滤镜画成整块白底。

### 6.3 `animationConfig`

- 顶层字段 1 = targets（目标名列表），字段 9 = sequences map；
- Sequence：1=name、2=帧序列；帧（字段 5）内 1=resource{2=resourceID}、2=duration(ms)。

### 6.4 `layoutConfig` **[未实现]**

BDA 皮肤的按键几何/动作来源文件，与 `appearanceConfig` 并列。当前编辑器使用官方 APK 的 1080 横竖屏基础 INI 布局（`bda-base.bds`）作为几何来源。若皮肤自带与基础布局不一致的 `layoutConfig`，需解析该文件才能正确预览；在此之前不得破坏原字节。

---

## 7. 偏移模型（`gen.ini` 的 `OFFSET{n}`）

- `PANEL.OFFSET_NUM` 声明偏移段数量；
- `[OFFSET{n}]` 下的 `POS=x,y` 是前景层偏移；
- `R_POS=x,y` 与 `POS` 同义，出现在部分 Android 皮肤的 `OFFSET{n}` 段（如 75–77）。**[已修复]** 解析时先查 `POS`、回退 `R_POS`；
- 按键 `POS_TYPE` 是逗号分隔的偏移段号列表，与 `FORE_STYLE` 的层一一对应，用于定位每一层前景。

---

## 8. 传统动画（`anim.ini` + `*_ANIM_STYLE`）

iOS/Android INI 皮肤支持按键帧动画：

- `res/anim.ini` 描述动画段，字段（据官方解析器）：`[GLOBAL] ANIM_NUM`、`DURATION`、`ANIMATION_DIRECTION`、`INIT_SCALE`、`SCALE_SPEED`、`INIT_ROTATE`、`ROTATE_SPEED`；
- 按键/提示条上的 `BACK_ANIM_STYLE`、`FORE_ANIM_STYLE`、`ANIM_STYLE` 引用动画样式。

编辑器在交互预览中按皮肤配置播放 `TYPE=0` 透明度、`TYPE=2` 位移、`TYPE=3/4` 缩放动画；`BUILD_LIST` 默认顺序播放，明确配置 `BUILD_METHOD=0` 时并行组合。`BACK_ANIM_STYLE`、逐层 `FORE_ANIM_STYLE` 和动态整键 `ANIM_STYLE` 分别作用于对应渲染层。`ANIM_PATH` 外部动画资源目前只解析保留，不自行生成替代效果。

---

## 9. 前景层定位

- 层 0（首个前景）无偏移时铺满整个按键；
- 有偏移时居中 + 偏移；
- 后续层无偏移时的定位为兜底启发式（右上角贴边），**[未实现]** 官方多层前景的精确定位规则需样本验证。

---

## 10. 编辑器职责边界

- 保留未知文件/字段/注释/空行/顺序/BOM/换行；
- 保存时保留原始 ZIP 条目顺序、权限、时间扩展字段、未修改条目的压缩数据；
- 只重写用户实际修改的配置或资源；
- BDA 只重写修改过的图片资源 ID、字体、字号、颜色字段，其余 protobuf 字段按原始字节保留；
- 候选栏与模拟输入仅用于外观/交互验证，不实现真实候选算法、拼音引擎或系统输入。
