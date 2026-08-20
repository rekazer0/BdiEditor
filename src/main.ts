import { Channel, invoke } from "@tauri-apps/api/core"
import { emitTo, listen } from "@tauri-apps/api/event"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { WebviewWindow } from "@tauri-apps/api/webviewWindow"
import { getCurrentWebview } from "@tauri-apps/api/webview"
import { message, open, save } from "@tauri-apps/plugin-dialog"
import { readFile, watch, writeFile, type UnwatchFn } from "@tauri-apps/plugin-fs"
import "./style.css"
import {
  DEFAULT_BDA_PANEL_HEIGHT,
  DEFAULT_BDA_PANEL_WIDTH,
  DEFAULT_CANDIDATE_HEIGHT,
  DEFAULT_PANEL_HEIGHT,
  DEFAULT_PANEL_WIDTH,
} from "./keyboard.ts"
import {
  actionDescription,
  isConfiguredSymbolLayout,
  knownFunctionCodes,
  previewPageTransition,
  previewStateTransitionFromAction,
  previewStateFromAction,
  previewToggleStateFromAction,
  skinStateLabel,
  shouldSuggestActionCodes,
} from "./actions.ts"
import {
  AtlasResolver,
  canvasFontFamily,
  drawVisualSource,
  isTransparentColor,
  type TextVisual,
  type Visual,
  type VisualResolver,
} from "./atlas.ts"
import {
  deviceSpec,
  keyboardPreviewGeometry,
  showsKeyboardAccessories,
} from "./devices.ts"
import {
  resolveCandidateInputStyle,
  resolveCandidateTextVisuals,
} from "./candidate-style.ts"
import {
  exportFormatFromPath,
  exportName,
  type ExportFormat,
} from "./export.ts"
import { inspectorGroupPositionPercent } from "./inspector-groups.ts"
import {
  BdaResolver,
  bdaAppearancePath,
  bdaColorHex,
  bdaConfigPath,
  bdaLayoutDocument,
  bdaLayoutNames,
  bdaPanelKeyName,
  bdaStyleID,
  bdaStyleRef,
  decodeBdaAnimation,
  decodeBdaAppearance,
  decodeBdaSoundConfig,
  describeBdaConfig,
  updateBdaAnimationFrame,
  updateBdaStyle,
  type BdaAppearance,
  type BdaStyleRef,
} from "./bda.ts"
import { convertBdaArchive } from "./bda-convert.ts"
import { IniDocument } from "./ini.ts"
import { adaptIos26KeyboardLayout, adaptIos26Variant } from "./ios26.ts"
import { highlightIni } from "./highlight.ts"
import { releaseImagePreviewURL, replaceImagePreviewURL } from "./image-preview.ts"
import {
  applyCandidateImageStyles,
  applyLayoutImageRects,
  applyLayoutImageStyles,
  layoutKeyRects,
  matchLayoutKeysToCells,
  planLayoutImage,
  planLayoutImageSlices,
  validateKeyRects,
  type LayoutImagePlan,
  type LayoutImageTarget,
} from "./layout-image.ts"
import { alphaMask, detectGridCells } from "./layout-scan.ts"
import {
  backgroundStyleSections,
  keyboardConfig,
  resolvePanelConfig,
  setKeyboardHeight,
  setStyleField,
} from "./keyboard.ts"
import {
  applyLayoutAction as transformLayout,
  isListCell,
  listCellIndex,
  listCellRect,
  listCellValue,
  mergeLayoutRects,
  moveRects,
  setExactGap,
  setListCellValue,
  type LayoutAction,
  type LayoutRect,
} from "./layout.ts"
import { shouldClearMixedInput } from "./mixed-input.ts"
import { installNumberInputWheel } from "./number-input-wheel.ts"
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
  variantCopyPaths,
} from "./panel-tools.ts"
import {
  Preview,
  parseLegacyAnimation,
  previewContentVerticalBounds,
  previewItems,
  previewStateImpact,
  type PreviewEvent,
} from "./preview.ts"
import { firstExistingPath, resourceImagePaths } from "./resources.ts"
import {
  candidatePreview,
  deleteBackward,
  deleteForward,
  insertText,
  moveCaret,
  moveCaretVertical,
} from "./simulation.ts"
import { SkinArchive } from "./skin.ts"
import { resolveSourceArchivePath } from "./source-tree.ts"
import {
  SOUND_ACCEPT,
  decodeAiffPcm,
  isSoundPath,
  soundFilenameForKey,
  soundMimeType,
  soundPathForFilename,
  soundResourcePaths,
  soundStyleForKey,
} from "./sounds.ts"
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

document.documentElement.classList.toggle("macos", isTauri() && navigator.userAgent.includes("Macintosh"))
document.documentElement.classList.toggle("windows", isTauri() && navigator.userAgent.includes("Windows"))
installNumberInputWheel()

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!
const newButton = $("#new") as HTMLButtonElement
const newProjectDialog = $("#new-project-dialog") as HTMLDialogElement
const newProjectForm = $("#new-project-form") as HTMLFormElement
const openButton = $("#open") as HTMLButtonElement
const saveButton = $("#save") as HTMLButtonElement
const mobileShareButton = $("#mobile-share") as HTMLButtonElement
const undoButton = $("#undo") as HTMLButtonElement
const redoButton = $("#redo") as HTMLButtonElement
const toolbarMore = $(".toolbar-more") as HTMLDetailsElement
const toolbarMenus = Array.from(document.querySelectorAll<HTMLDetailsElement>(".toolbar-more"))
const mobileCommandMenu = $(".mobile-command-menu") as HTMLDetailsElement
const mobileUndoButton = $("#mobile-undo") as HTMLButtonElement
const mobileRedoButton = $("#mobile-redo") as HTMLButtonElement
const mobileCommandButtons = Array.from(
  mobileCommandMenu.querySelectorAll<HTMLButtonElement>("[data-mobile-command], [data-mobile-export-format]"),
)
const mobileShareMenuLabel = mobileCommandMenu.querySelector<HTMLElement>(
  '[data-mobile-command="mobile-share"] span:last-child',
)!
const appDialogButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-app-dialog]"))
const settingsDialog = $("#settings-dialog") as HTMLDialogElement
const aboutDialog = $("#about-dialog") as HTMLDialogElement
const copyQqGroupButton = $("#copy-qq-group") as HTMLButtonElement
const aboutUpdate = $("#about-update")
const checkUpdateButton = $("#check-update") as HTMLButtonElement
const updateStatus = $("#update-status")
const downloadUpdate = $("#download-update") as HTMLAnchorElement
const defaultDevice = $("#default-device") as HTMLSelectElement
const canvasBackground = $("#canvas-background") as HTMLSelectElement
const appTheme = $("#app-theme") as HTMLSelectElement
const sourceFontSize = $("#source-font-size") as HTMLInputElement
const windowMaterial = $("#window-material") as HTMLInputElement
const sidebarViewVisible = $("#sidebar-view-visible") as HTMLInputElement
const inspectorTabsVisible = $("#inspector-tabs-visible") as HTMLInputElement
const inspectorGroupedDisplay = $("#inspector-grouped-display") as HTMLInputElement
const mobilePreviewPosition = $("#mobile-preview-position") as HTMLSelectElement
const sourceDirectoryEnabledSetting = $("#source-directory-enabled-setting")
const sourceDirectoryEnabled = $("#source-directory-enabled") as HTMLInputElement
const sourceDirectory = $("#source-directory") as HTMLInputElement
const chooseSourceDirectory = $("#choose-source-directory") as HTMLButtonElement
const resetSourceDirectory = $("#reset-source-directory") as HTMLButtonElement
const sourceDirectoryStatus = $("#source-directory-status")
const mobilePaneButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-mobile-pane]"))
const mobileSplitHandle = $("#mobile-split-handle") as HTMLButtonElement
const mobilePortraitQuery = matchMedia("(max-width: 760px) and (orientation: portrait)")
const exportButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>("[data-export-format]"),
)
const source = $("#source") as HTMLTextAreaElement
const sourceEditor = $("#source-editor")
const sourceHighlight = $("#source-highlight code")
const sourceLineNumbers = $("#source-line-numbers")
const sourceSearch = $("#source-search") as HTMLInputElement
const sourceSearchCount = $("#source-search-count")
const canvasWrap = $(".canvas-wrap")
const previewCanvas = $("#preview") as HTMLCanvasElement
const previewPanelViewport = $("#panel-viewport")
const mainWorkspace = $("main")
const sidebarPane = $("aside.sidebar")
const inspectorPane = $("section.source")
const sourceHeading = $(".source-heading")
const mobileInspectorSelection = $("#mobile-inspector-selection")
const emptyOpenButton = $("#empty-open") as HTMLButtonElement
const asset = $("#asset")
const assetImage = $("#asset-image") as HTMLImageElement
const replaceAssetButton = $("#replace-asset") as HTMLButtonElement
const assetBackButton = $("#asset-back") as HTMLButtonElement
const files = $("#files")
const sourceFileToolbar = $("#source-file-toolbar")
const sourceUploadButton = $("#source-upload") as HTMLButtonElement
const sourceDownloadButton = $("#source-download") as HTMLButtonElement
const sourceCopyButton = $("#source-copy") as HTMLButtonElement
const sourcePasteButton = $("#source-paste") as HTMLButtonElement
const sourceMoveButton = $("#source-move") as HTMLButtonElement
const sourceDeleteButton = $("#source-delete") as HTMLButtonElement
const sourceUploadInput = $("#source-upload-input") as HTMLInputElement
const sidebarViewButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-sidebar-view]"))
const sidebarViewControl = $(".sidebar-view-control")
const sidebarViewHeading = sidebarViewControl.closest<HTMLElement>(".pane-heading")!
const documentName = $("#document-name")
const sourceName = $("#source-name")
const dirty = $("#dirty")
const eventLog = $("#event-log")
const panelStatus = $("#panel-status")
const previewZoomOut = $("#preview-zoom-out") as HTMLButtonElement
const previewZoomFit = $("#preview-zoom-fit") as HTMLButtonElement
const previewZoomIn = $("#preview-zoom-in") as HTMLButtonElement
const panelScaleButton = $("#panel-scale") as HTMLButtonElement
const adaptIos26Button = $("#adapt-ios26") as HTMLButtonElement
const ios26Dialog = $("#ios26-dialog") as HTMLDialogElement
const ios26Form = $("#ios26-form") as HTMLFormElement
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
const mobileInspectorGroups = $("#mobile-inspector-groups")
const inspectorGroupsDrag = $("#inspector-groups-drag") as HTMLButtonElement
const keyInspectorTitle = $(".key-inspector-title")
const keyToolbar = $(".key-toolbar")
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
const keyModeButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-key-mode]"))
const keyActionButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-key-action]"))
const actionMeaningNodes = Array.from(
  document.querySelectorAll<HTMLElement>("[data-action-meaning]"),
)
const baiduActionCodes = $("#baidu-action-codes") as HTMLDataListElement
const actionFieldNames = new Set(actionMeaningNodes.map((node) => node.dataset.actionMeaning ?? ""))
const inspectorTabButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>("[data-inspector-tab]"),
)
const inspectorTabs = $(".inspector-tabs")
const browserOpen = $("#browser-open") as HTMLInputElement
const imageOpen = $("#image-open") as HTMLInputElement
const theme = $("#theme") as HTMLSelectElement
const orientation = $("#orientation") as HTMLSelectElement & { value: "port" | "land" }
const layout = $("#layout") as HTMLSelectElement
const mode = $("#mode") as HTMLSelectElement
const device = $("#device") as HTMLSelectElement
const toggleGuides = $("#toggle-guides") as HTMLButtonElement
const mobileToggleGuides = $("#mobile-toggle-guides") as HTMLButtonElement
const skinStateControl = $("#skin-state-control")
const skinState = $("#skin-state") as HTMLSelectElement
const skinStateValue = $(".skin-state-value")
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
const resourceSearchControl = resourceSearch.closest("label")!
const resourceCategory = $("#resource-category") as HTMLSelectElement
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
const replaceLayoutImageButton = $("#replace-layout-image") as HTMLButtonElement
const layoutImageDialog = $("#layout-image-dialog") as HTMLDialogElement
const layoutImageForm = $("#layout-image-form") as HTMLFormElement
const layoutImageFile = $("#layout-image-file") as HTMLButtonElement
const layoutImagePreview = $("#layout-image-preview") as HTMLImageElement
const layoutImageFileLabel = $("#layout-image-file-label") as HTMLElement
const layoutImageSize = $("#layout-image-size") as HTMLElement
const layoutImageLayout = $("#layout-image-layout") as HTMLElement
const layoutImageScope = $("#layout-image-scope") as HTMLElement
const layoutImageError = $("#layout-image-error") as HTMLElement
const layoutImageApply = $("#layout-image-apply") as HTMLButtonElement
const layoutImageTargetInputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[name="layout-image-target"]'))
const layoutImageOpen = $("#layout-image-open") as HTMLInputElement
const layoutImageConfigFieldset = $("#layout-image-config") as HTMLFieldSetElement
const layoutImageConfigDesc = $("#layout-image-config-desc") as HTMLElement
const layoutImageConfigButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-layout-image-config]"))
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
const candidateBackgroundCanvas = $("#candidate-background") as HTMLCanvasElement
const toolbarCanvas = $("#toolbar-preview") as HTMLCanvasElement
const candidateComposition = $("#candidate-composition")
const candidateInput = $("#candidate-input")
const candidateWords = $("#candidate-words")
let simulatedComposition = ""
let lastSimulationLanguage: "zh" | "en" | undefined
const modeChoiceButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-mode-choice]"))
const themeChoiceButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-theme-choice]"))
const orientationChoiceButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-orientation-choice]"))
const mobileChoiceButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-mobile-choice]"))
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
let sourceWorkspacePath = ""
let sourceWorkspacePrefix = ""
let sourceWorkspacePendingArchive: SkinArchive | undefined
const LAST_SOURCE_WORKSPACE_KEY = "last-source-workspace"
let stopSourceWatch: UnwatchFn | undefined
let sourceAutosaveTimer: number | undefined
let sourceAutosaveQueue = Promise.resolve()
const pendingSourcePaths = new Set<string>()
const pendingSourceWatchPaths = new Set<string>()
let sourceWatchTimer: number | undefined
let selectedPath = ""
let selectedDocument: IniDocument | undefined
let layoutPath = ""
let layoutDocument: IniDocument | undefined
let selectedKeySections: string[] = []
let unsavedNew = false
let assetURL = ""
let assetReturnPath = ""
let inspectorTab: "properties" | "source" = "properties"
let sourceSearchIndex = -1
type Change =
  | { kind: "text"; path: string; before: string; after: string }
  | { kind: "bytes"; path: string; before?: Uint8Array; after?: Uint8Array }
  | { kind: "batch"; changes: Change[] }
type LayoutImageConfig = "none" | "image-follows-layout" | "layout-follows-image"
let undoStack: Change[] = []
let redoStack: Change[] = []
let layoutImageBytes: Uint8Array | undefined
let layoutImageWidth = 0
let layoutImageHeight = 0
let layoutImageTarget: LayoutImageTarget | undefined
let layoutImageConfig: LayoutImageConfig = "none"
let layoutImageObjectURL = ""
let layoutImageHighlight = false
let fileOperationRunning = false
let firstCandidateTextVisual: TextVisual | undefined
let candidateTextWidth = DEFAULT_PANEL_WIDTH
let canvasLogicalSize: {
  width: number
  height: number
  panelHeight: number
  panelVisibleHeight: number
} | undefined
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
let selectedFileButton: HTMLElement | undefined
type SourceTransfer = {
  mode: "copy" | "move"
  sourcePath: string
  folder: boolean
  files: { path: string; source: string; bytes: Uint8Array }[]
}
let sourceTransfer: SourceTransfer | undefined
let sidebarView: "overview" | "source" = "overview"
let guidesVisible = false
let previewReturnName = "py_9.ini"
let resourceConfigActive = false
let resourceInspectorMode: "image" | "style" | "sound" = "image"
let selectedStyleID = ""
let selectedSoundID = ""
let styleReturnPath = ""
let styleReturnSelection: string[] = []
let styleReturnScrollTop = 0
let styleReturnInspectorGroup = ""
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
let keyMode: "select" | "move" = "select"
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

const deviceFrameProperties = [
  "--device-screen-inset-x",
  "--device-screen-inset-y",
  "--device-screen-radius",
  "--device-body-radius",
  "--device-island-width",
  "--device-island-height",
  "--device-island-offset",
] as const

const REFERENCE_PHONE_WIDTH_SCALE = 1

const preview = new Preview(
  $("#preview") as HTMLCanvasElement,
  (event) => {
    handlePreviewEvent(event)
  },
  (sections) => {
    if (selectedPath !== layoutPath) selectFile(layoutPath, "overview")
    selectedKeySections = sections
    if (sections.length && mobilePortraitQuery.matches) setMobilePane("inspector")
    populateKeyInspector()
    updateSourceHighlight()
    scrollSelectedSource()
  },
  false,
  (sections, deltaX, deltaY) => moveSelectedKeys(deltaX, deltaY, sections),
)

const toolbarPreview = new Preview(toolbarCanvas, () => {}, () => {}, true)
const candidateBackgroundPreview = new Preview(candidateBackgroundCanvas, () => {}, () => {})
let activeKeyboardGeometry: {
  panelWidth: number
  panelHeight: number
  candidateHeight: number
  candidateInputHeight: number
} | undefined

function applySkinState(state?: number, message?: string): void {
  skinState.value = state === undefined ? "" : String(state)
  skinStateValue.textContent = state === undefined ? "默认" : `S${state}`
  preview.setSkinState(state)
  toolbarPreview.setSkinState(state)
  if (message) eventLog.textContent = message
}

function skinStatePreviewMessage(state: number): string {
  const impact = previewStateImpact(layoutDocument, state)
  if (impact.resolved) return `皮肤状态：S${state}`
  if (impact.mapped) return `皮肤状态：S${state} · 当前布局的状态定义缺少 TIP 内容`
  if (state === 4) return `皮肤状态：S4 · 已进入输入编码预览，当前布局未配置按键换层`
  return `皮肤状态：S${state} · 当前布局未配置按键换层`
}

function activateSkinState(state?: number, message?: string): void {
  applySkinState(state, message ?? (state ? skinStatePreviewMessage(state) : "皮肤状态：默认"))
  refreshSimulationPreview()
}

let keySoundAudio: HTMLAudioElement | undefined
let keySoundURL = ""
let keySoundPath = ""
let keySoundContext: AudioContext | undefined
let keySoundSource: AudioBufferSourceNode | undefined
const keySoundBuffers = new Map<string, AudioBuffer>()

function releaseKeySound(): void {
  keySoundAudio?.pause()
  keySoundAudio = undefined
  try {
    keySoundSource?.stop()
  } catch {}
  keySoundSource = undefined
  keySoundPath = ""
  if (keySoundURL) URL.revokeObjectURL(keySoundURL)
  keySoundURL = ""
}

async function playDecodedSound(path: string, bytes: Uint8Array): Promise<void> {
  keySoundContext ??= new AudioContext()
  if (keySoundContext.state === "suspended") await keySoundContext.resume()
  let buffer = keySoundBuffers.get(path)
  if (!buffer) {
    try {
      buffer = await keySoundContext.decodeAudioData(bytes.slice().buffer)
    } catch (error) {
      if (/^FORM$/.test(new TextDecoder("ascii").decode(bytes.subarray(0, 4)))) {
        const decoded = decodeAiffPcm(bytes)
        buffer = keySoundContext.createBuffer(decoded.channelData.length, decoded.samplesDecoded, decoded.sampleRate)
        decoded.channelData.forEach((channel, index) => buffer!.copyToChannel(channel, index))
      } else {
        const ogg = /^OggS$/.test(new TextDecoder("ascii").decode(bytes.subarray(0, 4))) || /\.ogg$/i.test(path)
        if (!ogg) throw error
        const { OggVorbisDecoder } = await import("@wasm-audio-decoders/ogg-vorbis")
        const decoder = new OggVorbisDecoder()
        await decoder.ready
        const decoded = await decoder.decodeFile(bytes)
        decoder.free()
        if (!decoded.samplesDecoded || !decoded.channelData.length) throw new Error("OGG 文件没有可播放的音频")
        buffer = keySoundContext.createBuffer(decoded.channelData.length, decoded.samplesDecoded, decoded.sampleRate)
        decoded.channelData.forEach((channel, index) => buffer!.copyToChannel(channel, index))
      }
      if (!buffer) {
        throw error
      }
    }
    keySoundBuffers.set(path, buffer)
  }
  keySoundSource = keySoundContext.createBufferSource()
  keySoundSource.buffer = buffer
  keySoundSource.connect(keySoundContext.destination)
  keySoundSource.start()
}

function playSoundPath(path: string): void {
  const bytes = archive?.getBytes(path)
  if (!bytes) return
  if (path !== keySoundPath) {
    releaseKeySound()
    const copy = bytes.slice()
    keySoundURL = URL.createObjectURL(new Blob([copy.buffer], { type: soundMimeType(path) }))
    keySoundPath = path
    keySoundAudio = new Audio(keySoundURL)
    keySoundAudio.preload = "auto"
  }
  if (!keySoundAudio) return
  keySoundAudio.currentTime = 0
  void keySoundAudio.play().catch(async (error: unknown) => {
    if (error instanceof DOMException && error.name === "NotSupportedError") {
      try {
        await playDecodedSound(path, bytes)
        return
      } catch (fallbackError) {
        error = fallbackError
      }
    }
    const reason = error instanceof Error ? `（${error.name}：${error.message}）` : ""
    eventLog.textContent = `无法播放按键音效：${path.split("/").pop() ?? path}${reason}`
  })
}

function keySoundForEvent(event: PreviewEvent): string | undefined {
  if (!archive || !layoutDocument) return
  const names = archive.names()
  if (archive.format === "bda") {
    const path = bdaConfigPath(archive, theme.value, orientation.value, "sound")
    const bytes = path ? archive.getBytes(path) : undefined
    if (!bytes) return
    const sounds = decodeBdaSoundConfig(bytes).keySounds
    const resource = sounds.get(bdaPanelKeyName(event.code))
      ?? sounds.get(event.section)
      ?? [...sounds.values()][0]
    return resource?.resourceID
      ? soundPathForFilename(names, theme.value, orientation.value, resource.resourceID)
      : undefined
  }
  const stylesPath = styleConfigPath()
  if (!archive.isText(stylesPath)) return
  const generalPath = genConfigPath()
  const general = archive.isText(generalPath) ? IniDocument.parse(archive.getText(generalPath)) : undefined
  const filename = soundFilenameForKey(
    layoutDocument,
    event.section,
    IniDocument.parse(archive.getText(stylesPath)),
    general,
  )
  return filename ? soundPathForFilename(names, theme.value, orientation.value, filename) : undefined
}

