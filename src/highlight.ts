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

export function highlightIni(source: string): string {
  return source
    .split(/(\r\n|\n|\r)/)
    .map((part) => (/^\r?\n$|^\r$/.test(part) ? part : highlightLine(part)))
    .join("")
}
