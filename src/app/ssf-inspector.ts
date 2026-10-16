// The property inspector for a Sogou skin. It shows what the canvas draws in Sogou terms: a key's
// classes (background, foreground, label colour, animation, sound), a board's shared look, or every
// section of a Sogou file. The canvas layout is the preview overlay and is never shown or edited here.

import type { IniDocument } from "../ini.ts"
import type { SsfKeyBinding } from "../ssf/ssf-keymap.ts"
import { ssfSectionLabel } from "../ssf/ssf-labels.ts"
import { firstValue, ssfBackground, ssfForeground, ssfSoundSection, ssfTextSections } from "../ssf/ssf-parts.ts"
import { orientation } from "./dom"
import { editSsfFile, freeSectionName, renderGroup, setSsfValue, ssfButton, ssfEntries, type SsfBlock } from "./ssf-fields"
import { openImageResourceChooser } from "./resource-inspector"
import { isSsfBoardPath, ssfDocument, ssfKeysPath, ssfPackage, ssfQwertyBoard, ssfSelectedBindings, ssfSkinPath, ssfThemeFolder, SSF_SOUNDS_PATH } from "./ssf-documents"
import { appState } from "./state"
import { layoutLabel } from "./file-tree"

const COLOR_TEMPLATE = [{ key: "TEXT_COLOR", value: "0xFF000000" }]

/** The key section a per-key override is written to: one that already exists, else the portrait class. */
function ownSection(document: IniDocument, binding: SsfKeyBinding): string {
  const sections = document.sections()
  return binding.sections.find((section) => sections.includes(section))
    ?? binding.sections.find((section) => !/_Land/.test(section))
    ?? binding.sections[0]
}

/** Sound names Sogou can play: the WAV / OGG / MP3 files in default/, without extension. */
function soundOptions(): string[] {
  return [...new Set((appState.archive?.names() ?? []).flatMap((path) => {
    const match = path.match(/^default\/(?:res\/)?([^/]+)\.(?:wav|ogg|mp3)$/i)
    return match ? [match[1]] : []
  }))].sort()
}

function backgroundGroup(skinPath: string, skin: IniDocument, binding: SsfKeyBinding): HTMLElement | undefined {
  const background = ssfBackground(skin, binding)
  if (!background) {
    const owner = ownSection(skin, binding)
    return renderGroup("背景", [{
      path: skinPath,
      section: owner,
      title: "未设置背景",
      note: "这个按键没有背景图，也没有可用的共享背景。",
      template: [{ key: "BG_IMAGES", value: freeSectionName(skin, `SMA_${owner}`) }],
    }])
  }
  if (background.owner) {
    return renderGroup("背景", [{
      path: skinPath,
      section: background.images,
      reference: { path: skinPath, section: background.owner, key: "BG_IMAGES" },
    }], background.images)
  }
  // A shared default draws this key: editing it restyles every key of the class, so offer a copy.
  const copy = ssfButton("单独设置", "copy-plus", () => {
    const entries = ssfEntries(skinPath, background.images)
    editSsfFile(skinPath, (document) => {
      const owner = ownSection(document, binding)
      const images = freeSectionName(document, `SMA_${owner}`)
      document.appendSection(images, entries)
      setSsfValue(document, owner, "BG_IMAGES", images)
    })
  })
  return renderGroup("背景", [{
    path: skinPath,
    section: background.images,
    note: `共享背景：修改会影响所有使用 ${background.images} 的按键。`,
    actions: [copy],
  }], background.images)
}

function foregroundGroup(skinPath: string, keysPath: string, skin: IniDocument, binding: SsfKeyBinding): HTMLElement | undefined {
  const keys = ssfDocument(keysPath)
  const foreground = ssfForeground(skin, keys, binding)
  const blocks: SsfBlock[] = []
  if (foreground?.kind === "keys") {
    blocks.push(
      { path: keysPath, section: foreground.images, title: "前景图", reference: { path: keysPath, section: foreground.owner, key: "FG_IMAGES" } },
      { path: keysPath, section: foreground.owner, title: "前景位置", omit: ["FG_IMAGES", "ANIM_STYLE"] },
    )
  } else if (foreground) {
    blocks.push({ path: skinPath, section: foreground.owner, title: "图标", only: ["ICON", "ICON_PRESSED"] })
  } else {
    const add = ssfButton("添加前景图", "square-plus", () => openImageResourceChooser((resourceID) => {
      const file = /\.\w+$/.test(resourceID) ? resourceID : `${resourceID}.png`
      editSsfFile(keysPath, (document) => {
        const owner = ownSection(document, binding)
        const images = freeSectionName(document, `Foground_${owner}`)
        document.appendSection(images, [{ key: "NORMAL", value: file }, { key: "PRESSED", value: file }])
        setSsfValue(document, owner, "FG_IMAGES", images)
        setSsfValue(document, owner, "FG_RECT", "0,0,1,1")
      })
    }))
    const owner = ownSection(skin, binding)
    blocks.push({ path: skinPath, section: owner, title: "前景", note: "这个按键没有前景图，显示输入法自带的文字或图标。", actions: [add], only: [], template: [] })
  }
  // FG_STYLE places the icon and labels inside the key.
  const fgStyle = binding.sections.map((section) => firstValue(skin.get(section, "FG_STYLE"))).find(Boolean)
  if (fgStyle) blocks.push({ path: skinPath, section: fgStyle, title: "前景布局" })
  return renderGroup("前景", blocks)
}

