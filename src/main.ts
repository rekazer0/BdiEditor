import { invoke } from "@tauri-apps/api/core"
import { emitTo, listen } from "@tauri-apps/api/event"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { WebviewWindow } from "@tauri-apps/api/webviewWindow"
import { message, open, save } from "@tauri-apps/plugin-dialog"
import "./style.css"
import { previewPageTransition, previewStateFromAction } from "./actions.ts"
import {
  AtlasResolver,
  canvasFontFamily,
  drawVisualSource,
  isTransparentColor,
  resolveTextVisual,
  type TextVisual,
  type Visual,
  type VisualResolver,
} from "./atlas.ts"
import { deviceSpec, keyboardPreviewGeometry, showsKeyboardAccessories } from "./devices.ts"
import {
  exportFormatFromPath,
  exportName,
  exportPath,
  type ExportFormat,
} from "./export.ts"
import {
  BdaResolver,
  bdaAppearancePath,
  bdaColorHex,
  bdaConfigPath,
  bdaLayoutDocument,
  bdaLayoutNames,
  bdaStyleID,
  bdaStyleRef,
  decodeBdaAnimation,
  decodeBdaAppearance,
  describeBdaConfig,
  updateBdaAnimationFrame,
  updateBdaStyle,
  type BdaAppearance,
  type BdaStyleRef,
} from "./bda.ts"
import { convertBdaArchive } from "./bda-convert.ts"
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
import { shouldClearMixedInput } from "./mixed-input.ts"
import { loadBuiltInProjectTemplate, operationError } from "./operations.ts"
import {
  availableSkinStates,
  canvasFitWidth,
  copiedResourceBase,
  copyablePanelPaths,
  mergePanelStyles,
  panelStyleIDs,
  previewScalePercent,
  rewriteStyleImageBases,
  scaleIniDocument,
  scalePanelDocument,
  validPanelFilename,
} from "./panel-tools.ts"
import { Preview, previewContentVerticalBounds, previewItems, type PreviewEvent } from "./preview.ts"
import { firstExistingPath, resourceImagePaths } from "./resources.ts"
import { candidatePreview, deleteBackward, insertText } from "./simulation.ts"
import { SkinArchive } from "./skin.ts"
import { resolveStylePropertySources, type StylePropertySource } from "./style-properties.ts"
import {
  boundedTileRect,
  duplicateTileSlice,
  moveTileRect,
  nextTileIndex,
  removeTileSlice,
  tileSliceAt,
  tilePreviewDestination,
  tileSlices,
  updateTileSlice,
  type TilePoint,
  type TileRect,
  type TileSlice,
} from "./tiles.ts"
import { unsavedDecision } from "./unsaved.ts"
import { checkForUpdate } from "./update.ts"

document.documentElement.classList.toggle("macos", navigator.userAgent.includes("Macintosh"))
document.documentElement.classList.toggle("windows", navigator.userAgent.includes("Windows"))

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!
const newButton = $("#new") as HTMLButtonElement
const newProjectDialog = $("#new-project-dialog") as HTMLDialogElement
const newProjectForm = $("#new-project-form") as HTMLFormElement
const openButton = $("#open") as HTMLButtonElement
const saveButton = $("#save") as HTMLButtonElement
const undoButton = $("#undo") as HTMLButtonElement
const redoButton = $("#redo") as HTMLButtonElement
const toolbarMore = $(".toolbar-more") as HTMLDetailsElement
const toolbarMenus = Array.from(document.querySelectorAll<HTMLDetailsElement>(".toolbar-more"))
const appDialogButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-app-dialog]"))
const settingsDialog = $("#settings-dialog") as HTMLDialogElement
const aboutDialog = $("#about-dialog") as HTMLDialogElement
const copyQqGroupButton = $("#copy-qq-group") as HTMLButtonElement
const aboutUpdate = $("#about-update")
const checkUpdateButton = $("#check-update") as HTMLButtonElement
const updateStatus = $("#update-status")
const downloadUpdate = $("#download-update") as HTMLAnchorElement
const editContextMenu = $("#edit-context-menu") as HTMLDivElement
const defaultDevice = $("#default-device") as HTMLSelectElement
const canvasBackground = $("#canvas-background") as HTMLSelectElement
const appTheme = $("#app-theme") as HTMLSelectElement
const windowMaterial = $("#window-material") as HTMLInputElement
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
const sidebarViewButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-sidebar-view]"))
const documentName = $("#document-name")
const sourceName = $("#source-name")
const dirty = $("#dirty")
const eventLog = $("#event-log")
const panelStatus = $("#panel-status")
const panelScaleButton = $("#panel-scale") as HTMLButtonElement
const panelScaleDialog = $("#panel-scale-dialog") as HTMLDialogElement
const panelScaleForm = $("#panel-scale-form") as HTMLFormElement
const panelCopySource = $("#panel-copy-source") as HTMLSelectElement
const panelTargetTheme = $("#panel-target-theme") as HTMLSelectElement
const panelTargetOrientation = $("#panel-target-orientation") as HTMLSelectElement
const panelTargetExisting = $("#panel-target-existing") as HTMLSelectElement
const panelTargetFile = $("#panel-target-file") as HTMLInputElement
const panelScaleEnabled = $("#panel-scale-enabled") as HTMLInputElement
const panelScaleOptions = $("#panel-scale-options")
const panelSourceWidth = $("#panel-source-width") as HTMLInputElement
const panelSourceHeight = $("#panel-source-height") as HTMLInputElement
const panelTargetWidth = $("#panel-target-width") as HTMLInputElement
const panelTargetHeight = $("#panel-target-height") as HTMLInputElement
const panelScaleSummary = $("#panel-scale-summary")
const quickInspector = $("#quick-inspector")
const selectedKeyName = $("#selected-key")
const keyFields = Array.from(document.querySelectorAll<HTMLInputElement>("[data-key-field]"))
const styleFields = Array.from(document.querySelectorAll<HTMLInputElement>("[data-style-field]"))
const keyboardFields = Array.from(
  document.querySelectorAll<HTMLInputElement>("[data-keyboard-field]"),
)
const skinFields = Array.from(document.querySelectorAll<HTMLInputElement>("[data-skin-field]"))
const keyboardFieldsGroup = $(".keyboard-fields")
const toolbarFieldsGroup = $(".toolbar-fields")
const toolbarFields = Array.from(document.querySelectorAll<HTMLInputElement>("[data-toolbar-field]"))
const skinFieldsGroup = $(".skin-fields")
const documentFieldsGroup = $(".document-fields")
const documentFields = $("#document-fields")
const bdaConfigFieldsGroup = $(".bda-config-fields")
const bdaConfigFields = $("#bda-config-fields")
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
const baiduActionCodes = $("#baidu-action-codes") as HTMLDataListElement
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
const toggleGuides = $("#toggle-guides") as HTMLButtonElement
const skinStateControl = $("#skin-state-control")
const skinState = $("#skin-state") as HTMLSelectElement
const deviceShell = $("#device-shell")
const workspaceImageFigure = $("#workspace-image-figure")
const workspaceImage = $("#workspace-image") as HTMLImageElement
const atlasCanvas = $("#atlas-canvas") as HTMLCanvasElement
const workspaceImageError = $("#workspace-image-error")
const resourceInspector = $("#resource-inspector")
const resourceListView = $("#resource-list-view")
const resourceListTitle = $("#resource-list-title")
const resourceDetail = $("#resource-detail")
const imageResourceDetail = $("#image-resource-detail")
const styleResourceDetail = $("#style-resource-detail")
const styleDetailFields = $("#style-detail-fields")
const styleDetailNormal = $("#style-detail-normal") as HTMLCanvasElement
const styleDetailHighlighted = $("#style-detail-highlighted") as HTMLCanvasElement
const styleDetailImageButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-style-image-property]"))
const resourceBackButton = $("#resource-back") as HTMLButtonElement
const resourceName = $("#resource-name")
const resourceMeta = $("#resource-meta")
const resourceCount = $("#resource-count")
const resourceSearch = $("#resource-search") as HTMLInputElement
const resourceGallery = $("#resource-gallery")
const resourceUploadButton = $("#resource-upload") as HTMLButtonElement
const styleAddButton = $("#style-add") as HTMLButtonElement
const newStyleDialog = $("#new-style-dialog") as HTMLDialogElement
const newStyleForm = $("#new-style-form") as HTMLFormElement
const newStyleID = $("#new-style-id") as HTMLInputElement
const newStyleError = $("#new-style-error")
const resourceDownloadButton = $("#resource-download") as HTMLButtonElement
const resourceDeleteButton = $("#resource-delete") as HTMLButtonElement
const resourceUploadInput = $("#resource-upload-input") as HTMLInputElement
const inspectorResizeHandle = $("#inspector-resize-handle") as HTMLDivElement
const tileInspector = $("#tile-inspector")
const tileTitle = $("#tile-title")
const tilePreviewWrap = $("#tile-preview-wrap")
const tilePreview = $("#tile-preview") as HTMLCanvasElement
const newTileButton = $("#new-tile") as HTMLButtonElement
const duplicateTileButton = $("#duplicate-tile") as HTMLButtonElement
const deleteTileButton = $("#delete-tile") as HTMLButtonElement
const tileModeButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-tile-mode]"))
const tileSourceFields = Array.from(document.querySelectorAll<HTMLInputElement>("[data-tile-source]"))
const tileInnerFields = Array.from(document.querySelectorAll<HTMLInputElement>("[data-tile-inner]"))
const textStyleLabels = Array.from(document.querySelectorAll<HTMLElement>("[data-text-style]"))
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
const styleImageDialog = $("#style-image-dialog") as HTMLDivElement
const styleImageClose = $("#style-image-close") as HTMLButtonElement
const styleImageTitle = $("#style-image-title") as HTMLElement
const styleImageSubtitle = $("#style-image-subtitle") as HTMLSpanElement
const styleImageResourceOpen = $("#style-image-resource-open") as HTMLButtonElement
const styleImageResourcePicker = $("#style-image-resource-picker") as HTMLElement
const styleImageResourceClose = $("#style-image-resource-close") as HTMLButtonElement
const styleImageResourceSearch = $("#style-image-resource-search") as HTMLInputElement
const styleImageResourceCount = $("#style-image-resource-count") as HTMLElement
const styleImageResourceEmpty = $("#style-image-resource-empty") as HTMLElement
const styleImageImgList = $("#style-image-img-list") as HTMLDivElement
const styleImagePreview = $("#style-image-preview") as HTMLCanvasElement
const styleImagePicker = $("#style-image-picker")
const styleImagePickerCanvas = $("#style-image-picker-canvas") as HTMLCanvasElement
const styleImagePickerMeta = $("#style-image-picker-meta")
const stylePickerDialog = $("#style-picker-dialog") as HTMLDialogElement
const stylePickerSearch = $("#style-picker-search") as HTMLInputElement
const stylePickerCount = $("#style-picker-count")
const stylePickerGrid = $("#style-picker-grid")
const stylePickerEmpty = $("#style-picker-empty")
const stylePickerClose = $("#style-picker-close") as HTMLButtonElement

let archive: SkinArchive | undefined
let bdaBase: SkinArchive | undefined
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
type Change =
  | { kind: "text"; path: string; before: string; after: string }
  | { kind: "bytes"; path: string; before: Uint8Array; after: Uint8Array }
let undoStack: Change[] = []
let redoStack: Change[] = []
let fileOperationRunning = false
let firstCandidateTextVisual: TextVisual | undefined
let candidateTextWidth = 1125
let canvasLogicalSize: { width: number; height: number; panelHeight: number } | undefined
let stylePreviewDrawID = 0
let pickerURL = ""
let pickerImage: HTMLImageElement | undefined
let pickerPath = ""
let pickerSlices: TileSlice[] = []
let pickerScale = 1
let pickerOffset: TilePoint = { x: 0, y: 0 }
type StyleImagePickerTarget = {
  source: "BACK_STYLE" | "FORE_STYLE"
  property: "NM_IMG" | "HL_IMG"
  document?: IniDocument
  path?: string
  sections?: string[]
}
let pickerTarget: StyleImagePickerTarget | undefined
type NativeImagePickerPayload = {
  path: string
  dataURL: string
  slices: TileSlice[]
  selectedIndex?: number
  editable: boolean
}
type NativeResourcePickerPayload = { path: string; dataURL: string }[]
let nativeImagePickerPayload: NativeImagePickerPayload | undefined
let nativeResourcePickerPayload: NativeResourcePickerPayload = []
const processedPreviewVisuals = new Map<HTMLButtonElement, Visual[]>()
const processedPreviewStyleIDs = new Map<HTMLButtonElement, string[]>()
let selectedFileButton: HTMLElement | undefined
let sidebarView: "overview" | "source" = "overview"
let guidesVisible = false
let previewReturnName = "py_9.ini"
let resourceConfigActive = false
let resourceInspectorMode: "image" | "style" = "image"
let selectedStyleID = ""
let selectedResourcePath = ""
let resourceURLs: string[] = []
let tilePath = ""
let tileDocument = IniDocument.parse("")
let slices: TileSlice[] = []
let selectedTileIndex: number | undefined
let drawingTile = false
let tileDragStart: TilePoint | undefined
let tileDraft: TileRect | undefined
let tileMode: "select" | "move" = "select"
let movingTile: TileSlice | undefined
let moveStart: TilePoint | undefined
let moveSource: TileRect | undefined
let copiedTile: TileSlice | undefined

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
    if (selectedPath !== layoutPath) selectFile(layoutPath, "overview")
    selectedKeySections = sections
    populateKeyInspector()
    updateSourceHighlight()
    scrollSelectedSource()
  },
  false,
  (section, event) => showEditContextMenu(section, event),
)

const toolbarPreview = new Preview(toolbarCanvas, () => {}, () => {}, true)

function applySkinState(state?: number, message?: string): void {
  skinState.value = state === undefined ? "" : String(state)
  preview.setSkinState(state)
  toolbarPreview.setSkinState(state)
  if (message) eventLog.textContent = message
}

