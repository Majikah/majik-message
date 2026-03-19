// src-tauri/src/fcm.rs
use tauri::{AppHandle, Manager};

#[derive(serde::Deserialize)]
pub struct FcmConfig {
    pub api_key: String,
    pub app_id: String,
    pub project_id: String,
    pub vapid_key: Option<String>,
    pub messaging_sender_id: String,
}

#[tauri::command]
pub async fn start_fcm_service(app: AppHandle, config: FcmConfig) -> Result<(), String> {
    // Option A: Use a Rust FCM crate (e.g. `fcm` on crates.io for server-side token mgmt)
    // Option B: Spin up a JS worker in the webview and post the token back via emit
    // Option C: Use tauri-plugin-notification + your own FCM HTTP polling

    // Emit the token once you have it:
    app.emit("fcm-token-updated", "YOUR_RETRIEVED_TOKEN")
        .map_err(|e| e.to_string())?;

    Ok(())
}
