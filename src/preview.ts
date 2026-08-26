import { canvasFontFamily, isTransparentColor, type StyleTextVisual, type TextVisual, type Visual, type VisualResolver } from "./atlas.ts"
import { skinStateFallbackText } from "./actions.ts"
import { IniDocument } from "./ini.ts"
import { DEFAULT_CANDIDATE_HEIGHT, DEFAULT_PANEL_HEIGHT, DEFAULT_PANEL_WIDTH } from "./keyboard.ts"
import { gestureDirection, snapPointToRects, snapRectDelta } from "./layout.ts"
import { stateStyleValue, stateTipSection } from "./panel-tools.ts"
import type {
  BdaAnimation,
  BdaAnimationBinding,
  BdaAnimationEffect,
  BdaAnimationSequence,
  BdaEmitterAnimation,
  BdaTransformAnimation,
} from "./bda.ts"

export type PreviewEvent = {
  section: string
  direction: "center" | "hold" | "up" | "down" | "left" | "right"
  code: string
  holdSymbols?: string
}

type Rect = { x: number; y: number; width: number; height: number }

type NineSliceCanvas = Pick<HTMLCanvasElement, "width" | "height" | "getContext">

let nineSliceBuffer: HTMLCanvasElement | undefined

function sharedNineSliceBuffer(): HTMLCanvasElement {
  nineSliceBuffer ??= document.createElement("canvas")
  return nineSliceBuffer
}

function nineSliceAxis(size: number, leading: number, trailing: number): [number, number, number, number] {
  const fixed = leading + trailing
  const scale = fixed > size && fixed > 0 ? size / fixed : 1
  const first = Math.round(leading * scale)
  const second = Math.max(first, Math.round(size - trailing * scale))
  return [0, first, second, size]
}

export function drawNineSliceImage(
  context: Pick<CanvasRenderingContext2D, "drawImage">,
  visual: Visual,
  destination: Rect,
  createCanvas: () => NineSliceCanvas = sharedNineSliceBuffer,
): void {
  if (!visual.image || !visual.source || !visual.inner) return
  const [sx, sy, sw, sh] = visual.source
  const [ix, iy, iw, ih] = visual.inner
  const width = Math.max(1, Math.round(destination.width))
  const height = Math.max(1, Math.round(destination.height))
  const buffer = createCanvas()
  buffer.width = width
  buffer.height = height
  const bufferContext = buffer.getContext("2d")
  if (!bufferContext) return
  bufferContext.imageSmoothingEnabled = true
  bufferContext.imageSmoothingQuality = "high"

  const xs = [0, ix, ix + iw, sw]
  const ys = [0, iy, iy + ih, sh]
  const dx = nineSliceAxis(width, ix, sw - ix - iw)
  const dy = nineSliceAxis(height, iy, sh - iy - ih)
  for (let row = 0; row < 3; row++) {
    for (let column = 0; column < 3; column++) {
      const sourceWidth = xs[column + 1] - xs[column]
      const sourceHeight = ys[row + 1] - ys[row]
      const targetWidth = dx[column + 1] - dx[column]
      const targetHeight = dy[row + 1] - dy[row]
      if (sourceWidth <= 0 || sourceHeight <= 0 || targetWidth <= 0 || targetHeight <= 0) continue
      bufferContext.drawImage(
        visual.image,
        sx + xs[column],
        sy + ys[row],
        sourceWidth,
        sourceHeight,
        dx[column],
        dy[row],
        targetWidth,
        targetHeight,
      )
    }
  }
  context.drawImage(
    buffer as CanvasImageSource,
    0,
    0,
    width,
    height,
    destination.x,
    destination.y,
    destination.width,
    destination.height,
  )
}

export type PreviewItem = {
  section: string
  sections: string[]
  rect: Rect
  touchRect?: Rect
  foreRect?: Rect
  editable: boolean
  show: string
  center: string
  up: string
  down: string
  left: string
  right: string
  hold: string
  holdSymbols: string
  backStyle: string
  highlightBackStyle?: string
  foreStyle: string
  foreStyles: string[]
  foreOffsets: Array<[number, number] | undefined>
  positionTypes: string[]
  statStyle: string
  animStyle?: string
  backAnimStyle?: string
  foreAnimStyle?: string
  foreAnimStyles: string[]
}

type LegacyAnimationFrame = {
  type: "opacity" | "translate" | "scale" | "rotate"
  start: number
  duration: number
  delay: number
  repeat: number
  reverse: boolean
  relative: boolean
  easing: readonly [number, number]
  from: readonly [number, number]
  to: readonly [number, number]
}

export type LegacyParticleEmitter = {
  images: string[]
  life: readonly [number, number]
  emitRegion: readonly [number, number, number, number]
  totalNumber: number
  birthRate: number
  velocity: readonly [number, number]
  velocityDirection: readonly [number, number]
  acceleration: readonly [number, number]
  accelerationDirection: readonly [number, number]
  initialScale: readonly [number, number]
  scaleSpeed: readonly [number, number]
  initialRotation: readonly [number, number]
  rotationSpeed: readonly [number, number]
  initialAlpha: readonly [number, number]
  alphaSpeed: readonly [number, number]
}

export type LegacyParticleFrame = {
  styleID: string
  x: number
  y: number
  scale: number
  rotation: number
  opacity: number
}

type LegacyAnimationEffect = {
  frames: LegacyAnimationFrame[]
  particles: LegacyParticleEmitter[]
  parallel: boolean
}

export type LegacyAnimation = Map<string, LegacyAnimationEffect>

function animationEasing(type: number, progress: number): number {
  if (type === 1) return progress * progress
  if (type === 2) return 1 - (1 - progress) ** 2
  if (type === 3) return Math.cos((progress + 1) * Math.PI) / 2 + 0.5
  if (type === 4) {
    const bounce = (value: number) => value * value * 8
    const value = progress * 1.1226
    if (value < 0.3535) return bounce(value)
    if (value < 0.7408) return bounce(value - 0.54719) + 0.7
    if (value < 0.9644) return bounce(value - 0.8526) + 0.9
    return bounce(value - 1.0435) + 0.95
  }
  return progress
}

function animationDuration(frame: LegacyAnimationFrame): number {
  return frame.duration * frame.repeat * (frame.reverse ? 2 : 1)
}

function scalePair(value: string | undefined): [number, number] | undefined {
  const parts = value?.split(",").map(Number)
  if (!parts || parts.length < 2 || parts.some((part) => !Number.isFinite(part))) return
  return [parts[0] / 100, parts[1] / 100]
}

function pixelPair(value: string | undefined): [number, number] | undefined {
  const parts = value?.split(",").map(Number)
  if (!parts || parts.length < 2 || parts.some((part) => !Number.isFinite(part))) return
  return [parts[0], parts[1]]
}

function opacityPair(value: string | undefined): [number, number] | undefined {
  const number = Number(value)
  if (!Number.isFinite(number)) return
  const opacity = Math.max(0, Math.min(1, number / 255))
  return [opacity, opacity]
}

function scalarPair(value: string | undefined): [number, number] | undefined {
  const number = Number(value?.split(",")[0])
  return Number.isFinite(number) ? [number, number] : undefined
}

function numberRange(value: string | undefined, fallback: readonly [number, number]): [number, number] {
  const parts = value?.split(",").map(Number).filter(Number.isFinite) ?? []
  return [parts[0] ?? fallback[0], parts[1] ?? parts[0] ?? fallback[1]]
}

export function parseLegacyParticleEmitter(animations: IniDocument, section: string): LegacyParticleEmitter | undefined {
  const images = (animations.get(section, "PARTICLE_IMAGE") ?? "")
    .split(",").map((value) => value.trim()).filter(Boolean)
  if (!images.length) return
  const region = (animations.get(section, "EMIT_REGION") ?? "0,0,1,1").split(",").map(Number)
  return {
    images,
    life: numberRange(animations.get(section, "LIFE"), [1000, 1000]),
    emitRegion: region.length === 4 && region.every(Number.isFinite)
      ? region as [number, number, number, number]
      : [0, 0, 1, 1],
    totalNumber: Math.max(1, Number(animations.get(section, "TOTAL_NUMBER")) || 1),
    birthRate: Math.max(0.1, Number(animations.get(section, "BIRTH_RATE")) || 1),
    velocity: numberRange(animations.get(section, "VELOCITY"), [0, 0]),
    velocityDirection: numberRange(animations.get(section, "VELOCITY_DIRECTION"), [0, 0]),
    acceleration: numberRange(animations.get(section, "ACCELERATION"), [0, 0]),
    accelerationDirection: numberRange(animations.get(section, "ACCELERATION_DIRECTION"), [90, 90]),
    initialScale: numberRange(animations.get(section, "INIT_SCALE"), [1, 1]),
    scaleSpeed: numberRange(animations.get(section, "SCALE_SPEED"), [0, 0]),
    initialRotation: numberRange(animations.get(section, "INIT_ROTATE"), [0, 0]),
    rotationSpeed: numberRange(animations.get(section, "ROTATE_SPEED"), [0, 0]),
    initialAlpha: numberRange(animations.get(section, "INIT_ALPHA"), [255, 255]),
    alphaSpeed: numberRange(animations.get(section, "ALPHA_SPEED"), [0, 0]),
  }
}

function seededUnit(seed: number): number {
  let value = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b)
  value = Math.imul(value ^ value >>> 13, 0xc2b2ae35)
  return ((value ^ value >>> 16) >>> 0) / 0x1_0000_0000
}

function ranged(range: readonly [number, number], seed: number): number {
  return range[0] + (range[1] - range[0]) * seededUnit(seed)
}

