# Фаза 1.5: Переход на дизайн-систему

> **Цель:** привести Shell-слой приложения в соответствие с новой
> дизайн-спекой и HTML-моком, заложить общие UI-примитивы (Toast,
> `makeClickable`). Чистый мостик между фазой 1 (реализована по
> старой стилистике) и фазами 2+ (переписаны под новый дизайн).
>
> **Результат:** приложение запускается в новом визуале: sidebar
> 52px с золотым индикатором, header 48px, status bar 26px снизу с
> «Сохранено» и подсказками-хоткеями. Шрифты Outfit + JetBrains
> Mono. Иконка из `design/favicon-assets/`. Страницы-заглушки
> отрисованы в новой нейтрально-серой палитре.
>
> **Предусловие:** фаза 1 завершена (данные читаются и пишутся,
> Shell с Tailwind и slate-палитрой уже работает). Все обновлённые
> спеки (00–08, data-schema, architecture) зафиксированы.

## Контекст

Прочитай:
- `design/tuzov-os-design-spec.md` — токены, размеры, шрифты
- `design/tuzov-os-design-mock.html` — референс-реализация. В этой
  фазе переносим **только** Shell-уровень: селекторы `.app`,
  `.sidebar`, `.si`, `.s-logo`, `.s-top`, `.s-bot`, `.main`,
  `.page`, `.hdr`, `.hdr-title`, `.hdr-spacer`, `.hdr-btn`,
  `.hkbd`, `.nav-btn`, `.hdr-today`, `.search-input`, `.sbar`,
  `.toast-c`, `.toast` и всё, что им нужно в `:root`
- `spec/tuzov-os/02-architecture.md`, раздел «Дизайн-система и
  стилизация» + «UI: Общая структура»
- `spec/tuzov-os/03-phase-1-foundation.md`, шаги 8–9 (там же
  описаны правильные Shell и StatusBar)

Стили Planner, Entities, Dashboards в эту фазу **не переносим** —
они пойдут по своим фазам.

---

## Текущее состояние (что уже есть с фазы 1)

- `src/styles/globals.css`: `@import "tailwindcss"` + `@theme` со
  **старыми** цветами (`#0F172A`, `#3B82F6` и т.д.)
- `index.html`: атрибут `class="dark"` на `<html>`, без шрифтов,
  без favicon link
- `src/components/layout/Shell.tsx`, `Sidebar.tsx`, `Header.tsx`:
  написаны на Tailwind, размеры не из мока, `Sidebar` ~60px, нет
  золотого индикатора, статус-бара нет вообще
- `src/services/defaults.ts`, `TagBadge.tsx` — цвета уже
  обновлены (сделано при обновлении спек)

Вся эта поверхность переписывается в этой фазе.

---

## Шаги

### 1. CSS-токены и базовые стили

В `src/styles/globals.css`:
1. Оставить первой строкой `@import "tailwindcss";` (не
   используется, но подключён на будущее — см. `docs/tasks/
   tailwind-migration.md`).
2. Удалить старый блок `@theme { ... }` полностью.
3. Удалить существующие ручные правила `html/body/#root`, `body {
   font-family: ui-sans-serif ... }` — они заменяются блоком из
   мока.
4. Скопировать из `design/tuzov-os-design-mock.html` (теги
   `<style>`) **один в один**:
   - Весь блок `:root { ... }` (поверхности, текст, акцент,
     категории, opacity, радиусы, font-size, motion, elevation,
     layout)
   - Глобальные правила: `* { margin:0; padding:0; box-sizing:
     border-box }`
   - `body { font-family: var(--font); background: var(--bg-base);
     color: var(--text-primary); font-size: var(--fs-md); ...
     user-select: none }`
   - `::selection { background: rgba(224,184,96,.25) }`
   - `button:focus-visible, [tabindex]:focus-visible { outline:
     2px solid var(--focus-ring); outline-offset: 2px; border-
     radius: inherit }`
   - Список селекторов с `user-select: text` (заголовки,
     описания, чеклисты, note-body, инпуты — полный набор из мока)
5. Из мока перенести CSS Shell-уровня:
   - `.app`, `.sidebar`, `.s-top`, `.s-bot`, `.s-logo`, `.si`,
     `.si:hover`, `.si.active`, `.si.active::before`, `.si svg`
   - `.main`, `.page`, `.page.active`
   - `.hdr`, `.hdr-title`, `.hdr-spacer`, `.hdr-btn`, `.hdr-btn:
     hover`, `.hdr-btn-ghost`, `.hdr-btn-ghost:hover`, `.hkbd`,
     `.nav-btn`, `.nav-btn:hover`, `.nav-btn svg`, `.hdr-week`,
     `.hdr-week-sub`, `.hdr-today`, `.hdr-today:hover`,
     `.search-input`, `.search-input:focus`,
     `.search-input::placeholder`
   - `.sbar`, `.sbar .dot`, `.sbar .sep`, `.sbar .hints`, `.sbar
     kbd`
   - `.toast-c`, `.toast`, `@keyframes tIn`, `.toast.success`,
     `.toast.error` (последнее по аналогии с success, через
     `border-left` + `var(--error)`)

