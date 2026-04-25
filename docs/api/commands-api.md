# TuzovOS — Commands API

Документ описывает file-based API мутаций данных приложения.
Любой внешний клиент (скрипт, AI-агент, ручная правка) может
читать `data/` напрямую, а **писать — только** через очередь
команд `commands/pending/`. Приложение через file-watcher
подхватывает новые `.json`, валидирует через Zod, исполняет
и перемещает в `commands/done/` либо `commands/failed/`.

---

## 1. Где живут данные

```
data/
├── entities.json                 — все сущности
├── schedule/2026-wNN.json        — расписание недели (ISO week)
├── config.json                   — конфиг + scheduling_preferences
├── templates/default.json        — шаблон рутин
└── dashboards/
    ├── _registry.json
    └── *.jsx
commands/
├── pending/                      — входящие команды
├── done/                         — выполненные
└── failed/                       — с ошибками
```

Источник правды по схемам: `src/schemas/*.ts` (Zod).

---

## 2. Чтение

Файлы `data/*.json` читаются напрямую с диска. Никакого API не
требуется.

- `data/entities.json` — `EntitiesFileSchema`
- `data/schedule/<weekId>.json` — `WeekFileSchema`
- `data/config.json` — `ConfigFileSchema`
- `data/templates/default.json` — `TemplateFileSchema`
- `data/dashboards/_registry.json` — `DashboardRegistrySchema`

**Важно:** не записывать в `data/` напрямую. Приложение
кэширует загруженные файлы и может перезаписать чужую правку
очередной операцией. Все мутации идут через очередь команд.

---

## 3. Запись через очередь команд

### Имя файла

```
commands/pending/<sortable-timestamp>-<action>.json
```

Соглашение: `<unix-timestamp>-<action-slug>` или
`<ISO-datetime-без-двоеточий>-<action-slug>`. Формат самого имени
не валидируется — но порядок выполнения (особенно при boot-drain)
определяется лексикографической сортировкой имени.

Пример: `commands/pending/1713012345-create-block.json`.

### Атомарная запись

Файл нужно создавать через **temp + rename**:
1. Создать sibling-файл `<имя>.tmp.<unique>` в `commands/pending/`.
2. fsync содержимое.
3. rename на финальное имя `<имя>.json`.

Watcher игнорирует `.tmp.*` и не-`.json` файлы. Если файл записан
не атомарно, watcher может прочитать половинный JSON → команда
уйдёт в `failed/` с `Read/parse failed: ...`. Это безопасно, но
зашумляет лог.

### Жизненный цикл

```
client: pending/cmd-X.json
  ↓ watcher emits "command-received"
  ↓ app reads → CommandSchema.parse → executeCommand
  ↓ success → done/cmd-X.json   (toast «✓ ...», counter ++)
  ↓ failure → failed/cmd-X.json (поля error, failed_at)
```

При старте приложения все накопленные файлы в `pending/`
обрабатываются по порядку (boot drain).

---

## 4. Формат команды

```json
{
  "id": "cmd-<любой стабильный id>",
  "action": "create_block",
  "timestamp": "2026-04-13T14:25:45",
  "data": { ... }
}
```

Поля `id` и `timestamp` обязательны и валидируются. `data`
зависит от `action` — см. ниже.

---

## 5. Доступные actions

### Расписание

| action | data |
| --- | --- |
| `create_block` | `{ title, date, start, duration, category, source_entity_id, notes? }` |
| `update_block` | `{ block_id, ...partial Block без id }` |
| `move_block` | `{ block_id, new_date, new_start }` |
| `resize_block` | `{ block_id, new_duration }` |
| `delete_block` | `{ block_id }` (идемпотентна — отсутствующий блок ≡ успех) |
| `set_block_status` | `{ block_id, status: "planned"\|"done"\|"skipped"\|"moved" }` |

`date`/`new_date` — `YYYY-MM-DD`. `start`/`new_start` — `HH:MM`.
`duration`/`new_duration` — int ≥ 15 (мин).
`category` — id области из `config.areas` (`work`, `health`, …).
`source_entity_id` — `ent-<uuid>` или `null`.

### Сущности

| action | data |
| --- | --- |
| `create_entity` | полный `Entity` — см. ниже |
| `update_entity` | `{ entity_id, ...changed fields }` |
| `delete_entity` | `{ entity_id }` |

`create_entity` принимает полную сущность включая `id`,
`created_at`, `updated_at`. Префикс id — `ent-`. Timestamps
формата `YYYY-MM-DDTHH:MM:SS`.

