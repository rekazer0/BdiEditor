import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { message, open, save } from "@tauri-apps/plugin-dialog"
import "./style.css"
import { previewPageTarget } from "./actions.ts"
import {
  AtlasResolver,
  canvasFontFamily,
  drawVisualSource,
  isTransparentColor,
  resolveTextVisual,
  type TextVisual,
  type Visual,
} from "./atlas.ts"
import { deviceSpec, keyboardPreviewGeometry, showsKeyboardAccessories } from "./devices.ts"
import {
  exportFormatFromPath,
  exportName,
  exportPath,
  type ExportFormat,
} from "./export.ts"
import { IniDocument } from "./ini.ts"
import { highlightIni } from "./highlight.ts"
import { releaseImagePreviewURL, replaceImagePreviewURL } from "./image-preview.ts"
import {
  backgroundStyleSections,
  keyboardConfig,
  resolvePanelConfig,
  setKeyboardHeight,
  setStyleField,
} from "./keyboard.ts"
import {
  applyLayoutAction as transformLayout,
  moveRects,
  setExactGap,
  type LayoutAction,
  type LayoutRect,
} from "./layout.ts"
import { loadBuiltInProjectTemplate, operationError } from "./operations.ts"
import { Preview, previewItems, type PreviewEvent } from "./preview.ts"
import { firstExistingPath } from "./resources.ts"
import { candidatePreview, deleteBackward, insertText } from "./simulation.ts"
import { SkinArchive } from "./skin.ts"
import { sourceFolderDescription } from "./source-tree.ts"
import { resolveStylePropertySources, type StylePropertySource } from "./style-properties.ts"
import { unsavedDecision } from "./unsaved.ts"

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!
const newButton = $("#new") as HTMLButtonElement
const newProjectDialog = $("#new-project-dialog") as HTMLDialogElement
const newProjectForm = $("#new-project-form") as HTMLFormElement
const openButton = $("#open") as HTMLButtonElement
const saveButton = $("#save") as HTMLButtonElement
const undoButton = $("#undo") as HTMLButtonElement
const redoButton = $("#redo") as HTMLButtonElement
const toolbarMore = $(".toolbar-more") as HTMLDetailsElement
const appDialogButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-app-dialog]"))
const settingsDialog = $("#settings-dialog") as HTMLDialogElement
const aboutDialog = $("#about-dialog") as HTMLDialogElement
const editContextMenu = $("#edit-context-menu") as HTMLDivElement
const defaultDevice = $("#default-device") as HTMLSelectElement
const canvasBackground = $("#canvas-background") as HTMLSelectElement
const exportButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>("[data-export-format]"),
)
const source = $("#source") as HTMLTextAreaElement
const sourceEditor = $("#source-editor")
const sourceHighlight = $("#source-highlight code")
const canvasWrap = $(".canvas-wrap")
const emptyOpenButton = $("#empty-open") as HTMLButtonElement
const asset = $("#asset")
const assetImage = $("#asset-image") as HTMLImageElement
const replaceAssetButton = $("#replace-asset") as HTMLButtonElement
const assetBackButton = $("#asset-back") as HTMLButtonElement
const files = $("#files")
const documentName = $("#document-name")
const sourceName = $("#source-name")
const dirty = $("#dirty")
const eventLog = $("#event-log")
const quickInspector = $("#quick-inspector")
const selectedKeyName = $("#selected-key")
const keyFields = Array.from(document.querySelectorAll<HTMLInputElement>("[data-key-field]"))
const styleFields = Array.from(document.querySelectorAll<HTMLInputElement>("[data-style-field]"))
const backgroundStyleFields = Array.from(
  document.querySelectorAll<HTMLInputElement>("[data-background-style-field]"),
)
const keyboardFields = Array.from(
  document.querySelectorAll<HTMLInputElement>("[data-keyboard-field]"),
)
const skinFields = Array.from(document.querySelectorAll<HTMLInputElement>("[data-skin-field]"))
const keyboardFieldsGroup = $(".keyboard-fields")
const toolbarFieldsGroup = $(".toolbar-fields")
const toolbarFields = Array.from(document.querySelectorAll<HTMLInputElement>("[data-toolbar-field]"))
const skinFieldsGroup = $(".skin-fields")
const colorPickers = Array.from(document.querySelectorAll<HTMLInputElement>("[data-color-picker-for]"))
const colorAlphas = Array.from(document.querySelectorAll<HTMLInputElement>("[data-color-alpha-for]"))
const keyOnlyGroups = Array.from(document.querySelectorAll<HTMLElement>(".key-only"))
const gapFields = Array.from(document.querySelectorAll<HTMLInputElement>("[data-gap-field]"))
const layoutActionButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>("[data-layout-action]"),
)
const actionMeaningNodes = Array.from(
  document.querySelectorAll<HTMLElement>("[data-action-meaning]"),
)
const inspectorTabButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>("[data-inspector-tab]"),
)
const browserOpen = $("#browser-open") as HTMLInputElement
const imageOpen = $("#image-open") as HTMLInputElement
const theme = $("#theme") as HTMLSelectElement
const orientation = $("#orientation") as HTMLSelectElement & { value: "port" | "land" }
const layout = $("#layout") as HTMLSelectElement
const mode = $("#mode") as HTMLSelectElement
const device = $("#device") as HTMLSelectElement
const deviceShell = $("#device-shell")
const workspaceImageFigure = $("#workspace-image-figure")
const workspaceImage = $("#workspace-image") as HTMLImageElement
const workspaceImageError = $("#workspace-image-error")
const simulatedOutput = $("#simulated-output") as HTMLTextAreaElement
const clearSimulationButton = $("#clear-simulation") as HTMLButtonElement
const toolbarStrip = $("#toolbar-strip") as HTMLDivElement
const candidateArea = $("#candidate-area")
const toolbarCanvas = $("#toolbar-preview") as HTMLCanvasElement
const candidateComposition = $("#candidate-composition")
const candidateInput = $("#candidate-input")
const candidateWords = $("#candidate-words")
const modeChoiceButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-mode-choice]"))
const themeChoiceButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-theme-choice]"))
const orientationChoiceButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-orientation-choice]"))
const stylePreviewButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>("[data-style-preview], [data-style-preview-field]"),
)
const imagePreviewButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>("[data-image-preview]"),
)
const styleImageDialog = $("#style-image-dialog") as HTMLDialogElement
const styleImagePreview = $("#style-image-preview") as HTMLCanvasElement
const colorDialog = $("#color-dialog") as HTMLDialogElement
const rgbaPicker = $("#rgba-picker") as HTMLInputElement
const rgbaPreview = $("#rgba-preview")
const rgbaFields = {
  r: $("#rgba-r") as HTMLInputElement,
  g: $("#rgba-g") as HTMLInputElement,
  b: $("#rgba-b") as HTMLInputElement,
  a: $("#rgba-a") as HTMLInputElement,
}

let archive: SkinArchive | undefined
let currentPath = ""
let selectedPath = ""
let selectedDocument: IniDocument | undefined
let layoutPath = ""
let layoutDocument: IniDocument | undefined
let selectedKeySections: string[] = []
let unsavedNew = false
let assetURL = ""
let assetReturnPath = ""
let inspectorTab: "properties" | "source" = "properties"
type TextChange = { path: string; before: string; after: string }
let undoStack: TextChange[] = []
let redoStack: TextChange[] = []
let fileOperationRunning = false
let firstCandidateTextVisual: TextVisual | undefined
let candidateTextWidth = 1125
let stylePreviewDrawID = 0
let imagePreviewDrawID = 0
const imagePreviewVisuals = new Map<string, Visual[]>()
const processedPreviewVisuals = new Map<HTMLButtonElement, Visual[]>()
let selectedFileButton: HTMLButtonElement | undefined

const deviceGeometryProperties = [
  "--keyboard-height-port",
  "--keyboard-height-land",
  "--candidate-row",
  "--candidate-inset-row",
  "--candidate-content-row",
  "--panel-row",
  "--safe-row",
] as const

const preview = new Preview(
  $("#preview") as HTMLCanvasElement,
  (event) => {
    handlePreviewEvent(event)
  },
  (sections) => {
    selectedKeySections = sections
    populateKeyInspector()
    updateSourceHighlight()
    scrollSelectedSource()
  },
  false,
  (section, event) => showEditContextMenu(section, event),
)

const toolbarPreview = new Preview(toolbarCanvas, () => {}, () => {}, true)

function handlePreviewEvent(event: PreviewEvent): void {
  eventLog.textContent =
    `${event.section} · ${event.direction.toUpperCase()} · ${event.code || "未配置"}`
  const code = event.code.trim()
  const currentName = layoutPath.split("/").pop() ?? ""
  const target = previewPageTarget(code, currentName, layout.value)
  if (target) {
    const path = currentConfigPath(target)
    if (archive?.isText(path)) {
      layoutPath = path
      layoutDocument = IniDocument.parse(archive.getText(path))
      selectedKeySections = []
      refreshPreview()
      populateKeyInspector()
      eventLog.textContent += ` → 已切换预览到 ${target}`
      return
    }
  }
  if (code === "F36") {
    const result = deleteBackward(
      simulatedOutput.value,
      simulatedOutput.selectionStart ?? simulatedOutput.value.length,
      simulatedOutput.selectionEnd ?? simulatedOutput.value.length,
    )
    simulatedOutput.value = result.value
    simulatedOutput.focus()
    simulatedOutput.setSelectionRange(result.caret, result.caret)
    refreshSimulationState()
    return
  }
  if (!code || /^(F\d+|S\d+|Z\+)/.test(code)) return
  insertSimulatedText(code)
}

