type NumberInputRoot = Document | HTMLElement
export const NUMBER_WHEEL_IDLE_MS = 350

type WheelSession = {
  field: HTMLInputElement
  token: object
  mixed: boolean
  delta: number
  value: string
  committed: string
  dirty: boolean
  deferred: Map<unknown, () => void>
}
let dispatchSession: WheelSession | undefined
const finishers = new Set<() => void>()
const installed = new WeakSet<NumberInputRoot>()

/** Only synchronous writes caused by our input/change dispatch belong to the gesture. */
export function numberInputGesture(): object | undefined { return dispatchSession?.token }
export function flushNumberInputWheel(): void { for (const finish of finishers) finish() }
export function deferNumberInputRefresh(key: unknown, refresh: () => void): boolean {
  if (!dispatchSession) return false
  dispatchSession.deferred.set(key, refresh)
  return true
}

function isEditableNumberInput(target: EventTarget | null): target is HTMLInputElement {
  return target instanceof HTMLInputElement && target.type === "number" && !target.disabled && !target.readOnly
}

function stepNumber(input: HTMLInputElement, direction: number): void {
  if (input.step !== "any") {
    if (direction > 0) input.stepUp()
    else input.stepDown()
    return
  }
  const value = Number(input.value || 0) + direction
  const min = input.min === "" ? -Infinity : Number(input.min)
  const max = input.max === "" ? Infinity : Number(input.max)
  input.value = String(Math.min(max, Math.max(min, value)))
}

/** Immediate lightweight value feedback; one expensive input/change dispatch per frame. */
export function installNumberInputWheel(root: NumberInputRoot = document, options: {
  isMixed?: (field: HTMLInputElement) => boolean
  moveMixed?: (field: HTMLInputElement, steps: number) => void
} = {}): void {
  if (installed.has(root)) return
  installed.add(root)
  let session: WheelSession | undefined
  let frame = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  const flush = () => {
    if (frame) cancelAnimationFrame(frame)
    frame = 0
    const current = session
    if (!current?.dirty) return
    current.dirty = false
    if (!current.field.isConnected || !isEditableNumberInput(current.field)) return
    const previous = dispatchSession
    dispatchSession = current
    try {
      if (current.mixed) {
        const delta = current.delta
        current.delta = 0
        if (delta) options.moveMixed?.(current.field, delta)
      } else if (current.value !== current.committed) {
        current.field.value = current.value
        current.committed = current.value
        current.field.dispatchEvent(new Event("input", { bubbles: true }))
        current.field.dispatchEvent(new Event("change", { bubbles: true }))
      }
    } finally { dispatchSession = previous }
  }
  const finish = () => {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
    try { flush() } finally {
      const ended = session
      session = undefined
      if (ended) for (const refresh of ended.deferred.values()) refresh()
    }
  }
  finishers.add(finish)
  root.addEventListener("wheel", (event) => {
    const wheel = event as WheelEvent
    if (wheel.defaultPrevented) return
    if (!isEditableNumberInput(wheel.target) || wheel.ctrlKey || wheel.metaKey || !wheel.deltaY) {
      finish()
      return
    }
    wheel.preventDefault()
    const field = wheel.target
    if (session?.field !== field) finish()
    session ??= { field, token: {}, mixed: options.isMixed?.(field) ?? false,
      delta: 0, value: field.value, committed: field.value, dirty: false, deferred: new Map() }
    const direction = wheel.deltaY < 0 ? 1 : -1
    if (session.mixed) session.delta += direction
    else {
      stepNumber(field, direction)
      session.value = field.value
    }
    session.dirty = true
    if (!frame) frame = requestAnimationFrame(flush)
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(finish, NUMBER_WHEEL_IDLE_MS)
  }, { passive: false })
  // Flush before selection, typing, save and undo handlers see the new context.
  root.addEventListener("pointerdown", finish, true)
  root.addEventListener("keydown", finish, true)
  root.addEventListener("focusout", () => { if (!dispatchSession) finish() }, true)
  window.addEventListener("blur", finish)
  document.addEventListener("visibilitychange", () => { if (document.hidden) finish() })
}
