// Opening a Sogou `.ssf`: the user picks the Baidu format to edit it as, then the skin is converted
// onto the official template of that format and opened as a new, unsaved document.

import { clientLog } from "../client-log.ts"
import { loadBuiltInProjectTemplate } from "../operations.ts"
import { SkinArchive } from "../skin.ts"
import { importSsf, type SsfImportFormat, type SsfTemplates } from "../ssf/ssf-convert.ts"
import { ssfImportDialog, ssfImportForm } from "./dom"
import { showSkinLoadProgress, updateFileOperationProgress, waitForInterfacePaint } from "./file-operations"
import { appState } from "./state"

const FORMAT_KEY = "ssf-import-format"
const FORMATS: readonly SsfImportFormat[] = ["bds", "bdi", "bda"]

function chooseFormat(): Promise<SsfImportFormat | undefined> {
  let remembered: string | null = null
  try {
    remembered = localStorage.getItem(FORMAT_KEY)
  } catch {}
  const radios = [...ssfImportForm.querySelectorAll<HTMLInputElement>("input[name=ssf-import-format]")]
  for (const radio of radios) radio.checked = radio.value === (FORMATS.includes(remembered as SsfImportFormat) ? remembered : "bds")
  ssfImportDialog.returnValue = ""
  ssfImportDialog.showModal()
  return new Promise((resolve) => {
    ssfImportDialog.addEventListener("close", () => {
      const format = radios.find((radio) => radio.checked)?.value as SsfImportFormat | undefined
      if (ssfImportDialog.returnValue !== "import" || !format) return resolve(undefined)
      try {
        localStorage.setItem(FORMAT_KEY, format)
      } catch {}
      resolve(format)
    }, { once: true })
  })
}

async function templates(): Promise<SsfTemplates> {
  appState.ssfTemplates ??= {
    bds: SkinArchive.open(await loadBuiltInProjectTemplate("official-android-bds")),
    bda: SkinArchive.open(await loadBuiltInProjectTemplate("default-android"), "bda"),
  }
  return appState.ssfTemplates
}

/** Converts `.ssf` bytes after asking for the target format; undefined when the user backs out. */
export async function importSsfDocument(bytes: Uint8Array): Promise<Uint8Array | undefined> {
  const format = await chooseFormat()
  if (!format) return
  if (showSkinLoadProgress(bytes.byteLength)) {
    updateFileOperationProgress(10, `正在转换为 ${format.toUpperCase()}…`)
    await waitForInterfacePaint()
  }
  const started = performance.now()
  const result = await importSsf(bytes, format, await templates())
  clientLog.info("ssf.import", { format, warnings: result.warnings.length, durationMs: Math.round(performance.now() - started) })
  if (result.warnings.length && !window.confirm(
    `搜狗皮肤转换为 ${format.toUpperCase()} 时将降级以下内容：\n\n${result.warnings.join("\n")}\n\n继续导入吗？`,
  )) return
  return result.bytes
}
