import { test } from 'node:test'
import assert from 'node:assert/strict'
import { strToU8, zipSync } from 'fflate'
import { readArchiveEntry, SkinArchive } from '../src/skin.ts'

const LOCAL_SIGNATURE = 0x04034b50
const CENTRAL_SIGNATURE = 0x02014b50
const END_SIGNATURE = 0x06054b50

function sampleArchive() {
  return zipSync({
    'Info.txt': strToU8('AtomSkinName=test'),
    'light/port/gen.ini': strToU8('[PANEL]\nSIZE=480,320'),
    'light/port/py_9.ini': strToU8('[PANEL]\nSIZE=480,320'),
    'light/port/res/default.css': strToU8('[GLOBAL]\n'),
  }, { level: 0 })
}

function dataView(bytes) {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
}

function endOffset(bytes) {
  const view = dataView(bytes)
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65_557); offset--) {
    if (view.getUint32(offset, true) === END_SIGNATURE) return offset
  }
  throw new Error('missing EOCD')
}

// Some Android packers write 0 into the per-disk entry count and leave the total intact.
function clearPerDiskCount(bytes) {
  const view = dataView(bytes)
  const offset = endOffset(bytes)
  view.setUint16(offset + 4, 1, true)
  view.setUint16(offset + 6, 1, true)
  view.setUint16(offset + 8, 0, true)
}

// Third-party "encrypted" packers keep valid local headers but break the central directory.
function breakCentralMethods(bytes) {
  const view = dataView(bytes)
  for (let offset = 0; offset + 46 <= bytes.length; offset++) {
    if (view.getUint32(offset, true) === CENTRAL_SIGNATURE) view.setUint16(offset + 10, 0xffff, true)
  }
}

test('opens a well formed archive', async () => {
  const archive = await SkinArchive.openAsync(sampleArchive())
  assert.deepEqual(archive.names(), [
    'Info.txt',
    'light/skin/port/gen.ini',
    'light/skin/port/py_9.ini',
    'light/skin/port/res/default.css',
  ])
})

test('opens an archive whose EOCD per-disk entry count is zero', async () => {
  const bytes = sampleArchive()
  clearPerDiskCount(bytes)
  const archive = await SkinArchive.openAsync(bytes)
  assert.equal(archive.names().length, 4)
  assert.equal(archive.getText('light/skin/port/py_9.ini'), '[PANEL]\nSIZE=480,320')
})

test('falls back to local file headers when the central directory is unusable', async () => {
  const bytes = sampleArchive()
  clearPerDiskCount(bytes)
  breakCentralMethods(bytes)
  const archive = await SkinArchive.openAsync(bytes)
  assert.equal(archive.names().length, 4)
  assert.equal(archive.getText('light/skin/port/gen.ini'), '[PANEL]\nSIZE=480,320')
})

test('opens an archive without any entries', async () => {
  const archive = await SkinArchive.openAsync(zipSync({}))
  assert.deepEqual(archive.names(), [])
})

test('reports progress while unpacking the fallback path', async () => {
  const bytes = sampleArchive()
  clearPerDiskCount(bytes)
  breakCentralMethods(bytes)
  const seen = []
  const archive = await SkinArchive.openAsync(bytes, undefined, (value) => seen.push(value))
  assert.equal(archive.names().length, 4)
  assert.equal(seen.at(-1), 1)
})

test('reads one entry straight from its local file header', () => {
  const bytes = zipSync({
    'Info.txt': strToU8('AtomSkinName=test'),
    '__MACOSX/._demo.png': strToU8('junk'),
    'dark/skin/demo.png': strToU8('demo-bytes'),
  }, { level: 6 })
  const entry = readArchiveEntry(bytes, (name) => name === 'dark/skin/demo.png')
  assert.equal(entry?.name, 'dark/skin/demo.png')
  assert.equal(new TextDecoder().decode(entry.data), 'demo-bytes')
})

test('reads a stored entry without touching the bytes around it', () => {
  const bytes = zipSync({ 'demo.png': strToU8('demo-bytes') }, { level: 0 })
  const entry = readArchiveEntry(bytes, (name) => name === 'demo.png')
  assert.equal(new TextDecoder().decode(entry?.data), 'demo-bytes')
})

test('gives up when a local header defers sizes to a data descriptor', () => {
  const bytes = zipSync({ 'demo.png': strToU8('demo-bytes') }, { level: 0 })
  const view = dataView(bytes)
  for (let offset = 0; offset + 30 <= bytes.length; offset++) {
    if (view.getUint32(offset, true) === LOCAL_SIGNATURE) view.setUint16(offset + 6, 0x08, true)
  }
  assert.equal(readArchiveEntry(bytes, (name) => name === 'demo.png'), undefined)
})

test('returns nothing when no entry matches', () => {
  assert.equal(readArchiveEntry(sampleArchive(), (name) => name === 'demo.png'), undefined)
})
