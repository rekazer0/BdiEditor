import type {
  BdaAnimation,
  BdaAnimationEffect,
  BdaAnimationFrame,
  BdaAnimationBinding,
  BdaEmitterAnimation,
  BdaTransformAnimation,
} from "./bda.ts"
import { type Visual, type VisualResolver } from "./atlas.ts"
import { element } from "./dom-element.ts"

export type BdaAnimationEditorOptions = {
  animation: BdaAnimation
  resolver?: VisualResolver
  editable: boolean
  onDesignWidth: (value: number) => void
  onAnimationFrame: (sequence: string, frame: number, property: "resourceID" | "duration", value: string | number) => void
  onAnimationEffect: (key: string, property: string, value: string | number | boolean) => void
  onPickAnimationResource: (sequence: string, frame: number) => void
}

function section(label: string, className = "bda-animation-section"): HTMLElement {
  const node = element("section", className)
  node.dataset.inspectorGroupLabel = label
  return node
}

function heading(title: string, detail?: string): HTMLElement {
  const header = element("header", "bda-card-heading")
  const strong = element("strong")
  strong.textContent = title
  header.append(strong)
  if (detail) {
    const small = element("small")
    small.textContent = detail
    header.append(small)
  }
  return header
}

function field(label: string, control: HTMLElement): HTMLElement {
  const row = element("label", "ui-field bda-animation-field")
  const caption = element("span")
  caption.textContent = label
  row.append(caption, control)
  return row
}

function numberField(
  label: string,
  value: number,
  editable: boolean,
  onChange: (value: number) => void,
  step = 1,
): HTMLElement {
  const input = element("input") as HTMLInputElement
  input.type = "number"
  input.step = String(step)
  input.value = String(value)
  input.disabled = !editable
  input.addEventListener("change", () => {
    const next = Number(input.value)
    if (Number.isFinite(next)) onChange(next)
  })
  return field(label, input)
}

function textField(label: string, value: string, editable: boolean, onChange: (value: string) => void): HTMLElement {
  const input = element("input") as HTMLInputElement
  input.value = value
  input.disabled = !editable
  input.addEventListener("change", () => onChange(input.value))
  return field(label, input)
}

function booleanField(label: string, value: boolean, editable: boolean, onChange: (value: boolean) => void): HTMLElement {
  const input = element("input") as HTMLInputElement
  input.type = "checkbox"
  input.role = "switch"
  input.checked = value
  input.disabled = !editable
  input.addEventListener("change", () => onChange(input.checked))
  return field(label, input)
}

function rangeFields(
  label: string,
  values: readonly [number, number],
  editable: boolean,
  onChange: (index: 0 | 1, value: number) => void,
): HTMLElement {
  const row = element("div", "bda-animation-range")
  row.append(
    numberField(`${label}最小`, values[0], editable, (value) => onChange(0, value)),
    numberField(`${label}最大`, values[1], editable, (value) => onChange(1, value)),
  )
  return row
}

function animationDurations(frames: BdaAnimationFrame[]): number[] {
  return frames.map((frame) => Math.max(16, frame.duration ?? 100))
}

function drawVisual(canvas: HTMLCanvasElement, visual: Visual | undefined): void {
  if (!visual) return
  const bounds = canvas.getBoundingClientRect()
  const width = Math.max(1, Math.round(bounds.width || 128))
  const height = Math.max(1, Math.round(bounds.height || 76))
  const scale = Math.max(1, window.devicePixelRatio || 1)
  canvas.width = width * scale
  canvas.height = height * scale
  const context = canvas.getContext("2d")!
  context.setTransform(scale, 0, 0, scale, 0, 0)
  context.clearRect(0, 0, width, height)
  if (visual.color) {
    context.fillStyle = visual.color
    context.fillRect(0, 0, width, height)
  }
  if (visual.image) {
    const source = visual.source ?? [0, 0, visual.image.width, visual.image.height]
    const ratio = Math.min(width / source[2], height / source[3])
    const imageWidth = source[2] * ratio
    const imageHeight = source[3] * ratio
    context.drawImage(visual.image, source[0], source[1], source[2], source[3], (width - imageWidth) / 2, (height - imageHeight) / 2, imageWidth, imageHeight)
  }
}

