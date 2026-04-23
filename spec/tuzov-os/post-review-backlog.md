# Post-review backlog

Накопленный technical debt и улучшения, выявленные после AI-ревью
(8 ревьюеров: Gemini CLI, Codex CLI, Claude CLI, 5 Claude
субагентов с разными ролями: общий Tauri/macOS UX, WKWebView
internals × 2, macOS HIG, React/Tauri code quality).

## Контекст

После фазы 2 (`done/04-phase-2-weekly-grid.md`) и работы по
boot perception (`loading-perception.md`) собрался список
findings, не вошедших в текущие коммиты. Этот документ — что
осталось и в каком порядке брать. Я (Claude) **согласен с
каждым** пунктом ниже; альтернативы и спорные предложения в
секции «Отклонённое».

**Сделано в прошлой сессии:**
- `feat(boot): smoother first paint` — visible:false, native dialog,
  parallel boot
- `refactor(shell): hoist Header, full-width topbar` — Obsidian-style
  layout, drag region, tauri-plugin-window-state
- `fix(io): scope fs paths, fix data dir & race` — AppRoot validation,
  app_data_dir в release, request token в loadWeek
- `fix(planner): no scroll jump on inline cancel` — overflow-anchor
  none + blur-before-unmount

**Сделано в текущей сессии:**
- `14d505f` `fix: don't restore window size, only position` — **B1**
- `73fe05e` `fix: harden mutations and corrupt-file recovery` —
  **H1** (persist-first), **H2** (e.code), **H5** (recovery)
- `ab3374a` `feat(a11y): focus trap, sidebar buttons, toast roles` —
  **H3** (focus trap + ARIA), **H6** (sidebar buttons),
  **M7** (toast roles), **M8** (now tick aligned)
- `1c13ff2` `fix(shell): make chrome draggable, kill text selection` —
  drag-region на хроме + permission `core:window:allow-start-dragging`
- `cec789f` `feat(macos): native menu bar, dark theme, close-to-hide` —
  **M1** (menu bar), **M4** (force Dark), **M5** (close-to-hide)

**Сделано в текущей сессии (продолжение):**
- `387af39` `feat(ui): trim browser behaviors for native feel` —
  **M3** (только `setInspectable=false` в release; gestures/zoom
  default уже NO на macOS, scrollView KVC роняет на NSUnknownKey),
  **M6** (overscroll-behavior:none, system scrollbar, Tab выключен
  вне input/modal — все остальные косметические правки откатили
  как избыточные).

**Отброшено по решению пользователя:**
- **H4** (drop Backspace) — Backspace удаляет в нативном macOS
  Calendar, ломать привычку нельзя. Защита от случайных удалений
  — через undo (отдельный PR).
- **M2** (dock menu) — отложено: Tauri 2.10.3 не экспонирует
  `set_dock_menu`. Попробуем через objc в PR4 либо когда Tauri
  поднимет API.

---

## Баги

### B1. DevTools перезаписывает сохранённый размер окна ✅ DONE (`14d505f`)

**Симптом.** При открытых DevTools UI приложения (та часть, где
WebView) сжимается. После закрытия и перезапуска приложение
открывается размером с эту сжатую часть — будто отрезали площадь
инспектора. На macOS в normal-варианте Web Inspector открывается
ОТДЕЛЬНЫМ окном; здесь — нет, что подозрительно.

**Где копать.**
- `tauri-plugin-window-state-2.4.1` source: что именно сохраняет —
  `outer_size` или `inner_size`. Если inner — баг плагина,
  workaround нужен.
- Может быть Tauri 2 dev-режим докает inspector внутрь окна —
  проверить `tauri.conf.json` и переменные окружения.

**Возможные фиксы.**
- Workaround: удалить файл состояния
  `~/Library/Application Support/com.tuzov.os/.window-state.json`
- Если плагин виноват — issue в upstream + локальный fork с фиксом
- Альтернатива: убрать `StateFlags::SIZE` из restored set (как мы
  убрали `VISIBLE`), оставить только POSITION/MAXIMIZED

---

## HIGH — реальные баги корректности и UX

### H1. Optimistic mutations без rollback ✅ DONE (`73fe05e`)

**Где:** `src/store/schedule.ts:88-119`, `src/store/entities.ts:62-89`.

