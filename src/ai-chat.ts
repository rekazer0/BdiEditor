import "deep-chat"
import type { DeepChat } from "deep-chat"

export type AiChatRunHooks = {
  signal: AbortSignal
  onTextDelta: (delta: string) => Promise<void>
  onStatus?: (text: string, kind?: "thinking" | "reading" | "editing" | "done") => Promise<void>
  onThinking?: (text: string) => Promise<void>
}

export type AiChatRunResult = {
  fallback: string
  summary?: string
}

export type AiChatRun = (prompt: string, hooks: AiChatRunHooks) => Promise<AiChatRunResult>

export type AiChatController = {
  clear: () => void
  focus: () => void
  setEnabled: (enabled: boolean) => void
  setInput: (text: string) => void
}

type StepKind = "thinking" | "reading" | "editing" | "done" | "error"

type RunStep = { kind: StepKind; text: string }

type RunState = {
  id: string
  bodyId: string
  startedAt: number
  count: number
  steps: RunStep[]
  reasoning: string
  status: "running" | "done" | "stopped" | "error"
  finishedAt?: number
  timer?: ReturnType<typeof setInterval>
}

function stepRow(step: RunStep): HTMLLIElement {
  const item = document.createElement("li")
  item.className = "ai-run-step"
  item.dataset.kind = step.kind
  item.innerHTML = `<span class="ai-run-step-icon">${stepIcon(step.kind)}</span>`
  const label = document.createElement("span")
  label.className = "ai-run-step-text"
  label.textContent = step.text
  item.append(label)
  return item
}

/** 1.4px stroke glyphs, matching the inspector's system symbols. */
function stepIcon(kind: StepKind): string {
  const paths: Record<StepKind, string> = {
    thinking: '<path d="M8 2.6 9.3 6.2 12.9 7.5 9.3 8.8 8 12.4 6.7 8.8 3.1 7.5 6.7 6.2Z"/>',
    reading: '<path d="M4.1 2.7h5.1L12 5.5v7.6a.5.5 0 0 1-.5.5h-7.4a.5.5 0 0 1-.5-.5V3.2a.5.5 0 0 1 .5-.5Z"/><path d="M9.2 2.7v2.8h2.7"/>',
    editing: '<path d="m11.4 2.7 1.9 1.9-7.6 7.6-2.4.5.5-2.4Z"/><path d="m10.2 3.9 1.9 1.9"/>',
    done: '<path d="m3.6 8.4 2.9 2.9 5.9-6.5"/>',
    error: '<circle cx="8" cy="8" r="5.6"/><path d="M8 5.3v3.3M8 10.8h.01"/>',
  }
  return `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[kind]}</svg>`
}

/** Steps arrive as “AI 读取 project.bds…” — the panel already says who is acting. */
function stepText(text: string): string {
  return text.replace(/^AI\s*/, "").trim()
}

