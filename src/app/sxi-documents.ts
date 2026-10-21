import { appState } from "./state"
import { source } from "./canvas-interaction"
import { sourceName } from "./dom"
import { setSourceValue } from "./config-context"
import { commitText, isEditing, updateDirty } from "./edit-history"
import { showError } from "./file-operations"
import { refreshPreview } from "./preview-render"
import { populateKeyInspector } from "./key-inspector"
import { IniDocument } from "../ini.ts"
import { SXI_SKIN_PATH, applySxiFragments, encodeSkinJson, parseSkinJson, parseSkinJsonValue, sxiFragment, sxiFragmentPath } from "../palm/sxi-projection.ts"
import type { JsonObject } from "../palm/sxi-ini.ts"
import type { SkinArchive } from "../skin.ts"

/** The open `.sxi` document's skin.json, parsed again only when the document changes. */
export function palmSkin(archive: SkinArchive): JsonObject {
  const cached = appState.palmSkin
  if (cached?.archive === archive && cached.revision === archive.revision) return cached.skin
  const skin = parseSkinJson(archive.getText(SXI_SKIN_PATH))
  appState.palmSkin = { archive, revision: archive.revision, skin }
  return skin
}

// `.sxi` sources are JSON: a derived layout/style shows its `skin.json` fragment, stored JSON
// files show their own text.
export function isSxiSourcePath(path: string): boolean {
  const archive = appState.archive
  return archive?.format === "sxi" && (Boolean(archive.derivedPointer(path)) || archive.isText(path) && /\.json$/i.test(path))
}

function sxiSourceText(path: string): string {
  const archive = appState.archive!
  const pointer = archive.derivedPointer(path)
  if (!pointer) return archive.getText(path)
  return encodeSkinJson(sxiFragment(parseSkinJson(archive.getText(SXI_SKIN_PATH)), pointer))
}

export function showSxiSource(path: string): void {
  const pointer = appState.archive!.derivedPointer(path)
  if (!pointer) appState.selectedDocument = undefined
  setSourceValue(sxiSourceText(path))
  source.disabled = false
  sourceName.textContent = pointer ? `${SXI_SKIN_PATH} · ${pointer.join(".")}` : path
}

export function commitSxiSourceEdit(): void {
  const archive = appState.archive
  const path = appState.selectedPath
  if (!isEditing() || !archive || !isSxiSourcePath(path)) return
  const pointer = archive.derivedPointer(path)
  try {
    if (pointer) {
      const before = archive.getText(SXI_SKIN_PATH)
      commitText(SXI_SKIN_PATH, before, applySxiFragments(before, [{ path: sxiFragmentPath(pointer), text: source.value }]))
    } else {
      if (path === SXI_SKIN_PATH) parseSkinJson(source.value)
      else parseSkinJsonValue(source.value)
      commitText(path, archive.getText(path), source.value)
    }
  } catch (error) {
    showError(error, "编辑 skin.json")
  }
  if (archive.isText(path) && path === appState.layoutPath) {
    appState.layoutDocument = IniDocument.parse(archive.getText(path))
    appState.selectedDocument = appState.layoutDocument
  }
  if (archive.isText(path)) showSxiSource(path)
  refreshPreview()
  populateKeyInspector()
  updateDirty()
}

export function refreshSxiDocument(): void {
  const archive = appState.archive!
  if (archive.isText(appState.layoutPath)) appState.layoutDocument = IniDocument.parse(archive.getText(appState.layoutPath))
  if (archive.isText(appState.selectedPath)) {
    appState.selectedDocument = IniDocument.parse(archive.getText(appState.selectedPath))
    showSxiSource(appState.selectedPath)
  }
  refreshPreview()
  populateKeyInspector()
  updateDirty()
}
