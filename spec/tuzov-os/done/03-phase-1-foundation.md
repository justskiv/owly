# Фаза 1: Foundation

> **Цель:** запустить Tauri + React приложение, реализовать слой данных, показать пустой shell с навигацией.
>
> **Результат:** приложение открывается, показывает боковую панель и заглушки страниц. Данные читаются и пишутся в JSON-файлы. Zod-схемы валидируют всё.

## Контекст

Прочитай `00-overview.md`, `01-data-schema.md`, `02-architecture.md` в
этой же папке — там полная картина проекта. Также обязательно открой
**`design/tuzov-os-design-spec.md`** (UI-токены) и посмотри структуру
`design/tuzov-os-design-mock.html` (референс-реализация). CSS и разметка
Shell в этой фазе переносятся из мока 1-в-1.

Эта фаза — фундамент, на котором строятся все остальные.

## Шаги

### 1. Создать проект

```bash
npm create tauri-app@latest tuzov-os -- --template react-ts
cd tuzov-os
npm install
```

Убедись что `npm run tauri dev` запускается и показывает дефолтное окно.

### 2. Установить зависимости

```bash
npm install zustand zod lucide-react date-fns
npm install -D tailwindcss @tailwindcss/vite
```

Tailwind v4 ставим на будущее (он прописан в `CLAUDE.md` как стек
стилизации). В стартовой версии стилизация идёт голым CSS из
`design/tuzov-os-design-mock.html` — см. шаг «Стилизация» ниже.
Миграция на Tailwind — отложена (`docs/tasks/tailwind-migration.md`).

Настройка Tailwind:
- Добавить `@tailwindcss/vite` плагин в `vite.config.ts`
- В `src/styles/globals.css`: первой строкой `@import "tailwindcss";`
  (чтобы он был готов, когда начнём переносить стили)
- Импортировать `globals.css` в `main.tsx`

### 3. Zod-схемы

Создать `src/schemas/` со всеми схемами из `01-data-schema.md`:

**src/schemas/entity.ts:**
- `EntityTypeSchema` — enum всех типов
- `TaskFieldsSchema`, `ProjectFieldsSchema`, `RoutineFieldsSchema`, `EventFieldsSchema`, `ContactFieldsSchema`, `GoalFieldsSchema`, `NoteFieldsSchema`, `MetricFieldsSchema`
- `EntitySchema` — базовая схема с discriminated union по `type` → соответствующие `fields`
- `EntitiesFileSchema` — `{ version, entities: Entity[] }`

**src/schemas/schedule.ts:**
- `BlockStatusSchema` — enum
- `BlockSchema` — схема блока
- `WeekFileSchema` — `{ version, week, start_date, template_applied, blocks }`

**src/schemas/template.ts:**
- `TemplateBlockSchema`
- `TemplateFileSchema`

**src/schemas/config.ts:**
- `AreaSchema`
- `ConfigFileSchema`

**src/schemas/command.ts:**
- `CommandActionSchema` — union всех actions
- `CommandFileSchema`

**src/schemas/index.ts:**
- Реэкспорт всех схем
- `export type Entity = z.infer<typeof EntitySchema>` — и так для всех типов

### 4. Tauri-команды (Rust)

В `src-tauri/src/` реализовать команды из `02-architecture.md`:

- `read_file(path: String) -> Result<String, String>`
- `write_file(path: String, content: String) -> Result<(), String>` — с атомарной записью (temp + rename)
- `list_files(dir: String) -> Result<Vec<String>, String>`
- `ensure_dir(path: String) -> Result<(), String>`
- `move_file(from: String, to: String) -> Result<(), String>`
- `delete_file(path: String) -> Result<(), String>`
- `get_data_dir() -> Result<String, String>` — возвращает путь к `data/` рядом с проектом

Зарегистрировать все команды в `main.rs` через `tauri::Builder::default().invoke_handler(...)`.

### 5. Сервис file-io

**src/services/file-io.ts:**

```typescript
import { invoke } from '@tauri-apps/api/core';

export async function readJsonFile<T>(path: string, schema: z.ZodSchema<T>): Promise<T> {
  const content = await invoke<string>('read_file', { path });
  const data = JSON.parse(content);
  return schema.parse(data);  // валидация через Zod
}

export async function writeJsonFile(path: string, data: unknown): Promise<void> {
  const content = JSON.stringify(data, null, 2);
  await invoke('write_file', { path, content });
}

export async function ensureDataDir(): Promise<string> {
  const dataDir = await invoke<string>('get_data_dir');
  await invoke('ensure_dir', { path: dataDir });
  await invoke('ensure_dir', { path: `${dataDir}/schedule` });
  await invoke('ensure_dir', { path: `${dataDir}/templates` });
  await invoke('ensure_dir', { path: `${dataDir}/dashboards` });
  return dataDir;
}
```

### 6. Zustand stores (заготовки)

Создать пустые stores с интерфейсами из `02-architecture.md`:

