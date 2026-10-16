// An SSF document is edited as its own files; the canvas shows it through its conversion onto the
// official BDS template, installed as the archive's read-only overlay and rebuilt after each edit.

import { IniDocument } from "../ini.ts"
import { loadBuiltInProjectTemplate } from "../operations.ts"
import { SkinArchive } from "../skin.ts"
import { ssfPreviewFiles, type SsfTemplates } from "../ssf/ssf-convert.ts"
import { selectedVariant } from "./bda-documents"
import { layout, orientation, theme } from "./dom"
import { showStatus } from "./file-operations"
import { syncSegmentedControls } from "./mobile-layout"
import { refreshPreview, updateDevicePreview } from "./preview-render"
import { appState } from "./state"
import { preview } from "./canvas-interaction"
import { renderFiles } from "./file-tree"
import { selectFile } from "./navigation"
import { isSsfBoardPath } from "./ssf-documents"

/** How long typing pauses before the preview is rebuilt; a rebuild converts every image again. */
const REBUILD_DELAY = 300

export async function ssfTemplates(): Promise<SsfTemplates> {
  appState.ssfTemplates ??= {
    bds: SkinArchive.open(await loadBuiltInProjectTemplate("official-android-bds")),
    bda: SkinArchive.open(await loadBuiltInProjectTemplate("default-android"), "bda"),
  }
  return appState.ssfTemplates
}

/** Converts the open SSF document for the preview now; returns what the conversion could not carry over. */
export function rebuildSsfPreview(): string[] {
  const archive = appState.archive
  if (archive?.format !== "ssf" || !appState.ssfTemplates) return []
  let warnings: string[] = []
  try {
    const preview = ssfPreviewFiles(archive, appState.ssfTemplates.bds)
    archive.setOverlay(preview.files)
    warnings = preview.warnings
  } catch (error) {
    showStatus(`预览未更新：${error instanceof Error ? error.message : String(error)}`)
  }
  appState.ssfPreviewRevision = archive.revision
  if (archive.isText(appState.layoutPath)) appState.layoutDocument = IniDocument.parse(archive.getText(appState.layoutPath))
  return warnings
}

/** Rebuilds the preview shortly after the SSF document last changed. */
export function scheduleSsfPreview(): void {
  const archive = appState.archive
  if (archive?.format !== "ssf" || archive.revision === appState.ssfPreviewRevision) return
  window.clearTimeout(appState.ssfPreviewTimer)
  appState.ssfPreviewTimer = window.setTimeout(() => {
    appState.ssfPreviewTimer = undefined
    if (appState.archive !== archive) return
    rebuildSsfPreview()
    refreshPreview()
  }, REBUILD_DELAY)
}

/**
 * Switching theme, orientation or layout only changes which converted layout the canvas shows: the
 * file selection stays, and a look the skin lacks is not created (that would add Baidu files to it).
 */
export function switchSsfPreviewLayout(path: string): void {
  if (appState.archive?.isText(path)) {
    const boardSelected = isSsfBoardPath(appState.selectedPath) || appState.selectedPath === appState.layoutPath
    appState.layoutPath = path
    appState.layoutDocument = IniDocument.parse(appState.archive.getText(path))
    appState.selectedKeySections = []
    preview.setSelected([])
    // The overview lists the boards and phoneSkin.ini of the current look and orientation.
    renderFiles()
    if (boardSelected) selectFile(path)
  } else {
    const current = selectedVariant()
    theme.value = current.theme
    orientation.value = current.orientation
    layout.value = appState.layoutPath.split("/").pop() ?? layout.value
    showStatus("这套搜狗皮肤没有这种外观")
  }
  updateDevicePreview()
  syncSegmentedControls()
  refreshPreview()
}
