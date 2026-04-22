mod commands;

use std::path::PathBuf;

use commands::files::{
    delete_file, ensure_dir, file_exists, list_files, move_file, read_file, write_file,
};
use commands::system::get_data_dir;
use commands::AppRoot;
use tauri::Manager;
use tauri::utils::config::Color;
use tauri_plugin_window_state::StateFlags;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
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
                let _ = window.set_background_color(Some(Color(0x1a, 0x1a, 0x1a, 0xff)));
            }
            Ok(())
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
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
