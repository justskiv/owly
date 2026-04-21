# Фаза 1: Foundation

> **Цель:** запустить Tauri + React приложение, реализовать слой данных, показать пустой shell с навигацией.
>
> **Результат:** приложение открывается, показывает боковую панель и заглушки страниц. Данные читаются и пишутся в JSON-файлы. Zod-схемы валидируют всё.

## Контекст

Прочитай `00-overview.md`, `01-data-schema.md`, `02-architecture.md` в этой же папке — там полная картина проекта. Эта фаза — фундамент, на котором строятся все остальные.

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
npm install zustand zod lucide-react
npm install -D tailwindcss @tailwindcss/vite
```

Настроить Tailwind:
- Добавить `@tailwindcss/vite` плагин в `vite.config.ts`
- В `src/styles/globals.css`: `@import "tailwindcss";`
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

### 8. UI Shell

**src/App.tsx:**
- Загрузка данных при старте (с loading spinner)
- Роутинг между страницами: Planner, Entities, Dashboards

**src/components/layout/Sidebar.tsx:**
- Три пункта навигации с иконками (lucide-react): Calendar, Database, BarChart3
- Подсветка активного пункта
- Внизу — иконка Settings (шестерёнка) для будущей страницы настроек (в Фазе 1 — неактивна, но место зарезервировано)
- Маленький индикатор статуса: "Сохранено ✓" / "Ошибка". В Фазе 6 расширяется до полноценного status bar с счётчиками команд

**src/components/shared/** — базовые переиспользуемые компоненты:
- `Modal.tsx` — модальное окно (используется в BlockEditor, EntityEditor)
- `StatusBadge.tsx` — badge статуса (planned/done/skipped)
- `PriorityBadge.tsx` — badge приоритета (high/medium/low с цветом)
- `TagBadge.tsx` — badge тега области (с цветом из config)
- `Toast.tsx` — всплывающее уведомление (используется с Фазы 2+)

**src/components/layout/Header.tsx:**
- Для Planner: `← Неделя 16 (13-19 апр) →` с навигацией
- Для Entities: заголовок "Данные" + поиск
- Для Dashboards: заголовок "Дашборды"

**src/components/layout/Shell.tsx:**
- Sidebar слева (ширина 60px, icons only)
- Header сверху
- Main content area

### 9. Страницы-заглушки

- **PlannerPage.tsx** — текст "Планировщик будет здесь" + показать количество блоков в текущей неделе
- **EntitiesPage.tsx** — текст "Сущности" + показать количество сущностей из store
- **DashboardsPage.tsx** — текст "Дашборды" + список из реестра (если есть)

### 10. Seed-скрипт

**scripts/seed.ts** — запускается через `npx tsx scripts/seed.ts`:
- Генерирует `config.json` с 5 областями
- Генерирует `entities.json` с 15 тестовыми сущностями разных типов
- Генерирует расписание на текущую неделю с ~25 блоками
- Генерирует дефолтный шаблон
- Пишет всё напрямую в `data/`

## Дизайн

- Тёмная тема: фон `#0F172A` (slate-900), карточки `#1E293B` (slate-800), текст `#E2E8F0` (slate-200)
- Sidebar: `#020617` (slate-950), иконки slate-400, активная — white
- Акцентный цвет: `#3B82F6` (blue-500)
- Шрифт: системный (`font-sans` в Tailwind — Inter / SF Pro / Segoe)
- Скруглённые углы: `rounded-lg` (8px)
- Без теней (flat design)

## Критерии готовности

- [ ] `npm run tauri dev` запускает приложение
- [ ] Sidebar работает, переключает страницы
- [ ] Header показывает навигацию по неделям (кнопки работают)
- [ ] При первом запуске создаются дефолтные файлы в `data/`
- [ ] `readJsonFile` + Zod валидация работает (кривой JSON → ошибка в UI)
- [ ] Seed-скрипт генерирует тестовые данные
- [ ] После seed: страницы-заглушки показывают количество данных
- [ ] Запись в файлы работает атомарно (temp + rename)
