import puppeteer from "puppeteer-core"

const skin = "/Users/kaze/Downloads/蒋·Grid M版.bds"
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
await clickCanvas(qx, qy)
await sleep(400)
const editQ = await page.$eval('input[data-key-field="CENTER"]', (el) => el.value)
console.log("edit q CENTER", JSON.stringify(editQ))
await page.screenshot({ path: "/tmp/grid-edit-q.png" })

await clickCanvas(mx, my)
await sleep(400)
const editM = await page.$eval('input[data-key-field="CENTER"]', (el) => el.value)
console.log("edit m CENTER", JSON.stringify(editM))

await page.click('[data-mode-choice="preview"]')
await sleep(200)
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

await browser.close()

if (editQ !== "q") throw new Error("edit did not select q, got " + editQ)
if (editM !== "m") throw new Error("edit did not select m, got " + editM)
if (!previewQ.includes("KEY83")) throw new Error("preview q missed KEY83: " + previewQ)
if (!previewM.includes("KEY8")) throw new Error("preview m missed KEY8: " + previewM)
if (!previewShift.includes("KEY6")) throw new Error("preview F10 missed KEY6: " + previewShift)
console.log("✓ browser Grid 26-key: edit+preview hit q/m/F10")
