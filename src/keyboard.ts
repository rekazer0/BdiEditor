import { IniDocument } from "./ini.ts"

export const DEFAULT_PANEL_WIDTH = 1125
export const DEFAULT_PANEL_HEIGHT = 648
export const DEFAULT_CANDIDATE_HEIGHT = 133
export const DEFAULT_BDA_PANEL_WIDTH = 1080
export const DEFAULT_BDA_PANEL_HEIGHT = 641

export type KeyboardConfig = {
  width: number
  height: number
  styleID: string
  normalImage: string
  pressedImage: string
  normalColor: string
  pressedColor: string
}

export function backgroundStyleSections(
  layout: IniDocument,
  keySections: string[],
): string[] {
  return [
    ...new Set(
      keySections.flatMap((section) => {
        const id = layout.get(section, "BACK_STYLE")?.split(",")[0].trim()
        return id && /^\d+$/.test(id) ? [`STYLE${id}`] : []
      }),
    ),
  ]
}

export function keyboardConfig(gen: IniDocument, styles: IniDocument): KeyboardConfig {
  const size = gen.get("PANEL", "SIZE")?.split(",").map(Number) ?? []
  const styleID = gen.get("PANEL", "BACK_STYLE")?.split(",")[0].trim() ?? ""
  const section = styleID ? `STYLE${styleID}` : ""
  return {
    width: Number.isFinite(size[0]) ? size[0] : DEFAULT_PANEL_WIDTH,
    height: Number.isFinite(size[1]) ? size[1] : DEFAULT_PANEL_HEIGHT,
    styleID,
    normalImage: styles.get(section, "NM_IMG") ?? "",
    pressedImage: styles.get(section, "HL_IMG") ?? "",
    normalColor: styles.get(section, "NM_COLOR") ?? "",
    pressedColor: styles.get(section, "HL_COLOR") ?? "",
  }
}

function positiveFiniteSize(value: string | undefined): number | undefined {
  const size = Number(value)
  return Number.isFinite(size) && size > 0 ? size : undefined
}

function panelSize(document: IniDocument): [number | undefined, number | undefined] {
  const [width, height] = document.get("PANEL", "SIZE")?.split(",") ?? []
  return [positiveFiniteSize(width), positiveFiniteSize(height)]
}

function panelStyleID(document: IniDocument): string | undefined {
  const id = document.get("PANEL", "BACK_STYLE")?.split(",")[0].trim()
  return id && /^\d+$/.test(id) ? id : undefined
}

export function resolvePanelConfig(
  layout: IniDocument,
  gen: IniDocument,
  styles: IniDocument,
): KeyboardConfig {
  const [layoutWidth, layoutHeight] = panelSize(layout)
  const [generalWidth, generalHeight] = panelSize(gen)
  const styleID = panelStyleID(layout) ?? panelStyleID(gen) ?? ""
  const section = styleID ? `STYLE${styleID}` : ""
  return {
    width: layoutWidth ?? generalWidth ?? DEFAULT_PANEL_WIDTH,
    height: layoutHeight ?? generalHeight ?? DEFAULT_PANEL_HEIGHT,
    styleID,
    normalImage: styles.get(section, "NM_IMG") ?? "",
    pressedImage: styles.get(section, "HL_IMG") ?? "",
    normalColor: styles.get(section, "NM_COLOR") ?? "",
    pressedColor: styles.get(section, "HL_COLOR") ?? "",
  }
}

export function setKeyboardHeight(gen: IniDocument, height: number): boolean {
  if (!Number.isFinite(height) || height <= 0) return false
  const size = gen.get("PANEL", "SIZE")?.split(",").map(Number) ?? []
  const width = Number.isFinite(size[0]) ? size[0] : DEFAULT_PANEL_WIDTH
  return gen.set("PANEL", "SIZE", `${Math.round(width)},${Math.round(height)}`)
}

export function setStyleField(
  styles: IniDocument,
  sections: string[],
  key: string,
  value: string,
): boolean {
  let changed = false
  for (const section of sections) changed = styles.set(section, key, value) || changed
  return changed
}
