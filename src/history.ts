export type Change =
  | { kind: "text"; path: string; before: string; after: string }
  | { kind: "bytes"; path: string; before?: Uint8Array; after?: Uint8Array }
  | { kind: "batch"; changes: Change[] }

// 每步保存整份文件的前后内容，不设上限会让内存随编辑次数线性增长。
const HISTORY_LIMIT = 200

export function trimHistory(stack: Change[]): void {
  if (stack.length > HISTORY_LIMIT) stack.splice(0, stack.length - HISTORY_LIMIT)
}

export function pushChange(stack: Change[], change: Change, coalesce = false): void {
  const previous = stack.at(-1)
  if (
    coalesce && previous?.kind === "text" && change.kind === "text" &&
    previous.path === change.path && previous.after === change.before
  ) previous.after = change.after
  else {
    stack.push(change)
    trimHistory(stack)
  }
}