**Проблема.** `addBlock`, `updateBlock`, `deleteBlock` (и аналоги
в entities) делают `set({ blocks: [...] })` сначала, потом
`await save`. Если save кинет — в памяти блок есть, на диске нет,
после reload пропадает молча. Юзер видит только `saveStatus="error"`
в StatusBar — легко не заметить.

**Фикс.** Persist-first паттерн:
```ts
addBlock: async (draft) => {
  const block = { ...draft, id: generateId("blk") };
  const next = [...get().blocks, block];
  await persist(next);  // throw before mutating state
  set({ blocks: next });
  return block;
}
```
Применить ко всем мутаторам обоих stores.

### H2. Hotkeys ломаются на кириллице ✅ DONE (`73fe05e`)

**Где:** `src/pages/PlannerPage.tsx:161, 169, 186, 188`.

**Проблема.** `e.key === "n"` / `"d"` / `"s"` / `"t"` не срабатывают
на русской раскладке. Уже зафиксировано в CODESTYLE п.7, но не
исполнено.

**Фикс.** Заменить на `e.code === "KeyN"` / `"KeyD"` / `"KeyS"` /
`"KeyT"`. Для digit'ов в Shell.tsx (`KEY_PAGE = {"1": ..., ...}`)
тоже стоит подумать о `e.code === "Digit1"`, но цифры обычно
layout-stable.

### H3. Модалка `BlockEditor` без a11y baseline ✅ DONE (`ab3374a`)

**Где:** `src/components/planner/BlockEditor.tsx:155-297`,
`src/components/shared/Modal.tsx` (unused).

**Проблема.**
- Tab уходит за пределы модалки (нет focus-trap)
- После закрытия фокус на body, не на инициировавший элемент
- Нет `role="dialog"`, `aria-modal="true"`, `aria-labelledby`
- Shared Modal.tsx вообще не используется — BlockEditor лепит
  свою разметку

**Фикс.** Хуки `useFocusTrap` + `useRestoreFocus` (уже в backlog
фазы 3). Применить в Modal.tsx, использовать его в BlockEditor.
Удалить дубликат разметки. Добавить ARIA-атрибуты.

### H4. Backspace удаляет блок без undo ❌ ОТКЛОНЕНО

**Решение пользователя.** Backspace удаляет в нативном macOS
Calendar — это устоявшийся mac-паттерн. Менять = ломать muscle
memory. Правильное решение — добавить undo-стек (Cmd+Z), что
выходит за рамки этого backlog'а. Добавлено в memory как
feedback: «UX-решения проверять с native macOS приложениями».

**Где:** `src/pages/PlannerPage.tsx:191-193`.

**Проблема.** На macOS Backspace — это рефлекс «назад», легко
промахнуться при выделенном блоке и удалить случайно. Toast
говорит «✕ Удалён», но без recovery.

**Фикс (минимальный).** Дропнуть Backspace, оставить только Delete.
**Фикс (правильный).** Undo-стек минимум на одно действие.

### H5. Сломанный week-файл → exit(1) всего приложения ✅ DONE (`73fe05e`)

**Где:** `src/store/schedule.ts:51-71`, `src/services/file-io.ts:101-111`,
`src/App.tsx:43`.

**Проблема.** На Zod-fail в `loadWeek` → throw → App.tsx показывает
native dialog → `exit(1)`. Пользователь не может починить, не видит
какой именно файл, не может продолжить с другими неделями.

**Фикс.**
- Снимать снапшот сломанного файла в `<file>.corrupted-<timestamp>`
- Создавать пустой файл с дефолтом, продолжить boot
- Логировать в `~/Library/Logs/com.tuzov.os/...` (`tauri-plugin-log`)
- Включать `e.path` в сообщение error dialog для критичных файлов

### H6. Sidebar items — `<div>` вместо `<button>` ✅ DONE (`ab3374a`)

**Где:** `src/components/layout/Sidebar.tsx:29-39`,
`src/components/shared/makeClickable.ts`.

**Проблема.**
- VoiceOver не озвучивает «button»
- Full Keyboard Access (System Settings → Keyboard) не достигает
  сайдбара через Tab
- Space на div не активирует (нужно вручную обрабатывать)
- `clickableProps` — компенсация native поведения, которое было
  бы бесплатно у `<button>`

