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

export function previewPageTransition(
  code: string,
  currentName: string,
  returnName: string,
): { target: string | undefined; returnName: string } {
  const value = code.trim()
  const returnsToOrigin =
    value === "F4" ||
    value === "F15" ||
    (value === "F6" && currentName === "num_9.ini") ||
    (value === "F16" && currentName === "en_26.ini")
  const enteringTransientPage =
    !returnsToOrigin && Boolean(previewPageTarget(value, currentName, returnName))
  const nextReturnName = enteringTransientPage ? currentName : returnName
  return {
    target: previewPageTarget(value, currentName, nextReturnName),
    returnName: returnsToOrigin ? returnName : nextReturnName,
  }
}

export function layoutLetterKeyCount(document: IniDocument): number {
  return document.sections().filter((section) => {
    if (!/^KEY\d+$/.test(section)) return false
    return /^[A-Za-z]+$/.test(document.get(section, "CENTER")?.trim() ?? "")
  }).length
}
