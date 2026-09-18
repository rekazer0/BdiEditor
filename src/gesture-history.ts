import { pushChange, type Change } from "./history"

/** Compact many gesture snapshots to first-before / final-after, including BDA bytes. */
export function compactGestureChanges(changes: readonly Change[]): Change[] {
  const result: Change[] = []
  const index = new Map<string, number>()
  const visit = (change: Change) => {
    if (change.kind === "batch") { change.changes.forEach(visit); return }
    const key = `${change.kind}:${change.path}`
    const at = index.get(key)
    if (at === undefined) {
      index.set(key, result.length)
      result.push({ ...change })
    } else {
      const first = result[at]
      if (first.kind === "text" && change.kind === "text") first.after = change.after
      if (first.kind === "bytes" && change.kind === "bytes") first.after = change.after
    }
  }
  changes.forEach(visit)
  return result
}

export function createGestureHistory() {
  let active: { token: object; stack: Change[]; entry: Extract<Change, { kind: "batch" }> } | undefined
  return (stack: Change[], change: Change, token?: object, coalesce = false): void => {
    if (!token) {
      active = undefined
      pushChange(stack, change, coalesce)
      return
    }
    if (active?.token === token && active.stack === stack && stack.at(-1) === active.entry) {
      active.entry.changes = compactGestureChanges([...active.entry.changes, change])
    } else {
      const entry: Extract<Change, { kind: "batch" }> = { kind: "batch", changes: compactGestureChanges([change]) }
      stack.push(entry)
      active = { token, stack, entry }
    }
  }
}