function showEditContextMenu(section: string, event: MouseEvent): void {
  if (!isEditing()) return
  if (!selectedKeySections.includes(section)) {
    selectedKeySections = [section]
    preview.setSelected(selectedKeySections)
    populateKeyInspector()
    updateSourceHighlight()
  }
  editContextMenu.hidden = false
  editContextMenu.style.left = `${Math.min(event.clientX, window.innerWidth - 150)}px`
  editContextMenu.style.top = `${Math.min(event.clientY, window.innerHeight - 74)}px`
}

function copySelectedKeys(): void {
  if (!archive || !layoutDocument || !selectedKeySections.length) return
  const before = layoutDocument.toString()
  const occupied = new Set(layoutDocument.sections())
  let number = Math.max(0, ...[...occupied].flatMap((section) => {
    const value = section.match(/^KEY(\d+)$/)?.[1]
    return value ? [Number(value)] : []
  })) + 1
  const copies: string[] = []
  for (const section of selectedKeySections) {
    while (occupied.has(`KEY${number}`)) number += 1
    const target = `KEY${number++}`
    const entries = layoutDocument.entries(section).map(({ key, value }) => {
      if (key !== "VIEW_RECT") return { key, value }
      const rect = value.split(",").map(Number)
      if (rect.length === 4 && rect.every(Number.isFinite)) rect[0] += 18
      return { key, value: rect.join(",") }
    })
    layoutDocument.appendSection(target, entries)
    occupied.add(target)
    copies.push(target)
  }
  const text = layoutDocument.toString()
  commitText(layoutPath, before, text)
  if (selectedPath === layoutPath) setSourceValue(text)
  selectedKeySections = copies
  preview.setDocument(layoutDocument)
  preview.setSelected(copies)
  populateKeyInspector()
  updateSourceHighlight()
  updateDirty()
}

function deleteSelectedKeys(): void {
  if (!archive || !layoutDocument || !selectedKeySections.length) return
  const before = layoutDocument.toString()
  if (!layoutDocument.removeSections(selectedKeySections)) return
  const text = layoutDocument.toString()
  commitText(layoutPath, before, text)
  if (selectedPath === layoutPath) setSourceValue(text)
  selectedKeySections = []
  preview.setDocument(layoutDocument)
  preview.setSelected([])
  populateKeyInspector()
  updateSourceHighlight()
  updateDirty()
}

function insertSimulatedText(text: string): void {
  const result = insertText(
    simulatedOutput.value,
    simulatedOutput.selectionStart ?? simulatedOutput.value.length,
    simulatedOutput.selectionEnd ?? simulatedOutput.value.length,
    text,
  )
  simulatedOutput.value = result.value
  simulatedOutput.focus()
  simulatedOutput.setSelectionRange(result.caret, result.caret)
  refreshSimulationState()
}

function isTauri(): boolean {
  return "__TAURI_INTERNALS__" in window
}

const svgNamespace = "http://www.w3.org/2000/svg"
const fallbackSymbolPaths: Record<string, string[]> = {
  "info.circle": ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18", "M12 10v7", "M12 7h.01"],
  keyboard: ["M3 6h18v12H3z", "M6 10h2m2 0h2m2 0h2m2 0h1M7 14h10"],
  "square.grid.2x2": ["M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"],
  paintpalette: ["M12 3a9 9 0 1 0 0 18h2a2 2 0 0 0 0-4h-1a2 2 0 0 1 0-4h9a9 9 0 0 0-6-14", "M7 9h.01M10 6h.01M15 7h.01M18 11h.01"],
  folder: ["M3 6h7l2 2h9l-2 10H5z", "M5 6V4h6l2 2"],
  "doc.text": ["M6 3h8l4 4v14H6z", "M14 3v5h5M9 12h6M9 16h6"],
  photo: ["M4 4h16v16H4z", "m6 16 4-5 3 3 2-2 3 4M9 9h.01"],
  doc: ["M6 3h8l4 4v14H6z", "M14 3v5h5"],
}

function createSystemSymbol(name: string): HTMLSpanElement {
  const symbol = document.createElement("span")
  symbol.className = "system-symbol"
  symbol.dataset.systemSymbol = name
  symbol.ariaHidden = "true"
  const fallback = document.createElementNS(svgNamespace, "svg")
  fallback.classList.add("system-symbol-fallback")
  fallback.setAttribute("viewBox", "0 0 24 24")
  for (const pathData of fallbackSymbolPaths[name] ?? fallbackSymbolPaths.doc) {
    const path = document.createElementNS(svgNamespace, "path")
    path.setAttribute("d", pathData)
    fallback.append(path)
  }
  symbol.append(fallback)
  return symbol
}

function isEditing(): boolean {
  return mode.value === "edit"
}

function syncSegmentedControls(): void {
  for (const button of modeChoiceButtons) {
    button.classList.toggle("active", button.dataset.modeChoice === mode.value)
  }
  for (const button of themeChoiceButtons) {
    button.classList.toggle("active", button.dataset.themeChoice === theme.value)
  }
  for (const button of orientationChoiceButtons) {
    button.classList.toggle("active", button.dataset.orientationChoice === orientation.value)
  }
}

function applyModeState(): void {
  const editing = isEditing()
  deviceShell.dataset.mode = editing ? "edit" : "preview"
  preview.setMode(editing ? "edit" : "preview")
  source.readOnly = !editing
  replaceAssetButton.disabled = !editing
  quickInspector.dataset.readonly = editing ? "false" : "true"
  if (!editing) {
    for (const field of [...keyFields, ...styleFields, ...backgroundStyleFields, ...keyboardFields, ...toolbarFields, ...skinFields, ...gapFields]) {
      field.disabled = true
    }
    for (const button of layoutActionButtons) button.disabled = true
  }
  syncSegmentedControls()
}

function selectChoice(select: HTMLSelectElement, value: string): void {
  if (select.value === value) return
  select.value = value
  select.dispatchEvent(new Event("change"))
}

function hasUnsavedChanges(): boolean {
  return unsavedNew || Boolean(archive?.changed.size)
}

async function prepareDocumentReplacement(): Promise<boolean> {
  if (!hasUnsavedChanges()) return true
  let decision: "save" | "discard" | "cancel"
  if (isTauri()) {
    const result = await message("当前皮肤尚未保存。是否先保存修改？", {
      title: "未保存的皮肤",
      kind: "warning",
      buttons: { yes: "保存", no: "不保存", cancel: "取消" },
    })
    decision = unsavedDecision(result)
  } else if (window.confirm("当前皮肤尚未保存。点击“确定”先保存，点击“取消”继续选择。")) {
    decision = "save"
  } else {
    decision = window.confirm("不保存并继续吗？") ? "discard" : "cancel"
  }
  if (decision === "cancel") return false
  if (decision === "discard") return true
  return isTauri()
    ? saveNative(false, currentExportFormat())
    : downloadArchive(currentExportFormat())
}

function updateDirty(): void {
  dirty.hidden = !unsavedNew && !archive?.changed.size
}

function updateHistoryButtons(): void {
  undoButton.disabled = undoStack.length === 0
  redoButton.disabled = redoStack.length === 0
}

function commitText(path: string, before: string, after: string): void {
  if (!archive || before === after) return
  archive.setText(path, after)
  undoStack.push({ path, before, after })
  redoStack = []
  updateHistoryButtons()
}

function applyTextSnapshot(path: string, text: string): void {
  if (!archive) return
  archive.setText(path, text)
  if (path === layoutPath) layoutDocument = IniDocument.parse(text)
  if (path === selectedPath) {
    selectedDocument = IniDocument.parse(text)
    setSourceValue(text)
  }
  refreshPreview()
  populateKeyInspector()
  updateDirty()
}

function undo(): void {
  const change = undoStack.pop()
  if (!change) return
  redoStack.push(change)
  applyTextSnapshot(change.path, change.before)
  updateHistoryButtons()
}

function redo(): void {
  const change = redoStack.pop()
  if (!change) return
  undoStack.push(change)
  applyTextSnapshot(change.path, change.after)
  updateHistoryButtons()
}

function preferredPath(): string {
  return `${theme.value}/skin/${orientation.value}/${layout.value}`
}

function simulationLanguage(): "zh" | "en" {
  return /^en_/i.test(layoutPath.split("/").pop() ?? "") ? "en" : "zh"
}

function applyCandidateTextVisual(
  element: HTMLElement,
  visual: TextVisual | undefined,
  canvasWidth: number,
): void {
  element.style.color = visual?.color ?? ""
  element.style.fontFamily = canvasFontFamily(visual?.fontName)
  element.style.fontWeight = visual?.fontWeight ? String(visual.fontWeight) : ""
  element.style.fontSize = visual?.fontSize
    ? `${(visual.fontSize / canvasWidth) * 100}cqw`
    : ""
}

function renderCandidateState(): boolean {
  const state = candidatePreview(
    simulatedOutput.value,
    simulatedOutput.selectionStart ?? simulatedOutput.value.length,
    simulationLanguage(),
  )
  candidateComposition.hidden = !state.composing
  candidateInput.textContent = state.input
  candidateWords.replaceChildren(...state.candidates.map((value) => {
    const item = document.createElement("span")
    item.textContent = value
    return item
  }))
  const firstCandidate = candidateWords.firstElementChild as HTMLElement | null
  if (firstCandidate) {
    applyCandidateTextVisual(firstCandidate, firstCandidateTextVisual, candidateTextWidth)
  }
  return state.composing
}

