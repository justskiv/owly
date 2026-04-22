# TuzovOS favicon assets

Вариант «Страница 15» — тёмная карточка, золотая шапка, жирная дата.
Дата **динамическая**: в вебе — JS перерисовывает SVG в полночь, в Tauri — Rust
через `NSApp.setApplicationIconImage` меняет Dock-иконку живого процесса.

## Структура

```
favicon-assets/
  svg/
    favicon-template.svg   — шаблон с {{DAY}}
    favicon.svg            — статичный fallback (день = последний build)
  png/                     — 16, 32, 48, 64, 128, 256, 512, 1024
  tauri/icons/             — ready-to-drop в src-tauri/icons/
    icon.icns, icon.png, 32x32.png, 128x128.png, 128x128@2x.png
  web/
    dynamic-favicon.js     — drop-in для HTML-страницы
  tauri-rust/
    dynamic_icon.rs        — модуль для src-tauri/src/
    Cargo-additions.toml   — зависимости
    main-integration.rs    — пример подключения
  scripts/
    generate.mjs           — SVG → PNG (resvg-js)
    build-icns.sh          — PNG → .icns (iconutil)
    build-all.sh           — всё сразу
  docs/
    README.md              — этот файл
    DYNAMIC.md             — детали динамического обновления
```

## Быстрый старт

### Перегенерировать всё под сегодняшнюю дату
```bash
cd design/favicon-assets
bash scripts/build-all.sh
```

### Собрать под конкретный день (напр. для скриншотов)
```bash
bash scripts/build-all.sh 15
```

### Web (HTML-мок или Tauri webview)
```html
<script type="module" src="path/to/dynamic-favicon.js"></script>
```
Скрипт сам регистрирует `<link rel="icon">` и перерисовывает в полночь + на
`visibilitychange` (на случай, если вкладка была в фоне всю ночь).

### Tauri (Rust, macOS)
1. Скопируй `tauri-rust/dynamic_icon.rs` → `src-tauri/src/dynamic_icon.rs`
2. Добавь зависимости из `Cargo-additions.toml` в `src-tauri/Cargo.toml`
3. В `main.rs`:
   ```rust
   mod dynamic_icon;

   fn main() {
       tauri::Builder::default()
           .setup(|_app| {
               #[cfg(target_os = "macos")]
               dynamic_icon::spawn_midnight_updater();
               Ok(())
           })
           .run(tauri::generate_context!()).unwrap();
   }
   ```
4. Скопируй `tauri/icons/*` → `src-tauri/icons/` (статичный fallback в бандле)

Детали и caveats — в `DYNAMIC.md`.
