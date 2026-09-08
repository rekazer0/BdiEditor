/**
 * 性能监控与分析
 */

export interface PerformanceMetrics {
  fps: number
  renderTime: number
  memoryUsage: number
  canvasDrawCalls: number
  timestamp: number
}

class PerformanceMonitor {
  private frameCount = 0
  private lastTime = performance.now()
  private fps = 60
  private renderTimes: number[] = []
  private canvasDrawCalls = 0
  private isMonitoring = false
  private rafId: number | undefined
  private metricsHistory: PerformanceMetrics[] = []
  private readonly MAX_HISTORY = 100

  start(): void {
    if (this.isMonitoring) return
    this.isMonitoring = true
    this.lastTime = performance.now()
    this.frameCount = 0
    this.measure()
  }

  stop(): void {
    this.isMonitoring = false
    if (this.rafId) {
      cancelAnimationFrame(this.rafId)
      this.rafId = undefined
    }
  }

  private measure = (): void => {
    if (!this.isMonitoring) return

    const now = performance.now()
    this.frameCount++

    // 每秒计算一次 FPS
    if (now - this.lastTime >= 1000) {
      this.fps = Math.round((this.frameCount * 1000) / (now - this.lastTime))
      this.frameCount = 0
      this.lastTime = now

      // 记录指标
      this.recordMetrics()
    }

    this.rafId = requestAnimationFrame(this.measure)
  }

  private recordMetrics(): void {
    const metrics: PerformanceMetrics = {
      fps: this.fps,
      renderTime: this.getAverageRenderTime(),
      memoryUsage: this.getMemoryUsage(),
      canvasDrawCalls: this.canvasDrawCalls,
      timestamp: Date.now(),
    }

    this.metricsHistory.push(metrics)
    if (this.metricsHistory.length > this.MAX_HISTORY) {
      this.metricsHistory.shift()
    }

    // 重置计数器
    this.canvasDrawCalls = 0
    this.renderTimes = []
  }

  recordRenderTime(time: number): void {
    this.renderTimes.push(time)
  }

  recordCanvasDrawCall(): void {
    this.canvasDrawCalls++
  }

  private getAverageRenderTime(): number {
    if (this.renderTimes.length === 0) return 0
    const sum = this.renderTimes.reduce((a, b) => a + b, 0)
    return sum / this.renderTimes.length
  }

  private getMemoryUsage(): number {
    if ("memory" in performance && performance.memory) {
      const memory = performance.memory as { usedJSHeapSize: number }
      return memory.usedJSHeapSize / (1024 * 1024) // MB
    }
    return 0
  }

  getCurrentMetrics(): PerformanceMetrics {
    return {
      fps: this.fps,
      renderTime: this.getAverageRenderTime(),
      memoryUsage: this.getMemoryUsage(),
      canvasDrawCalls: this.canvasDrawCalls,
      timestamp: Date.now(),
    }
  }

  getMetricsHistory(): PerformanceMetrics[] {
    return [...this.metricsHistory]
  }

  getAverageFPS(): number {
    if (this.metricsHistory.length === 0) return 0
    const sum = this.metricsHistory.reduce((acc, m) => acc + m.fps, 0)
    return sum / this.metricsHistory.length
  }

  isPerformanceGood(): boolean {
    const avgFps = this.getAverageFPS()
    return avgFps >= 30 // 30 FPS 以上视为良好
  }

  getPerformanceReport(): string {
    const metrics = this.getCurrentMetrics()
    const avgFps = this.getAverageFPS()
    return `
Performance Report:
- Current FPS: ${metrics.fps}
- Average FPS: ${avgFps.toFixed(1)}
- Render Time: ${metrics.renderTime.toFixed(2)}ms
- Memory: ${metrics.memoryUsage.toFixed(2)}MB
- Canvas Draws: ${metrics.canvasDrawCalls}
    `.trim()
  }
}

// 单例
export const performanceMonitor = new PerformanceMonitor()

// 性能标记包装器
export function measurePerformance<T>(
  name: string,
  fn: () => T,
): T {
  const startMark = `${name}-start`
  const endMark = `${name}-end`

  performance.mark(startMark)
  const result = fn()
  performance.mark(endMark)

  try {
    performance.measure(name, startMark, endMark)
    const measure = performance.getEntriesByName(name, "measure")[0]
    performanceMonitor.recordRenderTime(measure.duration)
  } catch {
    // 忽略测量错误
  } finally {
    performance.clearMarks(startMark)
    performance.clearMarks(endMark)
    performance.clearMeasures(name)
  }

  return result
}

// 异步性能测量
export async function measurePerformanceAsync<T>(
  name: string,
  fn: () => Promise<T>,
): Promise<T> {
  const startMark = `${name}-start`
  const endMark = `${name}-end`

  performance.mark(startMark)
  try {
    return await fn()
  } finally {
    performance.mark(endMark)
    try {
      performance.measure(name, startMark, endMark)
      const measure = performance.getEntriesByName(name, "measure")[0]
      performanceMonitor.recordRenderTime(measure.duration)
    } catch {
      // 忽略测量错误
    } finally {
      performance.clearMarks(startMark)
      performance.clearMarks(endMark)
      performance.clearMeasures(name)
    }
  }
}

// 导出用于 Canvas 绘制计数
export function trackCanvasDrawCall(): void {
  performanceMonitor.recordCanvasDrawCall()
}

// 性能警告
export function checkPerformanceWarnings(): string[] {
  const warnings: string[] = []
  const metrics = performanceMonitor.getCurrentMetrics()

  if (metrics.fps < 30) {
    warnings.push(`低 FPS: ${metrics.fps} (建议 ≥ 30)`)
  }

  if (metrics.renderTime > 16.67) {
    warnings.push(`渲染时间过长: ${metrics.renderTime.toFixed(2)}ms (建议 < 16.67ms)`)
  }

  if (metrics.memoryUsage > 500) {
    warnings.push(`内存使用较高: ${metrics.memoryUsage.toFixed(2)}MB`)
  }

  return warnings
}
