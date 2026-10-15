// What a Sogou theme shows for each Baidu key, as ready-to-write images and colours.
//
// Shared by the BDS/BDI writer (ssf-to-baidu.ts) and the BDA writer (ssf-to-bda.ts) so both read the
// Sogou skin the same way: a key's background comes from its class or the shared defaults, its
// foreground from keys.ini (FG_RECT baked in as transparent padding, because Baidu stretches a
// foreground over the whole key) or from an icon centred on the background's canvas.

import type { IniDocument } from "../ini.ts"
import { ssfKeyBinding, type SsfKeyBinding } from "./ssf-keymap.ts"
import { parseSsfImage, ssfColor, type SsfImageRef, type SsfPackage, type SsfStretch, type SsfTheme } from "./ssf-package.ts"
import { MAX_PIXELS, compositeImage, cropImage, decodePng, encodePng, isPng, placeImage, pngSize, resizeImage, type RgbaImage } from "./ssf-png.ts"

/** `id` is stable for identical content, so writers can share one file per distinct image. */
export type LookImage = { id: string; bytes: Uint8Array; stretch?: SsfStretch }
export type LookPair = { normal: LookImage; pressed: LookImage }
export type LookColors = { normal: string; pressed: string }
type KeyLook = { binding: SsfKeyBinding; back?: LookPair; fore?: LookPair; label?: LookColors }

/** Sogou designs the keyboard at 1080 px wide; bar heights in its images use that scale. */
const SOGOU_WIDTH = 1080

type Foreground = { normal: string; pressed: string; rect?: number[] }

function first(value: string | undefined): string | undefined {
  return value?.split(",")[0].trim() || undefined
}

export class SsfLook {
  readonly theme: SsfTheme
  private readonly pkg: SsfPackage
  private readonly skin: IniDocument
  private readonly keys: IniDocument
  private readonly sounds: IniDocument
  private readonly warnings: string[]
  private readonly missing = new Set<string>()
  private readonly decoded = new Map<string, RgbaImage | undefined>()
  private readonly derived = new Map<string, LookImage | undefined>()
  private keyboardCache?: { panel?: LookImage; cand?: LookImage; panelColor?: string }

  constructor(pkg: SsfPackage, theme: SsfTheme, warnings: string[]) {
    this.pkg = pkg
    this.theme = theme
    this.warnings = warnings
    this.skin = pkg.skin(theme)
    this.keys = pkg.keys(theme)
    this.sounds = pkg.ini("default/sound_android.ini")
  }

  private file(name: string): Uint8Array | undefined {
    const bytes = this.pkg.file(this.theme, name)
    if (!bytes || !isPng(bytes)) {
      if (!this.missing.has(name)) {
        this.missing.add(name)
        this.warnings.push(`${this.theme === "dark" ? "夜间" : "白天"}外观缺少图片或不是 PNG：${name}`)
      }
      return
    }
    return bytes
  }

  decode(id: string, bytes: Uint8Array | undefined): RgbaImage | undefined {
    if (!this.decoded.has(id)) {
      let image: RgbaImage | undefined
      try {
        image = bytes ? decodePng(bytes) : undefined
      } catch (error) {
        this.warnings.push(`${id} 无法解码（${error instanceof Error ? error.message : error}），已跳过`)
      }
      this.decoded.set(id, image)
    }
    return this.decoded.get(id)
  }

  private image(ref: SsfImageRef): LookImage | undefined {
    const bytes = this.file(ref.file)
    return bytes ? { id: `${ref.file}|${ref.stretch ?? ""}`, bytes, stretch: ref.stretch } : undefined
  }

  /** Images derived from Sogou files (padded, cropped, composited) are built once per id. */
  private derive(id: string, build: () => RgbaImage | undefined): LookImage | undefined {
    if (!this.derived.has(id)) {
      const image = build()
      this.derived.set(id, image && { id, bytes: encodePng(image) })
    }
    return this.derived.get(id)
  }

  private statePair(section: string): LookPair | undefined {
    const normalRef = parseSsfImage(this.skin.get(section, "NORMAL"))
    const normal = normalRef && this.image(normalRef)
    if (!normal) return
    const pressedRef = parseSsfImage(this.skin.get(section, "PRESSED"))
    return { normal, pressed: (pressedRef && this.image(pressedRef)) ?? normal }
  }

