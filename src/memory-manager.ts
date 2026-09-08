/**
 * 内存管理与优化
 */

// 内存清理调度器
let cleanupScheduled = false
const CLEANUP_INTERVAL = 60000 // 60秒

// WeakMap 用于追踪对象生命周期
const objectRegistry = new WeakMap<object, string>()

// 定期清理
export function scheduleMemoryCleanup(): void {
  if (cleanupScheduled) return
  cleanupScheduled = true

  setInterval(() => {
    performMemoryCleanup()
  }, CLEANUP_INTERVAL)
}

export function performMemoryCleanup(): void {
  // 清理 Canvas 缓存
  cleanupCanvasCache()

  // 清理未使用的 DOM
  cleanupDetachedNodes()

  // 建议垃圾回收（仅在支持的环境中）
  if (typeof global !== "undefined" && "gc" in global) {
    try {
      ;(global as typeof global & { gc(): void }).gc()
    } catch {
      // 忽略错误
    }
  }
}

// Canvas 缓存清理
const canvasCacheMap = new Map<string, { canvas: HTMLCanvasElement; lastUsed: number }>()
const MAX_CANVAS_CACHE_SIZE = 50
const CANVAS_CACHE_TTL = 300000 // 5分钟

export function getCachedCanvas(key: string, width: number, height: number): HTMLCanvasElement {
  const cached = canvasCacheMap.get(key)
  const now = Date.now()

  if (cached && cached.canvas.width === width && cached.canvas.height === height) {
    cached.lastUsed = now
    return cached.canvas
  }

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height

  canvasCacheMap.set(key, { canvas, lastUsed: now })

  // 限制缓存大小
  if (canvasCacheMap.size > MAX_CANVAS_CACHE_SIZE) {
    cleanupCanvasCache()
  }

  return canvas
}

function cleanupCanvasCache(): void {
  const now = Date.now()
  const keysToDelete: string[] = []

  canvasCacheMap.forEach((value, key) => {
    if (now - value.lastUsed > CANVAS_CACHE_TTL) {
      keysToDelete.push(key)
    }
  })

  keysToDelete.forEach((key) => {
    const cached = canvasCacheMap.get(key)
    if (cached) {
      // 释放 Canvas 资源
      cached.canvas.width = 0
      cached.canvas.height = 0
    }
    canvasCacheMap.delete(key)
  })

  console.debug(`Cleaned up ${keysToDelete.length} cached canvases`)
}

// 检测并清理游离节点
function cleanupDetachedNodes(): void {
  // 清理已分离的事件监听器
  const elements = document.querySelectorAll("[data-cleanup]")
  elements.forEach((element) => {
    if (!element.isConnected) {
      element.removeAttribute("data-cleanup")
    }
  })
}

// 图片资源管理
const imageCache = new Map<string, HTMLImageElement>()
const MAX_IMAGE_CACHE_SIZE = 100

export function getCachedImage(src: string): HTMLImageElement | undefined {
  return imageCache.get(src)
}

export function cacheImage(src: string, image: HTMLImageElement): void {
  if (imageCache.size >= MAX_IMAGE_CACHE_SIZE) {
    // 删除最老的图片
    const firstKey = imageCache.keys().next().value
    if (firstKey) {
      const oldImg = imageCache.get(firstKey)
      if (oldImg) {
        oldImg.src = ""
      }
      imageCache.delete(firstKey)
    }
  }
  imageCache.set(src, image)
}

export function clearImageCache(): void {
  imageCache.forEach((img) => {
    img.src = ""
  })
  imageCache.clear()
}

// 注册对象用于调试
export function registerObject(obj: object, label: string): void {
  objectRegistry.set(obj, label)
}

// 内存使用报告
export interface MemoryReport {
  used: number
  total: number
  limit?: number
  percentage: number
  canvasCache: number
  imageCache: number
}

export function getMemoryReport(): MemoryReport | null {
  if ("memory" in performance && performance.memory) {
    const memory = performance.memory as {
      usedJSHeapSize: number
      totalJSHeapSize: number
      jsHeapSizeLimit?: number
    }

    return {
      used: memory.usedJSHeapSize,
      total: memory.totalJSHeapSize,
      limit: memory.jsHeapSizeLimit,
      percentage: (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100,
      canvasCache: canvasCacheMap.size,
      imageCache: imageCache.size,
    }
  }
  return null
}

// 内存压力检测
export function isMemoryPressure(): boolean {
  const report = getMemoryReport()
  if (!report) return false
  return report.percentage > 85 // 超过85%使用率视为内存压力
}

// 在内存压力下强制清理
export function handleMemoryPressure(): void {
  console.warn("Memory pressure detected, performing aggressive cleanup")
  clearImageCache()
  cleanupCanvasCache()
  performMemoryCleanup()
}
