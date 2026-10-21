// Rows shared by the inspectors that build their properties at run time (Sogou, Palm): the caption
// column and a row of prefixed number boxes (X / Y, W / H, four sides).

import { element } from "../dom-element.ts"
import { isEditing } from "./edit-history"

/** The label column; `key` is the raw field name, kept for filtering and the hover title. */
export function fieldCaption(row: HTMLElement, key: string, label: string): void {
  row.dataset.documentKey = key
  const span = element("span", "document-field-caption")
  span.title = label === key ? key : `${label}（${key}）`
  const name = element("span", "document-field-name")
  name.textContent = label
  span.append(name)
  row.append(span)
}

/** One number box per affix; `onChange` gets every box's value when one of them is committed. */
export function numberParts(row: HTMLElement, label: string, affixes: string[], values: string[], onChange: (values: string[]) => void, columns?: number): void {
  const pair = element("span", "ui-field-pair")
  if (columns) pair.dataset.columns = String(columns)
  affixes.forEach((affix, index) => {
    const box = element("span", "ui-input")
    const prefix = element("span", "ui-input-affix")
    prefix.textContent = affix
    const input = element("input")
    input.type = "number"
    input.step = values.some((value) => value.includes(".")) ? "any" : "1"
    input.value = values[index] ?? ""
    input.disabled = !isEditing()
    input.setAttribute("aria-label", `${label} ${affix}`)
    input.addEventListener("change", () => {
      if (input.value !== "" && Number.isFinite(input.valueAsNumber)) onChange(Array.from(pair.querySelectorAll("input"), (field) => field.value))
    })
    box.append(prefix, input)
    pair.append(box)
  })
  row.append(pair)
}
