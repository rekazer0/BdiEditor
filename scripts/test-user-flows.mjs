// End-to-end user simulation: drives every editor feature the way a person would.
// Run: node scripts/test-user-flows.mjs
// Starts a Vite dev server (or uses BASE_URL) and drives Chromium through Playwright
// (set PLAYWRIGHT_MODULE / CHROMIUM_PATH like test-mobile-layout.mjs). Real skins from
// REAL_SKINS_DIR (default /Users/kaze/work/bd) are opened when that folder exists.
import assert from "node:assert/strict"
import { execSync } from "node:child_process"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { deflateSync } from "node:zlib"

async function loadPlaywright() {
  const candidates = [process.env.PLAYWRIGHT_MODULE, "playwright"]
  try {
    candidates.push(join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright", "index.mjs"))
  } catch {}
  for (const candidate of candidates.filter(Boolean)) {
    try {
      return await import(candidate.startsWith("/") ? pathToFileURL(candidate).href : candidate)
    } catch {}
  }
  throw new Error("Playwright is not installed; install it or set PLAYWRIGHT_MODULE")
}

const { chromium } = await loadPlaywright()
let server
let baseURL = process.env.BASE_URL
if (!baseURL) {
  const { createServer } = await import("vite")
  const root = new URL("..", import.meta.url).pathname
  server = await createServer({ root, logLevel: "error", server: { port: 41731, strictPort: false, host: "127.0.0.1" } })
  await server.listen()
  baseURL = `http://127.0.0.1:${server.httpServer.address().port}/`
}
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
const results = []
const mod = process.platform === "darwin" ? "Meta" : "Control"

/** Opens a fresh window; collects page errors and fails the check if any occurred. */
async function withPage(run, { viewport = { width: 1440, height: 900 }, storage = {}, colorScheme = "light" } = {}) {
  // bypassCSP: Playwright polls predicates with new Function(), which the app's CSP forbids.
  const context = await browser.newContext({ viewport, colorScheme, acceptDownloads: true, bypassCSP: true })
  const page = await context.newPage()
  const errors = []
  page.on("pageerror", (error) => errors.push(error.message))
  page.on("dialog", (dialog) => dialog.accept())
  await page.addInitScript((entries) => {
    // Browser downloads go through the <a download> fallback so Playwright can observe them.
    delete window.showSaveFilePicker
    window.showSaveFilePicker = undefined
    for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value)
  }, storage)
  await page.goto(baseURL)
  await page.waitForSelector(".template-card")
  try {
    await run(page)
    assert.deepEqual(errors, [], "page errors")
  } catch (error) {
    if (process.env.FLOW_SHOTS) await page.screenshot({ path: join(process.env.FLOW_SHOTS, `${Date.now()}.png`) }).catch(() => {})
    throw error
  } finally {
    await context.close()
  }
}

let check = async function check(name, run) {
  const started = Date.now()
  try {
    await run()
    results.push({ name, ok: true, ms: Date.now() - started })
  } catch (error) {
    results.push({ name, ok: false, error, ms: Date.now() - started })
  }
}

async function openTemplate(page, template = "official-android-bds") {
  await page.locator(`.template-grid .template-card[data-template="${template}"]`).click()
  await page.waitForSelector(".canvas-wrap:not(.empty)")
  await page.waitForFunction(() => document.querySelector("#preview")?.getBoundingClientRect().height > 60)
  await closeOperationDialog(page)
  await page.waitForFunction(() => !document.querySelector("#open")?.disabled)
}

async function closeOperationDialog(page) {
  // 成功打开时进度弹窗会自己关闭；其他操作完成后才启用「关闭」。
  await page.waitForFunction(() => {
    const dialog = document.querySelector("#file-operation-dialog")
    return !dialog?.open || !document.querySelector("#file-operation-close")?.disabled
  }, null, { timeout: 60000 })
  const close = page.locator("#file-operation-dialog[open] #file-operation-close")
  if (await close.isVisible().catch(() => false)) await close.click()
}

async function editMode(page) {
  await page.getByRole("button", { name: "编辑模式", exact: true }).click()
  await page.waitForFunction(() => document.querySelector("#mode").value === "edit")
}

/** Clicks a point of the keyboard canvas, given as fractions of its size. */
async function clickCanvas(page, fx, fy, options) {
  const box = await page.locator("#preview").boundingBox()
  await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy, options)
}

async function selectKey(page, { timeout = 30000 } = {}) {
  await clickCanvas(page, 0.45, 0.45)
  // BDS/BDI 显示布局分组；BDA 的几何只读，检查器切到按键样式。
  await page.waitForSelector('.key-layout-fields:not([hidden]), #bda-config-fields[data-bda-scope="key"]', { state: "visible", timeout })
}