**Фикс.**
```tsx
<button
  type="button"
  className={`si${active ? " active" : ""}`}
  aria-label={label}
  aria-current={active ? "page" : undefined}
  onClick={() => setPage(id)}
>
  <Icon size={18} strokeWidth={1.5} />
</button>
```
Удалить `clickableProps` если больше нигде не нужен. Добавить
`aria-label="Главная навигация"` на `<nav className="sidebar">`.

---

## MEDIUM — native macOS polish

### M1. Нативный menu-bar ✅ DONE (`cec789f`)

**Реализовано:** TuzovOS / File / Edit / View / Window submenus.
Cmd+N (новый блок), Cmd+T (сегодня), Cmd+[/Cmd+] (нав по неделям),
стандартный Edit-блок. Доработка — `docs/tasks/native-menu-polish.md`.

**Где:** `src-tauri/src/lib.rs`.

**Зачем.** Все три macOS-ревьюера сходятся: «THE biggest tell»
что приложение не нативное. Без меню `Cmd+,` (Preferences),
`Cmd+F` (Find), `Cmd+W` (Close), `Cmd+M` (Minimize), `Cmd+H`
(Hide), `Cmd+Q` (Quit) ведут себя криво или никак.

**Что добавить (минимум):**
- `TuzovOS` submenu: About, Preferences (`Cmd+,`), Services, Hide,
  Hide Others, Show All, Quit
- `File`: New Block (`Cmd+N`), Close Window (`Cmd+W`)
- `Edit`: Undo/Redo, Cut/Copy/Paste, Select All, Find (`Cmd+F`)
- `View`: Previous Week (`Cmd+[`), Next Week (`Cmd+]`), Today
  (`Cmd+T`), Toggle Sidebar (`Cmd+0`), Enter Full Screen (`Ctrl+Cmd+F`)
- `Window`: Minimize, Zoom

**Реализация.** `tauri::menu::{MenuBuilder, SubmenuBuilder,
PredefinedMenuItem, MenuItemBuilder}` в setup hook. На menu-event
эмитить в frontend через `app.emit("menu://...")` и слушать в
React.

**Размер.** ~100 строк Rust + ~30 строк JS event listeners.
**Конфликт.** Текущие single-letter hotkeys `N`/`T`/`D`/`S` могут
конфликтовать с menu-accelerators при модификаторах. Решение:
in-app handlers оставляем как «pro» режим без модификаторов,
menu использует `Cmd+...`.

### M2. Dock menu ⏸ ОТЛОЖЕНО

Tauri 2.10.3 не экспонирует `set_dock_menu` (есть только
`set_dock_visibility`), muda тоже не поддерживает. Попробуем
через objc в PR4 (когда подтянем objc-зависимость для M3),
либо когда Tauri добавит API.

**Где:** `src-tauri/src/lib.rs`.

**Зачем.** Right-click по dock-иконке. Линейные/Things 3/Obsidian
имеют. Сильный native-сигнал.

**Что добавить.** «Новый блок», «Сегодня». 2-3 пункта максимум.

**Размер.** ~20 LOC через `MenuBuilder` + `app.set_dock_menu(...)`.

### M3. WKWebView — выключить веб-привычки ✅ DONE (`387af39`)

**Реализовано урезанно.** Из четырёх пунктов в плане живой эффект
дал только `setInspectable=false` в release. Остальное оказалось
лишним:
- `setAllowsBackForwardNavigationGestures` и `setAllowsMagnification`
  на macOS-WKWebView default = NO. Наши вызовы — no-op.
- `scrollView.bounces = NO` через `valueForKey:@"scrollView"` —
  iOS-only KVC, на macOS бросает NSUnknownKeyException и приложение
  падает с non-unwinding panic. Вместо этого — `overscroll-behavior:none`
  на `.grid-scroll` (M6, ниже).

Финальная функция: `hide_inspector_in_release` с
`respondsToSelector:` гейтом для macOS < 13.3.

**Где:** `src-tauri/src/lib.rs` (через `with_webview` + objc2).

**Что выключить.**
- `setAllowsBackForwardNavigationGestures: false` — иначе
  2-finger swipe пытается навигировать webview как браузер
- Elastic overscroll внутри `.grid-scroll` — bounce при дотягивании
  до низа выдаёт «это вебвью». Через `scrollView.bounces = NO`.
- `setAllowsMagnification: false` — pinch-to-zoom для UI
  бессмыслен и confusing
