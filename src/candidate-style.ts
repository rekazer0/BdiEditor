import type { TextVisual, VisualResolver } from "./atlas.ts"
import type { IniDocument } from "./ini.ts"
import { DEFAULT_CANDIDATE_HEIGHT, DEFAULT_PANEL_WIDTH } from "./keyboard.ts"

export type CandidateRect = { x: number; y: number; width: number; height: number }

function candidateRect(document: IniDocument | undefined): CandidateRect | undefined {
  const values = document?.get("CAND", "VIEW_RECT")?.split(",").map(Number)
  if (!values || values.length !== 4 || values.some((value) => !Number.isFinite(value))) return
  const [x, y, width, height] = values
  return width > 0 && height > 0 ? { x, y, width, height } : undefined
}

export function resolveCandidateRect(
  candidate: IniDocument | undefined,
  general: IniDocument | undefined,
): CandidateRect {
  const configured = candidateRect(candidate) ?? candidateRect(general)
  if (configured) return configured
  const panelWidth = Number(general?.get("PANEL", "SIZE")?.split(",")[0])
  return {
    x: 0,
    y: 0,
    width: Number.isFinite(panelWidth) && panelWidth > 0 ? panelWidth : DEFAULT_PANEL_WIDTH,
    height: DEFAULT_CANDIDATE_HEIGHT,
  }
}

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

export function candidateInputForegroundStyle(
  general: IniDocument | undefined,
  candidate?: IniDocument,
): string {
  return [
    candidate?.get("CAND", "INPUT_STYLE"),
    candidate?.get("INPUT", "FORE_STYLE"),
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
  candidate?: IniDocument,
): CandidateInputStyle {
  const foregroundStyle = candidateInputForegroundStyle(general, candidate)
  const fontSize = resolver.resolveText(foregroundStyle, false)?.fontSize
  const height = fontSize && fontSize > 0 ? fontSize + (inputInset(width) * 2) : 0
  return { foregroundStyle, height }
}
