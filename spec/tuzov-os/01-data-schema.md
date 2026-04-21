# TuzovOS — Схема данных

Все данные хранятся в JSON-файлах в папке `data/`. Этот документ описывает точную структуру каждого файла. Все схемы должны быть реализованы как Zod-схемы в `src/schemas/`.

---

## 1. Сущность (Entity) — базовая единица всего

Все объекты в системе (задачи, проекты, рутины, контакты и т.д.) — это сущности. Они хранятся в одном файле `data/entities.json`.

### Почему один файл
- Для одного пользователя — максимум сотни сущностей, это ~50-100 КБ
- Один файл = одна операция чтения, один Zod.parse, простой поиск
- Если вырастет за 1000 сущностей — можно разбить потом, архитектура не изменится

### Формат entities.json

```json
{
  "version": 1,
  "entities": [
    { ... },
    { ... }
  ]
}
```

### Базовые поля (общие для всех типов)

```typescript
// Каждая сущность обязательно имеет:
{
  "id": string,            // "ent-" + uuid (например "ent-a1b2c3d4")
  "type": EntityType,      // тип сущности (ось 1)
  "title": string,         // название
  "tags": string[],        // области жизни (ось 2): ["work", "growth"]
  "status": Status,        // "active" | "done" | "archived" | "someday"
  "priority": Priority,    // "high" | "medium" | "low" | null
  "deadline": string|null,  // "2026-04-18" (ISO date) или null
  "estimated_minutes": number|null,  // 120 или null
  "created_at": string,    // ISO datetime "2026-04-13T09:00:00"
  "updated_at": string,    // ISO datetime
  "fields": object         // тип-специфичные поля (см. ниже)
}
```

### Типы сущностей (EntityType)

```typescript
type EntityType =
  | "task"       // одноразовое действие
  | "project"    // группа задач с целью
  | "routine"    // повторяющееся действие
  | "event"      // фиксированное во времени событие
  | "contact"    // человек
  | "goal"       // цель (не операционная)
  | "note"       // заметка
  | "metric"     // отслеживаемая метрика
```

### Теги областей (Tags)

Предустановленные (в config.json):
```
work, people, life, growth, health
```

Пользователь может добавлять свои. Теги — просто строки. Сущность может иметь любое количество тегов.

### Тип-специфичные поля (fields)

#### task
```json
{
  "fields": {
    "parent_project_id": "ent-xxx" | null,  // если задача принадлежит проекту
    "checklist": [                           // опциональный чеклист
      { "text": "Записать интро", "done": false },
      { "text": "Добавить субтитры", "done": true }
    ]
  }
}
```

#### project
```json
{
  "fields": {
    "description": "Видео про Garbage Collector в Go",
    "pipeline_stage": "research" | "production" | "editing" | "review" | "publishing" | "done",
    "task_ids": ["ent-aaa", "ent-bbb"]  // ID дочерних задач
  }
}
```

#### routine
```json
{
  "fields": {
    "frequency": "daily" | "weekly" | "custom",
    "days": ["mon", "wed", "fri"],       // для weekly/custom
    "default_duration": 30,              // минуты
    "default_time": "07:00"              // предпочтительное время
  }
}
```

#### event
```json
{
  "fields": {
    "date": "2026-04-15",
    "time": "15:00",
    "duration": 60,                      // минуты
    "location": "Zoom",
    "travel_time": 0                     // минуты на дорогу (в одну сторону)
  }
}
```

#### contact
```json
{
  "fields": {
    "name": "Мама",
    "desired_cadence_days": 7,           // желаемая частота контакта (дни)
    "last_contact": "2026-04-06",        // дата последнего контакта
    "travel_time": 40,                   // минуты на дорогу (в одну сторону)
    "important_dates": [
      { "label": "День рождения", "date": "03-15" }  // MM-DD
    ],
    "notes": "Любит когда звоню, а не пишу"
  }
}
```

#### goal
```json
{
  "fields": {
    "target": "55K подписчиков YouTube",
    "current_value": "33K",
    "target_date": "2026-12-31" | null
  }
}
```

