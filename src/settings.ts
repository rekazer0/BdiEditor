import './settings.css'
import { createSettingsDraft } from './settings-draft'

type Control = HTMLInputElement | HTMLSelectElement

/** Live preferences reuse the editor's existing change handlers; cancel replays the opening values. */
export function initializeSettings(dialog: HTMLDialogElement, saveModel: () => Promise<void>, setGuides: (enabled: boolean) => void, modelEditing: { begin(): void; cancel(): void }) {
  const input = (id: string) => dialog.querySelector<Control>(`#${id}`)!
  const root = document.documentElement
  const density = input('interface-density')
  const accent = input('interface-accent')
  const soften = input('dark-canvas-soften') as HTMLInputElement
  const safe = input('safe-area-guides') as HTMLInputElement
  const guides = input('settings-layout-guides') as HTMLInputElement
  const sectionScrollbar = input('source-section-scrollbar') as HTMLInputElement
  const theme = input('app-theme')
  const read = (control: Control) => control instanceof HTMLInputElement && control.type === 'checkbox' ? String(control.checked) : control.value
  const write = (control: Control, value: string) => {
    if (control instanceof HTMLInputElement && control.type === 'checkbox') control.checked = value === 'true'
    else control.value = value
  }
  const preferences = [density, accent, soften, safe, guides, sectionScrollbar, input('interface-language')]
  density.value = localStorage.getItem(density.id) === 'compact' ? 'compact' : 'standard'
  const savedAccent = localStorage.getItem(accent.id)
  accent.value = savedAccent && /^#[0-9a-f]{6}$/i.test(savedAccent) ? savedAccent : '#2f6bff'
  sectionScrollbar.checked = localStorage.getItem(sectionScrollbar.id) !== 'false'
  soften.checked = localStorage.getItem(soften.id) !== 'false'
  safe.checked = localStorage.getItem(safe.id) === 'true'
  guides.checked = localStorage.getItem(guides.id) === 'true'
  const apply = () => {
    root.dataset.sourceSectionScrollbar = String(sectionScrollbar.checked)
    root.dataset.interfaceDensity = density.value
    root.style.setProperty('--accent', accent.value)
    root.style.setProperty('--accent-soft', `color-mix(in srgb, ${accent.value} 12%, var(--panel))`)
    root.dataset.darkCanvasSoften = String(soften.checked)
    root.dataset.safeAreaGuides = String(safe.checked)
    root.lang = input('interface-language').value
    dialog.querySelector('output#interface-accent-value')!.textContent = accent.value.toUpperCase()
  }
  for (const control of preferences) control.addEventListener('change', () => {
    localStorage.setItem(control.id, read(control))
    apply()
    if (control === guides) setGuides(guides.checked)
  })
  accent.addEventListener('input', apply)
  apply()
  setGuides(guides.checked)
  const sync = () => {
    for (const button of dialog.querySelectorAll<HTMLButtonElement>('[data-setting-choice]')) {
      button.setAttribute('aria-pressed', String(input(button.dataset.settingChoice!).value === button.dataset.value))
    }
    ;(input('theme-system-linked') as HTMLInputElement).checked = theme.value === 'system'
    dialog.querySelector('#theme-system-hint')!.textContent = theme.value === 'system' ? '由系统决定' : '已手动选择主题'
    for (const [page, id] of [['device', 'default-device'], ['background', 'canvas-background']]) {
      const control = input(id) as HTMLSelectElement
      dialog.querySelector(`[data-settings-summary="${page}"]`)!.textContent = control.selectedOptions[0]?.textContent ?? ''
    }
    dialog.querySelector('[data-settings-summary="guides"]')!.textContent = safe.checked || guides.checked || (input('editor-crosshair') as HTMLInputElement).checked ? '已启用' : '已关闭'
  }
  for (const button of dialog.querySelectorAll<HTMLButtonElement>('[data-setting-choice]')) button.addEventListener('click', () => {
    const control = input(button.dataset.settingChoice!)
    control.value = button.dataset.value!
    control.dispatchEvent(new Event('change', { bubbles: true }))
  })
  // Directory actions retain their explicit, immediate semantics; model credentials use the native save API.
  const controls = [...dialog.querySelectorAll<Control>('input[id], select[id]')].filter(control => control.id !== 'theme-system-linked' && !control.id.startsWith('source-directory') && control.id !== 'model-list')
  const storageKeys = [...controls.filter(control => !control.id.startsWith('model-')).map(control => control.id), 'window-glass-opacity', 'window-acrylic-opacity']
  let values = new Map<Control, string>()
  const draft = createSettingsDraft(localStorage, storageKeys)
  let reverting = false
  let saving = false
  const state = dialog.querySelector<HTMLElement>('#settings-save-state')!
  const dirty = () => controls.some(control => values.has(control) && read(control) !== values.get(control))
  const status = () => {
    state.dataset.dirty = String(dirty())
    dialog.querySelector('#settings-dirty-label')!.textContent = dirty() ? '有未保存的更改' : '所有更改已保存'
    const last = localStorage.getItem('settings-saved-at')
    dialog.querySelector('#settings-saved-at')!.textContent = last ? `上次保存 ${new Date(last).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}` : ''
    sync()
  }
  const begin = () => {
    values = new Map(controls.map(control => [control, read(control)]))
    draft.begin()
    modelEditing.begin()
    status()
  }
  const cancel = () => {
    if (saving) return
    reverting = true
    for (const [control, value] of values) {
      if (read(control) === value) continue
      write(control, value)
      if (!control.id.startsWith('model-')) {
        control.dispatchEvent(new Event('input', { bubbles: true }))
        control.dispatchEvent(new Event('change', { bubbles: true }))
      }
    }
    draft.cancel()
    modelEditing.cancel()
    reverting = false
    apply()
    sync()
    dialog.close()
    draft.cancel()
  }
  for (const id of ['settings-cancel', 'settings-close']) dialog.querySelector(`#${id}`)!.addEventListener('click', cancel)
  dialog.addEventListener('cancel', event => { event.preventDefault(); cancel() })
  dialog.addEventListener('click', event => { if (event.target === dialog) cancel() })
  const capture = (event: Event) => {
    const control = event.target
    if (dialog.open && !saving && !reverting && (control instanceof HTMLInputElement || control instanceof HTMLSelectElement)) {
      if (event.type === 'input' && control.id === 'window-material-opacity' || event.type === 'change' && control.id !== 'window-material-opacity' || event.type === 'focusout' && control.id === 'source-font-size') {
        draft.capture(control.id === 'window-material-opacity' ? ['window-glass-opacity', 'window-acrylic-opacity'] : [control.id])
      }
    }
    status()
  }
  dialog.addEventListener('input', capture)
  dialog.addEventListener('change', capture)
  dialog.addEventListener('focusout', capture)
  dialog.querySelector('form')!.addEventListener('submit', event => { event.preventDefault(); dialog.querySelector<HTMLButtonElement>('#settings-save')!.click() })
  dialog.querySelector('#settings-save')!.addEventListener('click', () => void (async () => {
    if (saving) return
    if (!dialog.querySelector('form')!.reportValidity()) return
    saving = true
    const button = dialog.querySelector<HTMLButtonElement>('#settings-save')!
    button.disabled = true
    try {
      if (controls.some(control => control.id.startsWith('model-') && values.has(control) && read(control) !== values.get(control))) await saveModel()
      draft.commit()
      // Flush inputs such as a color picker or number field before committing.
      for (const control of controls) if (!control.id.startsWith('model-') && read(control) !== values.get(control)) control.dispatchEvent(new Event('change', { bubbles: true }))
      localStorage.setItem('settings-saved-at', new Date().toISOString())
      begin()
      dialog.close()
    } catch (error) {
      dialog.querySelector('#settings-dirty-label')!.textContent = `保存失败：${error instanceof Error ? error.message : String(error)}`
    } finally {
      saving = false
      button.disabled = false
    }
  })())
  sync()
  return { begin }
}
