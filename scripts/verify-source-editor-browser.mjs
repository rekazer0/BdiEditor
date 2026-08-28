import assert from "node:assert/strict"
import fs from "node:fs"
import { spawn } from "node:child_process"
import os from "node:os"
import path from "node:path"
import puppeteer from "puppeteer-core"

const chrome = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
].find(fs.existsSync)
if (!chrome) throw new Error("找不到 Chrome 或 Chromium，无法运行源码编辑器浏览器验证")

const port = 1421
const origin = `http://127.0.0.1:${port}`
const bdiFixture = path.join(os.tmpdir(), `bdi-editor-codemirror-${process.pid}.bdi`)
fs.copyFileSync(path.resolve("public/default-template.bds"), bdiFixture)
const server = spawn(process.execPath, [
  "node_modules/vite/bin/vite.js",
  "--host", "127.0.0.1",
  "--port", String(port),
  "--strictPort",
], { stdio: ["ignore", "pipe", "pipe"] })

async function waitForServer() {
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Vite 提前退出：${server.exitCode}`)
    try {
      const response = await fetch(origin)
      if (response.ok) return
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error("等待 Vite 启动超时")
}

let browser
try {
  await waitForServer()
  browser = await puppeteer.launch({
    executablePath: chrome,
    headless: true,
    args: ["--no-sandbox", "--disable-gpu"],
  })
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  await page.goto(origin, { waitUntil: "networkidle0" })
  assert.equal(await page.$("#source .cm-editor"), null, "源码面板显示前不应加载 CodeMirror")

  await (await page.$("#browser-open")).uploadFile(path.resolve("public/default-template.bds"))
  await page.waitForFunction(() => !document.querySelector('[data-inspector-tab="source"]')?.disabled)
  await page.click('[data-inspector-tab="source"]')
  await page.click('[data-mode-choice="edit"]')
  await page.waitForSelector("#source .cm-content[contenteditable=true]")
  const appInitialLines = await page.$$eval("#source .cm-line", (lines) => lines.length)
  const appContent = await page.$("#source .cm-content")
  await appContent.click()
  await page.keyboard.down("Meta")
  await page.keyboard.press("End")
  await page.keyboard.up("Meta")
  await page.keyboard.type("\n; codemirror-app-test")
  const appChanged = await page.$eval("#source .cm-content", (element) =>
    (element.textContent ?? "").endsWith("; codemirror-app-test"))
  await page.keyboard.down("Meta")
  await page.keyboard.press("KeyZ")
  await page.keyboard.up("Meta")
  const appReverted = await page.$eval("#source .cm-content", (element) =>
    !(element.textContent ?? "").endsWith("; codemirror-app-test"))
  assert.ok(appInitialLines < 500, `真实 BDS 源码渲染了过多行：${appInitialLines}`)
  assert.ok(appChanged && appReverted, "真实 BDS 源码应支持编辑并复用应用级撤销")

  const bdiPage = await browser.newPage()
  await bdiPage.goto(origin, { waitUntil: "networkidle0" })
  await (await bdiPage.$("#browser-open")).uploadFile(bdiFixture)
  await bdiPage.waitForFunction(() => !document.querySelector('[data-inspector-tab="source"]')?.disabled)
  await bdiPage.click('[data-inspector-tab="source"]')
  await bdiPage.waitForSelector("#source .cm-content")
  const bdiSource = await bdiPage.$eval("#source .cm-content", (element) => element.textContent ?? "")
  assert.match(bdiSource, /^\[HINT]/, "BDI 扩展名应进入共用的 INI CodeMirror 源码区")
  await bdiPage.close()

  const result = await page.evaluate(async () => {
    const { SourceCodeEditor } = await import("/src/source-editor.ts")
    const appSource = document.querySelector("#source")
    if (appSource) appSource.id = "source-app-original"
    const parent = document.createElement("div")
    parent.id = "source"
    parent.style.cssText = "position:fixed;inset:20px auto auto 20px;width:900px;height:500px"
    document.body.append(parent)
    const editor = new SourceCodeEditor(parent)
    editor.disabled = false

    let inputEvents = 0
    let changeEvents = 0
    editor.addEventListener("input", () => inputEvents += 1)
    editor.addEventListener("change", () => changeEvents += 1)
    const ini = Array.from(
      { length: 30_000 },
      (_, index) => `[KEY${index}]\nCENTER=F${index}\nVIEW_RECT=${index},0,10,10`,
    ).join("\n")
    const started = performance.now()
    editor.value = ini
    editor.setLanguage("ini")
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    const initialRenderMs = performance.now() - started
    const initialLines = editor.renderedLineCount

    const last = ini.lastIndexOf("[KEY29999]")
    editor.setDecorations({
      selectedRanges: [[last, ini.length]],
      searchRanges: [[last, last + 10]],
      activeSearchRange: [last, last + 10],
    })
    editor.revealRange(last, ini.length)
    await new Promise((resolve) => setTimeout(resolve, 100))
    const finalLines = editor.renderedLineCount
    const visibleText = editor.view.contentDOM.textContent ?? ""
    const selectedLines = editor.view.contentDOM.querySelectorAll(".cm-line.cm-source-selected").length
    const selectedMarkInsideText = Boolean(editor.view.contentDOM.querySelector(".cm-line .cm-source-selected"))
    const activeSearchVisible = Boolean(editor.view.contentDOM.querySelector(".cm-source-search-active"))

    const blurTarget = document.createElement("button")
    document.body.append(blurTarget)
    editor.focus()
    editor.view.dispatch({ changes: { from: editor.value.length, insert: "\n; edited" } })
    const edited = editor.value.endsWith("; edited")
    blurTarget.focus()
    await Promise.resolve()
    editor.readOnly = true
    const readOnly = editor.view.contentDOM.getAttribute("contenteditable") !== "true"

    const json = `{"items":[\n${Array.from(
      { length: 30_000 },
      (_, index) => `{"id":${index},"resource":"image${index}.png"}`,
    ).join(",\n")}\n]}`
    editor.value = json
    editor.setLanguage("json")
    editor.revealRange(json.length - 2)
    await new Promise((resolve) => setTimeout(resolve, 100))
    const jsonLines = editor.renderedLineCount
    editor.destroy()
    parent.remove()

    return {
      activeSearchVisible,
      changeEvents,
      edited,
      finalLines,
      initialLines,
      initialRenderMs,
      inputEvents,
      jsonLines,
      readOnly,
      selectedLines,
      selectedMarkInsideText,
      visibleText,
    }
  })

  assert.ok(result.initialRenderMs < 5_000, `3 万行 INI 初始化耗时过长：${result.initialRenderMs.toFixed(0)}ms`)
  assert.ok(result.initialLines < 500, `INI 首屏渲染了过多行：${result.initialLines}`)
  assert.ok(result.finalLines < 500, `INI 末尾渲染了过多行：${result.finalLines}`)
  assert.ok(result.jsonLines < 500, `JSON 末尾渲染了过多行：${result.jsonLines}`)
  assert.match(result.visibleText, /KEY29999/, "滚动到末尾后应渲染最后一个 INI section")
  assert.equal(result.selectedLines, 3, "末尾选中范围应高亮完整的 3 行")
  assert.ok(!result.selectedMarkInsideText, "整行选中装饰不应嵌入文字并遮挡行首")
  assert.ok(result.activeSearchVisible, "末尾搜索结果应在当前视口显示")
  assert.ok(result.edited && result.inputEvents === 1, "CodeMirror 编辑应更新值并发出一次 input")
  assert.equal(result.changeEvents, 1, "CodeMirror 失焦应发出一次 change 供 BDA JSON 提交")
  assert.ok(result.readOnly, "只读模式应关闭 contenteditable")
  console.log(`✓ CodeMirror BDS/BDI 集成与 3 万行视口验证通过（首屏 ${result.initialLines} 行，末尾 ${result.finalLines} 行，JSON ${result.jsonLines} 行，初始化 ${result.initialRenderMs.toFixed(0)}ms）`)
} finally {
  await browser?.close()
  server.kill("SIGTERM")
  if (fs.existsSync(bdiFixture)) fs.unlinkSync(bdiFixture)
}
