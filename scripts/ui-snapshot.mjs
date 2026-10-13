// UI regression snapshots for the design-system refactor.
//   node scripts/ui-snapshot.mjs save      记录基线（.ui-baseline/）
//   node scripts/ui-snapshot.mjs compare   与基线比对，打印每个界面里变化的元素与属性
// 每个界面保存一张截图和一份“可见元素 → 位置 + 计算样式”的 JSON。元素按 DOM 位置（id 或 nth-of-type）
// 识别，不依赖类名，所以改类名、合并样式后仍能对上号。
import { chromium } from "playwright"
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs"
import { join } from "node:path"

const mode = process.argv[2] ?? "compare"
const only = process.argv[3]
const root = new URL("..", import.meta.url).pathname
const dir = join(root, ".ui-baseline")
const outDir = mode === "save" ? dir : join(root, ".ui-current")
mkdirSync(outDir, { recursive: true })

const { createServer } = await import("vite")
const server = await createServer({ root, logLevel: "error", server: { port: 41790, strictPort: false, host: "127.0.0.1" } })
await server.listen()
const baseURL = `http://127.0.0.1:${server.httpServer.address().port}/`
const browser = await chromium.launch()

const PROPS = ["display", "color", "backgroundColor", "backgroundImage", "borderTopColor", "borderTopWidth", "borderRadius", "boxShadow",
  "fontSize", "fontWeight", "fontFamily", "lineHeight", "opacity", "paddingTop", "paddingLeft", "gap", "outlineStyle", "cursor"]

async function capture(page, name) {
  if (only && !name.includes(only)) return
  await page.waitForTimeout(250)
  await page.screenshot({ path: join(outDir, `${name}.png`) })
  const elements = await page.evaluate((props) => {
    const pathOf = (el) => {
      const parts = []
      for (let node = el; node && node.nodeType === 1 && node !== document.documentElement; node = node.parentElement) {
        if (node.id) { parts.unshift(`#${node.id}`); break }
        const same = [...(node.parentElement?.children ?? [])].filter((child) => child.localName === node.localName)
        parts.unshift(same.length > 1 ? `${node.localName}:${same.indexOf(node) + 1}` : node.localName)
      }
      return parts.join(">")
    }
    const out = {}
    for (const el of document.body.querySelectorAll("*")) {
      const rect = el.getBoundingClientRect()
      if (rect.width < 1 || rect.height < 1) continue
      const style = getComputedStyle(el)
      if (style.visibility === "hidden" || style.display === "none") continue
      const entry = { box: [rect.x, rect.y, rect.width, rect.height].map(Math.round).join(","), pane: el.closest("section.source") ? 1 : 0 }
      for (const prop of props) entry[prop] = style[prop]
      out[pathOf(el)] = entry
    }
    return out
  }, PROPS)
  writeFileSync(join(outDir, `${name}.json`), JSON.stringify(elements))
  console.log(`  captured ${name} (${Object.keys(elements).length} elements)`)
}

async function withPage(run, { viewport = { width: 1440, height: 900 }, colorScheme = "light", url = baseURL } = {}) {
  const context = await browser.newContext({ viewport, colorScheme, bypassCSP: true, deviceScaleFactor: 1 })
  const page = await context.newPage()
  const errors = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.addInitScript(() => localStorage.clear())
  await page.goto(url)
  await page.addStyleTag({ content: "*,*::before,*::after{transition:none!important;animation:none!important;caret-color:transparent!important}" })
  try { await run(page) } finally { await context.close() }
  if (errors.length) console.log(`  page errors: ${errors.join(" | ")}`)
}

async function openTemplate(page, template) {
  await page.waitForSelector(".template-card")
  await page.locator(`.template-grid .template-card[data-template="${template}"]`).click()
  await page.waitForSelector(".canvas-wrap:not(.empty)")
  await page.waitForFunction(() => document.querySelector("#preview")?.getBoundingClientRect().height > 60)
  await page.waitForFunction(() => {
    const dialog = document.querySelector("#file-operation-dialog")
    return !dialog?.open || !document.querySelector("#file-operation-close")?.disabled
  }, null, { timeout: 60000 })
  const close = page.locator("#file-operation-dialog[open] #file-operation-close")
  if (await close.isVisible().catch(() => false)) await close.click()
}

