# 性能优化快速指南

## 开发环境性能监控

### 启动应用
```bash
npm run dev
```

启动后会自动：
- ✅ 初始化懒加载
- ✅ 预加载关键资源
- ✅ 启动内存清理调度
- ✅ 开启性能监控（自动输出报告）

### 查看性能报告
打开浏览器控制台，每10秒会自动输出：
```
Performance Report:
- Current FPS: 60
- Average FPS: 58.5
- Render Time: 12.34ms
- Memory: 156.78MB
- Canvas Draws: 42
```

### 手动诊断
在控制台执行：
```javascript
window.__performanceDiagnostics()
```

输出完整诊断信息：
```javascript
{
  memory: {
    used: "156.78 MB",
    total: "512.00 MB",
    percentage: "30.6%",
    canvasCache: 15,
    imageCache: 42
  },
  performance: {
    fps: 60,
    renderTime: "12.34 ms",
    canvasDrawCalls: 42,
    averageFPS: "58.5"
  },
  warnings: [],
  health: "良好"
}
```

## 生产构建

### 构建应用
```bash
npm run build
```

自动应用：
- ✅ 代码分割（编辑器、AI、音频）
- ✅ Tree shaking
- ✅ 压缩优化
- ✅ CSS 分割和最小化

### 预览构建产物
```bash
npm run preview
```

## 常见问题

### Q: 性能监控影响性能吗？
A: 性能监控仅在开发环境启用，生产构建会自动禁用。

### Q: 如何调整缓存大小？
A: 编辑对应的常量：
```typescript
// src/memory-manager.ts
const MAX_CANVAS_CACHE_SIZE = 50  // Canvas 缓存
const MAX_IMAGE_CACHE_SIZE = 100  // 图片缓存

// src/preview.ts
const MAX_NINE_SLICE_CACHE = 100  // 九宫格缓存
```

### Q: 内存占用过高怎么办？
A: 手动触发清理：
```javascript
import { performMemoryCleanup } from './memory-manager'
performMemoryCleanup()
```

### Q: 如何禁用某项优化？
A: 在 `src/performance-init.ts` 中注释相应初始化代码。

## 性能调优技巧

### 1. 减少 Canvas 绘制
```typescript
// 使用缓存
import { getCachedCanvas } from './memory-manager'
const canvas = getCachedCanvas(key, width, height)
```

### 2. 使用防抖和节流
```typescript
import { debounce, throttle } from './performance-utils'

// 防抖 - 输入搜索
const search = debounce((query) => {
  performSearch(query)
}, 300)

// 节流 - 滚动事件
const handleScroll = throttle(() => {
  updateScrollPosition()
}, 100)
```

### 3. 懒加载图片
```typescript
import { observeLazyImage } from './lazy-loading'

const img = new Image()
img.dataset.src = '/path/to/image.png'
observeLazyImage(img)
```

### 4. 性能测量
```typescript
import { measurePerformance } from './performance-monitor'

const result = measurePerformance('loadSkin', () => {
  return loadSkinFromFile(path)
})
```

## 性能警告处理

### FPS 低于 30
**原因**: 渲染负载过高
**解决方案**:
- 减少 Canvas 绘制次数
- 使用缓存
- 优化渲染算法

### 渲染时间 > 16.67ms
**原因**: 单次渲染时间过长
**解决方案**:
- 使用 requestAnimationFrame
- 分批渲染
- 减少 DOM 操作

### 内存使用 > 500MB
**原因**: 内存泄漏或缓存过大
**解决方案**:
- 检查缓存大小
- 手动触发清理
- 检查对象引用

## 开发建议

### ✅ 推荐做法
- 使用提供的性能工具函数
- 定期查看性能报告
- 及时处理性能警告
- 保持依赖更新

### ❌ 避免做法
- 不要创建过多大尺寸 Canvas
- 不要在循环中进行 DOM 操作
- 不要持有大对象的强引用
- 不要禁用自动内存清理

## 调试技巧

### Chrome DevTools
1. **Performance** 面板: 录制性能
2. **Memory** 面板: 查找内存泄漏
3. **Lighthouse**: 综合评分

### 性能分析流程
1. 启动性能监控
2. 执行目标操作
3. 查看性能报告
4. 分析瓶颈
5. 应用优化
6. 验证效果

---

**更多信息**: 参见 [PERFORMANCE-OPTIMIZATION.md](./PERFORMANCE-OPTIMIZATION.md)
