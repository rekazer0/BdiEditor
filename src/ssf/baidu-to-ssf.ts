// Baidu INI skin (BDS/BDI) → Sogou phone skin.
//
// The reverse of ssf-to-baidu.ts with the same key table: every Baidu key names one Sogou key class,
// the first key reaching a class decides its look. Atlas slices are cut into standalone PNGs (Sogou
// references whole files), INNER_RECT becomes the Sogou stretch band, and a foreground's FORE_OFFSET
// becomes FG_RECT. The Sogou background spans the candidate bar and the keys, so the Baidu candidate
// bar and panel backgrounds are stacked into one image. Light/dark themes become day/night statuses.

import { strToU8, zipSync } from "fflate"
import { IniDocument } from "../ini.ts"
import type { SkinArchive } from "../skin.ts"
import { ssfBoard, ssfKeyBinding, type SsfKeyBinding } from "./ssf-keymap.ts"
import { cropImage, decodePng, encodePng, placeImage, resizeImage, type RgbaImage } from "./ssf-png.ts"

type Theme = "light" | "dark"
type SliceImage = { image: RgbaImage; stretch?: [number, number, number, number] }
type StylePair = { normal?: SliceImage; pressed?: SliceImage; color?: string; pressedColor?: string }
type KeySample = { binding: SsfKeyBinding; back: StylePair; fore?: StylePair; foreRect?: string; labelColor?: string; labelPressedColor?: string }

const SOGOU_WIDTH = 1080
const SOGOU_BAR_HEIGHT = 126
const SOGOU_KEYBOARD_HEIGHT = 720
const STATUS: Record<Theme, string> = { light: "status1", dark: "status2" }

function numbers(value: string | undefined): number[] {
  return value?.split(",").map((part) => Number(part.trim())) ?? []
}

