use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use std::fs::{self, OpenOptions};
use std::io::{Read, Write};
use std::path::{Component, Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
#[cfg(any(target_os = "macos", target_os = "windows"))]
use tauri::window::{Effect, EffectsBuilder};
use tauri::Manager;
use tauri_plugin_fs::FsExt;

struct OpenedFiles(Mutex<Vec<String>>);
struct ClientLog(Mutex<()>);

const MAX_ARCHIVE_BYTES: u64 = 64 * 1024 * 1024;
const MAX_SOURCE_BYTES: usize = 256 * 1024 * 1024;
const MAX_SOURCE_FILES: usize = 4096;
const SOURCE_MARKER: &str = ".bdi-editor-source";
const SOURCE_MANIFEST: &str = ".bdi-editor-files.json";
const SOURCE_LIMIT: usize = 3;
const RELEASES_URL: &str = "https://github.com/rekazer0/BdiEditor/releases";
const CLIENT_LOG_FILE: &str = "client.jsonl";
const CLIENT_LOG_PREVIOUS_FILE: &str = "client.previous.jsonl";
const MAX_CLIENT_LOG_BYTES: u64 = 4 * 1024 * 1024;
const MAX_CLIENT_LOG_BATCH_BYTES: usize = 256 * 1024;

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct ClientLogFile {
    name: String,
    data: Vec<u8>,
}

fn append_client_log_path(directory: &Path, lines: &str, max_bytes: u64) -> Result<(), String> {
    if lines.is_empty() {
        return Ok(());
    }
    fs::create_dir_all(directory).map_err(|error| error.to_string())?;
    let current = directory.join(CLIENT_LOG_FILE);
    let previous = directory.join(CLIENT_LOG_PREVIOUS_FILE);
    let incoming = lines.len() as u64 + u64::from(!lines.ends_with('\n'));
    if fs::metadata(&current).map(|value| value.len()).unwrap_or(0) + incoming > max_bytes {
        if previous.exists() {
            fs::remove_file(&previous).map_err(|error| error.to_string())?;
        }
        if current.exists() {
            fs::rename(&current, &previous).map_err(|error| error.to_string())?;
        }
    }
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(current)
        .map_err(|error| error.to_string())?;
    file.write_all(lines.as_bytes())
        .map_err(|error| error.to_string())?;
    if !lines.ends_with('\n') {
        file.write_all(b"\n").map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn read_client_log_path(directory: &Path) -> Result<Vec<ClientLogFile>, String> {
    [CLIENT_LOG_PREVIOUS_FILE, CLIENT_LOG_FILE]
        .into_iter()
        .filter_map(|name| {
            let path = directory.join(name);
            path.is_file().then(|| {
                fs::read(path)
                    .map(|data| ClientLogFile {
                        name: name.into(),
                        data,
                    })
                    .map_err(|error| error.to_string())
            })
        })
        .collect()
}

#[derive(Clone, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct SourceFile {
    path: String,
    data: Vec<u8>,
}

#[derive(serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct EncodedSourceFile {
    path: String,
    data: String,
}

#[derive(serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct SourceChange {
    path: String,
    data: Option<Vec<u8>>,
    directory: bool,
}

fn safe_source_path(path: &str) -> bool {
    !path.is_empty()
        && Path::new(path)
            .components()
            .all(|part| matches!(part, Component::Normal(_)))
}

fn source_target(root: &Path, path: &str) -> Result<PathBuf, String> {
    if !safe_source_path(path) {
        return Err(format!("皮肤源码包含不安全路径：{path}"));
    }
    let mut target = root.to_path_buf();
    for part in Path::new(path).components() {
        let Component::Normal(name) = part else {
            unreachable!()
        };
        target.push(name);
        match fs::symlink_metadata(&target) {
            Ok(metadata) if metadata.file_type().is_symlink() => {
                return Err(format!("皮肤源码路径包含符号链接：{path}"));
            }
            Ok(_) => {}
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => return Err(error.to_string()),
        }
    }
    Ok(target)
}

fn canonical_event_path(path: PathBuf) -> PathBuf {
    fs::canonicalize(&path).unwrap_or_else(|_| {
        let Some(parent) = path.parent() else {
            return path.clone();
        };
        let Some(name) = path.file_name() else {
            return path.clone();
        };
        fs::canonicalize(parent)
            .map(|canonical| canonical.join(name))
            .unwrap_or(path)
    })
}

