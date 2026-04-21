# TuzovOS — Архитектура

## Структура проекта

```
tuzov-os/
├── src/                          # React frontend
│   ├── main.tsx                  # точка входа
│   ├── App.tsx                   # корневой компонент с роутингом
│   ├── schemas/                  # Zod-схемы (источник правды для типов)
│   │   ├── entity.ts             # EntitySchema, все type-specific поля
│   │   ├── schedule.ts           # WeekSchema, BlockSchema
│   │   ├── template.ts           # TemplateSchema
│   │   ├── config.ts             # ConfigSchema
│   │   ├── command.ts            # CommandSchema (все actions)
│   │   └── index.ts              # реэкспорт + выведенные TypeScript-типы
│   ├── store/                    # Zustand stores
│   │   ├── entities.ts           # CRUD сущностей
│   │   ├── schedule.ts           # текущая неделя, блоки
│   │   ├── config.ts             # конфиг приложения
│   │   ├── ui.ts                 # состояние UI (открытые панели, выбранные элементы)
│   │   └── dashboards.ts         # реестр дашбордов
│   ├── commands/                 # Tauri invoke обёртки
│   │   ├── files.ts              # readFile, writeFile, watchDir, listFiles
│   │   └── system.ts             # getAppDataDir, showDialog и т.п.
│   ├── services/                 # бизнес-логика
│   │   ├── file-io.ts            # чтение/запись данных через Tauri invoke + Zod
│   │   ├── defaults.ts           # дефолтные значения config/entities при первом запуске
│   │   ├── save-status.ts        # статус сохранения для status bar
│   │   ├── time-utils.ts         # расчёт overlap, баланс дня, snap to grid
│   │   ├── week-manager.ts       # создание недели, применение шаблона (фаза 4)
│   │   ├── routine-stats.ts      # streak / rate / week_done / heatmap (фаза 4)
│   │   ├── metric-stats.ts       # change / change_pct / avg_growth / trend (фаза 4)
│   │   ├── contact-stats.ts     # overdue_days / next_in_days (фаза 4)
│   │   └── command-processor.ts  # обработка команд из очереди (фаза 6)
│   ├── components/               # React-компоненты
│   │   ├── layout/
│   │   │   ├── Shell.tsx         # корневой grid: sidebar + main + statusbar
│   │   │   ├── Sidebar.tsx       # 52px, иконки Planner/Entities/Dashboards + Settings
│   │   │   ├── Header.tsx        # 48px, навигация по неделям + кнопки
│   │   │   └── StatusBar.tsx     # 26px снизу — статус сохранения, счётчики, hints
│   │   ├── planner/
│   │   │   ├── WeekGrid.tsx      # основная сетка 7 дней × 17 часов (06–23)
│   │   │   ├── DayHeader.tsx     # день + число + balance bar
│   │   │   ├── WeekSummary.tsx   # stacked bar + часы по категориям
│   │   │   ├── DayColumn.tsx     # колонка дня с ячейками .gr
│   │   │   ├── TimeBlock.tsx     # блок расписания (.tb)
│   │   │   ├── NowLine.tsx       # золотая линия текущего времени
│   │   │   ├── InlineCreate.tsx  # инлайн-инпут при клике на пустую ячейку
│   │   │   ├── BlockEditor.tsx   # модалка редактирования (400px, backdrop-blur)
│   │   │   ├── BlockContextMenu.tsx  # ctx-меню + кружки категорий
│   │   │   ├── TaskPool.tsx      # боковая панель 264px
│   │   │   └── TaskPoolItem.tsx  # карточка задачи в пуле
│   │   ├── entities/
│   │   │   ├── EntityList.tsx    # колонка списка 380px (erow)
│   │   │   ├── EntityFilters.tsx # колонка фильтров 180px (тип/область/статус)
│   │   │   ├── EntityDetail.tsx  # flex-колонка detail-панели (max-width 480px)
│   │   │   ├── EntityEditor.tsx  # форма создания/редактирования
│   │   │   └── detail/           # виджеты detail-панели по типам
│   │   │       ├── TaskDetail.tsx
│   │   │       ├── ProjectDetail.tsx  # pipeline визуализация + чеклист глав
│   │   │       ├── RoutineDetail.tsx  # stat-cards + streak-неделя + heatmap
│   │   │       ├── ContactDetail.tsx  # status-widget + this-week + topics + history + dates
│   │   │       ├── GoalDetail.tsx     # goal-block + stat-footer + linked metrics + sparkline
│   │   │       ├── MetricDetail.tsx   # 36px value + bar-chart + stat-footer
│   │   │       ├── NoteDetail.tsx     # mini-MD рендерер с --note-accent
│   │   │       └── EventDetail.tsx    # простая форма (дата/время/место)
│   │   ├── dashboards/
│   │   │   ├── DashboardHost.tsx # рендерер дашборд-компонентов (sucrase)
│   │   │   ├── DashboardGrid.tsx # grid карточек 200×130px
│   │   │   └── DashboardNav.tsx  # навигация между дашбордами
│   │   └── shared/
│   │       ├── StatusBadge.tsx
│   │       ├── PriorityPill.tsx  # HIGH/MEDIUM/LOW pill (не бейдж)
│   │       ├── TagBadge.tsx
│   │       ├── Modal.tsx
│   │       ├── Toast.tsx         # анимация tIn, success/error
│   │       └── makeClickable.ts  # helper: tabIndex + Enter/Space → click
│   └── styles/
│       └── globals.css           # Tailwind base + кастомные утилиты
│
├── src-tauri/                    # Rust backend (минимальный)
│   ├── src/
│   │   ├── main.rs               # точка входа Tauri
│   │   ├── commands/
│   │   │   ├── mod.rs
│   │   │   ├── files.rs          # read_file, write_file, list_files, watch_dir
│   │   │   └── system.rs         # get_data_dir, atomic_write
│   │   └── watcher.rs            # file watcher для commands/pending/
│   └── Cargo.toml
│
├── data/                         # данные пользователя (в .gitignore)
│   ├── config.json
│   ├── entities.json
│   ├── schedule/
│   ├── templates/
│   └── dashboards/
│
├── commands/                     # очередь команд от агента
│   ├── pending/
│   ├── done/
│   └── failed/
│
├── scripts/
│   └── seed.ts                   # генератор тестовых данных
│
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── vite.config.ts
└── spec/                         # спецификация (этот каталог)
```