async function clickCanvasWith(page, key, fx, fy) {
  await page.keyboard.down(key)
  await clickCanvas(page, fx, fy)
  await page.keyboard.up(key)
}

async function railTab(page, name) {
  await page.locator("#mobile-inspector-groups").getByRole("button", { name, exact: true }).click()
}

async function openFileMenu(page) {
  const menu = page.locator(".pen-file-menu")
  if (!(await menu.evaluate((node) => node.open))) await menu.locator("> summary").click()
}

const sourceText = (page) => page.evaluate(() => document.querySelector("#source .cm-content")?.innerText ?? "")
const undoEnabled = (page) => page.locator("#desktop-undo").isEnabled()

/** Minimal valid RGBA PNG for upload flows. */
function pngBytes(width, height, rgba = [40, 120, 220, 255]) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    return c >>> 0
  })
  const crc = (buffer) => {
    let c = 0xffffffff
    for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }
  const chunk = (type, data) => {
    const length = Buffer.alloc(4)
    length.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type), data])
    const sum = Buffer.alloc(4)
    sum.writeUInt32BE(crc(body))
    return Buffer.concat([length, body, sum])
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 6
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: width }, () => rgba).flat())])
  const raw = Buffer.concat(Array.from({ length: height }, () => row))
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ])
}

/* ------------------------------------------------------------------------------------------------
 * 1 · Welcome screen
 * ---------------------------------------------------------------------------------------------- */
const only = process.env.FLOW_ONLY ? new RegExp(process.env.FLOW_ONLY) : undefined
const runCheck = check
// FLOW_ONLY=正则 只运行名称匹配的用例，便于单独复现。
check = async (name, run) => (!only || only.test(name) ? runCheck(name, run) : undefined)

await check("welcome: one recent section, templates, no document controls", () => withPage(async (page) => {
  assert.equal(await page.locator(".welcome-aside").count(), 0, "duplicate recent column removed")
  assert.equal(await page.locator(".template-grid .template-card").count(), 7)
  await page.waitForFunction(() => document.querySelectorAll(".template-grid .template-preview img, .template-grid .template-preview canvas").length >= 3, null, { timeout: 30000 })
  for (const selector of ["#desktop-undo", ".mode-control", "#recent-clear"]) {
    assert.equal(await page.locator(selector).isVisible(), false, `${selector} hidden without a skin`)
  }
  assert.equal(await page.getByRole("button", { name: /^打开皮肤/ }).filter({ visible: true }).count(), 1, "a single open button")
  await openFileMenu(page)
  for (const id of ["#new", "#open"]) assert.equal(await page.locator(id).isEnabled(), true, `${id} enabled`)
  for (const id of ["#save", "#panel-scale", "#replace-layout-image", "#adapt-ios26"]) assert.equal(await page.locator(id).isDisabled(), true, `${id} disabled`)
  await page.keyboard.press("Escape")
  assert.equal(await page.locator(".pen-file-menu").evaluate((node) => node.open), false, "Escape closes the menu")
}))

/* ------------------------------------------------------------------------------------------------
 * 2 · Every built-in template opens and renders in both modes
 * ---------------------------------------------------------------------------------------------- */
for (const template of ["default-android", "official-android-bds", "xiaomi-unified-rounded-blur", "oppo-dual-color", "iqoo-rounded-black", "huawei-swipe-symbols-1080", "oppo-swipe-down"]) {
  await check(`template ${template}: opens, previews and edits`, () => withPage(async (page) => {
    await openTemplate(page, template)
    assert.match(await page.locator("#document-name").textContent(), /\.(bds|bda)$/)
    await editMode(page)
    await selectKey(page)
    assert.ok(await page.locator("#mobile-inspector-groups button").count() >= 1, "inspector categories")
    const sidebarItems = await page.locator(".sidebar-overview button[data-path]:visible").count()
    assert.ok(sidebarItems > 0, `sidebar lists items (${sidebarItems})`)
  }))
}

/* ------------------------------------------------------------------------------------------------
 * 3 · New skin dialog
 * ---------------------------------------------------------------------------------------------- */
