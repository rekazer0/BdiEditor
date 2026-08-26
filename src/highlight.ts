function escapeHTML(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

export function findTextMatches(source: string, query: string): number[] {
  if (!query) return []
  const text = source.toLocaleLowerCase()
  const needle = query.toLocaleLowerCase()
  const matches: number[] = []
  for (let index = text.indexOf(needle); index >= 0; index = text.indexOf(needle, index + needle.length)) {
    matches.push(index)
  }
  return matches
}

export function replaceTextMatches(source: string, query: string, replacement: string, matchIndex?: number): string {
  const matches = findTextMatches(source, query)
  const targets = matchIndex === undefined ? matches : matches.slice(matchIndex, matchIndex + 1)
  return targets.reduceRight(
    (text, index) => text.slice(0, index) + replacement + text.slice(index + query.length),
    source,
  )
}

function firstMatchEndingAfter(matches: readonly number[], queryLength: number, offset: number): number {
  let low = 0
  let high = matches.length
  while (low < high) {
    const middle = (low + high) >>> 1
    if (matches[middle] + queryLength <= offset) low = middle + 1
    else high = middle
  }
  return low
}

function highlightText(
  value: string,
  offset: number,
  matches: readonly number[],
  queryLength: number,
  activeIndex: number,
  token?: string,
): string {
  let output = ""
  let cursor = 0
  for (let index = firstMatchEndingAfter(matches, queryLength, offset); index < matches.length; index += 1) {
    const match = matches[index]
    const start = Math.max(0, match - offset)
    const end = Math.min(value.length, match + queryLength - offset)
    if (start >= value.length) break
    output += escapeHTML(value.slice(cursor, start))
    output += `<mark class="token-search-match${index === activeIndex ? " active" : ""}">${escapeHTML(value.slice(start, end))}</mark>`
    cursor = end
  }
  output += escapeHTML(value.slice(cursor))
  return token ? `<span class="${token}">${output}</span>` : output
}

function highlightValue(
  value: string,
  offset: number,
  matches: readonly number[],
  queryLength: number,
  activeIndex: number,
): string {
  const token = /\b(?:F\d+|S\d+(?:_\d+)*|Z\+[A-Za-z0-9_-]+|-?\d+(?:\.\d+)?)\b/g
  let output = ""
  let cursor = 0
  for (const match of value.matchAll(token)) {
    const index = match.index ?? 0
    output += highlightText(value.slice(cursor, index), offset + cursor, matches, queryLength, activeIndex)
    const type = /^(?:F|S|Z\+)/.test(match[0]) ? "action" : "number"
    output += highlightText(match[0], offset + index, matches, queryLength, activeIndex, `token-${type}`)
    cursor = index + match[0].length
  }
  return output + highlightText(value.slice(cursor), offset + cursor, matches, queryLength, activeIndex)
}

function highlightLine(
  line: string,
  offset: number,
  matches: readonly number[],
  queryLength: number,
  activeIndex: number,
): string {
  if (/^\s*[;#]/.test(line)) {
    return highlightText(line, offset, matches, queryLength, activeIndex, "token-comment")
  }
  if (/^\s*\[[^\]]+]\s*$/.test(line)) {
    return highlightText(line, offset, matches, queryLength, activeIndex, "token-section")
  }
  const entry = line.match(/^(\s*)([^=]+?)(\s*=\s*)(.*)$/)
  if (!entry) return highlightText(line, offset, matches, queryLength, activeIndex)
  const keyOffset = offset + entry[1].length
  const operatorOffset = keyOffset + entry[2].length
  const valueOffset = operatorOffset + entry[3].length
  return highlightText(entry[1], offset, matches, queryLength, activeIndex)
    + highlightText(entry[2], keyOffset, matches, queryLength, activeIndex, "token-key")
    + highlightText(entry[3], operatorOffset, matches, queryLength, activeIndex, "token-operator")
    + highlightValue(entry[4], valueOffset, matches, queryLength, activeIndex)
}

export function insertedTextRange(before: string, after: string): readonly [number, number] | undefined {
  let start = 0
  while (start < before.length && start < after.length && before[start] === after[start]) start += 1
  let beforeEnd = before.length
  let afterEnd = after.length
  while (beforeEnd > start && afterEnd > start && before[beforeEnd - 1] === after[afterEnd - 1]) {
    beforeEnd -= 1
    afterEnd -= 1
  }
  return afterEnd > start ? [start, afterEnd] : undefined
}

export function jsonPropertyRanges(source: string, properties: readonly string[]): Array<readonly [number, number]> {
  if (!properties.length) return []
  const selected = new Set(properties)
  const ranges: Array<readonly [number, number]> = []
  const property = /^(\s*)("(?:\\.|[^"\\])*")\s*:\s*([\[{])/gm
  for (const match of source.matchAll(property)) {
    if (!selected.has(JSON.parse(match[2]))) continue
    const start = match.index ?? 0
    const bodyStart = start + match[0].length - 1
    const open = match[3]
    const close = open === "{" ? "}" : "]"
    let depth = 0
    let quoted = false
    let escaped = false
    for (let index = bodyStart; index < source.length; index += 1) {
      const character = source[index]
      if (quoted) {
        if (escaped) escaped = false
        else if (character === "\\") escaped = true
        else if (character === '"') quoted = false
        continue
      }
      if (character === '"') quoted = true
      else if (character === open) depth += 1
      else if (character === close && --depth === 0) {
        ranges.push([start, index + 1])
        break
      }
    }
  }
  return ranges
}