- `setInspectable: cfg!(debug_assertions)` — закрыть Safari
  attach в release

**Реализация.**
```rust
#[cfg(target_os = "macos")]
window.with_webview(|webview| unsafe {
    use objc2::msg_send;
    let wv = webview.inner() as *mut objc2::runtime::AnyObject;
    let _: () = msg_send![wv, setAllowsBackForwardNavigationGestures: false];
    let _: () = msg_send![wv, setAllowsMagnification: false];
    #[cfg(debug_assertions)]
    let _: () = msg_send![wv, setInspectable: true];
    #[cfg(not(debug_assertions))]
    let _: () = msg_send![wv, setInspectable: false];
});
```

### M4. Force Dark appearance окна ✅ DONE (`cec789f`)

**Где:** `src-tauri/src/lib.rs` setup hook.

**Зачем.** На macOS с системной Light темой traffic lights
рендерятся в light chrome → клэш с нашим тёмным интерьером.

**Фикс (1 строка).**
```rust
let _ = window.set_theme(Some(tauri::Theme::Dark));
```

### M5. `Cmd+Q` vs window close behavior ✅ DONE (`cec789f`)

**Где:** `src-tauri/src/lib.rs`.

**Зачем.** Для «open once a day, runs for hours» паттерна (Things,
Notes, Reminders): close button / `Cmd+W` → hide window, `Cmd+Q`
→ quit. Reopen на dock-icon-click. Сейчас close = quit.

**Реализация.**
```rust
window.on_window_event(|event| {
    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
        api.prevent_close();
        let _ = window.hide();
    }
});
// + слушать RunEvent::Reopen для dock-click
```

### M6. Cursor / scrollbar / focus-ring native fixes ✅ DONE (`387af39`)

**Реализовано урезанно.** Изначальный план был «native polish»
четырёх вещей, но три из них оказались by-design и были отвергнуты
пользователем по ходу (сохранено в memory `feedback_no_cosmetic_overrides`):
- `cursor:cell` на `.gr` — by design, плюсик намекает на «click to
  create». НЕ трогаем.
- `box-shadow`-фокус вместо `outline` — складывался с `.tb.selected`
  box-shadow, давал двойную обводку. НЕ трогаем (более того, Tab
  по UI выключен — focus-ring глобально не нужен; см. ниже).
- Развилка `onContextMenu` для editable — нативное меню в `<input>`
  и так не блокировалось (`preventDefault` вешался на корень,
  `<input>` его перебивает). НЕ трогаем.

Реально применено:
- Удалены `.grid-scroll::-webkit-scrollbar*` правила → system overlay
  scrollbar (по системной настройке Show scroll bars).
- `overscroll-behavior:none` на `.grid-scroll` → нет резинового bounce
  (закрывает M3 пункт про bounce без objc-хака).
- `outline:none` для всех `button`/`[tabindex]` (focus-visible тоже)
  — Tab-навигация выключена в Shell.tsx keydown handler'е (вне
  `<input>`/`<textarea>`/`role="dialog"`). Все клавиатурные действия
  идут через хоткеи (как в native-приложениях типа Things/Reminders),
  Tab по контролам — браузерное поведение, для нашего use-case
  бессмысленное.
- `.tb` (TimeBlock) → `tabIndex={-1}`, убраны `onFocus`/`onKeyDown`
  для Enter/Space (раз нет Tab — нет смысла в keyboard activation).

**Где:** `src/styles/globals.css`.

**Что менять.**
- `.gr { cursor: cell }` (line 108) → `cursor: default`. `cell` —
  spreadsheet-курсор, нет ни в одном macOS-нативном app.
- Убрать `.grid-scroll::-webkit-scrollbar { width: 5px }` (line
  101-103). Дать system overlay-scrollbars (которые auto-hide и
  слушают System Settings → Show scroll bars).
- Focus ring через `box-shadow` вместо `outline` (более native):
  ```css
  button:focus-visible, [tabindex]:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--focus-ring) 50%, transparent);
    border-radius: inherit;
  }
  ```
- Глобальный `onContextMenu={(e) => e.preventDefault()}` в
  Shell.tsx (line 37) — пропускать для input/textarea/contentEditable,
  чтобы Look Up / Translate / Spell Check / Services работали.

### M7. Toast: разделить success и error ✅ DONE (`ab3374a`)

