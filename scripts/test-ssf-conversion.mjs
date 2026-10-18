// An SSF skin exported to BDI/BDS/BDA must keep the 1080 layout skeleton (the BDA skin's panel), not
// the old 480-wide BDS template. Drives the real export menu, then reopens every download.
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { chromium } from "playwright"
import { createServer } from "vite"
import { ssfFixture } from "../tests/helpers/ssf-fixture.mjs"
import { decodePng } from "../src/ssf/ssf-png.ts"

const shots = process.env.SSF_CONVERSION_SHOTS
const sample = process.env.SSF_SKIN_PATH
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
  const { panel, pixels } = await page.evaluate(async () => {
    const { preview } = await import("/src/app/canvas-interaction.ts")
    await document.fonts.ready
    await preview.rendered()
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    await preview.rendered()
    return { panel: [preview.panelWidth, preview.panelHeight], pixels: preview.canvas.toDataURL("image/png").split(",")[1] }
  })
  const png = Buffer.from(pixels, "base64")
  if (shots) writeFileSync(`${shots}/${name}.png`, png)
  return { panel, hash: createHash("sha256").update(decodePng(png).data).digest("hex") }
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

try {
  // Force the browser's <a download> fallback so Playwright can observe the exported file.
  await page.addInitScript(() => {
    delete window.showSaveFilePicker
    window.showSaveFilePicker = undefined
  })
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/`)
  await page.locator("#browser-open").setInputFiles({ name: sample?.split("/").pop() ?? "分辨率.ssf", mimeType: "application/octet-stream", buffer: sample ? readFileSync(sample) : Buffer.from(ssfFixture()) })
  await page.waitForFunction(() => !document.querySelector("#open").disabled)
  await closeDialog()
  assert.match(await panelSize(), /1080 × 64\d/, "source SSF preview on the Sogou skeleton")

  // Export every format while the SSF document is still open: a reopened BDI/BDS hides the BDA target.
  const exported = {}
  for (const [format, platform] of [["bdi", ""], ["bds", ""], ["bda", "android"]]) {
    const file = await download(async () => {
      await openMenu()
      await page.locator(`.pen-file-menu [data-export-format="${format}"]${platform ? `[data-bda-platform="${platform}"]` : ""}`).click()
    })
    exported[format] = readFileSync(await file.path())
    await closeDialog()
  }

  let convertedKeys
  for (const format of ["bdi", "bds", "bda"]) {
    await reopen(`转换.${format}`, exported[format])
    assert.match(await panelSize(), /1080 × 641/, `${format}: the BDA panel resolution`)
    const keys = await keyCount()
    assert.ok(keys > 10, `${format}: ${keys} keys`)
    convertedKeys ??= keys
    assert.equal(keys, convertedKeys, `${format}: same key set as the other Baidu formats`)
    const state = await snapshot(`converted-${format}`)
    assert.deepEqual(state.panel, [1080, 641], `${format}: canvas panel`)
  }
  console.log(`SSF conversion: BDI/BDS/BDA open at 1080 × 641 with ${convertedKeys} keys${shots ? `, screenshots in ${shots}` : ""}`)
  assert.deepEqual(errors, [])
} catch (error) {
  await page.screenshot({ path: "/tmp/bdi-ssf-conversion-failure.png" }).catch(() => {})
  throw error
} finally {
  await browser.close()
  await server.close()
}
