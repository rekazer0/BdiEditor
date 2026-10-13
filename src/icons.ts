import {
  createElement, type IconNode, KeyRound, Component, SquareDashed, Ellipsis,
  LayoutGrid, Palette, Type, Zap, Images, PanelTop, Clapperboard, Volume2,
  MousePointer2, Move, Copy, ArrowLeftRight, Trash2, ChevronDown, ChevronRight,
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight, CircleDot, Music, Play, Info,
  AlignStartVertical, AlignEndVertical, AlignStartHorizontal, AlignEndHorizontal,
  ArrowUpDown, FoldHorizontal, FoldVertical, Layers, SquareStack, Ruler,
  Search, Plus, X, Upload, Download, ImageDown, ChevronLeft, ChevronUp,
  SquarePlus, CopyPlus, FileText, List, Keyboard, Image, Settings, PenLine, Asterisk,
  AppWindow, MessageSquare, Grid3x3, PenTool, PenOff, PencilLine, Brush, CaseLower, CaseUpper,
  ALargeSmall, ArrowBigUp, ArrowBigUpDash, Phone, Mail, Globe, Link, Calculator, Binary, Hash,
  Percent, Quote, AtSign, Ampersand, MessageSquareQuote, MessageSquareMore, Signature, Rows3,
  ListOrdered, ListChecks, CircleHelp, Mic, Film, WandSparkles, ToggleRight, Sticker, AudioLines,
  Sigma, Pi, Omega, Slash, Parentheses, Braces, DollarSign, Hand, ScanLine, Spline, ListTree,
  ListFilter, Smile, Laugh, SmilePlus, LayoutTemplate, PanelBottom, SquareDashedBottom,
  LayoutDashboard, Columns3, Table2, Box, Folder, File,
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
  "square-plus": SquarePlus, "copy-plus": CopyPlus, "file-text": FileText, list: List,
  keyboard: Keyboard, image: Image, settings: Settings, "pen-line": PenLine, asterisk: Asterisk,
  "app-window": AppWindow, "message-square": MessageSquare,
  // 概览文件图标：每个文件一个。
  "grid-3x3": Grid3x3, "pen-tool": PenTool, "pen-off": PenOff, "pencil-line": PencilLine, brush: Brush,
  "case-lower": CaseLower, "case-upper": CaseUpper, "a-large-small": ALargeSmall,
  "arrow-big-up": ArrowBigUp, "arrow-big-up-dash": ArrowBigUpDash, phone: Phone, mail: Mail,
  globe: Globe, link: Link, calculator: Calculator, binary: Binary, hash: Hash, percent: Percent,
  quote: Quote, "at-sign": AtSign, ampersand: Ampersand, "message-square-quote": MessageSquareQuote,
  "message-square-more": MessageSquareMore, signature: Signature, "rows-3": Rows3,
  "list-ordered": ListOrdered, "list-checks": ListChecks, "circle-help": CircleHelp, mic: Mic,
  film: Film, "wand-sparkles": WandSparkles, "toggle-right": ToggleRight, sticker: Sticker,
  "audio-lines": AudioLines, sigma: Sigma, pi: Pi, omega: Omega, slash: Slash,
  parentheses: Parentheses, braces: Braces, "dollar-sign": DollarSign, hand: Hand,
  "scan-line": ScanLine, spline: Spline, "list-tree": ListTree, "list-filter": ListFilter,
  smile: Smile, laugh: Laugh, "smile-plus": SmilePlus, "layout-template": LayoutTemplate,
  "panel-bottom": PanelBottom, "square-dashed-bottom": SquareDashedBottom,
  "layout-dashboard": LayoutDashboard, "columns-3": Columns3, "table-2": Table2, box: Box,
  // 源文件树
  folder: Folder, file: File,
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
    : /气泡/.test(label) ? "message-square"
    : /候选栏|提示栏/.test(label) ? "panel-top"
    : /面板|布局|输入区|扩展区域/.test(label) ? "layout-grid"
    : /列表/.test(label) ? "list"
    : /基本信息|全局/.test(label) ? "info"
    : /样式|外观|颜色|皮肤/.test(label) ? "palette"
    : /文字|字体|内容/.test(label) ? "type"
    : /动作|手势|按键/.test(label) ? "zap" : "panel-top"
  return inspectorIcon(name, 16)
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
  "list.bullet": ["list", 14], "speaker.wave.2": ["volume-2", 14], "music.note": ["music", 14],
  play: ["play", 14], "play.fill": ["play", 14],
  keyboard: ["keyboard", 14], gearshape: ["settings", 14], pencil: ["pen-line", 14],
  asterisk: ["asterisk", 14], app: ["app-window", 14],
  folder: ["folder", 14], doc: ["file", 14],
}

/** The panel icon for a platform symbol name, or null when the panel has no equivalent. */
export function inspectorSymbolIcon(symbol: string, size?: number): SVGElement | null {
  // 概览条目里也直接写 Lucide 名（palette、images…），同样走这套图标。
  const entry = symbolIcons[symbol] ?? (icons[symbol] ? [symbol, 14] : undefined)
  return entry ? inspectorIcon(entry[0], size ?? entry[1]) : null
}
