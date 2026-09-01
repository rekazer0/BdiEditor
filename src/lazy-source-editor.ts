import type {
  SourceCodeEditor,
  SourceEditorDecorations,
  SourceEditorLanguage,
  SourceEditorValueClick,
  SourceEditorValuePreviewRenderer,
} from "./source-editor.ts"

export type {
  SourceEditorDecorations,
  SourceEditorLanguage,
  SourceEditorValueClick,
  SourceEditorValueRange,
  SourceEditorValuePreviewRenderer,
} from "./source-editor.ts"

type SourceEditorFeatures = {
  completion: boolean
  valueHints: boolean
  explanations: boolean
}

type PendingSelection = {
  start: number
  end: number
  reveal: boolean
}

export class LazySourceCodeEditor extends EventTarget {
  private editor?: SourceCodeEditor
  private loading?: Promise<void>
  private currentValue = ""
  private currentLanguage: SourceEditorLanguage = "ini"
  private currentDisabled = true
  private currentReadOnly = false
  private currentDecorations: SourceEditorDecorations = {}
  private currentFeatures: SourceEditorFeatures = {
    completion: false,
    valueHints: false,
    explanations: false,
  }
  private previewRenderer?: SourceEditorValuePreviewRenderer
  private pendingSelection?: PendingSelection
  private pendingReveal?: readonly [number, number]
  private changedSinceCommit = false

  constructor(private readonly parent: HTMLElement) {
    super()
  }

  get value(): string {
    return this.editor?.value ?? this.currentValue
  }

  set value(value: string) {
    this.currentValue = value
    this.changedSinceCommit = false
    if (this.editor) this.editor.value = value
  }

  get disabled(): boolean {
    return this.currentDisabled
  }

  set disabled(value: boolean) {
    this.currentDisabled = value
    if (this.editor) this.editor.disabled = value
  }

  get readOnly(): boolean {
    return this.currentReadOnly
  }

  set readOnly(value: boolean) {
    this.currentReadOnly = value
    if (this.editor) this.editor.readOnly = value
  }

  get renderedLineCount(): number {
    return this.editor?.renderedLineCount ?? 0
  }

  load(): Promise<void> {
    if (this.editor) return Promise.resolve()
    if (this.loading) return this.loading
    this.loading = import("./source-editor.ts")
      .then(({ SourceCodeEditor }) => {
        const editor = new SourceCodeEditor(this.parent)
        editor.addEventListener("input", () => {
          this.currentValue = editor.value
          this.changedSinceCommit = true
          this.dispatchEvent(new Event("input"))
        })
        editor.addEventListener("change", () => {
          this.currentValue = editor.value
          this.changedSinceCommit = false
          this.dispatchEvent(new Event("change"))
        })
        editor.addEventListener("valueclick", (event) => {
          const detail = (event as CustomEvent<SourceEditorValueClick>).detail
          this.dispatchEvent(new CustomEvent<SourceEditorValueClick>("valueclick", { detail }))
        })

        this.editor = editor
        editor.value = this.currentValue
        editor.setLanguage(this.currentLanguage)
        editor.disabled = this.currentDisabled
        editor.readOnly = this.currentReadOnly
        editor.setValuePreviewRenderer(this.previewRenderer)
        editor.setFeatures(this.currentFeatures)
        editor.setDecorations(this.currentDecorations)
        if (this.pendingSelection) {
          const { start, end, reveal } = this.pendingSelection
          editor.setSelectionRange(start, end, reveal)
        }
        if (this.pendingReveal) editor.revealRange(this.pendingReveal[0], this.pendingReveal[1])
      })
      .catch((error) => {
        this.loading = undefined
        throw error
      })
    return this.loading
  }

  setLanguage(language: SourceEditorLanguage): void {
    this.currentLanguage = language
    this.editor?.setLanguage(language)
  }

  setDecorations(value: SourceEditorDecorations): void {
    this.currentDecorations = value
    this.editor?.setDecorations(value)
  }

  setValuePreviewRenderer(renderer: SourceEditorValuePreviewRenderer | undefined): void {
    this.previewRenderer = renderer
    this.editor?.setValuePreviewRenderer(renderer)
  }

  setFeatures(features: Partial<SourceEditorFeatures>): void {
    this.currentFeatures = { ...this.currentFeatures, ...features }
    this.editor?.setFeatures(features)
  }

  replaceRange(from: number, to: number, value: string): void {
    if (this.editor) {
      this.editor.replaceRange(from, to, value)
      return
    }
    const start = Math.max(0, Math.min(this.currentValue.length, from))
    const end = Math.max(start, Math.min(this.currentValue.length, to))
    this.currentValue = `${this.currentValue.slice(0, start)}${value}${this.currentValue.slice(end)}`
    const head = start + value.length
    this.pendingSelection = { start: head, end: head, reveal: true }
    this.changedSinceCommit = true
    this.dispatchEvent(new Event("input"))
  }

  setSelectionRange(start: number, end = start, reveal = true): void {
    this.pendingSelection = { start, end, reveal }
    this.editor?.setSelectionRange(start, end, reveal)
  }

  collapseSelection(): void {
    if (this.editor) {
      this.editor.collapseSelection()
      return
    }
    if (this.pendingSelection) this.pendingSelection.end = this.pendingSelection.start
  }

  revealRange(start: number, end = start): void {
    this.pendingReveal = [start, end]
    this.editor?.revealRange(start, end)
  }

  focus(): void {
    this.editor?.focus()
  }

  commit(): void {
    if (this.editor) {
      this.editor.commit()
      return
    }
    if (!this.changedSinceCommit) return
    this.changedSinceCommit = false
    this.dispatchEvent(new Event("change"))
  }

  requestMeasure(): void {
    this.editor?.requestMeasure()
  }

  destroy(): void {
    this.editor?.destroy()
    this.editor = undefined
  }
}
