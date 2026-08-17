use std::fs;
use std::path::Path;
use std::sync::Mutex;
#[cfg(any(target_os = "macos", target_os = "windows"))]
use tauri::window::{Effect, EffectsBuilder};
use tauri::Manager;

struct OpenedFiles(Mutex<Vec<String>>);

const MAX_ARCHIVE_BYTES: u64 = 64 * 1024 * 1024;
const RELEASES_URL: &str = "https://github.com/rekazer0/BdiEditor/releases";

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
        return window
            .set_effects(
                EffectsBuilder::new()
                    .effect(Effect::Acrylic)
                    .color(tauri::window::Color(32, 34, 38, 210))
                    .build(),
            )
            .map_err(|error| error.to_string());
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
    use super::{read_file, valid_share_filename, write_file, MAX_ARCHIVE_BYTES};
    use std::fs;

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
        fetch_release_page
    ]);
    #[cfg(not(target_os = "macos"))]
    let builder = builder.invoke_handler(tauri::generate_handler![
        read_file,
        write_file,
        share_file,
        take_opened_files,
        quit_app,
        set_window_material,
        fetch_release_page
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
