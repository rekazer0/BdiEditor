import { emitTo } from "@tauri-apps/api/event"
import { getCurrentWindow } from "@tauri-apps/api/window"

const form = document.querySelector<HTMLFormElement>("#new-project-window-form")!
const cancelButton = document.querySelector<HTMLButtonElement>("#cancel")!
const isTauri = "__TAURI_INTERNALS__" in window
const appWindow = isTauri ? getCurrentWindow() : undefined
let finished = false

const themePreference = localStorage.getItem("app-theme")
const resolvedTheme = themePreference === "light" || themePreference === "dark"
  ? themePreference
  : matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
document.documentElement.dataset.appTheme = resolvedTheme
document.documentElement.style.colorScheme = resolvedTheme
if (appWindow) void appWindow.setTheme(themePreference === "light" || themePreference === "dark" ? themePreference : null)

async function finish(templateID?: string): Promise<void> {
  if (finished) return
  finished = true
  if (!appWindow) return
  if (templateID) await emitTo("main", "new-project-select", { templateID })
  else await emitTo("main", "new-project-cancel")
  await appWindow.close()
}

form.addEventListener("submit", (event) => {
  event.preventDefault()
  const templateID = new FormData(form).get("project-template")
  if (typeof templateID === "string") void finish(templateID)
})

cancelButton.addEventListener("click", () => void finish())
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") void finish()
})
if (appWindow) {
  void appWindow.onCloseRequested(async (event) => {
    if (finished) return
    event.preventDefault()
    await finish()
  })
  void emitTo("main", "new-project-ready")
}
