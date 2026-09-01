import { actionDescription, knownFunctionCodes, knownSkinStates } from "./actions.ts"
import { jsonFieldLabels, sourceKeyLabels } from "./config-labels.ts"
import type { SourceEditorLanguage } from "./source-editor.ts"

export type SourceCompletionKind = "key" | "value"

export type SourceCompletionItem = {
  label: string
  detail: string
  kind: SourceCompletionKind
  apply?: string
}

export type SourceCompletionResult = {
  items: SourceCompletionItem[]
  kind: SourceCompletionKind
  replaceLength: number
}

type ValueOption = readonly [value: string, detail: string]

const actionValueKeys = new Set(["CENTER", "UP", "DOWN", "LEFT", "RIGHT", "HOLD", "KEY"])
const jsonActionValueKeys = new Set(["action", "value", "code", "center", "up", "down", "left", "right", "hold"])

const iniValueOptions: Readonly<Record<string, readonly ValueOption[]>> = {
  NO_BLUR: [["0", "模糊输入"], ["1", "精确输入"]],
  LIST_ORDER: [["0", "纵向排列"], ["1", "横向排列"]],
  REMOVE: [["0", "动画结束后保留"], ["1", "动画结束后移除"]],
}

const jsonValueOptions: Readonly<Record<string, readonly ValueOption[]>> = {
  shouldBgBlur: [["false", "关闭背景模糊"], ["true", "开启背景模糊"]],
  shouldKeySlotting: [["false", "关闭按键开槽"], ["true", "开启按键开槽"]],
  removeOnFinish: [["false", "动画结束后保留"], ["true", "动画结束后移除"]],
}

function limited(items: SourceCompletionItem[], explicit: boolean): SourceCompletionItem[] {
  return explicit ? items : items.slice(0, 24)
}

function actionItems(query: string, explicit: boolean, statesOnly = false): SourceCompletionItem[] {
  const normalized = query.toUpperCase()
  const functionItems = knownFunctionCodes.map((label) => ({
    label,
    detail: actionDescription(label),
    kind: "value" as const,
  }))
  const stateItems = knownSkinStates.map((state) => {
    const label = `S${state}`
    return { label, detail: actionDescription(label), kind: "value" as const }
  })
  const candidates = statesOnly || normalized.startsWith("S")
    ? stateItems
    : normalized.startsWith("F") || !explicit
      ? functionItems
      : [...functionItems, ...stateItems]
  return limited(candidates.filter((item) => item.label.startsWith(normalized)), explicit)
}

function optionItems(options: readonly ValueOption[], query: string, explicit: boolean): SourceCompletionItem[] {
  return limited(options
    .filter(([value]) => value.toLowerCase().startsWith(query.toLowerCase()))
    .map(([label, detail]) => ({ label, detail, kind: "value" as const })), explicit)
}

function iniCompletions(lineBefore: string, explicit: boolean): SourceCompletionResult | undefined {
  if (/^\s*[;#\[]/.test(lineBefore)) return
  const equals = lineBefore.indexOf("=")
  if (equals < 0) {
    const match = lineBefore.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)?$/)
    if (!match) return
    const query = match[1] ?? ""
    if (!query && !explicit) return
    const items = Object.entries(sourceKeyLabels)
      .filter(([label]) => label.startsWith(query.toUpperCase()))
      .map(([label, detail]) => ({ label, detail, kind: "key" as const, apply: `${label}=` }))
    return { items: limited(items, explicit), kind: "key", replaceLength: query.length }
  }

  const key = lineBefore.slice(0, equals).trim().toUpperCase()
  const valueBefore = lineBefore.slice(equals + 1)
  if (valueBefore.includes(";")) return
  const match = valueBefore.match(/(?:^|[,\s])([A-Za-z0-9_]*)$/)
  if (!match) return
  const query = match[1] ?? ""
  let items: SourceCompletionItem[] = []
  if (key === "STAT_STYLE") items = actionItems(query, explicit, true)
  else if (actionValueKeys.has(key)) items = actionItems(query, explicit)
  else if (iniValueOptions[key]) items = optionItems(iniValueOptions[key], query, explicit)
  else return
  if (!items.length) return
  return { items, kind: "value", replaceLength: query.length }
}

function jsonCompletions(lineBefore: string, explicit: boolean): SourceCompletionResult | undefined {
  const startedKey = lineBefore.match(/(?:^|[,{])\s*"([^"\\]*)$/)
  const blankKey = explicit && /(?:^|[,{])\s*$/.test(lineBefore)
  if (startedKey || blankKey) {
    const query = startedKey?.[1] ?? ""
    const items = Object.entries(jsonFieldLabels)
      .filter(([label]) => label.toLowerCase().startsWith(query.toLowerCase()))
      .map(([label, detail]) => ({
        label,
        detail,
        kind: "key" as const,
        apply: startedKey ? `${label}": ` : `"${label}": `,
      }))
    return { items: limited(items, explicit), kind: "key", replaceLength: query.length }
  }

  const value = lineBefore.match(/"([^"\\]+)"\s*:\s*(?:"([^"\\]*)|([A-Za-z0-9_]*))$/)
  if (!value) return
  const key = value[1]
  const query = value[2] ?? value[3] ?? ""
  let items: SourceCompletionItem[] = []
  if (jsonActionValueKeys.has(key)) items = actionItems(query, explicit)
  else if (jsonValueOptions[key]) items = optionItems(jsonValueOptions[key], query, explicit)
  else return
  if (!items.length) return
  return { items, kind: "value", replaceLength: query.length }
}

export function sourceCompletions(
  lineBefore: string,
  language: SourceEditorLanguage,
  explicit = false,
): SourceCompletionResult | undefined {
  return language === "json"
    ? jsonCompletions(lineBefore, explicit)
    : iniCompletions(lineBefore, explicit)
}
