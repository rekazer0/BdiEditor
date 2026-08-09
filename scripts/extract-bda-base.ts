import { readFileSync, writeFileSync } from "node:fs"
import { unzipSync, zipSync } from "fflate"

const apk = unzipSync(readFileSync(process.argv[2] ?? "/private/tmp/baiduinput.apk"))
const files: Record<string, Uint8Array> = {}
const template: Record<string, Uint8Array> = {
  "Info.txt": new TextEncoder().encode("Name=百度输入法官方 BDA 默认皮肤\nSupportPlatform=A\n"),
}

for (const [path, bytes] of Object.entries(apk)) {
  const layout = path.match(/^assets\/skin\/phone\/1080\/(port|land)\/([^/]+\.(?:ini|cnd|pop))$/)
  if (layout) files[`light/skin/${layout[1]}/${layout[2]}`] = bytes
  const resource = path.match(/^assets\/skin\/facade\/phone\/light\/1080\/res\/(\d+\.png)$/)
  if (resource) {
    files[`light/skin/res/${resource[1]}`] = bytes
    template[`res/${resource[1]}`] = bytes
  }
  const appearance = path.match(/^assets\/skin\/facade\/phone\/light\/1080\/(port|land)\/appearanceConfig$/)
  if (appearance) template[`${appearance[1]}/appearanceConfig`] = bytes
}

if (
  !files["light/skin/port/py_9.ini"] ||
  !files["light/skin/res/10001.png"] ||
  !template["port/appearanceConfig"] ||
  !template["land/appearanceConfig"]
) {
  throw new Error("APK 中缺少 BDA 基础布局或资源")
}
writeFileSync("public/bda-base.bds", zipSync(files, { level: 9 }))
writeFileSync("public/default-template.bda", zipSync(template, { level: 9 }))
