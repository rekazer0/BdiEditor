// 面板复制 for Sogou skins. A resolution folder (`1080/`) copied to another width (`720/`) is a new
// look set for phones of that width: the phone only installs folders the skin lists, so the copy is
// added to time.ini's SUPPORT_SCREEN (and its status list) and phoneTheme.ini's supports-screens.

import { IniDocument } from "../ini.ts"

/** The screen width a Sogou path is drawn for: its first folder when that is a number. */
export function ssfResolutionFolder(path: string): number | undefined {
  const match = /^(\d+)(?:\/|$)/.exec(path)
  return match ? Number(match[1]) : undefined
}

function addListed(document: IniDocument, section: string, key: string, value: string): void {
  const listed = document.get(section, key)
  if (listed === undefined) return
  const items = listed.split(",").map((item) => item.trim()).filter(Boolean)
  if (!items.includes(value)) document.set(section, key, [...items, value].join(","))
}

/** time.ini once resolution `target` is a copy of `source`: listed, with the same day / night statuses. */
export function listSsfResolutionInTime(text: string, source: string, target: string): string {
  const document = IniDocument.parse(text)
  addListed(document, "General", "SUPPORT_SCREEN", target)
  // A folder the skin does not list statuses for takes those of another resolution, as its looks are copies.
  const statuses = [source, ...document.sections().filter((section) => /^\d+$/.test(section))].find((section) => document.sections().includes(section))
  if (statuses && !document.sections().includes(target)) {
    document.appendSection(target, document.entries(statuses).map(({ key, value }) => ({ key, value })))
  }
  return document.toString()
}

/** phoneTheme.ini once resolution `target` exists. */
export function listSsfResolutionInTheme(text: string, target: string): string {
  const document = IniDocument.parse(text)
  addListed(document, "General", "supports-screens", target)
  return document.toString()
}
