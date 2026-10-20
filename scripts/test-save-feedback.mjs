import assert from "node:assert/strict"
import { chromium } from "playwright"
import { createServer } from "vite"

const server = await createServer({ logLevel: "error", server: { host: "127.0.0.1", port: 0 } })
await server.listen()
let browser
try {
  browser = await chromium.launch()
  const page = await browser.newPage({ bypassCSP: true })
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/`)
  await page.waitForSelector(".template-card")
  await page.locator('.template-card[data-template="official-android-bds"]').click()
  await page.waitForFunction(() => !document.querySelector("#open").disabled)
  const dialog = page.locator("#file-operation-dialog")
  const close = page.locator("#file-operation-close")
  if (await dialog.isVisible()) await close.click()

  // Keep the real archive writer; control when the browser confirms the write.
  await page.evaluate(() => {
    window.showSaveFilePicker = async () => ({
      name: "保存反馈.bds",
      createWritable: async () => ({
        write: async (bytes) => { window.writtenSize = bytes.byteLength },
        close: () => new Promise((resolve, reject) => { window.finishWrite = resolve; window.failWrite = reject }),
      }),
    })
  })
  await page.evaluate(async () => {
    const { runFileOperation } = await import("/src/app/file-operations.ts")
    const { saveArchive } = await import("/src/app/archive-io.ts")
    window.pendingSave = runFileOperation("保存", () => saveArchive(false, "bds"))
  })
  await page.waitForFunction(() => typeof window.finishWrite === "function")
  assert.equal(await dialog.isVisible(), false, "do not show success until writable.close resolves")
  assert.ok(await page.evaluate(() => window.writtenSize > 0))
  await page.evaluate(async () => { window.finishWrite(); await window.pendingSave })
  await dialog.waitFor({ state: "visible" })
  assert.equal(await page.locator("#file-operation-title").textContent(), "保存成功")
  assert.equal(await close.evaluate((element) => element === document.activeElement), true)
  await page.keyboard.press("Enter")
  await dialog.waitFor({ state: "hidden" })

  for (const outcome of ["cancel", "error"]) {
    await page.evaluate(async (outcome) => {
      window.showSaveFilePicker = async () => {
        if (outcome === "cancel") throw new DOMException("已取消", "AbortError")
        return { name: "失败.bds", createWritable: async () => ({
          write: async () => {}, close: async () => { throw new Error("磁盘已满") },
        }) }
      }
      const { runFileOperation } = await import("/src/app/file-operations.ts")
      const { saveArchive } = await import("/src/app/archive-io.ts")
      await runFileOperation("导出", () => saveArchive(true, "bds"))
    }, outcome)
    assert.equal(await dialog.isVisible(), false, `${outcome} must not show a success dialog`)
    assert.match(await page.locator("#event-log").textContent(), outcome === "cancel" ? /已取消/ : /磁盘已满/)
  }

  for (const action of ["保存", "导出", "导出日志", "下载文件", "下载图片", "下载按键音效"]) {
    for (const progress of [false, true]) {
      await page.evaluate(async ({ action, progress }) => {
        const { runFileOperation, showFileOperationProgress } = await import("/src/app/file-operations.ts")
        await runFileOperation(action, () => { if (progress) showFileOperationProgress(); return true })
      }, { action, progress })
      const download = action.startsWith("下载")
      assert.equal(await dialog.isVisible(), !download, `${action} with progress=${progress}`)
      if (!download) {
        assert.equal(await page.locator("#file-operation-title").textContent(), `${action}成功`)
        assert.equal(await page.locator(".ui-operation-meter").isVisible(), false)
        await page.keyboard.press("Escape")
        await dialog.waitFor({ state: "hidden" })
      }
    }
  }
  console.log("PASS: confirmed writes, cancellation, write failure, all save/export actions, no asset download popup, progress reuse, focus, Enter and Escape")
} finally {
  await browser?.close()
  await server.close()
}
