import {
  createElement, type IconNode, KeyRound, Component, SquareDashed, Ellipsis,
  LayoutGrid, Palette, Type, Zap, Images, PanelTop, Clapperboard, Volume2,
  MousePointer2, Move, Copy, ArrowLeftRight, Trash2, ChevronDown, ChevronRight,
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight, CircleDot, Music, Play, Info,
  AlignStartVertical, AlignEndVertical, AlignStartHorizontal, AlignEndHorizontal,
  ArrowUpDown, FoldHorizontal, FoldVertical, Layers, SquareStack, Ruler,
} from "lucide"

// Exact Lucide names from 属性检查器.pen, read through Pen MCP.
const icons: Record<string, IconNode> = {
  "key-round": KeyRound, component: Component, "square-dashed": SquareDashed,
  ellipsis: Ellipsis, "layout-grid": LayoutGrid, palette: Palette, type: Type,
  zap: Zap, images: Images, "panel-top": PanelTop, clapperboard: Clapperboard,
  "volume-2": Volume2, "mouse-pointer-2": MousePointer2, move: Move, copy: Copy,
  "arrow-left-right": ArrowLeftRight, "trash-2": Trash2, "chevron-down": ChevronDown,
  "chevron-right": ChevronRight, "arrow-up": ArrowUp, "arrow-down": ArrowDown,
  "arrow-left": ArrowLeft, "arrow-right": ArrowRight, "circle-dot": CircleDot,
  music: Music, play: Play, info: Info, "align-start-vertical": AlignStartVertical,
  "align-end-vertical": AlignEndVertical, "align-start-horizontal": AlignStartHorizontal,
  "align-end-horizontal": AlignEndHorizontal, "arrow-up-down": ArrowUpDown,
  "fold-horizontal": FoldHorizontal, "fold-vertical": FoldVertical, layers: Layers,
  "square-stack": SquareStack, ruler: Ruler,
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
