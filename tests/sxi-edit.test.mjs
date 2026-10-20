import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addSxiImageStyle, setSxiForeground, setSxiStyleImage, sxiSectionRanges, sxiStylePointer } from '../src/palm/sxi-edit.ts'
import { encodeSkinJson, parseSkinJson, sxiDerivedFiles } from '../src/palm/sxi-projection.ts'
import { SkinArchive } from '../src/skin.ts'
import { strToU8, zipSync } from 'fflate'

const layout = ['default', 'port_layout', 'b', 'full26Pinyin']
const styles = ['default', 's_info', 'ss_1']
const board = { keys: [{ id: '9', b: { base_f: [1728], base_b: 3 }, values: [4, 'brace } and \\" quote'], rect: [[0, 0], [100, 100]] }, { id: '2', b: {} }], key_fix: { 7: { b: { base_f: [1728] } } } }
const original = encodeSkinJson({ default: { port_layout: { b: { full26Pinyin: board } }, s_info: { ss_1: { 1728: { id: 'STYLE1728', s_2: { normal: 'old,0', hl: 'old,1' }, s_1: { text: 'q' } } } } } })

test('SXI foreground append and state image edits persist through save/reopen without losing other data', () => {
  const added = addSxiImageStyle(original, styles, 'NM_IMG', 'new,2')
  let after = setSxiForeground(added.text, layout, ['KEY9', 'KEY2', 'TIP7'], `1728,${added.id}`)
  after = setSxiStyleImage(after, styles, [`STYLE${added.id}`], 'HL_IMG', 'new,3')
  const archive = SkinArchive.open(zipSync({ 'skin.json': strToU8(original) }), 'sxi')
  archive.setText('skin.json', after)
  const reopened = SkinArchive.open(archive.toBytes('sxi'), 'sxi')
  const skin = parseSkinJson(reopened.getText('skin.json'))
  assert.deepEqual(skin.default.port_layout.b.full26Pinyin.keys[0].b, { base_b: 3, base_f: [1728, Number(added.id)] })
  assert.deepEqual(skin.default.s_info.ss_1[added.id].s_2, { normal: 'new,2', hl: 'new,3' })
  assert.deepEqual(skin.default.s_info.ss_1[1728].s_1, { text: 'q' })
  assert.match(sxiDerivedFiles(skin).get('light/skin/port/py_26.ini').text, new RegExp(`FORE_STYLE=1728,${added.id}`))
  archive.setText('skin.json', original)
  assert.deepEqual(parseSkinJson(archive.getText('skin.json')), parseSkinJson(original))
  assert.throws(() => setSxiForeground(original, layout, ['KEY9'], 'NaN'), /编号/)
  assert.throws(() => setSxiForeground(original, layout, ['KEY404'], '1'), /KEY404/)
})

test('SXI source ranges follow key IDs, nested bases, escaped strings and state tips', () => {
  const text = encodeSkinJson(board)
  const ranges = sxiSectionRanges(text, ['KEY9', 'KEY2'])
  assert.deepEqual(ranges.map(([a, b]) => JSON.parse(text.slice(a, b)).id), ['9', '2'])
  const [a, b] = sxiSectionRanges(text, ['TIP7'])[0]
  assert.match(text.slice(a, b), /base_f/)
  assert.equal(sxiSectionRanges(text, ['KEY404']).length, 0)
  assert.doesNotThrow(() => sxiSectionRanges('{"keys":[{', ['KEY9']))
})

test('SXI image edits target an orientation table even when identical tables were deduplicated in the projection', () => {
  const skin = parseSkinJson(original)
  skin.default.s_port = structuredClone(skin.default.s_info)
  const text = encodeSkinJson(skin)
  assert.equal(sxiDerivedFiles(skin).has('light/skin/port/res/default.css'), false)
  const own = sxiStylePointer(text, styles, 'port')
  const added = addSxiImageStyle(text, own, 'NM_IMG', 'new,1')
  const after = parseSkinJson(added.text)
  assert.deepEqual(after.default.s_info, skin.default.s_info)
  assert.match(sxiDerivedFiles(after).get('light/skin/port/res/default.css').text, /NM_IMG=new,1/)
  assert.deepEqual(sxiStylePointer(text, styles, 'land'), styles)
})
