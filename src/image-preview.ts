export function replaceImagePreviewURL(
  previous: string,
  bytes: Uint8Array,
  createURL: (blob: Blob) => string = URL.createObjectURL,
  revokeURL: (url: string) => void = URL.revokeObjectURL,
): string {
  if (previous) revokeURL(previous)
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return createURL(new Blob([copy.buffer], { type: "image/png" }))
}

export function releaseImagePreviewURL(
  current: string,
  revokeURL: (url: string) => void = URL.revokeObjectURL,
): "" {
  if (current) revokeURL(current)
  return ""
}
