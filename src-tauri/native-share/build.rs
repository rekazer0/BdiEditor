fn main() {
    tauri_plugin::Builder::new(&[
        "pickSourceDirectory",
        "chooseProjectTemplate",
        "createSourceWorkspace",
        "readSourceWorkspace",
        "applySourceChanges",
        "startSourceObserver",
        "stopSourceObserver",
    ])
    .android_path("android")
    .build();
}