await check("new skin dialog: validation, cancel and create", () => withPage(async (page) => {
  await openFileMenu(page)
  await page.locator("#new").click()
  const dialog = page.locator("#new-project-dialog")
  await dialog.waitFor({ state: "visible" })
  const names = await dialog.locator("strong").allTextContents()
  for (const name of ["百度 BDA 默认", "百度 BDS 旧版", "OPPO 双色", "iQOO 圆角黑"]) assert.ok(names.some((text) => text.includes(name)), `dialog names match welcome cards: ${name}`)
  await dialog.locator("[name=project-name]").fill("../bad")
  await dialog.getByRole("button", { name: "创建皮肤", exact: true }).click()
  assert.equal(await dialog.isVisible(), true, "invalid name keeps the dialog open")
  await dialog.getByRole("button", { name: "取消", exact: true }).click()
  await dialog.waitFor({ state: "hidden" })
  await openFileMenu(page)
  await page.locator("#new").click()
  await dialog.locator("[name=project-name]").fill("用户流程测试")
  await dialog.locator("input[value=oppo-dual-color]").check()
  await dialog.getByRole("button", { name: "创建皮肤", exact: true }).click()
  await page.waitForFunction(() => document.querySelector("#document-name")?.textContent?.includes("用户流程测试"), null, { timeout: 30000 })
}))

/* ------------------------------------------------------------------------------------------------
 * 4 · Interactive preview and canvas toolbar
 * ---------------------------------------------------------------------------------------------- */
await check("preview: typing, devices, orientation, theme, guides, zoom, skin state", () => withPage(async (page) => {
  await openTemplate(page)
  // 手机设备下才显示模拟输入框；9 键拼音点按键后进入候选栏输入码。
  await page.selectOption("#device", "iphone-17-pro")
  await page.waitForFunction(() => document.querySelector("#preview").getBoundingClientRect().height > 40)
  await clickCanvas(page, 0.45, 0.45)
  await page.waitForFunction(() => /\S/.test(document.querySelector("#candidate-composition")?.textContent ?? ""))
  assert.match(await page.locator("#event-log").textContent(), /KEY\d+ · CENTER/, "status shows the pressed key")
  const devices = await page.locator("#device option").evaluateAll((options) => options.map((option) => option.value))
  for (const device of devices) {
    await page.selectOption("#device", device)
    await page.waitForFunction(() => document.querySelector("#preview").getBoundingClientRect().height > 40)
  }
  await page.locator('[data-orientation-choice="land"]').click()
  assert.equal(await page.locator("#orientation").inputValue(), "land")
  await page.locator('[data-orientation-choice="port"]').click()
  await page.locator('[data-theme-choice="dark"]').click()
  assert.equal(await page.locator("#theme").inputValue(), "dark")
  await page.locator('[data-theme-choice="light"]').click()
  await page.locator("#toggle-guides").click()
  assert.equal(await page.locator("#toggle-guides").getAttribute("aria-pressed"), "true")
  await page.locator("#toggle-guides").click()
  const zoom = () => page.locator("#panel-status").textContent()
  const before = await zoom()
  await page.locator("#preview-zoom-in").click()
  assert.notEqual(await zoom(), before, "zoom in changes scale")
  await page.locator("#preview-zoom-out").click()
  await page.locator("#preview-zoom-fit").click()
  const states = await page.locator("#skin-state option").count()
  if (states > 1) await page.selectOption("#skin-state", { index: 1 })
}))

/* ------------------------------------------------------------------------------------------------
 * 5 · Key editing: geometry, nudging, undo/redo, multi-select, layout actions, text and gestures
 * ---------------------------------------------------------------------------------------------- */
