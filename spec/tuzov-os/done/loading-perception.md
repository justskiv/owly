# Восприятие загрузки (boot perception)

> **Цель.** Сделать так, чтобы запуск приложения ощущался лёгким и
> отзывчивым. Сама загрузка локальных JSON быстрее не станет (десятки
> миллисекунд), задача — убрать визуальные разрывы и моменты «жди».
>
> **Не цель.** Театральные splashscreen'ы, бесконечные skeleton'ы с
> shimmer-анимацией и прочая мишура «как будто что-то делаем». Если
> ничего не делаем — лучше тихо появиться, чем громко исполнять
> загрузку.

## Контекст

Сценарий использования: один пользователь, один окно, открывает
приложение **раз в день и держит часами**. Не калькулятор, который
открывают на 5 секунд и закрывают; и не бизнес-апп, где старт ощущают
50 раз в день. Это значит: оптимизация под «100ms холодного старта»
важнее оптимизации под «открыл, моментально кликнул, закрыл».

Текущая последовательность boot'а:

1. macOS открывает окно Tauri (мгновенно).
2. WebView красит фон — `tauri.conf.json` уже даёт `#1a1a1a`,
   `index.html` подкрепляет inline `<style>` ~50ms.
3. React монтируется, в `App.tsx:36-51` отображает центрированную
   строку «Загрузка…».
4. `await` цепочка `ensureDataDir → loadConfig → loadEntities →
   loadWeek` (~100-300ms на cold-кэше диска).
5. Shell + Sidebar + Header + Grid + StatusBar появляются
   одновременно, разом.

Шаги 3 и 5 — самые заметные «разрывы». Между ними и нужно работать.

## Что уже сделано (статус)

- ✅ **`backgroundColor: "#1a1a1a"`** в `tauri.conf.json` — окно
  тёмное от OS-paint, без белой вспышки.
- ✅ **Inline `<style>` в `index.html`** — `html/body/#root` тёмные
  до того, как `globals.css` догрузится через `main.tsx`.
- ✅ **Self-host шрифтов** через `@fontsource-variable/outfit` +
  `@fontsource-variable/jetbrains-mono` — нет CDN-запросов в Google
  Fonts, нет FOUT, шрифты валидны офлайн. Family-имена в `globals.css`
  — `'Outfit Variable'` / `'JetBrains Mono Variable'`.

Остальное — план ниже, в трёх волнах по приоритету.

---

## Волна 1 — must (главный выигрыш)

Эти три пункта дают ~80% эффекта. Без них дальше идти бессмысленно.

### 1.1. Убрать «Загрузка…» — рендерить Shell сразу

**Файл:** `src/App.tsx:36-51`.

**Сейчас.** Пока `bootState === "loading"` — показывается
центрированный `<div>` со словом «Загрузка…». Shell не виден до
полной готовности данных.

**Стало.** `App` всегда рендерит `<Shell />`. Stores дают пустые
массивы по умолчанию (`useScheduleStore.blocks = []`,
`useEntityStore.entities = []`, `useConfigStore.config = null`). В
момент монтирования Shell видна структура (Sidebar 52px + Header
48px + пустой грид + StatusBar 26px). По мере подгрузки данных
блоки и счётчики появляются на местах.

Структура `App.tsx`:

```tsx
function App() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await ensureDataDir();
        await Promise.all([                              // см. 1.2
          useConfigStore.getState().loadConfig(),
          useEntityStore.getState().loadEntities(),
          useScheduleStore
            .getState()
            .loadWeek(getCurrentWeekId()),
        ]);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Ошибка не блокирует Shell — показываем banner или toast.
  return (
    <>
      <Shell />
      {error && <BootErrorBanner message={error} />}
    </>
  );
}
```

**Тонкости.**

