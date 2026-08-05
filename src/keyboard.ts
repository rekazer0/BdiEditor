import { IniDocument } from "./ini.ts"

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
    width: Number.isFinite(size[0]) ? size[0] : 1125,
    height: Number.isFinite(size[1]) ? size[1] : 648,
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
  const width = Number.isFinite(size[0]) ? size[0] : 1125
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
