import { emitTo, listen } from "@tauri-apps/api/event"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { tileSliceAt, type TilePoint, type TileSlice } from "./tiles.ts"

type ImagePayload = {
  path: string
  dataURL: string
  slices: TileSlice[]
  selectedIndex?: number
  editable: boolean
}

type ResourcePayload = { path: string; dataURL: string }[]

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!
const title = $("#picker-title")
const subtitle = $("#picker-subtitle")
const chooseResource = $("#choose-resource") as HTMLButtonElement
const search = $("#resource-search") as HTMLInputElement
const imageView = $("#image-picker-view")
const resourceView = $("#resource-picker-view")
const canvas = $("#picker-canvas") as HTMLCanvasElement
const meta = $("#picker-meta")
const grid = $("#resource-picker-grid")
const empty = $("#resource-empty")
const mode = new URLSearchParams(location.search).get("mode") === "resource" ? "resource" : "image"
const isTauri = "__TAURI_INTERNALS__" in window

let imagePayload: ImagePayload | undefined
let image: HTMLImageElement | undefined
let scale = 1
let offset: TilePoint = { x: 0, y: 0 }

function drawImage(): void {
  const context = canvas.getContext("2d")
  if (!context || !image?.naturalWidth || !imagePayload) return
  scale = Math.min(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight)
  const width = image.naturalWidth * scale
  const height = image.naturalHeight * scale
  offset = { x: (canvas.width - width) / 2, y: (canvas.height - height) / 2 }
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, offset.x, offset.y, width, height)
  const lineWidth = Math.max(1, Math.round(Math.min(width, height) / 350))
  context.font = `${Math.max(11, lineWidth * 7)}px ui-monospace, monospace`
  context.textBaseline = "top"
  for (const slice of imagePayload.slices) {
    const [x, y, sliceWidth, sliceHeight] = slice.source
    const selected = slice.index === imagePayload.selectedIndex
    context.lineWidth = selected ? lineWidth * 2 : lineWidth
    context.strokeStyle = selected ? "#ff453a" : "#0a84ff"
    context.strokeRect(offset.x + x * scale, offset.y + y * scale, sliceWidth * scale, sliceHeight * scale)
    context.fillStyle = context.strokeStyle
    context.fillRect(offset.x + x * scale, offset.y + y * scale, context.measureText(`IMG${slice.index}`).width + 6, 15)
    context.fillStyle = "#fff"
    context.fillText(`IMG${slice.index}`, offset.x + x * scale + 3, offset.y + y * scale + 2)
  }
}

function showImage(payload: ImagePayload): void {
  imagePayload = payload
  title.textContent = payload.path.split("/").pop() ?? payload.path
  subtitle.textContent = "选择切片"
  meta.textContent = payload.slices.length ? "点击图片中的切片以修改引用" : "此图片没有可用的 TIL 切片"
  canvas.style.cursor = payload.editable && payload.slices.length ? "crosshair" : "default"
  image = new Image()
  image.onload = () => {
    if (!image) return
    const fit = Math.min(1200 / image.naturalWidth, 760 / image.naturalHeight, 1)
    canvas.width = Math.max(1, Math.round(image.naturalWidth * fit))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * fit))
    drawImage()
  }
  image.src = payload.dataURL
}

function showResources(resources: ResourcePayload): void {
  grid.replaceChildren()
  title.textContent = "选择图片资源"
  subtitle.textContent = `${resources.length} 张图片`
  for (const resource of resources) {
    const button = document.createElement("button")
    button.type = "button"
    button.dataset.path = resource.path
    button.title = resource.path
    const preview = document.createElement("img")
    preview.src = resource.dataURL
    preview.alt = ""
    const name = document.createElement("span")
    name.textContent = resource.path.split("/").pop() ?? resource.path
    button.append(preview, name)
    button.addEventListener("click", () => {
      if (isTauri) {
        void emitTo("main", "resource-picker-select", { path: resource.path })
        void getCurrentWindow().close()
      }
    })
    grid.append(button)
  }
  filterResources()
}

function filterResources(): void {
  const query = search.value.trim().toLocaleLowerCase()
  let visible = 0
  for (const button of Array.from(grid.querySelectorAll<HTMLButtonElement>("button"))) {
    button.hidden = Boolean(query) && !button.dataset.path?.toLocaleLowerCase().includes(query)
    if (!button.hidden) visible++
  }
  empty.hidden = visible > 0
}

if (mode === "resource") {
  document.title = "选择图片资源"
  imageView.hidden = true
  resourceView.hidden = false
  chooseResource.hidden = true
  search.hidden = false
  search.addEventListener("input", filterResources)
  if (isTauri) await listen<ResourcePayload>("resource-picker-data", (event) => showResources(event.payload))
} else {
  document.title = "图片切片"
  chooseResource.addEventListener("click", () => {
    if (isTauri) void emitTo("main", "resource-picker-open")
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
  if (isTauri) await listen<ImagePayload>("image-picker-data", (event) => showImage(event.payload))
}

if (isTauri) void emitTo("main", "picker-window-ready", { mode })
