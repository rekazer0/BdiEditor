# 侧边栏 UI 审计与优化建议

## 当前状态分析

### 检查器界面（Inspector）

根据截图和代码分析，当前检查器界面存在以下问题：

#### 1. **布局问题**

**问题描述：**
- 顶部标题区域（"检查器 / py_9.ini · 整体布局"）占用空间过大
- 提示文本"编辑整体属性，或点击画布中的按键单独编辑"字号过小（可能为 9-10px），可读性差
- 标签页切换（属性/源代码/AI设计）与顶部信息视觉层级混乱

**优化建议：**
```css
/* 优化标题区域间距 */
.pane-heading {
  min-height: 42px; /* 从 48px 减小到 42px */
  padding: 7px 12px; /* 从 9px 减小到 7px */
}

/* 提升提示文本可读性 */
.inspector-title p,
.inspector-group-subtitle {
  font-size: 11px; /* 从当前的 9-10px 提升 */
  line-height: 1.4;
  color: var(--secondary);
  opacity: 0.85;
}

/* 优化标题文字层级 */
.inspector-context h2 {
  font-size: 14px; /* 从 13px 增大 */
  font-weight: 600;
  margin-bottom: 2px;
}

.inspector-context #source-name {
  font-size: 10px; /* 从 9px 增大 */
  margin-top: 1px;
}
```

#### 2. **面板/提示栏区域**

**问题描述：**
- "面板" 标签旁边的图标可视性不足
- 输入框（布局名称和类型字段）之间的间距过于紧凑
- 字段标签（"布局名称 (LAYOUT_NAME)" 和 "类型 (TYPE)"）与输入框缺乏明确的视觉分组

**优化建议：**
```css
/* 优化图标标签区域 */
.inspector-title {
  display: flex;
  align-items: center;
  gap: 10px; /* 增加图标与文字间距 */
  padding: 12px;
  border-bottom: 1px solid var(--line-soft);
}

.inspector-title .icon {
  width: 20px;
  height: 20px;
  opacity: 0.7;
}

/* 优化输入框布局 */
.inspector-grid {
  display: grid;
  gap: 14px; /* 从默认的可能更小的值增加到 14px */
  padding: 14px 12px;
}

.inspector-grid label {
  display: flex;
  flex-direction: column;
  gap: 6px; /* 标签与输入框间距 */
}

.inspector-grid label > span:first-child {
  font-size: 11px;
  font-weight: 500;
  color: var(--text);
  letter-spacing: -0.01em;
}

/* 输入框样式优化 */
.inspector-grid input {
  height: 30px; /* 增加到 30px 提升点击区域 */
  padding: 6px 10px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--control);
  font-size: 12px;
  transition: border-color 150ms ease, box-shadow 150ms ease;
}

.inspector-grid input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 15%, transparent);
}
```

#### 3. **扩展区域问题**

**问题描述：**
- 左侧"扩展区域"标签图标不够突出
- 扩展区域内容为空时缺乏占位提示
- 可展开/收起的交互状态不明确

**优化建议：**
```css
/* 扩展区域标签优化 */
.inspector-disclosure {
  border-top: 1px solid var(--line-soft);
}

.inspector-disclosure h3 {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 150ms ease;
  position: relative;
}

.inspector-disclosure h3::before {
  content: '';
  width: 16px;
  height: 16px;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cpath d='M7 5l5 5-5 5' fill='none' stroke='%23888' stroke-width='2'/%3E%3C/svg%3E");
  transition: transform 200ms ease;
}

.inspector-disclosure[open] h3::before {
  transform: rotate(90deg);
}

.inspector-disclosure h3:hover {
  background: var(--hover);
}

/* 空状态提示 */
.inspector-disclosure:not([open]) + .inspector-empty-hint {
  display: block;
  padding: 20px 12px;
  text-align: center;
  color: var(--tertiary);
  font-size: 11px;
}

.inspector-empty-hint {
  display: none;
}
```

---

## 整体设计建议

### 1. **视觉层级优化**

**当前问题：**
- 信息密度过高，缺乏视觉呼吸感
- 不同功能区域间的分隔不够明确

**解决方案：**
```css
/* 增加区域间隔 */
.inspector-group + .inspector-group {
  margin-top: 6px;
  border-top: 1px solid var(--line-soft);
}

/* 优化卡片式布局 */
.inspector-card {
  padding: 12px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--control) 50%, transparent);
  border: 1px solid var(--line-soft);
}

.inspector-card-heading {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 10px;
}

.inspector-card-heading strong {
  font-size: 11px;
  font-weight: 600;
  color: var(--text);
}

.inspector-card-heading span {
  font-size: 9px;
  color: var(--tertiary);
}
```

### 2. **交互状态增强**

**当前问题：**
- 按钮和输入框的悬停/聚焦状态不够明显
- 缺乏视觉反馈