---

## Tauri: Rust-бэкенд

Rust-код минимальный. Его единственная задача — дать фронтенду доступ к файловой системе и обеспечить атомарные записи.

### Команды (invoke)

```rust
// files.rs

#[tauri::command]
fn read_file(path: String) -> Result<String, String>
// Читает файл, возвращает содержимое как строку.
// Фронтенд парсит JSON и валидирует через Zod сам.

#[tauri::command]
fn write_file(path: String, content: String) -> Result<(), String>
// Атомарная запись: пишет во временный файл, потом rename.
// Гарантирует что файл не будет повреждён при крэше.

#[tauri::command]
fn list_files(dir: String) -> Result<Vec<String>, String>
// Возвращает список файлов в директории.

#[tauri::command]
fn ensure_dir(path: String) -> Result<(), String>
// Создаёт директорию если не существует (recursive).

#[tauri::command]
fn move_file(from: String, to: String) -> Result<(), String>
// Перемещает файл (для обработки команд pending → done/failed).

#[tauri::command]
fn delete_file(path: String) -> Result<(), String>
// Удаляет файл.

#[tauri::command]
fn get_data_dir() -> Result<String, String>
// Возвращает путь к папке data/ (рядом с бинарником или configurable).
```

### File Watcher

```rust
// watcher.rs
// При старте приложения запускает наблюдение за commands/pending/
// При появлении нового .json файла — отправляет событие на фронтенд:
// tauri::Event("command-received", { path: "commands/pending/cmd-xxx.json" })
// Фронтенд получает событие, читает файл, обрабатывает.
```

### Атомарная запись (важно!)

Все операции записи в JSON-файлы идут через `write_file`, который реализует паттерн:

```
1. Записать содержимое в data/schedule/2026-w16.json.tmp
2. fsync() — убедиться что данные на диске
3. rename("2026-w16.json.tmp", "2026-w16.json") — атомарная замена
```

Это защищает от повреждения файла при крэше приложения или OOM.

---

## Frontend: State Management

### Zustand stores

Каждый store отвечает за свой срез данных и умеет загружать/сохранять из файлов.

```typescript
// store/schedule.ts
interface ScheduleStore {
  // Состояние
  currentWeek: string;              // "2026-w16"
  blocks: Block[];                  // блоки текущей недели
  loading: boolean;
  error: string | null;

  // Действия
  loadWeek: (week: string) => Promise<void>;
  saveWeek: () => Promise<void>;
  addBlock: (block: Omit<Block, 'id'>) => void;
  updateBlock: (id: string, updates: Partial<Block>) => void;
  moveBlock: (id: string, date: string, start: string) => void;
  resizeBlock: (id: string, duration: number) => void;
  deleteBlock: (id: string) => void;
  setBlockStatus: (id: string, status: BlockStatus) => void;

  // Навигация
  goToNextWeek: () => void;
  goToPrevWeek: () => void;
  goToCurrentWeek: () => void;
}
```

