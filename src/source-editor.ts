import { defaultKeymap, indentWithTab } from "@codemirror/commands"
import {
  HighlightStyle,
  StreamLanguage,
  bracketMatching,
  indentOnInput,
  syntaxHighlighting,
} from "@codemirror/language"
import { json } from "@codemirror/lang-json"
import { properties } from "@codemirror/legacy-modes/mode/properties"
import {
  Compartment,
  EditorSelection,
  EditorState,
  StateEffect,
  StateField,
  Transaction,
  type Extension,
  type Range,
} from "@codemirror/state"
import {
  Decoration,
  EditorView,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  WidgetType,
  lineNumbers,
  type DecorationSet,
} from "@codemirror/view"
import { tags } from "@lezer/highlight"
import { actionDescription, knownFunctionCodes, knownSkinStates } from "./actions.ts"

export type SourceEditorLanguage = "ini" | "json"

export type SourceEditorDecorations = {
  selectedRanges?: readonly (readonly [number, number])[]
  searchRanges?: readonly (readonly [number, number])[]
  activeSearchRange?: readonly [number, number]
  valueRanges?: readonly SourceEditorValueRange[]
  previewRenderer?: SourceEditorValuePreviewRenderer
}

export type SourceEditorValueRange = {
  from: number
  to: number
  value: string
  kind: "action" | "color" | "style"
  label?: string
  color?: string
}

export type SourceEditorValueClick = SourceEditorValueRange

export type SourceEditorValuePreviewRenderer = (
  canvas: HTMLCanvasElement,
  range: SourceEditorValueRange,
) => void

const replaceDecorations = StateEffect.define<SourceEditorDecorations>()
const replaceExplanation = StateEffect.define<string>()

class ExplanationWidget extends WidgetType {
  constructor(private readonly text: string) { super() }
  toDOM(): HTMLElement {
    const node = document.createElement("div")
    node.className = "cm-source-explanation"
    node.textContent = `// ${this.text}`
    return node
  }
  eq(other: ExplanationWidget): boolean { return this.text === other.text }
}

const explanationField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, transaction) {
    value = value.map(transaction.changes)
    for (const effect of transaction.effects) {
      if (effect.is(replaceExplanation)) {
        value = effect.value
          ? Decoration.set([Decoration.widget({ widget: new ExplanationWidget(effect.value), block: true }).range(transaction.state.selection.main.head)], true)
          : Decoration.none
      }
    }
    return value
  },
  provide: (field) => EditorView.decorations.from(field),
})

class ValueSwatchWidget extends WidgetType {
  constructor(private readonly color: string) { super() }
  toDOM(): HTMLElement {
    const node = document.createElement("span")
    node.className = "cm-source-value-thumbnail cm-source-value-swatch"
    node.style.backgroundColor = this.color
    node.title = this.color
    return node
  }
  eq(other: ValueSwatchWidget): boolean { return this.color === other.color }
}

class ValuePreviewWidget extends WidgetType {
  constructor(
    private readonly range: SourceEditorValueRange,
    private readonly renderer?: SourceEditorValuePreviewRenderer,
  ) { super() }
  toDOM(): HTMLElement {
    const node = document.createElement("span")
    node.className = "cm-source-value-thumbnail"
    const canvas = document.createElement("canvas")
    canvas.width = 64
    canvas.height = 36
    canvas.setAttribute("aria-hidden", "true")
    node.append(canvas)
    this.renderer?.(canvas, this.range)
    return node
  }
  eq(other: ValuePreviewWidget): boolean {
    return this.range.value === other.range.value && this.range.kind === other.range.kind
  }
}

