import { jsonPropertyRanges } from "../highlight.ts"
import { asObject, type JsonObject } from "./sxi-ini.ts"
import { encodeSkinJson, parseSkinJson, sxiFragment } from "./sxi-projection.ts"

function sectionModel(model: JsonObject, section: string): JsonObject | undefined {
  const key = /^KEY(.+)$/.exec(section)
  if (key) return (Array.isArray(model.keys) ? model.keys : []).map(asObject).find((item) => String(item?.id) === key[1])
  const tip = /^TIP(.+)$/.exec(section)
  if (tip) return asObject(asObject(model.key_fix)?.[tip[1]])
  return asObject(model[({ PANEL: "board", LIST: "list" } as Record<string, string>)[section]])
}

export function setSxiForeground(text: string, pointer: string[], sections: string[], value: string): string {
  const ids = value.split(",").map((id) => id.trim()).filter(Boolean).map((id) => {
    if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id))) throw new Error("前景样式编号必须是非负整数")
    return Number(id)
  })
  const skin = parseSkinJson(text)
  const model = asObject(sxiFragment(skin, pointer))
  if (!model) throw new Error("找不到手心布局")
  for (const section of sections) {
    const key = sectionModel(model, section)
    if (!key) throw new Error(`找不到手心按键 ${section}`)
    const base = asObject(key.b) ?? {}
    base.base_f = [...ids]
    key.b = base
  }
  return encodeSkinJson(skin)
}

// Equal orientation tables are hidden by the projection, but remain the native source of truth.
export function sxiStylePointer(text: string, pointer: string[], orientation: string): string[] {
  if (pointer[1] !== "s_info") return pointer
  const own = [pointer[0], `s_${orientation}`, "ss_1"]
  return asObject(sxiFragment(parseSkinJson(text), own)) ? own : pointer
}

function styleModel(styles: JsonObject, section: string): JsonObject {
  const model = asObject(Object.entries(styles).find(([id, item]) => (asObject(item)?.id ?? `STYLE${id}`) === section)?.[1])
  if (!model) throw new Error(`找不到手心样式 ${section}`)
  return model
}

export function setSxiStyleImage(text: string, pointer: string[], sections: string[], property: "NM_IMG" | "HL_IMG", value: string): string {
  const skin = parseSkinJson(text)
  const styles = asObject(sxiFragment(skin, pointer))
  if (!styles) throw new Error("找不到手心样式")
  for (const section of sections) {
    const model = styleModel(styles, section)
    const image = asObject(model.s_2) ?? {}
    image[property === "NM_IMG" ? "normal" : "hl"] = value
    model.s_2 = image
  }
  return encodeSkinJson(skin)
}

// default.css text keys and their `s_1` names (see `stylesText` in sxi-style.ts).
const SXI_TEXT_FIELDS: Record<string, string> = { FONT_NAME: "f_n", FONT_SIZE: "f_s", NM_COLOR: "c_normal", HL_COLOR: "c_hl" }

/** Sets one text property of each style; an empty value removes it so the skin default applies. */
export function setSxiStyleText(text: string, pointer: string[], sections: string[], property: string, value: string): string {
  const field = SXI_TEXT_FIELDS[property]
  if (!field) throw new Error(`手心样式不支持 ${property}`)
  const number = Number(value)
  if (property === "FONT_SIZE" && value && !(Number.isFinite(number) && number > 0)) throw new Error("字号必须是正数")
  const skin = parseSkinJson(text)
  const styles = asObject(sxiFragment(skin, pointer))
  if (!styles) throw new Error("找不到手心样式")
  for (const section of sections) {
    const model = styleModel(styles, section)
    const info = asObject(model.s_1) ?? {}
    if (value) info[field] = property === "FONT_SIZE" ? number : value
    else delete info[field]
    model.s_1 = info
  }
  return encodeSkinJson(skin)
}

export function addSxiImageStyle(text: string, pointer: string[], property: "NM_IMG" | "HL_IMG", value: string): { text: string; id: string } {
  const skin = parseSkinJson(text)
  const styles = asObject(sxiFragment(skin, pointer))
  if (!styles) throw new Error("找不到手心样式")
  const ids = new Set(Object.entries(styles).map(([id, item]) => asObject(item)?.id ?? `STYLE${id}`))
  let id = 1
  while (styles[String(id)] !== undefined || ids.has(`STYLE${id}`)) id += 1
  styles[String(id)] = { f: 0, id: `STYLE${id}`, s_2: { normal: value, ...(property === "HL_IMG" ? { hl: value } : {}) } }
  return { text: encodeSkinJson(skin), id: String(id) }
}

// Locate whole key objects, respecting nested braces and escaped strings in JSON.
export function sxiSectionRanges(text: string, sections: readonly string[]): Array<readonly [number, number]> {
  const keys = jsonPropertyRanges(text, ["keys"])[0]
  const ranges: Array<readonly [number, number]> = []
  if (keys) {
    let depth = 0, start = 0, quoted = false, escaped = false
    for (let index = text.indexOf("[", keys[0]); index < keys[1]; index += 1) {
      const char = text[index]
      if (quoted) {
        if (escaped) escaped = false
        else if (char === "\\") escaped = true
        else if (char === '"') quoted = false
      } else if (char === '"') quoted = true
      else if (char === "{") { if (depth++ === 0) start = index }
      else if (char === "}" && --depth === 0) {
        try {
          const key = JSON.parse(text.slice(start, index + 1))
          if (sections.includes(`KEY${key.id}`)) ranges.push([start, index + 1])
        } catch { /* Source may be incomplete while typing. */ }
      }
    }
  }
  const names = { PANEL: "board", LIST: "list" } as Record<string, string>
  for (const section of sections) {
    if (names[section]) ranges.push(...jsonPropertyRanges(text, [names[section]]))
    const tip = /^TIP(.+)$/.exec(section)
    const fixes = tip && jsonPropertyRanges(text, ["key_fix"])[0]
    if (tip && fixes) ranges.push(...jsonPropertyRanges(text.slice(fixes[0], fixes[1]), [tip[1]]).map(([a, b]) => [a + fixes[0], b + fixes[0]] as const))
  }
  return ranges
}
