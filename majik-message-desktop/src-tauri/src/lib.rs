use tauri::Manager;
use tauri_plugin_global_shortcut::{
    Builder, Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState,
};

mod menu;
mod tray;

#[tauri::command]
fn set_auth_state(app: tauri::AppHandle, signed_in: bool) -> Result<(), String> {
    let menu = app.menu().ok_or("No menu")?;

    // Just toggle the enabled state on the two items that care about auth
    if let Some(item) = menu.get("sign-in") {
        item.as_menuitem()
            .ok_or("sign-in not a MenuItem")?
            .set_enabled(!signed_in)
            .map_err(|e| e.to_string())?;
    }
    if let Some(item) = menu.get("sign-out") {
        item.as_menuitem()
            .ok_or("sign-out not a MenuItem")?
            .set_enabled(signed_in)
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
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
        .invoke_handler(tauri::generate_handler![set_auth_state])
        .setup(|app| {
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

            // Register initially (app starts focused)
            app.global_shortcut().register_multiple(shortcuts.clone())?;

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