function refreshSimulationState(): boolean {
  const composing = renderCandidateState()
  toolbarStrip.hidden = composing || !toolbarStrip.dataset.path
  return composing
}

function refreshPreview(): void {
  if (!archive) return
  const composing = refreshSimulationState()
  const resolver = new AtlasResolver(archive, theme.value, orientation.value)
  const toolbarSize = refreshToolbarPreview(composing, resolver)
  preview.setResolver(resolver)
  preview.setTheme(theme.value === "dark" ? "dark" : "light")
  preview.setTransparent(device.value !== "canvas")
  const context = keyboardContext()
  if (context && layoutDocument) {
    const config = resolvePanelConfig(layoutDocument, context.gen, context.styles)
    const inputVisual = resolveTextVisual(
      context.styles,
      context.gen.get("SCAND", "INPUT_STYLE") ?? context.gen.get("INPUT", "FORE_STYLE") ?? "",
      false,
    )
    const candidatePath = toolbarConfigPath()
    const candidateLayout = candidatePath && archive.isText(candidatePath)
      ? IniDocument.parse(archive.getText(candidatePath))
      : undefined
    const candidateVisual = resolveTextVisual(
      context.styles,
      candidateLayout?.get("CAND", "FORE_STYLE") ?? context.gen.get("SCAND", "SCAND_STYLE") ?? "",
      false,
    )
    const firstCandidateVisual = resolveTextVisual(
      context.styles,
      candidateLayout?.get("CAND", "FIRST_FORE") ?? "",
      false,
    )
    firstCandidateTextVisual = firstCandidateVisual
    candidateTextWidth = config.width
    candidateInput.style.color = inputVisual?.color ?? ""
    candidateInput.style.fontFamily = canvasFontFamily(inputVisual?.fontName)
    candidateInput.style.fontWeight = inputVisual?.fontWeight ? String(inputVisual.fontWeight) : ""
    candidateInput.style.fontSize = inputVisual?.fontSize
      ? `${(inputVisual.fontSize / config.width) * 100}cqw`
      : ""
    candidateWords.style.color = candidateVisual?.color ?? ""
    candidateWords.style.fontFamily = canvasFontFamily(candidateVisual?.fontName)
    candidateWords.style.fontWeight = candidateVisual?.fontWeight
      ? String(candidateVisual.fontWeight)
      : ""
    candidateWords.style.fontSize = candidateVisual?.fontSize
      ? `${(candidateVisual.fontSize / config.width) * 100}cqw`
      : ""
    const firstCandidate = candidateWords.firstElementChild as HTMLElement | null
    if (firstCandidate) {
      applyCandidateTextVisual(firstCandidate, firstCandidateTextVisual, candidateTextWidth)
    }
    preview.setPanel(config.styleID, config.width, config.height)
    const spec = deviceSpec(device.value)
    if (spec) {
      const geometry = keyboardPreviewGeometry(
        spec,
        orientation.value,
        config.width,
        config.height,
        toolbarSize?.height ?? 0,
        composing,
      )
      const screenHeight = orientation.value === "port" ? spec.height : spec.width
      deviceShell.style.setProperty(
        `--keyboard-height-${orientation.value}`,
        `${(geometry.totalHeight / screenHeight) * 100}%`,
      )
      deviceShell.style.setProperty("--candidate-row", `${geometry.candidateHeight}fr`)
      deviceShell.style.setProperty("--candidate-inset-row", `${geometry.candidateInsetHeight}fr`)
      deviceShell.style.setProperty("--candidate-content-row", `${geometry.candidateContentHeight}fr`)
      deviceShell.style.setProperty("--panel-row", `${geometry.panelHeight}fr`)
      deviceShell.style.setProperty("--safe-row", `${geometry.safeBottomHeight}fr`)
    }
  }
  preview.setDocument(layoutDocument)
}

function updateDevicePreview(): void {
  deviceShell.dataset.device = device.value
  deviceShell.dataset.orientation = orientation.value
  deviceShell.dataset.theme = theme.value
  deviceShell.classList.toggle("canvas-only", device.value === "canvas")
  const spec = deviceSpec(device.value)
  deviceShell.dataset.accessories = showsKeyboardAccessories(spec, orientation.value)
    ? "visible"
    : "hidden"
  if (spec) {
    deviceShell.dataset.family = spec.family
    const portrait = orientation.value === "port"
    deviceShell.style.aspectRatio = portrait
      ? `${spec.width} / ${spec.height}`
      : `${spec.height} / ${spec.width}`
  } else {
    delete deviceShell.dataset.family
    deviceShell.style.removeProperty("aspect-ratio")
    for (const property of deviceGeometryProperties) deviceShell.style.removeProperty(property)
  }
  preview.setTransparent(device.value !== "canvas")
}

function setFileOperationBusy(busy: boolean): void {
  fileOperationRunning = busy
  newButton.disabled = busy
  openButton.disabled = busy
  saveButton.disabled = busy || !archive
  for (const button of exportButtons) button.disabled = busy || !archive
}

function showStatus(text: string, kind: "progress" | "success" = "success"): void {
  eventLog.dataset.kind = kind
  eventLog.textContent = text
}

function showError(error: unknown, action = "操作"): void {
  const text = operationError(action, error)
  eventLog.dataset.kind = "error"
  eventLog.textContent = text
  if (isTauri()) {
    void message(text, { title: `${action}失败`, kind: "error" }).catch(() => {})
  }
}

async function runFileOperation(
  action: string,
  operation: () => boolean | Promise<boolean>,
): Promise<void> {
  if (fileOperationRunning) return
  setFileOperationBusy(true)
  showStatus(`正在${action}…`, "progress")
  try {
    if (await operation()) showStatus(`${action}完成。`)
    else showStatus(`${action}已取消。`)
  } catch (error) {
    showError(error, action)
  } finally {
    setFileOperationBusy(false)
  }
}

function showImage(path: string): void {
  const bytes = archive?.getBytes(path)
  if (!bytes) return
  assetURL = replaceImagePreviewURL(assetURL, bytes)
  clearImagePreviewError()
  workspaceImage.src = assetURL
  assetImage.src = assetURL
  deviceShell.hidden = true
  workspaceImageFigure.hidden = false
  sourceEditor.hidden = true
  asset.hidden = false
  sourceName.textContent = path
  assetBackButton.disabled = !assetReturnPath
}

function clearImagePreviewError(): void {
  workspaceImage.hidden = false
  assetImage.hidden = false
  workspaceImageError.hidden = true
}

function showImagePreviewError(): void {
  workspaceImage.hidden = true
  assetImage.hidden = true
  workspaceImageError.hidden = false
}

function hideImageWorkspace(): void {
  workspaceImageFigure.hidden = true
  deviceShell.hidden = false
}

workspaceImage.addEventListener("load", clearImagePreviewError)
workspaceImage.addEventListener("error", showImagePreviewError)

function updateInspectorView(): void {
  const imageSelected = Boolean(archive?.isImage(selectedPath))
  const propertiesAvailable = Boolean(
    selectedPath && (selectedPath === layoutPath || isSkinInfoPath(selectedPath) || isToolbarPath(selectedPath)) && !imageSelected,
  )
  for (const button of inspectorTabButtons) {
    const tab = button.dataset.inspectorTab
    const available =
      tab === "properties"
        ? imageSelected || propertiesAvailable
        : !imageSelected && Boolean(selectedPath)
    button.disabled = !available
    button.classList.toggle("active", tab === inspectorTab && available)
  }
  if (imageSelected) {
    quickInspector.hidden = true
    sourceEditor.hidden = true
    asset.hidden = false
    return
  }
  asset.hidden = true
  quickInspector.hidden = inspectorTab !== "properties" || !propertiesAvailable
  sourceEditor.hidden = inspectorTab !== "source"
  if (!sourceEditor.hidden) requestAnimationFrame(scrollSelectedSource)
}

function updateSourceHighlight(): void {
  sourceHighlight.innerHTML = `${highlightIni(source.value, selectedPath === layoutPath ? selectedKeySections : [])}\n`
}

function scrollSelectedSource(): void {
  if (sourceEditor.hidden || selectedPath !== layoutPath || !selectedKeySections.length) return
  const selected = new Set(selectedKeySections)
  const line = source.value.split(/\r\n|\n|\r/).findIndex((value) => {
    const section = value.match(/^\s*\[([^\]]+)]\s*$/)?.[1]
    return Boolean(section && selected.has(section))
  })
  if (line < 0) return
  const style = getComputedStyle(source)
  const lineHeight = Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize) * 1.6
  source.scrollTop = Math.max(0, line * lineHeight - source.clientHeight / 3)
  const highlight = $("#source-highlight")
  highlight.scrollTop = source.scrollTop
}

function setSourceValue(text: string): void {
  source.value = text
  updateSourceHighlight()
}

function layoutKeyCount(path: string): number {
  if (!archive?.isText(path)) return 0
  const document = IniDocument.parse(archive.getText(path))
  return document.sections().filter((section) => {
    if (!/^KEY\d+$/.test(section)) return false
    const center = document.get(section, "CENTER")?.trim() ?? ""
    return center !== "" && !/^F\d+$/.test(center)
  }).length
}

