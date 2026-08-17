import { cpSync, existsSync, mkdirSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const source = resolve(root, "src-tauri/icons/android")
const target = resolve(root, "src-tauri/gen/android/app/src/main/res")

if (!existsSync(target)) {
  console.log("Android resources not initialized; skipping launcher icon sync")
  process.exit(0)
}

mkdirSync(target, { recursive: true })
cpSync(source, target, { recursive: true })
console.log("Android launcher icons synced from project icon")