export function legacyParticleFrames(
  emitter: LegacyParticleEmitter,
  elapsed: number,
  panelWidth: number,
  panelHeight: number,
): LegacyParticleFrame[] {
  // ponytail: deterministic ballistic preview; add EMIT_TYPE modes when a real skin needs distinct emitters.
  const interval = 1000 / emitter.birthRate
  const emitted = Math.min(emitter.totalNumber, Math.max(0, Math.floor(elapsed / interval)))
  const maxLife = Math.max(...emitter.life)
  const first = Math.max(0, emitted - Math.ceil(maxLife / interval) - 1)
  const normalized = emitter.emitRegion.every((value) => Math.abs(value) <= 1)
  const [regionX, regionY, regionWidth, regionHeight] = normalized
    ? [
        emitter.emitRegion[0] * panelWidth,
        emitter.emitRegion[1] * panelHeight,
        emitter.emitRegion[2] * panelWidth,
        emitter.emitRegion[3] * panelHeight,
      ]
    : emitter.emitRegion
  const result: LegacyParticleFrame[] = []
  for (let index = first; index < emitted; index++) {
    const age = elapsed - (index + 1) * interval
    const life = ranged(emitter.life, index * 17 + 1)
    if (age < 0 || age > life) continue
    const seconds = age / 1000
    const velocity = ranged(emitter.velocity, index * 17 + 2)
    const velocityDirection = ranged(emitter.velocityDirection, index * 17 + 3) * Math.PI / 180
    const acceleration = ranged(emitter.acceleration, index * 17 + 2)
    const direction = ranged(emitter.accelerationDirection, index * 17 + 3) * Math.PI / 180
    const distance = acceleration * seconds * seconds / 2
    result.push({
      styleID: emitter.images[Math.floor(seededUnit(index * 17 + 4) * emitter.images.length)],
      x: regionX + seededUnit(index * 17 + 5) * regionWidth + Math.cos(velocityDirection) * velocity * seconds + Math.cos(direction) * distance,
      y: regionY + seededUnit(index * 17 + 6) * regionHeight + Math.sin(velocityDirection) * velocity * seconds + Math.sin(direction) * distance,
      scale: Math.max(0, ranged(emitter.initialScale, index * 17 + 7) + ranged(emitter.scaleSpeed, index * 17 + 8) * seconds),
      rotation: ranged(emitter.initialRotation, index * 17 + 9) + ranged(emitter.rotationSpeed, index * 17 + 10) * seconds,
      opacity: Math.max(0, Math.min(1, (ranged(emitter.initialAlpha, index * 17 + 11) + ranged(emitter.alphaSpeed, index * 17 + 12) * seconds) / 255)),
    })
  }
  return result
}

export function parseLegacyAnimation(
  styles: IniDocument,
  animations: IniDocument,
): LegacyAnimation {
  const result: LegacyAnimation = new Map()
  for (const section of styles.sections()) {
    const styleID = section.match(/^STYLE(.+)$/)?.[1]
    const animationID = styles.get(section, "PRESS_ANIM") ?? styles.get(section, "SHOW_ANIM")
    if (!styleID || !animationID) continue
    const build = `ANIM${animationID}`
    const ids = (animations.get(build, "BUILD_LIST") ?? animationID)
      .split(",").map((value) => value.trim()).filter(Boolean)
    const parallel = animations.get(build, "BUILD_METHOD") === "0"
    let start = 0
    const particles: LegacyParticleEmitter[] = []
    const frames = ids.flatMap((id) => {
      const frame = `ANIM${id}`
      const particle = parseLegacyParticleEmitter(animations, frame)
      if (particle) {
        particles.push(particle)
        return []
      }
      const type = animations.get(frame, "TYPE")
      const fromPixels = animations.get(frame, "FROM_PX")
      const toPixels = animations.get(frame, "TO_PX")
      const from = type === "0"
        ? opacityPair(animations.get(frame, "FROM"))
        : type === "1"
          ? scalarPair(animations.get(frame, "FROM"))
        : type === "2"
          ? pixelPair(fromPixels ?? animations.get(frame, "FROM"))
          : scalePair(animations.get(frame, "FROM"))
      const to = type === "0"
        ? opacityPair(animations.get(frame, "TO"))
        : type === "1"
          ? scalarPair(animations.get(frame, "TO"))
        : type === "2"
          ? pixelPair(toPixels ?? animations.get(frame, "TO"))
          : scalePair(animations.get(frame, "TO"))
      if (!["0", "1", "2", "3", "4"].includes(type ?? "") || !from || !to) return []
      const duration = Math.max(0, Number(animations.get(frame, "DURATION")) || 0)
      const delay = Math.max(0, Number(animations.get(frame, "DELAY")) || 0)
      const repeat = Math.max(1, Number(animations.get(frame, "REPEAT_CNT")) || 1)
      const reverse = animations.get(frame, "REPEAT_MODE") === "1"
      const easingValues = (animations.get(frame, "INTPOL") ?? "0")
        .split(",").map((value) => Number(value.trim()) || 0)
      const parsed = {
        type: type === "0"
          ? "opacity" as const
          : type === "1"
            ? "rotate" as const
            : type === "2"
              ? "translate" as const
              : "scale" as const,
        start: parallel ? 0 : start,
        duration,
        delay,
        repeat,
        reverse,
        relative: type === "2" && fromPixels === undefined && toPixels === undefined,
        easing: [easingValues[0] ?? 0, easingValues[1] ?? easingValues[0] ?? 0] as const,
        from,
        to,
      }
      if (!parallel) start += delay + animationDuration(parsed)
      return [parsed]
    })
    if (frames.length || particles.length) result.set(styleID, { frames, particles, parallel })
  }
  return result
}

export const parseLegacyScaleAnimation = parseLegacyAnimation

function legacyAnimationPair(
  animation: LegacyAnimation | undefined,
  styleID: string | undefined,
  elapsed: number,
  type: "opacity" | "translate" | "scale" | "rotate",
  relativeSize?: Pick<Rect, "width" | "height">,
): readonly [number, number] | undefined {
  const effect = styleID ? animation?.get(styleID) : undefined
  const frames = effect?.frames
  if (!frames?.length) return
  const total = Math.max(...frames.map((frame) => frame.start + frame.delay + animationDuration(frame)))
  if (elapsed > total) return
  const relativeValue = (
    frame: LegacyAnimationFrame,
    value: readonly [number, number],
  ): readonly [number, number] => frame.relative && relativeSize
    ? [value[0] * relativeSize.width / 100, value[1] * relativeSize.height / 100]
    : value
  const valueAt = (frame: LegacyAnimationFrame): readonly [number, number] => {
    const start = frame.start + frame.delay
    const duration = animationDuration(frame)
    if (elapsed < start) return relativeValue(frame, frame.from)
    if (elapsed > start + duration) return relativeValue(frame, frame.reverse ? frame.from : frame.to)
    let progress = duration ? (elapsed - start) / duration : 1
    if (progress < 1 && frame.repeat > 1) progress = (progress * frame.repeat) % 1
    if (frame.reverse) {
      progress *= 2
      if (progress > 1) progress = 2 - progress
    }
    const x = animationEasing(frame.easing[0], progress)
    const y = animationEasing(frame.easing[1], progress)
    return relativeValue(frame, [
      frame.from[0] + (frame.to[0] - frame.from[0]) * x,
      frame.from[1] + (frame.to[1] - frame.from[1]) * y,
    ])
  }
  const matching = frames.filter((frame) => frame.type === type)
  if (effect?.parallel && matching.length) {
    const multiply = type === "scale" || type === "opacity"
    return matching.reduce<readonly [number, number]>((combined, frame) => {
      const value = valueAt(frame)
      return multiply
        ? [combined[0] * value[0], combined[1] * value[1]]
        : [combined[0] + value[0], combined[1] + value[1]]
    }, multiply ? [1, 1] : [0, 0])
  }
  let previous: (typeof frames)[number] | undefined
  for (const frame of matching) {
    const start = frame.start + frame.delay
    const duration = animationDuration(frame)
    const end = start + duration
    if (elapsed < start) return previous
      ? relativeValue(previous, previous.reverse ? previous.from : previous.to)
      : relativeValue(frame, frame.from)
    if (elapsed <= end) return valueAt(frame)
    previous = frame
  }
  return previous ? relativeValue(previous, previous.reverse ? previous.from : previous.to) : undefined
}

export function legacyAnimationScale(
  animation: LegacyAnimation | undefined,
  styleID: string | undefined,
  elapsed: number,
): readonly [number, number] | undefined {
  return legacyAnimationPair(animation, styleID, elapsed, "scale")
}

export function legacyAnimationTranslation(
  animation: LegacyAnimation | undefined,
  styleID: string | undefined,
  elapsed: number,
  relativeSize?: Pick<Rect, "width" | "height">,
): readonly [number, number] | undefined {
  return legacyAnimationPair(animation, styleID, elapsed, "translate", relativeSize)
}

export function legacyAnimationOpacity(
  animation: LegacyAnimation | undefined,
  styleID: string | undefined,
  elapsed: number,
): number | undefined {
  return legacyAnimationPair(animation, styleID, elapsed, "opacity")?.[0]
}

export function legacyAnimationRotation(
  animation: LegacyAnimation | undefined,
  styleID: string | undefined,
  elapsed: number,
): number | undefined {
  return legacyAnimationPair(animation, styleID, elapsed, "rotate")?.[0]
}

export function previewStateActive(item: PreviewItem, state: number | undefined): boolean {
  return state !== undefined && stateStyleValue(item.statStyle, state) !== undefined
}

function duplicateKeySignature(item: PreviewItem): string | undefined {
  if (!item.editable || !/^KEY\d+$/i.test(item.section)) return
  const actions = [item.show, item.center, item.up, item.down, item.left, item.right, item.hold]
  if (!actions.some(Boolean)) return
  return [item.rect.x, item.rect.y, item.rect.width, item.rect.height, ...actions].join("\u0000")
}

export function visiblePreviewItems(
  items: readonly PreviewItem[],
  state?: number,
): PreviewItem[] {
  const groups = new Map<string, PreviewItem[]>()
  for (const item of items) {
    const signature = duplicateKeySignature(item)
    if (signature) groups.set(signature, [...(groups.get(signature) ?? []), item])
  }
  const handled = new Set<PreviewItem>()
  const visible: PreviewItem[] = []
  for (const item of items) {
    if (handled.has(item)) continue
    const signature = duplicateKeySignature(item)
    const group = signature ? groups.get(signature) ?? [item] : [item]
    const stateGroup = group.filter((candidate) => candidate.statStyle)
    const fallbackGroup = group.filter((candidate) => !candidate.statStyle)
    if (stateGroup.length && fallbackGroup.length) {
      group.forEach((candidate) => handled.add(candidate))
      const selected = stateGroup.find((candidate) =>
        stateStyleValue(candidate.statStyle, state ?? 0) !== undefined
      ) ?? fallbackGroup[0] ?? stateGroup[0]
      visible.push({
        ...selected,
        sections: group.flatMap((candidate) => candidate.sections),
      })
    } else {
      handled.add(item)
      visible.push(item)
    }
  }
  return visible
}