fn source_root(app: &tauri::AppHandle, path: Option<String>) -> Result<PathBuf, String> {
    let directory = match path.filter(|value| !value.trim().is_empty()) {
        Some(value) => PathBuf::from(value),
        None => {
            #[cfg(target_os = "android")]
            return Err("请先选择用户可访问的源码保存目录".into());
            #[cfg(not(target_os = "android"))]
            app.path()
                .app_data_dir()
                .map_err(|error| error.to_string())?
                .join("skin-sources")
        }
    };
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    if !directory.is_dir() {
        return Err("源码保存路径不是文件夹".into());
    }
    fs::canonicalize(directory).map_err(|error| error.to_string())
}

fn source_paths(files: &[SourceFile]) -> Result<Vec<String>, String> {
    if files.len() > MAX_SOURCE_FILES {
        return Err(format!("皮肤源码文件超过 {MAX_SOURCE_FILES} 个"));
    }
    let mut total = 0usize;
    let mut paths = Vec::with_capacity(files.len());
    for file in files {
        if !safe_source_path(&file.path) {
            return Err(format!("皮肤源码包含不安全路径：{}", file.path));
        }
        total = total
            .checked_add(file.data.len())
            .ok_or_else(|| "皮肤源码过大".to_string())?;
        if total > MAX_SOURCE_BYTES {
            return Err("皮肤源码超过 256 MB".into());
        }
        if paths.contains(&file.path) {
            return Err(format!("皮肤源码包含重复路径：{}", file.path));
        }
        paths.push(file.path.clone());
    }
    Ok(paths)
}

fn decode_source_files(files: Vec<EncodedSourceFile>) -> Result<Vec<SourceFile>, String> {
    let mut output = Vec::with_capacity(files.len());
    for file in files {
        let data = BASE64_STANDARD
            .decode(&file.data)
            .map_err(|_| format!("皮肤源码数据无效：{}", file.path))?;
        output.push(SourceFile {
            path: file.path,
            data,
        });
    }
    source_paths(&output)?;
    Ok(output)
}

fn remove_empty_parents(mut path: PathBuf, root: &Path) -> Result<(), String> {
    while path != root {
        if fs::read_dir(&path)
            .map_err(|error| error.to_string())?
            .next()
            .is_some()
        {
            break;
        }
        fs::remove_dir(&path).map_err(|error| error.to_string())?;
        let Some(parent) = path.parent() else { break };
        path = parent.to_path_buf();
    }
    Ok(())
}

fn write_source_files(directory: &Path, files: &[SourceFile]) -> Result<(), String> {
    let paths = source_paths(files)?;
    fs::create_dir_all(directory).map_err(|error| error.to_string())?;
    let manifest = source_target(directory, SOURCE_MANIFEST)?;
    let previous: Vec<String> = fs::read(&manifest)
        .ok()
        .and_then(|data| serde_json::from_slice(&data).ok())
        .unwrap_or_default();
    for path in previous.iter().filter(|path| !paths.contains(path)) {
        if !safe_source_path(path) {
            continue;
        }
        let target = source_target(directory, path)?;
        if target.is_file() {
            fs::remove_file(&target).map_err(|error| error.to_string())?;
            if let Some(parent) = target.parent() {
                remove_empty_parents(parent.to_path_buf(), directory)?;
            }
        }
    }
    for file in files {
        let target = source_target(directory, &file.path)?;
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        fs::write(target, &file.data).map_err(|error| error.to_string())?;
    }
    fs::write(
        manifest,
        serde_json::to_vec(&paths).map_err(|error| error.to_string())?,
    )
    .map_err(|error| error.to_string())
}

