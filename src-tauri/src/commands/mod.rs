pub mod files;
pub mod system;

use std::path::PathBuf;
use std::sync::Mutex;

use notify::RecommendedWatcher;

// Base directory containing both `data/` (planner/entities/etc.) and
// `commands/` (file-based AI queue, phase 6). All file commands must
// validate paths against this root.
pub struct AppRoot(pub PathBuf);

// Holds the live notify watcher so it isn't dropped at the end of
// setup(). The Mutex<Option<...>> shape leaves room for a future
// hot-restart that swaps it; for now we Some(...) it once.
pub struct WatcherState(pub Mutex<Option<RecommendedWatcher>>);