#### note
```json
{
  "fields": {
    "body": "Текст заметки. Может быть многострочным.\nMarkdown поддерживается."
  }
}
```

#### metric
```json
{
  "fields": {
    "unit": "subscribers",
    "current_value": 33000,
    "history": [
      { "date": "2026-03-01", "value": 31500 },
      { "date": "2026-04-01", "value": 33000 }
    ]
  }
}
```

---

## 2. Расписание недели (Schedule)

Каждая неделя — отдельный файл: `data/schedule/2026-w16.json`

### Формат файла недели

```json
{
  "version": 1,
  "week": "2026-w16",
  "start_date": "2026-04-13",           // понедельник
  "template_applied": "default" | null,  // какой шаблон был применён
  "blocks": [
    { ... },
    { ... }
  ]
}
```

### Блок расписания (Block)

```typescript
{
  "id": string,              // "blk-" + uuid
  "title": string,           // "Монтаж GC Deep Dive"
  "date": string,            // "2026-04-14" (ISO date)
  "start": string,           // "09:00" (HH:MM, шаг 30 мин для snap, но хранится точное)
  "duration": number,        // минуты (минимум 15)
  "category": string,        // тег области для цвета: "work", "health" и т.д.
  "source_entity_id": string|null,  // ссылка на сущность из entities.json
  "status": BlockStatus,     // "planned" | "done" | "skipped" | "moved"
  "notes": string            // свободный текст
}
```

### BlockStatus

- `planned` — запланирован, ещё не выполнен
- `done` — выполнен
- `skipped` — пропущен (остаётся в расписании, но визуально отличается)
- `moved` — перенесён (блок создан в другом дне/времени)

### Связь блок ↔ сущность

Через `source_entity_id`. Блок ссылается на сущность, UI и агент резолвят по ID. **Копирования данных между файлами нет.** Если сущность удалена, блок остаётся (orphaned) — UI показывает title блока без ссылки.

### Правила

- Блоки могут пересекаться (overlap) — приложение подсвечивает конфликт, но не запрещает
- `start` snap к 15-минутным границам при drag-and-drop, но в JSON хранится точное значение
- Нет ограничения на количество блоков в дне
- Блоки без `source_entity_id` — допустимы (ручной блок, буфер, отдых)

---

## 3. Шаблон недели (Template)

Файл: `data/templates/default.json`

```json
{
  "version": 1,
  "name": "default",
  "description": "Обычная рабочая неделя",
  "blocks": [
    {
      "day": "mon",           // "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"
      "start": "07:00",
      "duration": 30,
      "title": "Собаки утро",
      "category": "health"
    },
    {
      "day": "mon",
      "start": "07:30",
      "duration": 30,
      "title": "Завтрак",
      "category": "health"
    },
    {
      "day": "mon",
      "start": "08:00",
      "duration": 30,
      "title": "Японский",
      "category": "growth"
    }
  ]
}
```

При создании новой недели: шаблонные блоки копируются в `2026-wXX.json` как обычные блоки с `status: "planned"` и без `source_entity_id` (рутины — самостоятельные блоки).

---

## 4. Конфигурация (Config)

Файл: `data/config.json`

```json
{
  "version": 1,

  "areas": [
    { "id": "work", "label": "Работа", "color": "#3B82F6", "icon": "briefcase" },
    { "id": "people", "label": "Люди", "color": "#EC4899", "icon": "users" },
    { "id": "life", "label": "Быт", "color": "#F59E0B", "icon": "home" },
    { "id": "growth", "label": "Развитие", "color": "#8B5CF6", "icon": "book" },
    { "id": "health", "label": "Здоровье", "color": "#10B981", "icon": "heart" }
  ],

  "scheduling_preferences": {
    "deep_work_hours": { "start": "08:00", "end": "13:00" },
    "no_calls_before": "11:00",
    "min_block_duration": {
      "editing": 120,
      "research": 90,
      "default": 30
    },
    "buffer_after": {
      "podcast_recording": 60
    },
    "hobby_hours": { "start": "19:00", "end": "22:00" },
    "max_consecutive_busy_evenings": 2,
    "meeting_preference": "weekends",
    "include_travel_time": true,
    "week_starts_on": "mon"
  },

  "pipeline_stages": [
    "research", "production", "editing", "review", "publishing", "done"
  ],

  "priorities": {
    "high": { "label": "Высокий", "color": "#EF4444" },
    "medium": { "label": "Средний", "color": "#F59E0B" },
    "low": { "label": "Низкий", "color": "#6B7280" }
  }
}
```

