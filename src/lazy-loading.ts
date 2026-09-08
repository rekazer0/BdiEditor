/**
 * 资源懒加载管理
 */

// 图片懒加载观察器
let imageObserver: IntersectionObserver | undefined

export function initLazyLoading(): void {
  if (!("IntersectionObserver" in window)) return

  imageObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement
          const src = img.dataset.src
          if (src) {
            img.src = src
            img.removeAttribute("data-src")
            imageObserver?.unobserve(img)
          }
        }
      })
    },
    {
      rootMargin: "50px",
      threshold: 0.01,
    },
  )
}

export function observeLazyImage(img: HTMLImageElement): void {
  if (imageObserver) {
    imageObserver.observe(img)
  } else {
    // 降级方案：立即加载
    const src = img.dataset.src
    if (src) {
      img.src = src
      img.removeAttribute("data-src")
    }
  }
}

export function unobserveLazyImage(img: HTMLImageElement): void {
  imageObserver?.unobserve(img)
}

// 动态导入模块
export async function lazyLoadModule<T>(
  importFn: () => Promise<T>,
): Promise<T> {
  try {
    return await importFn()
  } catch (error) {
    console.error("Failed to load module:", error)
    throw error
  }
}

// 预加载关键资源
export function preloadCriticalResources(): void {
  // 预加载字体
  if ("fonts" in document) {
    const fonts = [
      'normal 400 11px "PingFang SC"',
      'normal 500 11px "PingFang SC"',
      'normal 600 11px "PingFang SC"',
    ]
    fonts.forEach((font) => {
      document.fonts.load(font).catch(() => {
        // 字体加载失败时静默处理
      })
    })
  }

  // 预加载关键图标
  const criticalImages = ["/icons/phone-globe.png", "/icons/phone-microphone.png"]
  criticalImages.forEach((src) => {
    const img = new Image()
    img.src = src
  })
}

// 资源预取
export function prefetchResource(url: string, as: string = "fetch"): void {
  if ("HTMLLinkElement" in window) {
    const link = document.createElement("link")
    link.rel = "prefetch"
    link.href = url
    link.as = as
    document.head.appendChild(link)
  }
}

// 清理未使用的资源
export function cleanupUnusedResources(): void {
  // 清理已卸载的图片
  const images = document.querySelectorAll("img[data-loaded]")
  images.forEach((img) => {
    if (!img.isConnected) {
      const htmlImg = img as HTMLImageElement
      htmlImg.src = ""
      htmlImg.removeAttribute("data-loaded")
    }
  })
}
