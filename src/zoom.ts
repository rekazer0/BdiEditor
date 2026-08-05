const MIN_ZOOM = 50
const MAX_ZOOM = 150
const ZOOM_STEP = 10

export function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value))
}

export function stepZoom(value: number, direction: -1 | 1): number {
  return clampZoom(value + direction * ZOOM_STEP)
}
