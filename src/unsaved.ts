export type UnsavedDecision = "save" | "discard" | "cancel"

export function unsavedDecision(result: string): UnsavedDecision {
  if (result === "save" || result === "保存" || result === "Yes") return "save"
  if (result === "discard" || result === "不保存" || result === "No") return "discard"
  return "cancel"
}
