import { test } from 'node:test'
import assert from 'node:assert/strict'
import { IniDocument } from '../src/ini.ts'
import { previewItems, previewSurfaceHeight } from '../src/preview.ts'

test('keys below PANEL.SIZE extend the preview surface (Xiaomi bottom bar)', () => {
  const document = IniDocument.parse([
    '[KEY1]', 'VIEW_RECT=187,1,230,135', 'CENTER=a',
    '[KEY50]', 'FORE_STYLE=695', 'VIEW_RECT=101,580,120,120', 'CENTER=F16',
    '[KEY51]', 'FORE_STYLE=696', 'VIEW_RECT=857,579,120,120', 'CENTER=F76',
  ].join('\n'))
  const items = previewItems(document, 1080, 585)
  assert.ok(items.some((item) => item.section === 'KEY50'))
  assert.equal(previewSurfaceHeight(items, 585), 700)
})

test('a layout inside the panel keeps the panel height', () => {
  const document = IniDocument.parse('[KEY1]\nVIEW_RECT=0,0,100,100\nCENTER=a\n')
  assert.equal(previewSurfaceHeight(previewItems(document, 1080, 585), 585), 585)
})
