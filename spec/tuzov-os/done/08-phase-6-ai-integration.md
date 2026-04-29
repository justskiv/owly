# Фаза 6: AI Integration

> **Цель:** очередь команд для AI-агента, file watcher, протокол взаимодействия.
>
> **Результат:** AI-агент (Claude Code / Cowork) может создавать команды в `commands/pending/`, приложение подхватывает и исполняет их. Есть документация протокола для агента.
>
> **Предусловие:** Фазы 1-5 завершены, приложение полностью функционально для ручного использования.

## Контекст

Прочитай `01-data-schema.md` (раздел 6 — Commands),
`02-architecture.md` (watcher.rs).

**Референс:**
- `design/tuzov-os-design-spec.md`, разделы «Status bar»,
  «Toast-уведомления»
- `design/tuzov-os-design-mock.html`, селекторы `.sbar`, `.toast-
  c`, `.toast`, `.toast.success`, `@keyframes tIn`

---

## Очередь команд

### Структура папок

```
commands/
├── pending/      # агент кладёт команды сюда
├── done/         # приложение перемещает после выполнения
└── failed/       # приложение перемещает при ошибке
```

Создаются при инициализации приложения (ensure_dir).

### File Watcher (Rust)

В `src-tauri/src/watcher.rs`:

При старте приложения запустить `notify` file watcher на `commands/pending/`:

```rust
// Зависимость: notify = "6"
use notify::{Watcher, RecursiveMode, Event, EventKind};

fn start_command_watcher(app_handle: AppHandle, pending_dir: PathBuf) {
    let mut watcher = notify::recommended_watcher(move |event: Result<Event, _>| {
        if let Ok(event) = event {
            if matches!(event.kind, EventKind::Create(_)) {
                for path in event.paths {
                    if path.extension().map(|e| e == "json").unwrap_or(false) {
                        app_handle.emit("command-received", path.to_string_lossy().to_string()).ok();
                    }
                }
            }
        }
    }).unwrap();

    watcher.watch(&pending_dir, RecursiveMode::NonRecursive).unwrap();

    // Keep watcher alive — store in app state
    std::mem::forget(watcher); // или сохранить в state
}
```

Вызвать `start_command_watcher` в `main.rs` после setup.

### Command Processor (Frontend)

**src/services/command-processor.ts:**

```typescript
import { listen } from '@tauri-apps/api/event';

export function startCommandProcessor(stores: AppStores) {
  // Слушать события от file watcher
  listen<string>('command-received', async (event) => {
    const filePath = event.payload;
    await processCommand(filePath, stores);
  });

  // При старте — обработать все pending (если приложение было закрыто)
  processAllPending(stores);
}

async function processCommand(filePath: string, stores: AppStores) {
  try {
    // 1. Прочитать файл
    const content = await invoke<string>('read_file', { path: filePath });
    const rawCommand = JSON.parse(content);

    // 2. Валидировать через Zod
    const command = CommandFileSchema.parse(rawCommand);

    // 3. Выполнить
    await executeCommand(command, stores);

    // 4. Переместить в done/
    const donePath = filePath.replace('/pending/', '/done/');
    await invoke('move_file', { from: filePath, to: donePath });

    // 5. Показать toast: "Команда выполнена: create_block"
    stores.ui.showToast(`✓ ${command.action}`, 'success');

  } catch (error) {
    // Переместить в failed/ с ошибкой
    const failedPath = filePath.replace('/pending/', '/failed/');
    const content = await invoke<string>('read_file', { path: filePath });
    const failedContent = {
      ...JSON.parse(content),
      error: error.message,
      failed_at: new Date().toISOString()
    };
    await invoke('write_file', {
      path: failedPath,
      content: JSON.stringify(failedContent, null, 2)
    });
    await invoke('delete_file', { path: filePath });

    stores.ui.showToast(`✗ Ошибка: ${error.message}`, 'error');
  }
}

async function processAllPending(stores: AppStores) {
  const dataDir = await invoke<string>('get_data_dir');
  const pendingDir = `${dataDir}/../commands/pending`;
  const files = await invoke<string[]>('list_files', { dir: pendingDir });

  // Сортировать по имени (timestamp в имени обеспечивает порядок)
  files.sort();

  for (const file of files) {
    await processCommand(`${pendingDir}/${file}`, stores);
  }
}
```

### Исполнение команд

**executeCommand:**

