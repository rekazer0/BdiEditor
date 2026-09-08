# 性能优化总结

本次对 bdi-edit 项目进行了全面的性能优化，涵盖构建配置、运行时性能、内存管理和渲染优化等多个方面。

## 优化内容

### 1. Vite 构建优化 (vite.config.ts)

#### 代码分割
- **编辑器模块**: 将 CodeMirror 相关依赖打包为独立 chunk
- **AI 功能**: 将 AI 相关依赖分离，减少主包体积
- **音频处理**: 独立音频解码器模块

#### 构建配置
- 启用 ES2022 目标，利用现代浏览器特性
- CSS 代码分割，按需加载样式
- 模块预加载优化
- Terser 压缩配置，移除 debug 日志

#### 依赖预构建
- 预构建常用依赖，提升开发体验
- 优化依赖解析速度

### 2. Canvas 渲染优化 (src/preview.ts)

#### 九宫格渲染缓存
- 实现九宫格图像缓存机制
- 避免重复渲染相同尺寸的切片
- LRU 策略限制缓存大小（100项）

```typescript
const cacheKey = `${visual.image.src}-${sx}-${sy}-${sw}-${sh}-${ix}-${iy}-${iw}-${ih}-${width}-${height}`
```

### 3. 性能工具集 (src/performance-utils.ts)

#### 函数优化
- **防抖 (debounce)**: 延迟执行，适用于搜索、调整大小等场景
- **节流 (throttle)**: 限制执行频率，适用于滚动、拖动等高频事件
- **RAF 节流 (rafThrottle)**: 利用 requestAnimationFrame 优化动画

#### Canvas 缓存管理
- Canvas 对象池
- 统一的缓存获取接口
- 缓存清理机制

#### 性能标记
- 封装 Performance API
- 支持性能测量和分析

### 4. 懒加载管理 (src/lazy-loading.ts)

#### 图片懒加载
- IntersectionObserver 实现可见性检测
- 50px rootMargin 预加载
- 降级方案支持

#### 关键资源预加载
- 预加载字体（PingFang SC）
- 预加载关键图标
- DNS 预连接优化

#### 模块动态导入
- 封装动态 import
- 错误处理机制

### 5. 内存管理 (src/memory-manager.ts)

#### 定期清理
- 60秒周期自动清理
- Canvas 缓存 TTL 管理（5分钟）
- 图片缓存大小限制（100张）

#### 内存监控
- 实时内存使用报告
- 内存压力检测（85%阈值）
- 自动触发清理

#### 资源管理
- WeakMap 追踪对象生命周期
- 游离节点检测
- 主动释放未使用资源

### 6. 性能监控 (src/performance-monitor.ts)

#### FPS 监控
- 实时帧率计算
- 历史数据记录（100条）
- 平均 FPS 统计

#### 渲染时间分析
- 记录每次渲染耗时
- 平均渲染时间计算
- Canvas 绘制次数统计

#### 性能报告
- 内存使用情况
- FPS 和渲染时间
- 性能警告检测

### 7. CSS 性能优化 (src/style-performance.css)

#### GPU 加速
- `transform: translateZ(0)` 提升层级
- `will-change` 优化关键元素
- `backface-visibility: hidden` 避免闪烁

#### 滚动优化
- `-webkit-overflow-scrolling: touch` 平滑滚动
- `scroll-behavior: smooth` 原生平滑

#### 渲染优化
- `contain` 属性限制重排范围
- 字体平滑渲染
- 减少动画（尊重用户偏好）

### 8. 集成初始化 (src/performance-init.ts)

#### 自动初始化
- 懒加载初始化
- 内存清理调度
- 性能监控启动（开发环境）

#### 页面可见性优化
- 隐藏时停止监控
- 显示时恢复监控

#### 开发工具
- `window.__performanceDiagnostics()` 诊断接口
- 自动输出性能报告
- 警告提示

### 9. HTML 优化 (index.html)

- DNS 预解析
- 预连接 GitHub API

## 性能指标

### 优化前预期问题
- 大量 Canvas 重绘
- 未缓存的九宫格渲染
- 无懒加载机制
- 内存泄漏风险

### 优化后预期提升
- **首屏加载**: 减少 30-40% 加载时间
- **运行时性能**: FPS 提升至 60fps
- **内存使用**: 降低 20-30% 峰值内存
- **Canvas 性能**: 减少 50%+ 重复绘制

## 使用方法

### 开发环境
```bash
npm run dev
```

自动启用性能监控，每10秒输出性能报告到控制台。

### 生产构建
```bash
npm run build
```

应用所有优化，生成最小化包。

### 性能诊断
在浏览器控制台执行：
```javascript
window.__performanceDiagnostics()
```

输出详细的性能和内存使用情况。

## 最佳实践

### 1. 避免不必要的渲染
- 检查 Canvas 尺寸变化
- 使用缓存减少重复计算

### 2. 合理使用防抖和节流
```typescript
import { debounce, throttle } from './performance-utils'

// 搜索输入使用防抖
const handleSearch = debounce((query) => {
  // 搜索逻辑
}, 300)

// 滚动事件使用节流
const handleScroll = throttle(() => {
  // 滚动处理
}, 100)
```

### 3. 内存管理
- 及时释放大对象
- 避免闭包陷阱
- 监控内存使用

### 4. 异步操作优化
```typescript
import { measurePerformanceAsync } from './performance-monitor'

const result = await measurePerformanceAsync('loadSkin', async () => {
  return await loadSkin(path)
})
```

## 监控和调试

### 性能监控
```typescript
import { performanceMonitor } from './performance-monitor'

// 启动监控
performanceMonitor.start()

// 获取当前指标
const metrics = performanceMonitor.getCurrentMetrics()
console.log(metrics)

// 停止监控
performanceMonitor.stop()
```

### 内存报告
```typescript
import { getMemoryReport } from './memory-manager'

const report = getMemoryReport()
if (report) {
  console.log(`内存使用: ${report.percentage.toFixed(1)}%`)
}
```

## 注意事项

1. **缓存大小**: 各缓存都有大小限制，避免无限增长
2. **开发环境**: 性能监控仅在开发环境自动启用
3. **浏览器兼容**: 部分 API（如 Performance Memory）仅 Chromium 支持
4. **降级方案**: 不支持的 API 会静默降级

## 后续优化方向

1. **虚拟滚动**: 对长列表实现虚拟滚动
2. **Web Worker**: 将计算密集任务移到 Worker
3. **离线缓存**: Service Worker 实现离线支持
4. **增量渲染**: 大皮肤分块渲染
5. **代码分析**: Webpack Bundle Analyzer 优化包体积

## 验证方法

### Chrome DevTools
1. **Performance**: 录制加载和交互性能
2. **Memory**: 堆快照对比内存泄漏
3. **Lighthouse**: 综合性能评分

### 性能基准
- FPS ≥ 30（流畅）
- 首屏加载 < 2s
- 内存使用 < 500MB
- 无明显卡顿

---

**优化完成时间**: 2026-09-08  
**优化范围**: 构建配置、运行时性能、内存管理、渲染优化  
**预期提升**: 30-50% 性能提升
