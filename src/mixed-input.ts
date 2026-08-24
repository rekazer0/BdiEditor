export function shouldClearMixedInput(
  key: string,
  placeholder: string,
  disabled: boolean,
): boolean {
  return !disabled && placeholder === "混合" && (key === "Delete" || key === "Backspace")
}

export function mixedCoordinateDelta(
  name: string,
  placeholder: string,
  disabled: boolean,
  direction: number,
): readonly [number, number] | undefined {
  if (disabled || placeholder !== "混合" || !direction || (name !== "x" && name !== "y")) return
  const delta = Math.sign(direction)
  return name === "x" ? [delta, 0] : [0, delta]
}
