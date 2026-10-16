import { appState } from "./state"
import { skinState, sourceEditor, theme, orientation, colorPickers, colorAlphas, candidateArea, toolbarStrip, candidateBackgroundCanvas, toolbarCanvas } from "./dom"
import { isListCell } from "../layout.ts"
import { effectivePanelSection } from "../panel-tools.ts"
import { selectedBdaSourceKeys } from "./document-inspector"
import { jsonPropertyRanges, iniSectionRanges } from "../highlight.ts"
import { source, toolbarPreview, candidateBackgroundPreview } from "./canvas-interaction"
import { deferNumberInputRefresh } from "../number-input-wheel.ts"
import { updateSourceHighlight } from "./source-panel"
import { IniDocument } from "../ini.ts"
import { bdaBasePath, textDocument, currentBdaAppearance } from "./bda-documents"
import { firstExistingPath } from "../resources.ts"
import { type VisualResolver } from "../atlas.ts"
import { isConfiguredSymbolLayout } from "../actions.ts"
import { resolveCandidateRect, resolveCandidateInputStyle } from "../candidate-style.ts"
import { bdaStyleID } from "../bda.ts"
import { devicePreviewTransparent } from "./preview-render"
import { canvasEditable } from "./edit-history"

export function selectedSourceSections(): string[] {
  if (appState.resourceConfigActive && appState.selectedResourcePath) {
    return appState.selectedTileIndex === undefined ? [] : [`IMG${appState.selectedTileIndex}`]
  }
  if (appState.resourceConfigActive && appState.resourceInspectorMode === "style") {
    return appState.selectedStyleID && appState.archive?.format !== "bda" ? [`STYLE${appState.selectedStyleID}`] : []
  }
  const toolbarSections = isToolbarPath(appState.selectedPath) ? effectiveToolbarSections() : []
  if (toolbarSections.length) return toolbarSections
  return appState.selectedPath === appState.layoutPath ? effectiveSelectedSections() : []
}

export function currentSkinState(): number | undefined {
  return skinState.value ? Number(skinState.value) : undefined
}

export function effectiveKeySection(section: string): string {
  if (!appState.layoutDocument || isListCell(section)) return section
  return effectivePanelSection(appState.layoutDocument, section, currentSkinState())
}

export function effectiveSelectedSections(): string[] {
  return appState.selectedKeySections.map(effectiveKeySection)
}

export function effectiveToolbarSections(): string[] {
  if (!appState.selectedDocument) return appState.selectedToolbarSections
  return [...new Set(appState.selectedToolbarSections.flatMap((section) => {
    const effective = effectivePanelSection(appState.selectedDocument!, section, currentSkinState())
    return effective === section ? [section] : [section, effective]
  }))]
}

export function effectiveKeyValue(section: string, key: string): string | undefined {
  if (!appState.layoutDocument) return
  const effective = effectiveKeySection(section)
  return appState.layoutDocument.get(effective, key) ?? appState.layoutDocument.get(section, key)
}

export function scrollSelectedSource(): void {
  const sections = selectedSourceSections()
  const bdaKeys = selectedBdaSourceKeys()
  if (sourceEditor.hidden || !sections.length && !bdaKeys.length && !appState.sourceHistoryHighlight) return
  const bdaRange = jsonPropertyRanges(source.value, bdaKeys)[0]
  const iniRange = iniSectionRanges(source.value, sections)[0]
  const range = bdaRange ?? iniRange ?? appState.sourceHistoryHighlight
  if (range) source.revealRange(range[0], range[1])
}

export function setSourceValue(text: string): void {
  if (deferNumberInputRefresh(setSourceValue, () => setSourceValue(text))) return
  source.value = text
  updateSourceHighlight()
}

export function currentConfigPath(name: string): string {
  return `${theme.value}/skin/${orientation.value}/${name}`
}

export function styleConfigPath(): string {
  const candidates = [
    `${theme.value}/skin/${orientation.value}/res/default.css`,
    `${theme.value}/skin/res/default.css`,
  ]
  return candidates.find((path) => appState.archive?.names().includes(path)) ?? candidates[0]
}

export function legacyAnimationConfigPath(): string | undefined {
  return [
    `${theme.value}/skin/${orientation.value}/anim.ini`,
    `${theme.value}/skin/${orientation.value}/res/anim.ini`,
    `${theme.value}/skin/res/anim.ini`,
  ].find((path) => appState.archive?.isText(path))
}

export function genConfigPath(): string {
  return currentConfigPath("gen.ini")
}

