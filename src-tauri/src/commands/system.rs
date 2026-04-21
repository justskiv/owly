use std::env;
use std::path::PathBuf;

#[tauri::command]
pub fn get_data_dir() -> Result<String, String> {
    // dev: бинарник лежит в src-tauri/target/debug/<exe>, корень проекта в 3 уровнях выше.
    // prod: пока возвращаем директорию рядом с бинарником; путь пересмотрим при деплое.
    let exe = env::current_exe().map_err(|e| e.to_string())?;
    let base: PathBuf = if cfg!(debug_assertions) {
        // dev: src-tauri/target/debug/<exe> → подняться 4 уровня до корня проекта.
        exe.parent()
            .and_then(|p| p.parent())
            .and_then(|p| p.parent())
            .and_then(|p| p.parent())
            .ok_or_else(|| "cannot resolve project root".to_string())?
            .to_path_buf()
    } else {
        exe.parent()
            .ok_or_else(|| "cannot resolve app directory".to_string())?
            .to_path_buf()
    };
    Ok(base.join("data").to_string_lossy().into_owned())
}