function decorationSet(state: EditorState, value: SourceEditorDecorations): DecorationSet {
  const length = state.doc.length
  const ranges: Range<Decoration>[] = []
  const addMark = (range: readonly [number, number], className: string): void => {
    const from = Math.max(0, Math.min(length, range[0]))
    const to = Math.max(from, Math.min(length, range[1]))
    if (from < to) ranges.push(Decoration.mark({ class: className }).range(from, to))
  }
  const selectedLines = new Set<number>()
  for (const range of value.selectedRanges ?? []) {
    const from = Math.max(0, Math.min(length, range[0]))
    const to = Math.max(from, Math.min(length, range[1]))
    if (from === to) continue
    const lastLine = state.doc.lineAt(to - 1).number
    for (let lineNumber = state.doc.lineAt(from).number; lineNumber <= lastLine; lineNumber += 1) {
      selectedLines.add(state.doc.line(lineNumber).from)
    }
  }
  for (const from of selectedLines) {
    ranges.push(Decoration.line({ class: "cm-source-selected" }).range(from))
  }
  for (const range of value.searchRanges ?? []) addMark(range, "cm-source-search-match")
  if (value.activeSearchRange) addMark(value.activeSearchRange, "cm-source-search-active")
  for (const range of value.valueRanges ?? []) {
    if (range.kind === "action") continue
    addMark([range.from, range.to], `cm-source-value cm-source-value-${range.kind}`)
    if (range.color) ranges.push(Decoration.widget({ widget: new ValueSwatchWidget(range.color), side: -1 }).range(range.from))
    else ranges.push(Decoration.widget({ widget: new ValuePreviewWidget(range, value.previewRenderer), side: -1 }).range(range.from))
  }
  return Decoration.set(ranges, true)
}

const sourceDecorations = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, transaction) {
    value = value.map(transaction.changes)
    for (const effect of transaction.effects) {
      if (effect.is(replaceDecorations)) value = decorationSet(transaction.state, effect.value)
    }
    return value
  },
  provide: (field) => EditorView.decorations.from(field),
})

const sourceHighlightStyle = HighlightStyle.define([
  { tag: tags.comment, class: "token-comment" },
  { tag: tags.heading, class: "token-section" },
  { tag: [tags.propertyName, tags.definition(tags.variableName)], class: "token-key" },
  { tag: [tags.number, tags.integer, tags.float], class: "token-number" },
  { tag: [tags.bool, tags.null, tags.atom], class: "token-section" },
  { tag: [tags.string, tags.character, tags.regexp], class: "token-action" },
  { tag: [tags.operator, tags.punctuation, tags.separator], class: "token-operator" },
])

const iniLanguage = StreamLanguage.define(properties)
const baseExtensions: Extension[] = [
  lineNumbers(),
  highlightActiveLineGutter(),
  highlightSpecialChars(),
  drawSelection(),
  dropCursor(),
  EditorState.allowMultipleSelections.of(true),
  indentOnInput(),
  bracketMatching(),
  highlightActiveLine(),
  keymap.of([...defaultKeymap, indentWithTab]),
  syntaxHighlighting(sourceHighlightStyle),
  sourceDecorations,
  explanationField,
  EditorView.contentAttributes.of({
    "aria-label": "配置源代码",
    autocapitalize: "off",
    autocomplete: "off",
    spellcheck: "false",
  }),
]

export class SourceCodeEditor extends EventTarget {
  readonly view: EditorView
  private readonly languageCompartment = new Compartment()
  private readonly editableCompartment = new Compartment()
  private language: SourceEditorLanguage = "ini"
  private isDisabled = true
  private isReadOnly = false
  private suppressInput = false
  private changedSinceCommit = false
  private features = { completion: false, valueHints: false, explanations: false }
  private valueRanges: SourceEditorValueRange[] = []
  private valuePreviewRenderer?: SourceEditorValuePreviewRenderer
  private completionPopup?: HTMLElement
  private completionItems: string[] = []
  private completionIndex = 0
  private completionFrom = 0