```typescript
// store/entities.ts
interface EntityStore {
  entities: Entity[];
  loading: boolean;

  loadEntities: () => Promise<void>;
  saveEntities: () => Promise<void>;
  addEntity: (entity: Omit<Entity, 'id' | 'created_at' | 'updated_at'>) => void;
  updateEntity: (id: string, updates: Partial<Entity>) => void;
  deleteEntity: (id: string) => void;

  // Фильтрация (не мутирует, возвращает отфильтрованный список)
  getByType: (type: EntityType) => Entity[];
  getByTag: (tag: string) => Entity[];
  getByTags: (tags: string[]) => Entity[];  // сущности с ЛЮБЫМ из тегов
  getUnscheduled: (weekBlocks: Block[]) => Entity[];  // для пула задач
}
```

### Поток данных

```
Файл на диске
    ↓ read_file (Tauri invoke)
    ↓ JSON.parse
    ↓ Zod.parse (валидация)
    ↓ Zustand store (состояние в памяти)
    ↓ React-компоненты (рендер)
    ↓ Пользователь drag-and-drop / edit
    ↓ Zustand store (обновление)
    ↓ JSON.stringify
    ↓ write_file (Tauri invoke, атомарно)
Файл на диске
```

### Когда сохранять

- **Немедленно** при: создании/удалении блока, изменении статуса, move/resize
- **С debounce (500ms)** при: редактировании текстовых полей (title, notes)
- **По явному действию** при: создании новой недели, применении шаблона

### Auto-save

Zustand store подписывается на свои изменения и автоматически сохраняет в файл с debounce. Не нужен ручной «Save» — всё автоматически.

---

## UI: Общая структура

Shell — CSS-grid `grid-template-columns: 52px 1fr` + `grid-template-rows:
1fr 26px`. Sidebar растянут на обе строки (`grid-row: 1/-1`), status bar
всегда видно внизу.

```
┌────┬──────────────────────────────────────────────────┐
│ OS │  Header 48px                                     │
│ 🗓 ├──────────────────────────────────────────────────┤
│ 🗄 │                                                   │
│ 📊 │  Page content (Planner / Entities / Dashboards)  │
│    │                                                   │
│    │                                                   │
│ ⚙  │                                                   │
├────┴──────────────────────────────────────────────────┤
│ Status bar 26px: ● Сохранено · 18 сущностей · hints  │
└───────────────────────────────────────────────────────┘
```

### Sidebar (52px)

- `.s-logo` сверху — монограмма «OS» в квадратной рамке (28×28)
- `.s-top` — навигация: Planner / Entities / Dashboards (по 36×36px)
- `.s-bot` внизу — Settings (шестерёнка, активируется в фазе 4)
- Активная иконка — золотая, с `::before` золотым индикатором слева
- Точное поведение и стили — в дизайн-спеке + моке

### Header (48px)

Зависит от активной страницы:
- **Planner**: `← Неделя 16 · 14–20 апр →` · «Сегодня» · week summary
  stacked bar + часы по категориям · кнопка-toggle пула
- **Entities**: «Сущности» · поиск · «+ Создать»
- **Dashboards**: «Дашборды» · «+ Добавить»

### Status bar (26px, всегда виден)

С фазы 1: `● Сохранено · N сущностей · hints` (подсказки-хоткеи в
`<kbd>`-пилюлях). В фазе 6 расширяется счётчиками команд и ошибок +
кликабельной панелью failed.

### Переключение страниц

Нет React-роутера — `ui.currentPage` в Zustand переключает между
`.page.active` (см. `App.tsx`). Переключение горячими клавишами `1/2/3`.

### Тема

Тёмная, нейтральная (R=G=B серые), единственная. Светлая **не
планируется** — дизайн построен под тёмную палитру.

### Адаптивность

Desktop-only. Минимум ~1400px (с учётом 3-колоночного master-detail
в Entities и пула в Planner). Не проверяется в рантайме.

---

## Дизайн-система и стилизация

**Источник правды:** `design/tuzov-os-design-spec.md` + референс-
реализация `design/tuzov-os-design-mock.html`.

### Токены

Все токены живут в `src/styles/globals.css` в блоке `:root`. Группы:

- **Поверхности:** `--bg-deep / --bg-base / --bg-surface / --bg-
  elevated / --bg-hover / --bg-active` (6 ступеней нейтрального серого
  R=G=B)
- **Текст:** `--text-primary / --text-secondary / --text-tertiary /
  --text-disabled / --text-inverse` (5 токенов)
