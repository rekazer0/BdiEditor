import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const workflow = readFileSync(".github/workflows/pages.yml", "utf8")
const html = readFileSync("index.html", "utf8")

test("GitHub Pages validates and publishes the web build", () => {
  assert.match(workflow, /push:\s*\n\s*branches:\s*\n\s*- main/)
  assert.match(workflow, /npm test/)
  assert.match(workflow, /npm run build/)
  assert.match(workflow, /actions\/configure-pages@v5/)
  assert.match(workflow, /enablement: true/)
  assert.match(workflow, /actions\/upload-pages-artifact@v3/)
  assert.match(workflow, /actions\/deploy-pages@v4/)
})

test("the web CSP permits the public release API used outside Tauri", () => {
  assert.match(html, /connect-src 'self' https:\/\/api\.github\.com/)
})
