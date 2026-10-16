import { type StyleTextVisual } from "./atlas.ts"
import { type BdaImageStyle } from "./bda.ts"
import { bdaCssColor } from "./bda-resolver.ts"

/**
 * 字体适配：BDS 布局目录里的 font.json（`"Style<编号>": {...}`，字段与 BDA 图片样式的 fontInfo 相同）。
 * 真机按它用系统字体画文字，不画该样式的切图（如小米皮肤的「重输」「符」「中/英」）。
 */
export type FontAdaptInfo = NonNullable<BdaImageStyle["fontInfo"]>

export function parseFontJson(text: string): Map<string, FontAdaptInfo> {
  let value: unknown
  try {
    value = JSON.parse(text.replace(/^\uFEFF/, ""))
  } catch {
    return new Map()
  }
  if (!value || typeof value !== "object") return new Map()
  return new Map(Object.entries(value).flatMap(([name, info]) => {
    const id = name.match(/^Style(\d+)$/i)?.[1]
    return id && info && typeof info === "object" ? [[id, info as FontAdaptInfo]] : []
  }))
}

export function fontAdaptText(info: FontAdaptInfo | undefined, highlighted: boolean): StyleTextVisual | undefined {
  if (!info?.contentText) return
  const color = highlighted ? info.highlightColor ?? info.normalColor : info.normalColor
  return {
    text: info.contentText,
    fontSize: info.fontSize || undefined,
    color: color === undefined ? undefined : bdaCssColor(color),
    // 「中/英」这类切换键：drawType 2 突出后一段，其余 drawType 突出前一段；没有 drawType 时整段同一字号。
    emphasis: info.drawType === undefined || !info.contentText.includes("/")
      ? undefined
      : info.drawType === 2 ? "last" : "first",
    replacesImage: true,
  }
}
