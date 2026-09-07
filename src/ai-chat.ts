import "deep-chat"
import type { DeepChat } from "deep-chat"

export type AiChatRunHooks = {
  signal: AbortSignal
  onTextDelta: (delta: string) => Promise<void>
}

export type AiChatRunResult = {
  fallback: string
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
    margin: "0 14px 14px",
    border: `1px solid ${line}`,
    borderRadius: "12px",
    backgroundColor: control,
    boxShadow: "0 6px 20px rgb(0 0 0 / 7%)",
  }
  chat.textInput = {
    placeholder: { text: "描述要如何设计整个皮肤", style: { color: muted } },
    styles: {
      text: { color: text, fontSize: "13px", lineHeight: "1.5" },
      container: { minHeight: "58px" },
      focus: { borderColor: accent },
    },
  }
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
        default: { backgroundColor: accent, borderRadius: "8px" },
        hover: { filter: "brightness(1.06)" },
      },
      svg: { styles: { default: { filter: "brightness(0) invert(1)" } } },
    },
    stop: {
      container: { default: { border: `1px solid ${line}`, borderRadius: "8px" } },
    },
  }
  chat.focusMode = { smoothScroll: true, streamAutoScroll: true, fade: false }
  chat.scrollButton = { smoothScroll: true }
  chat.errorMessages = { displayServiceErrorMessages: false }
  chat.remarkable = { linkTarget: "_blank", breaks: true, html: false }
}

export async function connectAiChat(element: HTMLElement, run: AiChatRun): Promise<AiChatController> {
  await customElements.whenDefined("deep-chat")
  const chat = element as DeepChat
  configureAppearance(chat)
  chat.requestBodyLimits = { maxMessages: 1, totalMessagesMaxCharLength: 8_000 }
  let activeController: AbortController | undefined
  chat.connect = {
    stream: { partialRender: true },
    handler: (body, signals) => {
      const prompt = String(body?.messages?.at(-1)?.text ?? "").trim()
      const controller = new AbortController()
      activeController = controller
      let streamed = false
      signals.stopClicked.listener = () => controller.abort()
      signals.onOpen()
      void run(prompt, {
        signal: controller.signal,
        onTextDelta: async (delta) => {
          streamed = true
          await signals.onResponse({ text: delta })
        },
      }).then(async ({ fallback }) => {
        if (!streamed && fallback) await signals.onResponse({ text: fallback })
      }).catch(async (error) => {
        const message = controller.signal.aborted
          ? "AI 设计已取消，没有应用任何修改。"
          : error instanceof Error ? error.message : String(error)
        await signals.onResponse({ text: `${streamed ? "\n\n" : ""}${message}` })
      }).finally(() => {
        if (activeController === controller) activeController = undefined
        signals.onClose()
      })
    },
  }
  return {
    clear: () => {
      activeController?.abort()
      chat.clearMessages(false)
    },
    focus: () => chat.focusInput(),
    setEnabled: (enabled) => chat.disableSubmitButton(!enabled),
  }
}