function handlePreviewEvent(event: PreviewEvent): void {
  const soundPath = keySoundForEvent(event)
  if (soundPath) playSoundPath(soundPath)
  eventLog.textContent =
    `${event.section} · ${event.direction.toUpperCase()} · ${event.code || "未配置"}`
  if (event.direction === "hold" && event.holdSymbols) {
    eventLog.textContent = `${event.section} · HOLD · 长按符号候选：${event.holdSymbols}`
    return
  }
  const code = event.code.trim()
  const state = previewStateFromAction(code)
  if (state !== undefined) {
    activateSkinState(
      state || undefined,
      `${eventLog.textContent} → ${state ? skinStatePreviewMessage(state) : "皮肤状态：默认"}`,
    )
    return
  }
  const toggleState = previewToggleStateFromAction(code)
  if (toggleState !== undefined) {
    const currentState = skinState.value ? Number(skinState.value) : undefined
    const nextState = currentState === toggleState ? undefined : toggleState
    activateSkinState(
      nextState,
      `${eventLog.textContent} → ${nextState ? skinStatePreviewMessage(nextState) : "皮肤状态：默认"}`,
    )
    return
  }
  const currentState = skinState.value ? Number(skinState.value) : undefined
  const transitionedState = previewStateTransitionFromAction(code, currentState)
  if (transitionedState !== undefined) {
    activateSkinState(
      transitionedState === null ? undefined : transitionedState,
      `${eventLog.textContent} → ${transitionedState === null ? "皮肤状态：默认" : skinStatePreviewMessage(transitionedState)}`,
    )
    return
  }
  const currentName = layoutPath.split("/").pop() ?? ""
  const currentDirectory = layoutPath.slice(0, layoutPath.lastIndexOf("/") + 1)
  const availableNames = archive
    ? archive.format === "bda"
      ? bdaAvailableLayoutPaths().map((path) => path.slice(path.lastIndexOf("/") + 1))
      : archive.names()
        .filter((path) => path.startsWith(currentDirectory) && path.slice(currentDirectory.length).includes("/") === false)
        .map((path) => path.slice(currentDirectory.length))
    : undefined
  const general = archive && archive.isText(genConfigPath())
    ? IniDocument.parse(archive.getText(genConfigPath()))
    : undefined
  const symbolLayout = general?.get("MORE", "SYM_LAYOUT")?.trim()?.replace(/\.ini$/i, "") || "symbol"
  const transition = previewPageTransition(code, currentName, previewReturnName, availableNames, symbolLayout)
  const target = transition.target
  if (target) {
    const path = currentConfigPath(target)
    if (archive?.isText(path) || isBdaLayoutPath(path)) {
      previewReturnName = transition.returnName
      if (code === "F15" || code === "F16") simulatedComposition = ""
      if (skinState.value === "38") activateSkinState(undefined)
      selectFile(path, "overview")
      eventLog.textContent += ` → 已切换预览到 ${target}`
      return
    }
  }
  if (code === "F36") {
    if (simulatedComposition) {
      simulatedComposition = Array.from(simulatedComposition).slice(0, -1).join("")
      refreshSimulationPreview()
      return
    }
    const result = deleteBackward(
      simulatedOutput.value,
      simulatedOutput.selectionStart ?? simulatedOutput.value.length,
      simulatedOutput.selectionEnd ?? simulatedOutput.value.length,
    )
    simulatedOutput.value = result.value
    simulatedOutput.focus()
    simulatedOutput.setSelectionRange(result.caret, result.caret)
    refreshSimulationPreview()
    return
  }
  if (code === "F37") {
    const result = deleteForward(
      simulatedOutput.value,
      simulatedOutput.selectionStart ?? simulatedOutput.value.length,
      simulatedOutput.selectionEnd ?? simulatedOutput.value.length,
    )
    simulatedOutput.value = result.value
    simulatedOutput.focus()
    simulatedOutput.setSelectionRange(result.caret, result.caret)
    refreshSimulationPreview()
    return
  }
  if (code === "F38") {
    if (simulatedComposition) {
      simulatedComposition = ""
      refreshSimulationPreview()
      return
    }
    insertSimulatedText(" ")
    return
  }
  if (code === "F39") {
    simulatedComposition = ""
    insertSimulatedText("\n")
    return
  }
  if (code === "F40") {
    simulatedComposition = ""
    refreshSimulationPreview()
    return
  }
  if (code === "F47") {
    simulatedOutput.focus()
    simulatedOutput.setSelectionRange(0, simulatedOutput.value.length)
    refreshSimulationPreview()
    return
  }
  if (code === "F49" || code === "F50" || code === "F51" || code === "F52") {
    const direction = code === "F49" || code === "F51" ? -1 : 1
    const result = code === "F49" || code === "F50"
      ? moveCaretVertical(
        simulatedOutput.value,
        simulatedOutput.selectionStart ?? simulatedOutput.value.length,
        simulatedOutput.selectionEnd ?? simulatedOutput.value.length,
        direction,
      )
      : moveCaret(
      simulatedOutput.value,
      simulatedOutput.selectionStart ?? simulatedOutput.value.length,
      simulatedOutput.selectionEnd ?? simulatedOutput.value.length,
      direction,
      )
    simulatedOutput.focus()
    simulatedOutput.setSelectionRange(result.start, result.end)
    refreshSimulationPreview()
    return
  }
  if (code === "F48") {
    clearSimulatedOutput()
    return
  }
  if (!code || /^(F\d+|S\d+|Z\+)/.test(code)) return
  if (simulationLanguage() === "zh" && /^[A-Za-z']$/.test(code)) {
    simulatedComposition += code.toLowerCase()
    refreshSimulationPreview()
    return
  }
  simulatedComposition = ""
  insertSimulatedText(code)
}

function clearSimulatedOutput(): void {
  simulatedComposition = ""
  simulatedOutput.value = ""
  simulatedOutput.setSelectionRange(0, 0)
  refreshSimulationPreview()
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
  const copyBySource = new Map<string, string>()
  for (const section of preview.expandSections(selectedKeySections)) {
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
    copyBySource.set(section, target)
  }
  const text = layoutDocument.toString()
  commitText(layoutPath, before, text)
  if (selectedPath === layoutPath) setSourceValue(text)
  selectedKeySections = selectedKeySections.flatMap((section) => {
    const copy = copyBySource.get(section)
    return copy ? [copy] : []
  })
  preview.setDocument(layoutDocument)
  preview.setSelected(copies)
  populateKeyInspector()
  updateSourceHighlight()
  updateDirty()
}

function deleteSelectedKeys(): void {
  if (!archive || !layoutDocument || !selectedKeySections.length) return
  const before = layoutDocument.toString()
  if (!layoutDocument.removeSections(preview.expandSections(selectedKeySections))) return
  const text = layoutDocument.toString()
  commitText(layoutPath, before, text)
  if (selectedPath === layoutPath) setSourceValue(text)
  selectedKeySections = []
  preview.setDocument(layoutDocument)
  preview.setSelected([])
  refreshPreview()
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
  refreshSimulationPreview()
}

function isTauri(): boolean {
  return "__TAURI_INTERNALS__" in window
}

function isAndroidTauri(): boolean {
  return isTauri() && /Android/i.test(navigator.userAgent)
}

function isAndroidWeb(): boolean {
  return !isTauri() && /Android/i.test(navigator.userAgent)
}

function isIOSWeb(): boolean {
  return !isTauri() && (/iPad|iPhone|iPod/i.test(navigator.userAgent) ||
    navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
}

const mobileShareLabel = isAndroidTauri()
  ? "导入百度输入法"
  : isAndroidWeb()
    ? "分享 Android 皮肤"
    : isIOSWeb()
      ? "分享 iOS 皮肤"
      : "分享皮肤"
mobileShareButton.title = mobileShareLabel
mobileShareButton.setAttribute("aria-label", mobileShareLabel)
mobileShareMenuLabel.textContent = mobileShareLabel

const svgNamespace = "http://www.w3.org/2000/svg"
const fallbackSymbolPaths: Record<string, string[]> = {
  "info.circle": ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18", "M12 10v7", "M12 7h.01"],
  keyboard: ["M3 6h18v12H3z", "M6 10h2m2 0h2m2 0h2m2 0h1M7 14h10"],
  "square.grid.2x2": ["M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"],
  asterisk: ["M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"],
  pencil: ["m4 20 4.5-1 11-11-3.5-3.5-11 11z", "m14.5 6 3.5 3.5"],
  "list.bullet": ["M9 6h11M9 12h11M9 18h11", "M4 6h.01M4 12h.01M4 18h.01"],
  paperclip: ["M8 12.5 15.5 5a4 4 0 0 1 5.7 5.7L11 20.8a6 6 0 0 1-8.5-8.5L13 1.8", "M6 15.5 16.5 5a2 2 0 0 1 2.8 2.8L8.8 18.3"],
  play: ["M9 5v14l10-7z"],
  "play.fill": ["M8 5v14l11-7z"],
  "music.note": ["M9 18V5l12-2v13", "M9 9l12-2", "M9 18a3 3 0 1 1-3-3h3", "M21 16a3 3 0 1 1-3-3h3"],
  "speaker.wave.2": ["M4 9h4l5-4v14l-5-4H4z", "M16 9a4 4 0 0 1 0 6", "M18.5 6.5a8 8 0 0 1 0 11"],
  "speaker.slash": ["M4 9h4l5-4v14l-5-4H4z", "m17 9 4 6M21 9l-4 6"],
  gearshape: ["M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8", "M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"],
  "text.bubble": ["M4 4h16v12H9l-5 4z", "M8 8h8M8 12h5"],
  app: ["M4 4h16v16H4z", "M8 8h8v8H8z"],
  "rectangle.and.hand.point": ["M3 4h18v14H3z", "M8 8h8M12 8v6m0 0 3-3m-3 3-3-3"],
  paintpalette: ["M12 3a9 9 0 1 0 0 18h2a2 2 0 0 0 0-4h-1a2 2 0 0 1 0-4h9a9 9 0 0 0-6-14", "M7 9h.01M10 6h.01M15 7h.01M18 11h.01"],
  folder: ["M3 6h7l2 2h9l-2 10H5z", "M5 6V4h6l2 2"],
  "doc.text": ["M6 3h8l4 4v14H6z", "M14 3v5h5M9 12h6M9 16h6"],
  "doc.on.doc": ["M8 7V3h10l3 3v12h-4", "M5 7h10v14H5z", "M9 12h2m-2 4h2"],
  "arrow.uturn.backward": ["m7 5-4 3.5L7 12", "M4 8.5h7.2a5 5 0 0 1 5 5"],
  "arrow.uturn.forward": ["m13 5 4 3.5-4 3.5", "M16 8.5H8.8a5 5 0 0 0-5 5"],
  "rectangle.portrait": ["M6 2.5h12v19H6z", "M9 5h6M9 19h6"],
  "rectangle.landscape": ["M2.5 6h19v12h-19z", "M5 9v6M19 9v6"],
  "sun.max": ["M12 4V2m0 20v-2M4 12H2m20 0h-2M5.6 5.6 4.2 4.2m15.6 15.6-1.4-1.4m0-12.8 1.4-1.4M5.6 18.4l-1.4 1.4", "M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10"],
  moon: ["M20 15.5A8 8 0 0 1 8.5 4 8 8 0 1 0 20 15.5z"],
  magnifyingglass: ["M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14", "m16 16 5 5"],
  trash: ["M5 7h14M9 7V4h6v3m2 0-1 14H8L7 7m4 4v6m2-6v6"],
  photo: ["M4 4h16v16H4z", "m6 16 4-5 3 3 2-2 3 4M9 9h.01"],
  doc: ["M6 3h8l4 4v14H6z", "M14 3v5h5"],
}

function createSystemSymbol(name: string): HTMLSpanElement {
  const symbol = document.createElement("span")
  symbol.className = "system-symbol"
  symbol.dataset.systemSymbol = name
  symbol.ariaHidden = "true"
  const existingFallback = document.querySelector<SVGSVGElement>(
    `[data-system-symbol="${CSS.escape(name)}"] .system-symbol-fallback`,
  )
  if (existingFallback) {
    symbol.append(existingFallback.cloneNode(true))
    return symbol
  }
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

for (const symbol of Array.from(document.querySelectorAll<HTMLElement>(".system-symbol[data-system-symbol]:empty"))) {
  const rendered = createSystemSymbol(symbol.dataset.systemSymbol ?? "doc")
  symbol.replaceChildren(...rendered.childNodes)
}

function mobileCommandTarget(button: HTMLButtonElement): HTMLButtonElement | undefined {
  const command = button.dataset.mobileCommand
  if (command) return document.getElementById(command) as HTMLButtonElement | null ?? undefined
  const format = button.dataset.mobileExportFormat
  return format
    ? document.querySelector<HTMLButtonElement>(`[data-export-format="${format}"]`) ?? undefined
    : undefined
}

function syncMobileCommands(): void {
  for (const button of mobileCommandButtons) {
    button.disabled = mobileCommandTarget(button)?.disabled ?? true
  }
  mobileUndoButton.disabled = undoButton.disabled
  mobileRedoButton.disabled = redoButton.disabled
}

for (const button of mobileCommandButtons) {
  button.addEventListener("click", () => {
    const target = mobileCommandTarget(button)
    if (!target || target.disabled) return
    mobileCommandMenu.open = false
    target.click()
  })
}
new MutationObserver(syncMobileCommands).observe($(".toolbar-group"), {
  subtree: true,
  attributes: true,
  attributeFilter: ["disabled"],
})
syncMobileCommands()

for (const [button, target] of [[mobileUndoButton, undoButton], [mobileRedoButton, redoButton]] as const) {
  button.addEventListener("click", () => {
    if (!target.disabled) target.click()
  })
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
  const values: Record<string, string> = { mode: mode.value, theme: theme.value, orientation: orientation.value }
  const labels: Record<string, string> = {
    preview: "交互预览",
    edit: "编辑模式",
    light: "浅色",
    dark: "深色",
    port: "竖屏",
    land: "横屏",
  }
  for (const button of mobileChoiceButtons) {
    const value = values[button.dataset.mobileChoice ?? ""] ?? ""
    const label = labels[value] ?? value
    const labelNode = button.querySelector<HTMLElement>(".mobile-choice-label")
    if (labelNode) labelNode.textContent = label
    for (const icon of Array.from(button.querySelectorAll<HTMLElement>("[data-mobile-choice-value]"))) {
      icon.classList.toggle("active", icon.dataset.mobileChoiceValue === value)
    }
    button.setAttribute("aria-label", `切换${label || "选项"}（当前${label}）`)
  }
}

function syncMobileInspectorHeader(): void {
  mobileInspectorSelection.textContent = selectedKeyName.textContent
  sourceHeading.dataset.mobileKeyTools = selectedKeySections.length ? "on" : "off"
  const target = mobilePortraitQuery.matches ? sourceHeading : keyInspectorTitle
  if (keyToolbar.parentElement !== target) target.append(keyToolbar)
}

function mobileInspectorGroupLabel(group: HTMLElement): string {
  if (group.classList.contains("document-property-section")) {
    const label = group.querySelector(":scope > h3")?.textContent?.trim() ?? "配置"
    return label.replace(/\s*[（(][^）)]*[）)]\s*$/, "")
  }
  if (group.classList.contains("primary-key-fields")) return "常用"
  if (group.classList.contains("skin-fields")) return "皮肤"
  if (group.classList.contains("toolbar-fields")) return "候选栏"
  if (group.classList.contains("document-fields")) return "文档"
  if (group.classList.contains("bda-config-fields")) return "BDA"
  const label = group.querySelector(":scope > summary, :scope > h3")?.textContent?.trim() ?? "属性"
  if (label.includes("样式")) return "样式"
  if (label.includes("滑动")) return "手势"
  return label.split(/[、与（(]/)[0]
}

function setMobileInspectorGroup(id: string, scroll = true): void {
  quickInspector.dataset.mobileInspectorGroup = id
  for (const group of Array.from(quickInspector.querySelectorAll<HTMLElement>(".mobile-inspector-managed"))) {
    const active = group.dataset.mobileInspectorGroup === id
    group.classList.toggle("mobile-inspector-active", active)
  }
  for (const button of Array.from(mobileInspectorGroups.querySelectorAll<HTMLButtonElement>("button"))) {
    const active = button.dataset.mobileInspectorGroup === id
    button.classList.toggle("active", active)
    button.setAttribute("aria-pressed", String(active))
  }
  if (scroll && (mobilePortraitQuery.matches || !inspectorGroupedDisplay.checked)) {
    const group = quickInspector.querySelector<HTMLElement>(`.mobile-inspector-managed[data-mobile-inspector-group="${CSS.escape(id)}"]`)
    group?.scrollIntoView({ behavior: "smooth", block: "start" })
  } else if (scroll) quickInspector.scrollTop = 0
}

function syncMobileInspectorGroups(): void {
  for (const group of Array.from(quickInspector.querySelectorAll<HTMLElement>(".mobile-inspector-managed"))) {
    group.classList.remove("mobile-inspector-managed", "mobile-inspector-active")
    delete group.dataset.mobileInspectorGroup
  }
  const groups = Array.from(quickInspector.querySelectorAll<HTMLElement>(":scope > .inspector-group"))
    .filter((group) => !group.hidden)
    .flatMap((group) => group === documentFieldsGroup
      ? Array.from(documentFields.querySelectorAll<HTMLElement>(":scope > .document-property-section"))
      : [group])
  for (const [index, group] of groups.entries()) {
    group.dataset.mobileInspectorGroup = `${index}`
    group.classList.add("mobile-inspector-managed")
  }
  const active = groups.find((group) => group.dataset.mobileInspectorGroup === quickInspector.dataset.mobileInspectorGroup)
    ?? groups[0]
  mobileInspectorGroups.hidden = groups.length < 2
  mobileInspectorGroups.replaceChildren(inspectorGroupsDrag, ...groups.map((group) => {
    const button = document.createElement("button")
    button.type = "button"
    button.textContent = mobileInspectorGroupLabel(group)
    button.dataset.mobileInspectorGroup = group.dataset.mobileInspectorGroup
    button.addEventListener("click", () => setMobileInspectorGroup(group.dataset.mobileInspectorGroup ?? "0"))
    return button
  }))
  setMobileInspectorGroup(active?.dataset.mobileInspectorGroup ?? "", false)
}

{
  let dragging = false
  let pointerId = -1
  let pointerToCenterY = 0
  const savedPosition = Number(localStorage.getItem("desktop-inspector-groups-y"))
  if (Number.isFinite(savedPosition) && savedPosition >= 15 && savedPosition <= 85) {
    quickInspector.style.setProperty("--desktop-inspector-groups-y", `${savedPosition}%`)
  } else {
    quickInspector.style.setProperty("--desktop-inspector-groups-y", "50%")
  }

  inspectorGroupsDrag.addEventListener("pointerdown", (event) => {
    if (mobilePortraitQuery.matches) return
    dragging = true
    pointerId = event.pointerId
    const groupRect = mobileInspectorGroups.getBoundingClientRect()
    pointerToCenterY = event.clientY - (groupRect.top + groupRect.height / 2)
    mobileInspectorGroups.classList.add("dragging")
    inspectorGroupsDrag.setPointerCapture(pointerId)
    event.preventDefault()
  })
  inspectorGroupsDrag.addEventListener("pointermove", (event) => {
    if (!dragging || event.pointerId !== pointerId) return
    const rect = quickInspector.getBoundingClientRect()
    const percent = inspectorGroupPositionPercent(
      event.clientY,
      rect.top,
      rect.height,
      mobileInspectorGroups.offsetHeight,
      pointerToCenterY,
    )
    quickInspector.style.setProperty("--desktop-inspector-groups-y", `${percent}%`)
  })
  const stopDragging = (event: PointerEvent) => {
    if (!dragging || event.pointerId !== pointerId) return
    dragging = false
    mobileInspectorGroups.classList.remove("dragging")
    localStorage.setItem("desktop-inspector-groups-y", quickInspector.style.getPropertyValue("--desktop-inspector-groups-y").replace("%", ""))
    inspectorGroupsDrag.releasePointerCapture(pointerId)
    pointerId = -1
  }
  inspectorGroupsDrag.addEventListener("pointerup", stopDragging)
  inspectorGroupsDrag.addEventListener("pointercancel", stopDragging)
}

function setMobilePane(pane: "layout" | "inspector"): void {
  document.documentElement.dataset.mobilePane = pane
  for (const button of mobilePaneButtons) {
    const active = button.dataset.mobilePane === pane
    button.classList.toggle("active", active)
    button.setAttribute("aria-pressed", String(active))
  }
  const mobile = mobilePortraitQuery.matches
  sidebarPane.inert = mobile && pane !== "layout"
  inspectorPane.inert = mobile && pane !== "inspector"
}

function setMobileSplit(value: number, persist = true): void {
  const clamped = Math.max(28, Math.min(72, value))
  document.documentElement.style.setProperty("--mobile-workspace-split", `${clamped}%`)
  mobileSplitHandle.setAttribute("aria-valuenow", String(Math.round(clamped)))
  mobileSplitHandle.setAttribute("aria-valuetext", `画布占 ${Math.round(clamped)}%`)
  if (persist) localStorage.setItem("mobile-workspace-split", String(clamped))
}

setMobileSplit(Number(localStorage.getItem("mobile-workspace-split")) || 50, false)

let mobileSplitBeforeCollapse = Number(localStorage.getItem("mobile-workspace-split")) || 50
function setMobilePreviewCollapsed(collapsed: boolean): void {
  if (collapsed) {
    mobileSplitBeforeCollapse = Number.parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue("--mobile-workspace-split"),
    ) || mobileSplitBeforeCollapse
  }
  document.documentElement.dataset.mobilePreviewCollapsed = String(collapsed)
  mobileSplitHandle.setAttribute("aria-expanded", String(!collapsed))
  mobileSplitHandle.title = collapsed ? "点击展开预览" : "拖动调整画布与配置区域比例；点击收起或展开预览"
  mobileSplitHandle.setAttribute("aria-label", mobileSplitHandle.title)
  if (!collapsed) setMobileSplit(mobileSplitBeforeCollapse)
}

setMobilePane("layout")
syncMobileInspectorHeader()
for (const button of mobilePaneButtons) {
  button.addEventListener("click", () => setMobilePane(button.dataset.mobilePane === "inspector" ? "inspector" : "layout"))
}
mobilePortraitQuery.addEventListener("change", () => {
  if (!mobilePortraitQuery.matches) setMobilePreviewCollapsed(false)
  setMobilePane(document.documentElement.dataset.mobilePane === "inspector" ? "inspector" : "layout")
  syncMobileInspectorHeader()
})
let mobileSwipeStart: { pointerId: number; x: number; y: number } | undefined
mainWorkspace.addEventListener("pointerdown", (event) => {
  if (!mobilePortraitQuery.matches || event.pointerType === "mouse" && event.button !== 0 ||
    !(event.target as Element).closest("aside, .source")) return
  mobileSwipeStart = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }
  mainWorkspace.setPointerCapture(event.pointerId)
})
mainWorkspace.addEventListener("pointermove", (event) => {
  if (!mobileSwipeStart || mobileSwipeStart.pointerId !== event.pointerId) return
  const deltaX = event.clientX - mobileSwipeStart.x
  const deltaY = event.clientY - mobileSwipeStart.y
  if (Math.abs(deltaX) < 56 || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) return
  mobileSwipeStart = undefined
  setMobilePane(deltaX < 0 ? "inspector" : "layout")
})
mainWorkspace.addEventListener("pointerup", (event) => {
  if (!mobileSwipeStart || mobileSwipeStart.pointerId !== event.pointerId) return
  const deltaX = event.clientX - mobileSwipeStart.x
  const deltaY = event.clientY - mobileSwipeStart.y
  mobileSwipeStart = undefined
  if (mainWorkspace.hasPointerCapture(event.pointerId)) mainWorkspace.releasePointerCapture(event.pointerId)
  if (Math.abs(deltaX) < 56 || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) return
  setMobilePane(deltaX < 0 ? "inspector" : "layout")
})
mainWorkspace.addEventListener("pointercancel", (event) => {
  if (mobileSwipeStart?.pointerId === event.pointerId) mobileSwipeStart = undefined
})

{
  let dragging = false
  let moved = false
  let pointerId = -1
  let pointerStartY = 0

  mobileSplitHandle.addEventListener("pointerdown", (event) => {
    if (!mobilePortraitQuery.matches) return
    dragging = true
    moved = false
    pointerId = event.pointerId
    pointerStartY = event.clientY
    mobileSplitHandle.classList.add("dragging")
    mobileSplitHandle.setPointerCapture(pointerId)
    event.preventDefault()
  })

  mobileSplitHandle.addEventListener("pointermove", (event) => {
    if (!dragging || event.pointerId !== pointerId) return
    moved ||= Math.abs(event.clientY - pointerStartY) > 3
    const rect = mainWorkspace.getBoundingClientRect()
    if (!rect.height) return
    const fromTop = (event.clientY - rect.top) / rect.height * 100
    const split = mobilePreviewPosition.value === "top" ? fromTop : 100 - fromTop
    setMobileSplit(split)
  })

  const finishMobileSplitDrag = (event: PointerEvent) => {
    if (!dragging || event.pointerId !== pointerId) return
    dragging = false
    pointerId = -1
    mobileSplitHandle.classList.remove("dragging")
    if (mobileSplitHandle.hasPointerCapture(event.pointerId)) mobileSplitHandle.releasePointerCapture(event.pointerId)
  }
  mobileSplitHandle.addEventListener("pointerup", finishMobileSplitDrag)
  mobileSplitHandle.addEventListener("pointercancel", finishMobileSplitDrag)
  mobileSplitHandle.addEventListener("click", () => {
    const wasMoved = moved
    moved = false
    if (!mobilePortraitQuery.matches || wasMoved) return
    setMobilePreviewCollapsed(document.documentElement.dataset.mobilePreviewCollapsed !== "true")
  })
  mobileSplitHandle.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return
    const current = Number.parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue("--mobile-workspace-split"),
    ) || 50
    setMobileSplit(current + (event.key === "ArrowUp" ? 2 : -2))
    event.preventDefault()
  })
}

