mod commands;

use commands::files::{
    delete_file, ensure_dir, file_exists, list_files, move_file, read_file, write_file,
};
use commands::system::get_data_dir;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
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
