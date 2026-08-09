import { IniDocument } from "./ini.ts"
import { SkinArchive } from "./skin.ts"

export type Visual = {
  image?: ImageBitmap
  imagePath?: string
  color?: string
  source?: [number, number, number, number]
  inner?: [number, number, number, number]
}

export type TextVisual = {
  fontSize?: number
  fontName?: string
  fontWeight?: number
  color?: string
}

type VisualSpec = {
  imageName?: string
  tile?: number
  color?: string
}

function numbers(value: string | undefined): [number, number, number, number] | undefined {
  const parsed = value?.split(",").map(Number)
  if (!parsed || parsed.length !== 4 || parsed.some((item) => !Number.isFinite(item))) return
  return parsed as [number, number, number, number]
}

function parseColor(value: string | undefined): string | undefined {
  if (!value) return
  const hex = value.trim().replace(/^#/, "")
  if (!/^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(hex)) return
  if (hex.length === 6) return `#${hex}`
  const alpha = Number.parseInt(hex.slice(0, 2), 16) / 255
  const red = Number.parseInt(hex.slice(2, 4), 16)
  const green = Number.parseInt(hex.slice(4, 6), 16)
  const blue = Number.parseInt(hex.slice(6, 8), 16)
  const opacity = Number(alpha.toFixed(3))
  return `rgba(${red}, ${green}, ${blue}, ${opacity})`
}

export function isTransparentColor(color: string | undefined): boolean {
  if (!color) return false
  const match = color.match(/^rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)$/)
  return Boolean(match && Number(match[1]) === 0)
}

export function canvasFontFamily(fontName: string | undefined): string {
  const name = fontName?.trim()
  if (!name || /^\.SF(?:UI|NS)/i.test(name)) return "system-ui"
  return `"${name.replaceAll('"', '\\"')}", system-ui`
}

export function drawVisualSource(
  context: Pick<CanvasRenderingContext2D, "drawImage">,
  visual: Pick<Visual, "image" | "source">,
  destination: { x: number; y: number; width: number; height: number },
): void {
  if (!visual.image || !visual.source) return
  const [sourceX, sourceY, sourceWidth, sourceHeight] = visual.source
  context.drawImage(
    visual.image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    destination.x,
    destination.y,
    destination.width,
    destination.height,
  )
}

export function resolveTextVisual(
  styles: IniDocument,
  foreground: string,
  highlighted: boolean,
): TextVisual | undefined {
  const sections = styles.sections()
  const result: TextVisual = {}
  const visited = new Set<string>()
  for (const token of foreground.split(",").map((value) => value.trim()).filter(Boolean)) {
    const value = Number(token)
    const candidates = [`STYLE${token}`]
    if (Number.isFinite(value)) candidates.push(`STYLE${Math.floor(value / 100)}`)
    for (const section of candidates) {
      if (!sections.includes(section) || visited.has(section)) continue
      visited.add(section)
      const fontSize = Number(styles.get(section, "FONT_SIZE"))
      const fontName = styles.get(section, "FONT_NAME")?.trim()
      const fontWeight = Number(styles.get(section, "FONT_WEIGHT"))
      const color = parseColor(
        (highlighted ? styles.get(section, "HL_COLOR") : undefined) ??
          styles.get(section, "NM_COLOR"),
      )
      if (result.fontSize === undefined && Number.isFinite(fontSize)) result.fontSize = fontSize
      if (result.fontName === undefined && fontName) result.fontName = fontName
      if (
        result.fontWeight === undefined &&
        Number.isFinite(fontWeight) &&
        fontWeight >= 1 &&
        fontWeight <= 1000
      ) result.fontWeight = fontWeight
      if (result.color === undefined && color) result.color = color
    }
  }
  return Object.keys(result).length ? result : undefined
}

export function resolveVisualSpec(
  styles: IniDocument,
  styleID: string,
  highlighted: boolean,
): VisualSpec | undefined {
  const id = styleID.trim()
  if (!/^\d+$/.test(id)) return
  const section = `STYLE${id}`
  if (!styles.sections().includes(section)) return
  const imageValue =
    (highlighted ? styles.get(section, "HL_IMG") : undefined) ?? styles.get(section, "NM_IMG")
  const [imageName, tileValue] = imageValue?.split(",").map((part) => part.trim()) ?? []
  const colorValue =
    (highlighted ? styles.get(section, "HL_COLOR") : undefined) ??
    styles.get(section, "NM_COLOR")
  const color = parseColor(colorValue)
  return {
    imageName: imageName || undefined,
    tile: tileValue ? Number(tileValue) : undefined,
    color,
  }
}

function pngBlob(bytes: Uint8Array): Blob {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return new Blob([copy.buffer], { type: "image/png" })
}

