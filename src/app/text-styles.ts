// 候选栏与整体布局的「文字」分组。百度 BDS/BDI 写 default.css 的 STYLE 文字属性，手心写 skin.json
// 对应样式的 s_1，BDA 写 appearanceConfig 的文字样式；搜狗皮肤的文字由 ssf-inspector.ts 处理。
import { appState } from "./state"
import { IniDocument } from "../ini.ts"
import { textStyleSections } from "../style-properties.ts"
import { candidateInputForegroundStyle } from "../candidate-style.ts"
import { type BdaStyleRef } from "../bda.ts"
import { element } from "../dom-element.ts"
import { setSxiStyleText, sxiStylePointer } from "../palm/sxi-edit.ts"
import { SXI_SKIN_PATH } from "../palm/sxi-projection.ts"
import { styleConfigPath, genConfigPath, isToolbarPath, effectiveToolbarSections, effectiveKeyValue, setSourceValue } from "./config-context"
import { commitText, isEditing, updateDirty } from "./edit-history"
import { refreshPreview } from "./preview-render"
import { currentBdaAppearance, bdaAppearancePart } from "./bda-documents"
import { refreshSxiDocument } from "./sxi-documents"
import { showError } from "./file-operations"
import { bdaStyleValue, populateKeyInspector, updateBdaRefs } from "./key-inspector"
import { parseStyleColor } from "./resource-inspector"
import { fontFileField, orientation, textStyleGroup, textStyleNote, textStyleRows, textStyleTargetSwitch } from "./dom"

export type TextProperty = "FONT_NAME" | "FONT_SIZE" | "NM_COLOR" | "HL_COLOR"

type TextTarget = { id: string; label: string; properties: TextProperty[]; css?: string[]; bda?: BdaStyleRef[] }

const LABELS: Record<TextProperty, string> = { FONT_NAME: "字体名称", FONT_SIZE: "字号", NM_COLOR: "颜色", HL_COLOR: "按下颜色" }
const KEY_PROPERTIES: TextProperty[] = ["FONT_NAME", "FONT_SIZE", "NM_COLOR", "HL_COLOR"]
// 真机候选字用用户字体（candidate-style.ts），皮肤只能改字号与颜色。
const CANDIDATE_PROPERTIES: TextProperty[] = ["FONT_SIZE", "NM_COLOR", "HL_COLOR"]

/** Writes one text property into STYLE sections of the current default.css; Palm skins keep it in skin.json. */
export function writeCssStyleProperty(sections: string[], property: TextProperty, value: string): void {
  const archive = appState.archive
  const path = styleConfigPath()
  if (!archive || !sections.length || !isEditing() || !archive.isText(path)) return
  if (archive.format === "sxi") {
    const derived = archive.derivedPointer(path)
    if (!derived) return
    try {
      const before = archive.getText(SXI_SKIN_PATH)
      commitText(SXI_SKIN_PATH, before, setSxiStyleText(before, sxiStylePointer(before, derived, orientation.value), sections, property, value))
      refreshSxiDocument()
    } catch (error) { showError(error, "修改手心文字") }
    return
  }
  const before = archive.getText(path)
  const document = IniDocument.parse(before)
  for (const section of sections) {
    if (value) document.set(section, property, value)
    else document.remove(section, property)
  }
  const after = document.toString()
  commitText(path, before, after)
  if (appState.selectedPath === path) setSourceValue(after)
  refreshPreview()
  populateKeyInspector()
  updateDirty()
}

