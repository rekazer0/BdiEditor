import { updateSxiForeground } from "./sxi-documents"
import { IniDocument } from "../ini.ts"
import { type StylePropertySource, resolveStylePropertySources, resolveStylePropertyLayers } from "../style-properties.ts"
import { appState } from "./state"
import { styleConfigPath, effectiveKeyValue, isSkinInfoPath, isToolbarPath, effectiveToolbarSections, currentSkinState, genConfigPath, keyboardContext, syncColorControl, listGeometryDocument, effectiveKeySection, setSourceValue } from "./config-context"
import { isListCell, listCellValue, setListCellValue } from "../layout.ts"
import { type BdaStyleRef, bdaStyleRef, type BdaAppearance } from "../bda.ts"
import { bdaColorHex } from "../bda-resolver.ts"
import { updateBdaStyle } from "../bda-encode.ts"
import { decodedBdaAppearancePart, applyDecodedBdaAppearancePart } from "../bda-source.ts"
import { currentBdaAppearance, refreshBdaLayout, refreshSelectedBdaSource, bdaAppearancePart, visualResolver } from "./bda-documents"
import { commitBytes, updateDirty, isEditing, commitText } from "./edit-history"
import { refreshPreview } from "./preview-render"
import { refreshBdaStyleReferenceField } from "../bda-editor.ts"
import { actionFieldNames, bdaKeyFieldLabels, preview, keyboardFields, layoutActionButtons, actionMeaningNodes } from "./canvas-interaction"
import { shouldSuggestActionCodes, actionDescription } from "../actions.ts"
import { keyFields, styleFields, primaryCssFields, skinFieldsGroup, toolbarFieldsGroup, keyboardFieldsGroup, keyOnlyGroups, keyTypographyFieldsGroup, selectedKeyName, selectedKeyPreview, selectedKeyContext, quickInspector, skinFields, toolbarFields, textStyleLabels, $, canvasMultiToolbar, canvasMultiCount, keyLayoutFieldsGroup, keyModeButtons, keyActionButtons, gapFields, mode, theme } from "./dom"
import { deferNumberInputRefresh } from "../number-input-wheel.ts"
import { effectivePanelSection } from "../panel-tools.ts"
import { createIcon } from "../icons"
import { syncAiDesignContext } from "./ai-panel"
import { setInspectorKind, syncInspectorRows } from "../inspector-shell.ts"
import { syncMobileInspectorHeader, syncMobileInspectorGroups, revealSinglePageInspectorGroup, applyModeState } from "./mobile-layout"
import { keyboardConfig, setKeyboardHeight } from "../keyboard.ts"
import { soundStyleForKey } from "../sounds.ts"
import { selectedRects } from "./key-editing"
import { updateStylePreviews } from "./style-picker"
import { ssfInspectorTitle } from "./ssf-inspector"
import { populateDocumentInspector, populateBdaConfigInspector } from "./document-inspector"
import { populateFontControls } from "./skin-fonts"
import { populateTextStyleGroup, writeCssStyleProperty, type TextProperty } from "./text-styles"

export function selectedStylePropertyContext(property: string, styles?: IniDocument):
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

