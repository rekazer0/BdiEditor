// 预览按 CSS 的 res 目录解析 FONT_PATH / FONT_NAME：真机与预览必须读到同一份内嵌字体。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { strToU8, zipSync } from 'fflate'
import { SkinArchive } from '../src/skin.ts'
import { canvasFontFamily } from '../src/atlas.ts'
import { AtlasResolver } from '../src/atlas.ts'

const archive = SkinArchive.open(zipSync({
  'Info.txt': strToU8('AtomSkinName=test'),
  'light/port/res/default.css': strToU8([
    '[GLOBAL]',
    'FONT_PATH=../../res/benxu.ttf',
    '[STYLE1]',
    'SHOW=A',
    'FONT_SIZE=40',
    '[STYLE2]',
    'SHOW=B',
    'FONT_NAME=benxu',
    '[STYLE3]',
    'SHOW=C',
    'FONT_NAME=PingFang SC',
    '[STYLE4]',
    'SHOW=D',
    'FONT_PATH=symbols.ttf',
    '',
  ].join('\n')),
  'light/res/benxu.ttf': new Uint8Array([0, 1, 2, 3]),
  'light/port/res/symbols.ttf': new Uint8Array([4, 5, 6]),
  'light/port/py_9.ini': strToU8('[PANEL]\nSIZE=480,320'),
}, { level: 0 }))

test('GLOBAL FONT_PATH with .. is embedded and used as the default font', async () => {
  const resolver = new AtlasResolver(archive, 'light', 'port')
  await resolver.ready()
  const fontName = resolver.resolveStyleText('1', false)?.fontName
  assert.match(fontName ?? '', /^BdiEmbeddedFont\d+$/)
  assert.match(canvasFontFamily(fontName), /BdiEmbeddedFont/)
})

test('per-style FONT_NAME resolves with and without an extension', async () => {
  const resolver = new AtlasResolver(archive, 'light', 'port')
  const family = resolver.resolveStyleText('1', false)?.fontName
  assert.match(resolver.resolveStyleText('2', false)?.fontName ?? '', /^BdiEmbeddedFont\d+$/)
  // benxu and the global ../../res/benxu.ttf are the same file, so the family is reused.
  assert.equal(resolver.resolveStyleText('2', false)?.fontName, family)
})

test('unknown FONT_NAME stays a system font name', async () => {
  const resolver = new AtlasResolver(archive, 'light', 'port')
  assert.equal(resolver.resolveStyleText('3', false)?.fontName, 'PingFang SC')
  assert.equal(canvasFontFamily('PingFang SC'), '"PingFang SC", system-ui')
})

test('iOS-only per-style FONT_PATH is supported when the skin already has it', async () => {
  const resolver = new AtlasResolver(archive, 'light', 'port')
  assert.match(resolver.resolveStyleText('4', false)?.fontName ?? '', /^BdiEmbeddedFont\d+$/)
})
