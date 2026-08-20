import type { TextVisual, VisualResolver } from "./atlas.ts"
import type { IniDocument } from "./ini.ts"

function inputInset(width: number): number {
  const density = width <= 240 ? 0.75
    : width < 360 ? 1
    : width < 480 ? 1.2
    : width < 600 ? 1.5
    : width < 720 ? 2
    : width < 800 ? 2.25
    : width < 960 ? 2.5
    : width < 1080 ? 3
    : width < 1152 ? 3.3
    : width < 1280 ? 3.6
    : 4.4
  return Math.trunc(density * 2.5)
}

export type CandidateInputStyle = {
  foregroundStyle: string
  height: number
}

export function candidateInputForegroundStyle(general: IniDocument | undefined): string {
  return [
    general?.get("SCAND", "INPUT_STYLE"),
    general?.get("INPUT", "FORE_STYLE"),
    general?.get("SCAND", "FORE_STYLE"),
  ].map((value) => value?.trim() ?? "").find(Boolean) ?? ""
}

export function resolveCandidateTextVisuals(
  candidate: IniDocument | undefined,
  general: IniDocument | undefined,
  resolver: VisualResolver,
): { normal: TextVisual | undefined; first: TextVisual | undefined } {
  return {
    normal: resolver.resolveText(
      candidate?.get("CAND", "FORE_STYLE") ?? general?.get("SCAND", "SCAND_STYLE") ?? "",
      false,
    ),
    first: resolver.resolveText(candidate?.get("CAND", "FIRST_FORE") ?? "", false),
  }
}

export function resolveCandidateInputStyle(
  general: IniDocument | undefined,
  resolver: VisualResolver,
  width: number,
): CandidateInputStyle {
  const foregroundStyle = candidateInputForegroundStyle(general)
  const fontSize = resolver.resolveText(foregroundStyle, false)?.fontSize
  const height = fontSize && fontSize > 0 ? fontSize + (inputInset(width) * 2) : 0
  return { foregroundStyle, height }
}
