import { SXI_SKIN_PATH } from "../palm/sxi-projection.ts"
import { setSxiStyleImage, addSxiImageStyle, setSxiForeground, sxiStylePointer } from "../palm/sxi-edit.ts"
import { refreshSxiDocument } from "./sxi-documents"
import { showError } from "./file-operations"
import { IniDocument } from "../ini.ts"
import { appState } from "./state"
import { styleConfigPath, effectiveKeyValue, effectiveSelectedSections, setSourceValue } from "./config-context"
import { isListCell } from "../layout.ts"
import { type StyleImagePickerTarget, type NativeResourcePickerPayload } from "./types"
import { setStyleField } from "../keyboard.ts"
import { commitText, updateDirty, isEditing } from "./edit-history"
import { refreshPreview } from "./preview-render"
import { renderStyleResourceDetail } from "./resource-inspector"
import { populateKeyInspector, selectedBdaRefs, updateBdaRefs } from "./key-inspector"
import { stylePickerLabel, emitStyleLibrary } from "./style-picker"
import { WebviewWindow } from "@tauri-apps/api/webviewWindow"
import { emitTo } from "@tauri-apps/api/event"
import { resourceImagePaths } from "../resources.ts"
import { theme, orientation, styleImageResourcePicker, styleImageResourceSearch, styleImageImgList, styleImageResourceCount, styleImageResourceEmpty, styleImageSource, styleImagePicker, styleImageResourceOpen, styleImageTitle, styleImageSubtitle, styleImageDialog, styleImagePickerCanvas, styleImagePickerMeta } from "./dom"
import { isTauri } from "./canvas-interaction"
import { showStyleImageDialog } from "./source-panel"
import { drawSlicePicker, pickableSlices, WHOLE_IMAGE_INDEX } from "../slice-picker-canvas.ts"
import { type TileRect, tileSlices } from "../tiles.ts"
import { ssfPackage, ssfThemeFolder } from "./ssf-documents"

export function selectedStyleImageSections(source: "BACK_STYLE" | "FORE_STYLE"): { document: IniDocument; path: string; sections: string[] } | undefined {
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
        // Images live in STYLE<id> only (STYLE<id/100> is a text fallback, see styleWriteTarget), and a
        // text layer of the same foreground must not turn into an image.
        return foreStyle.split(",").map((token) => `STYLE${token.trim()}`).filter((section) =>
          document.get(section, "NM_IMG") !== undefined || document.get(section, "HL_IMG") !== undefined)
      }))]
  return sections.length ? { document, path, sections } : undefined
}

export function updateSelectedImageReference(target: StyleImagePickerTarget | undefined, value: string): boolean {
  if (!appState.archive || !target) return false
  const { document, path, sections } = target
  if (appState.archive.format === "sxi") {
    const archive = appState.archive
    const stylePath = path ?? styleConfigPath()
    const derived = archive.derivedPointer(stylePath)
    if (!derived || !isEditing()) return false
    try {
      const before = archive.getText(SXI_SKIN_PATH)
      const pointer = sxiStylePointer(before, derived, orientation.value)
      if (sections?.length) {
        commitText(SXI_SKIN_PATH, before, setSxiStyleImage(before, pointer, sections, target.property, value))
      } else {
        const input = appState.stylePickerTarget
        if (!input || input.dataset.keyField !== "FORE_STYLE") return false
        const added = addSxiImageStyle(before, pointer, target.property, value)
        const layoutPointer = archive.derivedPointer(appState.layoutPath)
        if (!layoutPointer) return false
        let after = added.text
        for (const section of effectiveSelectedSections()) {
          const ids = (effectiveKeyValue(section, "FORE_STYLE") ?? "").split(",").map((id) => id.trim()).filter(Boolean)
          if (input.dataset.styleReferenceAppend === "true") ids.push(added.id)
          else ids[Number(input.dataset.styleReferenceIndex ?? 0)] = added.id
          after = setSxiForeground(after, layoutPointer, [section], ids.join(","))
        }
        commitText(SXI_SKIN_PATH, before, after)
        target.path = stylePath
        target.sections = [`STYLE${added.id}`]
      }
      refreshSxiDocument()
      return true
    } catch (error) { showError(error, "修改手心前景图片"); return false }
  }
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
export function imagePickerStyleName(target: StyleImagePickerTarget): string {
  const section = target.sections?.find((name) => /^STYLE\d+$/i.test(name))
  const styleID = section ? section.replace(/^STYLE/i, "") : appState.selectedStyleID
  return styleID ? `样式 ${stylePickerLabel(styleID)}` : ""
}

export function imageDataURL(bytes: Uint8Array): string {
  let binary = ""
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
  }
  return `data:image/png;base64,${btoa(binary)}`
}

