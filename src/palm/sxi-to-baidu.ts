// Palm `.sxi` document → Baidu `bdi`/`bds` package.
//
// `skin.json` is projected back to the INI/CSS/TIL views the editor renders, the archive's
// resources are laid out under the Baidu theme folders, and the result is repackaged exactly
// like a document that was opened as BDS/BDI. A BDA target reuses the Sogou converters that
// already paint a Baidu INI skin onto the official BDA template.

import { strToU8, zipSync } from "fflate"
import { IniDocument } from "../ini.ts"
import { SkinArchive } from "../skin.ts"
import { convertBaiduToSsf } from "../ssf/baidu-to-ssf.ts"
import { SsfPackage } from "../ssf/ssf-package.ts"
import { convertSsfToBda } from "../ssf/ssf-to-bda.ts"
import { parseSkinJson, sxiDerivedFiles } from "./sxi-projection.ts"

type Converted = { bytes: Uint8Array; warnings: string[] }

const THEMES = ["light", "dark"] as const
type Theme = typeof THEMES[number]

// `skin.json` carries the configuration itself; the other files are source metadata for the
// Palm app, not part of a Baidu package.
const PALM_ONLY = new Set(["skin.json", "info.json", "native.layout"])

function themesOf(skin: ReturnType<typeof parseSkinJson>): Theme[] {
  return THEMES.filter((theme) => theme === "light" ? skin.default !== undefined : skin.night !== undefined)
}

/** `light/skin/res/bg.png` etc. of a Palm archive, mapped to the Baidu theme layout. */
function baiduPath(canonical: string, themes: Theme[]): { directory: string; path: string } | undefined {
  for (const theme of themes) {
    const prefix = `${theme}/skin/`
    if (canonical.startsWith(prefix)) {
      const path = canonical.slice(prefix.length)
      return { directory: themes.length > 1 ? theme : "", path }
    }
  }
}

function count(document: IniDocument, pattern: RegExp): number {
  return document.sections().filter((section) => pattern.test(section)).length
}

/** The projection writes what the renderer reads; a Baidu package also needs its section counters. */
function completeLayout(text: string, fileName: string): string {
  const document = IniDocument.parse(text)
  if (!document.sections().includes("PANEL")) return text
  if (fileName === "gen.ini") {
    const more = document.sections().includes("MORE")
    if (more && document.get("MORE", "SYM_LAYOUT") === undefined) document.set("MORE", "SYM_LAYOUT", "symbol")
  }
  const keys = count(document, /^KEY\d+$/)
  const tips = count(document, /^TIP\d+$/)
  const offsets = count(document, /^OFFSET\d+$/)
  if (keys) document.set("PANEL", "KEY_NUM", String(keys))
  if (tips) document.set("PANEL", "TIP_NUM", String(tips))
  if (offsets) document.set("PANEL", "OFFSET_NUM", String(offsets))
  return document.toString()
}

/**
 * The Baidu BDS archive an `.sxi` document stands for. Layouts, styles and tile maps come from
 * the `skin.json` projection; images, sounds and fonts are the Palm archive's own resources.
 */
export function sxiToBaiduArchive(archive: SkinArchive): SkinArchive {
  if (archive.format !== "sxi") throw new Error("只有手心皮肤（.sxi）需要转换")
  const skin = parseSkinJson(archive.getText("skin.json"))
  const themes = themesOf(skin)
  if (!themes.length) throw new Error("skin.json 中没有可转换的外观")
  const derived = sxiDerivedFiles(skin)
  const files: Record<string, Uint8Array> = {}
  const add = (directory: string, path: string, bytes: Uint8Array) => {
    files[directory ? `${directory}/${path}` : path] = bytes
  }

  for (const [canonical, file] of derived) {
    if (canonical === "Info.txt") continue
    const mapped = baiduPath(canonical, themes)
    if (mapped) add(mapped.directory, mapped.path, strToU8(completeLayout(file.text, mapped.path.split("/").pop()!)))
  }
  // The archive's own resources keep their paths; a layout that the projection generates wins
  // over one that the package already stored for the same path.
  for (const canonical of archive.names()) {
    if (PALM_ONLY.has(canonical) || derived.has(canonical) || canonical.endsWith("/")) continue
    const mapped = baiduPath(canonical, themes)
    if (!mapped || /^(?:preview|demo)\.png$/i.test(mapped.path)) continue
    const bytes = archive.getBytes(canonical)
    if (bytes) add(mapped.directory, mapped.path, bytes)
  }

  const info = derived.get("Info.txt")
  if (!info) throw new Error("skin.json 中缺少皮肤信息")
  files["Info.txt"] = strToU8(info.text)
  const preview = archive.getBytes("preview.png") ?? archive.getBytes("light/skin/preview.png")
  if (preview) files["demo.png"] = preview

  return SkinArchive.open(zipSync(files, { level: 6 }))
}

/** Repackages an `.sxi` document as an Android `.bds` or iOS `.bdi` skin, key sounds included. */
export async function convertSxiToBaidu(archive: SkinArchive, format: "bdi" | "bds"): Promise<Converted> {
  const converted = sxiToBaiduArchive(archive)
  const warnings: string[] = []
  const bytes = await converted.platformBytesAsync(format, warnings)
  return { bytes, warnings }
}

/**
 * Repackages an `.sxi` document as BDA on the official BDA template. BDA's appearance configs are
 * a different format, so the skin first takes the Baidu INI shape and is then painted through the
 * Sogou converters, the same two steps a real conversion would take.
 */
export async function convertSxiToBda(archive: SkinArchive, template: SkinArchive): Promise<Converted> {
  if (template.format !== "bda") throw new Error("BDA 转换需要 BDA 模板")
  const converted = sxiToBaiduArchive(archive)
  const ssf = await convertBaiduToSsf(converted)
  const pkg = await SsfPackage.open(ssf.bytes)
  const bda = convertSsfToBda(pkg, template)
  return { bytes: bda.archive.toBytes(), warnings: [...ssf.warnings, ...bda.warnings] }
}
