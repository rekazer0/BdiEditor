// Sogou phone skin → Baidu INI skin (BDS; BDI is the same tree packaged differently).
//
// Sogou skins carry no key geometry, so the official Baidu template provides every layout and the
// Sogou look (ssf-look.ts) is painted onto it as new single-image styles. Keys Sogou draws as text keep
// the template glyph, recoloured to the Sogou label colour. Day/night statuses become light/dark themes.

import { strToU8, zipSync } from "fflate"
import { IniDocument } from "../ini.ts"
import { SkinArchive } from "../skin.ts"
import { SsfLook, type LookColors, type LookImage, type LookPair } from "./ssf-look.ts"
import type { SsfPackage, SsfTheme } from "./ssf-package.ts"
import { cropImage, decodePng, encodePng, isPng, pngSize, tintImage, type RgbaImage } from "./ssf-png.ts"

export type SsfConversion = { archive: SkinArchive; warnings: string[] }

function tile(width: number, height: number, stretch?: LookImage["stretch"]): Uint8Array {
  const inner = stretch && stretch[1] <= width && stretch[3] <= height
    ? [`INNER_RECT=${stretch[0]},${stretch[2]},${stretch[1] - stretch[0]},${stretch[3] - stretch[2]}`]
    : []
  return strToU8(["[GLOBAL]", "IMG_NUM=1", "", "[IMG1]", `SOURCE_RECT=0,0,${width},${height}`, ...inner, ""].join("\n"))
}

function numbers(value: string | undefined): number[] {
  return value?.split(",").map((part) => Number(part.trim())) ?? []
}

/** One theme's `res/` folder and `default.css` being written. */
class ThemeResources {
  readonly styles: IniDocument
  private readonly theme: SsfTheme
  private readonly output: Map<string, Uint8Array>
  private nextStyle: number
  private nextImage = 1
  private readonly images = new Map<string, string>()

  constructor(theme: SsfTheme, output: Map<string, Uint8Array>, css: string) {
    this.theme = theme
    this.output = output
    this.styles = IniDocument.parse(css)
    const used = this.styles.sections().flatMap((section) => {
      const id = section.match(/^STYLE(\d+)$/)?.[1]
      return id ? [Number(id)] : []
    })
    this.nextStyle = Math.max(1000, ...used) + 1
  }

  private addStyle(entries: Array<{ key: string; value: string }>): string {
    const id = String(this.nextStyle++)
    this.styles.appendSection(`STYLE${id}`, entries)
    return id
  }

  /** Writes a standalone png + til pair once per distinct image and returns its resource name. */
  resource(image: LookImage): string {
    let name = this.images.get(image.id)
    if (!name) {
      const size = pngSize(image.bytes)
      if (!size) throw new Error(`${image.id} 不是有效的 PNG`)
      name = `ssf${this.nextImage++}`
      this.output.set(`${this.theme}/skin/res/${name}.png`, image.bytes)
      this.output.set(`${this.theme}/skin/res/${name}.til`, tile(size[0], size[1], image.stretch))
      this.images.set(image.id, name)
    }
    return name
  }

  imageStyle(pair: LookPair): string {
    return this.addStyle([
      { key: "NM_IMG", value: `${this.resource(pair.normal)},1` },
      { key: "HL_IMG", value: `${this.resource(pair.pressed)},1` },
    ])
  }

  colorStyle(normal: string, pressed = normal): string {
    return this.addStyle([{ key: "NM_COLOR", value: normal }, { key: "HL_COLOR", value: pressed }])
  }

  soundStyle(filename: string): string {
    return this.addStyle([{ key: "PRESS_SOUND_PATH", value: filename }])
  }

  /** Copies a template style with some fields replaced, so fonts and sizes survive recolouring. */
  derivedStyle(templateID: string, overrides: Record<string, string>): string {
    const entries = this.styles.entries(`STYLE${templateID}`)
      .filter((entry) => !(entry.key in overrides))
      .map(({ key, value }) => ({ key, value }))
    return this.addStyle([...entries, ...Object.entries(overrides).map(([key, value]) => ({ key, value }))])
  }