---

## 5. Дашборды

Файлы: `data/dashboards/*.jsx`

Каждый дашборд — самостоятельный React-компонент. Приложение рендерит его динамически. Формат:

```jsx
// data/dashboards/kpi.jsx
export default function KPIDashboard({ entities, schedule, config }) {
  // entities — массив всех сущностей
  // schedule — данные текущей недели
  // config — конфиг приложения
  return (
    <div>
      {/* содержимое дашборда */}
    </div>
  );
}
```

Приложение передаёт в каждый дашборд стандартный набор props. Дашборд рисует что хочет. AI-агент генерирует полный файл целиком.

### Реестр дашбордов

Файл `data/dashboards/_registry.json`:

```json
{
  "dashboards": [
    {
      "id": "kpi",
      "title": "KPI 2026",
      "file": "kpi.jsx",
      "icon": "bar-chart",
      "order": 1
    },
    {
      "id": "monthly-plans",
      "title": "Планы по месяцам",
      "file": "monthly-plans.jsx",
      "icon": "calendar",
      "order": 2
    }
  ]
}
```

---

## 6. Команды (Commands)

Файлы: `commands/pending/*.json`

### Формат команды

```json
{
  "id": "cmd-1713012345-create-block",
  "action": "create_block",
  "timestamp": "2026-04-13T14:25:45",
  "data": {
    "title": "Монтаж GC Deep Dive",
    "date": "2026-04-14",
    "start": "09:00",
    "duration": 120,
    "category": "work",
    "source_entity_id": "ent-gc-video"
  }
}
```

### Доступные действия (actions)

#### Расписание
- `create_block` — создать блок в расписании
- `update_block` — обновить поля блока (передаются только изменённые поля + `block_id`)
- `move_block` — переместить блок (`block_id`, `new_date`, `new_start`)
- `resize_block` — изменить длительность (`block_id`, `new_duration`)
- `delete_block` — удалить блок (`block_id`)
- `set_block_status` — изменить статус (`block_id`, `status`)

#### Сущности
- `create_entity` — создать сущность (все поля)
- `update_entity` — обновить поля сущности (`entity_id` + изменённые поля)
- `delete_entity` — удалить сущность (`entity_id`)

#### Неделя
- `create_week` — создать новую неделю (`week`: "2026-w17", `apply_template`: "default"|null)
- `apply_template` — применить шаблон к существующей неделе (`week`, `template_name`)

#### Пакетные
- `batch` — массив команд, выполняются атомарно (`commands`: [...])

### Жизненный цикл команды

1. Агент создаёт файл в `commands/pending/`
2. Приложение (file watcher) замечает новый файл
3. Читает → валидирует через Zod → исполняет
4. Успех → перемещает в `commands/done/`
5. Ошибка → перемещает в `commands/failed/`, добавляет поле `error`:

```json
{
  "id": "cmd-...",
  "action": "...",
  "data": { ... },
  "error": "Block blk-xxx not found in week 2026-w16",
  "failed_at": "2026-04-13T14:25:50"
}
```

---

## 7. Сэмпл данных

При первом запуске приложения (если `data/` пуста) создаются:

- `data/config.json` — дефолтный конфиг с 5 областями
- `data/entities.json` — пустой (`{ "version": 1, "entities": [] }`)
- `data/templates/default.json` — пустой шаблон
- `data/schedule/` — пустая папка
- `data/dashboards/_registry.json` — пустой реестр
- `commands/pending/`, `commands/done/`, `commands/failed/` — пустые папки

Для разработки и демо: отдельный скрипт `scripts/seed.ts` генерирует тестовые данные (10-15 сущностей разных типов, расписание на текущую неделю с 20+ блоками, пару дашбордов).
