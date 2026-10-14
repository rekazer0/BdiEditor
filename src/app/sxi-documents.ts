import { appState } from "./state"
import { source } from "./canvas-interaction"
import { sourceName } from "./dom"
import { setSourceValue } from "./config-context"
import { commitText, isEditing, updateDirty } from "./edit-history"
import { showError } from "./file-operations"
import { refreshPreview } from "./preview-render"
import { populateKeyInspector } from "./key-inspector"
import { IniDocument } from "../ini.ts"
import { SXI_SKIN_PATH, encodeSkinJson, parseSkinJson, setSxiFragment, sxiFragment } from "../palm/sxi-projection.ts"
import { PALM_INT_MAX } from "../palm/palm-json.ts"

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

function parseFragment(text: string): unknown {
  return JSON.parse(text, (_key, item) => item === 9223372036854775807 ? PALM_INT_MAX : item)
}

export function commitSxiSourceEdit(): void {
  const archive = appState.archive
  const path = appState.selectedPath
  if (!isEditing() || !archive || !isSxiSourcePath(path)) return
  const pointer = archive.derivedPointer(path)
  try {
    if (pointer) {
      const before = archive.getText(SXI_SKIN_PATH)
      const skin = parseSkinJson(before)
      setSxiFragment(skin, pointer, parseFragment(source.value) as never)
      commitText(SXI_SKIN_PATH, before, encodeSkinJson(skin))
    } else {
      if (path === SXI_SKIN_PATH) parseSkinJson(source.value)
      else parseFragment(source.value)
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
