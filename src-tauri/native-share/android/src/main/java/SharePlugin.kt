package io.github.rekazer0.bdiedit.share

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.database.ContentObserver
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.provider.DocumentsContract
import android.util.Base64
import androidx.annotation.Keep
import androidx.core.content.FileProvider
import androidx.activity.result.ActivityResult
import androidx.documentfile.provider.DocumentFile
import app.tauri.annotation.ActivityCallback
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Channel
import app.tauri.plugin.Invoke
import app.tauri.plugin.Plugin
import java.io.ByteArrayOutputStream
import java.io.File
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit
import java.util.zip.Deflater
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

@InvokeArg
class ShareFileArgs {
  lateinit var path: String
  lateinit var name: String
  lateinit var mimeType: String
}

@InvokeArg
class ObserveSourceArgs {
  lateinit var uri: String
  lateinit var handler: Channel
}

@Keep
class SourceFileArg {
  var path: String = ""
  var data: List<Int> = emptyList()
}

@InvokeArg
class CreateWorkspaceArgs {
  lateinit var uri: String
  lateinit var name: String
  var files: List<SourceFileArg> = emptyList()
}

@InvokeArg
class WorkspaceArgs {
  lateinit var uri: String
}

@Keep
class SourceChangeArg {
  var path: String = ""
  var data: List<Int>? = null
}

@InvokeArg
class ApplyChangesArgs {
  lateinit var uri: String
  var changes: List<SourceChangeArg> = emptyList()
}

@TauriPlugin
class SharePlugin(private val activity: Activity) : Plugin(activity) {
  companion object {
    private const val MAX_ARCHIVE_BYTES = 64 * 1024 * 1024
    private const val MAX_SOURCE_FILES = 4096
    private const val MAX_SOURCE_BYTES = 256L * 1024 * 1024
  }

  private var sourceObserver: ContentObserver? = null
  private var sourcePoll: ScheduledFuture<*>? = null
  private val sourceExecutor = Executors.newSingleThreadExecutor()
  private val sourcePollExecutor = Executors.newSingleThreadScheduledExecutor()

  private fun runSourceIO(invoke: Invoke, fallbackMessage: String, operation: () -> Any?) {
    sourceExecutor.execute {
      try {
        val result = operation()
        activity.runOnUiThread {
          if (result == null) invoke.resolve() else invoke.resolveObject(result)
        }
      } catch (error: Exception) {
        activity.runOnUiThread {
          invoke.reject(error.message ?: fallbackMessage, error)
        }
      }
    }
  }

  @Command
  fun shareFile(invoke: Invoke) {
    try {
      val args = invoke.parseArgs(ShareFileArgs::class.java)
      val file = File(args.path)
      if (!file.isFile) {
        invoke.reject("Shared skin file does not exist")
        return
      }

      val uri = FileProvider.getUriForFile(
        activity,
        "${activity.packageName}.fileprovider",
        file,
      )
      val viewIntent = Intent(Intent.ACTION_VIEW).apply {
        setDataAndType(uri, args.mimeType)
        setPackage("com.baidu.input")
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }
      activity.startActivity(viewIntent)
      invoke.resolve()
    } catch (error: ActivityNotFoundException) {
      invoke.reject("未安装百度输入法或当前版本不支持导入皮肤", error)
    } catch (error: Exception) {
      invoke.reject(error.message ?: "Unable to share skin", error)
    }
  }

