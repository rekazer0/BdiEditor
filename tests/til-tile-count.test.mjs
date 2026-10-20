import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { SkinArchive } from '../src/skin.ts'
import { IniDocument } from '../src/ini.ts'
import { convertBdaArchive } from '../src/bda-convert.ts'
import { convertSsfDocument, ssfDocumentBytes } from '../src/ssf/ssf-convert.ts'
import { ssfFixture } from './helpers/ssf-fixture.mjs'

const read = (path) => new Uint8Array(readFileSync(new URL(path, import.meta.url)))
const templates = {
  sogou: SkinArchive.open(read('../public/sogou-template.bds')),
  bda: SkinArchive.open(read('../public/default-template.bda'), 'bda'),
}

// Baidu Android's ImginiLoader sizes the slice table from [GLOBAL] TILE_NUM and drops any IMG<n> above it;
// it has no IMG_NUM key (V6 p43/p162), so a .til without TILE_NUM shows no image at all.
function assertTileCounts(archive, label) {
  const tiles = archive.names().filter((name) => name.endsWith('.til'))
  assert.ok(tiles.length > 0, label)
  for (const name of tiles) {
    const document = IniDocument.parse(archive.getText(name))
    const slices = document.sections().filter((section) => /^IMG\d+$/.test(section)).map((section) => Number(section.slice(3)))
    assert.ok(Number(document.get('GLOBAL', 'TILE_NUM')) >= Math.max(...slices), `${label} ${name}: TILE_NUM`)
  }
}

test('converted skins declare TILE_NUM so Android loads their slices', async () => {
  const source = SkinArchive.open(await ssfDocumentBytes(ssfFixture()), 'ssf')
  for (const format of ['bds', 'bdi']) {
    assertTileCounts(SkinArchive.open((await convertSsfDocument(source, format, templates)).bytes, format), `SSF → ${format}`)
  }
  assertTileCounts(convertBdaArchive(templates.bda, SkinArchive.open(read('../public/bda-base.bds'))).archive, 'BDA → bds')
})
