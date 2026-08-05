use std::fs;
use std::sync::Mutex;
use tauri::Manager;

struct OpenedFiles(Mutex<Vec<String>>);

const MAX_ARCHIVE_BYTES: u64 = 64 * 1024 * 1024;

fn is_allowed_sf_symbol(name: &str) -> bool {
    matches!(
        name,
        "plus"
            | "folder"
            | "square.and.arrow.down"
            | "arrow.uturn.backward"
            | "arrow.uturn.forward"
            | "ellipsis"
            | "info.circle"
            | "keyboard"
            | "square.grid.2x2"
            | "paintpalette"
            | "doc.text"
            | "photo"
            | "doc"
            | "chevron.left"
            | "square.and.arrow.up"
            | "checkmark"
            | "globe"
            | "mic"
            | "cellularbars"
            | "wifi"
            | "battery.100"
            | "minus"
    )
}

#[cfg(target_os = "macos")]
#[tauri::command]
fn sf_symbol(name: String) -> Result<Vec<u8>, String> {
    use objc2::runtime::AnyObject;
    use objc2_app_kit::{
        NSBitmapImageFileType, NSBitmapImageRep, NSBitmapImageRepPropertyKey, NSImage,
    };
    use objc2_foundation::{NSDictionary, NSString};

    if !is_allowed_sf_symbol(&name) {
        return Err(format!("system symbol is not allowed: {name}"));
    }

    let symbol_name = NSString::from_str(&name);
    let image = NSImage::imageWithSystemSymbolName_accessibilityDescription(&symbol_name, None)
        .ok_or_else(|| format!("system symbol is unavailable: {name}"))?;
    let tiff = image
        .TIFFRepresentation()
        .ok_or_else(|| format!("failed to render system symbol: {name}"))?;
    let bitmap = NSBitmapImageRep::imageRepWithData(&tiff)
        .ok_or_else(|| format!("failed to create bitmap for system symbol: {name}"))?;
    let properties = NSDictionary::<NSBitmapImageRepPropertyKey, AnyObject>::new();
    let png = unsafe {
        bitmap.representationUsingType_properties(NSBitmapImageFileType::PNG, &properties)
    }
    .ok_or_else(|| format!("failed to encode system symbol: {name}"))?;
    Ok(png.to_vec())
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
fn take_opened_files(app: tauri::AppHandle) -> Vec<String> {
    std::mem::take(&mut *app.state::<OpenedFiles>().0.lock().unwrap())
}

#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[cfg(test)]
mod tests {
    use super::{is_allowed_sf_symbol, read_file, write_file, MAX_ARCHIVE_BYTES};
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
    fn system_symbol_allowlist_accepts_editor_chrome_and_rejects_other_names() {
        for name in [
            "plus",
            "folder",
            "square.and.arrow.down",
            "arrow.uturn.backward",
            "arrow.uturn.forward",
            "ellipsis",
            "info.circle",
            "keyboard",
            "square.grid.2x2",
            "paintpalette",
            "doc.text",
            "photo",
            "doc",
            "chevron.left",
            "square.and.arrow.up",
            "checkmark",
            "globe",
            "mic",
            "cellularbars",
            "wifi",
            "battery.100",
            "minus",
        ] {
            assert!(is_allowed_sf_symbol(name), "{name} should be allowed");
        }

        for name in ["", "trash", "../plus", "PLUS"] {
            assert!(!is_allowed_sf_symbol(name), "{name} should be rejected");
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(OpenedFiles(Mutex::new(Vec::new())));
    #[cfg(target_os = "macos")]
    let builder = builder.invoke_handler(tauri::generate_handler![
        read_file,
        write_file,
        take_opened_files,
        quit_app,
        sf_symbol
    ]);
    #[cfg(not(target_os = "macos"))]
    let builder = builder.invoke_handler(tauri::generate_handler![
        read_file,
        write_file,
        take_opened_files,
        quit_app
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
