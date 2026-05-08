# Reliability scenarios — отдельно от coverage

Этот файл — **не про coverage существующих фич**. Это сценарии
сбоев, race conditions, recovery paths, которые могут быть
триггернуты пользователем (или не быть никогда), но если
триггернутся — могут привести к data loss.

Отделено от `coverage-*.md` намеренно: это инвестиция в защиту от
будущих регрессий, а не "вот фича без теста". Брать только если есть
ресурс на это плюс к coverage задачам.

## Persistence / IO

### R-1 — `file-io.ts:readJsonFileOrCreate` recovery path
- **File**: `src/services/file-io.ts:143-207`
- **Severity**: critical
- **Effort**: medium
- **Сценарий**: corrupted JSON или Zod-fail. Текущий код:
  read raw bytes → backup via moveFile → if move failed,
  content-write fallback → if backup not verified, refuse
  to overwrite.
- **Тест**: 3 варианта против VirtualFS — (1) corrupt JSON,
  backup created, defaults written; (2) moveFile throws,
  fallback content-write creates backup; (3) BOTH fail,
  original preserved + JsonReadError rethrown.
- **Тип**: pure unit (file-io against VirtualFS)

### R-2 — Atomic `write_file` Rust mid-rename failure
- **File**: `src-tauri/src/commands/files.rs:41-138`
- **Severity**: critical
- **Effort**: medium
- **Сценарий**: write через temp + rename. Если rename
  упадёт — старый файл должен остаться, tmp removed.
  Concurrent writers (2 потока на один путь) — final файл
  один из двух snapshot'ов, не mixed.
- **Тест**: Rust integration test с 2 потоками + force
  rename failure scenario.
- **Тип**: pure unit (Rust)

### R-3 — `seed-migration.maybeMigrateToV2` partial state
- **File**: `src/services/seed-migration.ts:62-216`
- **Severity**: critical
- **Effort**: medium
- **Сценарий**: 200-строчный state machine (4-state probe,
  @key→UUID map, ordered file copy). Partial failure
  оставит UUIDs cross-referencing файлов, которые не
  записались.
- **Тест**: (1) missing entities.json + valid seed → all 4
  files copied + marker; (2) seed schema-invalid → throw,
  marker NOT written; (3) entities.json exists Zod-invalid
  → throw "Fix or remove" without overwriting; (4)
  idempotency: marker present → no-op.
- **Тип**: store integration + VirtualFS

## Race conditions

### R-4 — `loadWeek` token guard под race
- **File**: `src/store/schedule.ts:67`,
  `src/store/pool.ts:25`
- **Severity**: critical
- **Effort**: small
- **Сценарий**: rapid prev/next clicks. Старый `loadWeek`
  финиширует последним → затирает новый currentWeek.
- **Тест**: delayed mockIPC для week A; fire `loadWeek("A")`,
  immediately `loadWeek("B")` (resolves fast); assert
  final state — B's blocks, A's commit discarded.
- **Тип**: store integration + VirtualFS

### R-5 — `applyToWeek` cross-week serialisation
- **File**: `src/store/schedule.ts:282-301`,
  `src/services/pool-actions.ts:39-66`
- **Severity**: critical
- **Effort**: small
- **Сценарий**: 2 concurrent `applyToWeek("2026-w20", ...)`
  когда currentWeek = "2026-w19". Через
  `enqueueWeekWrite` обе мутации должны land sequentially
  в одну w20.json (no clobber).
- **Тест**: фикс задержки на первый IPC `read_file`,
  второй должен дождаться.
- **Тип**: store integration + VirtualFS

### R-6 — Cross-week move_block partial failure
- **File**: `src/services/command-executor.ts:80-128`
- **Severity**: critical
- **Effort**: medium
- **Сценарий**: destination написан, source delete fails.
  Block оказался дублирован между fromWeek и toWeek.
  Retry-from-failed/ переисполнит → ещё один дубль.
- **Тест**: mock destination success, source reject.
  Assert error message names both weeks, destination
  contains block, idempotency guard `:113-115` prevents
  duplicate insert on retry.
- **Тип**: store integration + VirtualFS

### R-7 — Slow queued write racing `loadWeek()`
- **File**: `src/store/schedule.ts:159, :208`,
  `src/store/pool.ts:65`
- **Severity**: critical
- **Effort**: medium
- **Сценарий**: delay write_file → call updateBlock без
  await → immediately loadWeek same week → edit again.
  Оба updates должны survive.
- **Тип**: store integration + VirtualFS

## Write queues

### R-8 — Burst writes (100 mutations) — feature claim
  unverified
- **File**: `src/services/entities-write-queue.ts`,
  `pool-write-queue.ts`, `week-write-queue.ts`,
  `horizon-write-queue.ts`, `config-write-queue.ts`
- **Severity**: high
- **Effort**: trivial
- **Сценарий**: 100 sequential mutations без await каждой.
  После `flushAllWrites()` — все 100 на диске.
- **Тест**: один на каждую очередь.
- **Тип**: pure unit