  private background(binding: SsfKeyBinding): LookPair | undefined {
    for (const section of binding.sections) {
      const name = first(this.skin.get(section, "BG_IMAGES"))
      const pair = name ? this.statePair(name) : undefined
      if (pair) return pair
    }
    for (const section of binding.defaults) {
      const pair = this.statePair(section)
      if (pair) return pair
    }
  }

  private foregroundSource(binding: SsfKeyBinding): Foreground | undefined {
    for (const section of binding.sections) {
      const name = first(this.keys.get(section, "FG_IMAGES"))
      const normal = name && first(this.keys.get(name, "NORMAL"))
      if (!name || !normal) continue
      const rect = this.keys.get(section, "FG_RECT")?.split(",").map(Number)
      return { normal, pressed: first(this.keys.get(name, "PRESSED")) ?? normal, rect: rect?.length === 4 && rect.every(Number.isFinite) ? rect : undefined }
    }
    for (const section of binding.sections) {
      const icon = first(this.skin.get(section, "ICON"))
      if (!icon || /^transparent\.png$/i.test(icon)) continue
      return { normal: icon, pressed: first(this.skin.get(section, "ICON_PRESSED")) ?? icon }
    }
  }

  /**
   * FG_RECT (fractions of the key) becomes transparent padding; an icon is centred on a canvas the
   * size of the key's own background image, which Sogou draws at the key's real size.
   */
  private foregroundImage(name: string, rect: number[] | undefined, canvas: [number, number] | undefined): LookImage | undefined {
    const bytes = this.file(name)
    if (!bytes) return
    const source = this.decode(name, bytes)
    if (!source) return
    if (rect) {
      const [x, y, width, height] = rect
      if (!(width > 0 && height > 0 && width <= 1 && height <= 1) || (!x && !y && width === 1 && height === 1)) return { id: name, bytes }
      const canvasWidth = Math.round(source.width / width)
      const canvasHeight = Math.round(source.height / height)
      // A tiny FG_RECT would ask for a canvas many times the glyph; such a key keeps the bare glyph.
      if (canvasWidth * canvasHeight > MAX_PIXELS) return { id: name, bytes }
      return this.derive(`${name}|rect:${rect.join(",")}`, () =>
        placeImage(source, canvasWidth, canvasHeight, Math.round(x * canvasWidth), Math.round(y * canvasHeight)))
    }
    if (!canvas || canvas[0] * canvas[1] > MAX_PIXELS || (source.width >= canvas[0] && source.height >= canvas[1])) return { id: name, bytes }
    return this.derive(`${name}|canvas:${canvas.join("x")}`, () => {
      const width = Math.max(canvas[0], source.width)
      const height = Math.max(canvas[1], source.height)
      return placeImage(source, width, height, Math.round((width - source.width) / 2), Math.round((height - source.height) / 2))
    })
  }

  private labelColor(binding: SsfKeyBinding, qwerty: boolean, pressed: boolean): string | undefined {
    const field = pressed ? "TEXT_COLOR_PRESSED" : "TEXT_COLOR"
    const textStyles = binding.keyClass === "function"
      ? [qwerty ? "TextStyle_FuncKey_26char" : "TextStyle_FuncKey_T9", "TextStyle"]
      : binding.keyClass === "space" ? ["TextStyle_Space_Label", "TextStyle"]
        : [qwerty ? "TextStyle_Qwerty" : "TextStyle_Phone_Label", "TextStyle"]
    for (const section of [...binding.sections, ...textStyles]) {
      const color = ssfColor(this.skin.get(section, field)) ?? (pressed ? ssfColor(this.skin.get(section, "TEXT_COLOR")) : undefined)
      if (color) return color
    }
    if (binding.keyClass === "function") return ssfColor(this.skin.get("General", pressed ? "HIGH_LIGHT_ICON_COLOR" : "ICON_COLOR"))
  }

