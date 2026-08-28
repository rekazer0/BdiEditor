import { strFromU8, strToU8, unzipSync, zipSync } from "fflate"
import {
  convertBdaAppearancePlatform,
  convertBdaSoundPlatform,
  decodeBdaAppearance,
  decodeBdaSoundConfig,
  IOS_BDA_PANELS,
} from "./bda.ts"
import { SkinArchive } from "./skin.ts"

export type BdaPlatform = "ios" | "android" | "unknown"

const infoValue = (archive: SkinArchive, key: string) => {
  const bytes = archive.getBytes("Info.txt")
  return bytes ? strFromU8(bytes).match(new RegExp(`^${key}=(.*)$`, "mi"))?.[1].trim() : undefined
}

export function bdaPlatform(archive: SkinArchive): BdaPlatform {
  if (archive.format !== "bda") return "unknown"
  let ios = 0
  let android = 0
  for (const path of archive.names()) {
    const bytes = archive.getBytes(path)
    if (!bytes) continue
    if (/\/appearanceConfig$/i.test(path)) {
      const appearance = decodeBdaAppearance(bytes)
      if (appearance.designWidth === 1242 && [...appearance.panels.keys()].every((name) => IOS_BDA_PANELS.has(name))) ios += 3
      if (appearance.designWidth === 1080 || appearance.designWidth === 1920) android += 2
      if ([...appearance.panels.keys()].some((name) => !IOS_BDA_PANELS.has(name))) android += 2
    } else if (/\/soundConfig$/i.test(path)) {
      const sound = decodeBdaSoundConfig(bytes)
      if (sound.iosKeySounds.size) ios++
      if (sound.keySounds.size) android++
    } else if (/\/switchConfig$/i.test(path)) android++
  }
  if (ios > android) return "ios"
  if (android > ios) return "android"
  return infoValue(archive, "SupportPlatform") === "I" ? "ios"
    : infoValue(archive, "SupportPlatform") === "A" ? "android" : "unknown"
}

function setInfoPlatform(text: string, platform: BdaPlatform): string {
  const eol = text.includes("\r\n") ? "\r\n" : "\n"
  const value = platform === "ios" ? "I" : "A"
  return /^SupportPlatform=.*$/mi.test(text)
    ? text.replace(/^SupportPlatform=.*$/mi, `SupportPlatform=${value}`)
    : `${text}${text && !text.endsWith("\n") && !text.endsWith("\r") ? eol : ""}SupportPlatform=${value}${eol}`
}

function setInfoAtomSkinNames(text: string, names: [string, string]): string {
  const value = names.join(",")
  return /^AtomSkinName=.*$/mi.test(text)
    ? text.replace(/^AtomSkinName=.*$/mi, `AtomSkinName=${value}`)
    : `${text}${text && !text.endsWith("\n") && !text.endsWith("\r") ? "\n" : ""}AtomSkinName=${value}\n`
}

export function convertBdaPlatform(source: SkinArchive, platform: Exclude<BdaPlatform, "unknown">): SkinArchive {
  if (source.format !== "bda") throw new Error("只能转换 BDA 皮肤")
  const output = SkinArchive.open(source.normalizedBytes(), "bda")
  for (const path of output.names()) {
    const bytes = output.getBytes(path)
    if (!bytes) continue
    if (/(^|\/)Info\.txt$/i.test(path)) output.setBytes(path, strToU8(setInfoPlatform(strFromU8(bytes), platform)))
    else if (/\/appearanceConfig$/i.test(path)) output.setBytes(path, convertBdaAppearancePlatform(bytes, platform))
    else if (/\/soundConfig$/i.test(path)) output.setBytes(path, convertBdaSoundPlatform(bytes, platform))
    else if (platform === "ios" && /\/switchConfig$/i.test(path)) output.delete(path)
  }
  const reopened = SkinArchive.open(output.normalizedBytes(), "bda")
  if (platform === "ios") {
    const files = unzipSync(reopened.normalizedBytes())
    const renamed: Record<string, Uint8Array> = {}
    for (const [path, value] of Object.entries(files)) {
      // Android exports may carry a legacy BDI token under `skin/`. Native iOS
      // BDA packages have no `skin/` wrapper; keeping it makes older importers
      // treat the archive as a mixed package and skip the root preview image.
      if (/^skin(?:\/|$)/i.test(path)) continue
      const name = path.replace(/^light\//, "skin_light/").replace(/^dark\//, "skin_dark/")
      renamed[name] = /(?:^|\/)Info\.txt$/i.test(name)
        ? strToU8(setInfoAtomSkinNames(strFromU8(value), ["skin_light", "skin_dark"]))
        : value
    }
    const ios = SkinArchive.open(zipSync(renamed, { level: 6 }), "bda")
    if (bdaPlatform(ios) !== platform) throw new Error("无法转换为 iOS BDA")
    return ios
  }
  const androidFiles = unzipSync(reopened.normalizedBytes())
  const androidRenamed: Record<string, Uint8Array> = {}
  for (const [path, value] of Object.entries(androidFiles)) {
    const name = path.replace(/^skin_light\//, "light/").replace(/^skin_dark\//, "dark/")
    androidRenamed[name] = /(?:^|\/)Info\.txt$/i.test(name)
      ? strToU8(setInfoAtomSkinNames(strFromU8(value), ["light", "dark"]))
      : value
  }
  const android = SkinArchive.open(zipSync(androidRenamed, { level: 6 }), "bda")
  if (bdaPlatform(android) !== platform) throw new Error("无法转换为 Android BDA")
  return android
}

export function bdaCompatibilityWarnings(archive: SkinArchive): string[] {
  if (archive.format !== "bda") return []
  const platform = bdaPlatform(archive)
  const declared = infoValue(archive, "SupportPlatform")
  const warnings: string[] = []
  if (platform !== "unknown" && declared && declared !== (platform === "ios" ? "I" : "A")) {
    warnings.push(`Info.txt 声明为 ${declared}，但配置属于 ${platform === "ios" ? "iOS" : "Android"} BDA`)
  }
  const encrypted = archive.zipEncryptedPaths().filter((path) => !path.endsWith("/"))
  if (encrypted.length) warnings.push(`ZIP 有 ${encrypted.length} 个条目被标记为加密，目标输入法可能静默拒绝`)
  return warnings
}
