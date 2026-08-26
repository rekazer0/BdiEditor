export function resolveSafeAreaTop(options: {
  measured: number
  cached: number
  keyboardOpen: boolean
  viewportOffsetTop?: number
}): { top: number; cached: number } {
  const measured = Math.max(0, options.measured)
  const cached = measured > 1 ? measured : Math.max(0, options.cached)
  if (options.keyboardOpen && measured <= 1) return { top: cached, cached }
  return { top: measured, cached }
}

export function resolveViewportFrame(options: {
  viewportHeight: number
  viewportOffsetTop: number
  viewportOffsetLeft: number
  viewportWidth: number
  layoutHeight: number
  layoutWidth: number
}): { height: number; width: number; offsetTop: number; offsetLeft: number } {
  return {
    height: Math.max(1, options.viewportHeight || options.layoutHeight),
    width: Math.max(1, options.viewportWidth || options.layoutWidth),
    offsetTop: Math.max(0, options.viewportOffsetTop),
    offsetLeft: Math.max(0, options.viewportOffsetLeft),
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

function revealFocusedInput(): void {
  const active = document.activeElement
  if (!(active instanceof HTMLElement) || !isTextInput(active)) return
  const scroller = active.closest("#quick-inspector, #resource-inspector, #source-editor, aside #files, .source")
  if (!(scroller instanceof HTMLElement)) return
  const viewport = window.visualViewport
  const viewportTop = viewport?.offsetTop ?? 0
  const viewportBottom = viewportTop + (viewport?.height ?? window.innerHeight)
  const scrollerRect = scroller.getBoundingClientRect()
  const activeRect = active.getBoundingClientRect()
  const visibleTop = Math.max(scrollerRect.top, viewportTop) + 8
  const visibleBottom = Math.min(scrollerRect.bottom, viewportBottom) - 8
  if (activeRect.top < visibleTop) scroller.scrollTop -= visibleTop - activeRect.top
  else if (activeRect.bottom > visibleBottom) scroller.scrollTop += activeRect.bottom - visibleBottom
}

export function installSafeAreaLock(root: HTMLElement = document.documentElement): () => void {
  let cached = 0
  const probe = document.createElement("div")
  probe.setAttribute("aria-hidden", "true")
  probe.style.cssText = "position:absolute;left:-9999px;top:0;width:0;height:0;padding-top:env(safe-area-inset-top,0px);visibility:hidden;pointer-events:none"
  root.append(probe)

  const measure = () => Number.parseFloat(getComputedStyle(probe).paddingTop) || 0
  const sync = (reveal = false) => {
    const viewport = window.visualViewport
    const frame = resolveViewportFrame({
      viewportHeight: viewport?.height ?? window.innerHeight,
      viewportOffsetTop: viewport?.offsetTop ?? 0,
      viewportOffsetLeft: viewport?.offsetLeft ?? 0,
      viewportWidth: viewport?.width ?? window.innerWidth,
      layoutHeight: window.innerHeight,
      layoutWidth: window.innerWidth,
    })
    const keyboardOpen = isTextInput(document.activeElement)
    const resolved = resolveSafeAreaTop({
      measured: measure(),
      cached,
      keyboardOpen,
      viewportOffsetTop: frame.offsetTop,
    })
    cached = resolved.cached
    root.style.setProperty("--safe-area-top", `${resolved.top}px`)
    root.style.setProperty("--app-height", `${frame.height}px`)
    root.style.setProperty("--vv-top", `${frame.offsetTop}px`)
    root.style.setProperty("--vv-left", `${frame.offsetLeft}px`)
    root.style.setProperty("--vv-width", `${frame.width}px`)
    root.dataset.keyboardOpen = keyboardOpen ? "true" : "false"
    if (reveal && keyboardOpen) revealFocusedInput()
  }
  const schedule = () => {
    window.requestAnimationFrame(() => sync(false))
  }
  const reveal = () => {
    window.requestAnimationFrame(() => sync(true))
  }

  const listeners: Array<[EventTarget, string, EventListener]> = [
    [window, "resize", schedule],
    [window, "orientationchange", schedule],
    [document, "focusin", reveal],
    [document, "focusout", schedule],
  ]
  const viewport = window.visualViewport
  if (viewport) listeners.push([viewport, "resize", reveal], [viewport, "scroll", reveal])
  for (const [target, type, listener] of listeners) target.addEventListener(type, listener, { passive: true })
  sync(false)
  return () => {
    for (const [target, type, listener] of listeners) target.removeEventListener(type, listener)
    probe.remove()
    delete root.dataset.keyboardOpen
    for (const name of ["--safe-area-top", "--app-height", "--vv-top", "--vv-left", "--vv-width"]) {
      root.style.removeProperty(name)
    }
  }
}
