import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { SkinArchive } from '../src/skin.ts'
import { convertBdaArchive } from '../src/bda-convert.ts'
import { bdaSoundResourceType, updateBdaKeySound } from '../src/bda.ts'

const ogg = new Uint8Array(readFileSync(new URL('./fixtures/click.ogg', import.meta.url)))

function aiff(frames = 32) {
  const ssndLength = 8 + frames * 2
  const bytes = new Uint8Array(12 + 26 + 8 + ssndLength)
  const view = new DataView(bytes.buffer)
  const ascii = (offset, text) => [...text].forEach((char, index) => { bytes[offset + index] = char.charCodeAt(0) })
  ascii(0, 'FORM'); view.setUint32(4, bytes.length - 8); ascii(8, 'AIFF')
  ascii(12, 'COMM'); view.setUint32(16, 18); view.setUint16(20, 1); view.setUint32(22, frames); view.setUint16(26, 16)
  // 22050 Hz as an 80-bit extended float
  view.setUint16(28, 0x400d); view.setUint32(30, 0xac440000); view.setUint32(34, 0)
  ascii(38, 'SSND'); view.setUint32(42, ssndLength)
  for (let frame = 0; frame < frames; frame++) view.setInt16(54 + frame * 2, frame % 2 ? 8000 : -8000)
  return bytes
}

function isWav(bytes) {
  return strFromU8(bytes.subarray(0, 4)) === 'RIFF' && strFromU8(bytes.subarray(8, 12)) === 'WAVE'
}

test('BDS → BDI rewrites Ogg key sounds as WAV and updates PRESS_SOUND_PATH', async () => {
  const archive = SkinArchive.open(zipSync({
    'Info.txt': strToU8('AtomSkinName=test'),
    'port/py_9.ini': strToU8('[PANEL]\nSOUND_STYLE=7\n'),
    'res/default.css': strToU8('[GLOBAL]\nSTYLE_NUM=7\n\n[STYLE7]\nPRESS_SOUND_PATH=click.ogg\n'),
    'res/click.ogg': ogg,
  }))
  const files = unzipSync(await archive.toBytesAsync('bdi'))
  assert.equal(files['skin/res/click.ogg'], undefined)
  assert.ok(isWav(files['skin/res/click.wav']))
  assert.match(strFromU8(files['skin/res/default.css']), /^PRESS_SOUND_PATH=click\.wav$/m)
})

test('BDI → BDS rewrites AIFF key sounds as WAV', async () => {
  const archive = SkinArchive.open(zipSync({
    'skin/Info.txt': strToU8('AtomSkinName=test'),
    'skin/port/py_9.ini': strToU8('[PANEL]\nSOUND_STYLE=1\n'),
    'skin/res/default.css': strToU8('[STYLE1]\r\nPRESS_SOUND_PATH=tap.aiff\r\n'),
    'skin/res/tap.aiff': aiff(),
  }), 'bdi')
  const files = unzipSync(await archive.toBytesAsync('bds'))
  assert.equal(files['res/tap.aiff'], undefined)
  assert.ok(isWav(files['res/tap.wav']))
  assert.equal(strFromU8(files['res/default.css']), '[STYLE1]\r\nPRESS_SOUND_PATH=tap.wav\r\n')
})

test('same-format save leaves sounds untouched', async () => {
  const source = zipSync({
    'port/py_9.ini': strToU8('[PANEL]\n'),
    'res/default.css': strToU8('[STYLE1]\nPRESS_SOUND_PATH=tap.aiff\n'),
    'res/tap.aiff': aiff(),
  })
  const files = unzipSync(await SkinArchive.open(source).toBytesAsync('bds'))
  assert.ok(files['res/tap.aiff'])
})

test('BDA → BDS keeps key sounds', async () => {
  const template = unzipSync(new Uint8Array(readFileSync(new URL('../public/default-template.bda', import.meta.url))))
  let soundConfig = updateBdaKeySound(new Uint8Array(), 'KEY_DELETE', { type: bdaSoundResourceType('del.ogg'), resourceID: 'del.ogg' })
  soundConfig = updateBdaKeySound(soundConfig, 'default', { type: bdaSoundResourceType('tap.ogg'), resourceID: 'tap.ogg' })
  soundConfig = updateBdaKeySound(soundConfig, 'default', { type: bdaSoundResourceType('tap.aiff'), resourceID: 'tap.aiff' }, true)
  const source = SkinArchive.open(zipSync({
    ...template,
    'port/soundConfig': soundConfig,
    'res/tap.ogg': ogg,
    'res/del.ogg': ogg,
    'res/tap.aiff': aiff(),
  }), 'bda')
  const base = SkinArchive.open(new Uint8Array(readFileSync(new URL('../public/bda-base.bds', import.meta.url))))
  const result = convertBdaArchive(source, base, 'bds')
  const files = unzipSync(await result.archive.platformBytesAsync('bds'))
  const prefix = Object.keys(files).some((name) => name.startsWith('light/')) ? 'light/' : ''
  const css = strFromU8(files[`${prefix}res/default.css`])
  const tapStyle = css.match(/\[STYLE(\d+)\]\r?\nPRESS_SOUND_PATH=tap\.ogg/)?.[1]
  const delStyle = css.match(/\[STYLE(\d+)\]\r?\nPRESS_SOUND_PATH=del\.ogg/)?.[1]
  assert.ok(tapStyle && delStyle, css.slice(-200))
  assert.ok(files[`${prefix}res/tap.ogg`] && files[`${prefix}res/del.ogg`])
  assert.equal(files[`${prefix}res/tap.aiff`], undefined)
  const layout = strFromU8(files[`${prefix}port/py_9.ini`] ?? files[`${prefix}port/py_26.ini`])
  assert.match(layout, new RegExp(`^SOUND_STYLE=${tapStyle}$`, 'm'))
})

test('BDA → BDI prefers iOS key sounds', async () => {
  const template = unzipSync(new Uint8Array(readFileSync(new URL('../public/default-template.bda', import.meta.url))))
  let soundConfig = updateBdaKeySound(new Uint8Array(), 'default', { type: 5, resourceID: 'tap.ogg' })
  soundConfig = updateBdaKeySound(soundConfig, 'default', { type: 10, resourceID: 'tap.aiff' }, true)
  const source = SkinArchive.open(zipSync({
    ...template, 'port/soundConfig': soundConfig, 'res/tap.ogg': ogg, 'res/tap.aiff': aiff(),
  }), 'bda')
  const base = SkinArchive.open(new Uint8Array(readFileSync(new URL('../public/bda-base.bds', import.meta.url))))
  const files = unzipSync(await convertBdaArchive(source, base, 'bdi').archive.platformBytesAsync('bdi'))
  const names = Object.keys(files).filter((name) => /\.(ogg|aiff|wav)$/.test(name))
  assert.deepEqual(names, names.filter((name) => name.endsWith('tap.aiff')))
  assert.ok(names.length)
})
