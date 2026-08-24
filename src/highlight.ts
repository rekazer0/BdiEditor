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
  for (const [index, match] of matches.entries()) {
    const start = Math.max(0, match - offset)
    const end = Math.min(value.length, match + queryLength - offset)
    if (end <= 0) continue
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

export function highlightIni(
  source: string,
  selectedSections: readonly string[] = [],
  selectedRange?: readonly [number, number],
  searchQuery = "",
  activeSearchIndex = -1,
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
      const line = highlightLine(part, start, matches, searchQuery.length, activeSearchIndex)
      const rangeSelected = selectedRange && start < selectedRange[1] && offset > selectedRange[0]
      const lineMatch = matches.findIndex((value) => value < offset && value + searchQuery.length > start)
      const activeMatch = matches[activeSearchIndex]
      const classes = [
        selected.has(section) || rangeSelected ? "token-selected" : "",
        lineMatch >= 0 ? "token-search-line" : "",
        activeMatch !== undefined && activeMatch < offset && activeMatch + searchQuery.length > start ? "active" : "",
      ].filter(Boolean).join(" ")
      return classes ? `<span class="${classes}">${line}</span>` : line
    })
    .join("")
}
