// Minimal XML property-list reader.
//
// The reference tool decodes `toolbarMenuItems.plist` with `PropertyListDecoder`. That is
// far more than the toolbar menu needs, so this reader covers only the XML plist subset
// the menu files use (dict/array/key/string/integer/real/true/false) and reports failure
// the same way: by returning `undefined` so the caller drops the whole `menu` key.

import { decodeSkinText } from "./palm-ini.ts"

export type PalmPlistValue =
  | string
  | number
  | boolean
  | PalmPlistValue[]
  | { [key: string]: PalmPlistValue }

type PalmPlistElement = { tag: string; children: PalmPlistElement[]; text: string }

const CONTAINER_TAGS = new Set(["plist", "array", "dict"])
const SCALAR_TAGS = new Set(["string", "integer", "real", "key", "data", "date"])

function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, "&")
}

function parseElement(xml: string, start: number): { element: PalmPlistElement | undefined; next: number } {
  let index = start
  while (index < xml.length) {
    const open = xml.indexOf("<", index)
    if (open < 0) return { element: undefined, next: xml.length }
    const close = xml.indexOf(">", open)
    if (close < 0) return { element: undefined, next: xml.length }
    if (xml.startsWith("<!--", open)) {
      const end = xml.indexOf("-->", open + 4)
      if (end < 0) return { element: undefined, next: xml.length }
      index = end + 3
      continue
    }
    if (xml.startsWith("<?", open) || xml.startsWith("<!", open)) {
      index = close + 1
      continue
    }
    const raw = xml.slice(open + 1, close).trim()
    index = close + 1
    if (raw.startsWith("/")) return { element: undefined, next: index }
    const selfClosing = raw.endsWith("/")
    const tag = (selfClosing ? raw.slice(0, -1) : raw).trim()
    if (!CONTAINER_TAGS.has(tag) && !SCALAR_TAGS.has(tag) && tag !== "true" && tag !== "false") {
      continue
    }
    const element: PalmPlistElement = { tag, children: [], text: "" }
    if (tag === "true" || tag === "false") return { element, next: index }
    if (selfClosing) return { element, next: index }
    if (SCALAR_TAGS.has(tag)) {
      const end = xml.indexOf(`</${tag}>`, index)
      if (end < 0) return { element: undefined, next: xml.length }
      element.text = xml.slice(index, end)
      return { element, next: end + tag.length + 3 }
    }
    let cursor = index
    while (cursor < xml.length) {
      const child = parseElement(xml, cursor)
      if (!child.element) return { element, next: child.next }
      element.children.push(child.element)
      cursor = child.next
    }
    return { element, next: cursor }
  }
  return { element: undefined, next: xml.length }
}

function elementValue(element: PalmPlistElement): PalmPlistValue | undefined {
  switch (element.tag) {
    case "true":
      return true
    case "false":
      return false
    case "string":
    case "key":
    case "date":
      return decodeEntities(element.text).trim()
    case "integer": {
      const text = element.text.trim()
      if (!/^[+-]?\d+$/.test(text)) return undefined
      return Number(text)
    }
    case "real": {
      const text = element.text.trim()
      const value = Number(text)
      return Number.isFinite(value) && text !== "" ? value : undefined
    }
    case "data":
      return decodeEntities(element.text).trim()
    case "array": {
      const result: PalmPlistValue[] = []
      for (const child of element.children) {
        const value = elementValue(child)
        if (value === undefined) return undefined
        result.push(value)
      }
      return result
    }
    case "dict": {
      const result: { [key: string]: PalmPlistValue } = {}
      for (let index = 0; index < element.children.length; index += 2) {
        const keyElement = element.children[index]
        const valueElement = element.children[index + 1]
        if (!keyElement || !valueElement || keyElement.tag !== "key") return undefined
        const value = elementValue(valueElement)
        if (value === undefined) return undefined
        result[decodeEntities(keyElement.text).trim()] = value
      }
      return result
    }
    case "plist": {
      const child = element.children[0]
      return child ? elementValue(child) : undefined
    }
    default:
      return undefined
  }
}

export function parseXmlPlist(bytes: Uint8Array): PalmPlistValue | undefined {
  const xml = decodeSkinText(bytes)
  if (xml === undefined) return undefined
  const root = parseElement(xml, 0).element
  if (!root) return undefined
  return elementValue(root)
}