function currentConfigPath(name: string): string {
  return `${theme.value}/skin/${orientation.value}/${name}`
}

function styleConfigPath(): string {
  const candidates = [
    `${theme.value}/skin/${orientation.value}/res/default.css`,
    `${theme.value}/skin/res/default.css`,
  ]
  return candidates.find((path) => archive?.names().includes(path)) ?? candidates[0]
}

function genConfigPath(): string {
  return currentConfigPath("gen.ini")
}

function isSkinInfoPath(path: string): boolean {
  return /(^|\/)Info\.txt$/i.test(path)
}

function isToolbarPath(path: string): boolean {
  return /\.cnd$/i.test(path)
}

function colorControlKey(field: HTMLInputElement): string {
  return `${field.hasAttribute("data-keyboard-field") ? "keyboard" : "style"}-${field.dataset.keyboardField ?? field.dataset.styleField ?? ""}`
}

function syncColorControl(field: HTMLInputElement): void {
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
    alpha.value = String(Number((Number.parseInt(hex.slice(0, 2), 16) / 255).toFixed(2)))
    alpha.disabled = field.disabled
  }
}

function writeColorControl(control: HTMLInputElement, alphaValue: number): void {
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

function keyboardContext():
  | { gen: IniDocument; genPath: string; styles: IniDocument; stylePath: string }
  | undefined {
  if (!archive) return
  const genPath = genConfigPath()
  const stylePath = styleConfigPath()
  if (!archive.isText(genPath) || !archive.isText(stylePath)) return
  return {
    gen: IniDocument.parse(archive.getText(genPath)),
    genPath,
    styles: IniDocument.parse(archive.getText(stylePath)),
    stylePath,
  }
}

function toolbarConfigPath(): string | undefined {
  if (!archive) return
  const directory = `${theme.value}/skin/${orientation.value}`
  const genPath = genConfigPath()
  const configured = archive.isText(genPath)
    ? IniDocument.parse(archive.getText(genPath)).get("CAND", "LAYOUT_NAME")?.trim()
    : undefined
  return firstExistingPath(archive.names(), directory, [
    ...(configured ? [`${configured}.cnd`] : []),
    "cand1.cnd",
    "cand.cnd",
  ])
}

function refreshToolbarPreview(
  composing: boolean,
  resolver: AtlasResolver,
): { width: number; height: number } | undefined {
  const path = toolbarConfigPath()
  if (!archive || !path || !archive.isText(path)) {
    delete toolbarStrip.dataset.path
    toolbarStrip.hidden = true
    return
  }
  const document = IniDocument.parse(archive.getText(path))
  const gen = archive.isText(genConfigPath())
    ? IniDocument.parse(archive.getText(genConfigPath()))
    : undefined
  const size = gen?.get("CAND", "VIEW_RECT")?.split(",").map(Number)
  toolbarStrip.hidden = composing
  toolbarStrip.dataset.path = path
  toolbarPreview.setResolver(resolver)
  toolbarPreview.setTheme(theme.value === "dark" ? "dark" : "light")
  toolbarPreview.setTransparent(device.value !== "canvas")
  const width = size?.length === 4 && Number.isFinite(size[2]) ? size[2] : 1125
  const height = size?.length === 4 && Number.isFinite(size[3]) ? size[3] : 133
  toolbarPreview.setPanel(
    document.get("CAND", "BACK_STYLE")?.split(",")[0] ?? "",
    width,
    height,
  )
  toolbarPreview.setDocument(document)
  toolbarPreview.setMode("preview")
  return { width, height }
}

function commonSelectedStyle(name: "BACK_STYLE" | "FORE_STYLE"): string | undefined {
  if (!layoutDocument || !selectedKeySections.length) return
  const values = selectedKeySections.map((section) => layoutDocument?.get(section, name)?.trim() ?? "")
  return values.every((value) => value === values[0]) ? values[0] : undefined
}

function previewDestination(
  canvas: HTMLCanvasElement,
  visual: Visual,
  foreground: boolean,
  layer: number,
): { x: number; y: number; width: number; height: number } {
  if (!foreground || !visual.source) {
    return { x: 0, y: 0, width: canvas.width, height: canvas.height }
  }
  const [, , sourceWidth, sourceHeight] = visual.source
  const scale = Math.min(
    (canvas.width * (layer === 0 ? 0.78 : 0.48)) / sourceWidth,
    (canvas.height * (layer === 0 ? 0.78 : 0.55)) / sourceHeight,
  )
  const width = sourceWidth * scale
  const height = sourceHeight * scale
  return layer === 0
    ? {
        x: (canvas.width - width) / 2,
        y: (canvas.height - height) / 2,
        width,
        height,
      }
    : { x: canvas.width - width - 2, y: 2, width, height }
}

function drawVisualPreview(canvas: HTMLCanvasElement, visuals: Array<Visual | undefined>, foreground: boolean): void {
  const context = canvas.getContext("2d")
  if (!context) return
  context.clearRect(0, 0, canvas.width, canvas.height)
  visuals.forEach((visual, layer) => {
    if (!visual) return
    const destination = previewDestination(canvas, visual, foreground, layer)
    if (visual.color && !isTransparentColor(visual.color)) {
      context.fillStyle = visual.color
      context.fillRect(destination.x, destination.y, destination.width, destination.height)
    }
    drawVisualSource(context, visual, destination)
  })
}

function drawStylePreview(
  button: HTMLButtonElement,
  visuals: Array<Visual | undefined>,
  foreground: boolean,
): void {
  const canvas = button.querySelector("canvas")
  if (!canvas) return
  delete button.dataset.path
  const firstResource = visuals.find((visual) => visual?.imagePath)?.imagePath
  if (firstResource) button.dataset.path = firstResource
  const hasVisual = visuals.some((visual) => Boolean(visual?.image || visual?.color))
  button.disabled = !hasVisual
  button.setAttribute("aria-disabled", String(!hasVisual))
  drawVisualPreview(canvas, visuals, foreground)
}

async function updateStylePreviews(): Promise<void> {
  const drawID = ++stylePreviewDrawID
  const backStyle = commonSelectedStyle("BACK_STYLE")?.split(",")[0]?.trim() ?? ""
  const foreStyles = commonSelectedStyle("FORE_STYLE")
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean) ?? []
  if (!archive) {
    for (const button of stylePreviewButtons) button.hidden = true
    return
  }
  const resolver = new AtlasResolver(archive, theme.value, orientation.value)
  const requests = stylePreviewButtons.map(async (button) => {
    const [group, state] = (button.dataset.stylePreview ?? "").split(":")
    const [scope, fieldName] = (button.dataset.stylePreviewField ?? "").split(":")
    const field = scope === "keyboard"
      ? keyboardFields.find((item) => item.dataset.keyboardField === fieldName)
      : toolbarFields.find((item) => item.dataset.toolbarField === fieldName)
    const fieldStyles = field?.value.split(",").map((value) => value.trim()).filter(Boolean) ?? []
    const styleIDs = field
      ? fieldStyles
      : group === "fore"
        ? foreStyles
        : backStyle
          ? [backStyle]
          : []
    const highlighted = state === "highlighted"
    const visuals = await Promise.all(
      styleIDs.map((styleID) => resolver.resolve(styleID, highlighted).catch(() => undefined)),
    )
    return { button, foreground: group === "fore" || button.hasAttribute("data-preview-foreground"), styleIDs, visuals }
  })
  const results = await Promise.all(requests)
  if (drawID !== stylePreviewDrawID) return
  for (const { button, foreground, styleIDs, visuals } of results) {
    button.hidden = styleIDs.length === 0
    const drawable = visuals.filter((visual): visual is Visual => Boolean(visual))
    processedPreviewVisuals.set(button, drawable)
    drawStylePreview(button, drawable, foreground)
  }
}

async function updateImagePreviews(): Promise<void> {
  const drawID = ++imagePreviewDrawID
  const background = selectedBackgroundStyleContext()
  if (!archive || !background) {
    imagePreviewVisuals.clear()
    for (const button of imagePreviewButtons) button.hidden = true
    return
  }
  const resolver = new AtlasResolver(archive, theme.value, orientation.value)
  const styleIDs = background.sections.map((section) => section.replace(/^STYLE/, ""))
  const results = await Promise.all(
    imagePreviewButtons.map(async (button) => ({
      button,
      state: button.dataset.imagePreview ?? "normal",
      visuals: await Promise.all(
        styleIDs.map((styleID) => resolver.resolve(styleID, button.dataset.imagePreview === "highlighted").catch(() => undefined)),
      ),
    })),
  )
  if (drawID !== imagePreviewDrawID) return
  for (const { button, state, visuals } of results) {
    const drawable = visuals.filter((visual): visual is Visual => Boolean(visual))
    imagePreviewVisuals.set(state, drawable)
    processedPreviewVisuals.set(button, drawable)
    button.hidden = drawable.length === 0
    drawStylePreview(button, drawable, false)
  }
}

function selectedStylePropertyContext(property: string):
  | { document: IniDocument; path: string; sources: StylePropertySource[] }
  | undefined {
  if (!archive || !layoutDocument || !selectedKeySections.length) return
  const path = styleConfigPath()
  if (!archive.isText(path)) return
  const document = IniDocument.parse(archive.getText(path))
  const sources = resolveStylePropertySources(
    document,
    selectedKeySections.map((section) => layoutDocument?.get(section, "FORE_STYLE") ?? ""),
    property,
  )
  return sources ? { document, path, sources } : undefined
}

