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

export function resolveStylePropertySources(
  document: IniDocument,
  foregrounds: string[],
  property: string,
): StylePropertySource[] | undefined {
  const sources = foregrounds.map((foreground) =>
    stylePropertySource(document, foreground, property),
  )
  if (!sources.length || sources.some((source) => !source)) return
  return sources as StylePropertySource[]
}
