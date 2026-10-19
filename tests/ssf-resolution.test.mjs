// BDI/BDS exports preserve the actual SSF canvas instead of substituting a Baidu layout.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { strFromU8, strToU8 } from 'fflate'
import { IniDocument } from '../src/ini.ts'
import { SkinArchive } from '../src/skin.ts'
import { convertSsfDocument, ssfDocumentBytes, ssfPreviewFiles } from '../src/ssf/ssf-convert.ts'
import { convertBdaArchive } from '../src/bda-convert.ts'
import { convertSsfToBaidu } from '../src/ssf/ssf-to-baidu.ts'
import { syncKeyStateTips } from '../src/ssf/ssf-state-tips.ts'
import { SsfPackage } from '../src/ssf/ssf-package.ts'
import { ssfFixture } from './helpers/ssf-fixture.mjs'

const read = (path) => new Uint8Array(readFileSync(new URL(path, import.meta.url)))
const bda = SkinArchive.open(read('../public/default-template.bda'), 'bda')
const skeleton = convertBdaArchive(bda, SkinArchive.open(read('../public/bda-base.bds'))).archive
const templates = { bda, sogou: SkinArchive.open(read('../public/sogou-template.bds')) }
const open = async (bytes) => SkinArchive.open(await ssfDocumentBytes(bytes), 'ssf')
const size = (archive, path) => IniDocument.parse(archive.getText(path)).get('PANEL', 'SIZE')
const layouts = (output) => output.names()
  .filter((name) => /\/(?:port|land)\/[^/]+\.ini$/.test(name) && !name.endsWith('/gen.ini'))
  .map((name) => [name, IniDocument.parse(output.getText(name))])

test('SSF export uses the Sogou canvas skeleton at 1080', () => {
  assert.equal(size(templates.sogou, 'light/skin/port/gen.ini'), '1080,642')
  assert.equal(size(templates.sogou, 'light/skin/land/gen.ini'), '1920,559')
  const legacy = SkinArchive.open(read('../public/default-template.bds'))
  assert.equal(size(legacy, 'light/skin/port/gen.ini'), '480,312')
})

test('SSF → BDI and BDS reopen with every preview layout, toolbar, image and font unchanged', async () => {
  const fixture = await open(ssfFixture())
  const preview = ssfPreviewFiles(fixture, templates.sogou).files
  for (const format of ['bdi', 'bds']) {
    const { bytes } = await convertSsfDocument(fixture, format, templates)
    const output = SkinArchive.open(bytes, format)
    for (const theme of ['light', 'dark']) {
      assert.equal(size(output, `${theme}/skin/port/gen.ini`), '1080,642', `${format} ${theme} port`)
      assert.equal(size(output, `${theme}/skin/land/gen.ini`), '1920,570', `${format} ${theme} land`)
    }
    for (const [path, bytes] of preview) {
      if (/\.(?:ini|cnd)$/.test(path)) {
        const expected = IniDocument.parse(strFromU8(bytes))
        for (const { section, key } of expected.entries()) if (key.startsWith('SSF_')) expected.remove(section, key)
        assert.deepEqual(output.getBytes(path), strToU8(expected.toString()), `${format}: ${path}`)
        assert.ok(!output.getText(path).includes('SSF_'), `${path}: editor metadata must not become exported properties`)
      } else if (/\.(?:png|til|ttf)$/.test(path)) assert.deepEqual(output.getBytes(path), bytes, `${format}: ${path}`)
    }
    const toolbar = IniDocument.parse(output.getText('light/skin/port/cand1.cnd'))
    assert.equal(toolbar.get('CAND', 'ICON_NUM'), '7')
    for (let i = 1; i <= 7; i++) {
      assert.ok(toolbar.get(`ICON${i}`, 'KEY'))
      assert.ok(toolbar.get(`ICON${i}`, 'SIZE'))
    }
    const board = IniDocument.parse(output.getText('light/skin/port/py_9.ini'))
    const portraitWidth = Math.max(...board.sections().filter((name) => /^KEY\d+$/.test(name))
      .map((name) => board.get(name, 'VIEW_RECT').split(',').map(Number)).map(([x, , width]) => x + width))
    assert.ok(portraitWidth > 720 && portraitWidth <= 1080, `${format}: ${portraitWidth}`)
  }
})

test('SSF → BDI and BDS convert the same layout tree, only packaged for their platform', async () => {
  const fixture = await open(ssfFixture())
  const trees = {}
  for (const format of ['bdi', 'bds']) {
    const { bytes } = await convertSsfDocument(fixture, format, templates)
    const output = SkinArchive.open(bytes, format)
    trees[format] = output.names()
      .filter((name) => /\.(?:ini|cnd|css|til|png|ttf)$/i.test(name))
      .map((name) => [name, output.getBytes(name)])
  }
  assert.deepEqual(trees.bdi.map(([name]) => name), trees.bds.map(([name]) => name))
  for (const [index, [name, bytes]] of trees.bds.entries()) {
    const converted = trees.bdi[index][1]
    assert.ok(converted && converted.length === bytes.length && converted.every((byte, offset) => byte === bytes[offset]), name)
  }
})

test('SSF → BDS paints the Sogou keyboard background on every board', async () => {
  const { bytes } = await convertSsfDocument(await open(ssfFixture()), 'bds', templates)
  const output = SkinArchive.open(bytes, 'bds')
  for (const theme of ['light', 'dark']) for (const orientation of ['port', 'land']) {
    const panel = IniDocument.parse(output.getText(`${theme}/skin/${orientation}/gen.ini`)).get('PANEL', 'BACK_STYLE')
    assert.ok(panel, `${theme}/${orientation}: no background`)
    assert.match(output.getText(`${theme}/skin/res/default.css`), new RegExp(`\\[STYLE${panel}\\]`))
    for (const [path, document] of layouts(output)) {
      if (!path.startsWith(`${theme}/skin/${orientation}/`) || !document.sections().includes('PANEL')) continue
      assert.equal(document.get('PANEL', 'BACK_STYLE'), panel, path)
    }
  }
})

test('legacy Baidu state TIPs show the painted key, not the skeleton artwork', async () => {
  const { archive: output } = convertSsfToBaidu(await SsfPackage.open(ssfFixture()), skeleton)
  syncKeyStateTips(output)
  let checked = 0
  for (const [path, document] of layouts(output)) {
    const sections = document.sections()
    for (const section of sections.filter((name) => /^KEY\d+$/.test(name))) {
      const states = document.get(section, 'STAT_STYLE')
      if (!states) continue
      for (const match of states.matchAll(/S\d+_(\d+)/g)) {
        const tip = `TIP${match[1]}`
        if (!sections.includes(tip)) continue
        assert.equal(document.get(tip, 'BACK_STYLE'), document.get(section, 'BACK_STYLE'), `${path} ${tip} background`)
        assert.equal(document.get(tip, 'FORE_STYLE'), document.get(section, 'FORE_STYLE'), `${path} ${tip} foreground`)
        assert.equal(document.get(tip, 'FORE_OFFSET'), undefined, `${path} ${tip} offset`)
        checked++
      }
    }
  }
  assert.ok(checked > 0)
})