  key(layout: string, action: string, landscape: boolean): KeyLook {
    const binding = ssfKeyBinding(layout, action, landscape)
    const back = this.background(binding)
    const source = this.foregroundSource(binding)
    const canvas = back ? pngSize(back.normal.bytes) : undefined
    const normal = source && this.foregroundImage(source.normal, source.rect, canvas)
    const fore = source && normal ? { normal, pressed: this.foregroundImage(source.pressed, source.rect, canvas) ?? normal } : undefined
    const qwerty = /_26/.test(layout)
    const labelNormal = this.labelColor(binding, qwerty, false)
    const label = labelNormal ? { normal: labelNormal, pressed: this.labelColor(binding, qwerty, true) ?? labelNormal } : undefined
    return { binding, back, fore, label }
  }

  /**
   * Sogou paints one background behind both the candidate bar and the keys; Baidu styles them apart,
   * so the background is cut at the bar's height and the (usually translucent) bar is laid over the top.
   */
  keyboard(): { panel?: LookImage; cand?: LookImage; panelColor?: string } {
    if (this.keyboardCache) return this.keyboardCache
    const backgroundName = [
      this.skin.get("RootView", "BG_IMAGE"),
      this.skin.get("WALLPAPER", "BG_IMAGE"),
      this.skin.get("General", "PLATFORM_BG_IMAGE"),
    ].map(first).find((value) => value && /\.png$/i.test(value))
    const barSection = this.skin.get("CandidateView", "BG_IMAGE")?.trim()
    const barRef = barSection ? parseSsfImage(this.skin.get(barSection, "NORMAL")) : undefined
    const background = backgroundName ? this.decode(backgroundName, this.file(backgroundName)) : undefined
    const barBytes = barRef && this.file(barRef.file)
    const bar = barRef && this.decode(barRef.file, barBytes)
    const result: { panel?: LookImage; cand?: LookImage; panelColor?: string } = {}
    if (background) {
      const top = Math.min(background.height - 1, Math.max(0, bar ? Math.round(bar.height * background.width / SOGOU_WIDTH) : 0))
      result.panel = this.derive(`${backgroundName}|panel`, () => cropImage(background, 0, top, background.width, background.height - top))
      if (top > 0 && bar) {
        result.cand = this.derive(`${backgroundName}|cand`, () =>
          compositeImage(cropImage(background, 0, 0, background.width, top), resizeImage(bar, background.width, top)))
      }
    } else if (barRef && barBytes) {
      result.cand = { id: barRef.file, bytes: barBytes, stretch: barRef.stretch }
    }
    result.panelColor = ssfColor(this.skin.get("WALLPAPER", "COLOR")) ?? ssfColor(this.skin.get("RootView", "BG_FUNCTION_COLOR"))
    if (!result.panel && !result.panelColor) this.warnings.push(`${this.theme === "dark" ? "夜间" : "白天"}外观没有键盘背景，保留模板背景`)
    this.keyboardCache = result
    return result
  }

  /** The 9-key symbol column, which Sogou styles as the candidate code view. */
  list(): { back?: LookPair; cell?: LookPair; text?: string } {
    const back = first(this.skin.get("CandidateCodeView", "BG_IMAGE"))
    const cell = first(this.skin.get("CandidateCodeView", "BG_IMAGES"))
    return {
      back: back ? this.statePair(back) : undefined,
      cell: cell ? this.statePair(cell) : undefined,
      text: ["TextStyle_Popup_Code", "TextStyle_Symbol", "TextStyle"].map((section) => ssfColor(this.skin.get(section, "TEXT_COLOR"))).find(Boolean),
    }
  }

  color(section: string, field = "TEXT_COLOR"): string | undefined {
    return ssfColor(this.skin.get(section, field))
  }

  /** Key sound for a binding (or the default `[Key]` sound), as the file to copy. */
  sound(binding: SsfKeyBinding | undefined): { filename: string; bytes: Uint8Array } | undefined {
    const sound = (binding ? binding.sections : ["Key"]).map((section) => this.sounds.get(section, "sound")?.trim()).find(Boolean)
    if (!sound) return
    const filename = [`${sound}.wav`, `${sound}.ogg`, `${sound}.mp3`, sound].find((name) => this.pkg.file(this.theme, name))
    const bytes = filename && this.pkg.file(this.theme, filename)
    // Writers put the sound in their own res/ folder, so only the file name is kept.
    return filename && bytes ? { filename: filename.split(/[\\/]/).pop()!, bytes } : undefined
  }
}
