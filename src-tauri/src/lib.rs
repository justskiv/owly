mod commands;

use std::path::PathBuf;

use commands::files::{
    delete_file, ensure_dir, file_exists, list_files, move_file, read_file, write_file,
};
use commands::system::get_data_dir;
use commands::AppRoot;
use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::utils::config::Color;
use tauri::{Emitter, Manager, WindowEvent};
use tauri_plugin_window_state::StateFlags;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(
                    StateFlags::all() - StateFlags::VISIBLE - StateFlags::SIZE,
                )
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            // Resolve the app root once at startup so file commands can
            // validate every path against it. Dev keeps data in the
            // project tree (CARGO_MANIFEST_DIR resolves at compile time
            // and is the canonical way to find the project root —
            // exe-walking breaks under workspaces and custom targets).
            // Release uses the platform app data dir so writes survive
            // app updates and aren't blocked by Gatekeeper on a
            // read-only `.app` bundle.
            let root: PathBuf = if cfg!(debug_assertions) {
                PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                    .parent()
                    .ok_or("cannot resolve project root")?
                    .to_path_buf()
            } else {
                app.path().app_data_dir()?
            };
            std::fs::create_dir_all(&root)?;
            app.manage(AppRoot(root));

            if let Some(window) = app.get_webview_window("main") {
                let _ = window
                    .set_background_color(Some(Color(0x1a, 0x1a, 0x1a, 0xff)));
                let _ = window.set_theme(Some(tauri::Theme::Dark));

                // Close button hides the window instead of quitting.
                // Cmd+Q goes through PredefinedMenuItem::quit which calls
                // app.exit() and bypasses CloseRequested entirely.
                let win_clone = window.clone();
                window.on_window_event(move |event| {
                    if let WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = win_clone.hide();
                    }
                });
            }

            let menu = build_menu(app.handle())?;
            app.set_menu(menu)?;

            Ok(())
        })
        .on_menu_event(|app, event| {
            let id = event.id().0.clone();
            let _ = app.emit("menu", id);
        })
        .invoke_handler(tauri::generate_handler![
            read_file,
            write_file,
            list_files,
            ensure_dir,
            move_file,
            delete_file,
            file_exists,
            get_data_dir,
        ])
        .build(tauri::generate_context!())
        .expect("error while running tauri application");

    app.run(|app_handle, event| {
        // macOS: clicking the dock icon while the window is hidden
        // re-shows it. Without this, the close-to-hide behavior would
        // strand the window.
        if let tauri::RunEvent::Reopen { has_visible_windows, .. } = event {
            if !has_visible_windows {
                if let Some(w) = app_handle.get_webview_window("main") {
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            }
        }
    });
}

fn build_menu(
    app: &tauri::AppHandle,
) -> tauri::Result<tauri::menu::Menu<tauri::Wry>> {
    let app_sub = SubmenuBuilder::new(app, "TuzovOS")
        .services()
        .separator()
        .hide()
        .hide_others()
        .show_all()
        .separator()
        .quit()
        .build()?;

    let new_block = MenuItemBuilder::with_id("new-block", "Новый блок")
        .accelerator("Cmd+N")
        .build(app)?;
    let file_sub = SubmenuBuilder::new(app, "File")
        .item(&new_block)
        .separator()
        .close_window()
        .build()?;

    let edit_sub = SubmenuBuilder::new(app, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;

    let prev_week = MenuItemBuilder::with_id("prev-week", "Предыдущая неделя")
        .accelerator("Cmd+[")
        .build(app)?;
    let next_week = MenuItemBuilder::with_id("next-week", "Следующая неделя")
        .accelerator("Cmd+]")
        .build(app)?;
    let today = MenuItemBuilder::with_id("today", "Сегодня")
        .accelerator("Cmd+T")
        .build(app)?;
    let view_sub = SubmenuBuilder::new(app, "View")
        .item(&prev_week)
        .item(&next_week)
        .item(&today)
        .separator()
        .fullscreen()
        .build()?;

    let window_sub = SubmenuBuilder::new(app, "Window")
        .minimize()
        .maximize()
        .build()?;

    MenuBuilder::new(app)
        .items(&[&app_sub, &file_sub, &edit_sub, &view_sub, &window_sub])
        .build()
}
