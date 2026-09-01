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
  drawVisualText,
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
  candidateInputForegroundStyle,
  resolveCandidateRect,
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
  applyDecodedBdaAppearancePart,
  applyDecodedBdaSource,
  BdaResolver,
  bdaAppearancePath,
  bdaColorHex,
  bdaConfigPath,
  bdaDecodedSourceEditable,
  bdaConfigPaths,
  bdaLayoutDocument,
  bdaLayoutNames,
  bdaPanelKeyName,
  bdaStyleID,
  bdaStyleRef,
  decodedBdaSource,
  decodedBdaEditorSource,
  decodedBdaAppearancePart,
  decodeBdaAnimation,
  decodeBdaAppearance,
  decodeBdaSoundConfig,
  updateBdaAnimationFrame,
  updateBdaDesignWidth,
  updateBdaImageInnerRect,
  updateBdaStyle,
  type BdaAppearance,
  type BdaAppearancePart,
  type BdaAppearanceStyleGroup,
  type BdaStyleRef,
} from "./bda.ts"
import {
  refreshBdaStyleReferenceField,
  renderBdaConfigEditor,
  renderBdaLayoutEditor,
  renderBdaMetadataEditor,
  renderBdaStyleEditor,
} from "./bda-editor.ts"
import { convertBdaArchive } from "./bda-convert.ts"
import { bdaCompatibilityWarnings, bdaPlatform, convertBdaPlatform, type BdaPlatform } from "./bda-platform.ts"
import { IniDocument } from "./ini.ts"
import { adaptIos26KeyboardLayout, adaptIos26Variant } from "./ios26.ts"
import { findTextMatches, iniSectionRanges, insertedTextRange, jsonPropertyRanges, replaceTextMatches } from "./highlight.ts"
import { pushChange, type Change } from "./history.ts"
import { releaseImagePreviewURL, replaceImagePreviewURL } from "./image-preview.ts"
import {
  applyCandidateImageStyles,
  applyLayoutImageRects,
  applyLayoutImageStyles,
  layoutImageTileBytes,
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
  keyboardConfig,
  resolvePanelConfig,
  setKeyboardHeight,
  setStyleField,
} from "./keyboard.ts"
import {
  applyLayoutAction as transformLayout,
  isListCell,
  listCellRect,
  listCellValue,
  mergeLayoutRects,
  moveRects,
  setExactGap,
  setListCellValue,
  type LayoutAction,
  type LayoutRect,
} from "./layout.ts"
import { mixedCoordinateDelta, shouldClearMixedInput } from "./mixed-input.ts"
import { installNumberInputWheel } from "./number-input-wheel.ts"
import { loadBuiltInProjectTemplate, operationError } from "./operations.ts"
import {
  archiveCopyPaths,
  archivePathOptions,
  availableSkinStates,
  canvasFitWidth,
  effectivePanelSection,
  previewScalePercent,
  scaleIniDocument,
  variantCopyPaths,
} from "./panel-tools.ts"
import {
  Preview,
  parseLegacyAnimation,
  parseLegacyHint,
  parseLegacyParticleEmitter,
  previewContentVerticalBounds,
  previewItems,
  previewStateImpact,
  type PreviewEvent,
} from "./preview.ts"
import { firstExistingPath, resourceImagePaths } from "./resources.ts"
import {
  candidatePreview,
  compositionSkinState,
  deleteBackward,
  deleteForward,
  insertText,
  moveCaret,
  moveCaretVertical,
} from "./simulation.ts"
import { SkinArchive } from "./skin.ts"
import {
  consumeSourceWriteSnapshot,
  resolveSourceArchivePath,
  writePendingSourcePaths,
  type SourceWriteSnapshot,
} from "./source-tree.ts"
import { SourceCodeEditor } from "./source-editor.ts"
import type { SourceEditorValueRange } from "./source-editor.ts"
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
import { unsavedDecision, type UnsavedDecision } from "./unsaved.ts"
import { checkForUpdate } from "./update.ts"
import { clientLog, clientLogZip, flushClientLogs, installClientLogging } from "./client-log.ts"
import { installSafeAreaLock } from "./safe-area.ts"

installClientLogging(document.querySelector<HTMLElement>("#about-update")?.dataset.currentVersion ?? "unknown")
installSafeAreaLock()

document.documentElement.classList.toggle("macos", isTauri() && navigator.userAgent.includes("Macintosh"))
document.documentElement.classList.toggle("windows", isTauri() && navigator.userAgent.includes("Windows"))
installNumberInputWheel()

const scrollbarIdleTimers = new WeakMap<HTMLElement, number>()
document.addEventListener("scroll", (event) => {
  if (!(event.target instanceof HTMLElement)) return
  const target = event.target
  target.classList.add("scrollbar-active")
  window.clearTimeout(scrollbarIdleTimers.get(target))
  scrollbarIdleTimers.set(target, window.setTimeout(() => {
    target.classList.remove("scrollbar-active")
  }, 1000))
}, true)

window.addEventListener("pointerdown", (event) => {
  if (event.button !== 0 || event.pointerType !== "mouse") return
  for (const target of event.composedPath()) {
    if (!(target instanceof HTMLElement)) continue
    const style = getComputedStyle(target)
    if (style.getPropertyValue("scrollbar-width") === "none") continue
    const size = Number.parseFloat(style.getPropertyValue("--scrollbar-size"))
    const rect = target.getBoundingClientRect()
    const vertical = target.scrollHeight > target.clientHeight
      && /auto|scroll|overlay/.test(style.overflowY)
      && event.clientX >= rect.right - size
      && event.clientY < rect.top + target.clientTop + target.clientHeight
    const horizontal = target.scrollWidth > target.clientWidth
      && /auto|scroll|overlay/.test(style.overflowX)
      && event.clientY >= rect.bottom - size
      && event.clientX < rect.left + target.clientLeft + target.clientWidth
    if (!vertical && !horizontal) continue

    const clientSize = vertical ? target.clientHeight : target.clientWidth
    const scrollSize = vertical ? target.scrollHeight : target.scrollWidth
    const scrollPosition = vertical ? target.scrollTop : target.scrollLeft
    const pointer = vertical ? event.clientY - rect.top - target.clientTop : event.clientX - rect.left - target.clientLeft
    const thumbSize = Math.max(24, clientSize * clientSize / scrollSize)
    const thumbStart = scrollPosition / (scrollSize - clientSize) * (clientSize - thumbSize)
    if (pointer >= thumbStart && pointer <= thumbStart + thumbSize) return

    const position = (pointer - thumbSize / 2) / (clientSize - thumbSize) * (scrollSize - clientSize)
    if (vertical) target.scrollTop = position
    else target.scrollLeft = position
    event.preventDefault()
    event.stopPropagation()
    return
  }
}, true)

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!
const newButton = $("#new") as HTMLButtonElement
const newProjectDialog = $("#new-project-dialog") as HTMLDialogElement
const newProjectForm = $("#new-project-form") as HTMLFormElement
const unsavedDialog = $("#unsaved-dialog") as HTMLDialogElement
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
const aboutDiagnostics = $("#about-diagnostics")
const exportLogsButton = $("#export-logs") as HTMLButtonElement
const exportLogsStatus = $("#export-logs-status")
const defaultDevice = $("#default-device") as HTMLSelectElement
const canvasBackground = $("#canvas-background") as HTMLSelectElement
const appTheme = $("#app-theme") as HTMLSelectElement
const sourceFontSize = $("#source-font-size") as HTMLInputElement
const windowMaterial = $("#window-material") as HTMLInputElement
const windowMaterialOpacitySetting = $("#window-material-opacity-setting")
const windowMaterialOpacityLabel = $("#window-material-opacity-label")
const windowMaterialOpacity = $("#window-material-opacity") as HTMLInputElement
const windowMaterialOpacityValue = $("#window-material-opacity-value") as HTMLOutputElement
const sidebarViewVisible = $("#sidebar-view-visible") as HTMLInputElement
const inspectorTabsVisible = $("#inspector-tabs-visible") as HTMLInputElement
const inspectorGroupedDisplay = $("#inspector-grouped-display") as HTMLInputElement
const sourceCompletionEnabled = $("#source-completion-enabled") as HTMLInputElement
const sourceValueHintsEnabled = $("#source-value-hints-enabled") as HTMLInputElement
const sourceLineExplanationEnabled = $("#source-line-explanation-enabled") as HTMLInputElement
const mobilePreviewPosition = $("#mobile-preview-position") as HTMLSelectElement
const editorCrosshair = $("#editor-crosshair") as HTMLInputElement
const editorCoordinateSnapSetting = $("#editor-coordinate-snap-setting")
const editorCoordinateSnap = $("#editor-coordinate-snap") as HTMLInputElement
const settingsStorageSection = $("#settings-storage-section")
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
const source = new SourceCodeEditor($("#source"))
source.setValuePreviewRenderer(renderSourceValueThumbnail)
const sourceEditor = $("#source-editor")
const sourceToolbar = $(".source-toolbar")
const sourceFindToggle = $("#source-find-toggle") as HTMLButtonElement
const sourceSearch = $("#source-search") as HTMLInputElement
const sourceSearchCount = $("#source-search-count")
const sourceSearchPrevious = $("#source-search-previous") as HTMLButtonElement
const sourceSearchNext = $("#source-search-next") as HTMLButtonElement
const sourceReplaceToggle = $("#source-replace-toggle") as HTMLButtonElement
const sourceReplaceRow = $(".source-replace-row")
const sourceReplacement = $("#source-replacement") as HTMLInputElement
const sourceReplace = $("#source-replace") as HTMLButtonElement
const sourceReplaceAll = $("#source-replace-all") as HTMLButtonElement
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
const fileOperationDialog = $("#file-operation-dialog") as HTMLDialogElement
const fileOperationTitle = $("#file-operation-title")
const fileOperationDetail = $("#file-operation-detail")
const fileOperationProgress = $("#file-operation-progress") as HTMLProgressElement
const fileOperationResult = $("#file-operation-result")
const fileOperationClose = $("#file-operation-close") as HTMLButtonElement
const LARGE_SKIN_BYTES = 5 * 1024 * 1024
let fileOperationProgressVisible = false
const panelStatus = $("#panel-status")
const previewCoordinates = $("#preview-coordinates")
const previewCoordinateX = $("#preview-coordinate-x")
const previewCoordinateY = $("#preview-coordinate-y")
const previewZoomOut = $("#preview-zoom-out") as HTMLButtonElement
const previewZoomFit = $("#preview-zoom-fit") as HTMLButtonElement
const previewZoomIn = $("#preview-zoom-in") as HTMLButtonElement
const panelScaleButton = $("#panel-scale") as HTMLButtonElement
const adaptIos26Button = $("#adapt-ios26") as HTMLButtonElement
const ios26Dialog = $("#ios26-dialog") as HTMLDialogElement
const ios26Form = $("#ios26-form") as HTMLFormElement
const panelScaleDialog = $("#panel-scale-dialog") as HTMLDialogElement
const panelScaleForm = $("#panel-scale-form") as HTMLFormElement
const panelCopySource = $("#panel-copy-source") as HTMLInputElement
const panelCopySourceOptions = $("#panel-copy-source-options") as HTMLDataListElement
const panelCopyTarget = $("#panel-copy-target") as HTMLInputElement
const panelCopyTargetOptions = $("#panel-copy-target-options") as HTMLDataListElement
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
const keyAppearanceFieldsGroup = $(".key-appearance-fields")
const bdaKeyFieldLabels: Record<string, string> = {
  BACK_STYLE: "背景样式（backStyle）",
  FORE_STYLE: "前景样式（foreStyles）",
  FORE_OFFSET: "前景样式偏移（foreStyleOffsets）",
  FONT_NAME: "字体名称（fontName）",
  FONT_SIZE: "字体大小（fontSize）",
  NM_COLOR: "正常文字颜色（normalColor）",
  HL_COLOR: "高亮文字颜色（highlightColor）",
}
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
const styleDetailPreviews = $("#style-detail-previews")
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
const bdaTileUsage = $("#bda-tile-usage") as HTMLSelectElement
const tileInnerTitle = $("#tile-inner-title")
const tileSourceFieldsGroup = $("#tile-source-fields")
const tilePreviewWrap = $("#tile-preview-wrap")
const tilePreview = $("#tile-preview") as HTMLCanvasElement
const newTileButton = $("#new-tile") as HTMLButtonElement
const duplicateTileButton = $("#duplicate-tile") as HTMLButtonElement
const deleteTileButton = $("#delete-tile") as HTMLButtonElement
const moveTileButton = $("#move-tile") as HTMLButtonElement
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

function sourceDirectoryEnabledBySettings(): boolean {
  const stored = localStorage.getItem("source-directory-enabled")
  return isAndroidTauri() ? stored === "true" : stored !== "false"
}
let stopSourceWatch: UnwatchFn | undefined
let sourceAutosaveTimer: number | undefined
let sourceAutosaveQueue = Promise.resolve()
const pendingSourcePaths = new Set<string>()
const sourceWriteSnapshots = new Map<string, SourceWriteSnapshot[]>()
let sourceWriteSnapshotTimer: number | undefined
const pendingSourceWatchPaths = new Set<string>()
let sourceWatchTimer: number | undefined
let selectedPath = ""
let selectedDocument: IniDocument | undefined
let layoutPath = ""
let layoutDocument: IniDocument | undefined
let selectedKeySections: string[] = []
let selectedCandidate = false
let unsavedNew = false
let assetURL = ""
let assetReturnPath = ""
let inspectorTab: "properties" | "source" = "properties"
let sourceFindVisible = false
let sourceSearchIndex = -1
let sourceInputHighlightTimer: number | undefined
let sourceInputRefreshPending = false
let sourceSearchTimer: number | undefined
let sourceHistoryHighlight: readonly [number, number] | undefined
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
let resourcePickerSelect: ((resourceID: string) => void) | undefined
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
let selectedBdaStyleGroup: BdaAppearanceStyleGroup = "imageStyles"
let styleReturnPath = ""
let styleReturnSelection: string[] = []
let styleReturnCandidate = false
let styleReturnScrollTop = 0
let styleReturnInspectorGroup = ""
let bdaSliceReturn: { path: string; styleID: string } | undefined
let selectedResourcePath = ""
let resourceURLs: string[] = []
let tilePath = ""
let tileDocument = IniDocument.parse("")
let slices: TileSlice[] = []
type BdaTileUsage = {
  index: number
  ref: BdaStyleRef
  highlighted: boolean
  label: string
}
let bdaTileUsages: BdaTileUsage[] = []
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
  "--candidate-top-inset-row",
  "--candidate-inset-row",
  "--candidate-content-row",
  "--candidate-input-height",
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
    selectedCandidate = false
    syncCandidateSelection()
    if (selectedPath !== layoutPath) selectFile(layoutPath, "overview")
    selectedKeySections = sections
    if (!sections.length) source.collapseSelection()
    if (sections.length && mobilePortraitQuery.matches) setMobilePane("inspector")
    populateKeyInspector()
    updateSourceHighlight()
    scrollSelectedSource()
  },
  false,
  (sections, deltaX, deltaY) => moveSelectedKeys(deltaX, deltaY, sections),
  $("#hint-preview") as HTMLCanvasElement,
)

function updatePointerCoordinates(
  event: Pick<PointerEvent, "clientX" | "clientY" | "pointerType">,
  target: HTMLElement,
  canvas: HTMLCanvasElement,
  geometry?: { target: DOMRect; wrap: DOMRect; wrapWidth: number; wrapHeight: number },
): void {
  if (event.pointerType !== "mouse" || editorCrosshair.checked && !isEditing()) {
    if (editorCrosshair.checked) previewCoordinates.hidden = true
    return
  }
  // During canvas panning the shell is transformed every frame. Reading its
  // bounds immediately after that write forces a synchronous layout. The pan
  // handler supplies the already-known geometry instead, keeping this path
  // compositor-only while preserving exact coordinates.
  const bounds = geometry?.target ?? target.getBoundingClientRect()
  if (!bounds.width || !bounds.height) return
  const wrapBounds = geometry?.wrap ?? canvasWrap.getBoundingClientRect()
  const wrapWidth = geometry?.wrapWidth ?? canvasWrap.clientWidth
  const wrapHeight = geometry?.wrapHeight ?? canvasWrap.clientHeight
  let x = Math.min(bounds.width - 1, Math.max(0, event.clientX - bounds.left))
  let y = Math.min(bounds.height - 1, Math.max(0, event.clientY - bounds.top))
  const snapPreview = canvas === previewCanvas ? preview : canvas === toolbarCanvas ? toolbarPreview : undefined
  const logicalSize = snapPreview?.logicalSize() ?? { width: canvas.width, height: canvas.height }
  const point = editorCrosshair.checked && editorCoordinateSnap.checked && snapPreview
    ? snapPreview.snapPoint(
      { x: x / bounds.width * logicalSize.width, y: y / bounds.height * logicalSize.height },
      bounds,
    )
    : { x: x / bounds.width * logicalSize.width, y: y / bounds.height * logicalSize.height }
  const snappedX = Math.min(logicalSize.width - 1, Math.max(0, point.x))
  const snappedY = Math.min(logicalSize.height - 1, Math.max(0, point.y))
  const logicalX = Math.floor(snappedX)
  const logicalY = Math.floor(snappedY)
  x = snappedX / logicalSize.width * bounds.width
  y = snappedY / logicalSize.height * bounds.height
  previewCoordinateX.textContent = String(logicalX)
  previewCoordinateY.textContent = String(logicalY)
  if (!editorCrosshair.checked) {
    previewCoordinates.hidden = false
    return
  }
  const crosshairX = Math.round(bounds.left - wrapBounds.left + x)
  const crosshairY = Math.round(bounds.top - wrapBounds.top + y)
  const overlayGeometry = { left: canvasWrap.scrollLeft, top: canvasWrap.scrollTop, width: wrapWidth, height: wrapHeight }
  if (
    !pointerOverlayGeometry ||
    pointerOverlayGeometry.left !== overlayGeometry.left ||
    pointerOverlayGeometry.top !== overlayGeometry.top ||
    pointerOverlayGeometry.width !== overlayGeometry.width ||
    pointerOverlayGeometry.height !== overlayGeometry.height
  ) {
    pointerOverlayGeometry = overlayGeometry
    previewCoordinates.style.left = `${pointerOverlayGeometry.left}px`
    previewCoordinates.style.top = `${pointerOverlayGeometry.top}px`
    previewCoordinates.style.width = `${pointerOverlayGeometry.width}px`
    previewCoordinates.style.height = `${pointerOverlayGeometry.height}px`
  }
  previewCoordinates.style.setProperty("--crosshair-x", `${crosshairX}px`)
  previewCoordinates.style.setProperty("--crosshair-y", `${crosshairY}px`)
  const labelWidth = 130
  previewCoordinates.style.setProperty(
    "--coordinate-label-x",
    `${crosshairX + labelWidth + 8 <= wrapWidth ? crosshairX + 8 : Math.max(0, crosshairX - labelWidth - 8)}px`,
  )
  previewCoordinates.style.setProperty(
    "--coordinate-label-y",
    `${Math.min(wrapHeight - 14, Math.max(14, crosshairY))}px`,
  )
  previewCoordinates.hidden = false
}

let pendingPointerCoordinates: {
  event: Pick<PointerEvent, "clientX" | "clientY" | "pointerType">
  target: HTMLElement
  canvas: HTMLCanvasElement
  geometry?: { target: DOMRect; wrap: DOMRect; wrapWidth: number; wrapHeight: number }
} | undefined
let pointerCoordinatesFrame = 0
let pointerOverlayGeometry: { left: number; top: number; width: number; height: number } | undefined

function schedulePointerCoordinates(
  event: PointerEvent,
  target: HTMLElement,
  canvas: HTMLCanvasElement,
  geometry?: { target: DOMRect; wrap: DOMRect; wrapWidth: number; wrapHeight: number },
): void {
  pendingPointerCoordinates = {
    event: { clientX: event.clientX, clientY: event.clientY, pointerType: event.pointerType },
    target,
    canvas,
    geometry,
  }
  if (pointerCoordinatesFrame) return
  pointerCoordinatesFrame = requestAnimationFrame(() => {
    pointerCoordinatesFrame = 0
    const pending = pendingPointerCoordinates
    pendingPointerCoordinates = undefined
    if (pending) updatePointerCoordinates(pending.event, pending.target, pending.canvas, pending.geometry)
  })
}

previewCanvas.addEventListener("pointermove", (event) => {
  schedulePointerCoordinates(event, previewCanvas, previewCanvas)
})
toolbarStrip.addEventListener("pointermove", (event) => {
  schedulePointerCoordinates(event, toolbarStrip, toolbarCanvas)
})
document.addEventListener("pointermove", (event) => {
  if (previewPanStart) return
  const target = event.target as Node
  if (
    event.pointerType === "mouse" &&
    !canvasWrap.contains(target) &&
    !toolbarStrip.contains(target)
  ) {
    pendingPointerCoordinates = undefined
    if (editorCrosshair.checked) previewCoordinates.hidden = true
    else {
      previewCoordinateX.textContent = "—"
      previewCoordinateY.textContent = "—"
    }
  }
})

const toolbarPreview = new Preview(toolbarCanvas, () => {}, () => {}, true)
const candidateBackgroundPreview = new Preview(candidateBackgroundCanvas, () => {}, () => {})

