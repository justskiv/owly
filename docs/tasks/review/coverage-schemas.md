# Schemas — contract test gaps

Zod schemas в `src/schemas/` — source of truth для всех типов и
персистенции. Регрессия одного `refine` или `discriminated union`
ломает все downstream-операции (load → store → e2e). Сейчас ни одна
схема не имеет прямых unit-тестов.

Тестирование дешёвое (pure unit, без VirtualFS), valid + invalid
inputs покрывают большинство риска.

## Список

### Sc-1 — `common.ts` validators
- **File**: `src/schemas/common.ts:24-86`
- **Severity**: critical
- **Effort**: small
- **Что покрыть**: `isoDate` (Y-M-D + isValidYMD), `isoDateTime`
  (datetime + valid hour/minute), `timeHHMM` (HH:MM ranges),
  `weekId` (YYYY-wNN, 01-53), `monthDay` (Feb 29 разрешён —
  leap year), `DayOfWeekSchema` enum.
- **Почему важно**: эти функции используются в каждой схеме
  ниже. Бракнем их — bake silent corruption во все файлы.
- **Тип**: pure unit

### Sc-2 — `command.ts` CommandSchema
- **File**: `src/schemas/command.ts:221`
- **Severity**: critical
- **Effort**: small
- **Что покрыть**: 272-строчный discriminated union — каждый
  command type валиден с минимальными required полями;
  каждый отвергается при отсутствии required; partial-batch
  routing.
- **Почему важно**: agent contract. Невалидный command,
  пропущенный schema-check, может удалить или испортить
  данные.
- **Тип**: pure unit

### Sc-3 — `entity.ts` EntitySchema + EntitiesFileSchema
- **File**: `src/schemas/entity.ts:171`
- **Severity**: critical
- **Effort**: small
- **Что покрыть**: discriminated union (task/project/direction)
  default fields для каждого типа, status/priority enum, tags
  array, дефолты при загрузке legacy v1 (без новых полей —
  применяются defaults, НЕ создаётся `.corrupted-*`).
- **Почему важно**: entities.json — самый критичный файл
  пользователя. Recovery path в `file-io.ts` смотрит на
  результат этой схемы.
- **Тип**: pure unit

### Sc-4 — `schedule.ts` WeekFileSchema
- **File**: `src/schemas/schedule.ts:26`
- **Severity**: critical
- **Effort**: small
- **Что покрыть**: BlockSchema (start, duration ≥ 15, status
  enum, category, optional pool_item_id/source_entity_id),
  WeekFileSchema (week id format, blocks array,
  template_applied nullable).
- **Тип**: pure unit

### Sc-5 — `pool.ts` PoolFileSchema
- **File**: `src/schemas/pool.ts:31`
- **Severity**: critical
- **Effort**: small
- **Что покрыть**: PoolItemSchema (hours > 0, splittable bool,
  source_kind enum, placed bool, source_entity_id nullable
  по source_kind).
- **Тип**: pure unit

### Sc-6 — `horizon.ts` HorizonFileSchema
- **File**: `src/schemas/horizon.ts:24`
- **Severity**: critical
- **Effort**: small
- **Что покрыть**: HorizonProject (size enum, hidden bool,
  months array), defaults для legacy collapse maps.
- **Тип**: pure unit

### Sc-7 — `config.ts` ConfigFileSchema
- **File**: `src/schemas/config.ts:42`
- **Severity**: high
- **Effort**: small
- **Что покрыть**: Area uniqueness не enforced (пробел —
  отдельный риск, но проверка id format дешёвая),
  SchedulingPreferences (HourRange валидность),
  PriorityConfig.
- **Тип**: pure unit

### Sc-8 — `template.ts` TemplateFileSchema
- **File**: `src/schemas/template.ts:16`
- **Severity**: medium
- **Effort**: trivial
- **Что покрыть**: TemplateBlockSchema (duration ≥ 15 — тот же
  guard что в WeekFileSchema, иначе createWeekFromTemplate
  даст corrupt week file).
- **Тип**: pure unit

### Sc-9 — `dashboard.ts` DashboardEntrySchema +
  DashboardRegistrySchema
- **File**: `src/schemas/dashboard.ts:7`
- **Severity**: medium
- **Effort**: trivial
- **Что покрыть**: file regex `^[a-z0-9_\-]+\.jsx$` (URL-safe
  filenames), order non-negative, version literal 1.
- **Тип**: pure unit

## Заметки

- **Один тестовый файл = одна схема**, формат как у существующих
  unit-тестов в `src/services/`. Размещать в `src/schemas/*.test.ts`.
- Тесты на schemas — это **первая линия защиты** при schema-evolution
  (добавление нового поля, миграция enum-значения). Дешёвые сейчас,
  заметно полезные при следующем рефакторинге.
- Не путать с reliability-сценариями: тут проверяется что схема
  принимает/отвергает то что ожидает, не что приложение восстановится
  при corrupt-файле (это в `reliability-scenarios.md`).
