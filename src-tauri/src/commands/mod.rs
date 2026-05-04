pub mod files;
pub mod system;

use std::path::PathBuf;
use std::sync::Mutex;

use notify::RecommendedWatcher;

// `<app_root>/data` — the directory holding all user state (planner,
// entities, pool, horizon, dashboards, commands queue). Frontend file
// commands validate every path against it, so a frontend bug or
// compromised dashboard JSX cannot read or write outside data/.
// Replaces the previous AppRoot which pointed at the project root in
// dev and granted full source-tree access.
pub struct DataRoot(pub PathBuf);

// Holds the live notify watcher so it isn't dropped at the end of
// setup(). The Mutex<Option<...>> shape leaves room for a future
// hot-restart that swaps it; for now we Some(...) it once.
pub struct WatcherState(pub Mutex<Option<RecommendedWatcher>>);
