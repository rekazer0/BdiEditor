// Export via the real menu, download and reopen. BDI/BDS must match the source SSF canvas pixels.
// BDA has its own geometry and receives a separate reopen smoke check.
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { chromium } from "playwright"
import { createServer } from "vite"
import { ssfFixture } from "../tests/helpers/ssf-fixture.mjs"
import { decodePng } from "../src/ssf/ssf-png.ts"

const shots = process.env.SSF_CONVERSION_SHOTS
const sample = process.env.SSF_SKIN_PATH
const broken = process.env.SSF_CONVERSION_INPUT
if (shots) mkdirSync(shots, { recursive: true })
const server = await createServer({ root: new URL("..", import.meta.url).pathname, logLevel: "error", server: { port: 41811, strictPort: false, host: "127.0.0.1" } })
await server.listen()
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2, acceptDownloads: true, bypassCSP: true })
const errors = []
page.on("pageerror", (error) => errors.push(error.message))
page.on("dialog", (dialog) => dialog.accept())

const panelSize = () => page.evaluate(() => document.querySelector("#panel-status")?.textContent ?? "")
const keyCount = () => page.evaluate(async () => (await import("/src/app/canvas-interaction.ts")).preview.keys.length)
const snapshot = async (name) => {
  const result = await page.evaluate(async () => {
    const { preview, toolbarPreview, candidateBackgroundPreview } = await import("/src/app/canvas-interaction.ts")
    const previews = [preview, toolbarPreview, candidateBackgroundPreview]
    await Promise.all(previews.map((item) => item.resolver?.ready?.()))
    previews.forEach((item) => item.draw())
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    await Promise.all(previews.map((item) => item.rendered()))
    const canvas = document.createElement("canvas")
    canvas.width = preview.canvas.width
    canvas.height = preview.canvas.height + toolbarPreview.canvas.height
    const context = canvas.getContext("2d")
    context.drawImage(candidateBackgroundPreview.canvas, 0, 0)
    context.drawImage(toolbarPreview.canvas, 0, 0)
    context.drawImage(preview.canvas, 0, toolbarPreview.canvas.height)
    return {
      panel: [preview.panelWidth, preview.panelHeight],
      keys: preview.keys.map(({ center, rect }) => ({ center, rect })),
      icons: toolbarPreview.keys.filter((item) => /^ICON\d+$/.test(item.section)).map(({ center, rect }) => ({ center, rect })),
      pixels: canvas.toDataURL("image/png").split(",")[1],
    }
  })
  const png = Buffer.from(result.pixels, "base64")
  if (shots) writeFileSync(`${shots}/${name}.png`, png)
  const image = decodePng(png)
  delete result.pixels
  return { ...result, hash: createHash("sha256").update(image.data).digest("hex"), imageSize: [image.width, image.height] }
}
const closeDialog = async () => {
  await page.waitForFunction(() => {
    const dialog = document.querySelector("#file-operation-dialog")
    return !dialog?.open || !document.querySelector("#file-operation-close")?.disabled
  }, null, { timeout: 60000 })
  const close = page.locator("#file-operation-dialog[open] #file-operation-close")
  if (await close.isVisible().catch(() => false)) await close.click()
}
const openMenu = async () => {
  const menu = page.locator(".pen-file-menu")
  if (!(await menu.evaluate((node) => node.open))) await menu.locator("> summary").click()
}
const download = async (trigger) => {
  const pending = page.waitForEvent("download", { timeout: 120000 })
  pending.catch(() => {})
  await trigger()
  const tap = page.locator("#file-operation-dialog[open] button.primary", { hasText: "下载" })
  const tapped = tap.waitFor({ state: "visible", timeout: 120000 }).then(() => "tap")
  tapped.catch(() => {})
  const result = await Promise.race([pending, tapped])
  if (result === "tap") {
    await tap.click()
    return pending
  }
  return result
}
const reopen = async (name, bytes) => {
  await page.locator("#browser-open").setInputFiles({ name, mimeType: "application/octet-stream", buffer: Buffer.from(bytes) })
  await page.waitForFunction((file) => document.querySelector("#document-name")?.textContent?.includes(file.replace(/\.[^.]+$/, "")), name, { timeout: 60000 })
  await closeDialog()
  await page.waitForFunction(() => !document.querySelector("#open")?.disabled, null, { timeout: 60000 })
}

