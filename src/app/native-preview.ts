// Palm and Sogou skins are painted from their own files (skin.json, phoneSkin.ini); the layout the
// canvas lists only names the key sections the editor selects and edits, and their geometry.

import { AtlasResolver, type TextVisual } from "../atlas.ts"
import { IniDocument } from "../ini.ts"
import type { NativeScene, SceneLayer } from "../native-scene.ts"
import { palmBoardScene, palmCandidateScene, type PalmOrientation, type PalmTheme } from "../palm/palm-scene.ts"
import { SXI_SKIN_PATH, parseSkinJson } from "../palm/sxi-projection.ts"
import type { JsonObject } from "../palm/sxi-ini.ts"
import type { SkinArchive } from "../skin.ts"
import type { SsfTheme } from "../ssf/ssf-package.ts"
import { SsfStyles, ssfBoardScene, ssfCandidateScene } from "../ssf/ssf-scene.ts"
import { candidateBackgroundPreview, preview, toolbarPreview } from "./canvas-interaction"
import { toolbarConfigPath } from "./config-context"
import { ssfDocumentPackage } from "./ssf-preview"
import { appState } from "./state"

type CandidateScene = { bar: SceneLayer[]; icons: NativeScene }

function palmSkin(archive: SkinArchive): JsonObject {
  const cached = appState.palmSkin
  if (cached?.archive === archive && cached.revision === archive.revision) return cached.skin
  const skin = parseSkinJson(archive.getText(SXI_SKIN_PATH))
  appState.palmSkin = { archive, revision: archive.revision, skin }
  return skin
}

/** The toolbar canvas follows the keyboard state; the bar's backdrop does not change with it. */
function setCandidateScenes(build: (state: number | undefined) => Promise<CandidateScene>): void {
  const scenes = new Map<number | undefined, Promise<CandidateScene>>()
  const scene = (state: number | undefined) => {
    let built = scenes.get(state)
    if (!built) scenes.set(state, built = build(state))
    return built
  }
  toolbarPreview.setScene((state) => scene(state).then(({ icons }) => icons))
  candidateBackgroundPreview.setScene(() => scene(undefined).then(({ bar }) => ({ background: bar, keys: [] })))
}

function palmScenes(archive: SkinArchive): boolean {
  const pointer = archive.derivedPointer(appState.layoutPath)
  if (pointer?.[2] !== "b") return false
  const skin = palmSkin(archive)
  const [theme, layoutKey, , type] = pointer as [PalmTheme, string, string, string]
  const orientation = layoutKey.replace(/_layout$/, "") as PalmOrientation
  preview.setScene((state) => palmBoardScene(archive, skin, theme, orientation, type, state))
  setCandidateScenes((state) => palmCandidateScene(archive, skin, theme, orientation, type, state))
  return true
}

function ssfScenes(archive: SkinArchive): boolean {
  const template = appState.ssfTemplates?.sogou
  const match = appState.layoutPath.match(/^(light|dark)\/skin\/(port|land)\/([^/]+)\.ini$/)
  const layout = appState.layoutDocument
  if (!template || !match || !layout) return false
  const [, theme, orientation, name] = match
  const templatePath = (file: string) => `light/skin/${orientation}/${file}`
  const templateText = (file: string) => template.isText(templatePath(file)) ? IniDocument.parse(template.getText(templatePath(file))) : undefined
  const templateLayout = templateText(`${name}.ini`)
  if (!templateLayout) return false
  const pkg = ssfDocumentPackage(archive)
  const styles = new SsfStyles(archive, pkg, theme as SsfTheme)
  const resolver = new AtlasResolver(template, "light", orientation)
  const templateGen = templateText("gen.ini")
  const width = (document?: IniDocument) => Number(document?.get("PANEL", "SIZE")?.split(",")[0])
  const scale = width(layout) && width(templateGen) ? width(layout) / width(templateGen) : 1
  const skeleton = { layout, template: templateLayout, resolver, offsets: templateGen, scale }
  const candidatePath = toolbarConfigPath()
  const candidates = candidatePath && archive.isText(candidatePath) ? IniDocument.parse(archive.getText(candidatePath)) : undefined
  const barHeight = candidates && !toolbarPreview.canvas.closest("[hidden]") ? toolbarPreview.panelHeight : 0
  const size = { width: preview.panelWidth, height: preview.surfaceHeight }
  preview.setScene(() => ssfBoardScene(styles, skeleton, name, orientation === "land", { ...size, barHeight }))
  const templateCandidates = candidatePath && templateText(candidatePath.split("/").pop()!)
  if (candidates && templateCandidates) {
    setCandidateScenes(() => ssfCandidateScene(styles, candidates, templateCandidates, resolver, {
      width: toolbarPreview.panelWidth,
      height: toolbarPreview.panelHeight,
      panelHeight: size.height,
    }))
  }
  return true
}

/** Points the canvases at the open document's native scenes, or back at the layout's styles. */
export function refreshNativeScenes(): void {
  const archive = appState.archive
  const native = archive?.format === "sxi" ? palmScenes(archive) : archive?.format === "ssf" ? ssfScenes(archive) : false
  if (!native) for (const canvas of [preview, toolbarPreview, candidateBackgroundPreview]) canvas.setScene(undefined)
}

type CandidateText = { words?: TextVisual; first?: TextVisual; input?: TextVisual }

function ssfCandidateText(archive: SkinArchive, width: number): CandidateText | undefined {
  const theme = appState.layoutPath.match(/^(light|dark)\//)?.[1] as SsfTheme | undefined
  if (!theme) return
  const styles = new SsfStyles(archive, ssfDocumentPackage(archive), theme)
  const scale = width / styles.sogouWidth
  const visual = (section: string): TextVisual | undefined => {
    const look = styles.text([section], scale)
    const color = styles.color(section)
    const visual: TextVisual = {
      ...color ? { color } : {},
      ...look.size ? { fontSize: look.size } : {},
      ...look.font ? { fontName: look.font } : {},
      ...look.weight ? { bold: look.weight >= 700 } : {},
    }
    return Object.keys(visual).length ? visual : undefined
  }
  // Sogou highlights the first candidate with its own style.
  return { words: visual("TextStyle_Candidate"), first: visual("TextStyle_Candidate_Highlight"), input: visual("TextStyle_Composing") }
}

/**
 * The candidate words, first candidate and input code as the open Palm or Sogou skin styles them;
 * a field the skin leaves out keeps the built-in look.
 */
export function nativeCandidateText(width: number): CandidateText | undefined {
  const archive = appState.archive
  return archive?.format === "ssf" ? ssfCandidateText(archive, width) : undefined
}