Всё остальное (`.wsummary`, `.day-headers`, `.tb`, `.pool`,
`.erow`, `.edp`, `.dcard` и т.п.) в этой фазе **не переносим**.

### 2. Шрифты и точка входа

`index.html`:
- Убрать атрибут `class="dark"` с тега `<html>` (в новой дизайн-
  системе нет светлой темы и переключателя)
- Внутрь `<head>` добавить (после `<meta>` тегов):
  ```html
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500&family=Outfit:wght@300;400;500;600&display=swap" rel="stylesheet">
  ```
- Для favicon: `<link rel="icon" type="image/svg+xml" href="/favicon.svg">`

Убедиться, что `src/main.tsx` импортирует `./styles/globals.css`
(уже должно быть с фазы 1).

### 3. Favicon и иконка Tauri

1. Создать папку `public/` в корне проекта (если её нет) и
   скопировать туда `design/favicon.svg`.
2. Скопировать в `src-tauri/icons/` файлы из
   `design/favicon-assets/tauri/icons/`:
   - `32x32.png`
   - `128x128.png`
   - `128x128@2x.png`
   - `icon.png`
   - `icon.icns`
   (другие форматы — если Tauri шаблон их ожидает)
3. Проверить `src-tauri/tauri.conf.json` → `bundle.icon` ссылается
   на эти файлы (обычно шаблон Tauri так и делает по умолчанию).

Динамическая иконка в этой фазе **не подключается** — см.
`docs/tasks/dynamic-favicon.md`.

### 4. Shell.tsx — корневой grid

Переписать `src/components/layout/Shell.tsx`:

- Корневой `<div className="app">` вместо любых Tailwind-обёрток
- Грид формируется CSS-классом `.app` из мока:
  `grid-template-columns: var(--sidebar-w) 1fr;`
  `grid-template-rows: 1fr 26px;`
- Внутри: `<Sidebar />`, `<main className="main">{header +
  активная страница}</main>`, `<StatusBar />`
- Sidebar растянут на обе строки (`grid-row: 1/-1`) — это уже в
  CSS, в JSX просто ставим его вне `<main>`
- Активная страница выбирается через `ui.currentPage`, оборачивается
  в `<div className="page active">` (как в моке), остальные — в
  `<div className="page">` (display:none)

### 5. Sidebar.tsx — 52px с OS-логотипом

`src/components/layout/Sidebar.tsx`:

- Корневой `<nav className="sidebar">`
- `<div className="s-logo">OS</div>` сверху (шрифт `--mono`,
  рамка `--border`, 28×28)
- `<div className="s-top">` — три `.si` иконки:
  - Planner: `lucide-react` `<Calendar />` (или SVG-разметка как в
    моке)
  - Entities: `<Database />`
  - Dashboards: `<BarChart3 />` (или `<BarChart2 />`)
- `<div className="s-bot">` — одна `.si` иконка:
  - Settings: `<Settings />` — неактивна в этой фазе, без onClick
- Active-класс на `.si` выставляется по `ui.currentPage`
- При клике — `setCurrentPage(...)`
- Каждую `.si` делаем фокусируемой через `makeClickable`
- Все иконки — 18×18, `stroke-width: 1.5`

Убрать всё, что осталось от старой Tailwind-реализации (`bg-slate-*`,
hover-классы и т.д.).

### 6. Header.tsx — 48px, заглушки на каждой странице

`src/components/layout/Header.tsx`:

- Корневой `<div className="hdr">`
- Получает текущую страницу из `ui.currentPage`, рендерит один из
  трёх вариантов заголовка:
  - **planner**: `<`/`>` nav-btn (не функционирует пока — коммент
    «работает с фазы 2») + `.hdr-week` `Неделя N · ДД–ДД месяц` +
    `.hdr-today` «Сегодня» (disabled/visual-only) + `.hdr-spacer`
    + `.hdr-btn.hdr-btn-ghost` «Пул» с `.hkbd` «T»
  - **entities**: `.hdr-title` «Сущности» + `.search-input` +
    `.hdr-spacer` + `.hdr-btn` «+ Создать» (disabled пока)
  - **dashboards**: `.hdr-title` «Дашборды» + `.hdr-spacer` +
    `.hdr-btn` «+ Добавить» (disabled пока)
- Кнопки без логики — это заглушки. Логика появится в своих
  фазах (2 / 4 / 5)
- Для номера недели в фазе 1.5 достаточно `getCurrentWeekId()` из
  `time-utils.ts` + `fmtWeekRange(weekId)` — если лень вытаскивать
  даты, можно отрисовать просто `Неделя 16 · 14–20 апр` статикой.
  В фазе 2 этот блок оживёт

### 7. StatusBar.tsx (новый компонент)

