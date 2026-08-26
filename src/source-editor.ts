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
  lineNumbers,
  type DecorationSet,
} from "@codemirror/view"
import { tags } from "@lezer/highlight"

export type SourceEditorLanguage = "ini" | "json"

export type SourceEditorDecorations = {
  selectedRanges?: readonly (readonly [number, number])[]
  searchRanges?: readonly (readonly [number, number])[]
  activeSearchRange?: readonly [number, number]
}

const replaceDecorations = StateEffect.define<SourceEditorDecorations>()

function decorationSet(state: EditorState, value: SourceEditorDecorations): DecorationSet {
  const length = state.doc.length
  const ranges: Range<Decoration>[] = []
  const add = (range: readonly [number, number], className: string): void => {
    const from = Math.max(0, Math.min(length, range[0]))
    const to = Math.max(from, Math.min(length, range[1]))
    if (from < to) ranges.push(Decoration.mark({ class: className }).range(from, to))
  }
  for (const range of value.selectedRanges ?? []) add(range, "cm-source-selected")
  for (const range of value.searchRanges ?? []) add(range, "cm-source-search-match")
  if (value.activeSearchRange) add(value.activeSearchRange, "cm-source-search-active")
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
            if (!update.docChanged || this.suppressInput) return
            this.changedSinceCommit = true
            this.dispatchEvent(new Event("input"))
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
    this.view.dispatch({ effects: replaceDecorations.of(value) })
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
    this.view.destroy()
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
