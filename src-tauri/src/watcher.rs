use std::path::{Path, PathBuf};

use notify::{
    event::{CreateKind, ModifyKind, RenameMode},
    Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher,
};
use tauri::{AppHandle, Emitter, Manager};

use crate::commands::WatcherState;

const COMMAND_EVENT: &str = "command-received";
const DASHBOARD_EVENT: &str = "dashboard-files-changed";

#[derive(serde::Serialize, Clone)]
pub struct DashboardChange {
    pub path: String,
    // "created" | "modified" | "removed"
    pub kind: &'static str,
}

// Watch both pending/ and dashboards/ via one recommended_watcher.
// Routes events to two distinct Tauri events; per-event filtering
// (extension, .tmp.* prefix) lives on the JS side. Stores the
// watcher in WatcherState so it isn't dropped when setup() returns.
pub fn start_watchers(
    app: AppHandle,
    pending_dir: PathBuf,
    dashboards_dir: PathBuf,
) -> notify::Result<()> {
    let app2 = app.clone();
    let pending_clone = pending_dir.clone();
    let dashboards_clone = dashboards_dir.clone();

    let mut watcher: RecommendedWatcher =
        notify::recommended_watcher(move |res: notify::Result<Event>| {
            let event = match res {
                Ok(e) => e,
                Err(e) => {
                    eprintln!("[watcher] error: {e}");
                    return;
                }
            };

            // Treat Create + Modify(Name(To/Any/Both)) as new-file
            // signals. macOS FSEvents reports atomic temp-rename
            // writes as Modify(Name(To)); Linux inotify uses Create
            // or RenameMode::Both (paired old/new paths). Either way
            // means "the destination exists and is final".
            let is_create = matches!(
                event.kind,
                EventKind::Create(CreateKind::File)
                    | EventKind::Create(CreateKind::Any)
                    | EventKind::Modify(ModifyKind::Name(RenameMode::To))
                    | EventKind::Modify(ModifyKind::Name(RenameMode::Any))
                    | EventKind::Modify(ModifyKind::Name(RenameMode::Both))
            );
            let is_modify = matches!(
                event.kind,
                EventKind::Modify(ModifyKind::Data(_))
                    | EventKind::Modify(ModifyKind::Any)
            );
            let is_remove = matches!(event.kind, EventKind::Remove(_));

            for path in &event.paths {
                if path.starts_with(&pending_clone) {
                    if is_create {
                        let s = path.to_string_lossy().to_string();
                        let _ = app2.emit(COMMAND_EVENT, s);
                    }
                } else if path.starts_with(&dashboards_clone) {
                    let kind = if is_remove {
                        "removed"
                    } else if is_create {
                        "created"
                    } else if is_modify {
                        "modified"
                    } else {
                        continue;
                    };
                    let _ = app2.emit(
                        DASHBOARD_EVENT,
                        DashboardChange {
                            path: path.to_string_lossy().to_string(),
                            kind,
                        },
                    );
                }
            }
        })?;

    watcher.watch(&pending_dir, RecursiveMode::NonRecursive)?;
    // Recursive for dashboards so users can organize .jsx files into
    // subfolders (data/dashboards/work/foo.jsx) without losing hot
    // reload. The JS-side filter is the same — basename inspection.
    watcher.watch(&dashboards_dir, RecursiveMode::Recursive)?;

    let state = app.state::<WatcherState>();
    // Poison can only happen if a previous holder of this Mutex
    // panicked while holding it; today there is no such holder. Even
    // so, refuse to panic from inside Tauri::setup — log and return
    // cleanly so the UI still boots.
    match state.0.lock() {
        Ok(mut guard) => *guard = Some(watcher),
        Err(e) => eprintln!("[watcher] WatcherState mutex poisoned: {e}"),
    }
    Ok(())
}

pub fn ensure_dirs(paths: &[&Path]) -> std::io::Result<()> {
    for p in paths {
        std::fs::create_dir_all(p)?;
    }
    Ok(())
}