function handlePreviewEvent(event: PreviewEvent): void {
  eventLog.textContent =
    `${event.section} · ${event.direction.toUpperCase()} · ${event.code || "未配置"}`
  const code = event.code.trim()
  const state = previewStateFromAction(code)
  if (state !== undefined) {
    applySkinState(
      state || undefined,
      `${eventLog.textContent} → ${state ? `皮肤状态：S${state}` : "皮肤状态：默认"}`,
    )
    return
  }
  const currentName = layoutPath.split("/").pop() ?? ""
  const transition = previewPageTransition(code, currentName, previewReturnName)
  const target = transition.target
  if (target) {
    const path = currentConfigPath(target)
    if (archive?.isText(path) || isBdaLayoutPath(path)) {
      previewReturnName = transition.returnName
      selectFile(path, "overview")
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
  if (!isEditing() || archive?.format === "bda") return
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
  asterisk: ["M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"],
  pencil: ["m4 20 4.5-1 11-11-3.5-3.5-11 11z", "m14.5 6 3.5 3.5"],
  "list.bullet": ["M9 6h11M9 12h11M9 18h11", "M4 6h.01M4 12h.01M4 18h.01"],
  gearshape: ["M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8", "M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"],
  "text.bubble": ["M4 4h16v12H9l-5 4z", "M8 8h8M8 12h5"],
  app: ["M4 4h16v16H4z", "M8 8h8v8H8z"],
  "rectangle.and.hand.point": ["M3 4h18v14H3z", "M8 8h8M12 8v6m0 0 3-3m-3 3-3-3"],
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
    button.disabled = Boolean(archive) && !archive.names().some((name) =>
      name.startsWith(`${button.dataset.themeChoice}/skin/`),
    )
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
    for (const field of [...keyFields, ...styleFields, ...keyboardFields, ...toolbarFields, ...skinFields, ...gapFields]) {
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
  undoStack.push({ kind: "text", path, before, after })
  redoStack = []
  updateHistoryButtons()
}

function commitBytes(path: string, before: Uint8Array, after: Uint8Array): void {
  if (!archive || before.length === after.length && before.every((byte, index) => byte === after[index])) return
  archive.setBytes(path, after)
  undoStack.push({ kind: "bytes", path, before, after })
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
  if (resourceConfigActive && path === tilePath) {
    tileDocument = IniDocument.parse(text)
    slices = tileSlices(tileDocument)
    setSourceValue(text)
    sourceName.textContent = tilePath
    if (!slices.some((slice) => slice.index === selectedTileIndex)) selectedTileIndex = undefined
    updateSourceHighlight()
    populateTileInspector()
    drawAtlas()
  }
  refreshPreview()
  populateKeyInspector()
  updateDirty()
}

function undo(): void {
  const change = undoStack.pop()
  if (!change) return
  redoStack.push(change)
  if (change.kind === "text") applyTextSnapshot(change.path, change.before)
  else applyBytesSnapshot(change.path, change.before)
  updateHistoryButtons()
}

function redo(): void {
  const change = redoStack.pop()
  if (!change) return
  undoStack.push(change)
  if (change.kind === "text") applyTextSnapshot(change.path, change.after)
  else applyBytesSnapshot(change.path, change.after)
  updateHistoryButtons()
}

function applyBytesSnapshot(path: string, bytes: Uint8Array): void {
  if (!archive) return
  archive.setBytes(path, bytes)
  refreshBdaLayout()
  if (selectedPath === path) setSourceValue(describeBdaConfig(path, bytes))
  refreshPreview()
  populateKeyInspector()
  updateDirty()
}

function preferredPath(): string {
  return `${theme.value}/skin/${orientation.value}/${layout.value}`
}

function bdaBasePath(path = preferredPath()): string {
  return path.replace(/^(?:dark|light)\/skin\//, "light/skin/")
}

function currentBdaAppearance(): { path: string; bytes: Uint8Array; appearance: BdaAppearance } | undefined {
  if (!archive || archive.format !== "bda") return
  const path = bdaAppearancePath(archive, theme.value, orientation.value)
  const bytes = path && archive.getBytes(path)
  return path && bytes ? { path, bytes, appearance: decodeBdaAppearance(bytes) } : undefined
}

function bdaAvailableLayoutPaths(): string[] {
  if (!archive || archive.format !== "bda") return []
  const path = bdaAppearancePath(archive, theme.value, orientation.value)
  const appearanceBytes = path && archive.getBytes(path)
  if (!appearanceBytes) return []
  const prefix = `${theme.value}/skin/${orientation.value}/`
  return bdaLayoutNames(appearanceBytes)
    .map((name) => `${prefix}${name.replace(/\.ini$/i, "")}.ini`)
    .filter((name) => bdaBase?.isText(bdaBasePath(name)))
}

function isBdaVirtualTextPath(path: string): boolean {
  return Boolean(archive?.format === "bda" && bdaBase?.isText(bdaBasePath(path)))
}

function isBdaLayoutPath(path: string): boolean {
  return isBdaVirtualTextPath(path) && /\.ini$/i.test(path)
}

function textDocument(path: string): IniDocument | undefined {
  if (archive?.isText(path)) return IniDocument.parse(archive.getText(path))
  if (isBdaVirtualTextPath(path)) return IniDocument.parse(bdaBase!.getText(bdaBasePath(path)))
}

function refreshBdaLayout(path = preferredPath()): boolean {
  const info = currentBdaAppearance()
  const basePath = bdaBasePath(path)
  if (!info || !bdaBase?.isText(basePath)) return false
  layoutPath = path
  layoutDocument = bdaLayoutDocument(
    IniDocument.parse(bdaBase.getText(basePath)),
    info.appearance,
    path.split("/").pop() ?? layout.value,
  )
  return true
}

function visualResolver(): VisualResolver | undefined {
  if (!archive) return
  const info = currentBdaAppearance()
  return info
    ? new BdaResolver(archive, info.bytes, bdaBase, theme.value, orientation.value)
    : new AtlasResolver(archive, theme.value, orientation.value)
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

function applyDeviceKeyboardGeometry(
  panelWidth: number,
  panelHeight: number,
  candidateHeight: number,
  composing: boolean,
): void {
  const spec = deviceSpec(device.value)
  if (!spec) {
    for (const property of deviceGeometryProperties) deviceShell.style.removeProperty(property)
    return
  }
  const geometry = keyboardPreviewGeometry(
    spec,
    orientation.value,
    panelWidth,
    panelHeight,
    candidateHeight,
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

function refreshPreview(): void {
  if (!archive) return
  const composing = refreshSimulationState()
  const resolver = visualResolver()
  const context = keyboardContext()
  const toolbarSize = resolver ? refreshToolbarPreview(composing, resolver) : undefined
  preview.setResolver(resolver)
  const animationPath = archive.format === "bda"
    ? bdaConfigPath(archive, theme.value, orientation.value, "animation")
    : undefined
  const animationBytes = animationPath && archive.getBytes(animationPath)
  preview.setAnimation(animationBytes ? decodeBdaAnimation(animationBytes) : undefined)
  const bdaGenPath = bdaBasePath(genConfigPath())
  const bdaGen = archive.format === "bda" && bdaBase?.isText(bdaGenPath)
    ? IniDocument.parse(bdaBase.getText(bdaGenPath))
    : undefined
  preview.setOffsets(context?.gen ?? bdaGen)
  preview.setDefaults(context?.gen ?? bdaGen)
  preview.setTheme(theme.value === "dark" ? "dark" : "light")
  preview.setTransparent(device.value !== "canvas")
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
    updatePanelTools(config.width, config.height, toolbarSize?.height)
    applyDeviceKeyboardGeometry(config.width, config.height, toolbarSize?.height ?? 0, composing)
  } else if (bdaGen && layoutDocument) {
    const size = bdaGen.get("PANEL", "SIZE")?.split(",").map(Number)
    const panelWidth = size?.[0] || 1080
    const panelHeight = size?.[1] || 641
    const panel = currentBdaAppearance()?.appearance.panels.get(layout.value.replace(/\.ini$/i, ""))
    const candidateDocument = toolbarConfigPath() ? textDocument(toolbarConfigPath()!) : undefined
    const inputVisual = resolver?.resolveText(
      bdaGen.get("SCAND", "INPUT_STYLE") ?? bdaGen.get("INPUT", "FORE_STYLE") ?? "",
      false,
    )
    const candidateVisual = resolver?.resolveText(
      candidateDocument?.get("CAND", "FORE_STYLE") ?? bdaGen.get("SCAND", "SCAND_STYLE") ?? "",
      false,
    )
    const firstVisual = resolver?.resolveText(candidateDocument?.get("CAND", "FIRST_FORE") ?? "", false)
    candidateTextWidth = panelWidth
    firstCandidateTextVisual = firstVisual
    applyCandidateTextVisual(candidateInput, inputVisual, candidateTextWidth)
    applyCandidateTextVisual(candidateWords, candidateVisual, candidateTextWidth)
    const firstCandidate = candidateWords.firstElementChild as HTMLElement | null
    if (firstCandidate) applyCandidateTextVisual(firstCandidate, firstVisual, candidateTextWidth)
    preview.setPanel(
      bdaStyleID(panel?.wholeBackStyle ?? panel?.backStyle),
      panelWidth,
      panelHeight,
    )
    updatePanelTools(panelWidth, panelHeight, toolbarSize?.height)
    applyDeviceKeyboardGeometry(panelWidth, panelHeight, toolbarSize?.height ?? 0, composing)
  } else {
    for (const property of deviceGeometryProperties) deviceShell.style.removeProperty(property)
  }
  preview.setDocument(layoutDocument)
}

function skinStateDocuments(): IniDocument[] {
  if (!archive) return []
  const prefix = `${theme.value}/skin/${orientation.value}/`
  const paths = archive.format === "bda"
    ? bdaAvailableLayoutPaths()
    : archive.names().filter((path) => path.startsWith(prefix) && path.endsWith(".ini") && archive?.isText(path))
  return paths.flatMap((path) => {
    const document = textDocument(path)
    return document ? [document] : []
  })
}

function fitCanvasPreview(): void {
  if (!canvasLogicalSize) return
  const availableWidth = canvasWrap.clientWidth - 36
  const availableHeight = canvasWrap.clientHeight - 36
  if (availableWidth <= 0 || availableHeight <= 0) return
  const width = canvasFitWidth(
    availableWidth,
    availableHeight,
    canvasLogicalSize.width,
    canvasLogicalSize.height,
  )
  const scale = width / canvasLogicalSize.width
  const panelViewportHeight = Math.round(canvasLogicalSize.panelHeight * scale)
  deviceShell.style.setProperty("--canvas-fit-width", `${width}px`)
  deviceShell.style.setProperty("--panel-viewport-height", `${panelViewportHeight}px`)
  const toolbarHeight = Number(toolbarCanvas.style.getPropertyValue("--toolbar-height") || "0")
  const toolbarWidth = Number(toolbarCanvas.style.getPropertyValue("--toolbar-width") || "0")
  if (toolbarWidth > 0 && toolbarHeight > 0) {
    deviceShell.style.setProperty("--toolbar-viewport-height", `${Math.round(toolbarHeight * scale)}px`)
  }
  if (device.value === "canvas") updateCanvasPanelStatus(width)
}

function updateCanvasPanelStatus(renderedWidth: number): void {
  if (!canvasLogicalSize) return
  panelStatus.textContent = `面板：${Math.round(canvasLogicalSize.width)} × ${Math.round(canvasLogicalSize.panelHeight)} · 预览缩放：${Math.round(renderedWidth / canvasLogicalSize.width * 100)}%`
}

let fitCanvasDebounce: ReturnType<typeof setTimeout> | undefined
let canvasFitFrozen = false

function scheduleFitCanvasPreview(): void {
  if (canvasFitFrozen) return
  clearTimeout(fitCanvasDebounce)
  fitCanvasDebounce = setTimeout(fitCanvasPreview, 50)
}

new ResizeObserver(scheduleFitCanvasPreview).observe(canvasWrap)

function updatePanelTools(width: number, height: number, candidateHeight = 0): void {
  const content = previewContentVerticalBounds(
    layoutDocument ? previewItems(layoutDocument, width, height) : [],
    width,
    height,
  )
  deviceShell.style.setProperty("--canvas-width", `${width}px`)
  deviceShell.style.setProperty("--canvas-ratio-width", String(width))
  deviceShell.style.setProperty("--panel-visible-height", String(content.height))
  deviceShell.style.removeProperty("--panel-crop-offset")
  canvasLogicalSize = { width, height: content.height + candidateHeight, panelHeight: height }
  fitCanvasPreview()
  const states = availableSkinStates(...skinStateDocuments())
  const selected = skinState.value
  skinState.replaceChildren(new Option("默认", ""), ...states.map((state) => new Option(`S${state}`, String(state))))
  skinState.value = states.includes(Number(selected)) ? selected : ""
  skinStateControl.hidden = states.length === 0
  applySkinState(skinState.value ? Number(skinState.value) : undefined)
  requestAnimationFrame(() => {
    if (device.value === "canvas") return
    const bounds = ($("#preview") as HTMLCanvasElement).getBoundingClientRect()
    panelStatus.textContent = `面板：${Math.round(width)} × ${Math.round(height)} · 预览缩放：${previewScalePercent(bounds.width, bounds.height, width, height)}%`
  })
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
  fitCanvasPreview()
}

function panelSizeFrom(document: IniDocument | undefined): [number, number] | undefined {
  const size = document?.get("PANEL", "SIZE")?.split(",").map(Number)
  return size?.length === 2 && size.every((value) => Number.isFinite(value) && value > 0)
    ? size as [number, number]
    : undefined
}

function panelSizeForPath(path: string): [number, number] | undefined {
  if (!archive?.isText(path)) return
  const directory = path.slice(0, path.lastIndexOf("/"))
  return panelSizeFrom(IniDocument.parse(archive.getText(path))) ??
    (archive.isText(`${directory}/gen.ini`) ? panelSizeFrom(IniDocument.parse(archive.getText(`${directory}/gen.ini`))) : undefined)
}

function panelCopyTargetPath(): string {
  return `${panelTargetTheme.value}/skin/${panelTargetOrientation.value}/${panelTargetFile.value.trim()}`
}

function updatePanelCopyForm(): void {
  if (!archive) return
  const sourceSize = panelSizeForPath(panelCopySource.value)
  panelSourceWidth.value = sourceSize ? String(sourceSize[0]) : ""
  panelSourceHeight.value = sourceSize ? String(sourceSize[1]) : ""
  if (!panelTargetWidth.value && sourceSize) panelTargetWidth.value = String(sourceSize[0])
  if (!panelTargetHeight.value && sourceSize) panelTargetHeight.value = String(sourceSize[1])
  panelScaleOptions.hidden = !panelScaleEnabled.checked
  for (const field of [panelSourceWidth, panelSourceHeight, panelTargetWidth, panelTargetHeight]) {
    field.disabled = !panelScaleEnabled.checked
  }
  const prefix = `${panelTargetTheme.value}/skin/${panelTargetOrientation.value}/`
  const targetFiles = copyablePanelPaths(archive.names())
    .filter((path) => path.startsWith(prefix))
    .map((path) => path.slice(prefix.length))
  panelTargetExisting.replaceChildren(
    Object.assign(document.createElement("option"), { value: "", textContent: "新建 / 自定义文件名" }),
    ...targetFiles.map((value) => Object.assign(document.createElement("option"), { value, textContent: value })),
  )
  panelTargetExisting.value = targetFiles.includes(panelTargetFile.value.trim()) ? panelTargetFile.value.trim() : ""
  panelScaleSummary.textContent = `目标：${panelCopyTargetPath()}`
}

async function resizePng(bytes: Uint8Array, xRatio: number, yRatio: number): Promise<Uint8Array> {
  const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes).buffer], { type: "image/png" }))
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(bitmap.width * xRatio))
  canvas.height = Math.max(1, Math.round(bitmap.height * yRatio))
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => value ? resolve(value) : reject(new Error("PNG 缩放失败")), "image/png")
  })
  return new Uint8Array(await blob.arrayBuffer())
}

