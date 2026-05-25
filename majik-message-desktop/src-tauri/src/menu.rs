//menu.rs
use crate::AuthMenuState;

use tauri::{
    menu::{AboutMetadata, Menu, MenuItem, PredefinedMenuItem, Submenu},
    AppHandle, Emitter, Manager, Runtime,
};

pub fn build_menu(
    app: &AppHandle<tauri::Wry>,
    is_signed_in: bool,
) -> tauri::Result<Menu<tauri::Wry>> {
    // ── About ──────────────────────────────────────────────────────────────

    let about = PredefinedMenuItem::about(
        app,
        Some("About"), // label override, or None to use default
        Some(AboutMetadata {
            name: Some("Majik Message".into()),
            version: Some(env!("CARGO_PKG_VERSION").into()),
            copyright: Some(
                "© 2026 Majikah Information Technology Solutions. All rights reserved.".into(),
            ),
            website: Some("https://message.majikah.solutions".into()),
            icon: Some(app.default_window_icon().unwrap().clone()),
            license: Some("Apache 2.0".into()),
            authors: Some(vec!["Zelijah".into()]),
            ..Default::default()
        }),
    )?;

    // ── File ────────────────────────────────────────────────────────────
    let encrypt_file = MenuItem::with_id(app, "encrypt-file", "Encrypt File", true, None::<&str>)?;
    let decrypt_file = MenuItem::with_id(app, "decrypt-file", "Decrypt File", true, None::<&str>)?;

    // Import Chats submenu
    // let import_chats_mjki =
    //     MenuItem::with_id(app, "import-chats-mjki", "from MJKI", true, None::<&str>)?;
    // let import_chats_backup = MenuItem::with_id(
    //     app,
    //     "import-chats-backup",
    //     "from Backup",
    //     true,
    //     None::<&str>,
    // )?;
    // let import_chats_submenu = Submenu::with_items(
    //     app,
    //     "Invoice",
    //     true,
    //     &[&import_chats_mjki, &import_chats_backup],
    // )?;

    // Import Invoice submenu
    let import_contact_card = MenuItem::with_id(
        app,
        "import-contact",
        "from Contact Card",
        true,
        None::<&str>,
    )?;
    let import_contact_backup = MenuItem::with_id(
        app,
        "import-contact-backup",
        "from Backup",
        true,
        None::<&str>,
    )?;
    let import_contact_submenu = Submenu::with_items(
        app,
        "Contact",
        true,
        &[&import_contact_card, &import_contact_backup],
    )?;
    let import_app_data =
        MenuItem::with_id(app, "import-app-data", "App Data", true, None::<&str>)?;

    let import_file_submenu = Submenu::with_items(
        app,
        "Import",
        true,
        &[
            &import_contact_submenu,
            // &import_chats_submenu,
            &import_app_data,
        ],
    )?;

    // Export submenu
    let export_contacts =
        MenuItem::with_id(app, "export-contacts", "Contacts", true, None::<&str>)?;
    // let export_chat_backup =
    //     MenuItem::with_id(app, "export-chat-backup", "Backup", true, None::<&str>)?;
    // let export_chat_csv = MenuItem::with_id(app, "export-chat-csv", "CSV", true, None::<&str>)?;
    // // let export_chat_submenu = Submenu::with_items(
    // //     app,
    // //     "Invoices",
    // //     true,
    // //     &[&export_chat_backup, &export_chat_csv],
    // // )?;
    let export_app_data =
        MenuItem::with_id(app, "export-app-data", "App Data", true, None::<&str>)?;
    let export_submenu = Submenu::with_items(
        app,
        "Export",
        true,
        &[
            &export_contacts,
            //  &export_chat_submenu,
            &export_app_data,
        ],
    )?;

    let file_menu = Submenu::with_items(
        app,
        "File",
        true,
        &[
            &encrypt_file,
            &decrypt_file,
            &PredefinedMenuItem::separator(app)?,
            &import_file_submenu,
            &export_submenu,
        ],
    )?;

    // ── Account ────────────────────────────────────────────────────────────
    let create_account =
        MenuItem::with_id(app, "create-account", "Create Account", true, None::<&str>)?;
    let import_account =
        MenuItem::with_id(app, "import-account", "Import Account", true, None::<&str>)?;
    let add_contact = MenuItem::with_id(app, "add-contact", "Add Contact", true, None::<&str>)?;
    let refresh_identities = MenuItem::with_id(
        app,
        "refresh-identities",
        "Refresh Identities",
        is_signed_in,
        None::<&str>,
    )?;
    let minimize_to_tray = MenuItem::with_id(
        app,
        "minimize-to-tray",
        "Minimize to Tray",
        true,
        None::<&str>,
    )?;
    let sign_in = MenuItem::with_id(app, "sign-in", "Sign In", !is_signed_in, None::<&str>)?;
    let sign_out = MenuItem::with_id(app, "sign-out", "Sign Out", is_signed_in, None::<&str>)?;

    let auth_state = app.state::<AuthMenuState>();
    *auth_state.sign_in.lock().unwrap() = Some(sign_in.clone());
    *auth_state.sign_out.lock().unwrap() = Some(sign_out.clone());
    *auth_state.refresh_identities.lock().unwrap() = Some(refresh_identities.clone());

    let exit = MenuItem::with_id(app, "exit", "Exit", true, None::<&str>)?;

    let account_menu = Submenu::with_items(
        app,
        "Account",
        true,
        &[
            &create_account,
            &import_account,
            &PredefinedMenuItem::separator(app)?,
            &add_contact,
            &PredefinedMenuItem::separator(app)?,
            &minimize_to_tray,
            &PredefinedMenuItem::separator(app)?,
            &refresh_identities,
            &PredefinedMenuItem::separator(app)?,
            &sign_in,
            &sign_out,
            &PredefinedMenuItem::separator(app)?,
            &exit,
        ],
    )?;

    // ── Preferences ────────────────────────────────────────────────────────
    let toggle_dark_mode = MenuItem::with_id(
        app,
        "toggle-dark-mode",
        "Toggle Dark Mode",
        true,
        None::<&str>,
    )?;

    let user_preferences = MenuItem::with_id(
        app,
        "user-preferences",
        "User Preferences",
        true,
        None::<&str>,
    )?;

    let preferences_menu = Submenu::with_items(
        app,
        "Preferences",
        true,
        &[
            &toggle_dark_mode,
            &PredefinedMenuItem::separator(app)?,
            &user_preferences,
        ],
    )?;

    // ── Tools ──────────────────────────────────────────────────────────────
    let export_majik_key = MenuItem::with_id(
        app,
        "export-majik-key",
        "Export Majik Key",
        true,
        None::<&str>,
    )?;
    let validate_thread = MenuItem::with_id(
        app,
        "validate-thread",
        "Validate Thread",
        true,
        None::<&str>,
    )?;
    let launch_web_app =
        MenuItem::with_id(app, "launch-web-app", "Launch Web App", true, None::<&str>)?;

    let system_status =
        MenuItem::with_id(app, "system-status", "System Status", true, None::<&str>)?;

    let tools_menu = Submenu::with_items(
        app,
        "Tools",
        true,
        &[
            &export_majik_key,
            &validate_thread,
            &PredefinedMenuItem::separator(app)?,
            &launch_web_app,
            &PredefinedMenuItem::separator(app)?,
            &system_status,
        ],
    )?;

    // ── Help ───────────────────────────────────────────────────────────────
    let docs = MenuItem::with_id(app, "docs", "Docs", true, None::<&str>)?;
    let start_tutorial = MenuItem::with_id(app, "tutorial", "Start Tutorial", true, None::<&str>)?;
    let product_info = MenuItem::with_id(
        app,
        "product-info",
        "Product Information",
        true,
        None::<&str>,
    )?;
    let developer = MenuItem::with_id(app, "developer", "Developer", true, None::<&str>)?;
    let report_issue =
        MenuItem::with_id(app, "report-issue", "Report an Issue", true, None::<&str>)?;
    let submit_ticket =
        MenuItem::with_id(app, "submit-ticket", "Submit Ticket", true, None::<&str>)?;

    let help_menu = Submenu::with_items(
        app,
        "Help",
        true,
        &[
            &docs,
            &start_tutorial,
            &product_info,
            &developer,
            &PredefinedMenuItem::separator(app)?,
            &report_issue,
            &submit_ticket,
        ],
    )?;

    Menu::with_items(
        app,
        &[
            &file_menu,
            &account_menu,
            &preferences_menu,
            &tools_menu,
            &help_menu,
            &about,
        ],
    )
}