**解决方案：**
```css
/* 统一的悬停状态 */
button:hover:not(:disabled),
.toolbar-button:hover:not(:disabled) {
  background: var(--hover);
  transform: translateY(-0.5px);
  transition: all 150ms ease;
}

button:active:not(:disabled) {
  transform: translateY(0);
  transition: all 80ms ease;
}

/* 禁用状态优化 */
button:disabled,
input:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* 加载状态 */
.loading {
  position: relative;
  pointer-events: none;
}

.loading::after {
  content: '';
  position: absolute;
  inset: 0;
  background: color-mix(in srgb, var(--control) 60%, transparent);
  -webkit-backdrop-filter: blur(4px);
  backdrop-filter: blur(4px);
}
```

### 3. **响应式改进**

**当前问题：**
- 小屏幕设备上信息显示拥挤
- 移动端适配不够充分

**解决方案：**
```css
/* 针对窄侧边栏优化 */
@container (max-width: 280px) {
  .inspector-grid {
    gap: 10px;
  }
  
  .inspector-grid label {
    font-size: 10px;
  }
  
  .inspector-card-heading {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
}

/* 宽屏优化 */
@media (min-width: 1600px) {
  main {
    grid-template-columns: 260px minmax(600px, 1fr) 4px var(--inspector-width, 380px);
  }
  
  .inspector-grid {
    gap: 16px;
  }
}
```

### 4. **深色模式优化**

**当前问题：**
- 深色模式下对比度可能不足
- 边框颜色在深色背景上不够明显

**解决方案：**
```css
:root[data-app-theme="dark"] {
  /* 提升深色模式对比度 */
  --line: rgb(255 255 255 / 14%); /* 从 12% 提升 */
  --line-soft: rgb(255 255 255 / 9%); /* 从 7% 提升 */
  
  /* 优化输入框在深色模式下的可见度 */
  --control: rgb(255 255 255 / 10%); /* 从 8% 提升 */
}

:root[data-app-theme="dark"] input,
:root[data-app-theme="dark"] select {
  border-color: rgb(255 255 255 / 16%);
}

:root[data-app-theme="dark"] input:focus {
  border-color: var(--accent);
  background: rgb(255 255 255 / 12%);
}
```

---

## 可访问性改进

### 1. **键盘导航**

```css
/* 聚焦指示器 */
*:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: 4px;
}

/* 跳过链接 */
.skip-to-content {
  position: absolute;
  top: -100px;
  left: 0;
  padding: 8px 12px;
  background: var(--accent);
  color: white;
  z-index: 1000;
}

.skip-to-content:focus {
  top: 10px;
}
```

### 2. **屏幕阅读器支持**

```html
<!-- 为图标添加 aria-label -->
<button class="toolbar-button" aria-label="面板选项">
  <span class="icon" aria-hidden="true">...</span>
</button>

<!-- 为区域添加 landmark -->
<aside aria-label="文件浏览器" role="complementary">
  ...
</aside>

<section class="source" aria-label="属性检查器" role="region">
  ...
</section>
```

---

## 实施优先级

### 高优先级（立即实施）
1. ✅ 提升提示文本字号到 11px
2. ✅ 增加输入框高度到 30px
3. ✅ 优化输入框聚焦状态
4. ✅ 增加区域间距（gap: 14px）

### 中优先级（2周内）
1. 🟡 实现扩展区域的展开/收起动画
2. 🟡 优化深色模式对比度
3. 🟡 添加卡片式布局
4. 🟡 改进按钮悬停效果

### 低优先级（1个月内）
1. 🔵 响应式改进
2. 🔵 容器查询支持
3. 🔵 加载状态动画
4. 🔵 完善键盘导航

---

## 设计系统建议

建议建立统一的设计 token 系统：

```css
:root {
  /* 间距系统 */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 12px;
  --space-lg: 16px;
  --space-xl: 24px;
  
  /* 字号系统 */
  --text-xs: 9px;
  --text-sm: 10px;
  --text-base: 11px;
  --text-md: 12px;
  --text-lg: 13px;
  --text-xl: 14px;
  
  /* 圆角系统 */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-xl: 10px;
  
  /* 阴影系统 */
  --shadow-sm: 0 1px 3px rgb(0 0 0 / 8%);
  --shadow-md: 0 2px 8px rgb(0 0 0 / 12%);
  --shadow-lg: 0 4px 16px rgb(0 0 0 / 16%);
}
```

---

## 总结

通过以上优化，侧边栏UI将在以下方面得到显著改善：

1. **可读性**：提升文字大小和对比度
2. **可用性**：增加点击区域和视觉反馈
3. **视觉层级**：明确的信息组织和分组
4. **一致性**：统一的设计语言和交互模式
5. **可访问性**：更好的键盘导航和屏幕阅读器支持

建议按优先级逐步实施这些改进，并在每个阶段收集用户反馈进行迭代优化。
