# 属性检查器重设计实施计划

## 设计目标

将 Pen 设计稿中的属性检查器设计应用到 bdi-edit 项目，实现：

1. **统一行高 30px** - 所有字段、属性行、动作按钮统一高度
2. **四段式结构**：
   - 对象身份（Panel Header）
   - 搜索与分组（Group Switcher）
   - 分区行（Sections with Fields）
   - 常驻动作条（Action Bar）
3. **双模式视觉语言**：
   - BDS/BDI（INI皮肤）- 蓝色选择色，"可编辑"标签
   - BDA（protobuf皮肤）- 品牌色，"仅可编辑项"标签
4. **标签左、控件右、等宽数字右对齐**

## 现有文件结构

- `src/pen-sidebar.css` - 当前属性检查器样式（已经部分应用Pen设计）
- `src/pen-inspector.css` - 检查器通用样式
- `src/pen-inspector-rows.css` - 属性行样式
- `src/pen-inspector-sections.css` - 区块样式
- `src/pen-inspector-panels.css` - 面板特定样式
- `index.html` - 检查器HTML结构（454-654行区域）

## 实施步骤

### 阶段一：CSS变量与基础样式
- [x] 确认设计token（已在 pen-design-application.css）
- [x] 更新行高变量为统一30px
- [x] 添加BDS/BDI vs BDA模式的视觉差异变量

### 阶段二：HTML结构调整
- [x] 优化Panel Header结构（对象类型图标、路径）
- [x] 调整Section Head（12px/600标题 + 9.5px mono提示）
- [x] 统一Field结构（10.5px标签 + 30px输入框）
- [x] 标准化Property Row（28-30px行高，标签左、值右）

### 阶段三：组件级样式
- [x] 更新字段输入框：30px高度，$bg-sunken背景，$font-mono
- [x] 更新属性行：30px高度，12px标签左对齐，值右对齐
- [x] 更新按钮：28px高度，统一圆角
- [x] 更新分段控件（状态切换）
- [x] 更新内边距可视化编辑器

### 阶段四：模式指示器
- [x] 在Panel Header添加BDS/BDI vs BDA模式chip
- [x] BDS/BDI：选择色($sel)，"可编辑"
- [x] BDA：品牌色($brand)，"仅可编辑项"

### 阶段五：Action Bar
- [x] 创建常驻底部动作条
- [x] 模式切换器（选择/移动）
- [x] 主要操作按钮（复制、删除等）

## 设计Token参考（来自Pen设计稿）

```css
/* 颜色 */
$ink: 主文字色
$ink-muted: 次要文字色
$ink-faint: 辅助文字色
$bg-surface: 表面背景
$bg-sunken: 下沉输入框背景
$bg-raised: 抬高背景
$line: 分隔线
$sel: 选择色（BDS/BDI模式）
$sel-soft: 选择色浅色版
$brand: 品牌色（BDA模式）
$brand-soft: 品牌色浅色版

/* 尺寸 */
--row-height: 30px
--field-height: 30px
--action-height: 28px
--section-gap: 20px

/* 圆角 */
$radius-xs: 4px
$radius-sm: 6px
$radius-md: 8px
$radius-lg: 12px

/* 字体 */
$font-ui: 界面字体
$font-mono: 等宽字体
$font-display: 标题字体
```

## 完成标准

- [x] 所有字段统一30px高度
- [x] Panel Header显示对象类型和路径
- [x] Section Head使用12px/600 + 9.5px mono hint
- [x] Property Row使用标签左、值右布局
- [x] BDS/BDI和BDA有明确视觉差异
- [x] 常驻Action Bar在底部
- [x] 响应式适配移动端