// LIST 候选栏单元的几何（POS/CELL_SIZE）可能定义在布局自身或 gen.ini（候选栏几何通常全局共享）
export function listGeometryDocument(): { document: IniDocument; path: string } | undefined {
  if (!appState.archive || !appState.layoutDocument) return
  if (appState.layoutDocument.get("LIST", "POS") !== undefined || appState.layoutDocument.get("LIST", "CELL_SIZE") !== undefined) {
    return { document: appState.layoutDocument, path: appState.layoutPath }
  }
  const path = genConfigPath()
  if (appState.archive.isText(path)) return { document: IniDocument.parse(appState.archive.getText(path)), path }
  return { document: appState.layoutDocument, path: appState.layoutPath }
}

export function isSkinInfoPath(path: string): boolean {
  return /(^|\/)Info\.txt$/i.test(path)
}

export function isToolbarPath(path: string): boolean {
  return /\.cnd$/i.test(path)
}

/** INI / CND / POP 是属性面板能描述并回写的布局配置文档。 */
export function isConfigLayoutPath(path: string): boolean {
  return /\.(ini|cnd|pop)$/i.test(path)
}

/**
 * 普通皮肤（bds/bdi）里所有布局文档都自带属性面板。
 * BDA 容器内的同名遗留文件由 bda 解析器处理，不能按普通布局文档放行；
 * 搜狗皮肤的 INI 字段含义与百度不同，只用源代码编辑。
 */
export function showsLayoutProperties(path: string): boolean {
  return appState.archive?.format !== "bda" && appState.archive?.format !== "ssf" && isConfigLayoutPath(path)
}

export function colorControlKey(field: HTMLInputElement): string {
  return `${field.hasAttribute("data-keyboard-field") ? "keyboard" : "style"}-${field.dataset.keyboardField ?? field.dataset.styleField ?? ""}`
}