fn read_source_files(directory: &Path) -> Result<Vec<SourceFile>, String> {
    fn visit(
        root: &Path,
        directory: &Path,
        output: &mut Vec<SourceFile>,
        total: &mut usize,
    ) -> Result<(), String> {
        for entry in fs::read_dir(directory).map_err(|error| error.to_string())? {
            let entry = entry.map_err(|error| error.to_string())?;
            let path = entry.path();
            let name = entry.file_name();
            if directory == root
                && (name == SOURCE_MARKER || name == SOURCE_MANIFEST || name == ".DS_Store")
            {
                continue;
            }
            let file_type = entry.file_type().map_err(|error| error.to_string())?;
            if file_type.is_symlink() {
                continue;
            }
            if file_type.is_dir() {
                visit(root, &path, output, total)?;
                continue;
            }
            if !file_type.is_file() {
                continue;
            }
            if output.len() >= MAX_SOURCE_FILES {
                return Err(format!("皮肤源码文件超过 {MAX_SOURCE_FILES} 个"));
            }
            let data = fs::read(&path).map_err(|error| error.to_string())?;
            *total = total
                .checked_add(data.len())
                .ok_or_else(|| "皮肤源码过大".to_string())?;
            if *total > MAX_SOURCE_BYTES {
                return Err("皮肤源码超过 256 MB".into());
            }
            let relative = path
                .strip_prefix(root)
                .map_err(|error| error.to_string())?
                .to_string_lossy()
                .replace('\\', "/");
            output.push(SourceFile {
                path: relative,
                data,
            });
        }
        Ok(())
    }

    if !directory.is_dir() {
        return Err("选择的路径不是文件夹".into());
    }
    let mut files = Vec::new();
    let mut total = 0;
    visit(directory, directory, &mut files, &mut total)?;
    files.sort_by(|left, right| left.path.cmp(&right.path));
    Ok(files)
}

fn workspace_name(name: &str) -> String {
    let stem = Path::new(name)
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("skin");
    let cleaned: String = stem
        .chars()
        .map(|value| {
            if value.is_alphanumeric() || value == '-' || value == '_' {
                value
            } else {
                '-'
            }
        })
        .collect();
    let cleaned = cleaned.trim_matches('-');
    if cleaned.is_empty() {
        "skin".into()
    } else {
        cleaned.chars().take(48).collect()
    }
}