function cssTargets(): { scope: "candidate" | "layout"; targets: TextTarget[] } | undefined {
  const archive = appState.archive!
  const stylePath = styleConfigPath()
  if (!archive.isText(stylePath)) return
  const styles = IniDocument.parse(archive.getText(stylePath))
  const sections = (foregrounds: string[]) => [...new Set(foregrounds.flatMap((value) => textStyleSections(styles, value)))]
  if (isToolbarPath(appState.selectedPath)) {
    if (effectiveToolbarSections().length) return
    const candidate = appState.selectedDocument
    const general = archive.isText(genConfigPath()) ? IniDocument.parse(archive.getText(genConfigPath())) : undefined
    // Same lookups as the preview (resolveCandidateTextVisuals / resolveCandidateInputTextVisual).
    return {
      scope: "candidate",
      targets: [
        { id: "candidate", label: "候选字", properties: CANDIDATE_PROPERTIES, css: sections([candidate?.get("CAND", "FORE_STYLE") ?? general?.get("SCAND", "SCAND_STYLE") ?? ""]) },
        { id: "first", label: "首选", properties: CANDIDATE_PROPERTIES, css: sections([candidate?.get("CAND", "FIRST_FORE") ?? ""]) },
        { id: "input", label: "输入码", properties: CANDIDATE_PROPERTIES, css: sections([candidateInputForegroundStyle(general, candidate)]) },
      ].filter((target) => target.css.length),
    }
  }
  const layout = appState.layoutDocument
  if (appState.selectedPath !== appState.layoutPath || !layout) return
  const keys = layout.sections().filter((section) => /^KEY\d+$/.test(section)).map((section) => effectiveKeyValue(section, "FORE_STYLE") ?? "")
  const css = sections(keys)
  return { scope: "layout", targets: css.length ? [{ id: "keys", label: "全部按键", properties: KEY_PROPERTIES, css }] : [] }
}

function bdaTargets(): { scope: "candidate" | "layout"; targets: TextTarget[] } | undefined {
  const info = currentBdaAppearance()
  if (!info || bdaAppearancePart(appState.selectedPath)?.kind !== "panel" || appState.selectedPath !== appState.layoutPath) return
  const panel = info.appearance.panels.get(appState.selectedPath.split("/").pop()?.replace(/\.ini$/i, "") ?? "")
  if (!panel) return
  const text = (refs: Array<BdaStyleRef | undefined>) =>
    [...new Map(refs.filter((ref): ref is BdaStyleRef => ref?.type === "text").map((ref) => [ref.key, ref])).values()]
  if (appState.selectedCandidate) {
    return {
      scope: "candidate",
      targets: [
        { id: "candidate", label: "候选字", properties: CANDIDATE_PROPERTIES, bda: text([panel.cand?.cellForeStyle]) },
        { id: "first", label: "首选", properties: CANDIDATE_PROPERTIES, bda: text([panel.cand?.firstCellForeStyle]) },
        { id: "input", label: "输入码", properties: CANDIDATE_PROPERTIES, bda: text([panel.input?.textStyle]) },
      ].filter((target) => target.bda.length),
    }
  }
  const bda = text([...panel.keys.values()].flatMap((key) => key.foreStyles))
  return { scope: "layout", targets: bda.length ? [{ id: "keys", label: "全部按键", properties: KEY_PROPERTIES, bda }] : [] }
}

/** The candidate bar's or whole layout's text targets; keys keep their own 文字 group. */
function textTargets(): { scope: "candidate" | "layout"; targets: TextTarget[] } | undefined {
  const archive = appState.archive
  if (!archive || archive.format === "ssf" || appState.selectedKeySections.length) return
  return archive.format === "bda" ? bdaTargets() : cssTargets()
}

function targetValues(target: TextTarget, property: TextProperty): string[] {
  if (target.bda) {
    const info = currentBdaAppearance()
    return info ? target.bda.map((ref) => bdaStyleValue(info.appearance, ref, property)) : []
  }
  const path = styleConfigPath()
  const styles = appState.archive?.isText(path) ? IniDocument.parse(appState.archive.getText(path)) : undefined
  return (target.css ?? []).map((section) => styles?.get(section, property)?.trim() ?? "")
}

function writeTarget(target: TextTarget, property: TextProperty, value: string): void {
  if (target.bda) updateBdaRefs(target.bda, property, value)
  else writeCssStyleProperty(target.css ?? [], property, value)
}

function fieldRow(label: string, property: TextProperty, control: HTMLElement): HTMLElement {
  const row = element("label", "ui-field")
  row.title = property
  const caption = element("span")
  caption.textContent = label
  row.append(caption, control)
  return row
}