```typescript
async function executeCommand(command: Command, stores: AppStores) {
  switch (command.action) {
    case 'create_block': {
      const block: Block = {
        id: generateId('blk'),
        title: command.data.title,
        date: command.data.date,
        start: command.data.start,
        duration: command.data.duration,
        category: command.data.category || 'work',
        source_entity_id: command.data.source_entity_id || null,
        status: 'planned',
        notes: command.data.notes || ''
      };
      stores.schedule.addBlock(block);
      break;
    }

    case 'update_block': {
      stores.schedule.updateBlock(command.data.block_id, command.data);
      break;
    }

    case 'move_block': {
      stores.schedule.moveBlock(
        command.data.block_id,
        command.data.new_date,
        command.data.new_start
      );
      break;
    }

    case 'resize_block': {
      stores.schedule.resizeBlock(command.data.block_id, command.data.new_duration);
      break;
    }

    case 'delete_block': {
      stores.schedule.deleteBlock(command.data.block_id);
      break;
    }

    case 'set_block_status': {
      stores.schedule.setBlockStatus(command.data.block_id, command.data.status);
      break;
    }

    case 'create_entity': {
      stores.entities.addEntity(command.data);
      break;
    }

    case 'update_entity': {
      const { entity_id, ...updates } = command.data;
      stores.entities.updateEntity(entity_id, updates);
      break;
    }

    case 'delete_entity': {
      stores.entities.deleteEntity(command.data.entity_id);
      break;
    }

    case 'create_week': {
      await stores.schedule.createWeek(command.data.week, command.data.apply_template);
      break;
    }

    case 'batch': {
      for (const subCommand of command.data.commands) {
        await executeCommand(subCommand, stores);
      }
      break;
    }

    default:
      throw new Error(`Unknown action: ${command.action}`);
  }
}
```

---

## UI индикация

### Status Bar

Status bar существует с **фазы 1** (отрисовка) и **фазы 2** (счётчик
«Сохранено» + «N сущностей»). Здесь — расширяем его новыми
счётчиками.

Разметка `.sbar` — 26px, background `var(--bg-surface)`, `--fs-2xs`,
`var(--mono)`, `color: var(--text-tertiary)`:

```
● Сохранено 14:25 │ 18 сущностей │ 📥 2 выполнено │ ⚠ 1 ошибка     [hints →]
```

Состав:
- `● Сохранено HH:MM` — из `save-status.ts` (с фазы 2)
- `N сущностей` — из entity store (с фазы 1)
- **Новое**: `📥 N выполнено` — счётчик команд выполненных за
  сессию. Увеличивается при успешном `move_file → done/`
- **Новое**: `⚠ N ошибок` — счётчик failed-команд за сессию.
  Кликабельный → открывает панель `FailedCommandsPanel`
- Справа (`.hints`) — подсказки-хоткеи, подтягиваются по активной
  странице

Разделители — `.sep` (1px × 10px, `var(--border)`).

### Toast-уведомления

Контейнер `.toast-c` — `position: fixed`, `top: 12px`, `right:
12px`, вертикальный flex с gap 8px.

`.toast` — одна плашка:
- Background `var(--bg-elevated)`, `border: 1px solid var(--border-
  default)`, `border-radius: var(--radius-lg)`, padding 8×16
- `--fs-xs`, flex-row + gap 8px, `box-shadow: var(--shadow-sm)`
- Анимация появления — `@keyframes tIn { from { opacity:0;
  transform: translateX(16px) } }`, длительность `var(--duration-
  slow)` с `var(--ease-out)`
- Автоисчезает через 2500ms

Варианты:
- `.toast.success` — `border-left: 2px solid var(--success)`;
  текст `✓ ${command.action}` (или короче для ежедневных действий
  типа «Перемещён», «Создан: Монтаж GC»)
- `.toast.error` — `border-left: 2px solid var(--error)`; текст
  `✗ ${command.action}: ${error.message}`

Toast уже используется с фазы 2 (на любое изменение блока). В
фазе 6 добавляется реакция на успех/ошибку команды.

### Failed Commands Panel

Доступ: клик на "⚠ N ошибок" в status bar.

Список failed-команд:
- Action + data (кратко)
- Текст ошибки
- Timestamp
- Кнопка "Retry" (перемещает обратно в pending)
- Кнопка "Dismiss" (удаляет из failed)

---

## Протокол агента

Создать файл `docs/api/commands-api.md` — описание file-based API
мутаций для внешних клиентов (AI-агенты, скрипты, ручная правка).

### Содержание commands-api.md