fn prune_source_workspaces(root: &Path) -> Result<(), String> {
    let mut workspaces = fs::read_dir(root)
        .map_err(|error| error.to_string())?
        .filter_map(Result::ok)
        .filter(|entry| entry.path().is_dir() && entry.path().join(SOURCE_MARKER).is_file())
        .collect::<Vec<_>>();
    workspaces.sort_by_key(|entry| {
        entry
            .metadata()
            .and_then(|metadata| metadata.modified())
            .unwrap_or(UNIX_EPOCH)
    });
    let remove_count = workspaces.len().saturating_sub(SOURCE_LIMIT);
    for entry in workspaces.into_iter().take(remove_count) {
        fs::remove_dir_all(entry.path()).map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn prepare_source_directory(app: tauri::AppHandle, path: Option<String>) -> Result<String, String> {
    #[cfg(target_os = "android")]
    if let Some(uri) = path
        .as_deref()
        .filter(|value| value.starts_with("content://"))
    {
        return Ok(uri.to_string());
    }
    let directory = source_root(&app, path)?;
    app.fs_scope()
        .allow_directory(&directory, true)
        .map_err(|error| error.to_string())?;
    Ok(directory.to_string_lossy().into_owned())
}

#[tauri::command]
async fn create_source_workspace(
    app: tauri::AppHandle,
    directory: Option<String>,
    name: String,
    files: Vec<EncodedSourceFile>,
) -> Result<String, String> {
    #[cfg(target_os = "android")]
    if let Some(uri) = directory
        .as_deref()
        .filter(|value| value.starts_with("content://"))
    {
        return tauri_plugin_native_share::create_source_workspace(
            &app,
            uri.to_string(),
            name,
            serde_json::to_value(files).map_err(|error| error.to_string())?,
        )
        .await;
    }
    let files = decode_source_files(files)?;
    let uses_builtin_directory = directory
        .as_ref()
        .is_none_or(|value| value.trim().is_empty());
    let root = source_root(&app, directory)?;
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_millis();
    let base = format!("{timestamp}-{}", workspace_name(&name));
    let mut workspace = root.join(&base);
    let mut suffix = 2;
    while workspace.exists() {
        workspace = root.join(format!("{base}-{suffix}"));
        suffix += 1;
    }
    fs::create_dir(&workspace).map_err(|error| error.to_string())?;
    let result = (|| {
        fs::write(
            workspace.join(SOURCE_MARKER),
            b"BdiEditor source workspace\n",
        )
        .map_err(|error| error.to_string())?;
        write_source_files(&workspace, &files)?;
        if uses_builtin_directory {
            prune_source_workspaces(&root)?;
        }
        app.fs_scope()
            .allow_directory(&workspace, true)
            .map_err(|error| error.to_string())?;
        Ok(workspace.to_string_lossy().into_owned())
    })();
    if result.is_err() {
        let _ = fs::remove_dir_all(&workspace);
    }
    result
}

#[tauri::command]
async fn open_source_workspace(
    app: tauri::AppHandle,
    path: String,
) -> Result<Vec<SourceFile>, String> {
    #[cfg(target_os = "android")]
    if path.starts_with("content://") {
        let value = tauri_plugin_native_share::read_source_workspace(&app, path).await?;
        let files: Vec<SourceFile> =
            serde_json::from_value(value).map_err(|error| error.to_string())?;
        source_paths(&files)?;
        return Ok(files);
    }
    let directory = fs::canonicalize(path).map_err(|error| error.to_string())?;
    let files = read_source_files(&directory)?;
    if files.is_empty() {
        return Err("源码文件夹为空".into());
    }
    source_paths(&files)?;
    app.fs_scope()
        .allow_directory(&directory, true)
        .map_err(|error| error.to_string())?;
    Ok(files)
}

#[tauri::command]
async fn open_source_workspace_archive(
    app: tauri::AppHandle,
    path: String,
) -> Result<String, String> {
    #[cfg(target_os = "android")]
    if path.starts_with("content://") {
        return tauri_plugin_native_share::read_source_workspace_archive(&app, path).await;
    }
    let _ = (app, path);
    Err("Compact source archives are only available for Android content URIs".into())
}

#[tauri::command]
async fn apply_source_changes(
    app: tauri::AppHandle,
    path: String,
    changes: Vec<SourceChange>,
) -> Result<(), String> {
    #[cfg(target_os = "android")]
    if path.starts_with("content://") {
        return tauri_plugin_native_share::apply_source_changes(
            &app,
            path,
            serde_json::to_value(changes).map_err(|error| error.to_string())?,
        )
        .await;
    }
    let _ = app;
    apply_source_changes_path(path, changes)
}

fn apply_source_changes_path(path: String, changes: Vec<SourceChange>) -> Result<(), String> {
    let directory = fs::canonicalize(path).map_err(|error| error.to_string())?;
    for change in changes {
        let target = source_target(&directory, &change.path)?;
        match change.data {
            Some(data) => {
                if data.len() > MAX_SOURCE_BYTES {
                    return Err("单个源码文件超过 256 MB".into());
                }
                if let Some(parent) = target.parent() {
                    fs::create_dir_all(parent).map_err(|error| error.to_string())?;
                }
                fs::write(target, data).map_err(|error| error.to_string())?;
            }
            None => {
                if target.is_file() {
                    fs::remove_file(&target).map_err(|error| error.to_string())?;
                    if let Some(parent) = target.parent() {
                        remove_empty_parents(parent.to_path_buf(), &directory)?;
                    }
                }
            }
        }
    }
    Ok(())
}

#[tauri::command]
async fn read_source_changes(
    app: tauri::AppHandle,
    path: String,
    changed_paths: Vec<String>,
) -> Result<Vec<SourceChange>, String> {
    #[cfg(target_os = "android")]
    if path.starts_with("content://") {
        let value = tauri_plugin_native_share::read_source_workspace(&app, path).await?;
        let files: Vec<SourceFile> =
            serde_json::from_value(value).map_err(|error| error.to_string())?;
        source_paths(&files)?;
        let mut output = vec![SourceChange {
            path: String::new(),
            data: None,
            directory: true,
        }];
        output.extend(files.into_iter().map(|file| SourceChange {
            path: file.path,
            data: Some(file.data),
            directory: false,
        }));
        return Ok(output);
    }
    let _ = app;
    read_source_changes_path(path, changed_paths)
}

fn read_source_changes_path(
    path: String,
    changed_paths: Vec<String>,
) -> Result<Vec<SourceChange>, String> {
    let directory = fs::canonicalize(path).map_err(|error| error.to_string())?;
    let mut output = Vec::new();
    for changed_path in changed_paths {
        let target = canonical_event_path(PathBuf::from(&changed_path));
        let relative = target
            .strip_prefix(&directory)
            .map_err(|_| "源码变动路径不属于当前工作区".to_string())?
            .to_string_lossy()
            .replace('\\', "/");
        if relative == SOURCE_MARKER
            || relative == SOURCE_MANIFEST
            || relative == ".DS_Store"
            || (!relative.is_empty() && !safe_source_path(&relative))
        {
            continue;
        }
        if target.is_dir() {
            for file in read_source_files(&target)? {
                let nested = if relative.is_empty() {
                    file.path
                } else {
                    format!("{}/{}", relative.trim_end_matches('/'), file.path)
                };
                output.push(SourceChange {
                    path: nested,
                    data: Some(file.data),
                    directory: false,
                });
            }
            output.insert(
                0,
                SourceChange {
                    path: relative,
                    data: None,
                    directory: true,
                },
            );
        } else {
            let missing = !target.exists();
            let data = if target.is_file() {
                Some(fs::read(&target).map_err(|error| error.to_string())?)
            } else {
                None
            };
            output.push(SourceChange {
                path: relative,
                data,
                directory: missing,
            });
        }
    }
    Ok(output)
}

#[tauri::command]
fn path_is_directory(path: String) -> bool {
    Path::new(&path).is_dir()
}

#[tauri::command]
fn pick_source_directory(app: tauri::AppHandle) -> Result<String, String> {
    #[cfg(target_os = "android")]
    return tauri_plugin_native_share::pick_source_directory(&app);
    #[cfg(not(target_os = "android"))]
    {
        let _ = app;
        Err("SAF directory selection is only available on Android".into())
    }
}

#[tauri::command]
fn start_source_observer(
    app: tauri::AppHandle,
    path: String,
    handler: tauri::ipc::Channel<String>,
) -> Result<(), String> {
    #[cfg(target_os = "android")]
    return tauri_plugin_native_share::start_source_observer(&app, path, handler);
    #[cfg(not(target_os = "android"))]
    {
        let _ = (app, path, handler);
        Ok(())
    }
}

#[tauri::command]
fn stop_source_observer(app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "android")]
    return tauri_plugin_native_share::stop_source_observer(&app);
    #[cfg(not(target_os = "android"))]
    {
        let _ = app;
        Ok(())
    }
}