await check("edit keys: geometry, keyboard nudge, undo/redo, multi-select, layout tools", () => withPage(async (page) => {
  await openTemplate(page)
  await editMode(page)
  await selectKey(page)
  const x = page.locator("[data-key-field=x]")
  const original = Number(await x.inputValue())
  await x.fill(String(original + 3))
  await x.press("Enter")
  await page.waitForFunction(() => !document.querySelector("#desktop-undo").disabled)
  assert.match(await page.locator(".inspector-changes").textContent(), /已改/)
  await page.locator("#desktop-undo").click()
  await page.waitForFunction((value) => document.querySelector("[data-key-field=x]").value === String(value), original)
  await page.locator("#desktop-redo").click()
  await page.waitForFunction((value) => document.querySelector("[data-key-field=x]").value === String(value), original + 3)
  await page.keyboard.press(`${mod}+z`)
  await page.waitForFunction((value) => document.querySelector("[data-key-field=x]").value === String(value), original)
  await page.evaluate(() => document.activeElement?.blur())
  await page.keyboard.press("ArrowRight")
  await page.waitForFunction((value) => document.querySelector("[data-key-field=x]").value === String(value), original + 1)
  await page.keyboard.press("Shift+ArrowLeft")
  await page.waitForFunction((value) => document.querySelector("[data-key-field=x]").value === String(value), original - 9)
  // Multi-select reveals batch layout tools.
  await clickCanvasWith(page, mod, 0.65, 0.45)
  await page.waitForSelector("#inspector-multi-layout", { state: "visible" })
  await page.locator('#inspector-multi-layout [data-layout-action="same-width"]').click()
  await page.locator('#inspector-multi-layout [data-layout-action="same-height"]').click()
  assert.equal(await undoEnabled(page), true)
  // Esc 取消选择；再次单击唯一选中的键也取消选中。
  await page.evaluate(() => document.activeElement?.blur())
  await page.keyboard.press("Escape")
  await page.locator("#inspector-multi-layout").waitFor({ state: "hidden" })
  await page.locator(".key-layout-fields").waitFor({ state: "hidden" })
  await selectKey(page)
  await clickCanvas(page, 0.45, 0.45)
  await page.locator(".key-layout-fields").waitFor({ state: "hidden" })
  // Text and gestures on a single key.
  await selectKey(page)
  await railTab(page, "文字")
  const show = page.locator("[data-key-field=SHOW]")
  await show.fill("测")
  await show.press("Enter")
  await page.locator('[data-inspector-tab="source"]').click()
  await page.waitForFunction(() => /SHOW=测/.test(document.querySelector("#source .cm-content")?.innerText ?? ""))
  await page.locator('[data-inspector-tab="properties"]').click()
  // The font is picked from the skin's own font files; the system font is always offered.
  assert.equal(await page.locator("#font-file-select option").first().textContent(), "系统默认")
  await railTab(page, "手势")
  const up = page.locator("[data-key-field=UP]")
  await up.fill("F12")
  await up.press("Tab")
  assert.match(await page.locator('[data-gesture="UP"]').getAttribute("class"), /configured/)
  await railTab(page, "样式")
  await page.locator("[data-key-field=FORE_OFFSET]").waitFor({ state: "visible" })
  // Rows share one label column and fill the inspector.
  const rows = await page.locator(".appearance-property-grid > label:visible").evaluateAll((labels) => labels.map((label) => {
    const input = label.querySelector("input")
    return input ? Math.round(input.getBoundingClientRect().left) : 0
  }))
  assert.ok(rows.length && rows.every((left) => left === rows[0]), `advanced rows align (${rows})`)
}))

/* ------------------------------------------------------------------------------------------------
 * 6 · Styles: library, filters, search, apply, new style
 * ---------------------------------------------------------------------------------------------- */
await check("styles: library filters, search, preview, apply and new style", () => withPage(async (page) => {
  await openTemplate(page)
  await editMode(page)
  await selectKey(page)
  await railTab(page, "样式")
  const card = page.locator(".style-picker-state:visible").first()
  await card.click({ modifiers: ["Alt"] })
  const library = page.locator("#style-picker-dialog")
  await library.waitFor({ state: "visible" })
  const kinds = await library.locator("[data-style-library-kind]:visible").evaluateAll((items) => items.map((item) => item.dataset.styleLibraryKind))
  for (const kind of kinds) {
    const button = library.locator(`[data-style-library-kind="${kind}"]`)
    if (await button.isVisible()) await button.click()
  }
  for (const filter of ["panel", "key", "candidate", "foreground", "all"]) await library.locator(`[data-style-library-filter="${filter}"]`).click()
  await library.locator('[data-style-library-mode="images"]').click()
  await library.locator('[data-style-library-mode="styles"]').click()
  await page.locator("#style-picker-search").fill("zzzz-none")
  await page.locator("#style-picker-empty").waitFor({ state: "visible" })
  await page.locator("#style-picker-search").fill("")
  await page.locator("#style-picker-grid > *").first().click()
  await page.locator("#style-library-preview").waitFor({ state: "visible" })
  await page.locator("#style-library-apply").click()
  await library.waitFor({ state: "hidden" })
  // Sidebar style list and the new-style dialog.
  await page.locator(".sidebar-overview button[data-path]", { hasText: "样式配置" }).first().click()
  await page.locator("#style-add").click()
  const dialog = page.locator("#new-style-dialog")
  await dialog.waitFor({ state: "visible" })
  assert.equal(await dialog.locator("header button").count(), 0, "no redundant header close button")
  await dialog.locator("#new-style-id").fill("9876")
  await dialog.locator("#new-style-submit").click()
  await dialog.waitFor({ state: "hidden" })
  await page.waitForFunction(() => /9876/.test(document.querySelector("#resource-name")?.textContent ?? "") || /STYLE9876/.test(document.querySelector("#source .cm-content")?.innerText ?? ""))
}))

/* ------------------------------------------------------------------------------------------------
 * 7 · Overview pages, images and slices, sounds, skin info
 * ---------------------------------------------------------------------------------------------- */
