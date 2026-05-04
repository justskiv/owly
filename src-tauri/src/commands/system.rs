use crate::commands::DataRoot;

#[tauri::command]
pub fn get_data_dir(root: tauri::State<DataRoot>) -> Result<String, String> {
    // DataRoot is already <app_root>/data — no further join.
    Ok(root.0.to_string_lossy().into_owned())
}
