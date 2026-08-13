export type ExportFormat = "bdi" | "bds" | "bda"

export function exportFormatFromPath(path: string): ExportFormat | undefined {
  const match = path.match(/\.([^.\\/]+)$/)
  const extension = match?.[1].toLowerCase()
  return extension === "bdi" || extension === "bds" || extension === "bda"
    ? extension
    : undefined
}

export function exportPath(path: string, format: ExportFormat): string {
  return /\.[^.\\/]+$/.test(path) ? path.replace(/\.[^.\\/]+$/, `.${format}`) : `${path}.${format}`
}

export function exportName(name: string, format: ExportFormat): string {
  return exportPath(name || "未命名皮肤", format).split(/[\\/]/).pop()!
}

export function isUnnamedSkinName(name: string): boolean {
  const base = name.split(/[\\/]/).pop()?.replace(/\.(bdi|bds|bda)$/i, "").trim() ?? ""
  return /^未命名(?:皮肤)?(?:\s*\(\d+\))?$/.test(base)
}
