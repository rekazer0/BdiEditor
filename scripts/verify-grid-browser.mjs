import puppeteer from "puppeteer-core"

const skin = process.argv[2]
if (!skin) throw new Error("usage: node scripts/verify-grid-browser.mjs <skin.bds>")
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: ["--no-sandbox", "--disable-gpu"],
})
const page = await browser.newPage()
page.setDefaultTimeout(30000)
await page.setViewport({ width: 1440, height: 900 })
await page.goto("http://127.0.0.1:1420/", { waitUntil: "networkidle0" })
await (await page.$("#browser-open")).uploadFile(skin)
await page.waitForFunction(() => (document.querySelector("#panel-status")?.textContent ?? "").includes("1242"))
await sleep(400)

await page.evaluate(() => {
  const node = [...document.querySelectorAll("[data-path]")].find((item) =>
    item.getAttribute("data-path") === "light/skin/port/py_26.ini")
  if (!node) throw new Error("missing py_26.ini nav")
  node.click()
})
await sleep(1000)

async function clickCanvas(nx, ny) {
  const box = await (await page.$("#preview")).boundingBox()
  if (!box) throw new Error("no canvas box")
  await page.mouse.click(box.x + box.width * nx, box.y + box.height * ny)
}

const qx = (26 + 119 / 2) / 1242
const qy = (5 + 150 / 2) / 631
const mx = (919 + 119 / 2) / 1242
const my = (285 + 150 / 2) / 631
const shiftX = (25 + 179 / 2) / 1242
const shiftY = (285 + 150 / 2) / 631

await page.click('[data-mode-choice="edit"]')
await sleep(200)
await page.evaluate(() => {
  const getImageData = CanvasRenderingContext2D.prototype.getImageData
  window.__crosshairPixelReads = 0
  CanvasRenderingContext2D.prototype.getImageData = function (...args) {
    window.__crosshairPixelReads++
    return getImageData.apply(this, args)
  }
})
const canvasBox = await (await page.$("#preview")).boundingBox()
if (!canvasBox) throw new Error("no canvas box")
await page.mouse.move(canvasBox.x + canvasBox.width * qx, canvasBox.y + canvasBox.height * qy)
await sleep(20)
const crosshair = await page.$eval("#preview-coordinates", (el) => ({
  hidden: el.hidden,
  x: document.querySelector("#preview-coordinate-x")?.textContent,
  y: document.querySelector("#preview-coordinate-y")?.textContent,
  width: Number(document.querySelector("#preview")?.dataset.logicalWidth),
  height: Number(document.querySelector("#preview")?.dataset.logicalHeight),
  bounds: el.getBoundingClientRect().toJSON(),
  wrapBounds: document.querySelector(".canvas-wrap")?.getBoundingClientRect().toJSON(),
  cursor: getComputedStyle(document.querySelector("#preview")).cursor,
  background: getComputedStyle(document.querySelector(".preview-crosshair")).backgroundImage,
  blendMode: getComputedStyle(document.querySelector(".preview-crosshair")).mixBlendMode,
  pixelReads: window.__crosshairPixelReads,
}))
if (crosshair.hidden || crosshair.x !== String(Math.round(26 + 119 / 2)) || crosshair.y !== String(Math.round(5 + 150 / 2)) ||
  crosshair.bounds.x !== crosshair.wrapBounds.x || crosshair.bounds.y !== crosshair.wrapBounds.y ||
  crosshair.bounds.width !== crosshair.wrapBounds.width || crosshair.bounds.height !== crosshair.wrapBounds.height || crosshair.cursor !== "none" ||
  crosshair.background.split("linear-gradient").length !== 3 || crosshair.blendMode !== "normal" ||
  crosshair.pixelReads !== 0) {
  throw new Error("edit crosshair missed key center snap: " + JSON.stringify(crosshair))
}
await page.click("#toggle-guides")
const guides = await page.$eval("#panel-viewport .preview-guides", (el) => ({
  hidden: el.hidden,
  rects: el.querySelectorAll("rect").length,
  vectorEffect: getComputedStyle(el.querySelector("rect")).vectorEffect,
}))
if (guides.hidden || guides.rects === 0 || guides.vectorEffect !== "non-scaling-stroke") {
  throw new Error("guides are not rendered as a scalable vector overlay: " + JSON.stringify(guides))
}
for (let index = 0; index < 10; index++) await page.click("#preview-zoom-in")
await sleep(200)
const canvasResolution = await page.$eval("#preview", (el) => {
  const bounds = el.getBoundingClientRect()
  return { width: el.width, height: el.height, displayWidth: bounds.width, displayHeight: bounds.height, pixelRatio: devicePixelRatio }
})
if (canvasResolution.width < Math.round(canvasResolution.displayWidth * canvasResolution.pixelRatio) ||
  canvasResolution.height < Math.round(canvasResolution.displayHeight * canvasResolution.pixelRatio)) {
  throw new Error("zoomed keyboard canvas is below display resolution: " + JSON.stringify(canvasResolution))
}
await page.click("#preview-zoom-fit")
await sleep(200)
await page.$eval("#editor-crosshair", (el) => el.click())
await page.mouse.move(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2)
const staticCoordinates = await page.$eval("#preview-coordinates", (el) => ({
  hidden: el.hidden,
  x: document.querySelector("#preview-coordinate-x")?.textContent,
  y: document.querySelector("#preview-coordinate-y")?.textContent,
  crosshair: getComputedStyle(document.querySelector(".preview-crosshair")).display,
  left: getComputedStyle(el).left,
  bottom: getComputedStyle(el).bottom,
}))
if (staticCoordinates.hidden || staticCoordinates.x !== String(Math.floor(crosshair.width / 2)) ||
  staticCoordinates.y !== String(Math.floor(crosshair.height / 2)) || staticCoordinates.crosshair !== "none" ||
  staticCoordinates.left !== "14px" || staticCoordinates.bottom !== "14px") {
  throw new Error("crosshair setting did not restore static coordinates: " + JSON.stringify(staticCoordinates))
}
await page.$eval("#editor-crosshair", (el) => el.click())
const candidateBox = await (await page.$("#toolbar-strip")).boundingBox()
if (!candidateBox) throw new Error("no candidate box")
const candidateSize = await page.$eval("#toolbar-preview", (el) => ({
  width: Number(el.dataset.logicalWidth),
  height: Number(el.dataset.logicalHeight),
}))
await page.mouse.move(
  candidateBox.x + candidateBox.width * (0.5 + 4 / candidateSize.width),
  candidateBox.y + candidateBox.height * (0.5 + 4 / candidateSize.height),
)
const candidateCrosshair = await page.$eval("#preview-coordinates", (el) => ({
  hidden: el.hidden,
  x: document.querySelector("#preview-coordinate-x")?.textContent,
  y: document.querySelector("#preview-coordinate-y")?.textContent,
  width: Number(document.querySelector("#toolbar-preview")?.dataset.logicalWidth),
  height: Number(document.querySelector("#toolbar-preview")?.dataset.logicalHeight),
}))
if (candidateCrosshair.hidden || candidateCrosshair.x !== String(Math.round(candidateCrosshair.width / 2)) ||
  candidateCrosshair.y !== String(Math.round(candidateCrosshair.height / 2))) {
  throw new Error("candidate crosshair missed center snap: " + JSON.stringify(candidateCrosshair))
}
await clickCanvas(qx, qy)
await sleep(400)
if (await page.$eval("#preview-coordinates", (el) => el.hidden)) throw new Error("crosshair flashed off after key click")
const editQ = await page.$eval('input[data-key-field="CENTER"]', (el) => el.value)
console.log("edit q CENTER", JSON.stringify(editQ))
await page.screenshot({ path: "/tmp/grid-edit-q.png" })

