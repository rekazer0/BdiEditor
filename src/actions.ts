import { IniDocument } from "./ini.ts"

export function previewPageTarget(
  code: string,
  currentName: string,
  baseName = "py_9.ini",
): string | undefined {
  const value = code.trim()
  const explicit = value.match(/^Z\+([A-Za-z0-9_-]+)$/)
  if (explicit) return `${explicit[1]}.ini`
  if (value === "F4" || value === "F15") return baseName
  if (value === "F6") return currentName === "num_9.ini" ? baseName : "num_9.ini"
  if (value === "F1") return "symbol.ini"
  if (value === "F16") return currentName === "en_26.ini" ? baseName : "en_26.ini"
}

export function layoutLetterKeyCount(document: IniDocument): number {
  return document.sections().filter((section) => {
    if (!/^KEY\d+$/.test(section)) return false
    return /^[A-Za-z]+$/.test(document.get(section, "CENTER")?.trim() ?? "")
  }).length
}