  css(): Uint8Array {
    const count = String(this.styles.sections().filter((section) => /^STYLE\d+$/.test(section)).length)
    if (this.styles.sections().includes("GLOBAL")) this.styles.set("GLOBAL", "STYLE_NUM", count)
    else this.styles.appendSection("GLOBAL", [{ key: "STYLE_NUM", value: count }])
    return strToU8(this.styles.toString())
  }
}

/** Converts one Sogou theme onto copies of the template's `light/skin` tree. */
class ThemeConverter {
  private readonly look: SsfLook
  private readonly base: SkinArchive
  private readonly theme: SsfTheme
  private readonly output: Map<string, Uint8Array>
  private readonly resources: ThemeResources
  private readonly soundStyles = new Map<string, string>()
  private readonly glyphs = new Map<string, RgbaImage | undefined>()
  private keyboardStyles?: { panel?: string; cand?: string }

  constructor(pkg: SsfPackage, base: SkinArchive, theme: SsfTheme, output: Map<string, Uint8Array>, warnings: string[]) {
    this.look = new SsfLook(pkg, theme, warnings)
    this.base = base
    this.theme = theme
    this.output = output
    this.resources = new ThemeResources(theme, output, base.getText("light/skin/res/default.css"))
  }

  /** Template glyph slices recoloured to the Sogou label colour, for keys Sogou draws as text. */
  private tintedTemplateStyle(styleID: string, colors: LookColors): string | undefined {
    const value = this.resources.styles.get(`STYLE${styleID}`, "NM_IMG")
    const [imageName, tileValue] = value?.split(",").map((part) => part.trim()) ?? []
    if (!imageName || !tileValue) {
      return this.resources.styles.sections().includes(`STYLE${styleID}`)
        ? this.resources.derivedStyle(styleID, { NM_COLOR: colors.normal, HL_COLOR: colors.pressed })
        : undefined
    }
    if (!this.glyphs.has(imageName)) {
      const bytes = this.base.getBytes(`light/skin/res/${imageName}.png`)
      this.glyphs.set(imageName, bytes && isPng(bytes) ? decodePng(bytes) : undefined)
    }
    const atlas = this.glyphs.get(imageName)
    const tilePath = `light/skin/res/${imageName}.til`
    const source = numbers(this.base.isText(tilePath) ? IniDocument.parse(this.base.getText(tilePath)).get(`IMG${tileValue}`, "SOURCE_RECT") : undefined)
    if (!atlas || source.length !== 4) return
    const glyph = cropImage(atlas, source[0], source[1], source[2], source[3])
    const tinted = (color: string): LookImage => ({ id: `template:${imageName}:${tileValue}:${color}`, bytes: encodePng(tintImage(glyph, color)) })
    return this.resources.imageStyle({ normal: tinted(colors.normal), pressed: tinted(colors.pressed) })
  }

  private soundStyle(sound: { filename: string; bytes: Uint8Array } | undefined): string | undefined {
    if (!sound) return
    let style = this.soundStyles.get(sound.filename)
    if (!style) {
      this.output.set(`${this.theme}/skin/res/${sound.filename}`, sound.bytes)
      style = this.resources.soundStyle(sound.filename)
      this.soundStyles.set(sound.filename, style)
    }
    return style
  }

  private convertKeys(layout: IniDocument, layoutName: string, landscape: boolean): void {
    for (const section of layout.sections().filter((name) => /^KEY\d+$/.test(name))) {
      const action = layout.get(section, "CENTER")?.trim()
      if (!action) continue
      const look = this.look.key(layoutName, action, landscape)
      if (look.back) layout.set(section, "BACK_STYLE", this.resources.imageStyle(look.back))
      if (look.fore) {
        layout.set(section, "FORE_STYLE", this.resources.imageStyle(look.fore))
        layout.remove(section, "FORE_OFFSET")
      } else if (look.label) {
        const templateFore = layout.get(section, "FORE_STYLE")?.split(",").map((value) => value.trim()).filter(Boolean)
        if (templateFore?.length) layout.set(section, "FORE_STYLE", templateFore.map((id) => this.tintedTemplateStyle(id, look.label!) ?? id).join(","))
      }
      const sound = this.soundStyle(this.look.sound(look.binding))
      if (sound) layout.set(section, "SOUND_STYLE", sound)
    }
  }

