import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { appSource } from "./helpers/app-source.mjs"

const main = appSource()
const previews = readFileSync(new URL("../src/template-preview.ts", import.meta.url), "utf8")

test("startup welcome screen keeps recent skins bounded and template previews lazy", () => {
  assert.match(main, /const recentFilesLimit = 9/)
  assert.match(main, /\.slice\(0, recentFilesLimit\)/)
  assert.match(main, /hydrateTemplateCardPreviews\(document\.querySelector\("\.template-grid"\)!, \{ lazy: true \}\)/)
  assert.match(main, /await waitForPreviewFrame\(\)/)
  assert.match(previews, /new IntersectionObserver/)
  assert.match(previews, /const staticURL = builtInProjectTemplatePreviewURL\(id\)/)
})