async function editAndSelectKey(page) {
  await page.getByRole("button", { name: "编辑模式", exact: true }).click()
  await page.waitForFunction(() => document.querySelector("#mode").value === "edit")
  const box = await page.locator("#preview").boundingBox()
  await page.mouse.click(box.x + box.width * 0.45, box.y + box.height * 0.45)
  await page.waitForSelector('.key-layout-fields:not([hidden]), #bda-config-fields[data-bda-scope="key"]', { state: "visible" })
}

async function railTabs(page, prefix) {
  const buttons = page.locator("#mobile-inspector-groups button:visible")
  const count = await buttons.count()
  for (let i = 0; i < count; i += 1) {
    await buttons.nth(i).click()
    await capture(page, `${prefix}-rail${i + 1}`)
  }
}

console.log(`ui-snapshot ${mode}`)
await withPage(async (page) => {
  await page.waitForSelector(".template-card")
  await capture(page, "welcome")
  await openTemplate(page, "official-android-bds")
  await capture(page, "bds-preview")
  await page.locator('[data-sidebar-view="source"]').click()
  await capture(page, "bds-source")
  await page.locator('[data-sidebar-view="overview"]').click()
  await editAndSelectKey(page)
  await capture(page, "bds-key")
  await railTabs(page, "bds-key")
  await page.locator(".titlebar-preferences").click()
  await capture(page, "settings")
  await page.keyboard.press("Escape")
  // 图片编辑：资源列表与切片工具栏会挪进画布工作区
  await page.locator(".sidebar-overview button[data-path]", { hasText: "图片资源" }).first().click()
  await capture(page, "bds-images")
  await page.locator("#resource-gallery > *").first().click()
  await capture(page, "bds-image")
})
await withPage(async (page) => {
  await openTemplate(page, "default-android")
  await editAndSelectKey(page)
  await capture(page, "bda-key")
  await railTabs(page, "bda-key")
})
await withPage(async (page) => {
  await openTemplate(page, "official-android-bds")
  await editAndSelectKey(page)
  await capture(page, "dark-bds-key")
}, { colorScheme: "dark" })
await withPage(async (page) => {
  await page.waitForSelector(".template-card")
  await capture(page, "mobile-welcome")
  await openTemplate(page, "official-android-bds")
  await capture(page, "mobile-bds")
}, { viewport: { width: 390, height: 844 } })
await withPage(async (page) => { await page.waitForTimeout(800); await capture(page, "new-project") }, { url: `${baseURL}new-project.html` })
await withPage(async (page) => { await page.waitForTimeout(800); await capture(page, "picker") }, { url: `${baseURL}picker.html` })

await browser.close()
await server.close()

// 右侧面板里的元素：快照里带 pane 标记；旧基线没有标记时按面板内的 id 和路径判断。
const indexHtml = readFileSync(join(root, "index.html"), "utf8")
const paneHtml = indexHtml.slice(indexHtml.indexOf('<section class="source">'), indexHtml.indexOf("</main>"))
const paneIDs = new Set([...paneHtml.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]))
const inPane = (key, entry) => entry?.pane === 1 || key.startsWith("body>main>section:2") || paneIDs.has(key.match(/^#([^>]+)/)?.[1])

if (mode === "compare") {
  let total = 0
  for (const file of (await import("node:fs")).readdirSync(outDir).filter((f) => f.endsWith(".json"))) {
    if (!existsSync(join(dir, file))) { console.log(`\n${file}: 基线中不存在`); continue }
    const before = JSON.parse(readFileSync(join(dir, file), "utf8"))
    const after = JSON.parse(readFileSync(join(outDir, file), "utf8"))
    const lines = []
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
      // OUTSIDE_PANE=1：只看右侧面板以外的元素（重做检查器时确认其他区域不受影响）
      if (process.env.OUTSIDE_PANE && (inPane(key, after[key]) || inPane(key, before[key]))) continue
      if (!before[key]) { lines.push(`  + ${key}`); continue }
      if (!after[key]) { lines.push(`  - ${key}`); continue }
      const diff = Object.keys(before[key]).filter((p) => p !== "pane").filter((p) => before[key][p] !== after[key][p]).map((p) => `${p}: ${before[key][p]} → ${after[key][p]}`)
      if (diff.length) lines.push(`  ~ ${key}\n      ${diff.join("\n      ")}`)
    }
    total += lines.length
    if (lines.length) console.log(`\n${file.replace(".json", "")}: ${lines.length} 处变化\n${lines.slice(0, Number(process.env.LIMIT ?? 25)).join("\n")}`)
  }
  console.log(`\n共 ${total} 处变化`)
}