  @Command
  fun pickSourceDirectory(invoke: Invoke) {
    val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).apply {
      addFlags(
        Intent.FLAG_GRANT_READ_URI_PERMISSION or
          Intent.FLAG_GRANT_WRITE_URI_PERMISSION or
          Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION or
          Intent.FLAG_GRANT_PREFIX_URI_PERMISSION,
      )
      putExtra(
        DocumentsContract.EXTRA_INITIAL_URI,
        Uri.parse("content://com.android.externalstorage.documents/document/primary%3ABdiEditor"),
      )
    }
    startActivityForResult(invoke, intent, "sourceDirectoryResult")
  }

  @ActivityCallback
  fun sourceDirectoryResult(invoke: Invoke, result: ActivityResult) {
    val uri = result.data?.data
    if (result.resultCode != Activity.RESULT_OK || uri == null) {
      invoke.reject("Directory selection cancelled")
      return
    }
    try {
      val flags = result.data?.flags?.and(
        Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION,
      ) ?: 0
      activity.contentResolver.takePersistableUriPermission(uri, flags)
      val directory = DocumentFile.fromTreeUri(activity, uri)
      if (directory == null || !directory.isDirectory || !directory.canWrite()) {
        invoke.reject("Selected directory is not writable")
        return
      }
      invoke.resolveObject(uri.toString())
    } catch (error: Exception) {
      invoke.reject(error.message ?: "Unable to access selected directory", error)
    }
  }

  @Command
  fun startSourceObserver(invoke: Invoke) {
    try {
      val args = invoke.parseArgs(ObserveSourceArgs::class.java)
      sourceObserver?.let { activity.contentResolver.unregisterContentObserver(it) }
      sourcePoll?.cancel(false)
      sourceObserver = object : ContentObserver(Handler(Looper.getMainLooper())) {
        override fun onChange(selfChange: Boolean, uri: Uri?) {
          args.handler.sendObject(uri?.toString() ?: args.uri)
        }
      }
      val uri = Uri.parse(args.uri)
      activity.contentResolver.registerContentObserver(uri, true, sourceObserver!!)
      var snapshot: Map<String, String>? = null
      sourcePoll = sourcePollExecutor.scheduleWithFixedDelay({
        try {
          val next = sourceSnapshot(uri)
          if (snapshot != null && snapshot != next) {
            activity.runOnUiThread { args.handler.sendObject(args.uri) }
          }
          snapshot = next
        } catch (_: Exception) {
        }
      }, 0, 1200, TimeUnit.MILLISECONDS)
      invoke.resolve()
    } catch (error: Exception) {
      invoke.reject(error.message ?: "Unable to watch source directory", error)
    }
  }

  @Command
  fun stopSourceObserver(invoke: Invoke) {
    sourceObserver?.let { activity.contentResolver.unregisterContentObserver(it) }
    sourceObserver = null
    sourcePoll?.cancel(false)
    sourcePoll = null
    invoke.resolve()
  }

  private fun sourceSnapshot(root: Uri): Map<String, String> {
    val output = mutableMapOf<String, String>()
    fun walk(parent: Uri, prefix: String) {
      val children = DocumentsContract.buildChildDocumentsUriUsingTree(
        parent,
        DocumentsContract.getDocumentId(parent),
      )
      val directories = mutableListOf<Pair<Uri, String>>()
      activity.contentResolver.query(
        children,
        arrayOf(
          DocumentsContract.Document.COLUMN_DOCUMENT_ID,
          DocumentsContract.Document.COLUMN_DISPLAY_NAME,
          DocumentsContract.Document.COLUMN_MIME_TYPE,
          DocumentsContract.Document.COLUMN_LAST_MODIFIED,
          DocumentsContract.Document.COLUMN_SIZE,
        ),
        null,
        null,
        null,
      )?.use { cursor ->
        while (cursor.moveToNext()) {
          val id = cursor.getString(0)
          val name = cursor.getString(1)
          val mime = cursor.getString(2)
          val path = if (prefix.isEmpty()) name else "$prefix/$name"
          output[path] = "$mime:${cursor.getLong(3)}:${cursor.getLong(4)}"
          if (mime == DocumentsContract.Document.MIME_TYPE_DIR) {
            directories += DocumentsContract.buildDocumentUriUsingTree(parent, id) to path
          }
        }
      }
      directories.forEach { (uri, path) -> walk(uri, path) }
    }
    walk(root, "")
    return output
  }

  private fun safeParts(path: String): List<String> {
    val parts = path.split('/').filter { it.isNotEmpty() }
    if (parts.isEmpty() || parts.any { it == "." || it == ".." || it.contains('\\') }) {
      throw IllegalArgumentException("Unsafe source path: $path")
    }
    return parts
  }

  private fun directory(uri: String): DocumentFile =
    DocumentFile.fromTreeUri(activity, Uri.parse(uri))
      ?.takeIf { it.isDirectory }
      ?: throw IllegalArgumentException("Source directory is unavailable")

  private fun ensureDirectory(root: DocumentFile, parts: List<String>): DocumentFile {
    var current = root
    for (part in parts) {
      current = current.findFile(part)?.takeIf { it.isDirectory }
        ?: current.createDirectory(part)
        ?: throw IllegalStateException("Unable to create directory: $part")
    }
    return current
  }

  private fun findFile(root: DocumentFile, path: String): DocumentFile? {
    var current: DocumentFile = root
    for (part in safeParts(path)) current = current.findFile(part) ?: return null
    return current
  }

  private fun writeFile(root: DocumentFile, path: String, data: List<Int>) {
    val parts = safeParts(path)
    val parent = ensureDirectory(root, parts.dropLast(1))
    val name = parts.last()
    val file = parent.findFile(name)?.takeIf { it.isFile }
      ?: parent.createFile("application/octet-stream", name)
      ?: throw IllegalStateException("Unable to create file: $path")
    writeBytes(file, data)
  }

  private fun writeBytes(file: DocumentFile, data: List<Int>) {
    activity.contentResolver.openOutputStream(file.uri, "wt")!!.use { output ->
      output.write(ByteArray(data.size) { data[it].toByte() })
    }
  }

  private fun writeNewFiles(root: DocumentFile, files: List<SourceFileArg>) {
    val directories = mutableMapOf("" to root)
    for (file in files) {
      val parts = safeParts(file.path)
      var parent = root
      var parentPath = ""
      for (part in parts.dropLast(1)) {
        parentPath = if (parentPath.isEmpty()) part else "$parentPath/$part"
        parent = directories[parentPath]
          ?: parent.createDirectory(part)?.also { directories[parentPath] = it }
          ?: throw IllegalStateException("Unable to create directory: $part")
      }
      val target = parent.createFile("application/octet-stream", parts.last())
        ?: throw IllegalStateException("Unable to create file: ${file.path}")
      writeBytes(target, file.data)
    }
  }

  private fun readFiles(root: DocumentFile, path: String, output: MutableList<Map<String, Any>>) {
    for (entry in root.listFiles()) {
      val name = entry.name ?: continue
      val relative = if (path.isEmpty()) name else "$path/$name"
      if (entry.isDirectory) {
        readFiles(entry, relative, output)
      } else if (entry.isFile && name !in setOf(".bdi-editor-source", ".bdi-editor-files.json", ".DS_Store")) {
        val bytes = activity.contentResolver.openInputStream(entry.uri)!!.use { it.readBytes() }
        output.add(mapOf("path" to relative, "data" to bytes.map { it.toInt() and 0xff }))
      }
    }
  }

  private fun sourceArchive(root: DocumentFile): String {
    val prefix = root.name?.lowercase()?.takeIf { it == "dark" || it == "light" }?.let { "$it/" } ?: ""
    val archivePaths = mutableSetOf<String>()
    var fileCount = 0
    var totalBytes = 0L
    val output = ByteArrayOutputStream()
    ZipOutputStream(output).use { zip ->
      zip.setLevel(Deflater.BEST_SPEED)
      fun add(directory: DocumentFile, path: String) {
        for (entry in directory.listFiles()) {
          val name = entry.name ?: continue
          val relative = if (path.isEmpty()) name else "$path/$name"
          if (entry.isDirectory) {
            add(entry, relative)
          } else if (entry.isFile && name !in setOf(".bdi-editor-source", ".bdi-editor-files.json", ".DS_Store")) {
            safeParts(relative)
            fileCount += 1
            if (fileCount > MAX_SOURCE_FILES) throw IllegalArgumentException("Skin source contains too many files")
            val bytes = activity.contentResolver.openInputStream(entry.uri)!!.use { it.readBytes() }
            totalBytes += bytes.size
            if (totalBytes > MAX_SOURCE_BYTES) throw IllegalArgumentException("Skin source exceeds 256 MB")
            val archivePath = if (
              prefix.isNotEmpty()
              && relative != "Info.txt"
              && relative != "demo.png"
              && !relative.startsWith(prefix)
            ) "$prefix$relative" else relative
            if (!archivePaths.add(archivePath)) throw IllegalArgumentException("Skin source contains duplicate paths")
            zip.putNextEntry(ZipEntry(archivePath))
            zip.write(bytes)
            zip.closeEntry()
          }
        }
      }
      add(root, "")
    }
    if (fileCount == 0) throw IllegalArgumentException("Skin source directory is empty")
    if (output.size() > MAX_ARCHIVE_BYTES) throw IllegalArgumentException("Skin source archive exceeds 64 MB")
    return Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP)
  }

  @Command
  fun createSourceWorkspace(invoke: Invoke) {
    runSourceIO(invoke, "Unable to create source workspace") {
      val args = invoke.parseArgs(CreateWorkspaceArgs::class.java)
      val root = directory(args.uri)
      val stem = args.name.substringAfterLast('/').substringBeforeLast('.').replace(Regex("[^A-Za-z0-9_-]"), "-").take(48).ifEmpty { "skin" }
      val workspace = root.createDirectory("${System.currentTimeMillis()}-$stem")
        ?: throw IllegalStateException("Unable to create source workspace")
      writeNewFiles(workspace, args.files)
      workspace.uri.toString()
    }
  }

  @Command
  fun readSourceWorkspace(invoke: Invoke) {
    runSourceIO(invoke, "Unable to read source workspace") {
      val args = invoke.parseArgs(WorkspaceArgs::class.java)
      val output = mutableListOf<Map<String, Any>>()
      readFiles(directory(args.uri), "", output)
      output
    }
  }

  @Command
  fun readSourceWorkspaceArchive(invoke: Invoke) {
    runSourceIO(invoke, "Unable to read source workspace") {
      val args = invoke.parseArgs(WorkspaceArgs::class.java)
      sourceArchive(directory(args.uri))
    }
  }

  @Command
  fun applySourceChanges(invoke: Invoke) {
    runSourceIO(invoke, "Unable to save source changes") {
      val args = invoke.parseArgs(ApplyChangesArgs::class.java)
      val root = directory(args.uri)
      args.changes.forEach { change ->
        if (change.data == null) findFile(root, change.path)?.delete()
        else writeFile(root, change.path, change.data!!)
      }
      null
    }
  }
}