export function effectivePreviewItem(
  document: IniDocument,
  item: PreviewItem,
  state?: number,
): PreviewItem {
  const tip = stateTipSection(item.statStyle, state)
  if (tip === undefined) return item
  const section = `TIP${tip}`
  const hasTip = document.sections().includes(section)
  const fallbackText = hasTip ? undefined : skinStateFallbackText(state)
  if (fallbackText) {
    return {
      ...item,
      show: fallbackText,
      foreStyle: "",
      foreStyles: [],
      foreOffsets: [],
      positionTypes: [],
      foreAnimStyle: undefined,
      foreAnimStyles: [],
    }
  }
  if (!/^ICON\d+$/i.test(item.section)) {
    const value = (name: string): string | undefined => document.get(section, name)
    const backStyle = value("BACK_STYLE")
    const foreStyle = value("FORE_STYLE")
    const positionType = value("POS_TYPE")
    const foreOffset = value("FORE_OFFSET")
    const foreAnimStyle = value("FORE_ANIM_STYLE")
    const backAnimStyle = value("BACK_ANIM_STYLE")
    const animStyle = value("ANIM_STYLE")
    const center = value("CENTER") ?? item.center
    const down = value("DOWN") ?? (value("CENTER") === undefined ? item.down : center)
    const foreStyles = foreStyle === undefined
      ? item.foreStyles
      : foreStyle.split(",").map((token) => token.trim()).filter(Boolean)
    return {
      ...item,
      show: value("SHOW") ?? item.show,
      center,
      up: value("UP") ?? item.up,
      down,
      left: value("LEFT") ?? item.left,
      right: value("RIGHT") ?? item.right,
      hold: value("HOLD") ?? item.hold,
      holdSymbols: value("HOLDSYM") ?? item.holdSymbols,
      backStyle: backStyle === undefined ? item.backStyle : backStyle.split(",")[0],
      highlightBackStyle: value("HL_BACK_STYLE")?.split(",")[0] ?? item.highlightBackStyle,
      foreStyle: foreStyles[0] ?? "",
      foreStyles,
      foreOffsets: foreOffset === undefined
        ? item.foreOffsets
        : foreOffset.split(";").map(parseOffset),
      positionTypes: positionType === undefined
        ? item.positionTypes
        : positionType.split(",").map((token) => token.trim()).filter(Boolean),
      animStyle: animStyle ?? item.animStyle,
      backAnimStyle: backAnimStyle ?? item.backAnimStyle,
      foreAnimStyle: foreAnimStyle === undefined
        ? item.foreAnimStyle
        : foreAnimStyle.split(",")[0],
      foreAnimStyles: foreAnimStyle === undefined
        ? item.foreAnimStyles
        : foreAnimStyle.split(",").map((token) => token.trim()).filter(Boolean),
    }
  }
  const backStyle = document.get(section, "BACK_STYLE")
  const foreStyle = document.get(section, "FORE_STYLE")
  const positionType = document.get(section, "POS_TYPE")
  const foreStyles = foreStyle === undefined
    ? item.foreStyles
    : foreStyle.split(",").map((token) => token.trim()).filter(Boolean)
  return {
    ...item,
    backStyle: backStyle === undefined ? item.backStyle : backStyle.split(",")[0],
    highlightBackStyle: document.get(section, "HL_BACK_STYLE")?.split(",")[0] ?? item.highlightBackStyle,
    foreStyle: foreStyles[0] ?? "",
    foreStyles,
    positionTypes: positionType === undefined
      ? item.positionTypes
      : positionType.split(",").map((token) => token.trim()).filter(Boolean),
  }
}

export function previewStateImpact(
  document: IniDocument | undefined,
  state: number | undefined,
): { mapped: boolean; resolved: boolean } {
  if (!document || state === undefined) return { mapped: false, resolved: false }
  const tips = document.entries().flatMap(({ key, value }) => {
    if (key !== "STAT_STYLE") return []
    const tip = stateStyleValue(value, state)
    return tip === undefined ? [] : [tip]
  })
  if (!tips.length) return { mapped: false, resolved: false }
  const sections = new Set(document.sections())
  return {
    mapped: true,
    resolved: Boolean(skinStateFallbackText(state)) || tips.some((tip) => sections.has(`TIP${tip}`)),
  }
}

export function animationSequenceForKey(
  animation: BdaAnimation | undefined,
  item: PreviewItem,
): BdaAnimationSequence | undefined {
  if (!animation) return
  const target = bdaTargetForKey(animation, item)
  if (target) {
    const sequence = animation.bindings.get(target)
    return animation.sequences.get(sequence ?? target) ?? animation.sequences.get(target.replace(/^KEY_/, ""))
  }
  if (animation.sequences.size === 1) return animation.sequences.values().next().value
}

function bdaTargetForKey(animation: BdaAnimation, item: PreviewItem): string | undefined {
  const candidates = [item.section, item.center, item.down, `KEY_${item.center}`]
    .map((value) => value.trim().toUpperCase()).filter(Boolean)
  const exact = animation.targets.find((value) => candidates.includes(value.toUpperCase()))
  if (exact) return exact
  const main = /^[A-Z]$/i.test(item.center.trim())
  const semantic = main ? "MAIN_KEY" : "FUNCTION_KEY"
  return animation.targets.find((value) => value.toUpperCase() === semantic)
}

export function bdaAnimationBindingsForKey(
  animation: BdaAnimation | undefined,
  item: PreviewItem,
  event = 1,
): BdaAnimationBinding[] {
  if (!animation) return []
  const target = bdaTargetForKey(animation, item)
  return target ? (animation.targetBindings.get(target) ?? []).filter((binding) => binding.event === event) : []
}

function bdaBindingEffects(animation: BdaAnimation, binding: BdaAnimationBinding): BdaAnimationEffect[] {
  const effect = animation.effects.get(`${binding.kind}:${binding.key}`)
  if (!effect) return []
  if (effect.kind !== "group") return [effect]
  return effect.items.flatMap((item) => {
    const child = animation.effects.get(`${item.kind}:${item.key}`)
    return child ? [child] : []
  })
}

function bdaEffectDuration(effect: BdaAnimationEffect): number {
  if (effect.kind === "emitter") return Math.max(
    effect.duration * 1000,
    effect.totalNumber / Math.max(0.1, effect.birthRate) * 1000 + effect.life[1],
  )
  if (["alpha", "scale", "shift", "rotate"].includes(effect.kind)) {
    const transform = effect as BdaTransformAnimation
    return transform.delay + transform.duration * Math.max(1, transform.repeatCount) * (transform.repeatMode === 1 ? 2 : 1)
  }
  if (effect.kind === "image") return effect.sequence.frames.reduce((sum, frame) => sum + Math.max(16, frame.duration ?? 100), 0)
  return 0
}

type BdaTransformState = {
  scale?: readonly [number, number]
  translation?: readonly [number, number]
  rotation?: number
  opacity?: number
}

function bdaTransforms(
  animation: BdaAnimation | undefined,
  item: PreviewItem,
  elapsed: number,
  scope: "back" | "fore",
): BdaTransformState {
  if (!animation || elapsed < 0) return {}
  const result: BdaTransformState = {}
  const accepts = (binding: BdaAnimationBinding) => binding.scope === 2 || binding.scope === (scope === "back" ? 1 : 0)
  for (const binding of bdaAnimationBindingsForKey(animation, item).filter(accepts)) {
    for (const effect of bdaBindingEffects(animation, binding)) {
      if (!["alpha", "scale", "shift", "rotate"].includes(effect.kind)) continue
      const transform = effect as BdaTransformAnimation
      const start = transform.delay
      const repetitions = Math.max(1, transform.repeatCount)
      const cycles = repetitions * (transform.repeatMode === 1 ? 2 : 1)
      const total = transform.duration * cycles
      if (elapsed < start || elapsed > start + total) continue
      const raw = transform.duration ? (elapsed - start) / transform.duration : cycles
      let progress = raw >= cycles ? (transform.repeatMode === 1 ? 0 : 1) : raw % (transform.repeatMode === 1 ? 2 : 1)
      if (transform.repeatMode === 1 && progress > 1) progress = 2 - progress
      progress = animationEasing(transform.interpolation, Math.max(0, Math.min(1, progress)))
      // ponytail: random protobuf ranges use their midpoint for a stable editor preview.
      const midpoint = (range: readonly [number, number]) => (range[0] + range[1]) / 2
      const value = (axis: 0 | 1) => midpoint(transform.from[axis]) + (midpoint(transform.to[axis]) - midpoint(transform.from[axis])) * progress
      if (transform.kind === "alpha") result.opacity = value(0) / 255
      else if (transform.kind === "scale") result.scale = [value(0) / 100, value(1) / 100]
      else if (transform.kind === "rotate") result.rotation = value(0)
      else result.translation = transform.relative
        ? [value(0) * item.rect.width / 100, value(1) * item.rect.height / 100]
        : [value(0), value(1)]
    }
  }
  return result
}

export function bdaParticleEmitter(effect: BdaEmitterAnimation): LegacyParticleEmitter {
  const [left, top, right, bottom] = effect.emitRegion
  const region: [number, number, number, number] = left === 0 && top === 0 && right === 0 && bottom === 0
    ? [0, 0, 1, 1]
    : [left, top, right - left, bottom - top]
  return {
    images: effect.resources.map((item) => item.resourceID),
    life: effect.life,
    emitRegion: region,
    totalNumber: Math.max(1, effect.totalNumber),
    birthRate: Math.max(0.1, effect.birthRate),
    velocity: effect.velocity,
    velocityDirection: effect.velocityDirection,
    acceleration: effect.acceleration,
    accelerationDirection: effect.accelerationDirection,
    initialScale: effect.scale,
    scaleSpeed: effect.scaleSpeed,
    initialRotation: effect.rotation,
    rotationSpeed: effect.spin,
    initialAlpha: effect.alpha,
    alphaSpeed: effect.alphaSpeed,
  }
}

export function previewBackground(theme: "light" | "dark"): string {
  return theme === "dark" ? "#1c1c1e" : "#d1d4da"
}

export function previewSurfaceColor(theme: "light" | "dark", transparent: boolean): string | undefined {
  return transparent ? undefined : previewBackground(theme)
}

export function isFullPanelPreviewItem(
  item: Pick<PreviewItem, "rect">,
  panelWidth: number,
  panelHeight: number,
): boolean {
  return item.rect.x <= 0 && item.rect.y <= 0 &&
    item.rect.x + item.rect.width >= panelWidth &&
    item.rect.y + item.rect.height >= panelHeight
}

export function previewDrawOrder(
  items: readonly PreviewItem[],
  panelWidth: number,
  panelHeight: number,
  topSection?: string,
): PreviewItem[] {
  const layer = (item: PreviewItem) => item.section === topSection
    ? 2
    : isFullPanelPreviewItem(item, panelWidth, panelHeight) ? 0 : 1
  return [...items].sort((left, right) => layer(left) - layer(right))
}

export function shouldDrawItemBackground(
  item: PreviewItem,
  panelStyle: string,
  panelWidth: number,
  panelHeight: number,
): boolean {
  return !(item.backStyle === panelStyle && isFullPanelPreviewItem(item, panelWidth, panelHeight))
}

