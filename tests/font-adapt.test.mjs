import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { SkinArchive } from '../src/skin.ts'
import { AtlasResolver } from '../src/atlas.ts'

const open = (name) => SkinArchive.open(new Uint8Array(readFileSync(new URL(`../public/${name}`, import.meta.url))))

test('official Android keeps the image foregrounds when using the default system font', () => {
  const resolver = new AtlasResolver(open('templates/xiaomi-unified-rounded-blur.bds'), 'light', 'port')
  for (const id of ['2', '148', '108']) {
    assert.ok(resolver.sourceSize(id, false), `STYLE${id} must retain its image`)
    assert.equal(resolver.resolveStyleText(id, false), undefined, `STYLE${id} must not use font.json`)
    assert.equal(resolver.resolveStyleText(id, true), undefined)
  }
  assert.equal(resolver.resolveStyleText('72', false)?.text, 'ABC')
})
