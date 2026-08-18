use std::fs;
use std::path::{Component, Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
#[cfg(any(target_os = "macos", target_os = "windows"))]
use tauri::window::{Effect, EffectsBuilder};
use tauri::Manager;
use tauri_plugin_fs::FsExt;

struct OpenedFiles(Mutex<Vec<String>>);

const MAX_ARCHIVE_BYTES: u64 = 64 * 1024 * 1024;
const MAX_SOURCE_BYTES: usize = 256 * 1024 * 1024;
const MAX_SOURCE_FILES: usize = 4096;
const SOURCE_MARKER: &str = ".bdi-editor-source";
const SOURCE_MANIFEST: &str = ".bdi-editor-files.json";
const SOURCE_LIMIT: usize = 3;
const RELEASES_URL: &str = "https://github.com/rekazer0/BdiEditor/releases";

#[derive(Clone, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct SourceFile {
    path: String,
    data: Vec<u8>,
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

fn source_root(app: &tauri::AppHandle, path: Option<String>) -> Result<PathBuf, String> {
    let directory = match path.filter(|value| !value.trim().is_empty()) {
        Some(value) => PathBuf::from(value),
        None => app
            .path()
            .app_data_dir()
            .map_err(|error| error.to_string())?
            .join("skin-sources"),
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
    let manifest = directory.join(SOURCE_MANIFEST);
    let previous: Vec<String> = fs::read(&manifest)
        .ok()
        .and_then(|data| serde_json::from_slice(&data).ok())
        .unwrap_or_default();
    for path in previous.iter().filter(|path| !paths.contains(path)) {
        if !safe_source_path(path) {
            continue;
        }
        let target = directory.join(path);
        if target.is_file() {
            fs::remove_file(&target).map_err(|error| error.to_string())?;
            if let Some(parent) = target.parent() {
                remove_empty_parents(parent.to_path_buf(), directory)?;
            }
        }
    }
    for file in files {
        let target = directory.join(&file.path);
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
    fn visit(root: &Path, directory: &Path, output: &mut Vec<SourceFile>, total: &mut usize) -> Result<(), String> {
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
            output.push(SourceFile { path: relative, data });
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
        .map(|value| if value.is_alphanumeric() || value == '-' || value == '_' { value } else { '-' })
        .collect();
    let cleaned = cleaned.trim_matches('-');
    if cleaned.is_empty() { "skin".into() } else { cleaned.chars().take(48).collect() }
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
    let directory = source_root(&app, path)?;
    app.fs_scope()
        .allow_directory(&directory, true)
        .map_err(|error| error.to_string())?;
    Ok(directory.to_string_lossy().into_owned())
}

#[tauri::command]
fn create_source_workspace(
    app: tauri::AppHandle,
    directory: Option<String>,
    name: String,
    files: Vec<SourceFile>,
) -> Result<String, String> {
    let uses_builtin_directory = directory.as_ref().map_or(true, |value| value.trim().is_empty());
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
        fs::write(workspace.join(SOURCE_MARKER), b"BdiEditor source workspace\n")
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
fn open_source_workspace(app: tauri::AppHandle, path: String) -> Result<Vec<SourceFile>, String> {
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
fn apply_source_changes(path: String, changes: Vec<SourceChange>) -> Result<(), String> {
    let directory = fs::canonicalize(path).map_err(|error| error.to_string())?;
    for change in changes {
        if !safe_source_path(&change.path) {
            return Err(format!("皮肤源码包含不安全路径：{}", change.path));
        }
        let target = directory.join(&change.path);
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
fn read_source_changes(path: String, changed_paths: Vec<String>) -> Result<Vec<SourceChange>, String> {
    let directory = fs::canonicalize(path).map_err(|error| error.to_string())?;
    let mut output = Vec::new();
    for changed_path in changed_paths {
        let target = PathBuf::from(&changed_path);
        let relative = target
            .strip_prefix(&directory)
            .map_err(|_| "源码变动路径不属于当前工作区".to_string())?
            .to_string_lossy()
            .replace('\\', "/");
        if relative.is_empty()
            || relative == SOURCE_MARKER
            || relative == SOURCE_MANIFEST
            || relative == ".DS_Store"
            || !safe_source_path(&relative)
        {
            continue;
        }
        if target.is_dir() {
            for file in read_source_files(&target)? {
                let nested = format!("{}/{}", relative.trim_end_matches('/'), file.path);
                output.push(SourceChange { path: nested, data: Some(file.data), directory: false });
            }
            output.insert(0, SourceChange { path: relative, data: None, directory: true });
        } else {
            let missing = !target.exists();
            let data = if target.is_file() {
                Some(fs::read(&target).map_err(|error| error.to_string())?)
            } else {
                None
            };
            output.push(SourceChange { path: relative, data, directory: missing });
        }
    }
    Ok(output)
}

#[tauri::command]
fn path_is_directory(path: String) -> bool {
    Path::new(&path).is_dir()
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
fn write_file(path: String, data: Vec<u8>) -> Result<(), String> {
    fs::write(path, data).map_err(|error| error.to_string())
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
fn set_window_material(window: tauri::WebviewWindow, enabled: bool) -> Result<(), String> {
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
            let mica = window.set_effects(
                EffectsBuilder::new().effect(Effect::Mica).build(),
            );
            if mica.is_ok() {
                return mica.map_err(|error| error.to_string());
            }
            return window
                .set_effects(
                    EffectsBuilder::new()
                        .effect(Effect::Acrylic)
                        .color(tauri::window::Color(32, 34, 38, 210))
                        .build(),
                )
                .map_err(|error| error.to_string());
        }
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let _ = (window, enabled);
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
mod tests {
    use super::{
        apply_source_changes, prune_source_workspaces, read_file, read_source_files,
        safe_source_path, valid_share_filename, write_file, write_source_files, MAX_ARCHIVE_BYTES,
        SOURCE_MARKER,
    };
    use std::fs;
    use std::thread;
    use std::time::Duration;

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
            &[super::SourceFile { path: "skin/a.txt".into(), data: b"a".to_vec() }],
        ).expect("write managed file");
        apply_source_changes(
            root.to_string_lossy().into_owned(),
            vec![super::SourceChange { path: "skin/a.txt".into(), data: None, directory: false }],
        ).expect("delete managed file");
        assert!(root.join("keep.txt").is_file());
        assert!(!root.join("skin/a.txt").exists());
        fs::remove_dir_all(root).expect("cleanup source root");
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
        let root = std::env::temp_dir().join(format!("bdi-edit-empty-source-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).expect("create source root");
        assert!(read_source_files(&root).expect("read empty snapshot").is_empty());
        assert!(safe_source_path("skin/port/layout.ini"));
        assert!(!safe_source_path("../outside"));
        assert!(!safe_source_path("/absolute"));
        fs::remove_dir_all(root).expect("cleanup source root");
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_native_share::init())
        .manage(OpenedFiles(Mutex::new(Vec::new())));
    #[cfg(target_os = "macos")]
    let builder = builder.invoke_handler(tauri::generate_handler![
        read_file,
        write_file,
        share_file,
        take_opened_files,
        quit_app,
        set_window_material,
        fetch_release_page,
        prepare_source_directory,
        create_source_workspace,
        open_source_workspace,
        apply_source_changes,
        read_source_changes,
        path_is_directory
    ]);
    #[cfg(not(target_os = "macos"))]
    let builder = builder.invoke_handler(tauri::generate_handler![
        read_file,
        write_file,
        share_file,
        take_opened_files,
        quit_app,
        set_window_material,
        fetch_release_page,
        prepare_source_directory,
        create_source_workspace,
        open_source_workspace,
        apply_source_changes,
        read_source_changes,
        path_is_directory
    ]);
    builder
        .build(tauri::generate_context!())
        .expect("failed to build BDI editor")
        .run(|app, event| {
            #[cfg(any(target_os = "macos", target_os = "ios", target_os = "android"))]
            if let tauri::RunEvent::Opened { urls } = event {
                use tauri::Emitter;
                let paths: Vec<String> = urls
                    .into_iter()
                    .filter_map(|url| url.to_file_path().ok())
                    .map(|path| path.to_string_lossy().into_owned())
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
