import { invoke } from "@tauri-apps/api/core"
import { IMAGE_MODEL_PRESETS, MODEL_PROVIDER_PRESETS, imageModelPreset, modelProviderPreset, type ModelProtocol } from "./model-providers"

export interface ModelConfiguration {
  provider: string
  protocol: ModelProtocol
  apiUrl: string
  model: string
  apiKey: string
  /** "image" marks the single image-generation model used by AI design. */
  kind?: "image"
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

/** One service account in the editor; it is stored as one flat ModelConfiguration per enabled model. */
export interface ModelProvider {
  provider: string
  protocol: ModelProtocol
  apiUrl: string
  apiKey: string
  models: string[]
}

function presetProvider(id = "openai"): ModelProvider {
  const preset = modelProviderPreset(id)
  return { provider: preset.id, protocol: preset.protocol, apiUrl: preset.apiUrl, apiKey: "", models: preset.model ? [preset.model] : [] }
}

export function modelHost(url: string): string {
  try { return new URL(url).host } catch { return url }
}

/** Groups saved entries that share a service, endpoint and key, keeping first-seen order. */
export function groupModelConfigurations(models: ModelConfiguration[]): ModelProvider[] {
  const groups = new Map<string, ModelProvider>()
  for (const { model, ...service } of models) {
    const key = `${service.provider}\n${service.apiUrl}\n${service.apiKey}`
    const group = groups.get(key) ?? { ...service, models: [] }
    groups.set(key, group)
    if (model && !group.models.includes(model)) group.models.push(model)
  }
  return [...groups.values()]
}

export function flattenModelProviders(providers: ModelProvider[]): ModelConfiguration[] {
  return providers.flatMap(({ models, ...service }) => models.map((model) => ({ ...service, model })))
}

/** Returns the first problem in a provider list, so the editor can select the offending entry. */
export function validateModelProviders(providers: ModelProvider[]): { index: number; message: string } | undefined {
  const seen = new Set<string>()
  for (const [index, provider] of providers.entries()) {
    if (!provider.apiUrl) return { index, message: "请填写 API 地址" }
    if (!/^https?:\/\/[^/]/i.test(provider.apiUrl)) return { index, message: "API 地址必须以 http:// 或 https:// 开头" }
    if (!provider.apiKey) return { index, message: "请填写 API 密钥" }
    if (!provider.models.length) return { index, message: "请至少选择一个模型" }
    for (const model of flattenModelProviders([provider])) {
      const key = modelConfigurationKey(model)
      if (seen.has(key)) return { index, message: `模型 ${model.model} 已在相同服务商和地址下存在` }
      seen.add(key)
    }
  }
}

export function validateImageModel(image: ModelConfiguration | undefined): string | undefined {
  if (!image) return
  if (!/^https?:\/\/[^/]/i.test(image.apiUrl)) return "生图模型的 API 地址必须以 http:// 或 https:// 开头"
  if (!image.apiKey) return "请填写生图模型的 API 密钥"
  if (!image.model) return "请填写生图模型名称"
}

/**
 * The settings dialog edits an in-memory copy of the provider list; only the dialog's Save writes it to disk,
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
  const apiKey = $<HTMLInputElement>("model-api-key")
  const choices = $<HTMLUListElement>("model-choices")
  const name = $<HTMLInputElement>("model-name")
  const addModel = $<HTMLButtonElement>("model-name-add")
  const toggleKey = $<HTMLButtonElement>("toggle-model-api-key")
  const refresh = $<HTMLButtonElement>("refresh-model-list")
  const test = $<HTMLButtonElement>("test-model-connection")
  const statusText = $<HTMLElement>("model-configuration-status")
  const pathText = $<HTMLElement>("model-configuration-path")
  const summary = document.querySelector<HTMLElement>('[data-settings-summary="model"]')
  const imageProvider = $<HTMLSelectElement>("image-model-provider")
  const imageFields = $<HTMLElement>("image-model-fields")
  const imageApiUrl = $<HTMLInputElement>("image-model-api-url")
  const imageApiKey = $<HTMLInputElement>("image-model-api-key")
  const imageName = $<HTMLInputElement>("image-model-name")

  let saved: ModelConfiguration[] = []
  let draft: ModelProvider[] = []
  let imageDraft: ModelConfiguration | undefined
  let active = -1
  // Models fetched from the open provider's API; offered as choices but not saved.
  let fetched: string[] = []
  let loadError = ""

  provider.replaceChildren(...MODEL_PROVIDER_PRESETS.map((preset) => new Option(preset.label, preset.id)))
  imageProvider.replaceChildren(new Option("不使用", ""), ...IMAGE_MODEL_PRESETS.map((preset) => new Option(preset.label, preset.id)))

  const clone = <T extends object>(items: T[]) => structuredClone(items)
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
    profiles.replaceChildren(...draft.map((group, index) => {
      const label = modelProviderPreset(group.provider).label
      const item = document.createElement("li")
      const select = document.createElement("button")
      select.type = "button"
      select.className = "model-profile"
      select.setAttribute("aria-pressed", String(index === active))
      const title = document.createElement("strong")
      title.textContent = label
      const detail = document.createElement("small")
      detail.textContent = [group.models.length ? group.models.join("、") : "未选择模型", modelHost(group.apiUrl)].filter(Boolean).join(" · ")
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
      remove.title = `删除 ${label}`
      remove.setAttribute("aria-label", remove.title)
      remove.append(options.icon("trash"))
      remove.addEventListener("click", () => removeProfile(index))
      item.append(select, remove)
      return item
    }))
    if (!draft.length) {
      const empty = document.createElement("li")
      empty.className = "model-profiles-empty"
      empty.textContent = "尚未配置服务商，点击“新增”添加"
      profiles.append(empty)
    }
    const count = draft.reduce((total, group) => total + group.models.length, 0)
    if (summary) summary.textContent = count ? `${count} 个` : "未配置"
  }

  function renderChoices(): void {
    const group = current()
    if (!group) return
    const preset = modelProviderPreset(group.provider).model
    const all = [...new Set([...group.models, ...fetched, ...(preset ? [preset] : [])])]
    choices.replaceChildren(...all.map((model) => {
      const item = document.createElement("li")
      const label = document.createElement("label")
      const box = document.createElement("input")
      box.type = "checkbox"
      box.checked = group.models.includes(model)
      box.addEventListener("change", () => {
        group.models = box.checked ? [...group.models, model] : group.models.filter((item) => item !== model)
        renderProfiles()
        notify()
      })
      const text = document.createElement("span")
      text.textContent = model
      label.append(box, text)
      item.append(label)
      return item
    }))
    if (!all.length) {
      const empty = document.createElement("li")
      empty.className = "model-choices-empty"
      empty.textContent = "点击“获取”读取模型列表，或在下方手动添加"
      choices.append(empty)
    }
  }

  function renderEditor(): void {
    const group = current()
    editor.hidden = test.hidden = !group
    if (!group) return
    provider.value = modelProviderPreset(group.provider).id
    apiUrl.value = group.apiUrl
    apiKey.value = group.apiKey
    name.value = ""
    renderChoices()
  }

  function renderImage(): void {
    imageProvider.value = imageDraft?.provider ?? ""
    imageFields.hidden = !imageDraft
    imageApiUrl.value = imageDraft?.apiUrl ?? ""
    imageApiKey.value = imageDraft?.apiKey ?? ""
    imageName.value = imageDraft?.model ?? ""
  }

  function render(): void {
    renderProfiles()
    renderEditor()
    renderImage()
  }

  const chatModels = (models: ModelConfiguration[]) => models.filter((model) => model.kind !== "image")
  const savedImage = () => saved.find((model) => model.kind === "image")
  const allModels = () => [...flattenModelProviders(draft), ...(imageDraft ? [imageDraft] : [])]

  function selectProfile(index: number): void {
    if (index !== active) fetched = []
    active = index
    render()
    setStatus("")
  }

  function addProfile(): void {
    draft.push(presetProvider())
    selectProfile(draft.length - 1)
    provider.focus()
    setStatus("选择服务商并填写 API 密钥后保存")
    notify()
  }

  function removeProfile(index: number): void {
    draft.splice(index, 1)
    if (index === active) fetched = []
    active = Math.min(active > index ? active - 1 : active, draft.length - 1)
    render()
    setStatus("已删除，保存后生效")
    notify()
  }

  function updateCurrent(patch: Partial<ModelProvider>): void {
    const group = current()
    if (!group) return
    Object.assign(group, patch)
    renderProfiles()
  }

  function addCustomModel(): void {
    const group = current()
    const model = name.value.trim()
    if (!group || !model) return
    if (!group.models.includes(model)) group.models.push(model)
    name.value = ""
    renderProfiles()
    renderChoices()
    notify()
  }

  provider.addEventListener("change", () => {
    const group = current()
    if (!group) return
    const previous = modelProviderPreset(group.provider)
    const next = modelProviderPreset(provider.value)
    // Only replace values the user has not customised.
    if (!group.apiUrl || group.apiUrl === previous.apiUrl) apiUrl.value = next.apiUrl
    const untouched = !group.models.length || (group.models.length === 1 && group.models[0] === previous.model)
    fetched = []
    updateCurrent({
      provider: next.id,
      protocol: next.protocol,
      apiUrl: apiUrl.value.trim(),
      models: untouched ? (next.model ? [next.model] : []) : group.models,
    })
    renderChoices()
  })
  imageProvider.addEventListener("change", () => {
    const next = imageModelPreset(imageProvider.value)
    const previous = imageDraft && imageModelPreset(imageDraft.provider)
    // Keep a typed key when switching services; replace only untouched preset values.
    imageDraft = next && {
      provider: next.id,
      protocol: next.protocol,
      apiUrl: !imageDraft?.apiUrl || imageDraft.apiUrl === previous?.apiUrl ? next.apiUrl : imageDraft.apiUrl,
      model: !imageDraft?.model || imageDraft.model === previous?.model ? next.model : imageDraft.model,
      apiKey: imageDraft?.apiKey ?? "",
      kind: "image",
    }
    renderImage()
    notify()
  })
  for (const [input, field] of [[imageApiUrl, "apiUrl"], [imageApiKey, "apiKey"], [imageName, "model"]] as const) {
    input.addEventListener("input", () => {
      if (imageDraft) imageDraft[field] = input.value.trim()
      notify()
    })
  }
  apiUrl.addEventListener("input", () => updateCurrent({ apiUrl: apiUrl.value.trim() }))
  apiKey.addEventListener("input", () => updateCurrent({ apiKey: apiKey.value.trim() }))
  addModel.addEventListener("click", addCustomModel)
  name.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return
    event.preventDefault()
    addCustomModel()
  })
  $("model-profile-add").addEventListener("click", addProfile)

  toggleKey.addEventListener("click", () => {
    const revealing = apiKey.type === "password"
    apiKey.type = revealing ? "text" : "password"
    toggleKey.title = revealing ? "隐藏 API 密钥" : "显示 API 密钥"
    toggleKey.setAttribute("aria-label", toggleKey.title)
    toggleKey.replaceChildren(options.icon(revealing ? "eye.slash" : "eye"))
  })

  async function request<T>(pending: string, failure: string, command: string, model: string): Promise<T | undefined> {
    const group = current()
    if (!group) return
    if (!options.desktop) {
      setStatus("请在桌面应用中连接模型服务")
      return
    }
    const { models: _models, ...service } = group
    setBusy(true)
    setStatus(pending, "busy")
    try {
      return await invoke<T>(command, { configuration: { ...service, model } })
    } catch (error) {
      setStatus(`${failure}：${String(error)}`, "error")
    } finally {
      setBusy(false)
    }
  }

  refresh.addEventListener("click", () => void request<string[]>("正在从 API 获取模型…", "获取模型失败", "fetch_model_list", "").then((models) => {
    if (!models) return
    fetched = models
    renderChoices()
    setStatus(`已获取 ${models.length} 个模型，勾选要使用的模型`, "success")
  }))
  test.addEventListener("click", () => {
    const model = current()?.models[0]
    if (!model) {
      setStatus("请先选择一个模型", "error")
      return
    }
    void request<{ message: string }>(`正在使用 ${model} 测试连接…`, "连接失败", "test_model_connection", model).then((result) => {
      if (result) setStatus(result.message, "success")
    })
  })

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
          const preset = presetProvider(legacyProvider ?? "openai")
          const migrated = { ...preset, apiUrl: legacyApiUrl || preset.apiUrl, models: legacyModel ? [legacyModel] : preset.models, apiKey: legacyApiKey ?? "" }
          if (!validateModelProviders([migrated])) {
            await persist(flattenModelProviders([migrated]))
            setStatus("旧配置已迁移到本机配置文件", "success")
          }
        }
      }
      draft = groupModelConfigurations(chatModels(saved))
      imageDraft = structuredClone(savedImage())
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
      draft = groupModelConfigurations(chatModels(saved))
      imageDraft = structuredClone(savedImage())
      apiKey.type = imageApiKey.type = "password"
      active = Math.min(Math.max(active, 0), draft.length - 1)
      fetched = []
      render()
      setStatus(loadError, loadError ? "error" : "idle")
    },
    cancel(): void {
      this.begin()
    },
    dirty(): boolean {
      // Compare normalized forms: grouping may reorder or merge saved entries.
      const savedNormalized = [...flattenModelProviders(groupModelConfigurations(chatModels(saved))), ...(savedImage() ? [savedImage()] : [])]
      return JSON.stringify(allModels()) !== JSON.stringify(savedNormalized)
    },
    async save(): Promise<void> {
      if (!options.desktop) throw new Error("请在桌面应用中保存模型配置")
      // Never overwrite a config file we could not read.
      if (loadError) throw new Error(loadError)
      const problem = validateModelProviders(draft)
      if (problem) {
        selectProfile(problem.index)
        setStatus(problem.message, "error")
        throw new Error(`大模型 · ${problem.message}`)
      }
      const imageProblem = validateImageModel(imageDraft)
      if (imageProblem) {
        setStatus(imageProblem, "error")
        throw new Error(`大模型 · ${imageProblem}`)
      }
      setStatus("正在保存配置…", "busy")
      try {
        await persist(allModels())
        setStatus("配置已保存到本机", "success")
      } catch (error) {
        setStatus(`保存失败：${String(error)}`, "error")
        throw error
      }
    },
  }
}
