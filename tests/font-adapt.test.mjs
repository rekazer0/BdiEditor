import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { SkinArchive } from '../src/skin.ts'
import { AtlasResolver } from '../src/atlas.ts'
import { fontAdaptText, parseFontJson } from '../src/font-adapt.ts'

const open = (name) => SkinArchive.open(new Uint8Array(readFileSync(new URL(`../public/${name}`, import.meta.url))))

test('font.json text replaces the Xiaomi template images, like the phone draws it', () => {
  const resolver = new AtlasResolver(open('templates/xiaomi-unified-rounded-blur.bds'), 'light', 'port')
  // KEY17 FORE_STYLE=2 is the main,2 slice in default.css; font.json turns it into 50px system text.
  assert.deepEqual(resolver.resolveStyleText('2', false), {
    text: '重输', fontSize: 50, color: 'rgba(45, 46, 48, 1)', emphasis: undefined, replacesImage: true, fontName: undefined,
  })
  assert.equal(resolver.resolveStyleText('148', false).emphasis, 'first')
  assert.equal(resolver.resolveStyleText('108', false).emphasis, 'last')
  // Styles without a font.json entry keep their SHOW text and images.
  assert.equal(resolver.resolveStyleText('72', false).replacesImage, undefined)
})

test('font.json parsing tolerates a BOM and ignores entries that are not StyleN objects', () => {
  const entries = parseFontJson('\uFEFF{"Style7":{"contentText":"A","fontSize":40},"Other":{},"Style8":3}')
  assert.deepEqual([...entries.keys()], ['7'])
  assert.equal(parseFontJson('not json').size, 0)
  assert.equal(fontAdaptText({ fontSize: 40 }, false), undefined)
})