`src/components/layout/StatusBar.tsx`:

- Корневой `<div className="sbar">`
- Слева:
  - `<span className="dot"></span>` (4×4 зелёная точка, opacity .5)
  - Текст «Сохранено» (в будущем — с timestamp из `save-status.ts`)
  - `<span className="sep"></span>` (вертикальный разделитель 1×10)
  - Текст «N сущностей» — из entity store (`entities.length`)
- Справа `.hints`:
  - `<kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> страницы`
  - `<kbd>N</kbd> блок`
  - `<kbd>T</kbd> пул`
  - `drag блоки и пул`
- В фазе 6 сюда добавятся счётчики команд и ошибок

### 8. Общие примитивы

**`src/components/shared/Toast.tsx`** (новый):
- Компонент + mini-store (Zustand) для очереди тостов:
  ```typescript
  interface ToastStore {
    toasts: Array<{ id: string; type: 'success' | 'error'; text: string }>;
    push(type, text): void;
    remove(id): void;
  }
  ```
- Корневой контейнер `.toast-c` монтируется один раз в `Shell`
- Каждый тост — `.toast.success` / `.toast.error` с анимацией `tIn`
- Автоудаление через `setTimeout(2500ms)`
- Экспортируем хелпер `toast.success(text)` / `toast.error(text)`
  для удобства

**`src/components/shared/makeClickable.ts`** (новый):
- Хелпер, описан в архитектуре:
  ```typescript
  export function makeClickable(el: HTMLElement | null) {
    if (!el) return;
    el.tabIndex = 0;
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        el.click();
      }
    });
  }
  ```
- В React-коде чаще будет удобнее не mutate DOM, а сделать
  **хук** или **пропсы-расширитель**:
  ```typescript
  export function clickableProps(onClick: () => void) {
    return {
      tabIndex: 0,
      onClick,
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      },
    };
  }
  ```
- Экспортируем оба — `makeClickable` для ref-подхода (DOM-кейсы),
  `clickableProps` для JSX-подхода

### 9. Глобальные хоткеи страниц

`1 / 2 / 3` — переключение страниц — уже частично в спеке фазы 2,
но логично посадить этот слушатель в `Shell` сейчас (в фазе 1.5):

```typescript
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement) return;
    if (e.key === '1') setCurrentPage('planner');
    if (e.key === '2') setCurrentPage('entities');
    if (e.key === '3') setCurrentPage('dashboards');
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, []);
```

Хоткеи блоков (D, S, N, T, Delete и т.д.) в этой фазе **не
подключаются** — они требуют selection state, появятся в фазе 2.

### 10. Страницы-заглушки — обёртка в `.page`

Проверить, что `PlannerPage.tsx`, `EntitiesPage.tsx`,
`DashboardsPage.tsx` рендерят свой корневой `<div className="page">`
(без условного `active` — это выставляется в Shell). Простой текст
«Планировщик будет здесь. Блоков: N» и т.п. — достаточно. Визуально
текст в `--text-secondary`, заголовок в `--fs-xl` primary.

---

## Критерии готовности

- [ ] `npm run tauri dev` запускает приложение без ошибок в
  консоли
- [ ] В `index.html` нет `class="dark"`, подключены Google Fonts
  (Outfit + JetBrains Mono), виден `<link rel="icon">`
- [ ] Окно имеет иконку приложения из `design/favicon-assets/`
- [ ] В `globals.css` нет старого `@theme` со slate-цветами
- [ ] В `:root` globals.css присутствуют все токены из мока (6
  поверхностей, 5 текстовых, акцент, 5 категорий, success/error,
  5 opacity, 6 радиусов, 7 font-size, 4 motion, 4 shadow, 4 layout)
- [ ] Shell-grid: sidebar 52px слева, main по центру, status bar
  26px снизу
- [ ] Sidebar: OS-логотип в рамке сверху, 3 иконки навигации + 1
  settings внизу, активная — золотая с `::before` полоской слева
- [ ] Клик на иконку sidebar переключает страницу
- [ ] `1 / 2 / 3` на клавиатуре переключают страницы
- [ ] Tab-навигация по sidebar работает, фокус виден золотым
  outline-ом
- [ ] Header на каждой из 3 страниц отрисован по своему варианту
  (planner / entities / dashboards)
- [ ] Status bar снизу: `● Сохранено` · `N сущностей` · `.hints`
  с клавишами-подсказками
- [ ] Страницы-заглушки показывают счётчики данных (как в фазе
  1), но уже в новой палитре
- [ ] Шрифт страниц — Outfit (заголовки/текст), JetBrains Mono
  видно в status bar и в `<kbd>`-пилюлях
- [ ] Визуально нет остатков старой Tailwind-палитры (нет
  синего акцента, нет slate-фона)
- [ ] `Toast.tsx` подключён, можно триггерить тестовый тост и
  видеть анимацию
- [ ] `clickableProps` / `makeClickable` работают (Enter/Space
  на `.si` имитируют клик)
