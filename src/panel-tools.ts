import { IniDocument } from "./ini.ts"

const pairKeys = new Set(["SIZE", "POS", "CELL_SIZE", "FIX_SIZE"])
const rectKeys = new Set(["VIEW_RECT", "TOUCH_RECT", "SOURCE_RECT", "INNER_RECT"])

function scaled(value: string, xRatio: number, yRatio: number): string {
  return value.split(",").map((token, index) => {
    const number = Number(token)
    if (!Number.isFinite(number)) return token
    const ratio = index % 2 ? yRatio : xRatio
    return String(Math.round(number * ratio))
  }).join(",")
}

export function availableSkinStates(...documents: IniDocument[]): number[] {
  const states = documents.flatMap((document) => document.entries()).flatMap(({ key, value }) => {
    if (key !== "STAT_STYLE") return []
    return [...value.matchAll(/(?:^|\|)S(\d+)_/g)].map((match) => Number(match[1]))
  })
  return [...new Set(states)].sort((a, b) => a - b)
}

export function stateStyleValue(value: string | undefined, state: number): number | undefined {
  const match = value?.match(new RegExp(`(?:^|\\|)S${state}_(\\d+)(?:\\||$)`))
  return match ? Number(match[1]) : undefined
}

export function stateTipSection(
  value: string | undefined,
  state: number | undefined,
): number | undefined {
  if (state === undefined || state < 1 || state > 99) return
  return stateStyleValue(value, state)
}

export function previewScalePercent(
  renderedWidth: number,
  renderedHeight: number,
  panelWidth: number,
  panelHeight: number,
): number {
  if (![renderedWidth, renderedHeight, panelWidth, panelHeight].every((value) => value > 0)) return 0
  return Math.round(Math.min(renderedWidth / panelWidth, renderedHeight / panelHeight) * 100)
}

export function scaleIniDocument(
  source: IniDocument,
  xRatio: number,
  yRatio: number,
): IniDocument {
  const output = IniDocument.parse(source.toString())
  for (const { section, key, value } of output.entries()) {
    if (rectKeys.has(key) && value.split(",").length === 4) {
      output.set(section, key, scaled(value, xRatio, yRatio))
    } else if ((pairKeys.has(key) || key === "PADDING") && value.split(",").length % 2 === 0) {
      output.set(section, key, scaled(value, xRatio, yRatio))
    } else if (key === "FORE_OFFSET") {
      output.set(section, key, value.split(";").map((part) => scaled(part, xRatio, yRatio)).join(";"))
    }
  }
  return output
}

export function panelConversionPaths(
  names: readonly string[],
  themes: readonly string[],
): Array<{ source: string; target: string }> {
  return names.flatMap((source) => {
    const match = source.match(/^(light|dark)\/skin\/port\/(.+)$/)
    if (!match || !themes.includes(match[1]) || source.endsWith("/")) return []
    return [{ source, target: `${match[1]}/skin/land/${match[2]}` }]
  }).sort((a, b) => a.source.localeCompare(b.source))
}
