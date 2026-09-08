/**
 * 性能优化工具集
 */

// 防抖函数
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  return function (this: unknown, ...args: Parameters<T>) {
    if (timeoutId) clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn.apply(this, args), delay)
  }
}

// 节流函数
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  limit: number,
): (...args: Parameters<T>) => void {
  let inThrottle = false
  return function (this: unknown, ...args: Parameters<T>) {
    if (!inThrottle) {
      fn.apply(this, args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}

// requestAnimationFrame 节流
export function rafThrottle<T extends (...args: unknown[]) => unknown>(
  fn: T,
): (...args: Parameters<T>) => void {
  let rafId: number | undefined
  return function (this: unknown, ...args: Parameters<T>) {
    if (rafId) return
    rafId = requestAnimationFrame(() => {
      fn.apply(this, args)
      rafId = undefined
    })
  }
}

// Canvas 渲染缓存
const canvasCache = new Map<string, HTMLCanvasElement>()

export function getOrCreateCanvas(key: string, width: number, height: number): HTMLCanvasElement {
  let canvas = canvasCache.get(key)
  if (!canvas) {
    canvas = document.createElement("canvas")
    canvasCache.set(key, canvas)
  }
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }
  return canvas
}

export function clearCanvasCache(key?: string): void {
  if (key) {
    canvasCache.delete(key)
  } else {
    canvasCache.clear()
  }
}

// 图片预加载
export function preloadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

// 批量图片预加载
export async function preloadImages(sources: string[]): Promise<HTMLImageElement[]> {
  return Promise.all(sources.map(preloadImage))
}

// 对象池
export class ObjectPool<T> {
  private available: T[] = []
  private inUse = new Set<T>()

  constructor(
    private create: () => T,
    private reset: (obj: T) => void,
    initialSize = 0,
  ) {
    for (let i = 0; i < initialSize; i++) {
      this.available.push(this.create())
    }
  }

  acquire(): T {
    let obj = this.available.pop()
    if (!obj) {
      obj = this.create()
    }
    this.inUse.add(obj)
    return obj
  }

  release(obj: T): void {
    if (this.inUse.delete(obj)) {
      this.reset(obj)
      this.available.push(obj)
    }
  }

  clear(): void {
    this.available = []
    this.inUse.clear()
  }

  get size(): number {
    return this.available.length + this.inUse.size
  }
}

// 内存监控
export function measureMemory(): { used: number; total: number } | null {
  if ("memory" in performance && performance.memory) {
    const memory = performance.memory as {
      usedJSHeapSize: number
      totalJSHeapSize: number
    }
    return {
      used: memory.usedJSHeapSize,
      total: memory.totalJSHeapSize,
    }
  }
  return null
}

// 性能标记
export function mark(name: string): void {
  if (performance.mark) {
    performance.mark(name)
  }
}

export function measure(name: string, startMark: string, endMark?: string): number | null {
  if (performance.measure && performance.getEntriesByName) {
    try {
      performance.measure(name, startMark, endMark)
      const measures = performance.getEntriesByName(name, "measure")
      return measures.length > 0 ? measures[measures.length - 1].duration : null
    } catch {
      return null
    }
  }
  return null
}

// 清理性能标记
export function clearMarks(name?: string): void {
  if (performance.clearMarks) {
    performance.clearMarks(name)
  }
  if (performance.clearMeasures) {
    performance.clearMeasures(name)
  }
}
