import { invoke } from "@tauri-apps/api/core"
import { emitTo, listen } from "@tauri-apps/api/event"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { WebviewWindow } from "@tauri-apps/api/webviewWindow"
import { getCurrentWebview } from "@tauri-apps/api/webview"
import { open } from "@tauri-apps/plugin-dialog"
import "./tokens.css"
import "./components.css"
import "./style.css"
import "./device-preview.css"
import "./inspector.css"
import { type ProjectChoice } from "./project-chooser"
import { hydrateTemplateCardPreviews, releaseArchivePreview } from "./template-preview"
import { initInspectorShell } from "./inspector-shell.ts"
import { hydrateIcons } from "./icons"
import "./style-library.css"
import "./design-workbench.css"
import "./ai-design-panel.css"
import "./project-chooser.css"
import { createAtlasWorkspace } from "./atlas-workspace"
import { resizeTileSlice } from "./tiles"
import { actionDescription, knownFunctionCodes } from "./actions.ts"
import { canvasBackgroundFromDevice, canvasDeviceValue, type CanvasBackground } from "./canvas-background.ts"
import { type ExportFormat } from "./export.ts"
import { type BdaAppearanceStyleGroup } from "./bda.ts"
import { type BdaPlatform } from "./bda-platform.ts"
import { IniDocument } from "./ini.ts"
import type { Change } from "./history.ts"
import { type LayoutImageTarget } from "./layout-image.ts"
import { mixedCoordinateDelta, shouldClearMixedInput } from "./mixed-input.ts"
import { installNumberInputWheel } from "./number-input-wheel.ts"
import { resourceImagePaths } from "./resources.ts"
import type { SourceEditorCursorMove, SourceEditorValueClick } from "./lazy-source-editor.ts"
import { replacedSourceStyle } from "./source-value-ranges.ts"
import { soundPathForFilename } from "./sounds.ts"
import { boundedTileRect, duplicateTileSlice, moveTileRect, nextTileIndex, tileSliceAt, tileSlices, type TileRect } from "./tiles.ts"
import { clientLog, clientLogZip, installClientLogging } from "./client-log.ts"
import { installSafeAreaLock } from "./safe-area.ts"
import { bindSlicePickerZoom, MAX_SLICE_ZOOM, MIN_SLICE_ZOOM, pickableSlices, WHOLE_IMAGE_INDEX } from "./slice-picker-canvas.ts"
import { isTauri, scrollbarIdleTimers, source, schedulePointerCoordinates, mobileShareLabel, mobileShareMenuLabel, mobileCommandButtons, mobileCommandTarget, syncMobileCommands, mobilePortraitQuery, preview, toolbarPreview, keyboardFields, scheduleSelectionInspectorSync, exportButtons, settingsNavItems, isAndroidTauri, LAST_SOURCE_WORKSPACE_KEY, currentDeviceValue, layoutActionButtons, inspectorTabButtons, activateSkinState, playSoundPath, syncDeviceControlIcon, clearSimulatedOutput } from "./app/canvas-interaction"
import { moveSelectedKeys, applyExactGap, moveMixedCoordinate, applyLayoutAction, copySelectedKeys, deleteSelectedKeys, isTextEditingTarget } from "./app/key-editing"
import { renderSourceValueThumbnail, updateSourceFindVisibility, scheduleSourceInputHighlight, applySourceColorPicker, selectKeyFromSourceOffset, openSourceColorPicker, openSourceStyleDefinition, openSourceStylePicker, scheduleSourceSearch, closeSourceFind, findSourceMatch, openSourceFind, syncSourceFindBarOffset, replaceSourceMatches, updateInspectorView, updateSourceHighlight } from "./app/source-panel"
import { syncSinglePageInspectorGroup, setMobileSplit, setMobilePane, syncMobileInspectorHeader, setMobilePreviewCollapsed, syncSegmentedControls, applyModeState, selectChoice, setMobileInspectorGroup, bindPaneResize } from "./app/mobile-layout"
import { measureCanvasWrapInnerSize, scheduleFitCanvasPreview, applyPreviewZoom, setPreviewPan, finishPreviewPan, schedulePreviewPan, updateDevicePreview, refreshPreview, syncCandidateSelection, setGuidesVisible, refreshSimulationPreview, fitCanvasPreview } from "./app/preview-render"
import { isEditing, commitBatch, prepareDocumentReplacement, undo, redo, commitBytes, updateDirty, commitText, hasUnsavedChanges } from "./app/edit-history"
import { chooseStyleImageSlice, clearImagePreviewError, showImagePreviewError, selectStyleResource, showResourceList, renderResourceInspector, selectResourceImage, uploadKeySound, currentSoundEntries, hideImageWorkspace, updateResourceActionButtons } from "./app/resource-inspector"
import { applyStyleLibrarySelection, editStyleLibrarySelection, renderStylePicker, addStyleFromLibrary, emitStyleLibrary, nextStyleID, showNewStyleError, availableStyleIDs } from "./app/style-picker"
import { decorateStyleReferenceInput, openStyleReferenceEditor } from "./app/style-references"
import { renameDocumentTitle, syncActionCodeSuggestions, updateSelectedKey, updateSelectedStyle, updateKeyboard, updateToolbar, updateSkinInfo, populateKeyInspector } from "./app/key-inspector"
import { runFileOperation, readBrowserSkinFile, showImage, openPanelCopyDialog, adaptArchiveForIos26, updatePanelCopyForm, copyPanel, showStatus, showError } from "./app/file-operations"
import { sourceTargetFolder, commitSourceUploads, sourceSelection, setSourceTransfer, sourceCopyPath, refreshAfterSourceMutation, sourcePaths, setSidebarView, revealSourceFile, setSourceDropTarget, sourceDropFolder } from "./app/source-files"
import { writeToChosenFile, openNative, saveArchive, currentExportFormat, shareArchiveToMobile, isSupportedSkinPath, loadArchive, loadDroppedFile, loadDroppedPath, loadDroppedSourceWorkspace, loadNativePath, restoreLastSourceWorkspace } from "./app/archive-io"
import { startNewDocument, newDocument, finishNativeProjectChoice } from "./app/new-document"
import { recentFilesKey, recentPreviewCache, recentThumbRequest, renderRecentFiles } from "./app/recent-files"
import { refreshUpdateStatus, settingsController, showSettingsPage, nativeSettings, savedDefaultDevice, applyCanvasBackground, initialCanvasBackground, applyEditorCrosshairSetting, applyAppTheme, systemTheme, savedSourceFontSize, applySourceFontSize, saveSourceFontSize, initializeWindowMaterial, handleWindowMaterialError, applyWindowMaterialWithRetry, currentWindowMaterialOpacity, applyWindowMaterialOpacity, startWindowsWindowDrag, restoreWindowMaterialAfterDrag, applySidebarViewVisibility, applyInspectorTabsVisibility, applySourceEditorFeatures, setCanvasDropState, sourceDirectoryInitialization } from "./app/preferences"
import { syncAiDesignControls, applyAiDesignDraft, discardAiDesignDraft, ensureAiChat, aiDesignErrorMessage, syncAiDesignContext } from "./app/ai-panel"
import { activateSourceWorkspace, chooseAndroidSourceDirectory, applySourceDirectory } from "./app/source-workspace"
import { setLayoutImageHighlight, setLayoutImageBytes, openLayoutImageDialog, acceptLayoutImageFile, syncLayoutImageConfig, updateLayoutImageForm, applyLayoutImage, resourceRootPath } from "./app/layout-image-replace"
import { selectFile } from "./app/navigation"
import { isBdaAppearancePartPath, commitBdaSourceEdit, preferredPath, createMissingVariant, bdaAvailableLayoutPaths, bdaAppearanceStyleGroups, bdaAppearanceStylePath } from "./app/bda-documents"
import { populateTileInspector, drawAtlas, setDrawingTile, duplicateSelectedTile, deleteSelectedTile, atlasPoint, scheduleAtlasDraw, commitTile, updateSelectedTile, autoSliceSelectedImage, moveSelectedTile } from "./app/tile-editing"
import { syncColorControl, writeColorControl, scrollSelectedSource, styleConfigPath, setSourceValue, currentConfigPath } from "./app/config-context"
import { renderFiles } from "./app/file-tree"
import { drawImageSlicePicker, updateSelectedImageReference, pickerImageReference, clearImageSlicePicker, openStyleImageResourcePicker, closeStyleImageResourcePicker, renderStyleImageResources, resourcePickerPayload, selectImageResource } from "./app/image-pickers"
import { appState } from "./app/state"
import { type LayoutImageConfig, type StyleKind } from "./app/types"
import { mobileCommandMenu, settingsDialog, $, sidebarProjectName, documentName, aiDesignThinking, device, resourceSearch, editorCrosshair, previewCoordinates, canvasWrap, previewCanvas, toolbarCanvas, editorCoordinateSnap, previewCoordinateX, previewCoordinateY, deviceShell, toolbarStrip, skinState, eventLog, theme, orientation, simulatedOutput, mobileShareButton, mobileUndoButton, undoButton, mobileRedoButton, redoButton, desktopUndoButton, desktopRedoButton, mode, modeChoiceButtons, themeChoiceButtons, orientationChoiceButtons, mobileChoiceButtons, quickInspector, mobileInspectorGroups, bdaConfigFieldsGroup, inspectorBackButton, bdaInspectorStateButtons, mobilePaneButtons, mobileSplitHandle, files, mainWorkspace, mobilePreviewPosition, panelScaleButton, replaceLayoutImageButton, adaptIos26Button, replaceAssetButton, keyFields, styleFields, toolbarFields, skinFields, gapFields, layout, candidateArea, hintPreviewEnabled, previewZoomOut, previewZoomIn, previewZoomFit, previewPanelViewport, panelCopySource, panelTargetWidth, panelTargetHeight, panelScaleEnabled, panelCopyTarget, panelScaleDialog, newButton, openButton, saveButton, fileOperationDialog, workspaceImage, sourceEditor, assetBackButton, atlasCanvas, bdaTileUsage, newTileButton, duplicateTileButton, deleteTileButton, tileSourceFields, tileInnerFields, styleDetailImageButtons, resourceDetail, tileModeButtons, resourceCategory, resourceUploadButton, styleAddButton, resourceDownloadButton, resourceDeleteButton, resourceUploadInput, aiDesignPanel, sourceFindToggle, sourceSearch, sourceValueHintsEnabled, sourceCompletionEnabled, sourceLineExplanationEnabled, sourceSearchPrevious, sourceSearchNext, sourceReplacement, sourceReplace, sourceReplaceAll, colorPickers, colorAlphas, sourceColorPicker, styleImageDialog, sourceStyleProxy, stylePickerDialog, styleLibraryApply, styleLibraryPreview, styleLibraryEdit, stylePickerSearch, stylePickerAdd, stylePickerClose, newStyleDialog, baiduActionCodes, keyModeButtons, keyActionButtons, styleImageResourceSearch, styleImageSource, styleImagePicker, styleImageResourceOpen, styleImagePickerCanvas, sidebarViewButtons, sourceUploadButton, sourceDownloadButton, sourceCopyButton, sourcePasteButton, sourceMoveButton, sourceDeleteButton, sourceUploadInput, toggleGuides, mobileToggleGuides, aiDesignStatus, canvasBackground, toolbarMenus, browserOpen, checkUpdateButton, aboutDiagnostics, exportLogsButton, exportLogsStatus, copyQqGroupButton, appDialogButtons, settingsStorageNav, settingsModelNav, settingsStorageSection, settingsModelSection, aiNewSession, aiDraftApply, aiDraftCancel, sourceDirectory, sourceDirectoryStatus, sourceDirectoryEnabled, chooseSourceDirectory, resetSourceDirectory, defaultDevice, appTheme, sourceFontSize, windowMaterialOpacity, windowMaterial, sidebarViewVisible, inspectorTabsVisible, imageOpen, sourceReplaceToggle, sourceReplaceRow, resourceBackButton, ios26Dialog, ios26Form, layoutImageFile, layoutImageScope, layoutImageError, layoutImageTargetInputs, layoutImageDialog, layoutImageOpen, layoutImageConfigButtons, layoutImageConfigFieldset, layoutImageForm, panelScaleForm, styleImageClose, styleImageResourceClose, inspectorResizeHandle, newStyleID, newStyleForm, clearSimulationButton } from "./app/dom"

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
source.setValuePreviewRenderer(renderSourceValueThumbnail)
if (sidebarProjectName) {
  const syncSidebarProjectName = () => { sidebarProjectName.textContent = documentName?.textContent?.trim() || "未打开皮肤" }
  syncSidebarProjectName()
  new MutationObserver(syncSidebarProjectName).observe(documentName, { childList: true, characterData: true, subtree: true })
}
aiDesignThinking.value = localStorage.getItem("ai-thinking-level") || "off"
if (!aiDesignThinking.value) aiDesignThinking.value = "off"
aiDesignThinking.addEventListener("change", () => localStorage.setItem("ai-thinking-level", aiDesignThinking.value))

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
mobileShareButton.querySelector("span:last-child")!.textContent = mobileShareLabel
mobileShareButton.title = mobileShareLabel
mobileShareButton.setAttribute("aria-label", mobileShareLabel)
mobileShareMenuLabel.textContent = mobileShareLabel

