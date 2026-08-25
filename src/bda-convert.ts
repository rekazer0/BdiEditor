import { strToU8, zipSync } from "fflate"
import {
  bdaAppearancePath,
  bdaColorHex,
  bdaConfigPath,
  bdaLayoutDocument,
  bdaStyleID,
  decodeBdaAnimation,
  decodeBdaAppearance,
  type BdaAnimation,
  type BdaImageAtom,
} from "./bda.ts"
import { IniDocument } from "./ini.ts"
import { SkinArchive } from "./skin.ts"

export type BdaConversion = { archive: SkinArchive; warnings: string[] }

function pngSize(bytes: Uint8Array): [number, number] {
  if (
    bytes.length < 24 ||
    ![137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte) ||
    new TextDecoder().decode(bytes.slice(12, 16)) !== "IHDR"
  ) throw new Error("BDA 资源不是有效的 PNG")
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return [view.getUint32(16), view.getUint32(20)]
}

function staticResourceID(resourceID: string, animation: BdaAnimation): string {
  return animation.sequences.get(resourceID)?.frames.find((frame) => frame.resourceID)?.resourceID ?? resourceID
}

function sourceImage(
  source: SkinArchive,
  theme: string,
  orientation: string,
  resourceID: string,
): { id: string; bytes: Uint8Array } | undefined {
  const id = resourceID.replace(/\.png$/i, "")
  const paths = [
    `${theme}/skin/${orientation}/res/${id}.png`,
    `${theme}/skin/res/${id}.png`,
  ]
  const path = paths.find((candidate) => source.isImage(candidate))
  const bytes = path && source.getBytes(path)
  return bytes ? { id, bytes } : undefined
}

function tile(width: number, height: number, inner?: BdaImageAtom["innerRect"]): Uint8Array {
  return strToU8([
    "[GLOBAL]",
    "IMG_NUM=1",
    "",
    "[IMG1]",
    `SOURCE_RECT=0,0,${width},${height}`,
    ...(inner ? [`INNER_RECT=${inner.x},${inner.y},${inner.width},${inner.height}`] : []),
    "",
  ].join("\n"))
}

export function convertBdaArchive(source: SkinArchive, base: SkinArchive): BdaConversion {
  if (source.format !== "bda") throw new Error("只能转换 BDA 皮肤")
  const output = new Map<string, Uint8Array>()
  const warnings: string[] = []
  for (const path of ["Info.txt", "demo.png"]) {
    const bytes = source.getBytes(path)
    if (bytes) output.set(path, bytes)
  }

  for (const theme of ["light", "dark"] as const) {
    for (const orientation of ["port", "land"] as const) {
      const appearancePath = bdaAppearancePath(source, theme, orientation)
      const appearanceBytes = appearancePath && source.getBytes(appearancePath)
      if (!appearanceBytes) continue
      const appearance = decodeBdaAppearance(appearanceBytes)
      const animationPath = bdaConfigPath(source, theme, orientation, "animation")
      const animationBytes = animationPath && source.getBytes(animationPath)
      const animation = animationBytes
        ? decodeBdaAnimation(animationBytes)
        : { targets: [], sequences: new Map(), bindings: new Map(), targetBindings: new Map(), effects: new Map() }

      const basePrefix = `light/skin/${orientation}/`
      const targetPrefix = `${theme}/skin/${orientation}/`
      for (const path of base.names()) {
        if (!path.startsWith(basePrefix) || path.slice(basePrefix.length).includes("/")) continue
        const name = path.slice(basePrefix.length)
        if (name !== "gen.ini" && /\.ini$/i.test(name)) continue
        const bytes = base.getBytes(path)
        if (bytes) output.set(`${targetPrefix}${name}`, bytes)
      }
      for (const layout of appearance.panels.keys()) {
        const path = `${basePrefix}${layout}.ini`
        if (!base.isText(path)) {
          warnings.push(`${theme}/${orientation} 的 ${layout} 面板没有 BDS/BDI 基础布局，已跳过`)
          continue
        }
        output.set(
          `${targetPrefix}${layout}.ini`,
          strToU8(bdaLayoutDocument(IniDocument.parse(base.getText(path)), appearance, layout).toString()),
        )
      }

      const styles: string[] = []
      const copied = new Set<string>()
      const imageSpec = (atom: BdaImageAtom | undefined): string | undefined => {
        const original = atom?.resource?.resourceID
        if (!original) return
        const resourceID = staticResourceID(original, animation)
        const image = sourceImage(source, theme, orientation, resourceID)
        if (!image) return
        if (!copied.has(image.id)) {
          const [width, height] = pngSize(image.bytes)
          output.set(`${theme}/skin/res/${image.id}.png`, image.bytes)
          output.set(`${theme}/skin/res/${image.id}.til`, tile(width, height, atom?.innerRect))
          copied.add(image.id)
        }
        return `${image.id},1`
      }
      for (const [key, style] of appearance.imageStyles) {
        const normal = imageSpec(style.normalImage)
        const highlighted = imageSpec(style.highlightImage) ?? normal
        styles.push(
          `[STYLE${bdaStyleID({ type: "image", key })}]`,
          ...(normal ? [`NM_IMG=${normal}`] : []),
          ...(highlighted ? [`HL_IMG=${highlighted}`] : []),
          "",
        )
      }
      for (const [key, style] of appearance.colorStyles) {
        styles.push(
          `[STYLE${bdaStyleID({ type: "color", key })}]`,
          `NM_COLOR=${bdaColorHex(style.normalColor ?? 0)}`,
          `HL_COLOR=${bdaColorHex(style.highlightColor ?? style.normalColor ?? 0)}`,
          "",
        )
      }
      for (const [key, style] of appearance.textStyles) {
        styles.push(
          `[STYLE${bdaStyleID({ type: "text", key })}]`,
          ...(style.fontName ? [`FONT_NAME=${style.fontName}`] : []),
          ...(style.fontSize ? [`FONT_SIZE=${style.fontSize}`] : []),
          `NM_COLOR=${bdaColorHex(style.normalColor ?? 0)}`,
          `HL_COLOR=${bdaColorHex(style.highlightColor ?? style.normalColor ?? 0)}`,
          "",
        )
      }
      output.set(
        `${theme}/skin/res/default.css`,
        strToU8(`[GLOBAL]\nSTYLE_NUM=${appearance.imageStyles.size + appearance.colorStyles.size + appearance.textStyles.size}\n\n${styles.join("\n")}`),
      )
      if (animation.sequences.size) {
        warnings.push(`${theme}/${orientation} 的 ${animation.sequences.size} 个序列帧动画已降级为首帧静态图`)
      }
    }
  }

  if (!output.size) throw new Error("BDA 中没有可转换的外观配置")
  return { archive: SkinArchive.open(zipSync(Object.fromEntries(output), { level: 6 })), warnings }
}
