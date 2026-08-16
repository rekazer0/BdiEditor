import assert from "node:assert/strict"
import test from "node:test"
import { IniDocument } from "../src/ini.ts"
import {
  decodeAiffPcm,
  iniSoundStyles,
  isSoundPath,
  nextSoundStyleID,
  setIniSoundStyle,
  soundFilenameForKey,
  soundPathForFilename,
  soundResourcePaths,
} from "../src/sounds.ts"

function aiff16(samples: number[]): Uint8Array {
  const bytes = new Uint8Array(54 + samples.length * 2)
  const view = new DataView(bytes.buffer)
  const write = (offset: number, value: string) => bytes.set(new TextEncoder().encode(value), offset)
  write(0, "FORM")
  view.setUint32(4, bytes.length - 8)
  write(8, "AIFF")
  write(12, "COMM")
  view.setUint32(16, 18)
  view.setUint16(20, 1)
  view.setUint32(22, samples.length)
  view.setUint16(26, 16)
  bytes.set([0x40, 0x0e, 0xac, 0x44, 0, 0, 0, 0, 0, 0], 28)
  write(38, "SSND")
  view.setUint32(42, 8 + samples.length * 2)
  samples.forEach((sample, index) => view.setInt16(54 + index * 2, sample))
  return bytes
}

test("discovers orientation and shared key sound resources without duplicates", () => {
  const names = [
    "light/skin/port/res/key.ogg",
    "light/skin/res/key.ogg",
    "light/skin/res/space.wav",
    "light/skin/res/not-a-sound.png",
  ]
  assert.deepEqual(soundResourcePaths(names, "light", "port"), [
    "light/skin/port/res/key.ogg",
    "light/skin/res/space.wav",
  ])
  assert.equal(soundPathForFilename(names, "light", "port", "key.ogg"), "light/skin/port/res/key.ogg")
  assert.equal(isSoundPath("res/key.aiff"), true)
})

test("resolves per-key and panel sound styles from legacy skin documents", () => {
  const layout = IniDocument.parse("[PANEL]\nSOUND_STYLE=10\n[KEY1]\nSOUND_STYLE=11\n[KEY2]\n")
  const styles = IniDocument.parse("[STYLE10]\nPRESS_SOUND_PATH=default.ogg\n[STYLE11]\nPRESS_SOUND_PATH=space.wav\n")
  assert.equal(soundFilenameForKey(layout, "KEY1", styles), "space.wav")
  assert.equal(soundFilenameForKey(layout, "KEY2", styles), "default.ogg")
  assert.deepEqual(iniSoundStyles(styles), [
    { styleID: "10", filename: "default.ogg" },
    { styleID: "11", filename: "space.wav" },
  ])
})

test("creates a sound style and updates the global style count", () => {
  const styles = IniDocument.parse("[GLOBAL]\nSTYLE_NUM=8\n[STYLE8]\nNM_COLOR=FFFFFFFF\n")
  assert.equal(nextSoundStyleID(styles), "9")
  setIniSoundStyle(styles, "9", "key.ogg")
  assert.equal(styles.get("STYLE9", "PRESS_SOUND_PATH"), "key.ogg")
  assert.equal(styles.get("GLOBAL", "STYLE_NUM"), "9")
})

test("decodes uncompressed AIFF PCM used by iOS key sounds", () => {
  const decoded = decodeAiffPcm(aiff16([-32768, 0, 32767]))
  assert.equal(decoded.sampleRate, 44100)
  assert.equal(decoded.samplesDecoded, 3)
  assert.deepEqual(Array.from(decoded.channelData[0]).map((value) => Math.round(value * 32768)), [-32768, 0, 32767])
})
