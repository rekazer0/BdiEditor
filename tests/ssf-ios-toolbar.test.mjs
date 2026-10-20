import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { SkinArchive } from '../src/skin.ts'
import { IniDocument } from '../src/ini.ts'
import { parseXmlPlist } from '../src/palm/palm-plist.ts'
import { convertSsfDocument, ssfDocumentBytes } from '../src/ssf/ssf-convert.ts'
import { decodePng, cropImage } from '../src/ssf/ssf-png.ts'
import { ssfFixture } from './helpers/ssf-fixture.mjs'

const read = (path) => new Uint8Array(readFileSync(new URL(path, import.meta.url)))
const templates = {
  sogou: SkinArchive.open(read('../public/sogou-template.bds')),
  bda: SkinArchive.open(read('../public/default-template.bda'), 'bda'),
}

test('SSF → BDI packages native iOS toolbar plists, exact normal/pressed artwork and an F14 container', async () => {
  const original = await ssfDocumentBytes(ssfFixture())
  const source = SkinArchive.open(original, 'ssf')
  const bds = SkinArchive.open((await convertSsfDocument(source, 'bds', templates)).bytes)
  const converted = await convertSsfDocument(source, 'bdi', templates)
  const bdi = SkinArchive.open(converted.bytes, 'bdi')
  assert.ok(converted.warnings.some((text) => text.includes('AI侃侃')))
  for (const theme of ['light', 'dark']) {
    const prefix = `${theme}/skin/`
    const menuPath = `${prefix}res/logo/com.baidu.inputmethod.toolbarMenuItems.plist`
    const items = parseXmlPlist(bdi.getBytes(menuPath))
    assert.deepEqual(items.map(({ Name }) => Name), ['19', '17', '23', '26', '45'])
    assert.ok(items.every(({ Position }) => Position === 'toolbar'))
    assert.equal(bdi.getText(menuPath), bdi.getText(menuPath.replace('.plist', '.nijigen.plist')))
    const logo = parseXmlPlist(bdi.getBytes(`${prefix}res/logo/customImageConfig.plist`))
    assert.equal(logo[0].Name, '0')
    const cand = IniDocument.parse(bds.getText(`${prefix}port/cand1.cnd`))
    const css = IniDocument.parse(bds.getText(`${prefix}res/default.css`))
    for (const [item, action] of [...items.map((item, index) => [item, ['F7', 'F13', 'F72', 'F82', 'F68'][index]]), [logo[0], 'F31']]) {
      const section = cand.sections().find((name) => cand.get(name, 'KEY') === action)
      for (const [state, field] of [['Normal', 'NM_IMG'], ['Highlight', 'HL_IMG']]) {
        const [resource, tile] = css.get(`STYLE${cand.get(section, 'FORE_STYLE')}`, field).split(',')
        const til = IniDocument.parse(bds.getText(`${prefix}res/${resource}.til`))
        const rect = til.get(`IMG${tile}`, 'SOURCE_RECT').split(',').map(Number)
        const expected = cropImage(decodePng(bds.getBytes(`${prefix}res/${resource}.png`)), ...rect)
        // Every plist image name resolves to <name>_iphone@3x.png, the way native skins ship them.
        const name = item.Images.Normal[state]
        const actual = decodePng(bdi.getBytes(`${prefix}res/logo/${name}_iphone@3x.png`))
        assert.deepEqual(actual, expected, `${theme} ${action} ${state}`)
        assert.equal(item.Images.Theme[state], name)
      }
    }
    for (const orientation of ['port', 'land']) {
      const gen = IniDocument.parse(bdi.getText(`${prefix}${orientation}/gen.ini`))
      assert.equal(gen.get('LOGO', 'LAYOUT_NAME'), 'logo', `${theme}/${orientation}: load native logo resources`)
      const logoLayout = IniDocument.parse(bdi.getText(`${prefix}${orientation}/${gen.get('LOGO', 'LAYOUT_NAME')}.ini`))
      assert.equal(logoLayout.get('GLOBAL', 'VERSION'), '1')
      // ICON_NUM=1 counts an [ICON1]; the menu colours come from the candidate bar (V6 p160).
      const bdiCss = IniDocument.parse(bdi.getText(`${prefix}res/default.css`))
      assert.equal(logoLayout.get('PANEL', 'ICON_INDEX'), '1')
      assert.match(bdiCss.get(`STYLE${logoLayout.get('PANEL', 'BACK_STYLE')}`, 'NM_COLOR'), /^[0-9A-F]{6}$/)
      assert.equal(logoLayout.get('ICON1', 'TEXT_STYLE'), cand.get('CAND', 'FORE_STYLE'))
      const native = IniDocument.parse(bdi.getText(`${prefix}${orientation}/cand1.cnd`))
      assert.deepEqual([1, 2, 3, 4].map((id) => native.get(`ICON${id}`, 'KEY')), ['F31', 'F14', 'F8', 'F9'])
      assert.equal(native.get('CAND', 'ICON_NUM'), '4')
      assert.equal(native.get('ICON4', 'PERSIST'), '2')
      assert.deepEqual([1, 2, 3, 4].map((id) => native.get(`ICON${id}`, 'ANCHOR_TYPE')), ['1', '5', '3', '3'])
      assert.ok(Number(native.get('CAND', 'PADDING').split(',')[2]) > 0)
      for (const section of ['ICON1', 'ICON3', 'ICON4']) {
        const style = native.get(section, 'FORE_STYLE')
        const [resource, tile] = css.get(`STYLE${style}`, 'NM_IMG').split(',')
        const rect = IniDocument.parse(bds.getText(`${prefix}res/${resource}.til`)).get(`IMG${tile}`, 'SOURCE_RECT').split(',').map(Number)
        // Points as whole numbers, like native skins (100 px artwork → FIX_SIZE=33,33).
        assert.equal(native.get(section, 'FIX_SIZE'), rect.slice(2).map((size) => Math.round(size / 3)).join(','))
      }
      for (const field of ['BACK_STYLE', 'FORE_STYLE']) {
        assert.equal(native.get('CAND', field), IniDocument.parse(bds.getText(`${prefix}${orientation}/cand1.cnd`)).get('CAND', field))
      }
    }
  }
  assert.deepEqual(source.toBytes(), original)
  assert.equal(bds.names().some((path) => path.includes('/res/logo/')), false)
})

