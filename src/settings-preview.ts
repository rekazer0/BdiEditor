import './settings-preview.css'
import { deviceSpec } from './devices'

/** Small, isolated examples: changing settings never edits the open skin. */
export function initializeSettingsPreviews(dialog: HTMLDialogElement): void {
  const input = (id: string) => dialog.querySelector<HTMLInputElement>(`#${id}`)!
  const enabled = (id: string) => input(id).checked
  const add = (page: string, content: string) => {
    const figure = document.createElement('figure')
    figure.className = 'settings-example'
    figure.innerHTML = `<figcaption>效果预览 <span>示意效果 · 随设置实时更新</span></figcaption>${content}`
    dialog.querySelector(`[data-settings-panel="${page}"] .settings-list`)!.after(figure)
    return figure
  }
  const appearance = add('appearance', `<div class="se-material"><div class="se-window"><div class="se-toolbar">皮肤编辑器 <span>检查器</span></div><div class="se-properties"><strong>布局</strong><div>位置 <span>X 24　Y 16</span></div><div>尺寸 <span>48 × 48</span></div><strong>外观</strong><div>圆角 <span>8</span></div></div></div></div><small>窗口材质为示意，实际效果取决于系统支持。</small>`)
  const workspace = add('workspace', `<div class="se-editor"><div class="se-file-pane"><div class="se-tabs se-sidebar-tabs">概览 · 源文件</div><div class="se-file">default.ini</div></div><div class="se-source-pane"><div class="se-tabs se-inspector-tabs">属性 · 源代码</div><div class="se-code"><div class="se-line">[KEY1]</div><div class="se-line">BACK_COLOR=0xFF4285F4 <i class="se-color" title="颜色快捷编辑示例"></i></div><div class="se-line">WIDTH=48</div><div class="se-completion">WIDTH <span>按键宽度</span><br>HEIGHT <span>按键高度</span></div></div><div class="se-explanation">WIDTH：设置按键的宽度，单位为像素。</div></div></div>`)
  const preview = add('preview', `<div class="se-canvas"><div class="se-device"><div class="se-screen">你好，世界</div><div class="se-keyboard"><div class="se-bubble">Q</div><div class="se-keys"><span>Q</span><span>W</span><span>E</span><span>R</span><span>T</span></div><div class="se-keys"><span>A</span><span>S</span><span>D</span><span>F</span><span>G</span></div><div class="se-crosshair"></div></div></div></div><small class="se-preview-caption"></small><div class="se-mobile-layout"><div class="se-mobile-editor">属性 / 源代码</div><div class="se-mobile-preview">预览面板</div></div><small>移动端布局示意</small>`)
  const show = (root: HTMLElement, selector: string, visible: boolean) => {
    root.querySelectorAll<HTMLElement>(selector).forEach(element => { element.hidden = !visible })
  }
  const update = () => {
    appearance.classList.toggle('se-grouped', enabled('inspector-grouped-display'))
    appearance.querySelector<HTMLElement>('.se-window')!.style.background = enabled('window-material')
      ? `color-mix(in srgb, var(--menu) ${input('window-material-opacity').value}%, transparent)` : 'var(--menu)'
    show(appearance, '.se-properties strong', enabled('inspector-grouped-display'))
    const size = Number(input('source-font-size').value)
    if (size >= 8 && size <= 32) workspace.querySelector<HTMLElement>('.se-code')!.style.fontSize = `${size}px`
    show(workspace, '.se-sidebar-tabs', enabled('sidebar-view-visible'))
    show(workspace, '.se-inspector-tabs', enabled('inspector-tabs-visible'))
    show(workspace, '.se-completion', enabled('source-completion-enabled'))
    show(workspace, '.se-color', enabled('source-value-hints-enabled'))
    show(workspace, '.se-explanation', enabled('source-line-explanation-enabled'))
    preview.dataset.background = input('canvas-background').value
    const spec = deviceSpec(input('default-device').value)
    preview.classList.toggle('se-phone', !!spec)
    preview.querySelector<HTMLElement>('.se-device')!.style.aspectRatio = spec ? `${spec.width} / ${spec.height}` : 'auto'
    preview.classList.toggle('se-top', input('mobile-preview-position').value === 'top')
    preview.classList.toggle('se-snap', enabled('editor-coordinate-snap'))
    show(preview, '.se-bubble', enabled('hint-preview-enabled'))
    show(preview, '.se-crosshair', enabled('editor-crosshair'))
    const device = dialog.querySelector<HTMLSelectElement>('#default-device')!
    preview.querySelector('.se-preview-caption')!.textContent = `${device.selectedOptions[0]?.textContent ?? '画布'}${enabled('editor-crosshair') ? ` · ${enabled('editor-coordinate-snap') ? '光标吸附到坐标轴' : '自由光标'}` : ''}`
  }
  dialog.addEventListener('input', update)
  dialog.addEventListener('change', update)
  new MutationObserver(update).observe(dialog, { attributes: true, attributeFilter: ['open'] })
  update()
}
