/**
 * 性能优化入口
 * 在应用启动时初始化所有性能优化功能
 */

import { initLazyLoading, preloadCriticalResources } from "./lazy-loading"
import { scheduleMemoryCleanup, getMemoryReport, handleMemoryPressure, isMemoryPressure } from "./memory-manager"
import { performanceMonitor, checkPerformanceWarnings } from "./performance-monitor"

let performanceOptimizationInitialized = false

export function initPerformanceOptimization(): void {
  if (performanceOptimizationInitialized) return
  performanceOptimizationInitialized = true

  // 1. 初始化懒加载
  initLazyLoading()

  // 2. 预加载关键资源
  preloadCriticalResources()

  // 3. 启动内存清理调度
  scheduleMemoryCleanup()

  // 4. 启动性能监控（仅开发环境）
  // @ts-ignore - Vite 注入的环境变量
  const isDev = typeof import.meta.env !== "undefined" && import.meta.env.DEV === true
  if (isDev) {
    performanceMonitor.start()

    // 定期输出性能报告
    setInterval(() => {
      console.log(performanceMonitor.getPerformanceReport())

      const warnings = checkPerformanceWarnings()
      if (warnings.length > 0) {
        console.warn("性能警告:", warnings.join(", "))
      }
    }, 10000) // 每10秒
  }

  // 5. 监听内存压力
  setInterval(() => {
    if (isMemoryPressure()) {
      handleMemoryPressure()
    }
  }, 30000) // 每30秒检查一次

  // 6. 页面可见性变化优化
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      // 页面隐藏时停止性能监控
      performanceMonitor.stop()
    } else {
      // 页面显示时恢复
      if (isDev) {
        performanceMonitor.start()
      }
    }
  })

  // 7. 输出初始内存状态
  const memoryReport = getMemoryReport()
  if (memoryReport) {
    console.log("初始内存状态:", {
      used: `${(memoryReport.used / (1024 * 1024)).toFixed(2)} MB`,
      total: `${(memoryReport.total / (1024 * 1024)).toFixed(2)} MB`,
      percentage: `${memoryReport.percentage.toFixed(1)}%`,
    })
  }

  console.log("✅ 性能优化已启用")
}

// 获取性能诊断信息
export function getPerformanceDiagnostics() {
  const memoryReport = getMemoryReport()
  const metrics = performanceMonitor.getCurrentMetrics()
  const warnings = checkPerformanceWarnings()

  return {
    memory: memoryReport
      ? {
          used: `${(memoryReport.used / (1024 * 1024)).toFixed(2)} MB`,
          total: `${(memoryReport.total / (1024 * 1024)).toFixed(2)} MB`,
          percentage: `${memoryReport.percentage.toFixed(1)}%`,
          canvasCache: memoryReport.canvasCache,
          imageCache: memoryReport.imageCache,
        }
      : null,
    performance: {
      fps: metrics.fps,
      renderTime: `${metrics.renderTime.toFixed(2)} ms`,
      canvasDrawCalls: metrics.canvasDrawCalls,
      averageFPS: performanceMonitor.getAverageFPS().toFixed(1),
    },
    warnings,
    health: warnings.length === 0 ? "良好" : "需要关注",
  }
}

// 导出到 window 以便调试
if (typeof window !== "undefined") {
  ;(window as { __performanceDiagnostics?: () => void }).__performanceDiagnostics = () => {
    console.log("性能诊断:", getPerformanceDiagnostics())
  }
}