function updatePanelToolButtons(): void {
  const editing = isEditing()
  panelScaleButton.disabled = !editing || fileOperationRunning || !archive
  replaceLayoutImageButton.disabled = !editing || fileOperationRunning || !archive || archive.format === "bda"
  adaptIos26Button.disabled = !editing || fileOperationRunning || !archive || archive.format === "bda"
}

function applyModeState(): void {
  const editing = isEditing()
  deviceShell.dataset.mode = editing ? "edit" : "preview"
  preview.setMode(editing ? "edit" : "preview")
  preview.setEditTool(keyMode)
  source.readOnly = !editing
  replaceAssetButton.disabled = !editing
  quickInspector.dataset.readonly = editing ? "false" : "true"
  if (!editing) {
    for (const field of [...keyFields, ...styleFields, ...keyboardFields, ...toolbarFields, ...skinFields, ...gapFields]) {
      field.disabled = true
    }
    for (const button of layoutActionButtons) button.disabled = true
  }
  updatePanelToolButtons()
  updateSourceFileActions()
  syncSegmentedControls()
}

function selectChoice(select: HTMLSelectElement, value: string): void {
  if (select.value === value) return
  select.value = value
  select.dispatchEvent(new Event("change"))
}

type SourceFilePayload = { path: string; data: number[] }
type SourceChangePayload = { path: string; data: number[] | null; directory: boolean }

function sourcePathForWorkspace(path: string): string {
  return sourceWorkspacePrefix && path.startsWith(sourceWorkspacePrefix)
    ? path.slice(sourceWorkspacePrefix.length)
    : path
}

function sourcePathForArchive(path: string): string {
  return resolveSourceArchivePath(
    path,
    sourceWorkspacePrefix,
    archive?.sourceFiles().map((file) => file.path) ?? [],
  )
}

function sourceFilesPayload(value: SkinArchive): SourceFilePayload[] {
  return value.sourceFiles().map((file) => ({ path: file.path, data: Array.from(file.data) }))
}

function decodeBase64Archive(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
  return bytes
}

async function flushSourceAutosave(): Promise<void> {
  if (sourceAutosaveTimer !== undefined) {
    clearTimeout(sourceAutosaveTimer)
    sourceAutosaveTimer = undefined
  }
  if (archive && sourceWorkspacePath && pendingSourcePaths.size) {
    const workspace = sourceWorkspacePath
    const value = archive
    const paths = [...pendingSourcePaths]
    pendingSourcePaths.clear()
    const changes: SourceChangePayload[] = paths.map((path) => {
      const data = value.getSourceBytes(sourcePathForArchive(path))
      return { path, data: data ? Array.from(data) : null, directory: false }
    })
    sourceAutosaveQueue = sourceAutosaveQueue.catch(() => {}).then(() => invoke("apply_source_changes", {
      path: workspace,
      changes,
    }))
  }
  try {
    await sourceAutosaveQueue
  } catch (error) {
    showError(error, "自动保存源码")
  }
}

function scheduleSourceAutosave(paths: string[]): void {
  if (!archive || (!sourceWorkspacePath && sourceWorkspacePendingArchive !== archive)) return
  for (const path of paths) pendingSourcePaths.add(sourcePathForWorkspace(archive.sourcePath(path)))
  if (!sourceWorkspacePath) return
  if (sourceAutosaveTimer !== undefined) clearTimeout(sourceAutosaveTimer)
  sourceAutosaveTimer = window.setTimeout(() => void flushSourceAutosave(), 180)
}

async function refreshExternalSourceFiles(workspace: string, paths: string[]): Promise<void> {
  if (!archive || workspace !== sourceWorkspacePath || !paths.length) return
  const changes = await invoke<SourceChangePayload[]>("read_source_changes", {
    path: workspace,
    changedPaths: paths,
  })
  if (!archive || workspace !== sourceWorkspacePath) return
  let changed = false
  const affected = new Set<string>()
  const directorySnapshots = changes.filter((change) => change.directory)
  const presentPaths = new Set(changes.filter((change) => !change.directory && change.data).map((change) => sourcePathForArchive(change.path)))
  for (const snapshot of directorySnapshots) {
    const archiveSnapshotPath = sourcePathForArchive(snapshot.path).replace(/\/$/, "")
    const prefix = archiveSnapshotPath ? `${archiveSnapshotPath}/` : ""
    const removed = archive.sourceFiles()
      .filter((file) => (file.path === archiveSnapshotPath || file.path.startsWith(prefix)) && !presentPaths.has(file.path))
      .map((file) => archive!.canonicalSourcePath(file.path))
    for (const canonical of removed) {
      archive.delete(canonical)
      affected.add(canonical)
      changed = true
    }
  }
  for (const change of changes) {
    if (change.directory) continue
    pendingSourcePaths.delete(change.path)
    if (change.data) {
      const canonical = archive.canonicalSourcePath(sourcePathForArchive(change.path))
      const before = archive.getBytes(canonical)
      const after = new Uint8Array(change.data)
      if (before && before.length === after.length && before.every((byte, index) => byte === after[index])) continue
      archive.setBytes(canonical, after)
      affected.add(canonical)
      changed = true
      continue
    }
    const removed = archive.sourceFiles()
      .filter((file) => {
        const archivePath = sourcePathForArchive(change.path)
        return file.path === archivePath || file.path.startsWith(`${archivePath}/`)
      })
      .map((file) => archive!.canonicalSourcePath(file.path))
    for (const canonical of removed) {
      archive.delete(canonical)
      affected.add(canonical)
      changed = true
    }
  }
  if (!changed) return
  undoStack = []
  redoStack = []
  updateHistoryButtons()
  renderFiles()
  try {
    if (affected.has(layoutPath) && archive.isText(layoutPath)) {
      layoutDocument = IniDocument.parse(archive.getText(layoutPath))
    }
    if (selectedPath && archive.getBytes(selectedPath)) selectFile(selectedPath, sidebarView, "document", true)
    else {
      const next = archive.names().find((path) => archive?.isText(path))
      if (next) selectFile(next, sidebarView)
    }
    refreshBdaLayout()
    refreshPreview()
    populateKeyInspector()
  } catch (error) {
    showError(error, "刷新外部源码")
  }
  updateDirty()
  showStatus(`已实时刷新 ${affected.size} 个源码文件`)
}

function queueSourceWatch(paths: string[], workspace: string): void {
  if (workspace !== sourceWorkspacePath) return
  for (const path of paths) pendingSourceWatchPaths.add(path)
  if (sourceWatchTimer !== undefined) clearTimeout(sourceWatchTimer)
  sourceWatchTimer = window.setTimeout(() => {
    sourceWatchTimer = undefined
    const changed = [...pendingSourceWatchPaths]
    pendingSourceWatchPaths.clear()
    void refreshExternalSourceFiles(workspace, changed).catch((error) => showError(error, "刷新外部源码"))
  }, 80)
}

async function activateSourceWorkspace(path: string, prefix = ""): Promise<void> {
  stopSourceWatch?.()
  stopSourceWatch = undefined
  if (isAndroidTauri()) await invoke("stop_source_observer").catch(() => {})
  pendingSourcePaths.clear()
  pendingSourceWatchPaths.clear()
  sourceWorkspacePath = path
  sourceWorkspacePrefix = prefix
  if (!isTauri() || !path) return
  if (isAndroidTauri() && path.startsWith("content://")) {
    const handler = new Channel<string>()
    handler.onmessage = (changedPath) => queueSourceWatch([changedPath || path], path)
    await invoke("start_source_observer", { path, handler })
    stopSourceWatch = () => { void invoke("stop_source_observer") }
    if (localStorage.getItem("source-directory-enabled") === "true") {
      localStorage.setItem(LAST_SOURCE_WORKSPACE_KEY, path)
    }
    return
  }
  stopSourceWatch = await watch(path, (event) => {
    if (typeof event.type === "object" && "access" in event.type) return
    queueSourceWatch(event.paths, path)
  }, { recursive: true, delayMs: 120 })
}

function hasUnsavedChanges(): boolean {
  return unsavedNew || Boolean(archive?.changed.size)
}

async function prepareDocumentReplacement(): Promise<boolean> {
  await flushSourceAutosave()
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
  return saveArchive(false, currentExportFormat())
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
  scheduleSourceAutosave([path])
  updateHistoryButtons()
}

function commitBytes(path: string, before: Uint8Array, after: Uint8Array): void {
  if (!archive || before.length === after.length && before.every((byte, index) => byte === after[index])) return
  archive.setBytes(path, after)
  undoStack.push({ kind: "bytes", path, before, after })
  redoStack = []
  scheduleSourceAutosave([path])
  updateHistoryButtons()
}

function commitBatch(changes: Change[]): void {
  if (!archive || !changes.length) return
  for (const change of changes) {
    if (change.kind === "text") archive.setText(change.path, change.after)
    else if (change.kind === "bytes") {
      if (change.after) archive.setBytes(change.path, change.after)
      else archive.delete(change.path)
    }
  }
  undoStack.push({ kind: "batch", changes })
  redoStack = []
  scheduleSourceAutosave(changes.flatMap((change) => change.kind === "batch" ? [] : [change.path]))
  updateHistoryButtons()
}

function applyTextSnapshot(path: string, text: string): void {
  if (!archive) return
  archive.setText(path, text)
  scheduleSourceAutosave([path])
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
  if (change.kind === "batch") {
    for (const child of [...change.changes].reverse()) {
      if (child.kind === "text") applyTextSnapshot(child.path, child.before)
      else applyBytesSnapshot(child.path, child.before)
    }
  } else if (change.kind === "text") applyTextSnapshot(change.path, change.before)
  else applyBytesSnapshot(change.path, change.before)
  renderFiles()
  if (selectedPath && archive?.getBytes(selectedPath)) selectFile(selectedPath, sidebarView)
  updateHistoryButtons()
}

function redo(): void {
  const change = redoStack.pop()
  if (!change) return
  undoStack.push(change)
  if (change.kind === "batch") {
    for (const child of change.changes) {
      if (child.kind === "text") applyTextSnapshot(child.path, child.after)
      else applyBytesSnapshot(child.path, child.after)
    }
  } else if (change.kind === "text") applyTextSnapshot(change.path, change.after)
  else applyBytesSnapshot(change.path, change.after)
  renderFiles()
  if (selectedPath && archive?.getBytes(selectedPath)) selectFile(selectedPath, sidebarView)
  updateHistoryButtons()
}

function applyBytesSnapshot(path: string, bytes?: Uint8Array): void {
  if (!archive) return
  if (bytes) archive.setBytes(path, bytes)
  else archive.delete(path)
  scheduleSourceAutosave([path])
  refreshBdaLayout()
  if (selectedPath === path && bytes && archive.isBdaConfig(path)) setSourceValue(describeBdaConfig(path, bytes))
  refreshPreview()
  populateKeyInspector()
  updateDirty()
}

function preferredPath(): string {
  return `${theme.value}/skin/${orientation.value}/${layout.value}`
}

