/** Package formats a `SkinArchive` opens, edits and saves in place: Baidu BDI / BDS / BDA and Sogou SSF. */
export type ExportFormat = "bdi" | "bds" | "bda" | "ssf"

// `.sxi` (Palm) is a converted export target: produced by the Palm converter, never edited in place.
export type ExportTarget = ExportFormat | "sxi"

export function isExportFormat(format: ExportTarget): format is ExportFormat {
  return format !== "sxi"
}

export function exportFormatFromPath(path: string): ExportFormat | undefined {
  const match = path.match(/\.([^.\\/]+)$/)
  const extension = match?.[1].toLowerCase()
  if (extension === "mssf") return "ssf"
  return extension === "bdi" || extension === "bds" || extension === "bda" || extension === "ssf"
    ? extension
    : undefined
}

function exportPath(path: string, format: ExportTarget): string {
  return /\.[^.\\/]+$/.test(path) ? path.replace(/\.[^.\\/]+$/, `.${format}`) : `${path}.${format}`
}

export function exportName(name: string, format: ExportTarget): string {
  return exportPath(name || "未命名皮肤", format).split(/[\\/]/).pop()!
}
