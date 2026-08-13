import { IniDocument } from "./ini.ts"

const CANDIDATE_INFO = "iOS26透明候选背景"

function styleByInfo(styles: IniDocument, info: string): string | undefined {
  return styles.sections().find((section) => /^STYLE\d+$/.test(section) && styles.get(section, "INFO") === info)?.slice(5)
}

function nextStyle(styles: IniDocument): string {
  return String(Math.max(0, ...styles.sections().map((section) => Number(section.match(/^STYLE(\d+)$/)?.[1] ?? 0))) + 1)
}

function ensureStyle(styles: IniDocument, info: string): string {
  const existing = styleByInfo(styles, info)
  if (existing) return existing
  const id = nextStyle(styles)
  styles.appendSection(`STYLE${id}`, [
    { key: "INFO", value: info },
    { key: "NM_COLOR", value: "00d0d4db" },
    { key: "HL_COLOR", value: "00d0d4db" },
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
  styles: string
} {
  const candidate = IniDocument.parse(candidateText)
  const general = IniDocument.parse(generalText)
  const styles = IniDocument.parse(styleText)
  const candidateStyle = ensureStyle(styles, CANDIDATE_INFO)
  setSectionValue(candidate, "CAND", "BACK_STYLE", candidateStyle)
  setSectionValue(general, "SCAND", "BACK_STYLE", candidateStyle)
  return {
    candidate: candidate.toString(),
    general: general.toString(),
    styles: styles.toString(),
  }
}

export function isIos26Adapted(candidateText: string | undefined, generalText: string | undefined): boolean {
  if (!candidateText || !generalText) return false
  const candidate = IniDocument.parse(candidateText)
  const general = IniDocument.parse(generalText)
  const candidateStyle = candidate.get("CAND", "BACK_STYLE")
  return Boolean(candidateStyle && general.get("SCAND", "BACK_STYLE") === candidateStyle)
}