function selectedBackgroundStyleContext():
  | { document: IniDocument; path: string; sections: string[] }
  | undefined {
  if (!archive || !layoutDocument || !selectedKeySections.length) return
  const path = styleConfigPath()
  if (!archive.isText(path)) return
  const sections = backgroundStyleSections(layoutDocument, selectedKeySections)
  if (!sections.length) return
  return { document: IniDocument.parse(archive.getText(path)), path, sections }
}

function describeAction(value: string): string {
  const known: Record<string, string> = {
    F1: "切换符号面板",
    F6: "切换数字键盘",
    F16: "切换 ABC 键盘",
    F38: "输入空格",
    F39: "换行/确认",
  }
  if (!value) return "未配置"
  if (known[value]) return known[value]
  if (/^F\d+$/.test(value)) return `百度功能码 ${value}`
  if (/^S\d+/.test(value)) return `百度状态码 ${value}`
  return `输入“${value}”`
}

function addNavButton(
  parent: HTMLElement,
  label: string,
  meta: string,
  path: string,
  className: string,
): void {
  if (!archive?.names().includes(path)) return
  const button = document.createElement("button")
  button.className = className
  button.dataset.path = path
  const navigationSystemSymbols: Record<string, string> = {
    "nav-overview": "info.circle",
    "nav-layout": "keyboard",
    "nav-component": "square.grid.2x2",
    "nav-style": "paintpalette",
  }
  button.append(createSystemSymbol(navigationSystemSymbols[className] ?? "doc"))
  const labelNode = document.createElement("span")
  labelNode.className = "nav-label"
  labelNode.textContent = label
  button.append(labelNode)
  if (meta) {
    const metaNode = document.createElement("span")
    metaNode.className = "nav-meta"
    metaNode.textContent = meta
    button.append(metaNode)
  }
  button.addEventListener("click", () => {
    if (path.endsWith("py_9.ini") || path.endsWith("py_26.ini")) {
      layout.value = path.endsWith("_9.ini") ? "py_9.ini" : "py_26.ini"
    }
    selectFile(path)
  })
  parent.append(button)
}

function populateKeyInspector(): void {
  const document = layoutDocument
  const sections = selectedKeySections
  const hasSelection = Boolean(document && sections.length)
  const skinSelected = isSkinInfoPath(selectedPath)
  const toolbarSelected = isToolbarPath(selectedPath)
  skinFieldsGroup.hidden = !skinSelected
  toolbarFieldsGroup.hidden = !toolbarSelected
  keyboardFieldsGroup.hidden = skinSelected || toolbarSelected || selectedPath !== layoutPath || hasSelection
  for (const group of keyOnlyGroups) group.hidden = skinSelected || !hasSelection
  selectedKeyName.textContent = skinSelected
    ? "皮肤信息"
    : toolbarSelected
      ? "候选栏与工具栏"
    : !hasSelection
      ? `${layout.value === "py_26.ini" ? "26 键" : "九键"} · 整体设置`
    : sections.length === 1
      ? `${sections[0]} · ${document?.get(sections[0], "CENTER") || "未配置点击动作"}`
      : `已选择 ${sections.length} 个按键`
  for (const field of skinFields) {
    field.value = skinSelected ? selectedDocument?.get("", field.dataset.skinField ?? "") ?? "" : ""
    field.disabled = !skinSelected
  }
  const toolbarGen = toolbarSelected && archive?.isText(genConfigPath())
    ? IniDocument.parse(archive.getText(genConfigPath()))
    : undefined
  for (const field of toolbarFields) {
    const [section, key] = (field.dataset.toolbarField ?? "").split(".")
    field.value = toolbarSelected
      ? selectedDocument?.get(key ? section : "CAND", key || section) ?? toolbarGen?.get("CAND", key || section) ?? ""
      : ""
    field.disabled = !toolbarSelected || !isEditing()
  }
  const keyboard = keyboardContext()
  const config = keyboard ? keyboardConfig(keyboard.gen, keyboard.styles) : undefined
  for (const field of keyboardFields) {
    const name = field.dataset.keyboardField ?? ""
    field.disabled = !config || skinSelected
    field.value =
      name === "height"
        ? String(config?.height ?? "")
        : name === "styleID"
          ? config?.styleID ?? ""
          : name === "NM_IMG"
            ? config?.normalImage ?? ""
            : name === "HL_IMG"
              ? config?.pressedImage ?? ""
              : name === "NM_COLOR"
                ? config?.normalColor ?? ""
                : config?.pressedColor ?? ""
    if (field.dataset.keyboardField?.endsWith("COLOR")) syncColorControl(field)
  }
  for (const field of keyFields) {
    const name = field.dataset.keyField ?? ""
    field.disabled = !hasSelection
    field.placeholder = ""
    if (!hasSelection) {
      field.value = ""
      continue
    }
    const rectIndex = ["x", "y", "width", "height"].indexOf(name)
    const values = sections.map((section) => {
      if (rectIndex < 0) return document?.get(section, name) ?? ""
      const rect = document?.get(section, "VIEW_RECT")?.split(",").map(Number)
      return rect?.length === 4 ? String(Math.round(rect[rectIndex])) : ""
    })
    const common = values.every((value) => value === values[0]) ? values[0] : ""
    field.value = common
    if (!common && new Set(values).size > 1) field.placeholder = "混合"
  }
  for (const field of styleFields) {
    const property = field.dataset.styleField ?? ""
    const context = selectedStylePropertyContext(property)
    const values = context?.sources.map((source) => source.value)
    const common = values?.every((value) => value === values[0]) ? values[0] : ""
    field.disabled = !context
    field.placeholder = context && !common && new Set(values).size > 1
      ? "混合"
      : context
        ? ""
        : hasSelection
          ? "未配置"
          : ""
    field.value = common ?? ""
    if (property.endsWith("COLOR")) syncColorControl(field)
  }
  const background = selectedBackgroundStyleContext()
  for (const field of backgroundStyleFields) {
    const name = field.dataset.backgroundStyleField ?? ""
    const values = background?.sections.map((section) => background.document.get(section, name) ?? "")
    const common = values?.every((value) => value === values[0]) ? values[0] : ""
    field.disabled = !background
    field.value = common ?? ""
    field.placeholder = background && !common && new Set(values).size > 1 ? "混合" : ""
  }
  for (const button of layoutActionButtons) {
    button.disabled = selectedKeySections.length < 2
  }
  const rects = selectedRects()
  for (const field of gapFields) {
    field.disabled = rects.length < 2
    field.placeholder = ""
    if (rects.length < 2) {
      field.value = ""
      continue
    }
    const horizontal = field.dataset.gapField === "horizontal"
    const sorted = [...rects].sort((a, b) => (horizontal ? a.x - b.x : a.y - b.y))
    const gaps = sorted.slice(1).map((rect, index) => {
      const previous = sorted[index]
      return horizontal
        ? rect.x - previous.x - previous.width
        : rect.y - previous.y - previous.height
    })
    const common = gaps.every((gap) => gap === gaps[0])
    field.value = common ? String(Math.round(gaps[0])) : ""
    if (!common) field.placeholder = "混合"
  }
  for (const node of actionMeaningNodes) {
    const name = node.dataset.actionMeaning ?? ""
    const values = selectedKeySections.map((section) => document?.get(section, name) ?? "")
    node.textContent =
      !hasSelection || !values.every((value) => value === values[0])
        ? hasSelection
          ? "混合操作"
          : ""
        : describeAction(values[0])
  }
  void updateStylePreviews()
  if (hasSelection) void updateImagePreviews()
  applyModeState()
}

function updateSkinInfo(field: HTMLInputElement): void {
  if (!archive || !selectedDocument || !isSkinInfoPath(selectedPath)) return
  const before = selectedDocument.toString()
  selectedDocument.set("", field.dataset.skinField ?? "", field.value)
  const text = selectedDocument.toString()
  commitText(selectedPath, before, text)
  setSourceValue(text)
  updateDirty()
}

function updateKeyboard(field: HTMLInputElement): void {
  if (!archive) return
  const context = keyboardContext()
  if (!context) return
  const name = field.dataset.keyboardField ?? ""
  if (name === "height") {
    const before = context.gen.toString()
    if (!setKeyboardHeight(context.gen, Number(field.value))) return
    commitText(context.genPath, before, context.gen.toString())
  } else if (name === "styleID") {
    const before = context.gen.toString()
    context.gen.set("PANEL", "BACK_STYLE", field.value)
    commitText(context.genPath, before, context.gen.toString())
  } else {
    const styleID = context.gen.get("PANEL", "BACK_STYLE")?.split(",")[0].trim()
    if (!styleID) return
    const before = context.styles.toString()
    context.styles.set(`STYLE${styleID}`, name, field.value)
    commitText(context.stylePath, before, context.styles.toString())
  }
  refreshPreview()
  populateKeyInspector()
  updateDirty()
}

function updateToolbar(field: HTMLInputElement): void {
  if (!archive || !selectedDocument || !isToolbarPath(selectedPath) || !isEditing()) return
  const [section, key] = (field.dataset.toolbarField ?? "").split(".")
  const property = key || section
  const targetSection = key ? section : "CAND"
  const path = property === "VIEW_RECT" ? genConfigPath() : selectedPath
  if (!archive.isText(path)) return
  const document = path === selectedPath ? selectedDocument : IniDocument.parse(archive.getText(path))
  const before = document.toString()
  if (!document.set(targetSection, property, field.value)) return
  const text = document.toString()
  commitText(path, before, text)
  if (path === selectedPath) setSourceValue(text)
  refreshPreview()
  populateKeyInspector()
  updateDirty()
}