await check("overview: every sidebar item, image slices, sounds and info", () => withPage(async (page) => {
  await openTemplate(page)
  await editMode(page)
  const count = await page.locator(".sidebar-overview button[data-path]:visible").count()
  for (let index = 0; index < count; index += 1) {
    const item = page.locator(".sidebar-overview button[data-path]:visible").nth(index)
    await item.click()
    await page.waitForTimeout(120)
    // Image pages replace the overview list; come back to keep walking it.
    if (await page.locator("#atlas-back").isVisible()) await page.locator("#atlas-back").click()
  }
  await page.locator(".sidebar-overview button[data-path]", { hasText: "图片资源" }).first().click()
  const image = page.locator("#resource-gallery > *").first()
  await image.click()
  await page.locator("#tile-inspector").waitFor({ state: "visible" })
  assert.equal(await page.locator("#tile-inspector .geometry-fields").first().isVisible(), false, "no empty slice fields before a slice is chosen")
  await page.locator("#new-tile").click()
  const atlas = await page.locator("#atlas-canvas:visible, #workspace-image:visible").first().boundingBox()
  await page.mouse.move(atlas.x + 4, atlas.y + 4)
  await page.mouse.down()
  await page.mouse.move(atlas.x + atlas.width / 3, atlas.y + atlas.height / 3, { steps: 6 })
  await page.mouse.up()
  await page.waitForFunction(() => document.querySelector("#tile-inspector")?.dataset.empty === "false", null, { timeout: 5000 }).catch(() => {})
  await page.locator("#atlas-zoom-in").click()
  await page.locator("#atlas-zoom-fit").click()
  await page.locator("#atlas-back").click()
  await page.locator(".sidebar-overview button[data-path]", { hasText: "按键音效" }).first().click()
  await page.locator(".sidebar-overview button[data-path]", { hasText: "皮肤信息" }).first().click()
  const nameField = page.locator("#quick-inspector input:visible").first()
  await nameField.waitFor({ state: "visible" })
}))

/* ------------------------------------------------------------------------------------------------
 * 8 · Source files view and source editor
 * ---------------------------------------------------------------------------------------------- */
await check("source files: tree, editor, search, upload, copy/paste, delete and undo", () => withPage(async (page) => {
  await openTemplate(page)
  await editMode(page)
  await page.locator('[data-sidebar-view="source"]').click()
  await page.locator("#source-file-toolbar").waitFor({ state: "visible" })
  // 文件夹按需展开：逐层点开，直到出现 .ini 文件。
  // 访达式树：单击选中文件夹，点三角（或双击）展开。
  // 每次只展开第一个收起的文件夹：展开会插入子节点，提前取的列表会失效。
  for (let round = 0; round < 12 && !(await page.locator('.source-file-row[data-path$=".ini"]:visible').count()); round += 1) {
    const folder = page.locator('.source-folder-row[aria-expanded="false"]:visible').first()
    const path = await folder.getAttribute("data-folder-path")
    await folder.locator(".source-disclosure").click()
    await page.waitForFunction((value) => document.querySelector(`.source-folder-row[data-folder-path="${CSS.escape(value)}"]`)?.getAttribute("aria-expanded") === "true", path)
  }
  const file = page.locator('.source-file-row[data-path$=".ini"]:visible').first()
  await file.waitFor({ state: "visible" })
  await file.click()
  await page.locator('[data-inspector-tab="source"]').click()
  await page.waitForFunction(() => (document.querySelector("#source .cm-content")?.innerText ?? "").includes("["))
  await page.locator("#source-find-toggle").click()
  await page.locator("#source-search").fill("STYLE")
  await page.waitForFunction(() => /\d/.test(document.querySelector("#source-search-count")?.textContent ?? ""))
  await page.locator("#source-search-next").click()
  const before = await page.locator(".source-file-row").count()
  await page.locator("#source-upload-input").setInputFiles({ name: "flow-test.png", mimeType: "image/png", buffer: pngBytes(8, 8) })
  await page.waitForFunction((count) => document.querySelectorAll(".source-file-row").length > count, before)
  const uploaded = page.locator('.source-file-row[data-path$="flow-test.png"]')
  await uploaded.click()
  await page.locator("#source-copy").click()
  await page.locator("#source-paste").click()
  // 粘贴回原文件夹得到「flow-test 副本.png」，且保持展开、选中新文件。
  const copy = page.locator('.source-file-row[data-path$="flow-test 副本.png"]')
  await copy.waitFor({ state: "visible" })
  assert.match(await copy.getAttribute("class"), /selected|active/)
  await copy.click()
  await page.locator("#source-delete").click()
  await copy.waitFor({ state: "detached" })
  assert.equal(await uploaded.isVisible(), true, "the tree stays open after deleting")
  await page.locator("#desktop-undo").click()
  await page.waitForFunction(() => document.querySelectorAll('.source-file-row[data-path*="flow-test"]').length === 2)
  await page.locator('[data-sidebar-view="overview"]').click()
}))

