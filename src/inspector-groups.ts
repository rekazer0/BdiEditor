export function inspectorGroupPositionPercent(
  pointerClientY: number,
  containerTop: number,
  containerHeight: number,
  groupHeight: number,
  pointerToCenterY: number,
): number {
  if (!containerHeight) return 50
  const half = groupHeight / 2
  const center = Math.min(
    Math.max(pointerClientY - containerTop - pointerToCenterY, half),
    containerHeight - half,
  )
  return center / containerHeight * 100
}