function updateSelectedKey(field: HTMLInputElement): void {
  if (!archive || !layoutDocument || !selectedKeySections.length) return
  const before = layoutDocument.toString()
  const name = field.dataset.keyField ?? ""
  const rectNames = ["x", "y", "width", "height"]
  const rectIndex = rectNames.indexOf(name)
  for (const section of selectedKeySections) {
    if (rectIndex >= 0) {
      const rect = layoutDocument.get(section, "VIEW_RECT")?.split(",").map(Number)
      const value = Number(field.value)
      if (!rect || rect.length !== 4 || !Number.isFinite(value)) continue
      rect[rectIndex] = value
      layoutDocument.set(section, "VIEW_RECT", rect.map(Math.round).join(","))
    } else {
      layoutDocument.set(section, name, field.value)
    }
  }
  const text = layoutDocument.toString()
  commitText(layoutPath, before, text)
  if (selectedPath === layoutPath) setSourceValue(text)
  preview.setDocument(layoutDocument)
  populateKeyInspector()
  updateDirty()
}

function updateSelectedStyle(field: HTMLInputElement): void {
  const property = field.dataset.styleField ?? ""
  const context = selectedStylePropertyContext(property)
  if (!archive || !context) return
  const before = context.document.toString()
  for (const section of new Set(context.sources.map((source) => source.section))) {
    context.document.set(section, property, field.value)
  }
  const text = context.document.toString()
  commitText(context.path, before, text)
  if (selectedPath === context.path) setSourceValue(text)
  refreshPreview()
  populateKeyInspector()
  updateDirty()
}

function updateSelectedBackgroundStyle(field: HTMLInputElement): void {
  const context = selectedBackgroundStyleContext()
  if (!archive || !context) return
  const before = context.document.toString()
  setStyleField(
    context.document,
    context.sections,
    field.dataset.backgroundStyleField ?? "",
    field.value,
  )
  const text = context.document.toString()
  commitText(context.path, before, text)
  if (selectedPath === context.path) setSourceValue(text)
  refreshPreview()
  populateKeyInspector()
  updateDirty()
}

function selectedRects(): LayoutRect[] {
  if (!layoutDocument) return []
  return selectedKeySections.flatMap((section) => {
    const values = layoutDocument?.get(section, "VIEW_RECT")?.split(",").map(Number)
    if (!values || values.length !== 4 || values.some((value) => !Number.isFinite(value))) return []
    const [x, y, width, height] = values
    return [{ section, x, y, width, height }]
  })
}

function applyLayoutAction(action: string): void {
  if (!archive || !layoutDocument) return
  const rects = transformLayout(selectedRects(), action as LayoutAction)
  if (rects.length < 2) return
  const before = layoutDocument.toString()
  for (const rect of rects) {
    layoutDocument.set(
      rect.section,
      "VIEW_RECT",
      [rect.x, rect.y, rect.width, rect.height].map(Math.round).join(","),
    )
  }
  const text = layoutDocument.toString()
  commitText(layoutPath, before, text)
  if (selectedPath === layoutPath) setSourceValue(text)
  preview.setDocument(layoutDocument)
  populateKeyInspector()
  updateDirty()
}

function applyExactGap(field: HTMLInputElement): void {
  if (!archive || !layoutDocument) return
  const gap = Number(field.value)
  if (!Number.isFinite(gap)) return
  const rects = setExactGap(
    selectedRects(),
    field.dataset.gapField === "horizontal" ? "horizontal" : "vertical",
    gap,
  )
  if (rects.length < 2) return
  const before = layoutDocument.toString()
  for (const rect of rects) {
    layoutDocument.set(
      rect.section,
      "VIEW_RECT",
      [rect.x, rect.y, rect.width, rect.height].map(Math.round).join(","),
    )
  }
  const text = layoutDocument.toString()
  commitText(layoutPath, before, text)
  if (selectedPath === layoutPath) setSourceValue(text)
  preview.setDocument(layoutDocument)
  populateKeyInspector()
  updateDirty()
}

function moveSelectedKeys(deltaX: number, deltaY: number): void {
  if (!archive || !layoutDocument) return
  const rects = moveRects(selectedRects(), deltaX, deltaY)
  if (!rects.length) return
  const before = layoutDocument.toString()
  for (const rect of rects) {
    layoutDocument.set(
      rect.section,
      "VIEW_RECT",
      [rect.x, rect.y, rect.width, rect.height].map(Math.round).join(","),
    )
  }
  const text = layoutDocument.toString()
  commitText(layoutPath, before, text)
  if (selectedPath === layoutPath) setSourceValue(text)
  preview.setDocument(layoutDocument)
  populateKeyInspector()
  updateDirty()
}

function isTextEditingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return Boolean(target.closest("input, textarea, select, button, [contenteditable]"))
}

function selectFile(path: string): void {
  if (archive?.isImage(path) && selectedPath && !archive.isImage(selectedPath)) {
    assetReturnPath = selectedPath
  }
  selectedPath = path
  if (archive?.isImage(path)) {
    inspectorTab = "properties"
    selectedDocument = undefined
    showImage(path)
  } else if (archive?.isText(path)) {
    hideImageWorkspace()
    selectedDocument = IniDocument.parse(archive.getText(path))
    setSourceValue(selectedDocument.toString())
    source.disabled = false
    sourceName.textContent = path
    if (/\.(ini)$/i.test(path) && previewItems(selectedDocument).some((item) => item.editable)) {
      layoutPath = path
      layoutDocument = selectedDocument
      selectedKeySections = []
      inspectorTab = "properties"
      refreshPreview()
    } else if (isSkinInfoPath(path) || isToolbarPath(path)) {
      inspectorTab = "properties"
    } else if (path !== layoutPath) {
      inspectorTab = "source"
    }
  } else {
    return
  }
  if (path === layoutPath && selectedDocument) {
    layoutDocument = selectedDocument
    refreshPreview()
  }
  updateInspectorView()
  if (!quickInspector.hidden) populateKeyInspector()
  selectedFileButton?.classList.remove("selected")
  selectedFileButton = files.querySelector<HTMLButtonElement>(`button[data-path="${CSS.escape(path)}"]`) ?? undefined
  selectedFileButton?.classList.add("selected")
}

function renderFiles(): void {
  files.replaceChildren()
  selectedFileButton = undefined
  if (!archive) return

  const section = (title: string) => {
    const heading = document.createElement("div")
    heading.className = "nav-section"
    heading.textContent = title
    files.append(heading)
  }

  section("皮肤")
  const overviewPath = archive.names().includes(`${theme.value}/skin/Info.txt`)
    ? `${theme.value}/skin/Info.txt`
    : "Info.txt"
  addNavButton(files, "皮肤信息", "名称、作者和版本", overviewPath, "nav-overview")

  section("键盘布局")
  const ninePath = currentConfigPath("py_9.ini")
  const nineCount = layoutKeyCount(ninePath)
  addNavButton(
    files,
    "9键",
    nineCount && nineCount !== 9 ? `九键基础 · 自定义 ${nineCount} 字母键` : `${nineCount || 9} 个字母键`,
    ninePath,
    "nav-layout",
  )
  const twentySixPath = currentConfigPath("py_26.ini")
  addNavButton(
    files,
    "26 键",
    `${layoutKeyCount(twentySixPath) || 26} 个字母键`,
    twentySixPath,
    "nav-layout",
  )

  section("键盘组件")
  const candidatePath = toolbarConfigPath()
  if (candidatePath) addNavButton(files, "候选栏与工具栏", candidatePath.split("/").pop() ?? "", candidatePath, "nav-component")
  const components = [
    ["数字键盘", "num_9.ini"],
    ["符号面板", "symbol.ini"],
    ["手写面板", "hw_grid.ini"],
    ["输入法标识", "logo.ini"],
  ]
  for (const [label, name] of components) {
    addNavButton(files, label, name, currentConfigPath(name), "nav-component")
  }
  const hintPath = firstExistingPath(archive.names(), `${theme.value}/skin/${orientation.value}`, ["hint1.pop", "hint.pop"])
  if (hintPath) addNavButton(files, "按键气泡", hintPath.split("/").pop() ?? "", hintPath, "nav-component")

  section("外观与资源")
  addNavButton(
    files,
    "按键样式",
    "颜色、图片和按下状态",
    styleConfigPath(),
    "nav-style",
  )
  addNavButton(
    files,
    "图片资源",
    "按键图集",
    `${theme.value}/skin/res/btn.png`,
    "nav-style",
  )

  const divider = document.createElement("div")
  divider.className = "nav-divider"
  files.append(divider)
  const details = document.createElement("details")
  details.className = "raw-files"
  const summary = document.createElement("summary")
  summary.textContent = `高级 · 源文件 (${archive.names().filter((name) => !name.endsWith("/")).length})`
  details.append(summary)
  type SourceNode = { folders: Map<string, SourceNode>; paths: string[] }
  const root: SourceNode = { folders: new Map(), paths: [] }
  for (const path of archive.names().filter((name) => !name.endsWith("/"))) {
    const parts = path.split("/")
    let node = root
    for (const part of parts.slice(0, -1)) {
      let child = node.folders.get(part)
      if (!child) {
        child = { folders: new Map(), paths: [] }
        node.folders.set(part, child)
      }
      node = child
    }
    node.paths.push(path)
  }
  const appendNode = (parent: HTMLElement, node: SourceNode, parentPath = "") => {
    for (const [name, child] of node.folders) {
      const path = parentPath ? `${parentPath}/${name}` : name
      const folder = document.createElement("details")
      folder.className = "raw-folder"
      folder.dataset.folderPath = path
      const folderSummary = document.createElement("summary")
      const title = document.createElement("span")
      title.textContent = name
      const description = document.createElement("small")
      description.textContent = sourceFolderDescription(path)
      folderSummary.append(createSystemSymbol("folder"), title, description)
      folder.append(folderSummary)
      appendNode(folder, child, path)
      parent.append(folder)
    }
    for (const path of node.paths) {
      const button = document.createElement("button")
      const sourceSymbol = archive?.isText(path)
        ? "doc.text"
        : archive?.isImage(path)
          ? "photo"
          : "doc"
      button.append(createSystemSymbol(sourceSymbol))
      const label = document.createElement("span")
      label.className = "nav-label"
      label.textContent = path.split("/").pop() ?? path
      button.append(label)
      button.title = path
      button.dataset.path = path
      button.disabled = !archive?.isText(path) && !archive?.isImage(path)
      button.addEventListener("click", () => selectFile(path))
      parent.append(button)
    }
  }
  appendNode(details, root)
  files.append(details)
}