  constructor(parent: HTMLElement) {
    super()
    this.view = new EditorView({
      parent,
      state: EditorState.create({
        extensions: [
          ...baseExtensions,
          this.languageCompartment.of(iniLanguage),
          this.editableCompartment.of(this.editableExtensions()),
          EditorView.updateListener.of((update) => {
            if (update.selectionSet) this.refreshExplanation()
            if (!update.docChanged || this.suppressInput) return
            this.changedSinceCommit = true
            this.dispatchEvent(new Event("input"))
            if (this.features.completion) this.refreshCompletion()
          }),
          EditorView.domEventHandlers({
            keydown: (event) => this.handleKeydown(event),
            mouseup: () => {
              this.refreshExplanation()
              return false
            },
            mousedown: (event, view) => {
              if (!this.features.valueHints || event.button !== 0) return false
              const target = event.target instanceof HTMLElement ? event.target.closest(".cm-source-value") : null
              if (!target) return false
              const position = view.posAtCoords({ x: event.clientX, y: event.clientY })
              if (position === null) return false
              const range = this.valueRanges.find((item) => item.kind !== "action" && position >= item.from && position < item.to)
              if (!range) return false
              this.dispatchEvent(new CustomEvent<SourceEditorValueClick>("valueclick", { detail: range }))
              return true
            },
          }),
          EditorView.domEventHandlers({
            blur: () => {
              this.commit()
              return false
            },
          }),
        ],
      }),
    })
    this.refreshExplanation()
  }

  get value(): string {
    return this.view.state.doc.toString()
  }

  set value(value: string) {
    if (value === this.value) return
    this.suppressInput = true
    this.view.dispatch({
      changes: { from: 0, to: this.view.state.doc.length, insert: value },
      selection: { anchor: 0 },
      annotations: Transaction.addToHistory.of(false),
    })
    this.suppressInput = false
    this.changedSinceCommit = false
  }

  get disabled(): boolean {
    return this.isDisabled
  }

  set disabled(value: boolean) {
    if (value === this.isDisabled) return
    this.isDisabled = value
    this.reconfigureEditable()
  }

  get readOnly(): boolean {
    return this.isReadOnly
  }

  set readOnly(value: boolean) {
    if (value === this.isReadOnly) return
    this.isReadOnly = value
    this.reconfigureEditable()
  }

  get renderedLineCount(): number {
    return this.view.contentDOM.querySelectorAll(".cm-line").length
  }

  setLanguage(language: SourceEditorLanguage): void {
    if (language === this.language) return
    this.language = language
    this.view.dispatch({
      effects: this.languageCompartment.reconfigure(language === "json" ? json() : iniLanguage),
    })
  }

  setDecorations(value: SourceEditorDecorations): void {
    this.valueRanges = [...(value.valueRanges ?? [])]
    this.view.dispatch({ effects: replaceDecorations.of({ ...value, previewRenderer: this.valuePreviewRenderer }) })
    this.refreshExplanation()
  }

  setValuePreviewRenderer(renderer: SourceEditorValuePreviewRenderer | undefined): void {
    this.valuePreviewRenderer = renderer
    this.view.dispatch({ effects: replaceDecorations.of({ valueRanges: this.valueRanges, previewRenderer: renderer }) })
  }

  setFeatures(features: Partial<typeof this.features>): void {
    this.features = { ...this.features, ...features }
    if (!this.features.completion) this.closeCompletion()
    this.refreshExplanation()
  }

  replaceRange(from: number, to: number, value: string): void {
    this.view.dispatch({ changes: { from, to, insert: value } })
    this.focus()
  }

  setSelectionRange(start: number, end = start, reveal = true): void {
    const length = this.view.state.doc.length
    const from = Math.max(0, Math.min(length, start))
    const to = Math.max(from, Math.min(length, end))
    const range = EditorSelection.range(from, to)
    this.view.dispatch({
      selection: range,
      effects: reveal ? EditorView.scrollIntoView(range, { y: "center" }) : undefined,
    })
  }

  collapseSelection(): void {
    const head = this.view.state.selection.main.head
    this.view.dispatch({ selection: { anchor: head } })
  }

  revealRange(start: number, end = start): void {
    const length = this.view.state.doc.length
    const from = Math.max(0, Math.min(length, start))
    const to = Math.max(from, Math.min(length, end))
    this.view.dispatch({ effects: EditorView.scrollIntoView(EditorSelection.range(from, to), { y: "center" }) })
  }

  focus(): void {
    this.view.focus()
  }

  commit(): void {
    if (!this.changedSinceCommit) return
    this.changedSinceCommit = false
    this.dispatchEvent(new Event("change"))
  }

  requestMeasure(): void {
    this.view.requestMeasure()
  }

  destroy(): void {
    this.closeCompletion()
    this.view.destroy()
  }