function animationPlayer(frames: BdaAnimationFrame[], resolver: VisualResolver | undefined): HTMLElement {
  const player = element("section", "bda-animation-player")
  const canvas = element("canvas")
  const controls = element("div")
  const play = element("button")
  const status = element("output")
  const durations = animationDurations(frames)
  let timer: number | undefined
  let run = 0
  const show = (index: number) => {
    status.value = frames.length ? `第 ${index + 1} / ${frames.length} 帧` : "没有动画帧"
    const resourceID = frames[index]?.resourceID
    if (!resourceID) return
    void resolver?.resolveResource?.(resourceID).then((visual) => { if (canvas.isConnected) drawVisual(canvas, visual) }).catch(() => {})
  }
  const stop = (label: string) => {
    run += 1
    if (timer !== undefined) window.clearTimeout(timer)
    timer = undefined
    play.textContent = label
  }
  play.type = "button"
  play.textContent = "播放预览"
  play.disabled = !frames.length
  play.addEventListener("click", () => {
    if (!frames.length) return
    if (timer !== undefined) return stop("播放预览")
    const currentRun = ++run
    let index = 0
    play.textContent = "停止"
    const advance = () => {
      if (currentRun !== run || !player.isConnected) return
      show(index)
      timer = window.setTimeout(() => {
        index += 1
        if (index < frames.length) advance()
        else stop("重新播放")
      }, durations[index])
    }
    advance()
  })
  show(0)
  controls.append(play, status)
  player.append(canvas, controls)
  return player
}

function effectID(effect: BdaAnimationEffect): string {
  return `${effect.kind}:${effect.key}`
}

function commonFields(effect: BdaAnimationEffect, editable: boolean, onChange: BdaAnimationEditorOptions["onAnimationEffect"]): HTMLElement {
  const grid = element("div", "bda-animation-controls")
  const update = (property: string, value: string | number | boolean) => onChange(effectID(effect), property, value)
  grid.append(numberField("重复次数", effect.repeatCount, editable, (value) => update("repeatCount", value)))
  if ("repeatMode" in effect) grid.append(numberField("重复模式", effect.repeatMode, editable, (value) => update("repeatMode", value)))
  if (effect.kind === "group") grid.append(numberField("延迟（毫秒）", effect.delay, editable, (value) => update("delay", value)))
  if ("duration" in effect) grid.append(numberField("时长（毫秒）", effect.duration, editable, (value) => update("duration", value)))
  grid.append(booleanField("结束后移除", effect.removeOnFinish, editable, (value) => update("removeOnFinish", value)))
  return grid
}

function transformFields(effect: BdaTransformAnimation, editable: boolean, onChange: BdaAnimationEditorOptions["onAnimationEffect"]): HTMLElement {
  const grid = commonFields(effect, editable, onChange)
  const update = (property: string, value: number) => onChange(effectID(effect), property, value)
  grid.append(numberField("插值方式", effect.interpolation, editable, (value) => update("interpolation", value)))
  if (effect.kind === "alpha" || effect.kind === "rotate") {
    grid.append(
      rangeFields("起始值", effect.from[0], editable, (index, value) => update(index ? "fromMax" : "fromMin", value)),
      rangeFields("结束值", effect.to[0], editable, (index, value) => update(index ? "toMax" : "toMin", value)),
    )
  } else {
    for (const [axis, index] of [["X", 0], ["Y", 1]] as const) {
      grid.append(
        rangeFields(`起始${axis}`, effect.from[index], editable, (bound, value) => update(`from${axis}${bound ? "Max" : "Min"}`, value)),
        rangeFields(`结束${axis}`, effect.to[index], editable, (bound, value) => update(`to${axis}${bound ? "Max" : "Min"}`, value)),
      )
    }
  }
  return grid
}

