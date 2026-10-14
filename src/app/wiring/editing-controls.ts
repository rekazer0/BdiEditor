import { source, keyboardFields, layoutActionButtons, preview, toolbarPreview, inspectorTabButtons, mobilePortraitQuery, activateSkinState } from "../canvas-interaction"
import { type SourceEditorValueClick } from "../../lazy-source-editor.ts"
import { openSourceColorPicker, openSourceStyleDefinition, openSourceStylePicker, scheduleSourceSearch, closeSourceFind, findSourceMatch, openSourceFind, syncSourceFindBarOffset, replaceSourceMatches, updateInspectorView, updateSourceHighlight } from "../source-panel"
import { sourceSearch, sourceSearchPrevious, sourceSearchNext, sourceFindToggle, sourceEditor, sourceReplaceToggle, sourceReplaceRow, sourceReplacement, sourceReplace, sourceReplaceAll, keyFields, styleFields, toolbarFields, skinFields, gapFields, quickInspector, colorPickers, colorAlphas, keyModeButtons, keyActionButtons, inspectorBackButton, aiDesignPanel, aiDesignStatus, theme, orientation, layout, mode, eventLog, modeChoiceButtons, themeChoiceButtons, orientationChoiceButtons, mobileChoiceButtons, toggleGuides, mobileToggleGuides, newTileButton, duplicateTileButton, deleteTileButton, resourceBackButton, resourceSearch, resourceCategory, bdaTileUsage, tileModeButtons, atlasCanvas, workspaceImage, tileSourceFields, tileInnerFields, skinState, panelScaleButton, adaptIos26Button, ios26Dialog, ios26Form, replaceLayoutImageButton, layoutImageFile, layoutImageOpen, layoutImageDialog, layoutImageTargetInputs, layoutImageScope, layoutImageError, layoutImageConfigButtons, layoutImageConfigFieldset, layoutImageForm, panelCopySource, panelTargetWidth, panelTargetHeight, panelCopyTarget, panelScaleEnabled, panelScaleForm, panelScaleDialog, candidateArea, toolbarCanvas, toolbarStrip, styleImagePicker, styleImagePickerCanvas, styleImageClose, styleImageSource, styleImageDialog } from "../dom"
import { appState } from "../state"
import { syncActionCodeSuggestions, updateSelectedKey, updateSelectedStyle, updateKeyboard, updateToolbar, updateSkinInfo, populateKeyInspector } from "../key-inspector"
import { syncColorControl, writeColorControl, scrollSelectedSource } from "../config-context"
import { applyExactGap, moveMixedCoordinate, applyLayoutAction, copySelectedKeys, deleteSelectedKeys } from "../key-editing"
import { shouldClearMixedInput } from "../../mixed-input.ts"
import { syncCandidateSelection, updateDevicePreview, refreshPreview, setGuidesVisible } from "../preview-render"
import { setMobilePane, syncSegmentedControls, applyModeState, selectChoice, setMobileInspectorGroup, requestEditMode } from "../mobile-layout"
import { ensureAiChat, aiDesignErrorMessage } from "../ai-panel"
import { preferredPath, createMissingVariant, bdaAvailableLayoutPaths, bdaAppearanceStyleGroups, bdaAppearanceStylePath } from "../bda-documents"
import { renderFiles } from "../file-tree"
import { selectFile } from "../navigation"
import { IniDocument } from "../../ini.ts"
import { populateTileInspector, setDrawingTile, duplicateSelectedTile, deleteSelectedTile, drawAtlas, atlasPoint, scheduleAtlasDraw, commitTile, updateSelectedTile } from "../tile-editing"
import { isEditing } from "../edit-history"
import { selectStyleResource, showResourceList, renderResourceInspector } from "../resource-inspector"
import { revealSourceFile } from "../source-files"
import { type BdaAppearanceStyleGroup } from "../../bda.ts"
import { tileSliceAt, boundedTileRect, moveTileRect, nextTileIndex } from "../../tiles.ts"
import { resizeTileSlice } from "../../tiles"
import { openPanelCopyDialog, runFileOperation, adaptArchiveForIos26, updatePanelCopyForm, copyPanel } from "../file-operations"
import { openLayoutImageDialog, acceptLayoutImageFile, syncLayoutImageConfig, updateLayoutImageForm, applyLayoutImage } from "../layout-image-replace"
import { type LayoutImageTarget } from "../../layout-image.ts"
import { type LayoutImageConfig } from "../types"
import { bindSlicePickerZoom, MAX_SLICE_ZOOM, MIN_SLICE_ZOOM, pickableSlices } from "../../slice-picker-canvas.ts"
import { drawImageSlicePicker, updateSelectedImageReference, pickerImageReference, clearImageSlicePicker } from "../image-pickers"

/** 源码编辑器、属性字段、主题与方向、资源与键盘图替换。只在启动时由 main.ts 按顺序调用一次。 */
export function wireEditingControls(): void {
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
    const direction = (event.key === "ArrowUp" ? 1 : event.key === "ArrowDown" ? -1 : 0) * (event.shiftKey ? 10 : 1)
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
  // 只读表单里的禁用控件仍接收指针（components.css），点击统一提示切换模式。
  document.addEventListener("pointerdown", (event) => {
    const target = event.target
    if (!(target instanceof Element) || !target.matches(":disabled") || !target.closest('.ui-form[data-readonly="true"]')) return
    event.preventDefault()
    requestEditMode()
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
}