fn valid_share_filename(name: &str) -> bool {
    let path = Path::new(name);
    path.file_name().and_then(|value| value.to_str()) == Some(name)
        && matches!(
            path.extension()
                .and_then(|value| value.to_str())
                .map(str::to_ascii_lowercase)
                .as_deref(),
            Some("bdi" | "bds" | "bda")
        )
}

#[tauri::command]
fn read_file(path: String) -> Result<Vec<u8>, String> {
    let size = fs::metadata(&path)
        .map_err(|error| error.to_string())?
        .len();
    if size > MAX_ARCHIVE_BYTES {
        return Err("skin file exceeds 64 MB".into());
    }
    fs::read(path).map_err(|error| error.to_string())
}

#[tauri::command]
fn skin_file_size(path: String) -> Result<u64, String> {
    let size = fs::metadata(path).map_err(|error| error.to_string())?.len();
    if size > MAX_ARCHIVE_BYTES {
        return Err("skin file exceeds 64 MB".into());
    }
    Ok(size)
}

#[tauri::command]
fn read_skin_file(
    path: String,
    progress: tauri::ipc::Channel<[u64; 2]>,
) -> Result<Vec<u8>, String> {
    let size = fs::metadata(&path)
        .map_err(|error| error.to_string())?
        .len();
    if size > MAX_ARCHIVE_BYTES {
        return Err("skin file exceeds 64 MB".into());
    }
    let mut file = fs::File::open(path).map_err(|error| error.to_string())?;
    let mut output = Vec::with_capacity(size as usize);
    let mut chunk = [0; 256 * 1024];
    loop {
        let read = file.read(&mut chunk).map_err(|error| error.to_string())?;
        if read == 0 {
            break;
        }
        output.extend_from_slice(&chunk[..read]);
        progress
            .send([output.len() as u64, size])
            .map_err(|error| error.to_string())?;
    }
    Ok(output)
}

#[tauri::command]
fn write_file(path: String, data: Vec<u8>) -> Result<(), String> {
    fs::write(path, data).map_err(|error| error.to_string())
}

#[tauri::command]
fn append_client_log(
    app: tauri::AppHandle,
    state: tauri::State<'_, ClientLog>,
    lines: String,
) -> Result<(), String> {
    if lines.len() > MAX_CLIENT_LOG_BATCH_BYTES {
        return Err("client log batch exceeds 256 KiB".into());
    }
    let _guard = state.0.lock().map_err(|error| error.to_string())?;
    let directory = app
        .path()
        .app_log_dir()
        .map_err(|error| error.to_string())?;
    append_client_log_path(&directory, &lines, MAX_CLIENT_LOG_BYTES)
}