- `useConfigStore.config` стартует как `null`. В компонентах, где
  читаем `areas`, уже стоит `s.config?.areas ?? []` — компоненты
  переживут пустой массив (BlockEditor покажет пустой `.f-cats`, но
  юзер модалку не открывает в первые 200ms boot'а).
- `BootErrorBanner` — простой fixed-баннер сверху с текстом и
  кнопкой «Перезапустить». Компонент в `src/components/layout/`
  или просто inline JSX. Вариант проще: `toast.error(...)` через
  `useEffect` при `error`.
- `WeekGrid` авто-скроллит к 07:00 в `useEffect([weekKey])`. На
  пустом гриде это OK — позиция скролла будет правильной к моменту,
  когда блоки догрузятся.

**Чего ожидать.** После правки переход «открытие → Shell» становится
визуально мгновенным. Блоки прорастают на пустом гриде через ~150ms.

### 1.2. Параллелить boot

**Файл:** `src/App.tsx:19-22`.

**Сейчас.** Три `await` подряд — `loadConfig`, `loadEntities`,
`loadWeek` — выполняются последовательно. Они независимы (только
`ensureDataDir` обязан быть до них), параллелизация бесплатная.

**Стало.** `Promise.all` после `ensureDataDir`. Свободные 30-100ms
на cold-кэше диска.

Код — выше в 1.1.

### 1.3. Self-host шрифтов — ✅ сделано

См. секцию «Что уже сделано». Этот пункт включён сюда, потому что
изначально был отложен с фазы 1.5; сейчас закрыт. Попадает в Волну
1, потому что без него boot всё ещё дёргался FOUT-ом и сетевым
запросом в Google Fonts.

---

## Волна 2 — polish (когда хочется ещё немного)

### 2.1. Fade-in на блоках при появлении

**Файлы:** `src/styles/globals.css` (новый `@keyframes`),
`src/components/layout/Shell.tsx` (класс `booting` на `.app`),
`src/App.tsx` (toggle класса).

**Зачем.** После 1.1 структура видна сразу, но блоки появляются
синхронным «бабах» через ~150ms после mount. Тонкий fade-in (opacity
0 → 1 + lift 2px) сглаживает этот переход.

**Реализация (вариант A — без stagger, проще):**

```css
@keyframes tbIn {
  from { opacity: 0; transform: translateY(2px); }
}
.app:not(.booting) .tb {
  animation: tbIn var(--duration-base) var(--ease-out) both;
}
.app:not(.booting) .now-line {
  animation: tbIn var(--duration-fast) var(--ease-out) 100ms both;
}
.app:not(.booting) .wsbar span,
.app:not(.booting) .dh-bar .bseg {
  animation: tbIn var(--duration-base) var(--ease-out) 60ms both;
}
.app.booting .tb,
.app.booting .now-line,
.app.booting .wsbar span,
.app.booting .dh-bar .bseg { opacity: 0; }
```

`App.tsx` (или `Shell.tsx`) ставит класс `booting` на `.app` до
готовности данных, снимает после первой загрузки. Это синхронизирует
fade со временем когда блоки реально появились в DOM.

**Реализация (вариант B — со stagger, чуть живее):**

К каждому `.tb` через style передавать `--tb-i` равный `idx % 7`
(чтобы stagger не рос неограниченно при многих блоках):

```tsx
<TimeBlock style={{ "--tb-i": String(idx % 7) }} ... />
```

```css
.app:not(.booting) .tb {
  animation: tbIn var(--duration-base) var(--ease-out) both;
  animation-delay: calc(var(--tb-i, 0) * 8ms);
}
```

Stagger 8ms × (idx % 7) — слишком короткий чтобы прочитаться как
«волна», но защищает от синхронной opacity-вспышки 30+ элементов
на слабых GPU.

**Что выбрать.** A — если хочется минимума кода. B — если важна
тонкая «органика». Любой вариант — НЕ Motion One, НЕ Framer Motion.
Это четыре строки CSS.

**Reduced-motion.** В существующем `@media (prefers-reduced-motion:
reduce)` блоке (`globals.css:26-28`) сейчас режутся все
`animation-duration` и `transition-duration` до 1ms. Это слишком
жёстко: без opacity-fade блоки появляются с резкой вспышкой. Лучше
переопределить:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 1ms !important;
    transition-duration: 1ms !important;
    scroll-behavior: auto !important;
  }
  /* но boot opacity оставляем — без transform, мгновенный fade */
  .app:not(.booting) .tb,
  .app:not(.booting) .now-line,
  .app:not(.booting) .wsbar span,
  .app:not(.booting) .dh-bar .bseg {
    animation: tbIn var(--duration-fast) linear both !important;
    animation-delay: 0ms !important;
    transform: none !important;
  }
}
```

### 2.2. `visible: false` + `show()` с safety

**Файлы:** `src-tauri/tauri.conf.json` (опция),
`src/main.tsx` (вызов show + safety).

**Зачем.** Самый «native» сигнал на macOS: окно вообще не
появляется, пока контент не готов. После 1.1 окно появится с уже
обустроенным интерьером, без момента «темнота → Shell».

**Реализация.**

`tauri.conf.json`:

```json
"windows": [
  {
    ...
    "visible": false,                // <- новое
    "backgroundColor": "#1a1a1a"
  }
]
```

`main.tsx` — после монтирования React показать окно:

```tsx
import { getCurrentWindow } from "@tauri-apps/api/window";