/* ------------------------------------------------------------------------------------------------
 * 9 · Tool dialogs from the file menu: panel copy, replace keyboard style, iOS 26
 * ---------------------------------------------------------------------------------------------- */
await check("tools: panel copy, replace keyboard style and iOS 26 adaptation", () => withPage(async (page) => {
  await openTemplate(page)
  await openFileMenu(page)
  assert.equal(await page.locator("#panel-scale").isDisabled(), true, "tools need edit mode")
  await page.keyboard.press("Escape")
  await editMode(page)
  // Panel copy creates a new layout file.
  await openFileMenu(page)
  await page.locator("#panel-scale").click()
  const copy = page.locator("#panel-scale-dialog")
  await copy.waitFor({ state: "visible" })
  const target = await page.locator("#panel-copy-target").inputValue()
  assert.ok(target, "target path suggested")
  await page.locator("#panel-scale-enabled").check()
  await page.locator("#panel-scale-options").waitFor({ state: "visible" })
  await page.locator("#panel-scale-enabled").uncheck()
  await copy.getByRole("button", { name: "复制", exact: true }).click()
  await copy.waitFor({ state: "hidden" })
  await page.locator('[data-sidebar-view="source"]').click()
  assert.match(await page.locator("#event-log").textContent(), /复制面板完成/)
  assert.ok(await page.evaluate((path) => [...document.querySelectorAll("[data-path]")].some((row) => row.dataset.path === path), target), "copied layout listed")
  await page.locator('[data-sidebar-view="overview"]').click()
  // Replace keyboard style with an uploaded PNG, then undo it.
  await openFileMenu(page)
  await page.locator("#replace-layout-image").click()
  const replace = page.locator("#layout-image-dialog")
  await replace.waitFor({ state: "visible" })
  assert.equal(await replace.locator("header button").count(), 0, "no redundant header close button")
  await page.locator("#layout-image-open").setInputFiles({ name: "style.png", mimeType: "image/png", buffer: pngBytes(120, 60) })
  await page.waitForFunction(() => !document.querySelector("#layout-image-apply").disabled)
  for (const target of ["key-normal", "candidate", "panel"]) {
    await replace.locator(`label:has(input[value="${target}"])`).click()
    assert.equal(await replace.locator(`input[value="${target}"]`).isChecked(), true)
  }
  await page.locator("#layout-image-apply").click()
  await replace.waitFor({ state: "hidden" })
  await page.locator("#desktop-undo").click()
  // iOS 26 adaptation.
  await openFileMenu(page)
  await page.locator("#adapt-ios26").click()
  const ios = page.locator("#ios26-dialog")
  await ios.waitFor({ state: "visible" })
  await ios.getByRole("button", { name: "开始适配", exact: true }).click()
  await ios.waitFor({ state: "hidden" })
  await closeOperationDialog(page)
  assert.equal(await undoEnabled(page), true)
}))

/* ------------------------------------------------------------------------------------------------
 * 10 · Settings
 * ---------------------------------------------------------------------------------------------- */
await check("settings: every page, live preview, cancel restores and save persists", () => withPage(async (page) => {
  await openTemplate(page)
  await page.locator(".titlebar-preferences").click()
  const dialog = page.locator("#settings-dialog")
  await dialog.waitFor({ state: "visible" })
  for (const tab of await page.locator(".settings-nav-item:visible").all()) {
    await tab.click()
    assert.equal(await tab.getAttribute("aria-selected"), "true")
  }
  await page.locator('[data-settings-page="appearance"]').click()
  const accent = await page.locator('[data-settings-page="appearance"]').evaluate((node) => getComputedStyle(node).color)
  const brand = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim())
  assert.ok(brand, "accent token resolves")
  assert.notEqual(accent, "rgb(255, 107, 44)", "selected settings tab uses the accent, not the selection orange")
  await page.locator('[data-setting-choice="app-theme"][data-value="dark"]').click()
  await page.waitForFunction(() => document.documentElement.dataset.appTheme === "dark")
  await page.locator("#interface-accent").evaluate((input) => {
    input.value = "#12a150"
    input.dispatchEvent(new Event("input", { bubbles: true }))
    input.dispatchEvent(new Event("change", { bubbles: true }))
  })
  const applied = await page.evaluate(() => getComputedStyle(document.querySelector(".source")).getPropertyValue("--accent").trim())
  assert.equal(applied.toLowerCase(), "#12a150", "accent reaches the inspector")
  await page.locator("#settings-cancel").click()
  await dialog.waitFor({ state: "hidden" })
  await page.waitForFunction(() => document.documentElement.dataset.appTheme !== "dark")
  await page.locator(".titlebar-preferences").click()
  await page.locator('[data-setting-choice="interface-density"][data-value="compact"]').click()
  await page.locator("#settings-save").click()
  await dialog.waitFor({ state: "hidden" })
  assert.equal(await page.evaluate(() => localStorage.getItem("interface-density")), "compact")
  await page.locator(".titlebar-preferences").click()
  await page.locator("#settings-close").click()
  await dialog.waitFor({ state: "hidden" })
}))

