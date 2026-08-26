export function resolveSafeAreaTop(options: {
  measured: number
  cached: number
  keyboardOpen: boolean
}): { top: number; cached: number } {
  const measured = Math.max(0, options.measured)
  const cached = measured > 1 ? measured : Math.max(0, options.cached)
  return {
    top: options.keyboardOpen ? Math.max(measured, cached) : measured,
    cached,
  }
}

export function isTextInput(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true
  if (target instanceof HTMLInputElement) {
    return !["button", "checkbox", "radio", "file", "submit", "reset", "hidden", "image", "range", "color"].includes(target.type)
  }
  return Boolean(target.closest?.(".cm-content, .cm-editor"))
}

export function installSafeAreaLock(root: HTMLElement = document.documentElement): () => void {
  let cached = 0
  const probe = document.createElement("div")
  probe.setAttribute("aria-hidden", "true")
  probe.style.cssText = "position:absolute;left:-9999px;top:0;width:0;height:0;padding-top:env(safe-area-inset-top,0px);visibility:hidden;pointer-events:none"
  root.append(probe)

  const measure = () => Number.parseFloat(getComputedStyle(probe).paddingTop) || 0
  const pinScroll = () => {
    const scroller = document.scrollingElement
    if (scroller && (scroller.scrollTop || scroller.scrollLeft)) {
      scroller.scrollTop = 0
      scroller.scrollLeft = 0
    }
    if (window.scrollX || window.scrollY) window.scrollTo(0, 0)
  }
  const sync = () => {
    pinScroll()
    const resolved = resolveSafeAreaTop({
      measured: measure(),
      cached,
      keyboardOpen: isTextInput(document.activeElement),
    })
    cached = resolved.cached
    root.style.setProperty("--safe-area-top", `${resolved.top}px`)
  }
  const schedule = () => {
    window.requestAnimationFrame(sync)
  }

  const listeners: Array<[EventTarget, string]> = [
    [window, "resize"],
    [window, "orientationchange"],
    [window, "scroll"],
    [document, "focusin"],
    [document, "focusout"],
  ]
  const viewport = window.visualViewport
  if (viewport) listeners.push([viewport, "resize"], [viewport, "scroll"])
  for (const [target, type] of listeners) target.addEventListener(type, schedule, { passive: true })
  sync()
  return () => {
    for (const [target, type] of listeners) target.removeEventListener(type, schedule)
    probe.remove()
    root.style.removeProperty("--safe-area-top")
  }
}
