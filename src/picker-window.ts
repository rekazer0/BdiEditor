import { emitTo, listen } from "@tauri-apps/api/event"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { LogicalSize } from "@tauri-apps/api/dpi"
import { bindSlicePickerZoom, drawSlicePicker, MAX_SLICE_ZOOM, MIN_SLICE_ZOOM } from "./slice-picker-canvas.ts"
import { tileSliceAt, type TilePoint, type TileSlice } from "./tiles.ts"

type ImagePayload = {
  path: string
  dataURL: string
  slices: TileSlice[]
  selectedIndex?: number
  editable: boolean
  styleName?: string
  styleLibrary?: boolean
}

type ResourcePayload = { path: string; dataURL: string }[]

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!
const title = $("#picker-title")
const styleName = $("#picker-style")
const subtitle = $("#picker-subtitle")
const back = $("#picker-back") as HTMLButtonElement
const backLabel = $("#picker-back-label")
const search = $("#resource-search") as HTMLInputElement
const imageView = $("#image-picker-view")
const resourceView = $("#resource-picker-view")
const canvas = $("#picker-canvas") as HTMLCanvasElement
const meta = $("#picker-meta")
const grid = $("#resource-picker-grid")
const empty = $("#resource-empty")
const isTauri = "__TAURI_INTERNALS__" in window

let imagePayload: ImagePayload | undefined
let image: HTMLImageElement | undefined
let scale = 1
let fit = 1
let zoom = 1
let offset: TilePoint = { x: 0, y: 0 }
let resources: ResourcePayload = []
let resourcesLoaded = false
let view: "empty" | "image" | "resources" = "empty"

function setWindowTitle(text: string): void {
  if (isTauri) void getCurrentWindow().setTitle(text)
}

// 窗口高度不固定：测量页面内容高度后调整窗口高度，跟随图片大小变动（宽度保持不变）
async function fitWindowHeight(): Promise<void> {
  if (!isTauri) return
  const appWindow = getCurrentWindow()
  const [inner, outer] = await Promise.all([appWindow.innerSize(), appWindow.outerSize()])
  const scaleFactor = inner.height / window.innerHeight
  const chrome = (outer.height - inner.height) / scaleFactor
  // documentElement.scrollHeight 不小于视口高度，窗口只会变大不会缩小，所以量 body
  // 画布区域限高后内部滚动，加回它被截掉的部分才是完整内容高度
  const stage = $(".picker-canvas-stage")
  const content = document.body.scrollHeight - stage.clientHeight + stage.scrollHeight
  void appWindow.setSize(new LogicalSize(outer.width / scaleFactor, Math.ceil(content + chrome)))
}

function drawImage(): void {
  if (!image?.naturalWidth || !imagePayload) return
  scale = drawSlicePicker(canvas, image, imagePayload.slices, imagePayload.selectedIndex, fit * zoom, { normal: "#0a84ff", selected: "#ff453a" })
  offset = { x: 0, y: 0 }
}

function filterResources(): void {
  const query = search.value.trim().toLocaleLowerCase()
  let visible = 0
  for (const button of Array.from(grid.querySelectorAll<HTMLButtonElement>("button"))) {
    button.hidden = Boolean(query) && !button.dataset.path?.toLocaleLowerCase().includes(query)
    if (!button.hidden) visible++
  }
  empty.hidden = !resourcesLoaded || visible > 0
}

function renderResources(): void {
  grid.replaceChildren()
  for (const resource of resources) {
    const button = document.createElement("button")
    button.type = "button"
    button.dataset.path = resource.path
    button.title = resource.path
    button.classList.toggle("active", resource.path === imagePayload?.path)
    const preview = document.createElement("img")
    preview.src = resource.dataURL
    preview.alt = ""
    const name = document.createElement("span")
    name.textContent = resource.path.split("/").pop() ?? resource.path
    button.append(preview, name)
    // 同一个窗口既显示切片也显示全部图片列表，由主窗口决定选完之后是切图还是关窗。
    button.addEventListener("click", () => {
      if (isTauri) void emitTo("main", "resource-picker-select", { path: resource.path })
    })
    grid.append(button)
  }
  subtitle.textContent = resources.length ? `${resources.length} 张图片` : "正在读取图片资源"
  filterResources()
}

