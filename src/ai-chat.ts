import "deep-chat"
import type { DeepChat } from "deep-chat"

export type AiChatRunHooks = {
  signal: AbortSignal
  onTextDelta: (delta: string) => Promise<void>
  onStatus?: (text: string) => Promise<void>
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
}

function themeColor(element: HTMLElement, property: string, fallback: string): string {
  return getComputedStyle(element).getPropertyValue(property).trim() || fallback
}

function configureAppearance(chat: DeepChat): void {
  const text = themeColor(chat, "--text", "#1f2328")
  const muted = themeColor(chat, "--muted", "#667085")
  const control = themeColor(chat, "--control", "#ffffff")
  const line = themeColor(chat, "--line", "#d0d5dd")
  const accent = themeColor(chat, "--accent", "#1677ff")
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
      text: { color: text, fontSize: "13px", lineHeight: "1.75", padding: "14px 14px",
        boxSizing: "border-box", height: "calc(100% - 52px)", overflowY: "auto" },
      container: {
        width: "100%", boxSizing: "border-box", margin: "0",
        height: "var(--ai-input-height, 148px)", minHeight: "128px", maxHeight: "none", overflow: "hidden",
        border: `1px solid ${line}`, borderRadius: "14px",
        backgroundColor: control, boxShadow: `0 2px 8px rgb(0 0 0 / 6%), inset 0 1px rgb(255 255 255 / 60%)`,
      },
      focus: { borderColor: accent, boxShadow: `0 0 0 3px color-mix(in srgb, ${accent} 12%, transparent), 0 2px 8px rgb(0 0 0 / 8%)`, outline: "none" },
    },
  }
  chat.auxiliaryStyle = `
    #chat-view { grid-template-rows: minmax(0, 1fr) auto; }
    #messages { min-height: 0; }
    .intro-panel { width: 100%; box-sizing: border-box; top: 0;
      bottom: calc(var(--ai-input-height, 148px) + 42px); height: auto; margin: 0;
      overflow-y: auto; align-items: flex-start; }
    .ai-welcome { width: 100%; }
    .ai-welcome { box-sizing: border-box; max-width: 540px; margin: 0 auto;
      padding: clamp(24px, 4vh, 48px) 24px 24px; text-align: left; color: ${text}; }
    .ai-welcome-icon { display: grid; place-items: center; width: 44px; height: 44px;
      color: ${accent}; background: color-mix(in srgb, ${accent} 9%, ${control});
      border: 1px solid color-mix(in srgb, ${accent} 15%, ${line}); border-radius: 14px; font-size: 26px; }
    .ai-welcome-eyebrow { margin: 20px 0 8px; font-size: 11px; color: ${muted}; }
    .ai-welcome h2 { margin: 0; font-size: clamp(19px, 3vw, 24px); font-weight: 600; letter-spacing: -.5px; }
    .ai-welcome-description { margin: 12px 0 24px; font-size: 12px; color: ${muted}; line-height: 1.8; }
    .ai-suggestions { display: grid; gap: 8px; }
    .ai-suggestions button { display: flex; align-items: center; gap: 12px; width: 100%;
      padding: 13px 14px; text-align: left; font: inherit; color: ${text}; background: ${control};
      border: 1px solid ${line}; border-radius: 12px; cursor: pointer;
      transition: background .15s, border-color .15s; }
    .ai-suggestions button:hover { border-color: color-mix(in srgb, ${accent} 45%, ${line});
      background: color-mix(in srgb, ${accent} 4%, ${control}); }
    .ai-suggestions button:focus-visible { outline: 2px solid ${accent}; outline-offset: 3px; }
    .ai-suggestion-icon { display: grid; place-items: center; width: 32px; height: 32px;
      border-radius: 8px; background: color-mix(in srgb, ${accent} 7%, ${control}); color: ${accent}; font-size: 16px; flex-shrink: 0; }
    .ai-suggestions strong { display: block; font-size: 12px; font-weight: 500; }
    .ai-suggestions small { display: block; margin-top: 4px; font-size: 11px; color: ${muted}; }
    .ai-suggestion-arrow { margin-left: auto; color: ${muted}; }
    .ai-welcome-note { margin: 14px 0 0; font-size: 11px; color: ${muted}; }
    @media (max-height: 650px) {
      .ai-welcome { padding-top: 20px; }
      .ai-welcome-icon, .ai-welcome-eyebrow { display: none; }
      .ai-welcome-description { margin-bottom: 16px; }
    }
    @container (max-width: 300px) {
      .ai-welcome { padding-inline: 14px; }
      .ai-welcome h2 { font-size: 18px; letter-spacing: -.6px; }
      .ai-welcome-description br { display: none; }
      .ai-suggestions button { padding: 10px; gap: 8px; }
      .ai-suggestion-icon { width: 26px; height: 26px; }
      .ai-suggestion-arrow { display: none; }
    }
    #text-input-container::after {
      content: ""; position: absolute; left: 14px; right: 14px; bottom: 51px;
      height: 1px; background: ${line}; opacity: .65; pointer-events: none;
    }
    #text-input:empty::before { font-weight: 400; }
    .message-bubble { max-width: 88%; overflow-wrap: anywhere; text-align: left; }
    .message-bubble pre { max-width: 100%; overflow-x: auto; }
    .message-bubble p:first-child { margin-top: 0; }
    .message-bubble p:last-child { margin-bottom: 0; }
    #text-input:focus-visible { outline: none; }
    .ai-reasoning { font-size: 12px; color: ${muted}; text-align: left; }
    .ai-reasoning summary { cursor: pointer; padding: 4px 0; color: ${text}; }
    .ai-reasoning summary:focus-visible { outline: 2px solid ${accent}; outline-offset: 3px; }
    .ai-reasoning summary::after { content: "展开"; float: right; margin-left: 16px; color: ${muted}; }
    .ai-reasoning[open] summary::after { content: "收起"; }
    .ai-reasoning pre { white-space: pre-wrap; overflow-wrap: anywhere; max-height: 260px;
      overflow-y: auto; font: inherit; line-height: 1.7; border-top: 1px solid ${line}; padding-top: 10px; }

    @media (prefers-reduced-motion: reduce) {
      * { scroll-behavior: auto !important; animation: none !important; }
    }
  `
  chat.messageStyles = {
    default: {
      shared: { bubble: { fontSize: "13px", lineHeight: "1.7", padding: "16px 18px" } },
      user: {
        bubble: {
          color: text,
          backgroundColor: `color-mix(in srgb, ${accent} 10%, ${control})`,
          border: `1px solid color-mix(in srgb, ${accent} 20%, ${line})`,
          borderRadius: "16px 16px 4px 16px",
          boxShadow: "0 2px 8px rgb(0 0 0 / 4%)",
        },
      },
      ai: {
        bubble: {
          color: text,
          backgroundColor: control,
          border: `1px solid ${line}`,
          borderRadius: "14px",
          boxShadow: "0 2px 8px rgb(0 0 0 / 4%)",
        },
      },
    },
  }
  chat.submitButtonStyles = {
    position: "inside-end",
    tooltip: { text: "发送；生成时点击可停止" },
    submit: {
      container: {
        default: { backgroundColor: accent, borderRadius: "10px", width: "32px", height: "32px", bottom: "10px", right: "10px",
          boxShadow: `0 2px 8px color-mix(in srgb, ${accent} 30%, transparent)` },
        hover: { filter: "brightness(1.08)", transform: "scale(1.02)" },
      },
      svg: { styles: { default: { filter: "brightness(0) invert(1)" } } },
    },
    disabled: {
      container: { default: { backgroundColor: `color-mix(in srgb, ${text} 8%, ${control})`, borderRadius: "10px", width: "32px", height: "32px", bottom: "10px", right: "10px", cursor: "not-allowed", boxShadow: "none" } },
      svg: { styles: { default: { fill: muted, opacity: "0.5", filter: "none" } } },
    },
    stop: {
      container: { default: { border: `1px solid ${line}`, backgroundColor: control, borderRadius: "10px", width: "32px", height: "32px", bottom: "10px", right: "10px", boxShadow: "0 2px 6px rgb(0 0 0 / 6%)" } },
    },
  }
  chat.focusMode = { smoothScroll: true, streamAutoScroll: true, fade: false }
  chat.scrollButton = { smoothScroll: true }
  chat.errorMessages = { displayServiceErrorMessages: false }
  chat.remarkable = { linkTarget: "_blank", breaks: true, html: false }
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

  chat.connect = {
    stream: { partialRender: true },
    handler: (body, signals) => {
      const prompt = String(body?.messages?.at(-1)?.text ?? "").trim()
      const controller = new AbortController()
      activeController?.abort()
      closeActive?.()
      const currentGeneration = ++generation
      activeController = controller
      let streamed = false
      let thinkingBlock: HTMLDetailsElement | null = null
      const isCurrent = () => currentGeneration === generation

      signals.stopClicked.listener = () => controller.abort()
      signals.onOpen()
      let closed = false
      const close = () => {
        if (closed) return
        closed = true
        const label = thinkingBlock?.querySelector("summary")
        if (label) label.textContent = controller.signal.aborted ? "思考已停止" : "思考过程"
        signals.onClose()
        if (closeActive === close) closeActive = undefined
      }
      closeActive = close

      void run(prompt, {
        signal: controller.signal,
        onThinking: async (text) => {
          if (controller.signal.aborted || !isCurrent() || !text) return
          if (!thinkingBlock) {
            const id = `ai-reasoning-${currentGeneration}`
            chat.addMessage({ role: "ai", html: `<details class="ai-reasoning" id="${id}"><summary>正在思考…</summary><pre></pre></details>` })
            thinkingBlock = chat.shadowRoot?.querySelector<HTMLDetailsElement>(`#${id}`) ?? null
          }
          const content = thinkingBlock?.querySelector("pre")
          if (content) {
            const atBottom = content.scrollHeight - content.scrollTop - content.clientHeight < 32
            content.textContent = text
            if (thinkingBlock?.open && atBottom) content.scrollTop = content.scrollHeight
          }
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
        const message = controller.signal.aborted
          ? "AI 设计已取消，没有应用任何修改。"
          : error instanceof Error ? error.message : String(error)
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
      chat.clearMessages(false)
    },
    focus: () => chat.focusInput(),
    setEnabled: (enabled) => chat.disableSubmitButton(!enabled),
  }
}