  private handleKeydown(event: KeyboardEvent): boolean {
    if (!this.features.completion) return false
    if (event.key === "Escape" && this.completionPopup) {
      event.preventDefault(); this.closeCompletion(); return true
    }
    if (!this.completionPopup && event.key === " " && event.ctrlKey) {
      event.preventDefault(); this.openCompletion(); return true
    }
    if (!this.completionPopup) return false
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault()
      this.completionIndex = (this.completionIndex + (event.key === "ArrowDown" ? 1 : -1) + this.completionItems.length) % this.completionItems.length
      this.renderCompletion()
      return true
    }
    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault()
      const item = this.completionItems[this.completionIndex]
      if (item) this.replaceRange(this.completionFrom, this.view.state.selection.main.head, item)
      this.closeCompletion()
      return true
    }
    return false
  }

  private refreshCompletion(): void {
    if (!this.features.completion) return
    const head = this.view.state.selection.main.head
    const line = this.view.state.doc.lineAt(head)
    const prefix = line.text.slice(0, head - line.from).match(/(?:^|[=:\s"'])\s*([FS]\d*)$/i)
    if (!prefix) { this.closeCompletion(); return }
    this.completionFrom = head - prefix[1].length
    const query = prefix[1].toUpperCase()
    this.completionItems = (query.startsWith("F") ? knownFunctionCodes : knownSkinStates.map((state) => `S${state}`))
      .filter((item) => item.startsWith(query)).slice(0, 24)
    if (!this.completionItems.length) { this.closeCompletion(); return }
    this.completionIndex = 0
    this.renderCompletion()
  }

  private openCompletion(): void { this.refreshCompletion() }

  private renderCompletion(): void {
    if (!this.completionItems.length) return
    if (!this.completionPopup) {
      this.completionPopup = document.createElement("div")
      this.completionPopup.className = "cm-source-completion"
      this.completionPopup.addEventListener("mousedown", (event) => event.preventDefault())
      this.view.dom.parentElement?.append(this.completionPopup)
    }
    this.completionPopup.replaceChildren(...this.completionItems.map((item, index) => {
      const button = document.createElement("button")
      button.type = "button"
      button.className = index === this.completionIndex ? "active" : ""
      button.textContent = item
      button.title = actionDescription(item) || `百度状态码 ${item}`
      button.addEventListener("click", () => {
        this.replaceRange(this.completionFrom, this.view.state.selection.main.head, item)
        this.closeCompletion()
      })
      return button
    }))
    const coords = this.view.coordsAtPos(this.view.state.selection.main.head)
    const parent = this.view.dom.parentElement
    if (coords && parent) {
      const bounds = parent.getBoundingClientRect()
      this.completionPopup.style.left = `${Math.max(0, coords.left - bounds.left)}px`
      this.completionPopup.style.top = `${coords.bottom - bounds.top + 3}px`
    }
  }

  private closeCompletion(): void {
    this.completionPopup?.remove()
    this.completionPopup = undefined
    this.completionItems = []
  }

  private refreshExplanation(): void {
    if (!this.features.explanations) {
      this.view.dispatch({ effects: replaceExplanation.of("") })
      return
    }
    const selection = this.view.state.selection.main
    const selectedText = this.view.state.sliceDoc(selection.from, selection.to).trim()
    const line = this.view.state.doc.lineAt(selection.head).text
    const match = (selectedText.match(/^(F\d+|S\d+(?:_\d+)?)$/i) ?? line.match(/(?:^|[=:\s"'])(F\d+|S\d+(?:_\d+)?)(?=\s*(?:[,}"'#;]|$))/i))
    const value = match?.[1]?.toUpperCase()
    this.view.dispatch({ effects: replaceExplanation.of(value ? actionDescription(value) : "") })
  }

  private editableExtensions(): Extension {
    const readOnly = this.isDisabled || this.isReadOnly
    return [
      EditorState.readOnly.of(readOnly),
      EditorView.editable.of(!readOnly),
      EditorView.contentAttributes.of({
        "aria-disabled": String(this.isDisabled),
        "aria-readonly": String(readOnly),
      }),
    ]
  }

  private reconfigureEditable(): void {
    this.view.dispatch({ effects: this.editableCompartment.reconfigure(this.editableExtensions()) })
  }
}
