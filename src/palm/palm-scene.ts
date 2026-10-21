// Palm `skin.json` painted the way the Palm keyboard paints it: the board model (palm-board.ts) says
// where each key, list cell and candidate-bar icon is in a keyboard state, the styles (palm-styles.ts)
// what it looks like.

import { sceneKey, type NativeScene, type SceneLayer, type SceneLayers } from "../native-scene.ts"
import type { Rect } from "../preview-items.ts"
import type { PalmBase, PalmBoard, PalmTheme } from "./palm-board.ts"
import type { PalmStyles } from "./palm-styles.ts"

// What shows through a transparent skin: the Palm keyboard's own backdrop, sampled from Palm previews.
const BACKDROP: Record<PalmTheme, string> = { default: "#d0d3d9", night: "#212121" }

async function keyLayers(styles: PalmStyles, board: PalmBoard, base: PalmBase, rect: Rect, pressed: boolean): Promise<SceneLayers> {
  const fore: SceneLayer[] = []
  for (const [index, id] of base.fores.entries()) {
    const layer = await styles.fore(id, pressed, rect, board.offset(base.offsets[index]))
    if (layer) fore.push(layer)
  }
  return { back: base.back === undefined ? [] : await styles.back(base.back, pressed, rect), fore }
}

/** One keyboard board of a theme and orientation, in a keyboard state. */
export async function palmBoardScene(board: PalmBoard, styles: PalmStyles, state?: number): Promise<NativeScene> {
  const keys = await Promise.all(board.keys(state).map(({ section, rect, base }) =>
    sceneKey(section, rect, (pressed) => keyLayers(styles, board, base, rect, pressed))))
  const symbols = board.list()
  if (symbols) {
    keys.push(await sceneKey("LIST", symbols.bar, async (pressed) => ({ back: symbols.base.back === undefined ? [] : await styles.back(symbols.base.back, pressed, symbols.bar), fore: [] })))
    for (const cell of symbols.cells) {
      keys.push(await sceneKey(cell.section, cell.rect, async (pressed) => {
        const label = symbols.base.fores[0] === undefined ? undefined : await styles.fore(symbols.base.fores[0], pressed, cell.rect, undefined, cell.title)
        return { back: symbols.cell === undefined ? [] : await styles.back(symbols.cell, pressed, cell.rect), fore: label ? [label] : [] }
      }))
    }
  }
  // Keys below the panel (a navigation-bar row) grow the surface; the backdrop covers it too.
  const surface = { x: 0, y: 0, width: board.width, height: Math.ceil(Math.max(board.height, ...keys.filter((key) => /^KEY/.test(key.section)).map((key) => key.rect.y + key.rect.height))) }
  return {
    background: [
      { kind: "fill", rect: surface, color: BACKDROP[board.theme] },
      ...board.panelBack === undefined ? [] : await styles.back(board.panelBack, false, surface),
    ],
    keys,
  }
}

/**
 * The candidate bar of a board: its backdrop and icons. The switch container (F14) holds the toolbar
 * functions, evenly spaced and only ever shrunk.
 */
export async function palmCandidateScene(board: PalmBoard, styles: PalmStyles, state: number | undefined): Promise<{ bar: SceneLayer[]; icons: NativeScene }> {
  const size = board.candidateSize
  if (!size) return { bar: [], icons: { background: [], keys: [] } }
  // Every icon is painted; the canvas lists only those its composition shows.
  const keys = await Promise.all(board.icons(state).map(async ({ section, rect, base, switch: container, fixed }) => {
    if (container) {
      const images = await styles.toolbarImages()
      return sceneKey(section, rect, async () => {
        const slot = rect.width / Math.max(1, images.length)
        return { back: [], fore: images.map((visual, at) => {
          const [, , width, height] = visual.source!
          const scale = Math.min(1, slot / width, rect.height / height)
          return { kind: "image", visual, rect: {
            x: rect.x + at * slot + (slot - width * scale) / 2,
            y: rect.y + (rect.height - height * scale) / 2,
            width: width * scale,
            height: height * scale,
          } } as const
        }) }
      })
    }
    return sceneKey(section, rect, async (pressed) => {
      const fore: SceneLayer[] = []
      for (const id of base.fores) {
        const layer = await styles.fore(id, pressed, rect, undefined)
        if (!layer) continue
        fore.push(fixed && layer.kind === "image"
          ? { ...layer, rect: { x: rect.x + (rect.width - fixed[0]) / 2, y: rect.y + (rect.height - fixed[1]) / 2, width: fixed[0], height: fixed[1] } }
          : layer)
      }
      return { back: base.back === undefined ? [] : await styles.back(base.back, pressed, rect), fore }
    })
  }))
  const back = board.candidateBack
  return { bar: back === undefined ? [] : await styles.back(back, false, { x: 0, y: 0, ...size }), icons: { background: [], keys } }
}