function showEmptyView(): void {
  view = "empty"
  imageView.hidden = true
  resourceView.hidden = true
  search.hidden = true
  back.hidden = true
  styleName.hidden = true
  subtitle.hidden = true
}

function showSliceView(): void {
  view = "image"
  imageView.hidden = false
  resourceView.hidden = true
  search.hidden = true
  back.hidden = !imagePayload
  backLabel.textContent = imagePayload?.styleLibrary ? "全部样式" : "全部图片"
  back.setAttribute("aria-label", `返回${backLabel.textContent}`)
  if (imagePayload) title.textContent = imagePayload.path.split("/").pop() ?? imagePayload.path
  styleName.hidden = !styleName.textContent
  subtitle.hidden = true
  setWindowTitle("图片切片")
}

function showResourceList(): void {
  view = "resources"
  imageView.hidden = true
  resourceView.hidden = false
  search.hidden = false
  back.hidden = !imagePayload
  backLabel.textContent = "图片切片"
  back.setAttribute("aria-label", "返回图片切片")
  styleName.hidden = true
  subtitle.hidden = false
  title.textContent = "全部图片"
  search.value = ""
  renderResources()
  setWindowTitle("全部图片")
  // 资源列表按需拉取，避免每次打开切片窗口都编码全部图片。
  if (isTauri && !resources.length) void emitTo("main", "image-picker-resources-request")
}

function showImage(payload: ImagePayload): void {
  imagePayload = payload
  styleName.textContent = payload.styleName ?? ""
  showSliceView()
  meta.textContent = `${payload.slices.length ? "点击图片中的切片以修改引用" : "此图片没有可用的 TIL 切片"} · ⌘/Ctrl + 滚轮或双指捏合缩放`
  canvas.style.cursor = payload.editable && payload.slices.length ? "crosshair" : "default"
  image = new Image()
  image.onload = () => {
    if (!image) return
    fit = Math.min(1200 / image.naturalWidth, 760 / image.naturalHeight, 1)
    zoom = 1
    drawImage()
    void fitWindowHeight()
  }
  image.src = payload.dataURL
}

document.title = "图片切片"
showEmptyView()
back.addEventListener("click", () => {
  if (view === "image" && imagePayload?.styleLibrary && isTauri) void emitTo("main", "image-picker-back-styles")
  else if (view === "image") showResourceList()
  else if (imagePayload) showSliceView()
})
search.addEventListener("input", filterResources)
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !event.isComposing && isTauri) void getCurrentWindow().close()
})
bindSlicePickerZoom($(".picker-canvas-stage"), canvas, (factor) => {
  zoom = Math.min(MAX_SLICE_ZOOM, Math.max(MIN_SLICE_ZOOM, zoom * factor))
  drawImage()
})
canvas.addEventListener("click", (event) => {
  if (!imagePayload?.editable || !image || !imagePayload.slices.length) return
  const bounds = canvas.getBoundingClientRect()
  const point = {
    x: ((event.clientX - bounds.left) / bounds.width * canvas.width - offset.x) / scale,
    y: ((event.clientY - bounds.top) / bounds.height * canvas.height - offset.y) / scale,
  }
  const selected = tileSliceAt(imagePayload.slices, point)
  if (!selected) return
  imagePayload.selectedIndex = selected.index
  drawImage()
  if (isTauri) void emitTo("main", "image-picker-select", { index: selected.index })
})

if (isTauri) {
  await listen<ImagePayload>("image-picker-data", (event) => showImage(event.payload))
  await listen("image-picker-show-list", () => showResourceList())
  await listen<ResourcePayload>("image-picker-resources-data", (event) => {
    resources = event.payload
    resourcesLoaded = true
    renderResources()
  })
  void emitTo("main", "picker-window-ready")
}
