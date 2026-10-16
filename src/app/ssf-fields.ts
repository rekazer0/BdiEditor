// Property rows for Sogou INI sections: image pairs drawn as style cards, colours, four-part rectangles
// and plain values. Every row writes straight to its Sogou file and is one undo step.

import { drawVisualPreview, pngBitmap, retinaThumbnail, type Visual } from "../atlas.ts"
import { createIcon } from "../icons"
import { IniDocument } from "../ini.ts"
import { ssfFieldLabel, ssfSectionLabel } from "../ssf/ssf-labels.ts"
import { parseSsfImage, type SsfStretch } from "../ssf/ssf-package.ts"
import { setSourceValue } from "./config-context"
import { commitText, isEditing, updateDirty } from "./edit-history"
import { populateKeyInspector } from "./key-inspector"
import { refreshPreview } from "./preview-render"
import { openImageResourceChooser } from "./resource-inspector"
import { sourceEditPath, ssfDocument, ssfPackage, ssfTheme } from "./ssf-documents"
import { rebuildSsfPreview } from "./ssf-preview"
import { appState } from "./state"
import { styleKindBadge } from "./style-picker"

export type SsfEntry = { key: string; value: string }

/** State images that follow NORMAL / PRESSED when those are replaced and still show the same file. */
const LINKED_STATES: Record<string, string[]> = { NORMAL: ["DISABLED", "NORMAL_ON"], PRESSED: ["PRESSED_ON"] }
export const IMAGE_STATES = ["NORMAL", "PRESSED", "DISABLED", "NORMAL_ON", "PRESSED_ON", "FOCUSED"]
const QUADS: Record<string, string[]> = {
  FG_RECT: ["X", "Y", "W", "H"],
  ICON_RECT: ["←", "↑", "→", "↓"],
  LABEL_POSITION: ["←", "↑", "→", "↓"],
  MINOR_LABEL_POSITION: ["←", "↑", "→", "↓"],
  MARGINS: ["←", "↑", "→", "↓"],
  PADDINGS: ["←", "↑", "→", "↓"],
}
const COLOR_VALUE = /^(?:0x|#)?([0-9a-f]{6}|[0-9a-f]{8})$/i

function element<K extends keyof HTMLElementTagNameMap>(name: K, className?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(name)
  if (className) node.className = className
  return node
}

/**
 * Applies `change` to one Sogou file as a single undo step, then redraws the canvas from the edited
 * skin right away (the inspector is not typing, so it skips the preview's debounce).
 */
export function editSsfFile(path: string, change: (document: IniDocument) => void): void {
  const archive = appState.archive
  if (!archive || archive.format !== "ssf" || !isEditing()) return
  const before = archive.isText(path) ? archive.getText(path) : ""
  const document = IniDocument.parse(before)
  change(document)
  const after = document.toString()
  if (after === before) return
  commitText(path, before, after)
  if (appState.selectedPath === path) appState.selectedDocument = IniDocument.parse(after)
  if (sourceEditPath() === path) setSourceValue(after)
  rebuildSsfPreview()
  refreshPreview()
  populateKeyInspector()
  updateDirty()
}

/** Sets a value, adding the section at the end of the file when it does not exist yet. */
export function setSsfValue(document: IniDocument, section: string, key: string, value: string): void {
  if (document.sections().includes(section)) document.set(section, key, value)
  else document.appendSection(section, [{ key, value }])
}

/** One value per key: duplicate sections are read like IniDocument.get, the first definition wins. */
export function ssfEntries(path: string, section: string): SsfEntry[] {
  const seen = new Set<string>()
  return ssfDocument(path).entries(section).flatMap(({ key, value }) => {
    if (seen.has(key)) return []
    seen.add(key)
    return [{ key, value }]
  })
}

/** A section name not used in `document`, derived from `base`. */
export function freeSectionName(document: IniDocument, base: string): string {
  const taken = new Set(document.sections())
  for (let index = 1; ; index += 1) {
    const name = index === 1 ? base : `${base}_${index}`
    if (!taken.has(name)) return name
  }
}

// Thumbnails decode images; a file's whole phoneSkin.ini has hundreds, so only visible ones are drawn.
const pendingThumbnails = new WeakMap<HTMLCanvasElement, () => Promise<Visual | undefined>>()
const thumbnailObserver = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue
    const canvas = entry.target as HTMLCanvasElement
    thumbnailObserver.unobserve(canvas)
    const load = pendingThumbnails.get(canvas)
    pendingThumbnails.delete(canvas)
    void load?.().then((visual) => {
      if (!canvas.isConnected) return
      retinaThumbnail(canvas, canvas.clientWidth || 76, canvas.clientHeight || 38)
      drawVisualPreview(canvas, [visual], false)
    })
  }
})

