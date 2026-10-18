// 注入 AI 设计系统提示的皮肤格式知识；规则须与 atlas.ts / keyboard.ts 的实际解析保持一致。
const INI_SKILL = `## 皮肤格式技能（BDI/BDS）

### 文件分工
- \`<主题>/skin/<port|land>/*.ini\`：面板布局（如 py_9.ini、en_26.ini）。每个按键是一个配置节（KEY1、KEY2…），只描述几何（VIEW_RECT/TOUCH_RECT）、动作（CENTER/UP/DOWN/LEFT/RIGHT/HOLD）、样式引用（BACK_STYLE/FORE_STYLE）和 SHOW 序号。布局里的“文字”通常不在这里。
- \`<主题>/skin/<port|land>/gen.ini\`：全局面板配置，[PANEL] 的 SIZE、BACK_STYLE 是键盘整体尺寸和底板样式；[CAND]/[INPUT] 是候选栏和输入码区域。
- \`<主题>/skin/<port|land>/res/default.css\`，不存在时用 \`<主题>/skin/res/default.css\`：样式表。扩展名是 .css，但语法是 INI，用 set_ini_value 修改。按键上看到的文字、字体、字号、颜色、背景图引用全部定义在这里。
- 状态切换：按键节的 STAT_STYLE 会让特定输入状态改用布局里的 TIPn 节。

### 样式引用解析（最重要）
- BACK_STYLE=N：取第一个数字，背景样式是样式表 [STYLEN]。
- FORE_STYLE=A,B,…：每个数字 N 依次查 [STYLEN]，再查 [STYLE⌊N/100⌋] 作为字体与颜色的回退。例：FORE_STYLE=72,192 → [STYLE72]、[STYLE192]、[STYLE1]。字体、字号、颜色取第一个提供该字段的节。
- 样式节字段：
  - SHOW：该样式绘制的文字（例如“ABC”“分词”“重输”）。改按键显示文字 = 改对应 [STYLEN] 的 SHOW，绝不能改布局里的动作字段。
  - NM_COLOR / HL_COLOR：常态 / 按下颜色。有图片时是图片叠加色，有文字时是文字颜色。格式 RRGGBB 或 AARRGGBB（alpha 在前，00 为全透明）。
  - NM_IMG / HL_IMG：\`图片名,切片序号\`，指向 res/图片名.png 与 res/图片名.til 中的 [IMG序号] 切片。引用只能改成已存在的图片名和切片；按键颜色、图案若画在图片里，用 view_image / recolor_image / generate_image 直接修改该切片的像素。
  - FONT_NAME、FONT_SIZE、FONT_WEIGHT（1–1000）、FONT_CLEARTYPE、BORDER_COLOR。
- [GLOBAL]：STYLE_NUM（最大样式序号）、FONT_PATH（内嵌字体）。

### 推荐工作流
1. 在布局 ini 中定位目标按键节，读出 BACK_STYLE / FORE_STYLE。
2. 按上面的规则换算出样式节名，用 read_ini_sections 直接读取样式表中的这些节（样式表很大时不要分页通读）。
3. 找到真正提供目标字段（SHOW、颜色、字体…）的那个节再修改；画布上看到的文字或图标要先在样式节里找到来源。
4. 样式节可能被多个按键、多个面板共享（拼音与英文 9 键常共用字母样式）。修改前在当前布局中确认还有哪些按键引用同一节，在总结里说明受影响的按键，并提醒可能影响其他面板；需要只改一处时，可用 add_ini_section 复制出新的 STYLEn 并改该按键的引用。
5. 改完复读被改的节确认结果。`

const BDA_SKILL = `## 皮肤格式技能（BDA）
- 当前面板的 appearanceConfig 是一个 JSON 文件，按键、候选栏以及 imageStyles / textStyles / colorStyles 样式表都在同一个文件里。
- 按键通过样式引用（type 为 image/text/color，key 为样式表中的序号）指向样式；按键显示文字、字体、颜色要到被引用的 textStyles / colorStyles 条目中修改，不要改按键的动作字段。
- 用 read_project_file 读取后，用 replace_project_text 做唯一、精确的小片段替换；同一样式可能被多个按键共享，需在总结中说明影响范围。`

