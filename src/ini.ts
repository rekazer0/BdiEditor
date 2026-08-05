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

export class IniDocument {
  private lines: Line[]

  private constructor(lines: Line[]) {
    this.lines = lines
  }

  static parse(source: string): IniDocument {
    let section = ""
    const lines = splitLines(source).map((raw): Line => {
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
    return new IniDocument(lines)
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

  toString(): string {
    return this.lines.map((line) => line.raw).join("")
  }
}