export function previewHitItem(
  items: readonly PreviewItem[],
  point: { x: number; y: number },
  mode: "edit" | "preview",
  panelWidth: number,
  panelHeight: number,
  state?: number,
): PreviewItem | undefined {
  let best: PreviewItem | undefined
  let fallback: PreviewItem | undefined
  for (const item of [...visiblePreviewItems(items, state)].reverse()) {
    if (!item.editable) continue
    const target = previewHitRect(item, mode)
    if (
      point.x < target.x ||
      point.x > target.x + target.width ||
      point.y < target.y ||
      point.y > target.y + target.height
    ) continue
    if (isFullPanelPreviewItem(item, panelWidth, panelHeight)) {
      fallback ??= item
      continue
    }
    const area = item.rect.width * item.rect.height
    const bestArea = best ? best.rect.width * best.rect.height : Infinity
    if (area < bestArea) best = item
  }
  return best ?? fallback
}

export function effectivePreviewHitItem(
  document: IniDocument,
  items: readonly PreviewItem[],
  point: { x: number; y: number },
  mode: "edit" | "preview",
  panelWidth: number,
  panelHeight: number,
  state?: number,
): PreviewItem | undefined {
  const item = previewHitItem(items, point, mode, panelWidth, panelHeight, state)
  if (!item || mode === "edit") return item
  return effectivePreviewItem(document, item, state)
}

export function previewSelectionVisible(mode: "edit" | "preview", selected: boolean): boolean {
  return mode === "edit" && selected
}

export function previewFallbackText(
  item: PreviewItem,
  mode: "edit" | "preview",
  hasForeground: boolean,
): string {
  return !hasForeground && item.section?.startsWith("LIST:") ? item.show : ""
}

export function foregroundLayerRect(
  key: Rect,
  source: [number, number, number, number] | undefined,
  offset?: [number, number],
): Rect {
  if (!source || !offset) return key
  const [, , width, height] = source
  return {
    x: key.x + (key.width - width) / 2 + offset[0],
    y: key.y + (key.height - height) / 2 + offset[1],
    width,
    height,
  }
}

export function foregroundTextPoint(rect: Rect, offset?: [number, number]): { x: number; y: number } {
  return {
    x: rect.x + rect.width / 2 + (offset?.[0] ?? 0),
    y: rect.y + rect.height / 2 + (offset?.[1] ?? 0),
  }
}

export function phoneForegroundVisual(visual: Visual | undefined): Visual | undefined {
  if (!visual?.image || !visual.source) return
  const { color: _, ...imageVisual } = visual
  return imageVisual
}

export function phoneForegroundLayers(visuals: Array<Visual | undefined>): Array<Visual | undefined> {
  return visuals.map(phoneForegroundVisual)
}

export function isAdditiveSelection(
  event: Pick<MouseEvent, "metaKey" | "ctrlKey" | "shiftKey">,
): boolean {
  return event.metaKey || event.ctrlKey || event.shiftKey
}

export function isTouchLongPress(pointerType: string, duration: number, distance: number): boolean {
  return pointerType === "touch" && duration >= 450 && distance <= 12
}

export function previewHitRect(item: PreviewItem, mode: "edit" | "preview"): Rect {
  if (mode === "edit" || !item.touchRect) return item.rect
  const x = Math.min(item.rect.x, item.touchRect.x)
  const y = Math.min(item.rect.y, item.touchRect.y)
  const right = Math.max(item.rect.x + item.rect.width, item.touchRect.x + item.touchRect.width)
  const bottom = Math.max(item.rect.y + item.rect.height, item.touchRect.y + item.touchRect.height)
  return { x, y, width: right - x, height: bottom - y }
}

function parseRect(value: string | undefined): Rect | undefined {
  const parts = value?.split(",").map(Number)
  if (!parts || parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) return
  const [x, y, width, height] = parts
  if (width <= 0 || height <= 0) return
  return { x, y, width, height }
}

function parseOffset(value: string | undefined): [number, number] | undefined {
  const parts = value?.split(",").map(Number)
  if (!parts || parts.length !== 2 || parts.some((part) => !Number.isFinite(part))) return
  return parts as [number, number]
}

// gen.ini 的 OFFSET 段既有 POS=x,y 也有 R_POS=x,y（部分 Android 皮肤）。
// 两者同义，解析时优先 POS、回退 R_POS。
export function offsetFromSection(document: IniDocument | undefined, section: string): [number, number] | undefined {
  if (!document) return
  return parseOffset(
    document.get(section, "POS") ?? document.get(section, "R_POS"),
  )
}

function itemFromSection(document: IniDocument, section: string): PreviewItem | undefined {
  const rect = parseRect(document.get(section, "VIEW_RECT"))
  if (!rect) return
  const value = (name: string) => document.get(section, name) ?? ""
  const foreStyles = value("FORE_STYLE").split(",").map((token) => token.trim()).filter(Boolean)
  const center = value("CENTER")
  const down = value("DOWN") || center
  return {
    section,
    sections: [section],
    rect,
    touchRect: parseRect(document.get(section, "TOUCH_RECT")),
    editable: true,
    show: value("SHOW"),
    center,
    up: value("UP"),
    down,
    left: value("LEFT"),
    right: value("RIGHT"),
    hold: value("HOLD"),
    holdSymbols: value("HOLDSYM"),
    backStyle: value("BACK_STYLE").split(",")[0],
    highlightBackStyle: value("HL_BACK_STYLE").split(",")[0] || undefined,
    foreStyle: foreStyles[0] ?? "",
    foreStyles,
    foreOffsets: value("FORE_OFFSET").split(";").map(parseOffset),
    positionTypes: value("POS_TYPE").split(",").map((token) => token.trim()).filter(Boolean),
    statStyle: value("STAT_STYLE"),
    animStyle: value("ANIM_STYLE"),
    backAnimStyle: value("BACK_ANIM_STYLE"),
    foreAnimStyle: value("FORE_ANIM_STYLE").split(",")[0],
    foreAnimStyles: value("FORE_ANIM_STYLE").split(",").map((token) => token.trim()).filter(Boolean),
  }
}

function listItems(document: IniDocument, defaults?: IniDocument): PreviewItem[] {
  const value = (name: string) => document.get("LIST", name) ?? defaults?.get("LIST", name)
  const type = value("TYPE")?.trim()
  // TYPE=2 is the runtime scrolling-list container used by some Android skins.
  // It is not a static key/candidate strip and must not be painted over the
  // keyboard in the preview. TYPE=0, missing TYPE, and other legacy values
  // remain renderable for compatibility with existing skins.
  if (type === "2") return []
  const cell = value("CELL_SIZE")?.split(",").map(Number)
  const position = value("POS")?.split(",").map(Number)
  const count = Number(value("LIST_NUM"))
  const names = value("NAMES")?.trim().split(/\s+/) ?? []
  if (
    !cell || cell.length !== 2 || cell.some((value) => !Number.isFinite(value) || value <= 0) ||
    !position || position.length !== 2 || position.some((value) => !Number.isFinite(value)) ||
    !Number.isFinite(count) || count <= 0
  ) return []
  const horizontal = value("LIST_ORDER")?.trim() === "1"
  const foreStyles = value("FORE_STYLE")?.split(",").map((token) => token.trim()).filter(Boolean) ?? []
  // 每个标点只负责文字渲染，不可单独选中
  const cells: PreviewItem[] = names.slice(0, count).map((show, index) => ({
    section: `LIST:${index + 1}`,
    sections: [`LIST:${index + 1}`],
    rect: {
      x: position[0] + (horizontal ? index * cell[0] : 0),
      y: position[1] + (horizontal ? 0 : index * cell[1]),
      width: cell[0],
      height: cell[1],
    },
    editable: false,
    show,
    center: "",
    up: "",
    down: "",
    left: "",
    right: "",
    hold: "",
    holdSymbols: "",
    backStyle: value("CELL_STYLE")?.split(",")[0] ?? "",
    foreStyle: foreStyles[0] ?? "",
    foreStyles,
    foreOffsets: [],
    positionTypes: [],
    statStyle: "",
    foreAnimStyles: [],
  }))
  // 整个候选栏是一个可选中按钮
  const bar: PreviewItem = {
    section: "LIST",
    sections: ["LIST"],
    rect: {
      x: position[0],
      y: position[1],
      width: cell[0] * (horizontal ? count : 1),
      height: cell[1] * (horizontal ? 1 : count),
    },
    editable: true,
    show: "",
    center: "",
    up: "",
    down: "",
    left: "",
    right: "",
    hold: "",
    holdSymbols: "",
    backStyle: value("BACK_STYLE")?.split(",")[0] ?? "",
    foreStyle: "",
    foreStyles: [],
    foreOffsets: [],
    positionTypes: [],
    statStyle: "",
    foreAnimStyles: [],
  }
  return [bar, ...cells]
}

export function dynamicToolbarRect(
  document: IniDocument,
  panelWidth: number,
  panelHeight: number,
): Rect | undefined {
  const section = document.sections().find((name) =>
    /^ICON\d+$/i.test(name) && document.get(name, "KEY")?.trim().toUpperCase() === "F14"
  )
  if (!section) return
  const size = document.get(section, "SIZE")?.split(",").map(Number)
  const position = document.get(section, "POS")?.split(",").map(Number)
  const anchor = Number(document.get(section, "ANCHOR_TYPE"))
  if (
    !size || size.length !== 2 || size.some((value) => !Number.isFinite(value) || value <= 0) ||
    !position || position.length !== 2 || position.some((value) => !Number.isFinite(value))
  ) return
  const column = ((anchor - 1) % 3) + 1
  const row = Math.ceil(anchor / 3)
  return {
    x: (column === 2 ? panelWidth / 2 : column === 3 ? panelWidth : 0) + position[0],
    y: (row === 2 ? panelHeight / 2 : row === 3 ? panelHeight : 0) + position[1],
    width: size[0],
    height: size[1],
  }
}

