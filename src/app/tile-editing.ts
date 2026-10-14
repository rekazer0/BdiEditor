import { type BdaTileUsage } from "./types"
import { appState } from "./state"
import { currentBdaAppearance } from "./bda-documents"
import { type TileSlice, type TileRect, nextTileIndex, tilePreviewDestination, tilePreviewInnerRect, tileSlices, type TilePoint, updateTileSlice, removeTileSlice, moveTileRect, duplicateTileSlice } from "../tiles.ts"
import { bdaStyleID } from "../bda.ts"
import { updateBdaImageInnerRect } from "../bda-encode.ts"
import { sourceName, workspaceImage, atlasCanvas, tilePreviewWrap, tilePreview, tileInspector, bdaTileUsage, tileSourceFieldsGroup, tileInnerTitle, newTileButton, duplicateTileButton, deleteTileButton, moveTileButton, tileTitle, tileSourceFields, tileInnerFields, resourceGallery } from "./dom"
import { styleConfigPath, setSourceValue } from "./config-context"
import { IniDocument } from "../ini.ts"
import { isEditing, commitBytes, updateDirty, commitText, commitBatch } from "./edit-history"
import { source } from "./canvas-interaction"
import { updateSourceHighlight } from "./source-panel"
import { refreshPreview } from "./preview-render"
import { populateKeyInspector } from "./key-inspector"
import { decodePngMask, showStatus } from "./file-operations"
import { detectGridCells } from "../layout-scan.ts"
import { type Change } from "../history.ts"

export function bdaTileUsageKey(usage: BdaTileUsage | undefined): string {
  return usage ? `${usage.ref.key}:${usage.highlighted ? "highlight" : "normal"}` : ""
}

export function selectedBdaTileUsage(): BdaTileUsage | undefined {
  return appState.bdaTileUsages.find((usage) => usage.index === appState.selectedTileIndex)
}

export function bdaImageResourceID(path: string): string {
  return (path.split("/").pop() ?? path).replace(/\.png$/i, "")
}

export function pngPixelSize(bytes: Uint8Array | undefined): readonly [number, number] | undefined {
  if (!bytes || bytes.length < 24 || bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) return
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return [view.getUint32(16), view.getUint32(20)]
}

export function bdaImageUsageCounts(): Map<string, number> {
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

export function bdaImageTiles(path: string): { slices: TileSlice[]; usages: BdaTileUsage[] } {
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

export function syncAtlasWorkspace(): void {
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

export function scheduleAtlasDraw(): void {
  if (appState.atlasDrawFrame) return
  appState.atlasDrawFrame = requestAnimationFrame(() => {
    appState.atlasDrawFrame = 0
    drawAtlas()
  })
}

export function drawAtlas(): void {
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

export function drawTilePreview(): void {
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

export function populateTileInspector(): void {
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

export function loadTiles(path: string): void {
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

export function atlasPoint(event: Pick<PointerEvent, "clientX" | "clientY">): TilePoint {
  const bounds = atlasCanvas.getBoundingClientRect()
  return {
    x: ((event.clientX - bounds.left) / bounds.width) * workspaceImage.naturalWidth,
    y: ((event.clientY - bounds.top) / bounds.height) * workspaceImage.naturalHeight,
  }
}

export function commitBdaTileInnerRect(rect: TileRect): void {
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

export function commitTile(slice: TileSlice, coalesce = false): void {
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

export async function autoSliceSelectedImage(): Promise<void> {
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

export function renderResourceInspectorMetadata(): void {
  for (const item of resourceGallery.querySelectorAll<HTMLElement>(".resource-item")) {
    if (item.dataset.path !== appState.selectedResourcePath) continue
    const meta = item.querySelector("small")
    const size = meta?.textContent?.split(" · ")[0]
    if (meta) meta.textContent = `${size ? `${size} · ` : ""}TIL`
  }
}

export function setDrawingTile(active: boolean): void {
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

export function moveSelectedTile(deltaX: number, deltaY: number, coalesce = false): void {
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

export function deleteSelectedTile(): void {
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

export function duplicateSelectedTile(): void {
  const existing = appState.slices.find((slice) => slice.index === appState.selectedTileIndex)
  if (!existing || !isEditing()) return
  commitTile(duplicateTileSlice(existing, nextTileIndex(appState.tileDocument)))
}

export function updateSelectedTile(): void {
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