pub fn handle_menu_event<R: Runtime>(app: &AppHandle<R>, event_id: &str) {
    match event_id {
        // ── File ─────────────────────────────────────────────────────────
        "encrypt-file" => {
            let _ = app.emit("trigger-encrypt-file", ());
        }
        "decrypt-file" => {
            let _ = app.emit("trigger-decrypt-file", ());
        }

        // "import-chats-mjki" => {
        //     let _ = app.emit("trigger-import-chats-mjki", ());
        // }
        // "import-chats-backup" => {
        //     let _ = app.emit("trigger-import-chats-backup", ());
        // }
        "import-app-data" => {
            let _ = app.emit("trigger-import-app-data", ());
        }
        "export-contacts" => {
            let _ = app.emit("trigger-export-contacts", ());
        }
        // "export-chats-backup" => {
        //     let _ = app.emit("trigger-export-chats-backup", ());
        // }
        // "export-chats-csv" => {
        //     let _ = app.emit("trigger-export-chats-csv", ());
        // }
        "export-app-data" => {
            let _ = app.emit("trigger-export-app-data", ());
        }

        // ── Account ─────────────────────────────────────────────────────────
        "create-account" => {
            let _ = app.emit("trigger-create-account", ());
        }
        "import-account" => {
            let _ = app.emit("trigger-import-account", ());
        }
        "add-contact" => {
            let _ = app.emit("trigger-import-contact", ());
        }

        "import-contact" => {
            let _ = app.emit("trigger-import-contact", ());
        }

        "import-contact-backup" => {
            let _ = app.emit("trigger-import-contact-backup", ());
        }

        "minimize-to-tray" => {
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.hide();
            }
        }

        "refresh-identities" => {
            let _ = app.emit("trigger-refresh-identities", ());
        }

        "sign-in" => {
            let _ = app.emit("trigger-auth-sign-in", ());
        }
        "sign-out" => {
            let _ = app.emit("trigger-auth-sign-out", ());
        }
        "exit" => {
            app.exit(0);
        }

        // ── Preferences ──────────────────────────────────────────────────────
        "toggle-dark-mode" => {
            let _ = app.emit("trigger-toggle-dark-mode", ());
        }

        "user-preferences" => {
            let _ = app.emit("trigger-user-preferences", ());
        }

        // ── Tools ────────────────────────────────────────────────────────────
        "export-majik-key" => {
            let _ = app.emit("trigger-export-majik-key", ());
        }
        "validate-thread" => {
            open_url(app, "https://message.majikah.solutions/threads/validate");
        }
        "launch-web-app" => {
            open_url(app, "https://message.majikah.solutions/");
        }

        "system-status" => {
            open_url(app, "https://stats.uptimerobot.com/AeguJiJOrR/");
        }

        // ── Help ─────────────────────────────────────────────────────────────
        "docs" => {
            open_url(app, "https://majikah.solutions/products/majik-message/docs");
        }
        "tutorial" => {
            let _ = app.emit("trigger-start-tutorial", ());
        }

        "product-info" => {
            open_url(app, "https://majikah.solutions/products/majik-message");
        }
        "developer" => {
            open_url(app, "https://thezelijah.world/about");
        }
        "report-issue" => {
            open_url(app, "https://github.com/Majikah/majik-message/issues");
        }
        "submit-ticket" => {
            open_url(app, "https://majikah.solutions/support/tickets");
        }

        _ => {}
    }
}

fn open_url<R: Runtime>(app: &AppHandle<R>, url: &str) {
    use tauri_plugin_opener::OpenerExt;
    let _ = app.opener().open_url(url, None::<&str>);
}