function revealSourceFile(path: string): void {
  const button = Array.from(files.querySelectorAll<HTMLButtonElement>(".raw-files button[data-path]"))
    .find((item) => item.dataset.path === path)
  if (!button) return
  let parent = button.parentElement
  while (parent) {
    if (parent instanceof HTMLDetailsElement) parent.open = true
    parent = parent.parentElement
  }
  button.scrollIntoView({ block: "nearest" })
}

function loadArchive(bytes: Uint8Array, path: string, isNew = false): void {
  const nextArchive = SkinArchive.open(bytes)
  assetURL = releaseImagePreviewURL(assetURL)
  archive = nextArchive
  const availableThemes = ["light", "dark"].filter((value) =>
    archive?.names().some((name) => name.startsWith(`${value}/skin/`)),
  )
  if (!availableThemes.includes(theme.value)) theme.value = availableThemes[0] ?? "light"
  const preferredDevice = localStorage.getItem("default-device")
  if (preferredDevice && Array.from(device.options).some((option) => option.value === preferredDevice)) {
    device.value = preferredDevice
  }
  canvasWrap.classList.remove("empty")
  currentPath = path
  unsavedNew = isNew
  undoStack = []
  redoStack = []
  updateHistoryButtons()
  documentName.textContent = isNew
    ? exportName("未命名", archive.format)
    : path.split(/[\\/]/).pop() || "未命名皮肤"
  saveButton.disabled = false
  for (const button of exportButtons) button.disabled = false
  renderFiles()
  layoutPath = preferredPath()
  const initial = archive.names().includes(layoutPath)
    ? layoutPath
    : archive.names().find((name) => archive?.isText(name))
  if (initial) {
    layoutPath = initial
    selectFile(initial)
  }
  updateDirty()
}

async function openNative(): Promise<boolean> {
  if (!(await prepareDocumentReplacement())) return false
  const path = await open({
    multiple: false,
    filters: [{ name: "百度输入法皮肤", extensions: ["bdi", "bds", "zip"] }],
  })
  if (typeof path !== "string") return false
  await loadNativePath(path)
  return true
}

async function loadNativePath(path: string): Promise<boolean> {
  const bytes = await invoke<number[]>("read_file", { path })
  loadArchive(new Uint8Array(bytes), path)
  return true
}

function currentExportFormat(): ExportFormat {
  return exportFormatFromPath(currentPath) ?? archive?.format ?? "bdi"
}

async function saveNative(saveAs: boolean, format: ExportFormat): Promise<boolean> {
  if (!archive) throw new Error("当前没有可保存的皮肤")
  let path = currentPath
  if (saveAs || !path || exportFormatFromPath(path) !== format) {
    const picked = await save({
      defaultPath: exportName(documentName.textContent ?? "skin", format),
      filters: [
        {
          name: format === "bdi" ? "百度输入法 iOS 皮肤" : "百度输入法 Android 皮肤",
          extensions: [format],
        },
      ],
    })
    if (!picked) return false
    path = exportPath(picked, format)
  }
  const bytes = archive.toBytes(format)
  await invoke("write_file", { path, data: Array.from(bytes) })
  currentPath = path
  unsavedNew = false
  archive.markSaved(bytes)
  documentName.textContent = path.split(/[\\/]/).pop() || "未命名皮肤"
  updateDirty()
  return true
}

function downloadArchive(format: ExportFormat): boolean {
  if (!archive) throw new Error("当前没有可保存的皮肤")
  const bytes = archive.toBytes(format)
  const blob = new Blob([bytes as BlobPart], { type: "application/zip" })
  const link = document.createElement("a")
  link.href = URL.createObjectURL(blob)
  link.download = exportName(documentName.textContent || "skin", format)
  link.click()
  URL.revokeObjectURL(link.href)
  archive.markSaved(bytes)
  unsavedNew = false
  updateDirty()
  return true
}

function chooseProjectTemplate(): Promise<string | undefined> {
  newProjectDialog.returnValue = ""
  newProjectDialog.showModal()
  return new Promise((resolve) => {
    newProjectDialog.addEventListener(
      "close",
      () => {
        const templateID = new FormData(newProjectForm).get("project-template")
        resolve(
          newProjectDialog.returnValue === "create" && typeof templateID === "string"
            ? templateID
            : undefined,
        )
      },
      { once: true },
    )
  })
}

async function newDocument(): Promise<boolean> {
  const templateID = await chooseProjectTemplate()
  if (!templateID) return false
  if (!(await prepareDocumentReplacement())) return false
  loadArchive(await loadBuiltInProjectTemplate(templateID), "", true)
  return true
}

