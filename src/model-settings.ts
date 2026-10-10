import { invoke } from "@tauri-apps/api/core"
import { MODEL_PROVIDER_PRESETS, modelProviderPreset, type ModelProtocol } from "./model-providers"

export interface ModelConfiguration {
  provider: string
  protocol: ModelProtocol
  apiUrl: string
  model: string
  apiKey: string
}

interface ModelConfigurationState {
  configurations?: ModelConfiguration[]
  path: string
}

type Status = "idle" | "busy" | "success" | "error"

const LEGACY_KEYS = ["model-provider", "model-api-url", "model-name", "model-api-key"]

export function modelConfigurationKey(configuration: ModelConfiguration): string {
  return `${configuration.provider}\n${configuration.apiUrl}\n${configuration.model}`
}

function presetConfiguration(id = "openai"): ModelConfiguration {
  const preset = modelProviderPreset(id)
  return { provider: preset.id, protocol: preset.protocol, apiUrl: preset.apiUrl, model: preset.model, apiKey: "" }
}

function host(url: string): string {
  try { return new URL(url).host } catch { return url }
}

/** Returns the first problem in a model list, so the editor can select the offending entry. */
export function validateModelConfigurations(models: ModelConfiguration[]): { index: number; message: string } | undefined {
  const seen = new Set<string>()
  for (const [index, model] of models.entries()) {
    if (!model.apiUrl) return { index, message: "请填写 API 地址" }
    if (!/^https?:\/\/[^/]/i.test(model.apiUrl)) return { index, message: "API 地址必须以 http:// 或 https:// 开头" }
    if (!model.model) return { index, message: "请填写模型名称" }
    if (!model.apiKey) return { index, message: "请填写 API 密钥" }
    const key = modelConfigurationKey(model)
    if (seen.has(key)) return { index, message: "已存在相同服务商、地址和名称的模型" }
    seen.add(key)
  }
}

/**
 * The settings dialog edits an in-memory copy of the model list; only the dialog's Save writes it to disk,
 * so switching, adding and deleting entries are all undone by Cancel.
 */
