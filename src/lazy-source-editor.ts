import type {
  SourceCodeEditor,
  SourceEditorDecorations,
  SourceEditorLanguage,
} from "./source-editor.ts"

type Selection = { start: number; end: number; reveal: boolean }

export class LazySourceCodeEditor extends EventTarget {
  private editor?: SourceCodeEditor
  private loading?: Promise<void>
  private currentValue = ""
  private isDisabled = true
  private isReadOnly = false
  private language: SourceEditorLanguage = "ini"
  private decorations: SourceEditorDecorations = {}
  private selection?: Selection

  constructor(private readonly parent: HTMLElement) {
    super()
  }

  async load(): Promise<void> {
    if (this.editor) return
    if (this.loading) return this.loading
    this.parent.textContent = "正在加载源码编辑器…"
    this.parent.setAttribute("aria-busy", "true")
    this.loading = import("./source-editor.ts").then(({ SourceCodeEditor }) => {
      this.parent.replaceChildren()
      const editor = new SourceCodeEditor(this.parent)
      this.editor = editor
      editor.value = this.currentValue
      editor.setLanguage(this.language)
      editor.disabled = this.isDisabled
      editor.readOnly = this.isReadOnly
      editor.setDecorations(this.decorations)
      if (this.selection) {
        editor.setSelectionRange(this.selection.start, this.selection.end, this.selection.reveal)
      }
      editor.addEventListener("input", () => {
        this.currentValue = editor.value
        this.dispatchEvent(new Event("input"))
      })
      editor.addEventListener("change", () => {
        this.currentValue = editor.value
        this.dispatchEvent(new Event("change"))
      })
      this.parent.removeAttribute("aria-busy")
    }).catch((error) => {
      this.loading = undefined
      this.parent.removeAttribute("aria-busy")
      this.parent.textContent = "源码编辑器加载失败"
      throw error
    })
    return this.loading
  }

  get value(): string {
    return this.editor?.value ?? this.currentValue
  }

  set value(value: string) {
    this.currentValue = value
    if (this.editor) this.editor.value = value
  }

  get disabled(): boolean {
    return this.editor?.disabled ?? this.isDisabled
  }

  set disabled(value: boolean) {
    this.isDisabled = value
    if (this.editor) this.editor.disabled = value
  }

  get readOnly(): boolean {
    return this.editor?.readOnly ?? this.isReadOnly
  }

  set readOnly(value: boolean) {
    this.isReadOnly = value
    if (this.editor) this.editor.readOnly = value
  }

  setLanguage(language: SourceEditorLanguage): void {
    this.language = language
    this.editor?.setLanguage(language)
  }

  setDecorations(value: SourceEditorDecorations): void {
    this.decorations = value
    this.editor?.setDecorations(value)
  }

  setSelectionRange(start: number, end = start, reveal = true): void {
    this.selection = { start, end, reveal }
    this.editor?.setSelectionRange(start, end, reveal)
  }

  revealRange(start: number, end = start): void {
    this.setSelectionRange(start, end, true)
  }

  focus(): void {
    if (this.editor) this.editor.focus()
    else void this.load().then(() => this.editor?.focus())
  }

  commit(): void {
    this.editor?.commit()
  }

  requestMeasure(): void {
    this.editor?.requestMeasure()
  }

  destroy(): void {
    this.editor?.destroy()
  }
}
