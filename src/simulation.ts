export function insertText(
  value: string,
  start: number,
  end: number,
  insertion: string,
): { value: string; caret: number } {
  const safeStart = Math.max(0, Math.min(start, value.length))
  const safeEnd = Math.max(safeStart, Math.min(end, value.length))
  return {
    value: value.slice(0, safeStart) + insertion + value.slice(safeEnd),
    caret: safeStart + insertion.length,
  }
}

export function deleteBackward(
  value: string,
  start: number,
  end: number,
): { value: string; caret: number } {
  const safeStart = Math.max(0, Math.min(start, value.length))
  const safeEnd = Math.max(safeStart, Math.min(end, value.length))
  if (safeEnd > safeStart) {
    return { value: value.slice(0, safeStart) + value.slice(safeEnd), caret: safeStart }
  }
  if (safeStart === 0) return { value, caret: 0 }
  const previous = Array.from(value.slice(0, safeStart)).at(-1) ?? ""
  const caret = safeStart - previous.length
  return { value: value.slice(0, caret) + value.slice(safeStart), caret }
}

export function compositionBeforeCaret(value: string, caret: number): string {
  const safeCaret = Math.max(0, Math.min(caret, value.length))
  return value.slice(0, safeCaret).match(/[A-Za-z']+$/)?.[0] ?? ""
}

export function candidatePreview(
  value: string,
  caret = value.length,
  language: "zh" | "en" = "zh",
): {
  composing: boolean
  input: string
  candidates: string[]
} {
  const input = compositionBeforeCaret(value, caret)
  return input
    ? {
        composing: true,
        input,
        candidates: language === "en" ? [input] : ["你好", "不会", "不回", "不好", "你会"],
      }
    : { composing: false, input: "", candidates: [] }
}
