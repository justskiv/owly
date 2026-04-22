// Dynamic Dock icon for macOS — shows today's date on the app icon.
//
// Place this as `src-tauri/src/dynamic_icon.rs` (or wherever you prefer)
// and register in main.rs. See Cargo-additions.toml for dependencies.
//
// Notes:
// * The .icns baked into the app bundle is static (it's what users see before
//   the app launches, e.g. in Finder and in Dock slots of quit apps). On first
//   run after midnight, the Dock will briefly show yesterday's date until
//   `update_dock_icon` fires.
// * On non-macOS targets this module compiles as a no-op.

#[cfg(target_os = "macos")]
pub use macos::*;

#[cfg(not(target_os = "macos"))]
pub fn spawn_midnight_updater() {}

#[cfg(target_os = "macos")]
mod macos {
    use chrono::{Datelike, Duration as ChronoDur, Local, TimeZone};
    use resvg::tiny_skia::{Pixmap, Transform};
    use resvg::usvg::{fontdb, Options, Tree};
    use std::sync::Arc;

    // Adjust this path to wherever you place favicon-template.svg in your repo.
    // include_str! is resolved at compile time relative to this source file.
    const SVG_TEMPLATE: &str = include_str!(
        "../../../design/favicon-assets/svg/favicon-template.svg"
    );

    /// Render the favicon SVG with `day` baked in to a PNG byte buffer.
    pub fn render_day_png(day: u32, size: u32) -> Vec<u8> {
        let svg = SVG_TEMPLATE.replace("{{DAY}}", &day.to_string());

        let mut db = fontdb::Database::new();
        db.load_system_fonts();

        let opt = Options {
            fontdb: Arc::new(db),
            ..Default::default()
        };
        let tree = Tree::from_str(&svg, &opt).expect("parse svg");

        let mut pix = Pixmap::new(size, size).expect("pixmap alloc");
        let scale = size as f32 / 32.0;
        resvg::render(&tree, Transform::from_scale(scale, scale), &mut pix.as_mut());
        pix.encode_png().expect("encode png")
    }

    /// Replace the running Dock tile's image with today's date.
    pub fn update_dock_icon() {
        use cocoa::appkit::NSApp;
        use cocoa::base::id;
        use objc::{class, msg_send, sel, sel_impl};

        let today = Local::now().day();
        let png = render_day_png(today, 1024);

        unsafe {
            let data: id = msg_send![class!(NSData),
                dataWithBytes: png.as_ptr() as *const std::ffi::c_void
                length: png.len()];
            let image: id = msg_send![class!(NSImage), alloc];
            let image: id = msg_send![image, initWithData: data];
            let app: id = NSApp();
            let _: () = msg_send![app, setApplicationIconImage: image];
        }
    }

    /// Fire once immediately, then every local midnight.
    pub fn spawn_midnight_updater() {
        std::thread::spawn(|| loop {
            update_dock_icon();

            let now = Local::now();
            let tomorrow_midnight = (now + ChronoDur::days(1))
                .date_naive()
                .and_hms_opt(0, 0, 5)
                .unwrap();
            let target = Local
                .from_local_datetime(&tomorrow_midnight)
                .single()
                .unwrap_or(now + ChronoDur::days(1));
            let delta = (target - now).to_std().unwrap_or(std::time::Duration::from_secs(3600));
            std::thread::sleep(delta);
        });
    }
}
