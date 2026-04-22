use crate::commands::AppRoot;

#[tauri::command]
pub fn get_data_dir(root: tauri::State<AppRoot>) -> Result<String, String> {
    Ok(root.0.join("data").to_string_lossy().into_owned())
}
