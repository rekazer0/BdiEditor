import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { unzipSync } from 'fflate'
import { SkinArchive } from '../src/skin.ts'
import { skinFileName } from '../src/export.ts'
import { isSsfPath, looksLikeSsf } from '../src/ssf/ssf-package.ts'
import { ssfDocumentBytes } from '../src/ssf/ssf-convert.ts'
import { skinContainer, ssfFixture } from './helpers/ssf-fixture.mjs'
import { declarations, run } from './helpers/app-source.mjs'

for (const android of [true, false]) {
  test(`native skin picker uses ${android ? 'unrestricted Android MIME types' : 'desktop extension filters'}`, async () => {
    const loaded = []
    const context = run(declarations('openNative'), {
      isAndroidTauri: () => android,
      prepareDocumentReplacement: async () => true,
      open: async (options) => {
        assert.equal(options.multiple, false)
        assert.deepEqual(options.filters ? Array.from(options.filters[0].extensions) : undefined,
          android ? undefined : ['bdi', 'bds', 'bda', 'ssf', 'mssf', 'sxi'])
        return android ? 'content://provider/document/42' : '/皮肤.ssf'
      },
      loadNativePath: async (path) => loaded.push(path),
    })
    assert.equal(await context.openNative(), true)
    assert.deepEqual(loaded, [android ? 'content://provider/document/42' : '/皮肤.ssf'])
    context.prepareDocumentReplacement = async () => false
    assert.equal(await context.openNative(), false)
    assert.equal(loaded.length, 1)
  })
}

test('Android content URIs open ZIP SSF, encrypted SSF and Baidu skins by their contents', async () => {
  const zip = ssfFixture()
  for (const [bytes, format] of [
    [zip, 'ssf'],
    [await skinContainer(unzipSync(zip)), 'ssf'],
    [new Uint8Array(readFileSync(new URL('../public/default-template.bds', import.meta.url))), 'bds'],
  ]) {
    const path = 'content://provider/document/42'
    let loaded = false
    const context = run(declarations('loadNativePath', 'openSkinBytes', 'isSupportedSkinPath', 'UNSUPPORTED_SKIN_MESSAGE'), {
      isSsfPath, looksLikeSsf, ssfDocumentBytes,
      readFile: async (uri) => { assert.equal(uri, path); return bytes },
      readNativeSkinFile: () => assert.fail('content URIs must use the filesystem plugin'),
      loadArchive: async (data, uri) => {
        assert.equal(uri, path)
        assert.equal(SkinArchive.open(data).format, format)
        loaded = true
      },
    })
    assert.equal(await context.loadNativePath(path), true)
    assert.equal(loaded, true)
    await assert.rejects(context.loadNativePath('/invalid.txt'), /仅支持/)
  }
})

test('Android content URIs take the skin\'s declared name, not the encoded document id', async () => {
  const sogou = SkinArchive.open(await ssfDocumentBytes(ssfFixture()))
  const baidu = SkinArchive.open(new Uint8Array(readFileSync(new URL('../public/default-template.bds', import.meta.url))))
  baidu.setText('Info.txt', baidu.getText('Info.txt').replace(/^Name=.*$/m, 'Name=森 · 故梦 v1.2'))
  const nameless = SkinArchive.open(new Uint8Array(readFileSync(new URL('../public/default-template.bds', import.meta.url))))
  nameless.setText('Info.txt', 'Style=default\nName=a/b:c\n')
  const context = run(declarations('documentNameForPath'), { skinFileName })
  const uri = 'content://com.android.providers.downloads.documents/document/raw%3A%2Fstorage%2F%E6%A3%AE.sxi'
  assert.equal(context.documentNameForPath(uri, sogou), '测试皮肤.ssf')
  assert.equal(context.documentNameForPath(uri, baidu), '森 · 故梦 v1.2.bds')
  assert.equal(context.documentNameForPath(uri, nameless), 'a_b_c.bds')
  assert.equal(context.documentNameForPath('/skins/原文件名.bds', baidu), '原文件名.bds')
  assert.equal(skinFileName(undefined, 'bdi'), '未命名皮肤.bdi')
})