#[tauri::command]
fn read_client_logs(
    app: tauri::AppHandle,
    state: tauri::State<'_, ClientLog>,
) -> Result<Vec<ClientLogFile>, String> {
    let _guard = state.0.lock().map_err(|error| error.to_string())?;
    let directory = app
        .path()
        .app_log_dir()
        .map_err(|error| error.to_string())?;
    read_client_log_path(&directory)
}

#[tauri::command]
fn share_file(app: tauri::AppHandle, name: String, data: Vec<u8>) -> Result<(), String> {
    if !valid_share_filename(&name) {
        return Err("invalid skin filename".into());
    }
    #[cfg(target_os = "android")]
    {
        let directory = app
            .path()
            .app_cache_dir()
            .map_err(|error| error.to_string())?
            .join("shared-skins");
        fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
        let path = directory.join(&name);
        fs::write(&path, data).map_err(|error| error.to_string())?;
        tauri_plugin_native_share::share_file(
            &app,
            path.to_string_lossy().into_owned(),
            name,
            "application/octet-stream".into(),
        )?;
        return Ok(());
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = (app, data);
        Err("native file sharing is only available on Android".into())
    }
}

#[tauri::command]
fn take_opened_files(app: tauri::AppHandle) -> Vec<String> {
    std::mem::take(&mut *app.state::<OpenedFiles>().0.lock().unwrap())
}

#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[tauri::command]
fn window_material_kind() -> &'static str {
    #[cfg(target_os = "macos")]
    return "glass";
    #[cfg(target_os = "windows")]
    return windows_material_kind(windows_version::OsVersion::current().build);
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    return "none";
}

#[cfg(any(target_os = "windows", test))]
fn windows_material_kind(build: u32) -> &'static str {
    if build >= 22_000 {
        "glass"
    } else {
        "acrylic"
    }
}

#[cfg(any(target_os = "windows", test))]
fn acrylic_alpha(opacity: u8) -> u8 {
    ((u16::from(opacity.min(100)) * 255 + 50) / 100) as u8
}

#[tauri::command]
fn set_window_material(
    window: tauri::WebviewWindow,
    enabled: bool,
    opacity: u8,
) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    let _ = opacity;
    #[cfg(any(target_os = "macos", target_os = "windows"))]
    {
        if !enabled {
            return window.set_effects(None).map_err(|error| error.to_string());
        }
        #[cfg(target_os = "macos")]
        return window
            .set_effects(EffectsBuilder::new().effect(Effect::Sidebar).build())
            .map_err(|error| error.to_string());
        #[cfg(target_os = "windows")]
        {
            let effect = if window_material_kind() == "glass" {
                EffectsBuilder::new().effect(Effect::Mica)
            } else {
                EffectsBuilder::new()
                    .effect(Effect::Acrylic)
                    .color(tauri::window::Color(32, 34, 38, acrylic_alpha(opacity)))
            };
            return window
                .set_effects(effect.build())
                .map_err(|error| error.to_string());
        }
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let _ = (window, enabled, opacity);
        Ok(())
    }
}

#[tauri::command]
async fn fetch_release_page() -> Result<String, String> {
    reqwest::Client::builder()
        .user_agent("BdiEditor update checker")
        .build()
        .map_err(|error| error.to_string())?
        .get(RELEASES_URL)
        .send()
        .await
        .map_err(|error| error.to_string())?
        .error_for_status()
        .map_err(|error| error.to_string())?
        .text()
        .await
        .map_err(|error| error.to_string())
}

#[cfg(test)]
#[allow(clippy::items_after_test_module)]
mod tests {
    use super::{
        acrylic_alpha, append_client_log_path, apply_source_changes_path, prune_source_workspaces,
        read_client_log_path, read_file, read_source_changes_path, read_source_files,
        safe_source_path, valid_share_filename, windows_material_kind, write_file,
        write_source_files, MAX_ARCHIVE_BYTES, SOURCE_MARKER,
    };
    use std::fs;
    use std::thread;
    use std::time::Duration;

    #[test]
    fn window_material_distinguishes_windows_10_acrylic_from_windows_11_glass() {
        assert_eq!(windows_material_kind(21_999), "acrylic");
        assert_eq!(windows_material_kind(22_000), "glass");
        assert_eq!(acrylic_alpha(0), 0);
        assert_eq!(acrylic_alpha(100), 255);
    }

