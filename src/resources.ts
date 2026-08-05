export function imagePathForSpec(
  names: readonly string[],
  theme: string,
  orientation: string,
  spec: string,
): string | undefined {
  const name = spec.split(",")[0]?.trim().replace(/\.png$/i, "")
  if (!name) return
  return [
    `${theme}/skin/${orientation}/res/${name}.png`,
    `${theme}/skin/res/${name}.png`,
  ].find((path) => names.includes(path))
}

export function firstExistingPath(
  names: readonly string[],
  directory: string,
  candidates: readonly string[],
): string | undefined {
  return candidates.map((name) => `${directory}/${name}`).find((path) => names.includes(path))
}
