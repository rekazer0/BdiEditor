fn main() {
    tauri_plugin::Builder::new(&[
        "pickSourceDirectory",
        "createSourceWorkspace",
        "readSourceWorkspace",
        "applySourceChanges",
        "startSourceObserver",
        "stopSourceObserver",
    ])
        .android_path("android")
        .build();
}
