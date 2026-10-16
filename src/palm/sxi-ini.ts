// Shared writers for the `.sxi` read-only projection: Palm JSON values back to the INI
// spellings `palm-export.ts` parses them from.

import { ACTION_CODES } from "./palm-ini.ts"
import { PALM_INT_MAX, type PalmJSONValue } from "./palm-json.ts"

export type Json = PalmJSONValue
export type JsonObject = Record<string, Json>

export function asObject(value: Json): JsonObject | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : undefined
}

export function numberText(value: Json): string | undefined {
  if (typeof value !== "number") return
  return value === PALM_INT_MAX || value === Infinity ? "inf" : String(value)
}

function pair(value: Json): [Json, Json] | undefined {
  return Array.isArray(value) && value.length === 2 ? [value[0], value[1]] : undefined
}

export function pointText(value: Json): string | undefined {
  const point = pair(value)
  const x = point && numberText(point[0])
  const y = point && numberText(point[1])
  return x !== undefined && y !== undefined ? `${x},${y}` : undefined
}

export function rectParts(value: Json): [number, number, number, number] | undefined {
  const [origin, size] = pair(value) ?? []
  const [x, y] = pair(origin ?? null) ?? []
  const [width, height] = pair(size ?? null) ?? []
  const parts = [x, y, width, height]
  return parts.every((part) => typeof part === "number") ? parts as [number, number, number, number] : undefined
}

export function rectText(value: Json): string | undefined {
  return rectParts(value)?.map((part) => numberText(part)).join(",")
}

// `toInsets` reads "left,top,right,bottom".
export function insetsText(value: Json): string | undefined {
  const insets = asObject(value)
  const parts = insets && [insets.left, insets.top, insets.right, insets.bottom].map(numberText)
  return parts?.every((part) => part !== undefined) ? parts.join(",") : undefined
}

export function boolText(value: Json): string | undefined {
  return typeof value === "boolean" ? (value ? "1" : "0") : undefined
}

export function listText(value: Json): string | undefined {
  return Array.isArray(value) ? value.map((item) => numberText(item) ?? String(item)).join(",") : undefined
}

export function stringText(value: Json): string | undefined {
  return typeof value === "string" ? value : undefined
}

const ACTION_KEYS = new Map(Object.entries(ACTION_CODES).map(([code, name]) => [name, code]))

// `actionCode` maps "F38" to "space"; the projection writes the code back.
export function actionText(value: Json): string | undefined {
  return typeof value === "string" ? ACTION_KEYS.get(value) ?? value : undefined
}

// `toTipsMap` reads a flat `[state, tips, ...]` array from "S<state>_<tips>|...".
export function tipsText(value: Json): string | undefined {
  if (!Array.isArray(value)) return
  const items: string[] = []
  for (let index = 0; index + 1 < value.length; index += 2) items.push(`S${value[index]}_${value[index + 1]}`)
  return items.join("|")
}

export class IniWriter {
  private readonly sections: Array<{ name: string; entries: Map<string, string> }> = []

  section(name: string): Map<string, string> {
    const entries = new Map<string, string>()
    this.sections.push({ name, entries })
    return entries
  }

  toString(): string {
    return this.sections
      .map(({ name, entries }) => [`[${name}]`, ...[...entries].map(([key, value]) => `${key}=${value}`)].join("\n"))
      .join("\n\n") + "\n"
  }
}

// The first writer of a key wins, so a section-specific alias never overrides the base model.
export function put(entries: Map<string, string>, key: string, value: string | undefined): void {
  if (value !== undefined && !entries.has(key)) entries.set(key, value)
}

export type FieldKind = "number" | "point" | "rect" | "bool" | "string" | "list" | "insets"

const WRITERS: Record<FieldKind, (value: Json) => string | undefined> = {
  number: numberText,
  point: pointText,
  rect: rectText,
  bool: boolText,
  string: stringText,
  list: listText,
  insets: insetsText,
}

// Table-driven fields: `[json key, ini key, kind]`.
export function putFields(entries: Map<string, string>, model: JsonObject, fields: Array<[string, string, FieldKind]>): void {
  for (const [jsonKey, iniKey, kind] of fields) put(entries, iniKey, WRITERS[kind](model[jsonKey]))
}

// `SkinBaseModel` (`b`).
export function putBase(entries: Map<string, string>, value: Json): void {
  const base = asObject(value)
  if (!base) return
  putFields(entries, base, [
    ["base_b", "BACK_STYLE", "number"],
    ["base_f", "FORE_STYLE", "list"],
    ["base_s", "SOUND_STYLE", "number"],
    ["asi", "ANIM_STYLE", "number"],
    ["base_ba", "BACK_ANIM_STYLE", "number"],
    ["base_o", "POS_TYPE", "list"],
    ["base_pa", "PANEL_ANIM_STYLE", "number"],
    ["base_fa", "FORE_ANIM_STYLE", "list"],
    ["base_a", "FORE_ANIM_STYLE", "number"],
  ])
}
