import { IniDocument } from "./ini.ts"

const CANDIDATE_INFO = "iOS26透明候选背景"
const PANEL_INFO = "iOS26透明键盘背景"
/** The colour under both transparent backgrounds; the panel keeps alpha 01 so it still takes touches. */
export const IOS26_RGB = "d0d4db"

function styleByInfo(styles: IniDocument, info: string): string | undefined {
  return styles.sections().find((section) => /^STYLE\d+$/.test(section) && styles.get(section, "INFO") === info)?.slice(5)
}

function nextStyle(styles: IniDocument): string {
  return String(Math.max(0, ...styles.sections().map((section) => Number(section.match(/^STYLE(\d+)$/)?.[1] ?? 0))) + 1)
}

function ensureStyle(styles: IniDocument, info: string, alpha: "00" | "01"): string {
  const existing = styleByInfo(styles, info)
  if (existing) return existing
  const id = nextStyle(styles)
  styles.appendSection(`STYLE${id}`, [
    { key: "INFO", value: info },
    { key: "NM_COLOR", value: `${alpha}${IOS26_RGB}` },
    { key: "HL_COLOR", value: `${alpha}${IOS26_RGB}` },
  ])
  return id
}

function setSectionValue(document: IniDocument, section: string, key: string, value: string): void {
  if (!document.sections().includes(section)) document.appendSection(section, [{ key, value }])
  else document.set(section, key, value)
}

export function adaptIos26Variant(candidateText: string, generalText: string, styleText: string): {
  candidate: string
  general: string
  panelStyle: string
  styles: string
} {
  const candidate = IniDocument.parse(candidateText)
  const general = IniDocument.parse(generalText)
  const styles = IniDocument.parse(styleText)
  const candidateStyle = ensureStyle(styles, CANDIDATE_INFO, "00")
  const panelStyle = ensureStyle(styles, PANEL_INFO, "01")
  setSectionValue(candidate, "CAND", "BACK_STYLE", candidateStyle)
  setSectionValue(general, "SCAND", "BACK_STYLE", candidateStyle)
  return {
    candidate: candidate.toString(),
    general: general.toString(),
    panelStyle,
    styles: styles.toString(),
  }
}

/** Keyboards and the symbol panel get the transparent background; emoji, clipboard and other pages keep theirs. */
export function isIos26KeyboardLayout(name: string, symbolLayoutName = "symbol"): boolean {
  const symbolName = `${symbolLayoutName.replace(/\.ini$/i, "")}.ini`
  return /^(?:(?:py|def|en|num|tool)_.+|bh|hw_(?:full|grid))\.ini$/i.test(name) || name.toLowerCase() === symbolName.toLowerCase()
}

export function adaptIos26KeyboardLayout(
  name: string,
  text: string,
  panelStyle: string,
  symbolLayoutName = "symbol",
): string {
  if (!isIos26KeyboardLayout(name, symbolLayoutName)) return text
  const layout = IniDocument.parse(text)
  layout.set("PANEL", "BACK_STYLE", panelStyle)
  return layout.toString()
}

