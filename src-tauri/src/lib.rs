mod commands;
mod watcher;

use std::path::PathBuf;
use std::sync::Mutex;

use commands::files::{
    delete_file, ensure_dir, file_exists, list_files, move_file, read_file, write_file,
};
use commands::system::get_data_dir;
use commands::{DataRoot, WatcherState};
use tauri::menu::{AboutMetadata, MenuBuilder, MenuItemBuilder, SubmenuBuilder};
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
            // Self-update via tauri-plugin-updater — desktop only.
            // Pulled in once here so the frontend can call check() →
            // downloadAndInstall() against the GitHub Releases endpoint
            // configured in tauri.conf.json.
            #[cfg(desktop)]
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;

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

            // Make sure the directories the watcher subscribes to
            // exist before notify::watch (it errors on missing paths).
            // commands/ lives inside data/ so the whole user state
            // is one folder (single backup, single app data dir on
            // macOS release).
            let data_dir = root.join("data");
            let pending_dir = data_dir.join("commands").join("pending");
            let done_dir = data_dir.join("commands").join("done");
            let failed_dir = data_dir.join("commands").join("failed");
            let dashboards_dir = data_dir.join("dashboards");
            watcher::ensure_dirs(&[
                &pending_dir,
                &done_dir,
                &failed_dir,
                &dashboards_dir,
            ])?;

            // Manage the data root, not the app root: in dev this
            // narrows file commands to <project>/data/ instead of
            // <project>/, blocking accidental reads of source files.
            app.manage(DataRoot(data_dir));
            app.manage(WatcherState(Mutex::new(None)));

            if let Err(e) = watcher::start_watchers(
                app.handle().clone(),
                pending_dir,
                dashboards_dir,
            ) {
                eprintln!("[watcher] failed to start: {e}");
            }

            if let Some(window) = app.get_webview_window("main") {
                let _ = window
                    .set_background_color(Some(Color(0x1a, 0x1a, 0x1a, 0xff)));
                let _ = window.set_theme(Some(tauri::Theme::Dark));
                // Drive the window title from productName so
                // tauri.conf.json is the only place that names the app.
                let _ = window.set_title(&app.package_info().name);

                #[cfg(target_os = "macos")]
                hide_inspector_in_release(&window);

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
        // strand the window. RunEvent::Reopen only exists on macOS;
        // the cfg gate matches Tauri's own docs pattern.
        #[cfg(target_os = "macos")]
        if let tauri::RunEvent::Reopen { has_visible_windows, .. } = event {
            if !has_visible_windows {
                if let Some(w) = app_handle.get_webview_window("main") {
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            }
        }
        #[cfg(not(target_os = "macos"))]
        let _ = (app_handle, event);
    });
}

// WebKit 16.4 made WKWebView.inspectable opt-in. Tauri keeps it
// enabled so Web Inspector works in `tauri dev`; we need it off in
// release so a shipped .app doesn't expose internals to right-click
// → Inspect Element. Gated by respondsToSelector so pre-13.3
// systems don't hit an unrecognized selector.
#[cfg(target_os = "macos")]
fn hide_inspector_in_release(window: &tauri::WebviewWindow) {
    use objc2::msg_send;
    use objc2::runtime::Bool;
    use objc2_web_kit::WKWebView;

    let _ = window.with_webview(|webview| unsafe {
        let wv_ptr = webview.inner() as *mut WKWebView;
        if wv_ptr.is_null() {
            return;
        }
        let wv: &WKWebView = &*wv_ptr;

        let inspectable = cfg!(debug_assertions);
        let responds: Bool = msg_send![
            wv,
            respondsToSelector: objc2::sel!(setInspectable:)
        ];
        if responds.as_bool() {
            wv.setInspectable(inspectable);
        }
    });
}

fn build_menu(
    app: &tauri::AppHandle,
) -> tauri::Result<tauri::menu::Menu<tauri::Wry>> {
    // Pull the app name from package_info so productName in
    // tauri.conf.json is the single source of truth — renaming the
    // app does not require touching code.
    let pkg = app.package_info();

    // About dialog metadata. Version comes from Cargo.toml, name from
    // productName. Single source of truth, no hardcoded strings here.
    let about = AboutMetadata {
        name: Some(pkg.name.clone()),
        version: Some(pkg.version.to_string()),
        authors: Some(vec!["Nikolay Tuzov".into()]),
        comments: Some("Personal control center".into()),
        copyright: Some("© 2026 Nikolay Tuzov".into()),
        license: Some("PolyForm Perimeter 1.0.0".into()),
        website: Some("https://github.com/justskiv/owly".into()),
        website_label: Some("GitHub".into()),
        ..Default::default()
    };

    // Check for Updates — manual trigger that emits a menu event the
    // frontend listens for to invoke the updater plugin's check().
    let check_updates = MenuItemBuilder::with_id(
        "check-updates",
        "Check for Updates…",
    )
    .build(app)?;

    let app_sub = SubmenuBuilder::new(app, &pkg.name)
        .about(Some(about))
        .item(&check_updates)
        .separator()
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

    // Week-nav accelerators moved off Cmd+[ / Cmd+] so those chords
    // are free for history back/forward in the JS keydown handler
    // (Safari/Finder convention). Cmd+Shift+[ / Cmd+Shift+] keep
    // week-nav keyboard-reachable without colliding.
    let prev_week = MenuItemBuilder::with_id("prev-week", "Предыдущая неделя")
        .accelerator("Cmd+Shift+[")
        .build(app)?;
    let next_week = MenuItemBuilder::with_id("next-week", "Следующая неделя")
        .accelerator("Cmd+Shift+]")
        .build(app)?;
    let today = MenuItemBuilder::with_id("today", "Сегодня")
        .accelerator("Cmd+T")
        .build(app)?;
    let toggle_pool = MenuItemBuilder::with_id(
        "toggle-pool",
        "Показать/скрыть пул задач",
    )
    .build(app)?;
    let view_sub = SubmenuBuilder::new(app, "View")
        .item(&prev_week)
        .item(&next_week)
        .item(&today)
        .separator()
        .item(&toggle_pool)
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
