import { test } from 'node:test'
import assert from 'node:assert/strict'
import { IniDocument } from '../src/ini.ts'
import { resolveStylePropertySources, textStyleSections } from '../src/style-properties.ts'

const css = IniDocument.parse(`[STYLE1]
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
  assert.deepEqual(textStyleSections(css, '1,2'), ['STYLE2'])
  assert.deepEqual(textStyleSections(css, '301, 2, 2'), ['STYLE3', 'STYLE2'])
  assert.deepEqual(textStyleSections(css, '1,99'), [])
})

test('style property sources: an existing value wins, else the first text style takes the new property', () => {
  assert.deepEqual(resolveStylePropertySources(css, ['1,2', '3'], 'FONT_SIZE'), [
    { section: 'STYLE2', value: '30' },
    { section: 'STYLE3', value: '' },
  ])
  assert.deepEqual(resolveStylePropertySources(css, ['3,4'], 'NM_COLOR'), [{ section: 'STYLE4', value: 'FFFFFFFF' }])
  // A foreground that draws only images has nowhere to put text.
  assert.equal(resolveStylePropertySources(css, ['2', '1'], 'FONT_SIZE'), undefined)
})
