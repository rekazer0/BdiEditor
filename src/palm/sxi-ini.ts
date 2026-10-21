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

/** The inverse of `actionText`: an INI action code back to the Palm action name. */
export function actionValue(text: string): string {
  return ACTION_CODES[text.trim()] ?? text.trim()
}

/** The inverse of `tipsText`: "S<state>_<tips>|..." back to the flat `[state, tips, ...]` array. */
export function tipsValue(text: string): number[] {
  return text.split("|").map((part) => part.trim()).filter(Boolean).flatMap((part) => {
    const match = /^S(\d+)_(\d+)$/.exec(part)
    if (!match) throw new Error(`状态样式“${part}”应为 S状态_补丁`)
    return [Number(match[1]), Number(match[2])]
  })
}

// `toTipsMap` reads a flat `[state, tips, ...]` array from "S<state>_<tips>|...".
export function tipsText(value: Json): string | undefined {
  if (!Array.isArray(value)) return
  const items: string[] = []
  for (let index = 0; index + 1 < value.length; index += 2) items.push(`S${value[index]}_${value[index + 1]}`)
  // An empty state list must leave the key without `STAT_STYLE`, not override it with a blank value.
  return items.length ? items.join("|") : undefined
}

/** Writes an INI value back into the JSON it was projected from; `undefined` removes it. */
export type FieldWrite = (text: string | undefined) => void

// Where each projected key came from, so an edit of the read-only view can be written to skin.json.
const ORIGINS = new WeakMap<Map<string, string>, Map<string, { write: FieldWrite; present: boolean }>>()
// Objects a projection reads but the skin lacks (a style without `s_1`); a write attaches them.
const DETACHED = new WeakMap<JsonObject, { parent: JsonObject; key: string }>()

export class IniWriter {
  private readonly sections: Array<{ name: string; entries: Map<string, string> }> = []

  /** A section; the unnamed one ("") is written without a header, for key=value files like Info.txt. */
  section(name: string): Map<string, string> {
    const entries = new Map<string, string>()
    this.sections.push({ name, entries })
    return entries
  }

  /** How an edit of `[section] key` is written back, if the projection knows where it came from. */
  origin(section: string, key: string): FieldWrite | undefined {
    const entries = this.sections.find((item) => item.name === section)?.entries
    return entries && ORIGINS.get(entries)?.get(key)?.write
  }

  toString(): string {
    return this.sections
      .map(({ name, entries }) => [...name ? [`[${name}]`] : [], ...[...entries].map(([key, value]) => `${key}=${value}`)].join("\n"))
      .join("\n\n") + "\n"
  }
}

/** `parent[key]` as an object; when absent, an empty one that joins the skin on its first write. */
export function child(parent: JsonObject, key: string): JsonObject {
  const existing = asObject(parent[key])
  if (existing) return existing
  const created: JsonObject = {}
  DETACHED.set(created, { parent, key })
  return created
}

export function attach(model: JsonObject): void {
  const link = DETACHED.get(model)
  if (!link) return
  DETACHED.delete(model)
  link.parent[link.key] = model
  attach(link.parent)
}

/**
 * Records how `key` is written back. Like `put`, the writer of the value shown wins; a writer for an
 * absent value only stands until one that has the value comes along.
 */
export function bind(entries: Map<string, string>, key: string, write: FieldWrite, present: boolean): void {
  let origins = ORIGINS.get(entries)
  if (!origins) ORIGINS.set(entries, origins = new Map())
  const current = origins.get(key)
  if (!current || present && !current.present && !entries.has(key)) origins.set(key, { write, present })
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

export function numberValue(text: string): number {
  const value = text.trim() === "inf" ? PALM_INT_MAX : Number(text)
  if (!text.trim() || !Number.isFinite(value)) throw new Error(`“${text}”不是数字`)
  return value
}

function numbers(text: string, count: number): number[] {
  const parts = text.split(",").map(numberValue)
  if (parts.length !== count) throw new Error(`“${text}”应为 ${count} 个数字`)
  return parts
}

// The inverse of WRITERS: INI text back to the JSON value `palm-export.ts` would build.
export const READERS: Record<FieldKind, (text: string) => Json> = {
  number: numberValue,
  point: (text) => numbers(text, 2),
  rect: (text) => {
    const [x, y, width, height] = numbers(text, 4)
    return [[x, y], [width, height]]
  },
  bool: (text) => text.trim() === "1" || text.trim().toLowerCase() === "true",
  string: (text) => text,
  list: (text) => text.split(",").map((part) => part.trim()).filter(Boolean).map((part) => Number.isFinite(Number(part)) ? Number(part) : part),
  insets: (text) => {
    const [left, top, right, bottom] = numbers(text, 4)
    return { left, top, right, bottom }
  },
}

/** Writes `model[jsonKey]` from INI text of `kind`, attaching the model to the skin if it was absent. */
export function fieldWrite(model: JsonObject, jsonKey: string, read: (text: string) => Json): FieldWrite {
  return (text) => {
    if (text === undefined || text.trim() === "") delete model[jsonKey]
    else model[jsonKey] = read(text)
    attach(model)
  }
}

// Table-driven fields: `[json key, ini key, kind]`.
export function putFields(entries: Map<string, string>, model: JsonObject, fields: Array<[string, string, FieldKind]>): void {
  for (const [jsonKey, iniKey, kind] of fields) {
    const text = WRITERS[kind](model[jsonKey])
    bind(entries, iniKey, fieldWrite(model, jsonKey, READERS[kind]), text !== undefined)
    put(entries, iniKey, text)
  }
}

// `SkinBaseModel` (`b`) of `owner`, created on the first write if the owner has none.
export function putBase(entries: Map<string, string>, owner: JsonObject): void {
  putFields(entries, child(owner, "b"), [
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
