// Correspondence between Baidu layout keys and Sogou key classes.
//
// Baidu skins place keys explicitly (`[KEYn] CENTER=q VIEW_RECT=…`); Sogou skins only style key
// *classes* (`[Key_Q]`, `[Key_Backspace_Qwerty]`) and let the app place them. A Baidu key is identified
// by its board (from the layout file name) and its action (`CENTER`), which picks an ordered list of
// Sogou sections: the most specific one first, then the shared defaults (`KeyBg_Default_Latin`, …) a
// Sogou app falls back to. Both conversion directions use this one table.

type SsfBoard = "py26" | "en26" | "num26" | "py9" | "en9" | "bh" | "num9" | "other"
type SsfKeyClass = "char" | "space" | "function"
export type SsfKeyBinding = {
  /** Sogou key sections, most specific first (landscape variants lead in landscape). */
  sections: string[]
  /** Shared background classes used when no key section names a background. */
  defaults: string[]
  keyClass: SsfKeyClass
}

const NINE_KEY_GROUPS = ["ABC", "DEF", "GHI", "JKL", "MNO", "PQRS", "TUV", "WXYZ"]
const STROKES = ["One", "Two", "Three", "Four", "Five"]
/** Only these letters have separate pinyin / English classes (`Key_H_PY`, `Key_H_EN`); the rest share `Key_Q`. */
const MODE_LETTERS = "HJLS"

export function ssfBoard(layout: string): SsfBoard {
  // BDA landscape adds split / one-handed variants of the same boards (`py_9_split_left`, `bh_union`).
  const name = layout.replace(/\.ini$/i, "").split("/").pop()!.toLowerCase().replace(/_(?:split|union)(?:_left)?$/, "")
  if (name === "py_26" || name === "def_26") return "py26"
  if (name === "en_26" || name === "en_26s") return "en26"
  if (/^num_26/.test(name)) return "num26"
  if (name === "py_9" || name === "def_9") return "py9"
  if (name === "en_9" || name === "en_9s") return "en9"
  if (name === "bh") return "bh"
  if (name === "num_9") return "num9"
  return "other"
}

const isQwerty = (board: SsfBoard) => board === "py26" || board === "en26" || board === "num26"

/** Function keys whose Sogou class only differs by the `_Qwerty` suffix on 26-key boards. */
const FUNCTION_KEYS: Record<string, [qwerty: string[], nine: string[]]> = {
  F36: [["Key_Backspace_Qwerty"], ["Key_Backspace"]],
  F39: [["Key_Enter_Qwerty"], ["Key_Enter"]],
  F38: [["Key_Space"], ["Key_Space"]],
  F6: [["Key_Symbols_Qwerty"], ["Key_Digits"]],
  "Z+num_26_1": [["Key_Symbols_Qwerty"], ["Key_Digits"]],
  F1: [["Key_SymbolTable_Qwerty"], ["Key_SymbolTable"]],
  F16: [["Key_SwitchToEN_Qwerty"], ["Key_SwitchToEN"]],
  F15: [["Key_EnSwitchToCH_Qwerty"], ["Key_EnSwitchToCH"]],
  F10: [["Key_Shift_Qwerty", "Key_Shift"], ["Key_Shift"]],
  F11: [["Key_Shift_Qwerty", "Key_Shift"], ["Key_Shift"]],
  F4: [["Key_Return"], ["Key_Return"]],
  F40: [["Key_Clear_Input"], ["Key_Clear_Input"]],
  F25: [["Key_Prediction"], ["Key_Prediction_En9"]],
}

function primarySections(board: SsfBoard, action: string): string[] {
  const letter = /^[a-z]$/i.test(action) ? action.toUpperCase() : undefined
  const digit = /^\d$/.test(action) ? action : undefined
  const fn = FUNCTION_KEYS[action]
  if (fn) return isQwerty(board) ? fn[0] : fn[1]
  switch (board) {
    case "py26":
      if (letter) return MODE_LETTERS.includes(letter) ? [`Key_${letter}_PY`, `Key_${letter}`] : [`Key_${letter}`]
      if (action === "'") return ["Key_Separator"]
      if (action === "，") return ["Key_UDSymbol1_Qwerty"]
      if (action === "。") return ["Key_UDSymbol2_Qwerty"]
      return []
    case "en26":
      if (letter) return MODE_LETTERS.includes(letter) ? [`Key_${letter}_EN`, `Key_${letter}`] : [`Key_${letter}`]
      if (action === ".") return ["Key_PeriodEn_T"]
      if (action === ",") return ["Key_CommaEn_T"]
      return []
    case "num26":
      return digit ? [`Key_${digit}_Qwerty`] : []
    case "num9":
      return digit ? [`Key_${digit}`] : []
    case "py9":
    case "en9": {
      if (letter) {
        const group = NINE_KEY_GROUPS.find((value) => value.includes(letter))
        return group ? [`Key_${group}`] : []
      }
      if (action === "'") return ["Key_PunctPY"]
      return action === "…" || action === "*" ? ["Key_Punct"] : []
    }
    case "bh": {
      const stroke = action.match(/^B([1-6])$/)?.[1]
      if (stroke) return [stroke === "6" ? "Key_Wildcard" : `Key_${STROKES[Number(stroke) - 1]}`]
      if (action === "'") return ["Key_Separator_bh_S"]
      if (action === "：") return ["Key_Eight_S"]
      return action === "；" ? ["Key_Nine_S"] : []
    }
    default:
      return []
  }
}

/** Sogou names landscape classes either `Key_D_Land` or `Key_H_Land_PY`. */
function landscapeVariants(section: string): string[] {
  const suffixed = section.match(/^(.*)_(PY|EN)$/)
  return suffixed ? [`${suffixed[1]}_Land_${suffixed[2]}`, `${section}_Land`] : [`${section}_Land`]
}

function ssfKeyClass(action: string): SsfKeyClass {
  if (action === "F38") return "space"
  return /^(F\d+|Z\+)/.test(action) ? "function" : "char"
}

export function ssfKeyBinding(layout: string, action: string, landscape: boolean): SsfKeyBinding {
  const board = ssfBoard(layout)
  const primary = primarySections(board, action)
  const sections = landscape ? [...primary.flatMap(landscapeVariants), ...primary] : primary
  const keyClass = ssfKeyClass(action)
  const qwerty = isQwerty(board)
  const defaults = keyClass === "space"
    ? qwerty ? ["KeyBg_Space_Qwerty", "KeyBg_Space"] : ["KeyBg_Space"]
    : keyClass === "function"
      ? qwerty ? ["KeyBg_Function_Qwerty", "KeyBg_Function"] : ["KeyBg_Function"]
      : qwerty ? ["KeyBg_Default_Latin", "KeyBg_Default"] : ["KeyBg_Default"]
  return { sections, defaults, keyClass }
}