  private convertLists(layout: IniDocument): void {
    const list = this.look.list()
    const back = list.back && this.resources.imageStyle(list.back)
    const cell = list.cell && this.resources.imageStyle(list.cell)
    for (const section of layout.sections().filter((name) => /^LIST\d*$/.test(name))) {
      if (back && layout.get(section, "BACK_STYLE")) layout.set(section, "BACK_STYLE", back)
      if (cell && layout.get(section, "CELL_STYLE")) layout.set(section, "CELL_STYLE", cell)
      const fore = layout.get(section, "FORE_STYLE")?.trim()
      if (list.text && fore) layout.set(section, "FORE_STYLE", this.resources.derivedStyle(fore, { NM_COLOR: list.text, HL_COLOR: list.text }))
    }
  }

  private keyboard(): { panel?: string; cand?: string } {
    if (!this.keyboardStyles) {
      const { panel, cand, panelColor } = this.look.keyboard()
      this.keyboardStyles = {
        panel: panel ? this.resources.imageStyle({ normal: panel, pressed: panel }) : panelColor ? this.resources.colorStyle(panelColor) : undefined,
        cand: cand ? this.resources.imageStyle({ normal: cand, pressed: cand }) : undefined,
      }
    }
    return this.keyboardStyles
  }

  private convertGeneral(gen: IniDocument, orientation: string): void {
    const { panel, cand } = this.keyboard()
    if (panel) gen.set("PANEL", "BACK_STYLE", panel)
    const defaultSound = this.soundStyle(this.look.sound(undefined))
    if (defaultSound) gen.set("PANEL", "SOUND_STYLE", defaultSound)

    const composing = this.look.color("ComposingView", "BG_COLOR")
    if (composing && gen.get("INPUT", "BACK_STYLE")) gen.set("INPUT", "BACK_STYLE", this.resources.colorStyle(composing))
    const composingText = this.look.color("TextStyle_Composing")
    const inputFore = gen.get("INPUT", "FORE_STYLE")?.trim()
    if (composingText && inputFore) gen.set("INPUT", "FORE_STYLE", this.resources.derivedStyle(inputFore, { NM_COLOR: composingText, HL_COLOR: composingText }))

    const candName = gen.get("CAND", "LAYOUT_NAME")?.trim()
    const candPath = candName && `${this.theme}/skin/${orientation}/${candName}.cnd`
    const candBytes = candPath && this.output.get(candPath)
    if (!candPath || !candBytes) return
    const candidates = IniDocument.parse(new TextDecoder().decode(candBytes))
    const text = this.look.color("TextStyle_Candidate")
    const highlight = this.look.color("TextStyle_Candidate_Highlight") ?? text
    for (const section of ["CAND", "TAB"]) {
      if (cand && candidates.get(section, "BACK_STYLE")) candidates.set(section, "BACK_STYLE", cand)
      const fore = candidates.get(section, "FORE_STYLE")?.trim()
      if (text && highlight && fore) candidates.set(section, "FORE_STYLE", this.resources.derivedStyle(fore, { NM_COLOR: text, HL_COLOR: highlight }))
    }
    this.output.set(candPath, strToU8(candidates.toString()))
  }