function selectedVariant(): { theme: "light" | "dark"; orientation: "port" | "land" } {
  const match = layoutPath.match(/^(light|dark)\/skin\/(port|land)\//)
  return {
    theme: (match?.[1] as "light" | "dark") ?? theme.value as "light" | "dark",
    orientation: (match?.[2] as "port" | "land") ?? orientation.value,
  }
}

function preferredVariantExists(path: string): boolean {
  return archive?.format === "bda"
    ? bdaAvailableLayoutPaths().includes(path)
    : Boolean(archive?.names().includes(path))
}

function createMissingVariant(path: string): boolean {
  if (!archive || preferredVariantExists(path)) return true
  const { theme: sourceTheme, orientation: sourceOrientation } = selectedVariant()
  const targetTheme = theme.value as "light" | "dark"
  const targetOrientation = orientation.value
  const label = sourceTheme !== targetTheme
    ? `${targetTheme === "dark" ? "深色" : "浅色"}布局`
    : `${targetOrientation === "land" ? "横屏" : "竖屏"}布局`
  if (!window.confirm(`当前皮肤没有${label}，是否从当前配置创建？`)) {
    theme.value = sourceTheme
    orientation.value = sourceOrientation
    syncSegmentedControls()
    return false
  }
  const copies = variantCopyPaths(archive.names(), sourceTheme, sourceOrientation, targetTheme, targetOrientation)
  if (!copies.some(({ target }) => target === path)) {
    theme.value = sourceTheme
    orientation.value = sourceOrientation
    syncSegmentedControls()
    showError(new Error("当前配置没有可复制的对应布局"), `创建${label}`)
    return false
  }
  for (const { source, target } of copies) archive.setBytes(target, archive.getBytes(source)!.slice())
  scheduleSourceAutosave(copies.map(({ target }) => target))
  renderFiles()
  updateDirty()
  showStatus(`${label}已创建。`)
  return true
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
  const language = simulationLanguage()
  if (lastSimulationLanguage !== undefined && lastSimulationLanguage !== language) {
    simulatedComposition = ""
  }
  lastSimulationLanguage = language
  const candidateSource = language === "en" ? simulatedOutput.value : simulatedComposition
  const candidateCaret = language === "en"
    ? simulatedOutput.selectionStart ?? simulatedOutput.value.length
    : simulatedComposition.length
  const state = candidatePreview(
    candidateSource,
    candidateCaret,
    language,
    skinState.value ? Number(skinState.value) : undefined,
  )
  candidateComposition.hidden = !state.composing
  candidateInput.hidden = !state.input
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
  const symbolPanel = isConfiguredSymbolLayout(layoutPath, textDocument(genConfigPath()))
  candidateArea.hidden = symbolPanel
  toolbarStrip.hidden = symbolPanel || !toolbarStrip.dataset.path
  toolbarPreview.setPersistentOnly(composing)
  return composing
}

function applyDeviceKeyboardGeometry(
  panelWidth: number,
  panelHeight: number,
  candidateHeight: number,
  candidateInputHeight: number,
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
    candidateInputHeight,
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

function devicePreviewTransparent(): boolean {
  return true
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
  const legacyAnimationPath = [
    `${theme.value}/skin/${orientation.value}/anim.ini`,
    `${theme.value}/skin/${orientation.value}/res/anim.ini`,
    `${theme.value}/skin/res/anim.ini`,
  ].find((path) => archive?.isText(path))
  preview.setLegacyAnimation(
    archive.format !== "bda" && archive.isText(styleConfigPath()) && legacyAnimationPath
      ? parseLegacyAnimation(
          IniDocument.parse(archive.getText(styleConfigPath())),
          IniDocument.parse(archive.getText(legacyAnimationPath)),
        )
      : undefined,
  )
  const bdaGenPath = bdaBasePath(genConfigPath())
  const bdaGen = archive.format === "bda" && bdaBase?.isText(bdaGenPath)
    ? IniDocument.parse(bdaBase.getText(bdaGenPath))
    : undefined
  preview.setOffsets(context?.gen ?? bdaGen)
  preview.setDefaults(context?.gen ?? bdaGen)
  preview.setTheme(theme.value === "dark" ? "dark" : "light")
  preview.setTransparent(devicePreviewTransparent())
  if (context && layoutDocument) {
    const symbolPanel = candidateArea.hidden
    const candidateRect = context.gen.get("CAND", "VIEW_RECT")?.split(",").map(Number)
    const generalConfig = keyboardConfig(context.gen, context.styles)
    const candidateWidth = candidateRect?.length === 4 && Number.isFinite(candidateRect[2])
      ? candidateRect[2]
      : generalConfig.width
    const candidateContentHeight = candidateRect?.length === 4 && Number.isFinite(candidateRect[3])
      ? candidateRect[3]
      : DEFAULT_CANDIDATE_HEIGHT
    const minimumSymbolHeight = symbolPanel
      ? generalConfig.height + candidateContentHeight +
        resolveCandidateInputStyle(context.gen, resolver, candidateWidth).height
      : 0
    const config = resolvePanelConfig(
      layoutDocument,
      context.gen,
      context.styles,
      minimumSymbolHeight,
    )
    const inputVisual = resolver.resolveText(
      context.gen.get("SCAND", "INPUT_STYLE") ?? context.gen.get("INPUT", "FORE_STYLE") ?? "",
      false,
    )
    const candidatePath = toolbarConfigPath()
    const candidateLayout = candidatePath && archive.isText(candidatePath)
      ? IniDocument.parse(archive.getText(candidatePath))
      : undefined
    const { normal: candidateVisual, first: firstCandidateVisual } =
      resolveCandidateTextVisuals(candidateLayout, context.gen, resolver)
    firstCandidateTextVisual = firstCandidateVisual
    candidateTextWidth = config.width
    applyCandidateTextVisual(candidateInput, inputVisual, candidateTextWidth)
    applyCandidateTextVisual(
      candidateWords,
      candidateVisual ?? { color: "#ffffff" },
      candidateTextWidth,
    )
    const firstCandidate = candidateWords.firstElementChild as HTMLElement | null
    if (firstCandidate) {
      applyCandidateTextVisual(firstCandidate, firstCandidateTextVisual, candidateTextWidth)
    }
    preview.setPanel(config.styleID, config.width, config.height)
    updatePanelTools(config.width, config.height, toolbarSize?.height)
    const candidateHeight = toolbarSize?.height ?? 0
    const candidateInputHeight = toolbarSize?.inputHeight ?? 0
    activeKeyboardGeometry = {
      panelWidth: config.width,
      panelHeight: config.height,
      candidateHeight,
      candidateInputHeight,
    }
    applyDeviceKeyboardGeometry(config.width, config.height, candidateHeight, candidateInputHeight)
  } else if (bdaGen && layoutDocument) {
    const size = bdaGen.get("PANEL", "SIZE")?.split(",").map(Number)
    const panelWidth = size?.[0] || DEFAULT_BDA_PANEL_WIDTH
    const panelHeight = size?.[1] || DEFAULT_BDA_PANEL_HEIGHT
    const candidateRect = bdaGen.get("CAND", "VIEW_RECT")?.split(",").map(Number)
    const candidateWidth = candidateRect?.length === 4 && Number.isFinite(candidateRect[2])
      ? candidateRect[2]
      : panelWidth
    const candidateContentHeight = candidateRect?.length === 4 && Number.isFinite(candidateRect[3])
      ? candidateRect[3]
      : DEFAULT_CANDIDATE_HEIGHT
    const effectivePanelHeight = candidateArea.hidden && resolver
      ? panelHeight + candidateContentHeight +
        resolveCandidateInputStyle(bdaGen, resolver, candidateWidth).height
      : panelHeight
    const panel = currentBdaAppearance()?.appearance.panels.get(layout.value.replace(/\.ini$/i, ""))
    const candidateDocument = toolbarConfigPath() ? textDocument(toolbarConfigPath()!) : undefined
    const inputVisual = resolver?.resolveText(
      bdaGen.get("SCAND", "INPUT_STYLE") ?? bdaGen.get("INPUT", "FORE_STYLE") ?? "",
      false,
    )
    const { normal: candidateVisual, first: firstVisual } = resolver
      ? resolveCandidateTextVisuals(candidateDocument, bdaGen, resolver)
      : { normal: undefined, first: undefined }
    candidateTextWidth = panelWidth
    firstCandidateTextVisual = firstVisual
    applyCandidateTextVisual(candidateInput, inputVisual, candidateTextWidth)
    applyCandidateTextVisual(
      candidateWords,
      firstVisual ?? candidateVisual ?? { color: "#ffffff" },
      candidateTextWidth,
    )
    const firstCandidate = candidateWords.firstElementChild as HTMLElement | null
    if (firstCandidate) applyCandidateTextVisual(firstCandidate, firstVisual, candidateTextWidth)
    preview.setPanel(
      bdaStyleID(panel?.wholeBackStyle ?? panel?.backStyle),
      panelWidth,
      effectivePanelHeight,
    )
    updatePanelTools(panelWidth, effectivePanelHeight, toolbarSize?.height)
    const candidateHeight = toolbarSize?.height ?? 0
    const candidateInputHeight = toolbarSize?.inputHeight ?? 0
    activeKeyboardGeometry = {
      panelWidth,
      panelHeight: effectivePanelHeight,
      candidateHeight,
      candidateInputHeight,
    }
    applyDeviceKeyboardGeometry(panelWidth, effectivePanelHeight, candidateHeight, candidateInputHeight)
  } else {
    activeKeyboardGeometry = undefined
    for (const property of deviceGeometryProperties) deviceShell.style.removeProperty(property)
  }
  preview.setDocument(layoutDocument)
}

function refreshSimulationPreview(): void {
  const composing = refreshSimulationState()
  if (!archive || !activeKeyboardGeometry) return
  applyDeviceKeyboardGeometry(
    activeKeyboardGeometry.panelWidth,
    activeKeyboardGeometry.panelHeight,
    activeKeyboardGeometry.candidateHeight,
    activeKeyboardGeometry.candidateInputHeight,
  )
  updateCanvasCandidateGeometry(activeKeyboardGeometry.candidateHeight)
  const resolver = visualResolver()
  if (!resolver) return
  const toolbarSize = refreshToolbarPreview(composing, resolver)
  const candidateHeight = toolbarSize?.height ?? activeKeyboardGeometry.candidateHeight
  const candidateInputHeight = toolbarSize?.inputHeight ?? activeKeyboardGeometry.candidateInputHeight
  if (
    candidateHeight !== activeKeyboardGeometry.candidateHeight ||
    candidateInputHeight !== activeKeyboardGeometry.candidateInputHeight
  ) {
    activeKeyboardGeometry.candidateHeight = candidateHeight
    activeKeyboardGeometry.candidateInputHeight = candidateInputHeight
    applyDeviceKeyboardGeometry(
      activeKeyboardGeometry.panelWidth,
      activeKeyboardGeometry.panelHeight,
      candidateHeight,
      candidateInputHeight,
    )
    updateCanvasCandidateGeometry(candidateHeight)
  }
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
  const renderedWidth = width * previewZoom
  const scale = renderedWidth / canvasLogicalSize.width
  const panelViewportHeight = Math.round(canvasLogicalSize.panelHeight * scale)
  deviceShell.style.setProperty("--canvas-fit-width", `${renderedWidth}px`)
  deviceShell.style.setProperty("--panel-viewport-height", `${panelViewportHeight}px`)
  const toolbarHeight = Number(toolbarCanvas.style.getPropertyValue("--toolbar-height") || "0")
  const toolbarWidth = Number(toolbarCanvas.style.getPropertyValue("--toolbar-width") || "0")
  if (toolbarWidth > 0 && toolbarHeight > 0) {
    deviceShell.style.setProperty("--toolbar-viewport-height", `${Math.round(toolbarHeight * scale)}px`)
    const inputHeight = Number(toolbarCanvas.style.getPropertyValue("--candidate-input-height") || "0")
    deviceShell.style.setProperty("--candidate-input-height", `${Math.round(inputHeight * scale)}px`)
    deviceShell.style.setProperty(
      "--candidate-viewport-height",
      `${Math.round(toolbarHeight * scale)}px`,
    )
  }
  if (device.value === "canvas") updateCanvasPanelStatus(renderedWidth)
}

function updateCanvasPanelStatus(renderedWidth: number): void {
  if (!canvasLogicalSize) return
  panelStatus.textContent = `面板：${Math.round(canvasLogicalSize.width)} × ${Math.round(canvasLogicalSize.panelHeight)} · 预览缩放：${Math.round(renderedWidth / canvasLogicalSize.width * 100)}%`
}

let fitCanvasDebounce: ReturnType<typeof setTimeout> | undefined
let canvasFitFrozen = false
let previewZoom = 1
let previewPanX = 0
let previewPanY = 0
let previewPanStart: { x: number; y: number; panX: number; panY: number } | undefined
let previewPanCandidate: { pointerId: number; x: number; y: number; panX: number; panY: number } | undefined

function setPreviewPan(x: number, y: number): void {
  previewPanX = x
  previewPanY = y
  deviceShell.style.transform = `translate(${x}px, ${y}px) scale(${device.value === "canvas" ? 1 : previewZoom})`
}

function applyPreviewZoom(value: number, anchor?: { x: number; y: number }): void {
  const before = anchor ? deviceShell.getBoundingClientRect() : undefined
  const anchorX = before && anchor ? (anchor.x - before.left) / before.width : 0.5
  const anchorY = before && anchor ? (anchor.y - before.top) / before.height : 0.5
  previewZoom = Math.min(3, Math.max(0.4, Math.round(value * 10) / 10))
  previewZoomOut.disabled = previewZoom <= 0.4
  previewZoomIn.disabled = previewZoom >= 3
  if (device.value === "canvas") fitCanvasPreview()
  else setPreviewPan(previewPanX, previewPanY)
  if (anchor && before) {
    const after = deviceShell.getBoundingClientRect()
    setPreviewPan(
      previewPanX + anchor.x - (after.left + anchorX * after.width),
      previewPanY + anchor.y - (after.top + anchorY * after.height),
    )
  }
  if (device.value !== "canvas" && canvasLogicalSize) {
    requestAnimationFrame(() => {
      const bounds = ($("#preview") as HTMLCanvasElement).getBoundingClientRect()
      panelStatus.textContent = `面板：${Math.round(canvasLogicalSize!.width)} × ${Math.round(canvasLogicalSize!.panelHeight)} · 预览缩放：${previewScalePercent(bounds.width, bounds.height, canvasLogicalSize!.width, canvasLogicalSize!.panelHeight)}%`
    })
  }
}

function scheduleFitCanvasPreview(): void {
  if (canvasFitFrozen) return
  clearTimeout(fitCanvasDebounce)
  fitCanvasDebounce = setTimeout(() => {
    if (device.value === "canvas") fitCanvasPreview()
  }, 50)
}

new ResizeObserver(scheduleFitCanvasPreview).observe(canvasWrap)

previewZoomOut.addEventListener("click", () => applyPreviewZoom(previewZoom - 0.1))
previewZoomFit.addEventListener("click", () => {
  setPreviewPan(0, 0)
  applyPreviewZoom(1)
})
previewZoomIn.addEventListener("click", () => applyPreviewZoom(previewZoom + 0.1))
canvasWrap.addEventListener("wheel", (event) => {
  if (deviceShell.hidden) return
  event.preventDefault()
  applyPreviewZoom(
    previewZoom + (event.deltaY < 0 ? 0.1 : -0.1),
    { x: event.clientX, y: event.clientY },
  )
}, { passive: false })

window.addEventListener("blur", () => {
  previewPanCandidate = undefined
  previewPanStart = undefined
  canvasWrap.classList.remove("preview-pan-ready", "preview-panning")
})

canvasWrap.addEventListener("pointerdown", (event) => {
  if (
    event.button !== 0 ||
    event.pointerType === "touch" ||
    deviceShell.hidden ||
    isEditing() && keyMode === "move" && previewPanelViewport.contains(event.target as Node)
  ) return
  previewPanCandidate = {
    pointerId: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    panX: previewPanX,
    panY: previewPanY,
  }
  canvasWrap.classList.add("preview-pan-ready")
})

canvasWrap.addEventListener("pointermove", (event) => {
  if (isEditing() && keyMode === "move" && previewPanelViewport.contains(event.target as Node)) return
  if (!previewPanStart && previewPanCandidate?.pointerId === event.pointerId) {
    const dx = event.clientX - previewPanCandidate.x
    const dy = event.clientY - previewPanCandidate.y
    if (Math.hypot(dx, dy) < 3) return
    previewPanStart = previewPanCandidate
    preview.cancelPointerInteraction()
    canvasWrap.classList.add("preview-panning")
    canvasWrap.setPointerCapture(event.pointerId)
  }
  if (!previewPanStart) return
  event.preventDefault()
  setPreviewPan(
    previewPanStart.panX + event.clientX - previewPanStart.x,
    previewPanStart.panY + event.clientY - previewPanStart.y,
  )
})

function finishPreviewPan(): void {
  previewPanCandidate = undefined
  previewPanStart = undefined
  canvasWrap.classList.remove("preview-pan-ready", "preview-panning")
}

canvasWrap.addEventListener("pointerup", finishPreviewPan)
canvasWrap.addEventListener("pointercancel", finishPreviewPan)

function updateCanvasCandidateGeometry(candidateHeight: number): void {
  if (!canvasLogicalSize) return
  canvasLogicalSize.height = canvasLogicalSize.panelVisibleHeight + candidateHeight
  fitCanvasPreview()
}

function updatePanelTools(
  width: number,
  height: number,
  candidateHeight = 0,
): void {
  const content = previewContentVerticalBounds(
    layoutDocument ? previewItems(layoutDocument, width, height) : [],
    width,
    height,
  )
  deviceShell.style.setProperty("--canvas-width", `${width}px`)
  deviceShell.style.setProperty("--canvas-ratio-width", String(width))
  deviceShell.style.setProperty("--panel-visible-height", String(content.height))
  deviceShell.style.removeProperty("--panel-crop-offset")
  canvasLogicalSize = {
    width,
    height: content.height + candidateHeight,
    panelHeight: height,
    panelVisibleHeight: content.height,
  }
  fitCanvasPreview()
  const states = availableSkinStates(...skinStateDocuments())
  const selected = skinState.value
  const selectedState = selected ? Number(selected) : undefined
  if (selectedState && selectedState <= 122 && !states.includes(selectedState)) {
    states.push(selectedState)
    states.sort((a, b) => a - b)
  }
  skinState.replaceChildren(
    new Option("默认", ""),
    ...states.map((state) => new Option(skinStateLabel(state), String(state))),
  )
  skinState.value = selectedState && states.includes(selectedState) ? selected : ""
  skinStateValue.textContent = skinState.value ? `S${Number(skinState.value)}` : "默认"
  skinStateControl.hidden = states.length === 0
  applySkinState(skinState.value ? Number(skinState.value) : undefined)
  requestAnimationFrame(() => {
    if (device.value === "canvas") return
    const bounds = ($("#preview") as HTMLCanvasElement).getBoundingClientRect()
    panelStatus.textContent = `面板：${Math.round(width)} × ${Math.round(height)} · 预览缩放：${previewScalePercent(bounds.width, bounds.height, width, height)}%`
  })
}

function updateDevicePreview(): void {
  setPreviewPan(0, 0)
  deviceShell.dataset.device = device.value
  deviceShell.dataset.orientation = orientation.value
  deviceShell.dataset.theme = theme.value
  deviceShell.classList.toggle("canvas-only", device.value === "canvas")
  const spec = deviceSpec(device.value)
  const referenceFrame = spec?.family === "iphone" && orientation.value === "port"
  deviceShell.dataset.referenceFrame = String(referenceFrame)
  deviceShell.dataset.accessories = showsKeyboardAccessories(spec, orientation.value)
    ? "visible"
    : "hidden"
  if (spec) {
    deviceShell.dataset.family = spec.family
    const portrait = orientation.value === "port"
    const frame = spec.frame
    deviceShell.style.aspectRatio = portrait
      ? `${referenceFrame ? spec.width * REFERENCE_PHONE_WIDTH_SCALE : frame?.width ?? spec.width} / ${referenceFrame ? spec.height : frame?.height ?? spec.height}`
      : `${frame?.height ?? spec.height} / ${frame?.width ?? spec.width}`
    for (const property of deviceFrameProperties) deviceShell.style.removeProperty(property)
    if (frame) {
      const insetX = (frame.width - frame.screenWidth) / 2
      const insetY = (frame.height - frame.screenHeight) / 2
      const screenRadius = frame.width * 0.26 - insetX
      deviceShell.style.setProperty("--device-screen-inset-x", `${(portrait ? insetX / frame.width : insetY / frame.height) * 100}%`)
      deviceShell.style.setProperty("--device-screen-inset-y", `${(portrait ? insetY / frame.height : insetX / frame.width) * 100}%`)
      deviceShell.style.setProperty("--device-screen-radius", portrait
        ? `${screenRadius / frame.screenWidth * 100}% / ${screenRadius / frame.screenHeight * 100}%`
        : `${screenRadius / frame.screenHeight * 100}% / ${screenRadius / frame.screenWidth * 100}%`)
      const bodyRadius = frame.width * 0.26
      deviceShell.style.setProperty("--device-body-radius", portrait
        ? `${bodyRadius / frame.width * 100}% / ${bodyRadius / frame.height * 100}%`
        : `${bodyRadius / frame.height * 100}% / ${bodyRadius / frame.width * 100}%`)
      deviceShell.style.setProperty("--device-island-width", `${(portrait ? 126 / frame.viewportWidth : 37 / frame.viewportHeight) * 100}%`)
      deviceShell.style.setProperty("--device-island-height", `${(portrait ? 37 / frame.viewportHeight : 126 / frame.viewportWidth) * 100}%`)
      deviceShell.style.setProperty("--device-island-offset", `${11 / frame.viewportHeight * 100}%`)
    }
  } else {
    delete deviceShell.dataset.family
    deviceShell.style.removeProperty("aspect-ratio")
    for (const property of deviceGeometryProperties) deviceShell.style.removeProperty(property)
    for (const property of deviceFrameProperties) deviceShell.style.removeProperty(property)
  }
  preview.setTransparent(devicePreviewTransparent())
  applyPreviewZoom(previewZoom)
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

// ponytail: 复用 resizePng 的画布输出逻辑，按面板精确尺寸拉伸素材图
async function fitPngTo(bytes: Uint8Array, width: number, height: number): Promise<Uint8Array> {
  const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes).buffer], { type: "image/png" }))
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => value ? resolve(value) : reject(new Error("PNG 缩放失败")), "image/png")
  })
  return new Uint8Array(await blob.arrayBuffer())
}

// 复用 fitPngTo 的解码方式，读取像素后只保留 alpha 掩码用于按键网格检测
async function decodePngMask(bytes: Uint8Array): Promise<{ width: number; height: number; mask: Uint8Array }> {
  const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes).buffer], { type: "image/png" }))
  const canvas = document.createElement("canvas")
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const context = canvas.getContext("2d", { willReadFrequently: true })
  context?.drawImage(bitmap, 0, 0)
  bitmap.close()
  if (!context) throw new Error("无法读取图片像素")
  return { width: canvas.width, height: canvas.height, mask: alphaMask(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height) }
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
  scheduleSourceAutosave([...staged.keys()])

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
  mobileShareButton.disabled = busy || !archive
  updatePanelToolButtons()
  updateSourceFileActions()
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

function ios26StylePath(genPath: string): string | undefined {
  if (!archive) return
  const directory = genPath.slice(0, genPath.lastIndexOf("/"))
  const themeRoot = genPath.split("/").slice(0, 2).join("/")
  return [`${directory}/res/default.css`, `${themeRoot}/res/default.css`]
    .find((path) => archive?.isText(path))
}

function adaptArchiveForIos26(): boolean {
  if (!archive) return false
  const staged = new Map<string, string>()
  let variants = 0
  const text = (path: string) => staged.get(path) ?? archive!.getText(path)
  for (const genPath of archive.names().filter((path) => /\/(?:port|land)\/gen\.ini$/i.test(path))) {
    const directory = genPath.slice(0, genPath.lastIndexOf("/"))
    const gen = IniDocument.parse(text(genPath))
    const candidateName = gen.get("CAND", "LAYOUT_NAME") ?? "cand1"
    const candidatePath = `${directory}/${candidateName.replace(/\.cnd$/i, "")}.cnd`
    const stylePath = ios26StylePath(genPath)
    if (!archive.isText(candidatePath) || !stylePath) continue
    variants++
    const adapted = adaptIos26Variant(text(candidatePath), text(genPath), text(stylePath))
    staged.set(candidatePath, adapted.candidate)
    staged.set(genPath, adapted.general)
    staged.set(stylePath, adapted.styles)
    for (const path of archive.names().filter((path) => path.startsWith(`${directory}/`) && /\.ini$/i.test(path))) {
      if (!archive.isText(path)) continue
      const name = path.slice(directory.length + 1)
      staged.set(path, adaptIos26KeyboardLayout(
        name,
        text(path),
        adapted.panelStyle,
        gen.get("MORE", "SYM_LAYOUT") ?? "symbol",
      ))
    }
  }
  const changes: Change[] = [...staged].flatMap(([path, after]) => {
    const before = archive!.getText(path)
    return before === after ? [] : [{ kind: "text" as const, path, before, after }]
  })
  if (!variants) throw new Error("没有找到可适配的候选栏和通用配置。")
  if (!changes.length) return true
  commitBatch(changes)
  renderFiles()
  if (selectedPath && archive.isText(selectedPath)) selectFile(selectedPath)
  refreshPreview()
  updateDirty()
  return true
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
    drawVisualPreview(retinaThumbnail(styleDetailNormal, 128, 88), [await resolver.resolve(selectedStyleID, false).catch(() => undefined)], false)
    drawVisualPreview(retinaThumbnail(styleDetailHighlighted, 128, 88), [await resolver.resolve(selectedStyleID, true).catch(() => undefined)], false)
  }
  styleDetailFields.replaceChildren()
  const existing = stylesDocument.entries(section)
  const common = ["NM_COLOR", "HL_COLOR", "FONT_NAME", "FONT_WEIGHT", "FONT_SIZE", "SHOW", "INFO"]
  const keys = [...common, ...existing.map((entry) => entry.key).filter((key) => !common.includes(key) && key !== "NM_IMG" && key !== "HL_IMG")]
  for (const key of keys) {
    const label = document.createElement("label")
    label.className = "style-detail-field"
    const caption = document.createElement("span")
    caption.textContent = translatedConfigLabel(key)
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
    } else if (key.endsWith("SOUND_PATH")) {
      const filename = stylesDocument.get(section, key) ?? ""
      const soundPaths = currentSoundEntries()
      const soundPath = soundPathForFilename(archive.names(), theme.value, orientation.value, filename)
      const card = document.createElement("span")
      card.className = "style-detail-sound-card"
      const playButton = document.createElement("button")
      playButton.type = "button"
      playButton.className = "style-detail-sound-play"
      playButton.disabled = !soundPath
      playButton.title = soundPath ? `播放 ${filename}` : "当前声音文件不存在"
      playButton.setAttribute("aria-label", playButton.title)
      playButton.append(createSystemSymbol("play.fill"))
      playButton.addEventListener("click", () => {
        if (soundPath) playSoundPath(soundPath)
      })
      const select = document.createElement("select")
      select.disabled = !isEditing()
      select.setAttribute("aria-label", `选择 ${key} 声音文件`)
      if (filename && !soundPaths.some((entry) => entry.filename === filename)) {
        select.append(new Option(`${filename}（文件不存在）`, filename))
      }
      select.append(new Option("不使用声音", ""))
      for (const entry of soundPaths) select.append(new Option(entry.filename, entry.filename))
      select.value = filename
      select.addEventListener("change", () => updateField(select.value))
      card.append(playButton, select)
      row.append(card)
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
  const category = resourceCategory.value
  const styleIDs = availableStyleIDs().filter((styleID) => {
    const entries = stylesDocument.entries(`STYLE${styleID}`)
    const hasSound = Boolean(stylesDocument.get(`STYLE${styleID}`, "PRESS_SOUND_PATH")?.trim())
    if (category === "sound" && !hasSound || category === "visual" && hasSound) return false
    return !query || styleID.includes(query) || entries.some((entry) =>
      (entry.key === "INFO" || entry.key === "SHOW") && entry.value.toLowerCase().includes(query),
    )
  })
  resourceListTitle.textContent = "样式配置"
  resourceSearch.placeholder = "搜索样式"
  resourceSearch.setAttribute("aria-label", "搜索样式")
  resourceSearchControl.setAttribute("aria-label", "搜索样式")
  resourceCategory.hidden = false
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
    const soundFilename = stylesDocument.get(`STYLE${styleID}`, "PRESS_SOUND_PATH")?.trim()
    const soundPath = soundFilename
      ? soundPathForFilename(archive.names(), theme.value, orientation.value, soundFilename)
      : undefined
    if (soundFilename) {
      button.classList.add("has-sound")
      const badge = createSystemSymbol("play")
      badge.classList.add("sound-style-badge")
      badge.title = soundPath ? `点击试听 ${soundFilename}` : `声音文件不存在：${soundFilename}`
      button.append(badge)
    }
    const previews = document.createElement("span")
    previews.className = "resource-style-previews"
    for (const highlighted of [false, true]) {
      const canvas = retinaThumbnail(document.createElement("canvas"), 128, 88)
      drawVisualPreview(canvas, [await resolver.resolve(styleID, highlighted).catch(() => undefined)], false)
      previews.append(canvas)
    }
    const name = document.createElement("strong")
    name.textContent = `STYLE${styleID}`
    const entries = stylesDocument.entries(`STYLE${styleID}`)
    const meta = document.createElement("small")
    meta.textContent = soundFilename
      || entries.find((entry) => entry.key === "INFO")?.value
      || entries.find((entry) => entry.key === "SHOW")?.value
      || `${entries.length} 项配置`
    button.append(previews, name, meta)
    button.addEventListener("click", () => {
      selectGalleryItem(`STYLE${styleID}`, resourceGallery)
      if (soundPath) playSoundPath(soundPath)
    })
    button.addEventListener("dblclick", () => {
      selectGalleryItem(`STYLE${styleID}`, resourceGallery)
      selectStyleResource(styleID)
    })
    resourceGallery.append(button)
  }
  if (selectedResourceGalleryPath) selectGalleryItem(selectedResourceGalleryPath, resourceGallery)
}

type SoundEntry = {
  id: string
  label: string
  filename: string
  path: string
  usage: string
}

function currentSoundEntries(): SoundEntry[] {
  if (!archive) return []
  return soundResourcePaths(archive.names(), theme.value, orientation.value).map((path) => {
    const filename = path.split("/").pop() ?? path
    return {
      id: `file:${path}`,
      label: filename,
      filename,
      path,
      usage: path.split("/").slice(0, -1).join("/"),
    }
  })
}

function renderSoundResourceGallery(): void {
  if (!archive) return
  const query = resourceSearch.value.trim().toLowerCase()
  const entries = currentSoundEntries().filter((entry) =>
    !query || `${entry.label} ${entry.filename} ${entry.usage}`.toLowerCase().includes(query)
  )
  resourceListTitle.textContent = "按键音效"
  resourceSearch.placeholder = "搜索按键音效"
  resourceSearch.setAttribute("aria-label", "搜索按键音效")
  resourceSearchControl.setAttribute("aria-label", "搜索按键音效")
  resourceCategory.hidden = true
  resourceCount.textContent = `${entries.length} 个音效文件`
  resourceUploadInput.accept = SOUND_ACCEPT
  resourceUploadButton.hidden = false
  resourceUploadButton.title = selectedSoundID ? "替换选中按键音效" : "添加按键音效"
  resourceUploadButton.setAttribute("aria-label", resourceUploadButton.title)
  styleAddButton.hidden = true
  resourceDownloadButton.hidden = false
  resourceDownloadButton.title = "下载选中按键音效"
  resourceDownloadButton.setAttribute("aria-label", resourceDownloadButton.title)
  resourceDeleteButton.hidden = true
  resourceListView.hidden = false
  resourceDetail.hidden = true
  for (const entry of entries) {
    const button = document.createElement("button")
    button.className = "resource-item sound-resource-item"
    button.dataset.path = entry.id
    button.title = `${entry.label} · 点击试听`
    const icon = createSystemSymbol("speaker.wave.2")
    icon.classList.add("sound-resource-icon")
    const name = document.createElement("strong")
    name.textContent = entry.label
    const meta = document.createElement("small")
    meta.textContent = `${entry.filename} · ${entry.usage}`
    button.append(icon, name, meta)
    button.addEventListener("click", () => {
      selectedSoundID = entry.id
      selectGalleryItem(entry.id, resourceGallery)
      resourceUploadButton.title = "替换选中按键音效"
      resourceUploadButton.setAttribute("aria-label", resourceUploadButton.title)
      playSoundPath(entry.path)
    })
    resourceGallery.append(button)
  }
  if (selectedSoundID) selectGalleryItem(selectedSoundID, resourceGallery)
}