function duration(seconds: number): string {
  return seconds >= 60 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${seconds}s`
}

function runMarkup(id: string, bodyId: string): string {
  return `<section class="ai-run" id="${id}" aria-label="AI 处理步骤" data-state="running">`
    + `<button class="ai-run-head" type="button" aria-expanded="true" aria-controls="${bodyId}">`
    + '<span class="ai-run-spark" aria-hidden="true">✦</span>'
    + '<span class="ai-run-label">思考中…</span>'
    + '<span class="ai-run-caret" aria-hidden="true"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m4 6.5 4 4 4-4"/></svg></span>'
    + "</button>"
    + `<div class="ai-run-body" id="${bodyId}">`
    + '<ol class="ai-run-steps"></ol>'
    + '<details class="ai-run-think" hidden><summary>思考过程</summary><div class="ai-run-think-text"></div></details>'
    + "</div></section>"
}

function configureAppearance(chat: DeepChat): void {
  // The Pen design tokens stay symbolic: deep-chat's styles are inline, so a
  // `var()` keeps the conversation following the app theme after a theme switch
  // instead of freezing the light palette at connect time.
  const text = "var(--pen-text, #14161b)"
  const muted = "var(--pen-tertiary, #8c93a1)"
  const secondary = "var(--pen-secondary, #5a6070)"
  const control = "var(--pen-surface, #ffffff)"
  const sunken = "var(--pen-surface-subtle, #f4f5f8)"
  const line = "var(--pen-line, #e6e8ee)"
  const lineStrong = "var(--pen-line-strong, #d2d6df)"
  const accent = "var(--pen-accent, #2f6bff)"
  const onAccent = "var(--pen-on-brand, #ffffff)"
  const ok = "var(--pen-state-ok, #10a15a)"
  const danger = "var(--pen-state-danger, #e5484d)"
  const mono = "var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)"
  const radiusMd = "var(--pen-radius-md, 10px)"
  const radiusSm = "var(--pen-radius-sm, 8px)"
  const radiusPill = "var(--pen-radius-pill, 999px)"

  chat.chatStyle = {
    width: "100%",
    height: "100%",
    border: "0",
    borderRadius: "0",
    backgroundColor: "transparent",
    color: text,
  }
  chat.inputAreaStyle = {
    width: "auto",
    alignSelf: "end",
    margin: "0 14px 32px",
    border: "0",
    backgroundColor: "transparent",
    boxShadow: "none",
  }
  chat.textInput = {
    placeholder: { text: "描述你想要的皮肤效果…", style: { color: muted } },
    characterLimit: 8_000,
    styles: {
      text: { color: text, fontSize: "12.5px", lineHeight: "1.7", padding: "12px 12px 0",
        boxSizing: "border-box", height: "calc(100% - 46px)", overflowY: "auto" },
      container: {
        width: "100%", boxSizing: "border-box", margin: "0",
        height: "var(--ai-input-height, 148px)", minHeight: "128px", maxHeight: "none", overflow: "hidden",
        border: `1px solid ${line}`, borderRadius: radiusMd,
        backgroundColor: sunken, boxShadow: "none",
      },
      focus: { borderColor: accent, boxShadow: `0 0 0 3px color-mix(in srgb, ${accent} 16%, transparent)`, outline: "none" },
    },
  }

  // Everything below lives in deep-chat's shadow root, so it is written here
  // rather than in the stylesheets: the panel keeps its structure, the
  // conversation keeps its voice. The reference is a task timeline — steps and
  // reasoning as quiet left-aligned rows, no chat bubbles around prose.
  chat.auxiliaryStyle = `
    #chat-view { grid-template-rows: minmax(0, 1fr) auto; }
    #messages { min-height: 0; }
    .outer-message-container { padding: 0 14px; }
    .outer-message-container + .outer-message-container { margin-top: 6px; }
    /* The run timeline is injected, so it does not inherit messageStyles — it has
       to shed deep-chat's default grey bubble on its own. */
    .ai-run-holder .message-bubble { max-width: 100%; padding: 0; border: 0;
      border-radius: 0; background: transparent; box-shadow: none; color: ${text}; }

    /* --- empty state ------------------------------------------------------- */
    .intro-panel { display: flex; flex-direction: column; width: 100%; box-sizing: border-box; top: 0;
      bottom: calc(var(--ai-input-height, 148px) + 42px); height: auto; margin: 0;
      overflow-y: auto; align-items: stretch; justify-content: safe center; }
    .ai-welcome { width: 100%; box-sizing: border-box; margin: 0; padding: 16px 14px;
      text-align: left; color: ${text}; }
    .ai-welcome h2 { margin: 0 0 16px; font-size: 14px; font-weight: 500; letter-spacing: -.01em; }
    .ai-suggestions { display: flex; flex-wrap: wrap; gap: 8px; }
    .ai-suggestions button { min-height: 30px; justify-content: flex-start; text-align: left; }
    .ai-suggestions button:focus-visible, .ai-run-head:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px; }
    .ai-suggestions button { display: inline-flex; align-items: center; gap: 0; width: auto;
      max-width: 100%; padding: 5px 10px; font: inherit; font-size: 11.5px; color: ${secondary};
      background: ${sunken}; border: 1px solid transparent; border-radius: ${radiusPill};
      cursor: pointer; transition: background .15s, border-color .15s, color .15s; }
    .ai-suggestions button:hover { border-color: color-mix(in srgb, ${accent} 32%, transparent);
      background: color-mix(in srgb, ${accent} 7%, ${sunken}); color: ${text}; }
    .ai-suggestions button:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px; }

    /* --- run timeline: “✦ 思考中 · 12s · 6 个步骤” -------------------------- */
    .ai-run { margin: 2px 0 6px; }
    .ai-run-head { display: inline-flex; align-items: center; gap: 8px; max-width: 100%;
      margin: 0; padding: 3px 0; border: 0; background: none; font: inherit;
      color: ${muted}; cursor: pointer; text-align: left; }
    .ai-run-head:hover { color: ${secondary}; }
    .ai-run-head:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px; border-radius: 4px; }
    .ai-run-spark { display: grid; place-items: center; width: 16px; height: 16px; font-size: 11px; line-height: 1; }
    .ai-run-label { font-size: 12px; font-variant-numeric: tabular-nums; }
    .ai-run-caret { display: grid; place-items: center; width: 13px; height: 13px;
      transition: transform .16s ease; }
    .ai-run-caret svg { width: 13px; height: 13px; }
    .ai-run-head[aria-expanded="false"] .ai-run-caret { transform: rotate(-90deg); }
    .ai-run-head[aria-expanded="false"] + .ai-run-body { display: none; }
    .ai-run-steps { display: grid; gap: 0; margin: 2px 0 0; padding: 0; list-style: none; }
    .ai-run-step { display: grid; grid-template-columns: 16px minmax(0, 1fr); align-items: start;
      gap: 8px; padding: 2px 0; color: ${secondary}; font-size: 11.5px; line-height: 1.6; }
    .ai-run-step-icon { display: grid; place-items: center; width: 16px; height: 16px;
      margin-top: 1px; color: ${muted}; }
    .ai-run-step-icon svg { display: block; width: 14px; height: 14px; }
    .ai-run-step[data-kind="editing"] { color: ${accent}; }
    .ai-run-step[data-kind="editing"] .ai-run-step-icon { color: ${accent}; }
    .ai-run-step[data-kind="done"] .ai-run-step-icon { color: ${ok}; }
    .ai-run-step[data-kind="error"] { color: ${danger}; }
    .ai-run-step[data-kind="error"] .ai-run-step-icon { color: ${danger}; }
    .ai-run-step-text { min-width: 0; overflow-wrap: anywhere; }
    .ai-run-think { margin: 4px 0 0; }
    .ai-run-think > summary { padding: 2px 0; color: ${muted}; font-size: 11px;
      list-style: none; cursor: pointer; }
    .ai-run-think > summary::-webkit-details-marker { display: none; }
    .ai-run-think > summary::before { content: "▸ "; }
    .ai-run-think[open] > summary::before { content: "▾ "; }
    .ai-run-think > summary:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px; border-radius: 4px; }
    .ai-run-think-text { max-height: 240px; margin: 4px 0 0; overflow: auto;
      padding: 0 0 0 12px; border-left: 1px solid ${line};
      color: ${muted}; font-family: ${mono}; font-size: 11px; line-height: 1.7;
      white-space: pre-wrap; overflow-wrap: anywhere; }

    /* --- prose: no bubbles, the panel already frames the conversation ------ */
    .message-bubble { max-width: 100%; overflow-wrap: anywhere; text-align: left; }
    .message-bubble > :first-child { margin-top: 0; }
    .message-bubble > :last-child { margin-bottom: 0; }
    .message-bubble p { margin: 0 0 .6em; }
    .message-bubble :is(ul, ol) { margin: .2em 0 .7em; padding-left: 1.35em; }
    .message-bubble li { margin: .15em 0; }
    .message-bubble pre { max-width: 100%; margin: .5em 0; padding: 8px 10px; overflow-x: auto;
      border: 1px solid ${line}; border-radius: ${radiusSm}; background: ${sunken};
      font-family: ${mono}; font-size: 11px; line-height: 1.6; }
    .message-bubble code { font-family: ${mono}; font-size: .94em; }
    .message-bubble :not(pre) > code { padding: 1px 4px; border-radius: 5px;
      background: color-mix(in srgb, ${text} 6%, transparent); }
    .message-bubble a { color: ${accent}; }

    /* The submit glyph is stroke-drawn; deep-chat's own rule fills it and colourises
       it with a filter, which turns the plane into a grey blob. */
    #submit-icon { width: 15px !important; height: 15px !important; filter: none !important;
      fill: none !important; stroke: currentColor; stroke-width: 1.6; }
    #text-input:focus-visible { outline: none; }
    #text-input:empty::before { font-weight: 400; }
    #scroll-button { padding: 7px; border: 1px solid ${line}; border-radius: ${radiusPill};
      background: ${control}; box-shadow: 0 2px 8px color-mix(in srgb, ${text} 12%, transparent); }
    #scroll-button svg { width: 12px; height: 12px; color: ${secondary}; }

    @media (max-height: 650px) {
      .ai-welcome { padding-top: 14px; }
    }
    @container (max-width: 300px) {
      .ai-suggestions button { padding: 4px 8px; }
    }
    @media (prefers-reduced-motion: reduce) {
      * { scroll-behavior: auto !important; animation: none !important; }
    }
  `
  chat.messageStyles = {
    default: {
      shared: { bubble: { fontSize: "12.5px", lineHeight: "1.72" } },
      user: {
        bubble: {
          color: text,
          backgroundColor: sunken,
          border: "0",
          borderRadius: radiusMd,
          boxShadow: "none",
          padding: "8px 11px",
          maxWidth: "86%",
        },
      },
      ai: {
        bubble: {
          color: text,
          backgroundColor: "transparent",
          border: "0",
          borderRadius: "0",
          boxShadow: "none",
          padding: "0",
          maxWidth: "100%",
        },
      },
    },
  }
  chat.submitButtonStyles = {
    position: "inside-end",
    tooltip: { text: "发送；生成时点击可停止" },
    submit: {
      container: {
        default: { backgroundColor: accent, color: onAccent, borderRadius: radiusSm,
          width: "28px", height: "28px", bottom: "9px", right: "9px", boxShadow: "none" },
        hover: { filter: "brightness(1.06)", transform: "none" },
      },
    },
    disabled: {
      container: { default: { backgroundColor: mix(text, 5, sunken), border: `1px solid ${line}`, color: muted,
        borderRadius: radiusSm, width: "28px", height: "28px", bottom: "9px", right: "9px",
        cursor: "not-allowed", boxShadow: "none" } },
    },
    stop: {
      container: { default: { border: `1px solid ${lineStrong}`, backgroundColor: sunken, color: secondary,
        borderRadius: radiusSm, width: "28px", height: "28px", bottom: "9px", right: "9px", boxShadow: "none" } },
    },
  }
  chat.focusMode = { smoothScroll: true, streamAutoScroll: true, fade: false }
  chat.scrollButton = { smoothScroll: true }
  chat.errorMessages = { displayServiceErrorMessages: false }
  chat.remarkable = { linkTarget: "_blank", breaks: true, html: false }
}

function mix(base: string, percent: number, over: string): string {
  return `color-mix(in srgb, ${base} ${percent}%, ${over})`
}

function enableInputResize(chat: HTMLElement): void {
  const composer = chat.closest<HTMLElement>(".ai-design-composer")
  const handle = composer?.querySelector<HTMLElement>(".ai-design-resize")
  if (!composer || !handle) return
  let height = 148
  let drag: { pointerId: number; y: number; height: number } | undefined
  const updateHeight = (next: number) => {
    const available = composer.clientHeight
    if (!available) return
    const max = Math.max(128, Math.min(360, available - 160))
    height = Math.round(Math.max(128, Math.min(max, next)))
    composer.style.setProperty("--ai-input-height", `${height}px`)
    handle.setAttribute("aria-valuenow", String(height))
    handle.setAttribute("aria-valuemax", String(max))
    handle.setAttribute("aria-valuetext", `输入框高度 ${height} 像素`)
  }
  handle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return
    event.preventDefault()
    handle.focus()
    drag = { pointerId: event.pointerId, y: event.clientY, height }
    handle.setPointerCapture(event.pointerId)
    handle.classList.add("is-resizing")
  })
  handle.addEventListener("pointermove", (event) => {
    if (drag?.pointerId === event.pointerId) updateHeight(drag.height + drag.y - event.clientY)
  })
  const endDrag = () => {
    drag = undefined
    handle.classList.remove("is-resizing")
  }
  handle.addEventListener("lostpointercapture", endDrag)
  handle.addEventListener("pointercancel", endDrag)
  handle.addEventListener("pointerup", (event) => {
    if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId)
    endDrag()
  })
  handle.addEventListener("keydown", (event) => {
    if (!["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return
    event.preventDefault()
    updateHeight(event.key === "Home" ? 128 : event.key === "End" ? 360 : height + (event.key === "ArrowUp" ? 16 : -16))
  })
  handle.addEventListener("dblclick", () => updateHeight(148))
  new ResizeObserver(() => updateHeight(height)).observe(composer)
  updateHeight(height)
}

export async function connectAiChat(element: HTMLElement, run: AiChatRun): Promise<AiChatController> {
  await customElements.whenDefined("deep-chat")
  const chat = element as DeepChat
  configureAppearance(chat)
  enableInputResize(chat)

  chat.onComponentRender = () => {
    const input = chat.shadowRoot?.querySelector<HTMLElement>("#text-input")
    input?.setAttribute("aria-label", "描述你想要的皮肤效果")
    chat.shadowRoot?.querySelector(".input-button[role=button]")?.setAttribute("aria-label", "发送消息；生成时点击停止")
    chat.shadowRoot?.querySelectorAll<HTMLButtonElement>("[data-ai-prompt]").forEach((button) => {
      button.onclick = () => {
        if (!input) return
        const draft = input.innerText.trim()
        input.innerText = [draft, button.dataset.aiPrompt].filter(Boolean).join("\n")
        input.dispatchEvent(new Event("input", { bubbles: true }))
        chat.focusInput()
        const range = document.createRange()
        range.selectNodeContents(input)
        range.collapse(false)
        const selection = window.getSelection()
        selection?.removeAllRanges()
        selection?.addRange(range)
      }
    })
  }
  chat.requestBodyLimits = { maxMessages: 1, totalMessagesMaxCharLength: 8_000 }
  chat.validateInput = (text) => Boolean(text?.trim()) && (text?.length ?? 0) <= 8_000

  let activeController: AbortController | undefined
  let closeActive: (() => void) | undefined
  let generation = 0

  // The timeline is kept as data and re-painted into whatever section deep-chat
  // currently renders; injected nodes do not survive a message-list re-render.
  let timeline: RunState | undefined

  const runNodes = (state: RunState) => {
    const section = chat.shadowRoot?.querySelector<HTMLElement>(`#${state.id}`)
    return {
      section,
      head: section?.querySelector<HTMLButtonElement>(".ai-run-head") ?? null,
      label: section?.querySelector<HTMLElement>(".ai-run-label") ?? null,
      steps: section?.querySelector<HTMLOListElement>(".ai-run-steps") ?? null,
      think: section?.querySelector<HTMLDetailsElement>(".ai-run-think") ?? null,
      thinkText: section?.querySelector<HTMLElement>(".ai-run-think-text") ?? null,
    }
  }

  const runLabel = (state: RunState): string => {
    const prefix = state.status === "running" ? "处理中" : state.status === "stopped" ? "已停止" : state.status === "error" ? "未完成" : "已处理"
    const seconds = Math.max(0, Math.round(((state.finishedAt ?? Date.now()) - state.startedAt) / 1000))
    return `${prefix} · ${duration(seconds)} · ${state.count} 个步骤`
  }

  /**
   * The timeline is our own node, not a deep-chat message: adding it through
   * `addMessage` consumes the loading placeholder deep-chat expects to find
   * last, and it then reports a bogus error whenever a run streams no text.
   * It is appended to the group holding the current turn, so the answer that
   * streams next still lands underneath it.
   */
  const mountRun = (state: RunState): boolean => {
    const messages = chat.shadowRoot?.querySelector<HTMLElement>("#messages")
    if (!messages) return false
    if (messages.querySelector(`#${state.id}`)) return true
    const holder = document.createElement("div")
    holder.className = "ai-run-holder outer-message-container deep-chat-outer-container-role-ai"
      + " deep-chat-top-message deep-chat-bottom-message"
    holder.innerHTML = `<div class="inner-message-container">`
      + `<div class="message-bubble ai-message ai-message-text html-message">`
      + `${runMarkup(state.id, state.bodyId)}</div></div>`
    const groups = [...messages.children].filter((node) =>
      node.id !== "scroll-button" && !node.classList.contains("intro-panel"))
    ;(groups.at(-1) ?? messages).append(holder)
    return Boolean(messages.querySelector(`#${state.id}`))
  }

  const paintRun = (state: RunState): void => {
    if (!mountRun(state)) return
    const nodes = runNodes(state)
    if (!nodes.section || !nodes.head || !nodes.label || !nodes.steps) return
    if (!nodes.head.dataset.bound) {
      nodes.head.dataset.bound = "1"
      const head = nodes.head
      head.addEventListener("click", () => {
        head.setAttribute("aria-expanded", head.getAttribute("aria-expanded") === "true" ? "false" : "true")
      })
    }
    if (nodes.steps.childElementCount !== state.steps.length) {
      nodes.steps.replaceChildren(...state.steps.map(stepRow))
    }
    nodes.label.textContent = runLabel(state)
    if (nodes.think && nodes.thinkText) {
      nodes.think.hidden = state.reasoning === ""
      if (state.reasoning) {
        const atBottom = nodes.thinkText.scrollHeight - nodes.thinkText.scrollTop - nodes.thinkText.clientHeight < 32
        nodes.thinkText.textContent = state.reasoning
        if (nodes.think.open && atBottom) nodes.thinkText.scrollTop = nodes.thinkText.scrollHeight
      }
    }
    if (state.status !== "running") nodes.head.setAttribute("aria-expanded", "false")
  }

  const startRun = (id: number): RunState | undefined => {
    const state: RunState = {
      id: `ai-run-${id}`, bodyId: `ai-run-body-${id}`, startedAt: Date.now(),
      count: 0, steps: [], reasoning: "", status: "running",
    }
    if (!mountRun(state)) return undefined
    state.timer = setInterval(() => paintRun(state), 1_000)
    return state
  }

  const finishRun = (status: "done" | "stopped" | "error"): void => {
    if (!timeline) return
    if (timeline.timer !== undefined) clearInterval(timeline.timer)
    timeline.timer = undefined
    timeline.status = status
    timeline.finishedAt = Date.now()
    paintRun(timeline)
  }

  chat.connect = {
    stream: { partialRender: true },
    handler: (body, signals) => {
      const prompt = String(body?.messages?.at(-1)?.text ?? "").trim()
      const controller = new AbortController()
      activeController?.abort()
      closeActive?.()
      // Each turn owns its own timeline; the previous one is already folded away.
      timeline = undefined
      const currentGeneration = ++generation
      activeController = controller
      const isCurrent = () => currentGeneration === generation
      let streamed = false
      let closed = false
      let failed = false

      const openRun = (): RunState | undefined => {
        if (!timeline) timeline = startRun(currentGeneration)
        return timeline
      }

      const close = () => {
        if (closed) return
        closed = true
        if (isCurrent()) finishRun(controller.signal.aborted ? "stopped" : failed ? "error" : "done")
        signals.onClose()
        if (closeActive === close) closeActive = undefined
      }
      closeActive = close

      const appendStep = (kind: StepKind, rawText: string): void => {
        if (!isCurrent() || closed || !rawText.trim()) return
        const state = openRun()
        if (!state) return
        const text = stepText(rawText)
        const last = state.steps.at(-1)
        if (last?.kind === kind && last.text === text) return
        state.steps.push({ kind, text })
        state.count = state.steps.length
        paintRun(state)
      }

      signals.stopClicked.listener = () => controller.abort()
      signals.onOpen()

      void run(prompt, {
        signal: controller.signal,
        onStatus: async (text, kind = "thinking") => {
          appendStep((kind === "editing" ? "editing" : kind) as StepKind, text)
        },
        onThinking: async (text) => {
          if (controller.signal.aborted || !isCurrent() || !text.trim()) return
          const state = openRun()
          if (!state) return
          state.reasoning = text
          paintRun(state)
        },
        onTextDelta: async (delta) => {
          if (controller.signal.aborted || !isCurrent()) return
          streamed = true
          await signals.onResponse({ text: delta })
        },
      }).then(async ({ fallback, summary }) => {
        if (currentGeneration !== generation) return
        if (controller.signal.aborted) throw new DOMException("已停止生成", "AbortError")
        if (!streamed && fallback) await signals.onResponse({ text: fallback })
        if (summary) await signals.onResponse({ text: `\n\n${summary}` })
      }).catch(async (error) => {
        if (currentGeneration !== generation) return
        failed = !controller.signal.aborted
        const message = controller.signal.aborted
          ? "AI 设计已取消，没有应用任何修改。"
          : error instanceof Error ? error.message : String(error)
        appendStep("error", message)
        await signals.onResponse({ text: `${streamed ? "\n\n" : ""}${message}` })
      }).finally(() => {
        if (activeController === controller) activeController = undefined
        if (isCurrent()) close()
      })
    },
  }
  return {
    clear: () => {
      generation += 1
      activeController?.abort()
      activeController = undefined
      closeActive?.()
      if (timeline?.timer !== undefined) clearInterval(timeline.timer)
      timeline = undefined
      // 时间线是自建节点，deep-chat 不认识它，清空时要自己带走。
      chat.shadowRoot?.querySelectorAll(".ai-run-holder").forEach((holder) => holder.remove())
      // `true` is deep-chat's "reset": it restores the intro panel through its own
      // display() guard, so the welcome comes back after a skin switch. Touching
      // the inline style instead would leave deep-chat's flag stuck at "hidden"
      // and the welcome plate would then stay on top of the next conversation.
      chat.clearMessages(true)
      const input = chat.shadowRoot?.querySelector<HTMLElement>("#text-input")
      if (input) {
        input.innerText = ""
        input.dispatchEvent(new Event("input", { bubbles: true }))
      }
    },
    setInput: (text) => {
      const input = chat.shadowRoot?.querySelector<HTMLElement>("#text-input")
      if (!input || activeController) return
      input.innerText = text.slice(0, 8_000)
      input.dispatchEvent(new Event("input", { bubbles: true }))
      chat.focusInput()
    },
    focus: () => chat.focusInput(),
    setEnabled: (enabled) => chat.disableSubmitButton(!enabled),
  }
}
