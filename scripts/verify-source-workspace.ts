import assert from "node:assert/strict"
import fs from "node:fs"
import { SkinArchive } from "../src/skin.ts"
import { consumeSourceWriteSnapshot, resolveSourceArchivePath } from "../src/source-tree.ts"

for (const path of ["public/default-template.bds", "public/default-template.bda"]) {
  const archive = SkinArchive.open(fs.readFileSync(path))
  const reopened = SkinArchive.fromSourceFiles(archive.sourceFiles())
  assert.equal(reopened.format, archive.format, `${path} 源码往返后格式应保持不变`)
  const names = archive.names().filter((name) => !name.endsWith("/"))
  assert.deepEqual(reopened.names().filter((name) => !name.endsWith("/")), names, `${path} 源码往返后文件路径应保持不变`)
  for (const name of names) {
    assert.deepEqual(reopened.getBytes(name), archive.getBytes(name), `${path}: ${name} 内容应保持不变`)
  }
}

const bda = SkinArchive.open(fs.readFileSync("public/default-template.bda"))
const raw = bda.sourceFiles().find((file) => /appearanceConfig$/.test(file.path))?.path
assert.ok(raw, "BDA 应包含 appearanceConfig 源码")
const canonical = bda.canonicalSourcePath(raw)
assert.equal(bda.sourcePath(canonical), raw, "BDA 原始路径与编辑路径应双向映射")

const darkDirectory = SkinArchive.fromSourceFiles([
  { path: "dark/land/py_26.ini", data: new Uint8Array() },
])
assert.equal(darkDirectory.format, "bds", "dark 子目录补全主题前缀后应识别为双主题源码结构")
assert.ok(darkDirectory.names().includes("dark/skin/land/py_26.ini"))

assert.equal(
  resolveSourceArchivePath("info.txt", "", ["Info.txt", "light/skin/py_26.ini"]),
  "Info.txt",
  "外部文件事件的路径大小写应匹配归档中的现有源码路径",
)

const writes = new Map<string, Array<Uint8Array | null>>([
  ["skin/port/layout.ini", [new Uint8Array([1]), new Uint8Array([2])]],
])
assert.equal(
  consumeSourceWriteSnapshot(writes, "skin/port/layout.ini", new Uint8Array([1])),
  true,
  "源码监听应忽略应用自身的落盘回声",
)
assert.equal(
  consumeSourceWriteSnapshot(writes, "skin/port/layout.ini", new Uint8Array([3])),
  false,
  "源码监听不应吞掉真正的外部修改",
)