export function selectedBdaRefs(
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

export function bdaStyleValue(appearance: BdaAppearance, ref: BdaStyleRef, property: string): string {
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

export function updateBdaRefs(refs: BdaStyleRef[], property: string, value: string): boolean {
  const info = currentBdaAppearance()
  if (!info || !refs.length) return false
  // BDA has no way to drop a size or colour, and fields write on every keystroke: skip values that
  // are empty or not finished yet instead of encoding 0 or throwing.
  if (!value.trim() && property !== "FONT_NAME") return false
  let bytes = info.bytes
  try {
    for (const ref of new Map(refs.map((item) => [`${item.type}:${item.key}`, item])).values()) {
      bytes = updateBdaStyle(bytes, ref, property, value)
    }
  } catch {
    return false
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
export function updateBdaAppearanceStyleRef(paths: string[][], ref: BdaStyleRef, owner?: HTMLElement): boolean {
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

export function updateSelectedBdaPanelProperty(
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

export function syncActionCodeSuggestions(field: HTMLInputElement): void {
  if (!actionFieldNames.has(field.dataset.keyField ?? "")) return
  if (shouldSuggestActionCodes(field.value)) field.setAttribute("list", "baidu-action-codes")
  else field.removeAttribute("list")
}

export function syncBdaKeyFieldLabels(bdaSelected: boolean): void {
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

export function populatePrimaryCssFields(hasSelection: boolean, sections: string[]): void {
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
  for (const [index, source] of sources.entries()) {
    const label = document.createElement("label")
    label.className = "ui-field"
    const caption = `显示内容（来自 CSS · ${source.section}）`
    label.title = `${path} [${source.section}] SHOW`
    const name = document.createElement("span")
    // 前景有多层时按层区分，否则几行同名分不清
    name.textContent = sources.length > 1 ? `第 ${index + 1} 层` : "样式内容"
    label.append(name)
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

export function populateKeyInspector(): void {
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
  // A Sogou skin's keys and boards are inspected by ssf-inspector.ts (through the document fields).
  const ssfSelected = appState.archive?.format === "ssf"
  const candidateSelected = Boolean(bdaSelected && appState.selectedCandidate && appState.selectedPath === appState.layoutPath)
  syncBdaKeyFieldLabels(bdaSelected)
  skinFieldsGroup.hidden = !skinSelected || bdaSelected
  toolbarFieldsGroup.hidden = !toolbarSelected || bdaSelected || toolbarHasSelection
  keyboardFieldsGroup.hidden = bdaSelected || ssfSelected || skinSelected || toolbarSelected || bdaConfigSelected || candidateSelected || appState.selectedPath !== appState.layoutPath || hasSelection
  for (const group of keyOnlyGroups) {
    const availableForBda = group === keyTypographyFieldsGroup
    group.hidden = skinSelected || bdaConfigSelected || !hasSelection || ssfSelected || bdaSelected && !availableForBda
  }
  selectedKeyName.textContent = hasSelection
    ? sections.length > 1 ? `已选 ${sections.length} 个按键` : `按键 ${sections[0]?.match(/\d+$/)?.[0] ?? ""}`.trim()
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
      : "整体布局"
  selectedKeyPreview.replaceChildren(createIcon(hasSelection ? bdaSelected ? "component" : sections.length > 1 ? "layers" : "key-round" : "layout-panel-top", 16))
  selectedKeyPreview.hidden = false
  selectedKeyContext.textContent = hasSelection
    ? `${appState.selectedPath.split("/").pop()} · ${sections.length > 1 ? "keys.*" : sections[0]}`
    : appState.selectedPath || "选择文件以查看属性"
  selectedKeyContext.title = appState.selectedPath
  const ssfTitle = ssfSelected ? ssfInspectorTitle() : undefined
  if (ssfTitle) {
    selectedKeyName.textContent = ssfTitle.name
    selectedKeyContext.textContent = ssfTitle.context
    selectedKeyContext.title = ssfTitle.context
  }
  selectedKeyName.title = selectedKeyName.textContent ?? ""
  syncAiDesignContext()
  quickInspector.dataset.selectionCount = String(hasSelection ? sections.length : 0)
  quickInspector.dataset.selectionNames = JSON.stringify(hasSelection ? sections : [])
  for (const field of keyFields.filter((field) => field.dataset.keyField === "SHOW")) {
    const label = field.closest("label")
    if (label) label.hidden = bdaSelected
  }
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
    // 手势格子没配置时显示「+」（十字布局，DESIGN.md §10）。
    field.placeholder = name === "HOLD" ? "未设置（默认弹字符）" : actionFieldNames.has(name) ? "+" : ""
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
  populateFontControls()
  populateTextStyleGroup()
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
      // updateBdaStyle adds a missing field, so every text style can take every property.
      const available = Boolean(info && refs.length)
      bdaTextPropertyAvailability.set(property, available)
      const common = values.length && values.every((value) => value === values[0]) ? values[0] : ""
      field.disabled = !available
      field.placeholder = available && !common && new Set(values).size > 1 ? "混合" : available ? "未设置" : "未配置"
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
        ? "未设置"
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
      // 样式里没有的属性无法编辑，整行隐藏，避免留下没有输入框的空行
      const field = label.querySelector<HTMLInputElement>("[data-style-field]")
      label.hidden = Boolean(field?.disabled)
      for (const fieldLabel of Array.from(label.querySelectorAll<HTMLLabelElement>("label"))) {
        fieldLabel.hidden = Boolean(fieldLabel.querySelector<HTMLInputElement>("[data-style-field]")?.disabled)
      }
      if (label.classList.contains("color-pair-field")) label.hidden = Array.from(label.querySelectorAll<HTMLLabelElement>("label")).every((fieldLabel) => fieldLabel.hidden)
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
  const multiAvailable = sections.length > 1 && !bdaSelected && !ssfSelected && !sections.some(isListCell)
  multiLayout.dataset.available = String(multiAvailable)
  multiLayout.hidden = !multiAvailable
  canvasMultiToolbar.dataset.available = String(multiAvailable)
  const multiLabel = appState.archive?.format === "bda"
    ? "此格式不支持布局编辑" : sections.some(isListCell) ? "列表单元不支持批量布局"
      : multiAvailable ? `将修改 ${sections.length} 个按键` : "选择 2 个或更多按键"
  multiLayout.querySelector("[role=status]")!.textContent = multiLabel
  canvasMultiCount.textContent = multiLabel
  const layoutNote = keyLayoutFieldsGroup.querySelector<HTMLElement>(".inspector-note")!
  layoutNote.hidden = appState.archive?.format !== "bda"
  const listSelected = sections.some(isListCell)
  const keyToolsAvailable = hasSelection && isEditing() && !bdaSelected && !ssfSelected && !listSelected
  // Sogou skins carry no key geometry, so there is nothing to move, copy or delete.
  for (const button of [...keyModeButtons, ...keyActionButtons]) button.hidden = ssfSelected
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
    button.disabled = bdaSelected || ssfSelected || listSelected || (
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

export function updateSkinInfo(field: HTMLInputElement): void {
  if (!appState.archive || !appState.selectedDocument || !isSkinInfoPath(appState.selectedPath)) return
  const before = appState.selectedDocument.toString()
  appState.selectedDocument.set("", field.dataset.skinField ?? "", field.value)
  const text = appState.selectedDocument.toString()
  commitText(appState.selectedPath, before, text)
  setSourceValue(text)
  updateDirty()
}

export function renameDocumentTitle(): void {
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

export function updateKeyboard(field: HTMLInputElement): void {
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

export function updateToolbar(field: HTMLInputElement): void {
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

export function updateSelectedKey(field: HTMLInputElement): void {
  const name = field.dataset.keyField ?? ""
  if (appState.archive?.format === "bda") return
  if (!appState.archive || !appState.layoutDocument || !appState.selectedKeySections.length) return
  if (name === "FORE_STYLE" && appState.archive.format === "sxi") {
    updateSxiForeground(field.value)
    return
  }
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

export function updateSelectedStyle(field: HTMLInputElement): void {
  const property = field.dataset.styleField ?? ""
  if (appState.archive?.format === "bda") {
    updateBdaRefs(selectedBdaRefs("FORE_STYLE", "text"), property, field.value)
    return
  }
  const context = selectedStylePropertyContext(property)
  if (!context) return
  writeCssStyleProperty([...new Set(context.sources.map((source) => source.section))], property as TextProperty, field.value.trim())
}
