use std::fs;
use std::io::Write;
use std::path::{Component, Path, PathBuf};

use crate::commands::DataRoot;

fn map_err<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}

// Reject anything outside the data directory and any path containing a
// `..` component. The root passed in is `<app_root>/data` (DataRoot),
// not the project root — in dev, this confines file ops to the
// user-state tree rather than the whole source tree. We don't
// canonicalize because target paths are often missing on first write
// — symlink-escape is out of scope (single-user local app, the user
// owns the data dir).
fn validate(root: &Path, path: &str) -> Result<PathBuf, String> {
    let candidate = PathBuf::from(path);
    if !candidate.is_absolute() {
        return Err(format!("path must be absolute: {}", path));
    }
    for c in candidate.components() {
        if matches!(c, Component::ParentDir) {
            return Err(format!("parent-dir components not allowed: {}", path));
        }
    }
    if !candidate.starts_with(root) {
        return Err(format!("path outside data dir: {}", path));
    }
    Ok(candidate)
}

#[tauri::command]
pub fn read_file(path: String, root: tauri::State<DataRoot>) -> Result<String, String> {
    let p = validate(&root.0, &path)?;
    fs::read_to_string(&p).map_err(map_err)
}

#[tauri::command]
pub fn write_file(
    path: String,
    content: String,
    root: tauri::State<DataRoot>,
) -> Result<(), String> {
    let target = validate(&root.0, &path)?;

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
pub fn list_files(dir: String, root: tauri::State<DataRoot>) -> Result<Vec<String>, String> {
    let d = validate(&root.0, &dir)?;
    let entries = fs::read_dir(&d).map_err(map_err)?;
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
pub fn ensure_dir(path: String, root: tauri::State<DataRoot>) -> Result<(), String> {
    let p = validate(&root.0, &path)?;
    fs::create_dir_all(&p).map_err(map_err)
}

#[tauri::command]
pub fn move_file(
    from: String,
    to: String,
    root: tauri::State<DataRoot>,
) -> Result<(), String> {
    let from_p = validate(&root.0, &from)?;
    let to_p = validate(&root.0, &to)?;
    if let Some(parent) = to_p.parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent).map_err(map_err)?;
        }
    }
    fs::rename(&from_p, &to_p).map_err(map_err)
}

#[tauri::command]
pub fn delete_file(path: String, root: tauri::State<DataRoot>) -> Result<(), String> {
    let p = validate(&root.0, &path)?;
    fs::remove_file(&p).map_err(map_err)
}

#[tauri::command]
pub fn file_exists(path: String, root: tauri::State<DataRoot>) -> Result<bool, String> {
    let p = validate(&root.0, &path)?;
    Ok(p.exists())
}

// Random suffix so two simultaneous writes to the same path don't
// trample each other's temp file. Without this, a fast second writer
// can truncate the first's in-progress tmp, then the first finishes
// and renames a half-written file onto the final path.
fn tmp_sibling(path: &Path) -> PathBuf {
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::time::{SystemTime, UNIX_EPOCH};

    static COUNTER: AtomicU64 = AtomicU64::new(0);
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos() as u64)
        .unwrap_or(0);
    let n = COUNTER.fetch_add(1, Ordering::Relaxed);
    let pid = std::process::id();

    let mut tmp = path.as_os_str().to_owned();
    tmp.push(format!(".tmp.{pid}.{nanos}.{n}"));
    PathBuf::from(tmp)
}
