import { test } from 'node:test'
import assert from 'node:assert/strict'
import { IniDocument } from '../src/ini.ts'
import { previewItems, previewSurfaceHeight } from "../src/preview-items.ts"

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

test('iOS FIX_SIZE uses points while its touch rectangle uses skin pixels', () => {
  const document = IniDocument.parse('[CAND]\n[ICON1]\nFORE_STYLE=151\nSIZE=130,130\nFIX_SIZE=33,33\nANCHOR_TYPE=1\nPOS=30,0\nKEY=F31\n')
  const icon = previewItems(document, 1125, 115).find(({ section }) => section === 'ICON1')
  assert.deepEqual(icon.rect, { x: 30, y: 0, width: 130, height: 130 })
  assert.deepEqual(icon.foreRect, { x: 45.5, y: 15.5, width: 99, height: 99 })
})
