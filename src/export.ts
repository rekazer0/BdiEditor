export type ExportFormat = "bdi" | "bds" | "bda" | "sxi"

// BDI/BDS skins export to each other and to `.sxi`; BDA also exports to BDA; an opened `.sxi`
// is edited natively and only saves as `.sxi`.
export function canExport(source: ExportFormat, target: ExportFormat): boolean {
  if (source === "sxi") return target === "sxi"
  return target !== "bda" || source === "bda"
}

export function exportFormatFromPath(path: string): ExportFormat | undefined {
  const match = path.match(/\.([^.\\/]+)$/)
  const extension = match?.[1].toLowerCase()
  return extension === "bdi" || extension === "bds" || extension === "bda" || extension === "sxi"
    ? extension
    : undefined
}

function exportPath(path: string, format: ExportFormat): string {
  return /\.[^.\\/]+$/.test(path) ? path.replace(/\.[^.\\/]+$/, `.${format}`) : `${path}.${format}`
}

export function exportName(name: string, format: ExportFormat): string {
  return exportPath(name || "未命名皮肤", format).split(/[\\/]/).pop()!
}