export function syncColorControl(field: HTMLInputElement): void {
  const value = field.value.trim().replace(/^#/, "")
  if (!/^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(value)) return
  const hex = value.length === 6 ? `FF${value}` : value.toUpperCase()
  const picker = colorPickers.find((item) => item.dataset.colorPickerFor === colorControlKey(field))
  const alpha = colorAlphas.find((item) => item.dataset.colorAlphaFor === colorControlKey(field))
  if (picker) {
    picker.value = `#${hex.slice(2)}`
    picker.disabled = field.disabled
  }
  if (alpha) {
    alpha.value = String(Number.parseInt(hex.slice(0, 2), 16) / 255)
    alpha.disabled = field.disabled
  }
}

export function writeColorControl(control: HTMLInputElement, alphaValue: number): void {
  const key = control.dataset.colorPickerFor ?? control.dataset.colorAlphaFor ?? ""
  const field = document.querySelector<HTMLInputElement>(
    `[data-${key.startsWith("keyboard-") ? "keyboard" : "style"}-field="${CSS.escape(key.replace(/^(keyboard|style)-/, ""))}"]`,
  )
  if (!field) return
  const rgb = control.type === "color" ? control.value.slice(1).toUpperCase() : colorPickers.find((item) => item.dataset.colorPickerFor === key)?.value.slice(1).toUpperCase()
  if (!rgb || rgb.length !== 6) return
  field.value = `${Math.round(Math.max(0, Math.min(1, alphaValue)) * 255).toString(16).padStart(2, "0")}${rgb}`.toUpperCase()
  field.dispatchEvent(new Event(field.hasAttribute("data-keyboard-field") ? "change" : "input", { bubbles: true }))
}

export function keyboardContext():
  | { gen: IniDocument; genPath: string; styles: IniDocument; stylePath: string }
  | undefined {
  if (!appState.archive) return
  const genPath = genConfigPath()
  const stylePath = styleConfigPath()
  if (!appState.archive.isText(genPath) || !appState.archive.isText(stylePath)) return
  return {
    gen: IniDocument.parse(appState.archive.getText(genPath)),
    genPath,
    styles: IniDocument.parse(appState.archive.getText(stylePath)),
    stylePath,
  }
}

export function toolbarConfigPath(): string | undefined {
  if (!appState.archive) return
  const directory = `${theme.value}/skin/${orientation.value}`
  const genPath = genConfigPath()
  const source = appState.archive.format === "bda" ? appState.bdaBase : appState.archive
  const sourceGenPath = appState.archive.format === "bda" ? bdaBasePath(genPath) : genPath
  const configured = source?.isText(sourceGenPath)
    ? IniDocument.parse(source.getText(sourceGenPath)).get("CAND", "LAYOUT_NAME")?.trim()
    : undefined
  const sourceDirectory = appState.archive.format === "bda" ? bdaBasePath(directory) : directory
  const found = source && firstExistingPath(source.names(), sourceDirectory, [
    ...(configured ? [`${configured}.cnd`] : []),
    "cand1.cnd",
    "cand.cnd",
  ])
  return found && (appState.archive.format === "bda"
    ? `${directory}/${found.split("/").pop()}`
    : found)
}

export function candidateCssLength(value: string | undefined, width: number): string | undefined {
  const number = Number(value)
  return Number.isFinite(number) ? `${(number / width) * 100}cqw` : undefined
}

export function applyCandidateGeometry(
  document: IniDocument,
  width: number,
): void {
  const padding = document.get("CAND", "PADDING")?.split(",").map((value) => candidateCssLength(value, width))
  if (padding?.[0]) candidateArea.style.setProperty("--candidate-left-padding", padding[0])
  else candidateArea.style.removeProperty("--candidate-left-padding")
  const firstGap = candidateCssLength(document.get("CAND", "FIRST_GAP"), width)
  const rawCellWidth = Number(document.get("CAND", "CELL_W"))
  const cellWidth = candidateCssLength(document.get("CAND", "CELL_W"), width)
  const cellInset = candidateCssLength(
    Number.isFinite(rawCellWidth) ? String(rawCellWidth / 2) : undefined,
    width,
  )
  const moreWidth = candidateCssLength(document.get("CAND", "MORE_W"), width)
  if (firstGap) candidateArea.style.setProperty("--candidate-first-gap", firstGap)
  else candidateArea.style.removeProperty("--candidate-first-gap")
  if (cellWidth) candidateArea.style.setProperty("--candidate-cell-width", cellWidth)
  else candidateArea.style.removeProperty("--candidate-cell-width")
  if (cellInset) candidateArea.style.setProperty("--candidate-cell-inset", cellInset)
  else candidateArea.style.removeProperty("--candidate-cell-inset")
  if (moreWidth) candidateArea.style.setProperty("--candidate-more-width", moreWidth)
  else candidateArea.style.removeProperty("--candidate-more-width")
}

export function refreshToolbarPreview(
  composing: boolean,
  resolver: VisualResolver,
): { width: number; height: number; inputHeight: number } | undefined {
  if (isConfiguredSymbolLayout(appState.layoutPath, textDocument(genConfigPath()))) {
    delete toolbarStrip.dataset.path
    toolbarStrip.hidden = true
    candidateBackgroundCanvas.hidden = true
    return
  }
  const path = toolbarConfigPath()
  const document = path ? textDocument(path) : undefined
  if (!appState.archive || !path || !document) {
    delete toolbarStrip.dataset.path
    toolbarStrip.hidden = true
    candidateBackgroundCanvas.hidden = true
    return
  }
  const gen = textDocument(genConfigPath())
  const bdaPanel = appState.archive.format === "bda"
    ? currentBdaAppearance()?.appearance.panels.get(appState.layoutPath.split("/").pop()?.replace(/\.ini$/i, "") ?? "")
    : undefined
  toolbarStrip.hidden = false
  toolbarStrip.dataset.path = path
  toolbarPreview.setResolver(resolver)
  toolbarPreview.setOffsets(gen)
  toolbarPreview.setDefaults(gen)
  toolbarPreview.setPersistentOnly(composing)
  toolbarPreview.setTheme(theme.value === "dark" ? "dark" : "light")
  toolbarPreview.setTransparent(true)
  const { width, height } = resolveCandidateRect(document, gen)
  const inputGeneral = bdaPanel?.input?.textStyle
    ? IniDocument.parse(`[INPUT]\nFORE_STYLE=${bdaStyleID(bdaPanel.input.textStyle)}\n`)
    : gen
  const inputStyle = resolveCandidateInputStyle(inputGeneral, resolver, width, document)
  const inputHeight = inputStyle.height
  const backgroundStyle = appState.archive?.format === "bda"
    ? bdaStyleID(bdaPanel?.backStyle)
    : document.get("CAND", "BACK_STYLE")?.split(",")[0] ??
      gen?.get("SCAND", "BACK_STYLE")?.split(",")[0] ?? ""
  candidateBackgroundCanvas.hidden = false
  candidateBackgroundPreview.setResolver(resolver)
  candidateBackgroundPreview.setTheme(theme.value === "dark" ? "dark" : "light")
  candidateBackgroundPreview.setTransparent(devicePreviewTransparent())
  candidateBackgroundPreview.setPanel(
    backgroundStyle,
    width,
    height,
  )
  candidateBackgroundPreview.setDocument(undefined)
  toolbarCanvas.style.setProperty("--toolbar-width", String(width))
  toolbarCanvas.style.setProperty("--toolbar-height", String(height))
  toolbarCanvas.style.setProperty("--candidate-input-height", String(inputHeight))
  applyCandidateGeometry(document, width)
  const toolbarDocument = IniDocument.parse(document.toString())
  toolbarDocument.set("CAND", "BACK_STYLE", "")
  toolbarPreview.setPanel("", width, height)
  toolbarPreview.setDocument(toolbarDocument)
  toolbarPreview.setMode(canvasEditable() ? "edit" : "preview")
  return { width, height, inputHeight }
}