await clickCanvas(mx, my)
await sleep(400)
const editM = await page.$eval('input[data-key-field="CENTER"]', (el) => el.value)
console.log("edit m CENTER", JSON.stringify(editM))

await page.click('[data-mode-choice="preview"]')
await sleep(200)
await page.mouse.move(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2)
if (!await page.$eval("#preview-coordinates", (el) => el.hidden)) throw new Error("crosshair visible in preview mode")
await clickCanvas(qx, qy)
await sleep(400)
const previewQ = await page.$eval("#event-log", (el) => el.textContent ?? "")
console.log("preview q", previewQ)
await page.screenshot({ path: "/tmp/grid-preview-q.png" })

await clickCanvas(mx, my)
await sleep(400)
const previewM = await page.$eval("#event-log", (el) => el.textContent ?? "")
console.log("preview m", previewM)

await clickCanvas(shiftX, shiftY)
await sleep(400)
const previewShift = await page.$eval("#event-log", (el) => el.textContent ?? "")
console.log("preview shift/F10", previewShift)

await page.click("#preview-zoom-fit", { clickCount: 2 })
if (!await page.$eval("#preview-zoom-fit", (el) => el.getAttribute("aria-pressed") === "true")) {
  throw new Error("double-click did not lock canvas panning")
}
const lockedCanvasBox = await (await page.$("#preview")).boundingBox()
if (!lockedCanvasBox) throw new Error("no locked canvas box")
await page.mouse.move(lockedCanvasBox.x + lockedCanvasBox.width * qx, lockedCanvasBox.y + lockedCanvasBox.height * qy)
await page.mouse.down()
await page.mouse.move(lockedCanvasBox.x + lockedCanvasBox.width * qx + 40, lockedCanvasBox.y + lockedCanvasBox.height * qy)
await page.mouse.up()
const lockedSwipe = await page.$eval("#event-log", (el) => el.textContent ?? "")
if (!lockedSwipe.includes("RIGHT")) throw new Error("locked key drag missed RIGHT swipe: " + lockedSwipe)

await browser.close()

if (editQ !== "q") throw new Error("edit did not select q, got " + editQ)
if (editM !== "m") throw new Error("edit did not select m, got " + editM)
if (!previewQ.includes("KEY83")) throw new Error("preview q missed KEY83: " + previewQ)
if (!previewM.includes("KEY8")) throw new Error("preview m missed KEY8: " + previewM)
if (!previewShift.includes("KEY6")) throw new Error("preview F10 missed KEY6: " + previewShift)
console.log("✓ browser Grid 26-key: edit+preview hit q/m/F10")