/** The image a Sogou value names, fitted whole into a thumbnail. */
async function imageVisual(value: string | undefined): Promise<Visual | undefined> {
  const ref = parseSsfImage(value)
  const bytes = ref && ssfPackage()?.file(ssfTheme(), ref.file)
  const image = bytes && await pngBitmap(bytes)
  return image ? { image, source: [0, 0, image.width, image.height] } : undefined
}

function thumbnail(value: string | undefined): HTMLCanvasElement {
  const canvas = element("canvas")
  canvas.setAttribute("aria-hidden", "true")
  pendingThumbnails.set(canvas, () => imageVisual(value))
  thumbnailObserver.observe(canvas)
  return canvas
}

function caption(row: HTMLElement, key: string, label = ssfFieldLabel(key)): void {
  row.dataset.documentKey = key
  const span = element("span", "document-field-caption")
  span.title = label === key ? key : `${label}（${key}）`
  const name = element("span", "document-field-name")
  name.textContent = label
  span.append(name)
  row.append(span)
}

/** Replaces the file of an image value and keeps its stretch band. */
function withFile(value: string | undefined, file: string): string {
  const rest = value?.split(",").slice(1) ?? []
  return [file, ...rest].join(",")
}

/** Chooses an image of the skin for one state and writes it, keeping the stretch band. */
function chooseImage(path: string, section: string, key: string, current: string | undefined): void {
  if (!isEditing()) return
  openImageResourceChooser((resourceID) => {
    const file = /\.\w+$/.test(resourceID) ? resourceID : `${resourceID}.png`
    editSsfFile(path, (document) => {
      for (const linked of [key, ...LINKED_STATES[key] ?? []]) {
        const old = document.get(section, linked)
        if (linked === key || old !== undefined && old === current) setSsfValue(document, section, linked, withFile(old ?? current, file))
      }
    })
  })
}

export type CardReference = { path: string; section: string; key: string }

/**
 * The shared style card (DESIGN.md §10): the name on the left is the section this card shows (typing
 * re-points `reference`, the key field naming it); the previews on the right pick each state's image.
 */
export function imageCard(label: string, path: string, section: string, keys: [string, string], reference?: CardReference): HTMLElement {
  const document = ssfDocument(path)
  const row = element("div", "document-property-field wide style-reference-field")
  caption(row, keys[0], label)
  const wrapper = element("span", "style-reference-input")
  const trigger = element("span", "style-picker-trigger")
  const card = element("div", "style-reference-row")
  const meta = element("span", "style-reference-meta")
  const name = element("input", "style-reference-number style-reference-name")
  name.value = reference ? ssfDocument(reference.path).get(reference.section, reference.key)?.split(",")[0].trim() ?? section : section
  name.readOnly = !reference
  name.disabled = !isEditing()
  name.title = `${path} · [${section}]`
  name.setAttribute("aria-label", `${label}引用的样式段`)
  if (reference) {
    name.addEventListener("change", () => {
      const value = name.value.trim()
      if (value) editSsfFile(reference.path, (target) => setSsfValue(target, reference.section, reference.key, value))
    })
  }
  meta.append(name, styleKindBadge("image"))
  const states = element("span", "style-picker-states")
  const normal = document.get(section, keys[0])
  for (const [index, key] of keys.entries()) {
    const value = document.get(section, key) ?? (index ? normal : undefined)
    const state = element("button", "style-picker-state")
    state.type = "button"
    state.dataset.styleState = index ? "highlighted" : "normal"
    state.title = `${index ? "按下" : "正常"}：${value?.split(",")[0] ?? "未设置"}（点击更换图片）`
    state.setAttribute("aria-label", state.title)
    state.disabled = !isEditing()
    state.append(thumbnail(value))
    state.addEventListener("click", () => chooseImage(path, section, key, value))
    states.append(state)
  }
  card.append(meta, states)
  trigger.append(card)
  wrapper.append(trigger)
  row.append(wrapper)
  return row
}

function numberParts(row: HTMLElement, key: string, affixes: string[], values: string[], onChange: (values: string[]) => void): void {
  const pair = element("span", "ui-field-pair")
  affixes.forEach((affix, index) => {
    const box = element("span", "ui-input")
    const prefix = element("span", "ui-input-affix")
    prefix.textContent = affix
    const input = element("input")
    input.type = "number"
    input.step = values.some((value) => value.includes(".")) ? "any" : "1"
    input.value = values[index] ?? ""
    input.disabled = !isEditing()
    input.setAttribute("aria-label", `${ssfFieldLabel(key)} ${affix}`)
    input.addEventListener("change", () => {
      const next = [...values]
      next[index] = input.value
      onChange(next)
    })
    box.append(prefix, input)
    pair.append(box)
  })
  row.append(pair)
}