/* ------------------------------------------------------------------------------------------------
 * 11 · Rename, save, export, unsaved changes
 * ---------------------------------------------------------------------------------------------- */
await check("file: rename, save, export every format and unsaved prompt", () => withPage(async (page) => {
  await openTemplate(page)
  await page.locator("#document-name").click()
  await page.getByRole("textbox", { name: "皮肤名称" }).fill("导出测试.bds")
  await page.keyboard.press("Enter")
  assert.equal(await page.locator("#document-name").textContent(), "导出测试.bds")
  const download = async (trigger) => {
    const pending = page.waitForEvent("download", { timeout: 60000 })
    pending.catch(() => {})
    await trigger()
    const tap = page.locator("#file-operation-dialog[open] button.primary", { hasText: "下载" })
    const tapped = tap.waitFor({ state: "visible", timeout: 60000 }).then(() => "tap")
    tapped.catch(() => {})
    const result = await Promise.race([pending, tapped])
    if (result === "tap") {
      await tap.click()
      return pending
    }
    return result
  }
  // BDS 皮肤只能导出旧格式，BDA 导出项隐藏而不是置灰。
  assert.equal(await page.locator('.pen-file-menu [data-export-format="bda"]:not([hidden])').count(), 0, "BDA export hidden for BDS")
  const exportAll = async () => {
    const names = []
    const formats = await page.locator(".pen-file-menu [data-export-format]:not([hidden])").evaluateAll((items) => items.map((item) => [item.dataset.exportFormat, item.dataset.bdaPlatform ?? ""]))
    for (const [format, platform] of formats) {
      const item = page.locator(`.pen-file-menu [data-export-format="${format}"]${platform ? `[data-bda-platform="${platform}"]` : ""}`)
      const file = await download(async () => {
        await openFileMenu(page)
        await item.click()
      })
      names.push(file.suggestedFilename().split(".").pop())
      await closeOperationDialog(page)
    }
    return names
  }
  assert.deepEqual(await exportAll(), ["bdi", "bds", "sxi"])
  // Edit, then try to start a new skin: the unsaved prompt appears.
  await editMode(page)
  await selectKey(page)
  const x = page.locator("[data-key-field=x]")
  await x.fill(String(Number(await x.inputValue()) + 1))
  await x.press("Enter")
  await page.locator("#dirty").waitFor({ state: "visible" })
  assert.equal(await page.locator("#dirty").textContent(), "未保存")
  const saved = await download(async () => {
    await openFileMenu(page)
    await page.locator("#save").click()
  })
  assert.match(saved.suggestedFilename(), /\.bds$/)
  await closeOperationDialog(page)
  await x.fill(String(Number(await x.inputValue()) + 1))
  await x.press("Enter")
  // 先选模板，替换当前皮肤前才提示未保存。
  await openFileMenu(page)
  await page.locator("#new").click()
  await page.locator("#new-project-dialog").getByRole("button", { name: "创建皮肤", exact: true }).click()
  const unsaved = page.locator("#unsaved-dialog")
  await unsaved.waitFor({ state: "visible" })
  await unsaved.getByRole("button", { name: "取消", exact: true }).click()
  await unsaved.waitFor({ state: "hidden" })
  assert.equal(await page.locator("#document-name").textContent(), "导出测试.bds", "cancel keeps the current skin")
}))

await check("file: a BDA skin exports to every format", () => withPage(async (page) => {
  await openTemplate(page, "default-android")
  const formats = []
  for (const item of await page.locator(".pen-file-menu [data-export-format]:not([hidden])").all()) {
    const pending = page.waitForEvent("download", { timeout: 60000 })
    pending.catch(() => {})
    await openFileMenu(page)
    await item.click()
    const tap = page.locator("#file-operation-dialog[open] button.primary", { hasText: "下载" })
    const tapped = tap.waitFor({ state: "visible", timeout: 60000 }).then(() => "tap")
    tapped.catch(() => {})
    if ((await Promise.race([pending, tapped])) === "tap") await tap.click()
    formats.push((await pending).suggestedFilename().split(".").pop())
    await closeOperationDialog(page)
  }
  assert.deepEqual(formats, ["bdi", "bds", "bda", "bda", "sxi"])
}))