const root = ReactDOM.createRoot(...);
root.render(<App />);

// Показать окно сразу после первого commit'а React.
queueMicrotask(() => {
  void getCurrentWindow().show();
});

// Safety net: даже если что-то залипло — показать через 3с.
window.setTimeout(() => {
  void getCurrentWindow().show();
}, 3000);
```

**Тонкости.**

- `show()` идемпотентен — второй вызов не вредит.
- Если `ensureDataDir` упадёт на permissions prompt и зависнет —
  3-секундный safety-таймер всё равно покажет окно. Юзер увидит
  пустой Shell + (после 1.1) error banner.
- Подходит и тот вариант, где `show()` вызывается только в `App.tsx`
  через `useEffect(() => { show() }, [])` — но `main.tsx` чище,
  потому что `show` не зависит от React-cycle.

---

## Волна 3 — native feel (опционально, для macOS)

### 3.1. `titleBarStyle: "Overlay"` + `hiddenTitle: true`

**Файлы:** `src-tauri/tauri.conf.json`, `src/components/layout/Shell.tsx`
или `src/pages/PlannerPage.tsx` (drag region).

**Зачем.** Native traffic lights остаются (фокус, fullscreen,
accessibility — всё работает), заголовок исчезает, контент рисуется
до верхнего края. Look как в Linear / Things 3 / Arc.

**Реализация.**

`tauri.conf.json`:

```json
"windows": [
  {
    ...
    "titleBarStyle": "Overlay",
    "hiddenTitle": true
  }
]
```

В Shell — добавить `data-tauri-drag-region` поверх верхней части
интерфейса (28px высоты, начиная с x=80, чтобы не клипало traffic
lights в левом верхнем углу):

```tsx
<div
  data-tauri-drag-region
  style={{
    position: "fixed",
    top: 0,
    left: 80,           // не перекрываем traffic lights
    right: 0,
    height: 28,
    zIndex: 1,
  }}
/>
```

**Тонкости.**

- `titleBarStyle: "Overlay"` только на macOS. На Windows/Linux
  игнорируется. Если планируем кросс-платформу — оставить и для них
  defaults.
- Header высотой 48px — первые 28px перекрываются drag region. В
  Header нет интерактивных элементов в самой верхней зоне (кнопки
  навигации центрируются вертикально → центр на ~24px от верха
  Header'а, drag region всё равно не блокирует, потому что drag
  region это не interactive HTML element и не блокирует click через
  Tauri's drag-region semantics — по факту блокирует, поэтому надо
  проверять). Если кнопки клипает — сделать drag region 24px и
  оставить 4px gap.

### 3.2. `tauri-plugin-window-state`

**Файлы:** `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs`,
`package.json`.

**Зачем.** Восстанавливать size/position/maximized между запусками.
«Открыл там, где оставил» — один из самых заметных native-сигналов.

**Реализация.**

```bash
cd src-tauri
cargo add tauri-plugin-window-state
cd ..
npm install @tauri-apps/plugin-window-state
```

В `src-tauri/src/lib.rs`:

```rust
fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::default().build())
        // ... остальные plugins / commands
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

После — сохраняется автоматически. Никаких JS-вызовов не нужно.

---

## Что НЕ делать (намеренно)

Список основан на консенсусе трёх дизайн/UX-обзоров. Каждый пункт —
тестировался и отвергался по конкретной причине, не «просто потому
что».

- **Custom splash window.** Двух-оконная пляска ради того, чтобы
  спрятать 200ms boot'а. Net-negative: лишняя вспышка окна, больше
  кода, странности с dock. После 2.2 (`visible: false`) даёт ту же
  цель бесплатно.
