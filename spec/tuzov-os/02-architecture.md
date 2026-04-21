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
│   │   ├── week-manager.ts       # создание недели, применение шаблона, переход
│   │   ├── time-utils.ts         # расчёт overlap, баланс дня, snap to grid
│   │   └── command-processor.ts  # обработка команд из очереди
│   ├── components/               # React-компоненты
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx       # навигация: Planner, Entities, Dashboards
│   │   │   ├── Header.tsx        # заголовок + навигация по неделям
│   │   │   └── Shell.tsx         # общая обёртка
│   │   ├── planner/
│   │   │   ├── WeekGrid.tsx      # основная сетка 7×24
│   │   │   ├── DayColumn.tsx     # один день
│   │   │   ├── TimeBlock.tsx     # один блок в расписании
│   │   │   ├── BlockEditor.tsx   # форма создания/редактирования блока
│   │   │   ├── TaskPool.tsx      # боковая панель с пулом задач
│   │   │   ├── TaskPoolItem.tsx  # одна задача в пуле
│   │   │   ├── DayBalance.tsx    # баланс дня по категориям
│   │   │   └── WeekSummary.tsx   # итоги недели
│   │   ├── entities/
│   │   │   ├── EntityList.tsx    # список сущностей с фильтрами
│   │   │   ├── EntityCard.tsx    # карточка сущности
│   │   │   ├── EntityEditor.tsx  # форма создания/редактирования
│   │   │   └── TagFilter.tsx     # фильтр по тегам/областям
│   │   ├── dashboards/
│   │   │   ├── DashboardHost.tsx # рендерер дашборд-компонентов
│   │   │   └── DashboardNav.tsx  # навигация между дашбордами
│   │   └── shared/
│   │       ├── StatusBadge.tsx
│   │       ├── PriorityBadge.tsx
│   │       ├── TagBadge.tsx
│   │       └── Modal.tsx
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

```
┌──────────────────────────────────────────────────────┐
│  Header: [← Неделя 16] [Сегодня] [Неделя 18 →]     │
├────────┬─────────────────────────────────────────────┤
│        │                                             │
│  Side  │  Main Content Area                          │
│  bar   │                                             │
│        │  (WeekGrid / EntityList / Dashboard)        │
│ ☰ Plan │                                             │
│ ☰ Data │                                             │
│ ☰ Dash │                                             │
│        │                                             │
│        │                                             │
│        │                                             │
├────────┴─────────────────────────────────────────────┤
│  Status bar: Сохранено ✓ | 3 команды в очереди       │
└──────────────────────────────────────────────────────┘
```

### Навигация (Sidebar)

- **Planner** — недельная сетка (основной экран)
- **Entities** — список всех сущностей с фильтрами по типу и тегам
- **Dashboards** — список дашбордов из реестра, клик → рендерит выбранный

### Тёмная тема

По умолчанию — тёмная тема. Светлая — потом если нужна. Tailwind dark mode utilities.

### Адаптивность

Не нужна. Приложение десктопное, минимальная ширина 1200px.

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