function panelResourceRoots(path: string): string[] {
  const match = path.match(/^(light|dark)\/skin\/(port|land)\//)
  if (!match) throw new Error(`无效面板路径：${path}`)
  return [`${match[1]}/skin/${match[2]}/res`, `${match[1]}/skin/res`]
}

function openPanelCopyDialog(): void {
  if (!archive) return
  const paths = copyablePanelPaths(archive.names())
  if (!paths.length) {
    showError(new Error("皮肤中没有可复制的面板文件"), "打开面板复制")
    return
  }
  panelCopySource.replaceChildren(...paths.map((path) => Object.assign(document.createElement("option"), {
    value: path,
    textContent: path,
  })))
  panelCopySource.value = paths.includes(selectedPath) ? selectedPath :
    paths.find((path) => path === `${theme.value}/skin/${orientation.value}/${layout.value}`) ?? paths[0]
  panelTargetTheme.value = theme.value
  panelTargetOrientation.value = orientation.value
  panelTargetFile.value = panelCopySource.value.split("/").pop() ?? "panel.ini"
  panelScaleEnabled.checked = false
  panelTargetWidth.value = ""
  panelTargetHeight.value = ""
  updatePanelCopyForm()
  panelScaleDialog.showModal()
}

async function copyPanel(): Promise<boolean> {
  if (!archive) return false
  const sourcePath = panelCopySource.value
  if (!copyablePanelPaths(archive.names()).includes(sourcePath)) throw new Error("请选择有效的源面板")
  if (!validPanelFilename(panelTargetFile.value.trim())) throw new Error("目标文件名必须是安全的 .ini 文件名")
  const targetPath = panelCopyTargetPath()
  if (sourcePath === targetPath) throw new Error("源面板和目标面板不能相同")
  if (archive.getBytes(targetPath) && !window.confirm(`目标面板 ${targetPath} 已存在，是否覆盖？`)) return false

  let xRatio = 1
  let yRatio = 1
  if (panelScaleEnabled.checked) {
    const sourceWidth = Number(panelSourceWidth.value)
    const sourceHeight = Number(panelSourceHeight.value)
    const targetWidth = Number(panelTargetWidth.value)
    const targetHeight = Number(panelTargetHeight.value)
    if (![sourceWidth, sourceHeight, targetWidth, targetHeight].every((value) => Number.isFinite(value) && value > 0)) {
      throw new Error("面板分辨率必须是正数")
    }
    xRatio = targetWidth / sourceWidth
    yRatio = targetHeight / sourceHeight
  }

  const sourcePanel = IniDocument.parse(archive.getText(sourcePath))
  const sourceRoots = panelResourceRoots(sourcePath)
  const targetRoots = panelResourceRoots(targetPath)
  const sourceStylePath = sourceRoots.map((root) => `${root}/default.css`).find((path) => archive.isText(path))
  if (!sourceStylePath) throw new Error("源面板缺少 default.css")
  const targetStylePath = targetRoots.map((root) => `${root}/default.css`).find((path) => archive.isText(path)) ?? `${targetRoots[0]}/default.css`
  const sourceStyles = IniDocument.parse(archive.getText(sourceStylePath))
  const targetStyles = archive.isText(targetStylePath) ? IniDocument.parse(archive.getText(targetStylePath)) : IniDocument.parse("")
  const styleIDs = panelStyleIDs(sourcePanel)
  const imageBases = new Set<string>()
  for (const styleID of styleIDs) {
    for (const property of ["NM_IMG", "HL_IMG"]) {
      const base = sourceStyles.get(`STYLE${styleID}`, property)?.split(",")[0].trim()
      if (base) imageBases.add(base)
    }
  }

  const targetPairs = new Map<string, { png?: Uint8Array; til?: Uint8Array }>()
  for (const root of targetRoots) {
    const prefix = `${root}/`
    const bases = archive.names().flatMap((path) => {
      if (!path.startsWith(prefix)) return []
      const match = path.slice(prefix.length).match(/^(.*)\.(?:png|til)$/i)
      return match ? [match[1]] : []
    })
    for (const base of new Set(bases)) {
      if (targetPairs.has(base)) continue
      const png = archive.getBytes(`${root}/${base}.png`)
      const til = archive.getBytes(`${root}/${base}.til`)
      if (png && til) targetPairs.set(base, { png, til })
    }
  }
  const targetRoot = targetStylePath.slice(0, targetStylePath.lastIndexOf("/"))
  const staged = new Map<string, Uint8Array>()
  const resourceNames = new Map<string, string>()
  const encoder = new TextEncoder()
  for (const base of imageBases) {
    const sourceRoot = sourceRoots.find((root) => archive.getBytes(`${root}/${base}.png`) && archive.getBytes(`${root}/${base}.til`))
    if (!sourceRoot) throw new Error(`源样式引用的资源不完整：${base}.png / ${base}.til`)
    const sourcePng = archive.getBytes(`${sourceRoot}/${base}.png`)!
    const sourceTil = archive.getBytes(`${sourceRoot}/${base}.til`)!
    const scaled = xRatio !== 1 || yRatio !== 1
    const png = scaled ? await resizePng(sourcePng, xRatio, yRatio) : sourcePng.slice()
    const til = scaled
      ? encoder.encode(scaleIniDocument(IniDocument.parse(archive.getText(`${sourceRoot}/${base}.til`)), xRatio, yRatio).toString())
      : sourceTil.slice()
    const targetBase = copiedResourceBase(base, png, til, targetPairs)
    resourceNames.set(base, targetBase)
    targetPairs.set(targetBase, { png, til })
    staged.set(`${targetRoot}/${targetBase}.png`, png)
    staged.set(`${targetRoot}/${targetBase}.til`, til)
  }

  const copiedStyles = rewriteStyleImageBases(sourceStyles, styleIDs, resourceNames)
  const merged = mergePanelStyles(sourcePanel, copiedStyles, targetStyles)
  const panel = panelScaleEnabled.checked
    ? scalePanelDocument(merged.panel, xRatio, yRatio, Number(panelTargetWidth.value), Number(panelTargetHeight.value))
    : merged.panel
  staged.set(targetStylePath, encoder.encode(merged.styles.toString()))
  staged.set(targetPath, encoder.encode(panel.toString()))
  for (const [path, bytes] of staged) archive.setBytes(path, bytes)

  theme.value = panelTargetTheme.value
  orientation.value = panelTargetOrientation.value as "port" | "land"
  syncSegmentedControls()
  renderFiles()
  selectFile(targetPath)
  updateDirty()
  updateDevicePreview()
  return true
}

function setFileOperationBusy(busy: boolean): void {
  fileOperationRunning = busy
  newButton.disabled = busy
  openButton.disabled = busy
  saveButton.disabled = busy || !archive
  panelScaleButton.disabled = busy || !archive
  for (const button of exportButtons) {
    const format = button.dataset.exportFormat as ExportFormat
    button.disabled = busy || !archive || (archive.format !== "bda" && format === "bda")
  }
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
  asset.hidden = resourceConfigActive
  sourceName.textContent = path
  assetBackButton.disabled = !assetReturnPath
}

function drawAtlas(): void {
  if (!workspaceImage.complete || !workspaceImage.naturalWidth) return
  if (atlasCanvas.width !== workspaceImage.naturalWidth) atlasCanvas.width = workspaceImage.naturalWidth
  if (atlasCanvas.height !== workspaceImage.naturalHeight) atlasCanvas.height = workspaceImage.naturalHeight
  const context = atlasCanvas.getContext("2d")
  if (!context) return
  context.clearRect(0, 0, atlasCanvas.width, atlasCanvas.height)
  context.drawImage(workspaceImage, 0, 0)
  drawTilePreview()
  if (!resourceConfigActive || !guidesVisible) return

  const visible = tileDraft
    ? [...slices, { index: nextTileIndex(tileDocument), source: tileDraft }]
    : movingTile
      ? slices.map((slice) => slice.index === movingTile?.index ? movingTile : slice)
      : slices
  const lineWidth = Math.max(1, Math.round(Math.min(atlasCanvas.width, atlasCanvas.height) / 500))
  context.font = `${Math.max(11, lineWidth * 7)}px ui-monospace, monospace`
  context.textBaseline = "top"
  for (const slice of visible) {
    const [x, y, width, height] = slice.source
    const selected = slice.index === selectedTileIndex || slice.source === tileDraft
    context.lineWidth = selected ? lineWidth * 2 : lineWidth
    context.strokeStyle = selected ? "#ff3b30" : "#0a7ff5"
    context.strokeRect(x + context.lineWidth / 2, y + context.lineWidth / 2, width - context.lineWidth, height - context.lineWidth)
    const label = `IMG${slice.index}`
    const labelWidth = context.measureText(label).width + 6
    context.fillStyle = selected ? "#ff3b30" : "#0a7ff5"
    context.fillRect(x, y, labelWidth, Math.max(15, lineWidth * 9))
    context.fillStyle = "#fff"
    context.fillText(label, x + 3, y + 2)
  }
}

function drawTilePreview(): void {
  const slice = movingTile?.index === selectedTileIndex
    ? movingTile
    : slices.find((item) => item.index === selectedTileIndex)
  tilePreviewWrap.hidden = !slice
  const context = tilePreview.getContext("2d")
  if (!context) return
  context.clearRect(0, 0, tilePreview.width, tilePreview.height)
  if (!slice || !workspaceImage.complete || !workspaceImage.naturalWidth) return
  const [x, y, width, height] = slice.source
  const destination = tilePreviewDestination(width, height, tilePreview.width)
  context.imageSmoothingEnabled = false
  context.drawImage(
    workspaceImage,
    x, y, width, height,
    destination.x, destination.y, destination.width, destination.height,
  )
  context.lineWidth = 2
  context.strokeStyle = "#ff3b30"
  context.strokeRect(destination.x + 1, destination.y + 1, destination.width - 2, destination.height - 2)
}

function populateTileInspector(): void {
  const slice = slices.find((item) => item.index === selectedTileIndex)
  tileInspector.hidden = !selectedResourcePath
  newTileButton.disabled = !selectedResourcePath || !isEditing()
  duplicateTileButton.disabled = !slice || !isEditing()
  deleteTileButton.disabled = !slice || !isEditing()
  tileTitle.textContent = slice ? `IMG${slice.index}` : "切片"
  for (const field of tileSourceFields) {
    const index = Number(field.dataset.tileSource)
    field.value = slice ? String(slice.source[index]) : ""
    field.disabled = !slice || !isEditing()
  }
  for (const field of tileInnerFields) {
    const index = Number(field.dataset.tileInner)
    field.value = slice?.inner ? String(slice.inner[index]) : ""
    field.disabled = !slice || !isEditing()
  }
  drawTilePreview()
}

function loadTiles(path: string): void {
  tilePath = path.replace(/\.png$/i, ".til")
  tileDocument = archive?.isText(tilePath) ? IniDocument.parse(archive.getText(tilePath)) : IniDocument.parse("")
  slices = tileSlices(tileDocument)
  setSourceValue(tileDocument.toString())
  sourceName.textContent = tilePath
  source.disabled = false
  selectedTileIndex = undefined
  updateSourceHighlight()
  tileDraft = undefined
  movingTile = undefined
  moveStart = undefined
  moveSource = undefined
  populateTileInspector()
  drawAtlas()
}

function openStyleImageResourceChooser(target: StyleImagePickerTarget): void {
  pickerTarget = target
  if (isTauri()) openResourcePickerWindow()
  else openStyleImageResourcePicker()
}

function chooseStyleImageSlice(property: "NM_IMG" | "HL_IMG"): void {
  const target = styleSectionTarget(selectedStyleID, property)
  const path = styleConfigPath()
  const stylesDocument = archive?.isText(path) ? IniDocument.parse(archive.getText(path)) : undefined
  const current = stylesDocument?.get(`STYLE${selectedStyleID}`, property)?.split(",")[0]?.trim()
  const imagePath = resourceImagePaths(archive?.names() ?? [], theme.value, orientation.value)
    .find((candidate) => candidate.split("/").pop()?.replace(/\.png$/i, "") === current)
  if (imagePath && target) openImageSlicePicker(imagePath, target)
  else if (target) openStyleImageResourceChooser(target)
}

for (const button of styleDetailImageButtons) {
  button.addEventListener("click", () => chooseStyleImageSlice(button.dataset.styleImageProperty as "NM_IMG" | "HL_IMG"))
}

function styleSectionTarget(styleID: string, property: "NM_IMG" | "HL_IMG"): StyleImagePickerTarget | undefined {
  const path = styleConfigPath()
  if (!archive?.isText(path)) return
  return {
    source: "BACK_STYLE",
    property,
    document: IniDocument.parse(archive.getText(path)),
    path,
    sections: [`STYLE${styleID}`],
  }
}

function parseStyleColor(value: string): { hex: string; alpha: number } | undefined {
  const clean = value.trim().replace(/^#/, "")
  if (!/^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(clean)) return
  const normalized = clean.length === 6 ? `FF${clean}` : clean.toUpperCase()
  return { hex: normalized.slice(2), alpha: Number.parseInt(normalized.slice(0, 2), 16) / 255 }
}

function bindStyleDetailColor(
  textInput: HTMLInputElement,
  picker: HTMLInputElement,
  alpha: HTMLInputElement,
): void {
  const sync = () => {
    const parsed = parseStyleColor(textInput.value)
    if (!parsed) return
    picker.value = `#${parsed.hex}`
    alpha.value = String(parsed.alpha)
    picker.disabled = textInput.disabled
  }
  const write = () => {
    const parsed = parseStyleColor(textInput.value)
    const rgb = picker.value.slice(1).toUpperCase()
    if (!parsed && rgb.length !== 6) return
    const alphaValue = Math.max(0, Math.min(1, Number(alpha.value) || 1))
    textInput.value = `${Math.round(alphaValue * 255).toString(16).padStart(2, "0")}${rgb}`.toUpperCase()
    textInput.dispatchEvent(new Event("change", { bubbles: true }))
  }
  textInput.addEventListener("input", sync)
  textInput.addEventListener("change", sync)
  picker.addEventListener("input", write)
  alpha.addEventListener("input", write)
  sync()
}

async function renderStyleResourceDetail(): Promise<void> {
  const path = styleConfigPath()
  if (!archive?.isText(path) || !selectedStyleID) return
  const stylesDocument = IniDocument.parse(archive.getText(path))
  const section = `STYLE${selectedStyleID}`
  resourceName.textContent = section
  resourceMeta.textContent = path
  imageResourceDetail.hidden = true
  styleResourceDetail.hidden = false
  const resolver = visualResolver()
  if (resolver) {
    drawVisualPreview(styleDetailNormal, [await resolver.resolve(selectedStyleID, false).catch(() => undefined)], false)
    drawVisualPreview(styleDetailHighlighted, [await resolver.resolve(selectedStyleID, true).catch(() => undefined)], false)
  }
  styleDetailFields.replaceChildren()
  const existing = stylesDocument.entries(section)
  const common = ["NM_COLOR", "HL_COLOR", "FONT_NAME", "FONT_WEIGHT", "FONT_SIZE", "SHOW", "INFO"]
  const keys = [...common, ...existing.map((entry) => entry.key).filter((key) => !common.includes(key) && key !== "NM_IMG" && key !== "HL_IMG")]
  for (const key of keys) {
    const label = document.createElement("label")
    label.className = "style-detail-field"
    const caption = document.createElement("span")
    caption.textContent = documentFieldLabels[key] ?? key
    caption.title = key
    const row = document.createElement("span")
    row.className = "style-detail-field-row"
    const updateField = (value: string) => {
      if (!archive?.isText(path)) return
      const current = IniDocument.parse(archive.getText(path))
      const before = current.toString()
      if (!current.set(section, key, value)) return
      commitText(path, before, current.toString())
      setSourceValue(current.toString())
      refreshPreview()
      void renderStyleResourceDetail()
      updateDirty()
    }
    if (key.endsWith("COLOR")) {
      const textInput = document.createElement("input")
      textInput.value = stylesDocument.get(section, key) ?? ""
      textInput.disabled = !isEditing()
      const picker = document.createElement("input")
      picker.type = "color"
      picker.setAttribute("aria-label", `${key} 颜色选择器`)
      const alpha = document.createElement("input")
      alpha.type = "number"
      alpha.min = "0"
      alpha.max = "1"
      alpha.step = "0.01"
      alpha.setAttribute("aria-label", `${key} 透明度`)
      const colorControl = document.createElement("span")
      colorControl.className = "color-control"
      colorControl.append(textInput, picker, alpha)
      bindStyleDetailColor(textInput, picker, alpha)
      textInput.addEventListener("change", () => updateField(textInput.value))
      row.append(colorControl)
    } else {
      const input = document.createElement("input")
      input.value = stylesDocument.get(section, key) ?? ""
      input.disabled = !isEditing()
      input.addEventListener("change", () => updateField(input.value))
      row.append(input)
    }
    label.append(caption, row)
    styleDetailFields.append(label)
  }
}

function selectStyleResource(styleID: string): void {
  if (!availableStyleIDs().includes(styleID)) return
  selectedStyleID = styleID
  resourceListView.hidden = true
  resourceDetail.hidden = false
  resourceInspector.scrollTop = 0
  void renderStyleResourceDetail()
}

function selectResourceImage(path: string): void {
  if (!archive?.isImage(path)) return
  selectedResourcePath = path
  resourceListView.hidden = true
  resourceDetail.hidden = false
  resourceInspector.scrollTop = 0
  resourceName.textContent = path.split("/").pop() ?? path
  resourceMeta.textContent = path
  imageResourceDetail.hidden = false
  styleResourceDetail.hidden = true
  tileMode = "select"
  tileModeButtons.forEach((button) => button.classList.toggle("active", button.dataset.tileMode === tileMode))
  showImage(path)
  loadTiles(path)
  for (const item of resourceGallery.querySelectorAll<HTMLElement>(".resource-item")) {
    item.classList.toggle("selected", item.dataset.path === path)
  }
  resourceGallery.querySelector<HTMLElement>(`.resource-item[data-path="${CSS.escape(path)}"]`)?.scrollIntoView({ block: "nearest" })
}

function releaseResourceURLs(): void {
  for (const url of resourceURLs) URL.revokeObjectURL(url)
  resourceURLs = []
}

async function renderStyleResourceGallery(): Promise<void> {
  if (!archive?.isText(styleConfigPath())) return
  const query = resourceSearch.value.trim().toLowerCase()
  const stylesDocument = IniDocument.parse(archive.getText(styleConfigPath()))
  const styleIDs = availableStyleIDs().filter((styleID) => {
    const entries = stylesDocument.entries(`STYLE${styleID}`)
    return !query || styleID.includes(query) || entries.some((entry) =>
      (entry.key === "INFO" || entry.key === "SHOW") && entry.value.toLowerCase().includes(query),
    )
  })
  resourceListTitle.textContent = "样式配置"
  resourceSearch.placeholder = "搜索样式"
  resourceSearch.setAttribute("aria-label", "搜索样式")
  resourceCount.textContent = `${styleIDs.length} 个样式`
  resourceUploadButton.hidden = true
  styleAddButton.hidden = false
  resourceDownloadButton.hidden = true
  resourceDeleteButton.hidden = true
  resourceListView.hidden = Boolean(selectedStyleID)
  resourceDetail.hidden = !selectedStyleID
  const resolver = visualResolver()
  if (!resolver) return
  for (const styleID of styleIDs) {
    const button = document.createElement("button")
    button.className = "resource-item style-resource-item"
    button.dataset.path = `STYLE${styleID}`
    button.title = `STYLE${styleID}`
    const previews = document.createElement("span")
    previews.className = "resource-style-previews"
    for (const highlighted of [false, true]) {
      const canvas = document.createElement("canvas")
      canvas.width = 64
      canvas.height = 44
      drawVisualPreview(canvas, [await resolver.resolve(styleID, highlighted).catch(() => undefined)], false)
      previews.append(canvas)
    }
    const name = document.createElement("strong")
    name.textContent = `STYLE${styleID}`
    const entries = stylesDocument.entries(`STYLE${styleID}`)
    const meta = document.createElement("small")
    meta.textContent = entries.find((entry) => entry.key === "INFO")?.value
      || entries.find((entry) => entry.key === "SHOW")?.value
      || `${entries.length} 项配置`
    button.append(previews, name, meta)
    let clickTimer: ReturnType<typeof setTimeout> | undefined
    button.addEventListener("click", () => {
      clearTimeout(clickTimer)
      clickTimer = setTimeout(() => selectGalleryItem(`STYLE${styleID}`, resourceGallery), 200)
    })
    button.addEventListener("dblclick", () => {
      clearTimeout(clickTimer)
      selectGalleryItem(`STYLE${styleID}`, resourceGallery)
      selectStyleResource(styleID)
    })
    resourceGallery.append(button)
  }
  if (selectedResourceGalleryPath) selectGalleryItem(selectedResourceGalleryPath, resourceGallery)
}

function renderResourceInspector(): void {
  if (!archive) return
  releaseResourceURLs()
  resourceGallery.replaceChildren()
  if (resourceInspectorMode === "style") {
    void renderStyleResourceGallery()
    return
  }
  resourceListTitle.textContent = "皮肤图片"
  resourceSearch.placeholder = "搜索图片"
  resourceSearch.setAttribute("aria-label", "搜索图片")
  resourceUploadButton.hidden = false
  styleAddButton.hidden = true
  resourceDownloadButton.hidden = false
  resourceDeleteButton.hidden = false
  const query = resourceSearch.value.trim().toLowerCase()
  const paths = resourceImagePaths(archive.names(), theme.value, orientation.value)
    .filter((path) => !query || path.toLowerCase().includes(query))
  resourceCount.textContent = `${paths.length} 张图片`
  resourceListView.hidden = Boolean(selectedResourcePath)
  resourceDetail.hidden = !selectedResourcePath
  for (const path of paths) {
    const bytes = archive.getBytes(path)
    if (!bytes) continue
    const copy = new Uint8Array(bytes.byteLength)
    copy.set(bytes)
    const url = URL.createObjectURL(new Blob([copy.buffer], { type: "image/png" }))
    resourceURLs.push(url)
    const button = document.createElement("button")
    button.className = "resource-item"
    button.dataset.path = path
    button.title = path
    const image = document.createElement("img")
    image.src = url
    image.alt = ""
    const name = document.createElement("strong")
    name.textContent = path.split("/").pop() ?? path
    const meta = document.createElement("small")
    meta.textContent = archive.isText(path.replace(/\.png$/i, ".til")) ? "TIL" : "无 TIL"
    image.addEventListener("load", () => {
      meta.textContent = `${image.naturalWidth} × ${image.naturalHeight} · ${meta.textContent}`
    })
    button.append(image, name, meta)
    let clickTimer: ReturnType<typeof setTimeout> | undefined
    button.addEventListener("click", () => {
      clearTimeout(clickTimer)
      clickTimer = setTimeout(() => {
        selectGalleryItem(path, resourceGallery)
      }, 200)
    })
    button.addEventListener("dblclick", () => {
      clearTimeout(clickTimer)
      selectGalleryItem(path, resourceGallery)
      selectResourceImage(path)
    })
    resourceGallery.append(button)
  }
  // Restore selection state after re-render
  if (selectedResourceGalleryPath) {
    for (const item of resourceGallery.querySelectorAll<HTMLElement>(".resource-item")) {
      item.classList.toggle("selected", item.dataset.path === selectedResourceGalleryPath)
    }
  }
  updateResourceActionButtons()
}

function showResourceList(): void {
  resourceListView.hidden = false
  resourceDetail.hidden = true
  resourceInspector.scrollTop = 0
  if (resourceInspectorMode === "style") {
    selectedStyleID = ""
    renderResourceInspector()
    return
  }
  setDrawingTile(false)
  movingTile = undefined
  selectedTileIndex = undefined
  if (selectedDocument) setSourceValue(selectedDocument.toString())
  sourceName.textContent = selectedPath
  populateTileInspector()
}

function clearImagePreviewError(): void {
  atlasCanvas.hidden = false
  assetImage.hidden = false
  workspaceImageError.hidden = true
  drawAtlas()
}

function showImagePreviewError(): void {
  atlasCanvas.hidden = true
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
  const overviewSelected = Boolean(
    files.querySelector(`.sidebar-overview button[data-path="${CSS.escape(selectedPath)}"]`),
  )
  const propertiesAvailable = Boolean(
    selectedPath && (archive?.isText(selectedPath) || archive?.isBdaConfig(selectedPath) || isBdaLayoutPath(selectedPath)) && overviewSelected && !imageSelected,
  )
  for (const button of inspectorTabButtons) {
    const tab = button.dataset.inspectorTab
    const available = resourceConfigActive
      ? tab === "properties" || tab === "source" && Boolean(selectedPath)
      :
      tab === "properties"
        ? imageSelected || propertiesAvailable
        : !imageSelected && Boolean(selectedPath)
    button.disabled = !available
    button.classList.toggle("active", tab === inspectorTab && available)
  }
  if (resourceConfigActive) {
    sourceName.textContent = inspectorTab === "source" && selectedResourcePath ? tilePath : selectedResourcePath || selectedPath
    quickInspector.hidden = true
    asset.hidden = true
    resourceInspector.hidden = inspectorTab !== "properties"
    sourceEditor.hidden = inspectorTab !== "source"
    return
  }
  resourceInspector.hidden = true
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
  sourceHighlight.innerHTML = `${highlightIni(source.value, selectedSourceSections())}\n`
}

function selectedSourceSections(): string[] {
  if (resourceConfigActive && selectedResourcePath) {
    return selectedTileIndex === undefined ? [] : [`IMG${selectedTileIndex}`]
  }
  return selectedPath === layoutPath ? selectedKeySections : []
}

function scrollSelectedSource(): void {
  const sections = selectedSourceSections()
  if (sourceEditor.hidden || !sections.length) return
  const selected = new Set(sections)
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
    alpha.value = String(Number.parseInt(hex.slice(0, 2), 16) / 255)
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
  const source = archive.format === "bda" ? bdaBase : archive
  const sourceGenPath = archive.format === "bda" ? bdaBasePath(genPath) : genPath
  const configured = source?.isText(sourceGenPath)
    ? IniDocument.parse(source.getText(sourceGenPath)).get("CAND", "LAYOUT_NAME")?.trim()
    : undefined
  const sourceDirectory = archive.format === "bda" ? bdaBasePath(directory) : directory
  const found = source && firstExistingPath(source.names(), sourceDirectory, [
    ...(configured ? [`${configured}.cnd`] : []),
    "cand1.cnd",
    "cand.cnd",
  ])
  return found && (archive.format === "bda"
    ? `${directory}/${found.split("/").pop()}`
    : found)
}

function candidateCssLength(value: string | undefined, width: number): string | undefined {
  const number = Number(value)
  return Number.isFinite(number) ? `${(number / width) * 100}cqw` : undefined
}

function applyCandidateGeometry(document: IniDocument, width: number): void {
  const padding = document.get("CAND", "PADDING")?.split(",").map((value) => candidateCssLength(value, width))
  if (padding?.every(Boolean)) {
    const css = padding.length === 4
      ? [padding[1], padding[2], padding[3], padding[0]]
      : padding.length === 2
        ? [padding[1], padding[0]]
        : padding
    candidateArea.style.setProperty("--candidate-padding", css.join(" "))
  } else {
    candidateArea.style.removeProperty("--candidate-padding")
  }
  const firstGap = candidateCssLength(document.get("CAND", "FIRST_GAP"), width)
  const cellWidth = candidateCssLength(document.get("CAND", "CELL_W"), width)
  const moreWidth = candidateCssLength(document.get("CAND", "MORE_W"), width)
  if (firstGap) candidateArea.style.setProperty("--candidate-first-gap", firstGap)
  else candidateArea.style.removeProperty("--candidate-first-gap")
  if (cellWidth) candidateArea.style.setProperty("--candidate-cell-width", cellWidth)
  else candidateArea.style.removeProperty("--candidate-cell-width")
  if (moreWidth) candidateArea.style.setProperty("--candidate-more-width", moreWidth)
  else candidateArea.style.removeProperty("--candidate-more-width")
}

function refreshToolbarPreview(
  composing: boolean,
  resolver: VisualResolver,
): { width: number; height: number } | undefined {
  const path = toolbarConfigPath()
  const document = path ? textDocument(path) : undefined
  if (!archive || !path || !document) {
    delete toolbarStrip.dataset.path
    toolbarStrip.hidden = true
    return
  }
  const gen = textDocument(genConfigPath())
  const size = gen?.get("CAND", "VIEW_RECT")?.split(",").map(Number)
  toolbarStrip.hidden = composing
  toolbarStrip.dataset.path = path
  toolbarPreview.setResolver(resolver)
  toolbarPreview.setOffsets(gen)
  toolbarPreview.setDefaults(gen)
  toolbarPreview.setTheme(theme.value === "dark" ? "dark" : "light")
  toolbarPreview.setTransparent(device.value !== "canvas")
  const width = size?.length === 4 && Number.isFinite(size[2]) ? size[2] : 1125
  const height = size?.length === 4 && Number.isFinite(size[3]) ? size[3] : 133
  toolbarCanvas.style.setProperty("--toolbar-width", String(width))
  toolbarCanvas.style.setProperty("--toolbar-height", String(height))
  applyCandidateGeometry(document, width)
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
  if (!visual.source) {
    return { x: 0, y: 0, width: canvas.width, height: canvas.height }
  }
  const [, , sourceWidth, sourceHeight] = visual.source
  if (!foreground) {
    const scale = Math.min(canvas.width / sourceWidth, canvas.height / sourceHeight)
    const width = sourceWidth * scale
    const height = sourceHeight * scale
    return { x: (canvas.width - width) / 2, y: (canvas.height - height) / 2, width, height }
  }
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

let stylePickerTarget: HTMLInputElement | undefined
let stylePickerRenderID = 0

function styleReferenceKey(input: HTMLInputElement): string {
  return input.dataset.keyboardField ?? input.dataset.toolbarField ?? input.dataset.keyField ?? input.dataset.documentStyleKey ?? ""
}

function isStyleReferenceKey(key: string): boolean {
  return key === "styleID" || /(?:^|\.)(?:[A-Z0-9_]*STYLE|FIRST_BACK|FIRST_FORE)$/i.test(key)
}

function decorateStyleReferenceInput(input: HTMLInputElement, key = styleReferenceKey(input)): void {
  if (!isStyleReferenceKey(key) || input.closest(".style-reference-input")) return
  input.dataset.documentStyleKey ||= key
  const parent = input.parentNode
  if (!parent) return
  const wrapper = document.createElement("span")
  wrapper.className = "style-reference-input"
  parent.insertBefore(wrapper, input)
  wrapper.append(input)
  const button = document.createElement("button")
  button.type = "button"
  button.className = "style-picker-trigger"
  button.title = "浏览所有样式"
  button.setAttribute("aria-label", "浏览所有样式")
  button.textContent = "⌄"
  button.addEventListener("click", () => openStylePicker(input))
  wrapper.append(button)
}

function availableStyleIDs(): string[] {
  if (!archive || archive.format === "bda") return []
  const path = styleConfigPath()
  if (!archive.isText(path)) return []
  return IniDocument.parse(archive.getText(path)).sections()
    .flatMap((section) => section.match(/^STYLE(\d+)$/)?.[1] ?? [])
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
}

async function renderStylePicker(): Promise<void> {
  const renderID = ++stylePickerRenderID
  const query = stylePickerSearch.value.trim().toLowerCase()
  const styleIDs = availableStyleIDs().filter((styleID) => styleID.toLowerCase().includes(query))
  const resolver = visualResolver()
  stylePickerGrid.replaceChildren()
  stylePickerCount.textContent = `${styleIDs.length} 个样式`
  stylePickerEmpty.hidden = styleIDs.length > 0
  if (!resolver) return
  const foreground = /FORE|INPUT_STYLE|SCAND_STYLE|CELL_STYLE/.test(styleReferenceKey(stylePickerTarget!))
  const items = await Promise.all(styleIDs.map(async (styleID) => ({
    styleID,
    visuals: await Promise.all([
      resolver.resolve(styleID, false).catch(() => undefined),
      resolver.resolve(styleID, true).catch(() => undefined),
    ]),
  })))
  if (renderID !== stylePickerRenderID) return
  for (const { styleID, visuals } of items) {
    const button = document.createElement("button")
    button.type = "button"
    button.className = "style-picker-item"
    button.title = `使用样式 ${styleID}`
    const label = document.createElement("strong")
    label.textContent = styleID
    const previews = document.createElement("span")
    previews.className = "style-picker-previews"
    for (const [index, visual] of visuals.entries()) {
      const canvas = document.createElement("canvas")
      canvas.width = 64
      canvas.height = 44
      canvas.setAttribute("aria-label", index === 0 ? "正常状态" : "按下状态")
      drawVisualPreview(canvas, [visual], foreground)
      previews.append(canvas)
    }
    button.append(label, previews)
    button.addEventListener("click", () => {
      if (!stylePickerTarget) return
      stylePickerTarget.value = styleID
      stylePickerTarget.dispatchEvent(new Event("input", { bubbles: true }))
      stylePickerTarget.dispatchEvent(new Event("change", { bubbles: true }))
      stylePickerDialog.close()
    })
    stylePickerGrid.append(button)
  }
}

function openStylePicker(input: HTMLInputElement): void {
  if (input.disabled || !availableStyleIDs().length) return
  stylePickerTarget = input
  stylePickerSearch.value = ""
  stylePickerDialog.showModal()
  void renderStylePicker()
  stylePickerSearch.focus()
}

for (const input of [...keyboardFields, ...toolbarFields, ...keyFields]) decorateStyleReferenceInput(input)
stylePickerSearch.addEventListener("input", () => void renderStylePicker())
stylePickerClose.addEventListener("click", () => stylePickerDialog.close())
stylePickerDialog.addEventListener("click", (event) => {
  if (event.target === stylePickerDialog) stylePickerDialog.close()
})

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
  const resolver = visualResolver()
  if (!resolver) return
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
    processedPreviewStyleIDs.set(button, styleIDs)
    drawStylePreview(button, drawable, foreground)
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

function selectedBdaRefs(
  source: "BACK_STYLE" | "FORE_STYLE",
  type: BdaStyleRef["type"],
  fallbackSource?: "BACK_STYLE" | "FORE_STYLE",
): BdaStyleRef[] {
  if (archive?.format !== "bda" || !layoutDocument) return []
  const collect = (name: "BACK_STYLE" | "FORE_STYLE") =>
    selectedKeySections.flatMap((section) => {
      const ref = (layoutDocument?.get(section, name) ?? "")
        .split(",")
        .map(bdaStyleRef)
        .find((item) => item?.type === type)
      return ref ? [ref] : []
    })
  const refs = collect(source)
  return refs.length || !fallbackSource ? refs : collect(fallbackSource)
}

function bdaStyleValue(appearance: BdaAppearance, ref: BdaStyleRef, property: string): string {
  if (ref.type === "image") {
    const style = appearance.imageStyles.get(ref.key)
    return (property === "HL_IMG" ? style?.highlightImage : style?.normalImage)?.resource?.resourceID ?? ""
  }
  if (ref.type === "color") {
    const style = appearance.colorStyles.get(ref.key)
    const value = property === "HL_COLOR" ? style?.highlightColor : style?.normalColor
    return value === undefined ? "" : bdaColorHex(value)
  }
  const style = appearance.textStyles.get(ref.key)
  if (!style) return ""
  if (property === "FONT_NAME") return style.fontName
  if (property === "FONT_SIZE") return String(style.fontSize)
  if (property === "NM_COLOR") return bdaColorHex(style.normalColor)
  if (property === "HL_COLOR") return bdaColorHex(style.highlightColor)
  return ""
}

function updateBdaRefs(refs: BdaStyleRef[], property: string, value: string): boolean {
  const info = currentBdaAppearance()
  if (!info || !refs.length) return false
  let bytes = info.bytes
  for (const ref of new Map(refs.map((item) => [`${item.type}:${item.key}`, item])).values()) {
    bytes = updateBdaStyle(bytes, ref, property, value)
  }
  commitBytes(info.path, info.bytes, bytes)
  refreshBdaLayout(layoutPath)
  refreshPreview()
  populateKeyInspector()
  updateDirty()
  return true
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

baiduActionCodes.replaceChildren(...Array.from({ length: 99 }, (_, index) => {
  const value = `F${index + 1}`
  return new Option(describeAction(value), value)
}))

const documentFieldLabels: Record<string, string> = {
  BACK_STYLE: "背景样式",
  FORE_STYLE: "前景样式",
  CELL_STYLE: "单元格样式",
  VIEW_RECT: "显示区域",
  PADDING: "内边距",
  SIZE: "尺寸",
  TYPE: "类型",
  LAYOUT_NAME: "布局名称",
  KEY_NUM: "按键数量",
  TIP_NUM: "气泡数量",
  LIST_NUM: "列表数量",
  LIST_ORDER: "列表顺序",
  CELL_SIZE: "单元格尺寸",
  GRID: "网格",
  POS: "位置",
  NO_BLUR: "禁用模糊",
  OFFSET_NUM: "偏移数量",
}

function populateDocumentInspector(): void {
  documentFields.replaceChildren()
  const hasSelection = selectedPath === layoutPath && selectedKeySections.length > 0
  if (!selectedDocument || hasSelection || !archive?.isText(selectedPath)) {
    documentFieldsGroup.hidden = true
    return
  }
  const specialized = new Set<string>()
  if (isSkinInfoPath(selectedPath)) {
    for (const field of skinFields) specialized.add(`\u0000${field.dataset.skinField ?? ""}`)
  }
  if (isToolbarPath(selectedPath)) {
    for (const field of toolbarFields) {
      const [section, key] = (field.dataset.toolbarField ?? "").split(".")
      specialized.add(`${key ? section : "CAND"}\u0000${key || section}`)
    }
  }
  const entries = selectedDocument.entries().filter((entry) =>
    !/^KEY\d+$/.test(entry.section) && !specialized.has(`${entry.section}\u0000${entry.key}`),
  )
  documentFieldsGroup.hidden = entries.length === 0
  if (!entries.length) return

  const sections = [...new Set(entries.map((entry) => entry.section))]
  for (const [sectionIndex, section] of sections.entries()) {
    const disclosure = document.createElement("details")
    disclosure.className = "document-property-section"
    disclosure.open = sections.length <= 4 || sectionIndex === 0
    const summary = document.createElement("summary")
    summary.textContent = section || "基本信息"
    const grid = document.createElement("div")
    grid.className = "document-property-grid"
    for (const entry of entries.filter((item) => item.section === section)) {
      const label = document.createElement("label")
      label.className = "document-property-field"
      if (entry.value.length > 18 || /(?:RECT|IMG|PADDING|ORDER|LIST|SOURCE|FONT_NAME)/.test(entry.key)) {
        label.classList.add("wide")
      }
      const caption = document.createElement("span")
      caption.textContent = documentFieldLabels[entry.key] ?? entry.key
      caption.title = entry.key
      const input = document.createElement("input")
      input.value = entry.value
      input.disabled = !isEditing()
      input.addEventListener("change", () => {
        if (!selectedDocument || selectedPath !== input.closest<HTMLElement>(".document-fields")?.dataset.path) return
        const before = selectedDocument.toString()
        const key = entry.key
        if (!selectedDocument.set(section, key, input.value)) return
        const text = selectedDocument.toString()
        commitText(selectedPath, before, text)
        setSourceValue(text)
        if (selectedPath === layoutPath) layoutDocument = selectedDocument
        refreshPreview()
        updateDirty()
      })
      label.append(caption, input)
      decorateStyleReferenceInput(input, entry.key)
      grid.append(label)
    }
    disclosure.append(summary, grid)
    documentFields.append(disclosure)
  }
  documentFieldsGroup.dataset.path = selectedPath
}

function populateBdaConfigInspector(): void {
  bdaConfigFields.replaceChildren()
  const bytes = archive?.isBdaConfig(selectedPath) ? archive.getBytes(selectedPath) : undefined
  bdaConfigFieldsGroup.hidden = !bytes
  if (!bytes) return
  if (!/^\d*animationConfig$/.test(selectedPath.split("/").pop() ?? "")) {
    const summary = document.createElement("pre")
    summary.className = "bda-config-summary"
    summary.textContent = describeBdaConfig(selectedPath, bytes)
    bdaConfigFields.append(summary)
    return
  }

  const animation = decodeBdaAnimation(bytes)
  const targets = document.createElement("label")
  targets.textContent = "动画目标"
  const targetInput = document.createElement("input")
  targetInput.value = animation.targets.join(", ")
  targetInput.readOnly = true
  targets.append(targetInput)
  bdaConfigFields.append(targets)
  for (const sequence of animation.sequences.values()) {
    for (const [frameIndex, frame] of sequence.frames.entries()) {
      const resourceLabel = document.createElement("label")
      resourceLabel.textContent = `${sequence.name} · 第 ${frameIndex + 1} 帧资源`
      const resourceInput = document.createElement("input")
      resourceInput.value = frame.resourceID
      resourceInput.disabled = !isEditing()
      const durationLabel = document.createElement("label")
      durationLabel.textContent = `${sequence.name} · 第 ${frameIndex + 1} 帧时长`
      const durationInput = document.createElement("input")
      durationInput.type = "number"
      durationInput.min = "0"
      durationInput.value = String(frame.duration)
      durationInput.disabled = !isEditing()
      const update = (property: "resourceID" | "duration", value: string | number) => {
        const before = archive?.getBytes(selectedPath)
        if (!before) return
        const after = updateBdaAnimationFrame(before, sequence.name, frameIndex, property, value)
        commitBytes(selectedPath, before, after)
        setSourceValue(describeBdaConfig(selectedPath, after))
        populateBdaConfigInspector()
        refreshPreview()
        updateDirty()
      }
      resourceInput.addEventListener("change", () => update("resourceID", resourceInput.value))
      durationInput.addEventListener("change", () => update("duration", Number(durationInput.value)))
      resourceLabel.append(resourceInput)
      durationLabel.append(durationInput)
      bdaConfigFields.append(resourceLabel, durationLabel)
    }
  }
}

function addNavButton(
  parent: HTMLElement,
  label: string,
  path: string,
  className: string,
  icon?: string,
  navMode = className === "nav-resource" ? "resource" : "document",
): void {
  if (!archive?.names().includes(path) && !isBdaVirtualTextPath(path)) return
  const button = document.createElement("button")
  button.className = `nav-item ${className}`
  button.dataset.path = path
  button.dataset.navMode = navMode
  const navigationSystemSymbols: Record<string, string> = {
    "nav-overview": "info.circle",
    "nav-layout": "keyboard",
    "nav-component": "square.grid.2x2",
    "nav-style": "paintpalette",
    "nav-resource": "photo",
  }
  button.append(createSystemSymbol(icon ?? navigationSystemSymbols[className] ?? "doc"))
  const labelNode = document.createElement("span")
  labelNode.className = "nav-label"
  labelNode.textContent = label
  button.append(labelNode)
  const metaNode = document.createElement("span")
  metaNode.className = "nav-meta"
  metaNode.textContent = path.split("/").pop() ?? path
  button.append(metaNode)
  button.addEventListener("click", () => {
    if (path.endsWith("py_9.ini") || path.endsWith("py_26.ini")) {
      layout.value = path.endsWith("_9.ini") ? "py_9.ini" : "py_26.ini"
      previewReturnName = path.split("/").pop() ?? layout.value
    }
    selectFile(path, "overview", navMode === "resource" ? "image" : navMode === "style" ? "style" : "document")
  })
  parent.append(button)
}

function populateKeyInspector(): void {
  const document = layoutDocument
  const sections = selectedKeySections
  const hasSelection = Boolean(document && sections.length)
  const skinSelected = isSkinInfoPath(selectedPath)
  const toolbarSelected = isToolbarPath(selectedPath)
  const bdaConfigSelected = Boolean(archive?.isBdaConfig(selectedPath))
  skinFieldsGroup.hidden = !skinSelected
  toolbarFieldsGroup.hidden = !toolbarSelected
  keyboardFieldsGroup.hidden = skinSelected || toolbarSelected || bdaConfigSelected || selectedPath !== layoutPath || hasSelection
  for (const group of keyOnlyGroups) group.hidden = skinSelected || bdaConfigSelected || !hasSelection
  selectedKeyName.textContent = skinSelected
    ? "皮肤信息"
    : bdaConfigSelected
      ? selectedPath.split("/").pop() ?? "BDA 专属配置"
    : toolbarSelected
      ? "候选栏与工具栏"
    : selectedPath !== layoutPath && !toolbarSelected
      ? selectedPath.split("/").pop() ?? "文档配置"
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
    field.disabled = !hasSelection || archive?.format === "bda"
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
    if (archive?.format === "bda") {
      const info = currentBdaAppearance()
      const refs = selectedBdaRefs("FORE_STYLE", "text")
      const values = info ? refs.map((ref) => bdaStyleValue(info.appearance, ref, property)) : []
      const common = values.length && values.every((value) => value === values[0]) ? values[0] : ""
      field.disabled = !refs.length || property === "FONT_WEIGHT"
      field.placeholder = refs.length && !common && new Set(values).size > 1 ? "混合" : field.disabled ? "未配置" : ""
      field.value = common
      if (property.endsWith("COLOR")) syncColorControl(field)
      continue
    }
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
  const hasTextStyle = archive?.format === "bda"
    ? selectedBdaRefs("FORE_STYLE", "text").length > 0
    : styleFields.some((field) => Boolean(selectedStylePropertyContext(field.dataset.styleField ?? "")))
  for (const label of textStyleLabels) label.hidden = !hasSelection || !hasTextStyle
  for (const button of layoutActionButtons) {
    button.disabled = selectedKeySections.length < 2 || archive?.format === "bda"
  }
  const rects = selectedRects()
  for (const field of gapFields) {
    field.disabled = rects.length < 2 || archive?.format === "bda"
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
  populateDocumentInspector()
  populateBdaConfigInspector()
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
  if (!archive || archive.format === "bda" || !layoutDocument || !selectedKeySections.length) return
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
  if (archive?.format === "bda") {
    updateBdaRefs(selectedBdaRefs("FORE_STYLE", "text"), property, field.value)
    return
  }
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

function selectedStyleImageSections(source: "BACK_STYLE" | "FORE_STYLE"): { document: IniDocument; path: string; sections: string[] } | undefined {
  if (!archive || !layoutDocument || !selectedKeySections.length) return
  const path = styleConfigPath()
  if (!archive.isText(path)) return
  const document = IniDocument.parse(archive.getText(path))
  const sections = source === "BACK_STYLE"
    ? backgroundStyleSections(layoutDocument, selectedKeySections)
    : [...new Set(selectedKeySections.flatMap((key) =>
        (layoutDocument?.get(key, source) ?? "").split(",").map((token) => token.trim()).flatMap((token) => {
          const value = Number(token)
          return [`STYLE${token}`, Number.isFinite(value) ? `STYLE${Math.floor(value / 100)}` : ""]
        }).filter((section) => section && document.sections().includes(section)),
      ))]
  return sections.length ? { document, path, sections } : undefined
}

function styleWriteTarget(
  source: "BACK_STYLE" | "FORE_STYLE",
  property: "NM_IMG" | "HL_IMG",
  styleIDs: string[],
): StyleImagePickerTarget {
  if (archive?.format === "bda") return { source, property }
  const path = styleConfigPath()
  if (!archive?.isText(path)) return { source, property }
  const document = IniDocument.parse(archive.getText(path))
  const sections = [
    ...new Set(
      styleIDs.flatMap((token) => {
        const value = Number(token)
        return [
          `STYLE${token}`,
          source === "FORE_STYLE" && Number.isFinite(value)
            ? `STYLE${Math.floor(value / 100)}`
            : "",
        ].filter(Boolean)
      }).filter((section) => document.sections().includes(section)),
    ),
  ]
  return sections.length ? { source, property, document, path, sections } : { source, property }
}

function updateSelectedImageReference(target: StyleImagePickerTarget | undefined, value: string): boolean {
  if (!archive || !target) return false
  const { document, path, sections } = target
  if (document && path && sections?.length) {
    const before = document.toString()
    setStyleField(document, sections, target.property, value)
    const text = document.toString()
    commitText(path, before, text)
    if (selectedPath === path) setSourceValue(text)
    refreshPreview()
    if (resourceInspectorMode === "style" && resourceConfigActive) {
      void renderStyleResourceDetail()
    }
    populateKeyInspector()
    updateDirty()
    return true
  }
  if (archive?.format === "bda") {
    const refs = target.source === "FORE_STYLE"
      ? selectedBdaRefs("FORE_STYLE", "image", "BACK_STYLE")
      : selectedBdaRefs("BACK_STYLE", "image")
    return updateBdaRefs(refs, target.property, value)
  }
  const context = selectedStyleImageSections(target.source)
  if (!archive || !context) return false
  const before = context.document.toString()
  setStyleField(context.document, context.sections, target.property, value)
  const text = context.document.toString()
  commitText(context.path, before, text)
  if (selectedPath === context.path) setSourceValue(text)
  refreshPreview()
  populateKeyInspector()
  updateDirty()
  return true
}

let pickerSelectedIndex: number | undefined

function imageDataURL(bytes: Uint8Array): string {
  let binary = ""
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
  }
  return `data:image/png;base64,${btoa(binary)}`
}

async function showPickerWindow(
  label: "image-picker" | "resource-picker",
  mode: "image" | "resource",
  title: string,
  width: number,
  height: number,
): Promise<void> {
  const existing = await WebviewWindow.getByLabel(label)
  if (existing) {
    await emitTo(label, `${label}-data`, mode === "image" ? nativeImagePickerPayload : nativeResourcePickerPayload)
    await existing.setFocus()
    return
  }
  new WebviewWindow(label, {
    url: `picker.html?mode=${mode}`,
    title,
    width,
    height,
    minWidth: mode === "image" ? 720 : 560,
    minHeight: 480,
    center: true,
    decorations: true,
    resizable: true,
  })
}

function openResourcePickerWindow(): void {
  if (!archive || !pickerTarget) return
  nativeResourcePickerPayload = resourceImagePaths(archive.names(), theme.value, orientation.value).flatMap((path) => {
    const bytes = archive?.getBytes(path)
    return bytes ? [{ path, dataURL: imageDataURL(bytes) }] : []
  })
  void showPickerWindow("resource-picker", "resource", "选择图片资源", 860, 640)
}

function closeStyleImageResourcePicker(): void {
  styleImageResourcePicker.hidden = true
  styleImageResourceSearch.value = ""
}

function renderStyleImageResources(): void {
  if (!archive) return
  const query = styleImageResourceSearch.value.trim().toLowerCase()
  const paths = resourceImagePaths(archive.names(), theme.value, orientation.value)
    .filter((path) => path.toLowerCase().includes(query))
  styleImageImgList.replaceChildren()
  for (const path of paths) {
    const bytes = archive.getBytes(path)
    if (!bytes) continue
    const button = document.createElement("button")
    button.type = "button"
    button.title = path
    const image = document.createElement("img")
    image.src = imageDataURL(bytes)
    image.alt = ""
    const name = document.createElement("span")
    name.textContent = path.split("/").pop() ?? path
    button.append(image, name)
    button.classList.toggle("active", path === pickerPath)
    button.addEventListener("click", () => {
      closeStyleImageResourcePicker()
      if (pickerTarget) openImageSlicePicker(path, pickerTarget)
    })
    styleImageImgList.append(button)
  }
  const count = styleImageImgList.childElementCount
  styleImageResourceCount.textContent = `${count} 张图片`
  styleImageResourceEmpty.hidden = count > 0
}

function openStyleImageResourcePicker(): void {
  if (isTauri() || !archive || !pickerTarget) return
  styleImageResourcePicker.hidden = false
  renderStyleImageResources()
  styleImageResourceSearch.focus()
}

function clearImageSlicePicker(): void {
  if (pickerURL) URL.revokeObjectURL(pickerURL)
  pickerURL = ""
  pickerImage = undefined
  pickerSlices = []
  pickerPath = ""
  pickerTarget = undefined
  pickerSelectedIndex = undefined
  styleImagePicker.hidden = true
  styleImagePreview.hidden = false
  styleImageResourceOpen.hidden = true
  closeStyleImageResourcePicker()
  styleImageImgList.replaceChildren()
  styleImageResourceCount.textContent = ""
  styleImageResourceEmpty.hidden = true
  styleImageDialog.hidden = true
  nativeImagePickerPayload = undefined
  nativeResourcePickerPayload = []
  for (const label of ["image-picker", "resource-picker"]) {
    void WebviewWindow.getByLabel(label).then((pickerWindow) => pickerWindow?.close())
  }
}

function drawImageSlicePicker(): void {
  const context = styleImagePickerCanvas.getContext("2d")
  if (!context || !pickerImage?.naturalWidth) return
  const width = pickerImage.naturalWidth
  const height = pickerImage.naturalHeight
  pickerScale = Math.min(styleImagePickerCanvas.width / width, styleImagePickerCanvas.height / height)
  const targetWidth = width * pickerScale
  const targetHeight = height * pickerScale
  pickerOffset = { x: (styleImagePickerCanvas.width - targetWidth) / 2, y: (styleImagePickerCanvas.height - targetHeight) / 2 }
  context.clearRect(0, 0, styleImagePickerCanvas.width, styleImagePickerCanvas.height)
  context.drawImage(pickerImage, pickerOffset.x, pickerOffset.y, targetWidth, targetHeight)
  const lineWidth = Math.max(1, Math.round(Math.min(targetWidth, targetHeight) / 350))
  context.font = `${Math.max(11, lineWidth * 7)}px ui-monospace, monospace`
  context.textBaseline = "top"
  for (const slice of pickerSlices) {
    const [x, y, sliceWidth, sliceHeight] = slice.source
    const selected = slice.index === pickerSelectedIndex
    context.lineWidth = selected ? lineWidth * 2 : lineWidth
    context.strokeStyle = selected ? "#ff3b30" : "#0a7ff5"
    context.strokeRect(
      pickerOffset.x + x * pickerScale,
      pickerOffset.y + y * pickerScale,
      sliceWidth * pickerScale,
      sliceHeight * pickerScale,
    )
    context.fillStyle = selected ? "#ff3b30" : "#0a7ff5"
    context.fillRect(pickerOffset.x + x * pickerScale, pickerOffset.y + y * pickerScale, context.measureText(`IMG${slice.index}`).width + 6, 15)
    context.fillStyle = "#fff"
    context.fillText(`IMG${slice.index}`, pickerOffset.x + x * pickerScale + 3, pickerOffset.y + y * pickerScale + 2)
  }
}

function openImageSlicePicker(path: string, target: StyleImagePickerTarget, selectedSource?: TileRect): void {
  if (!archive?.isImage(path)) return
  const bytes = archive.getBytes(path)
  if (!bytes) return
  if (pickerURL) URL.revokeObjectURL(pickerURL)
  pickerURL = URL.createObjectURL(new Blob([bytes], { type: "image/png" }))
  pickerPath = path
  pickerTarget = target
  const tilePathForPicker = path.replace(/\.png$/i, ".til")
  pickerSlices = archive.isText(tilePathForPicker) ? tileSlices(IniDocument.parse(archive.getText(tilePathForPicker))) : []
  pickerSelectedIndex = pickerSlices.find((slice) => selectedSource && slice.source.join(",") === selectedSource.join(","))?.index
  nativeImagePickerPayload = {
    path,
    dataURL: imageDataURL(bytes),
    slices: pickerSlices,
    selectedIndex: pickerSelectedIndex,
    editable: isEditing(),
  }
  if ("__TAURI_INTERNALS__" in window) {
    styleImageDialog.hidden = true
    void showPickerWindow("image-picker", "image", "图片切片", 1100, 760)
    return
  }
  closeStyleImageResourcePicker()
  pickerImage = new Image()
  pickerImage.onload = () => {
    if (!pickerImage) return
    const scale = Math.min(960 / pickerImage.naturalWidth, 640 / pickerImage.naturalHeight)
    styleImagePickerCanvas.width = Math.max(1, Math.round(pickerImage.naturalWidth * scale))
    styleImagePickerCanvas.height = Math.max(1, Math.round(pickerImage.naturalHeight * scale))
    drawImageSlicePicker()
  }
  pickerImage.src = pickerURL
  styleImagePreview.hidden = true
  styleImagePicker.hidden = false
  styleImageResourceOpen.hidden = false
  styleImageTitle.textContent = path.split("/").pop() ?? path
  styleImageSubtitle.textContent = " · 选择切片"
  styleImagePickerMeta.textContent = pickerSlices.length ? "点击图片中的切片以修改引用" : "此图片没有可用的 TIL 切片"
  styleImageDialog.hidden = false
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

function atlasPoint(event: Pick<PointerEvent, "clientX" | "clientY">): TilePoint {
  const bounds = atlasCanvas.getBoundingClientRect()
  return {
    x: ((event.clientX - bounds.left) / bounds.width) * atlasCanvas.width,
    y: ((event.clientY - bounds.top) / bounds.height) * atlasCanvas.height,
  }
}

function commitTile(slice: TileSlice): void {
  if (!archive || !selectedResourcePath || !isEditing()) return
  const [x, y, width, height] = slice.source
  if (
    width <= 0 || height <= 0 || x < 0 || y < 0 ||
    x + width > atlasCanvas.width || y + height > atlasCanvas.height
  ) return
  const before = tileDocument.toString()
  updateTileSlice(tileDocument, slice)
  commitText(tilePath, before, tileDocument.toString())
  setSourceValue(tileDocument.toString())
  slices = tileSlices(tileDocument)
  selectedTileIndex = slice.index
  updateSourceHighlight()
  populateTileInspector()
  drawAtlas()
  updateDirty()
  renderResourceInspectorMetadata()
}

function renderResourceInspectorMetadata(): void {
  for (const item of resourceGallery.querySelectorAll<HTMLElement>(".resource-item")) {
    if (item.dataset.path !== selectedResourcePath) continue
    const meta = item.querySelector("small")
    const size = meta?.textContent?.split(" · ")[0]
    if (meta) meta.textContent = `${size ? `${size} · ` : ""}TIL`
  }
}

function setDrawingTile(active: boolean): void {
  drawingTile = active
  tileDragStart = undefined
  tileDraft = undefined
  if (active) {
    movingTile = undefined
    moveStart = undefined
    moveSource = undefined
  }
  newTileButton.classList.toggle("active", active)
  atlasCanvas.classList.toggle("drawing", active)
  drawAtlas()
}

function moveSelectedTile(deltaX: number, deltaY: number): void {
  if (!archive || !selectedResourcePath || !isEditing()) return
  const existing = slices.find((slice) => slice.index === selectedTileIndex)
  if (!existing) return
  const source = moveTileRect(existing.source, deltaX, deltaY, atlasCanvas.width, atlasCanvas.height)
  const actualX = source[0] - existing.source[0]
  const actualY = source[1] - existing.source[1]
  if (!actualX && !actualY) return
  const inner = existing.inner
    ? moveTileRect(existing.inner, actualX, actualY, atlasCanvas.width, atlasCanvas.height)
    : undefined
  commitTile({ index: existing.index, source, ...(inner ? { inner } : {}) })
}

function deleteSelectedTile(): void {
  if (!archive || !selectedResourcePath || !isEditing() || selectedTileIndex === undefined) return
  const before = tileDocument.toString()
  if (!removeTileSlice(tileDocument, selectedTileIndex)) return
  commitText(tilePath, before, tileDocument.toString())
  setSourceValue(tileDocument.toString())
  slices = tileSlices(tileDocument)
  selectedTileIndex = undefined
  updateSourceHighlight()
  populateTileInspector()
  drawAtlas()
  updateDirty()
}

function duplicateSelectedTile(): void {
  const existing = slices.find((slice) => slice.index === selectedTileIndex)
  if (!existing || !isEditing()) return
  commitTile(duplicateTileSlice(existing, nextTileIndex(tileDocument)))
}

function updateSelectedTile(): void {
  const existing = slices.find((slice) => slice.index === selectedTileIndex)
  if (!existing) return
  const source = tileSourceFields.map((field) => Number(field.value)) as TileRect
  if (source.some((value) => !Number.isFinite(value))) return
  const innerValues = tileInnerFields.map((field) => field.value.trim())
  const innerNumbers = innerValues.map(Number) as TileRect
  const inner = innerValues.every(Boolean) && innerNumbers.every(Number.isFinite) ? innerNumbers : undefined
  commitTile({ index: existing.index, source, ...(inner ? { inner } : {}) })
}

function setSidebarView(view: "overview" | "source"): void {
  sidebarView = view
  for (const button of sidebarViewButtons) {
    button.classList.toggle("active", button.dataset.sidebarView === view)
  }
  files.querySelector<HTMLElement>(".sidebar-overview")?.toggleAttribute("hidden", view !== "overview")
  files.querySelector<HTMLElement>(".raw-files")?.toggleAttribute("hidden", view !== "source")
}

function selectFile(
  path: string,
  preferredSidebarView = sidebarView,
  resourceMode: "document" | "image" | "style" = "document",
): void {
  resourceConfigActive = resourceMode !== "document"
  resourceInspectorMode = resourceMode === "style" ? "style" : "image"
  toggleGuides.title = resourceInspectorMode === "image" && resourceConfigActive ? "切片网格" : "辅助线"
  toggleGuides.setAttribute("aria-label", resourceInspectorMode === "image" && resourceConfigActive ? "切片网格" : "辅助线")
  if (resourceInspectorMode === "image" && resourceConfigActive) setGuidesVisible(true)
  if (!resourceConfigActive) {
    selectedResourcePath = ""
    drawingTile = false
    tileDragStart = undefined
    tileDraft = undefined
    newTileButton.classList.remove("active")
    atlasCanvas.classList.remove("drawing")
  } else {
    selectedResourcePath = ""
    selectedStyleID = ""
    selectedResourceGalleryPath = ""
    resourceListView.hidden = false
    resourceDetail.hidden = true
  }
  if (archive?.isImage(path) && selectedPath && !archive.isImage(selectedPath)) {
    assetReturnPath = selectedPath
  }
  selectedPath = path
  if (isBdaVirtualTextPath(path)) {
    hideImageWorkspace()
    const base = IniDocument.parse(bdaBase!.getText(bdaBasePath(path)))
    const previewLayout = isBdaLayoutPath(path) && previewItems(base).some((item) => item.editable)
    if (previewLayout && !refreshBdaLayout(path)) return
    selectedDocument = previewLayout ? layoutDocument : base
    if (previewLayout) selectedKeySections = []
    setSourceValue(`# BDA 官方基础布局（只读几何）\n\n${selectedDocument?.toString() ?? ""}`)
    source.disabled = true
    sourceName.textContent = `${path} · 几何来自百度输入法安装包`
    inspectorTab = "properties"
    if (previewLayout) refreshPreview()
  } else if (archive?.isImage(path)) {
    inspectorTab = "properties"
    selectedDocument = undefined
    showImage(path)
  } else if (archive?.isText(path)) {
    hideImageWorkspace()
    selectedDocument = IniDocument.parse(archive.getText(path))
    setSourceValue(selectedDocument.toString())
    source.disabled = false
    sourceName.textContent = path
    const previewLayout =
      /\.ini$/i.test(path) &&
      !/(^|\/)gen\.ini$/i.test(path) &&
      previewItems(selectedDocument).some((item) => item.editable)
    if (previewLayout) {
      layoutPath = path
      layoutDocument = selectedDocument
      selectedKeySections = []
      inspectorTab = "properties"
      refreshPreview()
    } else if (preferredSidebarView === "overview") {
      inspectorTab = "properties"
    } else if (path !== layoutPath) {
      inspectorTab = "source"
    }
  } else if (archive?.isBdaConfig(path)) {
    hideImageWorkspace()
    selectedDocument = undefined
    setSourceValue(describeBdaConfig(path, archive.getBytes(path)!))
    source.disabled = true
    sourceName.textContent = path
    inspectorTab = "properties"
  } else {
    return
  }
  if (path === layoutPath && selectedDocument) {
    layoutDocument = selectedDocument
    refreshPreview()
  }
  if (preferredSidebarView === "source" && (archive?.isText(path) || archive?.isBdaConfig(path))) {
    inspectorTab = "source"
  }
  updateInspectorView()
  if (resourceConfigActive) renderResourceInspector()
  if (!quickInspector.hidden) populateKeyInspector()
  selectedFileButton?.classList.remove("selected")
  const preferredContainer = files.querySelector(preferredSidebarView === "overview" ? ".sidebar-overview" : ".raw-files")
  const navMode = resourceInspectorMode === "style" && resourceConfigActive
    ? "style"
    : resourceConfigActive
      ? "resource"
      : "document"
  selectedFileButton = preferredContainer?.querySelector<HTMLElement>(`button[data-path="${CSS.escape(path)}"][data-nav-mode="${navMode}"]`)
    ?? preferredContainer?.querySelector<HTMLElement>(`button[data-path="${CSS.escape(path)}"]`)
    ?? files.querySelector<HTMLElement>(`button[data-path="${CSS.escape(path)}"]`)
    ?? undefined
  if (selectedFileButton) {
    setSidebarView(selectedFileButton.closest(".raw-files") ? "source" : "overview")
  }
  selectedFileButton?.classList.add("selected")
}

const overviewGroupState = new Map<string, boolean>()

function renderFiles(): void {
  files.replaceChildren()
  selectedFileButton = undefined
  if (!archive) return

  const overview = document.createElement("div")
  overview.className = "sidebar-overview"
  files.append(overview)

  const section = (title: string): HTMLElement => {
    const disclosure = document.createElement("details")
    disclosure.className = "nav-group"
    disclosure.open = overviewGroupState.get(title) ?? true
    disclosure.addEventListener("toggle", () => overviewGroupState.set(title, disclosure.open))
    const summary = document.createElement("summary")
    summary.className = "nav-section"
    const marker = document.createElement("span")
    marker.className = "source-disclosure"
    const label = document.createElement("span")
    label.textContent = title
    summary.append(marker, label)
    const body = document.createElement("div")
    body.className = "nav-group-body"
    disclosure.append(summary, body)
    overview.append(disclosure)
    return body
  }

  type NavEntry = { group: string; label: string; path: string; className: string; icon: string; navMode?: string }
  const entries: NavEntry[] = []
  const overviewPath = archive.names().includes(`${theme.value}/skin/Info.txt`)
    ? `${theme.value}/skin/Info.txt`
    : "Info.txt"
  entries.push({ group: "皮肤", label: "皮肤信息", path: overviewPath, className: "nav-overview", icon: "info.circle" })
  if (archive.format === "bda") {
    entries.push({ group: "皮肤", label: "效果预览", path: `${theme.value}/skin/demo.png`, className: "nav-overview", icon: "photo" })
  }

  const iniTypes: Record<string, Omit<NavEntry, "path">> = {
    "py_9.ini": { group: "键盘布局", label: "中文 9 键", className: "nav-layout", icon: "keyboard" },
    "py_26.ini": { group: "键盘布局", label: "中文 26 键", className: "nav-layout", icon: "keyboard" },
    "def_9.ini": { group: "键盘布局", label: "默认 9 键", className: "nav-layout", icon: "keyboard" },
    "def_26.ini": { group: "键盘布局", label: "默认 26 键", className: "nav-layout", icon: "keyboard" },
    "en_9.ini": { group: "键盘布局", label: "英文 9 键", className: "nav-layout", icon: "keyboard" },
    "en_9s.ini": { group: "键盘布局", label: "英文 9 键 Shift", className: "nav-layout", icon: "keyboard" },
    "en_26.ini": { group: "键盘布局", label: "英文 26 键", className: "nav-layout", icon: "keyboard" },
    "en_26s.ini": { group: "键盘布局", label: "英文 26 键 Shift", className: "nav-layout", icon: "keyboard" },
    "bh.ini": { group: "键盘布局", label: "笔画键盘", className: "nav-layout", icon: "pencil" },
    "num_9.ini": { group: "数字与符号", label: "数字键盘", className: "nav-component", icon: "square.grid.2x2" },
    "num_26.ini": { group: "数字与符号", label: "26 键数字键盘", className: "nav-component", icon: "square.grid.2x2" },
    "num2.ini": { group: "数字与符号", label: "数字键盘 2", className: "nav-component", icon: "square.grid.2x2" },
    "symbol.ini": { group: "数字与符号", label: "符号面板", className: "nav-component", icon: "asterisk" },
    "sym_26_cn.ini": { group: "数字与符号", label: "中文 26 键符号", className: "nav-component", icon: "asterisk" },
    "hw_grid.ini": { group: "手写与选择", label: "手写面板", className: "nav-component", icon: "pencil" },
    "hw_full.ini": { group: "手写与选择", label: "全屏手写", className: "nav-component", icon: "pencil" },
    "sel_ch.ini": { group: "手写与选择", label: "中文选择栏", className: "nav-component", icon: "list.bullet" },
    "sel_en.ini": { group: "手写与选择", label: "英文选择栏", className: "nav-component", icon: "list.bullet" },
    "help.ini": { group: "手写与选择", label: "帮助面板", className: "nav-component", icon: "list.bullet" },
    "logo.ini": { group: "键盘组件", label: "输入法标识", className: "nav-component", icon: "app" },
  }
  const configPrefix = `${theme.value}/skin/${orientation.value}/`
  const appearancePath = bdaAppearancePath(archive, theme.value, orientation.value)
  const layoutPaths = archive.format === "bda"
    ? bdaAvailableLayoutPaths()
    : archive.names()
  for (const path of layoutPaths.sort()) {
    const basePath = archive.format === "bda" ? bdaBasePath(path) : path
    if (!path.startsWith(configPrefix) || path.slice(configPrefix.length).includes("/") || !/\.ini$/i.test(path)) continue
    if (archive.format === "bda" && !bdaBase?.isText(basePath)) continue
    const name = path.split("/").pop() ?? path
    if (name.toLowerCase() === "gen.ini") continue
    const info = iniTypes[name] ?? {
      group: "扩展布局",
      label: name.replace(/\.ini$/i, "").replaceAll("_", " "),
      className: "nav-layout",
      icon: "keyboard",
    }
    entries.push({ ...info, path })
  }

  const candidatePath = toolbarConfigPath()
  if (candidatePath) entries.push({ group: "键盘组件", label: "候选栏与工具栏", path: candidatePath, className: "nav-component", icon: "text.bubble" })
  const hintPath = firstExistingPath(archive.names(), `${theme.value}/skin/${orientation.value}`, ["hint1.pop", "hint.pop"])
  if (hintPath) entries.push({ group: "键盘组件", label: "按键气泡", path: hintPath, className: "nav-component", icon: "rectangle.and.hand.point" })
  const stylePath = appearancePath ?? (archive.format === "bda" ? undefined : styleConfigPath())
  if (stylePath) {
    entries.push({ group: "资源配置", label: "图片资源", path: stylePath, className: "nav-resource", icon: "photo", navMode: "resource" })
    if (archive.format !== "bda") {
      entries.push({ group: "资源配置", label: "样式配置", path: stylePath, className: "nav-style", icon: "paintpalette", navMode: "style" })
    }
  }
  if (archive.format === "bda") {
    for (const [kind, label] of [
      ["animation", "序列帧动画"],
      ["lightAnimation", "轻量动画"],
      ["sound", "声音配置"],
      ["switch", "开关配置"],
    ] as const) {
      const path = bdaConfigPath(archive, theme.value, orientation.value, kind)
      if (path) entries.push({ group: "扩展配置", label, path, className: "nav-style", icon: "gearshape" })
    }
  }
  for (const group of ["皮肤", "资源配置", "键盘布局", "数字与符号", "手写与选择", "键盘组件", "扩展配置", "扩展布局"]) {
    const grouped = entries.filter((entry) => entry.group === group && (
      archive?.names().includes(entry.path) ||
      archive?.format === "bda" && Boolean(bdaBase?.isText(bdaBasePath(entry.path)))
    ))
    if (!grouped.length) continue
    const body = section(group)
    for (const entry of grouped) addNavButton(body, entry.label, entry.path, entry.className, entry.icon, entry.navMode)
  }

  const sourceFiles = document.createElement("div")
  sourceFiles.className = "raw-files"
  sourceFiles.setAttribute("role", "tree")
  sourceFiles.setAttribute("aria-label", "源文件")
  const sourceNameCompare = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" }).compare
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
  const selectSourceRow = (row: HTMLElement) => {
    selectedFileButton?.classList.remove("selected")
    selectedFileButton = row
    row.classList.add("selected")
    for (const item of sourceFiles.querySelectorAll<HTMLElement>(".source-tree-row")) {
      item.tabIndex = item === row ? 0 : -1
    }
    row.focus()
  }
  const appendNode = (parent: HTMLElement, node: SourceNode, parentPath = "") => {
    for (const [name, child] of [...node.folders].sort(([a], [b]) => sourceNameCompare(a, b))) {
      const path = parentPath ? `${parentPath}/${name}` : name
      const folder = document.createElement("details")
      folder.className = "raw-folder"
      folder.dataset.folderPath = path
      const folderSummary = document.createElement("summary")
      folderSummary.className = "source-tree-row source-folder-row"
      folderSummary.setAttribute("role", "treeitem")
      folderSummary.setAttribute("aria-expanded", "false")
      folderSummary.tabIndex = -1
      const disclosure = document.createElement("span")
      disclosure.className = "source-disclosure"
      disclosure.ariaHidden = "true"
      const title = document.createElement("span")
      title.className = "nav-label"
      title.textContent = name
      folderSummary.append(disclosure, createSystemSymbol("folder"), title)
      const children = document.createElement("div")
      children.className = "source-tree-group"
      children.setAttribute("role", "group")
      folder.append(folderSummary, children)
      appendNode(children, child, path)
      disclosure.addEventListener("click", (event) => {
        event.preventDefault()
        event.stopPropagation()
        folder.open = !folder.open
      })
      folderSummary.addEventListener("click", (event) => {
        event.preventDefault()
        selectSourceRow(folderSummary)
      })
      folderSummary.addEventListener("dblclick", (event) => {
        event.preventDefault()
        folder.open = !folder.open
      })
      folder.addEventListener("toggle", () => {
        folderSummary.setAttribute("aria-expanded", String(folder.open))
      })
      parent.append(folder)
    }
    for (const path of [...node.paths].sort(sourceNameCompare)) {
      const button = document.createElement("button")
      button.className = "source-tree-row source-file-row"
      button.setAttribute("role", "treeitem")
      button.tabIndex = -1
      const sourceSymbol = archive?.isText(path) || archive?.isBdaConfig(path)
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
      button.disabled = !archive?.isText(path) && !archive?.isImage(path) && !archive?.isBdaConfig(path)
      button.addEventListener("click", () => selectFile(path, "source"))
      parent.append(button)
    }
  }
  appendNode(sourceFiles, root)
  sourceFiles.querySelector<HTMLElement>(".source-tree-row")?.setAttribute("tabindex", "0")
  sourceFiles.addEventListener("keydown", (event) => {
    const current = (event.target as Element | null)?.closest<HTMLElement>(".source-tree-row")
    if (!current) return
    const rows = Array.from(sourceFiles.querySelectorAll<HTMLElement>(".source-tree-row"))
      .filter((row) => row.getClientRects().length > 0)
    const index = rows.indexOf(current)
    let next: HTMLElement | undefined
    switch (event.key) {
      case "ArrowDown":
        next = rows[index + 1]
        break
      case "ArrowUp":
        next = rows[index - 1]
        break
      case "ArrowRight": {
        const folder = current.closest<HTMLDetailsElement>("details.raw-folder")
        if (current.matches("summary") && folder && !folder.open) folder.open = true
        else if (current.matches("summary") && folder?.open) next = rows[index + 1]
        break
      }
      case "ArrowLeft": {
        const folder = current.closest<HTMLDetailsElement>("details.raw-folder")
        if (current.matches("summary") && folder?.open) folder.open = false
        else if (current.matches("summary")) {
          next = folder?.parentElement?.closest<HTMLDetailsElement>("details.raw-folder")?.querySelector<HTMLElement>(":scope > summary") ?? undefined
        } else {
          next = folder?.querySelector<HTMLElement>(":scope > summary") ?? undefined
        }
        break
      }
      case "Enter":
      case " ":
        current.dispatchEvent(new MouseEvent(current.matches("summary") ? "dblclick" : "click", { bubbles: true }))
        break
      default:
        return
    }
    event.preventDefault()
    if (next) selectSourceRow(next)
  })
  files.append(sourceFiles)
  setSidebarView(sidebarView)
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

async function loadArchive(bytes: Uint8Array, path: string, isNew = false): Promise<void> {
  const nextArchive = SkinArchive.open(bytes)
  if (nextArchive.format === "bda" && !bdaBase) {
    const response = await fetch(new URL("bda-base.bds", document.baseURI))
    if (!response.ok) throw new Error("无法加载 BDA 官方基础布局")
    bdaBase = SkinArchive.open(new Uint8Array(await response.arrayBuffer()))
  }
  assetURL = releaseImagePreviewURL(assetURL)
  clearImageSlicePicker()
  archive = nextArchive
  const availableThemes = ["light", "dark"].filter((value) =>
    archive?.names().some((name) => name.startsWith(`${value}/skin/`)),
  )
  if (!availableThemes.includes(theme.value)) theme.value = availableThemes[0] ?? "light"
  syncSegmentedControls()
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
  for (const button of exportButtons) {
    const format = button.dataset.exportFormat as ExportFormat
    button.disabled = archive.format !== "bda" && format === "bda"
  }
  renderFiles()
  const bdaLayouts = bdaAvailableLayoutPaths()
  layoutPath = archive.format === "bda" && !bdaLayouts.includes(preferredPath())
    ? bdaLayouts[0] ?? preferredPath()
    : preferredPath()
  previewReturnName = layoutPath.split("/").pop() ?? layout.value
  const initial = archive.format === "bda" && isBdaLayoutPath(layoutPath)
    ? layoutPath
    : archive.names().includes(layoutPath)
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
    filters: [{ name: "百度输入法皮肤", extensions: ["bdi", "bds", "bda", "zip"] }],
  })
  if (typeof path !== "string") return false
  await loadNativePath(path)
  return true
}

async function loadNativePath(path: string): Promise<boolean> {
  const bytes = await invoke<number[]>("read_file", { path })
  await loadArchive(new Uint8Array(bytes), path)
  return true
}

function isSupportedSkinPath(path: string): boolean {
  return /\.(bdi|bds|bda)$/i.test(path)
}

async function loadDroppedFile(file: File): Promise<boolean> {
  if (!isSupportedSkinPath(file.name)) return false
  if (!(await prepareDocumentReplacement())) return false
  await loadArchive(new Uint8Array(await file.arrayBuffer()), file.name)
  return true
}

async function loadDroppedPath(path: string): Promise<boolean> {
  if (!isSupportedSkinPath(path)) return false
  if (!(await prepareDocumentReplacement())) return false
  return loadNativePath(path)
}

function currentExportFormat(): ExportFormat {
  return exportFormatFromPath(currentPath) ?? archive?.format ?? "bdi"
}

function exportArchive(format: ExportFormat): {
  bytes: Uint8Array
  converted: boolean
  warnings: string[]
} | undefined {
  if (!archive) throw new Error("当前没有可保存的皮肤")
  if (archive.format !== "bda" || format === "bda") {
    return { bytes: archive.toBytes(format), converted: false, warnings: [] }
  }
  if (!bdaBase) throw new Error("无法加载 BDA 官方基础布局")
  const result = convertBdaArchive(archive, bdaBase)
  if (result.warnings.length && !window.confirm(
    `BDA 转换为 ${format.toUpperCase()} 时将降级以下内容：\n\n${result.warnings.join("\n")}\n\n继续导出吗？`,
  )) return
  return { bytes: result.archive.toBytes(format), converted: true, warnings: result.warnings }
}

async function saveNative(saveAs: boolean, format: ExportFormat): Promise<boolean> {
  if (!archive) throw new Error("当前没有可保存的皮肤")
  let path = currentPath
  if (saveAs || !path || exportFormatFromPath(path) !== format) {
    const picked = await save({
      defaultPath: exportName(documentName.textContent ?? "skin", format),
      filters: [
        {
          name: format === "bdi"
            ? "百度输入法 iOS 皮肤"
            : format === "bda"
              ? "百度输入法新版 Android 皮肤"
              : "百度输入法 Android 皮肤",
          extensions: [format],
        },
      ],
    })
    if (!picked) return false
    path = exportPath(picked, format)
  }
  const exported = exportArchive(format)
  if (!exported) return false
  await invoke("write_file", { path, data: Array.from(exported.bytes) })
  if (!exported.converted) {
    currentPath = path
    unsavedNew = false
    archive.markSaved(exported.bytes)
    documentName.textContent = path.split(/[\\/]/).pop() || "未命名皮肤"
    updateDirty()
  }
  return true
}

function downloadArchive(format: ExportFormat): boolean {
  if (!archive) throw new Error("当前没有可保存的皮肤")
  const exported = exportArchive(format)
  if (!exported) return false
  const blob = new Blob([exported.bytes as BlobPart], { type: "application/zip" })
  const link = document.createElement("a")
  link.href = URL.createObjectURL(blob)
  link.download = exportName(documentName.textContent || "skin", format)
  link.click()
  URL.revokeObjectURL(link.href)
  if (!exported.converted) {
    archive.markSaved(exported.bytes)
    unsavedNew = false
    updateDirty()
  }
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
  await loadArchive(await loadBuiltInProjectTemplate(templateID), "", true)
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
async function refreshUpdateStatus(): Promise<void> {
  checkUpdateButton.disabled = true
  updateStatus.textContent = "正在检查更新…"
  downloadUpdate.hidden = true
  try {
    const fetcher = isTauri()
      ? async () => new Response(await invoke<string>("fetch_release_page"), { status: 200 })
      : fetch
    const result = await checkForUpdate(aboutUpdate.dataset.currentVersion ?? "0.0.0", fetcher)
    if (result.status === "latest") {
      updateStatus.textContent = `当前已是最新版本（v${result.currentVersion}）`
      return
    }
    updateStatus.textContent = `发现新版本 v${result.latestVersion}`
    downloadUpdate.href = result.url
    downloadUpdate.textContent = `前往下载 v${result.latestVersion}`
    downloadUpdate.hidden = false
  } catch (error) {
    updateStatus.textContent = `检查更新失败：${error instanceof Error ? error.message : String(error)}`
  } finally {
    checkUpdateButton.disabled = false
  }
}

checkUpdateButton.addEventListener("click", () => void refreshUpdateStatus())
copyQqGroupButton.addEventListener("click", async () => {
  const value = "228040912"
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(value)
    else throw new Error("clipboard unavailable")
  } catch {
    const fallback = document.createElement("textarea")
    fallback.value = value
    fallback.style.position = "fixed"
    fallback.style.opacity = "0"
    document.body.append(fallback)
    fallback.select()
    document.execCommand("copy")
    fallback.remove()
  }
  const label = copyQqGroupButton.textContent ?? "QQ群：228040912"
  copyQqGroupButton.textContent = "QQ群号已复制"
  window.setTimeout(() => { copyQqGroupButton.textContent = label }, 1400)
})
for (const button of appDialogButtons) {
  button.addEventListener("click", () => {
    const dialog = button.dataset.appDialog === "settings" ? settingsDialog : aboutDialog
    dialog.showModal()
    if (dialog === aboutDialog) void refreshUpdateStatus()
    for (const menu of toolbarMenus) menu.open = false
  })
}
for (const dialog of [settingsDialog, aboutDialog]) {
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close()
  })
}
for (const button of sidebarViewButtons) {
  button.addEventListener("click", () => setSidebarView(button.dataset.sidebarView === "source" ? "source" : "overview"))
}
defaultDevice.value = localStorage.getItem("default-device") ?? device.value
defaultDevice.addEventListener("change", () => {
  localStorage.setItem("default-device", defaultDevice.value)
})
const savedCanvasBackground = localStorage.getItem("canvas-background")
canvasBackground.value = savedCanvasBackground === "default" ? "glass" : savedCanvasBackground ?? "white"
canvasWrap.dataset.background = canvasBackground.value
canvasBackground.addEventListener("change", () => {
  localStorage.setItem("canvas-background", canvasBackground.value)
  canvasWrap.dataset.background = canvasBackground.value
})
const systemTheme = matchMedia("(prefers-color-scheme: dark)")
function applyAppTheme(): void {
  const preference = appTheme.value === "light" || appTheme.value === "dark" ? appTheme.value : "system"
  const resolved = preference === "system" ? (systemTheme.matches ? "dark" : "light") : preference
  document.documentElement.dataset.appTheme = resolved
  document.documentElement.style.colorScheme = resolved
  if (isTauri()) void getCurrentWindow().setTheme(preference === "system" ? null : preference)
}
appTheme.value = localStorage.getItem("app-theme") ?? "system"
applyAppTheme()
appTheme.addEventListener("change", () => {
  localStorage.setItem("app-theme", appTheme.value)
  applyAppTheme()
})
systemTheme.addEventListener("change", applyAppTheme)
async function applyWindowMaterial(): Promise<void> {
  const enabled = windowMaterial.checked
  document.documentElement.dataset.windowMaterial = enabled ? "on" : "off"
  if (!isTauri()) return
  try {
    await invoke("set_window_material", { enabled })
  } catch (error) {
    windowMaterial.checked = false
    document.documentElement.dataset.windowMaterial = "off"
    localStorage.setItem("window-material", "off")
    showError(error, "切换窗口材质")
  }
}
windowMaterial.checked = localStorage.getItem("window-material") !== "off"
void applyWindowMaterial()
windowMaterial.addEventListener("change", () => {
  localStorage.setItem("window-material", windowMaterial.checked ? "on" : "off")
  void applyWindowMaterial()
})
undoButton.addEventListener("click", undo)
redoButton.addEventListener("click", redo)
browserOpen.addEventListener("change", async () => {
  const file = browserOpen.files?.[0]
  if (file) {
    await runFileOperation("打开", async () => {
      await loadArchive(new Uint8Array(await file.arrayBuffer()), file.name)
      return true
    })
  }
  browserOpen.value = ""
})
let canvasDragDepth = 0
function setCanvasDropState(active: boolean): void {
  canvasWrap.classList.toggle("drop-target", active)
}
canvasWrap.addEventListener("dragenter", (event) => {
  event.preventDefault()
  canvasDragDepth += 1
  setCanvasDropState(true)
})
canvasWrap.addEventListener("dragover", (event) => {
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = "copy"
})
canvasWrap.addEventListener("dragleave", (event) => {
  event.preventDefault()
  canvasDragDepth = Math.max(0, canvasDragDepth - 1)
  if (!canvasDragDepth) setCanvasDropState(false)
})
canvasWrap.addEventListener("drop", (event) => {
  event.preventDefault()
  canvasDragDepth = 0
  setCanvasDropState(false)
  const file = event.dataTransfer?.files[0]
  if (file) void runFileOperation("打开", () => loadDroppedFile(file))
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
  if (resourceConfigActive && selectedResourcePath) {
    const before = tileDocument.toString()
    tileDocument = IniDocument.parse(source.value)
    commitText(tilePath, before, source.value)
    slices = tileSlices(tileDocument)
    if (!slices.some((slice) => slice.index === selectedTileIndex)) selectedTileIndex = undefined
    populateTileInspector()
    drawAtlas()
    updateDirty()
    updateSourceHighlight()
    return
  }
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
quickInspector.addEventListener("keydown", (event) => {
  const field = event.target
  if (!(field instanceof HTMLInputElement)) return
  if (!shouldClearMixedInput(event.key, field.placeholder, field.disabled)) return
  event.preventDefault()
  field.value = ""
  field.placeholder = ""
  field.dispatchEvent(new Event("input", { bubbles: true }))
})
for (const picker of colorPickers) {
  picker.addEventListener("input", () => {
    const alpha = colorAlphas.find((item) => item.dataset.colorAlphaFor === picker.dataset.colorPickerFor)
    writeColorControl(picker, Number(alpha?.value ?? 100))
  })
}
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
    if (archive?.format === "bda") {
      renderFiles()
      if (bdaAvailableLayoutPaths().includes(path)) selectFile(path)
    } else if (archive?.names().includes(path)) {
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
  applyModeState()
  if (resourceConfigActive) populateTileInspector()
  else populateKeyInspector()
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
function setGuidesVisible(enabled: boolean): void {
  guidesVisible = enabled
  toggleGuides.classList.toggle("active", guidesVisible)
  toggleGuides.setAttribute("aria-pressed", String(guidesVisible))
  preview.setGuides(guidesVisible)
  toolbarPreview.setGuides(guidesVisible)
  if (!enabled) setDrawingTile(false)
  drawAtlas()
}

toggleGuides.addEventListener("click", () => setGuidesVisible(!guidesVisible))
newTileButton.addEventListener("click", () => {
  if (!selectedResourcePath || !isEditing()) return
  if (!guidesVisible) setGuidesVisible(true)
  setDrawingTile(!drawingTile)
})
duplicateTileButton.addEventListener("click", duplicateSelectedTile)
deleteTileButton.addEventListener("click", deleteSelectedTile)
resourceBackButton.addEventListener("click", showResourceList)
resourceSearch.addEventListener("input", renderResourceInspector)
for (const button of tileModeButtons) {
  button.addEventListener("click", () => {
    tileMode = button.dataset.tileMode === "move" ? "move" : "select"
    tileModeButtons.forEach((item) => item.classList.toggle("active", item === button))
    setDrawingTile(false)
  })
}
atlasCanvas.addEventListener("pointerdown", (event) => {
  if (!resourceConfigActive) return
  const point = atlasPoint(event)
  if (drawingTile) {
    tileDragStart = point
    tileDraft = undefined
    atlasCanvas.setPointerCapture(event.pointerId)
    return
  }
  const hit = tileSliceAt(slices, point)
  selectedTileIndex = hit?.index
  updateSourceHighlight()
  if (hit) requestAnimationFrame(scrollSelectedSource)
  if (tileMode === "move" && hit && isEditing()) {
    movingTile = hit
    moveStart = point
    moveSource = hit.source
    atlasCanvas.setPointerCapture(event.pointerId)
  }
  populateTileInspector()
  drawAtlas()
})
atlasCanvas.addEventListener("pointermove", (event) => {
  if (tileDragStart && drawingTile) {
    tileDraft = boundedTileRect(tileDragStart, atlasPoint(event), atlasCanvas.width, atlasCanvas.height)
    drawAtlas()
    return
  }
  if (!moveStart || !moveSource || !movingTile) return
  const point = atlasPoint(event)
  const source = moveTileRect(moveSource, point.x - moveStart.x, point.y - moveStart.y, atlasCanvas.width, atlasCanvas.height)
  const dx = source[0] - moveSource[0]
  const dy = source[1] - moveSource[1]
  movingTile = { ...movingTile, source, ...(movingTile.inner ? { inner: moveTileRect(movingTile.inner, dx, dy, atlasCanvas.width, atlasCanvas.height) } : {}) }
  drawAtlas()
})
atlasCanvas.addEventListener("pointerup", (event) => {
  if (tileDragStart && drawingTile) {
    tileDraft = boundedTileRect(tileDragStart, atlasPoint(event), atlasCanvas.width, atlasCanvas.height)
    const source = tileDraft
    setDrawingTile(false)
    if (source) commitTile({ index: nextTileIndex(tileDocument), source })
    return
  }
  if (movingTile) {
    const moved = movingTile
    movingTile = undefined
    moveStart = undefined
    moveSource = undefined
    commitTile(moved)
  }
})
atlasCanvas.addEventListener("pointercancel", () => {
  setDrawingTile(false)
  movingTile = undefined
  moveStart = undefined
  moveSource = undefined
  drawAtlas()
})
for (const field of [...tileSourceFields, ...tileInnerFields]) {
  field.addEventListener("change", updateSelectedTile)
}
skinState.addEventListener("change", () => {
  const state = skinState.value ? Number(skinState.value) : undefined
  applySkinState(state, state ? `皮肤状态：S${state}` : "皮肤状态：默认")
})
panelScaleButton.addEventListener("click", openPanelCopyDialog)
panelCopySource.addEventListener("change", () => {
  panelTargetFile.value = panelCopySource.value.split("/").pop() ?? "panel.ini"
  panelTargetWidth.value = ""
  panelTargetHeight.value = ""
  updatePanelCopyForm()
})
for (const field of [panelTargetTheme, panelTargetOrientation, panelScaleEnabled]) {
  field.addEventListener("change", updatePanelCopyForm)
}
panelTargetExisting.addEventListener("change", () => {
  if (panelTargetExisting.value) panelTargetFile.value = panelTargetExisting.value
  updatePanelCopyForm()
})
panelTargetFile.addEventListener("input", updatePanelCopyForm)
panelScaleForm.addEventListener("submit", (event) => {
  if ((event.submitter as HTMLButtonElement | null)?.value !== "copy") return
  event.preventDefault()
  panelScaleDialog.close()
  void runFileOperation("复制面板", copyPanel)
})
candidateArea.addEventListener("click", () => {
  if (!isEditing()) return
  const path = toolbarStrip.dataset.path
  if (path) selectFile(path)
})
function fallbackBackgroundStyleID(button: HTMLButtonElement): string | undefined {
  // Key style-reference buttons fall back to the selected keys' background style.
  if (button.dataset.stylePreview) {
    const shared = commonSelectedStyle("BACK_STYLE")?.split(",")[0]?.trim()
    if (shared) return shared
    const sections = layoutDocument ? backgroundStyleSections(layoutDocument, selectedKeySections) : []
    return sections[0]?.replace(/^STYLE/, "")
  }
  // Toolbar/field previews pair with the same section's background field
  // (FORE_STYLE ↔ BACK_STYLE, FIRST_FORE ↔ FIRST_BACK, ICON*.FORE_STYLE ↔ ICON*.BACK_STYLE),
  // falling back to the panel background style when the pair is not configured.
  const [scope, fieldName] = (button.dataset.stylePreviewField ?? "").split(":")
  if (scope !== "toolbar") return
  const [section, key] = fieldName.split(".")
  const pair = key
    ? `${section}.${key.replace(/FORE_STYLE$/, "BACK_STYLE")}`
    : fieldName.replace(/FORE_STYLE$/, "BACK_STYLE")
  const candidates = pair === fieldName ? [pair] : [pair, "BACK_STYLE"]
  for (const name of candidates) {
    const field = toolbarFields.find((item) => item.dataset.toolbarField === name)
    const styleID = field?.value.split(",")[0]?.trim()
    if (styleID) return styleID
  }
}

for (const button of stylePreviewButtons) {
  button.addEventListener("click", async (event) => {
    if (event.metaKey || event.ctrlKey) {
      const path = button.dataset.path
      if (!path) return
      selectFile(path)
      revealSourceFile(path)
      return
    }
    const visuals = processedPreviewVisuals.get(button) ?? []
    const styleIDs = processedPreviewStyleIDs.get(button) ?? []
    if (!visuals.length) return
    const [sourceName, state] = (button.dataset.stylePreview ?? "back:normal").split(":")
    const foreground = sourceName === "fore" || button.hasAttribute("data-preview-foreground")
    const property = state === "highlighted" ? "HL_IMG" : "NM_IMG"
    const visual = visuals.find((item) => item.imagePath)
    if (visual?.imagePath) {
      const target = styleWriteTarget(
        foreground ? "FORE_STYLE" : "BACK_STYLE",
        property,
        foreground ? styleIDs : styleIDs.slice(0, 1),
      )
      openImageSlicePicker(visual.imagePath, target, visual.source)
      return
    }
    // Foreground styles without an image (e.g. text-only styles) fall back to
    // the paired background style reference so the click still opens a slice
    // picker, same as clicking the background style reference.
    const backgroundID = fallbackBackgroundStyleID(button)
    if (backgroundID) {
      const backVisual = await visualResolver()?.resolve(backgroundID, state === "highlighted").catch(() => undefined)
      if (backVisual?.imagePath) {
        const target = styleWriteTarget("BACK_STYLE", property, [backgroundID])
        openImageSlicePicker(backVisual.imagePath, target, backVisual.source)
        return
      }
    }
    drawVisualPreview(styleImagePreview, visuals, foreground)
    styleImagePicker.hidden = true
    styleImagePreview.hidden = false
    styleImageResourceOpen.hidden = true
    closeStyleImageResourcePicker()
    styleImageTitle.textContent = "图片预览"
    styleImageSubtitle.textContent = ""
    styleImageDialog.hidden = false
  })
}
styleImagePickerCanvas.addEventListener("click", (event) => {
  if (!isEditing()) return
  if (!pickerImage || !pickerTarget || !pickerSlices.length) return
  const bounds = styleImagePickerCanvas.getBoundingClientRect()
  const point = {
    x: ((event.clientX - bounds.left) / bounds.width) * styleImagePickerCanvas.width,
    y: ((event.clientY - bounds.top) / bounds.height) * styleImagePickerCanvas.height,
  }
  const imagePoint = { x: (point.x - pickerOffset.x) / pickerScale, y: (point.y - pickerOffset.y) / pickerScale }
  const selected = tileSliceAt(pickerSlices, imagePoint)
  if (!selected) return
  pickerSelectedIndex = selected.index
  const name = pickerPath.split("/").pop()?.replace(/\.png$/i, "") ?? pickerPath
  updateSelectedImageReference(pickerTarget, `${name},${selected.index}`)
  drawImageSlicePicker()
})
styleImageClose.addEventListener("click", clearImageSlicePicker)
styleImageResourceOpen.addEventListener("click", openStyleImageResourcePicker)
styleImageResourceClose.addEventListener("click", closeStyleImageResourcePicker)
styleImageResourceSearch.addEventListener("input", renderStyleImageResources)

void listen<{ mode: "image" | "resource" }>("picker-window-ready", (event) => {
  const label = event.payload.mode === "image" ? "image-picker" : "resource-picker"
  const payload = event.payload.mode === "image" ? nativeImagePickerPayload : nativeResourcePickerPayload
  if (payload) void emitTo(label, `${label}-data`, payload)
})
void listen<{ index: number }>("image-picker-select", (event) => {
  if (!isEditing() || !pickerTarget) return
  const selected = pickerSlices.find((slice) => slice.index === event.payload.index)
  if (!selected) return
  pickerSelectedIndex = selected.index
  const name = pickerPath.split("/").pop()?.replace(/\.png$/i, "") ?? pickerPath
  updateSelectedImageReference(pickerTarget, `${name},${selected.index}`)
})
void listen("resource-picker-open", openResourcePickerWindow)
void listen<{ path: string }>("resource-picker-select", (event) => {
  if (pickerTarget) openImageSlicePicker(event.payload.path, pickerTarget)
})

// Inspector resize handle
{
  const MIN_W = 220
  const MAX_W = Math.max(700, window.innerWidth - 720)
  const DEFAULT_W = Math.max(420, Math.round(window.innerWidth * 0.28))
  const storageKey = "inspectorWidthV3"
  const stored = Number(localStorage.getItem(storageKey) || DEFAULT_W)
  const initialW = Math.max(MIN_W, Math.min(MAX_W, stored))
  document.documentElement.style.setProperty("--inspector-width", `${initialW}px`)

  let dragging = false
  let startX = 0
  let startW = initialW

  inspectorResizeHandle.addEventListener("pointerdown", (e) => {
    dragging = true
    startX = e.clientX
    startW = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--inspector-width") || String(DEFAULT_W), 10)
    inspectorResizeHandle.classList.add("dragging")
    inspectorResizeHandle.setPointerCapture(e.pointerId)
    e.preventDefault()
  })

  inspectorResizeHandle.addEventListener("pointermove", (e) => {
    if (!dragging) return
    const delta = startX - e.clientX
    const newW = Math.max(MIN_W, Math.min(MAX_W, startW + delta))
    document.documentElement.style.setProperty("--inspector-width", `${newW}px`)
  })

  inspectorResizeHandle.addEventListener("pointerup", () => {
    if (!dragging) return
    dragging = false
    inspectorResizeHandle.classList.remove("dragging")
    const w = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--inspector-width") || String(DEFAULT_W), 10)
    localStorage.setItem(storageKey, String(w))
  })
}

function nextStyleID(): string {
  const ids = availableStyleIDs().map(Number).filter(Number.isSafeInteger)
  return String((ids.length ? Math.max(...ids) : -1) + 1)
}

function showNewStyleError(text: string): void {
  newStyleError.textContent = text
  newStyleError.hidden = !text
}

styleAddButton.addEventListener("click", () => {
  if (!archive?.isText(styleConfigPath()) || !isEditing()) return
  newStyleID.value = nextStyleID()
  showNewStyleError("")
  newStyleDialog.showModal()
  newStyleID.select()
})

newStyleForm.addEventListener("submit", (event) => {
  if ((event.submitter as HTMLButtonElement | null)?.value !== "create") return
  event.preventDefault()
  const styleID = newStyleID.value.trim()
  if (!/^\d+$/.test(styleID)) {
    showNewStyleError("样式序号必须是非负整数")
    return
  }
  if (availableStyleIDs().includes(styleID)) {
    showNewStyleError(`STYLE${styleID} 已存在`)
    return
  }
  const path = styleConfigPath()
  if (!archive?.isText(path)) return
  const stylesDocument = IniDocument.parse(archive.getText(path))
  const before = stylesDocument.toString()
  stylesDocument.appendSection(`STYLE${styleID}`, [])
  const currentMax = Number(stylesDocument.get("GLOBAL", "STYLE_NUM") ?? -1)
  const numericID = Number(styleID)
  if (!Number.isFinite(currentMax) || numericID > currentMax) stylesDocument.set("GLOBAL", "STYLE_NUM", styleID)
  commitText(path, before, stylesDocument.toString())
  setSourceValue(stylesDocument.toString())
  newStyleDialog.close()
  selectedResourceGalleryPath = `STYLE${styleID}`
  selectStyleResource(styleID)
  refreshPreview()
  updateDirty()
})

// Resource image actions
let selectedResourceGalleryPath = ""

function updateResourceActionButtons(): void {
  const hasSelection = resourceInspectorMode === "image" && Boolean(selectedResourceGalleryPath)
  resourceDownloadButton.disabled = !hasSelection
  resourceDeleteButton.disabled = !hasSelection || !isEditing()
}

function selectGalleryItem(path: string, container: HTMLElement): void {
  selectedResourceGalleryPath = path
  for (const item of container.querySelectorAll<HTMLElement>(".resource-item")) {
    item.classList.toggle("selected", item.dataset.path === path)
  }
  updateResourceActionButtons()
}

resourceUploadButton.addEventListener("click", () => {
  if (!archive || !isEditing()) return
  resourceUploadInput.value = ""
  resourceUploadInput.click()
})

resourceUploadInput.addEventListener("change", () => {
  const file = resourceUploadInput.files?.[0]
  if (!file || !archive) return
  const reader = new FileReader()
  reader.onload = () => {
    if (!archive) return
    const bytes = new Uint8Array(reader.result as ArrayBuffer)
    const paths = resourceImagePaths(archive.names(), theme.value, orientation.value)
    const base = paths[0]?.split("/").slice(0, -1).join("/") ?? `${theme.value}/skin/${orientation.value}/res`
    const targetPath = `${base}/${file.name}`
    const before = archive.getBytes(targetPath)
    if (before) {
      if (!window.confirm(`图片 ${file.name} 已存在，是否替换？`)) return
    }
    commitBytes(targetPath, before ?? new Uint8Array(0), bytes)
    renderResourceInspector()
    updateDirty()
    selectedResourceGalleryPath = targetPath
    updateResourceActionButtons()
  }
  reader.readAsArrayBuffer(file)
})

resourceDownloadButton.addEventListener("click", () => {
  if (!archive || !selectedResourceGalleryPath) return
  const bytes = archive.getBytes(selectedResourceGalleryPath)
  if (!bytes) return
  const url = URL.createObjectURL(new Blob([bytes], { type: "image/png" }))
  const a = document.createElement("a")
  a.href = url
  a.download = selectedResourceGalleryPath.split("/").pop() ?? "image.png"
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
})

resourceDeleteButton.addEventListener("click", () => {
  if (!archive || !selectedResourceGalleryPath || !isEditing()) return
  const name = selectedResourceGalleryPath.split("/").pop() ?? selectedResourceGalleryPath
  if (!window.confirm(`确定要删除图片 ${name} 吗？此操作可撤销。`)) return
  const before = archive.getBytes(selectedResourceGalleryPath)
  if (!before) return
  commitBytes(selectedResourceGalleryPath, before, new Uint8Array(0))
  selectedResourceGalleryPath = ""
  updateResourceActionButtons()
  renderResourceInspector()
  updateDirty()
})

// Patch renderResourceInspector to use single-click select, double-click open
const _origRenderResourceInspector = renderResourceInspector
;(window as any).__resourceGalleryClickHandler = (path: string, container: HTMLElement) => {
  selectGalleryItem(path, container)
}
;(window as any).__resourceGalleryDblClickHandler = (path: string) => {
  selectResourceImage(path)
}
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
    if (resourceConfigActive && !isTextEditingTarget(event.target)) {
      if (selectedTileIndex === undefined || !isEditing()) return
      event.preventDefault()
      const distance = event.shiftKey ? 10 : 1
      moveSelectedTile(direction[0] * distance, direction[1] * distance)
      return
    }
    if (!isEditing() || !selectedKeySections.length || isTextEditingTarget(event.target)) return
    event.preventDefault()
    const distance = event.shiftKey ? 10 : 1
    moveSelectedKeys(direction[0] * distance, direction[1] * distance)
    return
  }
  if (resourceConfigActive && !isTextEditingTarget(event.target)) {
    if ((event.key === "Delete" || event.key === "Backspace") && isEditing()) {
      event.preventDefault()
      deleteSelectedTile()
      return
    }
    if (event.metaKey || event.ctrlKey) {
      if (event.key.toLowerCase() === "c") {
        const existing = slices.find((slice) => slice.index === selectedTileIndex)
        if (existing) {
          copiedTile = duplicateTileSlice(existing, existing.index)
          event.preventDefault()
        }
        return
      }
      if (event.key.toLowerCase() === "v" && copiedTile && isEditing()) {
        event.preventDefault()
        const index = nextTileIndex(tileDocument)
        commitTile({ ...copiedTile, index })
        selectedTileIndex = index
        populateTileInspector()
        drawAtlas()
        return
      }
    }
  }
  if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z") return
  event.preventDefault()
  if (event.shiftKey) redo()
  else undo()
})
window.addEventListener("pointerdown", (event) => {
  for (const menu of toolbarMenus) {
    if (menu.open && !menu.contains(event.target as Node)) menu.open = false
  }
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
  let movingDebounce: ReturnType<typeof setTimeout> | undefined
  void getCurrentWindow().onMoved(() => {
    clearTimeout(movingDebounce)
    clearTimeout(fitCanvasDebounce)
    movingDebounce = setTimeout(() => { fitCanvasPreview() }, 300)
  })
  let destroyingWindow = false
  void getCurrentWindow().onCloseRequested(async (event) => {
    if (destroyingWindow) return
    event.preventDefault()
    const shouldClose = await prepareDocumentReplacement()
    if (!shouldClose) return
    destroyingWindow = true
    void invoke("quit_app")
  })
  void listen<{ paths?: string[] } | string[]>("tauri://drag-drop", (event) => {
    const paths = Array.isArray(event.payload) ? event.payload : event.payload.paths ?? []
    const path = paths.find(isSupportedSkinPath)
    if (path) void runFileOperation("打开", () => loadDroppedPath(path))
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
void refreshUpdateStatus()