hydrateIcons()

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
quickInspector.addEventListener("scroll", syncSinglePageInspectorGroup, { passive: true })

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

setMobileSplit(Number(localStorage.getItem("mobile-workspace-split")) || 50, false)

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

for (const button of styleDetailImageButtons) {
  button.addEventListener("click", () => chooseStyleImageSlice(button.dataset.styleImageProperty as "NM_IMG" | "HL_IMG"))
}

workspaceImage.addEventListener("load", clearImagePreviewError)
workspaceImage.addEventListener("error", showImagePreviewError)
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

for (const input of [...keyboardFields, ...toolbarFields, ...keyFields]) decorateStyleReferenceInput(input)
stylePickerSearch.addEventListener("input", () => { styleLibraryPreview.hidden = true; void renderStylePicker() })
stylePickerDialog.addEventListener("close", () => { ++appState.stylePickerRenderID; appState.styleLibrarySelected = undefined })
stylePickerClose.addEventListener("click", () => stylePickerDialog.close())
newStyleDialog.addEventListener("close", () => { appState.newStyleApplyTarget = undefined })
stylePickerAdd.addEventListener("click", addStyleFromLibrary)
stylePickerDialog.addEventListener("click", (event) => {
  const rect = stylePickerDialog.getBoundingClientRect()
  if (event.target === stylePickerDialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) stylePickerDialog.close()
})

