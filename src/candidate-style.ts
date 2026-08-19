import type { VisualResolver } from "./atlas.ts"
import type { IniDocument } from "./ini.ts"

export const OFFICIAL_INPUT_VERTICAL_PADDING = 5

function firstStyle(value: string | undefined): string {
  return value?.split(",")[0]?.trim() ?? ""
}

export type CandidateInputStyle = {
  backgroundStyle: string
  foregroundStyle: string
  height: number
}

export function resolveCandidateInputStyle(
  general: IniDocument | undefined,
  resolver: VisualResolver,
  fallbackHeight: number,
): CandidateInputStyle {
  const backgroundStyle = firstStyle(
    general?.get("SCAND", "BACK_STYLE") ?? general?.get("INPUT", "BACK_STYLE"),
  )
  const foregroundStyle = (
    general?.get("SCAND", "INPUT_STYLE") ?? general?.get("INPUT", "FORE_STYLE") ?? ""
  ).trim()
  const fontSize = resolver.resolveText(foregroundStyle, false)?.fontSize
  const sourceHeight = resolver.sourceSize?.(backgroundStyle, false)?.height
  const height = fontSize && fontSize > 0
    ? fontSize + OFFICIAL_INPUT_VERTICAL_PADDING
    : sourceHeight && sourceHeight > 0
      ? sourceHeight
      : fallbackHeight
  return { backgroundStyle, foregroundStyle, height }
}
