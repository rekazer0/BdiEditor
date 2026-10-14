import { IniDocument } from "../ini.ts"
import { appState } from "./state"
import { panelCopySource, panelSourceWidth, panelSourceHeight, panelTargetWidth, panelTargetHeight, panelScaleEnabled, panelScaleOptions, panelCopyTarget, panelScaleSummary, panelCopySourceOptions, panelCopyTargetOptions, theme, orientation, layout, panelScaleDialog, newButton, openButton, saveButton, mobileShareButton, eventLog, fileOperationDialog, fileOperationProgress, fileOperationPercent, fileOperationDetail, fileOperationTitle, fileOperationResult, fileOperationClose, workspaceImage, assetImage, deviceShell, workspaceImageFigure, sourceEditor, asset, sourceName, assetBackButton } from "./dom"
import { archiveCopyPaths, archivePathOptions, scaleIniDocument } from "../panel-tools.ts"
import { alphaMask } from "../layout-scan.ts"
import { scheduleSourceAutosave } from "./source-workspace"
import { syncSegmentedControls, updatePanelToolButtons } from "./mobile-layout"
import { renderFiles } from "./file-tree"
import { selectFile } from "./navigation"
import { updateDirty, commitBatch } from "./edit-history"
import { updateDevicePreview, refreshPreview } from "./preview-render"
import { updateSourceFileActions } from "./source-files"
import { exportButtons, isTauri, LARGE_SKIN_BYTES } from "./canvas-interaction"
import { canExport, type ExportFormat } from "../export.ts"
import { operationError } from "../operations.ts"
import { clientLog, flushClientLogs } from "../client-log.ts"
import { message } from "@tauri-apps/plugin-dialog"
import { invoke, Channel } from "@tauri-apps/api/core"
import { adaptIos26Variant, adaptIos26KeyboardLayout } from "../ios26.ts"
import { type Change } from "../history.ts"
import { replaceImagePreviewURL } from "../image-preview.ts"
import { clearImagePreviewError } from "./resource-inspector"

export function panelSizeFrom(document: IniDocument | undefined): [number, number] | undefined {
  const size = document?.get("PANEL", "SIZE")?.split(",").map(Number)
  return size?.length === 2 && size.every((value) => Number.isFinite(value) && value > 0)
    ? size as [number, number]
    : undefined
}

export function panelSizeForPath(path: string): [number, number] | undefined {
  if (!appState.archive?.isText(path)) return
  const directory = path.slice(0, path.lastIndexOf("/"))
  return panelSizeFrom(IniDocument.parse(appState.archive.getText(path))) ??
    (appState.archive.isText(`${directory}/gen.ini`) ? panelSizeFrom(IniDocument.parse(appState.archive.getText(`${directory}/gen.ini`))) : undefined)
}

export function panelCopySourceSize(): [number, number] | undefined {
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

export function updatePanelCopyForm(): void {
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

export async function resizePng(bytes: Uint8Array, xRatio: number, yRatio: number): Promise<Uint8Array> {
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
export async function fitPngTo(bytes: Uint8Array, width: number, height: number): Promise<Uint8Array> {
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
export async function decodePngMask(bytes: Uint8Array): Promise<{ width: number; height: number; mask: Uint8Array }> {
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

export function defaultPanelCopyTarget(source: string): string {
  if (source.endsWith("/")) return `${source.slice(0, -1)}_copy/`
  const slash = source.lastIndexOf("/") + 1
  const dot = source.lastIndexOf(".")
  return dot >= slash
    ? `${source.slice(0, dot)}_copy${source.slice(dot)}`
    : `${source}_copy`
}

export function openPanelCopyDialog(): void {
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

export async function copyPanel(): Promise<boolean> {
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

export function setFileOperationBusy(busy: boolean): void {
  appState.fileOperationRunning = busy
  newButton.disabled = busy
  openButton.disabled = busy
  saveButton.disabled = busy || !appState.archive
  mobileShareButton.disabled = busy || !appState.archive
  updatePanelToolButtons()
  updateSourceFileActions()
  for (const button of exportButtons) {
    const format = button.dataset.exportFormat as ExportFormat
    // 不能导出的格式直接隐藏，不留一排无法解释的灰色菜单。
    button.hidden = Boolean(appState.archive) && !canExport(appState.archive!.format, format)
    button.disabled = busy || !appState.archive || button.hidden
  }
}

export function showStatus(text: string, kind: "progress" | "success" = "success"): void {
  eventLog.dataset.kind = kind
  eventLog.textContent = text
}

export function showError(error: unknown, action = "操作"): void {
  const text = operationError(action, error)
  clientLog.error("operation.error", { action }, error)
  void flushClientLogs()
  eventLog.dataset.kind = "error"
  eventLog.textContent = text
  if (isTauri() && !fileOperationDialog.open) {
    void message(text, { title: `${action}失败`, kind: "error" }).catch(() => {})
  }
}

export function updateFileOperationProgress(value: number, detail: string): void {
  fileOperationProgress.value = Math.max(0, Math.min(100, value))
  fileOperationProgress.textContent = `${Math.round(fileOperationProgress.value)}%`
  fileOperationPercent.textContent = fileOperationProgress.textContent
  fileOperationDetail.textContent = detail
}

export function showSkinLoadProgress(size: number): boolean {
  if (size <= LARGE_SKIN_BYTES) return false
  if (!appState.fileOperationProgressVisible) {
    appState.fileOperationProgressVisible = true
    if (!fileOperationDialog.open) fileOperationDialog.showModal()
  }
  return true
}

export async function readBrowserSkinFile(file: File): Promise<Uint8Array> {
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

export async function readNativeSkinFile(path: string): Promise<Uint8Array> {
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

export function waitForInterfacePaint(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
}

export function ios26StylePath(genPath: string): string | undefined {
  if (!appState.archive) return
  const directory = genPath.slice(0, genPath.lastIndexOf("/"))
  const themeRoot = genPath.split("/").slice(0, 2).join("/")
  return [`${directory}/res/default.css`, `${themeRoot}/res/default.css`]
    .find((path) => appState.archive?.isText(path))
}

export function adaptArchiveForIos26(): boolean {
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

export async function runFileOperation(
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

export function showImage(path: string): void {
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