function renderResourceInspector(): void {
  if (!archive) return
  releaseResourceURLs()
  resourceGallery.replaceChildren()
  if (resourceInspectorMode === "style") {
    void renderStyleResourceGallery()
    return
  }
  if (resourceInspectorMode === "sound") {
    renderSoundResourceGallery()
    return
  }
  resourceListTitle.textContent = "皮肤图片"
  resourceSearch.placeholder = "搜索图片"
  resourceSearch.setAttribute("aria-label", "搜索图片")
  resourceSearchControl.setAttribute("aria-label", "搜索图片")
  resourceCategory.hidden = true
  resourceUploadInput.accept = ".png,image/png"
  resourceUploadButton.hidden = false
  resourceUploadButton.title = "上传图片"
  resourceUploadButton.setAttribute("aria-label", resourceUploadButton.title)
  styleAddButton.hidden = true
  resourceDownloadButton.hidden = false
  resourceDownloadButton.title = "下载选中图片"
  resourceDownloadButton.setAttribute("aria-label", resourceDownloadButton.title)
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
  sourceLineNumbers.textContent = Array.from(
    { length: source.value.split(/\r\n|\n|\r/).length },
    (_, index) => String(index + 1),
  ).join("\n")
  updateSourceSearchStatus()
}

function sourceSearchMatches(): number[] {
  const query = sourceSearch.value.trim().toLocaleLowerCase()
  if (!query) return []
  const text = source.value.toLocaleLowerCase()
  const matches: number[] = []
  for (let index = text.indexOf(query); index >= 0; index = text.indexOf(query, index + query.length)) {
    matches.push(index)
  }
  return matches
}

function updateSourceSearchStatus(): void {
  const matches = sourceSearchMatches()
  if (sourceSearchIndex >= matches.length) sourceSearchIndex = -1
  sourceSearchCount.textContent = sourceSearch.value.trim()
    ? `${sourceSearchIndex < 0 ? 0 : sourceSearchIndex + 1}/${matches.length}`
    : ""
}

function syncSourceScroll(): void {
  const highlight = $("#source-highlight")
  highlight.scrollTop = source.scrollTop
  highlight.scrollLeft = source.scrollLeft
  sourceLineNumbers.scrollTop = source.scrollTop
}

function findSourceMatch(direction: 1 | -1): void {
  const matches = sourceSearchMatches()
  if (!matches.length) {
    sourceSearchIndex = -1
    updateSourceSearchStatus()
    return
  }
  sourceSearchIndex = sourceSearchIndex < 0
    ? direction > 0 ? 0 : matches.length - 1
    : (sourceSearchIndex + direction + matches.length) % matches.length
  const start = matches[sourceSearchIndex]
  source.setSelectionRange(start, start + sourceSearch.value.trim().length)
  const line = source.value.slice(0, start).split(/\r\n|\n|\r/).length - 1
  const style = getComputedStyle(source)
  const lineHeight = Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize) * 1.6
  source.scrollTop = Math.max(0, line * lineHeight - source.clientHeight / 3)
  syncSourceScroll()
  updateSourceSearchStatus()
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
  syncSourceScroll()
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

