export type ExportFormat = "bdi" | "bds" | "bda"

// `.sxi` is a read-only export target: it is produced by the Palm skin converter,
// never edited in place, so it is not a `SkinArchive` package format.
export type ExportTarget = ExportFormat | "sxi"

export function isExportFormat(format: ExportTarget): format is ExportFormat {
  return format !== "sxi"
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