### R-9 — Queue freeze on rejection (one-throw-blocks-all)
- **File**: все 5 `*-write-queue.ts` файлов
- **Severity**: high
- **Effort**: trivial
- **Сценарий**: каждый файл явно комментирует "without
  catch, one throw freezes every subsequent write". Без
  теста — refactor может drop `.catch(() => undefined)`.
- **Тест**: inject rejection → enqueue another → second
  resolves.
- **Тип**: pure unit

### R-10 — `flushAllWrites()` quiescence guarantee
- **File**: `src/test/e2e/automation.ts:97`
- **Severity**: medium
- **Effort**: small
- **Сценарий**: snapshot 5 queues один раз — может miss
  writes enqueued during flush by subscriptions.
- **Тест**: nested cross-store enqueue during write.
  Assert flushAllWrites loops до stable.
- **Тип**: pure unit / store integration

## Command queue

### R-11 — Boot pending drain via real `<App />`
- **File**: `src/App.tsx:79`,
  `src/services/command-processor.ts:101-121`
- **Severity**: critical
- **Effort**: small
- **Сценарий**: F-9 явно обходит `startCommandProcessor`,
  вызывает `__processOnePendingForTests` напрямую. Real
  boot wiring не покрыт.
- **Тест**: render `<App />` с pending command в FS, wait
  bootReady, assert pending → done + mutation persisted.
- **Тип**: e2e-browser

### R-12 — `markDone` move-fail fallback delete
- **File**: `src/services/command-processor.ts:231-260`
- **Severity**: high
- **Effort**: small
- **Сценарий**: move_file throws, delete_file succeeds.
  Source removed → no double-execution на restart.
- **Тест**: 2 варианта — move fails (delete recovery);
  both fail (toast surfaces).
- **Тип**: store integration + VirtualFS

### R-13 — Parse retry на truncated JSON
- **File**: `src/services/command-processor.ts:180-204`
- **Severity**: high
- **Effort**: small
- **Сценарий**: read_file fail first call (truncated),
  succeed second (after PARSE_RETRY_MS=80). Assert
  command executes once.
- **Тип**: store integration + VirtualFS

### R-14 — Watcher dedupe (`inflight: Set<string>`)
- **File**: `src/services/command-processor.ts:107-178`
- **Severity**: medium
- **Effort**: small
- **Сценарий**: macOS FSEvents может coalesce или fire
  twice. Path normalization regression — re-execute same
  command before move-to-done.
- **Тест**: synthesize 2 `command-received` events same
  path back-to-back. Assert exactly 1 done file.
- **Тип**: store integration + VirtualFS

### R-15 — Path-traversal Rust guard
- **File**: `src-tauri/src/commands/files.rs:18-32`
- **Severity**: medium
- **Effort**: small
- **Сценарий**: `enqueue` defense-in-depth — rejects paths
  outside `data/commands/pending/`. Forged event с path
  traversal не должен read/delete/move.
- **Тип**: pure unit (Rust)

## Boot order

### R-16 — Boot horizon reconciliation guard
- **File**: `src/App.tsx:155-181`,
  `src/store/horizon.ts:126`
- **Severity**: high
- **Effort**: small
- **Сценарий**: subscription mirrors entity changes →
  horizon. Если loadAll throws после одного store
  loaded — entity subscription может install и start
  reconciling без bootReady gate.
- **Тест**: full `<App />` boot с prefilled horizon.json
  + projects в entities. Assert months/size survive
  после boot и flush.
- **Тип**: e2e-browser

### R-17 — `bootReady` interlock
- **File**: `src/App.tsx:35-81`
- **Severity**: high
- **Effort**: small
- **Сценарий**: `loadAll` throws после одного load. User
  видит alert + exit — но subscription может install и
  написать half-baked horizon.
- **Тест**: mock loadEntities throw. Assert setBootReady
  не вызван, addProject/removeProject не вызваны, нет
  half-baked horizon.json.
- **Тип**: store integration + VirtualFS

## Schema migration

### R-18 — Legacy v1 файлы Zod defaults применяются, не
  `.corrupted-*`
- **File**: `src/schemas/entity.ts:49`,
  `src/schemas/pool.ts:18`,
  `src/schemas/horizon.ts:29`
- **Severity**: high
- **Effort**: small
- **Сценарий**: future добавление required field может
  trigger recovery path для valid old файлов.
- **Тест**: load legacy JSON missing v2 fields, pool
  defaults, horizon collapse maps. Assert defaults
  applied, no `.corrupted-*` created.
- **Тип**: store integration + VirtualFS

## Заметки

- Эти сценарии **обычно не триггерятся юзером** — но если
  триггернутся, последствия серьёзные (data loss / dup
  execution / inconsistent state).
- ROI ниже чем у coverage — там тесты ловят регрессии в
  активно меняющемся коде. Тут код стабилен (file-io,
  watcher, queues), регрессии редки.
- **Брать после coverage** или если проявится конкретный bug.
- Часть R-1..R-3, R-15, R-2 требует Rust-side тестов —
  отдельный stack.