export function iniSectionRanges(source: string, sections: readonly string[]): Array<readonly [number, number]> {
  if (!sections.length) return []
  const selected = new Set(sections)
  const headers = [...source.matchAll(/^\s*\[([^\]]+)]\s*$/gm)]
  return headers.flatMap((header, index) => selected.has(header[1])
    ? [[header.index ?? 0, headers[index + 1]?.index ?? source.length] as const]
    : [])
}

export function highlightJson(
  source: string,
  searchQuery = "",
  activeSearchIndex = -1,
  selectedProperties: readonly string[] = [],
  syntaxRange?: readonly [number, number],
): string {
  const matches = findTextMatches(source, searchQuery)
  const selectedRanges = jsonPropertyRanges(source, selectedProperties)
  const token = /"(?:\\.|[^"\\])*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\b(?:true|false|null)\b|[{}[\],:]/g
  let offset = 0
  return source
    .split(/(\r\n|\n|\r)/)
    .map((part) => {
      const start = offset
      offset += part.length
      if (/^\r?\n$|^\r$/.test(part)) return part
      const syntaxVisible = !syntaxRange || start < syntaxRange[1] && offset > syntaxRange[0]
      let line = ""
      let cursor = 0
      if (syntaxVisible) {
        for (const match of part.matchAll(token)) {
          const index = match.index ?? 0
          line += highlightText(part.slice(cursor, index), start + cursor, matches, searchQuery.length, activeSearchIndex)
          const type = match[0].startsWith('"')
            ? /^\s*:/.test(part.slice(index + match[0].length)) ? "key" : "action"
            : /^-?\d/.test(match[0]) ? "number"
              : /^[{}[\],:]$/.test(match[0]) ? "operator" : "section"
          line += highlightText(match[0], start + index, matches, searchQuery.length, activeSearchIndex, `token-${type}`)
          cursor = index + match[0].length
        }
      }
      line += highlightText(part.slice(cursor), start + cursor, matches, searchQuery.length, activeSearchIndex)
      const lineMatch = firstMatchEndingAfter(matches, searchQuery.length, start)
      const activeMatch = matches[activeSearchIndex]
      const classes = [
        syntaxVisible && selectedRanges.some(([rangeStart, rangeEnd]) => start < rangeEnd && offset > rangeStart) ? "token-selected" : "",
        syntaxVisible && matches[lineMatch] < offset ? "token-search-line" : "",
        activeMatch !== undefined && activeMatch < offset && activeMatch + searchQuery.length > start ? "active" : "",
      ].filter(Boolean).join(" ")
      return classes ? `<span class="${classes}">${line}</span>` : line
    })
    .join("")
}

export function highlightIni(
  source: string,
  selectedSections: readonly string[] = [],
  selectedRange?: readonly [number, number],
  searchQuery = "",
  activeSearchIndex = -1,
  syntaxRange?: readonly [number, number],
): string {
  const selected = new Set(selectedSections)
  const matches = findTextMatches(source, searchQuery)
  let section = ""
  let offset = 0
  return source
    .split(/(\r\n|\n|\r)/)
    .map((part) => {
      const start = offset
      offset += part.length
      if (/^\r?\n$|^\r$/.test(part)) return part
      const match = part.match(/^\s*\[([^\]]+)]\s*$/)
      if (match) section = match[1]
      const syntaxVisible = !syntaxRange || start < syntaxRange[1] && offset > syntaxRange[0]
      const line = syntaxVisible
        ? highlightLine(part, start, matches, searchQuery.length, activeSearchIndex)
        : highlightText(part, start, matches, searchQuery.length, activeSearchIndex)
      const rangeSelected = selectedRange && start < selectedRange[1] && offset > selectedRange[0]
      const lineMatch = firstMatchEndingAfter(matches, searchQuery.length, start)
      const activeMatch = matches[activeSearchIndex]
      const classes = [
        syntaxVisible && (selected.has(section) || rangeSelected) ? "token-selected" : "",
        syntaxVisible && matches[lineMatch] < offset ? "token-search-line" : "",
        activeMatch !== undefined && activeMatch < offset && activeMatch + searchQuery.length > start ? "active" : "",
      ].filter(Boolean).join(" ")
      return classes ? `<span class="${classes}">${line}</span>` : line
    })
    .join("")
}