**Где:** `src/components/shared/Toast.tsx:39-56`.

**Проблема.** Один live region `aria-live="polite"` для обоих типов.
Errors должны быть `aria-live="assertive"` чтобы VoiceOver озвучил
сразу. Сейчас error может потеряться.

**Фикс.** Два контейнера:
```tsx
<div className="toast-c" role="status" aria-live="polite">
  {success...}
</div>
<div className="toast-c err" role="alert" aria-live="assertive">
  {errors...}
</div>
```

### M8. nowTick aligned to :00 ✅ DONE (`ab3374a`)

**Где:** `src/pages/PlannerPage.tsx:109-116`.

**Проблема.** `setInterval(60_000)` тикает от старта приложения,
не от минутной границы. Если запустили в 14:00:30, тики в
14:01:30, 14:02:30 — now-line отстаёт до 60s.

**Фикс.**
```ts
useEffect(() => {
  const msToNextMinute = 60_000 - (Date.now() % 60_000);
  let interval: number | null = null;
  const start = window.setTimeout(() => {
    setNowTick((t) => t + 1);
    interval = window.setInterval(
      () => setNowTick((t) => t + 1),
      60_000,
    );
  }, msToNextMinute);
  return () => {
    window.clearTimeout(start);
    if (interval) window.clearInterval(interval);
  };
}, []);
```

---

## LOW — cleanup и production prep

### L1. `lucide-react@^1.8.0` — версия странная ✅ NO-OP

`npm view lucide-react@1.8.0`: description «A Lucide icon library
package for React applications.», repository
`github.com/lucide-icons/lucide`, homepage `lucide.dev`. Это
настоящий Lucide. На npm `latest=1.8.0`, `dev=0.554.0-rc.0` —
проект реально перешёл на 1.x семвер. Ничего менять не нужно.

### L2. `generateId` → `crypto.randomUUID()` ✅ DONE

**Где:** `src/services/time-utils.ts:129`.

4 случайных байта = 32 бита, ~50% коллизий на 65k IDs.
`crypto.randomUUID()` — встроенный, secure context (Tauri webview
ОК), 122 случайных бита.

Сделано: `${prefix}-${crypto.randomUUID()}`. Префикс сохранили —
полезно при чтении дампов JSON (видно тип). Старые короткие ID
(`blk-deadbeef`) остаются валидными — Zod не валидирует формат,
сравнения только через `===`.

### L3. Font preload в `index.html` ❌ ОТКЛОНЕНО

**Решение.** Окно показывается с `visible:false` до полной загрузки
данных и первого рендера (см. `loading-perception.md` и
boot-perception работу). FOUT по определению не воспроизводится —
шрифты успевают загрузиться до показа окна. Реальной пользовательской
проблемы нет, делать nothing.

### L4. Migrate time-utils на date-fns + DST + ISO weeks

**Где:** `src/services/time-utils.ts` (whole file).

Текущие `dayIndexOfDate`, `getCurrentWeekId`, `addWeeks`,
`getWeekStartDate` — наколеночные, страдают от DST off-by-one.
Мигрировать на `date-fns` (`getISOWeek`, `startOfISOWeek`,
`addWeeks`, `formatISO`) + unit-тесты.

### L5. App icon — проверить mipmap

**Где:** `src-tauri/icons/icon.icns`.

```bash
iconutil -c info src-tauri/icons/icon.icns
```
Должен содержать все размеры от 16×16 до 1024×1024 @ 1x и @ 2x.
Если что-то отсутствует — Finder/Dock покажут blurry в этом
размере.

### L6. Code signing + notarization

**Где:** `src-tauri/tauri.conf.json` `bundle.macOS`.

Без `signingIdentity` + notarization сборка `.app` получает
Gatekeeper quarantine при первой установке (ошибка «can't be
opened because Apple cannot check it»). Это **ship-blocker** для
любой публичной раздачи.

Нужно:
- Apple Developer ID Application certificate
- `bundle.macOS.signingIdentity = "Developer ID Application: ..."`
- `bundle.macOS.entitlements` (хотя бы пустой плист)
- В CI/dev: `xcrun notarytool submit` после bundle

### L7. CSP

**Где:** `src-tauri/tauri.conf.json:25-27`.

