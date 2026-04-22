pub mod files;
pub mod system;

use std::path::PathBuf;

// Base directory containing both `data/` (planner/entities/etc.) and
// `commands/` (file-based AI queue, phase 6). All file commands must
// validate paths against this root.
pub struct AppRoot(pub PathBuf);
