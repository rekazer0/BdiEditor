export type IniEntry = {
  section: string
  key: string
  value: string
}

type Line = {
  raw: string
  ending: string
  section?: string
  key?: string
  prefix?: string
  value?: string
}

function splitLines(source: string): string[] {
  return source.match(/[^\r\n]*(?:\r\n|\n|\r|$)/g)?.filter(Boolean) ?? []
}

function parseLines(source: string): Line[] {
  let section = ""
  return splitLines(source).map((raw): Line => {
    const ending = raw.match(/(\r\n|\n|\r)$/)?.[1] ?? ""
    const content = ending ? raw.slice(0, -ending.length) : raw
    const sectionMatch = content.match(/^\s*\[([^\]]+)]\s*$/)
    if (sectionMatch) {
      section = sectionMatch[1]
      return { raw, ending, section }
    }

    if (!/^\s*[;#]/.test(content)) {
      const entry = content.match(/^(\s*([^=]+?)\s*=\s*)(.*)$/)
      if (entry) {
        return {
          raw,
          ending,
          section,
          key: entry[2].trim(),
          prefix: entry[1],
          value: entry[3],
        }
      }
    }
    return { raw, ending }
  })
}

export class IniDocument {
  private lines: Line[]

  private constructor(lines: Line[]) {
    this.lines = lines
  }

  static parse(source: string): IniDocument {
    return new IniDocument(parseLines(source))
  }

  get(section: string, key: string): string | undefined {
    return this.lines.find((line) => line.section === section && line.key === key)?.value
  }

  set(section: string, key: string, value: string): boolean {
    const line = this.lines.find((candidate) => candidate.section === section && candidate.key === key)
    if (line) {
      if (line.value === value) return false
      line.value = value
      line.raw = `${line.prefix}${value}${line.ending}`
      return true
    }

    const sectionIndex =
      section === ""
        ? -1
        : this.lines.findIndex(
            (candidate) => candidate.section === section && candidate.key === undefined,
          )
    if (section !== "" && sectionIndex < 0) return false
    const nextSectionOffset = this.lines
      .slice(sectionIndex + 1)
      .findIndex((candidate) => candidate.section !== undefined && candidate.key === undefined)
    const insertAt =
      nextSectionOffset < 0 ? this.lines.length : sectionIndex + 1 + nextSectionOffset
    const ending = this.lines.find((candidate) => candidate.ending)?.ending ?? "\n"
    if (insertAt === this.lines.length && this.lines.at(-1)?.ending === "") {
      const previous = this.lines.at(-1)!
      previous.ending = ending
      previous.raw += ending
    }
    const prefix = `${key}=`
    this.lines.splice(insertAt, 0, {
      raw: `${prefix}${value}${ending}`,
      ending,
      section,
      key,
      prefix,
      value,
    })
    return true
  }

  remove(section: string, key: string): boolean {
    const index = this.lines.findIndex((line) => line.section === section && line.key === key)
    if (index < 0) return false
    this.lines.splice(index, 1)
    return true
  }

  entries(section?: string): IniEntry[] {
    return this.lines.flatMap((line) => {
      if (!line.key || line.section === undefined || line.value === undefined) return []
      if (section !== undefined && line.section !== section) return []
      return [{ section: line.section, key: line.key, value: line.value }]
    })
  }

  sections(): string[] {
    return [
      ...new Set(
        this.lines
          .filter((line) => line.key === undefined && line.section !== undefined)
          .map((line) => line.section as string),
      ),
    ]
  }

  appendSection(section: string, entries: readonly { key: string; value: string }[]): void {
    const ending = this.lines.find((line) => line.ending)?.ending ?? "\n"
    if (this.lines.length && this.lines.at(-1)?.ending === "") {
      const previous = this.lines.at(-1)!
      previous.ending = ending
      previous.raw += ending
    }
    this.lines.push({ raw: `[${section}]${ending}`, ending, section })
    for (const entry of entries) {
      this.lines.push({
        raw: `${entry.key}=${entry.value}${ending}`,
        ending,
        section,
        key: entry.key,
        prefix: `${entry.key}=`,
        value: entry.value,
      })
    }
  }

  removeSections(sections: readonly string[]): boolean {
    const selected = new Set(sections)
    const before = this.lines.length
    let section = ""
    this.lines = this.lines.filter((line) => {
      if (line.section !== undefined && line.key === undefined) section = line.section
      return !selected.has(section)
    })
    return this.lines.length !== before
  }

  // 返回 section 的原始文本（含段头行，不含下一个段头），未找到返回 undefined
  getSectionText(section: string): string | undefined {
    const start = this.lines.findIndex(
      (line) => line.section === section && line.key === undefined,
    )
    if (start < 0) return undefined
    const next = this.lines
      .slice(start + 1)
      .findIndex((line) => line.section !== undefined && line.key === undefined)
    const end = next < 0 ? this.lines.length : start + 1 + next
    return this.lines
      .slice(start, end)
      .map((line) => line.raw)
      .join("")
  }

  // 用新文本整体替换 section 的原始行（含段头）。
  // 段头必须保留且只能有一个段头（例如编辑 [STYLE43] 块时不能删掉或改成别的段头）。
  // 返回 false 表示未找到该 section 或新文本无效；内容无变化也返回 false。
  setSectionText(section: string, text: string): boolean {
    const start = this.lines.findIndex(
      (line) => line.section === section && line.key === undefined,
    )
    if (start < 0) return false
    const next = this.lines
      .slice(start + 1)
      .findIndex((line) => line.section !== undefined && line.key === undefined)
    const end = next < 0 ? this.lines.length : start + 1 + next
    const current = this.lines
      .slice(start, end)
      .map((line) => line.raw)
      .join("")
    if (current === text) return false
    const parsed = parseLines(text)
    const headers = parsed.filter(
      (line) => line.key === undefined && line.section !== undefined,
    )
    if (headers.length !== 1 || headers[0].section !== section) return false
    const ending = this.lines.find((line) => line.ending)?.ending ?? "\n"
    for (const line of parsed) {
      if (!line.ending) {
        line.ending = ending
        line.raw = `${line.raw}${ending}`
      }
    }
    this.lines.splice(start, end - start, ...parsed)
    return true
  }

  toString(): string {
    return this.lines.map((line) => line.raw).join("")
  }
}