`"csp": null` отключает CSP полностью. Локально-only приложение
относительно безопасно, но добавить strict CSP — одна строка,
которая закрывает любой будущий XSS от exfil:
```json
"security": {
  "csp": "default-src 'self'; img-src 'self' data: asset: https://asset.localhost; style-src 'self' 'unsafe-inline'; font-src 'self' data:; script-src 'self'; connect-src 'self' ipc: http://ipc.localhost"
}
```
Может потребоваться `'unsafe-eval'` для Vite dev — проверить.

---

## Порядок работы (предложение)

**PR 1 — высокий приоритет, надёжность.** ✅ Готово (`73fe05e`).
H1 (rollback), H2 (e.code), H5 (corrupt file recovery). H4
отклонён — Backspace соответствует нативному Calendar.

**PR 2 — accessibility и менее видимые баги.** ✅ Готово (`ab3374a`).
H3 (focus-trap), H6 (sidebar buttons), M7 (toast roles), M8
(now tick).

**PR 3 — native menu and chrome.** ✅ Готово (`cec789f`).
M1 (menu bar), M4 (force Dark), M5 (close-to-hide). M2
(dock menu) отложен — нет API в Tauri 2.10.3.

**PR 4 — webview-level native polish.** ✅ Готово (`387af39`).
M3 урезан до `setInspectable=false` в release (всё остальное —
no-op либо роняет приложение). M6 урезан до system scrollbar +
overscroll-behavior + Tab off (cursor/focus-ring/contextmenu
оставлены as-is как by-design).

**PR 5 — cleanup.** 🔧 В работе. L1 (✅ NO-OP — версия валидна),
L2 (✅ DONE), L3 (❌ ОТКЛОНЕНО — visible:false убирает FOUT),
L4 (⏳ дальше — date-fns + vitest, отдельный план).

**Отдельно — perf-blocker для production.** ⏳ Отложено.
L5 (icons), L6 (signing), L7 (CSP). Делать когда будет
реальная подготовка к раздаче build'а.

**Бонус-фикс по ходу.** `1c13ff2` — drag-region на всём хроме
(хедер, сайдбар, футер, day headers, time column, week summary)
+ permission `core:window:allow-start-dragging`. Решает баг
«не таскается за хедер» и «выделяется текст интерфейса».

---

## Отклонённое (намеренно НЕ делать)

- **`macos-private-api` для белой вспышки.** Блокирует Mac App Store
  distribution. Вспышка сейчас не воспроизводится в типичных
  сценариях после Gemini'шной правки boot timing. При желании MAS
  в будущем — нельзя.
- **macOS vibrancy / `WindowEffect::Sidebar` / `set_effects`.**
  Спека `loading-perception.md` явно запрещает. Gemini уже
  пытался впилить — пришлось откатывать. Карго-культ.
- **Custom traffic lights / `decorations: false`.** Ломает
  fullscreen, focus state, accessibility. `titleBarStyle: Overlay`
  даёт тот же визуальный эффект чище.
- **Skeleton screens с shimmer.** Локальные JSON загружаются за
  десятки ms, скелет успеет показаться 2 кадра. См. спеку.
- **localStorage cache last-state.** Cache invalidation сложнее
  выгоды в 50ms.
- **Транспарентные/vibrancy окна.** На Windows ломаются shadows
  + click-through bugs.
- **Custom splash window.** Двух-оконная пляска, net negative.
- **View Transitions API / `@starting-style`.** Поддержка частичная,
  выгода ноль на one-time first paint.
- **Motion One / Framer Motion.** 4 строки CSS дешевле 7KB
  библиотеки.

---

## Мета — как мы дошли до этого backlog

В сессии `b68cac33-cf8b-499d-b01e-20b15b725fc1`:
1. Рефакторили boot perception (visible:false, native dialog,
   parallel data load).
2. Поймали баг скролла на Esc — исправили через
   `overflow-anchor: none` + blur-before-unmount.
3. Запустили `/ai-review` дважды (broad + scroll-bug-specific).
   Первый раз Gemini CLI самовольно наредактировал файлов (моя
   ошибка — не указал явно «do not modify»). На будущее: для
   review-задач передавать в CLI `⚠️ DO NOT MODIFY ANY FILES`
   и использовать Explore-тип для Claude-субагентов (они
   read-only).
4. Закрыли в коммитах: data dir в release, FS scope, loadWeek
   race, scroll fix.

Этот документ — то, что ревью нашло, но не успели в текущую
сессию.