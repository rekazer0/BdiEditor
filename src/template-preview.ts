import { AtlasResolver } from "./atlas.ts"
import {
  BdaResolver,
  bdaAppearancePath,
  bdaLayoutDocument,
  bdaStyleID,
  decodeBdaAppearance,
} from "./bda.ts"
import { IniDocument } from "./ini.ts"
import {
  DEFAULT_BDA_PANEL_HEIGHT,
  DEFAULT_BDA_PANEL_WIDTH,
  resolvePanelConfig,
} from "./keyboard.ts"
import { loadBuiltInProjectTemplate } from "./operations.ts"
import { scaleIniDocument } from "./panel-tools.ts"
import { Preview } from "./preview.ts"
import { SkinArchive } from "./skin.ts"

const LAYOUT_FILES = ["py_9.ini", "py_26.ini"] as const

let bdaBasePromise: Promise<SkinArchive> | undefined

function loadBdaBase(): Promise<SkinArchive> {
  bdaBasePromise ??= (async () => {
    const response = await fetch(new URL("bda-base.bds", document.baseURI))
    if (!response.ok) throw new Error("无法加载 BDA 官方基础布局")
    return SkinArchive.open(new Uint8Array(await response.arrayBuffer()))
  })()
  return bdaBasePromise
}

function pickTheme(names: readonly string[]): "light" | "dark" {
  return names.some((name) => name.startsWith("light/skin/")) ? "light" : "dark"
}

function pickLayoutPath(names: readonly string[], theme: "light" | "dark"): string | undefined {
  const prefix = `${theme}/skin/port/`
  for (const layout of LAYOUT_FILES) {
    if (names.includes(`${prefix}${layout}`)) return `${prefix}${layout}`
  }
  return names.find((name) =>
    name.startsWith(prefix) &&
    name.toLowerCase().endsWith(".ini") &&
    !name.endsWith("/gen.ini")
  )
}

function stylePath(names: readonly string[], theme: "light" | "dark"): string | undefined {
  return [
    `${theme}/skin/port/res/default.css`,
    `${theme}/skin/res/default.css`,
  ].find((path) => names.includes(path))
}

async function paintPreview(
  canvas: HTMLCanvasElement,
  setup: (preview: Preview) => void,
): Promise<void> {
  const preview = new Preview(canvas, () => {}, () => {})
  try {
    preview.setMode("preview")
    preview.setTransparent(false)
    setup(preview)
    await preview.whenDrawn()
  } finally {
    preview.destroy()
  }
}

async function renderLegacyPreview(archive: SkinArchive, canvas: HTMLCanvasElement): Promise<void> {
  const names = archive.names()
  const theme = pickTheme(names)
  const layoutPath = pickLayoutPath(names, theme)
  const genPath = `${theme}/skin/port/gen.ini`
  const cssPath = stylePath(names, theme)
  if (!layoutPath || !archive.isText(layoutPath) || !archive.isText(genPath) || !cssPath) {
    throw new Error("皮肤缺少竖屏布局或样式")
  }
  const layout = IniDocument.parse(archive.getText(layoutPath))
  const gen = IniDocument.parse(archive.getText(genPath))
  const styles = IniDocument.parse(archive.getText(cssPath))
  const config = resolvePanelConfig(layout, gen, styles)
  await paintPreview(canvas, (preview) => {
    preview.setTheme(theme)
    preview.setResolver(new AtlasResolver(archive, theme, "port"))
    preview.setDefaults(gen)
    preview.setOffsets(gen)
    preview.setPanel(config.styleID, config.width, config.height)
    preview.setDocument(layout)
  })
}

async function renderBdaPreview(archive: SkinArchive, canvas: HTMLCanvasElement): Promise<void> {
  const base = await loadBdaBase()
  const theme = pickTheme(archive.names())
  const appearancePath = bdaAppearancePath(archive, theme, "port")
  const bytes = appearancePath && archive.getBytes(appearancePath)
  if (!bytes) throw new Error("皮肤缺少 appearanceConfig")
  const appearance = decodeBdaAppearance(bytes)
  const layoutName = LAYOUT_FILES
    .map((name) => name.replace(/\.ini$/i, ""))
    .find((name) => appearance.panels.has(name))
    ?? [...appearance.panels.keys()][0]
  if (!layoutName) throw new Error("皮肤缺少面板")
  const layoutFile = `${layoutName}.ini`
  const basePath = `light/skin/port/${layoutFile}`
  if (!base.isText(basePath)) throw new Error("缺少 BDA 基础布局")
  let layout = IniDocument.parse(base.getText(basePath))
  const width = Number(layout.get("PANEL", "SIZE")?.split(",")[0])
  if (appearance.designWidth && width) {
    layout = scaleIniDocument(layout, appearance.designWidth / width, appearance.designWidth / width)
  }
  layout = bdaLayoutDocument(layout, appearance, layoutFile)
  const genPath = "light/skin/port/gen.ini"
  const gen = base.isText(genPath) ? IniDocument.parse(base.getText(genPath)) : undefined
  const generalSize = gen?.get("PANEL", "SIZE")?.split(",").map(Number)
  const layoutSize = layout.get("PANEL", "SIZE")?.split(",").map(Number)
  const panel = appearance.panels.get(layoutName)
  await paintPreview(canvas, (preview) => {
    preview.setTheme(theme)
    preview.setResolver(new BdaResolver(archive, bytes, base, theme, "port"))
    if (gen) {
      preview.setDefaults(gen)
      preview.setOffsets(gen)
    }
    preview.setPanel(
      bdaStyleID(panel?.wholeBackStyle ?? panel?.backStyle),
      layoutSize?.[0] || generalSize?.[0] || DEFAULT_BDA_PANEL_WIDTH,
      layoutSize?.[1] || generalSize?.[1] || DEFAULT_BDA_PANEL_HEIGHT,
    )
    preview.setDocument(layout)
  })
}

async function renderTemplatePreview(id: string, host: HTMLElement): Promise<void> {
  const bytes = await loadBuiltInProjectTemplate(id)
  const archive = await SkinArchive.openAsync(bytes)
  const canvas = document.createElement("canvas")
  canvas.setAttribute("aria-hidden", "true")
  if (archive.format === "bda") await renderBdaPreview(archive, canvas)
  else await renderLegacyPreview(archive, canvas)
  if (!canvas.width || !canvas.height) throw new Error("预览为空")
  host.replaceChildren(canvas)
  host.classList.add("is-rendered")
}

export async function hydrateTemplateCardPreviews(root: ParentNode = document): Promise<void> {
  const cards = [...root.querySelectorAll<HTMLButtonElement>(".template-card[data-template]")]
  for (const card of cards) {
    const id = card.dataset.template
    const host = card.querySelector<HTMLElement>(".template-preview")
    if (!id || !host) continue
    try {
      await renderTemplatePreview(id, host)
    } catch {
      host.textContent = "预览暂不可用"
    }
  }
}