function textGroup(skinPath: string, skin: IniDocument, binding: SsfKeyBinding): HTMLElement | undefined {
  const sections = ssfTextSections(binding, ssfQwertyBoard())
  const source = sections.find((section) => skin.get(section, "TEXT_COLOR") !== undefined)
  const own = binding.sections.includes(source ?? "")
  const copy = ssfButton("单独设置", "copy-plus", () => editSsfFile(skinPath, (document) => {
    const owner = ownSection(document, binding)
    setSsfValue(document, owner, "TEXT_COLOR", (source && document.get(source, "TEXT_COLOR")) ?? "0xFF000000")
    const pressed = source && document.get(source, "TEXT_COLOR_PRESSED")
    if (pressed) setSsfValue(document, owner, "TEXT_COLOR_PRESSED", pressed)
  }))
  if (!source) {
    return renderGroup("文字", [{ path: skinPath, section: sections.at(-2)!, title: "按键文字", template: COLOR_TEMPLATE, note: "没有文字颜色，使用输入法默认颜色。" }])
  }
  return renderGroup("文字", [{
    path: skinPath,
    section: source,
    note: own ? undefined : `共享文字样式：修改会影响所有使用 ${source} 的按键。`,
    actions: own ? undefined : [copy],
  }], source)
}

function animationGroup(keysPath: string, binding: SsfKeyBinding): HTMLElement | undefined {
  const keys = ssfDocument(keysPath)
  const owner = binding.sections.find((section) => keys.get(section, "ANIM_STYLE"))
  if (!owner) return
  const style = firstValue(keys.get(owner, "ANIM_STYLE"))
  const animPath = `${ssfThemeFolder()}anim.ini`
  const blocks: SsfBlock[] = [{ path: keysPath, section: owner, title: "动画引用", omit: ["FG_IMAGES", "FG_RECT"] }]
  if (style) blocks.push({ path: animPath, section: style, title: "动画样式" })
  return renderGroup("动画", blocks)
}

function soundGroup(binding: SsfKeyBinding | undefined): HTMLElement | undefined {
  const sounds = ssfDocument(SSF_SOUNDS_PATH)
  const section = ssfSoundSection(sounds, binding)
  const options = { sound: soundOptions() }
  if (section) {
    return renderGroup("音效", [{
      path: SSF_SOUNDS_PATH,
      section,
      note: binding && section === "Key" ? "使用默认按键音效。" : undefined,
      options,
    }], section)
  }
  const owner = binding ? binding.sections.find((name) => !/_Land/.test(name)) ?? binding.sections[0] : "Key"
  return renderGroup("音效", [{ path: SSF_SOUNDS_PATH, section: owner, title: "按键音效", template: [{ key: "sound", value: options.sound[0] ?? "" }], options }])
}

/** Remaining values of the key's own classes (labels, long-press key, type…). */
function keyGroup(skinPath: string, binding: SsfKeyBinding): HTMLElement | undefined {
  const handled = ["BG_IMAGES", "ICON", "ICON_PRESSED", "FG_STYLE", "TEXT_COLOR", "TEXT_COLOR_PRESSED"]
  const blocks = binding.sections
    .filter((section) => ssfEntries(skinPath, section).some((entry) => !handled.includes(entry.key)))
    .map((section) => ({ path: skinPath, section, omit: handled }))
  return blocks.length ? renderGroup("按键", blocks) : undefined
}

function keyGroups(binding: SsfKeyBinding): HTMLElement[] {
  const skinPath = ssfSkinPath()
  const keysPath = ssfKeysPath()
  if (!skinPath || !keysPath) return []
  const skin = ssfDocument(skinPath)
  return [
    backgroundGroup(skinPath, skin, binding),
    foregroundGroup(skinPath, keysPath, skin, binding),
    textGroup(skinPath, skin, binding),
    keyGroup(skinPath, binding),
    animationGroup(keysPath, binding),
    soundGroup(binding),
  ].filter((group): group is HTMLElement => Boolean(group))
}