```markdown
# TuzovOS — Протокол для AI-агента

## Чтение данных

Читай файлы напрямую:
- `data/entities.json` — все сущности
- `data/schedule/2026-wNN.json` — расписание недели
- `data/config.json` — настройки, области, preferences
- `data/templates/default.json` — шаблон недели

## Запись данных

НЕ ПИШИ в data/ напрямую. Создавай команды в `commands/pending/`.

### Формат имени файла

`commands/pending/{timestamp}-{action}.json`

Пример: `commands/pending/1713012345-create-block.json`

### Формат команды

{json}
{
  "id": "cmd-{timestamp}-{action}",
  "action": "create_block",
  "timestamp": "2026-04-13T14:25:45",
  "data": { ... }
}
{/json}

### Доступные действия

[Полный список из 01-data-schema.md, раздел 6]

### Примеры

#### Создать блок в расписании
{json}
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
    "source_entity_id": "ent-a1b2c3d4"
  }
}
{/json}

#### Раскидать всю неделю (batch)
{json}
{
  "id": "cmd-1713012400-batch",
  "action": "batch",
  "timestamp": "2026-04-13T14:26:40",
  "data": {
    "commands": [
      { "action": "create_block", "data": { ... } },
      { "action": "create_block", "data": { ... } },
      { "action": "create_block", "data": { ... } }
    ]
  }
}
{/json}

#### Создать дашборд

Просто создай .jsx файл в `data/dashboards/` и обнови `_registry.json`.
Приложение подхватит автоматически (hot reload).

## Scheduling Preferences

Читай `data/config.json` → `scheduling_preferences` перед планированием.
Там правила: deep work утром, буферы после подкастов, и т.д.

## ID-формат

- Сущности: `ent-{uuid}`
- Блоки: `blk-{uuid}`
- Команды: `cmd-{timestamp}-{action}`
```

---

## Scheduling Preferences UI

Добавить в Settings (Фаза 4) секцию "AI-планирование":

Визуальный редактор preferences из config.json:
- Deep work hours: два time picker (start, end)
- No calls before: time picker
- Min block durations: таблица (тип работы → минимум минут)
- Buffers: таблица (после чего → сколько минут)
- Hobby hours: два time picker
- Max busy evenings: number input
- Meeting preference: select (weekdays / weekends / any)

Изменения сохраняются в `config.json` → агент читает при планировании.

---

## Технический долг от фазы 2 (сделать здесь — именно здесь критично)

Эти пункты были отложены из фазы 2, потому что ручному пользователю
они почти не мешают. Но как только команды от агента пойдут пачками и
параллельно — они становятся блокирующими.

- **Async sequencing в `loadWeek` / `saveWeek`.** Сейчас
  `useScheduleStore.loadWeek` вызывается с `void` (header), без
  request-token'а; быстрая навигация может закоммитить blocks от
  старой недели поверх новой. У ручного юзера это редко — у агента,
  который может прислать `create_week` + сразу `create_block` для
  него, это норма. Сделать:
  - `loadingToken: number` в store, инкрементируется на каждый
    `loadWeek`; при коммите проверять, что токен ещё актуален.
  - `saveQueue` (sequential) для `writeJsonFile` per-week — два
    параллельных save'а одной недели сериализуются.
  - Команды в `command-processor` — батч-режим: для одной недели в
    одном tick'е — один writeFile.
- **`generateId` → `crypto.randomUUID()`.** 32 бит случайности (8
  hex) ОК для ручных нескольких сотен блоков. У агента, который
  может за минуту нагенерить пачку команд + history-режимы (replay
  failed/), коллизии становятся реальными. Не блокирует ничего, но
  поправить в этой же фазе. Заодно пересмотреть префиксы (`blk-` /
  `ent-` / `cmd-`) — оставляем для читаемости.
- **`date-fns` миграция + DST + unit-тесты для `time-utils`.**
  `dayIndexOfDate` сейчас уязвим к DST off-by-one (spring-forward
  недели → блок ушёл на «понедельник следующей недели»). Когда
  команды от агента ходят с датами/временами — это тихие баги в
  расписании, которые юзер увидит «иногда» через неделю. Здесь:
  - Переписать `isoWeekParts`, `getWeekStartDate`, `addWeeks`,
    `getCurrentWeekId`, `dayIndexOfDate` на `date-fns` (`getISOWeek`,
    `startOfISOWeek`, `addWeeks`, `differenceInCalendarDays`).
  - Покрыть unit-тестами edge cases: 27–31 декабря (год-граница ISO
    weeks), DST spring-forward / fall-back недели, високосные годы.
- **Toast `role="alert"` для error.** Сейчас все тосты — `polite`
  (CODESTYLE п.10). В фазе 6 ошибки команд могут приходить пачками
  и должны прерывать SR-чтение. Развести error-тосты в отдельный
  контейнер с `role="alert" aria-live="assertive"`.

После этих правок — обновить CODESTYLE п.5 (async actions) и п.7
(хоткеи) кейсами «команд-очередь» и «error toast».

## Критерии готовности

- [ ] File watcher на commands/pending/ работает
- [ ] Приложение обрабатывает новые .json файлы в pending/
- [ ] Все actions из протокола работают (create/update/move/resize/delete block, CRUD entity, create week, batch)
- [ ] Валидация через Zod — невалидные команды попадают в failed/
- [ ] Выполненные команды перемещаются в done/
- [ ] Status bar показывает статус
- [ ] Toast-уведомления при выполнении/ошибке
- [ ] Failed commands panel с retry
- [ ] При старте — обработка всех pending (очередь не теряется)
- [ ] `docs/api/commands-api.md` создан и полон
- [ ] Scheduling preferences редактируются в UI
- [ ] Hot reload дашбордов при изменении файлов (из Фазы 5, если не было)
