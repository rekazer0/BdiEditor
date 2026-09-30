import {
  createElement, type IconNode, KeyRound, Component, SquareDashed, Ellipsis,
  LayoutGrid, Palette, Type, Zap, Images, PanelTop, Clapperboard, Volume2,
  MousePointer2, Move, Copy, ArrowLeftRight, Trash2, ChevronDown, ChevronRight,
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight, CircleDot, Music, Play, Info,
  AlignStartVertical, AlignEndVertical, AlignStartHorizontal, AlignEndHorizontal,
  ArrowUpDown, FoldHorizontal, FoldVertical, Layers, SquareStack, Ruler,
  Search, Plus, X, Upload, Download, ImageDown, ChevronLeft, ChevronUp,
  SquarePlus, CopyPlus, FileText,
} from "lucide"

// Exact Lucide names from 属性检查器.pen, read through Pen MCP.
const icons: Record<string, IconNode> = {
  "key-round": KeyRound, component: Component, "square-dashed": SquareDashed,
  ellipsis: Ellipsis, "layout-grid": LayoutGrid, palette: Palette, type: Type,
  zap: Zap, images: Images, "panel-top": PanelTop, clapperboard: Clapperboard,
  "volume-2": Volume2, "mouse-pointer-2": MousePointer2, move: Move, copy: Copy,
  "arrow-left-right": ArrowLeftRight, "trash-2": Trash2, "chevron-down": ChevronDown,
  "chevron-right": ChevronRight, "chevron-left": ChevronLeft, "chevron-up": ChevronUp,
  "arrow-up": ArrowUp, "arrow-down": ArrowDown, "arrow-left": ArrowLeft,
  "arrow-right": ArrowRight, "circle-dot": CircleDot, music: Music, play: Play,
  info: Info, "align-start-vertical": AlignStartVertical,
  "align-end-vertical": AlignEndVertical, "align-start-horizontal": AlignStartHorizontal,
  "align-end-horizontal": AlignEndHorizontal, "arrow-up-down": ArrowUpDown,
  "fold-horizontal": FoldHorizontal, "fold-vertical": FoldVertical, layers: Layers,
  "square-stack": SquareStack, ruler: Ruler, search: Search, plus: Plus, x: X,
  upload: Upload, download: Download, "image-down": ImageDown,
  "square-plus": SquarePlus, "copy-plus": CopyPlus, "file-text": FileText,
}

export function inspectorIcon(name: string, size = 14): SVGElement {
  const node = icons[name]
  if (!node) throw new Error(`Unknown inspector icon: ${name}`)
  const svg = createElement(node, { width: size, height: size, "stroke-width": 1.5, "aria-hidden": "true", class: "inspector-icon" })
  svg.dataset.penIcon = name
  return svg
}

export function inspectorGroupIcon(label: string): SVGElement {
  const name = /资源|图片/.test(label) ? "images"
    : /动画|动效|粒子/.test(label) ? "clapperboard"
    : /声音|音效/.test(label) ? "volume-2"
    : /面板|候选栏|提示栏/.test(label) ? "panel-top"
    : /布局|输入区|扩展区域/.test(label) ? "layout-grid"
    : /样式|外观|颜色|皮肤/.test(label) ? "palette"
    : /文字|字体|内容/.test(label) ? "type"
    : /动作|手势|按键/.test(label) ? "zap" : "panel-top"
  return inspectorIcon(name, 15)
}

/*
 * The panel's own tools (rail, key tool row, chevrons, section heads) draw the set above, but the
 * markup and the image/document panels still create platform symbols: those are a 20-unit box at
 * stroke 1.7, one optical step bolder than 1.5 in the 24-unit box here, so the same row reads as
 * two different icon families. Everything the panel still ships resolves through this map, which
 * keeps one glyph size (14px, like the tool rows) and one weight across the whole panel.
 */
const symbolIcons: Record<string, [string, number]> = {
  magnifyingglass: ["search", 14], plus: ["plus", 14], xmark: ["x", 14], trash: ["trash-2", 14],
  "arrow.up": ["upload", 14], "arrow.down": ["download", 14], "arrow.right": ["arrow-right", 14],
  "chevron.left": ["chevron-left", 14], "chevron.up": ["chevron-up", 14],
  "chevron.down": ["chevron-down", 14], "chevron.right": ["chevron-right", 14],
  cursorarrow: ["mouse-pointer-2", 14],
  "arrow.up.and.down.and.arrow.left.and.right": ["move", 14],
  "arrow.left.and.right": ["arrow-left-right", 14], "arrow.left.arrow.right": ["arrow-left-right", 14],
  "arrow.up.and.down": ["arrow-up-down", 14], "doc.on.doc": ["copy", 14],
  "doc.text": ["file-text", 14], "square.grid.2x2": ["layout-grid", 14],
  "plus.rectangle": ["square-plus", 14], "plus.square.on.square": ["copy-plus", 14],
  "photo.badge.arrow.down": ["image-down", 14],
  "align.horizontal.left": ["align-start-vertical", 14],
  "align.horizontal.right": ["align-end-vertical", 14],
  "align.vertical.top": ["align-start-horizontal", 14],
  "align.vertical.bottom": ["align-end-horizontal", 14],
  "arrow.left.and.right.righttriangle.left.righttriangle.right": ["fold-horizontal", 14],
  "arrow.up.and.down.righttriangle.up.righttriangle.down": ["fold-vertical", 14],
  "square.2.layers.3d": ["square-stack", 14], "rectangle.3.group": ["layout-grid", 14],
  paintbrush: ["palette", 14], paintpalette: ["palette", 14],
  "rectangle.and.hand.point": ["zap", 14], "text.bubble": ["panel-top", 14],
  sparkles: ["clapperboard", 14], "info.circle": ["info", 14], photo: ["images", 14],
  "list.bullet": ["layers", 14], "speaker.wave.2": ["volume-2", 14], "music.note": ["music", 14],
  play: ["play", 14], "play.fill": ["play", 14],
}

/** The panel icon for a platform symbol name, or null when the panel has no equivalent. */
export function inspectorSymbolIcon(symbol: string, size?: number): SVGElement | null {
  const entry = symbolIcons[symbol]
  return entry ? inspectorIcon(entry[0], size ?? entry[1]) : null
}