export function previewItems(
  document: IniDocument,
  panelWidth = DEFAULT_PANEL_WIDTH,
  panelHeight = DEFAULT_CANDIDATE_HEIGHT,
  defaults?: IniDocument,
  persistentOnly = false,
): PreviewItem[] {
  const list = persistentOnly ? [] : listItems(document, defaults)
  const real = document.sections().flatMap((section) => {
    if (/^TIP\d+$/i.test(section)) return []
    if (persistentOnly !== (document.get(section, "PERSIST") === "2")) return []
    const item = itemFromSection(document, section)
    return item ? [item] : []
  })
  if (real.length) return [...real, ...list]

  const sections = document.sections().filter((section) =>
    /^(CAND|SWITCH|PANEL|LIST|MORE|ICON\d+|TIP\d+)$/.test(section),
  )
  if (!sections.length) return list
  return [...sections.flatMap((section) => {
    if (
      /^TIP\d+$/.test(section) ||
      persistentOnly !== (document.get(section, "PERSIST") === "2")
    ) return []
    const backStyle = document.get(section, "BACK_STYLE")?.split(",")[0] ?? ""
    const foreStyles = document.get(section, "FORE_STYLE")?.split(",").map((token) => token.trim()).filter(Boolean) ?? []
    const foreStyle = foreStyles[0] ?? ""
    if (section !== "CAND" && (!document.get(section, "SIZE") || (!backStyle && !foreStyle))) return []
    const size = document.get(section, "SIZE")?.split(",").map(Number)
    const width = section === "CAND" ? panelWidth : size?.[0] ?? 0
    const height = section === "CAND" ? panelHeight : size?.[1] ?? 0
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return []
    const position = document.get(section, "POS")?.split(",").map(Number) ?? [0, 0]
    const anchor = Number(document.get(section, "ANCHOR_TYPE"))
    const xAnchor = ((anchor - 1) % 3) + 1
    const yAnchor = Math.ceil(anchor / 3)
    const x = section === "CAND"
      ? 0
      : xAnchor === 2
        ? panelWidth / 2 + (position[0] || 0)
        : xAnchor === 3
          ? panelWidth + (position[0] || 0)
          : position[0] || 0
    const y = section === "CAND"
      ? 0
      : yAnchor === 2
        ? panelHeight / 2 + (position[1] || 0)
        : yAnchor === 3
          ? panelHeight + (position[1] || 0)
          : position[1] || 0
    const fixed = document.get(section, "FIX_SIZE")?.split(",").map(Number)
    const foreRect = fixed?.length === 2 && fixed.every(Number.isFinite)
      ? {
          x: x + (width - fixed[0]) / 2,
          y: y + (height - fixed[1]) / 2,
          width: fixed[0],
          height: fixed[1],
        }
      : undefined
    const value = (name: string) => document.get(section, name) ?? ""
    return [{
      section,
      sections: [section],
      rect: { x, y, width, height },
      foreRect,
      editable: false,
      show: document.get(section, "SHOW") ?? "",
      center: value("KEY") || value("CENTER"),
      up: value("UP"),
      down: value("DOWN"),
      left: value("LEFT"),
      right: value("RIGHT"),
      hold: value("HOLD"),
      holdSymbols: value("HOLDSYM"),
      backStyle,
      highlightBackStyle: value("HL_BACK_STYLE").split(",")[0] || undefined,
      foreStyle,
      foreStyles,
      foreOffsets: [],
      positionTypes: document.get(section, "POS_TYPE")?.split(",").map((token) => token.trim()).filter(Boolean) ?? [],
      statStyle: value("STAT_STYLE"),
      animStyle: value("ANIM_STYLE"),
      foreAnimStyles: [],
    }]
  }), ...list]
}

export function previewContentVerticalBounds(
  items: readonly Pick<PreviewItem, "rect">[],
  panelWidth: number,
  panelHeight: number,
): { top: number; height: number } {
  const content = items.filter(({ rect }) =>
    rect.width > 0 && rect.height > 0 &&
    !(rect.x <= 0 && rect.y <= 0 && rect.width >= panelWidth && rect.height >= panelHeight),
  )
  if (!content.length) return { top: 0, height: panelHeight }
  const top = Math.max(0, Math.min(...content.map(({ rect }) => rect.y)))
  const bottom = Math.max(...content.map(({ rect }) => rect.y + rect.height))
  return { top, height: Math.max(1, bottom - top) }
}

export class Preview {
  private readonly canvas: HTMLCanvasElement
  private readonly onEvent: (event: PreviewEvent) => void
  private readonly onSelect: (sections: string[]) => void
  private readonly onMove: (sections: string[], deltaX: number, deltaY: number) => void
  private readonly toolbarSlots: boolean
  private document?: IniDocument
  private defaults?: IniDocument
  private offsets?: IniDocument
  private resolver?: VisualResolver
  private panelStyle = ""
  private panelWidth = DEFAULT_PANEL_WIDTH
  private panelHeight = DEFAULT_PANEL_HEIGHT
  private theme: "light" | "dark" = "light"
  private transparent = false
  private keys: PreviewItem[] = []
  private mode: "edit" | "preview" = "edit"
  private editTool: "select" | "move" = "select"
  private editDrag?: {
    pointerId: number
    startX: number
    startY: number
    original: Map<string, Rect>
  }
  private editTouch?: {
    pointerId: number
    pointerType: string
    key: PreviewItem
    startX: number
    startY: number
    clientX: number
    clientY: number
    startedAt: number
    longPress: boolean
    longPressTimer?: number
  }
  private active?: {
    pointerId: number
    key: PreviewItem
    startX: number
    startY: number
    startedAt: number
    clearOnHold: boolean
    holdTriggered: boolean
    holdTimer?: number
  }
  private selected = new Set<string>()
  private mobileMultiSelect = false
  private selectionAnchor?: string
  private guides = false
  private guidesOverlay?: SVGSVGElement
  private skinState?: number
  private persistentOnly = false
  private animation?: BdaAnimation
  private animationVisual?: { key: PreviewItem; visual: Visual }
  private animationTimer?: number
  private bdaAnimationState?: { key: PreviewItem; startedAt: number }
  private bdaAnimationTimer?: number
  private legacyAnimation?: LegacyAnimation
  private legacyAnimationState?: { key: PreviewItem; startedAt: number }
  private legacyAnimationTimer?: number
  private particlePreview?: LegacyParticleEmitter
  private panelAnimationStyle = ""
  private legacyPanelAnimationStartedAt = 0
  private legacyPanelAnimationTimer?: number
  private drawID = 0
  private drawQueued = false
  private readonly resizeObserver: ResizeObserver

  constructor(
    canvas: HTMLCanvasElement,
    onEvent: (event: PreviewEvent) => void,
    onSelect: (sections: string[]) => void,
    toolbarSlots = false,
    onMove: (sections: string[], deltaX: number, deltaY: number) => void = () => {},
  ) {
    this.canvas = canvas
    this.onEvent = onEvent
    this.onSelect = onSelect
    this.onMove = onMove
    this.toolbarSlots = toolbarSlots
    canvas.addEventListener("pointerdown", (event) => this.pointerDown(event))
    canvas.addEventListener("pointermove", (event) => this.pointerMove(event))
    canvas.addEventListener("pointerup", (event) => this.pointerUp(event))
    canvas.addEventListener("contextmenu", (event) => event.preventDefault())
    canvas.addEventListener("pointercancel", () => {
      if (this.active?.holdTimer !== undefined) window.clearTimeout(this.active.holdTimer)
      this.active = undefined
      this.cancelEditTouch()
      this.cancelEditDrag()
      this.updateCursor()
      void this.draw()
    })
    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(canvas)
  }

  setMode(mode: "edit" | "preview"): void {
    this.mode = mode
    this.mobileMultiSelect = false
    if (this.active?.holdTimer !== undefined) window.clearTimeout(this.active.holdTimer)
    this.active = undefined
    this.cancelEditTouch()
    this.cancelEditDrag()
    this.updateCursor()
    void this.draw()
  }

  cancelPointerInteraction(): void {
    if (this.active?.holdTimer !== undefined) window.clearTimeout(this.active.holdTimer)
    this.active = undefined
    this.cancelEditTouch()
    this.cancelEditDrag()
    this.updateCursor()
    void this.draw()
  }

  setEditTool(tool: "select" | "move"): void {
    this.editTool = tool
    this.cancelEditTouch()
    this.cancelEditDrag()
    this.updateCursor()
    void this.draw()
  }

  setSelected(sections: readonly string[]): void {
    this.selected = new Set(sections)
    if (!sections.length) this.mobileMultiSelect = false
    void this.draw()
  }

  setResolver(resolver?: VisualResolver): void {
    this.resolver = resolver
    void this.draw()
  }

  setOffsets(offsets?: IniDocument): void {
    this.offsets = offsets
    void this.draw()
  }

  setDefaults(defaults?: IniDocument): void {
    this.defaults = defaults
    this.keys = this.document
      ? previewItems(
          this.document,
          this.panelWidth,
          this.panelHeight,
          defaults,
          this.persistentOnly,
        )
      : []
    this.fitCanvas()
    void this.draw()
  }

  setTheme(theme: "light" | "dark"): void {
    this.theme = theme
    void this.draw()
  }

  setTransparent(transparent: boolean): void {
    this.transparent = transparent
    void this.draw()
  }

  setGuides(enabled: boolean): void {
    this.guides = enabled
    this.guidesOverlay?.toggleAttribute("hidden", !enabled)
    void this.draw()
  }

  setSkinState(state?: number): void {
    this.skinState = state
    void this.draw()
  }

  setPersistentOnly(persistentOnly: boolean): void {
    if (this.persistentOnly === persistentOnly) return
    this.persistentOnly = persistentOnly
    this.keys = this.document
      ? previewItems(
          this.document,
          this.panelWidth,
          this.panelHeight,
          this.defaults,
          persistentOnly,
        )
      : []
    void this.draw()
  }

  expandSections(sections: readonly string[]): string[] {
    const requested = new Set(sections)
    return visiblePreviewItems(this.keys, this.skinState).flatMap((item) =>
      item.sections.some((section) => requested.has(section)) ? item.sections : []
    )
  }

  setAnimation(animation?: BdaAnimation): void {
    this.animation = animation
    this.animationVisual = undefined
    this.bdaAnimationState = undefined
    if (this.animationTimer) window.clearTimeout(this.animationTimer)
    if (this.bdaAnimationTimer) window.cancelAnimationFrame(this.bdaAnimationTimer)
    void this.draw()
  }

  setLegacyAnimation(animation?: LegacyAnimation): void {
    this.legacyAnimation = animation
    this.legacyAnimationState = undefined
    if (this.legacyAnimationTimer) window.cancelAnimationFrame(this.legacyAnimationTimer)
    this.restartLegacyPanelAnimation()
    void this.draw()
  }

  setParticlePreview(emitter?: LegacyParticleEmitter): void {
    this.particlePreview = emitter
    this.restartLegacyPanelAnimation()
    void this.draw()
  }

  setPanel(styleID: string, width: number, height: number, animationStyle = ""): void {
    const animationChanged = this.panelAnimationStyle !== animationStyle
    this.panelStyle = styleID
    this.panelAnimationStyle = animationStyle
    this.panelWidth = width
    this.panelHeight = height
    this.keys = this.document
      ? previewItems(this.document, width, height, this.defaults, this.persistentOnly)
      : []
    this.fitCanvas()
    if (animationChanged) this.restartLegacyPanelAnimation()
    void this.draw()
  }

