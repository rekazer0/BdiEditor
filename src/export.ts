export type ExportFormat = "bdi" | "bds" | "bda"

// `.sxi` (Palm) and `.ssf` (Sogou) are converted export targets: they are produced by converters,
// never edited in place, so they are not `SkinArchive` package formats.
export type ExportTarget = ExportFormat | "sxi" | "ssf"

export function isExportFormat(format: ExportTarget): format is ExportFormat {
  return format !== "sxi" && format !== "ssf"
}

export function exportFormatFromPath(path: string): ExportFormat | undefined {
  const match = path.match(/\.([^.\\/]+)$/)
  const extension = match?.[1].toLowerCase()
  return extension === "bdi" || extension === "bds" || extension === "bda"
    ? extension
    : undefined
}

function exportPath(path: string, format: ExportTarget): string {
  return /\.[^.\\/]+$/.test(path) ? path.replace(/\.[^.\\/]+$/, `.${format}`) : `${path}.${format}`
}

export function exportName(name: string, format: ExportTarget): string {
  return exportPath(name || "未命名皮肤", format).split(/[\\/]/).pop()!
}
