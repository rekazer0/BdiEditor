use std::fs;
use std::sync::Mutex;
use tauri::Manager;

struct OpenedFiles(Mutex<Vec<String>>);

const MAX_ARCHIVE_BYTES: u64 = 64 * 1024 * 1024;

#[tauri::command]
fn read_file(path: String) -> Result<Vec<u8>, String> {
    let size = fs::metadata(&path).map_err(|error| error.to_string())?.len();
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
fn take_opened_files(app: tauri::AppHandle) -> Vec<String> {
    std::mem::take(&mut *app.state::<OpenedFiles>().0.lock().unwrap())
}

#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[cfg(test)]
mod tests {
    use super::{read_file, write_file, MAX_ARCHIVE_BYTES};
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
        assert_eq!(read_file(path_text.clone()).expect("read should succeed"), data);
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
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(OpenedFiles(Mutex::new(Vec::new())))
        .invoke_handler(tauri::generate_handler![
            read_file,
            write_file,
            take_opened_files,
            quit_app
        ])
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
