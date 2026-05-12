use tauri::Manager;
use tauri_plugin_global_shortcut::{
    Builder, Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState,
};

use std::env;
use std::path::PathBuf;

mod menu;
mod tray;

use std::sync::Mutex;
use tauri::menu::MenuItem;

pub struct AuthMenuState {
    pub sign_in: Mutex<Option<MenuItem<tauri::Wry>>>,
    pub sign_out: Mutex<Option<MenuItem<tauri::Wry>>>,
    pub refresh_identities: Mutex<Option<MenuItem<tauri::Wry>>>,
}

#[tauri::command]
fn open_devtools(window: tauri::webview::WebviewWindow) {
    window.open_devtools();
}

#[tauri::command]
fn set_auth_state(state: tauri::State<AuthMenuState>, signed_in: bool) -> Result<(), String> {
    println!("SET AUTH STATE CALLED: {}", signed_in);

    if let Some(sign_in) = state.sign_in.lock().unwrap().as_ref() {
        sign_in.set_enabled(!signed_in).map_err(|e| e.to_string())?;

        println!("UPDATED sign-in");
    } else {
        println!("SIGN-IN HANDLE MISSING");
    }

    if let Some(sign_out) = state.sign_out.lock().unwrap().as_ref() {
        sign_out.set_enabled(signed_in).map_err(|e| e.to_string())?;

        println!("UPDATED sign-out");
    } else {
        println!("SIGN-OUT HANDLE MISSING");
    }

    if let Some(refresh_identities) = state.refresh_identities.lock().unwrap().as_ref() {
        refresh_identities
            .set_enabled(signed_in)
            .map_err(|e| e.to_string())?;

        println!("UPDATED refresh-identities");
    } else {
        println!("REFRESH-IDENTITIES HANDLE MISSING");
    }

    Ok(())
}

#[tauri::command]
fn get_instance_id(instance_id: tauri::State<String>) -> String {
    instance_id.inner().clone()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(
            Builder::new()
                .with_handler(move |app, shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        let id = match shortcut.key {
                            Code::KeyN => "create-account",
                            Code::KeyO => "import-account",
                            Code::KeyT => "add-contact",
                            Code::KeyE => "encrypt-file",
                            Code::KeyD => "decrypt-file",

                            _ => return,
                        };
                        menu::handle_menu_event(app, id);
                    }
                })
                .build(),
        )
        .manage(AuthMenuState {
            sign_in: Mutex::new(None),
            sign_out: Mutex::new(None),
            refresh_identities: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            open_devtools,
            get_instance_id,
            set_auth_state, // 👈 must be here
        ])
        .setup(|app| {
            // 🧠 Get instance ID (default = "default")
            let instance_id = env::var("TAURI_INSTANCE_ID").unwrap_or_else(|_| "default".into());

            // 📂 Build isolated app data path
            let base_dir = app.path().app_data_dir().unwrap();
            let instance_dir: PathBuf = base_dir.join(&instance_id);

            std::fs::create_dir_all(&instance_dir).expect("failed to create instance dir");

            println!("🚀 Running instance: {}", instance_id);
            println!("📂 App data dir: {:?}", instance_dir);

            // (Optional but recommended) expose to frontend
            app.manage(instance_id.clone());

            // App menu
            let menu = menu::build_menu(app.handle(), false)?;
            app.set_menu(menu)?;

            let shortcuts = [
                Shortcut::new(Some(Modifiers::CONTROL), Code::KeyN),
                Shortcut::new(Some(Modifiers::CONTROL), Code::KeyO),
                Shortcut::new(Some(Modifiers::CONTROL), Code::KeyT),
                Shortcut::new(Some(Modifiers::CONTROL), Code::KeyE),
                Shortcut::new(Some(Modifiers::CONTROL), Code::KeyD),
            ];

            let multi = env::var("TAURI_INSTANCE_ID").is_ok();

            if !multi {
                // Register initially (app starts focused)
                app.global_shortcut().register_multiple(shortcuts.clone())?;
            }

            let handle = app.handle().clone();
            app.on_menu_event(move |_app, event| {
                menu::handle_menu_event(&handle, event.id().as_ref());
            });

            // System tray
            tray::build_tray(app.handle())?;

            // Handle focus changes + close to tray
            let win = app.get_webview_window("main").unwrap();
            let win_clone = win.clone();

            win.on_window_event(move |event| match event {
                tauri::WindowEvent::Focused(true) => {
                    let _ = win_clone
                        .app_handle()
                        .global_shortcut()
                        .register_multiple(shortcuts.clone());
                }
                tauri::WindowEvent::Focused(false) => {
                    let _ = win_clone
                        .app_handle()
                        .global_shortcut()
                        .unregister_multiple(shortcuts.clone());
                }
                tauri::WindowEvent::CloseRequested { api, .. } => {
                    api.prevent_close();
                    let _ = win_clone.hide();
                    #[cfg(target_os = "macos")]
                    let _ = win_clone
                        .app_handle()
                        .set_activation_policy(tauri::ActivationPolicy::Accessory);
                }
                _ => {}
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
