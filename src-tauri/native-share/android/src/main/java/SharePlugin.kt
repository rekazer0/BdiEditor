package io.github.rekazer0.bdiedit.share

import android.app.Activity
import android.content.ClipData
import android.content.Intent
import android.database.ContentObserver
import android.net.Uri
import android.os.Handler
import android.os.Looper
import androidx.core.content.FileProvider
import androidx.activity.result.ActivityResult
import androidx.documentfile.provider.DocumentFile
import app.tauri.annotation.ActivityCallback
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Channel
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSArray
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import java.io.File

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
  private var sourceObserver: ContentObserver? = null

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
      val sendIntent = Intent(Intent.ACTION_SEND).apply {
        type = args.mimeType
        putExtra(Intent.EXTRA_STREAM, uri)
        putExtra(Intent.EXTRA_TITLE, args.name)
        clipData = ClipData.newRawUri(args.name, uri)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }
      val chooser = Intent.createChooser(sendIntent, args.name).apply {
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }
      activity.startActivity(chooser)
      invoke.resolve()
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
      invoke.resolve(uri.toString())
    } catch (error: Exception) {
      invoke.reject(error.message ?: "Unable to access selected directory", error)
    }
  }

  @Command
  fun startSourceObserver(invoke: Invoke) {
    try {
      val args = invoke.parseArgs(ObserveSourceArgs::class.java)
      sourceObserver?.let { activity.contentResolver.unregisterContentObserver(it) }
      sourceObserver = object : ContentObserver(Handler(Looper.getMainLooper())) {
        override fun onChange(selfChange: Boolean, uri: Uri?) {
          args.handler.sendObject(uri?.toString() ?: args.uri)
        }
      }
      activity.contentResolver.registerContentObserver(Uri.parse(args.uri), true, sourceObserver!!)
      invoke.resolve()
    } catch (error: Exception) {
      invoke.reject(error.message ?: "Unable to watch source directory", error)
    }
  }

  @Command
  fun stopSourceObserver(invoke: Invoke) {
    sourceObserver?.let { activity.contentResolver.unregisterContentObserver(it) }
    sourceObserver = null
    invoke.resolve()
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
    activity.contentResolver.openOutputStream(file.uri, "wt")!!.use { output ->
      output.write(ByteArray(data.size) { data[it].toByte() })
    }
  }

  private fun readFiles(root: DocumentFile, path: String, output: JSArray) {
    for (entry in root.listFiles()) {
      val name = entry.name ?: continue
      val relative = if (path.isEmpty()) name else "$path/$name"
      if (entry.isDirectory) {
        readFiles(entry, relative, output)
      } else if (entry.isFile && name !in setOf(".bdi-editor-source", ".bdi-editor-files.json", ".DS_Store")) {
        val bytes = activity.contentResolver.openInputStream(entry.uri)!!.use { it.readBytes() }
        val data = JSArray()
        bytes.forEach { data.put(it.toInt() and 0xff) }
        output.put(JSObject().put("path", relative).put("data", data))
      }
    }
  }

  @Command
  fun createSourceWorkspace(invoke: Invoke) {
    try {
      val args = invoke.parseArgs(CreateWorkspaceArgs::class.java)
      val root = directory(args.uri)
      val stem = args.name.substringAfterLast('/').substringBeforeLast('.').replace(Regex("[^A-Za-z0-9_-]"), "-").take(48).ifEmpty { "skin" }
      val workspace = root.createDirectory("${System.currentTimeMillis()}-$stem")
        ?: throw IllegalStateException("Unable to create source workspace")
      args.files.forEach { writeFile(workspace, it.path, it.data) }
      invoke.resolve(workspace.uri.toString())
    } catch (error: Exception) {
      invoke.reject(error.message ?: "Unable to create source workspace", error)
    }
  }

  @Command
  fun readSourceWorkspace(invoke: Invoke) {
    try {
      val args = invoke.parseArgs(WorkspaceArgs::class.java)
      val output = JSArray()
      readFiles(directory(args.uri), "", output)
      invoke.resolve(output)
    } catch (error: Exception) {
      invoke.reject(error.message ?: "Unable to read source workspace", error)
    }
  }

  @Command
  fun applySourceChanges(invoke: Invoke) {
    try {
      val args = invoke.parseArgs(ApplyChangesArgs::class.java)
      val root = directory(args.uri)
      args.changes.forEach { change ->
        if (change.data == null) findFile(root, change.path)?.delete()
        else writeFile(root, change.path, change.data!!)
      }
      invoke.resolve()
    } catch (error: Exception) {
      invoke.reject(error.message ?: "Unable to save source changes", error)
    }
  }
}
