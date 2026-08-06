function escapeHTML(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

function highlightValue(value: string): string {
  const token = /\b(?:F\d+|S\d+(?:_\d+)*|Z\+[A-Za-z0-9_-]+|-?\d+(?:\.\d+)?)\b/g
  let output = ""
  let offset = 0
  for (const match of value.matchAll(token)) {
    const index = match.index ?? 0
    output += escapeHTML(value.slice(offset, index))
    const type = /^(?:F|S|Z\+)/.test(match[0]) ? "action" : "number"
    output += `<span class="token-${type}">${escapeHTML(match[0])}</span>`
    offset = index + match[0].length
  }
  return output + escapeHTML(value.slice(offset))
}

function highlightLine(line: string): string {
  if (/^\s*[;#]/.test(line)) {
    return `<span class="token-comment">${escapeHTML(line)}</span>`
  }
  if (/^\s*\[[^\]]+]\s*$/.test(line)) {
    return `<span class="token-section">${escapeHTML(line)}</span>`
  }
  const entry = line.match(/^(\s*)([^=]+?)(\s*=\s*)(.*)$/)
  if (!entry) return escapeHTML(line)
  return `${escapeHTML(entry[1])}<span class="token-key">${escapeHTML(entry[2])}</span><span class="token-operator">${escapeHTML(entry[3])}</span>${highlightValue(entry[4])}`
}

export function highlightIni(source: string, selectedSections: readonly string[] = []): string {
  const selected = new Set(selectedSections)
  let section = ""
  return source
    .split(/(\r\n|\n|\r)/)
    .map((part) => {
      if (/^\r?\n$|^\r$/.test(part)) return part
      const match = part.match(/^\s*\[([^\]]+)]\s*$/)
      if (match) section = match[1]
      const line = highlightLine(part)
      return selected.has(section) ? `<span class="token-selected">${line}</span>` : line
    })
    .join("")
}