**src/store/config.ts** — загрузка/сохранение config.json, при отсутствии файла создаёт дефолтный.

**src/store/entities.ts** — загрузка/сохранение entities.json, CRUD-методы, фильтрация по типу и тегам.

**src/store/schedule.ts** — загрузка/сохранение недельного файла, CRUD блоков, навигация по неделям.

**src/store/ui.ts** — текущая страница (planner/entities/dashboards), выбранный элемент, состояние модалок.

Каждый store должен реально работать: загружать данные из файлов при инициализации, сохранять при мутациях.

### 7. Инициализация данных

При запуске приложения (`App.tsx` → `useEffect`):

1. `ensureDataDir()` — создать структуру папок
2. Попробовать загрузить `config.json`. Если не существует — создать дефолтный (из `01-data-schema.md`, раздел 4)
3. Загрузить `entities.json`. Если не существует — создать пустой
4. Загрузить расписание текущей недели. Если не существует — создать пустую неделю

### 8. Стили, шрифты и иконка приложения

**Подключение шрифтов (Outfit + JetBrains Mono):**

В `index.html` внутри `<head>` добавить:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500&family=Outfit:wght@300;400;500;600&display=swap" rel="stylesheet">
```

Удалить атрибут `class="dark"` на `<html>` — дизайн и так тёмный,
флага не нужно.

**CSS-стилизация (из мока 1-в-1):**

В `src/styles/globals.css`:
1. Оставить первой строкой `@import "tailwindcss";` (для будущего).
2. Удалить всё, что было после (старый `@theme` со slate-цветами,
   ручные правила `body/html`).
3. Скопировать из `design/tuzov-os-design-mock.html`:
   - Полный блок `:root { ... }` с токенами (поверхности, текст,
     акцент, категории, opacity, радиусы, font-size, motion,
     elevation, layout).
   - Глобальные правила: `* { margin:0; padding:0; box-sizing:
     border-box }`, `body { ... }`, `::selection`,
     `button:focus-visible, [tabindex]:focus-visible`.
   - Селекторы Shell-уровня: `.app`, `.sidebar`, `.si`, `.s-logo`,
     `.s-top`, `.s-bot`, `.main`, `.page`, `.hdr`, `.hdr-title`,
     `.hdr-spacer`, `.hdr-btn`, `.sbar`, `.hints` и т.п.
   - В фазе 1 **не переносим** стили планировщика и сущностей —
     они пойдут в фазах 2–4 по мере появления компонентов.

`.icn`/иконочные стили и специфика страниц — только под то, что уже
отрендерено (заглушки).

**Favicon и иконка Tauri:**

В `design/favicon-assets/` уже есть готовые ассеты.

1. Скопировать `design/favicon-assets/tauri/icons/*.png` и
   `icon.icns` в `src-tauri/icons/`:
   - `32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.png`,
     `icon.icns`
2. Проверить `src-tauri/tauri.conf.json` → секция `bundle.icon`
   указывает на эти файлы (по умолчанию шаблон уже так и делает).
3. В `index.html` добавить: `<link rel="icon" type="image/svg+xml"
   href="/favicon.svg">` и положить `design/favicon.svg` в `public/`
   (или корень проекта, откуда Vite раздаёт статику).

Динамическая иконка (меняется в зависимости от состояния) —
отложена, см. `docs/tasks/dynamic-favicon.md`.

### 9. UI Shell

Структура грида и классов — **из мока**, см. `design/tuzov-os-design-
mock.html` (селекторы `.app`, `.sidebar`, `.main`, `.page`, `.hdr`,
`.sbar`).

**src/App.tsx:**
- Загрузка данных при старте (с loading spinner)
- Переключение страниц через `ui.currentPage` (Zustand), без react-
  router

**src/components/layout/Shell.tsx:**
- Корневой `.app` — CSS grid: `grid-template-columns: 52px 1fr`,
  `grid-template-rows: 1fr 26px`
- Рендерит `<Sidebar/>`, `<main class="main">...</main>` и
  `<StatusBar/>`
- Внутри `main` — `<Header/>` + активная страница

**src/components/layout/Sidebar.tsx:**
- Ширина `--sidebar-w: 52px`, background `--bg-surface`
- Сверху — `.s-logo` (28×28, монограмма «OS» в рамке `--border`)
- `.s-top` — навигация: Planner / Entities / Dashboards (иконки из
  `lucide-react`: Calendar, Database, BarChart3)
- `.s-bot` внизу — Settings (Settings-иконка), в фазе 1 неактивна
- Активная иконка — золотая с `::before` золотым индикатором слева
- Кастомные div-иконки `.si` делаем фокусируемыми через хелпер
  `makeClickable(el)` (`tabIndex=0` + Enter/Space → click)

**src/components/layout/Header.tsx:**
- Высота 48px (`--hdr-height` если вынести, иначе inline)
- Для Planner: `← Неделя 16 · 14–20 апр →` с навигацией + кнопка
  «Сегодня»
- Для Entities: заголовок «Сущности» + поиск + «+ Создать»
- Для Dashboards: заголовок «Дашборды» + «+ Добавить»
- В фазе 1 реализуем только скелет с правильной разметкой (без
  логики навигации недель — она в фазе 2)

**src/components/layout/StatusBar.tsx:**
- Высота 26px, background `--bg-surface`, font `--mono`, `--fs-2xs`
- Слева: `● Сохранено` (с привязкой к `save-status.ts`)
- После разделителя `│`: счётчик сущностей «N сущностей»
- Справа (`.hints`): подсказки `<kbd>1</kbd><kbd>2</kbd><kbd>3</kbd>
  страницы` · `<kbd>N</kbd> блок` · `<kbd>T</kbd> пул` · `drag
  блоки и пул`
- В фазе 6 расширяется: счётчик команд / ошибок + кликабельная
  панель failed

**src/components/shared/** — базовые переиспользуемые компоненты:
- `Modal.tsx` — модальное окно (используется с фазы 2)
- `StatusBadge.tsx` — badge статуса (planned/done/skipped)
- `PriorityPill.tsx` — pill приоритета HIGH/MEDIUM/LOW
- `TagBadge.tsx` — badge тега области (с цветом из config)
- `Toast.tsx` — всплывающее уведомление `.toast.success` с
  border-left + `tIn` анимацией (используется с фазы 2+)
- `makeClickable.ts` — хелпер для фокусируемых div-кнопок

### 10. Страницы-заглушки

- **PlannerPage.tsx** — текст «Планировщик будет здесь» + показать количество блоков в текущей неделе
- **EntitiesPage.tsx** — текст «Сущности» + показать количество сущностей из store
- **DashboardsPage.tsx** — текст «Дашборды» + список из реестра (если есть)

### 11. Seed-скрипт

**scripts/seed.ts** — запускается через `npm run seed`:
- Генерирует `config.json` с 5 областями и **новой палитрой**
  (`work #FF7A3D`, `people #FF5CA8`, `life #B8D84A`, `growth
  #9B6CFF`, `health #30D888`)
- Генерирует `entities.json` с 15–18 тестовыми сущностями разных
  типов (ориентир — сэмплы в `design/tuzov-os-design-mock.html`,
  массив `EN`)
- Генерирует расписание на текущую неделю с ~25 блоками (ориентир
  — массив `blocks` в моке)
- Генерирует дефолтный шаблон рутин (собаки / завтрак / японский)
- Пишет всё напрямую в `data/`

## Дизайн

Все визуальные решения — в `design/tuzov-os-design-spec.md`
(источник правды) и `design/tuzov-os-design-mock.html` (референс-
реализация). В этой фазе реализуем только Shell-слой:

- Тёмная тема, нейтральный серый R=G=B: 6 поверхностей от
  `--bg-deep #131313` до `--bg-active #3F3F3F`
- Текст: 5 токенов (`--text-primary #F2F2F2` ... `--text-inverse
  #131313`)
- Акцент: `--accent #E0B860` (золото) — только для active/selected/
  CTA. В фазе 1 — только для активной иконки sidebar
- Категории: `--work #FF7A3D · --people #FF5CA8 · --life #B8D84A ·
  --growth #9B6CFF · --health #30D888` (используются с фазы 2)
- Шрифты: Outfit (UI) + JetBrains Mono (mono-значения в status bar,
  hints)
- Радиусы, font-size, spacing, motion — шкалы из дизайн-спеки,
  переносятся из мока

Стилизация — голый CSS с CSS-переменными из `:root`. Tailwind
подключён, но не используется; миграция отложена, см. `docs/tasks/
tailwind-migration.md`.

## Критерии готовности

- [ ] `npm run tauri dev` запускает приложение
- [ ] Окно открывается с иконкой из `design/favicon-assets/`
- [ ] Шрифты Outfit и JetBrains Mono загружаются (виден Outfit в
  подписях, JetBrains Mono в «OS» логотипе и status bar)
- [ ] Shell-grid правильный: sidebar 52px слева, status bar 26px
  снизу, main в центре
- [ ] Sidebar: 3 иконки переключают страницы, активная —
  золотая с индикатором слева. Settings — неактивна
- [ ] Header показывает свою панель на каждой из 3 страниц
- [ ] Status bar внизу: `● Сохранено` + счётчик сущностей + hints
- [ ] Горячие клавиши `1/2/3` переключают страницы
- [ ] При первом запуске создаются дефолтные файлы в `data/`
- [ ] `readJsonFile` + Zod валидация работает (кривой JSON → ошибка
  в UI)
- [ ] Seed-скрипт генерирует тестовые данные **с новой палитрой**
  категорий
- [ ] После seed: страницы-заглушки показывают количество данных
- [ ] Запись в файлы работает атомарно (temp + rename)
