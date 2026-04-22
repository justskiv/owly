# Проработать native menu и горячие клавиши

> **Статус:** отложено. Базовая версия сделана в коммите PR3
> (feat(macos): native menu bar, dark theme, close-to-hide).
> Здесь — что нужно додумать и довести.

## Что уже есть

Menu bar с пунктами `TuzovOS / File / Edit / View / Window`
и акселераторами `Cmd+N`, `Cmd+T`, `Cmd+[`, `Cmd+]`, стандартный
Edit-блок. Клик → эвент `"menu"` во frontend → dispatch в stores.

## Что нужно доработать

(Детали — потом. Сейчас — чеклист тем.)

- Полный аудит конфликтов с in-app хоткеями (N, T, D, S) и
  системными акселераторами.
- Dock menu (right-click по иконке) — Tauri 2.10.3 не экспонирует
  `set_dock_menu`, сделать через objc.
- About item с реальными метаданными (версия, копирайт, link).
- Preferences (`Cmd+,`) — когда появится экран настроек.
- Find (`Cmd+F`) — когда появится поиск по блокам.
- Toggle Sidebar (`Cmd+0`) — когда добавим collapse-state в UI.
- Локализация menu строк (сейчас частично рус/частично англ).
- Проверить, что menu events не теряются при свёрнутом окне
  (RunEvent::Reopen + show).
- Проверить fullscreen / zoom / minimize на разных DPI.
- Убедиться, что Cmd+Q действительно выходит (а не просто
  прячет, как close button).
- Иконки/separator'ы в submenu — посмотреть macOS HIG.
- Менюшки для других страниц (Entities, Dashboards) — либо
  контекстные подменю, либо динамический `set_menu` при
  смене страницы.
