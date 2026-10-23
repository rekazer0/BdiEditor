// iOS 26 transparent background for a Sogou phone skin, the same result the Baidu tool gives a BDI
// skin: the candidate bar becomes fully transparent and the keyboard background (RootView, which Sogou
// paints behind the bar and the keys) almost transparent, alpha 01, so it still takes touches.
// Every look of every resolution folder is adapted; key backgrounds are left as they are.

import { IniDocument } from "../ini.ts"
import { IOS26_RGB } from "../ios26.ts"

const SKIN_FILE = /^\d+\/(?:[^/]+\/)?phoneSkin\.ini$/

/** Is `path` a look's phoneSkin.ini (`1080/status1/phoneSkin.ini`, `720/phoneSkin.ini`)? */
export function isSsfSkinFile(path: string): boolean {
  return SKIN_FILE.test(path)
}

/** Sogou draws BG_STYLE=2 views with BG_COLOR (frame/b0.java); the image is dropped so nothing else paints it. */
function solid(document: IniDocument, section: string, color: string): void {
  if (!document.sections().includes(section)) document.appendSection(section, [])
  document.set(section, "BG_STYLE", "2")
  document.set(section, "BG_COLOR", color)
  document.remove(section, "BG_IMAGE")
}

export function adaptSsfSkinForIos26(text: string): string {
  const document = IniDocument.parse(text)
  solid(document, "RootView", `0x01${IOS26_RGB.toUpperCase()}`)
  const bars = document.sections().filter((section) => /^CandidateView(?:Land|Weixin|DoubleLines)?$/.test(section))
  for (const section of new Set(["CandidateView", ...bars])) solid(document, section, `0x00${IOS26_RGB.toUpperCase()}`)
  return document.toString()
}