/** The stretch band shared by a section's state images: Sogou's order is left, right, top, bottom. */
export function stretchField(path: string, section: string): HTMLElement | undefined {
  const document = ssfDocument(path)
  const stretch = parseSsfImage(document.get(section, "NORMAL"))?.stretch
  if (!stretch) return
  const row = element("label", "document-property-field wide")
  caption(row, "STRETCH", "拉伸区域")
  row.title = "九宫格可拉伸的像素区间：左、右、上、下"
  numberParts(row, "STRETCH", ["左", "右", "上", "下"], stretch.map(String), (values) => {
    const next = values.map(Number) as SsfStretch
    if (next.some((value) => !Number.isInteger(value)) || next[0] >= next[1] || next[2] >= next[3]) return
    editSsfFile(path, (target) => {
      for (const key of IMAGE_STATES) {
        const value = target.get(section, key)
        const file = value && parseSsfImage(value)?.file
        if (file) target.set(section, key, [file, ...next].join(","))
      }
    })
  })
  return row
}

function colorField(path: string, section: string, key: string, value: string): HTMLElement {
  const row = element("label", "document-property-field")
  caption(row, key)
  const hex = value.trim().match(COLOR_VALUE)?.[1].toUpperCase() ?? "FF000000"
  const argb = hex.length === 6 ? `FF${hex}` : hex
  const control = element("span", "color-control ui-input ui-color")
  const picker = element("input")
  picker.type = "color"
  picker.value = `#${argb.slice(2)}`
  picker.setAttribute("aria-label", ssfFieldLabel(key))
  const text = element("input")
  text.value = value
  text.setAttribute("aria-label", `${ssfFieldLabel(key)}值`)
  const alpha = element("input")
  alpha.type = "number"
  alpha.min = "0"
  alpha.max = "1"
  alpha.step = "0.01"
  alpha.value = String(Math.round(Number.parseInt(argb.slice(0, 2), 16) / 255 * 100) / 100)
  alpha.setAttribute("aria-label", `${ssfFieldLabel(key)}透明度`)
  for (const input of [picker, text, alpha]) input.disabled = !isEditing()
  const write = (next: string) => editSsfFile(path, (document) => setSsfValue(document, section, key, next))
  const fromControls = () => {
    const alphaHex = Math.round(Math.max(0, Math.min(1, Number(alpha.value) || 0)) * 255).toString(16).padStart(2, "0")
    write(`0x${alphaHex}${picker.value.slice(1)}`.toUpperCase().replace(/^0X/, "0x"))
  }
  picker.addEventListener("change", fromControls)
  alpha.addEventListener("change", fromControls)
  text.addEventListener("change", () => { if (COLOR_VALUE.test(text.value.trim())) write(text.value.trim()) })
  control.append(picker, text, alpha)
  row.append(control)
  return row
}

function valueInput(path: string, section: string, key: string, value: string): HTMLInputElement {
  const input = element("input", "document-property-input")
  input.value = value
  input.title = `${ssfFieldLabel(key)}：${value}`
  input.disabled = !isEditing()
  input.setAttribute("aria-label", ssfFieldLabel(key))
  input.addEventListener("change", () => editSsfFile(path, (document) => setSsfValue(document, section, key, input.value)))
  return input
}

function textField(path: string, section: string, key: string, value: string, options?: string[]): HTMLElement {
  const row = element("label", "document-property-field")
  if (value.length > 18 || options) row.classList.add("wide")
  caption(row, key)
  const input = valueInput(path, section, key, value)
  if (options?.length) {
    const list = element("datalist")
    list.id = `ssf-options-${section}-${key}`.replace(/[^\w-]/g, "_")
    list.append(...options.map((option) => Object.assign(element("option"), { value: option })))
    input.setAttribute("list", list.id)
    row.append(list)
  }
  row.append(input)
  return row
}

/** A stand-alone image value (DISABLED, BG_IMAGE=bg.png, pic_path…): its thumbnail picks another image. */
function imageField(path: string, section: string, key: string, value: string): HTMLElement {
  const row = element("label", "document-property-field wide")
  caption(row, key)
  const box = element("span", "ui-input")
  const pick = element("button", "ui-input-affix ssf-image-affix")
  pick.type = "button"
  pick.title = `更换${ssfFieldLabel(key)}`
  pick.setAttribute("aria-label", pick.title)
  pick.disabled = !isEditing()
  pick.append(thumbnail(value))
  pick.addEventListener("click", (event) => {
    event.preventDefault()
    chooseImage(path, section, key, value)
  })
  box.append(pick, valueInput(path, section, key, value))
  row.append(box)
  return row
}

