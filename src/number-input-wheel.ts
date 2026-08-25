type NumberInputRoot = Document | HTMLElement

function isEditableNumberInput(target: EventTarget | null): target is HTMLInputElement {
  return target instanceof HTMLInputElement &&
    target.type === "number" &&
    !target.disabled &&
    !target.readOnly
}

/** Install one delegated wheel handler so static and dynamically-created fields share the same behavior. */
export function installNumberInputWheel(root: NumberInputRoot = document): void {
  root.addEventListener("wheel", (event) => {
    if (!isEditableNumberInput(event.target)) return
    const wheel = event as WheelEvent
    if (wheel.deltaY === 0) return
    event.preventDefault()
    if (wheel.deltaY < 0) event.target.stepUp()
    else event.target.stepDown()
    event.target.dispatchEvent(new Event("input", { bubbles: true }))
    event.target.dispatchEvent(new Event("change", { bubbles: true }))
  }, { passive: false })
}
