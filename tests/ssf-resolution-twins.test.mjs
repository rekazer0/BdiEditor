// A Sogou edit reaches every resolution folder, since the phone installs only the nearest one.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { IniDocument } from '../src/ini.ts'
import { mirrorSsfEdit, ssfResolutionTwins } from '../src/ssf/ssf-resolutions.ts'

const NAMES = ['1080/status1/phoneSkin.ini', '1080/status2/phoneSkin.ini', '720/status1/phoneSkin.ini', '480/phoneSkin.ini', '1080/status1/keys.ini']
const copy = (scale, shared = () => false) => ({ scale, sharedImage: shared })
const ini = (text) => IniDocument.parse(text)

test('twins are the same look file in the other resolution folders; a flat folder follows the day look', () => {
  assert.deepEqual(ssfResolutionTwins(NAMES, '1080/status1/phoneSkin.ini', 'status1'), ['720/status1/phoneSkin.ini', '480/phoneSkin.ini'])
  assert.deepEqual(ssfResolutionTwins(NAMES, '1080/status2/phoneSkin.ini', 'status1'), [])
  assert.deepEqual(ssfResolutionTwins(NAMES, '1080/status1/keys.ini', 'status1'), [])
  assert.deepEqual(ssfResolutionTwins(NAMES, 'default/sound_android.ini', 'status1'), [])
})

test('colours carry over, pixel sizes scale and images stay with their resolution', () => {
  const before = '[TextStyle_A]\nTEXT_COLOR=0xFF000000\nTEXT_SIZE=40\n[Key_A]\nMARGINS=6,9,6,9\nNORMAL=a.png\n'
  const after = '[TextStyle_A]\nTEXT_COLOR=0xFFFF0000\nTEXT_SIZE=60\nBOLD=true\n[Key_A]\nMARGINS=12,9,12,9\nNORMAL=b.png\n'
  const twin = '[TextStyle_A]\nTEXT_COLOR=0xFF000000\nTEXT_SIZE=27\n[Key_A]\nMARGINS=4,6,4,6\nNORMAL=a.png\n'
  const result = ini(mirrorSsfEdit(before, after, twin, copy(720 / 1080)))
  assert.equal(result.get('TextStyle_A', 'TEXT_COLOR'), '0xFFFF0000')
  assert.equal(result.get('TextStyle_A', 'TEXT_SIZE'), '40')
  assert.equal(result.get('TextStyle_A', 'BOLD'), 'true')
  assert.equal(result.get('Key_A', 'MARGINS'), '8,6,8,6')
  assert.equal(result.get('Key_A', 'NORMAL'), 'a.png', 'the 720 folder keeps its own image')
  const shared = ini(mirrorSsfEdit(before, after, twin, copy(720 / 1080, (file) => file === 'b.png')))
  assert.equal(shared.get('Key_A', 'NORMAL'), 'b.png', 'an image both folders read from default/ carries over')
  assert.equal(ini(mirrorSsfEdit('[S]\nTEXT_SIZE=0.04\n', '[S]\nTEXT_SIZE=0.05\n', '[S]\nTEXT_SIZE=0.04\n', copy(0.5))).get('S', 'TEXT_SIZE'), '0.05', 'a fraction of the width is the same everywhere')
})

test('removals carry over, and only what the edit changed is touched', () => {
  const result = ini(mirrorSsfEdit('[S]\nBOLD=true\nTEXT_COLOR=0xFF000000\n', '[S]\nTEXT_COLOR=0xFF000000\n', '[S]\nBOLD=true\nTEXT_COLOR=0xFF123456\n', copy(1)))
  assert.equal(result.get('S', 'BOLD'), undefined)
  assert.equal(result.get('S', 'TEXT_COLOR'), '0xFF123456', 'a value the edit left alone keeps the twin’s own setting')
})

test('a section copied for one key starts from the twin’s own copy of its source', () => {
  const before = '[SMA_Key]\nNORMAL=key.png,1,2,3,4\nPRESSED=key_p.png\n[Key_A]\nBG_IMAGES=SMA_Key\n'
  const after = `${before.replace('BG_IMAGES=SMA_Key', 'BG_IMAGES=SMA_Key_A')}[SMA_Key_A]\nNORMAL=key.png,1,2,3,4\nPRESSED=key_p.png\n`
  const twin = '[SMA_Key]\nNORMAL=key.png,1,1,2,2\nPRESSED=key_p.png\n[Key_A]\nBG_IMAGES=SMA_Key\n'
  const result = ini(mirrorSsfEdit(before, after, twin, copy(720 / 1080)))
  assert.equal(result.get('Key_A', 'BG_IMAGES'), 'SMA_Key_A')
  assert.equal(result.get('SMA_Key_A', 'NORMAL'), 'key.png,1,1,2,2', 'the copy keeps the 720 image and stretch band')
  assert.equal(result.get('SMA_Key_A', 'PRESSED'), 'key_p.png')
})
