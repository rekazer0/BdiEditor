// iOS reads the native F14 toolbar's images from logo plists, not arbitrary CND ICON slots.
import { IniDocument } from "../ini.ts"
import type { SkinArchive } from "../skin.ts"
import { cropImage, decodePng, encodePng } from "./ssf-png.ts"
import type { SsfPackage, SsfTheme } from "./ssf-package.ts"

const ITEMS = [
  ["F7", "19", "表情"],
  ["F13", "17", "键盘类型"],
  ["F72", "23", "语音输入"],
  ["F82", "26", "搜索"],
  ["F68", "45", "AI侃侃"],
] as const

const plist = (items: string[]) => `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><array>${items.join("\n")}</array></plist>\n`
const images = (normal: string, pressed: string) => {
  const states = `<dict><key>Normal</key><string>${normal}</string><key>Highlight</key><string>${pressed}</string><key>Selected</key><string>${normal}</string></dict>`
  return `<key>Images</key><dict><key>Normal</key>${states}<key>Theme</key>${states}</dict>`
}

/** Adapts only SSF exports; existing BDI documents keep their authored toolbar configuration. */
export function adaptSsfIosToolbar(archive: SkinArchive, source: SsfPackage, warnings: string[]): void {
  for (const theme of ["light", "dark"] as SsfTheme[]) {
    const prefix = `${theme}/skin/`
    const cssPath = `${prefix}res/default.css`
    if (!archive.isText(cssPath)) continue
    const css = IniDocument.parse(archive.getText(cssPath))
    const port = IniDocument.parse(archive.getText(`${prefix}port/cand1.cnd`))
    const icon = (document: IniDocument, action: string) => {
      const section = document.sections().find((name) => /^ICON\d+$/.test(name) && document.get(name, "KEY") === action)
      if (!section) throw new Error(`iOS 工具栏缺少 ${action} 图标`)
      return section
    }
    const writeImage = (action: string, state: "NM_IMG" | "HL_IMG", name: string): string => {
      const style = port.get(icon(port, action), "FORE_STYLE")
      const [resource, tile] = css.get(`STYLE${style}`, state)?.split(",") ?? []
      const bytes = resource && archive.getBytes(`${prefix}res/${resource}.png`)
      if (!bytes) throw new Error(`iOS 工具栏 ${action} 缺少 ${state} 图片`)
      const til = IniDocument.parse(archive.getText(`${prefix}res/${resource}.til`))
      const rect = til.get(`IMG${tile}`, "SOURCE_RECT")?.split(",").map(Number)
      if (!rect || rect.length !== 4 || rect.some((value) => !Number.isFinite(value))) throw new Error(`iOS 工具栏 ${action} 切片无效`)
      const image = decodePng(bytes)
      const [x, y, width, height] = rect
      const output = x === 0 && y === 0 && width === image.width && height === image.height
        ? bytes : encodePng(cropImage(image, x, y, width, height))
      archive.setBytes(`${prefix}res/logo/${name}_iphone@3x.png`, output)
      return name
    }
    const entries = ITEMS.map(([action, id, title], index) => {
      const normal = writeImage(action, "NM_IMG", `ssf-toolbar-${index}-normal`)
      const pressed = writeImage(action, "HL_IMG", `ssf-toolbar-${index}-pressed`)
      return `<dict><key>Position</key><string>toolbar</string><key>Name</key><string>${id}</string><key>Titles</key><dict><key>Normal</key><dict><key>Normal</key><string>${title}</string><key>Selected</key><string>${title}</string></dict></dict>${images(normal, pressed)}</dict>`
    })
    for (const [id, title, file, position] of [["18", "光标", "ime_function_textedit", "toolbar"], ["35", "剪贴板", "ime_function_clipboard", "menu"]]) {
      const normal = source.file(theme, `${file}.png`)
      if (!normal) continue
      const name = `ssf-menu-${id}`
      archive.setBytes(`${prefix}res/logo/${name}_iphone@3x.png`, normal)
      archive.setBytes(`${prefix}res/logo/${name}-pressed_iphone@3x.png`, source.file(theme, `${file}_p.png`) ?? normal)
      entries.push(`<dict><key>Position</key><string>${position}</string><key>Name</key><string>${id}</string><key>Titles</key><dict><key>Normal</key><dict><key>Normal</key><string>${title}</string></dict></dict>${images(name, `${name}-pressed`)}</dict>`)
    }
    for (const name of ["com.baidu.inputmethod.toolbarMenuItems.plist", "com.baidu.inputmethod.toolbarMenuItems.nijigen.plist"]) {
      archive.setText(`${prefix}res/logo/${name}`, plist(entries))
    }
    const logo = "ssf-toolbar-logo"
    // The client appends only "_iphone@3x.png" to a plist image name (native skins: "lg/jianpan" → lg/jianpan_iphone@3x.png).
    const logoNormal = writeImage("F31", "NM_IMG", `${logo}_Normal`)
    const logoStates = `<dict><key>Normal</key><string>${logoNormal}</string><key>Highlight</key><string>${writeImage("F31", "HL_IMG", `${logo}_Highlight`)}</string><key>Selected</key><string>${logoNormal}</string></dict>`
    archive.setText(`${prefix}res/logo/customImageConfig.plist`, plist([`<dict><key>Name</key><string>0</string><key>Images</key><dict><key>Normal</key>${logoStates}<key>Theme</key>${logoStates}</dict></dict>`]))
    const logoMenu = logoMenuStyles(archive, prefix, css, port)

    for (const orientation of ["port", "land"]) {
      const path = `${prefix}${orientation}/cand1.cnd`
      if (!archive.isText(path)) continue
      const document = IniDocument.parse(archive.getText(path))
      const genPath = `${prefix}${orientation}/gen.ini`
      const gen = IniDocument.parse(archive.getText(genPath))
      // VERSION=1 selects the plist-based iOS logo resources; writing the files alone does not load them.
      if (!gen.sections().includes("LOGO")) gen.appendSection("LOGO", [])
      gen.set("LOGO", "LAYOUT_NAME", "logo")
      archive.setText(genPath, gen.toString())
      // V6 p160: logo.ini declares the LOGO menu's colours; ICON_NUM=1 needs the [ICON1] it counts (native skins write both).
      archive.setText(`${prefix}${orientation}/logo.ini`, `[GLOBAL]\nICON_NUM=1\nVERSION=1\n\n[PANEL]\nBACK_STYLE=${logoMenu.back}\nICON_INDEX=1\n\n[ICON1]\nFORE_STYLE=${logoMenu.text}\nTEXT_STYLE=${logoMenu.text}\n`)
      const [,, width, height] = gen.get("CAND", "VIEW_RECT")!.split(",").map(Number)
      const side = Math.round(width / 7)
      const logoEntries = document.entries(icon(document, "F31"))
      const hideEntries = document.entries(icon(document, "F8"))
      document.removeSections(document.sections().filter((name) => /^ICON\d+$/.test(name)))
      const add = (name: string, entries: Array<{ key: string; value: string }>, x: number, w: number, action: string, persist: string, anchor = 1) => {
        document.appendSection(name, entries.filter(({ key }) => !["VIEW_RECT", "SIZE", "POS", "ANCHOR_TYPE", "KEY", "PERSIST"].includes(key)))
        const position = anchor === 5 ? `${-w / 2},${-height / 2}` : `${anchor === 3 ? x - width : x},0`
        for (const [key, value] of Object.entries({ SIZE: `${w},${height}`, POS: position, ANCHOR_TYPE: String(anchor), KEY: action, PERSIST: persist })) document.set(name, key, value)
      }
      add("ICON1", logoEntries, 0, side, "F31", "1")
      add("ICON2", [], side, width - side * 2, "F14", "1", 5)
      add("ICON3", hideEntries, width - side, side, "F8", "1", 3)
      add("ICON4", hideEntries, width - side, side, "F9", "2", 3)
      // V6 p158: iOS FIX_SIZE is in points (one third of the @3x artwork), not the touch rectangle.
      for (const [section, action] of [["ICON1", "F31"], ["ICON3", "F8"], ["ICON4", "F8"]]) {
        const style = port.get(icon(port, action), "FORE_STYLE")
        const [resource, tile] = css.get(`STYLE${style}`, "NM_IMG")!.split(",")
        const rect = IniDocument.parse(archive.getText(`${prefix}res/${resource}.til`)).get(`IMG${tile}`, "SOURCE_RECT")!.split(",").map(Number)
        document.set(section, "FIX_SIZE", `${Math.round(rect[2] / 3)},${Math.round(rect[3] / 3)}`)
      }
      document.set("CAND", "ICON_NUM", "4")
      document.set("CAND", "PADDING", `12,0,${side},0`)
      archive.setText(path, document.toString())
    }
  }
  warnings.push("iOS 工具栏按百度原生功能适配：搜狗灵犀映射为 AI侃侃；显示哪些功能、数量及顺序由百度客户端设置决定，不能保证搜狗七图标排列")
}

