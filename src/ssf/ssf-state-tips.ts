// A Baidu key can swap its artwork per state through `STAT_STYLE` → `TIPn`. The Sogou writers paint
// the key itself, so its state TIPs must show that same style instead of the skeleton's own artwork.

import { IniDocument } from "../ini.ts"
import type { SkinArchive } from "../skin.ts"

/** Points every state TIP of a painted key at the key's own styles, keeping state-only placement out. */
export function syncKeyStateTips(archive: SkinArchive): void {
  for (const path of archive.names()) {
    if (!/\/(?:port|land)\/[^/]+\.ini$/.test(path) || path.endsWith("/gen.ini")) continue
    const document = IniDocument.parse(archive.getText(path))
    const sections = document.sections()
    let changed = false
    for (const section of sections.filter((name) => /^KEY\d+$/.test(name))) {
      const states = document.get(section, "STAT_STYLE")
      const back = document.get(section, "BACK_STYLE")
      const fore = document.get(section, "FORE_STYLE")
      for (const match of states?.matchAll(/S\d+_(\d+)/g) ?? []) {
        const tip = `TIP${match[1]}`
        if (!sections.includes(tip)) continue
        if (back) document.set(tip, "BACK_STYLE", back)
        if (fore) {
          document.set(tip, "FORE_STYLE", fore)
          document.remove(tip, "FORE_OFFSET")
          document.remove(tip, "POS_TYPE")
        }
        changed = true
      }
    }
    if (changed) archive.setText(path, document.toString())
  }
}
