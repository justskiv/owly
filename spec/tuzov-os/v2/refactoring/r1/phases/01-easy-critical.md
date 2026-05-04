# R1 Phase 1 — Easy + Critical

> **Pre-flight:** прочитай `../PRE-FLIGHT.md` ПЕРЕД стартом.
> Особенно — раздел про path:line drift и существующие паттерны
> (pool-write-queue / horizon-write-queue / handlePersistError).
> Re-grep любые номера строк перед правкой.

## Контекст

Все XS/S правки, которые либо предотвращают data-loss, либо
закрывают security gap, либо чинят silent failure. Pattern уже
есть в коде (write-queues, readJsonFileOrCreate, isoDateTime
schema) — задача механически перенести его на места, где
забыли применить.

Большая фаза по объёму, но каждая правка изолирована. Бьётся
на 4 логические группы — после каждой `task check` зелёный +
smoke.

## Scope

### Группа A — Concurrency & race conditions (9 правок)

| # | Severity | Path:line | Задача | Effort |
|---|---|---|---|---|
| A1 | critical | `src/store/entities.ts:121-149` | Создать `services/entities-write-queue.ts` (mirror horizon-write-queue), завернуть `saveEntities`, `addEntity`, `updateEntity`, `deleteEntity`, `deleteDirectionWithCascade` | S |
| A2 | medium | `src/store/config.ts:82` | Создать `services/config-write-queue.ts` (single global chain), завернуть `setAreas`, `setPipelineStages`, `setSchedulingPreferences` и т.п. | XS |
| A3 | critical | `src/store/schedule.ts:273-290` | Off-current `applyToWeek`: переместить `getCachedWeek` + `readJsonFile` + `mutate` ВНУТРЬ callback'а `enqueueWeekWrite` (зеркало `pool-actions.ts:58-65`) | S |
| A4 | critical | `src/services/command-executor.ts:99` | `move_block` cross-week: idempotency guard на destination — `bs.some(b => b.id === block_id) ? bs : [...bs, movedBlock]` | XS |
| A5 | high | `src/services/command-executor.ts:98` | `move_block` cross-week: clear `pool_item_id` на `movedBlock` (pool items per-week, ссылка orphan'ит destination) | XS |
| A6 | critical | `src/App.tsx:137-153` | Boot race: добавить `bootReady: boolean` в `useUIStore` (false → true только после Promise.all всех load*). Gate entity→horizon subscription за `bootReady === true`. | S |
| A7 | critical | `src/services/command-processor.ts:56` | Live watcher listener: применить `shouldSkip(basename)` ДО `enqueue(path)`. Сейчас фильтр работает только в boot-time `drainPending`. | XS |
| A8 | medium | `src/services/command-processor.ts:50` | `started = true` ставить ПОСЛЕ успешного `listen()` (сейчас до — если listen throws, processor навсегда disabled) | XS |
| A9 | critical (min) | `src/services/command-executor.ts:191-194` | `delete_entity` минимальный каскад: чистить blocks с `source_entity_id === id` в active week + pool items с тем же source. Cross-week sweep — Phase 3. | S |

### Группа B — Schema input safety (7 правок)

| # | Severity | Path:line | Задача | Effort |
|---|---|---|---|---|
| B1 | critical | `src/schemas/command.ts:28-35` | `UpdateBlockCommandSchema.data` — omit `date` field (агенту использовать `move_block` для cross-week). Сейчас `date` через `partial()` пройдёт, executor пишет в исходную неделю — block теряется. | XS |
| B2 | high | `src/schemas/command.ts:7-9` | `id: z.string().min(1)`, `timestamp: isoDateTime()` (импорт из common.ts) | XS |
| B3 | medium | `src/schemas/entity.ts:163-164`, `src/schemas/pool.ts:24` | `created_at`, `updated_at` через `isoDateTime()` schema (защита от toISOString() drift) | XS |
| B4 | medium | `src/services/week-manager.ts:51-65` (`createWeekFromTemplate`) | `WeekFileSchema.safeParse(generated)` ПЕРЕД `writeJsonFile`. Также align `TemplateBlockSchema.duration` minimum с BlockSchema (≥15). | S |
| B5 | medium | `src/schemas/horizon.ts:9` (HorizonProjectStateSchema.months) | `min(0).max(7).max(8 items).refine(unique)` (board рендерит 0..7, дубликаты не имеют смысла). Также apply в `src/schemas/command.ts:144`. | XS |
| B6 | medium | `src/services/seed-migration.ts:140-164` | После replacement loop — `safeParse(текст)` каждого пути через path→schema map (entities/schedule/pool/horizon). На fail — abort до записи `marker`. | S |
| B7 | medium | `src/store/schedule.ts:152` | Сейчас в `loadWeek` есть бранчинг: `exists ? readJsonFile : readJsonFileOrCreate`. Existing-week ветка через `readJsonFile` падает на corrupt file → boot crash. Поменять на `readJsonFileOrCreate(path, WeekFileSchema, emptyWeekFile(week, startDate))` для обеих веток (`readJsonFileOrCreate` сам делает backup `.corrupted-*` и пишет defaults). Pool/entities/horizon уже сделаны так. | XS |

### Группа C — Security (3 правки)

| # | Severity | Path:line | Задача | Effort |
|---|---|---|---|---|
| C1 | high | `src-tauri/capabilities/default.json:7` | Заменить `core:default` на explicit minimal: `core:event:allow-listen`, `core:event:allow-unlisten`, `core:window:allow-show`, `core:window:allow-start-dragging` (плюс существующие plugin-permissions) | S |
| C2 | high | `src/services/command-processor.ts:enqueue` | После C1 frontend больше не emit'ит. Дополнительно: в JS-listener валидировать что `path.includes("/data/commands/pending/")` ДО `processOne`. Защита от forge'нутого payload если кто-то вернёт `core:event:allow-emit`. | XS |
| C3 | high | `src-tauri/src/commands/files.rs:12-29` | `validate()` против `AppRoot/data`, не `AppRoot`. Manage `DataRoot(root.join("data"))` state, передавать в commands. Сейчас в dev allows reads/writes под весь project root. | XS |

### Группа D — Error UX & tooling (7 правок)

| # | Severity | Path:line | Задача | Effort |
|---|---|---|---|---|
| D1 | high | `src/services/save-status.ts:14-15` + `src/components/layout/StatusBar.tsx` | На transition `saving → error` показывать toast с `saveError`. Кликабельный dot открывает popover с last error. | S |
| D2 | high | `ProjectPopup.tsx:53-80`, `TaskPopup.tsx:59-88`, `DirectionPopup.tsx:77-158`, `InlineProjectEditor.tsx:34-56`, `tasks/TaskRow.tsx:42` | Заменить `void updateEntity(...)` / `void deleteEntity(...)` на `try/await/catch` с toast.error и rollback draft (см. `BlockPopup.tsx:92-96` как образец `handlePersistError`). ~15 sites. | S |
| D3 | high | новый `src/services/format.ts` (или новый helper) | `errMsg(e: unknown): string` — `e instanceof Error ? e.message : typeof e === "string" ? e : String(e)`. Sweep все `(e as Error).message` (~30 sites) на `errMsg(e)`. | S |
| D4 | high | `src/hooks/useBlockGesture.ts:397, 562, 699` | `setDropTarget({...})` пишет fresh object каждый pointermove даже если snapped slot тот же → cascade re-render PlannerPage→WeekGrid→DayColumn × 60-120Hz. Fix: до `setDropTarget(next)` сравнить с `prev` (через `useRef` или `useCallback` с локальным last-value), пропустить если все три поля `{date, minute, duration}` равны. Не путать с `useKanbanGesture` cached-rects pattern — это другая оптимизация. | XS |
| D5 | medium | `src/store/commands.ts:135-147, 190-202` | `clearAllFailed` / `clearAllDone`: list+delete все `.json` в директории, не только `get().failed/done`. Сейчас `loadDone` cap'ит на 200, файлы старее не удаляются → next boot resurrect. На delete failures — toast, оставить запись в массиве. | XS |
| D6 | medium | `src/main.tsx` | Top-level `<ErrorBoundary>` с fallback "Произошла ошибка / Перезапустить" (восстановление через `getCurrentWindow().close()`). Сейчас render exception в Shell/PlannerPage = blank screen. | S |
| D7 | medium | `package.json` + новый `eslint.config.js` + `Taskfile.yml` | Установить `eslint`, `@typescript-eslint/*`, `eslint-plugin-react-hooks` (сейчас НЕТ ни одного eslint в deps — проверь `package.json`). Создать flat config с `react-hooks/exhaustive-deps: error`. Добавить новый task `lint` и включить его в `task check` (сейчас `check = typecheck + test + fe:build`, без lint). Существующие 8 шт `eslint-disable-next-line react-hooks/exhaustive-deps` — оставить (комментарии объясняют). После install — `eslint .` должен пройти; если warnings от чего-то другого — настроить scope или отключить правила, не править попутно. | S |

## Шаги реализации (порядок)

1. **Группа A — Concurrency** одним коммитом. После каждой правки `task check`. После всей группы — smoke от пользователя на drag блоков, agent-команды, batch создания entity.
2. **Группа B — Schema** одним коммитом. После — `task check` + smoke на agent commands (тест-batch с update_block без date, c date — должна reject; corrupt-template path; invalid horizon months).
3. **Группа C — Security** одним коммитом. **Внимание:** после tightening capabilities прод сборка может перестать запускаться — нужен `task tauri:dev` + проверка что emit/listen/window работают корректно. Smoke от пользователя обязателен.
4. **Группа D — Error UX** одним коммитом. Smoke: ошибка в saveEntities (моknуть disk error), удалить entity → проверить toast, ввести `(e as Error).message` в неподходящем месте → проверить fallback. ErrorBoundary — намеренно вызвать throw в одном из popup'ов.

Каждая группа — atomic commit. Не заходить в Группу B пока A не зелёная и не апрувнута.

## Acceptance criteria

### Concurrency
- [ ] entities-write-queue: два рапид update_entity подряд не теряются
- [ ] config-write-queue: setAreas + setSchedulingPreferences подряд не теряются
- [ ] applyToWeek off-current: два update_block в одну неделю не клоббятся
- [ ] move_block retry из failed/ не дублирует block в destination
- [ ] move_block cross-week — pool_item_id зачищен в destination
- [ ] boot race: agent команда `create_entity` за первые 100мс boot не теряет уже существующие entities
- [ ] watcher tmp-файлы не парсятся (mock: `pending/X.tmp.123.json` → не должно быть `failed/X.tmp.123.json`)
- [ ] processor `started` flag — listen() throw не фризит processor
- [ ] delete_entity: pool/blocks active week очищены

### Schema
- [ ] update_block с date — schema reject с понятным message
- [ ] command id `""` или missing timestamp — reject
- [ ] entity с `created_at: "2026-05-04T12:00:00Z"` (с Z) — reject
- [ ] template с block.duration=5 — reject; corrupt template — abort, marker не пишется
- [ ] horizon.months=[12] или [2,2] — reject
- [ ] schedule.json corrupt — `.corrupted-*` backup, default fresh week, не boot crash

### Security
- [ ] `task tauri:build` собирается, app запускается, базовые операции работают
- [ ] command-received с path вне `data/commands/pending` — silent skip
- [ ] read/write/delete под `<root>/src/foo` — reject `path outside data dir`

### Error UX
- [ ] mock disk error при saveEntities → toast с error message, dot красный
- [ ] entity popup delete с rejection → toast, popup не закрывается
- [ ] errMsg coverage (sweep полный — `rg "as Error"` пусто или только в test files)
- [ ] drag block → React DevTools Profiler показывает что DayColumn не re-render'ится при стационарном snapped slot
- [ ] clearAllDone с 250 done-файлами → все 250 удалены с диска
- [ ] throw в DirectionPopup → ErrorBoundary fallback, не blank screen
- [ ] `task check` включает `eslint .`, проходит зелёным

### Smoke (для пользователя)
- [ ] Drag блока 30+ секунд — нет лагов
- [ ] agent batch 10 commands (mix create/update/delete) — все либо в done/, либо в failed/ с понятным error
- [ ] Сделать `chmod -w data/entities.json`, попробовать переименовать entity → красный dot + понятный toast
- [ ] Удалить direction с 3 связанными projects — projects сохраняются с `direction_id: null`, pool items direction'а удалены
- [ ] Quick Add 3 task'а подряд за 1 секунду — все 3 в entities.json

## Ловушки

- **R1 (capabilities tightening, C1).** После замены `core:default` на минимальный набор могут отвалиться разные мелкие операции (например, drag-окна). Проверить руками: drag окна, esc для close, native menu (если есть), window.show при cmd+tab. Если какая-то операция отвалилась — добавить конкретный capability, не возвращать `core:default`.
- **R2 (DataRoot, C3).** Если `DataRoot` сделать раньше чем папка `data/` создана (cold start) — boot fall. Создавать `data/` и subfolders в `setup()` ДО регистрации DataRoot state.
- **R3 (boot race, A6).** Если `bootReady` flag слишком жёсткий (gate'ит ВСЕ мутаторы), команды в очереди при cold boot могут зависнуть. Решение: gate только подписки (entity→horizon), не сами мутаторы. Команды агента и так ждут processor `started`.
- **R4 (errMsg sweep, D3).** Не заменять в test-файлах (`*.test.ts`) — там cast валидный (контролируемый input). Только production code.
- **R5 (entities-write-queue, A1).** `deleteDirectionWithCascade` делает СРАЗУ несколько mutation'ов на entities. Wrap в одну `enqueueEntitiesWrite(() => /* всё внутри */)`, не разбивать на 3 отдельных enqueue.
- **R6 (D7 ESLint).** Существующие `eslint-disable-next-line react-hooks/exhaustive-deps` (8 шт) — все оправданы и описаны в комментариях. После установки plugin'а пройдёт ли `eslint .` без warning'ов? Проверить, добавить `--max-warnings=0` если нужно.
- **R7 (B6 seed validate).** Если bundled seed-v2 в проекте имеет какой-то edge-case формат — может зафейлить новую валидацию. Запустить миграцию на чистом `data/` перед коммитом, проверить marker пишется и files валидируются.

## Что НЕ включает (вынесено в другие фазы)

- Полный cross-week каскад при `delete_entity` / `delete_pool_item` — Phase 3
- Idempotency через executed log / processing folder — Phase 3
- Dashboard sandbox iframe — Phase 3
- Все недостающие тесты (command-processor, file-io, write-queues, stores) — Phase 3
- Splittable pool overscheduling fix — Phase 4
- Cross-field BlockSchema refines — Phase 4
- Watcher cache invalidation на schedule/pool — Phase 4
- noUncheckedIndexedAccess — Phase 4
- useUIStore / useBlockGesture refactor — Phase 4
- Versioned file migrators — Phase 4
- Title denormalization — Phase 4