  setDocument(document?: IniDocument): void {
    this.document = document
    this.keys = document
      ? previewItems(
          document,
          this.panelWidth,
          this.panelHeight,
          this.defaults,
          this.persistentOnly,
        )
      : []
    const available = new Set(this.keys.map((key) => key.section))
    this.selected = new Set([...this.selected].filter((section) => available.has(section)))
    this.fitCanvas()
    void this.draw()
  }

  private point(event: Pick<MouseEvent, "clientX" | "clientY">): { x: number; y: number } {
    const bounds = this.canvas.getBoundingClientRect()
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * this.panelWidth,
      y: ((event.clientY - bounds.top) / bounds.height) * this.panelHeight,
    }
  }

  private snapThreshold(): { x: number; y: number } {
    const bounds = this.canvas.getBoundingClientRect()
    return {
      x: bounds.width ? 8 * this.panelWidth / bounds.width : 0,
      y: bounds.height ? 8 * this.panelHeight / bounds.height : 0,
    }
  }

  logicalSize(): { width: number; height: number } {
    return { width: this.panelWidth, height: this.panelHeight }
  }

  snapPoint(point: { x: number; y: number }): { x: number; y: number } {
    return snapPointToRects(
      point,
      visiblePreviewItems(this.keys, this.skinState)
        .filter((key) => key.editable || this.toolbarSlots)
        .map((key) => key.rect),
      this.snapThreshold(),
    )
  }

  private dragDelta(point: { x: number; y: number }): { x: number; y: number } {
    if (!this.editDrag) return { x: 0, y: 0 }
    return snapRectDelta(
      [...this.editDrag.original.values()],
      visiblePreviewItems(this.keys, this.skinState)
        .filter((key) => key.editable && !this.editDrag?.original.has(key.section))
        .map((key) => key.rect),
      {
        x: Math.round(point.x - this.editDrag.startX),
        y: Math.round(point.y - this.editDrag.startY),
      },
      this.snapThreshold(),
    )
  }

  private hit(point: { x: number; y: number }): PreviewItem | undefined {
    return this.document
      ? effectivePreviewHitItem(
        this.document,
        this.keys,
        point,
        this.mode,
        this.panelWidth,
        this.panelHeight,
        this.skinState,
      )
      : previewHitItem(
        this.keys,
        point,
        this.mode,
        this.panelWidth,
        this.panelHeight,
        this.skinState,
      )
  }

  private itemSelected(item: PreviewItem): boolean {
    return item.sections.some((section) => this.selected.has(section))
  }

  private pointerDown(event: PointerEvent): void {
    const point = this.point(event)
    const key = this.hit(point)
    if (!key) {
      if (this.mode === "edit") {
        this.selected.clear()
        this.mobileMultiSelect = false
        this.onSelect([])
        void this.draw()
      }
      return
    }
    if (this.mode === "edit" && this.editTool === "select" && event.pointerType === "touch") {
      this.editTouch = {
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        key,
        startX: point.x,
        startY: point.y,
        clientX: event.clientX,
        clientY: event.clientY,
        startedAt: Date.now(),
        longPress: false,
      }
      const touch = this.editTouch
      touch.longPressTimer = window.setTimeout(() => {
        if (this.editTouch !== touch) return
        touch.longPress = true
        this.mobileMultiSelect = true
        this.selected.add(key.section)
        this.selectionAnchor = key.section
        this.onSelect([...this.selected])
        void this.draw()
      }, 450)
      this.canvas.setPointerCapture(event.pointerId)
      return
    }
    if (this.mode === "edit") {
      this.selectKey(key, event)
      if (this.editTool === "move" && !key.section.startsWith("LIST")) {
        const selectedSections = new Set(
          visiblePreviewItems(this.keys, this.skinState)
            .filter((item) => this.itemSelected(item) && !item.section.startsWith("LIST"))
            .flatMap((item) => item.sections),
        )
        const selectedKeys = this.keys.filter((item) => selectedSections.has(item.section))
        this.editDrag = {
          pointerId: event.pointerId,
          startX: point.x,
          startY: point.y,
          original: new Map(selectedKeys.map((item) => [item.section, { ...item.rect }])),
        }
        event.stopPropagation()
        this.canvas.setPointerCapture(event.pointerId)
        this.canvas.style.cursor = "grabbing"
      }
      void this.draw()
      return
    }
    this.canvas.setPointerCapture(event.pointerId)
    this.active = {
      pointerId: event.pointerId,
      key,
      startX: point.x,
      startY: point.y,
      startedAt: Date.now(),
      clearOnHold: key.center.trim() === "F36",
      holdTriggered: false,
    }
    if (this.active.clearOnHold) {
      const active = this.active
      active.holdTimer = window.setTimeout(() => {
        if (this.active !== active) return
        active.holdTriggered = true
        this.onEvent({ section: key.section, direction: "hold", code: "F48" })
      }, 450)
    }
    void this.playAnimation(key)
    void this.draw()
  }

  private selectKey(
    key: PreviewItem,
    event: Pick<PointerEvent, "metaKey" | "ctrlKey" | "shiftKey">,
  ): void {
    if (this.mode === "edit" && event.shiftKey && this.selectionAnchor) {
      const sections = visiblePreviewItems(this.keys, this.skinState)
        .filter((item) => item.editable).map((item) => item.section)
      const from = sections.indexOf(this.selectionAnchor)
      const to = sections.indexOf(key.section)
      if (from >= 0 && to >= 0) {
        this.selected = new Set(sections.slice(Math.min(from, to), Math.max(from, to) + 1))
      }
    } else if (this.mode === "edit" && isAdditiveSelection(event)) {
      if (this.itemSelected(key)) key.sections.forEach((section) => this.selected.delete(section))
      else this.selected.add(key.section)
    } else if (!this.itemSelected(key) || this.mode === "preview") {
      this.selected = new Set([key.section])
    } else if (this.mode === "edit" && this.editTool === "select") {
      key.sections.forEach((section) => this.selected.delete(section))
    }
    if (this.mobileMultiSelect && !this.selected.size) this.mobileMultiSelect = false
    if (this.mode === "edit" && !event.shiftKey) this.selectionAnchor = key.section
    this.onSelect([...this.selected])
  }

  private pointerMove(event: PointerEvent): void {
    if (this.active && event.pointerId === this.active.pointerId) {
      const point = this.point(event)
      if (Math.max(
        Math.abs(point.x - this.active.startX),
        Math.abs(point.y - this.active.startY),
      ) >= 20 && this.active.holdTimer !== undefined) {
        window.clearTimeout(this.active.holdTimer)
        this.active.holdTimer = undefined
      }
    }
    if (this.editTouch?.pointerId === event.pointerId && !this.editTouch.longPress) {
      const distance = Math.hypot(event.clientX - this.editTouch.clientX, event.clientY - this.editTouch.clientY)
      if (distance > 12 && this.editTouch.longPressTimer !== undefined) {
        window.clearTimeout(this.editTouch.longPressTimer)
        this.editTouch.longPressTimer = undefined
      }
    }
    if (!this.editDrag || this.editDrag.pointerId !== event.pointerId) return
    const point = this.point(event)
    const { x: dx, y: dy } = this.dragDelta(point)
    for (const key of this.keys) {
      const original = this.editDrag.original.get(key.section)
      if (original) key.rect = { ...original, x: original.x + dx, y: original.y + dy }
    }
    void this.draw()
  }

  private async playAnimation(key: PreviewItem): Promise<void> {
    this.playLegacyAnimation(key)
    const effects = this.animation
      ? bdaAnimationBindingsForKey(this.animation, key).flatMap((binding) => bdaBindingEffects(this.animation!, binding))
      : []
    const duration = Math.max(0, ...effects.map(bdaEffectDuration))
    if (duration) {
      if (this.bdaAnimationTimer) window.cancelAnimationFrame(this.bdaAnimationTimer)
      this.bdaAnimationState = { key, startedAt: Date.now() }
      const tick = () => {
        const elapsed = this.bdaAnimationState ? Date.now() - this.bdaAnimationState.startedAt : duration + 1
        void this.draw()
        if (elapsed <= duration) this.bdaAnimationTimer = window.requestAnimationFrame(tick)
        else {
          this.bdaAnimationState = undefined
          this.bdaAnimationTimer = undefined
          void this.draw()
        }
      }
      this.bdaAnimationTimer = window.requestAnimationFrame(tick)
    }
    const sequence = animationSequenceForKey(this.animation, key)
    if (!sequence?.frames.length || !this.resolver?.resolveResource) return
    if (this.animationTimer) window.clearTimeout(this.animationTimer)
    const play = async (index: number) => {
      const frame = sequence.frames[index]
      if (!frame) {
        this.animationVisual = undefined
        void this.draw()
        return
      }
      if (frame.resourceID === undefined) return void play(index + 1)
      const visual = await this.resolver?.resolveResource?.(frame.resourceID)
      if (!visual) return
      this.animationVisual = { key, visual }
      void this.draw()
      this.animationTimer = window.setTimeout(() => void play(index + 1), Math.max(16, frame.duration ?? 0))
    }
    await play(0)
  }

  private restartLegacyPanelAnimation(): void {
    if (this.legacyPanelAnimationTimer) window.cancelAnimationFrame(this.legacyPanelAnimationTimer)
    this.legacyPanelAnimationTimer = undefined
    const particles = this.particlePreview
      ? [this.particlePreview]
      : this.legacyAnimation?.get(this.panelAnimationStyle)?.particles ?? []
    if (!particles.length) {
      this.legacyPanelAnimationStartedAt = 0
      return
    }
    this.legacyPanelAnimationStartedAt = Date.now()
    const duration = Math.max(...particles.map((particle) =>
      particle.totalNumber / particle.birthRate * 1000 + Math.max(...particle.life)
    ))
    const tick = () => {
      const elapsed = Date.now() - this.legacyPanelAnimationStartedAt
      void this.draw()
      if (elapsed <= duration) this.legacyPanelAnimationTimer = window.requestAnimationFrame(tick)
      else this.legacyPanelAnimationTimer = undefined
    }
    this.legacyPanelAnimationTimer = window.requestAnimationFrame(tick)
  }

  private playLegacyAnimation(key: PreviewItem): void {
    const styles = [key.animStyle, key.backAnimStyle, ...key.foreAnimStyles].filter(Boolean) as string[]
    const duration = Math.max(0, ...styles.flatMap((style) => {
      const frames = this.legacyAnimation?.get(style)?.frames
      return frames?.length
        ? [Math.max(...frames.map((frame) => frame.start + frame.delay + animationDuration(frame)))]
        : []
    }))
    if (!duration) return
    if (this.legacyAnimationTimer) window.cancelAnimationFrame(this.legacyAnimationTimer)
    this.legacyAnimationState = { key, startedAt: Date.now() }
    const tick = () => {
      const elapsed = Date.now() - this.legacyAnimationState!.startedAt
      if (elapsed >= duration) this.legacyAnimationState = undefined
      void this.draw()
      if (elapsed < duration) this.legacyAnimationTimer = window.requestAnimationFrame(tick)
    }
    tick()
  }

  private pointerUp(event: PointerEvent): void {
    if (this.editTouch?.pointerId === event.pointerId) {
      const touch = this.editTouch
      this.cancelEditTouch()
      const distance = Math.hypot(event.clientX - touch.clientX, event.clientY - touch.clientY)
      const longPress = touch.longPress || isTouchLongPress(
        touch.pointerType,
        Date.now() - touch.startedAt,
        distance,
      )
      if (longPress) {
        this.mobileMultiSelect = true
        this.selected.add(touch.key.section)
        this.selectionAnchor = touch.key.section
        this.onSelect([...this.selected])
      } else {
        this.selectKey(touch.key, {
          metaKey: event.metaKey,
          ctrlKey: event.ctrlKey || this.mobileMultiSelect,
          shiftKey: event.shiftKey,
        })
      }
      void this.draw()
      return
    }
    if (this.editDrag?.pointerId === event.pointerId) {
      const drag = this.editDrag
      const point = this.point(event)
      const { x: dx, y: dy } = this.dragDelta(point)
      this.editDrag = undefined
      this.updateCursor()
      if (dx || dy) {
        this.onMove([...drag.original.keys()], dx, dy)
      }
      else void this.draw()
      return
    }
    if (!this.active) return
    const point = this.point(event)
    const active = this.active
    const { key, startX, startY, startedAt } = active
    if (active.holdTimer !== undefined) window.clearTimeout(active.holdTimer)
    if (active.holdTriggered) {
      this.active = undefined
      void this.draw()
      return
    }
    const dx = point.x - startX
    const dy = point.y - startY
    const clearOnHold = key.center.trim() === "F36"
    const direction = gestureDirection(
      dx,
      dy,
      Date.now() - startedAt,
      Boolean(key.hold || key.holdSymbols) || clearOnHold,
    )
    const code = direction === "hold" && clearOnHold ? "F48" : key[direction]
    this.onEvent({
      section: key.section,
      direction,
      code,
      holdSymbols: direction === "hold" ? key.holdSymbols : undefined,
    })
    const release = () => {
      if (this.active !== active) return
      this.active = undefined
      void this.draw()
    }
    if (event.pointerType === "touch") globalThis.setTimeout(release, 80)
    else release()
  }

  private cancelEditDrag(): void {
    if (!this.editDrag) return
    for (const key of this.keys) {
      const original = this.editDrag.original.get(key.section)
      if (original) key.rect = original
    }
    this.editDrag = undefined
  }

  private cancelEditTouch(): void {
    if (this.editTouch?.longPressTimer !== undefined) window.clearTimeout(this.editTouch.longPressTimer)
    this.editTouch = undefined
  }

  private updateCursor(): void {
    this.canvas.style.cursor = this.mode === "preview" ? "pointer" : this.editTool === "move" ? "grab" : "default"
  }

  private fitCanvas(): void {
    const width = Math.ceil(this.panelWidth)
    const height = Math.ceil(this.panelHeight)
    const changed = this.canvas.dataset.logicalWidth !== String(width) ||
      this.canvas.dataset.logicalHeight !== String(height)
    this.canvas.dataset.logicalWidth = String(width)
    this.canvas.dataset.logicalHeight = String(height)
    this.canvas.style.aspectRatio = `${width} / ${height}`
    if (changed) {
      this.canvas.width = width
      this.canvas.height = height
    }
    requestAnimationFrame(() => this.resize())
  }

  resize(): void {
    const bounds = this.canvas.getBoundingClientRect()
    if (!bounds.width || !bounds.height) return
    const ratio = devicePixelRatio || 1
    const width = Math.max(1, Math.round(bounds.width * ratio))
    const height = Math.max(1, Math.round(bounds.height * ratio))
    if (this.canvas.width === width && this.canvas.height === height) return
    this.canvas.width = width
    this.canvas.height = height
    void this.draw()
  }

  private drawGuides(keys: readonly PreviewItem[]): void {
    if (!this.guides) {
      this.guidesOverlay?.toggleAttribute("hidden", true)
      return
    }
    const overlay = this.guidesOverlay ?? document.createElementNS("http://www.w3.org/2000/svg", "svg")
    if (!this.guidesOverlay) {
      overlay.classList.add("preview-guides")
      overlay.setAttribute("aria-hidden", "true")
      this.canvas.insertAdjacentElement("afterend", overlay)
      this.guidesOverlay = overlay
    }
    overlay.toggleAttribute("hidden", false)
    overlay.setAttribute("viewBox", `0 0 ${this.panelWidth} ${this.panelHeight}`)
    overlay.style.setProperty("--preview-guide-font-size", `${15 * this.panelWidth / DEFAULT_PANEL_WIDTH}px`)
    overlay.replaceChildren(...keys.map((key) => {
      const group = document.createElementNS("http://www.w3.org/2000/svg", "g")
      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect")
      const text = document.createElementNS("http://www.w3.org/2000/svg", "text")
      group.classList.toggle("selected", this.itemSelected(key))
      rect.setAttribute("x", String(key.rect.x))
      rect.setAttribute("y", String(key.rect.y))
      rect.setAttribute("width", String(key.rect.width))
      rect.setAttribute("height", String(key.rect.height))
      text.setAttribute("x", String(key.rect.x + 4))
      text.setAttribute("y", String(key.rect.y + 4))
      text.textContent = key.section
      group.append(rect, text)
      return group
    }))
  }

  private drawNineSlice(
    context: CanvasRenderingContext2D,
    visual: Visual,
    destination: Rect,
  ): void {
    drawNineSliceImage(context, visual, destination)
  }

  private drawVisual(
    context: CanvasRenderingContext2D,
    visual: Visual | undefined,
    destination: Rect,
    stretch: boolean,
  ): void {
    if (!visual) return
    if (visual.color && !isTransparentColor(visual.color)) {
      context.fillStyle = visual.color
      context.fillRect(destination.x, destination.y, destination.width, destination.height)
    }
    if (!visual.image || !visual.source) {
      this.strokeBorder(context, visual, destination)
      return
    }
    if (stretch && visual.inner) {
      this.drawNineSlice(context, visual, destination)
    } else {
      const [sx, sy, sw, sh] = visual.source
      if (stretch) {
        context.drawImage(
          visual.image,
          sx,
          sy,
          sw,
          sh,
          destination.x,
          destination.y,
          destination.width,
          destination.height,
        )
      } else {
        context.drawImage(
          visual.image,
          sx,
          sy,
          sw,
          sh,
          destination.x + (destination.width - sw) / 2,
          destination.y + (destination.height - sh) / 2,
          sw,
          sh,
        )
      }
    }
    // BDA filterColor 是叠加在图片之上的颜色滤镜（tint），在图片之后绘制。
    if (visual.filterColor && !isTransparentColor(visual.filterColor)) {
      context.save()
      context.globalAlpha = this.filterAlpha(visual.filterColor)
      context.fillStyle = this.filterRgb(visual.filterColor)
      context.fillRect(destination.x, destination.y, destination.width, destination.height)
      context.restore()
    }
    this.strokeBorder(context, visual, destination)
  }

  private filterRgb(color: string): string {
    const match = color.match(/^rgba\(([^,]+),([^,]+),([^,]+),/)
    return match ? `rgb(${match[1]}, ${match[2]}, ${match[3]})` : color
  }

  private filterAlpha(color: string): number {
    const match = color.match(/rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/)
    return match ? Math.max(0, Math.min(1, Number(match[1]))) : 1
  }

  private strokeBorder(
    context: CanvasRenderingContext2D,
    visual: Visual,
    destination: Rect,
  ): void {
    if (!visual.borderColor || isTransparentColor(visual.borderColor)) return
    context.strokeStyle = visual.borderColor
    context.lineWidth = 1
    context.strokeRect(destination.x + 0.5, destination.y + 0.5, destination.width - 1, destination.height - 1)
  }

  private withTransform(
    context: CanvasRenderingContext2D,
    rect: Rect,
    scale: readonly [number, number] | undefined,
    translation: readonly [number, number] | undefined,
    rotation: number | undefined,
    opacity: number | undefined,
    draw: () => void,
  ): void {
    if (!scale && !translation && rotation === undefined && opacity === undefined) {
      draw()
      return
    }
    const centerX = rect.x + rect.width / 2
    const centerY = rect.y + rect.height / 2
    context.save()
    if (opacity !== undefined) context.globalAlpha *= opacity
    if (translation) context.translate(translation[0], translation[1])
    if (scale || rotation !== undefined) {
      context.translate(centerX, centerY)
      if (rotation !== undefined) context.rotate(rotation * Math.PI / 180)
      if (scale) context.scale(scale[0], scale[1])
      context.translate(-centerX, -centerY)
    }
    draw()
    context.restore()
  }

  private draw(): void {
    if (this.drawQueued) return
    this.drawQueued = true
    queueMicrotask(() => {
      this.drawQueued = false
      void this.render()
    })
  }

  private async render(): Promise<void> {
    const drawID = ++this.drawID
    const panelAnimationElapsed = this.legacyPanelAnimationStartedAt
      ? Date.now() - this.legacyPanelAnimationStartedAt
      : -1
    const particles = this.particlePreview
      ? [this.particlePreview]
      : this.legacyAnimation?.get(this.panelAnimationStyle)?.particles ?? []
    const particleFrames = panelAnimationElapsed < 0
      ? []
      : particles.flatMap((particle) =>
          legacyParticleFrames(particle, panelAnimationElapsed, this.panelWidth, this.panelHeight)
        )
    const bdaAnimationElapsed = this.bdaAnimationState ? Date.now() - this.bdaAnimationState.startedAt : -1
    const bdaParticleFrames = this.animation && this.bdaAnimationState && bdaAnimationElapsed >= 0
      ? bdaAnimationBindingsForKey(this.animation, this.bdaAnimationState.key).flatMap((binding) =>
          bdaBindingEffects(this.animation!, binding).flatMap((effect) => {
            if (effect.kind !== "emitter" || !effect.resources.length) return []
            return legacyParticleFrames(
              bdaParticleEmitter(effect), bdaAnimationElapsed,
              this.bdaAnimationState!.key.rect.width, this.bdaAnimationState!.key.rect.height,
            ).map((frame) => ({
              ...frame,
              x: frame.x + this.bdaAnimationState!.key.rect.x,
              y: frame.y + this.bdaAnimationState!.key.rect.y,
            }))
          })
        )
      : []
    const allParticleFrames = [...particleFrames, ...bdaParticleFrames]
    const particleStyleIDs = [...new Set(allParticleFrames.map((frame) => frame.styleID))]
    const keys = previewDrawOrder(visiblePreviewItems(this.keys, this.skinState)
      .map((key) =>
        this.document ? effectivePreviewItem(this.document, key, this.skinState ?? 0) : key,
      ), this.panelWidth, this.panelHeight, this.legacyAnimationState?.key.section)
    const [panel, visuals, toolbarImages, particleVisuals] = await Promise.all([
      this.resolver?.resolve(this.panelStyle, false),
      Promise.all(keys.map(async (key) => {
        const highlighted = this.active?.key.section === key.section ||
          this.legacyAnimationState?.key.section === key.section
        return {
          back: await this.resolver?.resolve(
            highlighted ? key.highlightBackStyle ?? key.backStyle : key.backStyle,
            highlighted,
          ),
          fore: await Promise.all(
            key.foreStyles.map((style) => this.resolver?.resolve(style, highlighted)),
          ),
          text: this.resolver?.resolveText(key.foreStyles.join(","), highlighted),
          styleTexts: key.foreStyles.map((style) =>
            this.resolver?.resolveStyleText?.(style, highlighted)
          ),
        }
      })),
      this.toolbarSlots && !this.persistentOnly
        ? this.resolver?.resolveToolbarImages() ?? Promise.resolve([])
        : Promise.resolve([]),
      Promise.all(particleStyleIDs.map(async (styleID) =>
        await this.resolver?.resolveResource?.(styleID) ?? this.resolver?.resolve(styleID, false)
      )),
    ])
    if (drawID !== this.drawID) return
    const context = this.canvas.getContext("2d")
    if (!context) return
    context.setTransform(1, 0, 0, 1, 0, 0)
    context.clearRect(0, 0, this.canvas.width, this.canvas.height)
    context.setTransform(this.canvas.width / this.panelWidth, 0, 0, this.canvas.height / this.panelHeight, 0, 0)
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = "high"
    const surfaceColor = previewSurfaceColor(this.theme, this.transparent)
    if (surfaceColor) {
      context.fillStyle = surfaceColor
      context.fillRect(0, 0, this.panelWidth, this.panelHeight)
    }
    this.drawVisual(
      context,
      panel,
      { x: 0, y: 0, width: this.panelWidth, height: this.panelHeight },
      true,
    )

    for (const [index, key] of keys.entries()) {
      const active = this.active?.key.section === key.section
      const selected = previewSelectionVisible(this.mode, this.itemSelected(key))
      const animationElapsed = this.legacyAnimationState?.key.section === key.section
        ? Date.now() - this.legacyAnimationState.startedAt
        : -1
      const activeBdaElapsed = this.bdaAnimationState?.key.section === key.section ? bdaAnimationElapsed : -1
      const bdaBack = bdaTransforms(this.animation, key, activeBdaElapsed, "back")
      const bdaFore = bdaTransforms(this.animation, key, activeBdaElapsed, "fore")
      const backAnimationStyle = key.backAnimStyle || key.animStyle
      const backScale = animationElapsed >= 0
        ? legacyAnimationScale(this.legacyAnimation, backAnimationStyle, animationElapsed)
        : bdaBack.scale
      const backTranslation = animationElapsed >= 0
        ? legacyAnimationTranslation(this.legacyAnimation, backAnimationStyle, animationElapsed, key.rect)
        : bdaBack.translation
      const backRotation = animationElapsed >= 0
        ? legacyAnimationRotation(this.legacyAnimation, backAnimationStyle, animationElapsed)
        : bdaBack.rotation
      const backOpacity = animationElapsed >= 0
        ? legacyAnimationOpacity(this.legacyAnimation, backAnimationStyle, animationElapsed)
        : bdaBack.opacity
      const foregrounds = phoneForegroundLayers(visuals[index].fore)
      const styleTexts = visuals[index].styleTexts
      const hasForeground = foregrounds.some(Boolean) || styleTexts.some(Boolean)
      if (shouldDrawItemBackground(key, this.panelStyle, this.panelWidth, this.panelHeight)) {
        this.withTransform(context, key.rect, backScale, backTranslation, backRotation, backOpacity, () => {
          this.drawVisual(context, visuals[index].back, key.rect, true)
        })
      }
      for (const [layer, fore] of foregrounds.entries()) {
        const animationStyle = key.foreAnimStyles[layer] || key.foreAnimStyle || key.animStyle
        const foreScale = animationElapsed >= 0
          ? legacyAnimationScale(this.legacyAnimation, animationStyle, animationElapsed)
          : bdaFore.scale
        const foreTranslation = animationElapsed >= 0
          ? legacyAnimationTranslation(this.legacyAnimation, animationStyle, animationElapsed, key.rect)
          : bdaFore.translation
        const foreRotation = animationElapsed >= 0
          ? legacyAnimationRotation(this.legacyAnimation, animationStyle, animationElapsed)
          : bdaFore.rotation
        const foreOpacity = animationElapsed >= 0
          ? legacyAnimationOpacity(this.legacyAnimation, animationStyle, animationElapsed)
          : bdaFore.opacity
        const offset = key.foreOffsets[layer] ?? offsetFromSection(
          this.offsets,
          `OFFSET${key.positionTypes[layer] ?? ""}`,
        )
        const destination = key.foreRect ?? foregroundLayerRect(key.rect, fore?.source, offset)
        this.withTransform(context, key.rect, foreScale, foreTranslation, foreRotation, foreOpacity, () => {
          this.drawVisual(context, fore, destination, false)
        })
      }

      for (const [layer, styleText] of styleTexts.entries()) {
        if (!styleText || foregrounds[layer]) continue
        const animationStyle = key.foreAnimStyles[layer] || key.foreAnimStyle || key.animStyle
        const foreScale = animationElapsed >= 0
          ? legacyAnimationScale(this.legacyAnimation, animationStyle, animationElapsed)
          : bdaFore.scale
        const foreTranslation = animationElapsed >= 0
          ? legacyAnimationTranslation(this.legacyAnimation, animationStyle, animationElapsed, key.rect)
          : bdaFore.translation
        const foreRotation = animationElapsed >= 0
          ? legacyAnimationRotation(this.legacyAnimation, animationStyle, animationElapsed)
          : bdaFore.rotation
        const foreOpacity = animationElapsed >= 0
          ? legacyAnimationOpacity(this.legacyAnimation, animationStyle, animationElapsed)
          : bdaFore.opacity
        const offset = key.foreOffsets[layer] ?? offsetFromSection(
          this.offsets,
          `OFFSET${key.positionTypes[layer] ?? ""}`,
        )
        const point = foregroundTextPoint(key.foreRect ?? key.rect, offset)
        this.withTransform(context, key.rect, foreScale, foreTranslation, foreRotation, foreOpacity, () => {
          this.drawStyleText(context, styleText, point)
        })
      }

      if (selected) {
        context.strokeStyle = "#087ff5"
        context.lineWidth = 4
        context.strokeRect(key.rect.x + 2, key.rect.y + 2, key.rect.width - 4, key.rect.height - 4)
      }

      const textVisual: TextVisual | undefined = visuals[index].text
      context.fillStyle = textVisual?.color ?? (this.theme === "dark" ? "#f5f5f7" : "#17191c")
      const fontSize = textVisual?.fontSize ?? Math.max(18, Math.min(42, key.rect.height * 0.25))
      const fontWeight = textVisual?.fontWeight ? `${textVisual.fontWeight} ` : ""
      context.font = `${fontWeight}${fontSize}px ${canvasFontFamily(textVisual?.fontName)}`
      context.textAlign = "center"
      context.textBaseline = "middle"
      const fallbackText = previewFallbackText(key, this.mode, hasForeground)
      if (fallbackText) {
        const animationStyle = key.foreAnimStyle || key.animStyle
        const foreScale = animationElapsed >= 0
          ? legacyAnimationScale(this.legacyAnimation, animationStyle, animationElapsed)
          : bdaFore.scale
        const foreTranslation = animationElapsed >= 0
          ? legacyAnimationTranslation(this.legacyAnimation, animationStyle, animationElapsed, key.rect)
          : bdaFore.translation
        const foreRotation = animationElapsed >= 0
          ? legacyAnimationRotation(this.legacyAnimation, animationStyle, animationElapsed)
          : bdaFore.rotation
        const foreOpacity = animationElapsed >= 0
          ? legacyAnimationOpacity(this.legacyAnimation, animationStyle, animationElapsed)
          : bdaFore.opacity
        this.withTransform(context, key.rect, foreScale, foreTranslation, foreRotation, foreOpacity, () => {
          context.fillText(
            fallbackText,
            key.rect.x + key.rect.width / 2,
            key.rect.y + key.rect.height / 2,
          )
        })
      }

    }

    const particleVisualByStyle = new Map(
      particleStyleIDs.map((styleID, index) => [styleID, particleVisuals[index]]),
    )
    for (const frame of allParticleFrames) {
      const visual = particleVisualByStyle.get(frame.styleID)
      if (!visual?.image || !visual.source || frame.scale <= 0 || frame.opacity <= 0) continue
      const [sx, sy, width, height] = visual.source
      context.save()
      context.globalAlpha *= frame.opacity
      context.translate(frame.x, frame.y)
      context.rotate(frame.rotation * Math.PI / 180)
      context.scale(frame.scale, frame.scale)
      context.drawImage(visual.image, sx, sy, width, height, -width / 2, -height / 2, width, height)
      context.restore()
    }

    if (this.animationVisual) {
      this.drawVisual(context, this.animationVisual.visual, this.animationVisual.key.rect, false)
    }

    const toolbarRect = this.document
      ? dynamicToolbarRect(this.document, this.panelWidth, this.panelHeight)
      : undefined
    if (toolbarRect && toolbarImages.length) {
      const slotWidth = toolbarRect.width / toolbarImages.length
      toolbarImages.forEach((visual, index) => {
        this.drawVisual(context, visual, {
          x: toolbarRect.x + index * slotWidth,
          y: toolbarRect.y,
          width: slotWidth,
          height: toolbarRect.height,
        }, false)
      })
    }

    this.drawGuides(visiblePreviewItems(this.keys, this.skinState))
  }

  private drawStyleText(
    context: CanvasRenderingContext2D,
    visual: StyleTextVisual,
    point: { x: number; y: number },
  ): void {
    context.fillStyle = visual.color ?? (this.theme === "dark" ? "#f5f5f7" : "#17191c")
    const weight = visual.fontWeight ? `${visual.fontWeight} ` : ""
    context.font = `${weight}${visual.fontSize ?? 24}px ${canvasFontFamily(visual.fontName)}`
    context.textAlign = "center"
    context.textBaseline = "middle"
    context.fillText(visual.text, point.x, point.y)
  }
}