function resizeKeyboardPreviews(): void {
  preview.resize()
  toolbarPreview.resize()
  candidateBackgroundPreview.resize()
}
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

function setSimulatedComposition(value: string): void {
  simulatedComposition = value
  const current = skinState.value ? Number(skinState.value) : undefined
  const next = compositionSkinState(value, current)
  if (next !== current) applySkinState(next)
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
  populateKeyInspector()
  updateSourceHighlight()
  scrollSelectedSource()
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
      buffer = await keySoundContext.decodeAudioData(new Uint8Array(bytes).buffer)
    } catch (error) {
      if (/^FORM$/.test(new TextDecoder("ascii").decode(bytes.subarray(0, 4)))) {
        const decoded = decodeAiffPcm(bytes)
        buffer = keySoundContext.createBuffer(decoded.channelData.length, decoded.samplesDecoded, decoded.sampleRate)
        decoded.channelData.forEach((channel, index) => buffer!.copyToChannel(new Float32Array(channel), index))
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
        decoded.channelData.forEach((channel, index) => buffer!.copyToChannel(new Float32Array(channel), index))
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
    const sound = decodeBdaSoundConfig(bytes)
    const sounds = bdaPlatform(archive) === "ios" ? sound.iosKeySounds : sound.keySounds
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
      if (code === "F15" || code === "F16") setSimulatedComposition("")
      if (skinState.value === "38") activateSkinState(undefined)
      selectFile(path, "overview")
      eventLog.textContent += ` → 已切换预览到 ${target}`
      return
    }
  }
  if (code === "F36") {
    if (simulatedComposition) {
      setSimulatedComposition(Array.from(simulatedComposition).slice(0, -1).join(""))
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
      setSimulatedComposition("")
      refreshSimulationPreview()
      return
    }
    insertSimulatedText(" ")
    return
  }
  if (code === "F39") {
    setSimulatedComposition("")
    insertSimulatedText("\n")
    return
  }
  if (code === "F40") {
    setSimulatedComposition("")
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
    setSimulatedComposition(simulatedComposition + code.toLowerCase())
    refreshSimulationPreview()
    return
  }
  setSimulatedComposition("")
  insertSimulatedText(code)
}

function clearSimulatedOutput(): void {
  setSimulatedComposition("")
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
  const platform = button.dataset.bdaPlatform
  return format
    ? document.querySelector<HTMLButtonElement>(
      `[data-export-format="${format}"]${platform ? `[data-bda-platform="${platform}"]` : ""}`,
    ) ?? undefined
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
  const explicitLabel = group.dataset.inspectorGroupLabel?.trim()
  if (explicitLabel) return explicitLabel
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
    if (active && group instanceof HTMLDetailsElement) group.open = true
  }
  for (const button of Array.from(mobileInspectorGroups.querySelectorAll<HTMLButtonElement>("button"))) {
    const active = button.dataset.mobileInspectorGroup === id
    button.classList.toggle("active", active)
    button.setAttribute("aria-pressed", String(active))
  }
  if (scroll && (mobilePortraitQuery.matches || !inspectorGroupedDisplay.checked)) {
    const group = quickInspector.querySelector<HTMLElement>(`.mobile-inspector-managed[data-mobile-inspector-group="${CSS.escape(id)}"]`)
    if (group) {
      const top = group.getBoundingClientRect().top - quickInspector.getBoundingClientRect().top + quickInspector.scrollTop
      quickInspector.scrollTo({ top, behavior: "smooth" })
    }
  } else if (scroll) quickInspector.scrollTop = 0
}

function syncMobileInspectorGroups(): void {
  for (const group of Array.from(quickInspector.querySelectorAll<HTMLElement>(".mobile-inspector-managed"))) {
    group.classList.remove("mobile-inspector-managed", "mobile-inspector-active")
    delete group.dataset.mobileInspectorGroup
  }
  const groups = Array.from(quickInspector.querySelectorAll<HTMLElement>(":scope > .inspector-group"))
    .filter((group) => !group.hidden)
    .flatMap((group) => {
      if (group === documentFieldsGroup) {
        return Array.from(documentFields.querySelectorAll<HTMLElement>(":scope > .document-property-section"))
      }
      if (group === bdaConfigFieldsGroup) {
        return Array.from(bdaConfigFields.querySelectorAll<HTMLElement>(":scope > .bda-inspector-section"))
      }
      return [group]
    })
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
  updateSourceFindVisibility()
})
let mobileSwipeStart: { pointerId: number; x: number; y: number } | undefined
mainWorkspace.addEventListener("pointerdown", (event) => {
  if (!mobilePortraitQuery.matches || event.pointerType === "mouse" && event.button !== 0 ||
    !(event.target as Element).closest("aside, .source")) return
  mobileSwipeStart = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }
})
mainWorkspace.addEventListener("pointermove", (event) => {
  if (!mobileSwipeStart || mobileSwipeStart.pointerId !== event.pointerId) return
  const deltaX = event.clientX - mobileSwipeStart.x
  const deltaY = event.clientY - mobileSwipeStart.y
  if (Math.abs(deltaY) > 12 && Math.abs(deltaY) > Math.abs(deltaX)) {
    mobileSwipeStart = undefined
    return
  }
  if (Math.abs(deltaX) < 56 || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) return
  mobileSwipeStart = undefined
  setMobilePane(deltaX < 0 ? "inspector" : "layout")
})
mainWorkspace.addEventListener("pointerup", (event) => {
  if (!mobileSwipeStart || mobileSwipeStart.pointerId !== event.pointerId) return
  const deltaX = event.clientX - mobileSwipeStart.x
  const deltaY = event.clientY - mobileSwipeStart.y
  mobileSwipeStart = undefined
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
  if (!editing && editorCrosshair.checked) previewCoordinates.hidden = true
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
  updateSourceSearchStatus()
  syncSegmentedControls()
}

function selectChoice(select: HTMLSelectElement, value: string): void {
  if (select.value === value) return
  select.value = value
  select.dispatchEvent(new Event("change"))
}

type SourceFilePayload = { path: string; data: string }
type SourceReadFilePayload = { path: string; data: number[] }
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

function sourceWriteKey(path: string): string {
  const normalized = path.replaceAll("\\", "/")
  return navigator.userAgent.includes("Windows") ? normalized.toLowerCase() : normalized
}

function rememberSourceWrite(path: string, data: SourceWriteSnapshot): void {
  const key = sourceWriteKey(path)
  const snapshots = sourceWriteSnapshots.get(key) ?? []
  snapshots.push(data)
  sourceWriteSnapshots.set(key, snapshots.slice(-4))
  if (sourceWriteSnapshotTimer !== undefined) clearTimeout(sourceWriteSnapshotTimer)
  sourceWriteSnapshotTimer = window.setTimeout(() => {
    sourceWriteSnapshots.clear()
    sourceWriteSnapshotTimer = undefined
  }, 10_000)
}

function sourceFilesPayload(value: SkinArchive): SourceFilePayload[] {
  return value.sourceFiles().map((file) => {
    const canonical = value.canonicalSourcePath(file.path)
    const data = value.isBdaConfig(canonical) ? bdaWorkspaceData(canonical, file.data) : file.data
    return { path: file.path, data: encodeBase64(data) }
  })
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = ""
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
  }
  return btoa(binary)
}

function decodeBase64Archive(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
  return bytes
}

function bdaWorkspaceData(path: string, bytes: Uint8Array): Uint8Array {
  const source = JSON.parse(decodedBdaSource(path, bytes)) as Record<string, unknown>
  source.$bdiEditorRaw = encodeBase64(bytes)
  return new TextEncoder().encode(JSON.stringify(source, null, 2))
}