- **View Transitions API / `@starting-style`.** Поддержка частичная
  (на WKWebView macOS — нет), выгода ноль на одном first paint. Если
  понадобится — для transitions между Planner/Entities/Dashboards,
  не для boot'а.
- **Motion One / Framer Motion / FormKit auto-animate.** Одна
  анимация = четыре строки CSS. Не добавляем dep ради 3-7KB.
- **Skeleton screens с shimmer-эффектом.** Скелеты разумны для
  network UI с непредсказуемой задержкой. Локальный JSON резолвится
  за десятки ms — скелет успеет показаться 2 кадра. Хуже того,
  fake-блоки на гриде = ложь, юзер увидит как они «исчезают» и
  заменяются настоящими.
- **Stagger 30-50ms на каждой строке/секции.** День — мило, неделя
  — раздражает. Stagger вообще оправдан только для предотвращения
  синхронной вспышки (см. вариант B в 2.1, там stagger 8ms — ниже
  порога восприятия).
- **Cached last-state в localStorage.** Тема «показать вчерашнее
  состояние мгновенно, потом обновить из файлов» звучит хорошо,
  но cache invalidation сложнее, чем выигрыш в 50ms.
- **macOS vibrancy / `windowEffects`** (`HudWindow`, `Sidebar`,
  `under-window`). Карго-культ под flat dark surface: если не делать
  панели полупрозрачными — vibrancy не виден; если делать — теряем
  контраст и фигачим против дизайна.
- **Transparent windows.** На Windows — сломанные тени, click-
  through баги. Не начинаем.
- **`decorations: false` + custom traffic lights.** Не работает с
  fullscreen, focus state, accessibility. `titleBarStyle: "Overlay"`
  даёт тот же эффект чище.
- **`BackgroundThrottlingPolicy` / GPU toggles.** Hours-long single-
  window foreground app. Defaults правильные. Трогать — путь к
  мистическим bug-репортам через полгода.
- **Dock-bounce «дамперы».** macOS прыгает иконкой в доке только
  когда приложение долго не отвечает на launch-event. После 2.2
  не должно вообще триггериться. Подавлять прыжок — спорить с OS.
- **`WebView.set_initialization_script` для pre-React paint.**
  Inline `<style>` в `index.html` уже отрабатывает раньше любого
  JS. Init-script — тот же самый момент, только сложнее.

---

## Verification

### Запуск и наблюдение

`task dev` — должен ощущаться так:

1. **Окно появляется** — тёмное, не белое (после 2.2 — окно вообще
   не показывается, пока не готово, без момента темноты).
2. **Shell видна сразу** — sidebar/header/statusbar/empty-grid без
   «Загрузка…».
3. **Блоки тихо появляются** через ~150ms (если включена 2.1) или
   просто резко (если без 2.1).
4. **Никаких внешних запросов** — файервол не должен спрашивать про
   сетевые соединения. Проверить через Little Snitch / `lsof` /
   macOS app firewall.

### Дополнительно

- Прокликать sidebar (`1`/`2`/`3`) — переключение страниц без
  морганий.
- Навигировать по неделям (`←`/`→`/`Сегодня`) — auto-scroll к 07:00,
  блоки новой недели появляются.
- Системные настройки macOS → Accessibility → Reduce Motion: после
  включения transform-анимации (translate, scale) не должны
  происходить, opacity-переходы остаются (см. refined block в 2.1).

### Что считается «готово»

После Волны 1 — boot воспринимается как «открылся, всё на месте,
блоки тихо проявились». После Волны 2 — добавляется ощущение
«дыхания», без морганий. Волна 3 — для тех, кто хочет «как Linear».

Если после Волны 1 кажется, что больше делать нечего — это
правильное ощущение. Дальше — диminishing returns. Не делать
анимации ради анимаций.

---

## Зависимости и порядок

- **1.1 → 1.2** — независимы, порядок неважен. Можно в одном PR.
- **1.3** — уже сделано.
- **2.1** требует 1.1 (без неё `.booting` класс не имеет смысла —
  блоки и так не видны до загрузки).
- **2.2** требует 1.1 (если оставить «Загрузка…» — окно покажется
  с этим спиннером, что хуже).
- **3.1, 3.2** — независимы от Волн 1-2.

Логичный порядок: 1.1 + 1.2 → коммит → проверить визуально → 2.1
→ коммит → 2.2 → коммит → потом, если хочется, Волна 3.