`update_entity` — патч валидируется после применения через
`EntitySchema.parse(merged)`. Если type-discriminator (`type`)
меняется — поведение неопределено, не делать так. Менять только
поля внутри одного типа.

### Неделя

| action | data |
| --- | --- |
| `create_week` | `{ week: "2026-wNN", apply_template: "default"\|null }` |
| `apply_template` | _(не реализован в MVP — использовать `create_week`)_ |

`create_week` упадёт, если файл недели уже существует. Применение
шаблона к существующей неделе через `apply_template` пока не
поддержано.

### Пакетные

| action | data |
| --- | --- |
| `batch` | `{ commands: [<sub-command>, ...] }` |

- Sub-command — любой action, кроме `batch` (вложенность не
  поддерживается).
- Каждый sub-command имеет свои `id`/`timestamp`/`action`/`data`.
- Выполняются **sequentially**.
- На midbatch-ошибке: предыдущие НЕ откатываются. В `failed/`
  пишется весь batch с полем
  `partial: { succeeded: N, failed_at_index: K }`.
- Поэтому: команды должны быть идемпотентны и допускать частичную
  применимость.

---

## 6. Примеры

### Создать блок на текущей неделе

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
    "source_entity_id": "ent-a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  }
}
```

### Раскидать неделю одним batch

```json
{
  "id": "cmd-1713012400-batch",
  "action": "batch",
  "timestamp": "2026-04-13T14:26:40",
  "data": {
    "commands": [
      {
        "id": "cmd-1713012400-1",
        "action": "create_block",
        "timestamp": "2026-04-13T14:26:40",
        "data": {
          "title": "Утренние собаки",
          "date": "2026-04-14",
          "start": "07:00",
          "duration": 30,
          "category": "health",
          "source_entity_id": null
        }
      },
      {
        "id": "cmd-1713012400-2",
        "action": "create_block",
        "timestamp": "2026-04-13T14:26:40",
        "data": {
          "title": "Японский",
          "date": "2026-04-14",
          "start": "08:00",
          "duration": 30,
          "category": "growth",
          "source_entity_id": "ent-japanese-routine-id"
        }
      }
    ]
  }
}
```

### Переместить блок между неделями

```json
{
  "id": "cmd-1713012500-move-block",
  "action": "move_block",
  "timestamp": "2026-04-13T14:28:20",
  "data": {
    "block_id": "blk-7c5b1e6f-...",
    "new_date": "2026-04-21",
    "new_start": "10:00"
  }
}
```

Приложение само определяет исходную неделю по `block_id`
(сканирует `data/schedule/*.json`). Целевая неделя выводится из
`new_date` (ISO week от даты).

### Создать новую неделю с шаблоном

```json
{
  "id": "cmd-1713015000-create-week",
  "action": "create_week",
  "timestamp": "2026-04-13T15:10:00",
  "data": {
    "week": "2026-w17",
    "apply_template": "default"
  }
}
```

### Создать сущность (полный Entity)

```json
{
  "id": "cmd-1713015100-create-entity",
  "action": "create_entity",
  "timestamp": "2026-04-13T15:11:40",
  "data": {
    "id": "ent-7c5b1e6f-1234-4abc-9def-0123456789ab",
    "type": "task",
    "title": "Записать интро GC",
    "tags": ["work"],
    "status": "active",
    "priority": "high",
    "deadline": "2026-04-18",
    "estimated_minutes": 60,
    "description": "",
    "created_at": "2026-04-13T15:11:40",
    "updated_at": "2026-04-13T15:11:40",
    "fields": {
      "parent_project_id": "ent-gc-video-id",
      "checklist": []
    }
  }
}
```

### Обновить отдельные поля сущности

```json
{
  "id": "cmd-1713015200-update-entity",
  "action": "update_entity",
  "timestamp": "2026-04-13T15:13:20",
  "data": {
    "entity_id": "ent-gc-video-id",
    "fields": { "pipeline_stage": "editing" }
  }
}
```

`patch` — глубокий merge только верхнего уровня. Если меняется
вложенное поле в `fields`, передавать **весь** новый `fields`
объект, не только изменённый ключ.

### Создать дашборд

Не через команды — напрямую файлами:
1. Положить `.jsx` в `data/dashboards/your-dashboard.jsx`.
2. Добавить запись в `data/dashboards/_registry.json`:
   `{ "id": "your-dashboard", "title": "...", "file": "your-dashboard.jsx",
   "icon": "📊", "order": N, "description": "..." }`.
3. Hot reload подхватит автоматически (notify-watcher на
   `data/dashboards/`).

Правила оформления `.jsx`: см. [dashboard-authoring.md](./dashboard-authoring.md).

---

## 7. Scheduling preferences

Перед автоматическим планированием стоит читать
`data/config.json` → `scheduling_preferences`:

```jsonc
{
  "deep_work_hours": { "start": "08:00", "end": "13:00" },
  "no_calls_before": "11:00",
  "min_block_duration": { "editing": 120, "research": 90, "default": 30 },
  "buffer_after": { "podcast_recording": 60 },
  "hobby_hours": { "start": "19:00", "end": "22:00" },
  "max_consecutive_busy_evenings": 2,
  "meeting_preference": "weekdays|weekends|any",
  "include_travel_time": true,
  "week_starts_on": "mon|sun"
}
```

Пользователь редактирует preferences в **Settings → AI**. После
сохранения файл `config.json` уже обновлён — клиент сразу
получает свежие значения при следующем чтении.

---

## 8. ID-форматы

| Тип | Формат | Пример |
| --- | --- | --- |
| Сущность | `ent-<uuid v4>` | `ent-a1b2c3d4-e5f6-7890-abcd-ef1234567890` |
| Блок | `blk-<uuid v4>` | `blk-7c5b1e6f-1234-4abc-9def-0123456789ab` |
| Команда | `cmd-<любой стабильный id>` | `cmd-1713012345-create-block` |

UUID v4 — 36 символов, тире-разделённый (стандартный формат).
Использовать `crypto.randomUUID()` или эквивалент.

---

## 9. Антипаттерны

- ❌ Запись в `data/` напрямую — попадёт под перезапись или
  устаревание кэша.
- ❌ Опускать `id` или `timestamp` в команде — Zod-валидация
  откажет, файл уйдёт в `failed/`.
- ❌ `create_entity` без полного Entity — обязательны `id`,
  `created_at`, `updated_at`, `fields`, `tags`, `status`,
  `priority`, `deadline`, `estimated_minutes`, `description`.
- ❌ `update_entity` со сменой `type` — discriminated union; это
  не обновление, а пересоздание (через delete + create).
- ❌ Команды без атомарной записи — половинный JSON попадёт в
  `failed/`.
- ❌ Вложенный `batch` внутри `batch` — дискриминатор не
  допустит.
- ❌ Полагаться на возвращаемое значение — команды
  fire-and-forget; для верификации читать `data/` или
  `commands/done/`.
- ❌ `create_block` для несуществующей недели — сначала
  `create_week`. Без этого блок упадёт в `failed/` с
  `Week ... does not exist`.

---

## 10. Отладка

- **Успех:** файл уехал в `commands/done/`, в UI:
  - toast «✓ <action>»
  - счётчик `📥 N выполнено` в status bar.
- **Ошибка:** файл уехал в `commands/failed/<имя>.json` с
  полями:
  - `error: string` — человекочитаемое описание;
  - `failed_at: ISO datetime`;
  - для batch — `partial: { succeeded, failed_at_index }`.
  - В UI: toast «✗ ...», счётчик `⚠ N ошибок` (кликабельный →
    панель с retry/dismiss).
- **Retry:** через UI (кнопка в панели ошибок) или вручную —
  переименование файла из `failed/` в `pending/`. Watcher
  подхватит.
- **Логи Rust-watcher:** stderr процесса (`npm run tauri dev`).

---

## 11. Версионирование

Файлы данных (`entities.json`, `_registry.json`, `config.json`)
содержат поле `version: 1`. Сейчас одна версия — миграции на
будущие версии будут отдельной процедурой; пока менять не нужно.

---

## 12. Ограничения MVP

- `apply_template` (для существующей недели) — не реализован;
  использовать `create_week` с `apply_template`.
- `move_block` между неделями: целевая неделя должна существовать
  (или быть создана отдельной командой раньше).
- Поиск блока по `block_id` сканирует все `data/schedule/*.json`.
  Для типичной истории (несколько десятков недель) это <50 мс,
  но при гигантской истории команда может медлить — батчи
  предпочтительнее.
- Sandbox для команд НЕ применяется. Trust model: данные
  пишутся доверенным клиентом, приложение — UI поверх. Любая
  команда применяется к файлам напрямую.
