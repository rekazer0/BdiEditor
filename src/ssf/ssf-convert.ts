// Entry points for Sogou skin conversion, kept apart from the editor so they can be tested directly.

import { convertBdaArchive } from "../bda-convert.ts"
import type { SkinArchive } from "../skin.ts"
import { convertBaiduToSsf } from "./baidu-to-ssf.ts"
import { SsfPackage } from "./ssf-package.ts"
import { convertSsfToBaidu } from "./ssf-to-baidu.ts"
import { convertSsfToBda } from "./ssf-to-bda.ts"

export type SsfImportFormat = "bds" | "bdi" | "bda"
/** Official templates the Sogou look is painted onto: `bds` (BDS/BDI) and `bda`. */
export type SsfTemplates = { bds: SkinArchive; bda: SkinArchive }
type Converted = { bytes: Uint8Array; warnings: string[] }

/** Converts `.ssf` bytes into a package of `format`, ready to open in the editor. */
export async function importSsf(bytes: Uint8Array, format: SsfImportFormat, templates: SsfTemplates): Promise<Converted> {
  const pkg = await SsfPackage.open(bytes)
  if (format === "bda") {
    const { archive, warnings } = convertSsfToBda(pkg, templates.bda)
    return { bytes: archive.toBytes(), warnings }
  }
  const { archive, warnings } = convertSsfToBaidu(pkg, templates.bds)
  // Platform packaging also re-encodes the Sogou WAV key sounds into what the target IME plays.
  return { bytes: await archive.platformBytesAsync(format, warnings), warnings }
}

/** Converts any editable Baidu skin to `.ssf`; BDA goes through the official BDS base layout first. */
export function exportSsf(archive: SkinArchive, bdaBase: SkinArchive | undefined): Converted {
  if (archive.format !== "bda") return convertBaiduToSsf(archive)
  if (!bdaBase) throw new Error("无法加载 BDA 官方基础布局")
  const converted = convertBdaArchive(archive, bdaBase)
  const result = convertBaiduToSsf(converted.archive)
  // BDA-only panels (split / one-handed landscape boards) have no Sogou counterpart either.
  const warnings = converted.warnings.filter((warning) => !warning.includes("没有 BDS/BDI 基础布局"))
  return { bytes: result.bytes, warnings: [...warnings, ...result.warnings] }
}
