import { appState } from "./state"
import { bdaStyleRef, bdaStyleID } from "../bda.ts"
import { currentBdaAppearance, visualResolver } from "./bda-documents"
import { styleConfigPath } from "./config-context"
import { IniDocument } from "../ini.ts"
import { type StyleKind } from "./types"
import { createIcon, symbolSpan } from "../icons"
import { isStyleReferenceKey, styleReferenceForeground, styleWriteTarget, styleReferenceKey, openStyleReferenceEditor, refreshStyleReferenceThumbnail } from "./style-references"
import { isEditing } from "./edit-history"
import { updateBdaRefs } from "./key-inspector"
import { bdaImageResourceID } from "./tile-editing"
import { stylePickerDialog, stylePickerGrid, styleLibraryPreviewImage, $, styleLibraryApply, styleLibraryPreview, stylePickerSearch, theme, orientation, stylePickerCount, stylePickerEmpty, styleLibraryEdit, stylePickerAdd, styleAddButton, newStyleError } from "./dom"
import { openImageSlicePicker, imageDataURL, showPickerWindow } from "./image-pickers"
import { type Visual, retinaThumbnail, drawVisualPreview, thumbnailRecycler, type VisualResolver } from "../atlas.ts"
import { isTauri, playSoundPath, afterNextPaint } from "./canvas-interaction"
import { WebviewWindow } from "@tauri-apps/api/webviewWindow"
import { selectFile } from "./navigation"
import { resourceImagePaths } from "../resources.ts"
import { soundPathForFilename } from "../sounds.ts"
import { type StyleLibraryPayload, type StyleLibraryVisual } from "../picker-window.ts"
import { emitTo } from "@tauri-apps/api/event"
import { SkinArchive } from "../skin.ts"

export function stylePickerLabel(styleID: string): string {
  return appState.archive?.format === "bda" ? String(bdaStyleRef(styleID)?.key ?? styleID) : styleID
}

export function availableStyleIDs(): string[] {
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

export const styleKinds: Record<StyleKind, { label: string; icon: string }> = {
  image: { label: "图片", icon: "image" },
  color: { label: "颜色", icon: "palette" },
  anim: { label: "动画", icon: "clapperboard" },
  text: { label: "文字", icon: "type" },
  sound: { label: "声音", icon: "volume-2" },
  empty: { label: "空", icon: "square-dashed" },
}

/** 按样式内容判定类型：有图即图片样式，其次动画、颜色、声音，只剩文字属性的归为文字样式。 */
export function styleKind(styleID: string, styles = styleConfigDocument()): StyleKind {
  if (appState.archive?.format === "bda") return bdaStyleRef(styleID)?.type ?? "empty"
  const keys = new Set(styles?.entries(`STYLE${styleID}`).filter((entry) => entry.value.trim()).map((entry) => entry.key) ?? [])
  const has = (pattern: RegExp) => [...keys].some((key) => pattern.test(key))
  if (has(/^(?:NM|HL)_IMG$/)) return "image"
  if (has(/ANIM|^EVENT\d+$/)) return "anim"
  if (has(/^(?:NM|HL)_COLOR$/)) return "color"
  if (keys.has("PRESS_SOUND_PATH")) return "sound"
  return keys.size ? "text" : "empty"
}

export function styleConfigDocument(): IniDocument | undefined {
  const path = styleConfigPath()
  return appState.archive?.isText(path) ? IniDocument.parse(appState.archive.getText(path)) : undefined
}

/** 样式类型徽标：样式库、检查器缩略图、样式配置列表共用，保证同一类型处处同一图标与文字。 */
export function styleKindBadge(kind: StyleKind, iconOnly = false): HTMLElement {
  const badge = document.createElement("span")
  badge.className = "style-kind-badge"
  badge.dataset.styleKind = kind
  badge.title = `${styleKinds[kind].label}样式`
  badge.append(createIcon(styleKinds[kind].icon, 11))
  if (!iconOnly) badge.append(styleKinds[kind].label)
  return badge
}

/** 由引用字段推断应优先展示的样式类型，打开样式库时据此预选筛选。 */
export function styleKindForKey(key: string): StyleKind | "all" {
  if (/ANIM_STYLE$/.test(key)) return "anim"
  if (key === "HW_FORE_STYLE") return "color"
  return "all"
}

export function styleLibraryCategories(styleID: string): Set<string> {
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

export function applyStyleLibrarySelection(): void {
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

export function previewStyleLibraryItem(
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

export function closeStylePicker(): void {
  stylePickerDialog.close()
  if (isTauri()) void WebviewWindow.getByLabel("image-picker").then((pickerWindow) => pickerWindow?.close())
}

export function editStyleLibrarySelection(): void {
  const selected = appState.styleLibrarySelected
  if (!selected) return
  closeStylePicker()
  if (selected.styleID) openStyleReferenceEditor(selected.styleID)
  else if (selected.imagePath) selectFile(selected.imagePath, "overview")
}

export async function renderStyleLibraryItems(renderID: number, styleIDs: string[], resolver: VisualResolver): Promise<void> {
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
  const thumbnail = thumbnailRecycler(stylePickerGrid)
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
        const canvas = thumbnail(128, 88)
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

export async function renderStylePicker(): Promise<void> {
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

export function openStylePicker(input: HTMLInputElement, highlighted = false): void {
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

export function nativeStyleLibraryPayload(sliceBack: boolean): Promise<StyleLibraryPayload | undefined> {
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

export async function emitStyleLibrary(sliceBack = false): Promise<void> {
  const payload = await nativeStyleLibraryPayload(sliceBack)
  if (payload) await emitTo("image-picker", "style-library-data", payload)
}

export function addStyleFromLibrary(): void {
  appState.newStyleApplyTarget = appState.stylePickerTarget
  closeStylePicker()
  styleAddButton.click()
}

export async function updateStylePreviews(): Promise<void> {
  if (appState.stylePreviewsPending) return
  appState.stylePreviewsPending = true
  afterNextPaint(() => {
    appState.stylePreviewsPending = false
    refreshStyleReferenceThumbnails()
  })
}

// What each thumbnail was last drawn from; selecting a key re-runs this for every
// trigger, and rebuilding unchanged ones dominated the click cost.
export const styleReferenceThumbnailInputs = new WeakMap<HTMLElement, { archive: SkinArchive; signature: string }>()

export function refreshStyleReferenceThumbnails(): void {
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

export function nextStyleID(): string {
  const ids = availableStyleIDs().map(Number).filter(Number.isSafeInteger)
  return String((ids.length ? Math.max(...ids) : -1) + 1)
}

export function showNewStyleError(text: string): void {
  newStyleError.textContent = text
  newStyleError.hidden = !text
}
