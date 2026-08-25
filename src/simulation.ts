import { skinStateForcesComposition } from "./actions.ts"

const chinesePreviewCandidates = ["你好", "不会", "不回", "不好", "你会"]
const englishPreviewCandidates = ["hello", "Hello", "world", "thanks"]

export function compositionSkinState(value: string, current?: number): number | undefined {
  return value ? 4 : current === 4 ? undefined : current
}

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

export function deleteForward(
  value: string,
  start: number,
  end: number,
): { value: string; caret: number } {
  const safeStart = Math.max(0, Math.min(start, value.length))
  const safeEnd = Math.max(safeStart, Math.min(end, value.length))
  if (safeEnd > safeStart) {
    return { value: value.slice(0, safeStart) + value.slice(safeEnd), caret: safeStart }
  }
  if (safeStart === value.length) return { value, caret: safeStart }
  const next = Array.from(value.slice(safeStart))[0] ?? ""
  return { value: value.slice(0, safeStart) + value.slice(safeStart + next.length), caret: safeStart }
}

export function compositionBeforeCaret(value: string, caret: number): string {
  const safeCaret = Math.max(0, Math.min(caret, value.length))
  return value.slice(0, safeCaret).match(/[A-Za-z']+$/)?.[0] ?? ""
}

function compositionValue(value: string, caret: number): string {
  const safeCaret = Math.max(0, Math.min(caret, value.length))
  const beforeCaret = value.slice(0, safeCaret)
  return compositionBeforeCaret(value, caret) || beforeCaret.trim()
}

export function moveCaret(
  value: string,
  start: number,
  end: number,
  direction: -1 | 1,
): { start: number; end: number } {
  const safeStart = Math.max(0, Math.min(start, value.length))
  const safeEnd = Math.max(safeStart, Math.min(end, value.length))
  if (safeEnd > safeStart) {
    const caret = direction < 0 ? safeStart : safeEnd
    return { start: caret, end: caret }
  }
  if (direction < 0) {
    const previous = Array.from(value.slice(0, safeStart)).at(-1) ?? ""
    const caret = safeStart - previous.length
    return { start: caret, end: caret }
  }
  const next = Array.from(value.slice(safeStart))[0] ?? ""
  const caret = safeStart + next.length
  return { start: caret, end: caret }
}

export function moveCaretVertical(
  value: string,
  start: number,
  end: number,
  direction: -1 | 1,
): { start: number; end: number } {
  const safeStart = Math.max(0, Math.min(start, value.length))
  const safeEnd = Math.max(safeStart, Math.min(end, value.length))
  const caret = direction < 0 ? safeStart : safeEnd
  const lineStart = value.lastIndexOf("\n", Math.max(0, caret - 1)) + 1
  const lineEndMatch = value.indexOf("\n", caret)
  const lineEnd = lineEndMatch < 0 ? value.length : lineEndMatch
  const column = Array.from(value.slice(lineStart, caret)).length
  if (direction < 0) {
    if (lineStart === 0) return { start: caret, end: caret }
    const previousEnd = lineStart - 1
    const previousStart = value.lastIndexOf("\n", Math.max(0, previousEnd - 1)) + 1
    const offset = Array.from(value.slice(previousStart, previousEnd)).slice(0, column).join("").length
    const target = previousStart + offset
    return { start: target, end: target }
  }
  if (lineEnd === value.length) return { start: caret, end: caret }
  const nextStart = lineEnd + 1
  const nextEndMatch = value.indexOf("\n", nextStart)
  const nextEnd = nextEndMatch < 0 ? value.length : nextEndMatch
  const offset = Array.from(value.slice(nextStart, nextEnd)).slice(0, column).join("").length
  const target = nextStart + offset
  return { start: target, end: target }
}

export function candidatePreview(
  value: string,
  caret = value.length,
  language: "zh" | "en" = "zh",
  skinState?: number,
): {
  composing: boolean
  input: string
  candidates: string[]
} {
  const typed = compositionValue(value, caret)
  if (language === "en") {
    return typed
      ? { composing: true, input: "", candidates: [...englishPreviewCandidates] }
      : { composing: false, input: "", candidates: [] }
  }
  const input = typed || (skinStateForcesComposition(skinState) ? "ni" : "")
  return input
    ? {
        composing: true,
        input,
        candidates: [...chinesePreviewCandidates],
      }
    : { composing: false, input: "", candidates: [] }
}
