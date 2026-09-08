import "deep-chat"
import type { DeepChat } from "deep-chat"
import { createStreamingEnhancer, createInputToolbar, type StreamingEnhancer } from "./ai-chat-enhanced"

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
    margin: "0 14px 12px",
    border: "0",
    backgroundColor: "transparent",
    boxShadow: "none",
  }
  chat.textInput = {
    placeholder: { text: "描述你想要的皮肤效果…", style: { color: muted } },
    styles: {
      text: { color: text, fontSize: "13px", lineHeight: "1.7", padding: "16px 14px",
        boxSizing: "border-box", height: "calc(100% - 52px)", overflowY: "auto" },
      container: {
        width: "100%", boxSizing: "border-box", margin: "0",
        height: "var(--ai-input-height, 184px)", minHeight: "144px", maxHeight: "none", overflow: "hidden",
        border: `1px solid ${line}`, borderRadius: "12px",
        backgroundColor: control, boxShadow: "none",
      },
      focus: { borderColor: muted, boxShadow: "none", outline: "none" },
    },
  }
  chat.auxiliaryStyle = `
    #text-input-container::after {
      content: ""; position: absolute; left: 14px; right: 14px; bottom: 51px;
      height: 1px; background: ${line}; opacity: .65; pointer-events: none;
    }
    #text-input:empty::before { font-weight: 400; }
  `
  chat.messageStyles = {
    default: {
      shared: { bubble: { fontSize: "13px", lineHeight: "1.65" } },
      user: {
        bubble: {
          color: text,
          backgroundColor: `color-mix(in srgb, ${accent} 10%, ${control})`,
          border: `1px solid color-mix(in srgb, ${accent} 18%, ${line})`,
          borderRadius: "14px 14px 4px 14px",
        },
      },
      ai: {
        bubble: {
          color: text,
          backgroundColor: control,
          border: `1px solid ${line}`,
          borderRadius: "12px",
        },
      },
    },
  }
  chat.submitButtonStyles = {
    position: "inside-end",
    tooltip: { text: "发送；生成时点击可停止" },
    submit: {
      container: {
        default: { backgroundColor: accent, borderRadius: "9px", width: "30px", height: "30px", bottom: "11px", right: "10px" },
        hover: { filter: "brightness(1.06)" },
      },
      svg: { styles: { default: { filter: "brightness(0) invert(1)" } } },
    },
    disabled: {
      container: { default: { backgroundColor: `color-mix(in srgb, ${text} 7%, ${control})`, borderRadius: "9px", width: "30px", height: "30px", bottom: "11px", right: "10px", cursor: "not-allowed" } },
      svg: { styles: { default: { fill: muted, opacity: "0.65", filter: "none" } } },
    },
    stop: {
      container: { default: { border: `1px solid ${line}`, borderRadius: "9px", width: "30px", height: "30px", bottom: "11px", right: "10px" } },
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
  let height = 184
  let drag: { pointerId: number; y: number; height: number } | undefined
  const updateHeight = (next: number) => {
    const available = composer.clientHeight
    if (!available) return
    const max = Math.max(144, Math.min(420, available - 110))
    height = Math.round(Math.max(144, Math.min(max, next)))
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
    updateHeight(event.key === "Home" ? 144 : event.key === "End" ? 420 : height + (event.key === "ArrowUp" ? 16 : -16))
  })
  handle.addEventListener("dblclick", () => updateHeight(184))
  new ResizeObserver(() => updateHeight(height)).observe(composer)
  updateHeight(height)
}

export async function connectAiChat(element: HTMLElement, run: AiChatRun): Promise<AiChatController> {
  await customElements.whenDefined("deep-chat")
  const chat = element as DeepChat
  configureAppearance(chat)
  enableInputResize(chat)

  // 添加输入工具栏增强
  const textInputContainer = chat.shadowRoot?.querySelector("#text-input-container") as HTMLElement
  if (textInputContainer) {
    const toolbar = createInputToolbar(textInputContainer)
    const textInput = chat.shadowRoot?.querySelector("#text-input") as HTMLElement
    if (textInput) {
      textInput.addEventListener("input", () => {
        toolbar.updateCharCount(textInput.textContent?.length ?? 0)
      })
    }
  }

  chat.introMessage = { text: "想让皮肤有什么变化？\n\n试试：将整个皮肤改为低饱和蓝色，保留按键布局。\n也可以调整文字大小、配色或已有样式。" }
  chat.requestBodyLimits = { maxMessages: 1, totalMessagesMaxCharLength: 8_000 }
  let activeController: AbortController | undefined
  let generation = 0
  let currentEnhancer: StreamingEnhancer | undefined

  chat.connect = {
    stream: { partialRender: true },
    handler: (body, signals) => {
      const prompt = String(body?.messages?.at(-1)?.text ?? "").trim()
      const controller = new AbortController()
      const currentGeneration = generation
      activeController = controller
      let streamed = false
      let thinkingText = ""

      signals.stopClicked.listener = () => controller.abort()
      signals.onOpen()

      // 在消息容器准备好后创建流式增强器
      setTimeout(() => {
        const messageElements = chat.shadowRoot?.querySelectorAll(".message-bubble")
        const lastMessage = messageElements?.[messageElements.length - 1] as HTMLElement
        if (lastMessage) {
          currentEnhancer = createStreamingEnhancer()
          const contentContainer = document.createElement("div")
          contentContainer.className = "message-content"
          lastMessage.appendChild(contentContainer)
          currentEnhancer.startStreaming(contentContainer)

          // 显示打断引导（生成开始后2秒显示）
          setTimeout(() => {
            currentEnhancer?.showInterruptGuide(() => {
              controller.abort()
            })
          }, 2000)
        }
      }, 50)

      void run(prompt, {
        signal: controller.signal,
        onThinking: async (text) => {
          if (controller.signal.aborted || currentGeneration !== generation) return
          thinkingText = text
          currentEnhancer?.showThinking(text)
        },
        onStatus: async (text) => {
          if (controller.signal.aborted || currentGeneration !== generation) return
          await signals.onResponse({ text: `\n\n> ${text}` })
        },
        onTextDelta: async (delta) => {
          if (controller.signal.aborted || currentGeneration !== generation) return
          streamed = true

          // 使用增强器逐字符添加（如果可用）
          if (currentEnhancer) {
            for (const char of delta) {
              currentEnhancer.addCharacter(char)
              await new Promise(resolve => setTimeout(resolve, 20))
            }
          } else {
            await signals.onResponse({ text: delta })
          }
        },
      }).then(async ({ fallback, summary }) => {
        if (currentGeneration !== generation) return
        currentEnhancer?.stopStreaming()
        if (!streamed && fallback) await signals.onResponse({ text: fallback })
        if (summary) await signals.onResponse({ text: `\n\n${summary}` })
      }).catch(async (error) => {
        if (currentGeneration !== generation) return
        currentEnhancer?.stopStreaming()
        const message = controller.signal.aborted
          ? "AI 设计已取消，没有应用任何修改。"
          : error instanceof Error ? error.message : String(error)
        await signals.onResponse({ text: `${streamed ? "\n\n" : ""}${message}` })
      }).finally(() => {
        if (activeController === controller) activeController = undefined
        currentEnhancer = undefined
        signals.onClose()
      })
    },
  }
  return {
    clear: () => {
      generation += 1
      activeController?.abort()
      currentEnhancer?.stopStreaming()
      currentEnhancer = undefined
      chat.clearMessages(false)
    },
    focus: () => chat.focusInput(),
    setEnabled: (enabled) => chat.disableSubmitButton(!enabled),
  }
}