/* ------------------------------------------------------------------------------------------------
 * 12 · AI design tab without a configured model
 * ---------------------------------------------------------------------------------------------- */
await check("AI design: context chips and model configuration entry", () => withPage(async (page) => {
  await openTemplate(page)
  await editMode(page)
  await selectKey(page)
  await page.locator('[data-inspector-tab="ai"]').click()
  await page.locator("#ai-design-panel").waitFor({ state: "visible" })
  assert.match(await page.locator("#ai-context-key").textContent(), /KEY|按键/)
  await page.locator('[data-inspector-tab="properties"]').click()
}))

/* ------------------------------------------------------------------------------------------------
 * 13 · Real skins: open .bdi / .bds / .bda files from disk and inspect them
 * ---------------------------------------------------------------------------------------------- */
const skinDirectory = process.env.REAL_SKINS_DIR ?? "/Users/kaze/work/bd"
if (existsSync(skinDirectory)) {
  const skins = readdirSync(skinDirectory).filter((name) => /\.(bdi|bds|bda)$/i.test(name)).sort()
  const limit = Number(process.env.REAL_SKINS_LIMIT ?? skins.length)
  await check(`real skins: ${Math.min(limit, skins.length)} files open, render and inspect`, () => withPage(async (page) => {
    const failures = []
    for (const name of skins.slice(0, limit)) {
      try {
        await page.locator("#browser-open").setInputFiles({ name, mimeType: "application/octet-stream", buffer: readFileSync(join(skinDirectory, name)) })
        await page.waitForFunction((file) => document.querySelector("#document-name")?.textContent?.includes(file.replace(/\.[^.]+$/, "")), name, { timeout: 60000 })
        await closeOperationDialog(page)
        // 标题在加载中途就会更新；等「打开」重新可用，表示整个打开操作结束。
        await page.waitForFunction(() => !document.querySelector("#open")?.disabled, null, { timeout: 60000 })
        await page.waitForFunction(() => document.querySelector("#preview")?.getBoundingClientRect().height > 20, null, { timeout: 15000 })
        if ((await page.locator("#mode").inputValue()) !== "edit") await editMode(page)
        // 键位不一定落在画布 45% 处，选不中不算失败。
        await selectKey(page, { timeout: 3000 }).catch(() => {})
        // Leave edits behind so the next open goes through the unsaved prompt path cleanly.
        if (await page.locator("#unsaved-dialog").isVisible()) await page.locator("#unsaved-dialog").getByRole("button", { name: "不保存" }).click()
      } catch (error) {
        const status = await page.locator("#event-log").textContent().catch(() => "")
        failures.push(`${name}: ${error.message.split("\n")[0]} · 状态：${status} · 标题：${await page.locator("#document-name").textContent().catch(() => "")}`)
        await closeOperationDialog(page).catch(() => {})
      }
    }
    assert.equal(failures.length, 0, failures.join("\n"))
  }))
}

/* ------------------------------------------------------------------------------------------------
 * 14 · Dark theme renders the same layout
 * ---------------------------------------------------------------------------------------------- */
await check("dark theme: inspector, sidebar and dialogs share the dark palette", () => withPage(async (page) => {
  await openTemplate(page)
  await editMode(page)
  await selectKey(page)
  const colors = await page.evaluate(() => {
    const luma = (element) => {
      const [r, g, b] = (getComputedStyle(element).backgroundColor.match(/\d+/g) ?? []).map(Number)
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    return { inspector: luma(document.querySelector("#quick-inspector")), sidebar: luma(document.querySelector("aside.sidebar")) }
  })
  assert.ok(colors.inspector < 60 && colors.sidebar < 60, `dark surfaces (${JSON.stringify(colors)})`)
}, { storage: { "app-theme": "dark" }, colorScheme: "dark" }))

await browser.close()
await server?.close()

for (const result of results) {
  console.log(`${result.ok ? "ok  " : "FAIL"} ${result.name} (${(result.ms / 1000).toFixed(1)}s)${result.ok ? "" : `\n     ${String(result.error.message).split("\n").slice(0, 4).join("\n     ")}`}`)
}
const failed = results.filter((result) => !result.ok).length
console.log(`\n${results.length - failed}/${results.length} passed`)
process.exit(failed ? 1 : 0)
