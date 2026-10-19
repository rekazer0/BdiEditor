/** Package formats the editor opens, edits and saves in place. */
export type ExportFormat = "bdi" | "bds" | "bda" | "ssf" | "sxi"

export function canExport(source: ExportFormat, target: ExportFormat): boolean {
  // Palm (.sxi) is its own format; a Baidu package and BDA are both produced by conversion.
  if (source === "sxi") return target !== "ssf"
  if (source === "ssf") return target !== "sxi"
  return target !== "bda" || source === "bda"
}

export function exportFormatFromPath(path: string): ExportFormat | undefined {
  const match = path.match(/\.([^.\\/]+)$/)
  const extension = match?.[1].toLowerCase()
  if (extension === "mssf") return "ssf"
  return extension === "bdi" || extension === "bds" || extension === "bda" || extension === "ssf" || extension === "sxi"
    ? extension
    : undefined
}

function exportPath(path: string, format: ExportFormat): string {
  return /\.[^.\\/]+$/.test(path) ? path.replace(/\.[^.\\/]+$/, `.${format}`) : `${path}.${format}`
}

export function exportName(name: string, format: ExportFormat): string {
  return exportPath(name || "未命名皮肤", format).split(/[\\/]/).pop()!
}
