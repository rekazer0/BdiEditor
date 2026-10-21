import { test } from 'node:test'
import assert from 'node:assert/strict'
import { IniDocument } from '../src/ini.ts'
import { freeStyleId, textStyleSections, textStyleValue, writeTextStyleProperty } from '../src/style-properties.ts'

const css = () => IniDocument.parse(`[STYLE1]
NM_IMG=fore,1
[STYLE2]
FONT_SIZE=30
NM_COLOR=FF000000
[STYLE3]
SHOW=中
[STYLE4]
NM_COLOR=FFFFFFFF
`)

test('text styles: image layers are skipped, STYLE<n/100> stands in for a missing STYLE<n>', () => {
  assert.deepEqual(textStyleSections(css(), '1,2'), ['STYLE2'])
  assert.deepEqual(textStyleSections(css(), '301, 2, 2'), ['STYLE3', 'STYLE2'])
  assert.deepEqual(textStyleSections(css(), '1,99'), [])
})

test('text style values follow the preview: the first layer with the property, through STYLE<n/100>', () => {
  assert.equal(textStyleValue(css(), { foreground: '3,4' }, 'NM_COLOR'), 'FFFFFFFF')
  assert.equal(textStyleValue(css(), { foreground: '201' }, 'FONT_SIZE'), '30')
  assert.equal(textStyleValue(css(), { foreground: '1' }, 'FONT_SIZE'), '')
})

test('free style ids avoid an existing STYLE<id/100> so a new style inherits nothing', () => {
  assert.equal(freeStyleId(css()), 5)
  assert.equal(freeStyleId(IniDocument.parse('[STYLE1]\n[STYLE99]\n')), 200)
})

test('writing text: the layer that has it, else the first text layer, else one new style for every bare text', () => {
  const styles = css()
  const owners = writeTextStyleProperty(styles, [
    { foreground: '1,2', owner: { path: 'py.ini', section: 'KEY1', key: 'FORE_STYLE', append: true } },
    { foreground: '3' },
    { foreground: '1', owner: { path: 'py.ini', section: 'KEY2', key: 'FORE_STYLE', append: true } },
    { foreground: '', owner: { path: 'cand.cnd', section: 'CAND', key: 'FIRST_FORE' }, copyFrom: '2' },
  ], 'FONT_SIZE', '40')
  assert.equal(styles.get('STYLE2', 'FONT_SIZE'), '40')
  assert.equal(styles.get('STYLE3', 'FONT_SIZE'), '40')
  // A new text layer for the image-only key; the missing FIRST_FORE starts from FORE_STYLE (STYLE2).
  assert.equal(styles.get('STYLE5', 'FONT_SIZE'), '40')
  assert.equal(styles.get('STYLE5', 'NM_COLOR'), undefined)
  assert.equal(styles.get('STYLE6', 'FONT_SIZE'), '40')
  assert.equal(styles.get('STYLE6', 'NM_COLOR'), 'FF000000')
  assert.equal(styles.get('STYLE1', 'FONT_SIZE'), undefined)
  assert.deepEqual(owners, [
    { path: 'py.ini', section: 'KEY2', key: 'FORE_STYLE', value: '1,5' },
    { path: 'cand.cnd', section: 'CAND', key: 'FIRST_FORE', value: '6' },
  ])
  // An empty value removes the property; texts without a style get none.
  assert.deepEqual(writeTextStyleProperty(styles, [{ foreground: '2' }, { foreground: '', owner: { path: 'a', section: 'B', key: 'C' } }], 'FONT_SIZE', ''), [])
  assert.equal(styles.get('STYLE2', 'FONT_SIZE'), undefined)
})