function sourceArchiveFromFiles(files: Array<{ path: string; data: Uint8Array }>): SkinArchive {
  const decoder = new TextDecoder()
  return SkinArchive.fromSourceFiles(files.map((file) => {
    if (!/\/\d*(?:appearance|animation|lightAnimation|sound|switch|sticker|scene)Config$/i.test(`/${file.path}`)) return file
    const text = decoder.decode(file.data)
    if (!/^\s*\{/.test(text)) return file
    const raw = (JSON.parse(text) as Record<string, unknown>).$bdiEditorRaw
    if (typeof raw !== "string") throw new Error(`BDA 解码源码缺少 $bdiEditorRaw：${file.path}`)
    return { path: file.path, data: applyDecodedBdaSource(file.path, decodeBase64Archive(raw), text) }
  }))
}

async function flushSourceAutosave(): Promise<void> {
  if (sourceAutosaveTimer !== undefined) {
    clearTimeout(sourceAutosaveTimer)
    sourceAutosaveTimer = undefined
  }
  if (archive && sourceWorkspacePath && pendingSourcePaths.size) {
    const workspace = sourceWorkspacePath
    const value = archive
    sourceAutosaveQueue = sourceAutosaveQueue.catch(() => {}).then(() =>
      writePendingSourcePaths(pendingSourcePaths, async (paths) => {
        const changes: SourceChangePayload[] = paths.map((path) => {
          const archivePath = sourcePathForArchive(path)
          const canonical = value.canonicalSourcePath(archivePath)
          const bytes = value.getSourceBytes(archivePath)
          const data = bytes && value.isBdaConfig(canonical) ? bdaWorkspaceData(canonical, bytes) : bytes
          return { path, data: data ? Array.from(data) : null, directory: false }
        })
        for (const change of changes) rememberSourceWrite(change.path, change.data ? new Uint8Array(change.data) : null)
        await invoke("apply_source_changes", { path: workspace, changes })
      }),
    )
  }
  await sourceAutosaveQueue
}

function scheduleSourceAutosave(paths: string[]): void {
  if (!archive || (!sourceWorkspacePath && sourceWorkspacePendingArchive !== archive)) return
  for (const path of paths) pendingSourcePaths.add(sourcePathForWorkspace(archive.sourcePath(path)))
  if (!sourceWorkspacePath || sourceAutosaveTimer !== undefined) return
  sourceAutosaveTimer = window.setTimeout(() => {
    void flushSourceAutosave().catch((error) => showError(error, "自动保存源码"))
  }, 3 * 60_000)
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
  const ignoredChanges = new Set(changes.filter((change) => {
    const data = change.data ? new Uint8Array(change.data) : null
    return consumeSourceWriteSnapshot(sourceWriteSnapshots, sourceWriteKey(change.path), data)
  }))
  const directorySnapshots = changes.filter((change) => change.directory && !ignoredChanges.has(change))
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
    if (change.directory || ignoredChanges.has(change)) continue
    pendingSourcePaths.delete(change.path)
    const data = change.data ? new Uint8Array(change.data) : null
    if (change.data) {
      const canonical = archive.canonicalSourcePath(sourcePathForArchive(change.path))
      const before = archive.getBytes(canonical)
      const after = before && archive.isBdaConfig(canonical)
        ? applyDecodedBdaSource(canonical, before, new TextDecoder().decode(data!))
        : data!
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
    if (selectedPath && (archive.getBytes(selectedPath) || isBdaAppearancePartPath(selectedPath))) {
      selectFile(selectedPath, sidebarView, "document", true)
    }
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
  sourceWriteSnapshots.clear()
  if (sourceWriteSnapshotTimer !== undefined) clearTimeout(sourceWriteSnapshotTimer)
  sourceWriteSnapshotTimer = undefined
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

function chooseUnsavedDecision(): Promise<UnsavedDecision> {
  unsavedDialog.returnValue = ""
  unsavedDialog.showModal()
  return new Promise((resolve) => {
    unsavedDialog.addEventListener(
      "close",
      () => resolve(unsavedDecision(unsavedDialog.returnValue)),
      { once: true },
    )
  })
}

async function prepareDocumentReplacement(): Promise<boolean> {
  try {
    await flushSourceAutosave()
  } catch (error) {
    showError(error, "自动保存源码")
    return false
  }
  if (!hasUnsavedChanges()) return true
  let decision: "save" | "discard" | "cancel"
  if (isTauri()) {
    const result = await message("当前皮肤尚未保存。是否先保存修改？", {
      title: "未保存的皮肤",
      kind: "warning",
      buttons: { yes: "保存", no: "不保存", cancel: "取消" },
    })
    decision = unsavedDecision(result)
  } else {
    decision = await chooseUnsavedDecision()
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

function commitText(path: string, before: string, after: string, coalesce = false): void {
  if (!archive || before === after) return
  sourceHistoryHighlight = undefined
  archive.setText(path, after)
  pushChange(undoStack, { kind: "text", path, before, after }, coalesce)
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
  if (path === selectedPath) sourceHistoryHighlight = insertedTextRange(archive.getText(path), text)
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
  sourceHistoryHighlight = undefined
  redoStack.push(change)
  applyChangeSnapshot(change, "before")
  renderFiles()
  if (selectedPath && (archive?.getBytes(selectedPath) || isBdaAppearancePartPath(selectedPath))) {
    selectFile(selectedPath, sidebarView)
  }
  updateHistoryButtons()
}

function redo(): void {
  const change = redoStack.pop()
  if (!change) return
  sourceHistoryHighlight = undefined
  undoStack.push(change)
  applyChangeSnapshot(change, "after")
  renderFiles()
  if (selectedPath && (archive?.getBytes(selectedPath) || isBdaAppearancePartPath(selectedPath))) {
    selectFile(selectedPath, sidebarView)
  }
  updateHistoryButtons()
}

function applyChangeSnapshot(change: Change, side: "before" | "after"): void {
  if (change.kind === "batch") {
    const changes = side === "before" ? [...change.changes].reverse() : change.changes
    for (const child of changes) applyChangeSnapshot(child, side)
  } else if (change.kind === "text") applyTextSnapshot(change.path, change[side])
  else applyBytesSnapshot(change.path, change[side])
}

function applyBytesSnapshot(path: string, bytes?: Uint8Array): void {
  if (!archive) return
  if (bytes) archive.setBytes(path, bytes)
  else archive.delete(path)
  scheduleSourceAutosave([path])
  refreshBdaLayout()
  if (selectedPath === path && bytes && archive.isBdaConfig(path)) setSourceValue(decodedBdaEditorSource(path, bytes))
  if (resourceConfigActive && archive.format === "bda" && selectedResourcePath) {
    loadTiles(selectedResourcePath)
    renderResourceInspector()
  }
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

const bdaAppearanceStyleGroups = [
  ["imageStyles", "图片样式"],
  ["textStyles", "文字样式"],
  ["colorStyles", "颜色样式"],
] as const satisfies ReadonlyArray<readonly [BdaAppearanceStyleGroup, string]>

function bdaAppearanceStylePath(group: BdaAppearanceStyleGroup): string {
  return `${theme.value}/skin/${orientation.value}/.appearance/${group}.json`
}

function bdaAppearancePart(path: string): BdaAppearancePart | undefined {
  if (!archive || archive.format !== "bda") return
  const prefix = `${theme.value}/skin/${orientation.value}/`
  if (!path.startsWith(prefix)) return
  const style = path.slice(prefix.length).match(/^\.appearance\/(imageStyles|textStyles|colorStyles)\.json$/)
  if (style) return { kind: "styles", group: style[1] as BdaAppearanceStyleGroup }
  if (path.slice(prefix.length).includes("/")) return
  const panelName = path.slice(prefix.length).replace(/\.ini$/i, "")
  if (!/\.ini$/i.test(path) || !currentBdaAppearance()?.appearance.panels.has(panelName)) return
  return { kind: "panel", name: panelName }
}

function isBdaAppearancePartPath(path: string): boolean {
  return Boolean(bdaAppearancePart(path))
}

function refreshSelectedBdaSource(): void {
  if (!archive || archive.format !== "bda") return
  const part = bdaAppearancePart(selectedPath)
  if (part) {
    const info = currentBdaAppearance()
    if (info) setSourceValue(decodedBdaAppearancePart(info.bytes, part))
    return
  }
  if (archive.isBdaConfig(selectedPath)) {
    const bytes = archive.getBytes(selectedPath)
    if (bytes) setSourceValue(decodedBdaEditorSource(selectedPath, bytes))
    return
  }
  if (!isBdaVirtualTextPath(selectedPath)) return
  const info = currentBdaAppearance()
  if (info) setSourceValue(decodedBdaSource(info.path, info.bytes, selectedPath.split("/").pop()))
}

function commitBdaSourceEdit(): void {
  if (!isEditing() || !archive) return
  const part = bdaAppearancePart(selectedPath)
  if (part) {
    const info = currentBdaAppearance()
    if (!info) return
    try {
      const after = applyDecodedBdaAppearancePart(info.path, info.bytes, source.value, part)
      commitBytes(info.path, info.bytes, after)
      refreshBdaLayout(layoutPath)
      setSourceValue(decodedBdaAppearancePart(after, part))
      refreshPreview()
      populateKeyInspector()
      updateDirty()
    } catch (error) {
      setSourceValue(decodedBdaAppearancePart(info.bytes, part))
      showError(error, "编辑 appearanceConfig 片段")
    }
    return
  }
  if (!archive.isBdaConfig(selectedPath) || !bdaDecodedSourceEditable(selectedPath)) return
  const before = archive.getBytes(selectedPath)
  if (!before) return
  try {
    const after = applyDecodedBdaSource(selectedPath, before, source.value)
    commitBytes(selectedPath, before, after)
    if (/appearanceConfig$/i.test(selectedPath)) refreshBdaLayout(layoutPath)
    setSourceValue(decodedBdaEditorSource(selectedPath, after))
    refreshPreview()
    populateKeyInspector()
    updateDirty()
  } catch (error) {
    setSourceValue(decodedBdaEditorSource(selectedPath, before))
    showError(error, "编辑 BDA JSON")
  }
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
  if (isBdaVirtualTextPath(path)) {
    let base = IniDocument.parse(bdaBase!.getText(bdaBasePath(path)))
    const info = currentBdaAppearance()
    const width = Number(base.get("PANEL", "SIZE")?.split(",")[0])
    if (info?.appearance.designWidth && width) {
      base = scaleIniDocument(base, info.appearance.designWidth / width, info.appearance.designWidth / width)
    }
    return info ? bdaLayoutDocument(base, info.appearance, layout.value) : base
  }
}

function refreshBdaLayout(path = preferredPath()): boolean {
  const info = currentBdaAppearance()
  const basePath = bdaBasePath(path)
  if (!info || !bdaBase?.isText(basePath)) return false
  layoutPath = path
  let base = IniDocument.parse(bdaBase.getText(basePath))
  const width = Number(base.get("PANEL", "SIZE")?.split(",")[0])
  if (info.appearance.designWidth && width) {
    base = scaleIniDocument(base, info.appearance.designWidth / width, info.appearance.designWidth / width)
  }
  layoutDocument = bdaLayoutDocument(
    base,
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
    setSimulatedComposition("")
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
  deviceShell.style.setProperty("--candidate-top-inset-row", `${geometry.topInsetHeight}fr`)
  deviceShell.style.setProperty("--candidate-inset-row", `${geometry.candidateInsetHeight}fr`)
  deviceShell.style.setProperty("--candidate-content-row", `${geometry.candidateContentHeight}fr`)
  deviceShell.style.setProperty("--candidate-input-height", `${geometry.candidateInsetHeight}px`)
  deviceShell.style.setProperty("--panel-row", `${geometry.panelHeight}fr`)
  deviceShell.style.setProperty("--safe-row", `${geometry.safeBottomHeight}fr`)
}

function devicePreviewTransparent(): boolean {
  return true
}

function refreshPreview(): void {
  if (!archive) return
  const currentArchive = archive
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
  const legacyAnimationPath = legacyAnimationConfigPath()
  preview.setLegacyAnimation(
    archive.format !== "bda" && archive.isText(styleConfigPath()) && legacyAnimationPath
      ? parseLegacyAnimation(
          IniDocument.parse(archive.getText(styleConfigPath())),
          IniDocument.parse(archive.getText(legacyAnimationPath)),
        )
      : undefined,
  )
  const hintBase = `${theme.value}/skin/${orientation.value}/`
  const hintPath = (name: string) => `${hintBase}${name}`
  const bdaInfo = currentBdaAppearance()
  const bdaHintPanel = bdaInfo?.appearance.panels.get(layout.value.replace(/\.ini$/i, ""))
  const hasBdaHints = Boolean(bdaHintPanel?.hints.size)
  const hintSource = currentArchive.format === "bda" ? bdaBase : currentArchive
  const hintDocument = (name: string) => {
    if (currentArchive.format === "bda" && !hasBdaHints) return
    const path = currentArchive.format === "bda" ? bdaBasePath(hintPath(name)) : hintPath(name)
    if (!hintSource?.isText(path)) return
    const document = IniDocument.parse(hintSource.getText(path))
    return bdaInfo ? bdaLayoutDocument(document, bdaInfo.appearance, layout.value) : document
  }
  const shortHint = hintDocument("hint1.pop") ?? hintDocument("hint.pop")
  const longHint = hintDocument("hint2.pop") ?? shortHint
  preview.setLegacyHints(
    parseLegacyHint(shortHint),
    parseLegacyHint(longHint),
    currentArchive.format === "bda" && hasBdaHints,
  )
  const bdaGenPath = bdaBasePath(genConfigPath())
  const bdaGen = archive.format === "bda" && bdaBase?.isText(bdaGenPath)
    ? IniDocument.parse(bdaBase.getText(bdaGenPath))
    : undefined
  preview.setOffsets(context?.gen ?? bdaGen)
  preview.setDefaults(context?.gen ?? bdaGen)
  preview.setTheme(theme.value === "dark" ? "dark" : "light")
  preview.setTransparent(devicePreviewTransparent())
  if (context && layoutDocument && resolver) {
    const symbolPanel = candidateArea.hidden
    const candidatePath = toolbarConfigPath()
    const candidateLayout = candidatePath && archive.isText(candidatePath)
      ? IniDocument.parse(archive.getText(candidatePath))
      : undefined
    const config = resolvePanelConfig(
      layoutDocument,
      context.gen,
      context.styles,
    )
    const inputVisual = resolver.resolveText(
      candidateInputForegroundStyle(context.gen, candidateLayout),
      false,
    )
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
    preview.setPanel(
      config.styleID,
      config.width,
      config.height,
      layoutDocument.get("PANEL", "ANIM_STYLE") ?? "",
    )
    const candidateHeight = symbolPanel ? 0 : (toolbarSize?.height ?? 0)
    const candidateInputHeight = symbolPanel ? 0 : (toolbarSize?.inputHeight ?? 0)
    updatePanelTools(config.width, config.height, candidateHeight)
    activeKeyboardGeometry = {
      panelWidth: config.width,
      panelHeight: config.height,
      candidateHeight,
      candidateInputHeight,
    }
    applyDeviceKeyboardGeometry(
      config.width,
      config.height,
      candidateHeight,
      candidateInputHeight,
    )
  } else if (bdaGen && layoutDocument) {
    const generalSize = bdaGen.get("PANEL", "SIZE")?.split(",").map(Number)
    const layoutSize = layoutDocument.get("PANEL", "SIZE")?.split(",").map(Number)
    const generalPanelWidth = generalSize?.[0] || DEFAULT_BDA_PANEL_WIDTH
    const panelWidth = layoutSize?.[0] || generalPanelWidth
    const panelHeight = layoutSize?.[1] || generalSize?.[1] || DEFAULT_BDA_PANEL_HEIGHT
    const candidateDocument = toolbarConfigPath() ? textDocument(toolbarConfigPath()!) : undefined
    const panel = currentBdaAppearance()?.appearance.panels.get(layout.value.replace(/\.ini$/i, ""))
    const inputVisual = resolver?.resolveText(
      panel?.input?.textStyle
        ? bdaStyleID(panel.input.textStyle)
        : candidateInputForegroundStyle(bdaGen, candidateDocument),
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
      candidateVisual ?? { color: "#ffffff" },
      candidateTextWidth,
    )
    const firstCandidate = candidateWords.firstElementChild as HTMLElement | null
    if (firstCandidate) applyCandidateTextVisual(firstCandidate, firstVisual, candidateTextWidth)
    preview.setPanel(
      bdaStyleID(panel?.wholeBackStyle ?? panel?.backStyle),
      panelWidth,
      panelHeight,
    )
    const bdaSymbolPanel = candidateArea.hidden
    const candidateHeight = bdaSymbolPanel ? 0 : (toolbarSize?.height ?? 0)
    const candidateInputHeight = bdaSymbolPanel ? 0 : (toolbarSize?.inputHeight ?? 0)
    updatePanelTools(panelWidth, panelHeight, candidateHeight)
    activeKeyboardGeometry = {
      panelWidth,
      panelHeight,
      candidateHeight,
      candidateInputHeight,
    }
    applyDeviceKeyboardGeometry(
      panelWidth,
      panelHeight,
      candidateHeight,
      candidateInputHeight,
    )
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
  const symbolPanel = candidateArea.hidden
  const candidateHeight = symbolPanel ? 0 : (toolbarSize?.height ?? activeKeyboardGeometry.candidateHeight)
  const candidateInputHeight = symbolPanel
    ? 0
    : (toolbarSize?.inputHeight ?? activeKeyboardGeometry.candidateInputHeight)
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
  requestAnimationFrame(resizeKeyboardPreviews)
}

function updateCanvasPanelStatus(renderedWidth: number): void {
  if (!canvasLogicalSize) return
  panelStatus.textContent = `面板：${Math.round(canvasLogicalSize.width)} × ${Math.round(canvasLogicalSize.panelHeight)} · 预览缩放：${Math.round(renderedWidth / canvasLogicalSize.width * 100)}%`
}

let fitCanvasDebounce: ReturnType<typeof setTimeout> | undefined
let canvasFitFrozen = false
let previewZoom = 1
let previewPanLocked = false
let previewPanX = 0
let previewPanY = 0
let previewPanStart: { x: number; y: number; panX: number; panY: number } | undefined
let previewPanCandidate: { pointerId: number; x: number; y: number; panX: number; panY: number } | undefined
let pendingPreviewPan: { x: number; y: number } | undefined
let previewPanFrame = 0
let previewPanGeometry: { target: DOMRect; wrap: DOMRect; wrapWidth: number; wrapHeight: number } | undefined

function setPreviewPan(x: number, y: number): void {
  previewPanX = x
  previewPanY = y
  deviceShell.style.transform = `translate(${x}px, ${y}px) scale(${device.value === "canvas" ? 1 : previewZoom})`
}

function schedulePreviewPan(x: number, y: number): void {
  pendingPreviewPan = { x, y }
  if (previewPanFrame) return
  previewPanFrame = requestAnimationFrame(() => {
    previewPanFrame = 0
    const pending = pendingPreviewPan
    pendingPreviewPan = undefined
    if (pending) setPreviewPan(pending.x, pending.y)
  })
}

function flushPreviewPan(): void {
  if (previewPanFrame) cancelAnimationFrame(previewPanFrame)
  previewPanFrame = 0
  const pending = pendingPreviewPan
  pendingPreviewPan = undefined
  if (pending) setPreviewPan(pending.x, pending.y)
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
  requestAnimationFrame(resizeKeyboardPreviews)
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
previewZoomFit.addEventListener("dblclick", () => {
  previewPanLocked = !previewPanLocked
  previewZoomFit.ariaPressed = String(previewPanLocked)
  previewZoomFit.ariaLabel = previewPanLocked ? "适配窗口，画布已锁定，双击解锁" : "适配窗口，双击锁定画布"
  previewZoomFit.title = previewPanLocked ? "画布已锁定（双击解锁）" : "适配窗口（双击锁定画布）"
  finishPreviewPan()
})
previewZoomIn.addEventListener("click", () => applyPreviewZoom(previewZoom + 0.1))
canvasWrap.addEventListener("wheel", (event) => {
  if (deviceShell.hidden) return
  event.preventDefault()
  if (previewPanLocked) return
  applyPreviewZoom(
    previewZoom + (event.deltaY < 0 ? 0.1 : -0.1),
    { x: event.clientX, y: event.clientY },
  )
}, { passive: false })

window.addEventListener("blur", () => {
  flushPreviewPan()
  previewPanCandidate = undefined
  previewPanStart = undefined
  preview.setPointerInteractionLocked(false)
  canvasWrap.classList.remove("preview-pan-ready", "preview-panning")
})

canvasWrap.addEventListener("pointerdown", (event) => {
  if (
    event.button !== 0 ||
    previewPanLocked ||
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
    preview.setPointerInteractionLocked(true)
    // Cache layout before the first transform write. Every subsequent frame
    // can derive the transformed canvas bounds from this snapshot and the pan
    // delta, avoiding forced reflow in the crosshair update path.
  previewPanGeometry = {
      target: previewCanvas.getBoundingClientRect(),
      wrap: canvasWrap.getBoundingClientRect(),
      wrapWidth: canvasWrap.clientWidth,
      wrapHeight: canvasWrap.clientHeight,
    }
    if (pointerCoordinatesFrame) cancelAnimationFrame(pointerCoordinatesFrame)
    pointerCoordinatesFrame = 0
    pendingPointerCoordinates = undefined
    canvasWrap.classList.add("preview-panning")
    canvasWrap.setPointerCapture(event.pointerId)
  }
  if (!previewPanStart) return
  event.preventDefault()
  schedulePreviewPan(
    previewPanStart.panX + event.clientX - previewPanStart.x,
    previewPanStart.panY + event.clientY - previewPanStart.y,
  )
  const geometry = previewPanGeometry
  if (geometry) {
    const offsetX = event.clientX - previewPanStart.x
    const offsetY = event.clientY - previewPanStart.y
    const target = geometry.target
    schedulePointerCoordinates(event, previewCanvas, previewCanvas, {
      target: new DOMRect(target.left + offsetX, target.top + offsetY, target.width, target.height),
      wrap: geometry.wrap,
      wrapWidth: geometry.wrapWidth,
      wrapHeight: geometry.wrapHeight,
    })
  } else {
    schedulePointerCoordinates(event, previewCanvas, previewCanvas)
  }
})

function finishPreviewPan(): void {
  flushPreviewPan()
  previewPanCandidate = undefined
  previewPanStart = undefined
  previewPanGeometry = undefined
  preview.setPointerInteractionLocked(false)
  canvasWrap.classList.remove("preview-pan-ready", "preview-panning")
}

canvasWrap.addEventListener("pointerup", finishPreviewPan)
canvasWrap.addEventListener("pointercancel", finishPreviewPan)

function updateCanvasCandidateGeometry(candidateHeight: number): void {
  if (!canvasLogicalSize) return
  canvasLogicalSize.height = canvasLogicalSize.panelHeight + candidateHeight
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
    height: height + candidateHeight,
    panelHeight: height,
    panelVisibleHeight: content.height,
  }
  fitCanvasPreview()
  const bdaSkin = archive?.format === "bda"
  const states = bdaSkin ? [] : availableSkinStates(...skinStateDocuments())
  const selected = skinState.value
  const selectedState = selected ? Number(selected) : undefined
  if (!bdaSkin && selectedState && selectedState <= 122 && !states.includes(selectedState)) {
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

function panelCopySourceSize(): [number, number] | undefined {
  if (!archive) return
  const source = panelCopySource.value.trim().replace(/\\/g, "/").replace(/\/+$/, "")
  if (archive.isText(source)) return panelSizeForPath(source)
  for (const path of archive.names()) {
    if (path.startsWith(`${source}/`) && /\.ini$/i.test(path)) {
      const size = panelSizeForPath(path)
      if (size) return size
    }
  }
}

function updatePanelCopyForm(): void {
  if (!archive) return
  const sourceSize = panelCopySourceSize()
  panelSourceWidth.value = sourceSize ? String(sourceSize[0]) : ""
  panelSourceHeight.value = sourceSize ? String(sourceSize[1]) : ""
  if (!panelTargetWidth.value && sourceSize) panelTargetWidth.value = String(sourceSize[0])
  if (!panelTargetHeight.value && sourceSize) panelTargetHeight.value = String(sourceSize[1])
  if (!sourceSize) panelScaleEnabled.checked = false
  panelScaleEnabled.disabled = !sourceSize
  panelScaleOptions.hidden = !panelScaleEnabled.checked
  panelSourceWidth.disabled = true
  panelSourceHeight.disabled = true
  panelTargetWidth.disabled = !panelScaleEnabled.checked
  panelTargetHeight.disabled = !panelScaleEnabled.checked
  try {
    const copies = archiveCopyPaths(archive.names(), panelCopySource.value, panelCopyTarget.value)
    panelScaleSummary.textContent = copies.length === 1
      ? `目标：${copies[0].target}`
      : `目标：${panelCopyTarget.value.trim()}（${copies.length} 个文件）`
  } catch {
    panelScaleSummary.textContent = ""
  }
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

function defaultPanelCopyTarget(source: string): string {
  if (source.endsWith("/")) return `${source.slice(0, -1)}_copy/`
  const slash = source.lastIndexOf("/") + 1
  const dot = source.lastIndexOf(".")
  return dot >= slash
    ? `${source.slice(0, dot)}_copy${source.slice(dot)}`
    : `${source}_copy`
}

function openPanelCopyDialog(): void {
  if (!archive) return
  const paths = archivePathOptions(archive.names())
  if (!paths.length) {
    showError(new Error("皮肤中没有可复制的目录或文件"), "打开面板复制")
    return
  }
  const options = paths.map((value) => Object.assign(document.createElement("option"), { value }))
  panelCopySourceOptions.replaceChildren(...options.map((option) => option.cloneNode(true)))
  panelCopyTargetOptions.replaceChildren(...options)
  panelCopySource.value = paths.includes(selectedPath) ? selectedPath :
    paths.find((path) => path === `${theme.value}/skin/${orientation.value}/${layout.value}`) ?? paths[0]
  panelCopyTarget.value = defaultPanelCopyTarget(panelCopySource.value)
  panelScaleEnabled.checked = false
  panelTargetWidth.value = ""
  panelTargetHeight.value = ""
  updatePanelCopyForm()
  panelScaleDialog.showModal()
}

async function copyPanel(): Promise<boolean> {
  if (!archive) return false
  const currentArchive = archive
  const copies = archiveCopyPaths(currentArchive.names(), panelCopySource.value, panelCopyTarget.value)
  const existingTargets = copies.filter(({ target }) => currentArchive.getBytes(target))
  if (existingTargets.length && !window.confirm(`目标中已有 ${existingTargets.length} 个文件，是否覆盖？`)) return false

  let xRatio = 1
  let yRatio = 1
  if (panelScaleEnabled.checked) {
    const sourceSize = panelCopySourceSize()
    const targetWidth = Number(panelTargetWidth.value)
    const targetHeight = Number(panelTargetHeight.value)
    if (!sourceSize || ![targetWidth, targetHeight].every((value) => Number.isFinite(value) && value > 0)) {
      throw new Error("面板分辨率必须是正数")
    }
    xRatio = targetWidth / sourceSize[0]
    yRatio = targetHeight / sourceSize[1]
  }

  const staged = new Map<string, Uint8Array>()
  const encoder = new TextEncoder()
  for (const { source, target } of copies) {
    const bytes = currentArchive.getBytes(source)!
    const scaled = panelScaleEnabled.checked && (xRatio !== 1 || yRatio !== 1)
    const output = scaled && source.toLowerCase().endsWith(".png")
      ? await resizePng(bytes, xRatio, yRatio)
      : scaled && /\.(?:ini|til)$/i.test(source) && currentArchive.isText(source)
        ? encoder.encode(scaleIniDocument(IniDocument.parse(currentArchive.getText(source)), xRatio, yRatio).toString())
        : bytes.slice()
    staged.set(target, output)
  }
  for (const [path, bytes] of staged) currentArchive.setBytes(path, bytes)
  scheduleSourceAutosave([...staged.keys()])

  const targetPath = copies[0].target
  const variant = targetPath.match(/^(light|dark)\/skin\/(port|land)\//)
  if (variant) {
    theme.value = variant[1]
    orientation.value = variant[2] as "port" | "land"
    syncSegmentedControls()
  }
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
  clientLog.error("operation.error", { action }, error)
  void flushClientLogs()
  eventLog.dataset.kind = "error"
  eventLog.textContent = text
  if (isTauri() && !fileOperationDialog.open) {
    void message(text, { title: `${action}失败`, kind: "error" }).catch(() => {})
  }
}

function updateFileOperationProgress(value: number, detail: string): void {
  fileOperationProgress.value = Math.max(0, Math.min(100, value))
  fileOperationProgress.textContent = `${Math.round(fileOperationProgress.value)}%`
  fileOperationDetail.textContent = detail
}

function showSkinLoadProgress(size: number): boolean {
  if (size <= LARGE_SKIN_BYTES) return false
  if (!fileOperationProgressVisible) {
    fileOperationProgressVisible = true
    if (!fileOperationDialog.open) fileOperationDialog.showModal()
  }
  return true
}

async function readBrowserSkinFile(file: File): Promise<Uint8Array> {
  if (!showSkinLoadProgress(file.size)) return new Uint8Array(await file.arrayBuffer())
  const output = new Uint8Array(file.size)
  const reader = file.stream().getReader()
  let offset = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    output.set(value, offset)
    offset += value.length
    updateFileOperationProgress(2 + offset / file.size * 16, `正在读取皮肤文件… ${Math.round(offset / file.size * 100)}%`)
  }
  return output
}

async function readNativeSkinFile(path: string): Promise<Uint8Array> {
  const size = await invoke<number>("skin_file_size", { path })
  if (showSkinLoadProgress(size)) {
    updateFileOperationProgress(2, "正在读取皮肤文件… 0%")
    await waitForInterfacePaint()
  }
  const progress = new Channel<[number, number]>()
  progress.onmessage = ([loaded, total]) => {
    if (!fileOperationProgressVisible) return
    updateFileOperationProgress(2 + loaded / total * 16, `正在读取皮肤文件… ${Math.round(loaded / total * 100)}%`)
  }
  return new Uint8Array(await invoke<number[]>("read_skin_file", { path, progress }))
}

function waitForInterfacePaint(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
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
  fileOperationProgressVisible = false
  showStatus(`正在${action}…`, "progress")
  fileOperationDialog.dataset.outcome = "progress"
  fileOperationTitle.textContent = `正在${action}`
  fileOperationResult.hidden = true
  fileOperationResult.textContent = ""
  fileOperationClose.disabled = true
  updateFileOperationProgress(2, "正在准备…")
  const started = performance.now()
  clientLog.info("operation.start", { action })
  try {
    const completed = await operation()
    clientLog.info("operation.finish", {
      action,
      outcome: completed ? "completed" : "cancelled",
      durationMs: Math.round(performance.now() - started),
    })
    const result = completed ? `${action}完成。` : `${action}已取消。`
    showStatus(result)
    if (fileOperationProgressVisible) {
      fileOperationDialog.dataset.outcome = completed ? "success" : "cancelled"
      fileOperationTitle.textContent = completed ? `${action}完成` : `${action}已取消`
      updateFileOperationProgress(completed ? 100 : fileOperationProgress.value, completed ? "处理完成" : "未进行更改")
      fileOperationResult.textContent = result
      fileOperationResult.hidden = false
    }
  } catch (error) {
    clientLog.info("operation.finish", {
      action,
      outcome: "failed",
      durationMs: Math.round(performance.now() - started),
    })
    showError(error, action)
    if (fileOperationProgressVisible) {
      fileOperationDialog.dataset.outcome = "error"
      fileOperationTitle.textContent = `${action}失败`
      fileOperationResult.textContent = operationError(action, error)
      fileOperationResult.hidden = false
    }
  } finally {
    setFileOperationBusy(false)
    if (fileOperationProgressVisible) fileOperationClose.disabled = false
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

function bdaTileUsageKey(usage: BdaTileUsage | undefined): string {
  return usage ? `${usage.ref.key}:${usage.highlighted ? "highlight" : "normal"}` : ""
}

function selectedBdaTileUsage(): BdaTileUsage | undefined {
  return bdaTileUsages.find((usage) => usage.index === selectedTileIndex)
}

function bdaImageResourceID(path: string): string {
  return (path.split("/").pop() ?? path).replace(/\.png$/i, "")
}

function pngPixelSize(bytes: Uint8Array | undefined): readonly [number, number] | undefined {
  if (!bytes || bytes.length < 24 || bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) return
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return [view.getUint32(16), view.getUint32(20)]
}

function bdaImageUsageCounts(): Map<string, number> {
  const counts = new Map<string, number>()
  const appearance = currentBdaAppearance()?.appearance
  if (!appearance) return counts
  for (const style of appearance.imageStyles.values()) {
    for (const atom of [style.normalImage, style.highlightImage]) {
      const resourceID = atom?.resource?.resourceID.replace(/\.png$/i, "")
      if (resourceID) counts.set(resourceID, (counts.get(resourceID) ?? 0) + 1)
    }
  }
  return counts
}

function bdaImageTiles(path: string): { slices: TileSlice[]; usages: BdaTileUsage[] } {
  const info = currentBdaAppearance()
  const size = pngPixelSize(archive?.getBytes(path))
  if (!info || !size) return { slices: [], usages: [] }
  const resourceID = bdaImageResourceID(path)
  const matches = [...info.appearance.imageStyles].flatMap(([key, style]) => [
    { ref: { type: "image" as const, key }, highlighted: false, atom: style.normalImage },
    { ref: { type: "image" as const, key }, highlighted: true, atom: style.highlightImage },
  ]).filter(({ atom }) => atom?.resource?.resourceID.replace(/\.png$/i, "") === resourceID)
    .sort((left, right) => left.ref.key - right.ref.key || Number(left.highlighted) - Number(right.highlighted))
  const usages = matches.map(({ ref, highlighted }, index) => ({
    index: index + 1,
    ref,
    highlighted,
    label: `STYLE ${bdaStyleID(ref)} · ${highlighted ? "按下" : "正常"}`,
  }))
  const slices = matches.map(({ atom }, index) => ({
    index: index + 1,
    source: [0, 0, size[0], size[1]] as TileRect,
    ...(atom?.innerRect ? {
      inner: [atom.innerRect.x, atom.innerRect.y, atom.innerRect.width, atom.innerRect.height] as TileRect,
    } : {}),
  }))
  return { slices, usages }
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

  const allVisible = tileDraft
    ? [...slices, { index: nextTileIndex(tileDocument), source: tileDraft }]
    : movingTile
      ? slices.map((slice) => slice.index === movingTile?.index ? movingTile : slice)
      : slices
  const visible = archive?.format === "bda"
    ? allVisible.filter((slice) => slice.index === selectedTileIndex)
    : allVisible
  const lineWidth = Math.max(1, Math.round(Math.min(atlasCanvas.width, atlasCanvas.height) / 500))
  context.font = `${Math.max(11, lineWidth * 7)}px ui-monospace, monospace`
  context.textBaseline = "top"
  for (const slice of visible) {
    const [x, y, width, height] = slice.source
    const selected = slice.index === selectedTileIndex || slice.source === tileDraft
    context.lineWidth = selected ? lineWidth * 2 : lineWidth
    context.strokeStyle = selected ? "#ff3b30" : "#0a7ff5"
    context.strokeRect(x + context.lineWidth / 2, y + context.lineWidth / 2, width - context.lineWidth, height - context.lineWidth)
    const usage = bdaTileUsages.find((item) => item.index === slice.index)
    const label = usage?.label ?? `IMG${slice.index}`
    const labelWidth = context.measureText(label).width + 6
    context.fillStyle = selected ? "#ff3b30" : "#0a7ff5"
    context.fillRect(x, y, labelWidth, Math.max(15, lineWidth * 9))
    context.fillStyle = "#fff"
    context.fillText(label, x + 3, y + 2)
    if (archive?.format === "bda" && slice.inner) {
      const [innerX, innerY, innerWidth, innerHeight] = slice.inner
      if (innerWidth > 0 && innerHeight > 0) {
        context.save()
        context.lineWidth = Math.max(2, lineWidth * 2)
        context.strokeStyle = "#ff9500"
        context.setLineDash([lineWidth * 4, lineWidth * 3])
        context.strokeRect(innerX, innerY, innerWidth, innerHeight)
        context.restore()
      }
    }
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
  if (archive?.format === "bda" && slice.inner) {
    const [innerX, innerY, innerWidth, innerHeight] = slice.inner
    if (innerWidth > 0 && innerHeight > 0) {
      context.save()
      context.strokeStyle = "#ff9500"
      context.setLineDash([6, 4])
      context.strokeRect(
        destination.x + ((innerX - x) / width) * destination.width,
        destination.y + ((innerY - y) / height) * destination.height,
        (innerWidth / width) * destination.width,
        (innerHeight / height) * destination.height,
      )
      context.restore()
    }
  }
}

function populateTileInspector(): void {
  const slice = slices.find((item) => item.index === selectedTileIndex)
  const bdaSelected = archive?.format === "bda"
  const usage = selectedBdaTileUsage()
  tileInspector.hidden = !selectedResourcePath
  bdaTileUsage.hidden = !bdaSelected || !bdaTileUsages.length
  tileSourceFieldsGroup.hidden = bdaSelected
  tileInnerTitle.textContent = bdaSelected ? "切片区域（innerRect）" : "INNER_RECT（可选）"
  bdaTileUsage.replaceChildren(...bdaTileUsages.map((item) => {
    const option = new Option(item.label, String(item.index))
    option.selected = item.index === selectedTileIndex
    return option
  }))
  newTileButton.hidden = Boolean(bdaSelected)
  duplicateTileButton.hidden = Boolean(bdaSelected)
  deleteTileButton.hidden = Boolean(bdaSelected)
  moveTileButton.hidden = Boolean(bdaSelected)
  newTileButton.disabled = !selectedResourcePath || !isEditing() || bdaSelected
  duplicateTileButton.disabled = !slice || !isEditing() || bdaSelected
  deleteTileButton.disabled = !slice || !isEditing() || bdaSelected
  tileTitle.textContent = usage ? "图片样式切片" : (slice ? `IMG${slice.index}` : bdaSelected ? "未被当前 BDA 外观引用" : "切片")
  for (const field of tileSourceFields) {
    const index = Number(field.dataset.tileSource)
    field.value = slice ? String(slice.source[index]) : ""
    field.disabled = !slice || !isEditing() || bdaSelected
  }
  for (const field of tileInnerFields) {
    const index = Number(field.dataset.tileInner)
    field.value = slice?.inner ? String(slice.inner[index]) : ""
    field.min = bdaSelected ? "0" : index >= 2 ? "1" : ""
    field.disabled = !slice || !isEditing()
  }
  drawTilePreview()
}

function loadTiles(path: string): void {
  const previousUsage = bdaTileUsageKey(selectedBdaTileUsage())
  if (archive?.format === "bda") {
    const tiles = bdaImageTiles(path)
    tilePath = ""
    tileDocument = IniDocument.parse("")
    setSourceValue("")
    source.disabled = true
    slices = tiles.slices
    bdaTileUsages = tiles.usages
    selectedTileIndex = bdaTileUsages.find((usage) => bdaTileUsageKey(usage) === previousUsage)?.index
      ?? bdaTileUsages[0]?.index
    tileDraft = undefined
    movingTile = undefined
    moveStart = undefined
    moveSource = undefined
    populateTileInspector()
    drawAtlas()
    return
  }
  bdaTileUsages = []
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
  resourcePickerSelect = undefined
  pickerTarget = target
  if (isTauri()) openResourcePickerWindow()
  else openStyleImageResourcePicker()
}

function openBdaAnimationResourceChooser(onSelect: (resourceID: string) => void): void {
  pickerTarget = undefined
  resourcePickerSelect = onSelect
  if (isTauri()) openResourcePickerWindow()
  else openStyleImageResourcePicker()
}

function openBdaStyleImageResourceChooser(ref: BdaStyleRef, highlighted: boolean): void {
  pickerTarget = undefined
  resourcePickerSelect = (resourceID) => {
    const property = highlighted ? "HL_IMG" : "NM_IMG"
    if (updateBdaRefs([ref], property, resourceID)) void renderStyleResourceDetail()
  }
  if (isTauri()) openResourcePickerWindow()
  else openStyleImageResourcePicker()
}

function replaceBdaStyleImage(ref: BdaStyleRef, highlighted: boolean): void {
  if (ref.type !== "image" || !isEditing()) return
  openBdaStyleImageResourceChooser(ref, highlighted)
}

function editBdaStyleImageSlice(ref: BdaStyleRef, highlighted: boolean): void {
  const info = currentBdaAppearance()
  const style = ref.type === "image" ? info?.appearance.imageStyles.get(ref.key) : undefined
  const atom = highlighted ? style?.highlightImage : style?.normalImage
  const resourceID = atom?.resource?.resourceID.replace(/\.png$/i, "")
  if (!info || !resourceID) return
  const path = resourceImagePaths(archive?.names() ?? [], theme.value, orientation.value)
    .find((candidate) => candidate.split("/").pop()?.replace(/\.png$/i, "") === resourceID)
  if (!path) return
  const returnState = { path: selectedPath, styleID: selectedStyleID }
  selectFile(info.path, "overview", "image")
  bdaSliceReturn = returnState
  selectResourceImage(path)
  selectedTileIndex = bdaTileUsages.find((usage) =>
    usage.ref.type === ref.type && usage.ref.key === ref.key && usage.highlighted === highlighted)?.index
    ?? selectedTileIndex
  populateTileInspector()
  drawAtlas()
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
  const appearancePart = bdaAppearancePart(selectedPath)
  const appearanceInfo = currentBdaAppearance()
  if (archive?.format === "bda" && appearancePart?.kind === "styles" && appearanceInfo && selectedStyleID) {
    const type = appearancePart.group === "imageStyles" ? "image" : appearancePart.group === "textStyles" ? "text" : "color"
    const ref: BdaStyleRef = { type, key: Number(selectedStyleID) }
    resourceName.textContent = `STYLE ${selectedStyleID}`
    resourceMeta.textContent = appearancePart.group
    imageResourceDetail.hidden = true
    styleResourceDetail.hidden = false
    styleDetailPreviews.hidden = true
    renderBdaStyleEditor(styleDetailFields, {
      appearance: appearanceInfo.appearance,
      ref,
      resolver: visualResolver(),
      editable: isEditing(),
      onStyleChange: (styleRef, property, value) => { updateBdaRefs([styleRef], property, value) },
      onImageAction: (ref, highlighted, action) => {
        if (action === "slice") editBdaStyleImageSlice(ref, highlighted)
        else replaceBdaStyleImage(ref, highlighted)
      },
    })
    return
  }
  const path = styleConfigPath()
  if (!archive?.isText(path) || !selectedStyleID) return
  const stylesDocument = IniDocument.parse(archive.getText(path))
  const section = `STYLE${selectedStyleID}`
  resourceName.textContent = section
  resourceMeta.textContent = path
  imageResourceDetail.hidden = true
  styleResourceDetail.hidden = false
  styleDetailPreviews.hidden = false
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
  if (archive?.format === "bda") {
    const part = bdaAppearancePart(selectedPath)
    const appearance = currentBdaAppearance()?.appearance
    if (part?.kind !== "styles" || !appearance) return
    const styles = part.group === "imageStyles"
      ? appearance.imageStyles
      : part.group === "textStyles"
        ? appearance.textStyles
        : appearance.colorStyles
    if (!styles.has(Number(styleID))) return
  } else if (!availableStyleIDs().includes(styleID)) return
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
  if (archive?.format === "bda") {
    await renderBdaStyleResourceGallery()
    return
  }
  if (!archive?.isText(styleConfigPath())) return
  if (resourceCategory.dataset.styleCategories !== "bdi") {
    resourceCategory.replaceChildren(
      new Option("全部样式", "all"),
      new Option("声音样式", "sound"),
      new Option("视觉样式", "visual"),
    )
    resourceCategory.dataset.styleCategories = "bdi"
  }
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

async function renderBdaStyleResourceGallery(): Promise<void> {
  const info = currentBdaAppearance()
  const part = bdaAppearancePart(selectedPath)
  if (!info || part?.kind !== "styles") return
  const definitions = {
    imageStyles: { label: "图片样式", type: "image", styles: info.appearance.imageStyles },
    textStyles: { label: "文字样式", type: "text", styles: info.appearance.textStyles },
    colorStyles: { label: "颜色样式", type: "color", styles: info.appearance.colorStyles },
  } as const
  const definition = definitions[part.group]
  if (resourceCategory.dataset.styleCategories !== "bda") {
    resourceCategory.replaceChildren(...bdaAppearanceStyleGroups.map(([value, label]) => new Option(label, value)))
    resourceCategory.dataset.styleCategories = "bda"
  }
  resourceCategory.value = part.group
  const query = resourceSearch.value.trim().toLowerCase()
  const keys = [...definition.styles.keys()].filter((key) => !query || String(key).includes(query))
  resourceListTitle.textContent = "样式配置"
  resourceSearch.placeholder = "搜索样式"
  resourceSearch.setAttribute("aria-label", "搜索样式")
  resourceSearchControl.setAttribute("aria-label", "搜索样式")
  resourceCategory.hidden = false
  resourceCount.textContent = `${keys.length} 个样式`
  resourceUploadButton.hidden = true
  styleAddButton.hidden = true
  resourceDownloadButton.hidden = true
  resourceDeleteButton.hidden = true
  resourceListView.hidden = Boolean(selectedStyleID)
  resourceDetail.hidden = !selectedStyleID
  const resolver = visualResolver()
  for (const key of keys) {
    const ref: BdaStyleRef = { type: definition.type, key }
    const button = document.createElement("button")
    button.className = "resource-item style-resource-item"
    button.dataset.path = `STYLE${key}`
    button.title = `STYLE ${key}`
    const previews = document.createElement("span")
    previews.className = "resource-style-previews"
    for (const highlighted of [false, true]) {
      const canvas = retinaThumbnail(document.createElement("canvas"), 128, 88)
      previews.append(canvas)
      void resolver?.resolve(bdaStyleID(ref), highlighted)
        .then((visual) => { if (canvas.isConnected) drawVisualPreview(canvas, [visual], false) })
        .catch(() => {})
    }
    const name = document.createElement("strong")
    name.textContent = `STYLE ${key}`
    const meta = document.createElement("small")
    meta.textContent = definition.label
    button.append(previews, name, meta)
    button.addEventListener("click", () => selectGalleryItem(`STYLE${key}`, resourceGallery))
    button.addEventListener("dblclick", () => selectStyleResource(String(key)))
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
  const bdaUsageCounts = archive.format === "bda" ? bdaImageUsageCounts() : new Map<string, number>()
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
    const hasTil = archive.isText(path.replace(/\.png$/i, ".til"))
    const bdaUsageCount = bdaUsageCounts.get(bdaImageResourceID(path)) ?? 0
    meta.textContent = archive.format === "bda"
      ? bdaUsageCount ? `${bdaUsageCount} 个样式引用` : "未被外观引用"
      : hasTil ? "TIL" : "无 TIL"
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

function loadVisibleSourceEditor(): void {
  if (sourceEditor.hidden) return
  requestAnimationFrame(() => {
    source.requestMeasure()
    scrollSelectedSource()
    updateSourceHighlight()
  })
}

workspaceImage.addEventListener("load", clearImagePreviewError)
workspaceImage.addEventListener("error", showImagePreviewError)

function updateInspectorView(): void {
  const imageSelected = Boolean(archive?.isImage(selectedPath))
  const overviewSelected = Boolean(
    files.querySelector(`.sidebar-overview button[data-path="${CSS.escape(selectedPath)}"]`),
  )
  const propertiesAvailable = Boolean(
    selectedPath && (
      archive?.isText(selectedPath) || archive?.isBdaConfig(selectedPath) || isBdaLayoutPath(selectedPath) ||
      bdaAppearancePart(selectedPath)
    ) && overviewSelected && !imageSelected,
  )
  for (const button of inspectorTabButtons) {
    const tab = button.dataset.inspectorTab
    const available = resourceConfigActive
      ? tab === "properties" || tab === "source" && Boolean(selectedPath) && !(
        archive?.format === "bda" && resourceInspectorMode === "image"
      )
      :
      tab === "properties"
        ? imageSelected || propertiesAvailable
        : !imageSelected && Boolean(selectedPath)
    button.disabled = !available
    button.classList.toggle("active", tab === inspectorTab && available)
  }
  if (resourceConfigActive) {
    sourceName.textContent = inspectorTab === "source" && selectedResourcePath
      ? archive?.format === "bda" ? "BDA 切片由 appearanceConfig 管理" : tilePath
      : selectedResourcePath || selectedPath
    quickInspector.hidden = true
    asset.hidden = true
    resourceInspector.hidden = inspectorTab !== "properties"
    sourceEditor.hidden = inspectorTab !== "source"
    updateSourceFindVisibility()
    loadVisibleSourceEditor()
    return
  }
  resourceInspector.hidden = true
  if (imageSelected) {
    quickInspector.hidden = true
    sourceEditor.hidden = true
    asset.hidden = false
    updateSourceFindVisibility()
    return
  }
  asset.hidden = true
  quickInspector.hidden = inspectorTab !== "properties" || !propertiesAvailable
  sourceEditor.hidden = inspectorTab !== "source"
  updateSourceFindVisibility()
  loadVisibleSourceEditor()
}

function updateSourceFindVisibility(): void {
  const mobileSourceVisible = mobilePortraitQuery.matches && !sourceEditor.hidden
  sourceFindToggle.hidden = !mobileSourceVisible
  sourceFindToggle.setAttribute("aria-pressed", String(mobileSourceVisible && sourceFindVisible))
  sourceFindToggle.title = sourceFindToggle.ariaLabel = sourceFindVisible ? "隐藏查找" : "显示查找"
  sourceToolbar.hidden = mobileSourceVisible && !sourceFindVisible
}

const SOURCE_SEARCH_HIGHLIGHT_LIMIT = 20_000
// ponytail: cap value decorations to keep large files responsive; raise after viewport-only ranges exist.
const SOURCE_VALUE_HINT_LIMIT = 5_000

function scheduleSourceInputHighlight(refreshInspector = false): void {
  sourceInputRefreshPending ||= refreshInspector
  if (sourceInputHighlightTimer !== undefined) window.clearTimeout(sourceInputHighlightTimer)
  sourceInputHighlightTimer = window.setTimeout(() => {
    sourceInputHighlightTimer = undefined
    updateSourceHighlight()
  }, 100)
}

function scheduleSourceSearch(): void {
  if (sourceSearchTimer !== undefined) window.clearTimeout(sourceSearchTimer)
  sourceSearchTimer = window.setTimeout(() => {
    sourceSearchTimer = undefined
    updateSourceHighlight()
  }, 80)
}

function sourceValueRanges(text: string, language: "ini" | "json"): SourceEditorValueRange[] {
  const ranges: SourceEditorValueRange[] = []
  const sourceColor = (value: string): string => {
    const clean = value.replace(/^#/, "")
    if (clean.length === 6) return `#${clean}`
    const alpha = Number.parseInt(clean.slice(0, 2), 16) / 255
    const red = Number.parseInt(clean.slice(2, 4), 16)
    const green = Number.parseInt(clean.slice(4, 6), 16)
    const blue = Number.parseInt(clean.slice(6, 8), 16)
    return `rgba(${red}, ${green}, ${blue}, ${Number(alpha.toFixed(3))})`
  }
  const add = (value: string, from: number, to: number): void => {
    if (ranges.length >= SOURCE_VALUE_HINT_LIMIT) return
    const normalized = value.trim()
    if (!normalized) return
    const action = normalized.match(/^(F\d+|S\d+(?:_\d+)?)$/i)
    const color = normalized.match(/^#?(?:[0-9a-f]{6}|[0-9a-f]{8})$/i)
    const style = /^(?:STYLE\d+|[123]\d{6})$/i.test(normalized)
    if (!action && !color && !style) return
    const kind = action ? "action" : color ? "color" : "style"
    ranges.push({
      from, to, value: normalized, kind,
      label: action ? actionDescription(action[1].toUpperCase()) : kind === "color" ? `颜色 ${normalized}` : `样式 ${normalized}`,
      color: color ? sourceColor(normalized) : undefined,
    })
  }
  if (language === "ini") {
    for (const match of text.matchAll(/^[ \t]*[^=\r\n]+\s*=\s*([^;#\r\n]*)/gm)) {
      if (ranges.length >= SOURCE_VALUE_HINT_LIMIT) break
      const raw = match[1]
      const value = raw.trim()
      const offset = match.index! + match[0].lastIndexOf(raw) + (raw.length - raw.trimStart().length)
      add(value, offset, offset + value.length)
    }
  } else {
    for (const match of text.matchAll(/"(?:action|value|code|style|color|normalColor|highlightColor)"\s*:\s*(?:"([^"\\]*(?:\\.[^"\\]*)*)"|(-?\d+(?:\.\d+)?))/gi)) {
      if (ranges.length >= SOURCE_VALUE_HINT_LIMIT) break
      const value = match[1] ?? match[2] ?? ""
      const full = match[0]
      const start = match.index! + full.lastIndexOf(value)
      add(value, start, start + value.length)
    }
  }
  return ranges
}

function updateSourceHighlight(): void {
  if (sourceSearchTimer !== undefined) window.clearTimeout(sourceSearchTimer)
  sourceSearchTimer = undefined
  if (sourceInputHighlightTimer !== undefined) window.clearTimeout(sourceInputHighlightTimer)
  sourceInputHighlightTimer = undefined
  if (sourceInputRefreshPending) {
    sourceInputRefreshPending = false
    refreshPreview()
    populateKeyInspector()
  }
  const sections = selectedSourceSections()
  const query = sourceSearch.value.trim()
  const bdaSource = Boolean(archive?.format === "bda" && (
    archive.isBdaConfig(selectedPath) || isBdaVirtualTextPath(selectedPath) || isBdaAppearancePartPath(selectedPath)
  ))
  source.setLanguage(bdaSource ? "json" : "ini")
  const matches = sourceSearchMatches()
  updateSourceSearchStatus(matches)
  const selectedRanges = bdaSource
    ? jsonPropertyRanges(source.value, selectedBdaSourceKeys())
    : sections.length ? iniSectionRanges(source.value, sections) : sourceHistoryHighlight ? [sourceHistoryHighlight] : []
  const searchRanges = matches.slice(0, SOURCE_SEARCH_HIGHLIGHT_LIMIT)
    .map((start) => [start, start + query.length] as const)
  const activeStart = matches[sourceSearchIndex]
  source.setDecorations({
    selectedRanges,
    searchRanges,
    activeSearchRange: activeStart === undefined ? undefined : [activeStart, activeStart + query.length],
    valueRanges: sourceValueHintsEnabled.checked ? sourceValueRanges(source.value, bdaSource ? "json" : "ini") : [],
  })
  source.setFeatures({
    completion: sourceCompletionEnabled.checked,
    valueHints: sourceValueHintsEnabled.checked,
    explanations: sourceLineExplanationEnabled.checked,
  })
}

function sourceSearchMatches(): number[] {
  return findTextMatches(source.value, sourceSearch.value.trim())
}

function updateSourceSearchStatus(matches = sourceSearchMatches()): void {
  if (sourceSearchIndex >= matches.length) sourceSearchIndex = -1
  sourceSearchCount.textContent = sourceSearch.value.trim()
    ? `${sourceSearchIndex < 0 ? 0 : sourceSearchIndex + 1}/${matches.length}`
    : ""
  sourceSearchPrevious.disabled = sourceSearchNext.disabled = !matches.length
  const replaceable = Boolean(matches.length) && !source.disabled && !source.readOnly
  sourceReplacement.disabled = sourceReplace.disabled = sourceReplaceAll.disabled = !replaceable
}

function findSourceMatch(direction: 1 | -1): void {
  const matches = sourceSearchMatches()
  if (!matches.length) {
    sourceSearchIndex = -1
    updateSourceHighlight()
    return
  }
  sourceSearchIndex = sourceSearchIndex < 0
    ? direction > 0 ? 0 : matches.length - 1
    : (sourceSearchIndex + direction + matches.length) % matches.length
  const start = matches[sourceSearchIndex]
  source.setSelectionRange(start, start + sourceSearch.value.trim().length)
  updateSourceHighlight()
}

function replaceSourceMatches(replaceAll: boolean): void {
  const query = sourceSearch.value.trim()
  const matches = sourceSearchMatches()
  if (!query || !matches.length || source.disabled || source.readOnly) return
  const index = sourceSearchIndex < 0 ? 0 : sourceSearchIndex
  source.value = replaceTextMatches(source.value, query, sourceReplacement.value, replaceAll ? undefined : index)
  sourceSearchIndex = replaceAll ? -1 : index
  source.dispatchEvent(new Event("input", { bubbles: true }))
  if (archive?.isBdaConfig(selectedPath) || isBdaAppearancePartPath(selectedPath)) commitBdaSourceEdit()
  if (!replaceAll) findSourceMatch(1)
}

function selectedSourceSections(): string[] {
  if (resourceConfigActive && selectedResourcePath) {
    return selectedTileIndex === undefined ? [] : [`IMG${selectedTileIndex}`]
  }
  return selectedPath === layoutPath ? effectiveSelectedSections() : []
}

function currentSkinState(): number | undefined {
  return skinState.value ? Number(skinState.value) : undefined
}

function effectiveKeySection(section: string): string {
  if (!layoutDocument || isListCell(section)) return section
  return effectivePanelSection(layoutDocument, section, currentSkinState())
}

function effectiveSelectedSections(): string[] {
  return selectedKeySections.map(effectiveKeySection)
}

function effectiveKeyValue(section: string, key: string): string | undefined {
  if (!layoutDocument) return
  const effective = effectiveKeySection(section)
  return layoutDocument.get(effective, key) ?? layoutDocument.get(section, key)
}

function scrollSelectedSource(): void {
  const sections = selectedSourceSections()
  if (sourceEditor.hidden || !sections.length && !sourceHistoryHighlight) return
  const bdaRange = jsonPropertyRanges(source.value, selectedBdaSourceKeys())[0]
  const iniRange = iniSectionRanges(source.value, sections)[0]
  const range = bdaRange ?? iniRange ?? sourceHistoryHighlight
  if (range) source.revealRange(range[0], range[1])
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

function legacyAnimationConfigPath(): string | undefined {
  return [
    `${theme.value}/skin/${orientation.value}/anim.ini`,
    `${theme.value}/skin/${orientation.value}/res/anim.ini`,
    `${theme.value}/skin/res/anim.ini`,
  ].find((path) => archive?.isText(path))
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
  const bdaPanel = archive.format === "bda"
    ? currentBdaAppearance()?.appearance.panels.get(layoutPath.split("/").pop()?.replace(/\.ini$/i, "") ?? "")
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
  const backgroundStyle = archive?.format === "bda"
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
  toolbarPreview.setMode("preview")
  return { width, height, inputHeight }
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
    drawVisualText(context, visual, destination)
  })
}

function renderSourceValueThumbnail(canvas: HTMLCanvasElement, range: SourceEditorValueRange): void {
  retinaThumbnail(canvas, 48, 30)
  const context = canvas.getContext("2d")
  if (!context) return
  context.clearRect(0, 0, canvas.width, canvas.height)
  if (range.kind === "color") {
    context.fillStyle = range.color ?? "transparent"
    context.fillRect(0, 0, canvas.width, canvas.height)
    return
  }
  const resolver = visualResolver()
  if (!resolver) return
  const styleID = range.value.replace(/^STYLE/i, "")
  void resolver.resolve(styleID, false).then((visual) => {
    if (canvas.isConnected) drawVisualPreview(canvas, [visual], false)
  }).catch(() => {})
}

let sourceValuePreviewRenderID = 0

function openSourceValuePreview(range: SourceEditorValueRange): void {
  clearImageSlicePicker()
  styleImageDialog.hidden = false
  styleImagePreview.hidden = false
  styleImagePicker.hidden = true
  styleImageResourceOpen.hidden = true
  styleImageTitle.textContent = range.kind === "style"
    ? `样式 ${range.value.replace(/^STYLE/i, "")}`
    : `颜色 ${range.value}`
  styleImageSubtitle.textContent = range.kind === "style" ? "正常 / 按下" : "颜色预览"
  const renderID = ++sourceValuePreviewRenderID
  const canvas = retinaThumbnail(styleImagePreview, 960, 260)
  const context = canvas.getContext("2d")
  if (!context) return
  context.clearRect(0, 0, canvas.width, canvas.height)
  if (range.kind === "color") {
    context.fillStyle = range.color ?? "transparent"
    context.fillRect(0, 0, canvas.width, canvas.height)
    return
  }
  const resolver = visualResolver()
  if (!resolver) return
  const styleID = range.value.replace(/^STYLE/i, "")
  void Promise.all([false, true].map((highlighted) => resolver.resolve(styleID, highlighted).catch(() => undefined)))
    .then((visuals) => {
      if (renderID !== sourceValuePreviewRenderID) return
      visuals.forEach((visual, index) => {
        const preview = retinaThumbnail(document.createElement("canvas"), 480, 260)
        drawVisualPreview(preview, [visual], false)
        context.drawImage(preview, index * canvas.width / 2, 0, canvas.width / 2, canvas.height)
      })
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
  if (!styleID || !availableStyleIDs().includes(styleID) || !archive) return
  const returnPath = selectedPath
  const returnSelection = [...selectedKeySections]
  const returnCandidate = selectedCandidate
  const returnScrollTop = quickInspector.scrollTop
  const returnInspectorGroup = quickInspector.dataset.mobileInspectorGroup ?? ""
  if (archive.format === "bda") {
    const ref = bdaStyleRef(styleID)
    if (!ref) return
    const group = `${ref.type}Styles` as BdaAppearanceStyleGroup
    const path = bdaAppearanceStylePath(group)
    selectFile(path, "overview", "style")
    styleReturnPath = returnPath === path ? "" : returnPath
    styleReturnSelection = returnSelection
    styleReturnCandidate = returnCandidate
    styleReturnScrollTop = returnScrollTop
    styleReturnInspectorGroup = returnInspectorGroup
    selectStyleResource(String(ref.key))
    return
  }
  const path = styleConfigPath()
  if (!archive.isText(path)) return
  selectFile(path, "overview", "style")
  styleReturnPath = returnPath === path ? "" : returnPath
  styleReturnSelection = returnSelection
  styleReturnScrollTop = returnScrollTop
  styleReturnInspectorGroup = returnInspectorGroup
  selectStyleResource(styleID)
}

function openBdaStyleReferencePicker(paths: string[][], ref: BdaStyleRef, field: string, owner: HTMLElement): void {
  const input = document.createElement("input")
  input.value = bdaStyleID(ref)
  input.dataset.documentStyleKey = field
  input.dataset.bdaStyleType = ref.type
  input.addEventListener("change", () => {
    const next = bdaStyleRef(input.value)
    if (next) updateBdaAppearanceStyleRef(paths, next, owner)
  })
  openStylePicker(input)
}

function stylePickerLabel(styleID: string): string {
  return archive?.format === "bda" ? String(bdaStyleRef(styleID)?.key ?? styleID) : styleID
}

function availableStyleIDs(): string[] {
  if (!archive) return []
  if (archive.format === "bda") {
    const appearance = currentBdaAppearance()?.appearance
    if (!appearance) return []
    return [
      ...[...appearance.imageStyles.keys()].map((key) => bdaStyleID({ type: "image", key })),
      ...[...appearance.colorStyles.keys()].map((key) => bdaStyleID({ type: "color", key })),
      ...[...appearance.textStyles.keys()].map((key) => bdaStyleID({ type: "text", key })),
    ]
  }
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
  const bdaTargetType = archive?.format === "bda" ? stylePickerTarget?.dataset.bdaStyleType : undefined
  const stylesPath = styleConfigPath()
  const styles = archive?.isText(stylesPath) ? IniDocument.parse(archive.getText(stylesPath)) : undefined
  const styleIDs = availableStyleIDs().filter((styleID) => {
    if (bdaTargetType && bdaStyleRef(styleID)?.type !== bdaTargetType) return false
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
    const displayID = stylePickerLabel(styleID)
    const button = document.createElement("button")
    button.type = "button"
    button.className = "style-picker-item"
    button.classList.toggle("selected", stylePickerTarget?.value.split(",")[0]?.trim() === styleID)
    button.title = `点击使用样式 ${displayID}；Command/Ctrl 点击编辑`
    const label = document.createElement("strong")
    label.textContent = displayID
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
        : effectiveKeyValue(section, "FORE_STYLE") ?? "",
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

function bdaStyleHasProperty(appearance: BdaAppearance, ref: BdaStyleRef, property: string): boolean {
  if (ref.type !== "text") return false
  const style = appearance.textStyles.get(ref.key)
  if (!style) return false
  if (property === "FONT_NAME") return style.fontName !== undefined
  if (property === "FONT_SIZE") return style.fontSize !== undefined
  if (property === "NM_COLOR") return style.normalColor !== undefined
  if (property === "HL_COLOR") return style.highlightColor !== undefined
  return false
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
  if (property === "FONT_NAME") return style.fontName ?? ""
  if (property === "FONT_SIZE") return style.fontSize === undefined ? "" : String(style.fontSize)
  if (property === "NM_COLOR") return style.normalColor === undefined ? "" : bdaColorHex(style.normalColor)
  if (property === "HL_COLOR") return style.highlightColor === undefined ? "" : bdaColorHex(style.highlightColor)
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
  refreshSelectedBdaSource()
  refreshPreview()
  populateKeyInspector()
  updateDirty()
  return true
}

// 将样式引用写回 appearanceConfig 的面板片段，path 指向解码 JSON 中的字段位置。
function updateBdaAppearanceStyleRef(paths: string[][], ref: BdaStyleRef, owner?: HTMLElement): boolean {
  const info = currentBdaAppearance()
  const part = bdaAppearancePart(selectedPath)
  if (!info || part?.kind !== "panel" || !paths.length) return false
  const source = JSON.parse(decodedBdaAppearancePart(info.bytes, part)) as Record<string, unknown>
  const value = { type: ref.type, key: ref.key }
  for (const path of paths) {
    let target: unknown = source
    for (const step of path.slice(0, -1)) {
      if (target === null || typeof target !== "object") return false
      target = Array.isArray(target)
        ? target[Number(step)]
        : (target as Record<string, unknown>)[step]
    }
    if (target === null || typeof target !== "object") return false
    const last = path[path.length - 1]
    if (Array.isArray(target)) target[Number(last)] = value
    else (target as Record<string, unknown>)[last] = value
  }
  const after = applyDecodedBdaAppearancePart(info.path, info.bytes, JSON.stringify(source), part)
  commitBytes(info.path, info.bytes, after)
  refreshBdaLayout(layoutPath)
  refreshSelectedBdaSource()
  refreshPreview()
  if (owner) void refreshBdaStyleReferenceField(owner, ref, visualResolver())
  updateDirty()
  return true
}

function updateSelectedBdaPanelProperty(
  property: "shouldBgBlur" | "shouldKeySlotting" | "trackColor",
  value: boolean | string,
): boolean {
  const info = currentBdaAppearance()
  const part = bdaAppearancePart(selectedPath)
  if (!info || part?.kind !== "panel") return false
  const source = JSON.parse(decodedBdaAppearancePart(info.bytes, part)) as Record<string, unknown>
  source[property] = value
  const after = applyDecodedBdaAppearancePart(info.path, info.bytes, JSON.stringify(source), part)
  commitBytes(info.path, info.bytes, after)
  refreshBdaLayout(layoutPath)
  refreshSelectedBdaSource()
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
  ANIM_STYLE: "动画样式",
  PRESS_ANIM: "按下动画",
  SHOW_ANIM: "显示动画",
  EVENT1: "动画事件",
  ANIM_NUM: "动画数量",
  CATEGORY: "动画类别",
  LIFE: "粒子寿命范围",
  EMIT_REGION: "发射区域",
  TOTAL_NUMBER: "粒子总数",
  BIRTH_RATE: "发射速率",
  EMIT_TYPE: "发射方式",
  PARTICLE_IMAGE: "粒子图片样式",
  VELOCITY: "初速度范围",
  VELOCITY_DIRECTION: "初速度方向范围",
  ACCELERATION: "加速度范围",
  ACCELERATION_DIRECTION: "加速度方向范围",
  INIT_SCALE: "初始缩放范围",
  SCALE_SPEED: "缩放速度范围",
  INIT_ROTATE: "初始旋转范围",
  ROTATE_SPEED: "旋转速度范围",
  INIT_ALPHA: "初始透明度范围",
  ALPHA_SPEED: "透明度速度范围",
  DURATION: "持续时间",
  DELAY: "延迟时间",
  REMOVE: "结束后移除",
  INTPOL: "插值方式",
  FROM: "起始值",
  TO: "结束值",
  FROM_PX: "起始位移",
  TO_PX: "结束位移",
  PIVOT: "变换中心",
  BUILD_NUM: "组合动画数量",
  BUILD_LIST: "组合动画列表",
  BUILD_METHOD: "组合播放方式",
  REPEAT_CNT: "重复次数",
  REPEAT_MODE: "重复方式",
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
  GLOBAL: "全局设置",
}

function translatedConfigLabel(key: string): string {
  return `${documentFieldLabels[key] ?? "扩展配置"}（${key}）`
}

function translatedSectionLabel(section: string): string {
  const offset = section.match(/^OFFSET(\d+)$/)
  const animation = section.match(/^ANIM(\d+)$/)
  const label = offset
    ? `偏移 ${offset[1]}`
    : animation
      ? `动画 ${animation[1]}`
      : documentSectionLabels[section] ?? "扩展区域"
  return `${label}（${section}）`
}

function isHiddenConfigEntry(section: string, key: string): boolean {
  return /^(?:OFFSET|TIP)\d*$/i.test(section) || /^(?:OFFSET|TIP)(?:_|\d|$)/i.test(key)
}

const particleFieldGroups = [
  ["发射", ["PARTICLE_IMAGE", "LIFE", "EMIT_REGION", "TOTAL_NUMBER", "BIRTH_RATE", "EMIT_TYPE"]],
  ["运动", ["VELOCITY", "VELOCITY_DIRECTION", "ACCELERATION", "ACCELERATION_DIRECTION"]],
  ["外观", ["INIT_SCALE", "SCALE_SPEED", "INIT_ROTATE", "ROTATE_SPEED", "INIT_ALPHA", "ALPHA_SPEED"]],
] as const
const particlePairFields = new Set<string>(particleFieldGroups.flatMap(([, keys]) => keys).filter((key) =>
  !["PARTICLE_IMAGE", "EMIT_REGION", "TOTAL_NUMBER", "BIRTH_RATE", "EMIT_TYPE"].includes(key),
))
let particlePreviewSection = ""

function isParticleSection(document: IniDocument, section: string): boolean {
  return document.get(section, "CATEGORY")?.trim() === "3" || Boolean(document.get(section, "PARTICLE_IMAGE")?.trim())
}

async function renderParticleImages(container: HTMLElement, value: string): Promise<void> {
  const resolver = visualResolver()
  const styleIDs = value.split(",").map((item) => item.trim()).filter(Boolean)
  container.replaceChildren()
  if (!resolver) return
  const visuals = await Promise.all(styleIDs.map((styleID) => resolver.resolve(styleID, false).catch(() => undefined)))
  if (!container.isConnected) return
  container.replaceChildren(...styleIDs.map((styleID, index) => {
    const item = document.createElement("span")
    item.className = "particle-image-preview"
    const canvas = retinaThumbnail(document.createElement("canvas"), 56, 56)
    drawVisualPreview(canvas, [visuals[index]], false)
    const caption = document.createElement("small")
    caption.textContent = styleID
    item.append(canvas, caption)
    return item
  }))
}

function particleNumberStep(key: string): string {
  return /SCALE|VELOCITY|ACCELERATION/.test(key) ? "0.1" : "1"
}

function populateDocumentInspector(): void {
  documentFields.replaceChildren()
  const hasSelection = selectedPath === layoutPath && selectedKeySections.length > 0
  if (archive?.format === "bda" || !selectedDocument || hasSelection || !archive?.isText(selectedPath)) {
    documentFieldsGroup.hidden = true
    particlePreviewSection = ""
    preview.setParticlePreview()
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
  if (!entries.length) {
    particlePreviewSection = ""
    preview.setParticlePreview()
    return
  }

  const sections = [...new Set(entries.map((entry) => entry.section))]
  const particleSections = sections.filter((section) => isParticleSection(selectedDocument!, section))
  if (!particleSections.includes(particlePreviewSection)) particlePreviewSection = particleSections[0] ?? ""
  preview.setParticlePreview(
    particlePreviewSection ? parseLegacyParticleEmitter(selectedDocument, particlePreviewSection) : undefined,
  )
  const update = (section: string, key: string, value: string): boolean => {
    if (!selectedDocument || selectedPath !== documentFieldsGroup.dataset.path) return false
    const before = selectedDocument.toString()
    if (!selectedDocument.set(section, key, value)) return false
    const text = selectedDocument.toString()
    commitText(selectedPath, before, text)
    setSourceValue(text)
    if (selectedPath === layoutPath) layoutDocument = selectedDocument
    refreshPreview()
    if (section === particlePreviewSection) {
      preview.setParticlePreview(parseLegacyParticleEmitter(selectedDocument, section))
    }
    updateDirty()
    return true
  }
  const renderEntry = (entry: typeof entries[number], specialized = false): HTMLElement => {
    const label = document.createElement("label")
    label.className = "document-property-field"
    if (isStyleReferenceKey(entry.key)) label.classList.add("style-reference-field")
    if (specialized) label.classList.add("particle-property-field")
    if (entry.value.length > 18 || /(?:RECT|IMG|PADDING|ORDER|LIST|SOURCE|FONT_NAME)/.test(entry.key)) {
      label.classList.add("wide")
    }
    const caption = document.createElement("span")
    caption.textContent = translatedConfigLabel(entry.key)
    caption.title = entry.key
    label.append(caption)

    if (specialized && (particlePairFields.has(entry.key) || entry.key === "EMIT_REGION")) {
      const count = entry.key === "EMIT_REGION" ? 4 : 2
      const values = entry.value.split(",").map((value) => value.trim())
      while (values.length < count) values.push(values.at(-1) ?? "0")
      const row = document.createElement("span")
      row.className = `particle-range-inputs particle-range-${count}`
      const names = count === 4 ? ["X", "Y", "宽", "高"] : ["最小", "最大"]
      for (let index = 0; index < count; index += 1) {
        const input = document.createElement("input")
        input.type = "number"
        input.step = particleNumberStep(entry.key)
        input.value = values[index]
        input.placeholder = names[index]
        input.setAttribute("aria-label", `${translatedConfigLabel(entry.key)}${names[index]}`)
        input.disabled = !isEditing()
        input.addEventListener("change", () => {
          values[index] = input.value
          update(entry.section, entry.key, values.join(","))
        })
        row.append(input)
      }
      label.append(row)
      return label
    }

    const input = document.createElement("input")
    input.value = entry.value
    input.classList.add("document-property-input")
    input.title = `${translatedConfigLabel(entry.key)}：${entry.value}`
    input.disabled = !isEditing()
    if (specialized && ["TOTAL_NUMBER", "BIRTH_RATE"].includes(entry.key)) {
      const value = Math.max(Number(entry.value) || 1, entry.key === "BIRTH_RATE" ? 0.1 : 1)
      input.type = "number"
      input.min = entry.key === "BIRTH_RATE" ? "0.1" : "1"
      input.step = entry.key === "BIRTH_RATE" ? "0.1" : "1"
      const row = document.createElement("span")
      row.className = "particle-slider-input"
      const slider = document.createElement("input")
      slider.type = "range"
      slider.min = input.min
      slider.max = String(Math.max(entry.key === "BIRTH_RATE" ? 20 : 1000, value * 2))
      slider.step = input.step
      slider.value = String(value)
      slider.disabled = input.disabled
      slider.addEventListener("input", () => { input.value = slider.value })
      slider.addEventListener("change", () => update(entry.section, entry.key, slider.value))
      input.addEventListener("input", () => {
        if (Number(input.value) > Number(slider.max)) slider.max = String(Number(input.value) * 2)
        slider.value = input.value
      })
      input.addEventListener("change", () => update(entry.section, entry.key, input.value))
      row.append(slider, input)
      label.classList.add("wide")
      label.append(row)
      return label
    }
    input.addEventListener("change", () => update(entry.section, entry.key, input.value))
    label.append(input)
    if (specialized && entry.key === "PARTICLE_IMAGE") {
      const previews = document.createElement("span")
      previews.className = "particle-image-previews"
      void renderParticleImages(previews, input.value)
      input.addEventListener("input", () => void renderParticleImages(previews, input.value))
      label.append(previews)
    } else {
      decorateStyleReferenceInput(input, entry.key)
    }
    return label
  }
  for (const section of sections) {
    const sectionPanel = document.createElement("section")
    sectionPanel.className = "document-property-section"
    const sectionEntries = entries.filter((item) => item.section === section)
    const particle = isParticleSection(selectedDocument, section)
    if (particle) sectionPanel.classList.add("particle-property-section")
    const heading = document.createElement("h3")
    heading.textContent = particle ? `粒子动效 ${section.replace(/^ANIM/, "")}（${section}）` : section ? translatedSectionLabel(section) : "基本信息"
    sectionPanel.append(heading)
    if (particle) {
      const toolbar = document.createElement("div")
      toolbar.className = "particle-preview-toolbar"
      const status = document.createElement("span")
      status.textContent = section === particlePreviewSection ? "正在画布预览" : "可在键盘画布中预览"
      const replay = document.createElement("button")
      replay.type = "button"
      replay.textContent = section === particlePreviewSection ? "重新播放" : "在画布预览"
      replay.addEventListener("click", () => {
        if (!selectedDocument) return
        particlePreviewSection = section
        preview.setParticlePreview(parseLegacyParticleEmitter(selectedDocument, section))
        populateDocumentInspector()
        syncMobileInspectorGroups()
      })
      toolbar.append(status, replay)
      sectionPanel.append(toolbar)
      const used = new Set<string>()
      for (const [name, keys] of particleFieldGroups) {
        const grouped = keys.flatMap((key) => sectionEntries.filter((entry) => entry.key === key))
        if (!grouped.length) continue
        grouped.forEach((entry) => used.add(entry.key))
        const fieldset = document.createElement("fieldset")
        fieldset.className = "particle-property-group"
        const legend = document.createElement("legend")
        legend.textContent = name
        const grid = document.createElement("div")
        grid.className = "document-property-grid"
        grid.append(...grouped.map((entry) => renderEntry(entry, true)))
        fieldset.append(legend, grid)
        sectionPanel.append(fieldset)
      }
      const advanced = sectionEntries.filter((entry) => !used.has(entry.key))
      if (advanced.length) {
        const details = document.createElement("details")
        details.className = "particle-advanced-properties"
        const summary = document.createElement("summary")
        summary.textContent = `高级参数（${advanced.length}）`
        const grid = document.createElement("div")
        grid.className = "document-property-grid"
        grid.append(...advanced.map((entry) => renderEntry(entry)))
        details.append(summary, grid)
        sectionPanel.append(details)
      }
      documentFields.append(sectionPanel)
      continue
    }
    const grid = document.createElement("div")
    grid.className = "document-property-grid"
    grid.append(...sectionEntries.map((entry) => renderEntry(entry)))
    sectionPanel.append(grid)
    documentFields.append(sectionPanel)
  }
  documentFieldsGroup.dataset.path = selectedPath
}

function selectedBdaKeyNames(): string[] {
  if (!layoutDocument || !selectedKeySections.length) return []
  return [...new Set(selectedKeySections.flatMap((section) => {
    const effective = effectiveKeySection(section)
    return [layoutDocument?.get(effective, "CENTER"), layoutDocument?.get(section, "CENTER"), layoutDocument?.get(section, "DOWN")]
      .filter((value): value is string => Boolean(value))
      .map(bdaPanelKeyName)
  }))]
}

function selectedBdaSourceKeys(): string[] {
  if (selectedCandidate && selectedPath === layoutPath) return ["cand"]
  return isBdaLayoutPath(selectedPath) ? selectedBdaKeyNames() : []
}

function populateBdaConfigInspector(): void {
  bdaConfigFields.replaceChildren()
  if (!archive || archive.format !== "bda") {
    bdaConfigFieldsGroup.hidden = true
    return
  }
  const info = currentBdaAppearance()
  if (isSkinInfoPath(selectedPath) && selectedDocument) {
    bdaConfigFieldsGroup.hidden = false
    renderBdaMetadataEditor(bdaConfigFields, {
      entries: selectedDocument.entries("").map(({ key, value }) => ({ key, value })),
      editable: isEditing(),
      onChange: (key, value) => {
        if (!selectedDocument) return
        const before = selectedDocument.toString()
        if (!selectedDocument.set("", key, value)) return
        const after = selectedDocument.toString()
        commitText(selectedPath, before, after)
        setSourceValue(after)
        populateBdaConfigInspector()
        updateDirty()
      },
    })
    return
  }
  if (bdaAppearancePart(selectedPath)?.kind === "panel" && info) {
    const panelName = selectedPath.split("/").pop()?.replace(/\.ini$/i, "") ?? ""
    const panel = info.appearance.panels.get(panelName)
    const selectedKeys = selectedBdaKeyNames().flatMap((name) => {
      const key = panel?.keys.get(name)
      return key ? [{ name, key }] : []
    })
    bdaConfigFieldsGroup.hidden = false
    renderBdaLayoutEditor(bdaConfigFields, {
      appearance: info.appearance,
      panelName,
      keys: selectedKeys,
      scope: selectedCandidate ? "candidate" : "panel",
      resolver: visualResolver(),
      editable: isEditing(),
      onStyleChange: (ref, property, value) => { updateBdaRefs([ref], property, value) },
      onPanelPropertyChange: (property, value) => { updateSelectedBdaPanelProperty(property, value) },
      onStyleRefChange: (paths, ref, owner) => { updateBdaAppearanceStyleRef(paths, ref, owner) },
      onStyleRefAction: (paths, ref, field, action, owner) => {
        if (action === "edit") openStyleReferenceEditor(bdaStyleID(ref))
        else openBdaStyleReferencePicker(paths, ref, field, owner)
      },
    })
    return
  }
  const bytes = archive.isBdaConfig(selectedPath) ? archive.getBytes(selectedPath) : undefined
  bdaConfigFieldsGroup.hidden = !bytes
  if (!bytes) return
  const update = (after: Uint8Array) => {
    commitBytes(selectedPath, bytes, after)
    if (/appearanceConfig$/i.test(selectedPath)) refreshBdaLayout(layoutPath)
    refreshSelectedBdaSource()
    refreshPreview()
    populateBdaConfigInspector()
    updateDirty()
  }
  renderBdaConfigEditor(bdaConfigFields, {
    path: selectedPath,
    bytes,
    resolver: visualResolver(),
    editable: isEditing(),
    onDesignWidth: (value) => update(updateBdaDesignWidth(bytes, value)),
    onAnimationFrame: (sequence, frame, property, value) => update(
      updateBdaAnimationFrame(bytes, sequence, frame, property, value),
    ),
    onPickAnimationResource: (sequence, frame) => openBdaAnimationResourceChooser((resourceID) => update(
      updateBdaAnimationFrame(bytes, sequence, frame, "resourceID", resourceID),
    )),
  })
}

function addNavButton(
  parent: HTMLElement,
  label: string,
  path: string,
  className: string,
  icon?: string,
  navMode = className === "nav-resource" ? "resource" : "document",
  meta = path.split("/").pop() ?? path,
): void {
  if (!archive?.names().includes(path) && !isBdaVirtualTextPath(path) && !isBdaAppearancePartPath(path)) return
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
  metaNode.textContent = meta
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

function syncBdaKeyFieldLabels(bdaSelected: boolean): void {
  for (const field of [...keyFields, ...styleFields]) {
    const label = field.closest<HTMLElement>("label")
    const textNode = label && Array.from(label.childNodes).find(
      (node): node is Text => node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim()),
    )
    if (!textNode || !label) continue
    const name = field.dataset.keyField ?? field.dataset.styleField ?? ""
    label.dataset.defaultInspectorCaption ??= textNode.textContent.trim()
    const caption = bdaSelected ? bdaKeyFieldLabels[name] : label.dataset.defaultInspectorCaption
    if (caption) textNode.textContent = `${caption} `
  }
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
  const bdaSelected = archive?.format === "bda"
  const candidateSelected = Boolean(bdaSelected && selectedCandidate && selectedPath === layoutPath)
  syncBdaKeyFieldLabels(bdaSelected)
  skinFieldsGroup.hidden = !skinSelected || bdaSelected
  toolbarFieldsGroup.hidden = !toolbarSelected || bdaSelected
  keyboardFieldsGroup.hidden = bdaSelected || skinSelected || toolbarSelected || bdaConfigSelected || candidateSelected || selectedPath !== layoutPath || hasSelection
  for (const group of keyOnlyGroups) {
    group.hidden = skinSelected || bdaConfigSelected || !hasSelection || bdaSelected && group !== keyAppearanceFieldsGroup
  }
  selectedKeyName.textContent = skinSelected
    ? "皮肤信息"
    : bdaConfigSelected
      ? selectedPath.split("/").pop() ?? "BDA 专属配置"
    : candidateSelected
      ? "候选栏"
    : toolbarSelected
      ? "候选栏与工具栏"
    : selectedPath !== layoutPath && !toolbarSelected
      ? selectedPath.split("/").pop() ?? "文档配置"
    : !hasSelection
      ? `${layout.value === "py_26.ini" ? "26 键" : "九键"} · 整体设置`
    : bdaSelected
      ? selectedBdaKeyNames().join("、") || `已选择 ${sections.length} 个 BDA 按键`
    : sections.length === 1
      ? isListCell(sections[0])
        ? "LIST · 候选栏"
        : `${effectiveKeySection(sections[0])} · ${effectiveKeyValue(sections[0], "CENTER") || "未配置点击动作"}`
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
    // BDA 样式引用由源码结构控件编辑，旧格式按键字段只负责非 BDA 皮肤。
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
          : listCellValue(document!, sections[0], name)
      }
      continue
    }
    const rectIndex = ["x", "y", "width", "height"].indexOf(name)
    const values = sections.map((section) => {
      if (rectIndex < 0) {
        if (name === "STAT_STYLE") return document?.get(section, name) ?? ""
        if (name === "SOUND_STYLE") {
          const effective = effectiveKeySection(section)
          return soundStyleForKey(document!, effective, soundGeneral)
            ?? (effective === section ? "" : soundStyleForKey(document!, section, soundGeneral) ?? "")
        }
        return effectiveKeyValue(section, name) ?? ""
      }
      const rect = document?.get(section, "VIEW_RECT")?.split(",").map(Number)
      return rect?.length === 4 ? String(Math.round(rect[rectIndex])) : ""
    })
    const common = values.every((value) => value === values[0]) ? values[0] : ""
    field.value = common
    if (!common && new Set(values).size > 1) field.placeholder = "混合"
  }
  const bdaKeyProperties = new Set(["FORE_OFFSET"])
  for (const field of keyFields) {
    if (!field.closest(".key-appearance-fields")) continue
    const label = field.closest<HTMLElement>("label")
    if (label) label.hidden = Boolean(bdaSelected && (
      !bdaKeyProperties.has(field.dataset.keyField ?? "") || !field.value && field.placeholder !== "混合"
    ))
  }
  const bdaTextPropertyAvailability = new Map<string, boolean>()
  for (const field of styleFields) {
    const property = field.dataset.styleField ?? ""
    if (archive?.format === "bda") {
      const info = currentBdaAppearance()
      const refs = selectedBdaRefs("FORE_STYLE", "text")
      const values = info ? refs.map((ref) => bdaStyleValue(info.appearance, ref, property)) : []
      const available = Boolean(info && refs.some((ref) => bdaStyleHasProperty(info.appearance, ref, property)))
      bdaTextPropertyAvailability.set(property, available)
      const common = values.length && values.every((value) => value === values[0]) ? values[0] : ""
      field.disabled = !available
      field.placeholder = available && !common && new Set(values).size > 1 ? "混合" : available ? "" : "未配置"
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
  for (const label of textStyleLabels) {
    if (!hasSelection || !hasTextStyle) {
      label.hidden = true
      continue
    }
    if (archive?.format !== "bda") {
      label.hidden = false
      for (const fieldLabel of Array.from(label.querySelectorAll<HTMLLabelElement>("label"))) fieldLabel.hidden = false
      continue
    }
    if (label.classList.contains("color-pair-field")) {
      for (const field of Array.from(label.querySelectorAll<HTMLInputElement>("[data-style-field]"))) {
        const fieldLabel = field.closest<HTMLLabelElement>("label")
        if (fieldLabel) fieldLabel.hidden = !bdaTextPropertyAvailability.get(field.dataset.styleField ?? "")
      }
      label.hidden = !Array.from(label.querySelectorAll<HTMLLabelElement>("label")).some((fieldLabel) => !fieldLabel.hidden)
      continue
    }
    const property = label.querySelector<HTMLInputElement>("[data-style-field]")?.dataset.styleField ?? ""
    label.hidden = !bdaTextPropertyAvailability.get(property)
  }
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
    const values = selectedKeySections.map((section) => effectiveKeyValue(section, name) ?? "")
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
  const name = field.dataset.keyField ?? ""
  if (archive?.format === "bda") return
  if (!archive || !layoutDocument || !selectedKeySections.length) return
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
      const target = name === "STAT_STYLE" ? section : effectiveKeySection(section)
      layoutDocument.set(target, name, field.value)
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
          : effectiveKeyValue(key, source) ?? ""
        const id = backStyle.split(",")[0]?.trim()
        return id && /^\d+$/.test(id) ? [`STYLE${id}`] : []
      }))]
    : [...new Set(selectedKeySections.flatMap((key) => {
        const foreStyle = isListCell(key)
          ? layoutDocument?.get("LIST", "FORE_STYLE") ?? ""
          : effectiveKeyValue(key, source) ?? ""
        return foreStyle.split(",").map((token) => token.trim()).flatMap((token) => {
          const value = Number(token)
          return [`STYLE${token}`, Number.isFinite(value) ? `STYLE${Math.floor(value / 100)}` : ""]
        }).filter((section) => section && document.sections().includes(section))
      }))]
  return sections.length ? { document, path, sections } : undefined
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
  if (!archive || (!pickerTarget && !resourcePickerSelect)) return
  nativeResourcePickerPayload = resourceImagePaths(archive.names(), theme.value, orientation.value).flatMap((path) => {
    const bytes = archive?.getBytes(path)
    return bytes ? [{ path, dataURL: imageDataURL(bytes) }] : []
  })
  void showPickerWindow("resource-picker", "resource", "选择图片资源", 860, 640)
}

function closeStyleImageResourcePicker(): void {
  styleImageResourcePicker.hidden = true
  styleImageResourceSearch.value = ""
  resourcePickerSelect = undefined
}

function selectImageResource(path: string): void {
  const select = resourcePickerSelect
  if (select) {
    const resourceID = path.split("/").pop()?.replace(/\.png$/i, "") ?? path
    clearImageSlicePicker()
    select(resourceID)
    return
  }
  if (pickerTarget) openImageSlicePicker(path, pickerTarget)
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
      if (resourcePickerSelect) selectImageResource(path)
      else {
        closeStyleImageResourcePicker()
        if (pickerTarget) openImageSlicePicker(path, pickerTarget)
      }
    })
    styleImageImgList.append(button)
  }
  const count = styleImageImgList.childElementCount
  styleImageResourceCount.textContent = `${count} 张图片`
  styleImageResourceEmpty.hidden = count > 0
}

function openStyleImageResourcePicker(): void {
  if (isTauri() || !archive || (!pickerTarget && !resourcePickerSelect)) return
  if (!pickerTarget) {
    styleImageDialog.hidden = false
    styleImagePreview.hidden = true
    styleImagePicker.hidden = true
    styleImageResourceOpen.hidden = true
    styleImageTitle.textContent = "选择图片资源"
    styleImageSubtitle.textContent = ""
  }
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
  resourcePickerSelect = undefined
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
  pickerURL = URL.createObjectURL(new Blob([new Uint8Array(bytes).buffer], { type: "image/png" }))
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
  const document = layoutDocument
  return selectedKeySections.flatMap((section) => {
    if (isListCell(section)) {
      const rect = listCellRect(document, section)
      return rect ? [rect] : []
    }
    const values = document.get(section, "VIEW_RECT")?.split(",").map(Number)
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
  coalesce = false,
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
  commitText(layoutPath, before, text, coalesce)
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

function commitBdaTileInnerRect(rect: TileRect): void {
  const info = currentBdaAppearance()
  const usage = selectedBdaTileUsage()
  const slice = slices.find((item) => item.index === selectedTileIndex)
  if (!info || !usage || !slice || !isEditing()) return
  const [x, y, width, height] = rect
  if (rect.some((value) => !Number.isInteger(value) || value < 0)) return
  if (x + width > slice.source[2] || y + height > slice.source[3]) return
  const after = updateBdaImageInnerRect(info.bytes, usage.ref, usage.highlighted, rect)
  commitBytes(info.path, info.bytes, after)
  loadTiles(selectedResourcePath)
  refreshPreview()
  populateKeyInspector()
  updateDirty()
}

function commitTile(slice: TileSlice, coalesce = false): void {
  if (!archive || !selectedResourcePath || !isEditing()) return
  const [x, y, width, height] = slice.source
  if (
    width <= 0 || height <= 0 || x < 0 || y < 0 ||
    x + width > atlasCanvas.width || y + height > atlasCanvas.height
  ) return
  const before = tileDocument.toString()
  updateTileSlice(tileDocument, slice)
  commitText(tilePath, before, tileDocument.toString(), coalesce)
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

function moveSelectedTile(deltaX: number, deltaY: number, coalesce = false): void {
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
  commitTile({ index: existing.index, source, ...(inner ? { inner } : {}) }, coalesce)
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
  const innerValues = tileInnerFields.map((field) => field.value.trim())
  const innerNumbers = innerValues.map(Number) as TileRect
  const inner = innerValues.every(Boolean) && innerNumbers.every(Number.isFinite) ? innerNumbers : undefined
  if (archive?.format === "bda") {
    if (inner) commitBdaTileInnerRect(inner)
    return
  }
  const source = tileSourceFields.map((field) => Number(field.value)) as TileRect
  if (source.some((value) => !Number.isFinite(value))) return
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
  if (resourceMode !== "image") bdaSliceReturn = undefined
  if (path !== selectedPath) source.commit()
  selectedCandidate = false
  const previousInspectorTab = inspectorTab
  const preserveCurrentInspectorView = preserveInspectorView || path === selectedPath
  if (path !== selectedPath) sourceHistoryHighlight = undefined
  styleReturnPath = ""
  styleReturnCandidate = false
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
  const appearancePart = bdaAppearancePart(path)
  if (appearancePart) {
    hideImageWorkspace()
    const info = currentBdaAppearance()
    if (!info) return
    const basePath = bdaBasePath(path)
    const base = appearancePart.kind === "panel" && bdaBase?.isText(basePath)
      ? IniDocument.parse(bdaBase.getText(basePath))
      : undefined
    const previewLayout = Boolean(base && previewItems(base).some((item) => item.editable))
    if (previewLayout && !refreshBdaLayout(path)) return
    selectedDocument = previewLayout ? layoutDocument : undefined
    if (previewLayout) {
      selectedKeySections = []
      preview.setSelected([])
    }
    setSourceValue(decodedBdaAppearancePart(info.bytes, appearancePart))
    source.disabled = false
    const partName = appearancePart.kind === "panel" ? appearancePart.name : appearancePart.group
    sourceName.textContent = `${info.path} · ${partName} · 解码源码`
    inspectorTab = "properties"
  } else if (isBdaVirtualTextPath(path)) {
    hideImageWorkspace()
    const panelName = path.split("/").pop()?.replace(/\.ini$/i, "") ?? path
    const base = IniDocument.parse(bdaBase!.getText(bdaBasePath(path)))
    const previewLayout = isBdaLayoutPath(path) && previewItems(base).some((item) => item.editable)
    if (previewLayout && !refreshBdaLayout(path)) return
    if (previewLayout) layoutPath = path
    selectedDocument = previewLayout ? layoutDocument : base
    if (previewLayout) {
      selectedKeySections = []
      preview.setSelected([])
    }
    const info = currentBdaAppearance()
    setSourceValue(info ? decodedBdaSource(info.path, info.bytes, panelName) : "{}")
    source.disabled = true
    sourceName.textContent = info ? `${info.path} · ${panelName} · 解码源码` : panelName
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
    setSourceValue(decodedBdaEditorSource(path, archive.getBytes(path)!))
    source.disabled = !bdaDecodedSourceEditable(path)
    sourceName.textContent = `${path} · 解码源码${source.disabled ? "（原始字段，只读）" : ""}`
    inspectorTab = "properties"
  } else {
    return
  }
  if (path === layoutPath && selectedDocument) {
    layoutDocument = selectedDocument
    refreshPreview()
  }
  if (preferredSidebarView === "source" && (
    archive?.isText(path) || archive?.isBdaConfig(path) || isBdaAppearancePartPath(path)
  )) {
    inspectorTab = "source"
  }
  if (preserveCurrentInspectorView || (previousInspectorTab === "source" && path === layoutPath)) {
    inspectorTab = previousInspectorTab
  }
  updateInspectorView()
  if (resourceConfigActive) renderResourceInspector()
  if (!quickInspector.hidden) populateKeyInspector()
  selectedFileButton?.classList.remove("selected")
  if (preferredSidebarView === "source") ensureSourcePathRendered(path)
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
  updateSourceSearchStatus()
  syncCandidateSelection()
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

  type NavEntry = {
    group: string
    label: string
    path: string
    className: string
    icon: string
    navMode?: string
    meta?: string
  }
  const entries: NavEntry[] = []
  const bdaConfigGroups = [
    ["animation", "动画效果", "动画配置", "sparkles"],
    ["lightAnimation", "轻量动画", "轻量动画", "sparkles"],
    ["sound", "按键音效", "声音配置", "speaker.wave.2"],
    ["switch", "开关配置", "开关配置", "gearshape"],
    ["sticker", "贴纸配置", "贴纸配置", "photo"],
    ["scene", "场景配置", "场景配置", "gearshape"],
  ] as const
  const overviewPath = archive.names().includes(`${theme.value}/skin/Info.txt`)
    ? `${theme.value}/skin/Info.txt`
    : "Info.txt"
  entries.push({
    group: archive.format === "bda" ? "皮肤信息" : "皮肤",
    label: "皮肤信息",
    path: overviewPath,
    className: "nav-overview",
    icon: "info.circle",
  })
  if (archive.format === "bda") {
    entries.push({ group: "皮肤信息", label: "效果预览", path: `${theme.value}/skin/demo.png`, className: "nav-overview", icon: "photo" })
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
    "sym_26_en.ini": { group: "数字与符号", label: "英文 26 键符号", className: "nav-component", icon: "asterisk" },
    "hw_grid.ini": { group: "手写与选择", label: "手写面板", className: "nav-component", icon: "pencil" },
    "hw_full.ini": { group: "手写与选择", label: "全屏手写", className: "nav-component", icon: "pencil" },
    "sel_ch.ini": { group: "手写与选择", label: "中文选择栏", className: "nav-component", icon: "list.bullet" },
    "sel_en.ini": { group: "手写与选择", label: "英文选择栏", className: "nav-component", icon: "list.bullet" },
    "voice.ini": { group: "键盘组件", label: "语音键盘", className: "nav-component", icon: "keyboard" },
    "dial.ini": { group: "键盘布局", label: "拨号键盘", className: "nav-layout", icon: "keyboard" },
    "email.ini": { group: "键盘布局", label: "邮箱键盘", className: "nav-layout", icon: "keyboard" },
    "net.ini": { group: "键盘布局", label: "网络键盘", className: "nav-layout", icon: "keyboard" },
    "net_shifts.ini": { group: "键盘布局", label: "网络键盘 Shift", className: "nav-layout", icon: "keyboard" },
    "sel_ch_h.ini": { group: "手写与选择", label: "中文选择栏（加高）", className: "nav-component", icon: "list.bullet" },
    "sel_en_h.ini": { group: "手写与选择", label: "英文选择栏（加高）", className: "nav-component", icon: "list.bullet" },
    "sym_26_cn_h.ini": { group: "数字与符号", label: "中文 26 键符号（加高）", className: "nav-component", icon: "asterisk" },
    "sym_26_en_h.ini": { group: "数字与符号", label: "英文 26 键符号（加高）", className: "nav-component", icon: "asterisk" },
    "symbol_h.ini": { group: "数字与符号", label: "符号面板（加高）", className: "nav-component", icon: "asterisk" },
    "help.ini": { group: "手写与选择", label: "帮助面板", className: "nav-component", icon: "list.bullet" },
    "logo.ini": { group: "键盘组件", label: "输入法标识", className: "nav-component", icon: "app" },
    "gen.ini": { group: "资源配置", label: "通用配置", className: "nav-style", icon: "gearshape" },
  }
  const hiddenLayouts = new Set(["def_9.ini", "def_26.ini"])
  const configPrefix = `${theme.value}/skin/${orientation.value}/`
  const appearancePath = bdaAppearancePath(archive, theme.value, orientation.value)
  const appearanceBytes = appearancePath && archive.getBytes(appearancePath)
  const appearance = appearanceBytes ? decodeBdaAppearance(appearanceBytes) : undefined
  if (archive.format === "bda" && appearance) {
    for (const panelName of appearance.panels.keys()) {
      const name = `${panelName}.ini`
      if (hiddenLayouts.has(name)) continue
      const info = iniTypes[name] ?? {
        group: "面板样式",
        label: panelName.replaceAll("_", " "),
        className: "nav-layout",
        icon: "keyboard",
      }
      entries.push({
        ...info,
        group: "面板样式",
        path: `${configPrefix}${name}`,
        meta: panelName,
      })
    }
    entries.push({
      group: "资源配置",
      label: "样式配置",
      path: bdaAppearanceStylePath(selectedBdaStyleGroup),
      className: "nav-style",
      icon: "paintpalette",
      navMode: "style",
      meta: "appearanceConfig",
    })
    entries.push({
      group: "资源配置",
      label: "图片资源",
      path: appearancePath!,
      className: "nav-resource",
      icon: "photo",
      navMode: "resource",
    })
    entries.push({
      group: "资源配置",
      label: "声音资源",
      path: appearancePath!,
      className: "nav-resource",
      icon: "speaker.wave.2",
      navMode: "sound",
    })
  }
  const layoutPaths = archive.format === "bda" ? [] : archive.names()
  for (const path of layoutPaths.sort()) {
    const basePath = path
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
    entries.push({
      ...info,
      group: info.group,
      path,
    })
  }

  const candidatePath = archive.format === "bda" ? undefined : toolbarConfigPath()
  if (candidatePath) {
    entries.push({ group: "键盘组件", label: "候选栏与工具栏", path: candidatePath, className: "nav-component", icon: "text.bubble" })
  }
  const hintPath = firstExistingPath(archive.names(), `${theme.value}/skin/${orientation.value}`, ["hint1.pop", "hint.pop"])
  if (hintPath) entries.push({ group: "键盘组件", label: "按键气泡", path: hintPath, className: "nav-component", icon: "rectangle.and.hand.point" })
  const longHintPath = firstExistingPath(archive.names(), `${theme.value}/skin/${orientation.value}`, ["hint2.pop"])
  if (longHintPath) entries.push({ group: "键盘组件", label: "长按气泡", path: longHintPath, className: "nav-component", icon: "rectangle.and.hand.point" })
  const stylePath = appearancePath ?? (archive.format === "bda" ? undefined : styleConfigPath())
  if (stylePath && archive.format !== "bda") {
    entries.push({
      group: "资源配置",
      label: "图片资源",
      path: stylePath,
      className: "nav-resource",
      icon: "photo",
      navMode: "resource",
    })
    entries.push({ group: "资源配置", label: "样式配置", path: stylePath, className: "nav-style", icon: "paintpalette", navMode: "style" })
    entries.push({ group: "资源配置", label: "按键音效", path: stylePath, className: "nav-resource", icon: "speaker.wave.2", navMode: "sound" })
  }
  const legacyAnimationPath = archive.format === "bda" ? undefined : legacyAnimationConfigPath()
  if (legacyAnimationPath) {
    entries.push({ group: "资源配置", label: "粒子动效", path: legacyAnimationPath, className: "nav-style", icon: "sparkles" })
  }
  if (archive.format === "bda") {
    for (const [kind, group, label, icon] of bdaConfigGroups) {
      const paths = bdaConfigPaths(archive, theme.value, orientation.value, kind)
      for (const path of paths) entries.push({
        group,
        label: paths.length > 1 ? `${label} · ${path.split("/").pop()}` : label,
        path,
        className: kind === "sound" ? "nav-resource" : "nav-style",
        icon,
        navMode: kind === "sound" ? "sound" : undefined,
      })
    }
  }
  const groups = archive.format === "bda"
    ? ["皮肤信息", "资源配置", "面板样式", "动画效果", "按键音效", "轻量动画", "开关配置", "贴纸配置", "场景配置"]
    : ["皮肤", "资源配置", "键盘布局", "数字与符号", "手写与选择", "键盘组件", "扩展配置", "扩展布局"]
  for (const group of groups) {
    const grouped = entries.filter((entry) => entry.group === group && (
      archive?.names().includes(entry.path) ||
      archive?.format === "bda" && (isBdaAppearancePartPath(entry.path) || Boolean(bdaBase?.isText(bdaBasePath(entry.path))))
    ))
    if (group === "键盘布局") {
      const layoutRank: Record<string, number> = { "py_9.ini": 0, "py_26.ini": 1, "bh.ini": 3 }
      grouped.sort((a, b) => {
        const aName = a.path.split("/").pop() ?? ""
        const bName = b.path.split("/").pop() ?? ""
        return (layoutRank[aName] ?? 2) - (layoutRank[bName] ?? 2)
      })
    }
    if (archive.format === "bda" && group === "面板样式") {
      const bdaLayoutRank: Record<string, number> = {
        "py_9": 0,
        "py_26": 1,
        "en_26": 2,
        "en_26s": 3,
        "en_9": 4,
        "en_9s": 5,
        "num_9": 6,
        "num_26": 7,
        "symbol": 8,
        "sym_26_cn": 9,
        "sym_26_en": 10,
        "hw_grid": 11,
        "hw_full": 12,
        "bh": 13,
        "sel_ch": 14,
        "sel_en": 15,
        "voice": 16,
      }
      grouped.sort((a, b) => {
        const aName = a.meta ?? ""
        const bName = b.meta ?? ""
        return (bdaLayoutRank[aName] ?? 100) - (bdaLayoutRank[bName] ?? 100) || aName.localeCompare(bName)
      })
    }
    if (!grouped.length) continue
    const body = section(group)
    for (const entry of grouped) {
      addNavButton(body, entry.label, entry.path, entry.className, entry.icon, entry.navMode, entry.meta)
    }
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
      let populated = false
      const populate = () => {
        if (populated) return
        populated = true
        appendNode(children, child, path)
      }
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
        if (folder.open) populate()
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

function ensureSourcePathRendered(path: string): void {
  const parts = path.split("/").slice(0, -1)
  for (let index = 1; index <= parts.length; index += 1) {
    const folderPath = parts.slice(0, index).join("/")
    const folder = files.querySelector<HTMLDetailsElement>(`details.raw-folder[data-folder-path="${CSS.escape(folderPath)}"]`)
    if (!folder) return
    folder.open = true
    folder.dispatchEvent(new Event("toggle"))
  }
}

function revealSourceFile(path: string): void {
  ensureSourcePathRendered(path)
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
  const started = performance.now()
  clientLog.info("archive.load.start", {
    name: (displayName || path).split(/[\\/]/).pop() || (isNew ? "new-project" : "unnamed"),
    sizeBytes: bytes.byteLength,
    sourceWorkspace: Boolean(existingSourceWorkspace),
  })
  if (showSkinLoadProgress(bytes.byteLength)) await waitForInterfacePaint()
  await flushSourceAutosave()
  await activateSourceWorkspace("", "")
  sourceWorkspacePendingArchive = undefined
  releaseKeySound()
  keySoundBuffers.clear()
  let nextArchive: SkinArchive
  try {
    updateFileOperationProgress(18, "正在解析皮肤包…")
    nextArchive = await SkinArchive.openAsync(
      bytes,
      exportFormatFromPath(displayName || path),
      fileOperationProgressVisible
        ? (progress) => updateFileOperationProgress(18 + progress * 32, `正在解析皮肤包… ${Math.round(progress * 100)}%`)
        : undefined,
    )
  } catch (error) {
    clientLog.error("archive.parse.error", {
      name: (displayName || path).split(/[\\/]/).pop() || "unnamed",
      sizeBytes: bytes.byteLength,
      durationMs: Math.round(performance.now() - started),
    }, error)
    void flushClientLogs()
    throw error
  }
  if (nextArchive.format === "bda" && !bdaBase) {
    updateFileOperationProgress(52, "正在加载 BDA 基础布局…")
    const response = await fetch(new URL("bda-base.bds", document.baseURI))
    if (!response.ok) throw new Error("无法加载 BDA 官方基础布局")
    bdaBase = await SkinArchive.openAsync(new Uint8Array(await response.arrayBuffer()))
  }
  const bdaWarnings = bdaCompatibilityWarnings(nextArchive)
  if (bdaWarnings.length) clientLog.info("bda.compatibility.warning", { warnings: bdaWarnings.join("；") })
  updateFileOperationProgress(55, "正在建立编辑工作区…")
  let nextSourceWorkspace = existingSourceWorkspace
  let pendingSourceDirectory: string | null | undefined
  const sourceDirectoryActive = sourceDirectoryEnabledBySettings()
  const configuredDirectory = sourceDirectoryActive ? localStorage.getItem("source-directory") || null : null
  if (isTauri() && sourceDirectoryActive && !nextSourceWorkspace && (!isAndroidTauri() || configuredDirectory)) {
    pendingSourceDirectory = configuredDirectory
  }
  assetURL = releaseImagePreviewURL(assetURL)
  clearImageSlicePicker()
  archive = nextArchive
  if (pendingSourceDirectory !== undefined) sourceWorkspacePendingArchive = nextArchive
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
  updateFileOperationProgress(68, "正在生成文件列表…")
  await waitForInterfacePaint()
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
    updateFileOperationProgress(82, "正在生成皮肤预览…")
    selectFile(initial)
  }
  updateFileOperationProgress(92, "正在连接源码工作区…")
  await activateSourceWorkspace(nextSourceWorkspace, sourcePrefix)
  if (pendingSourceDirectory !== undefined) {
    const pendingArchive = nextArchive
    void (async () => {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0))
      try {
        return await invoke<string>("create_source_workspace", {
          directory: pendingSourceDirectory,
          name: path || displayName || exportName("未命名", nextArchive.format),
          files: sourceFilesPayload(nextArchive),
        })
      } catch (error) {
        if (isAndroidTauri() || !pendingSourceDirectory) throw error
        const workspace = await invoke<string>("create_source_workspace", {
          directory: null,
          name: path || displayName || exportName("未命名", nextArchive.format),
          files: sourceFilesPayload(nextArchive),
        })
        showStatus("自定义源码目录不可用，本次已保存到内置目录")
        return workspace
      }
    })().then(async (workspace) => {
      if (archive !== pendingArchive || sourceWorkspacePendingArchive !== pendingArchive) return
      const pendingPaths = [...pendingSourcePaths]
      await activateSourceWorkspace(workspace, sourcePrefix)
      if (archive !== pendingArchive || sourceWorkspacePendingArchive !== pendingArchive) return
      pendingPaths.forEach((changedPath) => pendingSourcePaths.add(changedPath))
      await flushSourceAutosave()
      sourceWorkspacePendingArchive = undefined
      showStatus(isAndroidTauri() ? "源码已保存到授权目录" : "源码工作区已就绪")
    }).catch((error) => {
      if (archive !== pendingArchive || sourceWorkspacePendingArchive !== pendingArchive) return
      sourceWorkspacePendingArchive = undefined
      pendingSourcePaths.clear()
      showError(error, "保存源码到授权目录")
    })
  }
  updateDirty()
  clientLog.info("archive.load.finish", {
    format: nextArchive.format,
    fileCount: nextArchive.names().length,
    durationMs: Math.round(performance.now() - started),
  })
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
    const packed = SkinArchive.open(decodeBase64Archive(encoded))
    await loadArchive(sourceArchiveFromFiles(packed.sourceFiles()).toBytes(), "", false, path, name, sourcePrefix)
    return true
  }
  const files = await invoke<SourceReadFilePayload[]>("open_source_workspace", { path })
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
  const sourceArchive = sourceArchiveFromFiles(sourceFiles)
  const name = path.split(/[\\/]/).pop() || "皮肤源码"
  await loadArchive(sourceArchive.toBytes(), "", false, path, name, sourcePrefix)
  return true
}

async function restoreLastSourceWorkspace(): Promise<void> {
  if (!isAndroidTauri() || localStorage.getItem("source-directory-enabled") !== "true") return
  const lastSourceWorkspace = localStorage.getItem(LAST_SOURCE_WORKSPACE_KEY)
  if (!lastSourceWorkspace) return
  await runFileOperation("恢复上次皮肤源码", async () => {
    try {
      return await loadSourceWorkspace(lastSourceWorkspace)
    } catch (error) {
      localStorage.removeItem(LAST_SOURCE_WORKSPACE_KEY)
      throw error
    }
  })
}

async function loadNativePath(path: string): Promise<boolean> {
  if (!isSupportedSkinPath(path)) throw new Error("仅支持 .bda、.bdi 或 .bds 皮肤文件")
  const bytes = path.startsWith("content://")
    ? await readFile(path)
    : await readNativeSkinFile(path)
  await loadArchive(bytes, path)
  return true
}

function isSupportedSkinPath(path: string): boolean {
  return path.startsWith("content://") || /\.(bdi|bds|bda)$/i.test(path)
}

async function loadDroppedFile(file: File): Promise<boolean> {
  if (!isSupportedSkinPath(file.name)) return false
  if (!(await prepareDocumentReplacement())) return false
  await loadArchive(await readBrowserSkinFile(file), file.name)
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
  if (archive?.format === "bda") return "bda"
  if (isIOSWeb()) return "bdi"
  if (isAndroidTauri() || isAndroidWeb()) return "bds"
  return currentExportFormat()
}

async function exportArchive(format: ExportFormat, targetBdaPlatform?: Exclude<BdaPlatform, "unknown">): Promise<{
  bytes: Uint8Array
  converted: boolean
  warnings: string[]
} | undefined> {
  if (!archive) throw new Error("当前没有可保存的皮肤")
  updateFileOperationProgress(22, `正在生成 ${format.toUpperCase()} 皮肤包…`)
  if (archive.format === "bda" && format === "bda" && targetBdaPlatform) {
    const result = convertBdaPlatform(archive, targetBdaPlatform)
    return { bytes: await result.toBytesAsync(), converted: true, warnings: bdaCompatibilityWarnings(archive) }
  }
  if (archive.format !== "bda" || format === "bda") {
    return { bytes: await archive.toBytesAsync(format), converted: false, warnings: [] }
  }
  if (!bdaBase) throw new Error("无法加载 BDA 官方基础布局")
  await waitForInterfacePaint()
  updateFileOperationProgress(34, "正在转换 BDA 配置…")
  const result = convertBdaArchive(archive, bdaBase)
  if (result.warnings.length && !window.confirm(
    `BDA 转换为 ${format.toUpperCase()} 时将降级以下内容：\n\n${result.warnings.join("\n")}\n\n继续导出吗？`,
  )) return
  updateFileOperationProgress(48, `正在压缩 ${format.toUpperCase()} 皮肤包…`)
  return { bytes: await result.archive.toBytesAsync(format), converted: true, warnings: result.warnings }
}

async function saveNative(saveAs: boolean, format: ExportFormat, suggestedName: string): Promise<boolean> {
  if (!archive) throw new Error("当前没有可保存的皮肤")
  const exported = await exportArchive(format)
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
    archive.markSaved(exported.bytes, format)
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
  updateFileOperationProgress(72, "正在写入文件…")
  if (path.startsWith("content://")) {
    await writeFile(path, bytes)
    return
  }
  await invoke("write_file", { path, data: bytes })
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
  if (!picker) {
    const link = document.createElement("a")
    link.href = URL.createObjectURL(new Blob([bytes.slice().buffer], { type: "application/octet-stream" }))
    link.download = filename
    link.click()
    setTimeout(() => URL.revokeObjectURL(link.href), 1000)
    return filename
  }
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
  const exported = await exportArchive(format)
  if (!exported) return false
  const path = await writeToChosenFile(suggestedName, exported.bytes, `${format.toUpperCase()} 皮肤`)
  if (!path) return false
  if (!exported.converted) {
    currentPath = path
    documentName.textContent = suggestedName
    archive.markSaved(exported.bytes, format)
    unsavedNew = false
    updateDirty()
  }
  return true
}

async function saveArchive(
  saveAs: boolean,
  format: ExportFormat,
  targetBdaPlatform?: Exclude<BdaPlatform, "unknown">,
): Promise<boolean> {
  const currentName = documentName.textContent?.trim() ?? ""
  const suggestedName = exportName(currentName, format)
  if (targetBdaPlatform) {
    const exported = await exportArchive(format, targetBdaPlatform)
    if (!exported) return false
    return Boolean(await writeToChosenFile(
      suggestedName,
      exported.bytes,
      `${targetBdaPlatform === "ios" ? "iOS" : "Android"} BDA 皮肤`,
    ))
  }
  return isTauri()
    ? saveNative(saveAs, format, suggestedName)
    : downloadArchive(format, suggestedName)
}

async function shareArchiveToMobile(): Promise<boolean> {
  if (!archive) return false
  const format = mobileShareFormat()
  const exported = await exportArchive(format, format === "bda" ? (isIOSWeb() ? "ios" : "android") : undefined)
  if (!exported) return false
  const currentName = documentName.textContent?.trim() || "皮肤"
  const name = exportName(currentName, format)
  if (isAndroidTauri()) {
    updateFileOperationProgress(72, "正在交给系统分享…")
    await invoke("share_file", { name, data: exported.bytes })
    return true
  }
  const file = new File([new Uint8Array(exported.bytes).buffer], name, { type: "application/octet-stream" })
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
    const platform = button.dataset.bdaPlatform as Exclude<BdaPlatform, "unknown"> | undefined
    toolbarMore.open = false
    void runFileOperation("导出", () => saveArchive(true, format, platform))
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
aboutDiagnostics.hidden = !isTauri()
exportLogsButton.addEventListener("click", async () => {
  exportLogsButton.disabled = true
  exportLogsStatus.textContent = "正在整理日志…"
  try {
    const date = new Date().toISOString().slice(0, 10)
    const path = await writeToChosenFile(`bdi-editor-logs-${date}.zip`, await clientLogZip(), "诊断日志")
    exportLogsStatus.textContent = path ? "日志已导出。" : "已取消导出。"
  } catch (error) {
    exportLogsStatus.textContent = `导出失败：${error instanceof Error ? error.message : String(error)}`
    clientLog.error("logs.export_failed", {}, error)
  } finally {
    exportLogsButton.disabled = false
  }
})
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
  if (!isTauri()) return
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
    settingsStorageSection.hidden = true
    return
  }
  const configured = localStorage.getItem("source-directory")
  const enabled = sourceDirectoryEnabledBySettings() && (!isAndroidTauri() || Boolean(configured))
  sourceDirectoryEnabled.checked = enabled
  sourceDirectory.disabled = !enabled
  chooseSourceDirectory.disabled = !enabled
  resetSourceDirectory.disabled = !enabled
  if (isAndroidTauri()) {
    sourceDirectory.readOnly = true
    sourceDirectory.placeholder = "/storage/emulated/0/BdiEditor"
    resetSourceDirectory.hidden = true
    if (!enabled) {
      localStorage.removeItem("source-directory-enabled")
      localStorage.removeItem("source-directory")
      localStorage.removeItem(LAST_SOURCE_WORKSPACE_KEY)
      sourceDirectory.value = ""
    }
  }
  if (!enabled) {
    sourceDirectoryStatus.textContent = "已关闭 · 不会写入源码文件"
    return
  }
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
  if (!sourceDirectoryEnabled.checked) {
    if (isAndroidTauri()) localStorage.removeItem("source-directory-enabled")
    else localStorage.setItem("source-directory-enabled", "false")
    localStorage.removeItem(LAST_SOURCE_WORKSPACE_KEY)
    sourceWorkspacePendingArchive = undefined
    await activateSourceWorkspace("", "")
    sourceDirectory.disabled = true
    chooseSourceDirectory.disabled = true
    resetSourceDirectory.disabled = true
    if (isAndroidTauri()) {
      localStorage.removeItem("source-directory")
      sourceDirectory.value = ""
    }
    sourceDirectoryStatus.textContent = "已关闭 · 不会写入源码文件"
    return
  }
  if (isAndroidTauri()) {
    const granted = await chooseAndroidSourceDirectory()
    sourceDirectoryEnabled.checked = granted
    sourceDirectory.disabled = !granted
    chooseSourceDirectory.disabled = !granted
    if (granted) localStorage.setItem("source-directory-enabled", "true")
    else sourceDirectoryStatus.textContent = "未授权 · 不会写入源码文件"
    return
  }
  localStorage.setItem("source-directory-enabled", "true")
  sourceDirectory.disabled = false
  chooseSourceDirectory.disabled = false
  resetSourceDirectory.disabled = false
  await applySourceDirectory(localStorage.getItem("source-directory"))
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
editorCrosshair.checked = localStorage.getItem("editor-crosshair") !== "off"
editorCoordinateSnap.checked = localStorage.getItem("editor-coordinate-snap") !== "off"
function applyEditorCrosshairSetting(): void {
  const state = editorCrosshair.checked ? "on" : "off"
  deviceShell.dataset.crosshair = state
  previewCoordinates.dataset.crosshair = state
  editorCoordinateSnapSetting.hidden = !editorCrosshair.checked
  previewCoordinates.hidden = editorCrosshair.checked
  if (!editorCrosshair.checked) {
    for (const property of ["left", "top", "width", "height"]) previewCoordinates.style.removeProperty(property)
  }
}
applyEditorCrosshairSetting()
editorCrosshair.addEventListener("change", () => {
  localStorage.setItem("editor-crosshair", editorCrosshair.checked ? "on" : "off")
  applyEditorCrosshairSetting()
})
editorCoordinateSnap.addEventListener("change", () => {
  localStorage.setItem("editor-coordinate-snap", editorCoordinateSnap.checked ? "on" : "off")
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
type WindowMaterialKind = "glass" | "acrylic" | "none"
let windowMaterialKind: WindowMaterialKind = "glass"
function currentWindowMaterialOpacity(): number {
  return Math.max(20, Math.min(100, Number(windowMaterialOpacity.value) || 100))
}
function applyWindowMaterialOpacity(): void {
  const opacity = currentWindowMaterialOpacity()
  windowMaterialOpacity.value = String(opacity)
  windowMaterialOpacityValue.value = `${opacity}%`
  windowMaterialOpacity.disabled = !windowMaterial.checked
  document.documentElement.dataset.windowMaterialKind = windowMaterialKind
  document.documentElement.dataset.windowMaterialOpaque = opacity >= 100 ? "true" : "false"
  document.documentElement.style.setProperty("--window-material-opacity", `${opacity}%`)
}
async function applyWindowMaterial(): Promise<void> {
  const enabled = windowMaterial.checked
  document.documentElement.dataset.windowMaterial = enabled ? "on" : "off"
  applyWindowMaterialOpacity()
  if (!isTauri()) return
  try {
    await invoke("set_window_material", { enabled, opacity: currentWindowMaterialOpacity() })
  } catch (error) {
    windowMaterial.checked = false
    document.documentElement.dataset.windowMaterial = "off"
    localStorage.setItem("window-material", "off")
    showError(error, "切换窗口材质")
  }
}
windowMaterial.checked = localStorage.getItem("window-material") !== "off"
async function initializeWindowMaterial(retryCount = 0): Promise<void> {
  if (isTauri()) windowMaterialKind = await invoke<WindowMaterialKind>("window_material_kind")
  windowMaterialOpacitySetting.hidden = windowMaterialKind === "none"
  windowMaterialOpacityLabel.textContent = windowMaterialKind === "acrylic" ? "亚克力不透明度" : "玻璃不透明度"
  const storageKey = windowMaterialKind === "acrylic" ? "window-acrylic-opacity" : "window-glass-opacity"
  windowMaterialOpacity.value = localStorage.getItem(storageKey) ?? (windowMaterialKind === "acrylic" ? "92" : "100")
  try {
    await applyWindowMaterial()
  } catch (error) {
    if (retryCount < 3) {
      await new Promise(resolve => setTimeout(resolve, (retryCount + 1) * 100))
      return initializeWindowMaterial(retryCount + 1)
    }
    throw error
  }
}
void initializeWindowMaterial().catch((error) => showError(error, "读取窗口材质"))
windowMaterial.addEventListener("change", () => {
  localStorage.setItem("window-material", windowMaterial.checked ? "on" : "off")
  void applyWindowMaterial()
})
windowMaterialOpacity.addEventListener("input", () => {
  const storageKey = windowMaterialKind === "acrylic" ? "window-acrylic-opacity" : "window-glass-opacity"
  localStorage.setItem(storageKey, String(currentWindowMaterialOpacity()))
  applyWindowMaterialOpacity()
})
windowMaterialOpacity.addEventListener("change", () => void applyWindowMaterial())

let windowDragPointerDown = false
let windowDragMaterialDisabled = false
let windowDragMaterialTransition: Promise<unknown> | undefined

async function restoreWindowMaterialAfterDrag(retryCount = 0): Promise<void> {
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
  await new Promise(resolve => setTimeout(resolve, 50))
  try {
    await applyWindowMaterial()
  } catch (error) {
    if (retryCount < 3) {
      await new Promise(resolve => setTimeout(resolve, (retryCount + 1) * 100))
      return restoreWindowMaterialAfterDrag(retryCount + 1)
    }
    document.documentElement.dataset.windowMaterial = windowMaterial.checked ? "on" : "off"
    await applyWindowMaterial().catch(() => {})
  }
}

async function startWindowsWindowDrag(): Promise<void> {
  windowDragPointerDown = true
  document.documentElement.dataset.windowMaterial = "off"
  try {
    windowDragMaterialTransition = invoke("set_window_material", { enabled: false, opacity: currentWindowMaterialOpacity() })
    await windowDragMaterialTransition
    windowDragMaterialDisabled = true
    if (!windowDragPointerDown) {
      await restoreWindowMaterialAfterDrag()
      return
    }
    const mouseReleased = invoke("wait_for_left_mouse_release")
    await getCurrentWindow().startDragging()
    await mouseReleased
    await restoreWindowMaterialAfterDrag()
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
sourceCompletionEnabled.checked = false
sourceValueHintsEnabled.checked = false
sourceLineExplanationEnabled.checked = false
function applySourceEditorFeatures(): void {
  source.setFeatures({
    completion: sourceCompletionEnabled.checked,
    valueHints: sourceValueHintsEnabled.checked,
    explanations: sourceLineExplanationEnabled.checked,
  })
  updateSourceHighlight()
}
for (const [input, key] of [
  [sourceCompletionEnabled, "source-completion-enabled"],
  [sourceValueHintsEnabled, "source-value-hints-enabled"],
  [sourceLineExplanationEnabled, "source-line-explanation-enabled"],
] as const) input.addEventListener("change", () => {
  localStorage.setItem(key, input.checked ? "on" : "off")
  applySourceEditorFeatures()
})
undoButton.addEventListener("click", undo)
redoButton.addEventListener("click", redo)
browserOpen.addEventListener("change", async () => {
  const file = browserOpen.files?.[0]
  if (file) {
    await runFileOperation("打开", async () => {
      if (!isSupportedSkinPath(file.name)) throw new Error("仅支持 .bda、.bdi 或 .bds 皮肤文件")
      await loadArchive(await readBrowserSkinFile(file), file.name)
      return true
    })
  }
  browserOpen.value = ""
})
fileOperationDialog.addEventListener("cancel", (event) => {
  if (fileOperationRunning) event.preventDefault()
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
  if (archive.isBdaConfig(selectedPath) || isBdaAppearancePartPath(selectedPath)) {
    scheduleSourceInputHighlight()
    return
  }
  if (resourceConfigActive && selectedResourcePath) {
    const before = tileDocument.toString()
    tileDocument = IniDocument.parse(source.value)
    commitText(tilePath, before, source.value)
    slices = tileSlices(tileDocument)
    if (!slices.some((slice) => slice.index === selectedTileIndex)) selectedTileIndex = undefined
    populateTileInspector()
    drawAtlas()
    updateDirty()
    scheduleSourceInputHighlight()
    return
  }
  const before = selectedDocument?.toString() ?? archive.getText(selectedPath)
  selectedDocument = IniDocument.parse(source.value)
  commitText(selectedPath, before, source.value)
  if (selectedPath === layoutPath) layoutDocument = selectedDocument
  updateDirty()
  scheduleSourceInputHighlight(true)
})
source.addEventListener("change", commitBdaSourceEdit)
source.addEventListener("valueclick", (event) => {
  const detail = (event as CustomEvent<SourceEditorValueRange>).detail
  if (!detail || detail.kind === "action") return
  openSourceValuePreview(detail)
})
sourceSearch.addEventListener("input", () => {
  sourceSearchIndex = sourceSearch.value.trim() ? 0 : -1
  scheduleSourceSearch()
})
sourceSearch.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return
  event.preventDefault()
  findSourceMatch(event.shiftKey ? -1 : 1)
})
sourceSearchPrevious.addEventListener("click", () => findSourceMatch(-1))
sourceSearchNext.addEventListener("click", () => findSourceMatch(1))
sourceFindToggle.addEventListener("click", () => {
  sourceFindVisible = !sourceFindVisible
  updateSourceFindVisibility()
  if (sourceFindVisible) sourceSearch.focus()
})
sourceReplaceToggle.addEventListener("click", () => {
  const expanded = sourceReplaceRow.hidden
  sourceReplaceRow.hidden = !expanded
  sourceReplaceToggle.setAttribute("aria-expanded", String(expanded))
  sourceReplaceToggle.title = sourceReplaceToggle.ariaLabel = expanded ? "收起替换" : "展开替换"
  if (expanded) sourceReplacement.focus()
})
sourceReplace.addEventListener("click", () => replaceSourceMatches(false))
sourceReplaceAll.addEventListener("click", () => replaceSourceMatches(true))
sourceReplacement.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return
  event.preventDefault()
  replaceSourceMatches(event.metaKey || event.ctrlKey)
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
function moveMixedCoordinate(field: HTMLInputElement, direction: number, coalesce = false): boolean {
  const delta = mixedCoordinateDelta(
    field.dataset.keyField ?? "",
    field.placeholder,
    field.disabled,
    direction,
  )
  if (!delta) return false
  moveSelectedKeys(delta[0], delta[1], selectedKeySections, coalesce)
  return true
}
quickInspector.addEventListener("wheel", (event) => {
  const field = event.target
  if (!(field instanceof HTMLInputElement) || !moveMixedCoordinate(field, -event.deltaY)) return
  event.preventDefault()
  event.stopPropagation()
}, { passive: false })
quickInspector.addEventListener("keydown", (event) => {
  const field = event.target
  if (!(field instanceof HTMLInputElement)) return
  const direction = event.key === "ArrowUp" ? 1 : event.key === "ArrowDown" ? -1 : 0
  if (moveMixedCoordinate(field, direction, event.repeat)) {
    event.preventDefault()
    return
  }
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
    if (mobilePortraitQuery.matches) setMobilePane("inspector")
    updateInspectorView()
    if (!quickInspector.hidden) populateKeyInspector()
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
  if (resourceInspectorMode === "image" && bdaSliceReturn) {
    const { path, styleID } = bdaSliceReturn
    bdaSliceReturn = undefined
    selectFile(path, "overview", "style")
    selectStyleResource(styleID)
    return
  }
  if (resourceInspectorMode === "style" && styleReturnPath) {
    const path = styleReturnPath
    const selection = [...styleReturnSelection]
    const candidate = styleReturnCandidate
    const scrollTop = styleReturnScrollTop
    const inspectorGroup = styleReturnInspectorGroup
    styleReturnPath = ""
    styleReturnCandidate = false
    selectFile(path, "overview")
    selectedKeySections = selection
    selectedCandidate = candidate
    preview.setSelected(selection)
    syncCandidateSelection()
    populateKeyInspector()
    if (inspectorGroup) setMobileInspectorGroup(inspectorGroup, false)
    quickInspector.scrollTop = scrollTop
    revealSourceFile(path)
    return
  }
  showResourceList()
})
resourceSearch.addEventListener("input", renderResourceInspector)
resourceCategory.addEventListener("change", () => {
  if (archive?.format !== "bda" || resourceInspectorMode !== "style" || !resourceConfigActive) {
    renderResourceInspector()
    return
  }
  const group = resourceCategory.value as BdaAppearanceStyleGroup
  if (!bdaAppearanceStyleGroups.some(([value]) => value === group)) return
  source.commit()
  selectedBdaStyleGroup = group
  renderFiles()
  selectFile(bdaAppearanceStylePath(group), "overview", "style")
})
bdaTileUsage.addEventListener("change", () => {
  selectedTileIndex = Number(bdaTileUsage.value)
  populateTileInspector()
  drawAtlas()
})
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
  const hit = archive?.format === "bda"
    ? slices.find((slice) => slice.index === selectedTileIndex)
    : tileSliceAt(slices, point)
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
  return `${theme.value}/skin/res`
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
  const themeLabel = theme.value === "dark" ? "深色" : "浅色"
  const orientationLabel = orientation.value === "land" ? "横屏" : "竖屏"
  layoutImageLayout.textContent = `当前布局：${layoutPath.split("/").pop() ?? "布局"}（${themeLabel} · ${orientationLabel}）`
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
  layoutImageObjectURL = URL.createObjectURL(new Blob([new Uint8Array(bytes).buffer], { type: "image/png" }))
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
  const alphaMode = archive.format === "bds" ? 1 : 2
  if (layoutImageTarget === "candidate") {
    const candPath = toolbarConfigPath()
    const cand = candPath && archive.isText(candPath) ? IniDocument.parse(archive.getText(candPath)) : undefined
    if (!candPath || !cand) {
      layoutImageError.textContent = "当前主题未找到候选栏配置文件。"
      layoutImageError.hidden = false
      return
    }
    const candidateRect = resolveCandidateRect(cand, gen)
    if (layoutImageWidth !== candidateRect.width || layoutImageHeight !== candidateRect.height) {
      layoutImageBytes = await fitPngTo(layoutImageBytes, candidateRect.width, candidateRect.height)
      layoutImageWidth = candidateRect.width
      layoutImageHeight = candidateRect.height
    }
    const base = nextResourceBase()
    const plan = planLayoutImage(layoutImageTarget, [], IniDocument.parse(""), candidateRect.width, candidateRect.height)
    const tilesBytes = layoutImageTileBytes(plan, alphaMode)
    const stylesDoc = IniDocument.parse(styles.toString())
    const candDoc = IniDocument.parse(cand.toString())
    applyCandidateImageStyles(stylesDoc, candDoc, plan, base.split("/").pop()!)
    const pngPath = `${base}.png`
    const tilPath = `${base}.til`
    const stylePath = styleConfigPath()
    commitBatch([
      { kind: "bytes", path: pngPath, before: archive.getBytes(pngPath) ?? new Uint8Array(0), after: layoutImageBytes },
      { kind: "bytes", path: tilPath, before: archive.getBytes(tilPath) ?? new Uint8Array(0), after: tilesBytes },
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
    let cells = detectGridCells(scan.mask, scan.width, scan.height)
    if (!cells.length) {
      layoutImageError.textContent = "无法在图片中识别按键区域，请检查图片是否包含透明间隔。"
      layoutImageError.hidden = false
      return
    }
    if (layoutImageConfig === "image-follows-layout" && cells.length === 1 && keys.length) {
      const maxWidth = Math.max(...keys.map(({ rect }) => rect[2]))
      const maxHeight = Math.max(...keys.map(({ rect }) => rect[3]))
      const scale = Math.min(1, maxWidth / scan.width, maxHeight / scan.height)
      if (scale < 1) {
        const width = Math.max(1, Math.round(scan.width * scale))
        const height = Math.max(1, Math.round(scan.height * scale))
        layoutImageBytes = await fitPngTo(layoutImageBytes, width, height)
        layoutImageWidth = width
        layoutImageHeight = height
        cells = cells.map(([x, y, cellWidth, cellHeight]) => [
          Math.round(x * scale),
          Math.round(y * scale),
          Math.max(1, Math.round(cellWidth * scale)),
          Math.max(1, Math.round(cellHeight * scale)),
        ])
      }
    }
    const matchedKeys = layoutImageConfig === "layout-follows-image"
      ? matchLayoutKeysToCells(layoutDoc, keys, cells)
      : keys
    plan = planLayoutImageSlices(layoutImageTarget, matchedKeys, cells, IniDocument.parse(""))
    sourceWidth = scan.width
    sourceHeight = scan.height
  }
  const base = nextResourceBase()
  const tilesBytes = layoutImageTileBytes(plan, alphaMode)
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
    { kind: "bytes", path: tilPath, before: archive.getBytes(tilPath) ?? new Uint8Array(0), after: tilesBytes },
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
panelCopySource.addEventListener("input", () => {
  panelTargetWidth.value = ""
  panelTargetHeight.value = ""
  updatePanelCopyForm()
})
panelCopyTarget.addEventListener("input", updatePanelCopyForm)
panelScaleEnabled.addEventListener("change", updatePanelCopyForm)
panelScaleForm.addEventListener("submit", (event) => {
  if ((event.submitter as HTMLButtonElement | null)?.value !== "copy") return
  event.preventDefault()
  panelScaleDialog.close()
  void runFileOperation("复制面板", copyPanel)
})
function syncCandidateSelection(): void {
  const selected = selectedCandidate && archive?.format === "bda" && selectedPath === layoutPath
    || archive?.format !== "bda" && isToolbarPath(selectedPath)
  candidateArea.classList.toggle("candidate-selected", selected)
  candidateArea.setAttribute("aria-selected", String(selected))
}

candidateArea.addEventListener("click", () => {
  if (!isEditing()) return
  if (archive?.format === "bda") {
    if (selectedPath !== layoutPath) selectFile(layoutPath, "overview")
    selectedCandidate = true
    selectedKeySections = []
    preview.setSelected([])
    syncCandidateSelection()
    populateKeyInspector()
    updateSourceHighlight()
    scrollSelectedSource()
    if (mobilePortraitQuery.matches) setMobilePane("inspector")
    return
  }
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
styleImageResourceClose.addEventListener("click", () => {
  if (pickerTarget) closeStyleImageResourcePicker()
  else clearImageSlicePicker()
})
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
    selectImageResource(event.payload.path)
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
      moveSelectedTile(direction[0] * distance, direction[1] * distance, event.repeat)
      return
    }
    if (!isEditing() || !selectedKeySections.length || isTextEditingTarget(event.target)) return
    event.preventDefault()
    const distance = event.shiftKey ? 10 : 1
    moveSelectedKeys(direction[0] * distance, direction[1] * distance, selectedKeySections, event.repeat)
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
  // 窗口获得焦点时重新同步材质状态，修复 Windows 10 亚克力材质导致的窗口移动卡顿问题
  void getCurrentWindow().onFocusChanged(({ payload: focused }) => {
    if (focused && windowMaterial.checked && !windowDragPointerDown && !windowDragMaterialDisabled) {
      void applyWindowMaterial()
    }
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
        if (payload.paths.length === 1 && isSupportedSkinPath(payload.paths[0])) {
          await runFileOperation("打开", () => loadDroppedPath(payload.paths[0]))
          return
        }
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
