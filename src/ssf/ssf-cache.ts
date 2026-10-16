// An SSF document's preview is converted again after every edit, and most derived images (recoloured
// glyphs, cut backgrounds, padded foregrounds) come out the same. They are cached by the bytes they are
// made from, so an edit only rebuilds what it actually changed.

const LIMIT = 1024
const fingerprints = new WeakMap<Uint8Array, string>()
const entries = new Map<string, unknown>()

/** FNV-1a and length of `bytes`, remembered per array (package files are replaced, never mutated). */
export function fingerprint(bytes: Uint8Array): string {
  let value = fingerprints.get(bytes)
  if (!value) {
    let hash = 0x811c9dc5
    for (const byte of bytes) hash = Math.imul(hash ^ byte, 0x01000193)
    value = `${(hash >>> 0).toString(16)}:${bytes.length}`
    fingerprints.set(bytes, value)
  }
  return value
}

/**
 * `build()`'s result for `key`, built once; the oldest entries go first past the limit. A failed build
 * (undefined) is not kept, so the warnings it reports come back the next time.
 */
export function cached<T>(key: string, build: () => T | undefined): T | undefined {
  if (entries.has(key)) return entries.get(key) as T
  const value = build()
  if (value === undefined) return
  if (entries.size >= LIMIT) entries.delete(entries.keys().next().value!)
  entries.set(key, value)
  return value
}