/** What every key of the current board shares: backgrounds, candidate bar, default classes, colours. */
function boardGroups(): HTMLElement[] {
  const skinPath = ssfSkinPath()
  if (!skinPath) return []
  const skin = ssfDocument(skinPath)
  const qwerty = ssfQwertyBoard()
  const nineKey = /\/(?:py|en)_9s?\.ini$/i.test(appState.layoutPath)
  const block = (section: string, extra: Partial<SsfBlock> = {}): SsfBlock => ({ path: skinPath, section, ...extra })
  const referenced = (section: string, key: string, title: string): SsfBlock[] => {
    const target = firstValue(skin.get(section, key))
    return target && !/\.\w+$/.test(target) ? [block(target, { title })] : []
  }
  const candidate = orientation.value === "land" && skin.sections().includes("CandidateViewLand") ? "CandidateViewLand" : "CandidateView"
  const groups: Array<[string, SsfBlock[]]> = [
    ["键盘背景", [block("RootView"), ...skin.sections().includes("WALLPAPER") ? [block("WALLPAPER")] : []]],
    ["候选栏", [block(candidate), ...referenced(candidate, "BG_IMAGE", "候选栏背景")]],
    ["候选字", [block("TextStyle_Candidate", { template: COLOR_TEMPLATE }), block("TextStyle_Candidate_Highlight", { template: COLOR_TEMPLATE })]],
    ["输入码", [block("ComposingView"), block("TextStyle_Composing", { template: COLOR_TEMPLATE })]],
    ["按键背景", (qwerty ? ["KeyBg_Default_Latin", "KeyBg_Function_Qwerty", "KeyBg_Space_Qwerty"] : ["KeyBg_Default", "KeyBg_Function", "KeyBg_Space"]).map((section) => block(section))],
    ["按键文字", [
      block(qwerty ? "TextStyle_Qwerty" : "TextStyle_Phone_Label", { template: COLOR_TEMPLATE }),
      block(qwerty ? "TextStyle_FuncKey_26char" : "TextStyle_FuncKey_T9", { template: COLOR_TEMPLATE }),
      block("TextStyle_Space_Label"),
      block("TextStyle", { template: COLOR_TEMPLATE }),
      block("General"),
    ]],
    ...nineKey ? [["符号列", [
      block("CandidateCodeView"),
      ...referenced("CandidateCodeView", "BG_IMAGE", "符号列背景"),
      ...referenced("CandidateCodeView", "BG_IMAGES", "符号列单元格"),
      block("TextStyle_Popup_Code"),
    ]] as [string, SsfBlock[]]] : [],
  ]
  return [
    ...groups.map(([label, blocks]) => renderGroup(label, blocks)),
    soundGroup(undefined),
  ].filter((group): group is HTMLElement => Boolean(group))
}

/** Every section of a Sogou INI file, one group each. */
function fileGroups(path: string): HTMLElement[] {
  const document = ssfDocument(path)
  return document.sections().flatMap((section) => {
    const label = path === "phoneTheme.ini" && section === "General" ? "皮肤信息" : ssfSectionLabel(section)
    const group = renderGroup(label, [{ path, section }], section)
    return group ? [group] : []
  })
}

/** Inspector header for a board or its selected keys: the board / key class name and the file it lives in. */
export function ssfInspectorTitle(): { name: string; context: string } | undefined {
  const path = appState.selectedPath
  const skinPath = ssfSkinPath()
  if (!skinPath || !isSsfBoardPath(path) || path !== appState.layoutPath) return
  const bindings = ssfSelectedBindings()
  if (!appState.selectedKeySections.length) return { name: layoutLabel(path.split("/").pop()!), context: skinPath }
  const primary = bindings[0]?.binding.sections.find((section) => !/_Land/.test(section)) ?? bindings[0]?.binding.sections[0]
  const name = appState.selectedKeySections.length > 1 ? `已选 ${appState.selectedKeySections.length} 个按键` : primary ? ssfSectionLabel(primary) : "按键"
  return { name, context: primary ? `${skinPath.split("/").slice(-2).join("/")} · ${primary}` : skinPath }
}

/**
 * Fills `container` for the current Sogou selection and returns whether there was anything to show.
 * Several selected keys show the first one's classes: Sogou styles classes, not individual keys.
 */
export function populateSsfInspector(container: HTMLElement): boolean {
  container.replaceChildren()
  if (!ssfPackage()) return false
  const path = appState.selectedPath
  let groups: HTMLElement[] = []
  if (isSsfBoardPath(path) && path === appState.layoutPath) {
    const bindings = ssfSelectedBindings()
    groups = bindings.length ? keyGroups(bindings[0].binding) : boardGroups()
  } else if (appState.archive?.isText(path) && /\.ini$/i.test(path) && !appState.archive.isOverlay(path)) {
    groups = fileGroups(path)
  }
  container.append(...groups)
  container.dataset.path = path
  return groups.length > 0
}