/** The LOGO menu takes the candidate bar's text colour and a solid colour sampled from its background. */
function logoMenuStyles(archive: SkinArchive, prefix: string, css: IniDocument, candidates: IniDocument): { back: string; text: string } {
  const text = candidates.get("CAND", "FORE_STYLE")?.trim() ?? ""
  const back = candidates.get("CAND", "BACK_STYLE")?.trim() ?? ""
  if (css.get(`STYLE${back}`, "NM_COLOR")) return { back, text }
  const [resource, tile] = css.get(`STYLE${back}`, "NM_IMG")?.split(",") ?? []
  const bytes = resource ? archive.getBytes(`${prefix}res/${resource}.png`) : undefined
  const rect = resource && archive.isText(`${prefix}res/${resource}.til`)
    ? IniDocument.parse(archive.getText(`${prefix}res/${resource}.til`)).get(`IMG${tile}`, "SOURCE_RECT")?.split(",").map(Number)
    : undefined
  if (!bytes || !rect || rect.length !== 4) return { back, text }
  const image = decodePng(bytes)
  const offset = ((rect[1] + Math.floor(rect[3] / 2)) * image.width + rect[0] + Math.floor(rect[2] / 2)) * 4
  const color = [...image.data.subarray(offset, offset + 3)].map((value) => value.toString(16).padStart(2, "0")).join("").toUpperCase()
  const id = String(Number(css.get("GLOBAL", "STYLE_NUM") ?? 0) + 1)
  css.appendSection(`STYLE${id}`, [{ key: "NM_COLOR", value: color }, { key: "HL_COLOR", value: color }])
  css.set("GLOBAL", "STYLE_NUM", id)
  archive.setText(`${prefix}res/default.css`, css.toString())
  return { back: id, text }
}