export function initializeModelSettings(section: HTMLElement, options: {
  desktop: boolean
  icon(name: string): HTMLElement
  onSaved(models: ModelConfiguration[]): void
}) {
  const $ = <T extends HTMLElement>(id: string) => section.querySelector<T>(`#${id}`)!
  const profiles = $<HTMLUListElement>("model-profiles")
  const editor = $<HTMLElement>("model-editor")
  const provider = $<HTMLSelectElement>("model-provider")
  const apiUrl = $<HTMLInputElement>("model-api-url")
  const name = $<HTMLInputElement>("model-name")
  const list = $<HTMLSelectElement>("model-list")
  const apiKey = $<HTMLInputElement>("model-api-key")
  const toggleKey = $<HTMLButtonElement>("toggle-model-api-key")
  const refresh = $<HTMLButtonElement>("refresh-model-list")
  const test = $<HTMLButtonElement>("test-model-connection")
  const statusText = $<HTMLElement>("model-configuration-status")
  const pathText = $<HTMLElement>("model-configuration-path")
  const summary = document.querySelector<HTMLElement>('[data-settings-summary="model"]')

  let saved: ModelConfiguration[] = []
  let draft: ModelConfiguration[] = []
  let active = -1
  let loadError = ""

  provider.replaceChildren(...MODEL_PROVIDER_PRESETS.map((preset) => new Option(preset.label, preset.id)))

  const clone = (models: ModelConfiguration[]) => models.map((model) => ({ ...model }))
  const notify = () => section.dispatchEvent(new Event("change", { bubbles: true }))
  const setStatus = (message: string, state: Status = "idle") => {
    statusText.textContent = message
    statusText.dataset.state = state
  }
  const setBusy = (busy: boolean) => {
    refresh.disabled = busy
    test.disabled = busy
  }
  const current = () => draft[active]

  function renderProfiles(): void {
    profiles.replaceChildren(...draft.map((model, index) => {
      const item = document.createElement("li")
      const select = document.createElement("button")
      select.type = "button"
      select.className = "model-profile"
      select.setAttribute("aria-pressed", String(index === active))
      const title = document.createElement("strong")
      title.textContent = model.model || "未命名模型"
      const detail = document.createElement("small")
      detail.textContent = [modelProviderPreset(model.provider).label, host(model.apiUrl)].filter(Boolean).join(" · ")
      select.append(title, detail)
      if (index === 0) {
        const badge = document.createElement("em")
        badge.textContent = "默认"
        select.append(badge)
      }
      select.addEventListener("click", () => selectProfile(index))
      const remove = document.createElement("button")
      remove.type = "button"
      remove.className = "model-profile-remove"
      remove.title = `删除 ${model.model || "未命名模型"}`
      remove.setAttribute("aria-label", remove.title)
      remove.append(options.icon("trash"))
      remove.addEventListener("click", () => removeProfile(index))
      item.append(select, remove)
      return item
    }))
    if (!draft.length) {
      const empty = document.createElement("li")
      empty.className = "model-profiles-empty"
      empty.textContent = "尚未配置模型，点击“新增”添加模型服务"
      profiles.append(empty)
    }
    if (summary) summary.textContent = draft.length ? `${draft.length} 个` : "未配置"
  }

  function renderEditor(): void {
    const model = current()
    editor.hidden = test.hidden = !model
    showModelList([])
    if (!model) return
    provider.value = modelProviderPreset(model.provider).id
    apiUrl.value = model.apiUrl
    name.value = model.model
    apiKey.value = model.apiKey
  }

  function render(): void {
    renderProfiles()
    renderEditor()
  }

  function selectProfile(index: number): void {
    active = index
    render()
    setStatus("")
  }

  function addProfile(): void {
    // Copy the endpoint and key of the open entry: a second model usually comes from the same service.
    draft.push(current() ? { ...current(), model: "" } : presetConfiguration())
    selectProfile(draft.length - 1)
    name.focus()
    setStatus("填写模型名称后保存")
    notify()
  }

  function removeProfile(index: number): void {
    draft.splice(index, 1)
    active = Math.min(active > index ? active - 1 : active, draft.length - 1)
    render()
    setStatus("已删除，保存后生效")
    notify()
  }

  function updateCurrent(patch: Partial<ModelConfiguration>): void {
    const model = current()
    if (!model) return
    Object.assign(model, patch)
    renderProfiles()
  }

  function showModelList(models: string[]): void {
    const available = name.value && !models.includes(name.value) ? [name.value, ...models] : models
    list.replaceChildren(new Option("选择模型…", ""), ...available.map((model) => new Option(model, model)), new Option("手动输入…", "__custom__"))
    name.hidden = models.length > 0
    list.hidden = models.length === 0
    list.value = name.value
  }

  provider.addEventListener("change", () => {
    const model = current()
    if (!model) return
    const previous = modelProviderPreset(model.provider)
    const next = modelProviderPreset(provider.value)
    // Only replace values the user has not customised.
    if (!model.apiUrl || model.apiUrl === previous.apiUrl) apiUrl.value = next.apiUrl
    if (!model.model || model.model === previous.model) name.value = next.model
    updateCurrent({ provider: next.id, protocol: next.protocol, apiUrl: apiUrl.value.trim(), model: name.value.trim() })
    showModelList([])
  })
  apiUrl.addEventListener("input", () => updateCurrent({ apiUrl: apiUrl.value.trim() }))
  name.addEventListener("input", () => updateCurrent({ model: name.value.trim() }))
  apiKey.addEventListener("input", () => updateCurrent({ apiKey: apiKey.value.trim() }))
  list.addEventListener("change", () => {
    if (list.value === "__custom__") {
      list.hidden = true
      name.hidden = false
      name.focus()
      name.select()
      return
    }
    if (!list.value) return
    name.value = list.value
    updateCurrent({ model: list.value })
  })
  $("model-profile-add").addEventListener("click", addProfile)

  toggleKey.addEventListener("click", () => {
    const revealing = apiKey.type === "password"
    apiKey.type = revealing ? "text" : "password"
    toggleKey.title = revealing ? "隐藏 API 密钥" : "显示 API 密钥"
    toggleKey.setAttribute("aria-label", toggleKey.title)
    toggleKey.replaceChildren(options.icon(revealing ? "eye.slash" : "eye"))
  })

  async function request<T>(pending: string, failure: string, command: string): Promise<T | undefined> {
    const model = current()
    if (!model) return
    if (!options.desktop) {
      setStatus("请在桌面应用中连接模型服务")
      return
    }
    setBusy(true)
    setStatus(pending, "busy")
    try {
      return await invoke<T>(command, { configuration: model })
    } catch (error) {
      setStatus(`${failure}：${String(error)}`, "error")
    } finally {
      setBusy(false)
    }
  }

  refresh.addEventListener("click", () => void request<string[]>("正在从 API 获取模型…", "获取模型失败", "fetch_model_list").then((models) => {
    if (!models) return
    showModelList(models)
    if (!name.value && models[0]) {
      list.value = models[0]
      list.dispatchEvent(new Event("change", { bubbles: true }))
    }
    setStatus(`已获取 ${models.length} 个模型`, "success")
  }))
  test.addEventListener("click", () => void request<{ message: string }>("正在测试连接…", "连接失败", "test_model_connection").then((result) => {
    if (result) setStatus(result.message, "success")
  }))

  async function persist(models: ModelConfiguration[]): Promise<void> {
    const state = await invoke<ModelConfigurationState>("save_model_configuration", { configurations: models })
    for (const key of LEGACY_KEYS) localStorage.removeItem(key)
    saved = clone(models)
    pathText.textContent = pathText.title = state.path
    options.onSaved(clone(saved))
  }

  async function load(): Promise<void> {
    render()
    if (!options.desktop) {
      setStatus("模型服务仅在桌面应用中可用")
      return
    }
    try {
      const state = await invoke<ModelConfigurationState>("load_model_configuration")
      pathText.textContent = pathText.title = state.path
      saved = state.configurations ?? []
      if (!saved.length) {
        const legacy = LEGACY_KEYS.map((key) => localStorage.getItem(key))
        if (legacy.some(Boolean)) {
          const [legacyProvider, legacyApiUrl, legacyModel, legacyApiKey] = legacy
          const preset = presetConfiguration(legacyProvider ?? "openai")
          const migrated = { ...preset, apiUrl: legacyApiUrl || preset.apiUrl, model: legacyModel || preset.model, apiKey: legacyApiKey ?? "" }
          if (!validateModelConfigurations([migrated])) {
            await persist([migrated])
            setStatus("旧配置已迁移到本机配置文件", "success")
          }
        }
      }
      draft = clone(saved)
      active = draft.length ? 0 : -1
      render()
      options.onSaved(clone(saved))
      if (statusText.dataset.state !== "success") setStatus(saved.length ? "" : "尚未配置模型")
    } catch (error) {
      loadError = `读取配置失败：${String(error)}`
      setStatus(loadError, "error")
    }
  }

  void load()
  return {
    begin(): void {
      draft = clone(saved)
      active = Math.min(Math.max(active, 0), draft.length - 1)
      apiKey.type = "password"
      render()
      setStatus(loadError, loadError ? "error" : "idle")
    },
    cancel(): void {
      this.begin()
    },
    dirty(): boolean {
      return JSON.stringify(draft) !== JSON.stringify(saved)
    },
    async save(): Promise<void> {
      if (!options.desktop) throw new Error("请在桌面应用中保存模型配置")
      // Never overwrite a config file we could not read.
      if (loadError) throw new Error(loadError)
      const problem = validateModelConfigurations(draft)
      if (problem) {
        selectProfile(problem.index)
        setStatus(problem.message, "error")
        throw new Error(`大模型 · ${problem.message}`)
      }
      setStatus("正在保存配置…", "busy")
      try {
        await persist(draft)
        setStatus("配置已保存到本机", "success")
      } catch (error) {
        setStatus(`保存失败：${String(error)}`, "error")
        throw error
      }
    },
  }
}
