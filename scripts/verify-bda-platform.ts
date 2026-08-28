import assert from "node:assert/strict"
import fs from "node:fs"
import { SkinArchive } from "../src/skin.ts"
import { bdaPlatform, convertBdaPlatform } from "../src/bda-platform.ts"
import { decodeBdaAppearance, decodeBdaSoundConfig, IOS_BDA_PANELS } from "../src/bda.ts"

const android = SkinArchive.open(fs.readFileSync("public/default-template.bda"), "bda")
assert.equal(bdaPlatform(android), "android")

const ios = convertBdaPlatform(android, "ios")
assert.equal(bdaPlatform(ios), "ios")
for (const path of ios.names().filter((path) => /appearanceConfig$/.test(path))) {
  const appearance = decodeBdaAppearance(ios.getBytes(path)!)
  assert.equal(appearance.designWidth, 1242)
  assert([...appearance.panels.keys()].every((name) => IOS_BDA_PANELS.has(name)))
}
for (const path of ios.names().filter((path) => /soundConfig$/.test(path))) {
  const sound = decodeBdaSoundConfig(ios.getBytes(path)!)
  assert.equal(sound.keySounds.size, 0)
}
assert.equal(ios.zipEncryptedPaths().length, 0)

const roundTrip = convertBdaPlatform(ios, "android")
assert.equal(bdaPlatform(roundTrip), "android")
for (const path of roundTrip.names().filter((path) => /appearanceConfig$/.test(path))) {
  assert.equal(decodeBdaAppearance(roundTrip.getBytes(path)!).designWidth, 1080)
}

const samples = [
  ["/Users/kaze/Downloads/3花季-IOS.bda", "ios"],
  ["/Users/kaze/Downloads/3鲸鱼IOS.bda", "ios"],
  ["/Users/kaze/Downloads/llee晕染.bda", "android"],
  ["/Users/kaze/Downloads/八方来财.bda", "android"],
] as const
for (const [path, platform] of samples) {
  if (fs.existsSync(path)) assert.equal(bdaPlatform(SkinArchive.open(fs.readFileSync(path), "bda")), platform, path)
}

const renderSample = "/Users/kaze/Downloads/llee晕染.bda"
if (fs.existsSync(renderSample)) {
  const source = SkinArchive.open(fs.readFileSync(renderSample), "bda")
  const converted = convertBdaPlatform(source, "ios")
  for (const path of converted.names().filter((path) => /appearanceConfig$/.test(path))) {
    const appearance = decodeBdaAppearance(converted.getBytes(path)!)
    assert.equal(appearance.panels.has("url"), true, `${path} 的 Android net 面板必须迁移为 iOS url 面板`)
  }
assert.equal(
  converted.sourceFiles().some(({ path }) => /^skin(?:\/|$)/i.test(path)),
  false,
  "iOS BDA 不能保留 Android 的 skin/ 包装目录",
)
  const demo = converted.getBytes("demo.png")
  assert.ok(
    demo && demo.length > 24 && demo[0] === 0x89 && demo[1] === 0x50 && demo[2] === 0x4e && demo[3] === 0x47,
    "iOS BDA 必须保留根目录 demo.png 预览图",
  )
  for (const path of converted.names().filter((path) => /appearanceConfig$/.test(path))) {
    const before = decodeBdaAppearance(source.getBytes(path)!)
    const appearance = decodeBdaAppearance(converted.getBytes(path)!)
    for (const [name, panel] of appearance.panels) {
      if (!before.panels.get(name)?.wholeBackStyle) continue
      assert(panel.backStyle, `${path} 的 iOS 主体背景必须迁移到 backStyle`)
      assert.equal(panel.wholeBackStyle, undefined, `${path} 的 iOS 配置不能保留 Android wholeBackStyle`)
    }
  }
}

const iosRenderSample = "/Users/kaze/Downloads/3鲸鱼IOS.bda"
if (fs.existsSync(iosRenderSample)) {
  const source = SkinArchive.open(fs.readFileSync(iosRenderSample), "bda")
  const converted = convertBdaPlatform(source, "android")
  assert.equal(converted.names().length > 0, true)
  for (const path of converted.names().filter((path) => /appearanceConfig$/.test(path))) {
    const before = decodeBdaAppearance(source.getBytes(path)!)
    const appearance = decodeBdaAppearance(converted.getBytes(path)!)
    for (const [name, panel] of appearance.panels) {
      if (!before.panels.get(name)?.backStyle) continue
      assert(panel.wholeBackStyle, `${path} 的 Android 主体背景必须迁移到 wholeBackStyle`)
      assert.equal(panel.backStyle, undefined, `${path} 的 Android 配置不能保留 iOS backStyle`)
    }
  }
}

console.log("✓ BDA 平台识别、声音字段迁移与 iOS/Android 双向转换通过")
