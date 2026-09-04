import { IniDocument } from "./ini.ts"

export type AiSkinFileSyntax = "ini" | "json"

export type AiSkinEditableFile = {
  path: string
  syntax: AiSkinFileSyntax
  text: string
}

export type AiSkinWorkspaceLimits = {
  maxChangedFiles: number
  maxMutations: number
  maxReadChars: number
  maxTotalChars: number
}

export type AiSkinDraftChange = AiSkinEditableFile & { before: string; after: string }

const defaultLimits: AiSkinWorkspaceLimits = {
  maxChangedFiles: 8,
  maxMutations: 64,
  maxReadChars: 40_000,
  maxTotalChars: 2_000_000,
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return Number.isInteger(value) && value! > 0 ? value! : fallback
}

function singleLine(label: string, value: string, max = 16_384): void {
  if (!value || /[\r\n]/.test(value)) throw new Error(`${label}必须是非空单行文本`)
  if (value.length > max) throw new Error(`${label}过长`)
}

export class AiSkinWorkspace {
  private readonly files = new Map<string, AiSkinEditableFile>()
  private readonly original = new Map<string, string>()
  private readonly readPaths = new Set<string>()
  private readonly limits: AiSkinWorkspaceLimits
  private mutationCount = 0

  constructor(files: readonly AiSkinEditableFile[], limits: Partial<AiSkinWorkspaceLimits> = {}) {
    this.limits = {
      maxChangedFiles: positiveInteger(limits.maxChangedFiles, defaultLimits.maxChangedFiles),
      maxMutations: positiveInteger(limits.maxMutations, defaultLimits.maxMutations),
      maxReadChars: positiveInteger(limits.maxReadChars, defaultLimits.maxReadChars),
      maxTotalChars: positiveInteger(limits.maxTotalChars, defaultLimits.maxTotalChars),
    }
    let total = 0
    for (const file of files) {
      const segments = file.path.split(/[\\/]/)
      if (!file.path || file.path.startsWith("/") || segments.includes("..") || this.files.has(file.path)) {
        throw new Error(`AI 可编辑文件路径无效或重复：${file.path}`)
      }
      total += file.text.length
      if (total > this.limits.maxTotalChars) throw new Error("AI 可编辑项目超过文本大小上限")
      const entry = { ...file }
      this.files.set(file.path, entry)
      this.original.set(file.path, file.text)
    }
  }

  listFiles(prefix = ""): Array<{ path: string; syntax: AiSkinFileSyntax; chars: number }> {
    if (prefix.includes("..") || prefix.startsWith("/")) throw new Error("不允许访问项目外路径")
    return [...this.files.values()]
      .filter((file) => file.path.startsWith(prefix))
      .sort((left, right) => left.path.localeCompare(right.path))
      .map((file) => ({ path: file.path, syntax: file.syntax, chars: file.text.length }))
  }

  readFile(path: string, offset = 0, limit = this.limits.maxReadChars): { text: string; truncated: boolean; totalChars: number } {
    const file = this.requireFile(path)
    this.readPaths.add(path)
    const start = Number.isInteger(offset) ? Math.max(0, offset) : 0
    const requested = Number.isInteger(limit) ? Math.max(1, limit) : this.limits.maxReadChars
    const length = Math.min(requested, this.limits.maxReadChars)
    const text = file.text.slice(start, start + length)
    return { text, truncated: start + text.length < file.text.length, totalChars: file.text.length }
  }

  setIniValue(path: string, section: string, key: string, value: string): "created" | "updated" | "unchanged" {
    const file = this.requireFile(path)
    if (file.syntax !== "ini") throw new Error("该工具只能修改 INI 配置")
    this.requireRead(path)
    if (/\r|\n|\[|\]/.test(section)) throw new Error("配置节名称无效")
    singleLine("配置键", key, 512)
    singleLine("配置值", value)
    const document = IniDocument.parse(file.text)
    if (section && !document.sections().includes(section)) throw new Error(`配置节不存在：${section}`)
    const created = document.get(section, key) === undefined
    if (!document.set(section, key, value)) return "unchanged"
    this.applyMutation(file, document.toString())
    return created ? "created" : "updated"
  }

  removeIniValue(path: string, section: string, key: string): boolean {
    const file = this.requireFile(path)
    if (file.syntax !== "ini") throw new Error("该工具只能修改 INI 配置")
    this.requireRead(path)
    singleLine("配置键", key, 512)
    const document = IniDocument.parse(file.text)
    if (!document.remove(section, key)) return false
    this.applyMutation(file, document.toString())
    return true
  }

  replaceText(path: string, oldText: string, newText: string, expectedOccurrences = 1): number {
    const file = this.requireFile(path)
    this.requireRead(path)
    if (!oldText) throw new Error("待替换文本不能为空")
    if (oldText.length > 50_000 || newText.length > 50_000) throw new Error("单次替换文本过长")
    if (!Number.isInteger(expectedOccurrences) || expectedOccurrences < 1 || expectedOccurrences > 20) {
      throw new Error("替换次数必须在 1 到 20 之间")
    }
    const occurrences = file.text.split(oldText).length - 1
    if (occurrences !== expectedOccurrences) {
      throw new Error(`待替换文本应出现 ${expectedOccurrences} 次，实际出现 ${occurrences} 次`)
    }
    const next = file.text.split(oldText).join(newText)
    if (file.syntax === "json") {
      try {
        const parsed: unknown = JSON.parse(next)
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not object")
      } catch {
        throw new Error("替换后的 JSON 配置无效")
      }
    }
    this.applyMutation(file, next)
    return occurrences
  }

  changes(): AiSkinDraftChange[] {
    return [...this.files.values()].flatMap((file) => {
      const before = this.original.get(file.path)!
      return before === file.text ? [] : [{ ...file, before, after: file.text }]
    })
  }

  private requireFile(path: string): AiSkinEditableFile {
    const file = this.files.get(path)
    if (!file) throw new Error(`不允许访问未授权项目文件：${path}`)
    return file
  }

  private requireRead(path: string): void {
    if (!this.readPaths.has(path)) throw new Error(`修改前必须先读取文件：${path}`)
  }

  private applyMutation(file: AiSkinEditableFile, next: string): void {
    if (next === file.text) return
    if (this.mutationCount >= this.limits.maxMutations) throw new Error("已达到本轮修改次数上限")
    const changed = new Set(this.changes().map((change) => change.path))
    if (next === this.original.get(file.path)) changed.delete(file.path)
    else changed.add(file.path)
    if (changed.size > this.limits.maxChangedFiles) throw new Error("已达到本轮可修改文件数量上限")
    const total = [...this.files.values()].reduce(
      (sum, entry) => sum + (entry === file ? next.length : entry.text.length),
      0,
    )
    if (total > this.limits.maxTotalChars) throw new Error("修改后的项目超过文本大小上限")
    file.text = next
    this.mutationCount += 1
  }
}
