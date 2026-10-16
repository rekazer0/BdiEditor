// Entry points for Sogou skin documents and conversion, kept apart from the editor so they can be tested directly.

import { zipSync } from "fflate"
import { convertBdaArchive } from "../bda-convert.ts"
import type { SkinArchive } from "../skin.ts"
import { convertBaiduToSsf } from "./baidu-to-ssf.ts"
import { isSkinContainer } from "./ssf-container.ts"
import { SsfPackage, unpackSsf } from "./ssf-package.ts"
import { convertSsfToBaidu, ssfToBaiduFiles } from "./ssf-to-baidu.ts"
import { convertSsfToBda } from "./ssf-to-bda.ts"

/** Official templates the Sogou look is painted onto: `bds` (BDS/BDI) and `bda`. */
export type SsfTemplates = { bds: SkinArchive; bda: SkinArchive }
type Converted = { bytes: Uint8Array; warnings: string[] }

/** The document's own files, not copies: derived images are cached by the arrays they come from. */
function documentPackage(archive: SkinArchive): SsfPackage {
  return SsfPackage.fromFiles(new Map(archive.names().flatMap((path) => {
    const bytes = path.endsWith("/") || archive.isOverlay(path) ? undefined : archive.getBytes(path)
    return bytes ? [[path, bytes] as const] : []
  })))
}

/**
 * Bytes the editor opens as an SSF document. A ZIP is kept as it is, so saving rewrites only edited
 * entries; an encrypted container is repacked as a ZIP, which Sogou reads too. PC skins are rejected.
 */
export async function ssfDocumentBytes(bytes: Uint8Array): Promise<Uint8Array> {
  const files = await unpackSsf(bytes)
  SsfPackage.fromFiles(files)
  return isSkinContainer(bytes) ? zipSync(Object.fromEntries(files), { level: 6 }) : bytes
}

/** The light (day) look's phoneSkin.ini, where a Sogou skin's key styles live; none in a broken package. */
export function ssfMainSkinPath(archive: SkinArchive): string | undefined {
  const complete = archive.getBytes("phoneTheme.ini") && archive.names().some((name) => /^\d+\/(?:[^/]+\/)?phoneSkin\.ini$/.test(name))
  return complete ? `${documentPackage(archive).folder("light")}phoneSkin.ini` : undefined
}

/** The Baidu tree an SSF document previews as, for `SkinArchive.setOverlay`. */
export function ssfPreviewFiles(archive: SkinArchive, template: SkinArchive): { files: Map<string, Uint8Array>; warnings: string[] } {
  return ssfToBaiduFiles(documentPackage(archive), template)
}

/** Converts an SSF document into a Baidu package of `format`. */
export async function convertSsfDocument(archive: SkinArchive, format: "bdi" | "bds" | "bda", templates: SsfTemplates): Promise<Converted> {
  const pkg = documentPackage(archive)
  if (format === "bda") {
    const { archive: converted, warnings } = convertSsfToBda(pkg, templates.bda)
    return { bytes: converted.toBytes(), warnings }
  }
  const { archive: converted, warnings } = convertSsfToBaidu(pkg, templates.bds)
  // Platform packaging also re-encodes the Sogou WAV key sounds into what the target IME plays.
  return { bytes: await converted.platformBytesAsync(format, warnings), warnings }
}

/** Converts any editable Baidu skin to `.ssf`; BDA goes through the official BDS base layout first. */
export async function exportSsf(archive: SkinArchive, bdaBase: SkinArchive | undefined): Promise<Converted> {
  if (archive.format !== "bda") return convertBaiduToSsf(archive)
  if (!bdaBase) throw new Error("无法加载 BDA 官方基础布局")
  const converted = convertBdaArchive(archive, bdaBase)
  const result = await convertBaiduToSsf(converted.archive)
  // BDA-only panels (split / one-handed landscape boards) have no Sogou counterpart either.
  const warnings = converted.warnings.filter((warning) => !warning.includes("没有 BDS/BDI 基础布局"))
  return { bytes: result.bytes, warnings: [...warnings, ...result.warnings] }
}
