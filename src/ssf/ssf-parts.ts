// Which Sogou sections draw a key. The converters (ssf-look.ts) and the editor's inspector both read a
// key through these, so the sections the inspector edits are exactly the ones the canvas shows.

import type { IniDocument } from "../ini.ts"
import type { SsfKeyBinding } from "./ssf-keymap.ts"
import { parseSsfImage, type SsfImageRef } from "./ssf-package.ts"

/** Accepts an image reference; converters also require the file to exist. */
export type SsfImageCheck = (ref: SsfImageRef) => boolean

export type SsfBackground = {
  /** Key section whose BG_IMAGES names the background; absent when a shared default class draws it. */
  owner?: string
  /** Section holding the NORMAL / PRESSED images. */
  images: string
}

export type SsfForeground =
  /** keys.ini: `[owner] FG_IMAGES=images`, `[images] NORMAL=…`, placed by FG_RECT. */
  | { kind: "keys"; owner: string; images: string; rect?: number[] }
  /** phoneSkin.ini: `[owner] ICON=…`, centred on the key. */
  | { kind: "icon"; owner: string }

export function firstValue(value: string | undefined): string | undefined {
  return value?.split(",")[0].trim() || undefined
}

const anyImage: SsfImageCheck = () => true

export function ssfBackground(skin: IniDocument, binding: SsfKeyBinding, usable = anyImage): SsfBackground | undefined {
  for (const owner of binding.sections) {
    const images = firstValue(skin.get(owner, "BG_IMAGES"))
    const ref = images && parseSsfImage(skin.get(images, "NORMAL"))
    if (images && ref && usable(ref)) return { owner, images }
  }
  for (const images of binding.defaults) {
    const ref = parseSsfImage(skin.get(images, "NORMAL"))
    if (ref && usable(ref)) return { images }
  }
}

export function ssfForeground(skin: IniDocument, keys: IniDocument, binding: SsfKeyBinding): SsfForeground | undefined {
  for (const owner of binding.sections) {
    const images = firstValue(keys.get(owner, "FG_IMAGES"))
    if (!images || !firstValue(keys.get(images, "NORMAL"))) continue
    const rect = keys.get(owner, "FG_RECT")?.split(",").map(Number)
    return { kind: "keys", owner, images, rect: rect?.length === 4 && rect.every(Number.isFinite) ? rect : undefined }
  }
  for (const owner of binding.sections) {
    const icon = firstValue(skin.get(owner, "ICON"))
    if (icon && !/^transparent\.png$/i.test(icon)) return { kind: "icon", owner }
  }
}

/** The key's `FG_STYLE` section and the TextStyle its `LABEL_STYLE` names (Sogou reads key text only this way). */
export function ssfLabelStyle(skin: IniDocument, binding: SsfKeyBinding): { fgStyle: string; owner: string; style?: string } | undefined {
  for (const owner of binding.sections) {
    const fgStyle = firstValue(skin.get(owner, "FG_STYLE"))
    if (fgStyle) return { fgStyle, owner, style: firstValue(skin.get(fgStyle, "LABEL_STYLE")) }
  }
}

/**
 * Sections a key's label colour is looked up in, most specific first: the FG_STYLE label style, the
 * key's own classes (older editor exports wrote TEXT_COLOR there), then the board's default styles.
 */
export function ssfTextSections(binding: SsfKeyBinding, qwerty: boolean, skin?: IniDocument): string[] {
  const styles = binding.keyClass === "function"
    ? [qwerty ? "TextStyle_FuncKey_26char" : "TextStyle_FuncKey_T9", "TextStyle"]
    : binding.keyClass === "space" ? ["TextStyle_Space_Label", "TextStyle"]
      : [qwerty ? "TextStyle_Qwerty" : "TextStyle_Phone_Label", "TextStyle"]
  const label = skin && ssfLabelStyle(skin, binding)?.style
  return [...new Set([...label ? [label] : [], ...binding.sections, ...styles])]
}

/** sound_android.ini section that gives a key (or, without a binding, every key) its sound. */
export function ssfSoundSection(sounds: IniDocument, binding: SsfKeyBinding | undefined): string | undefined {
  return (binding ? binding.sections : ["Key"]).find((section) => sounds.get(section, "sound")?.trim())
}