    #[test]
    fn file_commands_report_success_and_missing_file_errors() {
        let path = std::env::temp_dir().join(format!(
            "bdi-edit-file-command-{}-{}.bdi",
            std::process::id(),
            1
        ));
        let path_text = path.to_string_lossy().into_owned();
        let data = vec![1, 2, 3, 4];

        write_file(path_text.clone(), data.clone()).expect("write should succeed");
        assert_eq!(
            read_file(path_text.clone()).expect("read should succeed"),
            data
        );
        fs::remove_file(&path).expect("cleanup should succeed");
        assert!(read_file(path_text).is_err());

        let oversized = std::env::temp_dir().join(format!(
            "bdi-edit-oversized-{}-{}.bdi",
            std::process::id(),
            1
        ));
        fs::File::create(&oversized)
            .expect("create sparse test file")
            .set_len(MAX_ARCHIVE_BYTES + 1)
            .expect("size sparse test file");
        assert!(read_file(oversized.to_string_lossy().into_owned()).is_err());
        fs::remove_file(oversized).expect("cleanup sparse test file");
    }

    #[test]
    fn client_log_rotates_and_keeps_current_and_previous_files() {
        let root = std::env::temp_dir().join(format!("bdi-edit-client-log-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        append_client_log_path(&root, "first", 8).expect("append first log");
        append_client_log_path(&root, "second", 8).expect("rotate log");
        append_client_log_path(&root, "third", 8).expect("rotate log again");
        let logs = read_client_log_path(&root).expect("read logs");
        assert_eq!(logs.len(), 2);
        assert_eq!(String::from_utf8_lossy(&logs[0].data), "second\n");
        assert_eq!(String::from_utf8_lossy(&logs[1].data), "third\n");
        fs::remove_dir_all(root).expect("cleanup logs");
    }

    #[test]
    fn share_filename_accepts_skin_files_without_path_components() {
        assert!(valid_share_filename("我的皮肤.bds"));
        assert!(valid_share_filename("sample.BDA"));
        assert!(!valid_share_filename("../sample.bds"));
        assert!(!valid_share_filename("sample.zip"));
        assert!(!valid_share_filename(""));
    }

    #[test]
    fn source_workspace_sync_only_removes_editor_managed_files() {
        let root = std::env::temp_dir().join(format!("bdi-edit-source-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).expect("create source root");
        fs::write(root.join("keep.txt"), b"external").expect("write external file");
        write_source_files(
            &root,
            &[super::SourceFile {
                path: "skin/a.txt".into(),
                data: b"a".to_vec(),
            }],
        )
        .expect("write managed file");
        apply_source_changes_path(
            root.to_string_lossy().into_owned(),
            vec![super::SourceChange {
                path: "skin/a.txt".into(),
                data: None,
                directory: false,
            }],
        )
        .expect("delete managed file");
        assert!(root.join("keep.txt").is_file());
        assert!(!root.join("skin/a.txt").exists());
        fs::remove_dir_all(root).expect("cleanup source root");
    }

    #[cfg(unix)]
    #[test]
    fn source_workspace_sync_rejects_symlinked_parent_paths() {
        use std::os::unix::fs::symlink;

        let root =
            std::env::temp_dir().join(format!("bdi-edit-source-link-{}", std::process::id()));
        let outside =
            std::env::temp_dir().join(format!("bdi-edit-source-outside-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        let _ = fs::remove_dir_all(&outside);
        fs::create_dir_all(&root).expect("create source root");
        fs::create_dir_all(&outside).expect("create outside root");
        symlink(&outside, root.join("skin")).expect("create source symlink");

        let result = apply_source_changes_path(
            root.to_string_lossy().into_owned(),
            vec![super::SourceChange {
                path: "skin/a.txt".into(),
                data: Some(b"escaped".to_vec()),
                directory: false,
            }],
        );
        assert!(result.is_err());
        assert!(!outside.join("a.txt").exists());

        fs::remove_dir_all(root).expect("cleanup source root");
        fs::remove_dir_all(outside).expect("cleanup outside root");
    }

    #[test]
    fn built_in_source_pruning_keeps_three_marked_workspaces() {
        let root = std::env::temp_dir().join(format!("bdi-edit-prune-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).expect("create source root");
        for index in 0..4 {
            let directory = root.join(format!("workspace-{index}"));
            fs::create_dir_all(&directory).expect("create workspace");
            fs::write(directory.join(SOURCE_MARKER), b"managed").expect("mark workspace");
            thread::sleep(Duration::from_millis(5));
        }
        let unmanaged = root.join("user-folder");
        fs::create_dir_all(&unmanaged).expect("create unmanaged folder");
        prune_source_workspaces(&root).expect("prune workspaces");
        let marked = fs::read_dir(&root)
            .expect("read source root")
            .filter_map(Result::ok)
            .filter(|entry| entry.path().join(SOURCE_MARKER).is_file())
            .count();
        assert_eq!(marked, 3);
        assert!(unmanaged.is_dir());
        fs::remove_dir_all(root).expect("cleanup source root");
    }

    #[test]
    fn source_reader_accepts_empty_change_snapshots_and_limits_paths() {
        let root =
            std::env::temp_dir().join(format!("bdi-edit-empty-source-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).expect("create source root");
        assert!(read_source_files(&root)
            .expect("read empty snapshot")
            .is_empty());
        assert!(safe_source_path("skin/port/layout.ini"));
        assert!(!safe_source_path("../outside"));
        assert!(!safe_source_path("/absolute"));
        fs::remove_dir_all(root).expect("cleanup source root");
    }

    #[test]
    fn source_reader_expands_workspace_root_events() {
        let root = std::env::temp_dir().join(format!("bdi-edit-root-event-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).expect("create source root");
        fs::write(root.join("Info.txt"), b"Name=changed").expect("write info");
        let changes = read_source_changes_path(
            root.to_string_lossy().into_owned(),
            vec![root.to_string_lossy().into_owned()],
        )
        .expect("read root event");
        assert!(changes
            .iter()
            .any(|change| change.path == "Info.txt" && change.data.is_some()));
        assert!(changes
            .iter()
            .any(|change| change.path.is_empty() && change.directory));
        let deleted = read_source_changes_path(
            root.to_string_lossy().into_owned(),
            vec![root.join("removed.tmp").to_string_lossy().into_owned()],
        )
        .expect("read missing file event");
        assert!(deleted
            .iter()
            .any(|change| change.path == "removed.tmp" && change.data.is_none()));
        fs::remove_dir_all(root).expect("cleanup source root");
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_native_share::init())
        .manage(ClientLog(Mutex::new(())))
        .manage(OpenedFiles(Mutex::new(Vec::new())));
    #[cfg(target_os = "macos")]
    let builder = builder.invoke_handler(tauri::generate_handler![
        read_file,
        skin_file_size,
        read_skin_file,
        write_file,
        append_client_log,
        read_client_logs,
        share_file,
        take_opened_files,
        quit_app,
        window_material_kind,
        set_window_material,
        fetch_release_page,
        prepare_source_directory,
        create_source_workspace,
        open_source_workspace,
        open_source_workspace_archive,
        apply_source_changes,
        read_source_changes,
        path_is_directory,
        pick_source_directory,
        start_source_observer,
        stop_source_observer
    ]);
    #[cfg(not(target_os = "macos"))]
    let builder = builder.invoke_handler(tauri::generate_handler![
        read_file,
        skin_file_size,
        read_skin_file,
        write_file,
        append_client_log,
        read_client_logs,
        share_file,
        take_opened_files,
        quit_app,
        window_material_kind,
        set_window_material,
        fetch_release_page,
        prepare_source_directory,
        create_source_workspace,
        open_source_workspace,
        open_source_workspace_archive,
        apply_source_changes,
        read_source_changes,
        path_is_directory,
        pick_source_directory,
        start_source_observer,
        stop_source_observer
    ]);
    builder
        .build(tauri::generate_context!())
        .expect("failed to build BDI editor")
        .run(|app, event| {
            #[cfg(not(any(target_os = "macos", target_os = "ios", target_os = "android")))]
            let _ = (&app, &event);
            #[cfg(any(target_os = "macos", target_os = "ios", target_os = "android"))]
            if let tauri::RunEvent::Opened { urls } = event {
                use tauri::Emitter;
                let paths: Vec<String> = urls
                    .into_iter()
                    .filter_map(|url| {
                        #[cfg(target_os = "android")]
                        if url.scheme() == "content" {
                            return Some(url.to_string());
                        }
                        url.to_file_path()
                            .ok()
                            .map(|path| path.to_string_lossy().into_owned())
                    })
                    .collect();
                app.state::<OpenedFiles>()
                    .0
                    .lock()
                    .unwrap()
                    .extend(paths.clone());
                let _ = app.emit("opened", paths);
            }
        });
}