const html = fs.readFileSync("index.html", "utf8")
const main = fs.readFileSync("src/main.ts", "utf8")
const androidShare = fs.readFileSync("src-tauri/native-share/android/src/main/java/SharePlugin.kt", "utf8")
const nativeShare = fs.readFileSync("src-tauri/native-share/src/lib.rs", "utf8")
const tauri = fs.readFileSync("src-tauri/src/lib.rs", "utf8")
assert.match(html, /<button id="open" class="toolbar-button"[^>]*>/)
assert.doesNotMatch(html, /open-menu|open-source-folder/)
assert.match(html, /id="source-directory"/)
assert.match(html, /id="source-directory-enabled"/, "设置中应提供源码目录同步开关")
assert.match(
  main,
  /if \(!isTauri\(\)\) \{\s+settingsStorageSection\.hidden = true\s+return/,
  "网页版应隐藏源码存储设置",
)
assert.match(
  main,
  /async function applySourceDirectory[\s\S]+?if \(!isTauri\(\)\) return/,
  "网页版不应调用原生源码目录功能",
)
assert.match(
  main,
  /selectFile\(selectedPath, sidebarView, "document", true\)/,
  "外部源码刷新应保留当前检查器选项卡",
)
assert.match(
  main,
  /!isAndroidTauri\(\) \|\| configuredDirectory/,
  "Android 未配置外部源码目录时不应在打开皮肤前复制完整归档",
)
assert.doesNotMatch(main, /sourceDirectoryReady/, "Android 首次启动不应等待或请求目录授权")
assert.match(main, /localStorage\.getItem\("source-directory-enabled"\) === "true"/, "源码目录同步应默认关闭")
assert.match(main, /await message\([\s\S]+await invoke<string>\("pick_source_directory"\)/, "请求目录授权前应先告知用户")
assert.match(
  main,
  /if \(isAndroidTauri\(\) \|\| !pendingSourceDirectory\) throw error/,
  "Android 用户目录失效时不应回退到私有目录",
)
assert.match(androidShare, /DocumentsContract\.EXTRA_INITIAL_URI/, "Android 目录选择器应优先定位默认源码目录")
assert.match(androidShare, /primary%3ABdiEditor/, "Android 默认源码目录应为用户可见的 BdiEditor")
assert.match(androidShare, /@Keep\s+class SourceFileArg/, "Release 构建应保留源码文件参数的反射结构")
assert.match(androidShare, /@Keep\s+class SourceChangeArg/, "Release 构建应保留源码变更参数的反射结构")
assert.match(androidShare, /runSourceIO\(invoke, "Unable to create source workspace"\)/, "Android 源码解压不应阻塞主线程")
assert.match(androidShare, /writeNewFiles\(workspace, args\.files\)/, "Android 源码解压应复用已创建的目录")
assert.match(androidShare, /scheduleWithFixedDelay/, "Android 外部文件直写应有轮询兜底")
assert.match(androidShare, /DocumentsContract\.Document\.COLUMN_LAST_MODIFIED/, "Android 源码轮询应比较文件元数据")
assert.match(androidShare, /ZipOutputStream/, "Android 源码读取应直接构建 ZIP")
assert.match(androidShare, /Base64\.encodeToString/, "Android 源码包应通过单个 Base64 字符串跨桥传输")
assert.match(androidShare, /output\.size\(\) > MAX_ARCHIVE_BYTES/, "Android 源码包应在跨桥前执行压缩大小限制")
assert.match(androidShare, /archivePaths\.add\(archivePath\)/, "Android 源码包应拒绝归一化后的重复路径")
assert.match(androidShare, /readSourceWorkspaceArchive[\s\S]+sourceArchive\(directory\(args\.uri\)\)/, "Android 打开源码应返回原生构建的 ZIP")
assert.match(nativeShare, /read_source_workspace_archive[\s\S]+Result<String, String>/, "原生插件应把紧凑源码包作为字符串转发")
assert.match(tauri, /open_source_workspace_archive[\s\S]+read_source_workspace_archive/, "Android 打开源码应直接转发紧凑源码包")
assert.match(main, /decodeBase64Archive/, "前端应直接解码原生源码包")
assert.match(main, /open_source_workspace_archive/, "Android 前端应调用紧凑源码包命令")
assert.match(main, /sourceWorkspacePendingArchive/, "Android 源码后台复制期间应保留编辑变更")
assert.match(main, /void \(async \(\) => \{[\s\S]+invoke<string>\("create_source_workspace"/, "打开皮肤不应等待源码复制完成")
assert.match(main, /3 \* 60_000/, "源码自动保存应在停止编辑三分钟后执行")
assert.match(main, /consumeSourceWriteSnapshot/, "源码监听应过滤应用自身的写入回声")
assert.match(main, /const LAST_SOURCE_WORKSPACE_KEY = "last-source-workspace"/, "应记录上次编辑的源码工作区")
assert.match(main, /localStorage\.setItem\(LAST_SOURCE_WORKSPACE_KEY, path\)/, "成功打开源码工作区后应保存其 URI")
assert.match(main, /await loadSourceWorkspace\(lastSourceWorkspace\)/, "启动时应恢复上次源码工作区")
assert.match(main, /localStorage\.removeItem\(LAST_SOURCE_WORKSPACE_KEY\)/, "关闭源码功能时应清除恢复入口")
console.log("✓ 源码工作区格式、路径映射与 UI 入口验证通过")