// LIST 候选栏单元的几何（POS/CELL_SIZE）可能定义在布局自身或 gen.ini（候选栏几何通常全局共享）
function listGeometryDocument(): { document: IniDocument; path: string } | undefined {
  if (!archive || !layoutDocument) return
  if (layoutDocument.get("LIST", "POS") !== undefined || layoutDocument.get("LIST", "CELL_SIZE") !== undefined) {
    return { document: layoutDocument, path: layoutPath }
  }
  const path = genConfigPath()
  if (archive.isText(path)) return { document: IniDocument.parse(archive.getText(path)), path }
  return { document: layoutDocument, path: layoutPath }
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

function applyCandidateGeometry(
  document: IniDocument,
  width: number,
): void {
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

function refreshToolbarPreview(
  composing: boolean,
  resolver: VisualResolver,
): { width: number; height: number; inputHeight: number } | undefined {
  if (isConfiguredSymbolLayout(layoutPath, textDocument(genConfigPath()))) {
    delete toolbarStrip.dataset.path
    toolbarStrip.hidden = true
    candidateBackgroundCanvas.hidden = true
    return
  }
  const path = toolbarConfigPath()
  const document = path ? textDocument(path) : undefined
  if (!archive || !path || !document) {
    delete toolbarStrip.dataset.path
    toolbarStrip.hidden = true
    candidateBackgroundCanvas.hidden = true
    return
  }
  const gen = textDocument(genConfigPath())
  const size = gen?.get("CAND", "VIEW_RECT")?.split(",").map(Number)
  toolbarStrip.hidden = false
  toolbarStrip.dataset.path = path
  toolbarPreview.setResolver(resolver)
  toolbarPreview.setOffsets(gen)
  toolbarPreview.setDefaults(gen)
  toolbarPreview.setPersistentOnly(composing)
  toolbarPreview.setTheme(theme.value === "dark" ? "dark" : "light")
  toolbarPreview.setTransparent(true)
  const width = size?.length === 4 && Number.isFinite(size[2]) ? size[2] : DEFAULT_PANEL_WIDTH
  const height = size?.length === 4 && Number.isFinite(size[3]) ? size[3] : DEFAULT_CANDIDATE_HEIGHT
  const inputStyle = resolveCandidateInputStyle(gen, resolver, width)
  const inputHeight = inputStyle.height
  const totalHeight = height + inputHeight
  const backgroundStyle = document.get("CAND", "BACK_STYLE")?.split(",")[0] ??
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
  toolbarCanvas.style.setProperty("--toolbar-height", String(totalHeight))
  toolbarCanvas.style.setProperty("--candidate-input-height", String(inputHeight))
  applyCandidateGeometry(document, width)
  const toolbarDocument = IniDocument.parse(document.toString())
  toolbarDocument.set("CAND", "BACK_STYLE", "")
  toolbarPreview.setPanel("", width, height)
  toolbarPreview.setDocument(toolbarDocument)
  toolbarPreview.setMode("preview")
  return { width, height: totalHeight, inputHeight }
}

function commonSelectedStyle(name: "BACK_STYLE" | "FORE_STYLE"): string | undefined {
  if (!layoutDocument || !selectedKeySections.length) return
  const values = selectedKeySections.map((section) =>
    isListCell(section)
      ? (layoutDocument?.get("LIST", name) ?? "").trim()
      : layoutDocument?.get(section, name)?.trim() ?? "",
  )
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

function retinaThumbnail(canvas: HTMLCanvasElement, cssWidth: number, cssHeight: number): HTMLCanvasElement {
  const ratio = window.devicePixelRatio || 1
  canvas.width = Math.max(1, Math.round(cssWidth * ratio))
  canvas.height = Math.max(1, Math.round(cssHeight * ratio))
  return canvas
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
const styleReferenceDrawIDs = new WeakMap<HTMLButtonElement, number>()

function styleReferenceKey(input: HTMLInputElement): string {
  return input.dataset.keyboardField ?? input.dataset.toolbarField ?? input.dataset.keyField ?? input.dataset.documentStyleKey ?? ""
}

function isStyleReferenceKey(key: string): boolean {
  if (key === "STAT_STYLE") return false
  return key === "styleID" || /(?:^|\.)(?:[A-Z0-9_]*STYLE|FIRST_BACK|FIRST_FORE)$/i.test(key)
}

function soundPathForStyle(styleID: string): string | undefined {
  if (!archive) return
  const path = styleConfigPath()
  if (!archive.isText(path)) return
  const filename = IniDocument.parse(archive.getText(path)).get(`STYLE${styleID}`, "PRESS_SOUND_PATH")?.trim()
  return filename ? soundPathForFilename(archive.names(), theme.value, orientation.value, filename) : undefined
}

function decorateStyleReferenceInput(input: HTMLInputElement, key = styleReferenceKey(input)): void {
  if (!isStyleReferenceKey(key) || input.closest(".style-reference-input")) return
  const soundStyle = key === "SOUND_STYLE"
  input.dataset.documentStyleKey ||= key
  const parent = input.parentNode
  if (!parent) return
  const wrapper = document.createElement("span")
  wrapper.className = "style-reference-input"
  wrapper.classList.toggle("sound-style-reference", soundStyle)
  parent.insertBefore(wrapper, input)
  wrapper.append(input)
  const button = document.createElement("button")
  button.type = "button"
  button.className = "style-picker-trigger"
  button.classList.toggle("sound-style-trigger", soundStyle)
  button.title = "点击更换样式；Command/Ctrl 点击编辑样式"
  button.setAttribute("aria-label", "更换或编辑引用样式")
  if (soundStyle) {
    button.append(createSystemSymbol("speaker.wave.2"), Object.assign(document.createElement("span"), { textContent: "更换" }))
  } else {
    const previews = document.createElement("span")
    previews.className = "style-picker-states"
    for (let index = 0; index < 2; index += 1) {
      const item = document.createElement("span")
      item.className = "style-picker-state"
      const canvas = retinaThumbnail(document.createElement("canvas"), 152, 76)
      canvas.setAttribute("aria-hidden", "true")
      item.append(canvas)
      previews.append(item)
    }
    button.append(previews)
  }
  button.addEventListener("click", (event) => {
    if (event.metaKey || event.ctrlKey) openStyleReferenceEditor(input.value.split(",")[0]?.trim() ?? "")
    else openStylePicker(input)
  })
  input.addEventListener("input", () => void refreshStyleReferenceThumbnail(button, input, key))
  input.addEventListener("change", () => void refreshStyleReferenceThumbnail(button, input, key))
  void refreshStyleReferenceThumbnail(button, input, key)
  wrapper.append(button)
  if (soundStyle) {
    const playButton = document.createElement("button")
    playButton.type = "button"
    playButton.className = "sound-style-play"
    playButton.setAttribute("aria-label", "播放按键音效")
    playButton.append(createSystemSymbol("play.fill"))
    playButton.addEventListener("click", () => {
      const path = soundPathForStyle(input.value.split(",")[0]?.trim() ?? "")
      if (path) playSoundPath(path)
    })
    wrapper.append(playButton)
    void refreshStyleReferenceThumbnail(button, input, key)
  }
}

function styleReferenceForeground(key: string): boolean {
  return /FORE|INPUT_STYLE|SCAND_STYLE|CELL_STYLE/.test(key)
}

async function refreshStyleReferenceThumbnail(
  button: HTMLButtonElement,
  input: HTMLInputElement,
  key: string,
): Promise<void> {
  const drawID = (styleReferenceDrawIDs.get(button) ?? 0) + 1
  styleReferenceDrawIDs.set(button, drawID)
  if (key === "SOUND_STYLE") {
    const styleID = input.value.split(",")[0]?.trim() ?? ""
    const path = soundPathForStyle(styleID)
    const playButton = button.parentElement?.querySelector<HTMLButtonElement>(".sound-style-play")
    if (playButton) {
      playButton.disabled = !path
      playButton.title = path ? `播放 ${path.split("/").pop() ?? path}` : "当前声音样式没有可播放的音效文件"
    }
    button.classList.toggle("has-sound", Boolean(path))
    return
  }
  const canvases = Array.from(button.querySelectorAll<HTMLCanvasElement>("canvas"))
  const resolver = visualResolver()
  const styleIDs = input.value.split(",").map((value) => value.trim()).filter(Boolean)
  if (canvases.length < 2 || !resolver || !styleIDs.length) {
    for (const canvas of canvases) {
      const context = canvas.getContext("2d")
      context?.clearRect(0, 0, canvas.width, canvas.height)
    }
    return
  }
  const visuals = await Promise.all([false, true].map((highlighted) => Promise.all(
    styleIDs.map((styleID) => resolver.resolve(styleID, highlighted).catch(() => undefined)),
  )))
  if (drawID !== styleReferenceDrawIDs.get(button)) return
  visuals.forEach((layers, index) => drawVisualPreview(canvases[index], layers, styleReferenceForeground(key)))
}

function openStyleReferenceEditor(styleID: string): void {
  if (!styleID || !availableStyleIDs().includes(styleID)) return
  const path = styleConfigPath()
  if (!archive?.isText(path)) return
  const returnPath = selectedPath
  const returnSelection = [...selectedKeySections]
  const returnScrollTop = quickInspector.scrollTop
  const returnInspectorGroup = quickInspector.dataset.mobileInspectorGroup ?? ""
  selectFile(path, "overview", "style")
  styleReturnPath = returnPath === path ? "" : returnPath
  styleReturnSelection = returnSelection
  styleReturnScrollTop = returnScrollTop
  styleReturnInspectorGroup = returnInspectorGroup
  selectStyleResource(styleID)
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
  const soundOnly = styleReferenceKey(stylePickerTarget!) === "SOUND_STYLE"
  const stylesPath = styleConfigPath()
  const styles = archive?.isText(stylesPath) ? IniDocument.parse(archive.getText(stylesPath)) : undefined
  const styleIDs = availableStyleIDs().filter((styleID) => {
    const filename = styles?.get(`STYLE${styleID}`, "PRESS_SOUND_PATH")?.trim() ?? ""
    return (!query || styleID.toLowerCase().includes(query) || filename.toLowerCase().includes(query))
      && (!soundOnly || Boolean(filename))
  })
  const resolver = visualResolver()
  stylePickerGrid.replaceChildren()
  stylePickerCount.textContent = `${styleIDs.length} 个${soundOnly ? "声音" : ""}样式`
  stylePickerEmpty.hidden = styleIDs.length > 0
  if (soundOnly) {
    for (const styleID of styleIDs) {
      const filename = styles?.get(`STYLE${styleID}`, "PRESS_SOUND_PATH")?.trim() ?? ""
      const card = document.createElement("div")
      card.className = "style-picker-item style-picker-sound"
      card.classList.toggle("selected", stylePickerTarget?.value.split(",")[0]?.trim() === styleID)
      const button = document.createElement("button")
      button.type = "button"
      button.className = "style-picker-sound-select"
      button.title = `点击使用声音样式 ${styleID}；Command/Ctrl 点击编辑`
      const icon = createSystemSymbol("music.note")
      icon.classList.add("style-picker-sound-icon")
      const label = document.createElement("strong")
      label.textContent = `STYLE${styleID}`
      const filenameNode = document.createElement("small")
      filenameNode.textContent = filename
      button.append(icon, label, filenameNode)
      button.addEventListener("click", (event) => {
        if (event.metaKey || event.ctrlKey) {
          stylePickerDialog.close()
          openStyleReferenceEditor(styleID)
          return
        }
        if (!stylePickerTarget) return
        stylePickerTarget.value = styleID
        stylePickerTarget.dispatchEvent(new Event("input", { bubbles: true }))
        stylePickerTarget.dispatchEvent(new Event("change", { bubbles: true }))
        stylePickerDialog.close()
      })
      const soundPath = soundPathForFilename(archive?.names() ?? [], theme.value, orientation.value, filename)
      const playButton = document.createElement("button")
      playButton.type = "button"
      playButton.className = "style-picker-sound-play"
      playButton.disabled = !soundPath
      playButton.title = soundPath ? `播放 ${filename}` : "声音文件不存在"
      playButton.setAttribute("aria-label", playButton.title)
      playButton.append(createSystemSymbol("play.fill"))
      playButton.addEventListener("click", () => {
        if (soundPath) playSoundPath(soundPath)
      })
      card.append(button, playButton)
      stylePickerGrid.append(card)
    }
    return
  }
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
    button.classList.toggle("selected", stylePickerTarget?.value.split(",")[0]?.trim() === styleID)
    button.title = `点击使用样式 ${styleID}；Command/Ctrl 点击编辑`
    const label = document.createElement("strong")
    label.textContent = styleID
    const previews = document.createElement("span")
    previews.className = "style-picker-previews"
    for (const [index, visual] of visuals.entries()) {
      const canvas = retinaThumbnail(document.createElement("canvas"), 128, 88)
      canvas.setAttribute("aria-label", index === 0 ? "正常状态" : "按下状态")
      drawVisualPreview(canvas, [visual], foreground)
      previews.append(canvas)
    }
    button.append(label, previews)
    button.addEventListener("click", (event) => {
      if (event.metaKey || event.ctrlKey) {
        stylePickerDialog.close()
        openStyleReferenceEditor(styleID)
        return
      }
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

async function updateStylePreviews(): Promise<void> {
  refreshStyleReferenceThumbnails()
}

function refreshStyleReferenceThumbnails(): void {
  for (const button of Array.from(document.querySelectorAll<HTMLButtonElement>(".style-picker-trigger"))) {
    const input = button.previousElementSibling
    if (input instanceof HTMLInputElement) {
      void refreshStyleReferenceThumbnail(button, input, styleReferenceKey(input))
    }
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
    selectedKeySections.map((section) =>
      isListCell(section)
        ? (layoutDocument?.get("LIST", "FORE_STYLE") ?? "").trim()
        : layoutDocument?.get(section, "FORE_STYLE") ?? "",
    ),
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

baiduActionCodes.replaceChildren(...knownFunctionCodes.map((value) => {
  return new Option(actionDescription(value), value)
}))

function syncActionCodeSuggestions(field: HTMLInputElement): void {
  if (!actionFieldNames.has(field.dataset.keyField ?? "")) return
  if (shouldSuggestActionCodes(field.value)) field.setAttribute("list", "baidu-action-codes")
  else field.removeAttribute("list")
}

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
  OFFSET: "偏移",
  FORE_STYLE_NUM: "前景样式数量",
  INPUT_STYLE: "输入区样式",
  SCAND_STYLE: "次选区样式",
  MORE_STYLE: "更多按钮样式",
  BG_COLOR: "背景颜色",
  FONT_NAME: "字体",
  FONT_WEIGHT: "字重",
  FONT_SIZE: "字号",
  NM_COLOR: "正常颜色",
  HL_COLOR: "按下颜色",
  SHOW: "显示内容",
  INFO: "说明",
}

const documentSectionLabels: Record<string, string> = {
  PANEL: "面板",
  INPUT: "输入区",
  CAND: "候选栏",
  SCAND: "次选区",
  HINT: "提示栏",
  MORE: "更多按钮",
  LOGO: "输入法标识",
  EMOJI: "表情面板",
}

function translatedConfigLabel(key: string): string {
  return `${documentFieldLabels[key] ?? "扩展配置"}（${key}）`
}

function translatedSectionLabel(section: string): string {
  const offset = section.match(/^OFFSET(\d+)$/)
  const label = offset ? `偏移 ${offset[1]}` : documentSectionLabels[section] ?? "扩展区域"
  return `${label}（${section}）`
}

function isHiddenConfigEntry(section: string, key: string): boolean {
  return /^(?:OFFSET|TIP)\d*$/i.test(section) || /^(?:OFFSET|TIP)(?:_|\d|$)/i.test(key)
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
    !/^KEY\d+$/.test(entry.section) &&
    !isHiddenConfigEntry(entry.section, entry.key) &&
    !specialized.has(`${entry.section}\u0000${entry.key}`),
  )
  documentFieldsGroup.hidden = entries.length === 0
  if (!entries.length) return

  const sections = [...new Set(entries.map((entry) => entry.section))]
  for (const [sectionIndex, section] of sections.entries()) {
    const sectionPanel = document.createElement("section")
    sectionPanel.className = "document-property-section"
    const heading = document.createElement("h3")
    heading.textContent = section ? translatedSectionLabel(section) : "基本信息"
    const grid = document.createElement("div")
    grid.className = "document-property-grid"
    for (const entry of entries.filter((item) => item.section === section)) {
      const label = document.createElement("label")
      label.className = "document-property-field"
      if (isStyleReferenceKey(entry.key)) label.classList.add("style-reference-field")
      if (entry.value.length > 18 || /(?:RECT|IMG|PADDING|ORDER|LIST|SOURCE|FONT_NAME)/.test(entry.key)) {
        label.classList.add("wide")
      }
      const caption = document.createElement("span")
      caption.textContent = translatedConfigLabel(entry.key)
      caption.title = entry.key
      const input = document.createElement("input")
      input.value = entry.value
      input.classList.add("document-property-input")
      input.title = `${translatedConfigLabel(entry.key)}：${entry.value}`
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
    sectionPanel.append(heading, grid)
    documentFields.append(sectionPanel)
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
    selectFile(path, "overview", navMode === "resource" ? "image" : navMode === "style" ? "style" : navMode === "sound" ? "sound" : "document")
    if (mobilePortraitQuery.matches) setMobilePane("inspector")
  })
  parent.append(button)
}

function populateKeyInspector(): void {
  if (selectedPath !== layoutPath && selectedKeySections.length) {
    selectedKeySections = []
    preview.setSelected([])
  }
  const document = layoutDocument
  const sections = selectedKeySections
  const hasSelection = Boolean(document && sections.length && selectedPath === layoutPath)
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
      ? isListCell(sections[0])
        ? "LIST · 候选栏"
        : `${sections[0]} · ${document?.get(sections[0], "CENTER") || "未配置点击动作"}`
      : `已选择 ${sections.length} 个按键`
  syncMobileInspectorHeader()
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
  const soundGeneral = archive?.isText(genConfigPath())
    ? IniDocument.parse(archive.getText(genConfigPath()))
    : undefined
  for (const field of keyFields) {
    const name = field.dataset.keyField ?? ""
    field.disabled = !hasSelection || archive?.format === "bda"
    field.placeholder = ""
    if (!hasSelection) {
      field.value = ""
      continue
    }
    if (isListCell(sections[0]) && sections.length === 1) {
      if (name === "height") {
        // 整体高度 = CELL_SIZE 高 × LIST_NUM；LIST_NUM 在布局文档，几何在定义处（布局或 gen.ini）
        const geometry = listGeometryDocument()
        const count = Number(document?.get("LIST", "LIST_NUM")) || 1
        field.value = geometry ? listCellValue(geometry.document, sections[0], "height", count) : ""
      } else if (["x", "y", "width"].includes(name)) {
        const geometry = listGeometryDocument()
        field.value = geometry ? listCellValue(geometry.document, sections[0], name) : ""
      } else {
        field.value = name === "SOUND_STYLE"
          ? soundStyleForKey(document!, "LIST", soundGeneral) ?? ""
          : listCellValue(document, sections[0], name)
      }
      continue
    }
    const rectIndex = ["x", "y", "width", "height"].indexOf(name)
    const values = sections.map((section) => {
      if (rectIndex < 0) return name === "SOUND_STYLE"
        ? soundStyleForKey(document!, section, soundGeneral) ?? ""
        : document?.get(section, name) ?? ""
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
  const listSelected = sections.some(isListCell)
  const keyToolsAvailable = hasSelection && isEditing() && archive?.format !== "bda" && !listSelected
  for (const button of keyModeButtons) button.disabled = !keyToolsAvailable
  for (const button of keyActionButtons) {
    button.disabled = !keyToolsAvailable || (
      button.dataset.keyAction === "swap" && selectedKeySections.length !== 2
    )
  }
  if (!keyToolsAvailable && keyMode === "move") {
    keyMode = "select"
    keyModeButtons.forEach((button) => button.classList.toggle("active", button.dataset.keyMode === keyMode))
    preview.setEditTool(keyMode)
  }
  for (const button of layoutActionButtons) {
    button.disabled = archive?.format === "bda" || listSelected || (
      button.dataset.layoutAction === "swap" || button.dataset.layoutAction === "merge"
        ? selectedKeySections.length !== 2
        : selectedKeySections.length < 2
    )
  }
  const rects = selectedRects().filter((rect) => !isListCell(rect.section))
  for (const field of gapFields) {
    field.disabled = rects.length < 2 || archive?.format === "bda" || listSelected
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
        : actionDescription(values[0])
  }
  for (const field of keyFields) syncActionCodeSuggestions(field)
  void updateStylePreviews()
  populateDocumentInspector()
  populateBdaConfigInspector()
  syncMobileInspectorGroups()
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

function renameDocumentTitle(): void {
  const currentNode = $("#document-name")
  const currentArchive = archive
  if (!currentArchive || currentNode.parentElement?.querySelector("input")) return
  const current = currentNode.textContent?.trim() ?? ""
  if (!current || current === "未打开皮肤") return
  const input = document.createElement("input")
  input.type = "text"
  input.value = current
  input.setAttribute("aria-label", "皮肤名称")
  const title = documentName.parentElement
  if (!title) return
  currentNode.replaceWith(input)
  input.select()
  input.focus()

  let finished = false
  const finish = (save: boolean): void => {
    if (finished) return
    finished = true
    const next = save ? input.value.trim() : current
    const label = document.createElement("strong")
    label.id = "document-name"
    label.setAttribute("role", "button")
    label.tabIndex = 0
    label.title = "点击修改皮肤名称"
    label.textContent = next || current
    input.replaceWith(label)
    if (!save || !next || next === current) return
    // Keep the archive's skin metadata in sync with the title when available.
    const infoPath = currentArchive.names().includes(`${theme.value}/skin/Info.txt`)
      ? `${theme.value}/skin/Info.txt`
      : currentArchive.names().includes("Info.txt") ? "Info.txt" : undefined
    if (infoPath && currentArchive.isText(infoPath)) {
      const info = infoPath === selectedPath && selectedDocument
        ? selectedDocument
        : IniDocument.parse(currentArchive.getText(infoPath))
      const before = info.toString()
      info.set("", "Name", next)
      const after = info.toString()
      if (before !== after) {
        commitText(infoPath, before, after)
        if (infoPath === selectedPath) {
          selectedDocument = info
          setSourceValue(after)
          populateKeyInspector()
        }
      }
    }
    updateDirty()
  }
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault()
      finish(true)
    } else if (event.key === "Escape") {
      event.preventDefault()
      finish(false)
    }
  })
  input.addEventListener("blur", () => finish(true), { once: true })
}

documentName.parentElement?.addEventListener("click", (event) => {
  if ((event.target as HTMLElement).id === "document-name") renameDocumentTitle()
})
documentName.parentElement?.addEventListener("keydown", (event) => {
  if ((event.target as HTMLElement).id !== "document-name") return
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault()
    renameDocumentTitle()
  }
})

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
  const name = field.dataset.keyField ?? ""
  const rectNames = ["x", "y", "width", "height"]
  if (selectedKeySections.length === 1 && isListCell(selectedKeySections[0])) {
    // LIST 候选栏单元：几何字段写回定义处（布局或 gen.ini），其余写回布局的 [LIST]
    if (rectNames.includes(name)) {
      const geometry = listGeometryDocument()
      if (!geometry) return
      const before = geometry.document.toString()
      const count = name === "height"
        ? Number(layoutDocument.get("LIST", "LIST_NUM")) || 1
        : undefined
      setListCellValue(geometry.document, selectedKeySections[0], name, field.value, count)
      const text = geometry.document.toString()
      if (text === before) return
      commitText(geometry.path, before, text)
      if (selectedPath === geometry.path) setSourceValue(text)
      refreshPreview()
    } else {
      const before = layoutDocument.toString()
      setListCellValue(layoutDocument, selectedKeySections[0], name, field.value)
      const text = layoutDocument.toString()
      commitText(layoutPath, before, text)
      if (selectedPath === layoutPath) setSourceValue(text)
      preview.setDocument(layoutDocument)
    }
    populateKeyInspector()
    updateDirty()
    return
  }
  const before = layoutDocument.toString()
  const rectIndex = rectNames.indexOf(name)
  for (const section of preview.expandSections(selectedKeySections)) {
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
    ? [...new Set(selectedKeySections.flatMap((key) => {
        const backStyle = isListCell(key)
          ? layoutDocument?.get("LIST", "BACK_STYLE") ?? ""
          : layoutDocument?.get(key, source) ?? ""
        const id = backStyle.split(",")[0]?.trim()
        return id && /^\d+$/.test(id) ? [`STYLE${id}`] : []
      }))]
    : [...new Set(selectedKeySections.flatMap((key) => {
        const foreStyle = isListCell(key)
          ? layoutDocument?.get("LIST", "FORE_STYLE") ?? ""
          : layoutDocument?.get(key, source) ?? ""
        return foreStyle.split(",").map((token) => token.trim()).flatMap((token) => {
          const value = Number(token)
          return [`STYLE${token}`, Number.isFinite(value) ? `STYLE${Math.floor(value / 100)}` : ""]
        }).filter((section) => section && document.sections().includes(section))
      }))]
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
  if (isTauri()) {
    for (const label of ["image-picker", "resource-picker"]) {
      void WebviewWindow.getByLabel(label).then((pickerWindow) => pickerWindow?.close())
    }
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
    if (isListCell(section)) {
      const rect = listCellRect(layoutDocument, section)
      return rect ? [rect] : []
    }
    const values = layoutDocument?.get(section, "VIEW_RECT")?.split(",").map(Number)
    if (!values || values.length !== 4 || values.some((value) => !Number.isFinite(value))) return []
    const [x, y, width, height] = values
    return [{ section, x, y, width, height }]
  })
}

function applyLayoutAction(action: string): void {
  if (!archive || !layoutDocument) return
  if (action === "merge") {
    mergeSelectedKeys()
    return
  }
  const real = selectedRects().filter((rect) => !isListCell(rect.section))
  const rects = transformLayout(real, action as LayoutAction)
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

function mergeSelectedKeys(): void {
  if (!archive || !layoutDocument) return
  const rects = selectedRects().filter((rect) => !isListCell(rect.section))
  if (rects.length !== 2) return
  const before = layoutDocument.toString()
  const merged = mergeLayoutRects(rects[0], rects[1])
  layoutDocument.set(merged.section, "VIEW_RECT", [merged.x, merged.y, merged.width, merged.height].map(Math.round).join(","))
  if (!layoutDocument.removeSections([rects[1].section])) return
  const text = layoutDocument.toString()
  commitText(layoutPath, before, text)
  if (selectedPath === layoutPath) setSourceValue(text)
  selectedKeySections = [merged.section]
  preview.setDocument(layoutDocument)
  preview.setSelected(selectedKeySections)
  populateKeyInspector()
  updateSourceHighlight()
  updateDirty()
}

function applyExactGap(field: HTMLInputElement): void {
  if (!archive || !layoutDocument) return
  const gap = Number(field.value)
  if (!Number.isFinite(gap)) return
  const rects = setExactGap(
    selectedRects().filter((rect) => !isListCell(rect.section)),
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

function moveSelectedKeys(
  deltaX: number,
  deltaY: number,
  sections: readonly string[] = selectedKeySections,
): void {
  if (!archive || !layoutDocument) return
  const rects = moveRects(sections.flatMap((section) => {
    const values = layoutDocument?.get(section, "VIEW_RECT")?.split(",").map(Number)
    if (!values || values.length !== 4 || values.some((value) => !Number.isFinite(value))) return []
    const [x, y, width, height] = values
    return [{ section, x, y, width, height }]
  }), deltaX, deltaY)
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
  sourceFileToolbar.hidden = view !== "source"
  updateSourceFileActions()
}

function sourceSelection(): { path: string; folder: boolean } | undefined {
  if (!selectedFileButton?.closest(".raw-files")) return
  const path = selectedFileButton.dataset.path
    ?? selectedFileButton.dataset.folderPath
    ?? selectedFileButton.closest<HTMLDetailsElement>("details.raw-folder")?.dataset.folderPath
  return path ? { path, folder: !selectedFileButton.dataset.path } : undefined
}

function updateSourceFileActions(): void {
  const selection = sourceSelection()
  const editable = Boolean(archive) && isEditing() && !fileOperationRunning
  sourceUploadButton.disabled = !editable
  sourceDownloadButton.disabled = fileOperationRunning || !selection || selection.folder
  sourceCopyButton.disabled = fileOperationRunning || !selection
  sourcePasteButton.disabled = !editable || !sourceTransfer?.files.length
  sourceMoveButton.disabled = !editable || !selection
  sourceDeleteButton.disabled = !editable || !selection
  sourceCopyButton.classList.toggle("active", sourceTransfer?.mode === "copy")
  sourceMoveButton.classList.toggle("active", sourceTransfer?.mode === "move")
  sourceCopyButton.setAttribute("aria-pressed", String(sourceTransfer?.mode === "copy"))
  sourceMoveButton.setAttribute("aria-pressed", String(sourceTransfer?.mode === "move"))
}

function sourceTargetFolder(): string {
  const selection = sourceSelection()
  if (!selection) return ""
  if (selection.folder) return selection.path
  return selection.path.split("/").slice(0, -1).join("/")
}

function sourcePaths(selection: { path: string; folder: boolean }): string[] {
  if (!archive) return []
  return selection.folder
    ? archive.names().filter((path) => !path.endsWith("/") && path.startsWith(`${selection.path}/`))
    : archive.getBytes(selection.path) ? [selection.path] : []
}

function setSourceTransfer(mode: SourceTransfer["mode"]): void {
  const selection = sourceSelection()
  if (!archive || !selection || mode === "move" && !isEditing()) return
  const base = selection.folder ? `${selection.path.split("/").pop()}/` : ""
  sourceTransfer = {
    mode,
    sourcePath: selection.path,
    folder: selection.folder,
    files: sourcePaths(selection).flatMap((source) => {
      const bytes = archive?.getBytes(source)
      if (!bytes) return []
      const relative = selection.folder ? source.slice(selection.path.length + 1) : source.split("/").pop() ?? source
      return [{ path: `${base}${relative}`, source, bytes: bytes.slice() }]
    }),
  }
  updateSourceFileActions()
}

function refreshAfterSourceMutation(preferredPath?: string): void {
  if (!archive) return
  const selectedStillExists = archive.getBytes(selectedPath)
  renderFiles()
  setSidebarView("source")
  const next = preferredPath && archive.getBytes(preferredPath)
    ? preferredPath
    : selectedStillExists
      ? selectedPath
      : archive.names().find((path) => archive?.isText(path) || archive?.isImage(path) || archive?.isBdaConfig(path))
  if (next) selectFile(next, "source")
  refreshPreview()
  updateDirty()
}

type SourceUpload = { name: string; bytes: Uint8Array }

function sourceDropFolder(target: Element | null): string | undefined {
  if (!target?.closest(".raw-files")) return
  const folder = target.closest<HTMLElement>(".source-folder-row")?.dataset.folderPath
  if (folder !== undefined) return folder
  const path = target.closest<HTMLElement>(".source-file-row")?.dataset.path
  return path ? path.split("/").slice(0, -1).join("/") : sourceTargetFolder()
}

function setSourceDropTarget(target?: Element | null): void {
  files.querySelector(".source-drop-target")?.classList.remove("source-drop-target")
  target?.closest<HTMLElement>(".source-tree-row")?.classList.add("source-drop-target")
}

function commitSourceUploads(uploads: SourceUpload[], folder: string): boolean {
  if (!archive || !uploads.length) return false
  const changes = uploads.map(({ name, bytes }) => {
    const filename = name.split(/[\\/]/).pop() ?? name
    const path = folder ? `${folder}/${filename}` : filename
    return { path, bytes }
  })
  const conflicts = changes.filter(({ path }) => archive?.getBytes(path)).map(({ path }) => path)
  if (conflicts.length && !window.confirm(`以下文件已存在，是否替换？\n\n${conflicts.join("\n")}`)) return false
  commitBatch(changes.map(({ path, bytes }) => ({
    kind: "bytes",
    path,
    before: archive!.getBytes(path)?.slice(),
    after: bytes,
  })))
  refreshAfterSourceMutation(changes[0]?.path)
  return true
}

sourceUploadButton.addEventListener("click", () => {
  if (!archive || !isEditing()) return
  sourceUploadInput.value = ""
  sourceUploadInput.click()
})

sourceUploadInput.addEventListener("change", () => {
  void runFileOperation("上传文件", async () => {
    if (!archive || !sourceUploadInput.files?.length) return false
    const folder = sourceTargetFolder()
    const uploads = await Promise.all(Array.from(sourceUploadInput.files).map(async (file) => ({
      name: file.name,
      bytes: new Uint8Array(await file.arrayBuffer()),
    })))
    return commitSourceUploads(uploads, folder)
  })
})

sourceDownloadButton.addEventListener("click", () => {
  void runFileOperation("下载文件", async () => {
    const selection = sourceSelection()
    if (!archive || !selection || selection.folder) return false
    const bytes = archive.getBytes(selection.path)
    if (!bytes) return false
    return Boolean(await writeToChosenFile(selection.path.split("/").pop() ?? "download", bytes))
  })
})

sourceCopyButton.addEventListener("click", () => {
  setSourceTransfer("copy")
})

sourcePasteButton.addEventListener("click", () => {
  if (!archive || !isEditing() || !sourceTransfer?.files.length) return
  const folder = sourceTargetFolder()
  if (sourceTransfer.mode === "move" && sourceTransfer.folder &&
    (folder === sourceTransfer.sourcePath || folder.startsWith(`${sourceTransfer.sourcePath}/`))) {
    window.alert("不能将文件夹移动到自身内部。")
    return
  }
  const copies = sourceTransfer.files.map(({ path, source, bytes }) => ({
    path: folder ? `${folder}/${path}` : path,
    source,
    bytes,
  }))
  if (sourceTransfer.mode === "move" && copies.every(({ path, source }) => path === source)) return
  const sources = new Set(sourceTransfer.files.map(({ source }) => source))
  const conflicts = copies
    .filter(({ path }) => archive?.getBytes(path) && (sourceTransfer?.mode !== "move" || !sources.has(path)))
    .map(({ path }) => path)
  if (conflicts.length && !window.confirm(`以下文件已存在，是否替换？\n\n${conflicts.join("\n")}`)) return
  const changes: Change[] = copies.map(({ path, bytes }) => ({
    kind: "bytes",
    path,
    before: archive!.getBytes(path)?.slice(),
    after: bytes.slice(),
  }))
  if (sourceTransfer.mode === "move") {
    for (const source of sources) {
      if (!copies.some(({ path }) => path === source)) {
        changes.push({ kind: "bytes", path: source, before: archive.getBytes(source)?.slice() })
      }
    }
    sourceTransfer = undefined
  }
  commitBatch(changes)
  refreshAfterSourceMutation(copies[0]?.path)
})

sourceMoveButton.addEventListener("click", () => {
  setSourceTransfer("move")
})

sourceDeleteButton.addEventListener("click", () => {
  const selection = sourceSelection()
  if (!archive || !selection || !isEditing()) return
  const paths = sourcePaths(selection)
  if (!paths.length || !window.confirm(`确定要删除${selection.folder ? "文件夹" : "文件"} ${selection.path} 吗？此操作可撤销。`)) return
  commitBatch(paths.map((path) => ({
    kind: "bytes",
    path,
    before: archive!.getBytes(path)?.slice(),
  })))
  refreshAfterSourceMutation()
})

function selectFile(
  path: string,
  preferredSidebarView = sidebarView,
  resourceMode: "document" | "image" | "style" | "sound" = "document",
  preserveInspectorView = false,
): void {
  const previousInspectorTab = inspectorTab
  styleReturnPath = ""
  resourceConfigActive = resourceMode !== "document"
  resourceInspectorMode = resourceMode === "style" ? "style" : resourceMode === "sound" ? "sound" : "image"
  const guideLabel = resourceInspectorMode === "image" && resourceConfigActive ? "切片网格" : "辅助线"
  for (const button of [toggleGuides, mobileToggleGuides]) {
    button.title = guideLabel
    button.setAttribute("aria-label", guideLabel)
  }
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
    selectedSoundID = ""
    selectedResourceGalleryPath = ""
    resourceListView.hidden = false
    resourceDetail.hidden = true
  }
  if (archive?.isImage(path) && selectedPath && !archive.isImage(selectedPath)) {
    assetReturnPath = selectedPath
  }
  selectedPath = path
  if (path !== layoutPath) {
    selectedKeySections = []
    preview.setSelected([])
  }
  if (isBdaVirtualTextPath(path)) {
    hideImageWorkspace()
    const base = IniDocument.parse(bdaBase!.getText(bdaBasePath(path)))
    const previewLayout = isBdaLayoutPath(path) && previewItems(base).some((item) => item.editable)
    if (previewLayout && !refreshBdaLayout(path)) return
    selectedDocument = previewLayout ? layoutDocument : base
    if (previewLayout) {
      selectedKeySections = []
      preview.setSelected([])
    }
    setSourceValue(`# BDA 官方基础布局（只读几何）\n\n${selectedDocument?.toString() ?? ""}`)
    source.disabled = true
    sourceName.textContent = `${path} · 几何来自百度输入法安装包`
    inspectorTab = "properties"
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
      preview.setSelected([])
      inspectorTab = "properties"
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
  if (preserveInspectorView) inspectorTab = previousInspectorTab
  updateInspectorView()
  if (resourceConfigActive) renderResourceInspector()
  if (!quickInspector.hidden) populateKeyInspector()
  selectedFileButton?.classList.remove("selected")
  const preferredContainer = files.querySelector(preferredSidebarView === "overview" ? ".sidebar-overview" : ".raw-files")
  const navMode = resourceInspectorMode === "style" && resourceConfigActive
    ? "style"
    : resourceInspectorMode === "sound" && resourceConfigActive
      ? "sound"
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
  if (mobilePortraitQuery.matches) {
    const group = selectedFileButton?.closest<HTMLElement>(".nav-group")?.dataset.overviewGroup
    files.querySelector<HTMLButtonElement>(`.mobile-overview-groups button[data-overview-group="${CSS.escape(group ?? "")}"]`)?.click()
  }
  updateSourceFileActions()
}

const overviewGroupState = new Map<string, boolean>()
let mobileOverviewGroup = ""

function renderFiles(): void {
  files.replaceChildren()
  selectedFileButton = undefined
  if (!archive) return

  const overview = document.createElement("div")
  overview.className = "sidebar-overview"
  files.append(overview)

  const mobileGroups = document.createElement("nav")
  mobileGroups.className = "mobile-overview-groups"
  mobileGroups.setAttribute("aria-label", "布局分组")
  overview.append(mobileGroups)

  const setMobileOverviewGroup = (title: string): void => {
    mobileOverviewGroup = title
    for (const button of Array.from(mobileGroups.querySelectorAll<HTMLButtonElement>("button"))) {
      const active = button.dataset.overviewGroup === title
      button.classList.toggle("active", active)
      button.setAttribute("aria-pressed", String(active))
    }
    for (const group of Array.from(overview.querySelectorAll<HTMLElement>(".nav-group"))) {
      group.classList.toggle("mobile-overview-active", group.dataset.overviewGroup === title)
    }
  }

  const section = (title: string): HTMLElement => {
    const disclosure = document.createElement("details")
    disclosure.className = "nav-group"
    disclosure.dataset.overviewGroup = title
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
    const mobileButton = document.createElement("button")
    mobileButton.type = "button"
    mobileButton.textContent = title
    mobileButton.dataset.overviewGroup = title
    mobileButton.addEventListener("click", () => setMobileOverviewGroup(title))
    mobileGroups.append(mobileButton)
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
    "gen.ini": { group: "资源配置", label: "通用配置", className: "nav-style", icon: "gearshape" },
  }
  const hiddenLayouts = new Set(["def_9.ini", "def_26.ini"])
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
    if (hiddenLayouts.has(name)) continue
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
    entries.push({ group: "资源配置", label: "按键音效", path: stylePath, className: "nav-resource", icon: "speaker.wave.2", navMode: "sound" })
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
    if (group === "键盘布局") {
      const layoutRank: Record<string, number> = { "py_9.ini": 0, "py_26.ini": 1, "bh.ini": 3 }
      grouped.sort((a, b) => {
        const aName = a.path.split("/").pop() ?? ""
        const bName = b.path.split("/").pop() ?? ""
        return (layoutRank[aName] ?? 2) - (layoutRank[bName] ?? 2)
      })
    }
    if (!grouped.length) continue
    const body = section(group)
    for (const entry of grouped) addNavButton(body, entry.label, entry.path, entry.className, entry.icon, entry.navMode)
  }
  const availableMobileGroups = Array.from(mobileGroups.querySelectorAll<HTMLButtonElement>("button"))
  if (!availableMobileGroups.some((button) => button.dataset.overviewGroup === mobileOverviewGroup)) {
    mobileOverviewGroup = availableMobileGroups[0]?.dataset.overviewGroup ?? ""
  }
  setMobileOverviewGroup(mobileOverviewGroup)

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
    updateSourceFileActions()
  }
  const appendNode = (parent: HTMLElement, node: SourceNode, parentPath = "") => {
    for (const [name, child] of [...node.folders].sort(([a], [b]) => sourceNameCompare(a, b))) {
      const path = parentPath ? `${parentPath}/${name}` : name
      const folder = document.createElement("details")
      folder.className = "raw-folder"
      folder.dataset.folderPath = path
      const folderSummary = document.createElement("summary")
      folderSummary.className = "source-tree-row source-folder-row"
      folderSummary.dataset.folderPath = path
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
      button.draggable = true
      button.addEventListener("click", () => {
        if (archive?.isText(path) || archive?.isImage(path) || archive?.isBdaConfig(path)) {
          selectFile(path, "source")
          if (mobilePortraitQuery.matches) setMobilePane("inspector")
        } else selectSourceRow(button)
        updateSourceFileActions()
      })
      button.addEventListener("dragstart", (event) => {
        const bytes = archive?.getBytes(path)
        if (!bytes || !event.dataTransfer) return
        const mime = archive?.isText(path)
          ? "text/plain"
          : archive?.isImage(path)
            ? "image/png"
            : isSoundPath(path)
              ? soundMimeType(path)
              : "application/octet-stream"
        const url = URL.createObjectURL(new Blob([bytes.slice().buffer], { type: mime }))
        const filename = path.split("/").pop() ?? "download"
        event.dataTransfer.effectAllowed = "copy"
        event.dataTransfer.setData("DownloadURL", `${mime}:${filename}:${url}`)
        event.dataTransfer.setData("text/uri-list", url)
        button.addEventListener("dragend", () => URL.revokeObjectURL(url), { once: true })
      })
      parent.append(button)
    }
  }
  appendNode(sourceFiles, root)
  sourceFiles.addEventListener("dragover", (event) => {
    if (!archive || !isEditing() || !event.dataTransfer?.types.includes("Files")) return
    event.preventDefault()
    event.dataTransfer.dropEffect = "copy"
    setSourceDropTarget(event.target as Element)
  })
  sourceFiles.addEventListener("dragleave", (event) => {
    if (!sourceFiles.contains(event.relatedTarget as Node | null)) setSourceDropTarget()
  })
  sourceFiles.addEventListener("drop", (event) => {
    const folder = sourceDropFolder(event.target as Element)
    setSourceDropTarget()
    if (!archive || !isEditing() || folder === undefined || !event.dataTransfer?.files.length) return
    event.preventDefault()
    const dropped = Array.from(event.dataTransfer.files)
    void runFileOperation("上传文件", async () => commitSourceUploads(
      await Promise.all(dropped.map(async (file) => ({
        name: file.name,
        bytes: new Uint8Array(await file.arrayBuffer()),
      }))),
      folder,
    ))
  })
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

async function loadArchive(
  bytes: Uint8Array,
  path: string,
  isNew = false,
  existingSourceWorkspace = "",
  displayName = "",
  sourcePrefix = "",
): Promise<void> {
  await flushSourceAutosave()
  await activateSourceWorkspace("", "")
  sourceWorkspacePendingArchive = undefined
  releaseKeySound()
  keySoundBuffers.clear()
  const nextArchive = SkinArchive.open(bytes)
  if (nextArchive.format === "bda" && !bdaBase) {
    const response = await fetch(new URL("bda-base.bds", document.baseURI))
    if (!response.ok) throw new Error("无法加载 BDA 官方基础布局")
    bdaBase = SkinArchive.open(new Uint8Array(await response.arrayBuffer()))
  }
  let nextSourceWorkspace = existingSourceWorkspace
  let pendingAndroidSourceDirectory = ""
  const sourceDirectoryActive = !isAndroidTauri() || localStorage.getItem("source-directory-enabled") === "true"
  const configuredDirectory = sourceDirectoryActive ? localStorage.getItem("source-directory") || null : null
  if (isTauri() && !nextSourceWorkspace && (!isAndroidTauri() || configuredDirectory)) {
    if (isAndroidTauri()) {
      pendingAndroidSourceDirectory = configuredDirectory!
    } else {
      try {
        nextSourceWorkspace = await invoke<string>("create_source_workspace", {
          directory: configuredDirectory,
          name: path || displayName || exportName("未命名", nextArchive.format),
          files: sourceFilesPayload(nextArchive),
        })
      } catch (error) {
        if (!configuredDirectory) throw error
        nextSourceWorkspace = await invoke<string>("create_source_workspace", {
          directory: null,
          name: path || displayName || exportName("未命名", nextArchive.format),
          files: sourceFilesPayload(nextArchive),
        })
        showStatus("自定义源码目录不可用，本次已保存到内置目录")
      }
    }
  }
  assetURL = releaseImagePreviewURL(assetURL)
  clearImageSlicePicker()
  archive = nextArchive
  sourceTransfer = undefined
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
    : displayName || path.split(/[\\/]/).pop() || "未命名皮肤"
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
  await activateSourceWorkspace(nextSourceWorkspace, sourcePrefix)
  if (pendingAndroidSourceDirectory) {
    const pendingArchive = nextArchive
    sourceWorkspacePendingArchive = pendingArchive
    void invoke<string>("create_source_workspace", {
      directory: pendingAndroidSourceDirectory,
      name: path || displayName || exportName("未命名", nextArchive.format),
      files: sourceFilesPayload(nextArchive),
    }).then(async (workspace) => {
      if (archive !== pendingArchive || sourceWorkspacePendingArchive !== pendingArchive) return
      const pendingPaths = [...pendingSourcePaths]
      await activateSourceWorkspace(workspace, sourcePrefix)
      if (archive !== pendingArchive || sourceWorkspacePendingArchive !== pendingArchive) return
      pendingPaths.forEach((changedPath) => pendingSourcePaths.add(changedPath))
      await flushSourceAutosave()
      sourceWorkspacePendingArchive = undefined
      showStatus("源码已保存到授权目录")
    }).catch((error) => {
      if (archive !== pendingArchive || sourceWorkspacePendingArchive !== pendingArchive) return
      sourceWorkspacePendingArchive = undefined
      pendingSourcePaths.clear()
      showError(error, "保存源码到授权目录")
    })
  }
  updateDirty()
}

async function openNative(): Promise<boolean> {
  if (!(await prepareDocumentReplacement())) return false
  const path = await open({
    multiple: false,
    filters: [{ name: "百度输入法皮肤", extensions: ["bdi", "bds", "bda"] }],
  })
  if (typeof path !== "string") return false
  await loadNativePath(path)
  return true
}

async function loadSourceWorkspace(path: string): Promise<boolean> {
  if (isAndroidTauri() && path.startsWith("content://")) {
    const encoded = await invoke<string>("open_source_workspace_archive", { path })
    const decodedPath = decodeURIComponent(path)
    const directoryName = decodedPath.split(/[\\/:]/).filter(Boolean).pop()?.toLowerCase() ?? ""
    const sourcePrefix = directoryName === "dark" || directoryName === "light"
      ? `${directoryName}/`
      : ""
    const name = decodedPath.split(/[\\/]/).filter(Boolean).pop() || "皮肤源码"
    await loadArchive(decodeBase64Archive(encoded), "", false, path, name, sourcePrefix)
    return true
  }
  const files = await invoke<SourceFilePayload[]>("open_source_workspace", { path })
  const directoryName = path.split(/[\\/]/).filter(Boolean).pop()?.toLowerCase() ?? ""
  const sourcePrefix = directoryName === "dark" || directoryName === "light"
    ? `${directoryName}/`
    : ""
  const sourceFiles = files
    .filter((file) => !file.path.endsWith("/.DS_Store") && file.path !== ".DS_Store")
    .filter((file) => file.path.includes("/") || !/\.(?:bdi|bds|bda)$/i.test(file.path))
    .map((file) => ({
      path: sourcePrefix
        && file.path !== "Info.txt"
        && file.path !== "demo.png"
        && !file.path.startsWith(sourcePrefix)
        ? `${sourcePrefix}${file.path}`
        : file.path,
      data: new Uint8Array(file.data),
    }))
  if (!sourceFiles.length) throw new Error("源码文件夹为空")
  const sourceArchive = SkinArchive.fromSourceFiles(sourceFiles)
  const name = path.split(/[\\/]/).pop() || "皮肤源码"
  await loadArchive(sourceArchive.toBytes(), "", false, path, name, sourcePrefix)
  return true
}

async function restoreLastSourceWorkspace(): Promise<void> {
  if (!isAndroidTauri() || localStorage.getItem("source-directory-enabled") !== "true") return
  const lastSourceWorkspace = localStorage.getItem(LAST_SOURCE_WORKSPACE_KEY)
  if (!lastSourceWorkspace) return
  setFileOperationBusy(true)
  showStatus("正在恢复上次皮肤源码…", "progress")
  try {
    await loadSourceWorkspace(lastSourceWorkspace)
    showStatus("已恢复上次编辑的皮肤源码")
  } catch {
    localStorage.removeItem(LAST_SOURCE_WORKSPACE_KEY)
    showStatus("上次皮肤源码已不可用，请重新打开")
  } finally {
    setFileOperationBusy(false)
  }
}

async function loadNativePath(path: string): Promise<boolean> {
  if (!isSupportedSkinPath(path)) throw new Error("仅支持 .bda、.bdi 或 .bds 皮肤文件")
  const bytes = path.startsWith("content://")
    ? await readFile(path)
    : new Uint8Array(await invoke<number[]>("read_file", { path }))
  await loadArchive(bytes, path)
  return true
}

function isSupportedSkinPath(path: string): boolean {
  return path.startsWith("content://") || /\.(bdi|bds|bda)$/i.test(path)
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

async function loadDroppedSourceWorkspace(path: string): Promise<boolean> {
  if (!(await prepareDocumentReplacement())) return false
  return loadSourceWorkspace(path)
}

function currentExportFormat(): ExportFormat {
  return exportFormatFromPath(currentPath) ?? archive?.format ?? "bdi"
}

function mobileShareFormat(): ExportFormat {
  if (isIOSWeb()) return "bdi"
  if (isAndroidTauri() || isAndroidWeb()) return archive?.format === "bda" ? "bda" : "bds"
  return currentExportFormat()
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

async function saveNative(saveAs: boolean, format: ExportFormat, suggestedName: string): Promise<boolean> {
  if (!archive) throw new Error("当前没有可保存的皮肤")
  const exported = exportArchive(format)
  if (!exported) return false
  let path = currentPath
  if (saveAs || !path || (!path.startsWith("content://") && exportFormatFromPath(path) !== format)) {
    const written = await writeToChosenFile(suggestedName, exported.bytes, `${format.toUpperCase()} 皮肤`)
    if (!written) return false
    path = written
  } else {
    await writeNativePath(path, exported.bytes)
  }
  if (!exported.converted) {
    currentPath = path
    unsavedNew = false
    archive.markSaved(exported.bytes)
    documentName.textContent = path.split(/[\\/]/).pop() || "未命名皮肤"
    updateDirty()
  }
  return true
}

type BrowserSaveFileHandle = {
  name: string
  createWritable(): Promise<{ write(data: Uint8Array): Promise<void>; close(): Promise<void> }>
}

async function writeNativePath(path: string, bytes: Uint8Array): Promise<void> {
  if (path.startsWith("content://")) {
    await writeFile(path, bytes)
    return
  }
  await invoke("write_file", { path, data: Array.from(bytes) })
}

async function writeToChosenFile(
  filename: string,
  bytes: Uint8Array,
  description = "文件",
): Promise<string | undefined> {
  const extension = filename.match(/\.([^.\\/]+)$/)?.[1]
  if (isTauri()) {
    const path = await save({
      title: "保存文件",
      defaultPath: filename,
      filters: extension ? [{ name: description, extensions: [extension] }] : undefined,
    })
    if (!path) return
    await writeNativePath(path, bytes)
    return path
  }
  const picker = (window as typeof window & {
    showSaveFilePicker?: (options: {
      suggestedName: string
      types?: Array<{ description: string; accept: Record<string, string[]> }>
    }) => Promise<BrowserSaveFileHandle>
  }).showSaveFilePicker
  if (!picker) throw new Error("当前浏览器不支持系统保存，请使用 Chrome 或桌面版")
  let file: BrowserSaveFileHandle
  try {
    file = await picker.call(window, {
      suggestedName: filename,
      types: extension ? [{
        description,
        accept: { "application/octet-stream": [`.${extension}`] },
      }] : undefined,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return
    throw error
  }
  const writable = await file.createWritable()
  await writable.write(bytes)
  await writable.close()
  return file.name
}

async function downloadArchive(format: ExportFormat, suggestedName: string): Promise<boolean> {
  if (!archive) throw new Error("当前没有可保存的皮肤")
  const exported = exportArchive(format)
  if (!exported) return false
  const path = await writeToChosenFile(suggestedName, exported.bytes, `${format.toUpperCase()} 皮肤`)
  if (!path) return false
  if (!exported.converted) {
    currentPath = path
    documentName.textContent = suggestedName
    archive.markSaved(exported.bytes)
    unsavedNew = false
    updateDirty()
  }
  return true
}

async function saveArchive(saveAs: boolean, format: ExportFormat): Promise<boolean> {
  const currentName = documentName.textContent?.trim() ?? ""
  const suggestedName = exportName(currentName, format)
  return isTauri()
    ? saveNative(saveAs, format, suggestedName)
    : downloadArchive(format, suggestedName)
}

async function shareArchiveToMobile(): Promise<boolean> {
  if (!archive) return false
  const format = mobileShareFormat()
  const exported = exportArchive(format)
  if (!exported) return false
  const currentName = documentName.textContent?.trim() || "皮肤"
  const name = exportName(currentName, format)
  if (isAndroidTauri()) {
    await invoke("share_file", { name, data: Array.from(exported.bytes) })
    return true
  }
  const file = new File([exported.bytes], name, { type: "application/octet-stream" })
  if (!navigator.share || navigator.canShare && !navigator.canShare({ files: [file] })) {
    throw new Error("当前设备不支持系统文件分享")
  }
  try {
    await navigator.share({ title: name, files: [file] })
    return true
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return false
    throw error
  }
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
  void runFileOperation("保存", () => saveArchive(false, currentExportFormat()))
})
mobileShareButton.addEventListener("click", () => {
  void runFileOperation("分享皮肤", shareArchiveToMobile)
})
for (const button of exportButtons) {
  button.addEventListener("click", () => {
    const format = button.dataset.exportFormat as ExportFormat
    toolbarMore.open = false
    void runFileOperation("导出", () => saveArchive(true, format))
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

function setSourceDirectoryState(path: string, custom: boolean, error = ""): void {
  sourceDirectory.value = path
  sourceDirectory.closest("label")?.setAttribute("data-invalid", String(Boolean(error)))
  sourceDirectoryStatus.textContent = error || (custom
    ? "自定义目录 · 不自动删除源码"
    : "内置目录 · 保留最近 3 份源码")
}

async function applySourceDirectory(path: string | null): Promise<void> {
  const custom = Boolean(path?.trim())
  const previous = localStorage.getItem("source-directory")
  try {
    const resolved = await invoke<string>("prepare_source_directory", { path: custom ? path!.trim() : null })
    if (custom) {
      localStorage.setItem("source-directory", resolved)
      if (isAndroidTauri() && previous !== resolved) {
        localStorage.removeItem(LAST_SOURCE_WORKSPACE_KEY)
        await activateSourceWorkspace("", "")
      }
    }
    else localStorage.removeItem("source-directory")
    setSourceDirectoryState(resolved, custom)
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error)
    setSourceDirectoryState(path ?? sourceDirectory.value, custom, `目录不可用：${text}`)
  }
}

async function initializeSourceDirectory(): Promise<void> {
  if (!isTauri()) {
    sourceDirectoryEnabledSetting.hidden = true
    sourceDirectory.disabled = true
    chooseSourceDirectory.disabled = true
    resetSourceDirectory.disabled = true
    sourceDirectoryStatus.textContent = "源码目录仅桌面版可用"
    return
  }
  const configured = localStorage.getItem("source-directory")
  if (isAndroidTauri()) {
    sourceDirectory.readOnly = true
    sourceDirectory.placeholder = "/storage/emulated/0/BdiEditor"
    resetSourceDirectory.hidden = true
    const enabled = localStorage.getItem("source-directory-enabled") === "true" && Boolean(configured)
    sourceDirectoryEnabled.checked = enabled
    sourceDirectory.disabled = !enabled
    chooseSourceDirectory.disabled = !enabled
    if (!enabled) {
      localStorage.removeItem("source-directory-enabled")
      localStorage.removeItem("source-directory")
      localStorage.removeItem(LAST_SOURCE_WORKSPACE_KEY)
      sourceDirectory.value = ""
      sourceDirectoryStatus.textContent = "已关闭 · 不会写入源码文件"
      return
    }
    await applySourceDirectory(configured)
    return
  }
  sourceDirectoryEnabledSetting.hidden = true
  await applySourceDirectory(configured)
}

async function chooseAndroidSourceDirectory(): Promise<boolean> {
  try {
    await message("开启后，编辑器会把皮肤源码保存到你授权的文件夹。下一步请在系统文件选择器中选择或新建 BdiEditor 文件夹。", {
      title: "授权皮肤源码目录",
      kind: "info",
    })
    await applySourceDirectory(await invoke<string>("pick_source_directory"))
    return true
  } catch (error) {
    if (!String(error).toLowerCase().includes("cancel")) showError(error, "选择源码目录")
    return false
  }
}

sourceDirectoryEnabled.addEventListener("change", () => void (async () => {
  if (!isAndroidTauri()) return
  if (!sourceDirectoryEnabled.checked) {
    localStorage.removeItem("source-directory-enabled")
    localStorage.removeItem("source-directory")
    localStorage.removeItem(LAST_SOURCE_WORKSPACE_KEY)
    await activateSourceWorkspace("", "")
    sourceDirectory.disabled = true
    chooseSourceDirectory.disabled = true
    sourceDirectory.value = ""
    sourceDirectoryStatus.textContent = "已关闭 · 不会写入源码文件"
    return
  }
  const granted = await chooseAndroidSourceDirectory()
  sourceDirectoryEnabled.checked = granted
  sourceDirectory.disabled = !granted
  chooseSourceDirectory.disabled = !granted
  if (granted) localStorage.setItem("source-directory-enabled", "true")
  else sourceDirectoryStatus.textContent = "未授权 · 不会写入源码文件"
})())

sourceDirectory.addEventListener("change", () => void applySourceDirectory(sourceDirectory.value))
sourceDirectory.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return
  event.preventDefault()
  void applySourceDirectory(sourceDirectory.value)
})
chooseSourceDirectory.addEventListener("click", () => void (async () => {
  if (isAndroidTauri()) {
    await chooseAndroidSourceDirectory()
    return
  }
  const path = await open({
    multiple: false,
    directory: true,
    title: "选择皮肤源码保存目录",
    defaultPath: sourceDirectory.value || undefined,
  })
  if (typeof path === "string") await applySourceDirectory(path)
})())
resetSourceDirectory.addEventListener("click", () => void applySourceDirectory(null))
const sourceDirectoryInitialization = initializeSourceDirectory()
for (const button of sidebarViewButtons) {
  button.addEventListener("click", () => setSidebarView(button.dataset.sidebarView === "source" ? "source" : "overview"))
}
const savedDefaultDevice = localStorage.getItem("default-device")
defaultDevice.value = Array.from(defaultDevice.options).some((option) => option.value === savedDefaultDevice)
  ? savedDefaultDevice!
  : device.value
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
mobilePreviewPosition.value = localStorage.getItem("mobile-preview-position") === "top" ? "top" : "bottom"
document.documentElement.dataset.mobilePreviewPosition = mobilePreviewPosition.value
mobilePreviewPosition.addEventListener("change", () => {
  localStorage.setItem("mobile-preview-position", mobilePreviewPosition.value)
  document.documentElement.dataset.mobilePreviewPosition = mobilePreviewPosition.value
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
function applySourceFontSize(): void {
  const size = Number(sourceFontSize.value)
  if (!Number.isFinite(size) || size < 8 || size > 32) return
  sourceEditor.style.setProperty("--source-font-size", `${size}px`)
}
const savedSourceFontSize = localStorage.getItem("source-font-size")
if (savedSourceFontSize && Number.isFinite(Number(savedSourceFontSize)) && Number(savedSourceFontSize) >= 8 && Number(savedSourceFontSize) <= 32) {
  sourceFontSize.value = savedSourceFontSize
}
applySourceFontSize()
function saveSourceFontSize(): void {
  const size = Number(sourceFontSize.value)
  if (!Number.isInteger(size) || size < 8 || size > 32) {
    sourceFontSize.value = localStorage.getItem("source-font-size") || "11"
    applySourceFontSize()
    return
  }
  sourceFontSize.value = String(size)
  localStorage.setItem("source-font-size", sourceFontSize.value)
  applySourceFontSize()
}
sourceFontSize.addEventListener("input", applySourceFontSize)
sourceFontSize.addEventListener("change", saveSourceFontSize)
sourceFontSize.addEventListener("blur", saveSourceFontSize)
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

let windowDragPointerDown = false
let windowDragMaterialDisabled = false
let windowDragMaterialTransition: Promise<unknown> | undefined

async function restoreWindowMaterialAfterDrag(): Promise<void> {
  windowDragPointerDown = false
  try {
    await windowDragMaterialTransition
  } catch {
    windowDragMaterialDisabled = false
    document.documentElement.dataset.windowMaterial = windowMaterial.checked ? "on" : "off"
    return
  }
  if (!windowDragMaterialDisabled) {
    document.documentElement.dataset.windowMaterial = windowMaterial.checked ? "on" : "off"
    return
  }
  windowDragMaterialDisabled = false
  await applyWindowMaterial()
}

async function startWindowsWindowDrag(): Promise<void> {
  windowDragPointerDown = true
  document.documentElement.dataset.windowMaterial = "off"
  try {
    windowDragMaterialTransition = invoke("set_window_material", { enabled: false })
    await windowDragMaterialTransition
    windowDragMaterialDisabled = true
    if (!windowDragPointerDown) {
      await restoreWindowMaterialAfterDrag()
      return
    }
    await getCurrentWindow().startDragging()
  } catch (error) {
    windowDragMaterialTransition = undefined
    await restoreWindowMaterialAfterDrag()
    showError(error, "拖动窗口")
  } finally {
    windowDragMaterialTransition = undefined
  }
}

document.addEventListener("mousedown", (event) => {
  if (
    !document.documentElement.classList.contains("windows") ||
    !windowMaterial.checked ||
    event.button !== 0 ||
    event.detail !== 1 ||
    !(event.target instanceof Element) ||
    !event.target.closest("[data-tauri-drag-region]") ||
    event.target.closest("button, input, select, textarea, a, summary, [contenteditable='true'], [role='button'], [role='link']")
  ) return
  event.preventDefault()
  event.stopImmediatePropagation()
  void startWindowsWindowDrag()
}, true)
window.addEventListener("mouseup", () => {
  if (windowDragPointerDown) void restoreWindowMaterialAfterDrag()
}, true)
window.addEventListener("blur", () => {
  if (windowDragPointerDown) void restoreWindowMaterialAfterDrag()
}, true)
sidebarViewVisible.checked = localStorage.getItem("sidebar-view-visible") !== "off"
function applySidebarViewVisibility(): void {
  sidebarViewHeading.toggleAttribute("hidden", !sidebarViewVisible.checked)
}
applySidebarViewVisibility()
sidebarViewVisible.addEventListener("change", () => {
  localStorage.setItem("sidebar-view-visible", sidebarViewVisible.checked ? "on" : "off")
  applySidebarViewVisibility()
})
inspectorTabsVisible.checked = localStorage.getItem("inspector-tabs-visible") !== "off"
function applyInspectorTabsVisibility(): void {
  inspectorTabs.toggleAttribute("hidden", !inspectorTabsVisible.checked)
}
applyInspectorTabsVisibility()
inspectorTabsVisible.addEventListener("change", () => {
  localStorage.setItem("inspector-tabs-visible", inspectorTabsVisible.checked ? "on" : "off")
  applyInspectorTabsVisibility()
})
inspectorGroupedDisplay.checked = localStorage.getItem("inspector-grouped-display") !== "off"
function applyInspectorGroupedDisplay(): void {
  quickInspector.dataset.inspectorGroupDisplay = inspectorGroupedDisplay.checked ? "grouped" : "all"
  if (inspectorGroupedDisplay.checked) quickInspector.scrollTop = 0
}
applyInspectorGroupedDisplay()
inspectorGroupedDisplay.addEventListener("change", () => {
  localStorage.setItem("inspector-grouped-display", inspectorGroupedDisplay.checked ? "on" : "off")
  applyInspectorGroupedDisplay()
})
undoButton.addEventListener("click", undo)
redoButton.addEventListener("click", redo)
browserOpen.addEventListener("change", async () => {
  const file = browserOpen.files?.[0]
  if (file) {
    await runFileOperation("打开", async () => {
      if (!isSupportedSkinPath(file.name)) throw new Error("仅支持 .bda、.bdi 或 .bds 皮肤文件")
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
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "copy"
    const file = event.dataTransfer.files[0]
    setLayoutImageHighlight(Boolean(archive && archive.format !== "bda" && file && /\.png$/i.test(file.name)))
  }
})
canvasWrap.addEventListener("dragleave", (event) => {
  event.preventDefault()
  canvasDragDepth = Math.max(0, canvasDragDepth - 1)
  if (!canvasDragDepth) {
    setCanvasDropState(false)
    setLayoutImageHighlight(false)
  }
})
canvasWrap.addEventListener("drop", (event) => {
  event.preventDefault()
  canvasDragDepth = 0
  setCanvasDropState(false)
  setLayoutImageHighlight(false)
  const file = event.dataTransfer?.files[0]
  if (!file) return
  if (/\.png$/i.test(file.name)) {
    if (!archive || archive.format === "bda") return
    const reader = new FileReader()
    reader.onload = () => {
      setLayoutImageBytes(new Uint8Array(reader.result as ArrayBuffer))
      openLayoutImageDialog()
    }
    reader.readAsArrayBuffer(file)
    return
  }
  void runFileOperation("打开", () => loadDroppedFile(file))
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
  syncSourceScroll()
})
sourceSearch.addEventListener("input", () => {
  sourceSearchIndex = -1
  findSourceMatch(1)
})
sourceSearch.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return
  event.preventDefault()
  findSourceMatch(event.shiftKey ? -1 : 1)
})
for (const field of keyFields) {
  field.addEventListener("input", () => {
    syncActionCodeSuggestions(field)
    updateSelectedKey(field)
  })
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
for (const button of keyModeButtons) {
  button.addEventListener("click", () => {
    keyMode = button.dataset.keyMode === "move" ? "move" : "select"
    keyModeButtons.forEach((item) => item.classList.toggle("active", item === button))
    preview.setEditTool(keyMode)
  })
}
for (const button of keyActionButtons) {
  button.addEventListener("click", () => {
    if (button.dataset.keyAction === "copy") copySelectedKeys()
    else if (button.dataset.keyAction === "swap") applyLayoutAction("swap")
    else deleteSelectedKeys()
  })
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
    if (control !== layout && !createMissingVariant(path)) return
    let selected = false
    if (archive?.format === "bda") {
      renderFiles()
      if (bdaAvailableLayoutPaths().includes(path)) {
        selectFile(path)
        selected = true
      }
    } else if (archive?.names().includes(path)) {
      layoutPath = path
      layoutDocument = IniDocument.parse(archive.getText(path))
      selectedKeySections = []
      preview.setSelected([])
      renderFiles()
      selectFile(path)
      selected = true
    }
    updateDevicePreview()
    syncSegmentedControls()
    if (!selected) refreshPreview()
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
for (const button of mobileChoiceButtons) {
  button.addEventListener("click", () => {
    const choice = button.dataset.mobileChoice
    const select = choice === "mode" ? mode : choice === "theme" ? theme : orientation
    const values = Array.from(select.options).map((option) => option.value)
    const next = values[(values.indexOf(select.value) + 1) % values.length]
    selectChoice(select, next)
  })
}
function setGuidesVisible(enabled: boolean): void {
  guidesVisible = enabled
  for (const button of [toggleGuides, mobileToggleGuides]) {
    button.classList.toggle("active", guidesVisible)
    button.setAttribute("aria-pressed", String(guidesVisible))
  }
  preview.setGuides(guidesVisible)
  toolbarPreview.setGuides(guidesVisible)
  if (!enabled) setDrawingTile(false)
  drawAtlas()
}

toggleGuides.addEventListener("click", () => setGuidesVisible(!guidesVisible))
mobileToggleGuides.addEventListener("click", () => setGuidesVisible(!guidesVisible))
newTileButton.addEventListener("click", () => {
  if (!selectedResourcePath || !isEditing()) return
  if (!guidesVisible) setGuidesVisible(true)
  setDrawingTile(!drawingTile)
})
duplicateTileButton.addEventListener("click", duplicateSelectedTile)
deleteTileButton.addEventListener("click", deleteSelectedTile)
resourceBackButton.addEventListener("click", () => {
  if (resourceInspectorMode === "style" && styleReturnPath) {
    const path = styleReturnPath
    const selection = [...styleReturnSelection]
    const scrollTop = styleReturnScrollTop
    const inspectorGroup = styleReturnInspectorGroup
    styleReturnPath = ""
    selectFile(path, "overview")
    selectedKeySections = selection
    preview.setSelected(selection)
    populateKeyInspector()
    if (inspectorGroup) setMobileInspectorGroup(inspectorGroup, false)
    quickInspector.scrollTop = scrollTop
    revealSourceFile(path)
    return
  }
  showResourceList()
})
resourceSearch.addEventListener("input", renderResourceInspector)
resourceCategory.addEventListener("change", renderResourceInspector)
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
  activateSkinState(state)
})
panelScaleButton.addEventListener("click", openPanelCopyDialog)
adaptIos26Button.addEventListener("click", () => ios26Dialog.showModal())
ios26Form.addEventListener("submit", (event) => {
  if ((event.submitter as HTMLButtonElement | null)?.value !== "apply") return
  event.preventDefault()
  ios26Dialog.close()
  void runFileOperation("适配 iOS 26", adaptArchiveForIos26)
})

// 替换键盘样式
function resourceRootPath(): string {
  return `${theme.value}/skin/${orientation.value}/res`
}

function currentLayoutDocument(): IniDocument | undefined {
  if (!archive || archive.format === "bda") return
  if (archive.isText(layoutPath)) return IniDocument.parse(archive.getText(layoutPath))
  const path = currentConfigPath(layout.value)
  return archive.isText(path) ? IniDocument.parse(archive.getText(path)) : layoutDocument
}

function currentStyleDocument(): IniDocument | undefined {
  const path = styleConfigPath()
  return archive?.isText(path) ? IniDocument.parse(archive.getText(path)) : undefined
}

function currentGenDocument(): IniDocument | undefined {
  const path = genConfigPath()
  return archive?.isText(path) ? IniDocument.parse(archive.getText(path)) : undefined
}

function nextResourceBase(): string {
  const root = resourceRootPath()
  let base = `${root}/replace_image`
  let suffix = 2
  while (archive?.names().some((path) => path === `${base}.png` || path === `${base}.til`)) {
    base = `${root}/replace_image${suffix}`
    suffix += 1
  }
  return base
}

function updateLayoutImageForm(): void {
  layoutImageSize.textContent = layoutImageWidth > 0 ? `${layoutImageWidth} × ${layoutImageHeight}` : "未选择图片"
  layoutImageApply.disabled =
    !archive || archive.format === "bda" || layoutImageWidth === 0 || !layoutImageTarget
}

function setLayoutImageHighlight(active: boolean): void {
  if (layoutImageHighlight === active) return
  layoutImageHighlight = active
  canvasWrap.classList.toggle("layout-image-target", active)
}

function openLayoutImageDialog(): void {
  if (!archive || archive.format === "bda") return
  const layout = currentLayoutDocument()
  const styles = currentStyleDocument()
  if (!layout || !styles) return
  layoutImageLayout.textContent = `当前布局：${layoutPath.split("/").pop() ?? layout.value}（${orientation.value}）`
  layoutImageScope.textContent = selectedKeySections.length
    ? `已选中 ${selectedKeySections.length} 个按键，将只替换这些按键。`
    : "未选中按键，将替换当前布局的全部按键。"
  layoutImageError.hidden = true
  layoutImageError.textContent = ""
  if (!layoutImageTarget) {
    layoutImageTarget = selectedKeySections.length ? "key-normal" : "panel"
    layoutImageTargetInputs.find((input) => input.value === layoutImageTarget)!.checked = true
  }
  if (!layoutImageBytes) layoutImageFile.click()
  else updateLayoutImageForm()
  layoutImageDialog.showModal()
}

function setLayoutImageBytes(bytes: Uint8Array): void {
  if (layoutImageObjectURL) URL.revokeObjectURL(layoutImageObjectURL)
  layoutImageObjectURL = URL.createObjectURL(new Blob([bytes], { type: "image/png" }))
  layoutImageBytes = bytes
  const image = new Image()
  image.onload = () => {
    layoutImageWidth = image.naturalWidth
    layoutImageHeight = image.naturalHeight
    layoutImagePreview.src = layoutImageObjectURL
    layoutImagePreview.hidden = false
    layoutImageFileLabel.hidden = true
    layoutImageFile.classList.add("has-image")
    updateLayoutImageForm()
  }
  image.src = layoutImageObjectURL
}

function layoutImageTargetLabel(target: LayoutImageTarget): string {
  switch (target) {
    case "panel": return "键盘背景"
    case "key-normal": return "正常按键背景"
    case "key-highlight": return "按下按键背景"
    case "fore-normal": return "按键前景"
    case "fore-highlight": return "按键按下前景"
    case "candidate": return "候选栏背景样式"
  }
}

async function applyLayoutImage(): Promise<void> {
  const layout = currentLayoutDocument()
  const styles = currentStyleDocument()
  const gen = currentGenDocument()
  if (!archive || !layout || !styles || !gen || !layoutImageBytes || !layoutImageTarget) return
  if (layoutImageTarget === "panel" && selectedKeySections.length) {
    layoutImageError.textContent = "键盘背景替换作用于整个布局，请先取消按键选择。"
    layoutImageError.hidden = false
    return
  }
  const panel = resolvePanelConfig(layout, gen, styles)
  if (layoutImageTarget === "candidate") {
    const candPath = toolbarConfigPath()
    const cand = candPath && archive.isText(candPath) ? IniDocument.parse(archive.getText(candPath)) : undefined
    if (!candPath || !cand) {
      layoutImageError.textContent = "当前主题未找到候选栏配置文件。"
      layoutImageError.hidden = false
      return
    }
    if (layoutImageWidth !== panel.width || layoutImageHeight !== panel.height) {
      layoutImageBytes = await fitPngTo(layoutImageBytes, panel.width, panel.height)
      layoutImageWidth = panel.width
      layoutImageHeight = panel.height
    }
    const base = nextResourceBase()
    const plan = planLayoutImage(layoutImageTarget, [], IniDocument.parse(""), panel.width, panel.height)
    const tilesDoc = IniDocument.parse("")
    for (const slice of plan.slices) updateTileSlice(tilesDoc, slice)
    const stylesDoc = IniDocument.parse(styles.toString())
    const candDoc = IniDocument.parse(cand.toString())
    applyCandidateImageStyles(stylesDoc, candDoc, plan, base.split("/").pop()!)
    const pngPath = `${base}.png`
    const tilPath = `${base}.til`
    const stylePath = styleConfigPath()
    commitBatch([
      { kind: "bytes", path: pngPath, before: archive.getBytes(pngPath) ?? new Uint8Array(0), after: layoutImageBytes },
      { kind: "bytes", path: tilPath, before: archive.getBytes(tilPath) ?? new Uint8Array(0), after: new TextEncoder().encode(tilesDoc.toString()) },
      { kind: "text", path: candPath, before: cand.toString(), after: candDoc.toString() },
      { kind: "text", path: stylePath, before: styles.toString(), after: stylesDoc.toString() },
    ])
    layoutImageDialog.close()
    if (selectedPath === candPath) {
      selectedDocument = candDoc
      setSourceValue(candDoc.toString())
    }
    renderFiles()
    selectFile(candPath)
    refreshPreview()
    updateDirty()
    showStatus(`已应用「${layoutImageTargetLabel(layoutImageTarget)}」替换`)
    return
  }
  const keys = layoutKeyRects(layout, selectedKeySections, [panel.width, panel.height])
  const layoutDoc = IniDocument.parse(layout.toString())
  let plan: LayoutImagePlan
  let sourceWidth = panel.width
  let sourceHeight = panel.height
  if (layoutImageConfig === "none" || layoutImageTarget === "panel") {
    // 布局配置仅对按键类目标生效，面板替换始终按整图处理
    if (layoutImageTarget !== "panel") {
      const rectError = validateKeyRects(keys, panel.width, panel.height)
      if (rectError) {
        layoutImageError.textContent = rectError
        layoutImageError.hidden = false
        return
      }
    }
    if (layoutImageWidth !== panel.width || layoutImageHeight !== panel.height) {
      layoutImageBytes = await fitPngTo(layoutImageBytes, panel.width, panel.height)
      layoutImageWidth = panel.width
      layoutImageHeight = panel.height
    }
    plan = planLayoutImage(layoutImageTarget, keys, IniDocument.parse(""), panel.width, panel.height)
  } else {
    // 图片跟随布局 / 布局跟随图片：按图片空白检测按键网格，切片源取自图片
    const scan = await decodePngMask(layoutImageBytes)
    const cells = detectGridCells(scan.mask, scan.width, scan.height)
    if (!cells.length) {
      layoutImageError.textContent = "无法在图片中识别按键区域，请检查图片是否包含透明间隔。"
      layoutImageError.hidden = false
      return
    }
    const matchedKeys = layoutImageConfig === "layout-follows-image"
      ? matchLayoutKeysToCells(layoutDoc, keys, cells)
      : keys
    plan = planLayoutImageSlices(layoutImageTarget, matchedKeys, cells, IniDocument.parse(""))
    sourceWidth = scan.width
    sourceHeight = scan.height
  }
  const base = nextResourceBase()
  const tilesDoc = IniDocument.parse("")
  for (const slice of plan.slices) updateTileSlice(tilesDoc, slice)
  const stylesDoc = IniDocument.parse(styles.toString())
  if (layoutImageConfig === "layout-follows-image" && layoutImageTarget !== "panel") {
    // 布局跟随图片：把按键矩形与面板尺寸改写为图片网格
    applyLayoutImageRects(layoutDoc, plan.keys, plan.slices.map((slice) => slice.source), sourceWidth, sourceHeight)
  }
  applyLayoutImageStyles(layoutImageTarget, layoutDoc, stylesDoc, plan, base.split("/").pop()!)
  const pngPath = `${base}.png`
  const tilPath = `${base}.til`
  const targetPath = layoutPath
  const stylePath = styleConfigPath()
  commitBatch([
    { kind: "bytes", path: pngPath, before: archive.getBytes(pngPath) ?? new Uint8Array(0), after: layoutImageBytes },
    { kind: "bytes", path: tilPath, before: archive.getBytes(tilPath) ?? new Uint8Array(0), after: new TextEncoder().encode(tilesDoc.toString()) },
    { kind: "text", path: targetPath, before: layout.toString(), after: layoutDoc.toString() },
    { kind: "text", path: stylePath, before: styles.toString(), after: stylesDoc.toString() },
  ])
  layoutDocument = layoutDoc
  layoutImageDialog.close()
  if (selectedPath === targetPath) {
    selectedDocument = layoutDoc
    setSourceValue(layoutDoc.toString())
  }
  renderFiles()
  selectFile(targetPath)
  refreshPreview()
  populateKeyInspector()
  updateDirty()
  showStatus(`已应用「${layoutImageTargetLabel(layoutImageTarget)}」替换`)
}

replaceLayoutImageButton.addEventListener("click", openLayoutImageDialog)
layoutImageFile.addEventListener("click", () => layoutImageOpen.click())
layoutImageOpen.addEventListener("change", () => {
  const file = layoutImageOpen.files?.[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = () => setLayoutImageBytes(new Uint8Array(reader.result as ArrayBuffer))
    reader.readAsArrayBuffer(file)
  }
  layoutImageOpen.value = ""
})
for (const input of layoutImageTargetInputs) {
  input.addEventListener("change", () => {
    layoutImageTarget = input.value as LayoutImageTarget
    layoutImageScope.textContent = layoutImageTarget === "panel"
      ? "替换当前布局的完整背景。"
      : layoutImageTarget === "candidate"
        ? "替换当前主题候选栏的背景图片。"
        : selectedKeySections.length
        ? `已选中 ${selectedKeySections.length} 个按键，将只替换这些按键。`
        : "未选中按键，将替换当前布局的全部按键。"
    syncLayoutImageConfig()
    updateLayoutImageForm()
  })
}
const layoutImageConfigDescriptions: Record<LayoutImageConfig, string> = {
  none: "保持当前布局，图片按面板尺寸缩放后替换按键区域。",
  "image-follows-layout": "图片不按键盘布局切片，而是识别图片自身的按键区域并切片，再拉伸贴到按键上，不改布局。",
  "layout-follows-image": "识别图片的按键布局，把当前键盘布局的按键区域改为图片的布局，再导入切片。",
}
function syncLayoutImageConfig(): void {
  for (const button of layoutImageConfigButtons) {
    button.classList.toggle("active", button.dataset.layoutImageConfig === layoutImageConfig)
  }
  layoutImageConfigDesc.textContent = layoutImageConfigDescriptions[layoutImageConfig]
  layoutImageConfigFieldset.disabled = layoutImageTarget === "panel" || layoutImageTarget === "candidate"
}
for (const button of layoutImageConfigButtons) {
  button.addEventListener("click", () => {
    if (layoutImageConfigFieldset.disabled) return
    const value = button.dataset.layoutImageConfig as LayoutImageConfig
    if (value === layoutImageConfig) return
    layoutImageConfig = value
    syncLayoutImageConfig()
  })
}
layoutImageForm.addEventListener("submit", (event) => {
  const submitter = event.submitter as HTMLButtonElement | null
  if (submitter?.value !== "apply") return
  event.preventDefault()
  void applyLayoutImage()
})
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

if (isTauri()) {
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
}

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
  const imageSelected = resourceInspectorMode === "image" && Boolean(selectedResourceGalleryPath)
  const soundSelected = resourceInspectorMode === "sound"
    && Boolean(currentSoundEntries().find((entry) => entry.id === selectedSoundID)?.path)
  resourceDownloadButton.disabled = !imageSelected && !soundSelected
  resourceDeleteButton.disabled = !imageSelected || !isEditing()
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

async function uploadKeySound(file: File): Promise<void> {
  if (!archive || !isSoundPath(file.name)) throw new Error("按键音效仅支持 OGG、WAV 或 AIFF 文件")
  const filename = file.name.split(/[\\/]/).pop() ?? file.name
  const entries = currentSoundEntries()
  const selected = entries.find((entry) => entry.id === selectedSoundID)
  const base = selected?.path.split("/").slice(0, -1).join("/")
    ?? soundResourcePaths(archive.names(), theme.value, orientation.value)[0]?.split("/").slice(0, -1).join("/")
    ?? `${theme.value}/skin/res`
  const targetPath = `${base}/${filename}`
  const beforeResource = archive.getBytes(targetPath)?.slice()
  if (beforeResource && targetPath !== selected?.path && !window.confirm(`音效 ${filename} 已存在，是否替换？`)) return
  const resourceBytes = new Uint8Array(await file.arrayBuffer())
  keySoundBuffers.delete(targetPath)
  releaseKeySound()
  commitBytes(targetPath, beforeResource ?? new Uint8Array(), resourceBytes)
  selectedSoundID = `file:${targetPath}`
  renderResourceInspector()
  updateDirty()
  showStatus(`按键音效文件已更新：${filename}`)
}

resourceUploadInput.addEventListener("change", () => {
  const file = resourceUploadInput.files?.[0]
  if (!file || !archive) return
  if (resourceInspectorMode === "sound") {
    void runFileOperation("上传按键音效", async () => {
      await uploadKeySound(file)
      return true
    })
    return
  }
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
  void runFileOperation(resourceInspectorMode === "sound" ? "下载按键音效" : "下载图片", async () => {
    if (resourceInspectorMode === "sound") {
      const entry = currentSoundEntries().find((item) => item.id === selectedSoundID)
      const bytes = entry?.path ? archive?.getBytes(entry.path) : undefined
      if (!entry?.path || !bytes) return false
      return Boolean(await writeToChosenFile(entry.filename, bytes))
    }
    if (!archive || !selectedResourceGalleryPath) return false
    const bytes = archive.getBytes(selectedResourceGalleryPath)
    if (!bytes) return false
    return Boolean(await writeToChosenFile(
      selectedResourceGalleryPath.split("/").pop() ?? "image.png",
      bytes,
    ))
  })
})

resourceDeleteButton.addEventListener("click", () => {
  if (!archive || !selectedResourceGalleryPath || !isEditing()) return
  const name = selectedResourceGalleryPath.split("/").pop() ?? selectedResourceGalleryPath
  if (!window.confirm(`确定要删除图片 ${name} 吗？此操作可撤销。`)) return
  const before = archive.getBytes(selectedResourceGalleryPath)
  if (!before) return
  commitBatch([{ kind: "bytes", path: selectedResourceGalleryPath, before }])
  selectedResourceGalleryPath = ""
  updateResourceActionButtons()
  renderResourceInspector()
  updateDirty()
})

device.addEventListener("change", () => {
  updateDevicePreview()
  refreshPreview()
})
clearSimulationButton.addEventListener("click", clearSimulatedOutput)
simulatedOutput.addEventListener("input", refreshSimulationPreview)
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
  if (
    (event.key === "Delete" || event.key === "Backspace") &&
    isEditing() &&
    selectedKeySections.length &&
    !isTextEditingTarget(event.target)
  ) {
    event.preventDefault()
    deleteSelectedKeys()
    return
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
  void (async () => {
    const scaleFactor = await getCurrentWindow().scaleFactor()
    await getCurrentWebview().onDragDropEvent((event) => {
      const payload = event.payload
      if (payload.type === "leave") {
        setSourceDropTarget()
        return
      }
      const target = document.elementFromPoint(
        payload.position.x / scaleFactor,
        payload.position.y / scaleFactor,
      )
      const folder = sourceDropFolder(target)
      if (payload.type === "enter" || payload.type === "over") {
        setSourceDropTarget(folder === undefined ? undefined : target)
        return
      }
      setSourceDropTarget()
      void (async () => {
        for (const path of payload.paths) {
          if (await invoke<boolean>("path_is_directory", { path })) {
            await runFileOperation("打开源码文件夹", () => loadDroppedSourceWorkspace(path))
            return
          }
        }
        if (folder !== undefined && archive && isEditing()) {
          await runFileOperation("上传文件", async () => commitSourceUploads(
            await Promise.all(payload.paths.map(async (path) => ({
              name: path,
              bytes: new Uint8Array(await invoke<number[]>("read_file", { path })),
            }))),
            folder,
          ))
          return
        }
        const pngPath = payload.paths.find((path) => /\.png$/i.test(path))
        if (pngPath) {
          if (!archive || archive.format === "bda") return
          const bytes = new Uint8Array(await invoke<number[]>("read_file", { path: pngPath }))
          setLayoutImageBytes(bytes)
          openLayoutImageDialog()
          return
        }
        const path = payload.paths.find(isSupportedSkinPath)
        if (path) await runFileOperation("打开", () => loadDroppedPath(path))
      })().catch((error) => showError(error, "处理拖入文件"))
    })
  })()
  void listen<string[]>("opened", async (event) => {
    const path = event.payload[0]
    if (path && (await prepareDocumentReplacement())) {
      void runFileOperation("打开", () => loadNativePath(path))
    }
  })
  void invoke<string[]>("take_opened_files")
    .then(async (paths) => {
      if (paths[0]) {
        await runFileOperation("打开", () => loadNativePath(paths[0]))
        return
      }
      await sourceDirectoryInitialization
      await restoreLastSourceWorkspace()
    })
    .catch((error) => showError(error, "读取启动文件"))
}
mode.value = "preview"
applyModeState()
syncLayoutImageConfig()
updateDevicePreview()
updateSourceHighlight()
updateInspectorView()
void refreshUpdateStatus()
