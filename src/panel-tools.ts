import { IniDocument } from "./ini.ts"
import { knownSkinStates } from "./actions.ts"

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
    const styleStates = key === "STAT_STYLE"
      ? [...value.matchAll(/(?:^|\|)S(\d+)_/g)].map((match) => Number(match[1]))
      : []
    const actionState = value.trim().match(/^S(\d+)(?:_\d+)?$/)
    return [...styleStates, ...(actionState ? [Number(actionState[1])] : [])]
  })
  return [...new Set([...knownSkinStates, ...states].filter((state) => state >= 1 && state <= 122))]
    .sort((a, b) => a - b)
}

export function stateStyleValue(value: string | undefined, state: number): number | undefined {
  const match = value?.match(new RegExp(`(?:^|\\|)S${state}_(\\d+)(?:\\||$)`))
  return match ? Number(match[1]) : undefined
}

export function stateTipSection(
  value: string | undefined,
  state: number | undefined,
): number | undefined {
  if (state === undefined || state <= 0 || state > 122) return
  return stateStyleValue(value, state)
}

export function effectivePanelSection(
  document: IniDocument,
  section: string,
  state: number | undefined,
): string {
  const tip = stateTipSection(document.get(section, "STAT_STYLE"), state)
  const target = tip === undefined ? undefined : `TIP${tip}`
  return target && document.sections().includes(target) ? target : section
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

export function canvasFitWidth(
  availableWidth: number,
  availableHeight: number,
  logicalWidth: number,
  logicalHeight: number,
): number {
  if (![availableWidth, availableHeight, logicalWidth, logicalHeight].every((value) => value > 0)) return 0
  return logicalWidth * Math.min(1, availableWidth / logicalWidth, availableHeight / logicalHeight)
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

export function scalePanelDocument(
  source: IniDocument,
  xRatio: number,
  yRatio: number,
  targetWidth: number,
  targetHeight: number,
): IniDocument {
  const output = scaleIniDocument(source, xRatio, yRatio)
  if (!output.sections().includes("PANEL")) output.appendSection("PANEL", [])
  output.set("PANEL", "SIZE", `${Math.round(targetWidth)},${Math.round(targetHeight)}`)
  return output
}

export function variantCopyPaths(
  names: readonly string[],
  sourceTheme: string,
  sourceOrientation: string,
  targetTheme: string,
  targetOrientation: string,
): Array<{ source: string; target: string }> {
  const existing = new Set(names)
  const themeChange = sourceTheme !== targetTheme
  const sourcePrefix = themeChange
    ? `${sourceTheme}/skin/`
    : `${sourceTheme}/skin/${sourceOrientation}/`
  const targetPrefix = themeChange
    ? `${targetTheme}/skin/`
    : `${targetTheme}/skin/${targetOrientation}/`
  return names.flatMap((source) => {
    if (!source.startsWith(sourcePrefix) || source.endsWith("/")) return []
    const target = `${targetPrefix}${source.slice(sourcePrefix.length)}`
    return existing.has(target) ? [] : [{ source, target }]
  }).sort((a, b) => a.source.localeCompare(b.source))
}

export function copyablePanelPaths(names: readonly string[]): string[] {
  return names.filter((path) =>
    /^(?:light|dark)\/skin\/(?:port|land)\/[^/]+\.ini$/i.test(path) &&
    !path.toLowerCase().endsWith("/gen.ini"),
  ).sort((a, b) => a.localeCompare(b))
}

export function validPanelFilename(value: string): boolean {
  return value === value.trim() &&
    /^[^/\\\0]+\.ini$/i.test(value) &&
    !/^\.+\.ini$/i.test(value) &&
    value.toLowerCase() !== "gen.ini"
}

export function panelStyleIDs(document: IniDocument): number[] {
  const ids = document.entries().flatMap(({ key, value }) => {
    if (key === "STAT_STYLE") {
      return [...value.matchAll(/(?:^|\|)S\d+_(\d+)/g)].map((match) => Number(match[1]))
    }
    if (!key.endsWith("_STYLE")) return []
    return value.split(",").map(Number).filter(Number.isFinite)
  })
  return [...new Set(ids.filter((id) => id > 0))].sort((a, b) => a - b)
}

export function rewritePanelStyleIDs(
  source: IniDocument,
  replacements: ReadonlyMap<number, number>,
): IniDocument {
  const output = IniDocument.parse(source.toString())
  for (const { section, key, value } of output.entries()) {
    if (key === "STAT_STYLE") {
      output.set(section, key, value.replace(/(S\d+_)(\d+)/g, (_, prefix, id) =>
        `${prefix}${replacements.get(Number(id)) ?? id}`,
      ))
    } else if (key.endsWith("_STYLE")) {
      output.set(section, key, value.replace(/\d+/g, (id) => String(replacements.get(Number(id)) ?? id)))
    }
  }
  return output
}

function sameEntries(
  left: readonly { key: string; value: string }[],
  right: readonly { key: string; value: string }[],
): boolean {
  return left.length === right.length && left.every((entry, index) =>
    entry.key === right[index]?.key && entry.value === right[index]?.value,
  )
}

export function mergePanelStyles(
  panel: IniDocument,
  source: IniDocument,
  target: IniDocument,
): { panel: IniDocument; styles: IniDocument; styleIDs: Map<number, number> } {
  const styles = IniDocument.parse(target.toString())
  const occupied = new Set(styles.sections().flatMap((section) => {
    const match = section.match(/^STYLE(\d+)$/)
    return match ? [Number(match[1])] : []
  }))
  const styleIDs = new Map<number, number>()
  let next = Math.max(0, ...occupied) + 1
  for (const sourceID of panelStyleIDs(panel)) {
    const entries = source.entries(`STYLE${sourceID}`)
    if (!entries.length) throw new Error(`源样式 STYLE${sourceID} 不存在`)
    const targetEntries = styles.entries(`STYLE${sourceID}`)
    let targetID = sourceID
    if (targetEntries.length && sameEntries(entries, targetEntries)) {
      styleIDs.set(sourceID, targetID)
      continue
    }
    if (targetEntries.length || occupied.has(targetID)) {
      while (occupied.has(next)) next += 1
      targetID = next++
    }
    styles.appendSection(`STYLE${targetID}`, entries.map(({ key, value }) => ({ key, value })))
    occupied.add(targetID)
    styleIDs.set(sourceID, targetID)
  }
  if (!styles.sections().includes("GLOBAL")) styles.appendSection("GLOBAL", [])
  styles.set("GLOBAL", "STYLE_NUM", String(Math.max(0, ...occupied)))
  return { panel: rewritePanelStyleIDs(panel, styleIDs), styles, styleIDs }
}

export function rewriteStyleImageBases(
  source: IniDocument,
  styleIDs: readonly number[],
  replacements: ReadonlyMap<string, string>,
): IniDocument {
  const output = IniDocument.parse(source.toString())
  for (const styleID of styleIDs) {
    for (const property of ["NM_IMG", "HL_IMG"]) {
      const value = output.get(`STYLE${styleID}`, property)
      if (!value) continue
      const comma = value.indexOf(",")
      const base = (comma < 0 ? value : value.slice(0, comma)).trim()
      const replacement = replacements.get(base)
      if (replacement) output.set(`STYLE${styleID}`, property, `${replacement}${comma < 0 ? "" : value.slice(comma)}`)
    }
  }
  return output
}

function sameBytes(left: Uint8Array | undefined, right: Uint8Array): boolean {
  return Boolean(left && left.length === right.length && left.every((byte, index) => byte === right[index]))
}

export function copiedResourceBase(
  base: string,
  png: Uint8Array,
  til: Uint8Array,
  existing: ReadonlyMap<string, { png?: Uint8Array; til?: Uint8Array }>,
  forceCopy = false,
): string {
  let candidate = base
  let copy = 2
  while (existing.has(candidate)) {
    const pair = existing.get(candidate)!
    if (!forceCopy && sameBytes(pair.png, png) && sameBytes(pair.til, til)) return candidate
    candidate = `${base}_copy${copy++}`
  }
  return candidate
}