newButton.addEventListener("click", () => void runFileOperation("新建项目", newDocument))
openButton.addEventListener("click", () => {
  if (isTauri()) void runFileOperation("打开", openNative)
  else {
    void runFileOperation("打开", async () => {
      if (!(await prepareDocumentReplacement())) return false
      browserOpen.click()
      return false
    })
  }
})
emptyOpenButton.addEventListener("click", () => openButton.click())
saveButton.addEventListener("click", () => {
  void runFileOperation("保存", () =>
    isTauri()
      ? saveNative(false, currentExportFormat())
      : downloadArchive(currentExportFormat()),
  )
})
for (const button of exportButtons) {
  button.addEventListener("click", () => {
    const format = button.dataset.exportFormat as ExportFormat
    toolbarMore.open = false
    void runFileOperation("导出", () =>
      isTauri() ? saveNative(true, format) : downloadArchive(format),
    )
  })
}
for (const button of appDialogButtons) {
  button.addEventListener("click", () => {
    const dialog = button.dataset.appDialog === "settings" ? settingsDialog : aboutDialog
    dialog.showModal()
  })
}
defaultDevice.value = localStorage.getItem("default-device") ?? device.value
defaultDevice.addEventListener("change", () => {
  localStorage.setItem("default-device", defaultDevice.value)
})
canvasBackground.value = localStorage.getItem("canvas-background") ?? "default"
canvasWrap.dataset.background = canvasBackground.value
canvasBackground.addEventListener("change", () => {
  localStorage.setItem("canvas-background", canvasBackground.value)
  canvasWrap.dataset.background = canvasBackground.value
})
undoButton.addEventListener("click", undo)
redoButton.addEventListener("click", redo)
browserOpen.addEventListener("change", async () => {
  const file = browserOpen.files?.[0]
  if (file) {
    await runFileOperation("打开", async () => {
      loadArchive(new Uint8Array(await file.arrayBuffer()), file.name)
      return true
    })
  }
  browserOpen.value = ""
})
replaceAssetButton.addEventListener("click", () => imageOpen.click())
assetBackButton.addEventListener("click", () => {
  const path = assetReturnPath
  if (!path || !archive?.names().includes(path)) return
  assetReturnPath = ""
  selectFile(path)
  revealSourceFile(path)
})
imageOpen.addEventListener("change", async () => {
  const file = imageOpen.files?.[0]
  if (file && archive?.isImage(selectedPath)) {
    await runFileOperation("替换图片", async () => {
      archive?.setBytes(selectedPath, new Uint8Array(await file.arrayBuffer()))
      showImage(selectedPath)
      refreshPreview()
      updateDirty()
      return true
    })
  }
  imageOpen.value = ""
})
source.addEventListener("input", () => {
  if (!isEditing() || !archive || !selectedPath) return
  const before = selectedDocument?.toString() ?? archive.getText(selectedPath)
  selectedDocument = IniDocument.parse(source.value)
  commitText(selectedPath, before, source.value)
  if (selectedPath === layoutPath) layoutDocument = selectedDocument
  refreshPreview()
  populateKeyInspector()
  updateDirty()
  updateSourceHighlight()
})
source.addEventListener("scroll", () => {
  const highlight = $("#source-highlight")
  highlight.scrollTop = source.scrollTop
  highlight.scrollLeft = source.scrollLeft
})
for (const field of keyFields) {
  field.addEventListener("input", () => updateSelectedKey(field))
}
for (const field of styleFields) {
  field.addEventListener("input", () => updateSelectedStyle(field))
}
for (const field of [...keyboardFields, ...styleFields]) {
  if (!field.dataset.keyboardField?.endsWith("COLOR") && !field.dataset.styleField?.endsWith("COLOR")) continue
  field.addEventListener("input", () => syncColorControl(field))
  field.addEventListener("change", () => syncColorControl(field))
}
for (const field of backgroundStyleFields) {
  field.addEventListener("input", () => updateSelectedBackgroundStyle(field))
}
for (const field of keyboardFields) {
  field.addEventListener("change", () => updateKeyboard(field))
}
for (const field of toolbarFields) {
  field.addEventListener("change", () => updateToolbar(field))
}
for (const field of skinFields) {
  field.addEventListener("input", () => updateSkinInfo(field))
}
for (const field of gapFields) {
  field.addEventListener("change", () => applyExactGap(field))
}
for (const picker of colorPickers) {
  picker.addEventListener("click", (event) => {
    event.preventDefault()
    const key = picker.dataset.colorPickerFor ?? ""
    const field = document.querySelector<HTMLInputElement>(
      `[data-${key.startsWith("keyboard-") ? "keyboard" : "style"}-field="${CSS.escape(key.replace(/^(keyboard|style)-/, ""))}"]`,
    )
    if (!field) return
    const value = field.value.trim().replace(/^#/, "")
    const hex = value.length === 6 ? `FF${value}` : /^[0-9a-f]{8}$/i.test(value) ? value : "FFFFFFFF"
    rgbaFields.r.value = String(Number.parseInt(hex.slice(2, 4), 16))
    rgbaFields.g.value = String(Number.parseInt(hex.slice(4, 6), 16))
    rgbaFields.b.value = String(Number.parseInt(hex.slice(6, 8), 16))
    rgbaFields.a.value = String(Number.parseInt(hex.slice(0, 2), 16))
    rgbaPicker.value = `#${hex.slice(2)}`
    colorDialog.dataset.fieldKey = key
    updateRgbaPreview()
    colorDialog.showModal()
  })
  picker.addEventListener("input", () => {
    const alpha = colorAlphas.find((item) => item.dataset.colorAlphaFor === picker.dataset.colorPickerFor)
    writeColorControl(picker, Number(alpha?.value ?? 100))
  })
}
function updateRgbaPreview(): void {
  const r = Number(rgbaFields.r.value) || 0
  const g = Number(rgbaFields.g.value) || 0
  const b = Number(rgbaFields.b.value) || 0
  const a = Number(rgbaFields.a.value) || 0
  rgbaPicker.value = `#${[r, g, b].map((value) => Math.max(0, Math.min(255, value)).toString(16).padStart(2, "0")).join("")}`
  rgbaPreview.style.backgroundColor = `rgba(${r}, ${g}, ${b}, ${a / 255})`
}
for (const field of Object.values(rgbaFields)) field.addEventListener("input", updateRgbaPreview)
rgbaPicker.addEventListener("input", () => {
  const hex = rgbaPicker.value.slice(1)
  rgbaFields.r.value = String(Number.parseInt(hex.slice(0, 2), 16))
  rgbaFields.g.value = String(Number.parseInt(hex.slice(2, 4), 16))
  rgbaFields.b.value = String(Number.parseInt(hex.slice(4, 6), 16))
  updateRgbaPreview()
})
colorDialog.querySelector("form")?.addEventListener("submit", (event) => {
  if ((event.submitter as HTMLButtonElement | null)?.value !== "ok") return
  const key = colorDialog.dataset.fieldKey ?? ""
  const field = document.querySelector<HTMLInputElement>(
    `[data-${key.startsWith("keyboard-") ? "keyboard" : "style"}-field="${CSS.escape(key.replace(/^(keyboard|style)-/, ""))}"]`,
  )
  if (!field) return
  field.value = [rgbaFields.a, rgbaFields.r, rgbaFields.g, rgbaFields.b]
    .map((item) => Math.max(0, Math.min(255, Number(item.value) || 0)).toString(16).padStart(2, "0"))
    .join("").toUpperCase()
  field.dispatchEvent(new Event(field.hasAttribute("data-keyboard-field") ? "change" : "input", { bubbles: true }))
})
for (const alpha of colorAlphas) {
  alpha.addEventListener("input", () => writeColorControl(alpha, Number(alpha.value)))
}
for (const button of layoutActionButtons) {
  button.addEventListener("click", () => applyLayoutAction(button.dataset.layoutAction ?? ""))
}
for (const button of inspectorTabButtons) {
  button.addEventListener("click", () => {
    inspectorTab = button.dataset.inspectorTab === "source" ? "source" : "properties"
    updateInspectorView()
  })
}
for (const control of [theme, orientation, layout]) {
  control.addEventListener("change", () => {
    const path = preferredPath()
    if (archive?.names().includes(path)) {
      layoutPath = path
      layoutDocument = IniDocument.parse(archive.getText(path))
      selectedKeySections = []
      renderFiles()
      selectFile(path)
    }
    updateDevicePreview()
    syncSegmentedControls()
    refreshPreview()
  })
}
mode.addEventListener("change", () => {
  populateKeyInspector()
  eventLog.textContent =
    mode.value === "edit"
      ? "编辑模式：点击选择按键，在检查器中修改布局与属性。"
      : "交互预览：配置只读；可点击、长按或滑动按键模拟操作。"
})
for (const button of modeChoiceButtons) {
  button.addEventListener("click", () => selectChoice(mode, button.dataset.modeChoice ?? "preview"))
}
for (const button of themeChoiceButtons) {
  button.addEventListener("click", () => selectChoice(theme, button.dataset.themeChoice ?? "light"))
}
for (const button of orientationChoiceButtons) {
  button.addEventListener("click", () => selectChoice(orientation, button.dataset.orientationChoice ?? "port"))
}
candidateArea.addEventListener("click", () => {
  if (!isEditing()) return
  const path = toolbarStrip.dataset.path
  if (path) selectFile(path)
})
for (const button of stylePreviewButtons) {
  button.addEventListener("click", (event) => {
    if (!(event.metaKey || event.ctrlKey)) {
      const visuals = processedPreviewVisuals.get(button)
      if (!visuals?.length) return
      drawVisualPreview(styleImagePreview, visuals, button.dataset.stylePreview?.startsWith("fore:") || button.hasAttribute("data-preview-foreground"))
      styleImageDialog.showModal()
      return
    }
    const path = button.dataset.path
    if (!path) return
    selectFile(path)
    revealSourceFile(path)
  })
}
for (const button of imagePreviewButtons) {
  button.addEventListener("click", () => {
    const visuals = imagePreviewVisuals.get(button.dataset.imagePreview ?? "")
    if (!visuals?.length) return
    drawVisualPreview(styleImagePreview, visuals, false)
    styleImageDialog.showModal()
  })
}
styleImageDialog.addEventListener("click", (event) => {
  if (event.target === styleImageDialog) styleImageDialog.close()
})
for (const button of Array.from(editContextMenu.querySelectorAll<HTMLButtonElement>("[data-context-action]"))) {
  button.addEventListener("click", () => {
    if (button.dataset.contextAction === "copy") copySelectedKeys()
    else deleteSelectedKeys()
    editContextMenu.hidden = true
  })
}
device.addEventListener("change", () => {
  updateDevicePreview()
  refreshPreview()
})
clearSimulationButton.addEventListener("click", () => {
  simulatedOutput.value = ""
  simulatedOutput.setSelectionRange(0, 0)
  refreshSimulationState()
})
simulatedOutput.addEventListener("input", refreshSimulationState)
window.addEventListener("keydown", (event) => {
  const movement: Record<string, readonly [number, number]> = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
  }
  const direction = movement[event.key]
  if (direction) {
    if (!isEditing() || !selectedKeySections.length || isTextEditingTarget(event.target)) return
    event.preventDefault()
    const distance = event.shiftKey ? 10 : 1
    moveSelectedKeys(direction[0] * distance, direction[1] * distance)
    return
  }
  if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z") return
  event.preventDefault()
  if (event.shiftKey) redo()
  else undo()
})
window.addEventListener("pointerdown", (event) => {
  if (toolbarMore.open && !toolbarMore.contains(event.target as Node)) toolbarMore.open = false
  if (!editContextMenu.hidden && !editContextMenu.contains(event.target as Node)) editContextMenu.hidden = true
})
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") editContextMenu.hidden = true
})
window.addEventListener("beforeunload", (event) => {
  if (isTauri() || !hasUnsavedChanges()) return
  event.preventDefault()
  event.returnValue = ""
})
if (isTauri()) {
  let destroyingWindow = false
  void getCurrentWindow().onCloseRequested(async (event) => {
    if (destroyingWindow) return
    event.preventDefault()
    const shouldClose = await prepareDocumentReplacement()
    if (!shouldClose) return
    destroyingWindow = true
    void invoke("quit_app")
  })
  void listen<string[]>("opened", async (event) => {
    const path = event.payload[0]
    if (path && (await prepareDocumentReplacement())) {
      void runFileOperation("打开", () => loadNativePath(path))
    }
  })
  void invoke<string[]>("take_opened_files")
    .then((paths) => {
      if (paths[0]) void runFileOperation("打开", () => loadNativePath(paths[0]))
    })
    .catch((error) => showError(error, "读取启动文件"))
}
mode.value = "preview"
applyModeState()
updateDevicePreview()
updateSourceHighlight()
updateInspectorView()