function valueRow(target: TextTarget, property: TextProperty, values: string[]): HTMLElement {
  const input = element("input")
  const common = values.every((value) => value === values[0]) ? values[0] ?? "" : ""
  input.value = common
  input.placeholder = new Set(values).size > 1 ? "混合" : "未设置"
  input.setAttribute("aria-label", `${target.label}${LABELS[property]}`)
  input.disabled = !isEditing()
  if (property === "FONT_SIZE") {
    input.type = "number"
    input.min = "1"
  } else input.setAttribute("list", "skin-font-names")
  input.addEventListener("change", () => {
    if (input.type === "number" && input.value && !input.checkValidity()) return
    writeTarget(target, property, input.value.trim())
  })
  return fieldRow(LABELS[property], property, input)
}

/** Picker, AARRGGBB text and opacity, as in the key 文字 group; empty values can be added from the picker. */
function colorRow(target: TextTarget, property: TextProperty, values: string[]): HTMLElement {
  const control = element("span", "color-control ui-input ui-color")
  const picker = element("input")
  const text = element("input")
  const alpha = element("input")
  picker.type = "color"
  alpha.type = "number"
  alpha.min = "0"
  alpha.max = "1"
  alpha.step = "0.01"
  const common = values.every((value) => value === values[0]) ? values[0] ?? "" : ""
  const parsed = parseStyleColor(common)
  text.value = common
  text.placeholder = new Set(values).size > 1 ? "混合" : "未设置"
  picker.value = `#${parsed?.hex ?? "000000"}`
  alpha.value = String(parsed ? Math.round(parsed.alpha * 100) / 100 : 1)
  const label = `${target.label}${LABELS[property]}`
  picker.setAttribute("aria-label", label)
  text.setAttribute("aria-label", `${label}值`)
  alpha.setAttribute("aria-label", `${label}透明度`)
  for (const input of [picker, text, alpha]) input.disabled = !isEditing()
  const fromControls = () => {
    const opacity = Math.max(0, Math.min(1, Number(alpha.value) || 0))
    writeTarget(target, property, `${Math.round(opacity * 255).toString(16).padStart(2, "0")}${picker.value.slice(1)}`.toUpperCase())
  }
  picker.addEventListener("change", fromControls)
  alpha.addEventListener("change", () => { if (alpha.value !== "" && alpha.checkValidity()) fromControls() })
  text.addEventListener("change", () => {
    const value = text.value.trim()
    if (!value || parseStyleColor(value)) writeTarget(target, property, value)
  })
  control.append(picker, text, alpha)
  return fieldRow(LABELS[property], property, control)
}

export function populateTextStyleGroup(): void {
  const context = textTargets()
  const globalFont = context?.scope === "layout" && !fontFileField.hidden
  if (context?.scope !== "layout") fontFileField.hidden = true
  textStyleGroup.hidden = !context || !context.targets.length && !globalFont
  textStyleTargetSwitch.replaceChildren()
  textStyleRows.replaceChildren()
  if (!context || textStyleGroup.hidden) return
  const target = context.targets.find((item) => item.id === appState.textStyleTarget) ?? context.targets[0]
  textStyleNote.textContent = context.scope === "candidate"
    ? "真机候选字使用用户字体，皮肤只能改字号与颜色"
    : target ? "同时修改本布局全部按键的文字" : ""
  textStyleNote.hidden = !textStyleNote.textContent
  textStyleTargetSwitch.hidden = context.targets.length < 2
  for (const item of context.targets) {
    const button = element("button")
    button.type = "button"
    button.textContent = item.label
    button.setAttribute("aria-pressed", String(item === target))
    button.addEventListener("click", () => {
      appState.textStyleTarget = item.id
      populateTextStyleGroup()
    })
    textStyleTargetSwitch.append(button)
  }
  if (!target) return
  textStyleRows.append(...target.properties.map((property) => {
    const values = targetValues(target, property)
    return property.endsWith("COLOR") ? colorRow(target, property, values) : valueRow(target, property, values)
  }))
}