function topLevelDicts(plist: string): string[] {
  const dictionaries: string[] = []
  let depth = 0
  let start = -1
  for (const match of plist.matchAll(/<\/?dict>/g)) {
    if (match[0] === "<dict>") {
      if (depth === 0) start = match.index
      depth++
      continue
    }
    depth--
    if (depth === 0 && start >= 0) dictionaries.push(plist.slice(start, match.index + match[0].length))
  }
  return dictionaries
}

export function toolbarImagePaths(plist: string, limit = 3): string[] {
  return topLevelDicts(plist)
    .filter((entry) => /<key>Position<\/key>\s*<string>toolbar<\/string>/.test(entry))
    .flatMap((entry) => {
      const path = entry.match(/<string>(1\.0\/toolbarMenuItem_[^<]+)<\/string>/)?.[1]
      return path ? [path] : []
    })
    .slice(0, limit)
}

export class AtlasResolver {
  private readonly archive: SkinArchive
  private readonly theme: string
  private readonly resourceRoots: string[]
  private readonly styles?: IniDocument
  private readonly images = new Map<string, Promise<ImageBitmap>>()
  private readonly tiles = new Map<string, IniDocument>()

  constructor(archive: SkinArchive, theme: string, orientation: string) {
    this.archive = archive
    this.theme = theme
    this.resourceRoots = [
      `${theme}/skin/${orientation}/res`,
      `${theme}/skin/res`,
    ]
    const path = [
      ...this.resourceRoots.map((root) => `${root}/default.css`),
    ].find((candidate) => archive.names().includes(candidate))
    if (path) this.styles = IniDocument.parse(archive.getText(path))
  }

  private bitmap(path: string): Promise<ImageBitmap> | undefined {
    const bytes = this.archive.getBytes(path)
    if (!bytes) return
    let image = this.images.get(path)
    if (!image) {
      image = createImageBitmap(pngBlob(bytes))
      this.images.set(path, image)
    }
    return image
  }

  async resolve(styleID: string, highlighted: boolean): Promise<Visual | undefined> {
    if (!this.styles) return
    const spec = resolveVisualSpec(this.styles, styleID, highlighted)
    if (!spec) return
    if (!spec.imageName || !spec.tile) return { color: spec.color }

    const base = this.resourceRoots
      .map((root) => `${root}/${spec.imageName}`)
      .find((candidate) =>
        this.archive.names().includes(`${candidate}.png`) &&
        this.archive.names().includes(`${candidate}.til`),
      )
    if (!base) return { color: spec.color }
    const imagePath = `${base}.png`
    const tilePath = `${base}.til`
    const image = this.bitmap(imagePath)
    if (!image || !this.archive.names().includes(tilePath)) return { color: spec.color }

    let tiles = this.tiles.get(tilePath)
    if (!tiles) {
      tiles = IniDocument.parse(this.archive.getText(tilePath))
      this.tiles.set(tilePath, tiles)
    }
    const source = numbers(tiles.get(`IMG${spec.tile}`, "SOURCE_RECT"))
    if (!source) return { color: spec.color }
    const absoluteInner = numbers(tiles.get(`IMG${spec.tile}`, "INNER_RECT"))
    const inner = absoluteInner
      ? ([
          absoluteInner[0] - source[0],
          absoluteInner[1] - source[1],
          absoluteInner[2],
          absoluteInner[3],
        ] as [number, number, number, number])
      : undefined
    return { image: await image, imagePath, source, inner, color: spec.color }
  }

  async resolveToolbarImages(limit = 3): Promise<Visual[]> {
    const plistPath = `${this.theme}/skin/res/logo/com.baidu.inputmethod.toolbarMenuItems.plist`
    if (!this.archive.isText(plistPath)) return []
    const names = this.archive.names()
    const paths = toolbarImagePaths(this.archive.getText(plistPath), limit).flatMap((base) => {
      const prefix = `${this.theme}/skin/res/logo/${base}`
      const candidates = [
        `${prefix}_iphone@3x.png`,
        `${prefix}@3x.png`,
        `${prefix}.png`,
      ]
      const path = candidates.find((candidate) => names.includes(candidate))
      return path ? [path] : []
    })
    const visuals: Array<Visual | undefined> = await Promise.all(paths.map(async (path) => {
      const image = await this.bitmap(path)
      return image ? { image, imagePath: path, source: [0, 0, image.width, image.height] as [number, number, number, number] } : undefined
    }))
    return visuals.filter((visual): visual is Visual => Boolean(visual))
  }

  resolveText(foreground: string, highlighted: boolean): TextVisual | undefined {
    if (!this.styles) return
    return resolveTextVisual(this.styles, foreground, highlighted)
  }
}