/** One row for any Sogou value, chosen by what the value is. `options` suggests values (sound names). */
export function ssfField(path: string, section: string, entry: SsfEntry, options?: string[]): HTMLElement {
  const { key, value } = entry
  const quad = QUADS[key]
  const parts = value.split(",").map((part) => part.trim())
  if (quad && parts.length === quad.length) {
    const row = element("label", "document-property-field wide")
    caption(row, key)
    numberParts(row, key, quad, parts, (values) => editSsfFile(path, (document) => setSsfValue(document, section, key, values.join(","))))
    return row
  }
  if (/COLOR/i.test(key) && COLOR_VALUE.test(value.trim())) return colorField(path, section, key, value)
  if (parseSsfImage(value)) return imageField(path, section, key, value)
  return textField(path, section, key, value, options)
}

export type SsfBlock = {
  path: string
  section: string
  /** Subheading; defaults to the section's Chinese name. */
  title?: string
  /** Keys shown elsewhere (in a card above) and left out of the rows. */
  omit?: string[]
  /** When set, the only keys this block shows; the rest of the section belongs to another group. */
  only?: string[]
  /** Entries a missing section is created with by its "添加" button (none: the block shows its note and actions only); without a template a missing block is skipped. */
  template?: SsfEntry[]
  note?: string
  actions?: HTMLElement[]
  /** The field naming this block's image section, editable in its card. */
  reference?: CardReference
  options?: Record<string, string[]>
}

export function ssfButton(label: string, icon: string, onClick: () => void): HTMLButtonElement {
  const button = element("button", "ui-button")
  button.type = "button"
  button.dataset.size = "sm"
  button.append(createIcon(icon, 14), label)
  button.disabled = !isEditing()
  button.addEventListener("click", onClick)
  return button
}

function blockHeading(block: SsfBlock): HTMLElement {
  const heading = element("h4", "ssf-block-heading")
  const title = element("span")
  title.textContent = block.title ?? ssfSectionLabel(block.section)
  heading.append(title)
  const code = element("code")
  code.textContent = `${block.path.split("/").pop()} · [${block.section}]`
  code.title = block.path
  heading.append(code)
  return heading
}

/** Rows of one section: its image pairs as cards, the stretch band, then every other value. */
export function renderBlock(block: SsfBlock, showHeading: boolean): HTMLElement[] {
  const nodes: HTMLElement[] = []
  const exists = ssfDocument(block.path).sections().includes(block.section)
  if (!exists && !block.template) return nodes
  if (showHeading) nodes.push(blockHeading(block))
  if (block.note) {
    const note = element("p", "inspector-group-subtitle")
    note.textContent = block.note
    nodes.push(note)
  }
  const actions = [...block.actions ?? []]
  const template = block.template
  if (!exists && template?.length) {
    actions.unshift(ssfButton("添加", "plus", () => editSsfFile(block.path, (document) => document.appendSection(block.section, template))))
  }
  if (actions.length) {
    const row = element("div", "ssf-block-actions")
    row.append(...actions)
    nodes.push(row)
  }
  if (!exists) return nodes
  const entries = ssfEntries(block.path, block.section).filter((entry) => !block.only || block.only.includes(entry.key))
  const keys = new Set(entries.map((entry) => entry.key))
  const grid = element("div", "document-property-grid")
  const used = new Set(block.omit ?? [])
  for (const [normal, pressed, label] of [["NORMAL", "PRESSED", "图片"], ["ICON", "ICON_PRESSED", "图标"]] as const) {
    if (used.has(normal) || !keys.has(normal) || !parseSsfImage(entries.find((entry) => entry.key === normal)?.value)) continue
    grid.append(imageCard(label, block.path, block.section, [normal, pressed], normal === "NORMAL" ? block.reference : undefined))
    used.add(normal).add(pressed)
    if (normal === "NORMAL") {
      const stretch = stretchField(block.path, block.section)
      if (stretch) grid.append(stretch)
    }
  }
  for (const entry of entries) {
    if (used.has(entry.key)) continue
    grid.append(ssfField(block.path, block.section, entry, block.options?.[entry.key]))
  }
  if (grid.childElementCount) nodes.push(grid)
  return nodes
}

/** One inspector group (a rail entry): several sections under one title, each with its own subheading. */
export function renderGroup(label: string, blocks: SsfBlock[], code?: string): HTMLElement | undefined {
  const shown = blocks.filter((block) => block.template || ssfDocument(block.path).sections().includes(block.section))
  if (!shown.length) return
  const section = element("section", "document-property-section")
  section.dataset.inspectorGroupLabel = label
  const heading = element("h3", "document-section-heading")
  const title = element("span", "document-section-title")
  title.textContent = label
  heading.append(title)
  if (code) {
    const codeNode = element("span", "document-section-code")
    codeNode.textContent = code
    heading.append(codeNode)
  }
  section.append(heading)
  const many = shown.length > 1
  for (const block of shown) section.append(...renderBlock(block, many || Boolean(block.title)))
  return section
}
