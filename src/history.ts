export type Change =
  | { kind: "text"; path: string; before: string; after: string }
  | { kind: "bytes"; path: string; before?: Uint8Array; after?: Uint8Array }
  | { kind: "batch"; changes: Change[] }

export function pushChange(stack: Change[], change: Change, coalesce = false): void {
  const previous = stack.at(-1)
  if (
    coalesce && previous?.kind === "text" && change.kind === "text" &&
    previous.path === change.path && previous.after === change.before
  ) previous.after = change.after
  else stack.push(change)
}
