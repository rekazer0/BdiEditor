import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { IniDocument } from '../src/ini.ts'
import { SkinArchive } from '../src/skin.ts'
import { stateTipSection } from '../src/panel-tools.ts'
import { bdaLayoutDocument } from '../src/bda.ts'
import { decodeBdaAppearance } from '../src/bda-decode.ts'

const template = (name) => SkinArchive.open(new Uint8Array(readFileSync(new URL(`../public/${name}`, import.meta.url))))

test('the space key shows its S36 variant (Baidu default: long-press voice on) unless a voice state is chosen', () => {
  const statStyle = 'S34_7|S36_8|S37_9'
  assert.equal(stateTipSection(statStyle, undefined), 8)
  assert.equal(stateTipSection(statStyle, 27), 8)
  assert.equal(stateTipSection(statStyle, 34), 7)
  assert.equal(stateTipSection('S34_7|S37_9', 34), 7)
  assert.equal(stateTipSection('S34_7|S37_9', undefined), undefined)
})

test('the first written state that holds picks the TIP, and a TIP does not switch again (KeyParam.J)', () => {
  const layout = IniDocument.parse(template('templates/xiaomi-unified-rounded-blur.bds').getText('light/skin/port/py_9.ini'))
  const enter = layout.get('KEY12', 'STAT_STYLE')
  // 默认只有设备状态成立：S99 → TIP18（贴屏幕圆角的回车切图）。
  assert.equal(stateTipSection(enter, undefined), 18)
  // S27 写在 S99 之前，先命中 TIP3；TIP3 自己的 STAT_STYLE=S99_21 不再生效。
  assert.equal(stateTipSection(enter, 27), 3)
  assert.equal(stateTipSection(layout.get('KEY10', 'STAT_STYLE'), undefined), 8)
  assert.equal(stateTipSection('S36_8|S4_9', 4), 8)
})

test('BDA state keys place foregrounds relative to the key they belong to', () => {
  const archive = template('default-template.bda')
  const base = IniDocument.parse(template('bda-base.bds').getText('light/skin/port/py_9.ini'))
  const appearance = decodeBdaAppearance(archive.getBytes('light/skin/port/appearanceConfig'))
  const layout = bdaLayoutDocument(base, appearance, 'py_9.ini')
  const space = layout.sections().find((section) => /^KEY\d+$/.test(section) && layout.get(section, 'CENTER') === 'F38')
  const tip = stateTipSection(layout.get(space, 'STAT_STYLE'), undefined)
  // The "0" label of KEY_F38_S36 sits above the microphone, not on top of it.
  const offsets = layout.get(`TIP${tip}`, 'FORE_OFFSET').split(';').map((pair) => pair.split(',').map(Number))
  assert.ok(offsets.some(([, y]) => y < -20), layout.get(`TIP${tip}`, 'FORE_OFFSET'))
})
