import { Channel, invoke } from "@tauri-apps/api/core"
import { emitTo, listen } from "@tauri-apps/api/event"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { WebviewWindow } from "@tauri-apps/api/webviewWindow"
import { getCurrentWebview } from "@tauri-apps/api/webview"
import { message, open, save } from "@tauri-apps/plugin-dialog"
import { readFile, watch, writeFile } from "@tauri-apps/plugin-fs"
import "./tokens.css"
import "./components.css"
import "./style.css"
import "./device-preview.css"
import "./inspector.css"
import { initializeProjectChooser, projectChoice, type ProjectChoice } from "./project-chooser"
import {
  hydrateTemplateCardPreviews,
  MissingPreviewImageError,
  releaseArchivePreview,
  renderArchivePreview,
  renderBlobPreview,
} from "./template-preview"
import { initInspectorShell, setInspectorKind, syncInspectorRows } from "./inspector-shell.ts"
import { createIcon, groupIcon, hydrateIcons, symbolSpan } from "./icons"
import { sourceKeyLabels } from "./config-labels.ts"
import "./style-library.css"
import "./design-workbench.css"
import "./ai-design-panel.css"
import { createDraftReview, changedJsonSections } from "./ai-draft-review"
import "./project-chooser.css"
import { initializeSettings } from "./settings"
import { createAtlasWorkspace } from "./atlas-workspace"
import { resizeTileSlice } from "./tiles"
import type { AiChatController, AiChatRunHooks, AiChatRunResult } from "./ai-chat.ts"
import type { StyleLibraryPayload, StyleLibraryVisual } from "./picker-window.ts"
import { DEFAULT_BDA_PANEL_HEIGHT, DEFAULT_BDA_PANEL_WIDTH } from "./keyboard.ts"
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
  drawVisualPreview,
  retinaThumbnail,
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
  canvasBackgroundFromDevice,
  canvasBackgroundValues,
  canvasDeviceValue,
  effectiveDeviceValue,
  type CanvasBackground,
} from "./canvas-background.ts"
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
import { IniDocument, normalizeKeySections } from "./ini.ts"
import { adaptIos26KeyboardLayout, adaptIos26Variant } from "./ios26.ts"
import { findTextMatches, iniSectionAtOffset, iniSectionRanges, insertedTextRange, jsonPropertyAtOffset, jsonPropertyRanges, replaceTextMatches } from "./highlight.ts"
import type { Change } from "./history.ts"
import { createGestureHistory } from "./gesture-history"
import type { AiSkinImageFile } from "./ai-skin-images.ts"
import type { AiSkinDraftChange, AiSkinEditableFile } from "./ai-skin-workspace.ts"
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
import { groupModelConfigurations, initializeModelSettings, modelConfigurationKey, modelHost, type ModelConfiguration } from "./model-settings.ts"
import { modelProviderPreset } from "./model-providers.ts"
import { installNumberInputWheel, numberInputGesture, flushNumberInputWheel, deferNumberInputRefresh } from "./number-input-wheel.ts"
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
  previewSurfaceHeight,
  previewItems,
  previewStateImpact,
  type PreviewEvent,
} from "./preview.ts"
import { firstExistingPath, resourceImagePaths } from "./resources.ts"
import { retryAsync } from "./retry.ts"
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
import { LazySourceCodeEditor } from "./lazy-source-editor.ts"
import type { SourceEditorCursorMove, SourceEditorValueClick, SourceEditorValueRange } from "./lazy-source-editor.ts"
import { replacedSourceColor, replacedSourceStyle, sourceValueRanges } from "./source-value-ranges.ts"
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
import {
  resolveStylePropertyLayers,
  resolveStylePropertySources,
  type StylePropertySource,
} from "./style-properties.ts"
import {
  boundedTileRect,
  duplicateTileSlice,
  moveTileRect,
  nextTileIndex,
  removeTileSlice,
  tileSliceAt,
  tilePreviewInnerRect,
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
import { bindSlicePickerZoom, drawSlicePicker, MAX_SLICE_ZOOM, MIN_SLICE_ZOOM, pickableSlices, WHOLE_IMAGE_INDEX } from "./slice-picker-canvas.ts"
import { mobileCommandMenu, settingsDialog, $, sidebarViewControl, sidebarProjectName, documentName, aiDesignThinking, device, resourceSearch, editorCrosshair, previewCoordinates, canvasWrap, previewCanvas, toolbarCanvas, editorCoordinateSnap, previewCoordinateX, previewCoordinateY, deviceShell, toolbarStrip, candidateBackgroundCanvas, skinState, skinStateValue, eventLog, theme, orientation, simulatedOutput, mobileShareButton, deviceControlIcon, mobileUndoButton, undoButton, mobileRedoButton, redoButton, desktopUndoButton, desktopRedoButton, mode, modeChoiceButtons, themeChoiceButtons, orientationChoiceButtons, mobileChoiceButtons, mobileInspectorSelection, selectedKeyName, sourceHeading, quickInspector, mobileInspectorGroups, keyTypographyFieldsGroup, bdaConfigFieldsGroup, documentFieldsGroup, documentFields, bdaConfigFields, bdaSelectedStyleHeading, inspectorBackButton, bdaInspectorStateButtons, mobilePaneButtons, sidebarPane, inspectorPane, mobileSplitHandle, files, mainWorkspace, mobilePreviewPosition, panelScaleButton, replaceLayoutImageButton, adaptIos26Button, replaceAssetButton, keyFields, styleFields, toolbarFields, skinFields, gapFields, unsavedDialog, dirty, sourceName, layout, candidateComposition, candidateInput, candidateWords, candidateArea, hintPreviewEnabled, panelStatus, previewZoomOut, previewZoomIn, previewZoomFit, previewPanelViewport, skinStateControl, panelCopySource, panelSourceWidth, panelSourceHeight, panelTargetWidth, panelTargetHeight, panelScaleEnabled, panelScaleOptions, panelCopyTarget, panelScaleSummary, panelCopySourceOptions, panelCopyTargetOptions, panelScaleDialog, newButton, openButton, saveButton, fileOperationDialog, fileOperationProgress, fileOperationPercent, fileOperationDetail, fileOperationTitle, fileOperationResult, fileOperationClose, workspaceImage, assetImage, workspaceImageFigure, sourceEditor, asset, assetBackButton, atlasCanvas, tilePreviewWrap, tilePreview, tileInspector, bdaTileUsage, tileSourceFieldsGroup, tileInnerTitle, newTileButton, duplicateTileButton, deleteTileButton, moveTileButton, tileTitle, tileSourceFields, tileInnerFields, styleDetailImageButtons, resourceName, resourceMeta, imageResourceDetail, styleResourceDetail, styleDetailPreviews, styleDetailFields, styleDetailNormal, styleDetailHighlighted, resourceListView, resourceDetail, resourceInspector, tileModeButtons, resourceGallery, resourceCategory, resourceListTitle, resourceCount, resourceUploadButton, styleAddButton, resourceDownloadButton, resourceDeleteButton, resourceUploadInput, workspaceImageError, aiDesignPanel, sourceToolbar, sourceFindToggle, sourceSearch, sourceValueHintsEnabled, sourceCompletionEnabled, sourceLineExplanationEnabled, sourceSearchCount, sourceSearchPrevious, sourceSearchNext, sourceReplacement, sourceReplace, sourceReplaceAll, colorPickers, colorAlphas, sourceColorPicker, styleImageDialog, sourceStyleProxy, stylePickerDialog, stylePickerGrid, styleLibraryPreviewImage, styleLibraryApply, styleLibraryPreview, styleLibraryEdit, stylePickerSearch, stylePickerCount, stylePickerEmpty, stylePickerAdd, stylePickerClose, newStyleDialog, baiduActionCodes, primaryCssFields, skinFieldsGroup, toolbarFieldsGroup, keyboardFieldsGroup, keyOnlyGroups, selectedKeyPreview, selectedKeyContext, textStyleLabels, canvasMultiToolbar, canvasMultiCount, keyLayoutFieldsGroup, keyModeButtons, keyActionButtons, styleImageResourcePicker, styleImageResourceSearch, styleImageImgList, styleImageResourceCount, styleImageResourceEmpty, styleImageSource, styleImagePicker, styleImageResourceOpen, styleImageTitle, styleImageSubtitle, styleImagePickerCanvas, styleImagePickerMeta, sidebarViewButtons, sourceFileToolbar, sourceUploadButton, sourceDownloadButton, sourceCopyButton, sourcePasteButton, sourceMoveButton, sourceDeleteButton, sourceUploadInput, toggleGuides, mobileToggleGuides, aiDesignStatus, canvasBackground, newProjectForm, newProjectDialog, toolbarMenus, browserOpen, welcomeScroller, checkUpdateButton, updateStatus, downloadUpdate, aboutUpdate, aboutDiagnostics, exportLogsButton, exportLogsStatus, copyQqGroupButton, appDialogButtons, settingsStorageNav, settingsModelNav, settingsStorageSection, settingsModelSection, aiContextKey, aiContextPreview, aiDesignModel, aiDraftPanel, aiDesignChat, aiDraftFiles, aiDraftSummary, aiNewSession, aiDraftApply, aiDraftCancel, sourceDirectory, sourceDirectoryStatus, sourceDirectoryEnabled, chooseSourceDirectory, resetSourceDirectory, aiModelSettings, defaultDevice, editorCoordinateSnapSetting, appTheme, sourceFontSize, windowMaterialOpacity, windowMaterialOpacityValue, windowMaterial, windowMaterialOpacitySetting, sidebarViewVisible, inspectorTabsVisible, inspectorTabs, imageOpen, sourceReplaceToggle, sourceReplaceRow, resourceBackButton, ios26Dialog, ios26Form, layoutImageSize, layoutImagePreview, layoutImageFileLabel, layoutImageFile, layoutImageApply, layoutImageLayout, layoutImageScope, layoutImageError, layoutImageTargetInputs, layoutImageDialog, layoutImageOpen, layoutImageConfigButtons, layoutImageConfigDesc, layoutImageConfigFieldset, layoutImageForm, panelScaleForm, styleImageClose, styleImageResourceClose, inspectorResizeHandle, newStyleError, newStyleID, newStyleForm, clearSimulationButton } from "./app/dom"
import { type AiDraft, type LayoutImageConfig, type StyleImagePickerTarget, type SourceTransfer, type BdaTileUsage, type SourceFilePayload, type SourceChangePayload, type SoundEntry, type StyleKind, type NativeResourcePickerPayload, type SourceUpload, type SourceReadFilePayload, type ChosenFileData, type BrowserSaveFileHandle, type RecentFile, type RecentThumb, type AiDraftVariant, type WindowMaterialKind } from "./app/types"
import { appState } from "./app/state"

installClientLogging(document.querySelector<HTMLElement>("#about-update")?.dataset.currentVersion ?? "unknown")
installSafeAreaLock()

document.documentElement.classList.toggle("macos", isTauri() && navigator.userAgent.includes("Macintosh"))
document.documentElement.classList.toggle("windows", isTauri() && navigator.userAgent.includes("Windows"))
installNumberInputWheel(document, {
  isMixed: (field) => Boolean(mixedCoordinateDelta(field.dataset.keyField ?? "", field.placeholder, field.disabled, 1)),
  moveMixed: (field, steps) => {
    const delta = mixedCoordinateDelta(field.dataset.keyField ?? "", field.placeholder, field.disabled, steps)
    if (delta) moveSelectedKeys(delta[0] * Math.abs(steps), delta[1] * Math.abs(steps))
  },
})

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
    // 绝大多数祖先不可滚动，先用廉价判断跳过，避免每次点击对整条路径取计算样式。
    if (target.scrollHeight <= target.clientHeight && target.scrollWidth <= target.clientWidth) continue
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
const mobileCommandButtons = Array.from(
  mobileCommandMenu.querySelectorAll<HTMLButtonElement>("[data-mobile-command], [data-mobile-export-format]"),
)
const mobileShareMenuLabel = mobileCommandMenu.querySelector<HTMLElement>(
  '[data-mobile-command="mobile-share"] span:last-child',
)!
const settingsNavItems = Array.from(settingsDialog.querySelectorAll<HTMLButtonElement>("[data-settings-page]"))
const settingsPages = Array.from(settingsDialog.querySelectorAll<HTMLElement>("[data-settings-panel]"))
const mobilePortraitQuery = matchMedia("(max-width: 760px) and (orientation: portrait)")
const exportButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>("[data-export-format]"),
)
const source = new LazySourceCodeEditor($("#source"))
source.setValuePreviewRenderer(renderSourceValueThumbnail)
const sidebarViewHeading = sidebarViewControl.closest<HTMLElement>(".pane-heading")!
if (sidebarProjectName) {
  const syncSidebarProjectName = () => { sidebarProjectName.textContent = documentName?.textContent?.trim() || "未打开皮肤" }
  syncSidebarProjectName()
  new MutationObserver(syncSidebarProjectName).observe(documentName, { childList: true, characterData: true, subtree: true })
}
const LARGE_SKIN_BYTES = 5 * 1024 * 1024
const keyboardFields = Array.from(
  document.querySelectorAll<HTMLInputElement>("[data-keyboard-field]"),
)
const bdaKeyFieldLabels: Record<string, string> = {
  BACK_STYLE: "背景样式（backStyle）",
  FORE_STYLE: "前景样式（foreStyles）",
  FORE_OFFSET: "前景样式偏移（foreStyleOffsets）",
  FONT_NAME: "字体名称（fontName）",
  FONT_SIZE: "字体大小（fontSize）",
  NM_COLOR: "正常文字颜色（normalColor）",
  HL_COLOR: "高亮文字颜色（highlightColor）",
}
const layoutActionButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>("[data-layout-action]"),
)
const actionMeaningNodes = Array.from(
  document.querySelectorAll<HTMLElement>("[data-action-meaning]"),
)
const actionFieldNames = new Set(actionMeaningNodes.map((node) => node.dataset.actionMeaning ?? ""))
const inspectorTabButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>("[data-inspector-tab]"),
)
aiDesignThinking.value = localStorage.getItem("ai-thinking-level") || "off"
if (!aiDesignThinking.value) aiDesignThinking.value = "off"
aiDesignThinking.addEventListener("change", () => localStorage.setItem("ai-thinking-level", aiDesignThinking.value))
function currentDeviceValue(): string {
  return effectiveDeviceValue(device.value)
}
const resourceSearchControl = resourceSearch.closest("label")!
const LAST_SOURCE_WORKSPACE_KEY = "last-source-workspace"

function sourceDirectoryEnabledBySettings(): boolean {
  const stored = localStorage.getItem("source-directory-enabled")
  return isAndroidTauri() ? stored === "true" : stored !== "false"
}
const pendingSourcePaths = new Set<string>()
const sourceWriteSnapshots = new Map<string, SourceWriteSnapshot[]>()
const pendingSourceWatchPaths = new Set<string>()
const recordChange = createGestureHistory()

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
    appState.selectedCandidate = false
    syncCandidateSelection()
    if (appState.selectedPath !== appState.layoutPath) selectFile(appState.layoutPath, "overview")
    appState.selectedKeySections = sections
    if (!sections.length) source.collapseSelection()
    if (sections.length && mobilePortraitQuery.matches) setMobilePane("inspector")
    scheduleSelectionInspectorSync(preview)
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
  const overlayGeometry = { left: canvasWrap.scrollLeft, top: canvasWrap.scrollTop, width: wrapWidth, height: wrapHeight }
  const x = Math.min(bounds.width - 1, Math.max(0, event.clientX - bounds.left))
  const y = Math.min(bounds.height - 1, Math.max(0, event.clientY - bounds.top))
  const snapPreview = canvas === previewCanvas ? preview : canvas === toolbarCanvas ? toolbarPreview : undefined
  const logicalSize = snapPreview?.logicalSize() ?? { width: canvas.width, height: canvas.height }
  const raw = { x: x / bounds.width * logicalSize.width, y: y / bounds.height * logicalSize.height }
  const point = !appState.previewPanStart && editorCrosshair.checked && editorCoordinateSnap.checked && snapPreview
    ? snapPreview.snapPoint(raw, bounds)
    : raw
  const snappedX = Math.min(logicalSize.width - 1, Math.max(0, point.x))
  const snappedY = Math.min(logicalSize.height - 1, Math.max(0, point.y))
  const logicalX = Math.floor(snappedX)
  const logicalY = Math.floor(snappedY)
  if (previewCoordinateX.textContent !== String(logicalX)) previewCoordinateX.textContent = String(logicalX)
  if (previewCoordinateY.textContent !== String(logicalY)) previewCoordinateY.textContent = String(logicalY)
  if (!editorCrosshair.checked) {
    previewCoordinates.hidden = false
    return
  }
  // The lines always follow the pointer exactly, like the system cursor. Snapping
  // only changes the readout; a dashed guide marks the edge it snapped to.
  const crosshairX = event.clientX - wrapBounds.left
  const crosshairY = event.clientY - wrapBounds.top
  const outsideCanvas = event.clientX < bounds.left || event.clientX >= bounds.right || event.clientY < bounds.top || event.clientY >= bounds.bottom
  const snapX = String(!outsideCanvas && point.x !== raw.x)
  const snapY = String(!outsideCanvas && point.y !== raw.y)
  if (previewCoordinates.dataset.snapX !== snapX) previewCoordinates.dataset.snapX = snapX
  if (previewCoordinates.dataset.snapY !== snapY) previewCoordinates.dataset.snapY = snapY
  if (snapX === "true") previewCoordinates.style.setProperty("--snap-x", `${bounds.left - wrapBounds.left + snappedX / logicalSize.width * bounds.width}px`)
  if (snapY === "true") previewCoordinates.style.setProperty("--snap-y", `${bounds.top - wrapBounds.top + snappedY / logicalSize.height * bounds.height}px`)
  if (
    !appState.pointerOverlayGeometry ||
    appState.pointerOverlayGeometry.left !== overlayGeometry.left ||
    appState.pointerOverlayGeometry.top !== overlayGeometry.top ||
    appState.pointerOverlayGeometry.width !== overlayGeometry.width ||
    appState.pointerOverlayGeometry.height !== overlayGeometry.height
  ) {
    appState.pointerOverlayGeometry = overlayGeometry
    previewCoordinates.style.left = `${appState.pointerOverlayGeometry.left}px`
    previewCoordinates.style.top = `${appState.pointerOverlayGeometry.top}px`
    previewCoordinates.style.width = `${appState.pointerOverlayGeometry.width}px`
    previewCoordinates.style.height = `${appState.pointerOverlayGeometry.height}px`
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

function schedulePointerCoordinates(
  event: PointerEvent,
  target: HTMLElement,
  canvas: HTMLCanvasElement,
  geometry?: { target: DOMRect; wrap: DOMRect; wrapWidth: number; wrapHeight: number },
): void {
  appState.pendingPointerCoordinates = {
    event: { clientX: event.clientX, clientY: event.clientY, pointerType: event.pointerType },
    target,
    canvas,
    geometry,
  }
  schedulePreviewInteractionFrame()
}

function paintPreviewInteraction(): void {
  if (appState.pointerCoordinatesFrame) cancelAnimationFrame(appState.pointerCoordinatesFrame)
  appState.pointerCoordinatesFrame = 0
  const coordinates = appState.pendingPointerCoordinates
  const pan = appState.pendingPreviewPan
  appState.pendingPointerCoordinates = undefined
  appState.pendingPreviewPan = undefined
  // All geometry reads occur before changing the shell transform. The overlay and
  // artwork are painted from the same latest pointer snapshot, in a single frame.
  if (coordinates) updatePointerCoordinates(coordinates.event, coordinates.target, coordinates.canvas, coordinates.geometry)
  if (pan) setPreviewPan(pan.x, pan.y)
}

function schedulePreviewInteractionFrame(): void {
  if (!appState.pointerCoordinatesFrame) appState.pointerCoordinatesFrame = requestAnimationFrame(paintPreviewInteraction)
}

// Runs callback in its own task right after the next frame is painted.
function afterNextPaint(callback: () => void): void {
  requestAnimationFrame(() => window.setTimeout(callback))
}
function scheduleSelectionInspectorSync(canvasPreview: Preview): void {
  if (appState.selectionInspectorSyncPending) return
  appState.selectionInspectorSyncPending = true
  afterNextPaint(() => void canvasPreview.rendered().then(() => {
    appState.selectionInspectorSyncPending = false
    populateKeyInspector()
    updateSourceHighlight()
    scrollSelectedSource()
  }))
}

canvasWrap.addEventListener("pointermove", (event) => {
  if (appState.previewPanStart || deviceShell.hidden) return
  const onToolbar = toolbarStrip.contains(event.target as Node)
  schedulePointerCoordinates(event, onToolbar ? toolbarStrip : previewCanvas, onToolbar ? toolbarCanvas : previewCanvas)
})
document.addEventListener("pointermove", (event) => {
  if (appState.previewPanStart) return
  const target = event.target as Node
  if (
    event.pointerType === "mouse" &&
    !canvasWrap.contains(target) &&
    !toolbarStrip.contains(target)
  ) {
    appState.pendingPointerCoordinates = undefined
    if (editorCrosshair.checked) previewCoordinates.hidden = true
    else {
      previewCoordinateX.textContent = "—"
      previewCoordinateY.textContent = "—"
    }
  }
})

const toolbarPreview = new Preview(toolbarCanvas, handlePreviewEvent, (sections) => {
  const path = toolbarStrip.dataset.path
  if (!path) return
  if (appState.selectedPath !== path) selectFile(path, "overview")
  appState.selectedToolbarSections = sections
  toolbarPreview.setSelected(sections)
  syncCandidateSelection()
  scheduleSelectionInspectorSync(toolbarPreview)
}, true)
const candidateBackgroundPreview = new Preview(candidateBackgroundCanvas, () => {}, () => {})

function resizeKeyboardPreviews(): void {
  preview.resize()
  toolbarPreview.resize()
  candidateBackgroundPreview.resize()
}

function applySkinState(state?: number, message?: string): void {
  skinState.value = state === undefined ? "" : String(state)
  skinStateValue.textContent = state === undefined ? "默认" : `S${state}`
  preview.setSkinState(state)
  toolbarPreview.setSkinState(state)
  if (message) eventLog.textContent = message
}

function setSimulatedComposition(value: string): void {
  appState.simulatedComposition = value
  const current = skinState.value ? Number(skinState.value) : undefined
  const next = compositionSkinState(value, current)
  if (next !== current) applySkinState(next)
}

function skinStatePreviewMessage(state: number): string {
  const impact = previewStateImpact(appState.layoutDocument, state)
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
const keySoundBuffers = new Map<string, AudioBuffer>()

function releaseKeySound(): void {
  appState.keySoundAudio?.pause()
  appState.keySoundAudio = undefined
  try {
    appState.keySoundSource?.stop()
  } catch {}
  appState.keySoundSource = undefined
  appState.keySoundPath = ""
  if (appState.keySoundURL) URL.revokeObjectURL(appState.keySoundURL)
  appState.keySoundURL = ""
}

async function playDecodedSound(path: string, bytes: Uint8Array): Promise<void> {
  appState.keySoundContext ??= new AudioContext()
  if (appState.keySoundContext.state === "suspended") await appState.keySoundContext.resume()
  let buffer = keySoundBuffers.get(path)
  if (!buffer) {
    try {
      buffer = await appState.keySoundContext.decodeAudioData(new Uint8Array(bytes).buffer)
    } catch (error) {
      if (/^FORM$/.test(new TextDecoder("ascii").decode(bytes.subarray(0, 4)))) {
        const decoded = decodeAiffPcm(bytes)
        buffer = appState.keySoundContext.createBuffer(decoded.channelData.length, decoded.samplesDecoded, decoded.sampleRate)
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
        buffer = appState.keySoundContext.createBuffer(decoded.channelData.length, decoded.samplesDecoded, decoded.sampleRate)
        decoded.channelData.forEach((channel, index) => buffer!.copyToChannel(new Float32Array(channel), index))
      }
      if (!buffer) {
        throw error
      }
    }
    keySoundBuffers.set(path, buffer)
  }
  appState.keySoundSource = appState.keySoundContext.createBufferSource()
  appState.keySoundSource.buffer = buffer
  appState.keySoundSource.connect(appState.keySoundContext.destination)
  appState.keySoundSource.start()
}

function playSoundPath(path: string): void {
  const bytes = appState.archive?.getBytes(path)
  if (!bytes) return
  if (path !== appState.keySoundPath) {
    releaseKeySound()
    const copy = bytes.slice()
    appState.keySoundURL = URL.createObjectURL(new Blob([copy.buffer], { type: soundMimeType(path) }))
    appState.keySoundPath = path
    appState.keySoundAudio = new Audio(appState.keySoundURL)
    appState.keySoundAudio.preload = "auto"
  }
  if (!appState.keySoundAudio) return
  appState.keySoundAudio.currentTime = 0
  void appState.keySoundAudio.play().catch(async (error: unknown) => {
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
  if (!appState.archive || !appState.layoutDocument) return
  const names = appState.archive.names()
  if (appState.archive.format === "bda") {
    const path = bdaConfigPath(appState.archive, theme.value, orientation.value, "sound")
    const bytes = path ? appState.archive.getBytes(path) : undefined
    if (!bytes) return
    const sound = decodeBdaSoundConfig(bytes)
    const sounds = bdaPlatform(appState.archive) === "ios" ? sound.iosKeySounds : sound.keySounds
    const resource = sounds.get(bdaPanelKeyName(event.code))
      ?? sounds.get(event.section)
      ?? [...sounds.values()][0]
    return resource?.resourceID
      ? soundPathForFilename(names, theme.value, orientation.value, resource.resourceID)
      : undefined
  }
  const stylesPath = styleConfigPath()
  if (!appState.archive.isText(stylesPath)) return
  const generalPath = genConfigPath()
  const general = appState.archive.isText(generalPath) ? IniDocument.parse(appState.archive.getText(generalPath)) : undefined
  const filename = soundFilenameForKey(
    appState.layoutDocument,
    event.section,
    IniDocument.parse(appState.archive.getText(stylesPath)),
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
  const currentName = appState.layoutPath.split("/").pop() ?? ""
  const currentDirectory = appState.layoutPath.slice(0, appState.layoutPath.lastIndexOf("/") + 1)
  const availableNames = appState.archive
    ? appState.archive.format === "bda"
      ? bdaAvailableLayoutPaths().map((path) => path.slice(path.lastIndexOf("/") + 1))
      : appState.archive.names()
        .filter((path) => path.startsWith(currentDirectory) && path.slice(currentDirectory.length).includes("/") === false)
        .map((path) => path.slice(currentDirectory.length))
    : undefined
  const general = appState.archive && appState.archive.isText(genConfigPath())
    ? IniDocument.parse(appState.archive.getText(genConfigPath()))
    : undefined
  const symbolLayout = general?.get("MORE", "SYM_LAYOUT")?.trim()?.replace(/\.ini$/i, "") || "symbol"
  const transition = previewPageTransition(code, currentName, appState.previewReturnName, availableNames, symbolLayout)
  const target = transition.target
  if (target) {
    const path = currentConfigPath(target)
    if (appState.archive?.isText(path) || isBdaLayoutPath(path)) {
      appState.previewReturnName = transition.returnName
      if (code === "F15" || code === "F16") setSimulatedComposition("")
      if (skinState.value === "38") activateSkinState(undefined)
      selectFile(path, "overview")
      eventLog.textContent += ` → 已切换预览到 ${target}`
      return
    }
  }
  if (code === "F36") {
    if (appState.simulatedComposition) {
      setSimulatedComposition(Array.from(appState.simulatedComposition).slice(0, -1).join(""))
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
    if (appState.simulatedComposition) {
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
    setSimulatedComposition(appState.simulatedComposition + code.toLowerCase())
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
  if (!appState.archive || !appState.layoutDocument || !appState.selectedKeySections.length) return
  const before = appState.layoutDocument.toString()
  const occupied = new Set(appState.layoutDocument.sections())
  let number = Math.max(0, ...[...occupied].flatMap((section) => {
    const value = section.match(/^KEY(\d+)$/)?.[1]
    return value ? [Number(value)] : []
  })) + 1
  const copies: string[] = []
  const copyBySource = new Map<string, string>()
  for (const section of preview.expandSections(appState.selectedKeySections)) {
    while (occupied.has(`KEY${number}`)) number += 1
    const target = `KEY${number++}`
    const entries = appState.layoutDocument.entries(section).map(({ key, value }) => {
      if (key !== "VIEW_RECT") return { key, value }
      const rect = value.split(",").map(Number)
      if (rect.length === 4 && rect.every(Number.isFinite)) rect[0] += 18
      return { key, value: rect.join(",") }
    })
    appState.layoutDocument.appendSection(target, entries)
    occupied.add(target)
    copies.push(target)
    copyBySource.set(section, target)
  }
  const renamed = normalizeKeySections(appState.layoutDocument)
  const text = appState.layoutDocument.toString()
  commitText(appState.layoutPath, before, text)
  if (appState.selectedPath === appState.layoutPath) setSourceValue(text)
  appState.selectedKeySections = appState.selectedKeySections.flatMap((section) => {
    const copy = copyBySource.get(section)
    return copy ? [renamed.get(copy) ?? copy] : []
  })
  preview.setDocument(appState.layoutDocument)
  preview.setSelected(copies.map((copy) => renamed.get(copy) ?? copy))
  populateKeyInspector()
  updateSourceHighlight()
  updateDirty()
}

function deleteSelectedKeys(): void {
  if (!appState.archive || !appState.layoutDocument || !appState.selectedKeySections.length) return
  const before = appState.layoutDocument.toString()
  if (!appState.layoutDocument.removeSections(preview.expandSections(appState.selectedKeySections))) return
  normalizeKeySections(appState.layoutDocument)
  const text = appState.layoutDocument.toString()
  commitText(appState.layoutPath, before, text)
  if (appState.selectedPath === appState.layoutPath) setSourceValue(text)
  appState.selectedKeySections = []
  preview.setDocument(appState.layoutDocument)
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
mobileShareButton.querySelector("span:last-child")!.textContent = mobileShareLabel
mobileShareButton.title = mobileShareLabel
mobileShareButton.setAttribute("aria-label", mobileShareLabel)
mobileShareMenuLabel.textContent = mobileShareLabel

// 源文件树缩略图按 PNG 字节缓存：文件被改写时换成新的字节对象，旧缓存随之回收。
// 只保留 16px（按像素比放大）的小图，大图解码后立即释放。
const sourceThumbnails = new WeakMap<Uint8Array, Promise<string | undefined>>()
function sourceThumbnail(bytes: Uint8Array): Promise<string | undefined> {
  let thumbnail = sourceThumbnails.get(bytes)
  if (!thumbnail) {
    thumbnail = createImageBitmap(new Blob([bytes as BlobPart], { type: "image/png" })).then((bitmap) => {
      const scale = Math.min(1, 16 * (window.devicePixelRatio || 1) / Math.max(bitmap.width, bitmap.height))
      const canvas = document.createElement("canvas")
      canvas.width = Math.max(1, Math.round(bitmap.width * scale))
      canvas.height = Math.max(1, Math.round(bitmap.height * scale))
      const context = canvas.getContext("2d")
      if (context) context.imageSmoothingQuality = "high"
      context?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      bitmap.close()
      return canvas.toDataURL()
    }).catch(() => undefined) // 损坏的 PNG 保留图片图标
    sourceThumbnails.set(bytes, thumbnail)
  }
  return thumbnail
}

function syncDeviceControlIcon(): void {
  const name = currentDeviceValue() === "canvas" ? "square-dashed" : "smartphone"
  if (deviceControlIcon.dataset.icon === name && deviceControlIcon.childElementCount) return
  deviceControlIcon.dataset.icon = name
  deviceControlIcon.replaceChildren(createIcon(name, 16))
}

hydrateIcons()

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
    const target = mobileCommandTarget(button)
    button.disabled = target?.disabled ?? true
    button.hidden = target?.hidden ?? false
  }
  mobileUndoButton.disabled = undoButton.disabled
  mobileRedoButton.disabled = redoButton.disabled
  desktopUndoButton.disabled = undoButton.disabled
  desktopRedoButton.disabled = redoButton.disabled
}

for (const button of mobileCommandButtons) {
  button.addEventListener("click", () => {
    const target = mobileCommandTarget(button)
    if (!target || target.disabled) return
    mobileCommandMenu.open = false
    target.click()
  })
}
for (const target of [document.querySelector(".titlebar-actions"), document.querySelector(".app-more"), document.querySelector(".pen-file-menu")]) {
  if (!target) continue
  new MutationObserver(syncMobileCommands).observe(target, {
    subtree: true,
    attributes: true,
    attributeFilter: ["disabled", "hidden"],
  })
}
syncMobileCommands()

for (const [button, target] of [[mobileUndoButton, undoButton], [mobileRedoButton, redoButton]] as const) {
  button.addEventListener("click", () => {
    if (!target.disabled) target.click()
  })
}
for (const [button, target] of [[desktopUndoButton, undoButton], [desktopRedoButton, redoButton]] as const) {
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
  sourceHeading.dataset.mobileKeyTools = appState.selectedKeySections.length ? "on" : "off"
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
  const label = group.querySelector(":scope > h3")?.textContent?.trim() ?? "属性"
  if (label.includes("样式")) return "样式"
  if (label.includes("滑动")) return "手势"
  return label.split(/[、与（(]/)[0]
}

function mobileInspectorGroupKey(group: HTMLElement): string {
  return group.querySelector(":scope > h3 .document-section-code")?.textContent?.trim()
    || mobileInspectorGroupLabel(group)
}

function setMobileInspectorGroup(id: string, scroll = true): void {
  quickInspector.dataset.mobileInspectorGroup = id
  for (const button of Array.from(mobileInspectorGroups.querySelectorAll<HTMLButtonElement>("button"))) {
    const active = button.dataset.mobileInspectorGroup === id
    button.classList.toggle("active", active)
    button.setAttribute("aria-pressed", String(active))
  }
  const current = Array.from(quickInspector.querySelectorAll<HTMLElement>(".mobile-inspector-managed"))
    .find((group) => group.dataset.mobileInspectorGroup === id)
  appState.inspectorGroupKey = current ? mobileInspectorGroupKey(current) : ""
  // Each group owns its scrolling area. Scrolling the outer grid here moves the
  // summary card and category rail together, so switching tabs appears to make
  // the controls jump away from the pointer.
  if (scroll) {
    quickInspector.scrollTop = 0
    mobileInspectorGroups.querySelector<HTMLButtonElement>("button.active")?.scrollIntoView({ block: "nearest", inline: "nearest" })
    // 样式引用缩略图只在可见时才量得到卡片尺寸，切到该分组时补绘一次。
    redrawStyleStateCanvases()
    scrollToSinglePageInspectorGroup()
  }
}

/** 一页显示时把当前分区滚到检查器顶部；第一个分区保留顶部留白。 */
function scrollToSinglePageInspectorGroup(): void {
  const groups = Array.from(quickInspector.querySelectorAll<HTMLElement>(".mobile-inspector-managed"))
    .filter((group) => group.getClientRects().length > 0)
  const current = groups.find((group) => group.dataset.mobileInspectorGroup === quickInspector.dataset.mobileInspectorGroup)
  quickInspector.scrollTop = 0
  if (current && current !== groups[0]) quickInspector.scrollTop = current.getBoundingClientRect().top - quickInspector.getBoundingClientRect().top
}
/** 换了选中对象时停在记住的分区（与分组模式一致）；同一对象重绘时只按滚动位置刷新分类轨。 */
function revealSinglePageInspectorGroup(context: string): void {
  if (context === appState.singlePageInspectorContext) {
    syncSinglePageInspectorGroup()
    return
  }
  appState.singlePageInspectorContext = context
  scrollToSinglePageInspectorGroup()
}

/** 一页显示时按滚动位置点亮分类轨：最后一个顶边越过检查器顶部的分区即为当前分区。 */
function syncSinglePageInspectorGroup(): void {
  const groups = Array.from(quickInspector.querySelectorAll<HTMLElement>(".mobile-inspector-managed"))
    .filter((group) => group.getClientRects().length > 0)
  if (!groups.length) return
  const view = quickInspector.getBoundingClientRect()
  const current = groups.find((group) => group.dataset.mobileInspectorGroup === quickInspector.dataset.mobileInspectorGroup)
  const atEnd = quickInspector.scrollTop + quickInspector.clientHeight >= quickInspector.scrollHeight - 2
  // 滚到底时末尾几个短分区到不了顶部：保留刚点选且仍可见的分区，否则点亮最后一个。
  const currentTop = current?.getBoundingClientRect().top ?? -Infinity
  if (atEnd && currentTop >= view.top - 8 && currentTop < view.bottom) return
  const next = atEnd ? groups[groups.length - 1] : groups.filter((group) => group.getBoundingClientRect().top - view.top <= 8).pop() ?? groups[0]
  if (next !== current) setMobileInspectorGroup(next.dataset.mobileInspectorGroup ?? "", false)
}
quickInspector.addEventListener("scroll", syncSinglePageInspectorGroup, { passive: true })

function syncMobileInspectorGroups(): void {
  const combinedBda = appState.archive?.format === "bda" && appState.selectedKeySections.length > 0 && !appState.selectedCandidate
  if (combinedBda && keyTypographyFieldsGroup.parentElement !== bdaConfigFieldsGroup) bdaConfigFieldsGroup.append(keyTypographyFieldsGroup)
  else if (!combinedBda && keyTypographyFieldsGroup.parentElement !== quickInspector) quickInspector.insertBefore(keyTypographyFieldsGroup, quickInspector.querySelector(".key-gesture-fields"))
  let groups = Array.from(quickInspector.querySelectorAll<HTMLElement>(":scope > .inspector-group"))
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
  const managed = Array.from(quickInspector.querySelectorAll<HTMLElement>(".mobile-inspector-managed"))
  if (appState.archive?.format !== "bda" && groups.length === managed.length && groups.every((group, index) =>
    group === managed[index] && mobileInspectorGroupLabel(group) === mobileInspectorGroups.children[index]?.querySelector(".inspector-group-label")?.textContent,
  )) return
  for (const group of Array.from(quickInspector.querySelectorAll<HTMLElement>(".mobile-inspector-managed"))) {
    group.classList.remove("mobile-inspector-managed", "mobile-inspector-active")
    delete group.dataset.mobileInspectorGroup
  }
  const selectedBdaKey = appState.archive?.format === "bda" && appState.selectedKeySections.length > 0 && !appState.selectedCandidate
  bdaSelectedStyleHeading.hidden = !selectedBdaKey
  if (selectedBdaKey) {
    bdaConfigFieldsGroup.dataset.inspectorGroupLabel = "样式"
    groups = [bdaConfigFieldsGroup]
      .filter((group) => !group.hidden)
  } else {
    delete bdaConfigFieldsGroup.dataset.inspectorGroupLabel
  }
  for (const [index, group] of groups.entries()) {
    group.dataset.mobileInspectorGroup = `${index}`
    group.classList.add("mobile-inspector-managed")
  }
  // 两个分组可能落在同一个短标签上（例如静态候选栏组与 [CAND] 分区）：
  // 先算出一组唯一名称并写回分组，再按名称找回当前分组，避免选中同名的另一个。
  // 重名时加序号（「候选栏 2」），分区代码放进提示，窄分类轨上不会被截断。
  const railLabels = new Map<HTMLElement, string>()
  const railCodes = new Map<HTMLElement, string>()
  const usedRailLabels = new Map<string, number>()
  for (const group of groups) {
    let label = mobileInspectorGroupLabel(group)
    const code = group.querySelector(":scope > h3 .document-section-code")?.textContent?.trim() ?? ""
    const seen = usedRailLabels.get(label) ?? 0
    usedRailLabels.set(label, seen + 1)
    if (seen) {
      label = `${label} ${seen + 1}`
      group.dataset.inspectorGroupLabel = label
    }
    railLabels.set(group, label)
    if (code) railCodes.set(group, code)
  }
  const active = groups.find((group) => mobileInspectorGroupKey(group) === appState.inspectorGroupKey)
    ?? groups[0]
  // 分类轨只在检查器没有任何分组时隐藏。单分区文档（例如只有 [PANEL] 的 help.ini）
  // 此前也会被当成「没有可切换的分组」而整条收起，属性检查器于是少了一侧导航。
  mobileInspectorGroups.hidden = groups.length === 0
  // Keep the horizontal inspector navigation evenly distributed when the
  // available groups change (for example: 面板 / 提示栏 / 扩展区域).
  mobileInspectorGroups.style.setProperty("--inspector-group-count", String(Math.max(groups.length, 1)))
  mobileInspectorGroups.replaceChildren(...groups.map((group) => {
    const button = document.createElement("button")
    button.type = "button"
    const label = railLabels.get(group) ?? mobileInspectorGroupLabel(group)
    const text = document.createElement("span")
    text.className = "inspector-group-label"
    text.textContent = label
    button.append(groupIcon(label), text)
    button.title = railCodes.has(group) ? `${label}（${railCodes.get(group)}）` : label
    button.dataset.mobileInspectorGroup = group.dataset.mobileInspectorGroup
    button.addEventListener("click", () => setMobileInspectorGroup(group.dataset.mobileInspectorGroup ?? "0"))
    return button
  }))
  setMobileInspectorGroup(active?.dataset.mobileInspectorGroup ?? "", false)
  if (appState.archive && appState.selectedKeySections.length) {
    const addDestination = (label: string, action: () => void) => {
      const button = document.createElement("button")
      button.type = "button"
      button.title = label
      button.append(groupIcon(label), Object.assign(document.createElement("span"), { className: "inspector-group-label", textContent: label }))
      button.addEventListener("click", action)
      mobileInspectorGroups.append(button)
    }
    if (appState.archive.format === "bda") {
      addDestination("面板", () => inspectorBackButton.click())
      for (const [kind, label] of [["animation", "动画"], ["sound", "声音"]] as const) {
        const path = bdaConfigPath(appState.archive, theme.value, orientation.value, kind)
        if (path) addDestination(label, () => selectFile(path, "overview"))
      }
      mobileInspectorGroups.hidden = false
    }
  }
}

mobileInspectorGroups.addEventListener("keydown", (event) => {
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return
  const buttons = Array.from(mobileInspectorGroups.querySelectorAll<HTMLButtonElement>("button"))
  const current = buttons.indexOf(document.activeElement as HTMLButtonElement)
  if (current < 0) return
  event.preventDefault()
  const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1
    : (current + (["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : -1) + buttons.length) % buttons.length
  buttons[next].click()
  buttons[next].focus()
})

for (const button of bdaInspectorStateButtons) {
  button.addEventListener("click", () => {
    const state = button.dataset.bdaInspectorState === "pressed" ? "pressed" : "normal"
    bdaConfigFieldsGroup.dataset.previewState = state
    for (const item of bdaInspectorStateButtons) {
      const active = item === button
      item.classList.toggle("active", active)
      item.setAttribute("aria-pressed", String(active))
    }
  })
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
function setMobilePreviewCollapsed(collapsed: boolean): void {
  if (collapsed) {
    appState.mobileSplitBeforeCollapse = Number.parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue("--mobile-workspace-split"),
    ) || appState.mobileSplitBeforeCollapse
  }
  document.documentElement.dataset.mobilePreviewCollapsed = String(collapsed)
  mobileSplitHandle.setAttribute("aria-expanded", String(!collapsed))
  mobileSplitHandle.title = collapsed ? "点击展开预览" : "拖动调整画布与配置区域比例；点击收起或展开预览"
  mobileSplitHandle.setAttribute("aria-label", mobileSplitHandle.title)
  if (!collapsed) setMobileSplit(appState.mobileSplitBeforeCollapse)
}

setMobilePane("layout")
syncMobileInspectorHeader()
for (const button of mobilePaneButtons) {
  button.addEventListener("click", () => setMobilePane(button.dataset.mobilePane === "inspector" ? "inspector" : "layout"))
}
mobilePortraitQuery.addEventListener("change", () => {
  if (!mobilePortraitQuery.matches) setMobilePreviewCollapsed(false)
  else {
    const activeGroup = files.querySelector<HTMLDetailsElement>(".nav-group.mobile-overview-active")
    if (activeGroup) activeGroup.open = true
  }
  setMobilePane(document.documentElement.dataset.mobilePane === "inspector" ? "inspector" : "layout")
  syncMobileInspectorHeader()
  updateSourceFindVisibility()
})
mainWorkspace.addEventListener("pointerdown", (event) => {
  if (!mobilePortraitQuery.matches || event.pointerType === "mouse" && event.button !== 0 ||
    !(event.target as Element).closest("aside, .source")) return
  appState.mobileSwipeStart = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }
})
mainWorkspace.addEventListener("pointermove", (event) => {
  if (!appState.mobileSwipeStart || appState.mobileSwipeStart.pointerId !== event.pointerId) return
  const deltaX = event.clientX - appState.mobileSwipeStart.x
  const deltaY = event.clientY - appState.mobileSwipeStart.y
  if (Math.abs(deltaY) > 12 && Math.abs(deltaY) > Math.abs(deltaX)) {
    appState.mobileSwipeStart = undefined
    return
  }
  if (Math.abs(deltaX) < 56 || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) return
  appState.mobileSwipeStart = undefined
  setMobilePane(deltaX < 0 ? "inspector" : "layout")
})
mainWorkspace.addEventListener("pointerup", (event) => {
  if (!appState.mobileSwipeStart || appState.mobileSwipeStart.pointerId !== event.pointerId) return
  const deltaX = event.clientX - appState.mobileSwipeStart.x
  const deltaY = event.clientY - appState.mobileSwipeStart.y
  appState.mobileSwipeStart = undefined
  if (Math.abs(deltaX) < 56 || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) return
  setMobilePane(deltaX < 0 ? "inspector" : "layout")
})
mainWorkspace.addEventListener("pointercancel", (event) => {
  if (appState.mobileSwipeStart?.pointerId === event.pointerId) appState.mobileSwipeStart = undefined
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
  panelScaleButton.disabled = !editing || appState.fileOperationRunning || !appState.archive
  replaceLayoutImageButton.disabled = !editing || appState.fileOperationRunning || !appState.archive || appState.archive.format === "bda"
  adaptIos26Button.disabled = !editing || appState.fileOperationRunning || !appState.archive || appState.archive.format === "bda"
}

function applyModeState(): void {
  const editing = isEditing()
  if (!editing && editorCrosshair.checked) previewCoordinates.hidden = true
  deviceShell.dataset.mode = editing ? "edit" : "preview"
  preview.setMode(editing ? "edit" : "preview")
  toolbarPreview.setMode(editing ? "edit" : "preview")
  preview.setEditTool(appState.keyMode)
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
  syncAiDesignContext()
  select.dispatchEvent(new Event("change"))
}

function sourcePathForWorkspace(path: string): string {
  return appState.sourceWorkspacePrefix && path.startsWith(appState.sourceWorkspacePrefix)
    ? path.slice(appState.sourceWorkspacePrefix.length)
    : path
}

function sourcePathForArchive(path: string): string {
  return resolveSourceArchivePath(
    path,
    appState.sourceWorkspacePrefix,
    appState.archive?.sourceFiles().map((file) => file.path) ?? [],
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
  if (appState.sourceWriteSnapshotTimer !== undefined) clearTimeout(appState.sourceWriteSnapshotTimer)
  appState.sourceWriteSnapshotTimer = window.setTimeout(() => {
    sourceWriteSnapshots.clear()
    appState.sourceWriteSnapshotTimer = undefined
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
  if (appState.aiDraftPreview) discardAiDesignDraft("保存源码前已丢弃未应用的 AI 草稿。")
  if (appState.sourceAutosaveTimer !== undefined) {
    clearTimeout(appState.sourceAutosaveTimer)
    appState.sourceAutosaveTimer = undefined
  }
  if (appState.archive && appState.sourceWorkspacePath && pendingSourcePaths.size) {
    const workspace = appState.sourceWorkspacePath
    const value = appState.archive
    appState.sourceAutosaveQueue = appState.sourceAutosaveQueue.catch(() => {}).then(() =>
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
  await appState.sourceAutosaveQueue
}

function scheduleSourceAutosave(paths: string[]): void {
  if (!appState.archive || (!appState.sourceWorkspacePath && appState.sourceWorkspacePendingArchive !== appState.archive)) return
  for (const path of paths) pendingSourcePaths.add(sourcePathForWorkspace(appState.archive.sourcePath(path)))
  if (!appState.sourceWorkspacePath || appState.sourceAutosaveTimer !== undefined) return
  appState.sourceAutosaveTimer = window.setTimeout(() => {
    // Never write a previewed draft to disk; retry once the draft is resolved.
    if (appState.aiDraftPreview) {
      appState.sourceAutosaveTimer = undefined
      return scheduleSourceAutosave([])
    }
    void flushSourceAutosave().catch((error) => showError(error, "自动保存源码"))
  }, 3 * 60_000)
}

async function refreshExternalSourceFiles(workspace: string, paths: string[]): Promise<void> {
  if (!appState.archive || workspace !== appState.sourceWorkspacePath || !paths.length) return
  const changes = await invoke<SourceChangePayload[]>("read_source_changes", {
    path: workspace,
    changedPaths: paths,
  })
  if (!appState.archive || workspace !== appState.sourceWorkspacePath) return
  let changed = false
  const affected = new Set<string>()
  const ignoredChanges = new Set(changes.filter((change) => {
    const data = change.data ? new Uint8Array(change.data) : null
    return consumeSourceWriteSnapshot(sourceWriteSnapshots, sourceWriteKey(change.path), data)
  }))
  if (appState.aiDraftPreview && changes.some((change) => !ignoredChanges.has(change))) {
    discardAiDesignDraft("源码文件在外部被修改，AI 草稿已丢弃。")
  }
  const directorySnapshots = changes.filter((change) => change.directory && !ignoredChanges.has(change))
  const presentPaths = new Set(changes.filter((change) => !change.directory && change.data).map((change) => sourcePathForArchive(change.path)))
  for (const snapshot of directorySnapshots) {
    const archiveSnapshotPath = sourcePathForArchive(snapshot.path).replace(/\/$/, "")
    const prefix = archiveSnapshotPath ? `${archiveSnapshotPath}/` : ""
    const removed = appState.archive.sourceFiles()
      .filter((file) => (file.path === archiveSnapshotPath || file.path.startsWith(prefix)) && !presentPaths.has(file.path))
      .map((file) => appState.archive!.canonicalSourcePath(file.path))
    for (const canonical of removed) {
      appState.archive.delete(canonical)
      affected.add(canonical)
      changed = true
    }
  }
  for (const change of changes) {
    if (change.directory || ignoredChanges.has(change)) continue
    pendingSourcePaths.delete(change.path)
    const data = change.data ? new Uint8Array(change.data) : null
    if (change.data) {
      const canonical = appState.archive.canonicalSourcePath(sourcePathForArchive(change.path))
      const before = appState.archive.getBytes(canonical)
      const after = before && appState.archive.isBdaConfig(canonical)
        ? applyDecodedBdaSource(canonical, before, new TextDecoder().decode(data!))
        : data!
      if (before && before.length === after.length && before.every((byte, index) => byte === after[index])) continue
      appState.archive.setBytes(canonical, after)
      affected.add(canonical)
      changed = true
      continue
    }
    const removed = appState.archive.sourceFiles()
      .filter((file) => {
        const archivePath = sourcePathForArchive(change.path)
        return file.path === archivePath || file.path.startsWith(`${archivePath}/`)
      })
      .map((file) => appState.archive!.canonicalSourcePath(file.path))
    for (const canonical of removed) {
      appState.archive.delete(canonical)
      affected.add(canonical)
      changed = true
    }
  }
  if (!changed) return
  appState.undoStack = []
  appState.redoStack = []
  updateHistoryButtons()
  renderFiles()
  try {
    if (affected.has(appState.layoutPath) && appState.archive.isText(appState.layoutPath)) {
      appState.layoutDocument = IniDocument.parse(appState.archive.getText(appState.layoutPath))
    }
    if (appState.selectedPath && (appState.archive.getBytes(appState.selectedPath) || isBdaAppearancePartPath(appState.selectedPath))) {
      selectFile(appState.selectedPath, appState.sidebarView, "document", true)
    }
    else {
      const next = appState.archive.names().find((path) => appState.archive?.isText(path))
      if (next) selectFile(next, appState.sidebarView)
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
  if (workspace !== appState.sourceWorkspacePath) return
  for (const path of paths) pendingSourceWatchPaths.add(path)
  if (appState.sourceWatchTimer !== undefined) clearTimeout(appState.sourceWatchTimer)
  appState.sourceWatchTimer = window.setTimeout(() => {
    appState.sourceWatchTimer = undefined
    const changed = [...pendingSourceWatchPaths]
    pendingSourceWatchPaths.clear()
    void refreshExternalSourceFiles(workspace, changed).catch((error) => showError(error, "刷新外部源码"))
  }, 80)
}

async function activateSourceWorkspace(path: string, prefix = ""): Promise<void> {
  appState.stopSourceWatch?.()
  appState.stopSourceWatch = undefined
  if (isAndroidTauri()) await invoke("stop_source_observer").catch(() => {})
  pendingSourcePaths.clear()
  sourceWriteSnapshots.clear()
  if (appState.sourceWriteSnapshotTimer !== undefined) clearTimeout(appState.sourceWriteSnapshotTimer)
  appState.sourceWriteSnapshotTimer = undefined
  pendingSourceWatchPaths.clear()
  appState.sourceWorkspacePath = path
  appState.sourceWorkspacePrefix = prefix
  if (!isTauri() || !path) return
  if (isAndroidTauri() && path.startsWith("content://")) {
    const handler = new Channel<string>()
    handler.onmessage = (changedPath) => queueSourceWatch([changedPath || path], path)
    await invoke("start_source_observer", { path, handler })
    appState.stopSourceWatch = () => { void invoke("stop_source_observer") }
    if (localStorage.getItem("source-directory-enabled") === "true") {
      localStorage.setItem(LAST_SOURCE_WORKSPACE_KEY, path)
    }
    return
  }
  appState.stopSourceWatch = await watch(path, (event) => {
    if (typeof event.type === "object" && "access" in event.type) return
    queueSourceWatch(event.paths, path)
  }, { recursive: true, delayMs: 120 })
}

function hasUnsavedChanges(): boolean {
  return appState.unsavedNew || Boolean(appState.archive?.changed.size)
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
  flushNumberInputWheel()
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
  dirty.hidden = !appState.unsavedNew && !appState.archive?.changed.size
}

function updateHistoryButtons(): void {
  undoButton.disabled = appState.undoStack.length === 0
  redoButton.disabled = appState.redoStack.length === 0
}

function commitText(path: string, before: string, after: string, coalesce = false): void {
  if (!appState.archive || before === after) return
  acceptAiDraftPreview()
  appState.sourceHistoryHighlight = undefined
  appState.archive.setText(path, after)
  recordChange(appState.undoStack, { kind: "text", path, before, after }, numberInputGesture(), coalesce)
  appState.redoStack = []
  scheduleSourceAutosave([path])
  updateHistoryButtons()
}

function commitBytes(path: string, before: Uint8Array | undefined, after: Uint8Array): void {
  if (!appState.archive || before && before.length === after.length && before.every((byte, index) => byte === after[index])) return
  acceptAiDraftPreview()
  appState.archive.setBytes(path, after)
  recordChange(appState.undoStack, { kind: "bytes", path, before, after }, numberInputGesture())
  appState.redoStack = []
  scheduleSourceAutosave([path])
  updateHistoryButtons()
}

function commitBatch(changes: Change[]): void {
  if (!appState.archive || !changes.length) return
  acceptAiDraftPreview()
  for (const change of changes) {
    if (change.kind === "text") appState.archive.setText(change.path, change.after)
    else if (change.kind === "bytes") {
      if (change.after) appState.archive.setBytes(change.path, change.after)
      else appState.archive.delete(change.path)
    }
  }
  recordChange(appState.undoStack, { kind: "batch", changes }, numberInputGesture())
  appState.redoStack = []
  scheduleSourceAutosave(changes.flatMap((change) => change.kind === "batch" ? [] : [change.path]))
  updateHistoryButtons()
}

function applyTextSnapshot(path: string, text: string): void {
  if (!appState.archive) return
  if (path === appState.selectedPath) appState.sourceHistoryHighlight = insertedTextRange(appState.archive.getText(path), text)
  appState.archive.setText(path, text)
  scheduleSourceAutosave([path])
  if (path === appState.layoutPath) appState.layoutDocument = IniDocument.parse(text)
  if (path === appState.selectedPath) {
    appState.selectedDocument = IniDocument.parse(text)
    setSourceValue(text)
  }
  if (appState.resourceConfigActive && path === appState.tilePath) {
    appState.tileDocument = IniDocument.parse(text)
    appState.slices = tileSlices(appState.tileDocument)
    setSourceValue(text)
    sourceName.textContent = appState.tilePath
    if (!appState.slices.some((slice) => slice.index === appState.selectedTileIndex)) appState.selectedTileIndex = undefined
    updateSourceHighlight()
    populateTileInspector()
    drawAtlas()
  }
  refreshPreview()
  populateKeyInspector()
  updateDirty()
}

function refreshHistorySelection(): void {
  const path = appState.selectedResourcePath
  const index = appState.selectedTileIndex
  const resourceMode = appState.resourceConfigActive ? appState.resourceInspectorMode : "document"
  renderFiles()
  if (appState.selectedPath && (appState.archive?.getBytes(appState.selectedPath) || isBdaAppearancePartPath(appState.selectedPath))) {
    selectFile(appState.selectedPath, appState.sidebarView, resourceMode)
    if (resourceMode === "image" && appState.archive?.isImage(path)) {
      selectResourceImage(path)
      appState.selectedTileIndex = appState.slices.some(slice => slice.index === index) ? index : undefined
      populateTileInspector()
      drawAtlas()
    }
  }
  updateHistoryButtons()
}

function undo(): void {
  flushNumberInputWheel()
  if (appState.aiDraftPreview) return discardAiDesignDraft("已撤销 AI 草稿预览 · 未修改皮肤。")
  const change = appState.undoStack.pop()
  if (!change) return
  appState.sourceHistoryHighlight = undefined
  appState.redoStack.push(change)
  applyChangeSnapshot(change, "before")
  refreshHistorySelection()
}

function redo(): void {
  flushNumberInputWheel()
  if (appState.aiDraftPreview) discardAiDesignDraft("AI 草稿预览已丢弃。")
  const change = appState.redoStack.pop()
  if (!change) return
  appState.sourceHistoryHighlight = undefined
  appState.undoStack.push(change)
  applyChangeSnapshot(change, "after")
  refreshHistorySelection()
}

function applyChangeSnapshot(change: Change, side: "before" | "after"): void {
  if (change.kind === "batch") {
    const changes = side === "before" ? [...change.changes].reverse() : change.changes
    for (const child of changes) applyChangeSnapshot(child, side)
  } else if (change.kind === "text") applyTextSnapshot(change.path, change[side])
  else applyBytesSnapshot(change.path, change[side])
}

function applyBytesSnapshot(path: string, bytes?: Uint8Array): void {
  if (!appState.archive) return
  if (bytes) appState.archive.setBytes(path, bytes)
  else appState.archive.delete(path)
  scheduleSourceAutosave([path])
  refreshBdaLayout()
  if (appState.selectedPath === path && bytes && appState.archive.isBdaConfig(path)) setSourceValue(decodedBdaEditorSource(path, bytes))
  if (appState.resourceConfigActive && appState.archive.format === "bda" && appState.selectedResourcePath) {
    loadTiles(appState.selectedResourcePath)
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
  const match = appState.layoutPath.match(/^(light|dark)\/skin\/(port|land)\//)
  return {
    theme: (match?.[1] as "light" | "dark") ?? theme.value as "light" | "dark",
    orientation: (match?.[2] as "port" | "land") ?? orientation.value,
  }
}

function preferredVariantExists(path: string): boolean {
  return appState.archive?.format === "bda"
    ? bdaAvailableLayoutPaths().includes(path)
    : Boolean(appState.archive?.names().includes(path))
}

function createMissingVariant(path: string): boolean {
  if (!appState.archive || preferredVariantExists(path)) return true
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
  const copies = variantCopyPaths(appState.archive.names(), sourceTheme, sourceOrientation, targetTheme, targetOrientation)
  if (!copies.some(({ target }) => target === path)) {
    theme.value = sourceTheme
    orientation.value = sourceOrientation
    syncSegmentedControls()
    showError(new Error("当前配置没有可复制的对应布局"), `创建${label}`)
    return false
  }
  for (const { source, target } of copies) appState.archive.setBytes(target, appState.archive.getBytes(source)!.slice())
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
  if (!appState.archive || appState.archive.format !== "bda") return
  const path = bdaAppearancePath(appState.archive, theme.value, orientation.value)
  const bytes = path && appState.archive.getBytes(path)
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
  if (!appState.archive || appState.archive.format !== "bda") return
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
  if (deferNumberInputRefresh(refreshSelectedBdaSource, refreshSelectedBdaSource)) return
  if (!appState.archive || appState.archive.format !== "bda") return
  const part = bdaAppearancePart(appState.selectedPath)
  if (part) {
    const info = currentBdaAppearance()
    if (info) setSourceValue(decodedBdaAppearancePart(info.bytes, part))
    return
  }
  if (appState.archive.isBdaConfig(appState.selectedPath)) {
    const bytes = appState.archive.getBytes(appState.selectedPath)
    if (bytes) setSourceValue(decodedBdaEditorSource(appState.selectedPath, bytes))
    return
  }
  if (!isBdaVirtualTextPath(appState.selectedPath)) return
  const info = currentBdaAppearance()
  if (info) setSourceValue(decodedBdaSource(info.path, info.bytes, appState.selectedPath.split("/").pop()))
}

function commitBdaSourceEdit(): void {
  if (!isEditing() || !appState.archive) return
  const part = bdaAppearancePart(appState.selectedPath)
  if (part) {
    const info = currentBdaAppearance()
    if (!info) return
    try {
      const after = applyDecodedBdaAppearancePart(info.path, info.bytes, source.value, part)
      commitBytes(info.path, info.bytes, after)
      refreshBdaLayout(appState.layoutPath)
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
  if (!appState.archive.isBdaConfig(appState.selectedPath) || !bdaDecodedSourceEditable(appState.selectedPath)) return
  const before = appState.archive.getBytes(appState.selectedPath)
  if (!before) return
  try {
    const after = applyDecodedBdaSource(appState.selectedPath, before, source.value)
    commitBytes(appState.selectedPath, before, after)
    if (/appearanceConfig$/i.test(appState.selectedPath)) refreshBdaLayout(appState.layoutPath)
    setSourceValue(decodedBdaEditorSource(appState.selectedPath, after))
    refreshPreview()
    populateKeyInspector()
    updateDirty()
  } catch (error) {
    setSourceValue(decodedBdaEditorSource(appState.selectedPath, before))
    showError(error, "编辑 BDA JSON")
  }
}

function bdaAvailableLayoutPaths(): string[] {
  if (!appState.archive || appState.archive.format !== "bda") return []
  const path = bdaAppearancePath(appState.archive, theme.value, orientation.value)
  const appearanceBytes = path && appState.archive.getBytes(path)
  if (!appearanceBytes) return []
  const prefix = `${theme.value}/skin/${orientation.value}/`
  return bdaLayoutNames(appearanceBytes)
    .map((name) => `${prefix}${name.replace(/\.ini$/i, "")}.ini`)
    .filter((name) => appState.bdaBase?.isText(bdaBasePath(name)))
}

function isBdaVirtualTextPath(path: string): boolean {
  return Boolean(appState.archive?.format === "bda" && appState.bdaBase?.isText(bdaBasePath(path)))
}

function isBdaLayoutPath(path: string): boolean {
  return isBdaVirtualTextPath(path) && /\.ini$/i.test(path)
}

function textDocument(path: string): IniDocument | undefined {
  if (appState.archive?.isText(path)) return IniDocument.parse(appState.archive.getText(path))
  if (isBdaVirtualTextPath(path)) {
    let base = IniDocument.parse(appState.bdaBase!.getText(bdaBasePath(path)))
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
  if (!info || !appState.bdaBase?.isText(basePath)) return false
  appState.layoutPath = path
  let base = IniDocument.parse(appState.bdaBase.getText(basePath))
  const width = Number(base.get("PANEL", "SIZE")?.split(",")[0])
  if (info.appearance.designWidth && width) {
    base = scaleIniDocument(base, info.appearance.designWidth / width, info.appearance.designWidth / width)
  }
  appState.layoutDocument = bdaLayoutDocument(
    base,
    info.appearance,
    path.split("/").pop() ?? layout.value,
  )
  return true
}

function visualResolver(): VisualResolver | undefined {
  if (!appState.archive) return
  const appearancePath = appState.archive.format === "bda" ? bdaAppearancePath(appState.archive, theme.value, orientation.value) : undefined
  const appearanceBytes = appearancePath ? appState.archive.getBytes(appearancePath) : undefined
  // 新建解析器会重新解析样式、重新解码全部 PNG；归档内容（revision）与主题方向不变时复用，保留位图缓存。
  const key = [appState.archive, appState.archive.revision, appState.bdaBase, appState.bdaBase?.revision, appearanceBytes, theme.value, orientation.value]
  if (appState.cachedVisualResolver?.key.every((value, index) => value === key[index])) return appState.cachedVisualResolver.resolver
  const resolver = appearanceBytes
    ? new BdaResolver(appState.archive, appearanceBytes, appState.bdaBase, theme.value, orientation.value)
    : new AtlasResolver(appState.archive, theme.value, orientation.value)
  appState.cachedVisualResolver = { key, resolver }
  return resolver
}

function simulationLanguage(): "zh" | "en" {
  return /^en_/i.test(appState.layoutPath.split("/").pop() ?? "") ? "en" : "zh"
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
  if (appState.lastSimulationLanguage !== undefined && appState.lastSimulationLanguage !== language) {
    setSimulatedComposition("")
  }
  appState.lastSimulationLanguage = language
  const candidateSource = language === "en" ? simulatedOutput.value : appState.simulatedComposition
  const candidateCaret = language === "en"
    ? simulatedOutput.selectionStart ?? simulatedOutput.value.length
    : appState.simulatedComposition.length
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
    applyCandidateTextVisual(firstCandidate, appState.firstCandidateTextVisual, appState.candidateTextWidth)
  }
  return state.composing
}

function refreshSimulationState(): boolean {
  const composing = renderCandidateState()
  const symbolPanel = isConfiguredSymbolLayout(appState.layoutPath, textDocument(genConfigPath()))
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
  const spec = deviceSpec(currentDeviceValue())
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
  if (!appState.archive) return
  const currentArchive = appState.archive
  const composing = refreshSimulationState()
  const resolver = visualResolver()
  const context = keyboardContext()
  const toolbarSize = resolver ? refreshToolbarPreview(composing, resolver) : undefined
  preview.setResolver(resolver)
  const animationPath = appState.archive.format === "bda"
    ? bdaConfigPath(appState.archive, theme.value, orientation.value, "animation")
    : undefined
  const animationBytes = animationPath && appState.archive.getBytes(animationPath)
  preview.setAnimation(animationBytes ? decodeBdaAnimation(animationBytes) : undefined)
  const legacyAnimationPath = legacyAnimationConfigPath()
  const legacyAnimation =
    appState.archive.format !== "bda" && appState.archive.isText(styleConfigPath()) && legacyAnimationPath
      ? parseLegacyAnimation(
          IniDocument.parse(appState.archive.getText(styleConfigPath())),
          IniDocument.parse(appState.archive.getText(legacyAnimationPath)),
        )
      : undefined
  preview.setLegacyAnimation(legacyAnimation)
  toolbarPreview.setLegacyAnimation(legacyAnimation)
  const hintBase = `${theme.value}/skin/${orientation.value}/`
  const hintPath = (name: string) => `${hintBase}${name}`
  const bdaInfo = currentBdaAppearance()
  const bdaHintPanel = bdaInfo?.appearance.panels.get(layout.value.replace(/\.ini$/i, ""))
  const hasBdaHints = Boolean(bdaHintPanel?.hints.size)
  const hintSource = currentArchive.format === "bda" ? appState.bdaBase : currentArchive
  const hintDocument = (name: string) => {
    if (currentArchive.format === "bda" && !hasBdaHints) return
    const path = currentArchive.format === "bda" ? bdaBasePath(hintPath(name)) : hintPath(name)
    if (!hintSource?.isText(path)) return
    const document = IniDocument.parse(hintSource.getText(path))
    return bdaInfo ? bdaLayoutDocument(document, bdaInfo.appearance, layout.value) : document
  }
  // 每个面板用 [HINT] LAYOUT_NAME 指定一个 pop（未写时取 gen.ini），pop 内同时含普通气泡与长按 [BAR]。
  const hintName = (appState.layoutDocument?.get("HINT", "LAYOUT_NAME") ?? context?.gen?.get("HINT", "LAYOUT_NAME"))?.trim()
  const namedHint = hintName ? hintDocument(`${hintName.replace(/\.pop$/i, "")}.pop`) : undefined
  const shortHint = namedHint ?? hintDocument("hint1.pop") ?? hintDocument("hint.pop")
  const longHint = namedHint ?? hintDocument("hint2.pop") ?? shortHint
  preview.setLegacyHints(
    hintPreviewEnabled.checked ? parseLegacyHint(shortHint) : undefined,
    hintPreviewEnabled.checked ? parseLegacyHint(longHint) : undefined,
    hintPreviewEnabled.checked && currentArchive.format === "bda" && hasBdaHints,
  )
  const bdaGenPath = bdaBasePath(genConfigPath())
  const bdaGen = appState.archive.format === "bda" && appState.bdaBase?.isText(bdaGenPath)
    ? IniDocument.parse(appState.bdaBase.getText(bdaGenPath))
    : undefined
  preview.setOffsets(context?.gen ?? bdaGen)
  preview.setDefaults(context?.gen ?? bdaGen)
  preview.setTheme(theme.value === "dark" ? "dark" : "light")
  preview.setTransparent(devicePreviewTransparent())
  if (context && appState.layoutDocument && resolver) {
    const symbolPanel = candidateArea.hidden
    const candidatePath = toolbarConfigPath()
    const candidateLayout = candidatePath && appState.archive.isText(candidatePath)
      ? IniDocument.parse(appState.archive.getText(candidatePath))
      : undefined
    const config = resolvePanelConfig(
      appState.layoutDocument,
      context.gen,
      context.styles,
    )
    const inputVisual = resolver.resolveText(
      candidateInputForegroundStyle(context.gen, candidateLayout),
      false,
    )
    const { normal: candidateVisual, first: firstCandidateVisual } =
      resolveCandidateTextVisuals(candidateLayout, context.gen, resolver)
    appState.firstCandidateTextVisual = firstCandidateVisual
    appState.candidateTextWidth = config.width
    applyCandidateTextVisual(candidateInput, inputVisual, appState.candidateTextWidth)
    applyCandidateTextVisual(
      candidateWords,
      candidateVisual ?? { color: "#ffffff" },
      appState.candidateTextWidth,
    )
    const firstCandidate = candidateWords.firstElementChild as HTMLElement | null
    if (firstCandidate) {
      applyCandidateTextVisual(firstCandidate, appState.firstCandidateTextVisual, appState.candidateTextWidth)
    }
    preview.setPanel(
      config.styleID,
      config.width,
      config.height,
      appState.layoutDocument.get("PANEL", "ANIM_STYLE") ?? "",
    )
    const candidateHeight = symbolPanel ? 0 : (toolbarSize?.height ?? 0)
    const candidateInputHeight = symbolPanel ? 0 : (toolbarSize?.inputHeight ?? 0)
    const surfaceHeight = updatePanelTools(config.width, config.height, candidateHeight)
    appState.activeKeyboardGeometry = {
      panelWidth: config.width,
      panelHeight: surfaceHeight,
      candidateHeight,
      candidateInputHeight,
    }
    applyDeviceKeyboardGeometry(
      config.width,
      surfaceHeight,
      candidateHeight,
      candidateInputHeight,
    )
  } else if (bdaGen && appState.layoutDocument) {
    const generalSize = bdaGen.get("PANEL", "SIZE")?.split(",").map(Number)
    const layoutSize = appState.layoutDocument.get("PANEL", "SIZE")?.split(",").map(Number)
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
    appState.candidateTextWidth = panelWidth
    appState.firstCandidateTextVisual = firstVisual
    applyCandidateTextVisual(candidateInput, inputVisual, appState.candidateTextWidth)
    applyCandidateTextVisual(
      candidateWords,
      candidateVisual ?? { color: "#ffffff" },
      appState.candidateTextWidth,
    )
    const firstCandidate = candidateWords.firstElementChild as HTMLElement | null
    if (firstCandidate) applyCandidateTextVisual(firstCandidate, firstVisual, appState.candidateTextWidth)
    preview.setPanel(
      bdaStyleID(panel?.wholeBackStyle ?? panel?.backStyle),
      panelWidth,
      panelHeight,
    )
    const bdaSymbolPanel = candidateArea.hidden
    const candidateHeight = bdaSymbolPanel ? 0 : (toolbarSize?.height ?? 0)
    const candidateInputHeight = bdaSymbolPanel ? 0 : (toolbarSize?.inputHeight ?? 0)
    const surfaceHeight = updatePanelTools(panelWidth, panelHeight, candidateHeight)
    appState.activeKeyboardGeometry = {
      panelWidth,
      panelHeight: surfaceHeight,
      candidateHeight,
      candidateInputHeight,
    }
    applyDeviceKeyboardGeometry(
      panelWidth,
      surfaceHeight,
      candidateHeight,
      candidateInputHeight,
    )
  } else {
    appState.activeKeyboardGeometry = undefined
    for (const property of deviceGeometryProperties) deviceShell.style.removeProperty(property)
  }
  preview.setDocument(appState.layoutDocument)
}

function refreshSimulationPreview(): void {
  const composing = refreshSimulationState()
  if (!appState.archive || !appState.activeKeyboardGeometry) return
  applyDeviceKeyboardGeometry(
    appState.activeKeyboardGeometry.panelWidth,
    appState.activeKeyboardGeometry.panelHeight,
    appState.activeKeyboardGeometry.candidateHeight,
    appState.activeKeyboardGeometry.candidateInputHeight,
  )
  updateCanvasCandidateGeometry(appState.activeKeyboardGeometry.candidateHeight)
  const resolver = visualResolver()
  if (!resolver) return
  const toolbarSize = refreshToolbarPreview(composing, resolver)
  const symbolPanel = candidateArea.hidden
  const candidateHeight = symbolPanel ? 0 : (toolbarSize?.height ?? appState.activeKeyboardGeometry.candidateHeight)
  const candidateInputHeight = symbolPanel
    ? 0
    : (toolbarSize?.inputHeight ?? appState.activeKeyboardGeometry.candidateInputHeight)
  if (
    candidateHeight !== appState.activeKeyboardGeometry.candidateHeight ||
    candidateInputHeight !== appState.activeKeyboardGeometry.candidateInputHeight
  ) {
    appState.activeKeyboardGeometry.candidateHeight = candidateHeight
    appState.activeKeyboardGeometry.candidateInputHeight = candidateInputHeight
    applyDeviceKeyboardGeometry(
      appState.activeKeyboardGeometry.panelWidth,
      appState.activeKeyboardGeometry.panelHeight,
      candidateHeight,
      candidateInputHeight,
    )
    updateCanvasCandidateGeometry(candidateHeight)
  }
}

// 每次切换布局都会把全部布局文件重新解析（BDA 还要按当前布局逐个合成）来统计皮肤状态；内容不变时复用结果。
function currentSkinStates(): number[] {
  const key = [appState.archive, appState.archive?.revision, appState.bdaBase, appState.bdaBase?.revision, theme.value, orientation.value]
  if (!appState.cachedSkinStates?.key.every((value, index) => value === key[index])) appState.cachedSkinStates = { key, byLayout: new Map() }
  let states = appState.cachedSkinStates.byLayout.get(layout.value)
  if (!states) appState.cachedSkinStates.byLayout.set(layout.value, states = availableSkinStates(...skinStateDocuments()))
  return [...states]
}

function skinStateDocuments(): IniDocument[] {
  if (!appState.archive) return []
  const prefix = `${theme.value}/skin/${orientation.value}/`
  const paths = appState.archive.format === "bda"
    ? bdaAvailableLayoutPaths()
    : appState.archive.names().filter((path) => path.startsWith(prefix) && path.endsWith(".ini") && appState.archive?.isText(path))
  return paths.flatMap((path) => {
    const document = textDocument(path)
    return document ? [document] : []
  })
}

function measureCanvasWrapInnerSize(): { width: number; height: number } {
  const canvasStyle = getComputedStyle(canvasWrap)
  // offsetWidth/Height ignore scrollbars: a panned shell that overflows briefly
  // shows scrollbars, and fitting to clientWidth would shrink then regrow the keyboard.
  return {
    width: canvasWrap.offsetWidth - parseFloat(canvasStyle.borderLeftWidth) - parseFloat(canvasStyle.borderRightWidth) -
      parseFloat(canvasStyle.paddingLeft) - parseFloat(canvasStyle.paddingRight),
    height: canvasWrap.offsetHeight - parseFloat(canvasStyle.borderTopWidth) - parseFloat(canvasStyle.borderBottomWidth) -
      parseFloat(canvasStyle.paddingTop) - parseFloat(canvasStyle.paddingBottom),
  }
}

function fitCanvasPreview(): void {
  if (!appState.canvasLogicalSize) return
  const { width: availableWidth, height: availableHeight } = appState.canvasWrapInnerSize ?? measureCanvasWrapInnerSize()
  if (availableWidth <= 0 || availableHeight <= 0) return
  const width = canvasFitWidth(
    availableWidth,
    availableHeight,
    appState.canvasLogicalSize.width,
    appState.canvasLogicalSize.height,
  )
  const renderedWidth = width * appState.previewZoom
  const scale = renderedWidth / appState.canvasLogicalSize.width
  const panelViewportHeight = Math.round(appState.canvasLogicalSize.panelHeight * scale)
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
  if (currentDeviceValue() === "canvas") updateCanvasPanelStatus(renderedWidth)
  requestAnimationFrame(resizeKeyboardPreviews)
}

function updateCanvasPanelStatus(renderedWidth: number): void {
  if (!appState.canvasLogicalSize) return
  panelStatus.textContent = `面板：${Math.round(appState.canvasLogicalSize.width)} × ${Math.round(appState.canvasLogicalSize.layoutPanelHeight)} · 预览缩放：${Math.round(renderedWidth / appState.canvasLogicalSize.width * 100)}%`
}

function setPreviewPan(x: number, y: number): void {
  appState.previewPanX = x
  appState.previewPanY = y
  deviceShell.style.transform = `translate(${x}px, ${y}px) scale(${currentDeviceValue() === "canvas" ? 1 : appState.previewZoom})`
}

function schedulePreviewPan(x: number, y: number): void {
  appState.pendingPreviewPan = { x, y }
  schedulePreviewInteractionFrame()
}

function flushPreviewPan(): void {
  paintPreviewInteraction()
}

function applyPreviewZoom(value: number, anchor?: { x: number; y: number }): void {
  const before = anchor ? deviceShell.getBoundingClientRect() : undefined
  const anchorX = before && anchor ? (anchor.x - before.left) / before.width : 0.5
  const anchorY = before && anchor ? (anchor.y - before.top) / before.height : 0.5
  appState.previewZoom = Math.min(3, Math.max(0.4, Math.round(value * 10) / 10))
  previewZoomOut.disabled = appState.previewZoom <= 0.4
  previewZoomIn.disabled = appState.previewZoom >= 3
  if (currentDeviceValue() === "canvas") fitCanvasPreview()
  else setPreviewPan(appState.previewPanX, appState.previewPanY)
  if (anchor && before) {
    const after = deviceShell.getBoundingClientRect()
    setPreviewPan(
      appState.previewPanX + anchor.x - (after.left + anchorX * after.width),
      appState.previewPanY + anchor.y - (after.top + anchorY * after.height),
    )
  }
  if (currentDeviceValue() !== "canvas" && appState.canvasLogicalSize) {
    requestAnimationFrame(() => {
      const bounds = ($("#preview") as HTMLCanvasElement).getBoundingClientRect()
      panelStatus.textContent = `面板：${Math.round(appState.canvasLogicalSize!.width)} × ${Math.round(appState.canvasLogicalSize!.layoutPanelHeight)} · 预览缩放：${previewScalePercent(bounds.width, bounds.height, appState.canvasLogicalSize!.width, appState.canvasLogicalSize!.panelHeight)}%`
    })
  }
  requestAnimationFrame(resizeKeyboardPreviews)
}

function scheduleFitCanvasPreview(): void {
  if (appState.canvasFitFrozen) return
  clearTimeout(appState.fitCanvasDebounce)
  appState.fitCanvasDebounce = setTimeout(() => {
    if (currentDeviceValue() === "canvas") fitCanvasPreview()
  }, 50)
}

new ResizeObserver(() => {
  appState.canvasWrapInnerSize = measureCanvasWrapInnerSize()
  scheduleFitCanvasPreview()
}).observe(canvasWrap)

previewZoomOut.addEventListener("click", () => applyPreviewZoom(appState.previewZoom - 0.1))
previewZoomFit.addEventListener("click", () => {
  setPreviewPan(0, 0)
  applyPreviewZoom(1)
})
previewZoomFit.addEventListener("dblclick", () => {
  appState.previewPanLocked = !appState.previewPanLocked
  previewZoomFit.ariaPressed = String(appState.previewPanLocked)
  previewZoomFit.ariaLabel = appState.previewPanLocked ? "适配窗口，画布已锁定，双击解锁" : "适配窗口，双击锁定画布"
  previewZoomFit.title = appState.previewPanLocked ? "画布已锁定（双击解锁）" : "适配窗口（双击锁定画布）"
  finishPreviewPan()
})
previewZoomIn.addEventListener("click", () => applyPreviewZoom(appState.previewZoom + 0.1))
canvasWrap.addEventListener("wheel", (event) => {
  // 欢迎页（未打开皮肤）需要正常的纵向滚动，不能被画布缩放拦截
  if (deviceShell.hidden || canvasWrap.classList.contains("empty")) return
  event.preventDefault()
  if (appState.previewPanLocked) return
  applyPreviewZoom(
    appState.previewZoom + (event.deltaY < 0 ? 0.1 : -0.1),
    { x: event.clientX, y: event.clientY },
  )
}, { passive: false })

window.addEventListener("blur", () => {
  finishPreviewPan()
  if (editorCrosshair.checked) previewCoordinates.hidden = true
})

canvasWrap.addEventListener("pointerdown", (event) => {
  if (
    event.button !== 0 ||
    appState.previewPanLocked ||
    event.pointerType === "touch" ||
    deviceShell.hidden ||
    isEditing() && appState.keyMode === "move" && previewPanelViewport.contains(event.target as Node)
  ) return
  appState.previewPanCandidate = {
    pointerId: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    panX: appState.previewPanX,
    panY: appState.previewPanY,
  }
  canvasWrap.classList.add("preview-pan-ready")
})

canvasWrap.addEventListener("pointermove", (event) => {
  if (isEditing() && appState.keyMode === "move" && previewPanelViewport.contains(event.target as Node)) return
  if (!appState.previewPanStart && appState.previewPanCandidate?.pointerId === event.pointerId) {
    const dx = event.clientX - appState.previewPanCandidate.x
    const dy = event.clientY - appState.previewPanCandidate.y
    if (Math.hypot(dx, dy) < 3) return
    appState.previewPanStart = appState.previewPanCandidate
    preview.setPointerInteractionLocked(true)
    toolbarPreview.setPointerInteractionLocked(true)
    // Cache layout before the first transform write. Every subsequent frame
    // can derive the transformed canvas bounds from this snapshot and the pan
    // delta, avoiding forced reflow in the crosshair update path.
    appState.previewPanGeometry = {
      target: previewCanvas.getBoundingClientRect(),
      wrap: canvasWrap.getBoundingClientRect(),
      wrapWidth: canvasWrap.clientWidth,
      wrapHeight: canvasWrap.clientHeight,
    }
    if (appState.pointerCoordinatesFrame) cancelAnimationFrame(appState.pointerCoordinatesFrame)
    appState.pointerCoordinatesFrame = 0
    appState.pendingPointerCoordinates = undefined
    canvasWrap.classList.add("preview-panning")
    canvasWrap.setPointerCapture(event.pointerId)
  }
  if (!appState.previewPanStart || appState.previewPanStart.pointerId !== event.pointerId) return
  event.preventDefault()
  schedulePreviewPan(
    appState.previewPanStart.panX + event.clientX - appState.previewPanStart.x,
    appState.previewPanStart.panY + event.clientY - appState.previewPanStart.y,
  )
  const geometry = appState.previewPanGeometry
  if (geometry) {
    const offsetX = event.clientX - appState.previewPanStart.x
    const offsetY = event.clientY - appState.previewPanStart.y
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
  const pointerId = appState.previewPanStart?.pointerId
  flushPreviewPan()
  appState.previewPanCandidate = undefined
  appState.previewPanStart = undefined
  appState.previewPanGeometry = undefined
  preview.setPointerInteractionLocked(false)
  toolbarPreview.setPointerInteractionLocked(false)
  canvasWrap.classList.remove("preview-pan-ready", "preview-panning")
  if (pointerId !== undefined && canvasWrap.hasPointerCapture(pointerId)) canvasWrap.releasePointerCapture(pointerId)
}
canvasWrap.addEventListener("pointerdown", (event) => { appState.canvasWrapClickStart = { x: event.clientX, y: event.clientY } })
canvasWrap.addEventListener("click", (event) => {
  const target = event.target as Element
  const start = appState.canvasWrapClickStart
  appState.canvasWrapClickStart = undefined
  if (
    !isEditing() ||
    !start || Math.hypot(event.clientX - start.x, event.clientY - start.y) >= 3 ||
    candidateArea.contains(target) ||
    target.closest("canvas, button, input, select, label, [role=button]")
  ) return
  if (appState.selectedKeySections.length || appState.selectedToolbarSections.length || appState.selectedCandidate) inspectorBackButton.click()
})

canvasWrap.addEventListener("pointerup", finishPreviewPan)
canvasWrap.addEventListener("pointercancel", finishPreviewPan)
// Ignore capture lost by child canvases (it bubbles here when the pan takes capture over).
canvasWrap.addEventListener("lostpointercapture", (event) => { if (event.target === canvasWrap) finishPreviewPan() })

function updateCanvasCandidateGeometry(candidateHeight: number): void {
  if (!appState.canvasLogicalSize) return
  appState.canvasLogicalSize.height = appState.canvasLogicalSize.panelHeight + candidateHeight
  fitCanvasPreview()
}

function updatePanelTools(
  width: number,
  height: number,
  candidateHeight = 0,
): number {
  const items = appState.layoutDocument ? previewItems(appState.layoutDocument, width, height) : []
  const surfaceHeight = previewSurfaceHeight(items, height)
  const content = previewContentVerticalBounds(items, width, surfaceHeight)
  deviceShell.style.setProperty("--canvas-width", `${width}px`)
  deviceShell.style.setProperty("--canvas-ratio-width", String(width))
  deviceShell.style.setProperty("--panel-visible-height", String(content.height))
  deviceShell.style.removeProperty("--panel-crop-offset")
  appState.canvasLogicalSize = {
    width,
    height: surfaceHeight + candidateHeight,
    panelHeight: surfaceHeight,
    layoutPanelHeight: height,
    panelVisibleHeight: content.height,
  }
  fitCanvasPreview()
  const states = currentSkinStates()
  const selected = skinState.value
  const selectedState = selected ? Number(selected) : undefined
  if (selectedState !== undefined && selectedState <= 122 && !states.includes(selectedState)) {
    states.push(selectedState)
    states.sort((a, b) => a - b)
  }
  skinState.replaceChildren(
    new Option("默认", ""),
    ...states.map((state) => new Option(skinStateLabel(state), String(state))),
  )
  skinState.value = selectedState !== undefined && states.includes(selectedState) ? selected : ""
  skinStateValue.textContent = skinState.value ? `S${Number(skinState.value)}` : "默认"
  skinStateControl.hidden = states.length === 0
  applySkinState(skinState.value ? Number(skinState.value) : undefined)
  requestAnimationFrame(() => {
    if (currentDeviceValue() === "canvas") return
    const bounds = ($("#preview") as HTMLCanvasElement).getBoundingClientRect()
    panelStatus.textContent = `面板：${Math.round(width)} × ${Math.round(height)} · 预览缩放：${previewScalePercent(bounds.width, bounds.height, width, surfaceHeight)}%`
  })
  return surfaceHeight
}

function updateDevicePreview(): void {
  setPreviewPan(0, 0)
  const deviceValue = currentDeviceValue()
  deviceShell.dataset.device = deviceValue
  deviceShell.dataset.orientation = orientation.value
  deviceShell.dataset.theme = theme.value
  deviceShell.classList.toggle("canvas-only", deviceValue === "canvas")
  const spec = deviceSpec(deviceValue)
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
  applyPreviewZoom(appState.previewZoom)
  // Device switches change whether the canvas is the panel surface, which
  // decides if the gesture hot zones can line up.
  populateKeyInspector()
}

function panelSizeFrom(document: IniDocument | undefined): [number, number] | undefined {
  const size = document?.get("PANEL", "SIZE")?.split(",").map(Number)
  return size?.length === 2 && size.every((value) => Number.isFinite(value) && value > 0)
    ? size as [number, number]
    : undefined
}

function panelSizeForPath(path: string): [number, number] | undefined {
  if (!appState.archive?.isText(path)) return
  const directory = path.slice(0, path.lastIndexOf("/"))
  return panelSizeFrom(IniDocument.parse(appState.archive.getText(path))) ??
    (appState.archive.isText(`${directory}/gen.ini`) ? panelSizeFrom(IniDocument.parse(appState.archive.getText(`${directory}/gen.ini`))) : undefined)
}

function panelCopySourceSize(): [number, number] | undefined {
  if (!appState.archive) return
  const source = panelCopySource.value.trim().replace(/\\/g, "/").replace(/\/+$/, "")
  if (appState.archive.isText(source)) return panelSizeForPath(source)
  for (const path of appState.archive.names()) {
    if (path.startsWith(`${source}/`) && /\.ini$/i.test(path)) {
      const size = panelSizeForPath(path)
      if (size) return size
    }
  }
}

function updatePanelCopyForm(): void {
  if (!appState.archive) return
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
    const copies = archiveCopyPaths(appState.archive.names(), panelCopySource.value, panelCopyTarget.value)
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
  if (!appState.archive) return
  const paths = archivePathOptions(appState.archive.names())
  if (!paths.length) {
    showError(new Error("皮肤中没有可复制的目录或文件"), "打开面板复制")
    return
  }
  const options = paths.map((value) => Object.assign(document.createElement("option"), { value }))
  panelCopySourceOptions.replaceChildren(...options.map((option) => option.cloneNode(true)))
  panelCopyTargetOptions.replaceChildren(...options)
  panelCopySource.value = paths.includes(appState.selectedPath) ? appState.selectedPath :
    paths.find((path) => path === `${theme.value}/skin/${orientation.value}/${layout.value}`) ?? paths[0]
  panelCopyTarget.value = defaultPanelCopyTarget(panelCopySource.value)
  panelScaleEnabled.checked = false
  panelTargetWidth.value = ""
  panelTargetHeight.value = ""
  updatePanelCopyForm()
  panelScaleDialog.showModal()
}

async function copyPanel(): Promise<boolean> {
  if (!appState.archive) return false
  const currentArchive = appState.archive
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
  appState.fileOperationRunning = busy
  newButton.disabled = busy
  openButton.disabled = busy
  saveButton.disabled = busy || !appState.archive
  mobileShareButton.disabled = busy || !appState.archive
  updatePanelToolButtons()
  updateSourceFileActions()
  for (const button of exportButtons) {
    const format = button.dataset.exportFormat as ExportFormat
    // 只有 BDA 皮肤能导出 BDA；其他格式直接隐藏这两项，不留一排无法解释的灰色菜单。
    button.hidden = Boolean(appState.archive) && appState.archive!.format !== "bda" && format === "bda"
    button.disabled = busy || !appState.archive || button.hidden
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
  fileOperationPercent.textContent = fileOperationProgress.textContent
  fileOperationDetail.textContent = detail
}

function showSkinLoadProgress(size: number): boolean {
  if (size <= LARGE_SKIN_BYTES) return false
  if (!appState.fileOperationProgressVisible) {
    appState.fileOperationProgressVisible = true
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
    if (!appState.fileOperationProgressVisible) return
    updateFileOperationProgress(2 + loaded / total * 16, `正在读取皮肤文件… ${Math.round(loaded / total * 100)}%`)
  }
  // 后端直接回传二进制，避免 Vec<u8> 被序列化成 JSON 数字数组。
  return new Uint8Array(await invoke<ArrayBuffer>("read_skin_file", { path, progress }))
}

function waitForInterfacePaint(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
}

function ios26StylePath(genPath: string): string | undefined {
  if (!appState.archive) return
  const directory = genPath.slice(0, genPath.lastIndexOf("/"))
  const themeRoot = genPath.split("/").slice(0, 2).join("/")
  return [`${directory}/res/default.css`, `${themeRoot}/res/default.css`]
    .find((path) => appState.archive?.isText(path))
}

function adaptArchiveForIos26(): boolean {
  if (!appState.archive) return false
  const staged = new Map<string, string>()
  let variants = 0
  const text = (path: string) => staged.get(path) ?? appState.archive!.getText(path)
  for (const genPath of appState.archive.names().filter((path) => /\/(?:port|land)\/gen\.ini$/i.test(path))) {
    const directory = genPath.slice(0, genPath.lastIndexOf("/"))
    const gen = IniDocument.parse(text(genPath))
    const candidateName = gen.get("CAND", "LAYOUT_NAME") ?? "cand1"
    const candidatePath = `${directory}/${candidateName.replace(/\.cnd$/i, "")}.cnd`
    const stylePath = ios26StylePath(genPath)
    if (!appState.archive.isText(candidatePath) || !stylePath) continue
    variants++
    const adapted = adaptIos26Variant(text(candidatePath), text(genPath), text(stylePath))
    staged.set(candidatePath, adapted.candidate)
    staged.set(genPath, adapted.general)
    staged.set(stylePath, adapted.styles)
    for (const path of appState.archive.names().filter((path) => path.startsWith(`${directory}/`) && /\.ini$/i.test(path))) {
      if (!appState.archive.isText(path)) continue
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
    const before = appState.archive!.getText(path)
    return before === after ? [] : [{ kind: "text" as const, path, before, after }]
  })
  if (!variants) throw new Error("没有找到可适配的候选栏和通用配置。")
  if (!changes.length) return true
  commitBatch(changes)
  renderFiles()
  if (appState.selectedPath && appState.archive.isText(appState.selectedPath)) selectFile(appState.selectedPath)
  refreshPreview()
  updateDirty()
  return true
}

async function runFileOperation(
  action: string,
  operation: () => boolean | Promise<boolean>,
): Promise<void> {
  if (appState.fileOperationRunning) {
    // 拖入、最近打开、模板卡片在上一个操作结束前也能触发：给出提示，不再静默忽略。
    showStatus(`正在${appState.currentFileOperation}，请稍后再${action}。`, "progress")
    return
  }
  appState.currentFileOperation = action
  setFileOperationBusy(true)
  appState.fileOperationProgressVisible = false
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
    if (appState.fileOperationProgressVisible) {
      fileOperationDialog.dataset.outcome = completed ? "success" : "cancelled"
      fileOperationTitle.textContent = completed ? `${action}完成` : `${action}已取消`
      updateFileOperationProgress(completed ? 100 : fileOperationProgress.value, completed ? "处理完成" : "未进行更改")
      fileOperationResult.textContent = result
      fileOperationResult.hidden = false
      if (completed && action === "打开") {
        fileOperationDialog.close()
        appState.fileOperationProgressVisible = false
      }
    }
  } catch (error) {
    clientLog.info("operation.finish", {
      action,
      outcome: "failed",
      durationMs: Math.round(performance.now() - started),
    })
    showError(error, action)
    if (appState.fileOperationProgressVisible) {
      fileOperationDialog.dataset.outcome = "error"
      fileOperationTitle.textContent = `${action}失败`
      fileOperationDetail.textContent = "处理已停止"
      fileOperationResult.textContent = operationError(action, error)
      fileOperationResult.hidden = false
    }
  } finally {
    setFileOperationBusy(false)
    if (appState.fileOperationProgressVisible) fileOperationClose.disabled = false
  }
}

function showImage(path: string): void {
  const bytes = appState.archive?.getBytes(path)
  if (!bytes) return
  appState.assetURL = replaceImagePreviewURL(appState.assetURL, bytes)
  clearImagePreviewError()
  workspaceImage.src = appState.assetURL
  assetImage.src = appState.assetURL
  deviceShell.hidden = true
  workspaceImageFigure.hidden = false
  sourceEditor.hidden = true
  asset.hidden = appState.resourceConfigActive
  sourceName.textContent = path
  assetBackButton.disabled = !appState.assetReturnPath
}

function bdaTileUsageKey(usage: BdaTileUsage | undefined): string {
  return usage ? `${usage.ref.key}:${usage.highlighted ? "highlight" : "normal"}` : ""
}

function selectedBdaTileUsage(): BdaTileUsage | undefined {
  return appState.bdaTileUsages.find((usage) => usage.index === appState.selectedTileIndex)
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
  const size = pngPixelSize(appState.archive?.getBytes(path))
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

function syncAtlasWorkspace(): void {
  if (appState.resourceConfigActive && appState.resourceInspectorMode === "image" && appState.inspectorTab === "properties" && appState.selectedResourcePath) sourceName.textContent = appState.selectedResourcePath
  const slice = appState.movingTile ?? appState.slices.find(item => item.index === appState.selectedTileIndex)
  const references: string[] = []
  if (slice && appState.archive?.isText(styleConfigPath())) {
    const styles = IniDocument.parse(appState.archive.getText(styleConfigPath()))
    const name = appState.selectedResourcePath.split("/").pop()?.replace(/\.png$/i, "")
    for (const section of styles.sections()) {
      for (const key of ["NM_IMG", "HL_IMG"]) {
        const value = styles.get(section, key)?.split(",").map(item => item.trim())
        if (value && value[0] === name && Number(value[1]) === slice.index) references.push(`${section} · ${key}`)
      }
    }
  }
  appState.atlasWorkspace?.update({
    active: appState.resourceConfigActive && appState.resourceInspectorMode === "image",
    path: appState.selectedResourcePath,
    width: workspaceImage.naturalWidth,
    height: workspaceImage.naturalHeight,
    slices: appState.slices, selected: slice, editable: isEditing(), bda: appState.archive?.format === "bda",
    guides: appState.guidesVisible, reference: selectedBdaTileUsage()?.label ?? references.join("、"),
  })
}

function scheduleAtlasDraw(): void {
  if (appState.atlasDrawFrame) return
  appState.atlasDrawFrame = requestAnimationFrame(() => {
    appState.atlasDrawFrame = 0
    drawAtlas()
  })
}

function drawAtlas(): void {
  if (appState.atlasDrawFrame) cancelAnimationFrame(appState.atlasDrawFrame)
  appState.atlasDrawFrame = 0
  syncAtlasWorkspace()
  if (!workspaceImage.complete || !workspaceImage.naturalWidth) return
  const { naturalWidth, naturalHeight } = workspaceImage
  // 桌面工作区按显示尺寸 × DPR 绘制，避免 CSS 放大导致切片线条和标签模糊；像素上限防止大图超出画布限制
  const cssWidth = parseFloat(atlasCanvas.style.width)
  const pixelScale = cssWidth
    ? Math.max(1, Math.min(cssWidth * devicePixelRatio / naturalWidth, Math.sqrt(16e6 / (naturalWidth * naturalHeight))))
    : 1
  const backingWidth = Math.round(naturalWidth * pixelScale)
  const backingHeight = Math.round(naturalHeight * pixelScale)
  if (atlasCanvas.width !== backingWidth) atlasCanvas.width = backingWidth
  if (atlasCanvas.height !== backingHeight) atlasCanvas.height = backingHeight
  const context = atlasCanvas.getContext("2d")
  if (!context) return
  context.setTransform(1, 0, 0, 1, 0, 0)
  context.clearRect(0, 0, backingWidth, backingHeight)
  context.setTransform(backingWidth / naturalWidth, 0, 0, backingHeight / naturalHeight, 0, 0)
  context.imageSmoothingEnabled = pixelScale <= 1
  context.drawImage(workspaceImage, 0, 0)
  drawTilePreview()
  if (!appState.resourceConfigActive || !appState.guidesVisible) return

  const allVisible = appState.tileDraft
    ? [...appState.slices, { index: nextTileIndex(appState.tileDocument), source: appState.tileDraft }]
    : appState.movingTile
      ? appState.slices.map((slice) => slice.index === appState.movingTile?.index ? appState.movingTile : slice)
      : appState.slices
  const visible = appState.archive?.format === "bda"
    ? allVisible.filter((slice) => slice.index === appState.selectedTileIndex)
    : allVisible
  const displayScale = Math.max(0.01, atlasCanvas.getBoundingClientRect().width / Math.max(1, naturalWidth))
  const lineWidth = Math.min(6, 1.5 / displayScale)
  context.font = `${11 / displayScale}px ui-monospace, monospace`
  context.textBaseline = "top"
  const accent = getComputedStyle(atlasCanvas).getPropertyValue("--accent").trim() || "#3a6df0"
  const handle = 8 / displayScale
  const labelHeight = 17 / displayScale
  for (const slice of visible) {
    const [x, y, width, height] = slice.source
    const selected = slice.index === appState.selectedTileIndex || slice.source === appState.tileDraft
    context.lineWidth = selected ? lineWidth * 2 : lineWidth
    context.strokeStyle = selected ? accent : "#8d96a7"
    context.strokeRect(x + context.lineWidth / 2, y + context.lineWidth / 2, width - context.lineWidth, height - context.lineWidth)
    const usage = appState.bdaTileUsages.find((item) => item.index === slice.index)
    const label = usage?.label ?? `IMG${slice.index}`
    const labelWidth = context.measureText(label).width + 6 / displayScale
    context.fillStyle = selected ? accent : "#68758a"
    context.fillRect(x, y, labelWidth, labelHeight)
    context.fillStyle = "#fff"
    context.fillText(label, x + 3 / displayScale, y + 2 / displayScale)
    if (selected) {
      for (const [hx, hy] of [[x, y], [x + width, y], [x, y + height], [x + width, y + height]]) {
        context.fillStyle = accent
        context.fillRect(hx - handle / 2, hy - handle / 2, handle, handle)
        context.strokeStyle = "#fff"
        context.lineWidth = handle / 7
        context.strokeRect(hx - handle / 2, hy - handle / 2, handle, handle)
      }
    }
    if (slice.inner && (appState.archive?.format === "bda" || selected)) {
      const [innerX, innerY, innerWidth, innerHeight] = slice.inner
      if (innerWidth > 0 && innerHeight > 0) {
        context.save()
        context.lineWidth = lineWidth * 2
        context.strokeStyle = "#ff9500"
        context.setLineDash([lineWidth * 4, lineWidth * 3])
        context.strokeRect(innerX, innerY, innerWidth, innerHeight)
        context.restore()
      }
    }
  }
}

function drawTilePreview(): void {
  const slice = appState.movingTile?.index === appState.selectedTileIndex
    ? appState.movingTile
    : appState.slices.find((item) => item.index === appState.selectedTileIndex)
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
  context.strokeStyle = getComputedStyle(atlasCanvas).getPropertyValue("--accent").trim() || "#3a6df0"
  context.strokeRect(destination.x + 1, destination.y + 1, destination.width - 2, destination.height - 2)
  if (slice.inner) {
    const inner = tilePreviewInnerRect(slice.source, slice.inner, destination)
    if (inner) {
      context.save()
      context.beginPath()
      context.rect(destination.x, destination.y, destination.width, destination.height)
      context.clip()
      context.strokeStyle = "#ff9500"
      context.setLineDash([6, 4])
      context.strokeRect(inner.x, inner.y, inner.width, inner.height)
      context.restore()
    }
  }
}

function populateTileInspector(): void {
  const slice = appState.slices.find((item) => item.index === appState.selectedTileIndex)
  const bdaSelected = appState.archive?.format === "bda"
  const usage = selectedBdaTileUsage()
  tileInspector.hidden = !appState.selectedResourcePath
  bdaTileUsage.hidden = !bdaSelected || !appState.bdaTileUsages.length
  tileSourceFieldsGroup.hidden = bdaSelected
  tileInnerTitle.textContent = bdaSelected ? "切片区域" : "拉伸边距"
  tileInspector.dataset.empty = String(!slice)
  bdaTileUsage.replaceChildren(...appState.bdaTileUsages.map((item) => {
    const option = new Option(item.label, String(item.index))
    option.selected = item.index === appState.selectedTileIndex
    return option
  }))
  newTileButton.hidden = Boolean(bdaSelected)
  duplicateTileButton.hidden = Boolean(bdaSelected)
  deleteTileButton.hidden = Boolean(bdaSelected)
  moveTileButton.hidden = Boolean(bdaSelected)
  newTileButton.disabled = !appState.selectedResourcePath || !isEditing() || bdaSelected
  duplicateTileButton.disabled = !slice || !isEditing() || bdaSelected
  deleteTileButton.disabled = !slice || !isEditing() || bdaSelected
  tileTitle.textContent = usage ? "图片样式切片" : (slice ? `切片 #${slice.index}` : bdaSelected ? "未被当前 BDA 外观引用" : "未选择切片 · 点击图片中的切片进行编辑")
  for (const field of tileSourceFields) {
    const index = Number(field.dataset.tileSource)
    if (field.parentElement?.firstChild?.nodeType === Node.TEXT_NODE) field.parentElement.firstChild.textContent = `${["X", "Y", "宽", "高"][index]} `
    field.value = slice ? String(slice.source[index]) : ""
    field.disabled = !slice || !isEditing() || bdaSelected
  }
  for (const field of tileInnerFields) {
    const index = Number(field.dataset.tileInner)
    const margins = slice?.inner && [slice.inner[0] - slice.source[0], slice.inner[1] - slice.source[1], slice.source[0] + slice.source[2] - slice.inner[0] - slice.inner[2], slice.source[1] + slice.source[3] - slice.inner[1] - slice.inner[3]]
    field.value = slice?.inner ? String(bdaSelected ? slice.inner[index] : margins![index]) : ""
    if (field.parentElement?.firstChild?.nodeType === Node.TEXT_NODE) field.parentElement.firstChild.textContent = `${(bdaSelected ? ["X", "Y", "宽", "高"] : ["左", "上", "右", "下"])[index]} `
    field.min = "0"
    field.disabled = !slice || !isEditing()
  }
  drawTilePreview()
  syncAtlasWorkspace()
}

function loadTiles(path: string): void {
  const previousUsage = bdaTileUsageKey(selectedBdaTileUsage())
  if (appState.archive?.format === "bda") {
    const tiles = bdaImageTiles(path)
    appState.tilePath = ""
    appState.tileDocument = IniDocument.parse("")
    setSourceValue("")
    source.disabled = true
    appState.slices = tiles.slices
    appState.bdaTileUsages = tiles.usages
    appState.selectedTileIndex = appState.bdaTileUsages.find((usage) => bdaTileUsageKey(usage) === previousUsage)?.index
      ?? appState.bdaTileUsages[0]?.index
    appState.tileDraft = undefined
    appState.movingTile = undefined
    appState.moveStart = undefined
    appState.moveSource = undefined
    populateTileInspector()
    drawAtlas()
    return
  }
  appState.bdaTileUsages = []
  appState.tilePath = path.replace(/\.png$/i, ".til")
  appState.tileDocument = appState.archive?.isText(appState.tilePath) ? IniDocument.parse(appState.archive.getText(appState.tilePath)) : IniDocument.parse("")
  appState.slices = tileSlices(appState.tileDocument)
  setSourceValue(appState.tileDocument.toString())
  sourceName.textContent = appState.tilePath
  source.disabled = false
  appState.selectedTileIndex = undefined
  updateSourceHighlight()
  appState.tileDraft = undefined
  appState.movingTile = undefined
  appState.moveStart = undefined
  appState.moveSource = undefined
  populateTileInspector()
  drawAtlas()
}

function openStyleImageResourceChooser(target: StyleImagePickerTarget): void {
  appState.resourcePickerSelect = undefined
  appState.pickerTarget = target
  if (isTauri()) openImagePickerList()
  else openStyleImageResourcePicker()
}

function openBdaAnimationResourceChooser(onSelect: (resourceID: string) => void): void {
  appState.pickerTarget = undefined
  appState.resourcePickerSelect = onSelect
  if (isTauri()) openImagePickerList()
  else openStyleImageResourcePicker()
}

function openBdaStyleImageResourceChooser(ref: BdaStyleRef, highlighted: boolean): void {
  appState.pickerTarget = undefined
  appState.resourcePickerSelect = (resourceID) => {
    const property = highlighted ? "HL_IMG" : "NM_IMG"
    if (updateBdaRefs([ref], property, resourceID)) void renderStyleResourceDetail()
  }
  if (isTauri()) openImagePickerList()
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
  const path = resourceImagePaths(appState.archive?.names() ?? [], theme.value, orientation.value)
    .find((candidate) => candidate.split("/").pop()?.replace(/\.png$/i, "") === resourceID)
  if (!path) return
  const returnState = { path: appState.selectedPath, styleID: appState.selectedStyleID }
  selectFile(info.path, "overview", "image")
  appState.bdaSliceReturn = returnState
  selectResourceImage(path)
  appState.selectedTileIndex = appState.bdaTileUsages.find((usage) =>
    usage.ref.type === ref.type && usage.ref.key === ref.key && usage.highlighted === highlighted)?.index
    ?? appState.selectedTileIndex
  populateTileInspector()
  drawAtlas()
}

function chooseStyleImageSlice(property: "NM_IMG" | "HL_IMG"): void {
  const target = styleSectionTarget(appState.selectedStyleID, property)
  const path = styleConfigPath()
  const stylesDocument = appState.archive?.isText(path) ? IniDocument.parse(appState.archive.getText(path)) : undefined
  const current = stylesDocument?.get(`STYLE${appState.selectedStyleID}`, property)?.split(",")[0]?.trim()
  const imagePath = resourceImagePaths(appState.archive?.names() ?? [], theme.value, orientation.value)
    .find((candidate) => candidate.split("/").pop()?.replace(/\.png$/i, "") === current)
  appState.stylePickerTarget = undefined
  if (imagePath && target) openImageSlicePicker(imagePath, target)
  else if (target) openStyleImageResourceChooser(target)
}

for (const button of styleDetailImageButtons) {
  button.addEventListener("click", () => chooseStyleImageSlice(button.dataset.styleImageProperty as "NM_IMG" | "HL_IMG"))
}

function styleSectionTarget(styleID: string, property: "NM_IMG" | "HL_IMG"): StyleImagePickerTarget | undefined {
  const path = styleConfigPath()
  if (!appState.archive?.isText(path)) return
  return {
    source: "BACK_STYLE",
    property,
    document: IniDocument.parse(appState.archive.getText(path)),
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
  const appearancePart = bdaAppearancePart(appState.selectedPath)
  const appearanceInfo = currentBdaAppearance()
  if (appState.archive?.format === "bda" && appearancePart?.kind === "styles" && appearanceInfo && appState.selectedStyleID) {
    const type = appearancePart.group === "imageStyles" ? "image" : appearancePart.group === "textStyles" ? "text" : "color"
    const ref: BdaStyleRef = { type, key: Number(appState.selectedStyleID) }
    resourceName.textContent = `STYLE ${appState.selectedStyleID}`
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
  if (!appState.archive?.isText(path) || !appState.selectedStyleID) return
  const stylesDocument = IniDocument.parse(appState.archive.getText(path))
  const section = `STYLE${appState.selectedStyleID}`
  resourceName.textContent = section
  resourceMeta.textContent = path
  imageResourceDetail.hidden = true
  styleResourceDetail.hidden = false
  styleDetailPreviews.hidden = false
  const resolver = visualResolver()
  if (resolver) {
    drawVisualPreview(retinaThumbnail(styleDetailNormal, 128, 88), [await resolver.resolve(appState.selectedStyleID, false).catch(() => undefined)], false)
    drawVisualPreview(retinaThumbnail(styleDetailHighlighted, 128, 88), [await resolver.resolve(appState.selectedStyleID, true).catch(() => undefined)], false)
  }
  styleDetailFields.replaceChildren()
  const existing = stylesDocument.entries(section)
  const common = ["NM_COLOR", "HL_COLOR", "FONT_NAME", "FONT_WEIGHT", "FONT_SIZE", "SHOW", "INFO"]
  const keys = [...common, ...existing.map((entry) => entry.key).filter((key) => !common.includes(key) && key !== "NM_IMG" && key !== "HL_IMG")]
  const groups = [
    ["colors", "状态颜色", (key: string) => key === "NM_COLOR" || key === "HL_COLOR"],
    ["typography", "字体", (key: string) => key.startsWith("FONT_")],
    ["content", "内容与说明", (key: string) => key === "SHOW" || key === "INFO"],
    ["advanced", "边框与扩展", () => true],
  ] as const
  const groupFields = new Map(groups.map(([id]) => [id, document.createElement("div")]))
  for (const fields of groupFields.values()) fields.className = "style-detail-group-fields"
  for (const key of keys) {
    const label = document.createElement("label")
    label.className = "style-detail-field"
    const caption = document.createElement("span")
    caption.textContent = translatedConfigLabel(key)
    caption.title = key
    // 没有中文译名的键（FONT_CLEARTYPE 等）按技术名排版，避免看起来像缺了一半的标签。
    caption.classList.toggle("style-detail-key-raw", caption.textContent === key)
    const row = document.createElement("span")
    row.className = "style-detail-field-row"
    const updateField = (value: string) => {
      if (!appState.archive?.isText(path)) return
      const current = IniDocument.parse(appState.archive.getText(path))
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
      alpha.disabled = !isEditing()
      const colorControl = document.createElement("span")
      colorControl.className = "color-control"
      colorControl.append(textInput, picker, alpha)
      bindStyleDetailColor(textInput, picker, alpha)
      textInput.addEventListener("change", () => updateField(textInput.value))
      row.append(colorControl)
    } else if (key.endsWith("SOUND_PATH")) {
      const filename = stylesDocument.get(section, key) ?? ""
      const soundPaths = currentSoundEntries()
      const soundPath = soundPathForFilename(appState.archive.names(), theme.value, orientation.value, filename)
      const card = document.createElement("span")
      card.className = "style-detail-sound-card"
      const playButton = document.createElement("button")
      playButton.type = "button"
      playButton.className = "style-detail-sound-play"
      playButton.disabled = !soundPath
      playButton.title = soundPath ? `播放 ${filename}` : "当前声音文件不存在"
      playButton.setAttribute("aria-label", playButton.title)
      playButton.append(symbolSpan("play.fill"))
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
    const group = groups.find(([, , matches]) => matches(key))!
    groupFields.get(group[0])!.append(label)
  }
  for (const [id, title] of groups) {
    const fields = groupFields.get(id)!
    if (!fields.childElementCount) continue
    const fieldset = document.createElement("fieldset")
    fieldset.className = "style-detail-group"
    fieldset.dataset.styleDetailGroup = id
    const legend = document.createElement("legend")
    legend.textContent = title
    fieldset.append(legend, fields)
    styleDetailFields.append(fieldset)
  }
}

function selectStyleResource(styleID: string): void {
  if (appState.archive?.format === "bda") {
    const part = bdaAppearancePart(appState.selectedPath)
    const appearance = currentBdaAppearance()?.appearance
    if (part?.kind !== "styles" || !appearance) return
    const styles = part.group === "imageStyles"
      ? appearance.imageStyles
      : part.group === "textStyles"
        ? appearance.textStyles
        : appearance.colorStyles
    if (!styles.has(Number(styleID))) return
  } else if (!availableStyleIDs().includes(styleID)) return
  appState.selectedStyleID = styleID
  resourceListView.hidden = true
  resourceDetail.hidden = false
  resourceInspector.scrollTop = 0
  void renderStyleResourceDetail()
}

function selectResourceImage(path: string): void {
  if (!appState.archive?.isImage(path)) return
  appState.selectedResourcePath = path
  appState.selectedResourceGalleryPath = path
  resourceListView.hidden = true
  resourceDetail.hidden = false
  resourceInspector.scrollTop = 0
  resourceName.textContent = path.split("/").pop() ?? path
  resourceMeta.textContent = path
  imageResourceDetail.hidden = false
  styleResourceDetail.hidden = true
  appState.tileMode = "select"
  tileModeButtons.forEach((button) => button.classList.toggle("active", button.dataset.tileMode === appState.tileMode))
  showImage(path)
  loadTiles(path)
  syncAtlasWorkspace()
  updateResourceActionButtons()
  for (const item of resourceGallery.querySelectorAll<HTMLElement>(".resource-item")) {
    item.classList.toggle("selected", item.dataset.path === path)
  }
  resourceGallery.querySelector<HTMLElement>(`.resource-item[data-path="${CSS.escape(path)}"]`)?.scrollIntoView({ block: "nearest" })
}

function releaseResourceURLs(): void {
  for (const url of appState.resourceURLs) URL.revokeObjectURL(url)
  appState.resourceURLs = []
}

async function renderStyleResourceGallery(): Promise<void> {
  if (appState.archive?.format === "bda") {
    await renderBdaStyleResourceGallery()
    return
  }
  if (!appState.archive?.isText(styleConfigPath())) return
  if (resourceCategory.dataset.styleCategories !== "bdi") {
    resourceCategory.replaceChildren(
      new Option("全部样式", "all"),
      ...(["image", "color", "anim", "text", "sound"] as const).map((kind) => new Option(`${styleKinds[kind].label}样式`, kind)),
    )
    resourceCategory.dataset.styleCategories = "bdi"
  }
  const query = resourceSearch.value.trim().toLowerCase()
  const stylesDocument = IniDocument.parse(appState.archive.getText(styleConfigPath()))
  const category = resourceCategory.value
  const styleIDs = availableStyleIDs().filter((styleID) => {
    const entries = stylesDocument.entries(`STYLE${styleID}`)
    const hasSound = Boolean(stylesDocument.get(`STYLE${styleID}`, "PRESS_SOUND_PATH")?.trim())
    // 声音可与视觉属性共存，按是否带音效筛；其余按样式类型筛。
    if (category === "sound" ? !hasSound : category !== "all" && styleKind(styleID, stylesDocument) !== category) return false
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
  resourceListView.hidden = Boolean(appState.selectedStyleID)
  resourceDetail.hidden = !appState.selectedStyleID
  const resolver = visualResolver()
  if (!resolver) return
  for (const styleID of styleIDs) {
    const button = document.createElement("button")
    button.className = "resource-item style-resource-item"
    button.dataset.path = `STYLE${styleID}`
    button.title = `STYLE${styleID}`
    const soundFilename = stylesDocument.get(`STYLE${styleID}`, "PRESS_SOUND_PATH")?.trim()
    const soundPath = soundFilename
      ? soundPathForFilename(appState.archive.names(), theme.value, orientation.value, soundFilename)
      : undefined
    if (soundFilename) {
      button.classList.add("has-sound")
      const badge = symbolSpan("play")
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
    meta.prepend(styleKindBadge(styleKind(styleID, stylesDocument)))
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
  if (appState.selectedResourceGalleryPath) selectGalleryItem(appState.selectedResourceGalleryPath, resourceGallery)
}

async function renderBdaStyleResourceGallery(): Promise<void> {
  const info = currentBdaAppearance()
  const part = bdaAppearancePart(appState.selectedPath)
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
  resourceListView.hidden = Boolean(appState.selectedStyleID)
  resourceDetail.hidden = !appState.selectedStyleID
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
  if (appState.selectedResourceGalleryPath) selectGalleryItem(appState.selectedResourceGalleryPath, resourceGallery)
}

function currentSoundEntries(): SoundEntry[] {
  if (!appState.archive) return []
  return soundResourcePaths(appState.archive.names(), theme.value, orientation.value).map((path) => {
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
  if (!appState.archive) return
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
  resourceUploadButton.title = appState.selectedSoundID ? "替换选中按键音效" : "添加按键音效"
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
    const icon = symbolSpan("speaker.wave.2")
    icon.classList.add("sound-resource-icon")
    const name = document.createElement("strong")
    name.textContent = entry.label
    const meta = document.createElement("small")
    meta.textContent = `${entry.filename} · ${entry.usage}`
    button.append(icon, name, meta)
    button.addEventListener("click", () => {
      appState.selectedSoundID = entry.id
      selectGalleryItem(entry.id, resourceGallery)
      resourceUploadButton.title = "替换选中按键音效"
      resourceUploadButton.setAttribute("aria-label", resourceUploadButton.title)
      playSoundPath(entry.path)
    })
    resourceGallery.append(button)
  }
  if (appState.selectedSoundID) selectGalleryItem(appState.selectedSoundID, resourceGallery)
}

function renderResourceInspector(): void {
  if (!appState.archive) return
  releaseResourceURLs()
  resourceGallery.replaceChildren()
  if (appState.resourceInspectorMode === "style") {
    void renderStyleResourceGallery()
    return
  }
  if (appState.resourceInspectorMode === "sound") {
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
  const paths = resourceImagePaths(appState.archive.names(), theme.value, orientation.value)
    .filter((path) => !query || path.toLowerCase().includes(query))
  const bdaUsageCounts = appState.archive.format === "bda" ? bdaImageUsageCounts() : new Map<string, number>()
  resourceCount.textContent = `${paths.length} 张图片`
  resourceListView.hidden = Boolean(appState.selectedResourcePath) && !document.body.classList.contains("atlas-workspace")
  resourceDetail.hidden = !appState.selectedResourcePath
  for (const path of paths) {
    const bytes = appState.archive.getBytes(path)
    if (!bytes) continue
    const copy = new Uint8Array(bytes.byteLength)
    copy.set(bytes)
    const url = URL.createObjectURL(new Blob([copy.buffer], { type: "image/png" }))
    appState.resourceURLs.push(url)
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
    const hasTil = appState.archive.isText(path.replace(/\.png$/i, ".til"))
    const bdaUsageCount = bdaUsageCounts.get(bdaImageResourceID(path)) ?? 0
    meta.textContent = appState.archive.format === "bda"
      ? bdaUsageCount ? `${bdaUsageCount} 个样式引用` : "未被外观引用"
      : hasTil ? "TIL" : "无 TIL"
    image.addEventListener("load", () => {
      meta.textContent = `${image.naturalWidth} × ${image.naturalHeight} · ${meta.textContent}`
    })
    button.append(image, name, meta)
    button.addEventListener("click", () => {
      selectGalleryItem(path, resourceGallery)
      selectResourceImage(path)
    })
    resourceGallery.append(button)
  }
  // Restore selection state after re-render
  if (appState.selectedResourceGalleryPath) {
    for (const item of resourceGallery.querySelectorAll<HTMLElement>(".resource-item")) {
      item.classList.toggle("selected", item.dataset.path === appState.selectedResourceGalleryPath)
    }
  }
  updateResourceActionButtons()
  syncAtlasWorkspace()
}

function showResourceList(): void {
  resourceListView.hidden = false
  resourceDetail.hidden = true
  resourceInspector.scrollTop = 0
  if (appState.resourceInspectorMode === "style") {
    appState.selectedStyleID = ""
    renderResourceInspector()
    return
  }
  setDrawingTile(false)
  appState.movingTile = undefined
  appState.selectedTileIndex = undefined
  if (appState.selectedDocument) setSourceValue(appState.selectedDocument.toString())
  sourceName.textContent = appState.selectedPath
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
  void source.load()
    .then(() => requestAnimationFrame(() => {
      source.requestMeasure()
      scrollSelectedSource()
      updateSourceHighlight()
    }))
    .catch((error) => showError(error, "加载源码编辑器"))
}

workspaceImage.addEventListener("load", clearImagePreviewError)
workspaceImage.addEventListener("error", showImagePreviewError)

function updateInspectorView(): void {
  syncAtlasWorkspace()
  inspectorBackButton.hidden = appState.resourceConfigActive || Boolean(appState.archive?.isImage(appState.selectedPath)) || appState.inspectorTab === "ai"
  const imageSelected = Boolean(appState.archive?.isImage(appState.selectedPath))
  const overviewSelected = Boolean(
    files.querySelector(`.sidebar-overview button[data-path="${CSS.escape(appState.selectedPath)}"]`),
  )
  const layoutSelected = appState.selectedPath === appState.layoutPath && /\.ini$/i.test(appState.selectedPath)
  // ini/cnd/pop 布局配置文档自带属性面板，无需依赖概览分组；其余文本仍要求来自概览或当前布局。
  const configLayoutSelected = showsLayoutProperties(appState.selectedPath)
  const propertiesAvailable = Boolean(
    appState.selectedPath && (
      appState.archive?.isText(appState.selectedPath) || appState.archive?.isBdaConfig(appState.selectedPath) || isBdaLayoutPath(appState.selectedPath) ||
      bdaAppearancePart(appState.selectedPath)
    ) && (configLayoutSelected || overviewSelected || layoutSelected) && !imageSelected,
  )
  for (const button of inspectorTabButtons) {
    const tab = button.dataset.inspectorTab
    const available = appState.resourceConfigActive
      ? tab === "ai" || tab === "properties" || tab === "source" && Boolean(appState.selectedPath) && !(
        appState.archive?.format === "bda" && appState.resourceInspectorMode === "image"
      )
      :
      tab === "ai"
        ? true
        : tab === "properties"
        ? imageSelected || propertiesAvailable
        : !imageSelected && Boolean(appState.selectedPath)
    button.disabled = !available
    button.classList.toggle("active", tab === appState.inspectorTab && available)
    button.setAttribute("aria-pressed", String(tab === appState.inspectorTab && available))
  }
  if (appState.resourceConfigActive) {
    sourceName.textContent = appState.inspectorTab === "source" && appState.selectedResourcePath
      ? appState.archive?.format === "bda" ? "BDA 切片由 appearanceConfig 管理" : appState.tilePath
      : appState.selectedResourcePath || appState.selectedPath
    quickInspector.hidden = true
    asset.hidden = true
    resourceInspector.hidden = appState.inspectorTab !== "properties"
    sourceEditor.hidden = appState.inspectorTab !== "source"
    aiDesignPanel.hidden = appState.inspectorTab !== "ai"
    updateSourceFindVisibility()
    loadVisibleSourceEditor()
    return
  }
  resourceInspector.hidden = true
  if (imageSelected) {
    quickInspector.hidden = true
    sourceEditor.hidden = true
    aiDesignPanel.hidden = appState.inspectorTab !== "ai"
    asset.hidden = appState.inspectorTab === "ai"
    updateSourceFindVisibility()
    return
  }
  asset.hidden = true
  quickInspector.hidden = appState.inspectorTab !== "properties" || !propertiesAvailable
  sourceEditor.hidden = appState.inspectorTab !== "source"
  aiDesignPanel.hidden = appState.inspectorTab !== "ai"
  updateSourceFindVisibility()
  loadVisibleSourceEditor()
}

function syncSourceFindBarOffset(): void {
  // 悬浮按钮始终贴在搜索栏上方，避免被底部弹出的搜索栏盖住。
  const height = sourceToolbar.hidden ? 0 : sourceToolbar.offsetHeight
  sourceEditor.style.setProperty("--source-find-bar-height", `${height}px`)
}

function updateSourceFindVisibility(): void {
  // 圆形查找按钮悬浮在源代码右下角，点击后底部弹出搜索栏；Ctrl/Cmd + F 也可唤出。
  const sourceVisible = !sourceEditor.hidden
  const expanded = sourceVisible && appState.sourceFindVisible
  sourceFindToggle.hidden = !sourceVisible
  sourceFindToggle.setAttribute("aria-pressed", String(expanded))
  sourceFindToggle.setAttribute("aria-expanded", String(expanded))
  sourceFindToggle.title = sourceFindToggle.ariaLabel = appState.sourceFindVisible ? "收起查找" : "查找（Ctrl/⌘ + F）"
  sourceToolbar.hidden = !expanded
  syncSourceFindBarOffset()
}

function openSourceFind(): void {
  if (sourceEditor.hidden) return
  appState.sourceFindVisible = true
  updateSourceFindVisibility()
  sourceSearch.focus()
  sourceSearch.select()
}

function closeSourceFind(): void {
  if (!appState.sourceFindVisible) return
  appState.sourceFindVisible = false
  updateSourceFindVisibility()
  sourceFindToggle.focus()
}

const SOURCE_SEARCH_HIGHLIGHT_LIMIT = 20_000

function scheduleSourceInputHighlight(refreshInspector = false): void {
  appState.sourceInputRefreshPending ||= refreshInspector
  if (appState.sourceInputHighlightTimer !== undefined) window.clearTimeout(appState.sourceInputHighlightTimer)
  appState.sourceInputHighlightTimer = window.setTimeout(() => {
    appState.sourceInputHighlightTimer = undefined
    updateSourceHighlight()
  }, 100)
}

function scheduleSourceSearch(): void {
  if (appState.sourceSearchTimer !== undefined) window.clearTimeout(appState.sourceSearchTimer)
  appState.sourceSearchTimer = window.setTimeout(() => {
    appState.sourceSearchTimer = undefined
    updateSourceHighlight()
  }, 80)
}

function updateSourceHighlight(): void {
  if (appState.sourceSearchTimer !== undefined) window.clearTimeout(appState.sourceSearchTimer)
  appState.sourceSearchTimer = undefined
  if (appState.sourceInputHighlightTimer !== undefined) window.clearTimeout(appState.sourceInputHighlightTimer)
  appState.sourceInputHighlightTimer = undefined
  if (appState.sourceInputRefreshPending) {
    appState.sourceInputRefreshPending = false
    refreshPreview()
    populateKeyInspector()
  }
  const sections = selectedSourceSections()
  const query = sourceSearch.value.trim()
  const bdaSource = Boolean(appState.archive?.format === "bda" && (
    appState.archive.isBdaConfig(appState.selectedPath) || isBdaVirtualTextPath(appState.selectedPath) || isBdaAppearancePartPath(appState.selectedPath)
  ))
  source.setLanguage(bdaSource ? "json" : "ini")
  const matches = sourceSearchMatches()
  updateSourceSearchStatus(matches)
  const selectedRanges = bdaSource
    ? jsonPropertyRanges(source.value, selectedBdaSourceKeys())
    : sections.length ? iniSectionRanges(source.value, sections) : appState.sourceHistoryHighlight ? [appState.sourceHistoryHighlight] : []
  const searchRanges = matches.slice(0, SOURCE_SEARCH_HIGHLIGHT_LIMIT)
    .map((start) => [start, start + query.length] as const)
  const activeStart = matches[appState.sourceSearchIndex]
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
  if (appState.sourceSearchIndex >= matches.length) appState.sourceSearchIndex = -1
  sourceSearchCount.textContent = sourceSearch.value.trim()
    ? `${appState.sourceSearchIndex < 0 ? 0 : appState.sourceSearchIndex + 1}/${matches.length}`
    : ""
  sourceSearchPrevious.disabled = sourceSearchNext.disabled = !matches.length
  const replaceable = Boolean(matches.length) && !source.disabled && !source.readOnly
  sourceReplacement.disabled = sourceReplace.disabled = sourceReplaceAll.disabled = !replaceable
}

function findSourceMatch(direction: 1 | -1): void {
  const matches = sourceSearchMatches()
  if (!matches.length) {
    appState.sourceSearchIndex = -1
    updateSourceHighlight()
    return
  }
  appState.sourceSearchIndex = appState.sourceSearchIndex < 0
    ? direction > 0 ? 0 : matches.length - 1
    : (appState.sourceSearchIndex + direction + matches.length) % matches.length
  const start = matches[appState.sourceSearchIndex]
  source.setSelectionRange(start, start + sourceSearch.value.trim().length)
  updateSourceHighlight()
}

function replaceSourceMatches(replaceAll: boolean): void {
  const query = sourceSearch.value.trim()
  const matches = sourceSearchMatches()
  if (!query || !matches.length || source.disabled || source.readOnly) return
  const index = appState.sourceSearchIndex < 0 ? 0 : appState.sourceSearchIndex
  source.value = replaceTextMatches(source.value, query, sourceReplacement.value, replaceAll ? undefined : index)
  appState.sourceSearchIndex = replaceAll ? -1 : index
  source.dispatchEvent(new Event("input", { bubbles: true }))
  if (appState.archive?.isBdaConfig(appState.selectedPath) || isBdaAppearancePartPath(appState.selectedPath)) commitBdaSourceEdit()
  if (!replaceAll) findSourceMatch(1)
}

function selectedSourceSections(): string[] {
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

function currentSkinState(): number | undefined {
  return skinState.value ? Number(skinState.value) : undefined
}

function effectiveKeySection(section: string): string {
  if (!appState.layoutDocument || isListCell(section)) return section
  return effectivePanelSection(appState.layoutDocument, section, currentSkinState())
}

function effectiveSelectedSections(): string[] {
  return appState.selectedKeySections.map(effectiveKeySection)
}

function effectiveToolbarSections(): string[] {
  if (!appState.selectedDocument) return appState.selectedToolbarSections
  return [...new Set(appState.selectedToolbarSections.flatMap((section) => {
    const effective = effectivePanelSection(appState.selectedDocument!, section, currentSkinState())
    return effective === section ? [section] : [section, effective]
  }))]
}

function effectiveKeyValue(section: string, key: string): string | undefined {
  if (!appState.layoutDocument) return
  const effective = effectiveKeySection(section)
  return appState.layoutDocument.get(effective, key) ?? appState.layoutDocument.get(section, key)
}

function scrollSelectedSource(): void {
  const sections = selectedSourceSections()
  const bdaKeys = selectedBdaSourceKeys()
  if (sourceEditor.hidden || !sections.length && !bdaKeys.length && !appState.sourceHistoryHighlight) return
  const bdaRange = jsonPropertyRanges(source.value, bdaKeys)[0]
  const iniRange = iniSectionRanges(source.value, sections)[0]
  const range = bdaRange ?? iniRange ?? appState.sourceHistoryHighlight
  if (range) source.revealRange(range[0], range[1])
}

function setSourceValue(text: string): void {
  if (deferNumberInputRefresh(setSourceValue, () => setSourceValue(text))) return
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
  return candidates.find((path) => appState.archive?.names().includes(path)) ?? candidates[0]
}

function legacyAnimationConfigPath(): string | undefined {
  return [
    `${theme.value}/skin/${orientation.value}/anim.ini`,
    `${theme.value}/skin/${orientation.value}/res/anim.ini`,
    `${theme.value}/skin/res/anim.ini`,
  ].find((path) => appState.archive?.isText(path))
}

function genConfigPath(): string {
  return currentConfigPath("gen.ini")
}

// LIST 候选栏单元的几何（POS/CELL_SIZE）可能定义在布局自身或 gen.ini（候选栏几何通常全局共享）
function listGeometryDocument(): { document: IniDocument; path: string } | undefined {
  if (!appState.archive || !appState.layoutDocument) return
  if (appState.layoutDocument.get("LIST", "POS") !== undefined || appState.layoutDocument.get("LIST", "CELL_SIZE") !== undefined) {
    return { document: appState.layoutDocument, path: appState.layoutPath }
  }
  const path = genConfigPath()
  if (appState.archive.isText(path)) return { document: IniDocument.parse(appState.archive.getText(path)), path }
  return { document: appState.layoutDocument, path: appState.layoutPath }
}

function isSkinInfoPath(path: string): boolean {
  return /(^|\/)Info\.txt$/i.test(path)
}

function isToolbarPath(path: string): boolean {
  return /\.cnd$/i.test(path)
}

/** INI / CND / POP 是属性面板能描述并回写的布局配置文档。 */
function isConfigLayoutPath(path: string): boolean {
  return /\.(ini|cnd|pop)$/i.test(path)
}

/**
 * 普通皮肤（bds/bdi）里所有布局文档都自带属性面板。
 * BDA 容器内的同名遗留文件由 bda 解析器处理，不能按普通布局文档放行。
 */
function showsLayoutProperties(path: string): boolean {
  return appState.archive?.format !== "bda" && isConfigLayoutPath(path)
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

function toolbarConfigPath(): string | undefined {
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
  toolbarPreview.setMode(isEditing() ? "edit" : "preview")
  return { width, height, inputHeight }
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

function openSourceColorPicker(range: SourceEditorValueClick): void {
  const clean = range.value.trim().replace(/^#/, "")
  if (range.kind !== "color" || !/^[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(clean)) return
  appState.sourceColorPickerTarget = range
  sourceColorPicker.value = `#${(clean.length === 8 ? clean.slice(2) : clean).toLowerCase()}`
  sourceColorPicker.title = range.label ?? `颜色 ${range.value}`
  sourceColorPicker.style.left = `${Math.max(0, Math.min(window.innerWidth - 1, range.anchor.left))}px`
  sourceColorPicker.style.top = `${Math.max(0, Math.min(window.innerHeight - 1, range.anchor.bottom))}px`
  try {
    sourceColorPicker.showPicker()
  } catch {
    sourceColorPicker.click()
  }
}

function applySourceColorPicker(): void {
  const target = appState.sourceColorPickerTarget
  appState.sourceColorPickerTarget = undefined
  if (!target || source.disabled || source.readOnly) return
  if (source.value.slice(target.from, target.to) !== target.value) return
  const next = replacedSourceColor(target.value, sourceColorPicker.value)
  if (!next) return
  source.replaceRange(target.from, target.to, next)
  source.commit()
}

function showStyleImageDialog(): void {
  if (!styleImageDialog.open) styleImageDialog.showModal()
}

/** Jumps to a style's definition: the slice picker's target, or `styleID` when given (source Command/Ctrl click). */
function openSourceStyleDefinition(styleID = ""): void {
  const target = styleID ? undefined : appState.pickerTarget
  if (!appState.archive || !styleID && (!target?.path || !target.sections?.length)) return
  const ref = appState.archive.format === "bda" ? bdaStyleRef(styleID) : undefined
  const path = target?.path ?? (ref ? bdaAppearanceStylePath(`${ref.type}Styles`) : styleConfigPath())
  const sections = target?.sections
  clearImageSlicePicker()
  selectFile(path, "source")
  const range = sections?.length
    ? iniSectionRanges(source.value, sections)[0]
    : ref
    ? jsonPropertyRanges(source.value, [String(ref.key)])[0]
    : iniSectionRanges(source.value, [`STYLE${styleID}`])[0]
  if (range) source.setSelectionRange(range[0], range[1])
  if (mobilePortraitQuery.matches) setMobilePane("inspector")
  void source.load().then(() => source.focus())
}
sourceStyleProxy.hidden = true
document.body.append(sourceStyleProxy)
sourceStyleProxy.addEventListener("change", () => {
  const target = appState.sourceStyleProxyTarget
  if (!target || source.disabled || source.readOnly) return
  if (source.value.slice(target.from, target.to) !== target.value) return
  const next = replacedSourceStyle(target.value, sourceStyleProxy.value.split(",")[0]?.trim() ?? "")
  if (!next) return
  source.replaceRange(target.from, target.to, next)
  appState.sourceStyleProxyTarget = { ...target, to: target.from + next.length, value: next }
  source.commit()
})

function openSourceStylePicker(range: SourceEditorValueRange): void {
  if (range.kind !== "style") return
  const styleID = range.value.replace(/^STYLE/i, "")
  appState.sourceStyleProxyTarget = range
  sourceStyleProxy.value = styleID
  const key = (range.key ?? "STYLE").replace(/([a-z0-9])([A-Z])/g, "$1_$2").toUpperCase()
  sourceStyleProxy.dataset.documentStyleKey = key
  const type = appState.archive?.format === "bda" ? bdaStyleRef(styleID)?.type : undefined
  if (type) sourceStyleProxy.dataset.bdaStyleType = type
  else delete sourceStyleProxy.dataset.bdaStyleType
  sourceStyleProxy.disabled = source.disabled || source.readOnly || !isEditing()
  // 与检查器缩略图一致：图片样式进切片选择器（可在其中切到全部样式），声音样式直接进样式库。
  if (key === "SOUND_STYLE") openStylePicker(sourceStyleProxy)
  else void openStyleReferenceStateImage(sourceStyleProxy, key, false)
}
const styleReferenceDrawIDs = new WeakMap<HTMLElement, number>()

function styleReferenceKey(input: HTMLInputElement): string {
  return input.dataset.keyboardField ?? input.dataset.toolbarField ?? input.dataset.keyField ?? input.dataset.documentStyleKey ?? ""
}

function isStyleReferenceKey(key: string): boolean {
  if (key === "STAT_STYLE") return false
  return key === "styleID" || /(?:^|\.)(?:[A-Z0-9_]*STYLE|FIRST_BACK|FIRST_FORE)$/i.test(key)
}

function soundPathForStyle(styleID: string): string | undefined {
  if (!appState.archive) return
  const path = styleConfigPath()
  if (!appState.archive.isText(path)) return
  const filename = IniDocument.parse(appState.archive.getText(path)).get(`STYLE${styleID}`, "PRESS_SOUND_PATH")?.trim()
  return filename ? soundPathForFilename(appState.archive.names(), theme.value, orientation.value, filename) : undefined
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
  if (soundStyle) {
    const soundMain = document.createElement("span")
    soundMain.className = "sound-style-main"
    soundMain.setAttribute("role", "button")
    soundMain.tabIndex = 0
    soundMain.setAttribute("aria-label", "播放按键音效")
    const musicIcon = createIcon("music", 13)
    musicIcon.classList.add("sound-style-main-icon")
    const soundMeta = document.createElement("span")
    soundMeta.className = "sound-style-main-meta"
    const soundTitle = document.createElement("strong")
    soundTitle.className = "sound-style-name"
    const soundSubtitle = document.createElement("small")
    soundSubtitle.className = "sound-style-file"
    soundMeta.append(soundTitle, soundSubtitle)
    input.classList.add("sound-style-value")
    input.tabIndex = -1
    input.setAttribute("aria-hidden", "true")
    soundMain.append(musicIcon, soundMeta, input)
    const playCurrent = () => {
      const path = soundPathForStyle(input.value.split(",")[0]?.trim() ?? "")
      if (path) playSoundPath(path)
    }
    soundMain.addEventListener("click", playCurrent)
    soundMain.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); playCurrent() }
    })
    const play = document.createElement("button")
    play.type = "button"
    play.className = "inspector-sound-play"
    play.setAttribute("aria-label", "播放按键音效")
    play.append(createIcon("play", 12))
    play.addEventListener("click", playCurrent)
    wrapper.append(soundMain, play)
  } else {
    wrapper.append(input)
  }
  const button = document.createElement(soundStyle ? "button" : "span")
  if (button instanceof HTMLButtonElement) button.type = "button"
  button.className = "style-picker-trigger"
  button.classList.toggle("sound-style-trigger", soundStyle)
  if (soundStyle) {
    button.title = "点击更换样式；Command/Ctrl 点击编辑样式"
    button.setAttribute("aria-label", "更换或编辑引用样式")
    button.append(createIcon("ellipsis", 14))

  }
  if (button instanceof HTMLButtonElement) button.addEventListener("click", (event) => {
    if (event.metaKey || event.ctrlKey) openStyleReferenceEditor(input.value.split(",")[0]?.trim() ?? "")
    else openStylePicker(input)
  })
  input.addEventListener("input", () => void refreshStyleReferenceThumbnail(button, input, key))
  input.addEventListener("change", () => void refreshStyleReferenceThumbnail(button, input, key))
  void refreshStyleReferenceThumbnail(button, input, key)
  wrapper.append(button)
  if (soundStyle) void refreshStyleReferenceThumbnail(button, input, key)
}

function renderStyleReferenceRows(button: HTMLElement, input: HTMLInputElement, key: string): string[] {
  const styleIDs = input.value.split(",").map((value) => value.trim()).filter(Boolean)
  for (const canvas of Array.from(button.querySelectorAll("canvas"))) styleStateCanvasObserver.unobserve(canvas)
  button.replaceChildren()
  const styles = styleConfigDocument()
  for (const [styleIndex, styleID] of (styleIDs.length ? styleIDs : [""]).entries()) {
    const rowInput = () => {
      const target = input.cloneNode(false) as HTMLInputElement
      target.value = styleID
      target.addEventListener("change", () => {
        const values = input.value.split(",").map((value) => value.trim()).filter(Boolean)
        values[styleIndex] = target.value
        input.value = values.join(",")
        input.dispatchEvent(new Event("input", { bubbles: true }))
        input.dispatchEvent(new Event("change", { bubbles: true }))
      })
      return target
    }
    const wrapper = document.createElement("div")
    wrapper.className = "style-reference-row"
    const numberInput = rowInput()
    numberInput.className = "style-reference-number"
    numberInput.removeAttribute("id")
    numberInput.setAttribute("aria-label", `样式 ${styleIndex + 1} 编号`)
    const previews = document.createElement("span")
    previews.className = "style-picker-states"
    for (let index = 0; index < 2; index += 1) {
      const item = document.createElement("button")
      const highlighted = index === 1
      item.type = "button"
      item.className = "style-picker-state"
      item.dataset.styleState = highlighted ? "highlighted" : "normal"
      // 预览图就是该状态引用的图片，点击它进入这张图片的切片选择器；
      // 更换引用的样式挪到 Alt 点击，编号框仍可直接输入。
      item.title = `点击选择${highlighted ? "按下" : "正常"}图片切片；Alt 点击更换样式；Command/Ctrl 点击编辑样式`
      item.setAttribute("aria-label", item.title)
      const canvas = retinaThumbnail(document.createElement("canvas"), 152, 76)
      canvas.setAttribute("aria-hidden", "true")
      item.append(canvas)
      item.addEventListener("click", (event) => {
        if (event.metaKey || event.ctrlKey) openStyleReferenceEditor(styleID)
        else if (event.altKey) openStylePicker(rowInput(), highlighted)
        else void openStyleReferenceStateImage(rowInput(), key, highlighted)
      })
      previews.append(item)
    }
    wrapper.append(numberInput, previews)
    if (styleID) wrapper.append(styleKindBadge(styleKind(styleID, styles)))
    button.append(wrapper)
  }
  return styleIDs
}

function styleReferenceForeground(key: string): boolean {
  return /FORE|INPUT_STYLE|SCAND_STYLE|CELL_STYLE/.test(key)
}

async function refreshStyleReferenceThumbnail(
  button: HTMLElement,
  input: HTMLInputElement,
  key: string,
  resolver = visualResolver(),
): Promise<void> {
  const drawID = (styleReferenceDrawIDs.get(button) ?? 0) + 1
  styleReferenceDrawIDs.set(button, drawID)
  if (key === "SOUND_STYLE") {
    const styleID = input.value.split(",")[0]?.trim() ?? ""
    const path = soundPathForStyle(styleID)
    const main = button.parentElement?.querySelector<HTMLElement>(".sound-style-main")
    const title = main?.querySelector<HTMLElement>(".sound-style-name")
    const file = main?.querySelector<HTMLElement>(".sound-style-file")
    if (title) title.textContent = path?.split("/").pop() || (styleID ? `STYLE${styleID}` : "未选择音效")
    if (file) file.textContent = path ? `STYLE${styleID} · 点击试听` : "选择一个音乐文件"
    const play = button.parentElement?.querySelector<HTMLButtonElement>(".inspector-sound-play")
    if (play) play.disabled = !path
    if (main) {
      main.classList.toggle("has-sound", Boolean(path))
      main.setAttribute("aria-disabled", String(!path))
    }
    button.classList.toggle("has-sound", Boolean(path))
    return
  }
  const styleIDs = renderStyleReferenceRows(button, input, key)
  const canvases = Array.from(button.querySelectorAll<HTMLCanvasElement>("canvas"))
  if (canvases.length < 2 || !resolver || !styleIDs.length) {
    for (const canvas of canvases) {
      const context = canvas.getContext("2d")
      context?.clearRect(0, 0, canvas.width, canvas.height)
    }
    return
  }
  const visuals = await Promise.all(styleIDs.flatMap((styleID) =>
    [false, true].map((highlighted) => resolver.resolve(styleID, highlighted).catch(() => undefined)),
  ))
  if (drawID !== styleReferenceDrawIDs.get(button)) return
  // Unresolved visuals may resolve later; let the next refresh retry them.
  if (visuals.some((visual) => !visual)) styleReferenceThumbnailInputs.delete(button)
  const foreground = styleReferenceForeground(key)
  visuals.forEach((visual, index) => {
    const canvas = canvases[index]
    styleStateVisuals.set(canvas, { visual, foreground })
    // 量不到尺寸（所在分组隐藏）时先用现有位图绘制，保证切回该分组时不出现空白预览。
    if (!sizeStyleStateCanvas(canvas)) drawVisualPreview(canvas, [visual], foreground)
    styleStateCanvasObserver.observe(canvas)
  })
}

const styleStateVisuals = new WeakMap<HTMLCanvasElement, { visual: Visual | undefined; foreground: boolean }>()
const styleStateCanvasSizes = new WeakMap<HTMLCanvasElement, string>()

/*
 * 缩略图按卡片的实际尺寸绘制：固定 152×76 的宽扁画布经过 object-fit: contain 后只剩卡片
 * 一半高度，图案显得又小又扁。改用卡片内容盒尺寸作为位图尺寸，样式图才能铺满卡片高度。
 */
function sizeStyleStateCanvas(canvas: HTMLCanvasElement): boolean {
  const { width, height } = canvas.getBoundingClientRect()
  if (width < 1 || height < 1) return false
  const size = `${Math.round(width)}x${Math.round(height)}`
  if (styleStateCanvasSizes.get(canvas) === size) return false
  styleStateCanvasSizes.set(canvas, size)
  retinaThumbnail(canvas, width, height)
  const meta = styleStateVisuals.get(canvas)
  if (meta) drawVisualPreview(canvas, [meta.visual], meta.foreground)
  return true
}

/** 分组切换后为之前量不到尺寸的缩略图补一次按尺寸重绘。 */
function redrawStyleStateCanvases(): void {
  for (const canvas of Array.from(document.querySelectorAll<HTMLCanvasElement>(".style-reference-row canvas"))) {
    sizeStyleStateCanvas(canvas)
  }
}

/** 面板宽度变化（选中态切换、窗口缩放）后按新尺寸重绘，避免位图与卡片比例不符。 */
const styleStateCanvasObserver = new ResizeObserver((entries) => {
  for (const entry of entries) {
    const canvas = entry.target
    if (!(canvas instanceof HTMLCanvasElement)) continue
    // 被重建替换掉的画布不再需要重绘，及时解绑，避免观察器长期持有已分离的位图。
    if (!canvas.isConnected) {
      styleStateCanvasObserver.unobserve(canvas)
      styleStateVisuals.delete(canvas)
      styleStateCanvasSizes.delete(canvas)
      continue
    }
    sizeStyleStateCanvas(canvas)
  }
})

function styleWriteTarget(
  source: "BACK_STYLE" | "FORE_STYLE",
  property: "NM_IMG" | "HL_IMG",
  styleIDs: string[],
): StyleImagePickerTarget {
  if (appState.archive?.format === "bda") return { source, property }
  const path = styleConfigPath()
  if (!appState.archive?.isText(path)) return { source, property }
  const document = IniDocument.parse(appState.archive.getText(path))
  const sections = [...new Set(styleIDs.flatMap((token) => {
    const value = Number(token)
    return [`STYLE${token}`, source === "FORE_STYLE" && Number.isFinite(value) ? `STYLE${Math.floor(value / 100)}` : ""]
  }).filter((section) => section && document.sections().includes(section)))]
  return sections.length ? { source, property, document, path, sections } : { source, property }
}

function pairedBackgroundStyleID(input: HTMLInputElement, key: string): string | undefined {
  const backgroundKey = key.replace(/FORE_STYLE$/, "BACK_STYLE").replace(/FIRST_FORE$/, "FIRST_BACK")
  if (backgroundKey === key) return
  const fields = input.dataset.keyField !== undefined
    ? keyFields
    : input.dataset.toolbarField !== undefined
      ? toolbarFields
      : input.dataset.keyboardField !== undefined
        ? keyboardFields
        : []
  return fields.find((field) => styleReferenceKey(field) === backgroundKey)?.value.split(",")[0]?.trim()
}

async function openStyleReferenceStateImage(
  input: HTMLInputElement,
  key: string,
  highlighted: boolean,
): Promise<void> {
  if (input.disabled) return
  const resolver = visualResolver()
  if (!resolver) return
  const foreground = styleReferenceForeground(key)
  const source: "BACK_STYLE" | "FORE_STYLE" = foreground ? "FORE_STYLE" : "BACK_STYLE"
  const property = highlighted ? "HL_IMG" : "NM_IMG"
  let styleIDs = input.value.split(",").map((value) => value.trim()).filter(Boolean)
  let targetSource = source
  let visual = (await Promise.all(styleIDs.map((styleID) => resolver.resolve(styleID, highlighted).catch(() => undefined))))
    .find((item) => item?.imagePath)
  // 颜色 / 动画样式没有图片可切，改为在样式库里更换引用的样式；不能回退去改背景图片。
  if (!visual && styleIDs.some((styleID) => ["color", "anim"].includes(styleKind(styleID)))) return openStylePicker(input, highlighted)
  if (!visual && foreground) {
    const backgroundID = pairedBackgroundStyleID(input, key)
    if (backgroundID) {
      styleIDs = [backgroundID]
      targetSource = "BACK_STYLE"
      visual = await resolver.resolve(backgroundID, highlighted).catch(() => undefined)
    }
  }
  const target = styleWriteTarget(targetSource, property, styleIDs)
  appState.stylePickerTarget = input
  appState.styleLibraryHighlighted = highlighted
  if (visual?.imagePath) openImageSlicePicker(visual.imagePath, target, visual.source)
  else openStyleImageResourceChooser(target)
}

function openStyleReferenceEditor(styleID: string): void {
  if (!styleID || !availableStyleIDs().includes(styleID) || !appState.archive) return
  const returnPath = appState.selectedPath
  const returnSelection = [...appState.selectedKeySections]
  const returnCandidate = appState.selectedCandidate
  const returnScrollTop = quickInspector.scrollTop
  const returnInspectorGroup = quickInspector.dataset.mobileInspectorGroup ?? ""
  if (appState.archive.format === "bda") {
    const ref = bdaStyleRef(styleID)
    if (!ref) return
    const group = `${ref.type}Styles` as BdaAppearanceStyleGroup
    const path = bdaAppearanceStylePath(group)
    selectFile(path, "overview", "style")
    appState.styleReturnPath = returnPath === path ? "" : returnPath
    appState.styleReturnSelection = returnSelection
    appState.styleReturnCandidate = returnCandidate
    appState.styleReturnScrollTop = returnScrollTop
    appState.styleReturnInspectorGroup = returnInspectorGroup
    selectStyleResource(String(ref.key))
    return
  }
  const path = styleConfigPath()
  if (!appState.archive.isText(path)) return
  selectFile(path, "overview", "style")
  appState.styleReturnPath = returnPath === path ? "" : returnPath
  appState.styleReturnSelection = returnSelection
  appState.styleReturnScrollTop = returnScrollTop
  appState.styleReturnInspectorGroup = returnInspectorGroup
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
  return appState.archive?.format === "bda" ? String(bdaStyleRef(styleID)?.key ?? styleID) : styleID
}

function availableStyleIDs(): string[] {
  if (!appState.archive) return []
  if (appState.archive.format === "bda") {
    const appearance = currentBdaAppearance()?.appearance
    if (!appearance) return []
    return [
      ...[...appearance.imageStyles.keys()].map((key) => bdaStyleID({ type: "image", key })),
      ...[...appearance.colorStyles.keys()].map((key) => bdaStyleID({ type: "color", key })),
      ...[...appearance.textStyles.keys()].map((key) => bdaStyleID({ type: "text", key })),
    ]
  }
  const path = styleConfigPath()
  if (!appState.archive.isText(path)) return []
  return IniDocument.parse(appState.archive.getText(path)).sections()
    .flatMap((section) => section.match(/^STYLE(\d+)$/)?.[1] ?? [])
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
}
const styleKinds: Record<StyleKind, { label: string; icon: string }> = {
  image: { label: "图片", icon: "images" },
  color: { label: "颜色", icon: "palette" },
  anim: { label: "动画", icon: "clapperboard" },
  text: { label: "文字", icon: "type" },
  sound: { label: "声音", icon: "volume-2" },
  empty: { label: "空", icon: "square-dashed" },
}

/** 按样式内容判定类型：有图即图片样式，其次动画、颜色、声音，只剩文字属性的归为文字样式。 */
function styleKind(styleID: string, styles = styleConfigDocument()): StyleKind {
  if (appState.archive?.format === "bda") return bdaStyleRef(styleID)?.type ?? "empty"
  const keys = new Set(styles?.entries(`STYLE${styleID}`).filter((entry) => entry.value.trim()).map((entry) => entry.key) ?? [])
  const has = (pattern: RegExp) => [...keys].some((key) => pattern.test(key))
  if (has(/^(?:NM|HL)_IMG$/)) return "image"
  if (has(/ANIM|^EVENT\d+$/)) return "anim"
  if (has(/^(?:NM|HL)_COLOR$/)) return "color"
  if (keys.has("PRESS_SOUND_PATH")) return "sound"
  return keys.size ? "text" : "empty"
}

function styleConfigDocument(): IniDocument | undefined {
  const path = styleConfigPath()
  return appState.archive?.isText(path) ? IniDocument.parse(appState.archive.getText(path)) : undefined
}

/** 样式类型徽标：样式库、检查器缩略图、样式配置列表共用，保证同一类型处处同一图标与文字。 */
function styleKindBadge(kind: StyleKind): HTMLElement {
  const badge = document.createElement("span")
  badge.className = "style-kind-badge"
  badge.dataset.styleKind = kind
  badge.title = `${styleKinds[kind].label}样式`
  badge.append(createIcon(styleKinds[kind].icon, 11), styleKinds[kind].label)
  return badge
}

/** 由引用字段推断应优先展示的样式类型，打开样式库时据此预选筛选。 */
function styleKindForKey(key: string): StyleKind | "all" {
  if (/ANIM_STYLE$/.test(key)) return "anim"
  if (key === "HW_FORE_STYLE") return "color"
  return "all"
}

function styleLibraryCategories(styleID: string): Set<string> {
  const categories = new Set<string>()
  for (const { section, key, value } of appState.layoutDocument?.entries() ?? []) {
    if (!isStyleReferenceKey(key) || !value.split(",").map((value) => value.trim()).includes(styleID)) continue
    if (/CAND|INPUT|CELL/.test(section + key)) categories.add("candidate")
    else if (styleReferenceForeground(key)) categories.add("foreground")
    else if (section === "PANEL") categories.add("panel")
    else categories.add("key")
  }
  return categories
}

function applyStyleLibrarySelection(): void {
  const target = appState.stylePickerTarget
  const selected = appState.styleLibrarySelected
  if (!target || target.disabled || !selected || !isEditing()) return
  if (selected.styleID) {
    const ref = bdaStyleRef(selected.styleID)
    if (target.dataset.bdaStyleType && ref?.type !== target.dataset.bdaStyleType) return
    target.value = selected.styleID
    target.dispatchEvent(new Event("input", { bubbles: true }))
    target.dispatchEvent(new Event("change", { bubbles: true }))
    closeStylePicker()
  } else if (selected.imagePath) {
    const styleID = target.value.split(",")[0]?.trim() ?? ""
    if (appState.archive?.format === "bda") {
      const ref = bdaStyleRef(styleID)
      if (ref?.type !== "image") return
      if (updateBdaRefs([ref], appState.styleLibraryHighlighted ? "HL_IMG" : "NM_IMG", bdaImageResourceID(selected.imagePath))) {
        closeStylePicker()
        void refreshStyleReferenceThumbnails()
      }
    } else {
      stylePickerDialog.close()
      openImageSlicePicker(selected.imagePath, styleWriteTarget(styleReferenceForeground(styleReferenceKey(target)) ? "FORE_STYLE" : "BACK_STYLE", appState.styleLibraryHighlighted ? "HL_IMG" : "NM_IMG", [styleID]))
    }
  }
}

function previewStyleLibraryItem(
  button: HTMLButtonElement,
  selected: { styleID?: string; imagePath?: string },
  visuals: Array<Visual | undefined> = [],
): void {
  appState.styleLibrarySelected = selected
  stylePickerGrid.querySelectorAll(".previewing").forEach((item) => item.classList.remove("previewing"))
  button.classList.add("previewing")
  styleLibraryPreviewImage.replaceChildren()
  if (selected.imagePath) {
    const bytes = appState.archive?.getBytes(selected.imagePath)
    if (!bytes) return
    const image = new Image()
    image.alt = selected.imagePath.split("/").pop() ?? selected.imagePath
    image.src = imageDataURL(bytes)
    styleLibraryPreviewImage.append(image)
  } else {
    for (const visual of visuals) {
      const canvas = retinaThumbnail(document.createElement("canvas"), 180, 120)
      drawVisualPreview(canvas, [visual], false)
      styleLibraryPreviewImage.append(canvas)
    }
  }
  $("#style-library-preview-title").textContent = selected.imagePath?.split("/").pop() ?? `样式 ${stylePickerLabel(selected.styleID!)}`
  $("#style-library-preview-meta").textContent = selected.imagePath ?? "正常 / 按下 · 确认后应用到当前项"
  const targetType = appState.stylePickerTarget?.dataset.bdaStyleType
  const ref = bdaStyleRef(selected.styleID ?? appState.stylePickerTarget?.value.split(",")[0]?.trim() ?? "")
  const compatible = !targetType || (selected.imagePath ? ref?.type === "image" : ref?.type === targetType)
  styleLibraryApply.disabled = !compatible || !isEditing()
  styleLibraryApply.textContent = !compatible ? "样式类型不兼容" : selected.imagePath && appState.archive?.format !== "bda" ? "选择切片并应用" : "应用到当前项"
  styleLibraryPreview.hidden = false
}

function closeStylePicker(): void {
  stylePickerDialog.close()
  if (isTauri()) void WebviewWindow.getByLabel("image-picker").then((pickerWindow) => pickerWindow?.close())
}

function editStyleLibrarySelection(): void {
  const selected = appState.styleLibrarySelected
  if (!selected) return
  closeStylePicker()
  if (selected.styleID) openStyleReferenceEditor(selected.styleID)
  else if (selected.imagePath) selectFile(selected.imagePath, "overview")
}

styleLibraryApply.addEventListener("click", applyStyleLibrarySelection)
styleLibraryEdit.addEventListener("click", editStyleLibrarySelection)
$("#style-library-preview-close").addEventListener("click", () => { styleLibraryPreview.hidden = true })
for (const button of stylePickerDialog.querySelectorAll<HTMLButtonElement>("[data-style-library-mode]")) {
  button.addEventListener("click", () => {
    appState.styleLibraryMode = button.dataset.styleLibraryMode as "styles" | "images"
    appState.styleLibraryFilter = "all"
    stylePickerSearch.value = ""
    styleLibraryPreview.hidden = true
    void renderStylePicker()
  })
}
for (const button of stylePickerDialog.querySelectorAll<HTMLButtonElement>("[data-style-library-kind]")) {
  button.addEventListener("click", () => {
    appState.styleLibraryKind = button.dataset.styleLibraryKind as StyleKind | "all"
    styleLibraryPreview.hidden = true
    void renderStylePicker()
  })
}
for (const button of stylePickerDialog.querySelectorAll<HTMLButtonElement>("[data-style-library-filter]")) {
  button.addEventListener("click", () => {
    appState.styleLibraryFilter = button.dataset.styleLibraryFilter!
    styleLibraryPreview.hidden = true
    void renderStylePicker()
  })
}

async function renderStyleLibraryItems(renderID: number, styleIDs: string[], resolver: VisualResolver): Promise<void> {
  const query = stylePickerSearch.value.trim().toLowerCase().replace(/^#/, "")
  const allItems = await Promise.all(styleIDs.map(async (styleID) => ({
    styleID,
    visuals: await Promise.all([resolver.resolve(styleID, false).catch(() => undefined), resolver.resolve(styleID, true).catch(() => undefined)]),
  })))
  if (renderID !== appState.stylePickerRenderID || !stylePickerDialog.open) return
  const styles = styleConfigDocument()
  const paths = resourceImagePaths(appState.archive?.names() ?? [], theme.value, orientation.value)
  const currentID = appState.stylePickerTarget?.value.split(",")[0]?.trim()
  const currentImages = allItems.find((item) => item.styleID === currentID)?.visuals.map((visual) => visual?.imagePath) ?? []
  const imageCategories = new Map<string, Set<string>>()
  for (const item of allItems) {
    for (const visual of item.visuals) {
      if (!visual?.imagePath) continue
      const categories = imageCategories.get(visual.imagePath) ?? new Set<string>()
      for (const category of styleLibraryCategories(item.styleID)) categories.add(category)
      imageCategories.set(visual.imagePath, categories)
    }
  }
  const items = appState.styleLibraryMode === "images"
    ? paths.filter((path) => path.toLowerCase().includes(query) && (appState.styleLibraryFilter === "all" || imageCategories.get(path)?.has(appState.styleLibraryFilter)))
      .map((imagePath) => ({ styleID: "", imagePath, visuals: [] as Array<Visual | undefined> }))
    : allItems.filter(({ styleID, visuals }) => {
      const searchText = [styleID, stylePickerLabel(styleID), ...visuals.map((visual) => visual?.imagePath ?? "")].join(" ").toLowerCase()
      return searchText.includes(query) && (appState.styleLibraryFilter === "all" || styleLibraryCategories(styleID).has(appState.styleLibraryFilter))
        && (appState.styleLibraryKind === "all" || styleKind(styleID, styles) === appState.styleLibraryKind)
    }).map((item) => ({ ...item, imagePath: "" }))
  // 当前皮肤没有的类型不显示筛选项，避免点出空列表。
  const kinds = new Set(allItems.map(({ styleID }) => styleKind(styleID, styles)))
  for (const button of stylePickerDialog.querySelectorAll<HTMLButtonElement>("[data-style-library-kind]")) {
    button.hidden = button.dataset.styleLibraryKind !== "all" && !kinds.has(button.dataset.styleLibraryKind as StyleKind)
  }
  stylePickerGrid.replaceChildren()
  stylePickerCount.textContent = `${allItems.length} 个样式 · ${paths.length} 张图片`
  stylePickerEmpty.hidden = items.length > 0
  stylePickerEmpty.textContent = appState.styleLibraryMode === "images" ? "没有匹配的图片" : "没有匹配的样式"
  $("#style-library-status").textContent = `显示 ${items.length} 项${currentID ? ` · 当前 ${stylePickerLabel(currentID)}` : ""}`
  $("#style-library-source").textContent = `来源 ${appState.layoutPath.split("/").pop() || "当前皮肤"}`
  for (const { styleID, imagePath, visuals } of items) {
    const button = document.createElement("button")
    button.type = "button"
    button.className = "style-picker-item"
    button.classList.toggle("selected", imagePath ? currentImages.includes(imagePath) : currentID === styleID)
    button.setAttribute("aria-pressed", String(button.classList.contains("selected")))
    const previews = document.createElement("span")
    previews.className = "style-picker-previews"
    if (imagePath) {
      const bytes = appState.archive?.getBytes(imagePath)
      if (!bytes) continue
      const image = new Image()
      image.alt = ""
      image.loading = "lazy"
      image.src = imageDataURL(bytes)
      previews.append(image)
    } else {
      for (const [index, visual] of visuals.entries()) {
        const canvas = retinaThumbnail(document.createElement("canvas"), 128, 88)
        canvas.setAttribute("aria-label", index ? "按下状态" : "正常状态")
        drawVisualPreview(canvas, [visual], styleReferenceForeground(styleReferenceKey(appState.stylePickerTarget!)))
        previews.append(canvas)
      }
    }
    const label = document.createElement("strong")
    label.textContent = imagePath ? imagePath.split("/").pop()! : `样式 ${stylePickerLabel(styleID)}`
    button.title = imagePath || `${label.textContent} · 单击预览，双击应用，Command/Ctrl 单击编辑`
    const meta = document.createElement("small")
    meta.textContent = imagePath ? (imageCategories.has(imagePath) ? "已引用" : "图片资源") : `#${stylePickerLabel(styleID)}`
    if (!imagePath) meta.prepend(styleKindBadge(styleKind(styleID, styles)))
    button.append(previews, label, meta)
    button.addEventListener("click", (event) => {
      previewStyleLibraryItem(button, imagePath ? { imagePath } : { styleID }, visuals)
      if (event.metaKey || event.ctrlKey) styleLibraryEdit.click()
    })
    button.addEventListener("dblclick", () => { if (!styleLibraryApply.disabled) applyStyleLibrarySelection() })
    stylePickerGrid.append(button)
  }
}

async function renderStylePicker(): Promise<void> {
  const renderID = ++appState.stylePickerRenderID
  for (const button of stylePickerDialog.querySelectorAll<HTMLButtonElement>("[data-style-library-mode]")) {
    button.setAttribute("aria-pressed", String(button.dataset.styleLibraryMode === appState.styleLibraryMode))
    button.disabled = styleReferenceKey(appState.stylePickerTarget!) === "SOUND_STYLE" && button.dataset.styleLibraryMode === "images"
  }
  for (const button of stylePickerDialog.querySelectorAll<HTMLButtonElement>("[data-style-library-filter]")) {
    button.setAttribute("aria-pressed", String(button.dataset.styleLibraryFilter === appState.styleLibraryFilter))
    button.disabled = styleReferenceKey(appState.stylePickerTarget!) === "SOUND_STYLE"
  }
  for (const button of stylePickerDialog.querySelectorAll<HTMLButtonElement>("[data-style-library-kind]")) {
    button.setAttribute("aria-pressed", String(button.dataset.styleLibraryKind === appState.styleLibraryKind))
  }
  stylePickerDialog.querySelector<HTMLElement>(".style-library-kinds")!.hidden =
    appState.styleLibraryMode === "images" || styleReferenceKey(appState.stylePickerTarget!) === "SOUND_STYLE"
  stylePickerAdd.hidden = !appState.archive?.isText(styleConfigPath()) || appState.archive.format === "bda"
  stylePickerAdd.disabled = !isEditing()
  stylePickerSearch.placeholder = appState.styleLibraryMode === "images" ? "搜索图片名称" : "搜索样式名称或编号"
  const query = stylePickerSearch.value.trim().toLowerCase()
  const soundOnly = styleReferenceKey(appState.stylePickerTarget!) === "SOUND_STYLE"
  stylePickerDialog.querySelector(".style-picker-hint")!.textContent = soundOnly
    ? "单击应用声音样式 · Command/Ctrl 单击编辑"
    : "单击预览 · 双击应用 · Command/Ctrl 单击编辑"
  const bdaTargetType = appState.archive?.format === "bda" ? appState.stylePickerTarget?.dataset.bdaStyleType : undefined
  const stylesPath = styleConfigPath()
  const styles = appState.archive?.isText(stylesPath) ? IniDocument.parse(appState.archive.getText(stylesPath)) : undefined
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
    $("#style-library-status").textContent = `显示 ${styleIDs.length} 个声音样式`
    $("#style-library-source").textContent = `来源 ${stylesPath.split("/").pop()}`
    for (const styleID of styleIDs) {
      const filename = styles?.get(`STYLE${styleID}`, "PRESS_SOUND_PATH")?.trim() ?? ""
      const card = document.createElement("div")
      card.className = "style-picker-item style-picker-sound"
      card.classList.toggle("selected", appState.stylePickerTarget?.value.split(",")[0]?.trim() === styleID)
      const button = document.createElement("button")
      button.type = "button"
      button.className = "style-picker-sound-select"
      button.title = `点击使用声音样式 ${styleID}；Command/Ctrl 点击编辑`
      const icon = symbolSpan("music.note")
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
        if (!appState.stylePickerTarget) return
        appState.stylePickerTarget.value = styleID
        appState.stylePickerTarget.dispatchEvent(new Event("input", { bubbles: true }))
        appState.stylePickerTarget.dispatchEvent(new Event("change", { bubbles: true }))
        stylePickerDialog.close()
      })
      const soundPath = soundPathForFilename(appState.archive?.names() ?? [], theme.value, orientation.value, filename)
      const playButton = document.createElement("button")
      playButton.type = "button"
      playButton.className = "style-picker-sound-play"
      playButton.disabled = !soundPath
      playButton.title = soundPath ? `播放 ${filename}` : "声音文件不存在"
      playButton.setAttribute("aria-label", playButton.title)
      playButton.append(symbolSpan("play.fill"))
      playButton.addEventListener("click", () => {
        if (soundPath) playSoundPath(soundPath)
      })
      card.append(button, playButton)
      stylePickerGrid.append(card)
    }
    return
  }
  if (!resolver) {
    stylePickerEmpty.hidden = false
    stylePickerEmpty.textContent = "当前皮肤没有可预览的样式"
    return
  }
  stylePickerEmpty.hidden = false
  stylePickerEmpty.textContent = "正在加载预览…"
  await renderStyleLibraryItems(renderID, availableStyleIDs(), resolver)
}

function openStylePicker(input: HTMLInputElement, highlighted = false): void {
  appState.styleLibraryHighlighted = highlighted
  if (input.disabled || !availableStyleIDs().length) return
  appState.stylePickerTarget = input
  appState.styleLibraryMode = "styles"
  appState.styleLibraryFilter = "all"
  appState.styleLibraryKind = styleKindForKey(styleReferenceKey(input))
  appState.styleLibrarySelected = undefined
  styleLibraryPreview.hidden = true
  stylePickerSearch.value = ""
  // 桌面端样式库与图片切片共用同一个原生窗口，避免页内弹窗叠加模糊背景导致点击卡顿。
  if (isTauri()) {
    void showPickerWindow("styles", "全部样式", 1100, 760)
    return
  }
  stylePickerDialog.showModal()
  void renderStylePicker()
  stylePickerSearch.focus()
}

function nativeStyleLibraryPayload(sliceBack: boolean): Promise<StyleLibraryPayload | undefined> {
  const target = appState.stylePickerTarget
  if (!appState.archive || !target) return Promise.resolve(undefined)
  const source = appState.archive
  const key = styleReferenceKey(target)
  const soundOnly = key === "SOUND_STYLE"
  const styles = styleConfigDocument()
  const currentID = target.value.split(",")[0]?.trim() ?? ""
  const targetType = appState.archive.format === "bda" ? target.dataset.bdaStyleType : undefined
  const bitmaps: Record<string, string> = {}
  const bitmapKeys = new Map<ImageBitmap, string>()
  // 位图不能跨窗口传：有归档路径就直接编码原始 PNG，否则（如 BDA 基础皮肤里的图）画到画布再导出。
  const wireVisual = (visual: Visual | undefined): StyleLibraryVisual | null => {
    if (!visual) return null
    const { image, ...rest } = visual
    if (!image) return rest
    const bytes = visual.imagePath ? source.getBytes(visual.imagePath) : undefined
    const imageKey = bytes ? visual.imagePath! : bitmapKeys.get(image) ?? `bitmap:${bitmapKeys.size}`
    bitmapKeys.set(image, imageKey)
    if (!bitmaps[imageKey]) {
      if (bytes) bitmaps[imageKey] = imageDataURL(bytes)
      else {
        const canvas = document.createElement("canvas")
        canvas.width = image.width
        canvas.height = image.height
        canvas.getContext("2d")?.drawImage(image, 0, 0)
        bitmaps[imageKey] = canvas.toDataURL()
      }
    }
    return { ...rest, imageKey }
  }
  const payload = {
    sliceBack,
    editable: isEditing() && !target.disabled,
    canAdd: Boolean(appState.archive.isText(styleConfigPath()) && appState.archive.format !== "bda"),
    soundOnly,
    foreground: styleReferenceForeground(key),
    bda: appState.archive.format === "bda",
    kind: styleKindForKey(key),
    currentID,
    currentLabel: currentID ? stylePickerLabel(currentID) : "",
    source: (soundOnly ? styleConfigPath() : appState.layoutPath).split("/").pop() || "当前皮肤",
    imagesCompatible: !targetType || bdaStyleRef(currentID)?.type === "image",
    bitmaps,
    styles: [] as StyleLibraryPayload["styles"],
    images: [] as StyleLibraryPayload["images"],
    sounds: [] as StyleLibraryPayload["sounds"],
  }
  if (soundOnly) {
    payload.sounds = availableStyleIDs().flatMap((styleID) => {
      const filename = styles?.get(`STYLE${styleID}`, "PRESS_SOUND_PATH")?.trim() ?? ""
      if (!filename) return []
      const playable = Boolean(soundPathForFilename(source.names(), theme.value, orientation.value, filename))
      return [{ styleID, filename, playable }]
    })
    return Promise.resolve(payload)
  }
  const resolver = visualResolver()
  if (!resolver) return Promise.resolve(payload)
  return Promise.all(availableStyleIDs().map(async (styleID) => ({
    styleID,
    visuals: await Promise.all([resolver.resolve(styleID, false).catch(() => undefined), resolver.resolve(styleID, true).catch(() => undefined)]),
  }))).then((items) => {
    const imageCategories = new Map<string, Set<string>>()
    payload.styles = items.map(({ styleID, visuals }) => {
      const categories = styleLibraryCategories(styleID)
      for (const visual of visuals) {
        if (!visual?.imagePath) continue
        const merged = imageCategories.get(visual.imagePath) ?? new Set<string>()
        for (const category of categories) merged.add(category)
        imageCategories.set(visual.imagePath, merged)
      }
      const kind = styleKind(styleID, styles)
      return {
        styleID,
        label: stylePickerLabel(styleID),
        kind,
        kindLabel: styleKinds[kind].label,
        kindIcon: styleKinds[kind].icon,
        categories: [...categories],
        compatible: !targetType || bdaStyleRef(styleID)?.type === targetType,
        imagePaths: visuals.flatMap((visual) => visual?.imagePath ? [visual.imagePath] : []),
        visuals: visuals.map(wireVisual),
      }
    })
    payload.images = resourceImagePaths(source.names(), theme.value, orientation.value).flatMap((path) => {
      const bytes = source.getBytes(path)
      if (!bytes) return []
      bitmaps[path] ??= imageDataURL(bytes)
      return [{ path, categories: [...imageCategories.get(path) ?? []], referenced: imageCategories.has(path) }]
    })
    return payload
  })
}

async function emitStyleLibrary(sliceBack = false): Promise<void> {
  const payload = await nativeStyleLibraryPayload(sliceBack)
  if (payload) await emitTo("image-picker", "style-library-data", payload)
}

for (const input of [...keyboardFields, ...toolbarFields, ...keyFields]) decorateStyleReferenceInput(input)
stylePickerSearch.addEventListener("input", () => { styleLibraryPreview.hidden = true; void renderStylePicker() })
stylePickerDialog.addEventListener("close", () => { ++appState.stylePickerRenderID; appState.styleLibrarySelected = undefined })
stylePickerClose.addEventListener("click", () => stylePickerDialog.close())
newStyleDialog.addEventListener("close", () => { appState.newStyleApplyTarget = undefined })
function addStyleFromLibrary(): void {
  appState.newStyleApplyTarget = appState.stylePickerTarget
  closeStylePicker()
  styleAddButton.click()
}
stylePickerAdd.addEventListener("click", addStyleFromLibrary)
stylePickerDialog.addEventListener("click", (event) => {
  const rect = stylePickerDialog.getBoundingClientRect()
  if (event.target === stylePickerDialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) stylePickerDialog.close()
})
async function updateStylePreviews(): Promise<void> {
  if (appState.stylePreviewsPending) return
  appState.stylePreviewsPending = true
  afterNextPaint(() => {
    appState.stylePreviewsPending = false
    refreshStyleReferenceThumbnails()
  })
}

// What each thumbnail was last drawn from; selecting a key re-runs this for every
// trigger, and rebuilding unchanged ones dominated the click cost.
const styleReferenceThumbnailInputs = new WeakMap<HTMLElement, { archive: SkinArchive; signature: string }>()

function refreshStyleReferenceThumbnails(): void {
  let resolver: VisualResolver | undefined
  for (const button of Array.from(document.querySelectorAll<HTMLElement>(".style-picker-trigger"))) {
    const input = button.previousElementSibling
    if (!(input instanceof HTMLInputElement)) continue
    const key = styleReferenceKey(input)
    if (appState.archive) {
      const signature = `${appState.archive.revision}|${theme.value}|${orientation.value}|${key}|${input.value}`
      const previous = styleReferenceThumbnailInputs.get(button)
      if (previous?.archive === appState.archive && previous.signature === signature) continue
      styleReferenceThumbnailInputs.set(button, { archive: appState.archive, signature })
    } else styleReferenceThumbnailInputs.delete(button)
    resolver ??= visualResolver()
    void refreshStyleReferenceThumbnail(button, input, key, resolver)
  }
}

function selectedStylePropertyContext(property: string, styles?: IniDocument):
  | { document: IniDocument; path: string; sources: StylePropertySource[] }
  | undefined {
  if (!appState.archive || !appState.layoutDocument || !appState.selectedKeySections.length) return
  const path = styleConfigPath()
  if (!appState.archive.isText(path)) return
  const document = styles ?? IniDocument.parse(appState.archive.getText(path))
  const sources = resolveStylePropertySources(
    document,
    appState.selectedKeySections.map((section) =>
      isListCell(section)
        ? (appState.layoutDocument?.get("LIST", "FORE_STYLE") ?? "").trim()
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
  if (appState.archive?.format !== "bda" || !appState.layoutDocument) return []
  const collect = (name: "BACK_STYLE" | "FORE_STYLE") =>
    appState.selectedKeySections.flatMap((section) => {
      const ref = (appState.layoutDocument?.get(section, name) ?? "")
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
  refreshBdaLayout(appState.layoutPath)
  refreshSelectedBdaSource()
  refreshPreview()
  populateKeyInspector()
  updateDirty()
  return true
}

// 将样式引用写回 appearanceConfig 的面板片段，path 指向解码 JSON 中的字段位置。
function updateBdaAppearanceStyleRef(paths: string[][], ref: BdaStyleRef, owner?: HTMLElement): boolean {
  const info = currentBdaAppearance()
  const part = bdaAppearancePart(appState.selectedPath)
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
  refreshBdaLayout(appState.layoutPath)
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
  const part = bdaAppearancePart(appState.selectedPath)
  if (!info || part?.kind !== "panel") return false
  const source = JSON.parse(decodedBdaAppearancePart(info.bytes, part)) as Record<string, unknown>
  source[property] = value
  const after = applyDecodedBdaAppearancePart(info.path, info.bytes, JSON.stringify(source), part)
  commitBytes(info.path, info.bytes, after)
  refreshBdaLayout(appState.layoutPath)
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
  TIP_NUM: "补丁数量",
  LIST_NUM: "列表数量",
  LIST_ORDER: "列表顺序",
  CELL_SIZE: "单元格尺寸",
  GRID: "网格",
  POS: "位置",
  NO_BLUR: "精确输入模式",
  OFFSET_NUM: "偏移数量",
  OFFSET: "偏移",
  FORE_STYLE_NUM: "前景样式数量",
  INPUT_STYLE: "输入码样式",
  SCAND_STYLE: "云输入样式",
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
  // 以下键只出现在文档配置节（LIST / BAR / SWITCH / CAND / ICON…），此前都显示为英文原名。
  NAMES: "列表名称",
  VALUES: "列表值",
  NAME: "名称",
  VERSION: "版本",
  TEXT_STYLE: "文字样式",
  BACK_ANIM_STYLE: "背景动画样式",
  FORE_ANIM_STYLE: "前景动画样式",
  HW_FORE_STYLE: "手写前景样式",
  ANIM_LEVEL: "动画层级",
  ICON_NUM: "图标数量",
  ICON_INDEX: "图标序号",
  BACK_ICON: "背景图标",
  ARROW_ICON: "箭头图标",
  ICON_UP: "上划气泡图标",
  ICON_DN: "下划气泡图标",
  ICON_LT: "左划气泡图标",
  ICON_RT: "右划气泡图标",
  ANCHOR_TYPE: "锚点类型",
  PERSIST: "显示时机",
  CELL_W: "候选字间距",
  FIRST_GAP: "首项间距",
  NML_BACK_STYLE: "普通背景样式",
  SEL_BACK_STYLE: "选中背景样式",
  NML_FONT_STYLE: "普通文字样式",
  SEL_FONT_STYLE: "选中文字样式",
  HLINE_STYLE: "横线样式",
  VLINE_STYLE: "竖线样式",
  SCROLL_SIDE: "滚动条位置",
  SYM_LAYOUT: "符号面板布局",
  EVENT_NUM: "事件数量",
  IDLE_TIME: "空闲时间",
  FIX_SIZE: "固定尺寸",
}

const documentSectionLabels: Record<string, string> = {
  PANEL: "面板",
  INPUT: "输入区",
  CAND: "候选栏",
  SCAND: "云输入栏",
  HINT: "气泡",
  MORE: "更多面板",
  LOGO: "Logo 菜单",
  EMOJI: "表情面板",
  GLOBAL: "全局设置",
  // SWITCH / BAR / LIST 等文档分区此前会显示为英文原名。
  LIST: "列表",
  BAR: "长按气泡",
  SWITCH: "工具栏",
  TAB: "标签",
  DRAW: "拖拉气泡",
  VIEWSTATE: "视图状态",
}

const documentPairFieldLabels: Record<string, [string, string]> = {
  SIZE: ["宽度", "高度"],
  POS: ["横向", "纵向"],
  CELL_SIZE: ["宽度", "高度"],
  FIX_SIZE: ["宽度", "高度"],
}

const documentQuadFieldLabels: Record<string, [string, string, string, string]> = {
  VIEW_RECT: ["横向", "纵向", "宽度", "高度"],
  NON_SPLIT_PANEL_REGION: ["横向", "纵向", "宽度", "高度"],
  PADDING: ["左", "上", "右", "下"],
}

const documentSwitchFields = new Set(["NO_BLUR"])
const documentNumericFields = new Set([
  "KEY_NUM", "TIP_NUM", "LIST_NUM", "OFFSET_NUM", "FORE_STYLE_NUM", "ANIM_NUM", "BUILD_NUM",
  "REPEAT_CNT", "FONT_SIZE", "FONT_WEIGHT",
  "CELL_W", "FIRST_GAP", "ICON_NUM", "ICON_INDEX", "EVENT_NUM",
])

/** number 输入框会清空非数字值，只有纯数字才切换到数字类型。 */
function looksNumeric(value: string): boolean {
  return /^-?\d+(?:\.\d+)?$/.test(value.trim())
}

/** MORE.SYM_LAYOUT 这类键按 id 绑定布局文件，沿用侧边栏使用的布局名称。 */
const layoutIDLabels: Record<string, string> = {
  bh: "笔画键盘",
  def_9: "五笔 9 键",
  def_26: "五笔 26 键",
  py_9: "拼音 9 键",
  py_26: "拼音 26 键",
  en_9: "英文 9 键",
  en_9s: "英文 9 键 Shift",
  en_9_h: "英文 9 键（加高）",
  en_9s_h: "英文 9 键 Shift（加高）",
  en_26: "英文 26 键",
  en_26s: "英文 26 键 Shift",
  num_9: "数字键盘",
  num_9_h: "数字键盘（加高）",
  num_26: "26 键数字键盘",
  num2: "数字键盘 2",
  symbol: "符号面板",
  symbol_h: "符号面板（加高）",
  sym_26_cn: "中文 26 键符号",
  sym_26_cn_h: "中文 26 键符号（加高）",
  sym_26_en: "英文 26 键符号",
  sym_26_en_h: "英文 26 键符号（加高）",
  emoji: "表情面板",
  hw_grid: "手写面板",
  hw_full: "全屏手写",
  help: "帮助面板",
  sel_ch: "中文选择栏",
  sel_ch_h: "中文选择栏（加高）",
  sel_en: "英文选择栏",
  sel_en_h: "英文选择栏（加高）",
  voice: "语音键盘",
  dial: "拨号键盘",
  email: "邮箱键盘",
  net: "网址键盘",
  net_shifts: "网址键盘大写",
  logo: "输入法标识",
  en_26_new: "英文 26 键（无上划）",
  en_26s_new: "英文 26 键 Shift（无上划）",
  def_26_new: "五笔 26 键（无上划）",
  en_9_pad: "英文 9 键加高",
  en_9s_pad: "英文 9 键 Shift 加高",
}

function translatedConfigLabel(key: string): string {
  // 文档标签优先，其次复用源码侧的通用标签表；都没有时保留原始键名，而不是猜一个词。
  const known = documentFieldLabels[key] ?? sourceKeyLabels[key]
  if (known) return known
  const layout = key.match(/^([A-Z0-9_]+)_LAYOUT$/)
  if (layout) {
    const id = layout[1].toLowerCase()
    const name = layoutIDLabels[id] ?? id.replaceAll("_", " ")
    return /[A-Za-z0-9]$/.test(name) ? `${name} 布局` : `${name}布局`
  }
  return key
}

function translatedSectionLabel(section: string): string {
  const offset = section.match(/^OFFSET(\d+)$/)
  const animation = section.match(/^ANIM(\d+)$/)
  const icon = section.match(/^ICON(\d+)$/i)
  const tip = section.match(/^TIP(\d+)$/i)
  const event = section.match(/^EVENT(\d+)$/i)
  const label = offset
    ? `偏移 ${offset[1]}`
    : animation
      ? `动画 ${animation[1]}`
      : icon
        ? `工具按钮 ${icon[1]}`
        : tip
          ? `状态提示 ${tip[1]}`
          : event
            ? `事件 ${event[1]}`
            : documentSectionLabels[section] ?? section
  return `${label}（${section}）`
}

function isHiddenConfigEntry(section: string, key: string, showTips = false): boolean {
  if (/^OFFSET\d*$/i.test(section) || /^OFFSET(?:_|\d|$)/i.test(key)) return true
  return !showTips && (/^TIP\d*$/i.test(section) || /^TIP(?:_|\d|$)/i.test(key))
}

const particleFieldGroups = [
  ["发射", ["PARTICLE_IMAGE", "LIFE", "EMIT_REGION", "TOTAL_NUMBER", "BIRTH_RATE", "EMIT_TYPE"]],
  ["运动", ["VELOCITY", "VELOCITY_DIRECTION", "ACCELERATION", "ACCELERATION_DIRECTION"]],
  ["外观", ["INIT_SCALE", "SCALE_SPEED", "INIT_ROTATE", "ROTATE_SPEED", "INIT_ALPHA", "ALPHA_SPEED"]],
] as const
const particlePairFields = new Set<string>(particleFieldGroups.flatMap(([, keys]) => keys).filter((key) =>
  !["PARTICLE_IMAGE", "EMIT_REGION", "TOTAL_NUMBER", "BIRTH_RATE", "EMIT_TYPE"].includes(key),
))

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
  const hasSelection = appState.selectedPath === appState.layoutPath && appState.selectedKeySections.length > 0
  if (appState.archive?.format === "bda" || !appState.selectedDocument || hasSelection || !appState.archive?.isText(appState.selectedPath)) {
    documentFieldsGroup.hidden = true
    appState.particlePreviewSection = ""
    preview.setParticlePreview()
    return
  }
  const specialized = new Set<string>()
  const toolbarSections = new Set(isToolbarPath(appState.selectedPath) ? effectiveToolbarSections() : [])
  if (isSkinInfoPath(appState.selectedPath)) {
    for (const field of skinFields) specialized.add(`\u0000${field.dataset.skinField ?? ""}`)
  }
  if (isToolbarPath(appState.selectedPath)) {
    for (const field of toolbarFields) {
      const [section, key] = (field.dataset.toolbarField ?? "").split(".")
      specialized.add(`${key ? section : "CAND"}\u0000${key || section}`)
    }
  }
  const entries = appState.selectedDocument.entries().filter((entry) =>
    !/^KEY\d+$/.test(entry.section) &&
    !isHiddenConfigEntry(entry.section, entry.key, isToolbarPath(appState.selectedPath)) &&
    (!toolbarSections.size || toolbarSections.has(entry.section)) &&
    !specialized.has(`${entry.section}\u0000${entry.key}`),
  )
  documentFieldsGroup.hidden = entries.length === 0
  if (!entries.length) {
    appState.particlePreviewSection = ""
    preview.setParticlePreview()
    return
  }

  const sections = [...new Set(entries.map((entry) => entry.section))]
  const particleSections = sections.filter((section) => isParticleSection(appState.selectedDocument!, section))
  if (!particleSections.includes(appState.particlePreviewSection)) appState.particlePreviewSection = particleSections[0] ?? ""
  preview.setParticlePreview(
    appState.particlePreviewSection ? parseLegacyParticleEmitter(appState.selectedDocument, appState.particlePreviewSection) : undefined,
  )
  const update = (section: string, key: string, value: string): boolean => {
    if (!appState.selectedDocument || appState.selectedPath !== documentFieldsGroup.dataset.path) return false
    const before = appState.selectedDocument.toString()
    if (!appState.selectedDocument.set(section, key, value)) return false
    const text = appState.selectedDocument.toString()
    commitText(appState.selectedPath, before, text)
    setSourceValue(text)
    if (appState.selectedPath === appState.layoutPath) appState.layoutDocument = appState.selectedDocument
    refreshPreview()
    if (section === appState.particlePreviewSection) {
      preview.setParticlePreview(parseLegacyParticleEmitter(appState.selectedDocument, section))
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
    label.dataset.documentKey = entry.key
    const caption = document.createElement("span")
    caption.className = "document-field-caption"
    const captionLabel = translatedConfigLabel(entry.key)
    // 译文之外的原始键名保留在悬停提示里，属性行始终能对应回 ini 的键。
    caption.title = captionLabel === entry.key ? entry.key : `${captionLabel}（${entry.key}）`
    const captionName = document.createElement("span")
    captionName.className = "document-field-name"
    captionName.textContent = captionLabel
    caption.append(captionName)
    if (documentFieldLabels[entry.key]) {
      const code = document.createElement("span")
      code.className = "document-field-code"
      code.textContent = entry.key
      caption.append(code)
    }
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

    const pairLabels = documentPairFieldLabels[entry.key]
    const pairValues = entry.value.split(",").map((value) => value.trim())
    if (!specialized && pairLabels && pairValues.length === pairLabels.length) {
      const row = document.createElement("span")
      row.className = "document-pair-inputs"
      const separator = /SIZE$/.test(entry.key) ? "×" : ","
      pairLabels.forEach((name, index) => {
        if (index > 0) {
          const mark = document.createElement("span")
          mark.className = "document-pair-separator"
          mark.textContent = separator
          row.append(mark)
        }
        const input = document.createElement("input")
        input.type = "number"
        input.step = "1"
        input.value = pairValues[index] ?? ""
        input.placeholder = name
        input.disabled = !isEditing()
        input.setAttribute("aria-label", `${translatedConfigLabel(entry.key)} ${name}`)
        input.addEventListener("change", () => {
          pairValues[index] = input.value
          update(entry.section, entry.key, pairValues.join(","))
        })
        row.append(input)
      })
      label.classList.add("document-pair-field")
      label.append(row)
      return label
    }

    const quadLabels = documentQuadFieldLabels[entry.key]
    const quadValues = entry.value.split(",").map((value) => value.trim())
    if (!specialized && quadLabels && quadValues.length === quadLabels.length) {
      const row = document.createElement("span")
      row.className = "document-quad-inputs"
      quadLabels.forEach((name, index) => {
        const item = document.createElement("span")
        item.className = "document-subfield"
        const small = document.createElement("small")
        small.textContent = name
        const input = document.createElement("input")
        input.type = "number"
        input.step = "1"
        input.value = quadValues[index] ?? ""
        input.placeholder = name
        input.disabled = !isEditing()
        input.setAttribute("aria-label", `${translatedConfigLabel(entry.key)} ${name}`)
        input.addEventListener("change", () => {
          quadValues[index] = input.value
          update(entry.section, entry.key, quadValues.join(","))
        })
        item.append(small, input)
        row.append(item)
      })
      label.classList.add("wide", "document-quad-field")
      label.append(row)
      return label
    }

    if (!specialized && documentSwitchFields.has(entry.key)) {
      const input = document.createElement("input")
      input.type = "checkbox"
      input.setAttribute("role", "switch")
      input.checked = !["0", "false", "off", ""].includes(entry.value.trim().toLowerCase())
      input.disabled = !isEditing()
      input.setAttribute("aria-label", translatedConfigLabel(entry.key))
      const control = document.createElement("span")
      control.className = "document-switch-control"
      const state = document.createElement("span")
      state.className = "document-switch-state"
      state.textContent = input.checked ? "开启" : "关闭"
      input.addEventListener("change", () => {
        state.textContent = input.checked ? "开启" : "关闭"
        update(entry.section, entry.key, input.checked ? "1" : "0")
      })
      control.append(input, state)
      label.classList.add("document-switch-field")
      label.append(control)
      return label
    }

    const input = document.createElement("input")
    input.value = entry.value
    input.classList.add("document-property-input")
    input.title = `${translatedConfigLabel(entry.key)}：${entry.value}`
    input.disabled = !isEditing()
    input.setAttribute("aria-label", translatedConfigLabel(entry.key))
    // 值不是数字时保持文本输入：number 输入框会清空显示，用户一编辑就丢原值。
    if (documentNumericFields.has(entry.key) && looksNumeric(entry.value)) {
      input.type = "number"
      input.step = "1"
      input.inputMode = "numeric"
    }
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
    const particle = isParticleSection(appState.selectedDocument, section)
    if (particle) sectionPanel.classList.add("particle-property-section")
    const sectionLabel = particle
      ? `粒子动效 ${section.replace(/^ANIM/, "")}（${section}）`
      : section ? translatedSectionLabel(section) : "基本信息"
    const sectionName = sectionLabel.replace(/\s*[（(][^）)]*[）)]\s*$/, "")
    sectionPanel.dataset.inspectorGroupLabel = sectionName
    const heading = document.createElement("h3")
    heading.className = "document-section-heading"
    const title = document.createElement("span")
    title.className = "document-section-title"
    title.textContent = sectionName
    const meta = document.createElement("span")
    meta.className = "document-section-meta"
    meta.textContent = `${sectionEntries.length} 项`
    heading.append(title)
    if (section && sectionName !== section) {
      const code = document.createElement("span")
      code.className = "document-section-code"
      code.textContent = section
      heading.append(code)
    }
    heading.append(meta)
    sectionPanel.append(heading)
    if (particle) {
      const toolbar = document.createElement("div")
      toolbar.className = "particle-preview-toolbar"
      const status = document.createElement("span")
      status.textContent = section === appState.particlePreviewSection ? "正在画布预览" : "可在键盘画布中预览"
      const replay = document.createElement("button")
      replay.type = "button"
      replay.textContent = section === appState.particlePreviewSection ? "重新播放" : "在画布预览"
      replay.addEventListener("click", () => {
        if (!appState.selectedDocument) return
        appState.particlePreviewSection = section
        preview.setParticlePreview(parseLegacyParticleEmitter(appState.selectedDocument, section))
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
        const advancedSection = document.createElement("section")
        advancedSection.className = "particle-advanced-properties"
        const heading = document.createElement("h4")
        heading.textContent = `高级参数（${advanced.length}）`
        const grid = document.createElement("div")
        grid.className = "document-property-grid"
        grid.append(...advanced.map((entry) => renderEntry(entry)))
        advancedSection.append(heading, grid)
        sectionPanel.append(advancedSection)
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
  documentFieldsGroup.dataset.path = appState.selectedPath
}

function selectedBdaKeyNames(): string[] {
  if (!appState.layoutDocument || !appState.selectedKeySections.length) return []
  return [...new Set(appState.selectedKeySections.flatMap((section) => {
    const effective = effectiveKeySection(section)
    return [appState.layoutDocument?.get(effective, "CENTER"), appState.layoutDocument?.get(section, "CENTER"), appState.layoutDocument?.get(section, "DOWN")]
      .filter((value): value is string => Boolean(value))
      .map(bdaPanelKeyName)
  }))]
}

function selectedBdaSourceKeys(): string[] {
  if (appState.resourceConfigActive && appState.resourceInspectorMode === "style") return appState.selectedStyleID ? [appState.selectedStyleID] : []
  if (appState.selectedCandidate && appState.selectedPath === appState.layoutPath) return ["cand"]
  return isBdaLayoutPath(appState.selectedPath) ? selectedBdaKeyNames() : []
}

function populateBdaConfigInspector(): void {
  bdaConfigFields.replaceChildren()
  if (!appState.archive || appState.archive.format !== "bda") {
    bdaConfigFieldsGroup.hidden = true
    return
  }
  const info = currentBdaAppearance()
  if (isSkinInfoPath(appState.selectedPath) && appState.selectedDocument) {
    bdaConfigFieldsGroup.hidden = false
    renderBdaMetadataEditor(bdaConfigFields, {
      entries: appState.selectedDocument.entries("").map(({ key, value }) => ({ key, value })),
      editable: isEditing(),
      onChange: (key, value) => {
        if (!appState.selectedDocument) return
        const before = appState.selectedDocument.toString()
        if (!appState.selectedDocument.set("", key, value)) return
        const after = appState.selectedDocument.toString()
        commitText(appState.selectedPath, before, after)
        setSourceValue(after)
        populateBdaConfigInspector()
        updateDirty()
      },
    })
    return
  }
  if (bdaAppearancePart(appState.selectedPath)?.kind === "panel" && info) {
    const panelName = appState.selectedPath.split("/").pop()?.replace(/\.ini$/i, "") ?? ""
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
      scope: appState.selectedCandidate ? "candidate" : "panel",
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
  const bytes = appState.archive.isBdaConfig(appState.selectedPath) ? appState.archive.getBytes(appState.selectedPath) : undefined
  bdaConfigFieldsGroup.hidden = !bytes
  if (!bytes) return
  const update = (after: Uint8Array) => {
    commitBytes(appState.selectedPath, bytes, after)
    if (/appearanceConfig$/i.test(appState.selectedPath)) refreshBdaLayout(appState.layoutPath)
    refreshSelectedBdaSource()
    refreshPreview()
    populateBdaConfigInspector()
    updateDirty()
  }
  renderBdaConfigEditor(bdaConfigFields, {
    path: appState.selectedPath,
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
  if (!appState.archive?.names().includes(path) && !isBdaVirtualTextPath(path) && !isBdaAppearancePartPath(path)) return
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
  // 概览与检查器分类轨共用同一套 Lucide 图标（16px、1.5 描边），平台符号只作兜底。
  const symbolName = icon ?? navigationSystemSymbols[className] ?? "doc"
  button.append(symbolSpan(symbolName))
  const labelNode = document.createElement("span")
  labelNode.className = "nav-label"
  labelNode.textContent = label
  button.append(labelNode)
  // 概览卡片统一为两行内容：标题 + 文件名。英文布局也保留 en_*.ini，
  // 所有卡片的文字块高度才会完全一致。
  const metaNode = document.createElement("span")
  metaNode.className = "nav-meta"
  metaNode.textContent = meta || path.split("/").pop() || ""
  button.append(metaNode)
  button.title = `${label} · ${metaNode.textContent}`
  button.addEventListener("click", () => {
    if (path.endsWith("py_9.ini") || path.endsWith("py_26.ini")) {
      layout.value = path.endsWith("_9.ini") ? "py_9.ini" : "py_26.ini"
      appState.previewReturnName = path.split("/").pop() ?? layout.value
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
    if (caption) textNode.textContent = `${caption.replace(/（[A-Za-z_]+）/g, "")} `
    label.title ||= name
  }
}

function populatePrimaryCssFields(hasSelection: boolean, sections: string[]): void {
  primaryCssFields.replaceChildren()
  if (!hasSelection || appState.archive?.format === "bda" || sections.length !== 1 || !appState.layoutDocument) return
  const path = styleConfigPath()
  if (!appState.archive?.isText(path)) return
  const styles = IniDocument.parse(appState.archive.getText(path))
  const section = sections[0]
  const foreground = isListCell(section)
    ? appState.layoutDocument.get("LIST", "FORE_STYLE") ?? ""
    : effectiveKeyValue(section, "FORE_STYLE") ?? ""
  const sources = [...new Map(
    resolveStylePropertyLayers(styles, foreground, "SHOW").map((source) => [source.section, source]),
  ).values()]
  for (const source of sources) {
    const label = document.createElement("label")
    const caption = `显示内容（来自 CSS · ${source.section}）`
    label.title = `${path} [${source.section}] SHOW`
    label.append(`${caption} `)
    const input = document.createElement("input")
    input.value = source.value
    input.disabled = !isEditing()
    input.setAttribute("aria-label", caption)
    input.addEventListener("input", () => {
      const before = styles.toString()
      if (!styles.set(source.section, "SHOW", input.value)) return
      const text = styles.toString()
      commitText(path, before, text)
      refreshPreview()
      updateDirty()
    })
    label.append(input)
    primaryCssFields.append(label)
  }
}

function populateKeyInspector(): void {
  if (deferNumberInputRefresh(populateKeyInspector, populateKeyInspector)) return
  if (appState.selectedPath !== appState.layoutPath && appState.selectedKeySections.length) {
    appState.selectedKeySections = []
    preview.setSelected([])
  }
  const document = appState.layoutDocument
  const sections = appState.selectedKeySections
  const hasSelection = Boolean(document && sections.length && appState.selectedPath === appState.layoutPath)
  const skinSelected = isSkinInfoPath(appState.selectedPath)
  const toolbarSelected = isToolbarPath(appState.selectedPath)
  const toolbarSections = toolbarSelected ? effectiveToolbarSections() : []
  const toolbarHasSelection = toolbarSections.length > 0
  const toolbarSection = appState.selectedToolbarSections[0] ?? ""
  const effectiveToolbarSection = toolbarSection && appState.selectedDocument
    ? effectivePanelSection(appState.selectedDocument, toolbarSection, currentSkinState())
    : toolbarSection
  const bdaConfigSelected = Boolean(appState.archive?.isBdaConfig(appState.selectedPath))
  const bdaSelected = appState.archive?.format === "bda"
  const candidateSelected = Boolean(bdaSelected && appState.selectedCandidate && appState.selectedPath === appState.layoutPath)
  inspectorBackButton.disabled = !(hasSelection || toolbarHasSelection || candidateSelected)
  syncBdaKeyFieldLabels(bdaSelected)
  skinFieldsGroup.hidden = !skinSelected || bdaSelected
  toolbarFieldsGroup.hidden = !toolbarSelected || bdaSelected || toolbarHasSelection
  keyboardFieldsGroup.hidden = bdaSelected || skinSelected || toolbarSelected || bdaConfigSelected || candidateSelected || appState.selectedPath !== appState.layoutPath || hasSelection
  for (const group of keyOnlyGroups) {
    const availableForBda = group === keyTypographyFieldsGroup
    group.hidden = skinSelected || bdaConfigSelected || !hasSelection || bdaSelected && !availableForBda
  }
  selectedKeyName.textContent = hasSelection
    ? sections.length > 1 ? `已选 ${sections.length} 个按键` : "按键"
    : skinSelected
    ? "皮肤信息"
    : bdaConfigSelected
      ? appState.selectedPath.split("/").pop() ?? "BDA 专属配置"
    : candidateSelected
      ? "候选栏"
    : toolbarHasSelection
      ? `${toolbarSection} · ${appState.selectedDocument?.get(effectiveToolbarSection, "KEY") || appState.selectedDocument?.get(toolbarSection, "KEY") || "未配置点击动作"}`
    : toolbarSelected
      ? "候选栏与工具栏"
    : appState.selectedPath !== appState.layoutPath
      ? appState.selectedPath.split("/").pop() ?? "文档配置"
      : `${appState.selectedPath.split("/").pop() ?? "键盘"} · 整体布局`
  selectedKeyPreview.replaceChildren(createIcon(hasSelection ? bdaSelected ? "component" : sections.length > 1 ? "layers" : "key-round" : "panel-top"))
  selectedKeyPreview.hidden = false
  selectedKeyName.title = selectedKeyName.textContent ?? ""
  selectedKeyContext.textContent = hasSelection
    ? `${appState.selectedPath.split("/").pop()} · ${sections.length > 1 ? "keys.*" : sections[0]}`
    : appState.selectedPath || "选择文件以查看属性"
  syncAiDesignContext()
  quickInspector.dataset.selectionCount = String(hasSelection ? sections.length : 0)
  quickInspector.dataset.selectionNames = JSON.stringify(hasSelection ? sections : [])
  for (const field of keyFields.filter((field) => field.dataset.keyField === "SHOW")) {
    const label = field.closest("label")
    if (label) label.hidden = bdaSelected
  }
  selectedKeyContext.title = appState.selectedPath
  setInspectorKind(appState.archive?.format === "bda" ? "bda" : appState.archive ? "bds" : "")
  syncMobileInspectorHeader()
  for (const field of skinFields) {
    field.value = skinSelected ? appState.selectedDocument?.get("", field.dataset.skinField ?? "") ?? "" : ""
    field.disabled = !skinSelected
  }
  const general = appState.archive?.isText(genConfigPath())
    ? IniDocument.parse(appState.archive.getText(genConfigPath()))
    : undefined
  const toolbarGen = toolbarSelected ? general : undefined
  for (const field of toolbarFields) {
    const [section, key] = (field.dataset.toolbarField ?? "").split(".")
    field.value = toolbarSelected
      ? appState.selectedDocument?.get(key ? section : "CAND", key || section) ?? toolbarGen?.get("CAND", key || section) ?? ""
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
  const soundGeneral = general
  for (const field of keyFields) {
    const name = field.dataset.keyField ?? ""
    // BDA 样式引用由源码结构控件编辑，旧格式按键字段只负责非 BDA 皮肤。
    field.disabled = !hasSelection || appState.archive?.format === "bda"
    field.placeholder = ""
    if (!hasSelection || bdaSelected) {
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
        if (name.startsWith("PADDING.")) return (effectiveKeyValue(section, "PADDING") ?? "0,0,0,0").split(",")[Number(name.split(".")[1])] ?? "0"
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
  populatePrimaryCssFields(hasSelection, sections)
  const bdaKeyProperties = new Set(["FORE_OFFSET"])
  for (const field of keyFields) {
    if (!field.closest(".key-appearance-fields")) continue
    const label = field.closest<HTMLElement>("label")
    if (label) label.hidden = Boolean(bdaSelected && (
      !bdaKeyProperties.has(field.dataset.keyField ?? "") || !field.value && field.placeholder !== "混合"
    ))
  }
  const bdaTextPropertyAvailability = new Map<string, boolean>()
  // Decoding the appearance file is the expensive part: do it once per refresh, not per field.
  const bdaTextInfo = bdaSelected ? currentBdaAppearance() : undefined
  const bdaTextRefs = bdaSelected ? selectedBdaRefs("FORE_STYLE", "text") : []
  let hasTextStyle = bdaTextRefs.length > 0
  for (const field of styleFields) {
    const property = field.dataset.styleField ?? ""
    if (bdaSelected) {
      const info = bdaTextInfo
      const refs = bdaTextRefs
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
    const context = selectedStylePropertyContext(property, keyboard?.styles)
    hasTextStyle ||= Boolean(context)
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
  for (const label of textStyleLabels) {
    if (!hasSelection || !hasTextStyle) {
      label.hidden = true
      continue
    }
    if (appState.archive?.format !== "bda") {
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
  const typographySubtitle = quickInspector.querySelector(".typography-subtitle-default")
  if (typographySubtitle) typographySubtitle.textContent = hasSelection && !hasTextStyle ? "前景样式不含文字属性，只能修改显示内容" : "显示内容与字体颜色"
  const paddingSection = quickInspector.querySelector<HTMLElement>(".inspector-padding-section")
  if (paddingSection) paddingSection.hidden = bdaSelected || !hasSelection || sections.some(isListCell) || !sections.every((section) => effectiveKeyValue(section, "PADDING") !== undefined)
  const multiLayout = $("#inspector-multi-layout")
  const multiAvailable = sections.length > 1 && appState.archive?.format !== "bda" && !sections.some(isListCell)
  multiLayout.dataset.available = String(multiAvailable)
  multiLayout.hidden = !multiAvailable
  canvasMultiToolbar.dataset.available = String(multiAvailable)
  const multiLabel = appState.archive?.format === "bda"
    ? "此格式不支持布局编辑" : sections.some(isListCell) ? "列表单元不支持批量布局"
      : multiAvailable ? `将修改 ${sections.length} 个按键` : "选择 2 个或更多按键"
  multiLayout.querySelector("[role=status]")!.textContent = multiLabel
  canvasMultiCount.textContent = multiLabel
  const layoutNote = keyLayoutFieldsGroup.querySelector<HTMLElement>(".inspector-note")!
  layoutNote.textContent = appState.archive?.format === "bda"
    ? "此格式的位置与尺寸仅供查看。外观和文字可在对应分类中修改。"
    : "方向键移动 1 px · Shift + 方向键移动 10 px"
  const listSelected = sections.some(isListCell)
  const keyToolsAvailable = hasSelection && isEditing() && appState.archive?.format !== "bda" && !listSelected
  for (const button of keyModeButtons) button.disabled = !keyToolsAvailable
  for (const button of keyActionButtons) {
    button.disabled = !keyToolsAvailable || (
      button.dataset.keyAction === "swap" && appState.selectedKeySections.length !== 2
    )
  }
  if (!keyToolsAvailable && appState.keyMode === "move") {
    appState.keyMode = "select"
    keyModeButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.keyMode === appState.keyMode)))
    preview.setEditTool(appState.keyMode)
  }
  for (const button of layoutActionButtons) {
    button.disabled = appState.archive?.format === "bda" || listSelected || (
      button.dataset.layoutAction === "swap" || button.dataset.layoutAction === "merge"
        ? appState.selectedKeySections.length !== 2
        : appState.selectedKeySections.length < 2
    )
  }
  const rects = selectedRects().filter((rect) => !isListCell(rect.section))
  for (const field of gapFields) {
    field.disabled = rects.length < 2 || appState.archive?.format === "bda" || listSelected
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
    const values = appState.selectedKeySections.map((section) => effectiveKeyValue(section, name) ?? "")
    node.textContent =
      !hasSelection || !values.every((value) => value === values[0])
        ? hasSelection
          ? "混合操作"
          : ""
        // 空值由输入框占位符提示「未配置」，这里不再重复
        : values[0] ? actionDescription(values[0]) : ""
  }
  for (const field of keyFields) syncActionCodeSuggestions(field)
  void updateStylePreviews()
  populateDocumentInspector()
  populateBdaConfigInspector()
  if (bdaSelected) {
    for (const field of keyFields) {
      if (field.dataset.keyField === "SHOW") field.closest("label")?.setAttribute("hidden", "")
    }
  }
  syncMobileInspectorGroups()
  revealSinglePageInspectorGroup(JSON.stringify([appState.selectedPath, appState.selectedKeySections, appState.selectedCandidate]))
  applyModeState()
  syncInspectorRows(JSON.stringify([appState.selectedPath, appState.selectedKeySections, mode.value]))
}

function updateSkinInfo(field: HTMLInputElement): void {
  if (!appState.archive || !appState.selectedDocument || !isSkinInfoPath(appState.selectedPath)) return
  const before = appState.selectedDocument.toString()
  appState.selectedDocument.set("", field.dataset.skinField ?? "", field.value)
  const text = appState.selectedDocument.toString()
  commitText(appState.selectedPath, before, text)
  setSourceValue(text)
  updateDirty()
}

function renameDocumentTitle(): void {
  const currentNode = $("#document-name")
  const currentArchive = appState.archive
  if (!currentArchive || currentNode.parentElement?.querySelector("input")) return
  const current = currentNode.textContent?.trim() ?? ""
  if (!current || current === "未打开皮肤") return
  const input = document.createElement("input")
  input.type = "text"
  input.value = current
  input.setAttribute("aria-label", "皮肤名称")
  // 复用原标题节点：替换节点会让全局 documentName 指向脱离 DOM 的旧节点，导致只能改名一次
  currentNode.hidden = true
  currentNode.after(input)
  input.select()
  input.focus()

  let finished = false
  const finish = (save: boolean): void => {
    if (finished) return
    finished = true
    const next = save ? input.value.trim() : current
    currentNode.textContent = next || current
    currentNode.hidden = false
    input.remove()
    if (!save || !next || next === current) return
    // Keep the archive's skin metadata in sync with the title when available.
    const infoPath = currentArchive.names().includes(`${theme.value}/skin/Info.txt`)
      ? `${theme.value}/skin/Info.txt`
      : currentArchive.names().includes("Info.txt") ? "Info.txt" : undefined
    if (infoPath && currentArchive.isText(infoPath)) {
      const info = infoPath === appState.selectedPath && appState.selectedDocument
        ? appState.selectedDocument
        : IniDocument.parse(currentArchive.getText(infoPath))
      const before = info.toString()
      info.set("", "Name", next)
      const after = info.toString()
      if (before !== after) {
        commitText(infoPath, before, after)
        if (infoPath === appState.selectedPath) {
          appState.selectedDocument = info
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
  if (!appState.archive) return
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
  if (!appState.archive || !appState.selectedDocument || !isToolbarPath(appState.selectedPath) || !isEditing()) return
  const [section, key] = (field.dataset.toolbarField ?? "").split(".")
  const property = key || section
  const targetSection = key ? section : "CAND"
  const path = property === "VIEW_RECT" ? genConfigPath() : appState.selectedPath
  if (!appState.archive.isText(path)) return
  const document = path === appState.selectedPath ? appState.selectedDocument : IniDocument.parse(appState.archive.getText(path))
  const before = document.toString()
  if (!document.set(targetSection, property, field.value)) return
  const text = document.toString()
  commitText(path, before, text)
  if (path === appState.selectedPath) setSourceValue(text)
  refreshPreview()
  populateKeyInspector()
  updateDirty()
}

function updateSelectedKey(field: HTMLInputElement): void {
  const name = field.dataset.keyField ?? ""
  if (appState.archive?.format === "bda") return
  if (!appState.archive || !appState.layoutDocument || !appState.selectedKeySections.length) return
  const rectNames = ["x", "y", "width", "height"]
  if (appState.selectedKeySections.length === 1 && isListCell(appState.selectedKeySections[0])) {
    // LIST 候选栏单元：几何字段写回定义处（布局或 gen.ini），其余写回布局的 [LIST]
    if (rectNames.includes(name)) {
      const geometry = listGeometryDocument()
      if (!geometry) return
      const before = geometry.document.toString()
      const count = name === "height"
        ? Number(appState.layoutDocument.get("LIST", "LIST_NUM")) || 1
        : undefined
      setListCellValue(geometry.document, appState.selectedKeySections[0], name, field.value, count)
      const text = geometry.document.toString()
      if (text === before) return
      commitText(geometry.path, before, text)
      if (appState.selectedPath === geometry.path) setSourceValue(text)
      refreshPreview()
    } else {
      const before = appState.layoutDocument.toString()
      setListCellValue(appState.layoutDocument, appState.selectedKeySections[0], name, field.value)
      const text = appState.layoutDocument.toString()
      commitText(appState.layoutPath, before, text)
      if (appState.selectedPath === appState.layoutPath) setSourceValue(text)
      preview.setDocument(appState.layoutDocument)
    }
    populateKeyInspector()
    updateDirty()
    return
  }
  const before = appState.layoutDocument.toString()
  const rectIndex = rectNames.indexOf(name)
  for (const section of preview.expandSections(appState.selectedKeySections)) {
    if (rectIndex >= 0) {
      const rect = appState.layoutDocument.get(section, "VIEW_RECT")?.split(",").map(Number)
      const value = Number(field.value)
      if (!rect || rect.length !== 4 || !Number.isFinite(value)) continue
      rect[rectIndex] = value
      appState.layoutDocument.set(section, "VIEW_RECT", rect.map(Math.round).join(","))
    } else {
      const target = name === "STAT_STYLE" ? section : effectiveKeySection(section)
      if (name.startsWith("PADDING.")) {
        const values = (effectiveKeyValue(section, "PADDING") ?? "0,0,0,0").split(",")
        const value = Number(field.value)
        if (!Number.isFinite(value)) continue
        values[Number(name.split(".")[1])] = String(value)
        appState.layoutDocument.set(target, "PADDING", values.join(","))
      } else appState.layoutDocument.set(target, name, field.value)
    }
  }
  const text = appState.layoutDocument.toString()
  commitText(appState.layoutPath, before, text)
  if (appState.selectedPath === appState.layoutPath) setSourceValue(text)
  preview.setDocument(appState.layoutDocument)
  populateKeyInspector()
  updateDirty()
}

function updateSelectedStyle(field: HTMLInputElement): void {
  const property = field.dataset.styleField ?? ""
  if (appState.archive?.format === "bda") {
    updateBdaRefs(selectedBdaRefs("FORE_STYLE", "text"), property, field.value)
    return
  }
  const context = selectedStylePropertyContext(property)
  if (!appState.archive || !context) return
  const before = context.document.toString()
  for (const section of new Set(context.sources.map((source) => source.section))) {
    context.document.set(section, property, field.value)
  }
  const text = context.document.toString()
  commitText(context.path, before, text)
  if (appState.selectedPath === context.path) setSourceValue(text)
  refreshPreview()
  populateKeyInspector()
  updateDirty()
}

function selectedStyleImageSections(source: "BACK_STYLE" | "FORE_STYLE"): { document: IniDocument; path: string; sections: string[] } | undefined {
  if (!appState.archive || !appState.layoutDocument || !appState.selectedKeySections.length) return
  const path = styleConfigPath()
  if (!appState.archive.isText(path)) return
  const document = IniDocument.parse(appState.archive.getText(path))
  const sections = source === "BACK_STYLE"
    ? [...new Set(appState.selectedKeySections.flatMap((key) => {
        const backStyle = isListCell(key)
          ? appState.layoutDocument?.get("LIST", "BACK_STYLE") ?? ""
          : effectiveKeyValue(key, source) ?? ""
        const id = backStyle.split(",")[0]?.trim()
        return id && /^\d+$/.test(id) ? [`STYLE${id}`] : []
      }))]
    : [...new Set(appState.selectedKeySections.flatMap((key) => {
        const foreStyle = isListCell(key)
          ? appState.layoutDocument?.get("LIST", "FORE_STYLE") ?? ""
          : effectiveKeyValue(key, source) ?? ""
        return foreStyle.split(",").map((token) => token.trim()).flatMap((token) => {
          const value = Number(token)
          return [`STYLE${token}`, Number.isFinite(value) ? `STYLE${Math.floor(value / 100)}` : ""]
        }).filter((section) => section && document.sections().includes(section))
      }))]
  return sections.length ? { document, path, sections } : undefined
}

function updateSelectedImageReference(target: StyleImagePickerTarget | undefined, value: string): boolean {
  if (!appState.archive || !target) return false
  const { document, path, sections } = target
  if (document && path && sections?.length) {
    const before = document.toString()
    setStyleField(document, sections, target.property, value)
    const text = document.toString()
    commitText(path, before, text)
    if (appState.selectedPath === path) setSourceValue(text)
    refreshPreview()
    if (appState.resourceInspectorMode === "style" && appState.resourceConfigActive) {
      void renderStyleResourceDetail()
    }
    populateKeyInspector()
    updateDirty()
    return true
  }
  if (appState.archive?.format === "bda") {
    const refs = target.source === "FORE_STYLE"
      ? selectedBdaRefs("FORE_STYLE", "image", "BACK_STYLE")
      : selectedBdaRefs("BACK_STYLE", "image")
    return updateBdaRefs(refs, target.property, value)
  }
  const context = selectedStyleImageSections(target.source)
  if (!appState.archive || !context) return false
  const before = context.document.toString()
  setStyleField(context.document, context.sections, target.property, value)
  const text = context.document.toString()
  commitText(context.path, before, text)
  if (appState.selectedPath === context.path) setSourceValue(text)
  refreshPreview()
  populateKeyInspector()
  updateDirty()
  return true
}

// 切片窗口标题栏显示所属样式：优先用引用目标里的 STYLE 段，其次退回资源检查器正在查看的样式。
function imagePickerStyleName(target: StyleImagePickerTarget): string {
  const section = target.sections?.find((name) => /^STYLE\d+$/i.test(name))
  const styleID = section ? section.replace(/^STYLE/i, "") : appState.selectedStyleID
  return styleID ? `样式 ${stylePickerLabel(styleID)}` : ""
}

function imageDataURL(bytes: Uint8Array): string {
  let binary = ""
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
  }
  return `data:image/png;base64,${btoa(binary)}`
}

// 图片切片与「全部图片」列表共用一个窗口，不再另开资源窗口。
async function showPickerWindow(
  view: "image" | "list" | "styles",
  title: string,
  width: number,
  height: number,
): Promise<void> {
  const existing = await WebviewWindow.getByLabel("image-picker")
  if (existing) {
    if (view === "list") await emitTo("image-picker", "image-picker-show-list")
    else if (view === "styles") await emitStyleLibrary()
    else if (appState.nativeImagePickerPayload) await emitTo("image-picker", "image-picker-data", appState.nativeImagePickerPayload)
    await existing.setFocus()
    return
  }
  appState.pickerRequestedView = view
  new WebviewWindow("image-picker", {
    url: "picker.html",
    title,
    width,
    height,
    minWidth: 720,
    minHeight: 480,
    center: true,
    decorations: true,
    resizable: true,
  })
}

function openImagePickerList(): void {
  if (!appState.archive || (!appState.pickerTarget && !appState.resourcePickerSelect)) return
  void showPickerWindow("list", "全部图片", 960, 680)
}

function resourcePickerPayload(): NativeResourcePickerPayload {
  return resourceImagePaths(appState.archive?.names() ?? [], theme.value, orientation.value).flatMap((path) => {
    const bytes = appState.archive?.getBytes(path)
    return bytes ? [{ path, dataURL: imageDataURL(bytes) }] : []
  })
}

function closeStyleImageResourcePicker(): void {
  styleImageResourcePicker.hidden = true
  styleImageResourceSearch.value = ""
  appState.resourcePickerSelect = undefined
}

function selectImageResource(path: string): void {
  const select = appState.resourcePickerSelect
  if (select) {
    const resourceID = path.split("/").pop()?.replace(/\.png$/i, "") ?? path
    clearImageSlicePicker()
    select(resourceID)
    return
  }
  if (appState.pickerTarget) openImageSlicePicker(path, appState.pickerTarget)
}

function renderStyleImageResources(): void {
  if (!appState.archive) return
  const query = styleImageResourceSearch.value.trim().toLowerCase()
  const paths = resourceImagePaths(appState.archive.names(), theme.value, orientation.value)
    .filter((path) => path.toLowerCase().includes(query))
  styleImageImgList.replaceChildren()
  for (const path of paths) {
    const bytes = appState.archive.getBytes(path)
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
    button.classList.toggle("active", path === appState.pickerPath)
    button.addEventListener("click", () => {
      if (appState.resourcePickerSelect) selectImageResource(path)
      else {
        closeStyleImageResourcePicker()
        if (appState.pickerTarget) openImageSlicePicker(path, appState.pickerTarget)
      }
    })
    styleImageImgList.append(button)
  }
  const count = styleImageImgList.childElementCount
  styleImageResourceCount.textContent = `${count} 张图片`
  styleImageResourceEmpty.hidden = count > 0
}

function openStyleImageResourcePicker(): void {
  if (isTauri() || !appState.archive || (!appState.pickerTarget && !appState.resourcePickerSelect)) return
  styleImageSource.hidden = !(appState.pickerTarget?.path && appState.pickerTarget.sections?.length)
  if (!appState.pickerTarget) {
    showStyleImageDialog()
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
  if (appState.pickerURL) URL.revokeObjectURL(appState.pickerURL)
  appState.pickerURL = ""
  appState.pickerImage = undefined
  appState.pickerSlices = []
  appState.pickerPath = ""
  appState.pickerTarget = undefined
  appState.resourcePickerSelect = undefined
  appState.pickerSelectedIndex = undefined
  styleImagePicker.hidden = true
  styleImageResourceOpen.hidden = true
  styleImageSource.hidden = true
  closeStyleImageResourcePicker()
  styleImageImgList.replaceChildren()
  styleImageResourceCount.textContent = ""
  styleImageResourceEmpty.hidden = true
  if (styleImageDialog.open) styleImageDialog.close()
  appState.nativeImagePickerPayload = undefined
  if (isTauri()) {
    appState.pickerRequestedView = "image"
    void WebviewWindow.getByLabel("image-picker").then((pickerWindow) => pickerWindow?.close())
  }
}

function drawImageSlicePicker(): void {
  if (!appState.pickerImage?.naturalWidth) return
  appState.pickerScale = drawSlicePicker(styleImagePickerCanvas, appState.pickerImage, pickableSlices(appState.pickerSlices, appState.pickerImage), appState.pickerSelectedIndex, appState.pickerFit * appState.pickerZoom, { normal: "#3a6df0", selected: "#ff6b2c" })
  appState.pickerOffset = { x: 0, y: 0 }
}

function pickerImageReference(index: number): string {
  const name = appState.pickerPath.split("/").pop()?.replace(/\.png$/i, "") ?? appState.pickerPath
  return index === WHOLE_IMAGE_INDEX ? name : `${name},${index}`
}

function openImageSlicePicker(path: string, target: StyleImagePickerTarget, selectedSource?: TileRect): void {
  if (!appState.archive?.isImage(path)) return
  const bytes = appState.archive.getBytes(path)
  if (!bytes) return
  if (appState.pickerURL) URL.revokeObjectURL(appState.pickerURL)
  appState.pickerURL = URL.createObjectURL(new Blob([new Uint8Array(bytes).buffer], { type: "image/png" }))
  appState.pickerPath = path
  appState.pickerTarget = target
  const tilePathForPicker = path.replace(/\.png$/i, ".til")
  appState.pickerSlices = appState.archive.isText(tilePathForPicker) ? tileSlices(IniDocument.parse(appState.archive.getText(tilePathForPicker))) : []
  appState.pickerSelectedIndex = !appState.pickerSlices.length && selectedSource
    ? WHOLE_IMAGE_INDEX
    : appState.pickerSlices.find((slice) => selectedSource && slice.source.join(",") === selectedSource.join(","))?.index
  appState.nativeImagePickerPayload = {
    path,
    dataURL: imageDataURL(bytes),
    slices: appState.pickerSlices,
    selectedIndex: appState.pickerSelectedIndex,
    editable: isEditing(),
    styleName: imagePickerStyleName(target),
    // 行内缩略图传入的是未挂载的克隆输入框，只要有引用目标就能回到样式库。
    styleLibrary: Boolean(appState.stylePickerTarget),
  }
  if ("__TAURI_INTERNALS__" in window) {
    if (styleImageDialog.open) styleImageDialog.close()
    void showPickerWindow("image", "图片切片", 1100, 760)
    return
  }
  closeStyleImageResourcePicker()
  appState.pickerImage = new Image()
  appState.pickerImage.onload = () => {
    if (!appState.pickerImage) return
    // 初始大小铺满可视区域（减去内边距与底部说明），之后由缩放倍率调整
    const width = styleImagePicker.clientWidth - 38
    const height = styleImagePicker.clientHeight - 38 - styleImagePickerMeta.offsetHeight - 7
    appState.pickerFit = Math.min((width > 0 ? width : 960) / appState.pickerImage.naturalWidth, (height > 0 ? height : 640) / appState.pickerImage.naturalHeight)
    appState.pickerZoom = 1
    drawImageSlicePicker()
  }
  appState.pickerImage.src = appState.pickerURL
  styleImageSource.hidden = !(target.path && target.sections?.length)
  styleImagePicker.hidden = false
  styleImageResourceOpen.hidden = false
  styleImageTitle.textContent = path.split("/").pop() ?? path
  styleImageSubtitle.textContent = " · 选择切片"
  styleImagePickerMeta.textContent = `${appState.pickerSlices.length ? "点击图片中的切片以修改引用" : "点击整张图以修改引用"} · ⌘/Ctrl + 滚轮或双指捏合缩放`
  showStyleImageDialog()
}

function selectedRects(): LayoutRect[] {
  if (!appState.layoutDocument) return []
  const document = appState.layoutDocument
  return appState.selectedKeySections.flatMap((section) => {
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
  if (!appState.archive || !appState.layoutDocument) return
  if (action === "merge") {
    mergeSelectedKeys()
    return
  }
  const real = selectedRects().filter((rect) => !isListCell(rect.section))
  const rects = transformLayout(real, action as LayoutAction)
  if (rects.length < 2) return
  const before = appState.layoutDocument.toString()
  for (const rect of rects) {
    appState.layoutDocument.set(
      rect.section,
      "VIEW_RECT",
      [rect.x, rect.y, rect.width, rect.height].map(Math.round).join(","),
    )
  }
  const text = appState.layoutDocument.toString()
  commitText(appState.layoutPath, before, text)
  if (appState.selectedPath === appState.layoutPath) setSourceValue(text)
  preview.setDocument(appState.layoutDocument)
  populateKeyInspector()
  updateDirty()
}

function mergeSelectedKeys(): void {
  if (!appState.archive || !appState.layoutDocument) return
  const rects = selectedRects().filter((rect) => !isListCell(rect.section))
  if (rects.length !== 2) return
  const before = appState.layoutDocument.toString()
  const merged = mergeLayoutRects(rects[0], rects[1])
  appState.layoutDocument.set(merged.section, "VIEW_RECT", [merged.x, merged.y, merged.width, merged.height].map(Math.round).join(","))
  if (!appState.layoutDocument.removeSections([rects[1].section])) return
  const renamed = normalizeKeySections(appState.layoutDocument)
  const text = appState.layoutDocument.toString()
  commitText(appState.layoutPath, before, text)
  if (appState.selectedPath === appState.layoutPath) setSourceValue(text)
  appState.selectedKeySections = [renamed.get(merged.section) ?? merged.section]
  preview.setDocument(appState.layoutDocument)
  preview.setSelected(appState.selectedKeySections)
  populateKeyInspector()
  updateSourceHighlight()
  updateDirty()
}

function applyExactGap(field: HTMLInputElement): void {
  if (!appState.archive || !appState.layoutDocument) return
  const gap = Number(field.value)
  if (!Number.isFinite(gap)) return
  const rects = setExactGap(
    selectedRects().filter((rect) => !isListCell(rect.section)),
    field.dataset.gapField === "horizontal" ? "horizontal" : "vertical",
    gap,
  )
  if (rects.length < 2) return
  const before = appState.layoutDocument.toString()
  for (const rect of rects) {
    appState.layoutDocument.set(
      rect.section,
      "VIEW_RECT",
      [rect.x, rect.y, rect.width, rect.height].map(Math.round).join(","),
    )
  }
  const text = appState.layoutDocument.toString()
  commitText(appState.layoutPath, before, text)
  if (appState.selectedPath === appState.layoutPath) setSourceValue(text)
  preview.setDocument(appState.layoutDocument)
  populateKeyInspector()
  updateDirty()
}

function moveSelectedKeys(
  deltaX: number,
  deltaY: number,
  sections: readonly string[] = appState.selectedKeySections,
  coalesce = false,
): void {
  if (!appState.archive || !appState.layoutDocument) return
  const rects = moveRects(sections.flatMap((section) => {
    const values = appState.layoutDocument?.get(section, "VIEW_RECT")?.split(",").map(Number)
    if (!values || values.length !== 4 || values.some((value) => !Number.isFinite(value))) return []
    const [x, y, width, height] = values
    return [{ section, x, y, width, height }]
  }), deltaX, deltaY)
  if (!rects.length) return
  const before = appState.layoutDocument.toString()
  for (const rect of rects) {
    appState.layoutDocument.set(
      rect.section,
      "VIEW_RECT",
      [rect.x, rect.y, rect.width, rect.height].map(Math.round).join(","),
    )
  }
  const text = appState.layoutDocument.toString()
  commitText(appState.layoutPath, before, text, coalesce)
  if (appState.selectedPath === appState.layoutPath) setSourceValue(text)
  preview.setDocument(appState.layoutDocument)
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
    x: ((event.clientX - bounds.left) / bounds.width) * workspaceImage.naturalWidth,
    y: ((event.clientY - bounds.top) / bounds.height) * workspaceImage.naturalHeight,
  }
}

function commitBdaTileInnerRect(rect: TileRect): void {
  const info = currentBdaAppearance()
  const usage = selectedBdaTileUsage()
  const slice = appState.slices.find((item) => item.index === appState.selectedTileIndex)
  if (!info || !usage || !slice || !isEditing()) return
  const [x, y, width, height] = rect
  if (rect.some((value) => !Number.isInteger(value) || value < 0)) return
  if (x + width > slice.source[2] || y + height > slice.source[3]) return
  const after = updateBdaImageInnerRect(info.bytes, usage.ref, usage.highlighted, rect)
  commitBytes(info.path, info.bytes, after)
  loadTiles(appState.selectedResourcePath)
  refreshPreview()
  populateKeyInspector()
  updateDirty()
}

function commitTile(slice: TileSlice, coalesce = false): void {
  if (!appState.archive || appState.archive.format === "bda" || !appState.selectedResourcePath || !isEditing()) return
  const [x, y, width, height] = slice.source
  if (
    slice.source.some(value => !Number.isInteger(value)) ||
    width <= 0 || height <= 0 || x < 0 || y < 0 ||
    x + width > workspaceImage.naturalWidth || y + height > workspaceImage.naturalHeight
  ) return
  const before = appState.tileDocument.toString()
  updateTileSlice(appState.tileDocument, slice)
  commitText(appState.tilePath, before, appState.tileDocument.toString(), coalesce)
  setSourceValue(appState.tileDocument.toString())
  appState.slices = tileSlices(appState.tileDocument)
  appState.selectedTileIndex = slice.index
  updateSourceHighlight()
  populateTileInspector()
  drawAtlas()
  updateDirty()
  renderResourceInspectorMetadata()
}

async function autoSliceSelectedImage(): Promise<void> {
  const currentArchive = appState.archive
  const path = appState.selectedResourcePath
  if (!currentArchive || currentArchive.format === "bda" || !path || !appState.tilePath || !isEditing()) return
  const bytes = currentArchive.getBytes(path)
  if (!bytes) return
  try {
    const scan = await decodePngMask(bytes)
    const cells = detectGridCells(scan.mask, scan.width, scan.height)
    if (!cells.length) {
      showStatus("未识别到可切片的透明图块")
      return
    }
    if (appState.slices.length && !window.confirm(`自动切片将替换当前 ${appState.slices.length} 个切片，是否继续？`)) return
    if (appState.archive !== currentArchive || appState.selectedResourcePath !== path || !isEditing()) return
    const before = appState.tileDocument.toString()
    for (const slice of appState.slices) removeTileSlice(appState.tileDocument, slice.index)
    cells.forEach((source, index) => updateTileSlice(appState.tileDocument, { index: index + 1, source }))
    commitText(appState.tilePath, before, appState.tileDocument.toString())
    loadTiles(path)
    appState.selectedTileIndex = 1
    updateSourceHighlight()
    populateTileInspector()
    drawAtlas()
    updateDirty()
    showStatus(`已自动切片 ${cells.length} 个区域`)
  } catch (error) {
    showStatus(`自动切片失败：${error instanceof Error ? error.message : String(error)}`)
  }
}

function renderResourceInspectorMetadata(): void {
  for (const item of resourceGallery.querySelectorAll<HTMLElement>(".resource-item")) {
    if (item.dataset.path !== appState.selectedResourcePath) continue
    const meta = item.querySelector("small")
    const size = meta?.textContent?.split(" · ")[0]
    if (meta) meta.textContent = `${size ? `${size} · ` : ""}TIL`
  }
}

function setDrawingTile(active: boolean): void {
  appState.drawingTile = active
  appState.tileDragStart = undefined
  appState.tileDraft = undefined
  if (active) {
    appState.movingTile = undefined
    appState.moveStart = undefined
    appState.moveSource = undefined
  }
  newTileButton.classList.toggle("active", active)
  atlasCanvas.classList.toggle("drawing", active)
  drawAtlas()
}

function moveSelectedTile(deltaX: number, deltaY: number, coalesce = false): void {
  if (!appState.archive || !appState.selectedResourcePath || !isEditing()) return
  const existing = appState.slices.find((slice) => slice.index === appState.selectedTileIndex)
  if (!existing) return
  const source = moveTileRect(existing.source, deltaX, deltaY, workspaceImage.naturalWidth, workspaceImage.naturalHeight)
  const actualX = source[0] - existing.source[0]
  const actualY = source[1] - existing.source[1]
  if (!actualX && !actualY) return
  const inner = existing.inner
    ? moveTileRect(existing.inner, actualX, actualY, workspaceImage.naturalWidth, workspaceImage.naturalHeight)
    : undefined
  commitTile({ index: existing.index, source, ...(inner ? { inner } : {}) }, coalesce)
}

function deleteSelectedTile(): void {
  if (!appState.archive || appState.archive.format === "bda" || !appState.selectedResourcePath || !isEditing() || appState.selectedTileIndex === undefined) return
  const before = appState.tileDocument.toString()
  if (!removeTileSlice(appState.tileDocument, appState.selectedTileIndex)) return
  // 工具书 V6 p43：切片序号禁止跳号；删中间切片后顺延重排，并同步同目录 css 中 *_IMG=素材名,序号 的引用。
  const shifted = new Map([...appState.tileDocument.renumberSections("IMG")].map(([from, to]) => [from.slice(3), to.slice(3)]))
  const changes: Change[] = [{ kind: "text", path: appState.tilePath, before, after: appState.tileDocument.toString() }]
  const directory = appState.selectedResourcePath.slice(0, appState.selectedResourcePath.lastIndexOf("/") + 1)
  const stem = appState.selectedResourcePath.slice(directory.length).replace(/\.png$/i, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const reference = new RegExp(`^(\\s*[A-Z_]*IMG\\s*=\\s*${stem}\\s*,\\s*)(\\d+)`, "gim")
  for (const path of shifted.size ? appState.archive.names() : []) {
    if (!path.startsWith(directory) || path.slice(directory.length).includes("/") || !/\.css$/i.test(path) || !appState.archive.isText(path)) continue
    const text = appState.archive.getText(path)
    const next = text.replace(reference, (_, prefix: string, index: string) => prefix + (shifted.get(index) ?? index))
    if (next !== text) changes.push({ kind: "text", path, before: text, after: next })
  }
  commitBatch(changes)
  setSourceValue(appState.tileDocument.toString())
  appState.slices = tileSlices(appState.tileDocument)
  appState.selectedTileIndex = undefined
  updateSourceHighlight()
  populateTileInspector()
  drawAtlas()
  updateDirty()
}

function duplicateSelectedTile(): void {
  const existing = appState.slices.find((slice) => slice.index === appState.selectedTileIndex)
  if (!existing || !isEditing()) return
  commitTile(duplicateTileSlice(existing, nextTileIndex(appState.tileDocument)))
}

function updateSelectedTile(): void {
  const existing = appState.slices.find((slice) => slice.index === appState.selectedTileIndex)
  if (!existing) return
  const innerValues = tileInnerFields.map((field) => field.value.trim())
  const innerNumbers = innerValues.map(Number) as TileRect
  let inner = innerValues.every(Boolean) && innerNumbers.every(Number.isFinite) ? innerNumbers : undefined
  if (appState.archive?.format === "bda") {
    if (inner) commitBdaTileInnerRect(inner)
    return
  }
  const source = tileSourceFields.map((field) => Number(field.value)) as TileRect
  if (source.some((value) => !Number.isFinite(value))) return
  if (inner) {
    const [left, top, right, bottom] = inner
    if (inner.some(value => value < 0 || !Number.isInteger(value)) || left + right >= source[2] || top + bottom >= source[3]) {
      populateTileInspector()
      showStatus("九宫格边距不能超出切片范围")
      return
    }
    inner = [source[0] + left, source[1] + top, source[2] - left - right, source[3] - top - bottom]
  }
  commitTile({ index: existing.index, source, ...(inner ? { inner } : {}) })
}

function setSidebarView(view: "overview" | "source"): void {
  appState.sidebarView = view
  for (const button of sidebarViewButtons) {
    button.classList.toggle("active", button.dataset.sidebarView === view)
  }
  files.querySelector<HTMLElement>(".sidebar-overview")?.toggleAttribute("hidden", view !== "overview")
  files.querySelector<HTMLElement>(".raw-files")?.toggleAttribute("hidden", view !== "source")
  sourceFileToolbar.hidden = view !== "source"
  updateSourceFileActions()
}

function sourceSelection(): { path: string; folder: boolean } | undefined {
  if (!appState.selectedFileButton?.closest(".raw-files")) return
  const path = appState.selectedFileButton.dataset.path
    ?? appState.selectedFileButton.dataset.folderPath
    ?? appState.selectedFileButton.closest<HTMLDetailsElement>("details.raw-folder")?.dataset.folderPath
  return path ? { path, folder: !appState.selectedFileButton.dataset.path } : undefined
}

function updateSourceFileActions(): void {
  const selection = sourceSelection()
  const editable = Boolean(appState.archive) && isEditing() && !appState.fileOperationRunning
  sourceUploadButton.disabled = !editable
  sourceDownloadButton.disabled = appState.fileOperationRunning || !selection || selection.folder
  sourceCopyButton.disabled = appState.fileOperationRunning || !selection
  sourcePasteButton.disabled = !editable || !appState.sourceTransfer?.files.length
  sourceMoveButton.disabled = !editable || !selection
  sourceDeleteButton.disabled = !editable || !selection
  sourceCopyButton.classList.toggle("active", appState.sourceTransfer?.mode === "copy")
  sourceMoveButton.classList.toggle("active", appState.sourceTransfer?.mode === "move")
  sourceCopyButton.setAttribute("aria-pressed", String(appState.sourceTransfer?.mode === "copy"))
  sourceMoveButton.setAttribute("aria-pressed", String(appState.sourceTransfer?.mode === "move"))
}

function sourceTargetFolder(): string {
  const selection = sourceSelection()
  if (!selection) return ""
  if (selection.folder) return selection.path
  return selection.path.split("/").slice(0, -1).join("/")
}

function sourcePaths(selection: { path: string; folder: boolean }): string[] {
  if (!appState.archive) return []
  return selection.folder
    ? appState.archive.names().filter((path) => !path.endsWith("/") && path.startsWith(`${selection.path}/`))
    : appState.archive.getBytes(selection.path) ? [selection.path] : []
}

/** 生成「名称 副本.ext」「名称 副本 2.ext」，跳过已占用的路径。 */
function sourceCopyPath(path: string, taken: (candidate: string) => boolean): string {
  const slash = path.lastIndexOf("/")
  const name = path.slice(slash + 1)
  const dot = name.lastIndexOf(".")
  const stem = dot > 0 ? name.slice(0, dot) : name
  const extension = dot > 0 ? name.slice(dot) : ""
  for (let index = 1; ; index += 1) {
    const candidate = `${path.slice(0, slash + 1)}${stem} 副本${index > 1 ? ` ${index}` : ""}${extension}`
    if (!taken(candidate)) return candidate
  }
}

function setSourceTransfer(mode: SourceTransfer["mode"]): void {
  const selection = sourceSelection()
  if (!appState.archive || !selection || mode === "move" && !isEditing()) return
  const base = selection.folder ? `${selection.path.split("/").pop()}/` : ""
  appState.sourceTransfer = {
    mode,
    sourcePath: selection.path,
    folder: selection.folder,
    files: sourcePaths(selection).flatMap((source) => {
      const bytes = appState.archive?.getBytes(source)
      if (!bytes) return []
      const relative = selection.folder ? source.slice(selection.path.length + 1) : source.split("/").pop() ?? source
      return [{ path: `${base}${relative}`, source, bytes: bytes.slice() }]
    }),
  }
  updateSourceFileActions()
}

function refreshAfterSourceMutation(preferredPath?: string): void {
  if (!appState.archive) return
  const selectedStillExists = appState.archive.getBytes(appState.selectedPath)
  renderFiles()
  setSidebarView("source")
  const next = preferredPath && appState.archive.getBytes(preferredPath)
    ? preferredPath
    : selectedStillExists
      ? appState.selectedPath
      : appState.archive.names().find((path) => appState.archive?.isText(path) || appState.archive?.isImage(path) || appState.archive?.isBdaConfig(path))
  if (next) {
    selectFile(next, "source")
    revealSourceFile(next)
  }
  refreshPreview()
  updateDirty()
}

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
  if (!appState.archive || !uploads.length) return false
  const changes = uploads.map(({ name, bytes }) => {
    const filename = name.split(/[\\/]/).pop() ?? name
    const path = folder ? `${folder}/${filename}` : filename
    return { path, bytes }
  })
  const conflicts = changes.filter(({ path }) => appState.archive?.getBytes(path)).map(({ path }) => path)
  if (conflicts.length && !window.confirm(`以下文件已存在，是否替换？\n\n${conflicts.join("\n")}`)) return false
  commitBatch(changes.map(({ path, bytes }) => ({
    kind: "bytes",
    path,
    before: appState.archive!.getBytes(path)?.slice(),
    after: bytes,
  })))
  refreshAfterSourceMutation(changes[0]?.path)
  return true
}

sourceUploadButton.addEventListener("click", () => {
  if (!appState.archive || !isEditing()) return
  sourceUploadInput.value = ""
  sourceUploadInput.click()
})

sourceUploadInput.addEventListener("change", () => {
  void runFileOperation("上传文件", async () => {
    if (!appState.archive || !sourceUploadInput.files?.length) return false
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
    if (!appState.archive || !selection || selection.folder) return false
    const bytes = appState.archive.getBytes(selection.path)
    if (!bytes) return false
    return Boolean(await writeToChosenFile(selection.path.split("/").pop() ?? "download", bytes))
  })
})

sourceCopyButton.addEventListener("click", () => {
  setSourceTransfer("copy")
})

sourcePasteButton.addEventListener("click", () => {
  if (!appState.archive || !isEditing() || !appState.sourceTransfer?.files.length) return
  const folder = sourceTargetFolder()
  if (appState.sourceTransfer.mode === "move" && appState.sourceTransfer.folder &&
    (folder === appState.sourceTransfer.sourcePath || folder.startsWith(`${appState.sourceTransfer.sourcePath}/`))) {
    window.alert("不能将文件夹移动到自身内部。")
    return
  }
  let copies = appState.sourceTransfer.files.map(({ path, source, bytes }) => ({
    path: folder ? `${folder}/${path}` : path,
    source,
    bytes,
  }))
  if (appState.sourceTransfer.mode === "move" && copies.every(({ path, source }) => path === source)) return
  // 复制后粘贴回原位置：按访达习惯另存为「名称 副本」，而不是询问是否用自己替换自己。
  if (appState.sourceTransfer.mode === "copy") {
    const names = appState.archive.names()
    if (appState.sourceTransfer.folder) {
      const top = `${folder ? `${folder}/` : ""}${appState.sourceTransfer.sourcePath.split("/").pop()}`
      if (top === appState.sourceTransfer.sourcePath) {
        const renamed = sourceCopyPath(top, (candidate) => names.some((name) => name.startsWith(`${candidate}/`)))
        copies = copies.map((copy) => ({ ...copy, path: renamed + copy.path.slice(top.length) }))
      }
    } else {
      copies = copies.map((copy) => copy.path === copy.source
        ? { ...copy, path: sourceCopyPath(copy.path, (candidate) => names.includes(candidate)) }
        : copy)
    }
  }
  const sources = new Set(appState.sourceTransfer.files.map(({ source }) => source))
  const conflicts = copies
    .filter(({ path }) => appState.archive?.getBytes(path) && (appState.sourceTransfer?.mode !== "move" || !sources.has(path)))
    .map(({ path }) => path)
  if (conflicts.length && !window.confirm(`以下文件已存在，是否替换？\n\n${conflicts.join("\n")}`)) return
  const changes: Change[] = copies.map(({ path, bytes }) => ({
    kind: "bytes",
    path,
    before: appState.archive!.getBytes(path)?.slice(),
    after: bytes.slice(),
  }))
  if (appState.sourceTransfer.mode === "move") {
    for (const source of sources) {
      if (!copies.some(({ path }) => path === source)) {
        changes.push({ kind: "bytes", path: source, before: appState.archive.getBytes(source)?.slice() })
      }
    }
    appState.sourceTransfer = undefined
  }
  commitBatch(changes)
  refreshAfterSourceMutation(copies[0]?.path)
})

sourceMoveButton.addEventListener("click", () => {
  setSourceTransfer("move")
})

sourceDeleteButton.addEventListener("click", () => {
  const selection = sourceSelection()
  if (!appState.archive || !selection || !isEditing()) return
  const paths = sourcePaths(selection)
  if (!paths.length || !window.confirm(`确定要删除${selection.folder ? "文件夹" : "文件"} ${selection.path} 吗？此操作可撤销。`)) return
  commitBatch(paths.map((path) => ({
    kind: "bytes",
    path,
    before: appState.archive!.getBytes(path)?.slice(),
  })))
  refreshAfterSourceMutation()
})

function selectFile(
  path: string,
  preferredSidebarView = appState.sidebarView,
  resourceMode: "document" | "image" | "style" | "sound" = "document",
  preserveInspectorView = false,
): void {
  if (resourceMode !== "image") appState.bdaSliceReturn = undefined
  if (path !== appState.selectedPath) {
    source.commit()
    appState.selectedToolbarSections = []
    toolbarPreview.setSelected([])
  }
  appState.selectedCandidate = false
  const previousInspectorTab = appState.inspectorTab
  const preserveCurrentInspectorView = preserveInspectorView || path === appState.selectedPath
  if (path !== appState.selectedPath) appState.sourceHistoryHighlight = undefined
  appState.styleReturnPath = ""
  appState.styleReturnCandidate = false
  appState.resourceConfigActive = resourceMode !== "document"
  appState.resourceInspectorMode = resourceMode === "style" ? "style" : resourceMode === "sound" ? "sound" : "image"
  const guideLabel = appState.resourceInspectorMode === "image" && appState.resourceConfigActive ? "切片网格" : "辅助线"
  for (const button of [toggleGuides, mobileToggleGuides]) {
    button.title = guideLabel
    button.setAttribute("aria-label", guideLabel)
  }
  if (appState.resourceInspectorMode === "image" && appState.resourceConfigActive) setGuidesVisible(true)
  if (!appState.resourceConfigActive) {
    appState.selectedResourcePath = ""
    appState.drawingTile = false
    appState.tileDragStart = undefined
    appState.tileDraft = undefined
    newTileButton.classList.remove("active")
    atlasCanvas.classList.remove("drawing")
  } else {
    appState.selectedResourcePath = ""
    appState.selectedStyleID = ""
    appState.selectedSoundID = ""
    appState.selectedResourceGalleryPath = ""
    resourceListView.hidden = false
    resourceDetail.hidden = true
  }
  if (appState.archive?.isImage(path) && appState.selectedPath && !appState.archive.isImage(appState.selectedPath)) {
    appState.assetReturnPath = appState.selectedPath
  }
  appState.selectedPath = path
  if (path !== appState.layoutPath) {
    appState.selectedKeySections = []
    preview.setSelected([])
  }
  const appearancePart = bdaAppearancePart(path)
  if (appearancePart) {
    hideImageWorkspace()
    const info = currentBdaAppearance()
    if (!info) return
    const basePath = bdaBasePath(path)
    const base = appearancePart.kind === "panel" && appState.bdaBase?.isText(basePath)
      ? IniDocument.parse(appState.bdaBase.getText(basePath))
      : undefined
    const previewLayout = Boolean(base && previewItems(base).some((item) => item.editable))
    if (previewLayout && !refreshBdaLayout(path)) return
    appState.selectedDocument = previewLayout ? appState.layoutDocument : undefined
    if (previewLayout) {
      appState.selectedKeySections = []
      preview.setSelected([])
    }
    setSourceValue(decodedBdaAppearancePart(info.bytes, appearancePart))
    source.disabled = false
    const partName = appearancePart.kind === "panel" ? appearancePart.name : appearancePart.group
    sourceName.textContent = `${info.path} · ${partName} · 解码源码`
    appState.inspectorTab = "properties"
  } else if (isBdaVirtualTextPath(path)) {
    hideImageWorkspace()
    const panelName = path.split("/").pop()?.replace(/\.ini$/i, "") ?? path
    const base = IniDocument.parse(appState.bdaBase!.getText(bdaBasePath(path)))
    const previewLayout = isBdaLayoutPath(path) && previewItems(base).some((item) => item.editable)
    if (previewLayout && !refreshBdaLayout(path)) return
    if (previewLayout) appState.layoutPath = path
    appState.selectedDocument = previewLayout ? appState.layoutDocument : base
    if (previewLayout) {
      appState.selectedKeySections = []
      preview.setSelected([])
    }
    const info = currentBdaAppearance()
    setSourceValue(info ? decodedBdaSource(info.path, info.bytes, panelName) : "{}")
    source.disabled = true
    sourceName.textContent = info ? `${info.path} · ${panelName} · 解码源码` : panelName
    appState.inspectorTab = "properties"
  } else if (appState.archive?.isImage(path)) {
    appState.inspectorTab = "properties"
    appState.selectedDocument = undefined
    showImage(path)
  } else if (appState.archive?.isText(path)) {
    hideImageWorkspace()
    appState.selectedDocument = IniDocument.parse(appState.archive.getText(path))
    setSourceValue(appState.selectedDocument.toString())
    source.disabled = false
    sourceName.textContent = path
    const previewLayout =
      /\.ini$/i.test(path) &&
      !/(^|\/)gen\.ini$/i.test(path) &&
      previewItems(appState.selectedDocument).some((item) => item.editable)
    if (previewLayout) {
      // 撤销 / 重做会重新选中同一个布局：保留仍然存在的按键选择，检查器不跳回面板。
      const existing = new Set(appState.selectedDocument.sections())
      const kept = path === appState.layoutPath
        ? appState.selectedKeySections.filter((section) => existing.has(section) || isListCell(section))
        : []
      appState.layoutPath = path
      appState.layoutDocument = appState.selectedDocument
      appState.selectedKeySections = kept
      preview.setSelected(kept)
      appState.inspectorTab = "properties"
    } else if (preferredSidebarView === "overview" || showsLayoutProperties(path)) {
      // INI/CND/POP 布局文件始终打开属性面板，不论从哪个侧边栏点进来。
      appState.inspectorTab = "properties"
    } else if (path !== appState.layoutPath) {
      appState.inspectorTab = "source"
    }
  } else if (appState.archive?.isBdaConfig(path)) {
    hideImageWorkspace()
    appState.selectedDocument = undefined
    setSourceValue(decodedBdaEditorSource(path, appState.archive.getBytes(path)!))
    source.disabled = !bdaDecodedSourceEditable(path)
    sourceName.textContent = `${path} · 解码源码${source.disabled ? "（原始字段，只读）" : ""}`
    appState.inspectorTab = "properties"
  } else {
    return
  }
  if (path === appState.layoutPath && appState.selectedDocument) {
    appState.layoutDocument = appState.selectedDocument
    refreshPreview()
  }
  if (preferredSidebarView === "source" && (
    appState.archive?.isText(path) || appState.archive?.isBdaConfig(path) || isBdaAppearancePartPath(path)
) && path !== appState.layoutPath && !showsLayoutProperties(path)) {
    appState.inspectorTab = "source"
  }
  // 右侧停在源代码时，任何选择操作都不跳回属性面板。
  if (preserveCurrentInspectorView || previousInspectorTab === "source") {
    appState.inspectorTab = previousInspectorTab
  }
  updateInspectorView()
  if (appState.resourceConfigActive) renderResourceInspector()
  if (resourceMode === "image" && appState.archive) {
    const firstImage = resourceImagePaths(appState.archive.names(), theme.value, orientation.value)[0]
    if (firstImage) selectResourceImage(firstImage)
  }
  if (!quickInspector.hidden) populateKeyInspector()
  appState.selectedFileButton?.classList.remove("selected")
  if (preferredSidebarView === "source") ensureSourcePathRendered(path)
  const preferredContainer = files.querySelector(preferredSidebarView === "overview" ? ".sidebar-overview" : ".raw-files")
  const navMode = appState.resourceInspectorMode === "style" && appState.resourceConfigActive
    ? "style"
    : appState.resourceInspectorMode === "sound" && appState.resourceConfigActive
      ? "sound"
    : appState.resourceConfigActive
      ? "resource"
      : "document"
  appState.selectedFileButton = preferredContainer?.querySelector<HTMLElement>(`button[data-path="${CSS.escape(path)}"][data-nav-mode="${navMode}"]`)
    ?? preferredContainer?.querySelector<HTMLElement>(`button[data-path="${CSS.escape(path)}"]`)
    ?? files.querySelector<HTMLElement>(`button[data-path="${CSS.escape(path)}"]`)
    ?? undefined
  if (appState.selectedFileButton) {
    setSidebarView(appState.selectedFileButton.closest(".raw-files") ? "source" : "overview")
  }
  appState.selectedFileButton?.classList.add("selected")
  if (mobilePortraitQuery.matches) {
    const group = appState.selectedFileButton?.closest<HTMLElement>(".nav-group")?.dataset.overviewGroup
    files.querySelector<HTMLButtonElement>(`.mobile-overview-groups button[data-overview-group="${CSS.escape(group ?? "")}"]`)?.click()
  }
  updateSourceFileActions()
  updateSourceSearchStatus()
  syncCandidateSelection()
}

const overviewGroupState = new Map<string, boolean>()

function renderFiles(): void {
  // 重建文件树前记住展开的文件夹，上传、删除、撤销后树不会整体收起。
  const openFolders = Array.from(files.querySelectorAll<HTMLDetailsElement>("details.raw-folder[open]"))
    .map((folder) => folder.dataset.folderPath ?? "")
    .filter(Boolean)
  files.replaceChildren()
  appState.selectedFileButton = undefined
  document.documentElement.dataset.archiveFormat = appState.archive?.format ?? ""
  if (!appState.archive) return

  const overview = document.createElement("div")
  overview.className = "sidebar-overview"
  files.append(overview)

  const mobileGroups = document.createElement("nav")
  mobileGroups.className = "mobile-overview-groups"
  mobileGroups.setAttribute("aria-label", "布局分组")
  overview.append(mobileGroups)

  const setMobileOverviewGroup = (title: string): void => {
    appState.mobileOverviewGroup = title
    for (const button of Array.from(mobileGroups.querySelectorAll<HTMLButtonElement>("button"))) {
      const active = button.dataset.overviewGroup === title
      button.classList.toggle("active", active)
      button.setAttribute("aria-pressed", String(active))
    }
    for (const group of Array.from(overview.querySelectorAll<HTMLDetailsElement>(".nav-group"))) {
      const active = group.dataset.overviewGroup === title
      group.classList.toggle("mobile-overview-active", active)
      // The phone rail replaces the disclosure summary, so a closed group would render empty.
      if (active && mobilePortraitQuery.matches) group.open = true
    }
  }

  const section = (title: string, count = 0): HTMLElement => {
    const disclosure = document.createElement("details")
    disclosure.className = "nav-group"
    disclosure.dataset.overviewGroup = title
    disclosure.open = overviewGroupState.get(title) ?? ["皮肤", "资源配置", "键盘布局"].includes(title)
    disclosure.addEventListener("toggle", () => overviewGroupState.set(title, disclosure.open))
    const summary = document.createElement("summary")
    summary.className = "nav-section"
    const marker = document.createElement("span")
    marker.className = "source-disclosure"
    const label = document.createElement("span")
    label.className = "nav-label"
    label.textContent = title
    const countNode = document.createElement("span")
    countNode.className = "nav-section-count"
    countNode.textContent = String(count)
    summary.append(marker, label, countNode)
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
    ["animation", "动画效果", "动画配置", "film"],
    ["lightAnimation", "轻量动画", "轻量动画", "wand-sparkles"],
    ["sound", "按键音效", "声音配置", "volume-2"],
    ["switch", "开关配置", "开关配置", "toggle-right"],
    ["sticker", "贴纸配置", "贴纸配置", "sticker"],
    ["scene", "场景配置", "场景配置", "layers"],
  ] as const
  const overviewPath = appState.archive.names().includes(`${theme.value}/skin/Info.txt`)
    ? `${theme.value}/skin/Info.txt`
    : "Info.txt"
  entries.push({
    group: appState.archive.format === "bda" ? "皮肤信息" : "皮肤",
    label: "皮肤信息",
    path: overviewPath,
    className: "nav-overview",
    icon: "info",
  })
  // BDA 的 demo 在主题目录下，其他格式放在包根；条目只在文件存在时才显示。
  const demoPath = appState.archive.names().includes(`${theme.value}/skin/demo.png`) ? `${theme.value}/skin/demo.png` : "demo.png"
  entries.push({ group: appState.archive.format === "bda" ? "皮肤信息" : "皮肤", label: "效果预览", path: demoPath, className: "nav-overview", icon: "image" })

  const iniTypes: Record<string, Omit<NavEntry, "path">> = {
    "bh.ini": { group: "键盘布局", label: "笔画键盘", className: "nav-layout", icon: "brush" },
    "def_9.ini": { group: "键盘布局", label: "五笔 9 键", className: "nav-layout", icon: "pen-line" },
    "def_26.ini": { group: "键盘布局", label: "五笔 26 键", className: "nav-layout", icon: "pen-tool" },
    "def_26_new.ini": { group: "键盘布局", label: "五笔 26 键（无上划）", className: "nav-layout", icon: "pen-off" },
    "py_9.ini": { group: "键盘布局", label: "拼音 9 键", className: "nav-layout", icon: "grid-3x3" },
    "py_26.ini": { group: "键盘布局", label: "拼音 26 键", className: "nav-layout", icon: "keyboard" },
    "en_9.ini": { group: "键盘布局", label: "英文 9 键", className: "nav-layout", icon: "case-lower" },
    "en_9s.ini": { group: "键盘布局", label: "英文 9 键 Shift", className: "nav-layout", icon: "arrow-big-up" },
    "en_26.ini": { group: "键盘布局", label: "英文 26 键", className: "nav-layout", icon: "a-large-small" },
    "en_26s.ini": { group: "键盘布局", label: "英文 26 键 Shift", className: "nav-layout", icon: "arrow-big-up-dash" },
    "en_26_new.ini": { group: "键盘布局", label: "英文 26 键（无上划）", className: "nav-layout", icon: "type" },
    "en_26s_new.ini": { group: "键盘布局", label: "英文 26 键 Shift（无上划）", className: "nav-layout", icon: "case-upper" },
    "num_9.ini": { group: "数字与符号", label: "数字键盘", className: "nav-component", icon: "calculator" },
    "num_26.ini": { group: "数字与符号", label: "26 键数字键盘", className: "nav-component", icon: "binary" },
    "num2.ini": { group: "数字与符号", label: "数字键盘 2", className: "nav-component", icon: "hash" },
    "symbol.ini": { group: "数字与符号", label: "符号面板", className: "nav-component", icon: "asterisk" },
    "sym_26_cn.ini": { group: "数字与符号", label: "中文 26 键符号", className: "nav-component", icon: "quote" },
    "sym_26_en.ini": { group: "数字与符号", label: "英文 26 键符号", className: "nav-component", icon: "at-sign" },
    "hw_grid.ini": { group: "手写与选择", label: "手写面板", className: "nav-component", icon: "signature" },
    "hw_full.ini": { group: "手写与选择", label: "全屏手写", className: "nav-component", icon: "pencil-line" },
    "sel_ch.ini": { group: "手写与选择", label: "中文选择栏", className: "nav-component", icon: "rows-3" },
    "sel_en.ini": { group: "手写与选择", label: "英文选择栏", className: "nav-component", icon: "list" },
    "voice.ini": { group: "键盘组件", label: "语音键盘", className: "nav-component", icon: "mic" },
    "dial.ini": { group: "键盘布局", label: "拨号键盘", className: "nav-layout", icon: "phone" },
    "email.ini": { group: "键盘布局", label: "邮箱键盘", className: "nav-layout", icon: "mail" },
    "net.ini": { group: "键盘布局", label: "网址键盘", className: "nav-layout", icon: "globe" },
    "net_shifts.ini": { group: "键盘布局", label: "网址键盘大写", className: "nav-layout", icon: "link" },
    "sel_ch_h.ini": { group: "手写与选择", label: "中文选择栏（加高）", className: "nav-component", icon: "list-ordered" },
    "sel_en_h.ini": { group: "手写与选择", label: "英文选择栏（加高）", className: "nav-component", icon: "list-checks" },
    "sym_26_cn_h.ini": { group: "数字与符号", label: "中文 26 键符号（加高）", className: "nav-component", icon: "message-square-quote" },
    "sym_26_en_h.ini": { group: "数字与符号", label: "英文 26 键符号（加高）", className: "nav-component", icon: "ampersand" },
    "symbol_h.ini": { group: "数字与符号", label: "符号面板（加高）", className: "nav-component", icon: "percent" },
    "help.ini": { group: "手写与选择", label: "帮助面板", className: "nav-component", icon: "circle-help" },
    "logo.ini": { group: "键盘组件", label: "输入法标识", className: "nav-component", icon: "app-window" },
    "gen.ini": { group: "资源配置", label: "通用配置", className: "nav-style", icon: "settings" },
  }
  const hiddenLayouts = new Set<string>()
  const configPrefix = `${theme.value}/skin/${orientation.value}/`
  const appearancePath = bdaAppearancePath(appState.archive, theme.value, orientation.value)
  const appearanceBytes = appearancePath && appState.archive.getBytes(appearancePath)
  const appearance = appearanceBytes ? decodeBdaAppearance(appearanceBytes) : undefined
  if (appState.archive.format === "bda" && appearance) {
    for (const panelName of appearance.panels.keys()) {
      const name = `${panelName}.ini`
      if (hiddenLayouts.has(name)) continue
      const info = iniTypes[name] ?? {
        group: "面板样式",
        label: panelName.replaceAll("_", " "),
        className: "nav-layout",
        icon: "",
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
      path: bdaAppearanceStylePath(appState.selectedBdaStyleGroup),
      className: "nav-style",
      icon: "palette",
      navMode: "style",
      meta: "appearanceConfig",
    })
    entries.push({
      group: "资源配置",
      label: "图片资源",
      path: appearancePath!,
      className: "nav-resource",
      icon: "images",
      navMode: "resource",
    })
    entries.push({
      group: "资源配置",
      label: "声音资源",
      path: appearancePath!,
      className: "nav-resource",
      icon: "audio-lines",
      navMode: "sound",
    })
  }
  const layoutPaths = appState.archive.format === "bda" ? [] : appState.archive.names()
  for (const path of layoutPaths.sort()) {
    const basePath = path
    if (!path.startsWith(configPrefix) || path.slice(configPrefix.length).includes("/") || !/\.ini$/i.test(path)) continue
    if (appState.archive.format === "bda" && !appState.bdaBase?.isText(basePath)) continue
    const name = path.split("/").pop() ?? path
    if (hiddenLayouts.has(name)) continue
    const info = iniTypes[name] ?? {
      group: "扩展布局",
      label: name.replace(/\.ini$/i, "").replaceAll("_", " "),
      className: "nav-layout",
      icon: "",
    }
    entries.push({
      ...info,
      group: info.group,
      path,
    })
  }

  const candidatePath = appState.archive.format === "bda" ? undefined : toolbarConfigPath()
  if (candidatePath) {
    entries.push({ group: "键盘组件", label: "候选栏与工具栏", path: candidatePath, className: "nav-component", icon: "panel-top" })
  }
  const hintPath = firstExistingPath(appState.archive.names(), `${theme.value}/skin/${orientation.value}`, ["hint1.pop", "hint.pop"])
  if (hintPath) entries.push({ group: "键盘组件", label: "按键气泡", path: hintPath, className: "nav-component", icon: "message-square" })
  const longHintPath = firstExistingPath(appState.archive.names(), `${theme.value}/skin/${orientation.value}`, ["hint2.pop"])
  if (longHintPath) entries.push({ group: "键盘组件", label: "长按气泡", path: longHintPath, className: "nav-component", icon: "message-square-more" })
  const stylePath = appearancePath ?? (appState.archive.format === "bda" ? undefined : styleConfigPath())
  if (stylePath && appState.archive.format !== "bda") {
    entries.push({
      group: "资源配置",
      label: "图片资源",
      path: stylePath,
      className: "nav-resource",
      icon: "images",
      navMode: "resource",
    })
    entries.push({ group: "资源配置", label: "样式配置", path: stylePath, className: "nav-style", icon: "palette", navMode: "style" })
    entries.push({ group: "资源配置", label: "按键音效", path: stylePath, className: "nav-resource", icon: "volume-2", navMode: "sound" })
  }
  const legacyAnimationPath = appState.archive.format === "bda" ? undefined : legacyAnimationConfigPath()
  if (legacyAnimationPath) {
    entries.push({ group: "资源配置", label: "粒子动效", path: legacyAnimationPath, className: "nav-style", icon: "wand-sparkles" })
  }
  if (appState.archive.format === "bda") {
    for (const [kind, group, label, icon] of bdaConfigGroups) {
      const paths = bdaConfigPaths(appState.archive, theme.value, orientation.value, kind)
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
  // 每个文件一个图标：未登记或与前面撞图标的文件按名字归族，取族里还没用过的图标。
  const iconFamilies: [RegExp, string[]][] = [
    [/num|数字/i, ["calculator", "binary", "hash", "sigma", "pi"]],
    [/sym|符号/i, ["asterisk", "percent", "ampersand", "at-sign", "omega", "braces", "slash", "parentheses", "dollar-sign"]],
    [/sel|选择|list/i, ["rows-3", "list", "list-ordered", "list-checks", "list-tree", "list-filter"]],
    [/hw|手写/i, ["signature", "pencil-line", "hand", "spline", "scan-line"]],
    [/emoji|表情/i, ["smile", "laugh", "smile-plus"]],
  ]
  const spareIcons = ["keyboard", "layout-template", "panel-bottom", "square-dashed-bottom", "layout-dashboard", "columns-3", "table-2", "component", "box"]
  const iconOwners = new Map<string, NavEntry>()
  for (const entry of entries) if (entry.icon && !iconOwners.has(entry.icon)) iconOwners.set(entry.icon, entry)
  for (const entry of entries) {
    if (entry.icon && iconOwners.get(entry.icon) === entry) continue
    const name = `${entry.path.split("/").pop()} ${entry.label}`
    const family = iconFamilies.find(([pattern]) => pattern.test(name))?.[1] ?? []
    entry.icon = [...family, ...spareIcons].find((icon) => !iconOwners.has(icon)) ?? (entry.icon || "keyboard")
    iconOwners.set(entry.icon, entry)
  }
  const groups = appState.archive.format === "bda"
    ? ["皮肤信息", "资源配置", "面板样式", "动画效果", "按键音效", "轻量动画", "开关配置", "贴纸配置", "场景配置"]
    : ["皮肤", "资源配置", "键盘布局", "数字与符号", "手写与选择", "键盘组件", "扩展配置", "扩展布局"]
  for (const group of groups) {
    const grouped = entries.filter((entry) => entry.group === group && (
      appState.archive?.names().includes(entry.path) ||
      appState.archive?.format === "bda" && (isBdaAppearancePartPath(entry.path) || Boolean(appState.bdaBase?.isText(bdaBasePath(entry.path))))
    ))
    if (group === "键盘布局") {
      const layoutRank: Record<string, number> = { "py_9.ini": 0, "py_26.ini": 1, "bh.ini": 3 }
      grouped.sort((a, b) => {
        const aName = a.path.split("/").pop() ?? ""
        const bName = b.path.split("/").pop() ?? ""
        return (layoutRank[aName] ?? 2) - (layoutRank[bName] ?? 2)
      })
    }
    if (appState.archive.format === "bda" && group === "面板样式") {
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
    const body = section(group, grouped.length)
    for (const entry of grouped) {
      addNavButton(body, entry.label, entry.path, entry.className, entry.icon, entry.navMode, entry.meta)
    }
  }
  const availableMobileGroups = Array.from(mobileGroups.querySelectorAll<HTMLButtonElement>("button"))
  if (!availableMobileGroups.some((button) => button.dataset.overviewGroup === appState.mobileOverviewGroup)) {
    appState.mobileOverviewGroup = availableMobileGroups[0]?.dataset.overviewGroup ?? ""
  }
  setMobileOverviewGroup(appState.mobileOverviewGroup)

  const sourceFiles = document.createElement("div")
  sourceFiles.className = "raw-files"
  sourceFiles.setAttribute("role", "tree")
  sourceFiles.setAttribute("aria-label", "源文件")
  const sourceNameCompare = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" }).compare
  type SourceNode = { folders: Map<string, SourceNode>; paths: string[] }
  const root: SourceNode = { folders: new Map(), paths: [] }
  for (const path of appState.archive.names().filter((name) => !name.endsWith("/"))) {
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
  // 与概览同一套 Lucide 图标（16px、1.5 描边）；图片行先放图标，滚到附近再换成缩略图。
  const sourceSymbol = (name: string) => symbolSpan(name)
  const thumbnailObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue
      const symbol = entry.target as HTMLElement
      thumbnailObserver.unobserve(symbol)
      const bytes = appState.archive?.getBytes(symbol.dataset.thumbnailPath ?? "")
      if (!bytes) continue
      void sourceThumbnail(bytes).then((url) => {
        if (!url) return
        const image = document.createElement("img")
        image.className = "source-thumbnail"
        image.alt = ""
        image.src = url
        symbol.replaceChildren(image)
      })
    }
  }, { rootMargin: "200px 0px" })
  const sourceFileCount = (node: SourceNode): number =>
    node.paths.length + [...node.folders.values()].reduce((total, child) => total + sourceFileCount(child), 0)
  const selectSourceRow = (row: HTMLElement) => {
    appState.selectedFileButton?.classList.remove("selected")
    appState.selectedFileButton = row
    row.classList.add("selected")
    for (const item of sourceFiles.querySelectorAll<HTMLElement>(".source-tree-row")) {
      item.tabIndex = item === row ? 0 : -1
    }
    row.focus()
    updateSourceFileActions()
  }
  const appendNode = (parent: HTMLElement, node: SourceNode, parentPath = "", depth = 0) => {
    for (const [name, child] of [...node.folders].sort(([a], [b]) => sourceNameCompare(a, b))) {
      const names = [name]
      let compactNode = child
      while (compactNode.paths.length === 0 && compactNode.folders.size === 1) {
        const [nestedName, nestedNode] = compactNode.folders.entries().next().value as [string, SourceNode]
        names.push(nestedName)
        compactNode = nestedNode
      }
      const compactName = names.join("/")
      const path = parentPath ? `${parentPath}/${compactName}` : compactName
      const folder = document.createElement("details")
      folder.className = "raw-folder"
      folder.dataset.folderPath = path
      folder.dataset.treeDepth = String(depth)
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
      title.textContent = `${compactName}/`
      const count = document.createElement("span")
      count.className = "nav-meta source-item-count"
      count.textContent = `${sourceFileCount(compactNode)} 项`
      folderSummary.append(disclosure, sourceSymbol("folder"), title, count)
      const children = document.createElement("div")
      children.className = "source-tree-group"
      children.setAttribute("role", "group")
      folder.append(folderSummary, children)
      let populated = false
      const populate = () => {
        if (populated) return
        populated = true
        appendNode(children, compactNode, path, depth + 1)
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
      const symbolName = appState.archive?.isText(path) || appState.archive?.isBdaConfig(path)
        ? "doc.text"
        : appState.archive?.isImage(path)
          ? "image"
          : "doc"
      const symbol = sourceSymbol(symbolName)
      if (symbolName === "image") {
        symbol.dataset.thumbnailPath = path
        thumbnailObserver.observe(symbol)
      }
      button.append(symbol)
      const label = document.createElement("span")
      label.className = "nav-label"
      label.textContent = path.split("/").pop() ?? path
      button.append(label)
      button.title = path
      button.dataset.path = path
      button.draggable = true
      button.addEventListener("click", () => {
        if (appState.archive?.isText(path) || appState.archive?.isImage(path) || appState.archive?.isBdaConfig(path)) {
          selectFile(path, "source")
          if (mobilePortraitQuery.matches) setMobilePane("inspector")
        } else selectSourceRow(button)
        updateSourceFileActions()
      })
      button.addEventListener("dragstart", (event) => {
        const bytes = appState.archive?.getBytes(path)
        if (!bytes || !event.dataTransfer) return
        const mime = appState.archive?.isText(path)
          ? "text/plain"
          : appState.archive?.isImage(path)
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
  const rootFolder = document.createElement("details")
  rootFolder.className = "raw-folder source-root-folder"
  rootFolder.open = true
  const rootSummary = document.createElement("summary")
  rootSummary.className = "source-tree-row source-folder-row source-root-row"
  rootSummary.setAttribute("role", "treeitem")
  rootSummary.setAttribute("aria-expanded", "true")
  rootSummary.tabIndex = -1
  const rootDisclosure = document.createElement("span")
  rootDisclosure.className = "source-disclosure"
  rootDisclosure.ariaHidden = "true"
  const rootTitle = document.createElement("span")
  rootTitle.className = "nav-label"
  rootTitle.textContent = documentName.textContent?.trim() || `未命名.${appState.archive.format}`
  const rootCount = document.createElement("span")
  rootCount.className = "nav-meta source-item-count"
  rootCount.textContent = `${sourceFileCount(root)} 项`
  const rootChildren = document.createElement("div")
  rootChildren.className = "source-tree-group source-root-group"
  rootChildren.setAttribute("role", "group")
  rootSummary.append(rootDisclosure, sourceSymbol("doc.text"), rootTitle, rootCount)
  rootFolder.append(rootSummary, rootChildren)
  rootDisclosure.addEventListener("click", (event) => {
    event.preventDefault()
    event.stopPropagation()
    rootFolder.open = !rootFolder.open
  })
  rootSummary.addEventListener("click", (event) => {
    event.preventDefault()
    selectSourceRow(rootSummary)
  })
  rootSummary.addEventListener("dblclick", (event) => {
    event.preventDefault()
    rootFolder.open = !rootFolder.open
  })
  rootFolder.addEventListener("toggle", () => {
    rootSummary.setAttribute("aria-expanded", String(rootFolder.open))
  })
  sourceFiles.append(rootFolder)
  appendNode(rootChildren, root)
  sourceFiles.addEventListener("dragover", (event) => {
    if (!appState.archive || !isEditing() || !event.dataTransfer?.types.includes("Files")) return
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
    if (!appState.archive || !isEditing() || folder === undefined || !event.dataTransfer?.files.length) return
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
  for (const folder of openFolders) ensureSourcePathRendered(`${folder}/`)
  setSidebarView(appState.sidebarView)
}

function ensureSourcePathRendered(path: string): void {
  const parts = path.split("/").slice(0, -1)
  for (let index = 1; index <= parts.length; index += 1) {
    const folderPath = parts.slice(0, index).join("/")
    const folder = files.querySelector<HTMLDetailsElement>(`details.raw-folder[data-folder-path="${CSS.escape(folderPath)}"]`)
    // 合并显示的文件夹（如 light/skin/）没有中间层节点，跳过继续找下一层。
    if (!folder) continue
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
  appState.sourceWorkspacePendingArchive = undefined
  releaseKeySound()
  keySoundBuffers.clear()
  let nextArchive: SkinArchive
  try {
    updateFileOperationProgress(18, "正在解析皮肤包…")
    nextArchive = await SkinArchive.openAsync(
      bytes,
      exportFormatFromPath(displayName || path),
      appState.fileOperationProgressVisible
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
  if (nextArchive.format === "bda" && !appState.bdaBase) {
    updateFileOperationProgress(52, "正在加载 BDA 基础布局…")
    const response = await fetch(new URL("bda-base.bds", document.baseURI))
    if (!response.ok) throw new Error("无法加载 BDA 官方基础布局")
    appState.bdaBase = await SkinArchive.openAsync(new Uint8Array(await response.arrayBuffer()))
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
  appState.assetURL = releaseImagePreviewURL(appState.assetURL)
  clearImageSlicePicker()
  appState.archive = nextArchive
  appState.aiDesignConversationTarget = nextArchive
  appState.aiDesignConversation = []
  aiDesignStatus.textContent = ""
  aiDesignPanel.dataset.state = "idle"
  setAiDesignDraft(undefined)
  appState.aiChatController?.clear()
  if (pendingSourceDirectory !== undefined) appState.sourceWorkspacePendingArchive = nextArchive
  appState.sourceTransfer = undefined
  const availableThemes = ["light", "dark"].filter((value) =>
    appState.archive?.names().some((name) => name.startsWith(`${value}/skin/`)),
  )
  if (!availableThemes.includes(theme.value)) theme.value = availableThemes[0] ?? "light"
  syncSegmentedControls()
  const preferredDevice = localStorage.getItem("default-device")
  if (preferredDevice === "canvas") {
    device.value = canvasDeviceValue(canvasBackground.value as CanvasBackground)
  } else if (preferredDevice && Array.from(device.options).some((option) => option.value === preferredDevice)) {
    device.value = preferredDevice
  }
  canvasWrap.classList.remove("empty")
  appState.currentPath = path
  appState.unsavedNew = isNew
  appState.undoStack = []
  appState.redoStack = []
  updateHistoryButtons()
  documentName.textContent = isNew
    ? exportName("未命名", appState.archive.format)
    : displayName || path.split(/[\\/]/).pop() || "未命名皮肤"
  syncAiDesignContext()
  if (!isNew && isTauri() && path) recordRecentFile(path, documentName.textContent)
  saveButton.disabled = false
  for (const button of exportButtons) {
    const format = button.dataset.exportFormat as ExportFormat
    button.hidden = appState.archive.format !== "bda" && format === "bda"
    button.disabled = button.hidden
  }
  updateFileOperationProgress(68, "正在生成文件列表…")
  await waitForInterfacePaint()
  renderFiles()
  const bdaLayouts = bdaAvailableLayoutPaths()
  appState.layoutPath = appState.archive.format === "bda" && !bdaLayouts.includes(preferredPath())
    ? bdaLayouts[0] ?? preferredPath()
    : preferredPath()
  appState.previewReturnName = appState.layoutPath.split("/").pop() ?? layout.value
  const initial = appState.archive.format === "bda" && isBdaLayoutPath(appState.layoutPath)
    ? appState.layoutPath
    : appState.archive.names().includes(appState.layoutPath)
      ? appState.layoutPath
      : appState.archive.names().find((name) => appState.archive?.isText(name))
  if (initial) {
    appState.layoutPath = initial
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
      if (appState.archive !== pendingArchive || appState.sourceWorkspacePendingArchive !== pendingArchive) return
      const pendingPaths = [...pendingSourcePaths]
      await activateSourceWorkspace(workspace, sourcePrefix)
      if (appState.archive !== pendingArchive || appState.sourceWorkspacePendingArchive !== pendingArchive) return
      pendingPaths.forEach((changedPath) => pendingSourcePaths.add(changedPath))
      await flushSourceAutosave()
      appState.sourceWorkspacePendingArchive = undefined
      showStatus(isAndroidTauri() ? "源码已保存到授权目录" : "源码工作区已就绪")
    }).catch((error) => {
      if (appState.archive !== pendingArchive || appState.sourceWorkspacePendingArchive !== pendingArchive) return
      appState.sourceWorkspacePendingArchive = undefined
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
  return exportFormatFromPath(appState.currentPath) ?? appState.archive?.format ?? "bdi"
}

function mobileShareFormat(): ExportFormat {
  if (appState.archive?.format === "bda") return "bda"
  if (isIOSWeb()) return "bdi"
  if (isAndroidTauri() || isAndroidWeb()) return "bds"
  return currentExportFormat()
}

async function exportArchive(format: ExportFormat, targetBdaPlatform?: Exclude<BdaPlatform, "unknown">): Promise<{
  bytes: Uint8Array
  converted: boolean
  warnings: string[]
} | undefined> {
  if (!appState.archive) throw new Error("当前没有可保存的皮肤")
  if (appState.aiDraftPreview) throw new Error("请先应用或丢弃 AI 修改草稿")
  updateFileOperationProgress(22, `正在生成 ${format.toUpperCase()} 皮肤包…`)
  if (appState.archive.format === "bda" && format === "bda" && targetBdaPlatform) {
    const result = convertBdaPlatform(appState.archive, targetBdaPlatform)
    return { bytes: await result.toBytesAsync(), converted: true, warnings: bdaCompatibilityWarnings(appState.archive) }
  }
  if (appState.archive.format !== "bda" || format === "bda") {
    const soundWarnings: string[] = []
    const bytes = await appState.archive.toBytesAsync(format, soundWarnings)
    reportSoundWarnings(soundWarnings)
    return { bytes, converted: false, warnings: soundWarnings }
  }
  if (!appState.bdaBase) throw new Error("无法加载 BDA 官方基础布局")
  await waitForInterfacePaint()
  updateFileOperationProgress(34, "正在转换 BDA 配置…")
  const result = convertBdaArchive(appState.archive, appState.bdaBase, format)
  if (result.warnings.length && !window.confirm(
    `BDA 转换为 ${format.toUpperCase()} 时将降级以下内容：\n\n${result.warnings.join("\n")}\n\n继续导出吗？`,
  )) return
  updateFileOperationProgress(48, `正在压缩 ${format.toUpperCase()} 皮肤包…`)
  const soundWarnings: string[] = []
  const bytes = await result.archive.platformBytesAsync(format, soundWarnings)
  reportSoundWarnings(soundWarnings)
  return { bytes, converted: true, warnings: [...result.warnings, ...soundWarnings] }
}

function reportSoundWarnings(warnings: string[]): void {
  if (!warnings.length) return
  clientLog.info("export.sound-warnings", { count: warnings.length, detail: warnings.join("; ") })
  window.alert(`以下按键音未能转换为目标平台格式，导出包中仍引用原文件，目标平台可能没有声音：\n\n${warnings.join("\n")}`)
}

async function saveNative(saveAs: boolean, format: ExportFormat, suggestedName: string): Promise<boolean> {
  if (!appState.archive) throw new Error("当前没有可保存的皮肤")
  let exported: Awaited<ReturnType<typeof exportArchive>>
  let path = appState.currentPath
  if (saveAs || !path || (!path.startsWith("content://") && exportFormatFromPath(path) !== format)) {
    const written = await writeToChosenFile(suggestedName, async () => {
      exported = await exportArchive(format)
      return exported?.bytes
    }, `${format.toUpperCase()} 皮肤`)
    if (!written || !exported) return false
    path = written
  } else {
    exported = await exportArchive(format)
    if (!exported) return false
    await writeNativePath(path, exported.bytes)
  }
  if (!exported.converted) {
    appState.currentPath = path
    appState.unsavedNew = false
    appState.archive.markSaved(exported.bytes, format)
    documentName.textContent = path.split(/[\\/]/).pop() || "未命名皮肤"
    updateDirty()
  }
  return true
}

async function writeNativePath(path: string, bytes: Uint8Array): Promise<void> {
  updateFileOperationProgress(72, "正在写入文件…")
  if (path.startsWith("content://")) {
    await writeFile(path, bytes)
    return
  }
  await invoke("write_file", { path, data: bytes })
}

/**
 * Asks for the destination before producing the bytes: browsers only open the save picker while the
 * click's user activation is still live (about 5 s), and packaging or converting a skin can outlast it.
 * A producer that resolves to undefined cancels the save.
 */
async function writeToChosenFile(
  filename: string,
  data: ChosenFileData,
  description = "文件",
): Promise<string | undefined> {
  const produce = () => data instanceof Uint8Array ? Promise.resolve(data) : data()
  const extension = filename.match(/\.([^.\\/]+)$/)?.[1]
  if (isTauri()) {
    let path: string | null
    try {
      path = await save({
        title: "保存文件",
        defaultPath: filename,
        filters: extension ? [{ name: description, extensions: [extension] }] : undefined,
      })
    } catch (error) {
      // The Android picker rejects instead of resolving null when it is dismissed.
      if (/cancel/i.test(String(error))) return
      throw error
    }
    if (!path) return
    const bytes = await produce()
    if (!bytes) return
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
    const bytes = await produce()
    if (!bytes) return
    const link = document.createElement("a")
    link.href = URL.createObjectURL(new Blob([bytes.slice().buffer], { type: "application/octet-stream" }))
    link.download = filename
    link.hidden = true
    // Mobile browsers hand blob downloads to a download manager that reads the URL later.
    const revoke = () => setTimeout(() => URL.revokeObjectURL(link.href), 60_000)
    const download = () => {
      document.body.append(link)
      link.click()
      link.remove()
    }
    // Chrome on Android silently drops a scripted download once the click's user activation has
    // expired, which packaging the skin usually outlasts; ask for one more tap in that case.
    if (navigator.userActivation && !navigator.userActivation.isActive) {
      const confirmed = await waitForTap(`${filename} 已生成，轻点“下载”继续`, "下载", download)
      revoke()
      return confirmed ? filename : undefined
    }
    download()
    revoke()
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
  let bytes: Uint8Array | undefined
  try {
    bytes = await produce()
  } catch (error) {
    await (file as BrowserSaveFileHandle & { remove?: () => Promise<void> }).remove?.().catch(() => undefined)
    throw error
  }
  if (!bytes) {
    await (file as BrowserSaveFileHandle & { remove?: () => Promise<void> }).remove?.().catch(() => undefined)
    return
  }
  const writable = await file.createWritable()
  await writable.write(bytes)
  await writable.close()
  return file.name
}

async function downloadArchive(format: ExportFormat, suggestedName: string): Promise<boolean> {
  if (!appState.archive) throw new Error("当前没有可保存的皮肤")
  let exported: Awaited<ReturnType<typeof exportArchive>>
  const path = await writeToChosenFile(suggestedName, async () => {
    exported = await exportArchive(format)
    return exported?.bytes
  }, `${format.toUpperCase()} 皮肤`)
  if (!path || !exported) return false
  if (!exported.converted) {
    appState.currentPath = path
    documentName.textContent = suggestedName
    appState.archive.markSaved(exported.bytes, format)
    appState.unsavedNew = false
    updateDirty()
  }
  return true
}

async function saveArchive(
  saveAs: boolean,
  format: ExportFormat,
  targetBdaPlatform?: Exclude<BdaPlatform, "unknown">,
): Promise<boolean> {
  flushNumberInputWheel()
  const currentName = documentName.textContent?.trim() ?? ""
  const suggestedName = exportName(currentName, format)
  if (targetBdaPlatform) {
    return Boolean(await writeToChosenFile(
      suggestedName,
      async () => (await exportArchive(format, targetBdaPlatform))?.bytes,
      `${targetBdaPlatform === "ios" ? "iOS" : "Android"} BDA 皮肤`,
    ))
  }
  return isTauri()
    ? saveNative(saveAs, format, suggestedName)
    : downloadArchive(format, suggestedName)
}

async function shareArchiveToMobile(): Promise<boolean> {
  if (!appState.archive) return false
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
  // navigator.share needs a live user activation, which packaging the skin may have used up.
  if (navigator.userActivation && !navigator.userActivation.isActive && !(await waitForTap(`${name} 已生成，轻点“分享”继续`, "分享"))) return false
  try {
    await navigator.share({ title: name, files: [file] })
    return true
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return false
    throw error
  }
}

/**
 * Shows a button in the progress dialog and resolves once it is tapped (true) or the dialog is dismissed
 * (false). `onTap` runs inside the tap's click handler, while its user activation is still live.
 */
function waitForTap(detail: string, label: string, onTap?: () => void): Promise<boolean> {
  return new Promise((resolve) => {
    appState.fileOperationProgressVisible = true
    if (!fileOperationDialog.open) fileOperationDialog.showModal()
    updateFileOperationProgress(90, detail)
    const share = document.createElement("button")
    share.type = "button"
    share.className = "primary"
    share.textContent = label
    fileOperationClose.before(share)
    fileOperationClose.disabled = false
    const finish = (confirmed: boolean) => {
      share.remove()
      fileOperationClose.disabled = true
      fileOperationClose.removeEventListener("click", cancel)
      fileOperationDialog.removeEventListener("close", cancel)
      resolve(confirmed)
    }
    const cancel = () => finish(false)
    share.addEventListener("click", () => {
      onTap?.()
      finish(true)
    }, { once: true })
    fileOperationClose.addEventListener("click", cancel, { once: true })
    fileOperationDialog.addEventListener("close", cancel, { once: true })
    share.focus()
  })
}

async function chooseProjectTemplate(): Promise<string | undefined> {
  if (isAndroidTauri()) return chooseAndroidProjectTemplate()
  if (isTauri()) {
    const templateID = await chooseNativeProjectTemplate()
    return templateID === EMBEDDED_PROJECT_FALLBACK
      ? chooseEmbeddedProjectTemplate()
      : templateID
  }
  return chooseEmbeddedProjectTemplate()
}

async function chooseAndroidProjectTemplate(): Promise<string | undefined> {
  try {
    return await invoke<string>("choose_project_template")
  } catch (error) {
    if (String(error).includes("project template selection cancelled")) return undefined
    throw error
  }
}

function chooseEmbeddedProjectTemplate(): Promise<string | undefined> {
  if (!appState.projectChooserInitialized) {
    initializeProjectChooser(newProjectForm)
    newProjectForm.addEventListener("project-import", () => newProjectDialog.close("import"))
    appState.projectChooserInitialized = true
  }
  newProjectDialog.returnValue = ""
  newProjectDialog.showModal()
  return new Promise((resolve) => {
    newProjectDialog.addEventListener(
      "close",
      () => {
        appState.newProjectOptions = projectChoice(newProjectForm)
        const templateID = appState.newProjectOptions.templateID
        if (newProjectDialog.returnValue === "import") { resolve("__import__"); return }
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
const EMBEDDED_PROJECT_FALLBACK = "__embedded-project-fallback__"

function finishNativeProjectChoice(templateID?: string): void {
  if (!appState.resolveNativeProjectChoice) return
  window.clearTimeout(appState.nativeProjectReadyTimer)
  appState.nativeProjectReadyTimer = undefined
  const resolve = appState.resolveNativeProjectChoice
  appState.resolveNativeProjectChoice = undefined
  appState.nativeProjectChoice = undefined
  resolve(templateID)
}

async function chooseNativeProjectTemplate(): Promise<string | undefined> {
  if (appState.nativeProjectChoice) {
    void WebviewWindow.getByLabel("new-project").then((window) => window?.setFocus())
    return appState.nativeProjectChoice
  }

  // Remove a window left behind by a previous reload before installing the new
  // resolver. Its close event must not be allowed to cancel the next request.
  const existing = await WebviewWindow.getByLabel("new-project")
  if (existing) await existing.close().catch(() => undefined)

  const choice = new Promise<string | undefined>((resolve) => {
    appState.resolveNativeProjectChoice = resolve
  })
  appState.nativeProjectChoice = choice
  appState.nativeProjectWindowReady = false

  try {
    const projectWindow = new WebviewWindow("new-project", {
      url: "new-project.html",
      title: "新建项目",
      width: 920,
      height: 660,
      minWidth: 400,
      minHeight: 420,
      center: true,
      decorations: true,
      resizable: true,
      focus: true,
      visible: true,
      minimizable: false,
      maximizable: false,
      skipTaskbar: false,
      preventOverflow: { width: 24, height: 24 },
      parent: navigator.userAgent.includes("Macintosh") ? undefined : "main",
    })
    void projectWindow.once("tauri://destroyed", () => {
      finishNativeProjectChoice(appState.nativeProjectWindowReady ? undefined : EMBEDDED_PROJECT_FALLBACK)
    })
    void projectWindow.once("tauri://error", () => finishNativeProjectChoice(EMBEDDED_PROJECT_FALLBACK))
    appState.nativeProjectReadyTimer = window.setTimeout(() => {
      if (appState.nativeProjectWindowReady || !appState.resolveNativeProjectChoice) return
      void WebviewWindow.getByLabel("new-project").then((window) => window?.close())
      finishNativeProjectChoice(EMBEDDED_PROJECT_FALLBACK)
    }, 2500)
  } catch {
    finishNativeProjectChoice(EMBEDDED_PROJECT_FALLBACK)
  }

  return choice
}

async function newDocument(templateID: string): Promise<boolean> {
  if (!(await prepareDocumentReplacement())) return false
  await loadArchive(await loadBuiltInProjectTemplate(templateID), "", true)
  return true
}

async function startNewDocument(): Promise<void> {
  if (appState.fileOperationRunning) return
  appState.newProjectOptions = undefined
  const templateID = await chooseProjectTemplate()
  if (templateID === "__import__") { openButton.click(); return }
  if (!templateID) {
    showStatus("新建皮肤已取消。")
    return
  }
  await runFileOperation("新建皮肤", async () => {
    if (!(await newDocument(templateID))) return false
    const options = appState.newProjectOptions
    if (appState.archive && options?.name) documentName.textContent = exportName(options.name, appState.archive.format)
    if (appState.archive && options?.savePath) {
      const bytes = await appState.archive.toBytesAsync(appState.archive.format)
      await writeNativePath(options.savePath, bytes)
      appState.currentPath = options.savePath
      documentName.textContent = options.savePath.split(/[\\/]/).pop() || documentName.textContent
      appState.archive.markSaved(bytes, appState.archive.format)
      appState.unsavedNew = false
      updateDirty()
    }
    return true
  })
}

for (const menu of toolbarMenus) {
  menu.addEventListener("click", (event) => {
    if ((event.target as Element).closest("button")) menu.open = false
  })
}
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || event.isComposing) return
  const menuOpen = toolbarMenus.some((menu) => menu.open)
  for (const menu of toolbarMenus) menu.open = false
  // Esc 取消画布上的按键选择（与点空白处一致）；输入框、弹窗和菜单里的 Esc 留给它们自己。
  const target = event.target as Element | null
  if (menuOpen || !isEditing() || !appState.selectedKeySections.length || document.querySelector("dialog[open]")) return
  if (target?.closest?.("input, textarea, select, [contenteditable], .cm-editor")) return
  preview.setSelected([])
  appState.selectedKeySections = []
  source.collapseSelection()
  scheduleSelectionInspectorSync(preview)
})
newButton.addEventListener("click", () => void startNewDocument())
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

const recentFilesKey = "recent-files"
const recentFilesLimit = 9

function readRecentFiles(): RecentFile[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(recentFilesKey) || "[]")
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item): item is RecentFile =>
        Boolean(item)
        && typeof item.path === "string"
        && typeof item.name === "string"
        && typeof item.at === "number",
    ).slice(0, recentFilesLimit)
  } catch {
    return []
  }
}

function recordRecentFile(path: string, name: string): void {
  if (!path || path.startsWith("content://")) return
  const next = [{ path, name, at: Date.now() }, ...readRecentFiles().filter((item) => item.path !== path)]
    .slice(0, recentFilesLimit)
  localStorage.setItem(recentFilesKey, JSON.stringify(next))
  renderRecentFiles()
}

function formatRecentTime(at: number): string {
  const minute = 60_000
  const diff = Date.now() - at
  if (diff < minute) return "刚刚"
  if (diff < 60 * minute) return `${Math.floor(diff / minute)} 分钟前`
  if (diff < 24 * 60 * minute) return `${Math.floor(diff / (60 * minute))} 小时前`
  const days = Math.floor(diff / (24 * 60 * minute))
  if (days === 1) return "昨天"
  if (days < 7) return `${days} 天前`
  if (days < 30) return `${Math.floor(days / 7)} 周前`
  return new Date(at).toLocaleDateString("zh-CN")
}

function openRecentFile(item: RecentFile): void {
  if (appState.fileOperationRunning) return
  void runFileOperation("打开", async () => {
    if (!(await prepareDocumentReplacement())) return false
    return loadNativePath(item.path)
  })
}

function recentFolderLabel(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean)
  if (parts.length < 2) return ""
  const folder = parts.slice(0, -1)
  return folder.length > 2 ? `…/${folder.slice(-2).join("/")}` : folder.join("/")
}

function recentFormatLabel(path: string): string {
  return path.match(/\.(bdi|bds|bda)$/i)?.[0]?.toLowerCase() ?? "皮肤"
}

function recentCard(item: RecentFile): HTMLButtonElement {
  const card = document.createElement("button")
  card.type = "button"
  card.className = "template-card recent-card"
  card.dataset.recent = item.path
  card.title = `打开 ${item.name}\n${item.path}`
  const preview = document.createElement("span")
  preview.className = "template-preview"
  preview.ariaHidden = "true"
  preview.textContent = "正在加载预览…"
  const foot = document.createElement("span")
  foot.className = "template-foot"
  const nameRow = document.createElement("span")
  nameRow.className = "template-name-row"
  const name = document.createElement("span")
  name.className = "template-name"
  name.textContent = item.name
  const go = symbolSpan("arrow.right")
  go.classList.add("icon", "template-go")
  nameRow.append(name, go)
  const meta = document.createElement("span")
  meta.className = "template-meta"
  const format = document.createElement("em")
  format.textContent = recentFormatLabel(item.path)
  const time = document.createElement("span")
  time.textContent = formatRecentTime(item.at)
  meta.append(format, time)
  const folder = recentFolderLabel(item.path)
  if (folder) {
    const place = document.createElement("span")
    place.className = "recent-card-folder"
    place.textContent = `· ${folder}`
    meta.append(place)
  }
  foot.append(nameRow, meta)
  card.append(preview, foot)
  card.addEventListener("click", () => openRecentFile(item))
  return card
}

const recentPreviewCache = new Map<string, HTMLImageElement>()
// 预览只取包里的 demo 图，不需要解整包；上限与后端可读的整包上限保持一致。
const recentPreviewMaxBytes = 64 * 1024 * 1024

async function readRecentPreviewBytes(path: string): Promise<Uint8Array> {
  if (!isTauri()) throw new Error("仅在桌面应用中生成本地预览")
  if (await invoke<number>("skin_file_size", { path }) > recentPreviewMaxBytes) {
    throw new Error("皮肤文件过大，暂不生成预览")
  }
  return new Uint8Array(await invoke<ArrayBuffer>("read_file", { path }))
}

function welcomeVisible(): boolean {
  return canvasWrap.classList.contains("empty")
}

function waitForPreviewFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}

// 最近皮肤最多 9 张，逐个串行取图，避免同时读多份皮肤阻塞 UI。
const recentPreviewQueue: HTMLButtonElement[] = []
const recentPreviewQueued = new Set<HTMLButtonElement>()

function recentThumbRequest<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  appState.recentThumbDb ??= new Promise((resolve, reject) => {
    const request = indexedDB.open("recent-previews", 1)
    request.onupgradeneeded = () => request.result.createObjectStore("previews")
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  return appState.recentThumbDb.then((db) => new Promise<T>((resolve, reject) => {
    const request = run(db.transaction("previews", mode).objectStore("previews"))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  }))
}

async function renderRecentPreview(path: string, host: HTMLElement): Promise<HTMLImageElement> {
  const stamp = (await invoke<number[]>("skin_file_stamp", { path })).join(":")
  const stored = await recentThumbRequest<RecentThumb | undefined>("readonly", (store) => store.get(path))
    .catch(() => undefined)
  if (stored?.stamp === stamp) {
    try {
      return await renderBlobPreview(stored.blob, host)
    } catch {
      // 缓存的图解码失败就当没缓存，重新从皮肤包取。
    }
  }
  const image = await renderArchivePreviewWithRetry(path, host)
  void fetch(image.src)
    .then((response) => response.blob())
    .then((blob) => recentThumbRequest("readwrite", (store) => store.put({ stamp, blob } satisfies RecentThumb, path)))
    .catch(() => undefined)
  return image
}

async function renderArchivePreviewWithRetry(path: string, host: HTMLElement): Promise<HTMLImageElement> {
  let lastError: unknown
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await renderArchivePreview(await readRecentPreviewBytes(path), host)
    } catch (error) {
      lastError = error
      // 没有 demo 图是稳定结果，重试只会把整包再读一遍。
      if (attempt || error instanceof MissingPreviewImageError) break
      await new Promise((resolve) => window.setTimeout(resolve, 120))
    }
  }
  throw lastError
}

async function drainRecentPreviews(): Promise<void> {
  if (appState.recentPreviewRunning) return
  appState.recentPreviewRunning = true
  try {
    for (;;) {
      // Let the welcome page paint between archive reads so the first interaction is immediate.
      await waitForPreviewFrame()
      const card = recentPreviewQueue.shift()
      if (!card) return
      recentPreviewQueued.delete(card)
      if (!welcomeVisible()) {
        recentPreviewQueue.length = 0
        recentPreviewQueued.clear()
        return
      }
      if (!card.isConnected) continue
      const path = card.dataset.recent
      const host = card.querySelector<HTMLElement>(".template-preview")
      if (!path || !host || host.classList.contains("is-rendered") || host.dataset.preview === "failed") continue
      const cached = recentPreviewCache.get(path)
      if (cached) {
        host.replaceChildren(cached)
        host.classList.add("is-rendered")
        continue
      }
      try {
        const image = await renderRecentPreview(path, host)
        if (readRecentFiles().some((item) => item.path === path)) recentPreviewCache.set(path, image)
      } catch {
        host.dataset.preview = "failed"
        host.classList.remove("is-rendered")
        host.textContent = "暂无预览图"
      }
    }
  } finally {
    appState.recentPreviewRunning = false
    if (recentPreviewQueue.length && welcomeVisible()) void drainRecentPreviews()
  }
}

function queueRecentPreview(card: HTMLButtonElement): void {
  if (recentPreviewQueued.has(card)) return
  recentPreviewQueued.add(card)
  recentPreviewQueue.push(card)
  void drainRecentPreviews()
}
const recentPreviewObserver = welcomeScroller && "IntersectionObserver" in window
  ? new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue
      recentPreviewObserver?.unobserve(entry.target)
      queueRecentPreview(entry.target as HTMLButtonElement)
    }
  }, { root: welcomeScroller, rootMargin: "240px 0px" })
  : undefined

function observeRecentPreviews(): void {
  if (!welcomeVisible()) return
  recentPreviewObserver?.disconnect()
  const pending = [...document.querySelectorAll<HTMLButtonElement>(".recent-card[data-recent]")].filter((card) => {
    const host = card.querySelector<HTMLElement>(".template-preview")
    return Boolean(host) && !host!.classList.contains("is-rendered") && host!.dataset.preview !== "failed"
  })
  for (const card of pending) {
    if (recentPreviewObserver) recentPreviewObserver.observe(card)
    else queueRecentPreview(card)
  }
}

function renderRecentFiles(): void {
  const clear = $("#recent-clear")
  recentPreviewObserver?.disconnect()
  recentPreviewQueue.length = 0
  recentPreviewQueued.clear()
  const items = readRecentFiles()
  clear?.toggleAttribute("hidden", items.length === 0)
  const grid = $("#welcome-recent-grid")
  const gridEmpty = $("#welcome-recent-empty")
  const hint = $("#welcome-recent-hint")
  grid?.replaceChildren(...items.map(recentCard))
  grid?.toggleAttribute("hidden", items.length === 0)
  if (gridEmpty) gridEmpty.hidden = items.length > 0
  if (hint) hint.textContent = items.length ? `${items.length} 个文件` : "还没有记录"
  // 预览图按路径缓存，这里裁掉已不在列表里的条目并释放它们占用的 blob URL
  const listed = new Set(items.map((item) => item.path))
  for (const [path, image] of [...recentPreviewCache]) {
    if (listed.has(path)) continue
    releaseArchivePreview(image)
    recentPreviewCache.delete(path)
  }
  void recentThumbRequest("readonly", (store) => store.getAllKeys())
    .then((keys) => Promise.all(keys.filter((key) => !listed.has(String(key)))
      .map((key) => recentThumbRequest("readwrite", (store) => store.delete(key)))))
    .catch(() => undefined)
  if (items.length) observeRecentPreviews()
}

$("#recent-clear")?.addEventListener("click", () => {
  localStorage.removeItem(recentFilesKey)
  for (const image of recentPreviewCache.values()) releaseArchivePreview(image)
  recentPreviewCache.clear()
  void recentThumbRequest("readwrite", (store) => store.clear()).catch(() => undefined)
  renderRecentFiles()
})

$("#welcome-recent-open")?.addEventListener("click", () => openButton.click())
renderRecentFiles()

void hydrateTemplateCardPreviews(document.querySelector(".template-grid")!, { lazy: true })

// 欢迎页模板卡：直接以该模板新建，不再弹选择器
for (const card of document.querySelectorAll<HTMLButtonElement>(".template-card[data-template]")) {
  card.addEventListener("click", () => {
    const templateID = card.dataset.template
    if (!templateID || appState.fileOperationRunning) return
    void runFileOperation("新建皮肤", () => newDocument(templateID))
  })
}
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
    settingsController.begin()
    settingsDialog.showModal()
    if (button.classList.contains("ai-design-settings")) showSettingsPage("model")
    else if (button.dataset.appDialog === "about") showSettingsPage("about")
    for (const menu of toolbarMenus) menu.open = false
  })
}

function showSettingsPage(page: string): void {
  const target = settingsPages.find(panel => panel.dataset.settingsPanel === page && !panel.hasAttribute("data-platform-hidden"))
    ?? settingsPages.find(panel => !panel.hasAttribute("data-platform-hidden"))
  if (!target) return
  for (const panel of settingsPages) panel.hidden = panel !== target
  for (const button of settingsNavItems) {
    const selected = button.dataset.settingsPage === target.dataset.settingsPanel
    button.setAttribute("aria-selected", String(selected))
    button.tabIndex = selected ? 0 : -1
  }
  settingsDialog.querySelector<HTMLElement>(".settings-content")?.scrollTo({ top: 0 })
  if (target.dataset.settingsPanel === "about") void refreshUpdateStatus()
}

for (const button of settingsNavItems) {
  button.addEventListener("click", () => showSettingsPage(button.dataset.settingsPage ?? "appearance"))
  button.addEventListener("keydown", (event) => {
    if (!["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return
    event.preventDefault()
    const visibleItems = settingsNavItems.filter(item => !item.hidden)
    const offset = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1
    const index = visibleItems.indexOf(button)
    const next = event.key === "Home" ? visibleItems[0] : event.key === "End" ? visibleItems.at(-1) : visibleItems[(index + offset + visibleItems.length) % visibleItems.length]
    next?.focus()
    next?.click()
  })
}

const nativeSettings = isTauri() || location.hostname === "127.0.0.1" && ["1420", "4173"].includes(location.port)
settingsStorageNav.hidden = !nativeSettings
settingsModelNav.hidden = !nativeSettings
settingsStorageSection.toggleAttribute("data-platform-hidden", !nativeSettings)
settingsModelSection.toggleAttribute("data-platform-hidden", !nativeSettings)
showSettingsPage("appearance")

function aiEditableProjectFiles(target: SkinArchive, scope: "panel" | "project" = "project"): AiSkinEditableFile[] {
  const panelConfig = target.format === "bda"
    ? bdaConfigPath(target, theme.value, orientation.value, "appearance")
    : appState.layoutPath || appState.selectedPath || preferredPath()
  // 面板范围同时授权它引用的全局配置与样式表：按键文字、字体、颜色都定义在样式表里。
  const panelFiles = new Set([panelConfig, ...target.format === "bda" ? [] : [genConfigPath(), styleConfigPath()]])
  return target.names().flatMap((path) => {
    if (scope === "panel" && !panelFiles.has(path)) return []
    if (target.format === "bda") {
      if (!target.isBdaConfig(path) || !bdaDecodedSourceEditable(path)) return []
      const bytes = target.getBytes(path)
      if (!bytes) return []
      try {
        return [{ path, syntax: "json" as const, text: decodedBdaEditorSource(path, bytes) }]
      } catch {
        return []
      }
    }
    if (!target.isText(path) || !/\.(?:ini|css|json)$/i.test(path)) return []
    return [{ path, syntax: /\.json$/i.test(path) ? "json" as const : "ini" as const, text: target.getText(path) }]
  })
}

/** PNGs beside the panel's style sheet (or every PNG for project scope), with their .til slices. */
function aiEditableProjectImages(target: SkinArchive, scope: "panel" | "project" = "project"): AiSkinImageFile[] {
  if (target.format === "bda") return []
  const folders = [styleConfigPath().replace(/[^/]*$/, ""), `${theme.value}/skin/res/`]
  return target.names().flatMap((path) => {
    if (!target.isImage(path) || scope === "panel" && !folders.some((folder) => path.startsWith(folder) && !path.slice(folder.length).includes("/"))) return []
    const tilPath = path.replace(/\.png$/i, ".til")
    return [{ path, bytes: target.getBytes(path)!, tiles: target.isText(tilPath) ? target.getText(tilPath) : undefined }]
  })
}

function aiWantsWholeProject(prompt: string): boolean {
  return /整个皮肤|全局|所有面板|全部面板|所有主题|全部主题|全项目|整个项目|全局修改/i.test(prompt)
}

function aiWantsVariants(prompt: string): boolean {
  return /开创性|创新|创作|灵感|大胆|全新风格|多版|几版|几个方案|不同方向|方案选择/i.test(prompt)
}

function aiPreviewImage(): { type: "image"; data: string; mimeType: string } | undefined {
  if (!previewCanvas.width || !previewCanvas.height) return
  try {
    const layers = [
      !candidateBackgroundCanvas.hidden ? candidateBackgroundCanvas : undefined,
      !toolbarCanvas.hidden && !toolbarStrip.hidden ? toolbarCanvas : undefined,
      previewCanvas,
    ].filter((canvas): canvas is HTMLCanvasElement => Boolean(canvas && canvas.width && canvas.height))
    const width = Math.max(...layers.map((canvas) => canvas.width))
    const height = layers.reduce((sum, canvas) => sum + canvas.height, 0)
    const snapshot = document.createElement("canvas")
    snapshot.width = width
    snapshot.height = height
    const context = snapshot.getContext("2d")
    if (!context) return
    context.fillStyle = theme.value === "dark" ? "#17191f" : "#f6f7f9"
    context.fillRect(0, 0, width, height)
    let y = 0
    for (const canvas of layers) {
      context.drawImage(canvas, 0, y)
      y += canvas.height
    }
    const url = snapshot.toDataURL("image/png")
    const comma = url.indexOf(",")
    if (comma < 0) return
    return { type: "image", mimeType: "image/png", data: url.slice(comma + 1) }
  } catch {
    return
  }
}

function aiSelectedKeyContext(): { label: string; sections: string[]; values: Record<string, string> } {
  const sections = appState.selectedKeySections.slice()
  const keys = ["BACK_STYLE", "FORE_STYLE", "FONT_NAME", "FONT_SIZE", "NM_COLOR", "HL_COLOR", "CENTER", "CLICK", "LONG_CLICK", "SWIPE"]
  const values: Record<string, string> = {}
  for (const key of keys) {
    const value = sections.length ? effectiveKeyValue(sections[0], key) : undefined
    if (value !== undefined) values[key] = value
  }
  return { label: selectedKeyName.textContent?.trim() ?? "", sections, values }
}

function syncAiDesignContext(): void {
  aiContextKey.hidden = appState.selectedKeySections.length === 0
  aiContextKey.textContent = appState.selectedKeySections.length > 1
    ? `${appState.selectedKeySections.length} 个按键`
    : `${selectedKeyName.textContent?.trim() || "按键"} · ${appState.selectedKeySections[0] ?? ""}`
  const available = Boolean(appState.archive && previewCanvas.width && previewCanvas.height)
  aiContextPreview.textContent = available ? "画布" : "暂无画布"
  aiContextPreview.dataset.off = String(!available)
  syncAiDesignControls()
}

function validatedAiChanges(target: SkinArchive, drafts: readonly AiSkinDraftChange[]): Change[] {
  const allowed = new Map(aiEditableProjectFiles(target).map((file) => [file.path, file]))
  const images = new Set(aiEditableProjectImages(target).map((image) => image.path))
  const seen = new Set<string>()
  return drafts.flatMap<Change>((draft): Change[] => {
    if (seen.has(draft.path)) throw new Error(`AI 返回了重复修改：${draft.path}`)
    seen.add(draft.path)
    if (draft.syntax === "png") {
      if (!images.has(draft.path)) throw new Error(`AI 修改了未授权图片：${draft.path}`)
      const before = target.getBytes(draft.path)!
      if (!sameBytes(before, draft.before)) throw new Error(`AI 运行期间图片已变化：${draft.path}`)
      return [{ kind: "bytes" as const, path: draft.path, before: before.slice(), after: draft.after.slice() }]
    }
    const editable = allowed.get(draft.path)
    if (!editable || editable.syntax !== draft.syntax) throw new Error(`AI 修改了未授权文件：${draft.path}`)
    if (editable.text !== draft.before) throw new Error(`AI 运行期间文件已变化：${draft.path}`)
    if (draft.before === draft.after) return []
    if (target.format !== "bda") {
      return [{ kind: "text" as const, path: draft.path, before: draft.before, after: draft.after }]
    }
    const before = target.getBytes(draft.path)
    if (!before) throw new Error(`文件已不存在：${draft.path}`)
    const after = applyDecodedBdaSource(draft.path, before, draft.after)
    return [{ kind: "bytes" as const, path: draft.path, before: before.slice(), after }]
  })
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  return left.length === right.length && left.every((byte, index) => byte === right[index])
}

function aiDesignErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error)
  const normalized = raw.toLowerCase()
  if (normalized.includes("connection error") || normalized.includes("failed to fetch") || normalized.includes("networkerror")) {
    return "无法连接模型服务。请在设置 > AI 模型中检查 API 地址、模型名称和密钥。"
  }
  if (normalized.includes("401") || normalized.includes("unauthorized") || normalized.includes("api key")) {
    return "模型服务拒绝了请求，请检查 API 密钥是否正确或已过期。"
  }
  if (normalized.includes("404") || normalized.includes("not found")) {
    return "找不到模型接口，请检查 API 地址和协议类型是否匹配。"
  }
  if (normalized.includes("server_error") || normalized.includes("overloaded")
    || normalized.includes("429") || normalized.includes("503") || normalized.includes("529")) {
    return "模型服务当前繁忙，请稍后重试。"
  }
  return `AI 设计失败：${raw}`
}

async function runAiDesignRequest(prompt: string, hooks: AiChatRunHooks, files: readonly File[]): Promise<AiChatRunResult> {
  if (!isTauri()) {
    throw new Error("AI 设计当前仅在桌面应用中可用。")
  }
  if (!appState.archive) {
    throw new Error("请先打开一个皮肤项目。")
  }
  if (!isEditing()) {
    throw new Error("请先切换到编辑模式。")
  }
  if (!prompt.trim()) throw new Error("请填写设计要求。")
  if (appState.aiDesignBusy) throw new Error("上一轮设计尚未结束，请稍候。")
  if (appState.aiDesignDraft) throw new Error("请先应用或丢弃待确认的草稿，再继续对话。")
  source.commit()
  const target = appState.archive
  const configuration = appState.savedModels[Number(aiDesignModel.value)]
  if (!configuration) {
    throw new Error("请先配置 AI 模型。")
  }
  if (appState.aiDesignConversationTarget !== target) {
    appState.aiDesignConversationTarget = target
    appState.aiDesignConversation = []
  }
  appState.aiDesignBusy = true
  // Progress lives in the conversation timeline; the status line only reports outcomes.
  aiDesignPanel.dataset.state = "running"
  aiDesignStatus.textContent = ""
  syncAiDesignControls()
  try {
    const panelScope = aiWantsWholeProject(prompt) ? "project" as const : "panel" as const
    const panelPath = target.format === "bda"
      ? bdaConfigPath(target, theme.value, orientation.value, "appearance") ?? appState.layoutPath
      : appState.layoutPath || appState.selectedPath || preferredPath()
    const project = {
      format: target.format,
      skinName: documentName.textContent?.trim() ?? "",
      skinPath: appState.currentPath.split(/[\\/]/).pop() ?? "",
      theme: theme.value,
      orientation: orientation.value,
      layout: layout.value,
      keyboard: device.options[device.selectedIndex]?.textContent?.trim() || currentDeviceValue(),
      panelPath,
      panelScope,
      selectedKey: aiSelectedKeyContext(),
      preview: aiPreviewImage(),
      files: aiEditableProjectFiles(target, panelScope),
      images: aiEditableProjectImages(target, panelScope),
    }
    const { aiDesignAttachments, runAiSkinDesign } = await import("./ai-design.ts")
    const attachments = files.length ? await aiDesignAttachments(files) : undefined
    const result = await runAiSkinDesign(configuration, project, prompt, {
      imageModel: appState.savedImageModel,
      attachments,
      history: appState.aiDesignConversation,
      variantCount: aiWantsVariants(prompt) ? 3 : 1,
      thinkingLevel: aiDesignThinking.value as "off" | "low" | "medium" | "high",
      signal: hooks.signal,
      onStatus: async (kind, text) => {
        if (hooks.signal.aborted || appState.archive !== target) return
        await hooks.onStatus?.(text, kind)
      },
      onTextDelta: hooks.onTextDelta,
      onThinking: hooks.onThinking,
    })
    if (hooks.signal.aborted) throw new DOMException("AI 设计已取消", "AbortError")
    if (appState.archive !== target) throw new Error("AI 运行期间已切换皮肤项目，本轮草稿未应用")
    if (!isEditing()) throw new Error("已退出编辑模式，本轮草稿未应用")
    if (result.variants?.length) {
      const variants = result.variants.flatMap<AiDraftVariant>((variant) => {
        try {
          const changes = validatedAiChanges(target, variant.changes)
          return [{
            id: variant.id,
            title: variant.title,
            changes,
            drafts: variant.changes,
            sections: aiDraftSections(variant.changes),
            conversation: variant.conversation,
            response: variant.response,
          }]
        } catch (error) {
          throw new Error(`${variant.title}：${aiDesignErrorMessage(error)}`)
        }
      })
      setAiDesignDraft({
        target,
        changes: [],
        drafts: [],
        sections: [],
        conversation: [],
        response: "",
        variants,
      })
      return {
        fallback: "已生成多个设计方向，请选择一个方案预览并应用。",
        summary: "方案已就绪 · 选择后才会写入皮肤",
      }
    }
    const changes = validatedAiChanges(target, result.changes)
    if (!changes.length) {
      appState.aiDesignConversation = result.conversation
      aiDesignPanel.dataset.state = "done"
      aiDesignStatus.textContent = "分析完成 · 没有文件修改"
      return { fallback: result.response || "AI 分析完成，没有需要应用的修改。" }
    }
    // Keep the committed conversation unchanged until the user accepts the draft.
    setAiDesignDraft({
      target,
      changes,
      drafts: result.changes,
      sections: aiDraftSections(result.changes),
      conversation: result.conversation,
      response: result.response,
    })
    return {
      fallback: result.response,
      summary: `已生成 ${changes.length} 个文件的草稿，审阅后应用。`,
    }
  } catch (error) {
    if (appState.archive === target) {
      aiDesignPanel.dataset.state = hooks.signal.aborted ? "stopped" : "error"
      // The conversation already shows the error; repeating it above reads as a second failure.
      aiDesignStatus.textContent = hooks.signal.aborted ? "已停止 · 未应用任何修改" : ""
    }
    if (hooks.signal.aborted) throw error
    throw new Error(aiDesignErrorMessage(error))
  } finally {
    appState.aiDesignBusy = false
    syncAiDesignControls()
  }
}

/**
 * Derives the canvas sections an AI draft would touch, by comparing the INI
 * sections (or JSON keys) present before and after each proposed file change.
 */
function aiDraftSections(changes: readonly AiSkinDraftChange[]): string[] {
  const sections = new Set<string>()
  for (const change of changes) {
    if (change.syntax === "png") continue
    if (change.syntax === "json") {
      for (const key of changedJsonSections(change.before, change.after)) sections.add(key)
      continue
    }
    const before = new Map(iniSectionTexts(change.before))
    const after = new Map(iniSectionTexts(change.after))
    for (const [name, text] of after) {
      if (before.get(name) !== text) sections.add(name)
    }
    for (const name of before.keys()) if (!after.has(name)) sections.add(name)
  }
  return [...sections]
}

function iniSectionTexts(source: string): Array<[string, string]> {
  const headers = [...source.matchAll(/^\s*\[([^\]]+)]\s*$/gm)]
  return headers.map((header, index) => [
    header[1],
    source.slice(header.index ?? 0, headers[index + 1]?.index ?? source.length),
  ])
}

function createAiVariantReview(variant: AiDraftVariant, index: number): HTMLLIElement {
  const item = document.createElement("li")
  item.className = "ai-variant-card"
  const button = document.createElement("button")
  button.type = "button"
  button.className = "ai-variant-select"
  button.dataset.variantId = variant.id
  button.innerHTML = `<span class="ai-variant-index">${index + 1}</span><span class="ai-variant-copy"><strong></strong><small></small></span><span class="system-symbol" data-system-symbol="chevron.right" aria-hidden="true"></span>`
  button.querySelector("strong")!.textContent = variant.title
  button.querySelector("small")!.textContent = `${variant.changes.length} 个文件 · ${variant.sections.length} 个配置块`
  button.addEventListener("click", () => chooseAiVariant(variant.id))
  item.append(button)
  if (variant.response.trim()) {
    const note = document.createElement("p")
    note.className = "ai-variant-note"
    note.textContent = variant.response.trim().slice(0, 180)
    item.append(note)
  }
  return item
}

function chooseAiVariant(id: string): void {
  const draft = appState.aiDesignDraft
  const variant = draft?.variants?.find((item) => item.id === id)
  if (!draft || !variant) return
  draft.changes = variant.changes
  draft.drafts = variant.drafts
  draft.sections = variant.sections
  draft.conversation = variant.conversation
  draft.response = variant.response
  draft.variants = undefined
  setAiDesignDraft(draft)
  aiDesignStatus.textContent = `已选择「${variant.title}」· 请核对修改后应用`
}

function setAiDesignDraft(draft: AiDraft | undefined): void {
  revertAiDraftPreview()
  appState.aiDesignDraft = draft
  aiDraftPanel.hidden = !draft
  // The draft card takes the composer's place until it is applied or discarded.
  aiDesignChat.toggleAttribute("data-draft", Boolean(draft))
  preview.setDraftSections(draft?.sections ?? [])
  syncAiDesignControls()
  if (draft) {
    aiDesignPanel.dataset.state = "review"
    aiDesignStatus.textContent = ""
  }
  if (!draft) {
    aiDraftFiles.replaceChildren()
    return
  }
  if (draft.variants?.length) {
    aiDraftSummary.textContent = `${draft.variants.length} 个设计方向 · 选择一个继续`
    aiDraftFiles.replaceChildren(...draft.variants.map((variant, index) => createAiVariantReview(variant, index)))
    return
  }
  aiDraftSummary.textContent = `涉及 ${draft.changes.length} 个文件` +
    (draft.sections.length ? ` · ${draft.sections.length} 个配置块` : "")
  aiDraftFiles.replaceChildren(...draft.drafts.map(createDraftReview))
  previewAiDraft(draft)
}

function writeAiDraftChanges(target: SkinArchive, changes: readonly Change[], side: "before" | "after"): void {
  for (const change of side === "before" ? [...changes].reverse() : changes) {
    if (change.kind === "text") target.setText(change.path, change[side])
    else if (change.kind === "bytes") {
      const bytes = change[side]
      if (bytes) target.setBytes(change.path, bytes)
      else target.delete(change.path)
    }
  }
}

/** Shows a draft on the canvas by writing it into the archive without recording history. */
function previewAiDraft(draft: AiDraft): void {
  if (appState.archive !== draft.target) return
  try {
    source.commit()
    // Revalidate before writing: never overwrite edits made since generation.
    draft.changes = validatedAiChanges(draft.target, draft.drafts)
  } catch (error) {
    aiDesignStatus.textContent = `${aiDesignErrorMessage(error)}。无法在画布预览，请丢弃后重新生成。`
    return
  }
  writeAiDraftChanges(draft.target, draft.changes, "after")
  appState.aiDraftPreview = { target: draft.target, changes: draft.changes }
  refreshAfterAiDraft(draft.target)
}

function revertAiDraftPreview(): void {
  const current = appState.aiDraftPreview
  if (!current) return
  appState.aiDraftPreview = undefined
  writeAiDraftChanges(current.target, current.changes, "before")
  if (appState.archive === current.target) refreshAfterAiDraft(current.target)
}

/** Turns the previewed draft into a normal undoable edit; the archive already holds its content. */
function acceptAiDraftPreview(): void {
  const current = appState.aiDraftPreview
  if (!current) return
  appState.aiDraftPreview = undefined
  commitBatch(current.changes)
  if (appState.aiDesignDraft) appState.aiDesignConversation = appState.aiDesignDraft.conversation
  setAiDesignDraft(undefined)
  aiDesignPanel.dataset.state = "done"
  aiDesignStatus.textContent = `已应用 ${current.changes.length} 个文件的修改，可使用撤销恢复。`
}

function discardAiDesignDraft(message: string): void {
  if (!appState.aiDesignDraft) return
  setAiDesignDraft(undefined)
  aiDesignPanel.dataset.state = "idle"
  aiDesignStatus.textContent = message
}

function refreshAfterAiDraft(target: SkinArchive): void {
  if (target.format === "bda") refreshBdaLayout(appState.layoutPath)
  else if (target.isText(appState.layoutPath)) appState.layoutDocument = IniDocument.parse(target.getText(appState.layoutPath))
  renderFiles()
  if (appState.selectedPath && target.getBytes(appState.selectedPath)) selectFile(appState.selectedPath, appState.sidebarView, "document", true)
  refreshPreview()
  populateKeyInspector()
  updateDirty()
}

function applyAiDesignDraft(): void {
  const draft = appState.aiDesignDraft
  if (!draft) return
  if (appState.archive !== draft.target) {
    setAiDesignDraft(undefined)
    aiDesignStatus.textContent = "皮肤项目已切换，草稿已丢弃。"
    return
  }
  if (!isEditing() || appState.aiDesignBusy) {
    aiDesignStatus.textContent = "请在编辑模式下应用草稿，并等待生成结束。"
    return
  }
  if (!draft.changes.length || !draft.drafts.length) {
    aiDesignStatus.textContent = "请先选择一个设计方案。"
    return
  }
  if (!appState.aiDraftPreview) {
    aiDesignPanel.dataset.state = "error"
    aiDesignStatus.textContent = "草稿无法在画布预览，请丢弃后重新生成。"
    return
  }
  // A pending source edit is committed first and accepts the preview on its own.
  source.commit()
  acceptAiDraftPreview()
}

function ensureAiChat(): Promise<AiChatController> {
  appState.aiChatInitialization ??= import("./ai-chat.ts")
    .then(({ connectAiChat }) => connectAiChat(aiDesignChat, runAiDesignRequest))
    .catch((error) => { appState.aiChatInitialization = undefined; throw error })
  return appState.aiChatInitialization.then((controller) => {
    appState.aiChatController = controller
    syncAiDesignControls()
    return controller
  })
}

function syncAiDesignControls(): void {
  aiDesignModel.disabled = appState.aiDesignBusy || appState.savedModels.length === 0
  aiDesignThinking.disabled = aiDesignModel.disabled
  aiNewSession.disabled = appState.aiDesignBusy || Boolean(appState.aiDesignDraft)
  // A pending draft must be applied or discarded first; deep-chat keeps its stop
  // button during a run, so only the idle submit state is affected.
  appState.aiChatController?.setEnabled(!appState.aiDesignDraft && appState.savedModels.length > 0)
  aiDraftApply.disabled = appState.aiDesignBusy || !isEditing() || Boolean(appState.aiDesignDraft?.variants?.length)
  aiDraftCancel.disabled = appState.aiDesignBusy
}

aiNewSession.addEventListener("click", () => {
  if (appState.aiDesignBusy || appState.aiDesignDraft) return
  appState.aiChatController?.clear()
  appState.aiDesignConversation = []
  aiDesignStatus.textContent = "已开始新对话 · 已应用的修改不受影响"
  aiDesignPanel.dataset.state = "idle"
  syncAiDesignControls()
  appState.aiChatController?.focus()
})
aiDraftApply.addEventListener("click", () => applyAiDesignDraft())
aiDraftCancel.addEventListener("click", () => {
  discardAiDesignDraft("草稿已丢弃 · 本轮未修改皮肤，可调整要求后重试。")
})

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

function syncModelProfiles(all: ModelConfiguration[]): void {
  const selected = appState.savedModels[Number(aiDesignModel.value)]
  const models = all.filter((model) => model.kind !== "image")
  appState.savedImageModel = all.find((model) => model.kind === "image")
  appState.savedModels = models
  // One optgroup per provider account; option values stay indexes into the flat saved list.
  const groups = groupModelConfigurations(models)
  const labels = groups.map((group) => modelProviderPreset(group.provider).label)
  aiDesignModel.replaceChildren(...groups.map((group, index) => {
    const optgroup = document.createElement("optgroup")
    optgroup.label = labels.indexOf(labels[index]) === labels.lastIndexOf(labels[index]) ? labels[index] : `${labels[index]} · ${modelHost(group.apiUrl)}`
    optgroup.append(...group.models.map((model) => {
      const flat = models.findIndex((item) => item.provider === group.provider && item.apiUrl === group.apiUrl && item.apiKey === group.apiKey && item.model === model)
      return new Option(model, String(flat))
    }))
    return optgroup
  }))
  if (!models.length) aiDesignModel.replaceChildren(new Option("请先配置模型", ""))
  // Keep the chat on the same model when the list is reordered or shortened.
  const index = selected ? models.findIndex((model) => modelConfigurationKey(model) === modelConfigurationKey(selected)) : -1
  if (models.length) aiDesignModel.value = String(Math.max(index, 0))
  aiDesignModel.hidden = models.length === 0
  aiDesignThinking.hidden = aiDesignModel.hidden
  aiModelSettings.hidden = models.length > 0
  syncAiDesignControls()
}

const modelSettings = initializeModelSettings($("#settings-model-section"), {
  desktop: isTauri(),
  icon: symbolSpan,
  onSaved: syncModelProfiles,
})

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
    appState.sourceWorkspacePendingArchive = undefined
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
  : currentDeviceValue()
defaultDevice.addEventListener("change", () => {
  localStorage.setItem("default-device", defaultDevice.value)
})
function applyCanvasBackground(background: CanvasBackground): void {
  canvasBackground.value = background
  localStorage.setItem("canvas-background", background)
  canvasWrap.dataset.background = background
}

const savedCanvasBackground = localStorage.getItem("canvas-background")
const initialCanvasBackground = savedCanvasBackground === "default"
  ? "glass"
  : canvasBackgroundValues.includes(savedCanvasBackground as CanvasBackground)
    ? savedCanvasBackground as CanvasBackground
    : "checkerboard"
applyCanvasBackground(initialCanvasBackground)
if (currentDeviceValue() === "canvas") device.value = canvasDeviceValue(initialCanvasBackground)
canvasBackground.addEventListener("change", () => {
  const background = canvasBackground.value as CanvasBackground
  applyCanvasBackground(background)
  if (currentDeviceValue() === "canvas") {
    device.value = canvasDeviceValue(background)
    updateDevicePreview()
    refreshPreview()
  }
})
mobilePreviewPosition.value = localStorage.getItem("mobile-preview-position") === "top" ? "top" : "bottom"
document.documentElement.dataset.mobilePreviewPosition = mobilePreviewPosition.value
mobilePreviewPosition.addEventListener("change", () => {
  localStorage.setItem("mobile-preview-position", mobilePreviewPosition.value)
  document.documentElement.dataset.mobilePreviewPosition = mobilePreviewPosition.value
})
hintPreviewEnabled.checked = localStorage.getItem("hint-preview-enabled") !== "off"
hintPreviewEnabled.addEventListener("change", () => {
  localStorage.setItem("hint-preview-enabled", hintPreviewEnabled.checked ? "on" : "off")
  refreshPreview()
})
editorCrosshair.checked = localStorage.getItem("editor-crosshair") !== "off"
editorCoordinateSnap.checked = localStorage.getItem("editor-coordinate-snap") !== "off"
function applyEditorCrosshairSetting(): void {
  const state = editorCrosshair.checked ? "on" : "off"
  deviceShell.dataset.crosshair = state
  previewCoordinates.dataset.crosshair = state
  preview.setCrosshair(editorCrosshair.checked)
  toolbarPreview.setCrosshair(editorCrosshair.checked)
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
function currentWindowMaterialOpacity(): number {
  return Math.max(20, Math.min(100, Number(windowMaterialOpacity.value) || 100))
}
function applyWindowMaterialOpacity(): void {
  const opacity = currentWindowMaterialOpacity()
  windowMaterialOpacity.value = String(opacity)
  windowMaterialOpacityValue.value = `${opacity}%`
  windowMaterialOpacity.disabled = !windowMaterial.checked
  document.documentElement.dataset.windowMaterialKind = appState.windowMaterialKind
  // 滑杆值就是材质填充强度：100% 时每个表面都合成到完全不透明，因此不再像旧版那样乘一个小系数
  // （那样 100% 也只有半透明）。各表面按层角色取系数：单层直接用 f，下沉层用 1-√(1-f) 让两层叠加后
  // 正好等于 f，浮层用 1-(1-f)² 让对话框正文始终落在接近实心的底上。模糊无需再关闭。
  const fill = opacity / 100
  document.documentElement.style.setProperty("--window-material-layer", String(fill))
  document.documentElement.style.setProperty("--window-material-sunken", String(1 - Math.sqrt(1 - fill)))
  document.documentElement.style.setProperty("--window-material-floating", String(1 - (1 - fill) ** 2))
}
async function applyWindowMaterial(): Promise<void> {
  const enabled = windowMaterial.checked
  document.documentElement.dataset.windowMaterial = enabled ? "on" : "off"
  applyWindowMaterialOpacity()
  if (!isTauri()) return
  await invoke("set_window_material", { enabled, opacity: currentWindowMaterialOpacity() })
}
function applyWindowMaterialWithRetry(): Promise<void> {
  return retryAsync(applyWindowMaterial, { attempts: 4, delayMs: 100 })
}
function handleWindowMaterialError(error: unknown, action: string): void {
  windowMaterial.checked = false
  document.documentElement.dataset.windowMaterial = "off"
  localStorage.setItem("window-material", "off")
  applyWindowMaterialOpacity()
  showError(error, action)
}
async function initializeWindowMaterial(): Promise<void> {
  if (isTauri()) {
    appState.windowMaterialKind = await retryAsync(
      () => invoke<WindowMaterialKind>("window_material_kind"),
      { attempts: 4, delayMs: 100 },
    )
  }
  const savedWindowMaterial = localStorage.getItem("window-material")
  windowMaterial.checked = savedWindowMaterial === null
    ? appState.windowMaterialKind !== "acrylic"
    : savedWindowMaterial !== "off"
  windowMaterialOpacitySetting.hidden = appState.windowMaterialKind === "none"
  const storageKey = appState.windowMaterialKind === "acrylic" ? "window-acrylic-opacity" : "window-glass-opacity"
  // 玻璃默认值取 50%：滑杆现在代表填充强度，100% 等同于实心窗口，默认值要留出材质本身。
  windowMaterialOpacity.value = localStorage.getItem(storageKey) ?? "87"
  await applyWindowMaterialWithRetry()
}
void initializeWindowMaterial().catch((error) => handleWindowMaterialError(error, "读取窗口材质"))
windowMaterial.addEventListener("change", () => {
  localStorage.setItem("window-material", windowMaterial.checked ? "on" : "off")
  void applyWindowMaterialWithRetry().catch((error) => handleWindowMaterialError(error, "切换窗口材质"))
})
windowMaterialOpacity.addEventListener("input", () => {
  const storageKey = appState.windowMaterialKind === "acrylic" ? "window-acrylic-opacity" : "window-glass-opacity"
  localStorage.setItem(storageKey, String(currentWindowMaterialOpacity()))
  applyWindowMaterialOpacity()
})
windowMaterialOpacity.addEventListener("change", () => {
  void applyWindowMaterialWithRetry().catch((error) => handleWindowMaterialError(error, "切换窗口材质"))
})

async function restoreWindowMaterialAfterDrag(): Promise<void> {
  appState.windowDragPointerDown = false
  try {
    await appState.windowDragMaterialTransition
  } catch {
    appState.windowDragMaterialDisabled = false
    document.documentElement.dataset.windowMaterial = windowMaterial.checked ? "on" : "off"
    return
  }
  if (!appState.windowDragMaterialDisabled) {
    document.documentElement.dataset.windowMaterial = windowMaterial.checked ? "on" : "off"
    return
  }
  appState.windowDragMaterialDisabled = false
  await new Promise(resolve => setTimeout(resolve, 50))
  try {
    await applyWindowMaterialWithRetry()
  } catch (error) {
    handleWindowMaterialError(error, "恢复窗口材质")
  }
}

async function startWindowsWindowDrag(): Promise<void> {
  appState.windowDragPointerDown = true
  document.documentElement.dataset.windowMaterial = "off"
  try {
    appState.windowDragMaterialTransition = invoke("set_window_material", { enabled: false, opacity: currentWindowMaterialOpacity() })
    await appState.windowDragMaterialTransition
    appState.windowDragMaterialDisabled = true
    if (!appState.windowDragPointerDown) {
      await restoreWindowMaterialAfterDrag()
      return
    }
    const mouseReleased = invoke("wait_for_left_mouse_release")
    await getCurrentWindow().startDragging()
    await mouseReleased
    await restoreWindowMaterialAfterDrag()
  } catch (error) {
    appState.windowDragMaterialTransition = undefined
    await restoreWindowMaterialAfterDrag()
    showError(error, "拖动窗口")
  } finally {
    appState.windowDragMaterialTransition = undefined
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
  if (appState.windowDragPointerDown) void restoreWindowMaterialAfterDrag()
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
sourceCompletionEnabled.checked = localStorage.getItem("source-completion-enabled") === "on"
sourceValueHintsEnabled.checked = localStorage.getItem("source-value-hints-enabled") === "on"
sourceLineExplanationEnabled.checked = localStorage.getItem("source-line-explanation-enabled") === "on"
function applySourceEditorFeatures(): void {
  source.setFeatures({
    completion: sourceCompletionEnabled.checked,
    valueHints: sourceValueHintsEnabled.checked,
    explanations: sourceLineExplanationEnabled.checked,
  })
  updateSourceHighlight()
}
applySourceEditorFeatures()
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
  if (appState.fileOperationRunning) event.preventDefault()
})
function setCanvasDropState(active: boolean): void {
  canvasWrap.classList.toggle("drop-target", active)
}
canvasWrap.addEventListener("dragenter", (event) => {
  event.preventDefault()
  appState.canvasDragDepth += 1
  setCanvasDropState(true)
})
canvasWrap.addEventListener("dragover", (event) => {
  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "copy"
    const file = event.dataTransfer.files[0]
    setLayoutImageHighlight(Boolean(appState.archive && appState.archive.format !== "bda" && file && /\.png$/i.test(file.name)))
  }
})
canvasWrap.addEventListener("dragleave", (event) => {
  event.preventDefault()
  appState.canvasDragDepth = Math.max(0, appState.canvasDragDepth - 1)
  if (!appState.canvasDragDepth) {
    setCanvasDropState(false)
    setLayoutImageHighlight(false)
  }
})
canvasWrap.addEventListener("drop", (event) => {
  event.preventDefault()
  appState.canvasDragDepth = 0
  setCanvasDropState(false)
  setLayoutImageHighlight(false)
  const file = event.dataTransfer?.files[0]
  if (!file) return
  if (/\.png$/i.test(file.name)) {
    if (!appState.archive || appState.archive.format === "bda") return
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
  const path = appState.assetReturnPath
  if (!path || !appState.archive?.names().includes(path)) return
  appState.assetReturnPath = ""
  selectFile(path)
  revealSourceFile(path)
})
imageOpen.addEventListener("change", async () => {
  const file = imageOpen.files?.[0]
  if (file && isEditing() && appState.archive?.isImage(appState.selectedPath)) {
    const targetArchive = appState.archive
    const path = appState.selectedPath
    await runFileOperation("替换图片", async () => {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }))
      bitmap.close()
      if (appState.archive !== targetArchive || !isEditing()) return false
      commitBytes(path, appState.archive.getBytes(path)?.slice(), bytes)
      if (appState.selectedPath === path) showImage(path)
      refreshPreview()
      updateDirty()
      return true
    })
  }
  imageOpen.value = ""
})
source.addEventListener("input", () => {
  if (!isEditing() || !appState.archive || !appState.selectedPath) return
  if (appState.archive.isBdaConfig(appState.selectedPath) || isBdaAppearancePartPath(appState.selectedPath)) {
    scheduleSourceInputHighlight()
    return
  }
  if (appState.resourceConfigActive && appState.selectedResourcePath) {
    const before = appState.tileDocument.toString()
    appState.tileDocument = IniDocument.parse(source.value)
    commitText(appState.tilePath, before, source.value)
    appState.slices = tileSlices(appState.tileDocument)
    if (!appState.slices.some((slice) => slice.index === appState.selectedTileIndex)) appState.selectedTileIndex = undefined
    populateTileInspector()
    drawAtlas()
    updateDirty()
    scheduleSourceInputHighlight()
    return
  }
  const before = appState.selectedDocument?.toString() ?? appState.archive.getText(appState.selectedPath)
  appState.selectedDocument = IniDocument.parse(source.value)
  commitText(appState.selectedPath, before, source.value)
  if (appState.selectedPath === appState.layoutPath) appState.layoutDocument = appState.selectedDocument
  updateDirty()
  scheduleSourceInputHighlight(true)
})
source.addEventListener("change", commitBdaSourceEdit)
sourceColorPicker.addEventListener("change", applySourceColorPicker)
/**
 * Reverse direction of the canvas ↔ source link: putting the caret inside a
 * configuration block selects the key that block describes. The canvas is
 * updated without echoing back into the editor, so the two stay in step
 * without fighting over the caret.
 */
function selectKeyFromSourceOffset(offset: number): void {
  if (!isEditing() || !appState.archive || !appState.selectedPath) return
  if (appState.selectedPath !== appState.layoutPath) return
  const bdaSource = appState.archive.format === "bda" && (
    appState.archive.isBdaConfig(appState.selectedPath) || isBdaVirtualTextPath(appState.selectedPath) || isBdaAppearancePartPath(appState.selectedPath)
  )
  const property = bdaSource ? jsonPropertyAtOffset(source.value, offset) : undefined
  const section = bdaSource ? undefined : iniSectionAtOffset(source.value, offset)
  const panelKey = property && property !== "cand" ? property : undefined
  if (!section && !panelKey) return
  if (!appState.layoutDocument) return
  const items = previewItems(appState.layoutDocument)
  const match = items.find((item) => item.editable && (
    section !== undefined
      ? item.section === section || item.sections.includes(section)
      : item.center.trim().toLowerCase() === panelKey
  ))
  if (!match) return
  if (appState.selectedKeySections.length === 1 && appState.selectedKeySections[0] === match.section) return
  appState.selectedCandidate = false
  syncCandidateSelection()
  appState.selectedKeySections = [match.section]
  preview.setSelected(appState.selectedKeySections)
  populateKeyInspector()
}

/**
 * Reverse direction of the canvas ↔ source link: putting the caret inside a
 * configuration block selects the key that block describes. The canvas is
 * updated without echoing back into the editor, so the two stay in step
 * without fighting over the caret.
 *
 * The lazy editor is a plain EventTarget rather than a DOM node, so this is
 * bound to the instance (the editor also re-raises with `bubbles`, which the
 * document-level listener below picks up if that ever changes).
 */
source.addEventListener("cursormove", (event) => {
  const detail = (event as CustomEvent<SourceEditorCursorMove>).detail
  if (!detail) return
  selectKeyFromSourceOffset(detail.offset)
})
source.addEventListener("valueclick", (event) => {
  const detail = (event as CustomEvent<SourceEditorValueClick>).detail
  if (!detail || detail.kind === "action") return
  if (detail.kind === "color") openSourceColorPicker(detail)
  else if (detail.kind === "style" && detail.modifier) openSourceStyleDefinition(detail.value.replace(/^STYLE/i, ""))
  else if (detail.kind === "style") openSourceStylePicker(detail)
})
sourceSearch.addEventListener("input", () => {
  appState.sourceSearchIndex = sourceSearch.value.trim() ? 0 : -1
  scheduleSourceSearch()
})
sourceSearch.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault()
    closeSourceFind()
    return
  }
  if (event.key !== "Enter") return
  event.preventDefault()
  findSourceMatch(event.shiftKey ? -1 : 1)
})
sourceSearchPrevious.addEventListener("click", () => findSourceMatch(-1))
sourceSearchNext.addEventListener("click", () => findSourceMatch(1))
sourceFindToggle.addEventListener("click", () => {
  if (appState.sourceFindVisible) closeSourceFind()
  else openSourceFind()
})
window.addEventListener("keydown", (event) => {
  if (!(event.metaKey || event.ctrlKey) || event.altKey || event.key.toLowerCase() !== "f") return
  if (sourceEditor.hidden) return
  event.preventDefault()
  openSourceFind()
})
sourceReplaceToggle.addEventListener("click", () => {
  const expanded = sourceReplaceRow.hidden
  sourceReplaceRow.hidden = !expanded
  sourceReplaceToggle.setAttribute("aria-expanded", String(expanded))
  sourceReplaceToggle.title = sourceReplaceToggle.ariaLabel = expanded ? "收起替换" : "展开替换"
  syncSourceFindBarOffset()
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
  moveSelectedKeys(delta[0], delta[1], appState.selectedKeySections, coalesce)
  return true
}
// Mixed coordinate wheel edits share the document-level gesture scheduler/history.
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
    appState.keyMode = button.dataset.keyMode === "move" ? "move" : "select"
    keyModeButtons.forEach((item) => item.setAttribute("aria-pressed", String(item === button)))
    preview.setEditTool(appState.keyMode)
  })
}
for (const button of keyActionButtons) {
  button.addEventListener("click", () => {
    if (button.dataset.keyAction === "copy") copySelectedKeys()
    else if (button.dataset.keyAction === "swap") applyLayoutAction("swap")
    else deleteSelectedKeys()
  })
}
inspectorBackButton.addEventListener("click", () => {
  source.commit()
  appState.selectedKeySections = []
  appState.selectedToolbarSections = []
  appState.selectedCandidate = false
  preview.setSelected([])
  toolbarPreview.setSelected([])
  if (appState.inspectorTab !== "source") appState.inspectorTab = "properties"
  syncCandidateSelection()
  updateInspectorView()
  populateKeyInspector()
  updateSourceHighlight()
  scrollSelectedSource()
})
for (const button of inspectorTabButtons) {
  button.addEventListener("click", () => {
    const tab = button.dataset.inspectorTab
    appState.inspectorTab = tab === "source" ? "source" : tab === "ai" ? "ai" : "properties"
    if (mobilePortraitQuery.matches) setMobilePane("inspector")
    updateInspectorView()
    if (!quickInspector.hidden) populateKeyInspector()
    if (!aiDesignPanel.hidden) {
      void ensureAiChat()
        .catch((error) => { aiDesignStatus.textContent = aiDesignErrorMessage(error) })
    }
  })
}
for (const control of [theme, orientation, layout]) {
  control.addEventListener("change", () => {
    const path = preferredPath()
    if (control !== layout && !createMissingVariant(path)) return
    let selected = false
    if (appState.archive?.format === "bda") {
      renderFiles()
      if (bdaAvailableLayoutPaths().includes(path)) {
        selectFile(path)
        selected = true
      }
    } else if (appState.archive?.names().includes(path)) {
      appState.layoutPath = path
      appState.layoutDocument = IniDocument.parse(appState.archive.getText(path))
      appState.selectedKeySections = []
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
  if (appState.resourceConfigActive) populateTileInspector()
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
  appState.guidesVisible = enabled
  ;($("#settings-layout-guides") as HTMLInputElement).checked = enabled
  for (const button of [toggleGuides, mobileToggleGuides]) {
    button.classList.toggle("active", appState.guidesVisible)
    button.setAttribute("aria-pressed", String(appState.guidesVisible))
  }
  preview.setGuides(appState.guidesVisible)
  toolbarPreview.setGuides(appState.guidesVisible)
  if (!enabled) setDrawingTile(false)
  drawAtlas()
}

toggleGuides.addEventListener("click", () => setGuidesVisible(!appState.guidesVisible))
mobileToggleGuides.addEventListener("click", () => setGuidesVisible(!appState.guidesVisible))
newTileButton.addEventListener("click", () => {
  if (!appState.selectedResourcePath || !isEditing()) return
  if (!appState.guidesVisible) setGuidesVisible(true)
  setDrawingTile(!appState.drawingTile)
})
duplicateTileButton.addEventListener("click", duplicateSelectedTile)
deleteTileButton.addEventListener("click", deleteSelectedTile)
resourceBackButton.addEventListener("click", () => {
  if (appState.resourceInspectorMode === "image" && appState.bdaSliceReturn) {
    const { path, styleID } = appState.bdaSliceReturn
    appState.bdaSliceReturn = undefined
    selectFile(path, "overview", "style")
    selectStyleResource(styleID)
    return
  }
  if (appState.resourceInspectorMode === "style" && appState.styleReturnPath) {
    const path = appState.styleReturnPath
    const selection = [...appState.styleReturnSelection]
    const candidate = appState.styleReturnCandidate
    const scrollTop = appState.styleReturnScrollTop
    const inspectorGroup = appState.styleReturnInspectorGroup
    appState.styleReturnPath = ""
    appState.styleReturnCandidate = false
    selectFile(path, "overview")
    appState.selectedKeySections = selection
    appState.selectedCandidate = candidate
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
  if (appState.archive?.format !== "bda" || appState.resourceInspectorMode !== "style" || !appState.resourceConfigActive) {
    renderResourceInspector()
    return
  }
  const group = resourceCategory.value as BdaAppearanceStyleGroup
  if (!bdaAppearanceStyleGroups.some(([value]) => value === group)) return
  source.commit()
  appState.selectedBdaStyleGroup = group
  renderFiles()
  selectFile(bdaAppearanceStylePath(group), "overview", "style")
})
bdaTileUsage.addEventListener("change", () => {
  appState.selectedTileIndex = Number(bdaTileUsage.value)
  populateTileInspector()
  drawAtlas()
})
for (const button of tileModeButtons) {
  button.addEventListener("click", () => {
    appState.tileMode = button.dataset.tileMode === "move" ? "move" : "select"
    tileModeButtons.forEach((item) => item.classList.toggle("active", item === button))
    setDrawingTile(false)
  })
}
atlasCanvas.addEventListener("pointerdown", (event) => {
  if (!appState.resourceConfigActive || event.button !== 0) return
  const point = atlasPoint(event)
  if (appState.drawingTile) {
    appState.tileDragStart = point
    appState.tileDraft = undefined
    atlasCanvas.setPointerCapture(event.pointerId)
    return
  }
  appState.tileResizeCorner = undefined
  const selected = appState.slices.find(slice => slice.index === appState.selectedTileIndex)
  if (selected && isEditing() && appState.archive?.format !== "bda" && appState.guidesVisible) {
    const [x, y, w, h] = selected.source
    const radius = 9 * workspaceImage.naturalWidth / Math.max(1, atlasCanvas.getBoundingClientRect().width)
    const corner = [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].findIndex(([cx, cy]) => Math.abs(point.x - cx) <= radius && Math.abs(point.y - cy) <= radius)
    if (corner >= 0) {
      appState.tileResizeCorner = corner
      appState.movingTile = appState.tileDragOriginal = selected
      atlasCanvas.setPointerCapture(event.pointerId)
      return
    }
  }
  const hit = appState.archive?.format === "bda"
    ? appState.slices.find((slice) => slice.index === appState.selectedTileIndex)
    : tileSliceAt(appState.slices, point)
  appState.selectedTileIndex = hit?.index
  updateSourceHighlight()
  if (hit) requestAnimationFrame(scrollSelectedSource)
  if (appState.tileMode === "move" && hit && isEditing() && appState.archive?.format !== "bda") {
    appState.movingTile = hit
    appState.tileDragOriginal = hit
    appState.moveStart = point
    appState.moveSource = hit.source
    atlasCanvas.setPointerCapture(event.pointerId)
  }
  populateTileInspector()
  drawAtlas()
})
atlasCanvas.addEventListener("pointermove", (event) => {
  if (appState.tileResizeCorner !== undefined && appState.tileDragOriginal) {
    appState.movingTile = resizeTileSlice(appState.tileDragOriginal, appState.tileResizeCorner, atlasPoint(event), workspaceImage.naturalWidth, workspaceImage.naturalHeight)
    scheduleAtlasDraw()
    return
  }
  if (appState.tileDragStart && appState.drawingTile) {
    appState.tileDraft = boundedTileRect(appState.tileDragStart, atlasPoint(event), workspaceImage.naturalWidth, workspaceImage.naturalHeight)
    scheduleAtlasDraw()
    return
  }
  if (!appState.moveStart || !appState.moveSource || !appState.movingTile) return
  const point = atlasPoint(event)
  const source = moveTileRect(appState.moveSource, point.x - appState.moveStart.x, point.y - appState.moveStart.y, workspaceImage.naturalWidth, workspaceImage.naturalHeight)
  const dx = source[0] - appState.moveSource[0]
  const dy = source[1] - appState.moveSource[1]
  appState.movingTile = { ...appState.movingTile, source, ...(appState.tileDragOriginal?.inner ? { inner: moveTileRect(appState.tileDragOriginal.inner, dx, dy, workspaceImage.naturalWidth, workspaceImage.naturalHeight) } : {}) }
  scheduleAtlasDraw()
})
atlasCanvas.addEventListener("pointerup", (event) => {
  if (atlasCanvas.hasPointerCapture(event.pointerId)) atlasCanvas.releasePointerCapture(event.pointerId)
  appState.tileResizeCorner = undefined
  appState.tileDragOriginal = undefined
  if (appState.tileDragStart && appState.drawingTile) {
    appState.tileDraft = boundedTileRect(appState.tileDragStart, atlasPoint(event), workspaceImage.naturalWidth, workspaceImage.naturalHeight)
    const source = appState.tileDraft
    setDrawingTile(false)
    if (source) commitTile({ index: nextTileIndex(appState.tileDocument), source })
    return
  }
  if (appState.movingTile) {
    const moved = appState.movingTile
    appState.movingTile = undefined
    appState.moveStart = undefined
    appState.moveSource = undefined
    commitTile(moved)
  }
})
atlasCanvas.addEventListener("pointercancel", () => {
  appState.tileResizeCorner = undefined
  appState.tileDragOriginal = undefined
  setDrawingTile(false)
  appState.movingTile = undefined
  appState.moveStart = undefined
  appState.moveSource = undefined
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
  if (!appState.archive || appState.archive.format === "bda") return
  if (appState.archive.isText(appState.layoutPath)) return IniDocument.parse(appState.archive.getText(appState.layoutPath))
  const path = currentConfigPath(layout.value)
  return appState.archive.isText(path) ? IniDocument.parse(appState.archive.getText(path)) : appState.layoutDocument
}

function currentStyleDocument(): IniDocument | undefined {
  const path = styleConfigPath()
  return appState.archive?.isText(path) ? IniDocument.parse(appState.archive.getText(path)) : undefined
}

function currentGenDocument(): IniDocument | undefined {
  const path = genConfigPath()
  return appState.archive?.isText(path) ? IniDocument.parse(appState.archive.getText(path)) : undefined
}

function nextResourceBase(): string {
  const root = resourceRootPath()
  let base = `${root}/replace_image`
  let suffix = 2
  while (appState.archive?.names().some((path) => path === `${base}.png` || path === `${base}.til`)) {
    base = `${root}/replace_image${suffix}`
    suffix += 1
  }
  return base
}

function updateLayoutImageForm(): void {
  const hasImage = appState.layoutImageWidth > 0 && appState.layoutImageHeight > 0
  layoutImageSize.textContent = hasImage
    ? `${appState.layoutImageWidth} × ${appState.layoutImageHeight} · 点击可更换`
    : "支持 PNG · 也可以直接拖到画布"
  layoutImagePreview.hidden = !hasImage
  layoutImageFileLabel.hidden = hasImage
  layoutImageFile.classList.toggle("has-image", hasImage)
  layoutImageApply.disabled =
    !appState.archive || appState.archive.format === "bda" || !hasImage || !appState.layoutImageTarget || appState.layoutImageApplying
}

function setLayoutImageHighlight(active: boolean): void {
  if (appState.layoutImageHighlight === active) return
  appState.layoutImageHighlight = active
  canvasWrap.classList.toggle("layout-image-target", active)
}

function openLayoutImageDialog(): void {
  if (!appState.archive || appState.archive.format === "bda") return
  const layout = currentLayoutDocument()
  const styles = currentStyleDocument()
  if (!layout || !styles) return
  const themeLabel = theme.value === "dark" ? "深色" : "浅色"
  const orientationLabel = orientation.value === "land" ? "横屏" : "竖屏"
  layoutImageLayout.textContent = `当前布局：${appState.layoutPath.split("/").pop() ?? "布局"}（${themeLabel} · ${orientationLabel}）`
  layoutImageScope.textContent = appState.selectedKeySections.length
    ? `已选中 ${appState.selectedKeySections.length} 个按键，将只替换这些按键。`
    : "未选中按键，将替换当前布局的全部按键。"
  layoutImageError.hidden = true
  layoutImageError.textContent = ""
  if (!appState.layoutImageTarget) {
    appState.layoutImageTarget = appState.selectedKeySections.length ? "key-normal" : "panel"
    layoutImageTargetInputs.find((input) => input.value === appState.layoutImageTarget)!.checked = true
  }
  syncLayoutImageConfig()
  updateLayoutImageForm()
  layoutImageDialog.showModal()
  // 选择器必须在 showModal 之后触发，否则部分 WebView（含 Tauri）不会弹出系统文件框。
  if (!appState.layoutImageBytes) layoutImageFile.click()
}

function setLayoutImageBytes(bytes: Uint8Array): void {
  if (appState.layoutImageObjectURL) URL.revokeObjectURL(appState.layoutImageObjectURL)
  appState.layoutImageObjectURL = URL.createObjectURL(new Blob([new Uint8Array(bytes).buffer], { type: "image/png" }))
  appState.layoutImageBytes = bytes
  appState.layoutImageWidth = 0
  appState.layoutImageHeight = 0
  layoutImagePreview.src = appState.layoutImageObjectURL
  layoutImageError.hidden = true
  layoutImageError.textContent = ""
  updateLayoutImageForm()
  const image = new Image()
  image.onload = () => {
    appState.layoutImageWidth = image.naturalWidth
    appState.layoutImageHeight = image.naturalHeight
    updateLayoutImageForm()
  }
  image.onerror = () => {
    layoutImageError.textContent = "无法读取该图片，请确认选择的是有效的 PNG 文件。"
    layoutImageError.hidden = false
    updateLayoutImageForm()
  }
  image.src = appState.layoutImageObjectURL
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
  if (appState.layoutImageApplying) return
  appState.layoutImageApplying = true
  layoutImageApply.textContent = "正在应用…"
  updateLayoutImageForm()
  try {
    await runLayoutImageReplace()
  } catch (error) {
    layoutImageError.textContent = `替换失败：${error instanceof Error ? error.message : String(error)}`
    layoutImageError.hidden = false
  } finally {
    appState.layoutImageApplying = false
    layoutImageApply.textContent = "应用替换"
    updateLayoutImageForm()
  }
}

async function runLayoutImageReplace(): Promise<void> {
  const layout = currentLayoutDocument()
  const styles = currentStyleDocument()
  const gen = currentGenDocument()
  if (!appState.archive || !layout || !styles || !gen || !appState.layoutImageBytes || !appState.layoutImageTarget) return
  // 每次都从最初选中的图片开始切片；复用上一次缩放后的字节会逐次降采样。
  let source = appState.layoutImageBytes
  let sourceWidth = appState.layoutImageWidth
  let sourceHeight = appState.layoutImageHeight
  if (appState.layoutImageTarget === "panel" && appState.selectedKeySections.length) {
    layoutImageError.textContent = "键盘背景替换作用于整个布局，请先取消按键选择。"
    layoutImageError.hidden = false
    return
  }
  const panel = resolvePanelConfig(layout, gen, styles)
  const alphaMode = appState.archive.format === "bds" ? 1 : 2
  if (appState.layoutImageTarget === "candidate") {
    const candPath = toolbarConfigPath()
    const cand = candPath && appState.archive.isText(candPath) ? IniDocument.parse(appState.archive.getText(candPath)) : undefined
    if (!candPath || !cand) {
      layoutImageError.textContent = "当前主题未找到候选栏配置文件。"
      layoutImageError.hidden = false
      return
    }
    const candidateRect = resolveCandidateRect(cand, gen)
    if (sourceWidth !== candidateRect.width || sourceHeight !== candidateRect.height) {
      source = await fitPngTo(source, candidateRect.width, candidateRect.height)
    }
    const base = nextResourceBase()
    const plan = planLayoutImage(appState.layoutImageTarget, [], IniDocument.parse(""), candidateRect.width, candidateRect.height)
    const tilesBytes = layoutImageTileBytes(plan, alphaMode)
    const stylesDoc = IniDocument.parse(styles.toString())
    const candDoc = IniDocument.parse(cand.toString())
    applyCandidateImageStyles(stylesDoc, candDoc, plan, base.split("/").pop()!)
    const pngPath = `${base}.png`
    const tilPath = `${base}.til`
    const stylePath = styleConfigPath()
    commitBatch([
      { kind: "bytes", path: pngPath, before: appState.archive.getBytes(pngPath), after: source },
      { kind: "bytes", path: tilPath, before: appState.archive.getBytes(tilPath), after: tilesBytes },
      { kind: "text", path: candPath, before: cand.toString(), after: candDoc.toString() },
      { kind: "text", path: stylePath, before: styles.toString(), after: stylesDoc.toString() },
    ])
    layoutImageDialog.close()
    if (appState.selectedPath === candPath) {
      appState.selectedDocument = candDoc
      setSourceValue(candDoc.toString())
    }
    renderFiles()
    selectFile(candPath)
    refreshPreview()
    updateDirty()
    showStatus(`已应用「${layoutImageTargetLabel(appState.layoutImageTarget)}」替换`)
    return
  }
  const keys = layoutKeyRects(layout, appState.selectedKeySections, [panel.width, panel.height])
  const layoutDoc = IniDocument.parse(layout.toString())
  let plan: LayoutImagePlan
  if (appState.layoutImageConfig === "none" || appState.layoutImageTarget === "panel") {
    // 布局配置仅对按键类目标生效，面板替换始终按整图处理
    if (appState.layoutImageTarget !== "panel") {
      const rectError = validateKeyRects(keys, panel.width, panel.height)
      if (rectError) {
        layoutImageError.textContent = rectError
        layoutImageError.hidden = false
        return
      }
    }
    if (sourceWidth !== panel.width || sourceHeight !== panel.height) {
      source = await fitPngTo(source, panel.width, panel.height)
      sourceWidth = panel.width
      sourceHeight = panel.height
    }
    plan = planLayoutImage(appState.layoutImageTarget, keys, IniDocument.parse(""), panel.width, panel.height)
  } else {
    // 图片跟随布局 / 布局跟随图片：按图片空白检测按键网格，切片源取自图片
    const scan = await decodePngMask(source)
    let cells = detectGridCells(scan.mask, scan.width, scan.height)
    if (!cells.length) {
      layoutImageError.textContent = "无法在图片中识别按键区域，请检查图片是否包含透明间隔。"
      layoutImageError.hidden = false
      return
    }
    if (appState.layoutImageConfig === "image-follows-layout" && cells.length === 1 && keys.length) {
      const maxWidth = Math.max(...keys.map(({ rect }) => rect[2]))
      const maxHeight = Math.max(...keys.map(({ rect }) => rect[3]))
      const scale = Math.min(1, maxWidth / scan.width, maxHeight / scan.height)
      if (scale < 1) {
        const width = Math.max(1, Math.round(scan.width * scale))
        const height = Math.max(1, Math.round(scan.height * scale))
        source = await fitPngTo(source, width, height)
        sourceWidth = width
        sourceHeight = height
        cells = cells.map(([x, y, cellWidth, cellHeight]) => [
          Math.round(x * scale),
          Math.round(y * scale),
          Math.max(1, Math.round(cellWidth * scale)),
          Math.max(1, Math.round(cellHeight * scale)),
        ])
      }
    }
    const matchedKeys = appState.layoutImageConfig === "layout-follows-image"
      ? matchLayoutKeysToCells(layoutDoc, keys, cells)
      : keys
    plan = planLayoutImageSlices(appState.layoutImageTarget, matchedKeys, cells, IniDocument.parse(""))
    sourceWidth = scan.width
    sourceHeight = scan.height
  }
  const base = nextResourceBase()
  const tilesBytes = layoutImageTileBytes(plan, alphaMode)
  const stylesDoc = IniDocument.parse(styles.toString())
  if (appState.layoutImageConfig === "layout-follows-image" && appState.layoutImageTarget !== "panel") {
    // 布局跟随图片：把按键矩形与面板尺寸改写为图片网格
    applyLayoutImageRects(layoutDoc, plan.keys, plan.slices.map((slice) => slice.source), sourceWidth, sourceHeight)
  }
  applyLayoutImageStyles(appState.layoutImageTarget, layoutDoc, stylesDoc, plan, base.split("/").pop()!)
  normalizeKeySections(layoutDoc)
  const pngPath = `${base}.png`
  const tilPath = `${base}.til`
  const targetPath = appState.layoutPath
  const stylePath = styleConfigPath()
  commitBatch([
    { kind: "bytes", path: pngPath, before: appState.archive.getBytes(pngPath), after: source },
    { kind: "bytes", path: tilPath, before: appState.archive.getBytes(tilPath), after: tilesBytes },
    { kind: "text", path: targetPath, before: layout.toString(), after: layoutDoc.toString() },
    { kind: "text", path: stylePath, before: styles.toString(), after: stylesDoc.toString() },
  ])
  appState.layoutDocument = layoutDoc
  layoutImageDialog.close()
  if (appState.selectedPath === targetPath) {
    appState.selectedDocument = layoutDoc
    setSourceValue(layoutDoc.toString())
  }
  renderFiles()
  selectFile(targetPath)
  refreshPreview()
  populateKeyInspector()
  updateDirty()
  showStatus(`已应用「${layoutImageTargetLabel(appState.layoutImageTarget)}」替换`)
}

replaceLayoutImageButton.addEventListener("click", openLayoutImageDialog)
layoutImageFile.addEventListener("click", () => layoutImageOpen.click())
function acceptLayoutImageFile(file: File | undefined): boolean {
  if (!file) return false
  if (!/\.png$/i.test(file.name) && file.type !== "image/png") {
    layoutImageError.textContent = "只支持 PNG 图片。"
    layoutImageError.hidden = false
    return false
  }
  const reader = new FileReader()
  reader.onload = () => setLayoutImageBytes(new Uint8Array(reader.result as ArrayBuffer))
  reader.readAsArrayBuffer(file)
  return true
}
layoutImageOpen.addEventListener("change", () => {
  acceptLayoutImageFile(layoutImageOpen.files?.[0])
  layoutImageOpen.value = ""
})
layoutImageFile.addEventListener("dragenter", (event) => {
  if (!event.dataTransfer?.types.includes("Files")) return
  event.preventDefault()
  appState.layoutImageDragDepth += 1
  layoutImageFile.classList.add("drop-target")
})
layoutImageFile.addEventListener("dragover", (event) => {
  if (!event.dataTransfer?.types.includes("Files")) return
  event.preventDefault()
  event.dataTransfer.dropEffect = "copy"
})
layoutImageFile.addEventListener("dragleave", () => {
  appState.layoutImageDragDepth = Math.max(0, appState.layoutImageDragDepth - 1)
  if (!appState.layoutImageDragDepth) layoutImageFile.classList.remove("drop-target")
})
layoutImageFile.addEventListener("drop", (event) => {
  if (!event.dataTransfer?.types.includes("Files")) return
  event.preventDefault()
  appState.layoutImageDragDepth = 0
  layoutImageFile.classList.remove("drop-target")
  acceptLayoutImageFile(event.dataTransfer.files[0])
})
layoutImageDialog.addEventListener("dragover", (event) => {
  if (event.dataTransfer?.types.includes("Files")) event.preventDefault()
})
layoutImageDialog.addEventListener("drop", (event) => {
  if (event.dataTransfer?.types.includes("Files")) event.preventDefault()
})
for (const input of layoutImageTargetInputs) {
  input.addEventListener("change", () => {
    appState.layoutImageTarget = input.value as LayoutImageTarget
    layoutImageScope.textContent = appState.layoutImageTarget === "panel"
      ? "替换当前布局的完整背景。"
      : appState.layoutImageTarget === "candidate"
        ? "替换当前主题候选栏的背景图片。"
        : appState.selectedKeySections.length
        ? `已选中 ${appState.selectedKeySections.length} 个按键，将只替换这些按键。`
        : "未选中按键，将替换当前布局的全部按键。"
    layoutImageError.hidden = true
    layoutImageError.textContent = ""
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
    button.classList.toggle("active", button.dataset.layoutImageConfig === appState.layoutImageConfig)
  }
  layoutImageConfigDesc.textContent = layoutImageConfigDescriptions[appState.layoutImageConfig]
  layoutImageConfigFieldset.disabled = appState.layoutImageTarget === "panel" || appState.layoutImageTarget === "candidate"
}
for (const button of layoutImageConfigButtons) {
  button.addEventListener("click", () => {
    if (layoutImageConfigFieldset.disabled) return
    const value = button.dataset.layoutImageConfig as LayoutImageConfig
    if (value === appState.layoutImageConfig) return
    appState.layoutImageConfig = value
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
  const selected = appState.selectedCandidate && appState.archive?.format === "bda" && appState.selectedPath === appState.layoutPath
    || appState.archive?.format !== "bda" && isToolbarPath(appState.selectedPath) && !appState.selectedToolbarSections.length
  candidateArea.classList.toggle("candidate-selected", selected)
  candidateArea.setAttribute("aria-selected", String(selected))
}

candidateArea.addEventListener("click", (event) => {
  if (!isEditing()) return
  if (event.target === toolbarCanvas && appState.selectedToolbarSections.length) return
  if (appState.archive?.format === "bda") {
    if (appState.selectedPath !== appState.layoutPath) selectFile(appState.layoutPath, "overview")
    appState.selectedCandidate = true
    appState.selectedKeySections = []
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
bindSlicePickerZoom(styleImagePicker, styleImagePickerCanvas, (factor) => {
  appState.pickerZoom = Math.min(MAX_SLICE_ZOOM, Math.max(MIN_SLICE_ZOOM, appState.pickerZoom * factor))
  drawImageSlicePicker()
})
styleImagePickerCanvas.addEventListener("click", (event) => {
  if (!isEditing()) return
  if (!appState.pickerImage || !appState.pickerTarget) return
  const bounds = styleImagePickerCanvas.getBoundingClientRect()
  const point = {
    x: ((event.clientX - bounds.left) / bounds.width) * styleImagePickerCanvas.width,
    y: ((event.clientY - bounds.top) / bounds.height) * styleImagePickerCanvas.height,
  }
  const imagePoint = { x: (point.x - appState.pickerOffset.x) / appState.pickerScale, y: (point.y - appState.pickerOffset.y) / appState.pickerScale }
  const selected = tileSliceAt(pickableSlices(appState.pickerSlices, appState.pickerImage), imagePoint)
  if (!selected) return
  appState.pickerSelectedIndex = selected.index
  updateSelectedImageReference(appState.pickerTarget, pickerImageReference(selected.index))
  drawImageSlicePicker()
})
styleImageClose.addEventListener("click", clearImageSlicePicker)
styleImageSource.addEventListener("click", () => openSourceStyleDefinition())
styleImageDialog.addEventListener("cancel", (event) => {
  event.preventDefault()
  clearImageSlicePicker()
})
styleImageDialog.addEventListener("click", (event) => {
  if (event.target === styleImageDialog) clearImageSlicePicker()
})
styleImageResourceOpen.addEventListener("click", openStyleImageResourcePicker)
styleImageResourceClose.addEventListener("click", () => {
  if (appState.pickerTarget) closeStyleImageResourcePicker()
  else clearImageSlicePicker()
})
styleImageResourceSearch.addEventListener("input", renderStyleImageResources)

if (isTauri()) {
  void listen("new-project-ready", () => {
    appState.nativeProjectWindowReady = true
    window.clearTimeout(appState.nativeProjectReadyTimer)
    appState.nativeProjectReadyTimer = undefined
    void WebviewWindow.getByLabel("new-project").then((window) => window?.setFocus())
  })
  void listen<ProjectChoice>("new-project-select", (event) => {
    appState.newProjectOptions = event.payload
    finishNativeProjectChoice(event.payload.templateID)
  })
  void listen("new-project-cancel", () => finishNativeProjectChoice())
  void listen("picker-window-ready", () => {
    if (appState.pickerRequestedView === "list") void emitTo("image-picker", "image-picker-show-list")
    else if (appState.pickerRequestedView === "styles") void emitStyleLibrary()
    else if (appState.nativeImagePickerPayload) void emitTo("image-picker", "image-picker-data", appState.nativeImagePickerPayload)
  })
  void listen<{ index: number }>("image-picker-select", (event) => {
    if (!isEditing() || !appState.pickerTarget) return
    const { index } = event.payload
    if (index === WHOLE_IMAGE_INDEX ? appState.pickerSlices.length : !appState.pickerSlices.some((slice) => slice.index === index)) return
    appState.pickerSelectedIndex = index
    updateSelectedImageReference(appState.pickerTarget, pickerImageReference(index))
  })
  // 切片窗口返回「全部样式」：留在同一个窗口里切视图。
  void listen("image-picker-back-styles", () => void emitStyleLibrary(true))
  void listen<{ styleID?: string; imagePath?: string }>("style-library-apply", (event) => {
    appState.styleLibrarySelected = event.payload
    applyStyleLibrarySelection()
  })
  void listen<{ styleID?: string; imagePath?: string }>("style-library-edit", (event) => {
    appState.styleLibrarySelected = event.payload
    editStyleLibrarySelection()
  })
  void listen("style-library-add", addStyleFromLibrary)
  void listen<{ filename: string }>("style-library-play", (event) => {
    const path = soundPathForFilename(appState.archive?.names() ?? [], theme.value, orientation.value, event.payload.filename)
    if (path) playSoundPath(path)
  })
  void listen("image-picker-resources-request", () => {
    void emitTo("image-picker", "image-picker-resources-data", resourcePickerPayload())
  })
  void listen<{ path: string }>("resource-picker-select", (event) => {
    selectImageResource(event.payload.path)
  })
}

// 左栏与检查器共用的拖动调宽：direction 为 1 时向右拖变宽，-1 时向左拖变宽。
function bindPaneResize(handle: HTMLElement, cssVar: string, storageKey: string, minW: number, maxW: number, defaultW: number, direction: 1 | -1): void {
  const stored = Number(localStorage.getItem(storageKey) || defaultW)
  const initialW = Math.max(minW, Math.min(maxW, stored))
  document.documentElement.style.setProperty(cssVar, `${initialW}px`)
  const currentW = () => parseInt(getComputedStyle(document.documentElement).getPropertyValue(cssVar) || String(defaultW), 10)

  let dragging = false
  let startX = 0
  let startW = initialW

  handle.addEventListener("pointerdown", (e) => {
    dragging = true
    startX = e.clientX
    startW = currentW()
    handle.classList.add("dragging")
    handle.setPointerCapture(e.pointerId)
    e.preventDefault()
  })

  handle.addEventListener("pointermove", (e) => {
    if (!dragging) return
    const newW = Math.max(minW, Math.min(maxW, startW + (e.clientX - startX) * direction))
    document.documentElement.style.setProperty(cssVar, `${newW}px`)
  })

  handle.addEventListener("pointerup", () => {
    if (!dragging) return
    dragging = false
    handle.classList.remove("dragging")
    localStorage.setItem(storageKey, String(currentW()))
  })
}

bindPaneResize($("#sidebar-resize-handle"), "--sidebar-width", "sidebarWidthV2", 180, 420, 248, 1)
bindPaneResize(inspectorResizeHandle, "--inspector-width", "inspectorWidthV5", 220, Math.max(700, window.innerWidth - 720), 360, -1)

function nextStyleID(): string {
  const ids = availableStyleIDs().map(Number).filter(Number.isSafeInteger)
  return String((ids.length ? Math.max(...ids) : -1) + 1)
}

function showNewStyleError(text: string): void {
  newStyleError.textContent = text
  newStyleError.hidden = !text
}

styleAddButton.addEventListener("click", () => {
  if (!appState.archive?.isText(styleConfigPath()) || !isEditing()) return
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
  if (!appState.archive?.isText(path)) return
  const stylesDocument = IniDocument.parse(appState.archive.getText(path))
  const before = stylesDocument.toString()
  stylesDocument.appendSection(`STYLE${styleID}`, [])
  const currentMax = Number(stylesDocument.get("GLOBAL", "STYLE_NUM") ?? -1)
  const numericID = Number(styleID)
  if (!Number.isFinite(currentMax) || numericID > currentMax) stylesDocument.set("GLOBAL", "STYLE_NUM", styleID)
  commitText(path, before, stylesDocument.toString())
  setSourceValue(stylesDocument.toString())
  const applyTarget = appState.newStyleApplyTarget
  newStyleDialog.close()
  // 检查器缩略图传入的是行内克隆输入框（未挂载），只看是否可编辑。
  if (applyTarget && !applyTarget.disabled) {
    applyTarget.value = styleID
    applyTarget.dispatchEvent(new Event("input", { bubbles: true }))
    applyTarget.dispatchEvent(new Event("change", { bubbles: true }))
    openStyleReferenceEditor(styleID)
    refreshPreview()
    updateDirty()
    return
  }
  appState.selectedResourceGalleryPath = `STYLE${styleID}`
  selectStyleResource(styleID)
  refreshPreview()
  updateDirty()
})

appState.atlasWorkspace = createAtlasWorkspace({
  back: () => selectFile(appState.layoutPath || currentConfigPath(layout.value)),
  autoSlice: () => { void autoSliceSelectedImage() },
  guides: () => setGuidesVisible(!appState.guidesVisible),
  redraw: () => drawAtlas(),
  stretch: enabled => {
    const slice = appState.slices.find(item => item.index === appState.selectedTileIndex)
    if (!slice || !isEditing() || appState.archive?.format === "bda") return
    const [x, y, width, height] = slice.source
    const left = Math.floor(width / 4), top = Math.floor(height / 4)
    commitTile({ index: slice.index, source: slice.source, ...(enabled ? { inner: [x + left, y + top, width - left * 2, height - top * 2] as TileRect } : {}) })
  },
  copy: () => {
    if (!appState.archive || !appState.selectedResourcePath || !isEditing()) return
    const base = appState.selectedResourcePath.replace(/\.png$/i, "")
    let target = `${base}_copy`
    for (let index = 2; appState.archive.getBytes(`${target}.png`) || appState.archive.getBytes(`${target}.til`); index++) target = `${base}_copy${index}`
    const changes: Change[] = ["png", "til"].flatMap(extension => {
      const bytes = appState.archive!.getBytes(`${base}.${extension}`)
      return bytes ? [{ kind: "bytes" as const, path: `${target}.${extension}`, after: bytes.slice() }] : []
    })
    commitBatch(changes)
    renderResourceInspector()
    selectResourceImage(`${target}.png`)
    updateDirty()
  },
  create: (name, width, height) => {
    if (!appState.archive || !isEditing()) return
    if (!/^[^\\/:*?"<>|]+\.png$/i.test(name) || name.startsWith(".")) { showStatus("请输入有效的 PNG 文件名"); return }
    const size = [width, height]
    if (size.length !== 2 || size.some(n => !Number.isInteger(n) || n < 1 || n > 8192)) { showStatus("图片宽高必须是 1 至 8192 的整数"); return }
    const base = appState.selectedResourcePath.substring(0, appState.selectedResourcePath.lastIndexOf("/")) || resourceRootPath()
    const path = `${base}/${name}`
    if (appState.archive.getBytes(path)) { showStatus("同名图片已存在"); return }
    const targetArchive = appState.archive
    const canvas = document.createElement("canvas")
    canvas.width = size[0]; canvas.height = size[1]
    canvas.toBlob(blob => {
      if (!blob) return
      void runFileOperation("新建图片", async () => {
        const bytes = new Uint8Array(await blob.arrayBuffer())
        if (appState.archive !== targetArchive || !isEditing()) return false
        commitBatch([{ kind: "bytes", path, after: bytes }])
        renderResourceInspector()
        selectResourceImage(path)
        updateDirty()
        return true
      })
    }, "image/png")
  },
  import: files => {
    if (!appState.archive || !isEditing() || !files.length) return
    const targetArchive = appState.archive
    const base = appState.selectedResourcePath.substring(0, appState.selectedResourcePath.lastIndexOf("/")) || resourceRootPath()
    void runFileOperation("导入图片目录", async () => {
      const changes: Array<Extract<Change, { kind: "bytes" }>> = []
      const paths = new Set<string>()
      for (const file of files) {
        const relative = file.webkitRelativePath.split("/").slice(1).join("/") || file.name
        if (relative.split("/").some(part => part === ".." || !part)) throw new Error("无效的资源路径")
        const path = `${base}/${relative}`
        if (paths.has(path)) throw new Error(`目录中存在重名资源：${relative}`)
        paths.add(path)
        const bytes = new Uint8Array(await file.arrayBuffer())
        if (/\.png$/i.test(file.name)) {
          const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }))
          bitmap.close()
        }
        changes.push({ kind: "bytes", path, before: targetArchive.getBytes(path)?.slice(), after: bytes })
      }
      if (appState.archive !== targetArchive || !isEditing()) return false
      if (changes.some(change => change.kind === "bytes" && change.before) && !window.confirm("目录包含已有资源，是否替换？")) return false
      commitBatch(changes)
      renderResourceInspector()
      const image = changes.find(change => /\.png$/i.test(change.path))
      if (image) selectResourceImage(image.path)
      updateDirty()
      return true
    })
  },
})

function updateResourceActionButtons(): void {
  const imageSelected = appState.resourceInspectorMode === "image" && Boolean(appState.selectedResourceGalleryPath)
  const soundSelected = appState.resourceInspectorMode === "sound"
    && Boolean(currentSoundEntries().find((entry) => entry.id === appState.selectedSoundID)?.path)
  resourceDownloadButton.disabled = !imageSelected && !soundSelected
  resourceDeleteButton.disabled = !imageSelected || !isEditing()
  resourceUploadButton.disabled = !isEditing()
  syncAtlasWorkspace()
}

function selectGalleryItem(path: string, container: HTMLElement): void {
  appState.selectedResourceGalleryPath = path
  for (const item of container.querySelectorAll<HTMLElement>(".resource-item")) {
    item.classList.toggle("selected", item.dataset.path === path)
  }
  updateResourceActionButtons()
}

resourceUploadButton.addEventListener("click", () => {
  if (!appState.archive || !isEditing()) return
  resourceUploadInput.value = ""
  resourceUploadInput.click()
})

async function uploadKeySound(file: File): Promise<boolean> {
  if (!appState.archive || !isSoundPath(file.name)) throw new Error("按键音效仅支持 OGG、WAV 或 AIFF 文件")
  if (!isEditing()) return false
  const targetArchive = appState.archive
  const filename = file.name.split(/[\\/]/).pop() ?? file.name
  const entries = currentSoundEntries()
  const selected = entries.find((entry) => entry.id === appState.selectedSoundID)
  const base = selected?.path.split("/").slice(0, -1).join("/")
    ?? soundResourcePaths(appState.archive.names(), theme.value, orientation.value)[0]?.split("/").slice(0, -1).join("/")
    ?? `${theme.value}/skin/res`
  const targetPath = `${base}/${filename}`
  const beforeResource = appState.archive.getBytes(targetPath)?.slice()
  if (beforeResource && targetPath !== selected?.path && !window.confirm(`音效 ${filename} 已存在，是否替换？`)) return false
  const resourceBytes = new Uint8Array(await file.arrayBuffer())
  if (appState.archive !== targetArchive || !isEditing()) return false
  keySoundBuffers.delete(targetPath)
  releaseKeySound()
  commitBytes(targetPath, beforeResource, resourceBytes)
  appState.selectedSoundID = `file:${targetPath}`
  renderResourceInspector()
  updateDirty()
  showStatus(`按键音效文件已更新：${filename}`)
  return true
}

resourceUploadInput.addEventListener("change", () => {
  const file = resourceUploadInput.files?.[0]
  if (!file || !appState.archive || !isEditing()) return
  if (appState.resourceInspectorMode === "sound") {
    void runFileOperation("上传按键音效", () => uploadKeySound(file))
    return
  }
  const targetArchive = appState.archive
  void runFileOperation("上传图片", async () => {
    const bytes = new Uint8Array(await file.arrayBuffer())
    const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }))
    bitmap.close()
    if (appState.archive !== targetArchive || !isEditing()) return false
    const paths = resourceImagePaths(appState.archive.names(), theme.value, orientation.value)
    const base = paths[0]?.split("/").slice(0, -1).join("/") ?? `${theme.value}/skin/${orientation.value}/res`
    const targetPath = `${base}/${file.name}`
    const before = appState.archive.getBytes(targetPath)
    if (before) {
      if (!window.confirm(`图片 ${file.name} 已存在，是否替换？`)) return false
    }
    commitBatch([{ kind: "bytes", path: targetPath, before: before?.slice(), after: bytes }])
    renderResourceInspector()
    updateDirty()
    selectResourceImage(targetPath)
    return true
  })
})

resourceDownloadButton.addEventListener("click", () => {
  void runFileOperation(appState.resourceInspectorMode === "sound" ? "下载按键音效" : "下载图片", async () => {
    if (appState.resourceInspectorMode === "sound") {
      const entry = currentSoundEntries().find((item) => item.id === appState.selectedSoundID)
      const bytes = entry?.path ? appState.archive?.getBytes(entry.path) : undefined
      if (!entry?.path || !bytes) return false
      return Boolean(await writeToChosenFile(entry.filename, bytes))
    }
    if (!appState.archive || !appState.selectedResourceGalleryPath) return false
    const bytes = appState.archive.getBytes(appState.selectedResourceGalleryPath)
    if (!bytes) return false
    return Boolean(await writeToChosenFile(
      appState.selectedResourceGalleryPath.split("/").pop() ?? "image.png",
      bytes,
    ))
  })
})

resourceDeleteButton.addEventListener("click", () => {
  if (!appState.archive || !appState.selectedResourceGalleryPath || !isEditing()) return
  const name = appState.selectedResourceGalleryPath.split("/").pop() ?? appState.selectedResourceGalleryPath
  if (!window.confirm(`确定要删除图片 ${name} 吗？此操作可撤销。`)) return
  const before = appState.archive.getBytes(appState.selectedResourceGalleryPath)
  if (!before) return
  commitBatch([{ kind: "bytes", path: appState.selectedResourceGalleryPath, before }])
  if (appState.selectedResourcePath === appState.selectedResourceGalleryPath) {
    appState.selectedResourcePath = ""
    appState.slices = []
    appState.selectedTileIndex = undefined
    resourceDetail.hidden = true
    hideImageWorkspace()
  }
  appState.selectedResourceGalleryPath = ""
  updateResourceActionButtons()
  renderResourceInspector()
  updateDirty()
})

device.addEventListener("change", () => {
  const background = canvasBackgroundFromDevice(device.value)
  if (background) applyCanvasBackground(background)
  syncDeviceControlIcon()
  syncAiDesignContext()
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
    if (appState.resourceConfigActive && !isTextEditingTarget(event.target)) {
      if (appState.selectedTileIndex === undefined || !isEditing()) return
      event.preventDefault()
      const distance = event.shiftKey ? 10 : 1
      moveSelectedTile(direction[0] * distance, direction[1] * distance, event.repeat)
      return
    }
    if (!isEditing() || !appState.selectedKeySections.length || isTextEditingTarget(event.target)) return
    event.preventDefault()
    const distance = event.shiftKey ? 10 : 1
    moveSelectedKeys(direction[0] * distance, direction[1] * distance, appState.selectedKeySections, event.repeat)
    return
  }
  if (appState.resourceConfigActive && !isTextEditingTarget(event.target)) {
    if ((event.key === "Delete" || event.key === "Backspace") && isEditing()) {
      event.preventDefault()
      deleteSelectedTile()
      return
    }
    if (event.metaKey || event.ctrlKey) {
      if (event.key.toLowerCase() === "c") {
        const existing = appState.slices.find((slice) => slice.index === appState.selectedTileIndex)
        if (existing) {
          appState.copiedTile = duplicateTileSlice(existing, existing.index)
          event.preventDefault()
        }
        return
      }
      if (event.key.toLowerCase() === "v" && appState.copiedTile && isEditing()) {
        event.preventDefault()
        const index = nextTileIndex(appState.tileDocument)
        commitTile({ ...appState.copiedTile, index })
        appState.selectedTileIndex = index
        populateTileInspector()
        drawAtlas()
        return
      }
    }
  }
  if (
    (event.key === "Delete" || event.key === "Backspace") &&
    isEditing() &&
    appState.selectedKeySections.length &&
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
    clearTimeout(appState.fitCanvasDebounce)
    movingDebounce = setTimeout(() => { fitCanvasPreview() }, 300)
  })
  // 窗口获得焦点时重新同步材质状态，修复 Windows 10 亚克力材质导致的窗口移动卡顿问题
  void getCurrentWindow().onFocusChanged(({ payload: focused }) => {
    if (focused && windowMaterial.checked && !appState.windowDragPointerDown && !appState.windowDragMaterialDisabled) {
      void applyWindowMaterialWithRetry().catch((error) => handleWindowMaterialError(error, "恢复窗口材质"))
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
        if (folder !== undefined && appState.archive && isEditing()) {
          await runFileOperation("上传文件", async () => commitSourceUploads(
            await Promise.all(payload.paths.map(async (path) => ({
              name: path,
              bytes: new Uint8Array(await invoke<ArrayBuffer>("read_file", { path })),
            }))),
            folder,
          ))
          return
        }
        const pngPath = payload.paths.find((path) => /\.png$/i.test(path))
        if (pngPath) {
          if (!appState.archive || appState.archive.format === "bda") return
          const bytes = new Uint8Array(await invoke<ArrayBuffer>("read_file", { path: pngPath }))
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

// 初始化性能优化

mode.value = "preview"
applyModeState()
syncLayoutImageConfig()
syncDeviceControlIcon()
updateDevicePreview()
updateSourceHighlight()
updateInspectorView()
void refreshUpdateStatus()

// 检查器外壳：搜索 / 状态作用域 / 常驻动作条 / 分区折叠
initInspectorShell()

const settingsController = initializeSettings(settingsDialog, setGuidesVisible, modelSettings)
