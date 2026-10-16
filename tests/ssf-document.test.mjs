// A Sogou skin opened as an editor document: its own files, saved in place, previewed as Baidu.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { IniDocument } from '../src/ini.ts'
import { SkinArchive } from '../src/skin.ts'
import { parseZip } from '../src/skin-zip.ts'
import { documentPackage, ssfDocumentBytes, ssfPreviewFiles } from '../src/ssf/ssf-convert.ts'
import { exportFormatFromPath } from '../src/export.ts'
import { decodePng, encodePng } from '../src/ssf/ssf-png.ts'
import { SIZES, skinContainer, solid, ssfFixture } from './helpers/ssf-fixture.mjs'

const template = SkinArchive.open(new Uint8Array(readFileSync(new URL('../public/default-template.bds', import.meta.url))))
const open = async (bytes) => SkinArchive.open(await ssfDocumentBytes(bytes), 'ssf')

test('ssf document: opens as its own format with the package paths as they are', async () => {
  const archive = await open(ssfFixture())
  assert.equal(archive.format, 'ssf')
  assert.ok(archive.names().includes('1080/status1/phoneSkin.ini'))
  assert.equal(`${documentPackage(archive).folder('light')}phoneSkin.ini`, '1080/status1/phoneSkin.ini')
  assert.equal(exportFormatFromPath('a/皮肤.ssf'), 'ssf')
  assert.equal(exportFormatFromPath('皮肤.MSSF'), 'ssf')
  // Detected from the files alone too, e.g. a content:// URI without a name.
  assert.equal(SkinArchive.open(ssfFixture()).format, 'ssf')
})

test('ssf document: a ZIP is kept byte for byte, an encrypted container becomes a ZIP, PC skins are refused', async () => {
  const zip = ssfFixture()
  assert.deepEqual(await ssfDocumentBytes(zip), zip)
  const fromContainer = await ssfDocumentBytes(await skinContainer(unzipSync(zip)))
  assert.deepEqual(Object.keys(unzipSync(fromContainer)).sort(), Object.keys(unzipSync(zip)).sort())
  await assert.rejects(ssfDocumentBytes(zipSync({ 'skin.ini': strToU8('[General]') })), /电脑版/)
})

test('ssf document: saving rewrites only the edited entry', async () => {
  const original = ssfFixture()
  const archive = await open(original)
  const path = '1080/status1/phoneSkin.ini'
  const skin = IniDocument.parse(archive.getText(path))
  skin.set('TextStyle_Candidate', 'TEXT_COLOR', '0xFF123456')
  archive.setText(path, skin.toString())
  assert.deepEqual([...archive.changed], [path])
  const saved = archive.toBytes('ssf')
  const before = new Map(parseZip(original).entries.map((entry) => [entry.name, entry.local]))
  for (const entry of parseZip(saved).entries) {
    if (entry.name === path) assert.match(strFromU8(unzipSync(saved)[path]), /0xFF123456/)
    else assert.deepEqual(entry.local, before.get(entry.name), entry.name)
  }
  archive.markSaved(saved)
  assert.equal(archive.changed.size, 0)
  assert.equal(archive.format, 'ssf')
})

test('ssf document: the preview overlay is readable, read-only, unsaved and not a change', async () => {
  const archive = await open(ssfFixture())
  const { files, warnings } = ssfPreviewFiles(archive, template)
  assert.ok(Array.isArray(warnings))
  const revision = archive.revision
  archive.setOverlay(files)
  assert.ok(archive.revision > revision)
  const layout = 'light/skin/port/py_26.ini'
  assert.ok(archive.isOverlay(layout) && archive.isText(layout))
  assert.ok(archive.names().includes(layout) && archive.names().includes('dark/skin/port/py_26.ini'))
  assert.ok(!archive.isOverlay('1080/status1/phoneSkin.ini'))
  assert.throws(() => archive.setText(layout, ''), /不能修改/)
  assert.equal(archive.changed.size, 0)
  assert.ok(!Object.keys(unzipSync(archive.toBytes('ssf'))).some((name) => name.startsWith('light/')))
  assert.ok(!archive.sourceFiles().some((file) => file.path.startsWith('light/')))
})

test('ssf document: edits show up in the rebuilt preview', async () => {
  const archive = await open(ssfFixture())
  const candidateColor = (files) => {
    const gen = IniDocument.parse(strFromU8(files.get('light/skin/port/gen.ini')))
    const cand = IniDocument.parse(strFromU8(files.get(`light/skin/port/${gen.get('CAND', 'LAYOUT_NAME')}.cnd`)))
    return IniDocument.parse(strFromU8(files.get('light/skin/res/default.css'))).get(`STYLE${cand.get('CAND', 'FORE_STYLE')}`, 'NM_COLOR')
  }
  const path = '1080/status1/phoneSkin.ini'
  const skin = IniDocument.parse(archive.getText(path))
  skin.set('TextStyle_Candidate', 'TEXT_COLOR', '0xFF123456')
  archive.setText(path, skin.toString())
  assert.equal(candidateColor(ssfPreviewFiles(archive, template).files), 'FF123456')
})

test('ssf document: Baidu and Sogou formats never repackage into each other', async () => {
  const archive = await open(ssfFixture())
  assert.throws(() => archive.toBytes('bds'), /需要经过转换/)
  await assert.rejects(archive.toBytesAsync('bdi'), /需要经过转换/)
  assert.throws(() => template.toBytes('ssf'), /需要经过转换/)
  assert.throws(() => SkinArchive.open(template.toBytes()).toBytes('bda'), /BDA/)
})

test('ssf document: a broken package does not open as a skin, and an explicit Baidu format is never taken for SSF', async () => {
  const files = unzipSync(ssfFixture())
  delete files['phoneTheme.ini']
  assert.throws(() => documentPackage(SkinArchive.open(zipSync(files), 'ssf')), /phoneTheme\.ini/)
  const baidu = unzipSync(template.toBytes())
  baidu['phoneTheme.ini'] = strToU8('[General]')
  assert.equal(SkinArchive.open(zipSync(baidu), 'bds').format, 'bds')
})

test('ssf document: rebuilt previews reuse unchanged images but never a replaced one', async () => {
  const archive = await open(ssfFixture())
  const panelPixel = (files) => {
    const gen = IniDocument.parse(strFromU8(files.get('light/skin/port/gen.ini')))
    const css = IniDocument.parse(strFromU8(files.get('light/skin/res/default.css')))
    const [name] = css.get(`STYLE${gen.get('PANEL', 'BACK_STYLE')}`, 'NM_IMG').split(',')
    return [...decodePng(files.get(`light/skin/res/${name}.png`)).data.subarray(0, 3)]
  }
  const first = ssfPreviewFiles(archive, template).files
  const again = ssfPreviewFiles(archive, template).files
  assert.deepEqual(panelPixel(again), panelPixel(first))
  archive.setBytes('1080/status1/bg.png', encodePng(solid(...SIZES.background, [9, 8, 7])))
  assert.deepEqual(panelPixel(ssfPreviewFiles(archive, template).files), [9, 8, 7])
})