// 规则须与 ssf/ssf-parts.ts、ssf/ssf-keymap.ts 的实际解析保持一致。
const SSF_SKILL = `## 皮肤格式技能（搜狗 SSF）

### 文件分工
- \`phoneTheme.ini\`：皮肤名称（skin_name）、作者、版本。
- \`time.ini\`：哪个外观文件夹（statusN）在哪些时段显示；中午显示的是白天外观，另一个是夜间外观。
- \`<分辨率>/<statusN>/phoneSkin.ini\`：当前外观的主文件，按键类、背景图、文字颜色、候选栏、键盘背景都在这里。
- \`<分辨率>/<statusN>/keys.ini\`：按键前景图（FG_IMAGES、FG_RECT）和按键动画引用（ANIM_STYLE）。
- \`<分辨率>/<statusN>/anim.ini\`：按键动画。
- \`default/sound_android.ini\`：按键音效。[Key] 是默认音效；sound= 填 default/ 下的音频文件名（不含扩展名）。
- 图片先在 statusN 文件夹找，找不到再依次找 \`<分辨率>/\`、\`default/\`。

### 解析规则（最重要）
- 搜狗皮肤不含按键位置：按键排布由搜狗输入法决定，不能增删按键或改几何，只改视觉。
- 按键类是配置节：全键字母 [Key_A]，九键字母组 [Key_ABC]，九键功能键 [Key_Backspace]、[Key_Enter]，全键功能键加 _Qwerty（[Key_Backspace_Qwerty]）。横屏先读 _Land 变体（[Key_A_Land]）。
- 背景：按键类的 BG_IMAGES=段名，该段的 NORMAL / PRESSED（以及 DISABLED、NORMAL_ON、PRESSED_ON）是各状态图片。值格式 \`图片.png,左,右,上,下\`，后四个数是九宫格可拉伸的像素区间，换图时保留。
- 按键类没有可用的 BG_IMAGES 时用共享默认段：九键 KeyBg_Default、功能键 KeyBg_Function、空格 KeyBg_Space；全键 KeyBg_Default_Latin、KeyBg_Function_Qwerty、KeyBg_Space_Qwerty。
- 前景：keys.ini 里按键类的 FG_IMAGES=段名，该段 NORMAL / PRESSED 是前景图，FG_RECT=左,上,右,下 是按键内的比例坐标；没有时用 phoneSkin.ini 按键类的 ICON / ICON_PRESSED。
- 文字颜色：TEXT_COLOR / TEXT_COLOR_PRESSED，格式 0xAARRGGBB。按键类自己没写时依次用：全键 TextStyle_Qwerty、九键 TextStyle_Phone_Label（功能键 TextStyle_FuncKey_26char / TextStyle_FuncKey_T9，空格 TextStyle_Space_Label），最后 TextStyle。功能键图标颜色在 [General] ICON_COLOR / HIGH_LIGHT_ICON_COLOR。
- 键盘背景 [RootView] BG_IMAGE；候选栏 [CandidateView] BG_IMAGE=段名，该段 NORMAL 是候选栏图片；候选字 [TextStyle_Candidate]、首选 [TextStyle_Candidate_Highlight]；输入码 [ComposingView] BG_COLOR 与 [TextStyle_Composing]。
- 同名配置节可能出现两次，第一次出现的值生效。

### 推荐工作流
1. 用 read_ini_sections 读取目标按键类，按上面的规则找到真正提供背景、前景或颜色的段，再读取那个段。
2. 共享段（默认背景、TextStyle）会影响同类的所有按键；只改一个键时，用 add_ini_section 复制出新段（如 SMA_Key_A），再让该按键类的 BG_IMAGES 指向它，或把 TEXT_COLOR 写进按键类自己的节。
3. 图片颜色要改像素时，按段里的文件名用 view_image / recolor_image 修改对应 PNG。
4. 改完复读被改的节确认结果，在总结中说明影响范围。`

export function aiSkinSkill(format: "bdi" | "bds" | "bda" | "ssf"): string {
  return format === "bda" ? BDA_SKILL : format === "ssf" ? SSF_SKILL : INI_SKILL
}
