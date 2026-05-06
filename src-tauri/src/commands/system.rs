use crate::commands::DataRoot;

#[tauri::command]
pub fn get_data_dir(root: tauri::State<DataRoot>) -> Result<String, String> {
    // DataRoot is already <app_root>/data — no further join.
    Ok(root.0.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use tauri::test::{mock_builder, mock_context, noop_assets};
    use tauri::Manager;
    use tempfile::TempDir;

    #[test]
    fn get_data_dir_returns_managed_root() {
        let dir = TempDir::new().unwrap();
        let app = mock_builder()
            .manage(DataRoot(dir.path().to_path_buf()))
            .build(mock_context(noop_assets()))
            .expect("mock app builds");

        let returned = get_data_dir(app.state::<DataRoot>()).unwrap();

        assert_eq!(PathBuf::from(returned), dir.path().to_path_buf());
    }
}