const views = []
for (const theme of ["light", "dark"]) for (const orientation of ["port", "land"]) {
  for (const board of ["py_9", "py_26", "py_9_big_enter_double_input", "big_9"]) views.push({ theme, orientation, board, name: `${theme}-${orientation}-${board}` })
}
const chooseView = async ({ theme, orientation, board }) => {
  await page.locator(`[data-theme-choice="${theme}"]`).click()
  await page.locator(`[data-orientation-choice="${orientation}"]`).click()
  await page.evaluate(() => document.querySelectorAll("#files .nav-group").forEach((group) => { group.open = true }))
  await page.locator(`.sidebar-overview button[data-path="${theme}/skin/${orientation}/${board}.ini"]`).click()
}

try {
  // Force the browser's <a download> fallback so Playwright can observe the exported file.
  await page.addInitScript(() => {
    delete window.showSaveFilePicker
    window.showSaveFilePicker = undefined
  })
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/`)
  let reported
  if (broken) {
    await reopen(broken.split("/").pop(), readFileSync(broken))
    reported = await snapshot("reported-broken-bdi")
    if (shots) await page.screenshot({ path: `${shots}/reported-broken-editor.png` })
  }
  await page.locator("#browser-open").setInputFiles({ name: sample?.split("/").pop() ?? "分辨率.ssf", mimeType: "application/octet-stream", buffer: sample ? readFileSync(sample) : Buffer.from(ssfFixture()) })
  await page.waitForFunction(() => !document.querySelector("#open").disabled)
  await closeDialog()
  const source = new Map()
  for (const view of views) {
    await chooseView(view)
    const state = await snapshot(`source-${view.name}`)
    assert.equal(state.icons.length, 7, `${view.name}: seven toolbar icons`)
    assert.ok(state.icons.every((icon) => icon.center), `${view.name}: toolbar actions`)
    source.set(view.name, state)
  }
  if (reported) assert.notEqual(reported.hash, source.get(views[0].name).hash, "reported BDI reproduces the regression")

  // Export every format while the SSF document is still open: a reopened BDI/BDS hides the BDA target.
  const exported = {}
  for (const [format, platform] of [["bdi", ""], ["bds", ""], ["bda", "android"]]) {
    const file = await download(async () => {
      await openMenu()
      await page.locator(`.pen-file-menu [data-export-format="${format}"]${platform ? `[data-bda-platform="${platform}"]` : ""}`).click()
    })
    exported[format] = readFileSync(await file.path())
    if (shots) await file.saveAs(`${shots}/converted.${format}`)
    await closeDialog()
  }

  const comparisons = []
  for (const format of ["bdi", "bds"]) {
    await reopen(`转换.${format}`, exported[format])
    for (const view of views) {
      await chooseView(view)
      const state = await snapshot(`${format}-${view.name}`)
      assert.deepEqual(state, source.get(view.name), `${format} ${view.name}: geometry, toolbar and every canvas pixel match the SSF`)
      comparisons.push({ format, view: view.name, hash: state.hash, imageSize: state.imageSize, equal: true })
    }
    await chooseView(views[0])
    if (shots) await page.screenshot({ path: `${shots}/converted-${format}-editor.png` })
  }
  await reopen("转换.bda", exported.bda)
  assert.match(await panelSize(), /1080 × 641/)
  assert.ok(await keyCount() > 10)
  assert.deepEqual(errors, [])
  if (shots) writeFileSync(`${shots}/results.json`, JSON.stringify({ sample, broken, reported, comparisons, pageErrors: errors }, null, 2))
  console.log(`SSF export: ${comparisons.length} BDI/BDS views match the source SSF pixel for pixel after menu export, download and reopen; BDA reopen smoke passed${sample ? ` (${sample})` : ""}${shots ? `; artifacts: ${shots}` : ""}`)
} catch (error) {
  await page.screenshot({ path: "/tmp/bdi-ssf-conversion-failure.png" }).catch(() => {})
  throw error
} finally {
  await browser.close()
  await server.close()
}
