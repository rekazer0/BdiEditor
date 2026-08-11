import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import test from "node:test"
import { strToU8, unzipSync, zipSync } from "fflate"
import { SkinArchive } from "../src/skin.ts"

test("ships the official Baidu BDA skin as the built-in default template", () => {
  const url = new URL("../public/default-template.bda", import.meta.url)
  assert.equal(existsSync(url), true, "public/default-template.bda must be bundled")
  const archive = SkinArchive.open(new Uint8Array(readFileSync(url)))
  assert.equal(archive.format, "bda")
  assert.ok(archive.names().some((name) => /(^|\/)Info\.txt$/i.test(name)))
  assert.ok(archive.names().includes("light/skin/port/appearanceConfig"))
  assert.ok(archive.names().some((name) => name.startsWith("light/skin/res/") && name.endsWith(".png")))
})

test("keeps the official BDS default as an alternative template", () => {
  const archive = SkinArchive.open(new Uint8Array(readFileSync(new URL("../public/default-template.bds", import.meta.url))))
  assert.equal(archive.format, "bds")
  assert.ok(archive.names().includes("light/skin/port/py_9.ini"))
})

test("bundles the five downloaded BDS skin templates", () => {
  for (const name of [
    "oppo-swipe-down.bds",
    "oppo-dual-color.bds",
    "iqoo-rounded-black.bds",
    "xiaomi-unified-rounded-blur.bds",
    "huawei-swipe-symbols-1080.bds",
  ]) {
    const url = new URL(`../public/templates/${name}`, import.meta.url)
    assert.equal(existsSync(url), true, `${name} must be bundled`)
    assert.equal(SkinArchive.open(new Uint8Array(readFileSync(url))).format, "bds")
  }
})

test("changes one config while preserving other entry bytes", () => {
  const image = new Uint8Array([1, 2, 3, 4])
  const bytes = zipSync({
    "skin/port/py_9.ini": strToU8("[KEY1]\nVIEW_RECT=1,2,3,4\n"),
    "skin/res/key.png": image,
  })
  const archive = SkinArchive.open(bytes)

  archive.setText("skin/port/py_9.ini", "[KEY1]\nVIEW_RECT=5,6,7,8\n")
  const output = unzipSync(archive.toBytes())

  assert.deepEqual(output["skin/res/key.png"], image)
  assert.deepEqual([...archive.changed], ["skin/port/py_9.ini"])
})

test("rejects parent-directory paths", () => {
  const bytes = zipSync({ "../escape.ini": strToU8("x=1") })
  assert.throws(() => SkinArchive.open(bytes), /不安全路径/)
})

test("undoing to original bytes clears the changed state", () => {
  const archive = SkinArchive.open(
    zipSync({ "skin.ini": strToU8("[KEY1]\nCENTER=q\n") }),
  )
  archive.setText("skin.ini", "[KEY1]\nCENTER=w\n")
  assert.deepEqual([...archive.changed], ["skin.ini"])
  archive.setText("skin.ini", "[KEY1]\nCENTER=q\n")
  assert.equal(archive.changed.size, 0)
})

test("returns the original container byte-for-byte when unchanged", () => {
  const bytes = zipSync({ "skin.ini": strToU8("[KEY1]\nCENTER=q\n") })
  const archive = SkinArchive.open(bytes)
  assert.deepEqual(archive.toBytes(), bytes)
})

test("preserves untouched local ZIP records and central metadata", () => {
  const bytes = zipSync({
    "skin/": [new Uint8Array(), { level: 0, os: 3, attrs: 0o40755 << 16 }],
    "skin/layout.ini": [
      strToU8("[KEY1]\nCENTER=q\n"),
      { level: 6, os: 3, attrs: 0o100644 << 16 },
    ],
    "skin/image.png": [
      new Uint8Array([1, 2, 3, 4]),
      { level: 6, os: 3, attrs: 0o100644 << 16 },
    ],
  })
  const archive = SkinArchive.open(bytes)
  archive.setText("skin/layout.ini", "[KEY1]\nCENTER=w\n")
  const output = archive.toBytes()
  const reopened = SkinArchive.open(output)

  assert.equal(reopened.getText("skin/layout.ini"), "[KEY1]\nCENTER=w\n")
  assert.deepEqual(reopened.getBytes("skin/image.png"), new Uint8Array([1, 2, 3, 4]))
  assert.equal(new DataView(output.buffer).getUint32(0, true), LOCAL_SIGNATURE_FOR_TEST)
})

