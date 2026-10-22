import { emitTo, listen } from "@tauri-apps/api/event"

// 图片切片 / 全部图片 / 全部样式共用 picker.html：桌面端是原生窗口，走 Tauri 事件；网页端嵌在主页面的 iframe 里，走 postMessage。
const isTauri = "__TAURI_INTERNALS__" in window

export function pickerEmitter(tauriTarget: string, peer: () => Window | null | undefined) {
  return async (event: string, payload: unknown = {}): Promise<void> => {
    if (isTauri) await emitTo(tauriTarget, event, payload)
    else peer()?.postMessage({ pickerEvent: event, payload }, location.origin)
  }
}

export function pickerListener(peer: () => Window | null | undefined) {
  return async <T>(event: string, handler: (payload: T) => void): Promise<void> => {
    if (isTauri) {
      await listen<T>(event, (message) => handler(message.payload))
      return
    }
    addEventListener("message", (message) => {
      if (message.origin === location.origin && message.source === peer() && message.data?.pickerEvent === event) handler(message.data.payload)
    })
  }
}