function effectEditor(effect: BdaAnimationEffect, options: BdaAnimationEditorOptions): HTMLElement {
  const card = section(effect.key, "bda-animation-card")
  const detail = effect.kind === "group" ? `${effect.kind} · ${effect.items.length} 个子效果` : effect.kind
  card.append(heading(effect.key, detail))
  const update = (property: string, value: string | number | boolean) => options.onAnimationEffect(effectID(effect), property, value)
  if (effect.kind === "alpha" || effect.kind === "scale" || effect.kind === "shift" || effect.kind === "rotate") {
    card.append(transformFields(effect, options.editable, options.onAnimationEffect))
  } else {
    card.append(commonFields(effect, options.editable, options.onAnimationEffect))
    if (effect.kind === "group") card.append(...effect.items.map((item) => textField("子效果", `${item.kind}:${item.key}`, false, () => {})))
    else if (effect.kind === "image") {
      card.append(
        booleanField("循环播放", effect.loopForever, options.editable, (value) => update("loopForever", value)),
        numberField("起始重复帧", effect.startRepeatFrame, options.editable, (value) => update("startRepeatFrame", value)),
      )
    } else if (effect.kind === "frame" || effect.kind === "lottie" || effect.kind === "video") {
      if (effect.resource) card.append(textField("资源", effect.resource.resourceID, options.editable, (value) => update("resourceID", value)))
      if (effect.startRepeatFrame !== undefined) card.append(numberField("起始重复帧", effect.startRepeatFrame, options.editable, (value) => update("startRepeatFrame", value)))
    } else if (effect.kind === "emitter") {
      const emitter = effect as BdaEmitterAnimation
      card.append(numberField("出生率", emitter.birthRate, options.editable, (value) => update("birthRate", value)))
      card.append(numberField("粒子总数", emitter.totalNumber, options.editable, (value) => update("totalNumber", value)))
    }
  }
  return card
}

function bindingLabel(binding: BdaAnimationBinding): string {
  return `${binding.kind}:${binding.key} · 事件 ${binding.event}${binding.isolated ? " · 独立" : ""}`
}

function targetEditor(target: string, bindings: BdaAnimationBinding[]): HTMLElement {
  const card = section(target, "bda-animation-target")
  card.append(heading(target, `${bindings.length} 个绑定`))
  if (!bindings.length) {
    const empty = element("p", "bda-editor-empty")
    empty.textContent = "没有绑定动效"
    card.append(empty)
  } else {
    for (const binding of bindings) card.append(textField("动效", bindingLabel(binding), false, () => {}))
  }
  return card
}

export function renderBdaAnimationEditor(container: HTMLElement, options: BdaAnimationEditorOptions): void {
  container.replaceChildren()
  const { animation } = options
  const summary = section("动画", "bda-animation-summary")
  summary.append(heading("动画配置", `${animation.targets.length} 个目标 · ${animation.effects.size} 个定义`))
  if (animation.designWidth !== undefined) summary.append(numberField("设计宽度", animation.designWidth, options.editable, options.onDesignWidth))
  container.append(summary)

  if (animation.targets.length) {
    const targets = section("目标", "bda-animation-targets")
    targets.append(heading("触发目标"))
    for (const target of animation.targets) targets.append(targetEditor(target, animation.targetBindings.get(target) ?? []))
    container.append(targets)
  }

  for (const sequence of animation.sequences.values()) {
    const card = section(sequence.name, "bda-animation-card")
    card.append(heading(sequence.name, `${sequence.frames.length} 帧`), animationPlayer(sequence.frames, options.resolver))
    const strip = element("div", "bda-frame-strip")
    sequence.frames.forEach((frame, index) => {
      const item = element("article", "bda-frame-card")
      item.append(heading(`第 ${index + 1} 帧`, frame.resourceID))
      const row = element("div", "bda-frame-row")
      const controls = element("div", "bda-frame-controls")
      if (frame.resourceID !== undefined) {
        const preview = element("button", "bda-frame-resource-button")
        const canvas = element("canvas")
        const caption = element("span")
        preview.type = "button"
        preview.disabled = !options.editable
        preview.setAttribute("aria-label", `更换第 ${index + 1} 帧图片资源`)
        caption.textContent = options.editable ? "点击更换图片" : "图片资源"
        preview.append(canvas, caption)
        preview.addEventListener("click", () => options.onPickAnimationResource(sequence.name, index))
        void options.resolver?.resolveResource?.(frame.resourceID).then((visual) => { if (canvas.isConnected) drawVisual(canvas, visual) }).catch(() => {})
        row.append(preview)
        controls.append(textField("图片资源", frame.resourceID, options.editable, (value) => options.onAnimationFrame(sequence.name, index, "resourceID", value)))
      }
      if (frame.duration !== undefined) controls.append(numberField("时长（毫秒）", frame.duration, options.editable, (value) => options.onAnimationFrame(sequence.name, index, "duration", value)))
      row.append(controls)
      item.append(row)
      strip.append(item)
    })
    card.append(strip)
    container.append(card)
  }

  const effects = section("效果", "bda-animation-effects")
  effects.append(heading("效果定义", `${animation.effects.size} 个`))
  for (const effect of animation.effects.values()) effects.append(effectEditor(effect, options))
  if (animation.effects.size) container.append(effects)
}