  convert(): void {
    const prefix = "light/skin/"
    for (const path of this.base.names()) {
      if (!path.startsWith(prefix) || path.endsWith("/")) continue
      const name = path.slice(prefix.length)
      if (name === "res/default.css" || name === "Info.txt" || name === "demo.png") continue
      this.output.set(`${this.theme}/skin/${name}`, this.base.getBytes(path)!)
    }
    for (const orientation of ["port", "land"] as const) {
      const genPath = `${this.theme}/skin/${orientation}/gen.ini`
      const genBytes = this.output.get(genPath)
      if (!genBytes) continue
      const gen = IniDocument.parse(new TextDecoder().decode(genBytes))
      const templatePanel = gen.get("PANEL", "BACK_STYLE")?.trim()
      this.convertGeneral(gen, orientation)
      this.output.set(genPath, strToU8(gen.toString()))
      const { panel } = this.keyboard()
      for (const path of [...this.output.keys()]) {
        const match = path.match(new RegExp(`^${this.theme}/skin/${orientation}/([^/]+)\\.ini$`))
        if (!match || match[1] === "gen") continue
        const layout = IniDocument.parse(new TextDecoder().decode(this.output.get(path)!))
        this.convertKeys(layout, match[1], orientation === "land")
        this.convertLists(layout)
        // Pages that repeat the general panel background (symbol, handwriting) follow it.
        if (panel && templatePanel && layout.get("PANEL", "BACK_STYLE")?.trim() === templatePanel) layout.set("PANEL", "BACK_STYLE", panel)
        this.output.set(path, strToU8(layout.toString()))
      }
    }
    this.output.set(`${this.theme}/skin/res/default.css`, this.resources.css())
  }
}

function infoText(base: SkinArchive, pkg: SsfPackage): Uint8Array {
  const template = base.isText("Info.txt") ? base.getText("Info.txt") : ""
  const lines = template.split(/\r?\n/)
    .map((line) => line.replace(/^﻿/, ""))
    .filter((line) => line && !/^(Name|Author|SupportDarkMode|VersionCode)=/i.test(line))
  lines.unshift(`Name=${pkg.info.name}`)
  if (pkg.info.author) lines.push(`Author=${pkg.info.author}`)
  if (pkg.themes.has("dark")) lines.push("SupportDarkMode=1")
  return strToU8(`${lines.join("\n")}\n`)
}

/** Warnings for Sogou features no Baidu format has; shared with the BDA writer. */
export function ssfUnsupportedWarnings(pkg: SsfPackage): string[] {
  const names = [...pkg.files.keys()]
  return [
    ...(names.some((name) => /(^|\/)anim\.ini$/i.test(name)) ? ["按键动画（anim.ini）在百度皮肤中没有对应，已忽略"] : []),
    ...(names.some((name) => /\.webp$/i.test(name)) ? ["开屏动画和动态背景（webp）在百度皮肤中没有对应，已忽略"] : []),
  ]
}

export function ssfPreview(pkg: SsfPackage): Uint8Array | undefined {
  const preview = pkg.files.get("square_preview.png") ?? pkg.files.get("candidate_preview.png")
  return preview && isPng(preview) ? preview : undefined
}

/** Converts a Sogou skin to a Baidu BDS archive laid out on `base` (the official BDS template). */
export function convertSsfToBaidu(pkg: SsfPackage, base: SkinArchive): SsfConversion {
  if (base.format === "bda") throw new Error("搜狗皮肤只能套用 BDS/BDI 模板")
  if (!base.isText("light/skin/res/default.css")) throw new Error("模板缺少 res/default.css")
  const warnings = [...pkg.warnings]
  const canonical = new Map<string, Uint8Array>()
  for (const theme of pkg.themes.keys()) new ThemeConverter(pkg, base, theme, canonical, warnings).convert()
  canonical.set("Info.txt", infoText(base, pkg))
  const preview = ssfPreview(pkg)
  if (preview) canonical.set("demo.png", preview)
  warnings.push(...ssfUnsupportedWarnings(pkg))

  const dual = pkg.themes.size > 1
  const raw = Object.fromEntries([...canonical].map(([path, bytes]) => {
    if (path === "Info.txt" || path === "demo.png") return [path, bytes]
    const themed = path.match(/^(light|dark)\/skin\/(.*)$/)!
    return [dual ? `${themed[1]}/${themed[2]}` : themed[2], bytes]
  }))
  return { archive: SkinArchive.open(zipSync(raw, { level: 6 }), "bds"), warnings }
}
