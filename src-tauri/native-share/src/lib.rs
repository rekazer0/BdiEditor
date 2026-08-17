use tauri::{plugin::TauriPlugin, Runtime};

#[cfg(target_os = "android")]
use tauri::{plugin::PluginHandle, AppHandle, Manager};

#[cfg(target_os = "android")]
struct NativeShare<R: Runtime>(PluginHandle<R>);

#[cfg(target_os = "android")]
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct ShareFilePayload {
    path: String,
    name: String,
    mime_type: String,
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    let builder = tauri::plugin::Builder::new("native-share");
    #[cfg(target_os = "android")]
    let builder = builder.setup(|app, api| {
        let handle = api.register_android_plugin(
            "io.github.rekazer0.bdiedit.share",
            "SharePlugin",
        )?;
        app.manage(NativeShare(handle));
        Ok(())
    });
    builder.build()
}

#[cfg(target_os = "android")]
pub fn share_file<R: Runtime>(
    app: &AppHandle<R>,
    path: String,
    name: String,
    mime_type: String,
) -> Result<(), String> {
    app.state::<NativeShare<R>>()
        .0
        .run_mobile_plugin::<()>(
            "shareFile",
            ShareFilePayload {
                path,
                name,
                mime_type,
            },
        )
        .map_err(|error| error.to_string())
}