test('SSF → BDI maps native cursor 18 and clipboard 35 from the source menu artwork, including theme and pressed fallback', async () => {
  const source = SkinArchive.open(await ssfDocumentBytes(ssfFixture()), 'ssf')
  for (const folder of ['status1', 'status2']) {
    source.setBytes(`1080/${folder}/ime_function_textedit.png`, source.getBytes(`1080/${folder}/902.png`))
    source.setBytes(`1080/${folder}/ime_function_textedit_p.png`, source.getBytes(`1080/${folder}/26q_x.png`))
    source.setBytes(`1080/${folder}/ime_function_clipboard.png`, source.getBytes(`1080/${folder}/delf_26.png`))
  }
  const bdi = SkinArchive.open((await convertSsfDocument(source, 'bdi', templates)).bytes, 'bdi')
  for (const [theme, folder] of [['light', 'status1'], ['dark', 'status2']]) {
    const prefix = `${theme}/skin/res/logo/`
    const items = parseXmlPlist(bdi.getBytes(`${prefix}com.baidu.inputmethod.toolbarMenuItems.plist`))
    for (const [id, file, position] of [['18', 'ime_function_textedit', 'toolbar'], ['35', 'ime_function_clipboard', 'menu']]) {
      const item = items.find(({ Name }) => Name === id)
      assert.equal(item.Position, position)
      for (const state of ['Normal', 'Highlight']) {
        const original = source.getBytes(`1080/${folder}/${file}${state === 'Highlight' ? '_p' : ''}.png`) ?? source.getBytes(`1080/${folder}/${file}.png`)
        assert.deepEqual(bdi.getBytes(`${prefix}${item.Images.Normal[state]}_iphone@3x.png`), original)
      }
    }
  }
})