test("uses the just-saved container as the next unchanged output", () => {
  const archive = SkinArchive.open(zipSync({ "skin.ini": strToU8("value=old\n") }))
  archive.setText("skin.ini", "value=new\n")
  const saved = archive.toBytes()
  archive.markSaved(saved)
  assert.deepEqual(archive.toBytes(), saved)
})

test("rejects a damaged skin archive instead of opening partial state", () => {
  assert.throws(() => SkinArchive.open(new Uint8Array([1, 2, 3, 4])))
})

test("rejects a ZIP whose central directory declares an oversized unpacked payload", () => {
  const packed = zipSync({ "Info.txt": strToU8("Name=small\n") })
  const bytes = packed.slice()
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let central = -1
  for (let offset = 0; offset <= bytes.length - 4; offset++) {
    if (view.getUint32(offset, true) === 0x02014b50) {
      central = offset
      break
    }
  }
  assert.notEqual(central, -1)
  view.setUint32(central + 24, 256 * 1024 * 1024 + 1, true)
  assert.throws(() => SkinArchive.open(bytes), /超过 256 MB/)
})

test("normalizes a current iOS BDI package for editing", () => {
  const archive = SkinArchive.open(zipSync({
    "skin/Info.txt": strToU8("Name=Test\r\nSupportPlatform=I\r\n"),
    "skin/light/skin/port/py_9.ini": strToU8("[KEY1]\nCENTER=q\n"),
  }))

  assert.equal(archive.format, "bdi")
  assert.equal(archive.getText("light/skin/port/py_9.ini"), "[KEY1]\nCENTER=q\n")
})

test("normalizes an Android BDS package for editing", () => {
  const archive = SkinArchive.open(zipSync({
    "Info.txt": strToU8("Name=Test\r\nSupportPlatform=A\r\n"),
    "light/port/py_9.ini": strToU8("[KEY1]\nCENTER=q\n"),
  }))

  assert.equal(archive.format, "bds")
  assert.equal(archive.getText("light/skin/port/py_9.ini"), "[KEY1]\nCENTER=q\n")
})

test("recognizes and preserves the protobuf-based Android BDA layout", () => {
  const appearance = new Uint8Array([0x08, 0x01])
  const image = new Uint8Array([1, 2, 3, 4])
  const bytes = zipSync({
    "Info.txt": strToU8("Name=Test\r\nSkinType=1\r\n"),
    "light/port/appearanceConfig": appearance,
    "light/port/switchConfig": new Uint8Array([0x08, 0x01]),
    "light/res/key.png": image,
  })
  const archive = SkinArchive.open(bytes)

  assert.equal(archive.format, "bda")
  assert.equal(archive.isBdaConfig("light/skin/port/appearanceConfig"), true)
  assert.equal(archive.isBdaConfig("light/skin/port/lightAnimationConfig"), true)
  assert.equal(archive.isBdaConfig("light/skin/port/switchConfig.json"), false)
  assert.deepEqual(archive.getBytes("light/skin/port/appearanceConfig"), appearance)
  assert.deepEqual(archive.getBytes("light/skin/res/key.png"), image)
  assert.deepEqual(archive.toBytes("bda"), bytes)
  assert.throws(() => archive.toBytes("bds"), /不能转换/)
})

test("writes a changed BDA resource back to its original package path", () => {
  const archive = SkinArchive.open(zipSync({
    "Info.txt": strToU8("SkinType=1\n"),
    "dark/land/appearanceConfig": new Uint8Array([0x08, 0x01]),
    "dark/res/key.png": new Uint8Array([1]),
  }))
  archive.setBytes("dark/skin/res/key.png", new Uint8Array([9, 8]))
  const output = unzipSync(archive.toBytes("bda"))

  assert.deepEqual(output["dark/res/key.png"], new Uint8Array([9, 8]))
  assert.equal(output["dark/skin/res/key.png"], undefined)
})

test("keeps platform directories when editing current BDI and BDS packages", () => {
  const bdi = SkinArchive.open(zipSync({
    "skin/Info.txt": strToU8("SupportPlatform=I\r\n"),
    "skin/light/skin/port/py_9.ini": strToU8("CENTER=q\n"),
  }))
  bdi.setText("light/skin/port/py_9.ini", "CENTER=w\n")
  const bdiOutput = unzipSync(bdi.toBytes("bdi"))
  assert.equal(new TextDecoder().decode(bdiOutput["skin/light/skin/port/py_9.ini"]), "CENTER=w\n")
  assert.equal(bdiOutput["light/skin/port/py_9.ini"], undefined)

  const bds = SkinArchive.open(zipSync({
    "Info.txt": strToU8("SupportPlatform=A\r\n"),
    "light/port/py_9.ini": strToU8("CENTER=q\n"),
  }))
  bds.setText("light/skin/port/py_9.ini", "CENTER=w\n")
  const bdsOutput = unzipSync(bds.toBytes("bds"))
  assert.equal(new TextDecoder().decode(bdsOutput["light/port/py_9.ini"]), "CENTER=w\n")
  assert.equal(bdsOutput["light/skin/port/py_9.ini"], undefined)
})