baiduActionCodes.replaceChildren(...knownFunctionCodes.map((value) => {
  return new Option(actionDescription(value), value)
}))

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
settingsStorageNav.hidden = !nativeSettings
settingsModelNav.hidden = !nativeSettings
settingsStorageSection.toggleAttribute("data-platform-hidden", !nativeSettings)
settingsModelSection.toggleAttribute("data-platform-hidden", !nativeSettings)
showSettingsPage("appearance")

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
for (const button of sidebarViewButtons) {
  button.addEventListener("click", () => setSidebarView(button.dataset.sidebarView === "source" ? "source" : "overview"))
}
defaultDevice.value = Array.from(defaultDevice.options).some((option) => option.value === savedDefaultDevice)
  ? savedDefaultDevice!
  : currentDeviceValue()
defaultDevice.addEventListener("change", () => {
  localStorage.setItem("default-device", defaultDevice.value)
})
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
applyEditorCrosshairSetting()
editorCrosshair.addEventListener("change", () => {
  localStorage.setItem("editor-crosshair", editorCrosshair.checked ? "on" : "off")
  applyEditorCrosshairSetting()
})
editorCoordinateSnap.addEventListener("change", () => {
  localStorage.setItem("editor-coordinate-snap", editorCoordinateSnap.checked ? "on" : "off")
})
appTheme.value = localStorage.getItem("app-theme") ?? "system"
applyAppTheme()
appTheme.addEventListener("change", () => {
  localStorage.setItem("app-theme", appTheme.value)
  applyAppTheme()
})
systemTheme.addEventListener("change", applyAppTheme)
if (savedSourceFontSize && Number.isFinite(Number(savedSourceFontSize)) && Number(savedSourceFontSize) >= 8 && Number(savedSourceFontSize) <= 32) {
  sourceFontSize.value = savedSourceFontSize
}
applySourceFontSize()
sourceFontSize.addEventListener("input", applySourceFontSize)
sourceFontSize.addEventListener("change", saveSourceFontSize)
sourceFontSize.addEventListener("blur", saveSourceFontSize)
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
applySidebarViewVisibility()
sidebarViewVisible.addEventListener("change", () => {
  localStorage.setItem("sidebar-view-visible", sidebarViewVisible.checked ? "on" : "off")
  applySidebarViewVisibility()
})
inspectorTabsVisible.checked = localStorage.getItem("inspector-tabs-visible") !== "off"
applyInspectorTabsVisibility()
inspectorTabsVisible.addEventListener("change", () => {
  localStorage.setItem("inspector-tabs-visible", inspectorTabsVisible.checked ? "on" : "off")
  applyInspectorTabsVisibility()
})
sourceCompletionEnabled.checked = localStorage.getItem("source-completion-enabled") === "on"
sourceValueHintsEnabled.checked = localStorage.getItem("source-value-hints-enabled") === "on"
sourceLineExplanationEnabled.checked = localStorage.getItem("source-line-explanation-enabled") === "on"
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

replaceLayoutImageButton.addEventListener("click", openLayoutImageDialog)
layoutImageFile.addEventListener("click", () => layoutImageOpen.click())
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

bindPaneResize($("#sidebar-resize-handle"), "--sidebar-width", "sidebarWidthV2", 180, 420, 248, 1)
bindPaneResize(inspectorResizeHandle, "--inspector-width", "inspectorWidthV5", 220, Math.max(700, window.innerWidth - 720), 360, -1)

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

resourceUploadButton.addEventListener("click", () => {
  if (!appState.archive || !isEditing()) return
  resourceUploadInput.value = ""
  resourceUploadInput.click()
})

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
