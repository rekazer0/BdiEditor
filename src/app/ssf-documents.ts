// Where an open Sogou skin keeps what the editor shows. The canvas draws boards from the preview
// overlay (`<theme>/skin/<orientation>/py_9.ini`, never saved); everything the user edits is a Sogou file.

import { IniDocument } from "../ini.ts"
import { documentPackage } from "../ssf/ssf-convert.ts"
import { ssfBoard, ssfKeyBinding, type SsfKeyBinding } from "../ssf/ssf-keymap.ts"
import type { SsfPackage, SsfTheme } from "../ssf/ssf-package.ts"
import { orientation, theme } from "./dom"
import { appState } from "./state"

export const SSF_SOUNDS_PATH = "default/sound_android.ini"

let cachedPackage: { archive: unknown; revision: number; pkg?: SsfPackage } | undefined

/** The open Sogou skin as a package; undefined for other formats or a skin missing its main files. */
export function ssfPackage(): SsfPackage | undefined {
  const archive = appState.archive
  if (archive?.format !== "ssf") return
  if (cachedPackage?.archive !== archive || cachedPackage.revision !== archive.revision) {
    let pkg: SsfPackage | undefined
    try {
      pkg = documentPackage(archive)
    } catch {
      pkg = undefined
    }
    cachedPackage = { archive, revision: archive.revision, pkg }
  }
  return cachedPackage.pkg
}

export function ssfTheme(): SsfTheme {
  return theme.value === "dark" ? "dark" : "light"
}

/** Folder (with trailing slash) holding the current look's phoneSkin.ini / keys.ini / anim.ini. */
export function ssfThemeFolder(): string | undefined {
  return ssfPackage()?.folder(ssfTheme())
}

export function ssfSkinPath(): string | undefined {
  const folder = ssfThemeFolder()
  return folder && `${folder}phoneSkin.ini`
}

export function ssfKeysPath(): string | undefined {
  const folder = ssfThemeFolder()
  return folder && `${folder}keys.ini`
}

/** A Sogou file as an INI document; an absent file reads as empty so sections can be added to it. */
export function ssfDocument(path: string): IniDocument {
  return IniDocument.parse(appState.archive?.isText(path) ? appState.archive.getText(path) : "")
}

/** A board of the current look and orientation, as the preview overlay lays it out. */
export function isSsfBoardPath(path: string): boolean {
  const archive = appState.archive
  return archive?.format === "ssf" && archive.isOverlay(path) && path.startsWith(`${theme.value}/skin/${orientation.value}/`)
    && /\.ini$/i.test(path) && !/\/gen\.ini$/i.test(path) && !path.slice(`${theme.value}/skin/${orientation.value}/`.length).includes("/")
}

/** The Sogou classes the selected canvas key is drawn from. */
export function ssfSelectedBindings(): Array<{ section: string; action: string; binding: SsfKeyBinding }> {
  const document = appState.layoutDocument
  if (!document || !isSsfBoardPath(appState.layoutPath)) return []
  const layout = appState.layoutPath.split("/").pop()!
  return appState.selectedKeySections.flatMap((section) => {
    const action = document.get(section, "CENTER")?.trim()
    return action ? [{ section, action, binding: ssfKeyBinding(layout, action, orientation.value === "land", document.get(section, "SSF_SECTION"), document.get(section, "SSF_BG")) }] : []
  })
}

/** 26-key boards read their own `_Qwerty` / `_Latin` classes. */
export function ssfQwertyBoard(path = appState.layoutPath): boolean {
  return ["py26", "en26", "num26"].includes(ssfBoard(path))
}

/**
 * The file the source editor shows for a selection: a board's look lives in phoneSkin.ini, so selecting
 * a board (or a key on it) opens that instead of the overlay layout, which is never edited.
 */
export function sourceEditPath(path = appState.selectedPath): string {
  return isSsfBoardPath(path) ? ssfSkinPath() ?? path : path
}