test("normalizes and preserves single-theme BDI and BDS layouts", () => {
  const bdi = SkinArchive.open(zipSync({
    "skin/Info.txt": strToU8("SupportPlatform=I\r\n"),
    "skin/port/py_9.ini": strToU8("CENTER=q\n"),
  }))
  assert.equal(bdi.getText("light/skin/port/py_9.ini"), "CENTER=q\n")
  bdi.setText("light/skin/port/py_9.ini", "CENTER=w\n")
  assert.ok(unzipSync(bdi.toBytes("bdi"))["skin/port/py_9.ini"])

  const bds = SkinArchive.open(zipSync({
    "Info.txt": strToU8("SupportPlatform=A\r\n"),
    "port/py_9.ini": strToU8("CENTER=q\n"),
  }))
  assert.equal(bds.getText("light/skin/port/py_9.ini"), "CENTER=q\n")
  bds.setText("light/skin/port/py_9.ini", "CENTER=w\n")
  assert.ok(unzipSync(bds.toBytes("bds"))["port/py_9.ini"])
})

test("stores newly generated canonical landscape files in the package's native paths", () => {
  const bda = SkinArchive.open(zipSync({
    "port/appearanceConfig": new Uint8Array([8, 1]),
  }))
  bda.setBytes("light/skin/land/appearanceConfig", new Uint8Array([8, 2]))
  assert.ok(unzipSync(bda.toBytes())["land/appearanceConfig"])
  assert.equal(unzipSync(bda.toBytes())["light/skin/land/appearanceConfig"], undefined)

  const bds = SkinArchive.open(zipSync({
    "light/port/gen.ini": strToU8("[PANEL]\nSIZE=1080,600\n"),
  }))
  bds.setText("light/skin/land/gen.ini", "[PANEL]\nSIZE=1920,600\n")
  assert.ok(unzipSync(bds.toBytes())["light/land/gen.ini"])
})

test("exports legacy iOS structure as an importable BDI package", () => {
  const archive = SkinArchive.open(zipSync({
    "Info.txt": strToU8("Name=Test\r\nSupportPlatform=I\r\n"),
    "demo.png": new Uint8Array([1, 2, 3]),
    "light/skin/port/py_9.ini": strToU8("[KEY1]\nCENTER=q\n"),
  }))
  const output = unzipSync(archive.toBytes("bdi"))

  assert.ok(output["skin/Info.txt"])
  assert.ok(output["skin/demo.png"])
  assert.ok(output["skin/light/skin/port/py_9.ini"])
  assert.match(new TextDecoder().decode(output["skin/Info.txt"]), /SupportPlatform=I/)
  assert.equal(output["Info.txt"], undefined)
})

test("exports canonical skin data as an Android BDS package", () => {
  const archive = SkinArchive.open(zipSync({
    "Info.txt": strToU8("Name=Test\r\nSupportPlatform=I\r\n"),
    "light/skin/port/py_9.ini": strToU8("[KEY1]\nCENTER=q\n"),
  }))
  const output = unzipSync(archive.toBytes("bds"))
  const info = new TextDecoder().decode(output["Info.txt"])

  assert.ok(output["light/port/py_9.ini"])
  assert.equal(output["light/skin/port/py_9.ini"], undefined)
  assert.match(info, /SupportPlatform=A/)
  assert.match(info, /Style=default/)
})

test("removes the Android style marker when exporting BDI", () => {
  const archive = SkinArchive.open(zipSync({
    "Info.txt": strToU8("Name=Test\r\nStyle=default\r\nSupportPlatform=A\r\n"),
    "port/py_9.ini": strToU8("CENTER=q\n"),
  }))
  const output = unzipSync(archive.toBytes("bdi"))
  const info = new TextDecoder().decode(output["skin/Info.txt"])

  assert.match(info, /SupportPlatform=I/)
  assert.doesNotMatch(info, /^Style=/m)
})

const LOCAL_SIGNATURE_FOR_TEST = 0x04034b50
