// Example main.rs snippet for wiring dynamic_icon into a Tauri app.

mod dynamic_icon;

fn main() {
    tauri::Builder::default()
        .setup(|_app| {
            #[cfg(target_os = "macos")]
            dynamic_icon::spawn_midnight_updater();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
