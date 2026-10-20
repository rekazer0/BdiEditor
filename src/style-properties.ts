import { IniDocument } from "./ini.ts"

export type StylePropertySource = {
  section: string
  value: string
}

function stylePropertySource(
  document: IniDocument,
  foreground: string,
  property: string,
): StylePropertySource | undefined {
  const sections = new Set(document.sections())
  const visited = new Set<string>()
  const tokens = foreground.split(",").map((token) => token.trim()).filter(Boolean)
  for (const token of tokens) {
    const value = Number(token)
    const candidates = [`STYLE${token}`]
    if (Number.isFinite(value)) candidates.push(`STYLE${Math.floor(value / 100)}`)
    for (const section of candidates) {
      if (!sections.has(section) || visited.has(section)) continue
      visited.add(section)
      const propertyValue = document.get(section, property)
      if (propertyValue !== undefined) return { section, value: propertyValue }
    }
  }
}

export function resolveStylePropertyLayers(
  document: IniDocument,
  foreground: string,
  property: string,
): StylePropertySource[] {
  return foreground.split(",").map((token) => token.trim()).filter(Boolean).flatMap((token) =>
    stylePropertySource(document, token, property) ?? []
  )
}

/**
 * Where each foreground keeps `property`: the first layer that sets it, else its first text style
 * (value "") so the property can be added. Undefined when a foreground draws no text at all.
 */
export function resolveStylePropertySources(
  document: IniDocument,
  foregrounds: string[],
  property: string,
): StylePropertySource[] | undefined {
  const sources = foregrounds.map((foreground) => {
    const text = textStyleSections(document, foreground)[0]
    return stylePropertySource(document, foreground, property) ?? (text ? { section: text, value: "" } : undefined)
  })
  if (!sources.length || sources.some((source) => !source)) return
  return sources as StylePropertySource[]
}

/**
 * The text styles a FORE_STYLE draws: each layer's `STYLE<n>`, else `STYLE<⌊n/100⌋>`, skipping image
 * layers (NM_IMG / HL_IMG). New text properties are written here when no layer has them yet.
 */
export function textStyleSections(document: IniDocument, foreground: string): string[] {
  const sections = new Set(document.sections())
  const found = new Set<string>()
  for (const token of foreground.split(",").map((part) => part.trim()).filter(Boolean)) {
    const value = Number(token)
    const section = [`STYLE${token}`, ...Number.isFinite(value) ? [`STYLE${Math.floor(value / 100)}`] : []]
      .find((name) => sections.has(name))
    if (section && document.get(section, "NM_IMG") === undefined && document.get(section, "HL_IMG") === undefined) found.add(section)
  }
  return [...found]
}
