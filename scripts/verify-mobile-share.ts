import assert from "node:assert/strict"
import fs from "node:fs"

const main = fs.readFileSync("src/main.ts", "utf8")
const plugin = fs.readFileSync("src-tauri/native-share/android/src/main/java/SharePlugin.kt", "utf8")
const html = fs.readFileSync("index.html", "utf8")

assert.match(main, /function isAndroidWeb\(\): boolean/)
assert.match(main, /function isIOSWeb\(\): boolean/)
assert.match(main, /if \(isIOSWeb\(\)\) return "bdi"/)
assert.match(main, /if \(isAndroidTauri\(\) \|\| isAndroidWeb\(\)\) return archive\?\.format === "bda" \? "bda" : "bds"/)
assert.match(main, /if \(isAndroidTauri\(\)\) \{[\s\S]*await invoke\("share_file"/)
assert.match(main, /await navigator\.share\(\{ title: name, files: \[file\] \}\)/)
assert.match(plugin, /Intent\(Intent\.ACTION_VIEW\)/)
assert.doesNotMatch(plugin, /Intent\(Intent\.ACTION_SEND\)/)
assert.match(plugin, /setPackage\("com\.baidu\.input"\)/)
assert.match(plugin, /setDataAndType\(uri, args\.mimeType\)/)
assert.match(plugin, /activity\.startActivity\(viewIntent\)/)
assert.doesNotMatch(plugin, /Intent\.createChooser\(sendIntent/)
assert.match(html, />分享皮肤<\/span>/)
assert.doesNotMatch(html, />分享到百度输入法<\/span>/)

console.log("✓ iOS 网页、Android 网页与 Android APK 使用各自的分享路径和皮肤格式")