- **Акцент:** `--accent: #E0B860` (золото, для selected/now/CTA) +
  `--focus-ring: var(--accent)`
- **Категории:** `--work / --people / --life / --growth / --health`
- **Семантика:** `--success / --error`
- **Поверхности-оверлеи:** `--bg-tint-1 / --bg-tint-2` и границы
  `--border / --border-default / --border-strong`
- **Радиусы:** `--radius-xs/sm/md/lg/xl/pill` (2/4/6/8/12/999)
- **Размеры шрифта:** `--fs-2xs/xs/sm/md/lg/xl/2xl` (10/11/12/14/
  16/20/28)
- **Motion:** `--duration-instant/fast/base/slow` (50/100/150/240ms)
  + `--ease-out: cubic-bezier(.22, 1, .36, 1)`
- **Elevation:** `--shadow-sm/md/lg/drag`
- **Layout:** `--sidebar-w: 52px`, `--row-h: 40px`, `--time-w: 44px`,
  `--pool-w: 264px`

Точные значения и правила применения — в дизайн-спеке.

### Шрифты

- **Outfit** (sans, вес 300/400/500/600) — UI, заголовки, подписи
- **JetBrains Mono** (вес 300/400/500) — времена, числа, хоткеи,
  mono-labels

Подключение — через Google Fonts в `index.html` (см. фазу 1).

### CSS-стек

Пока — голый CSS с CSS-переменными, переносится 1-в-1 из мока.
Классы из мока (`.tb`, `.pi`, `.erow`, `.edp-sec`, `.ct-status`,
`.pipe-col` и т.д.) переходят в React как обычные className'ы,
стили живут в `globals.css`.

Миграция на Tailwind v4 отложена и описана отдельно в
`docs/tasks/tailwind-migration.md`. Новый CSS (если потребуется
что-то сверх мока) по возможности писать на Tailwind.

### Spacing

Все `padding/gap/margin` — на 4px-grid: `4 / 8 / 12 / 16 / 24 /
32`. Допустимые исключения (20/28/40/48) — тоже кратны 4 и
задокументированы в дизайн-спеке.

### Focus и клавиатура

- `button:focus-visible, [tabindex]:focus-visible { outline: 2px
  solid var(--focus-ring); outline-offset: 2px; border-radius:
  inherit }` — глобальное правило
- Кастомные div-кнопки (`.tb`, `.pi`, `.erow`, `.fo`, `.si`) делаем
  фокусируемыми через helper `makeClickable(el)`: `el.tabIndex = 0`
  + Enter/Space keydown → `el.click()`

### user-select политика

- Разрешено: заголовки, описания, чеклисты, note-body, числа, инпуты
- Запрещено: кнопки, sidebar, header, бейджи, блоки расписания

Реализуется через `user-select:none` на `body` + явные `user-select:
text` на конкретных селекторах (список в дизайн-спеке).

---

## Дашборды: динамический рендеринг

### Как это работает

1. Файлы `.jsx` лежат в `data/dashboards/`
2. Реестр `_registry.json` описывает какие дашборды есть
3. При выборе дашборда: читаем `.jsx` файл → компилируем через `sucrase` или `@babel/standalone` (в runtime) → рендерим как React-компонент
4. Передаём стандартные props: `{ entities, schedule, config }`

### Почему runtime-компиляция

Потому что дашборды генерируются агентом. Агент создаёт `.jsx` файл → приложение подхватывает без перезапуска. Не нужен build step.

### Безопасность

Дашборды выполняются в том же контексте что и приложение. Для одного пользователя это нормально — он сам (или его агент) создаёт дашборды. Sandbox не нужен.

### Библиотека для рендеринга

`sucrase` — минимальный, быстрый JSX-транспилер. Легче Babel, достаточен для JSX → JS.

```typescript
import { transform } from 'sucrase';

function compileDashboard(jsxCode: string): React.FC {
  const jsCode = transform(jsxCode, {
    transforms: ['jsx', 'imports'],
  }).code;

  const module = { exports: {} };
  const fn = new Function('module', 'exports', 'React', jsCode);
  fn(module, module.exports, React);
  return module.exports.default;
}
```

---

## Обработка ошибок

### Уровни

1. **Файл не найден** — создаём дефолтный (для config, entities, templates)
2. **JSON невалидный** — показываем ошибку с путём к файлу, предлагаем открыть в редакторе
3. **Zod validation failed** — показываем конкретные ошибки полей, данные не загружаем
4. **Tauri invoke failed** — toast-уведомление, retry

### Принцип

Приложение никогда не крашится молча. Любая ошибка данных → видимое уведомление с описанием проблемы и путём к файлу.