// 图片切片与「全部图片」列表共用一个窗口，不再另开资源窗口。
export async function showPickerWindow(
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

export function openImagePickerList(): void {
  if (!appState.archive || (!appState.pickerTarget && !appState.resourcePickerSelect)) return
  void showPickerWindow("list", "全部图片", 960, 680)
}

/** Images a style can use: Baidu res/ folders, or the folders a Sogou look looks images up in. */
export function pickableImagePaths(): string[] {
  const archive = appState.archive
  const names = archive?.names() ?? []
  if (archive?.format !== "ssf") return resourceImagePaths(names, theme.value, orientation.value)
  const pkg = ssfPackage()
  const roots = [ssfThemeFolder(), pkg && `${pkg.resolution}/`, "default/", "default/res/"].filter((root): root is string => Boolean(root))
  return names.filter((path) => !archive.isOverlay(path) && /\.(?:png|webp|jpe?g)$/i.test(path)
    && roots.some((root) => path.startsWith(root) && !path.slice(root.length).includes("/")))
}

export function resourcePickerPayload(): NativeResourcePickerPayload {
  return pickableImagePaths().flatMap((path) => {
    const bytes = appState.archive?.getBytes(path)
    return bytes ? [{ path, dataURL: imageDataURL(bytes) }] : []
  })
}

export function closeStyleImageResourcePicker(): void {
  styleImageResourcePicker.hidden = true
  styleImageResourceSearch.value = ""
  appState.resourcePickerSelect = undefined
}

export function selectImageResource(path: string): void {
  const select = appState.resourcePickerSelect
  if (select) {
    const resourceID = path.split("/").pop()?.replace(/\.png$/i, "") ?? path
    clearImageSlicePicker()
    select(resourceID)
    return
  }
  if (appState.pickerTarget) openImageSlicePicker(path, appState.pickerTarget)
}

export function renderStyleImageResources(): void {
  if (!appState.archive) return
  const query = styleImageResourceSearch.value.trim().toLowerCase()
  const paths = pickableImagePaths().filter((path) => path.toLowerCase().includes(query))
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

export function openStyleImageResourcePicker(): void {
  if (isTauri() || !appState.archive || (!appState.pickerTarget && !appState.resourcePickerSelect)) return
  styleImageSource.hidden = !(appState.pickerTarget?.path && appState.pickerTarget.sections?.length)
  showStyleImageDialog()
  if (!appState.pickerTarget) {
    styleImagePicker.hidden = true
    styleImageResourceOpen.hidden = true
    styleImageTitle.textContent = "选择图片资源"
    styleImageSubtitle.textContent = ""
  }
  styleImageResourcePicker.hidden = false
  renderStyleImageResources()
  styleImageResourceSearch.focus()
}

export function clearImageSlicePicker(): void {
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

export function drawImageSlicePicker(): void {
  if (!appState.pickerImage?.naturalWidth) return
  appState.pickerScale = drawSlicePicker(styleImagePickerCanvas, appState.pickerImage, pickableSlices(appState.pickerSlices, appState.pickerImage), appState.pickerSelectedIndex, appState.pickerFit * appState.pickerZoom, { normal: "#3a6df0", selected: "#ff6b2c" })
  appState.pickerOffset = { x: 0, y: 0 }
}

export function pickerImageReference(index: number): string {
  const name = appState.pickerPath.split("/").pop()?.replace(/\.png$/i, "") ?? appState.pickerPath
  return index === WHOLE_IMAGE_INDEX ? name : `${name},${index}`
}

export function openImageSlicePicker(path: string, target: StyleImagePickerTarget, selectedSource?: TileRect): void {
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
