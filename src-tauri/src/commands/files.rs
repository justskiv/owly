use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

fn map_err<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}

#[tauri::command]
pub fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(map_err)
}

#[tauri::command]
pub fn write_file(path: String, content: String) -> Result<(), String> {
    let target = PathBuf::from(&path);

    if let Some(parent) = target.parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent).map_err(map_err)?;
        }
    }

    let tmp_path = tmp_sibling(&target);

    {
        let mut tmp_file = fs::File::create(&tmp_path).map_err(map_err)?;
        tmp_file.write_all(content.as_bytes()).map_err(map_err)?;
        tmp_file.sync_all().map_err(map_err)?;
    }

    fs::rename(&tmp_path, &target).map_err(|e| {
        let _ = fs::remove_file(&tmp_path);
        map_err(e)
    })?;

    Ok(())
}

#[tauri::command]
pub fn list_files(dir: String) -> Result<Vec<String>, String> {
    let entries = fs::read_dir(&dir).map_err(map_err)?;
    let mut result = Vec::new();
    for entry in entries {
        let entry = entry.map_err(map_err)?;
        if let Some(name) = entry.file_name().to_str() {
            result.push(name.to_string());
        }
    }
    result.sort();
    Ok(result)
}

#[tauri::command]
pub fn ensure_dir(path: String) -> Result<(), String> {
    fs::create_dir_all(&path).map_err(map_err)
}

#[tauri::command]
pub fn move_file(from: String, to: String) -> Result<(), String> {
    if let Some(parent) = Path::new(&to).parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent).map_err(map_err)?;
        }
    }
    fs::rename(&from, &to).map_err(map_err)
}

#[tauri::command]
pub fn delete_file(path: String) -> Result<(), String> {
    fs::remove_file(&path).map_err(map_err)
}

#[tauri::command]
pub fn file_exists(path: String) -> bool {
    Path::new(&path).exists()
}

fn tmp_sibling(path: &Path) -> PathBuf {
    let mut tmp = path.as_os_str().to_owned();
    tmp.push(".tmp");
    PathBuf::from(tmp)
}