function baiduColor(value: string | undefined): string | undefined {
  const hex = value?.trim().replace(/^(?:0x|#)/i, "")
  if (!hex || !/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(hex)) return
  return `0x${(hex.length === 6 ? `FF${hex}` : hex).toUpperCase()}`
}

function solid(color: string, size = 8): RgbaImage {
  const value = Number.parseInt(color.replace(/^0x/i, ""), 16) >>> 0
  const data = new Uint8Array(size * size * 4)
  for (let offset = 0; offset < data.length; offset += 4) {
    data[offset] = (value >>> 16) & 0xff
    data[offset + 1] = (value >>> 8) & 0xff
    data[offset + 2] = value & 0xff
    data[offset + 3] = value >>> 24
  }
  return { width: size, height: size, data }
}

/** FNV-1a over the pixels: identical slices cut for different keys share one file. */
function contentHash(data: Uint8Array): string {
  let hash = 0x811c9dc5
  for (const byte of data) hash = Math.imul(hash ^ byte, 0x01000193)
  return (hash >>> 0).toString(16)
}

/** Resolves Baidu `STYLEn` ids of one theme into cropped slice images and colours. */
class BaiduStyles {
  readonly styles: IniDocument
  private atlases = new Map<string, RgbaImage | undefined>()
  private tiles = new Map<string, IniDocument | undefined>()
  private slices = new Map<string, SliceImage | undefined>()
  private readonly archive: SkinArchive
  private readonly roots: string[]
  private readonly warnings: string[]

  /** Styles and atlases live in `<orientation>/res/` when present, otherwise in the theme's `res/`. */
  constructor(archive: SkinArchive, theme: Theme, orientation: "port" | "land", warnings: string[]) {
    this.archive = archive
    this.warnings = warnings
    this.roots = [`${theme}/skin/${orientation}/res`, `${theme}/skin/res`]
    const css = this.roots.map((root) => `${root}/default.css`).find((path) => archive.isText(path))
    this.styles = IniDocument.parse(css ? archive.getText(css) : "")
  }

  private slice(value: string | undefined): SliceImage | undefined {
    const [name, tileValue] = value?.split(",").map((part) => part.trim()) ?? []
    if (!name) return
    const key = `${name},${tileValue}`
    if (!this.slices.has(key)) this.slices.set(key, this.cut(name, tileValue))
    return this.slices.get(key)
  }

  private cut(name: string, tileValue: string | undefined): SliceImage | undefined {
    const base = this.roots.map((root) => `${root}/${name}`).find((path) => this.archive.getBytes(`${path}.png`)) ?? `${this.roots[1]}/${name}`
    if (!this.atlases.has(name)) {
      let atlas: RgbaImage | undefined
      const bytes = this.archive.getBytes(`${base}.png`)
      try {
        atlas = bytes ? decodePng(bytes) : undefined
      } catch (error) {
        this.warnings.push(`${name}.png 无法解码（${error instanceof Error ? error.message : error}），已跳过`)
      }
      this.atlases.set(name, atlas)
      this.tiles.set(name, this.archive.isText(`${base}.til`) ? IniDocument.parse(this.archive.getText(`${base}.til`)) : undefined)
    }
    const atlas = this.atlases.get(name)
    if (!atlas) return
    const tiles = this.tiles.get(name)
    const source = numbers(tiles?.get(`IMG${tileValue || 1}`, "SOURCE_RECT"))
    const [x, y, width, height] = source.length === 4 && source.every(Number.isFinite) ? source : [0, 0, atlas.width, atlas.height]
    if (width <= 0 || height <= 0) return
    const inner = numbers(tiles?.get(`IMG${tileValue || 1}`, "INNER_RECT"))
    const stretch = inner.length === 4 && inner[2] > 0 && inner[3] > 0
      ? [inner[0] - x, inner[0] - x + inner[2], inner[1] - y, inner[1] - y + inner[3]] as [number, number, number, number]
      : undefined
    return { image: cropImage(atlas, x, y, width, height), stretch }
  }

  resolve(styleID: string | undefined): StylePair | undefined {
    const section = `STYLE${styleID?.split(",")[0].trim()}`
    if (!styleID || !this.styles.sections().includes(section)) return
    const normalImage = this.styles.get(section, "NM_IMG")
    const normal = this.slice(normalImage)
    const pressed = this.slice(this.styles.get(section, "HL_IMG") ?? normalImage) ?? normal
    const color = baiduColor(this.styles.get(section, "NM_COLOR"))
    const pressedColor = baiduColor(this.styles.get(section, "HL_COLOR")) ?? color
    if (!normal && !color) return
    return { normal, pressed, color, pressedColor }
  }
}

/** Writes one Sogou status folder: phoneSkin.ini, keys.ini and the images they name. */
class StatusWriter {
  readonly skin = IniDocument.parse("")
  readonly keys = IniDocument.parse("")
  private images = new Map<string, Array<{ data: Uint8Array; filename: string }>>()
  private nextImage = 1
  private readonly folder: string
  private readonly output: Map<string, Uint8Array>

  constructor(folder: string, output: Map<string, Uint8Array>) {
    this.folder = folder
    this.output = output
    this.skin.appendSection("General", [
      { key: "SMA_Key9AZUserDefine", value: "1" },
      { key: "SMA_Key9FunUserDefine", value: "1" },
      { key: "SMA_Key26AZUserDefine", value: "1" },
      { key: "SMA_Key26FunUserDefine", value: "1" },
    ])
  }

  file(image: RgbaImage, name?: string): string {
    const key = `${image.width}x${image.height}:${contentHash(image.data)}`
    const candidates = this.images.get(key) ?? []
    const same = name ? undefined : candidates.find((entry) => entry.data.length === image.data.length && entry.data.every((byte, index) => byte === image.data[index]))
    if (same) return same.filename
    const filename = name ?? `bd${this.nextImage++}.png`
    this.output.set(`${this.folder}${filename}`, encodePng(image))
    this.images.set(key, [...candidates, { data: image.data, filename }])
    return filename
  }

  imageValue(slice: SliceImage, name?: string): string {
    const filename = this.file(slice.image, name)
    return slice.stretch ? `${filename},${slice.stretch.join(",")}` : filename
  }

  /** NORMAL/PRESSED plus the toggled (`_ON`) and disabled states Sogou also reads. */
  stateSection(section: string, pair: StylePair): boolean {
    const normal = pair.normal ?? (pair.color ? { image: solid(pair.color), stretch: [1, 7, 1, 7] as [number, number, number, number] } : undefined)
    if (!normal) return false
    const pressed = pair.pressed ?? (pair.pressedColor ? { image: solid(pair.pressedColor), stretch: [1, 7, 1, 7] as [number, number, number, number] } : normal)
    const normalValue = this.imageValue(normal)
    const pressedValue = this.imageValue(pressed)
    this.skin.appendSection(section, [
      { key: "NORMAL", value: normalValue },
      { key: "PRESSED", value: pressedValue },
      { key: "DISABLED", value: normalValue },
      { key: "NORMAL_ON", value: normalValue },
      { key: "PRESSED_ON", value: pressedValue },
    ])
    return true
  }

  write(): void {
    this.output.set(`${this.folder}phoneSkin.ini`, strToU8(this.skin.toString()))
    this.output.set(`${this.folder}keys.ini`, strToU8(this.keys.toString()))
  }
}

function bgSectionName(section: string, layout: string): string {
  const prefix = /^(py26|en26|num26)$/.test(ssfBoard(layout)) ? "SMA_Key26Bg_" : "SMA_Key9Bg_"
  return `${prefix}${section.replace(/^Key_/, "")}`
}

const MAIN_LAYOUTS = ["py_26", "py_9", "en_26", "en_9", "num_26", "num_9", "bh"]

function layoutRank(path: string): number {
  const main = MAIN_LAYOUTS.indexOf(path.split("/").pop()!.replace(/\.ini$/i, ""))
  if (main >= 0) return main
  return ssfBoard(path) === "other" ? MAIN_LAYOUTS.length + 1 : MAIN_LAYOUTS.length
}

/** Collects, per Sogou key class, the first Baidu key that reaches it. */
function sampleKeys(archive: SkinArchive, theme: Theme, warnings: string[]): Map<string, KeySample & { layout: string }> {
  const samples = new Map<string, KeySample & { layout: string }>()
  for (const orientation of ["port", "land"] as const) {
    const styles = new BaiduStyles(archive, theme, orientation, warnings)
    const prefix = `${theme}/skin/${orientation}/`
    const layouts = archive.names().filter((path) => path.startsWith(prefix) && /^[^/]+\.ini$/.test(path.slice(prefix.length)) && !path.endsWith("/gen.ini"))
    // Several boards share a Sogou class (`Key_Q`, `Key_Space`): the main pinyin boards decide it,
    // then the other boards Sogou styles per class, and symbol pages last.
    layouts.sort((a, b) => layoutRank(a) - layoutRank(b) || a.localeCompare(b))
    for (const path of layouts) {
      const layout = path.slice(prefix.length, -4)
      const document = IniDocument.parse(archive.getText(path))
      for (const section of document.sections().filter((name) => /^KEY\d+$/.test(name))) {
        const action = document.get(section, "CENTER")?.trim()
        if (!action) continue
        const binding = ssfKeyBinding(layout, action, orientation === "land")
        const name = binding.sections[0] ?? `${binding.defaults[0]}`
        if (samples.has(name)) continue
        const back = styles.resolve(document.get(section, "BACK_STYLE"))
        if (!back) continue
        const foreIDs = document.get(section, "FORE_STYLE")?.split(",").map((value) => value.trim()).filter(Boolean) ?? []
        const fore = foreIDs.map((id) => styles.resolve(id)).find((pair) => pair?.normal)
        const text = foreIDs.map((id) => styles.resolve(id)).find((pair) => pair?.color && !pair.normal)
        const rect = numbers(document.get(section, "VIEW_RECT"))
        const offset = numbers(document.get(section, "FORE_OFFSET")?.split(";")[0])
        let foreRect: string | undefined
        if (fore?.normal && offset.length === 2 && rect.length === 4 && rect[2] > 0 && rect[3] > 0) {
          const { width, height } = fore.normal.image
          const fraction = (value: number) => Number(Math.max(0, value).toFixed(3))
          foreRect = [
            fraction(((rect[2] - width) / 2 + offset[0]) / rect[2]),
            fraction(((rect[3] - height) / 2 + offset[1]) / rect[3]),
            fraction(width / rect[2]),
            fraction(height / rect[3]),
          ].join(",")
        }
        samples.set(name, { layout, binding, back, fore, foreRect, labelColor: text?.color, labelPressedColor: text?.pressedColor })
      }
    }
  }
  return samples
}

/**
 * Where a theme keeps its keyboard and candidate bar styles: INI skins in gen.ini and its `.cnd`,
 * skins converted from BDA in each layout's own [PANEL] / [CAND].
 */
function styleSources(archive: SkinArchive, theme: Theme): { panel: IniDocument[]; cand: IniDocument[] } {
  const parse = (path: string) => archive.isText(path) ? [IniDocument.parse(archive.getText(path))] : []
  const root = `${theme}/skin/port/`
  const gen = parse(`${root}gen.ini`)
  const candName = gen[0]?.get("CAND", "LAYOUT_NAME")?.trim()
  const layouts = [...parse(`${root}py_26.ini`), ...parse(`${root}py_9.ini`)]
  return { panel: [...gen, ...layouts], cand: [...(candName ? parse(`${root}${candName}.cnd`) : []), ...layouts] }
}

/** The first style among `documents` that actually resolves (a copied base gen.ini may name a missing one). */
function firstStyle(styles: BaiduStyles, documents: IniDocument[], section: string, key: string): StylePair | undefined {
  for (const document of documents) {
    const style = styles.resolve(document.get(section, key)?.trim())
    if (style) return style
  }
}

/** Stacks the candidate bar strip above the keyboard panel the way Sogou's single background does. */
function keyboardBackground(styles: BaiduStyles, archive: SkinArchive, theme: Theme): { background?: RgbaImage; bar?: RgbaImage } {
  const sources = styleSources(archive, theme)
  const fill = (pair: StylePair | undefined, height: number) => {
    if (pair?.normal) return resizeImage(pair.normal.image, SOGOU_WIDTH, height)
    return pair?.color ? resizeImage(solid(pair.color), SOGOU_WIDTH, height) : undefined
  }
  const panel = fill(firstStyle(styles, sources.panel, "PANEL", "BACK_STYLE"), SOGOU_KEYBOARD_HEIGHT)
  const bar = fill(firstStyle(styles, sources.cand, "CAND", "BACK_STYLE"), SOGOU_BAR_HEIGHT)
  if (!panel) return { bar }
  const background = placeImage(panel, SOGOU_WIDTH, SOGOU_BAR_HEIGHT + SOGOU_KEYBOARD_HEIGHT, 0, SOGOU_BAR_HEIGHT)
  if (bar) background.data.set(bar.data, 0)
  return { background, bar }
}

function candidateColors(archive: SkinArchive, theme: Theme, styles: BaiduStyles): StylePair | undefined {
  return firstStyle(styles, styleSources(archive, theme).cand, "CAND", "FORE_STYLE")
}

function convertTheme(archive: SkinArchive, theme: Theme, folder: string, output: Map<string, Uint8Array>, warnings: string[]): void {
  const styles = new BaiduStyles(archive, theme, "port", warnings)
  const writer = new StatusWriter(folder, output)
  const samples = sampleKeys(archive, theme, warnings)
  const defaults = new Set<string>()
  for (const [section, sample] of samples) {
    const isDefault = !sample.binding.sections.length
    const bgName = isDefault ? section : bgSectionName(section, sample.layout)
    if (!writer.stateSection(bgName, sample.back)) continue
    for (const fallback of sample.binding.defaults) {
      if (defaults.has(fallback) || samples.has(fallback)) continue
      defaults.add(fallback)
      writer.stateSection(fallback, sample.back)
    }
    if (isDefault) continue
    const entries = [{ key: "BG_IMAGES", value: bgName }]
    if (sample.labelColor) entries.push({ key: "TEXT_COLOR", value: sample.labelColor }, { key: "TEXT_COLOR_PRESSED", value: sample.labelPressedColor ?? sample.labelColor })
    writer.skin.appendSection(section, entries)
    if (sample.fore?.normal) {
      const foreName = `Foground_${section}`
      writer.keys.appendSection(section, [
        { key: "FG_IMAGES", value: foreName },
        { key: "FG_RECT", value: sample.foreRect ?? "0,0,1,1" },
      ])
      const normal = writer.file(sample.fore.normal.image)
      const pressed = writer.file((sample.fore.pressed ?? sample.fore.normal).image)
      writer.keys.appendSection(foreName, [
        { key: "NORMAL", value: normal },
        { key: "PRESSED", value: pressed },
        { key: "DISABLED", value: normal },
        { key: "NORMAL_ON", value: normal },
        { key: "PRESSED_ON", value: pressed },
      ])
    }
  }

  const { background, bar } = keyboardBackground(styles, archive, theme)
  if (background) writer.skin.appendSection("RootView", [{ key: "BG_STYLE", value: "1" }, { key: "BG_IMAGE", value: writer.file(background, "bg.png") }])
  else warnings.push(`${theme === "dark" ? "深色" : "浅色"}外观没有可转换的键盘背景`)
  if (bar) {
    writer.skin.appendSection("BgCandidate1", [{ key: "NORMAL", value: writer.file(bar, "bar.png") }])
    for (const view of ["CandidateView", "CandidateViewLand"]) {
      writer.skin.appendSection(view, [{ key: "BG_STYLE", value: "1" }, { key: "BG_IMAGE", value: "BgCandidate1" }])
    }
  }
  const candidate = candidateColors(archive, theme, styles)
  if (candidate?.color) {
    writer.skin.appendSection("TextStyle_Candidate", [{ key: "TEXT_COLOR", value: candidate.color }])
    writer.skin.appendSection("TextStyle_Candidate_Highlight", [{ key: "TEXT_COLOR", value: candidate.pressedColor ?? candidate.color }])
  }
  writer.write()
}

function infoValue(archive: SkinArchive, key: string): string | undefined {
  const bytes = archive.getBytes("Info.txt")
  return bytes ? new TextDecoder().decode(bytes).match(new RegExp(`^\\uFEFF?${key}=(.*)$`, "mi"))?.[1].trim() : undefined
}

function soundFiles(archive: SkinArchive, theme: Theme, output: Map<string, Uint8Array>, warnings: string[]): void {
  const gen = `${theme}/skin/port/gen.ini`
  if (!archive.isText(gen)) return
  const styleID = IniDocument.parse(archive.getText(gen)).get("PANEL", "SOUND_STYLE")?.trim()
  const filename = styleID && new BaiduStyles(archive, theme, "port", warnings).styles.get(`STYLE${styleID}`, "PRESS_SOUND_PATH")?.trim()
  const bytes = filename && [`${theme}/skin/port/res/${filename}`, `${theme}/skin/res/${filename}`].map((path) => archive.getBytes(path)).find(Boolean)
  if (!filename || !bytes) return
  if (!/\.wav$/i.test(filename)) warnings.push(`按键音 ${filename} 不是 WAV，搜狗输入法可能无法播放`)
  output.set(`default/${filename}`, bytes)
  const sound = filename.replace(/\.[^.]+$/, "")
  output.set("default/sound_android.ini", strToU8(`[General]\nSUPPORT_SCREEN=${SOGOU_WIDTH}\nVERSION=1\n\n[Key]\nsound=${sound}\n`))
}

/** Converts a Baidu BDS/BDI skin to Sogou `.ssf` bytes. */
export function convertBaiduToSsf(archive: SkinArchive): { bytes: Uint8Array; warnings: string[] } {
  if (archive.format === "bda") throw new Error("BDA 需要先转换为 BDS 再导出搜狗皮肤")
  const warnings: string[] = []
  const output = new Map<string, Uint8Array>()
  const themes = (["light", "dark"] as const).filter((theme) =>
    ["res", "port/res", "land/res"].some((root) => archive.isText(`${theme}/skin/${root}/default.css`)))
  if (!themes.length) throw new Error("皮肤缺少 res/default.css，无法转换")
  const dual = themes.length > 1
  for (const theme of themes) convertTheme(archive, theme, dual ? `${SOGOU_WIDTH}/${STATUS[theme]}/` : `${SOGOU_WIDTH}/`, output, warnings)

  const name = infoValue(archive, "Name") || "百度皮肤"
  const author = infoValue(archive, "Author") ?? ""
  const preview = archive.getBytes("demo.png")
  if (preview) output.set("square_preview.png", preview)
  output.set("phoneTheme.ini", strToU8([
    "[General]",
    "skin_type=1",
    `skin_name=${name}`,
    `skin_author=${author}`,
    "skin_version=10000",
    `supports-screens=${SOGOU_WIDTH}`,
    ...(preview ? ["preview_square=square_preview.png"] : []),
    "",
  ].join("\n")))
  if (dual) {
    output.set("time.ini", strToU8([
      "[General]", `SUPPORT_SCREEN=${SOGOU_WIDTH}`, "VERSION=1",
      `[${SOGOU_WIDTH}]`, "LOOP_TYPE=1", "STATUS_LIST=status1,status2",
      "[status1]", "START=7", "END=18",
      "[status2]", "START=0,19", "END=6,23", "",
    ].join("\n")))
  }
  soundFiles(archive, themes[0], output, warnings)
  if (archive.names().some((path) => /\/anim\.ini$/i.test(path))) warnings.push("百度按键动画在搜狗皮肤中没有对应，已忽略")
  return { bytes: zipSync(Object.fromEntries(output), { level: 6 }), warnings }
}
