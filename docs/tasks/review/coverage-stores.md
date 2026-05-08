# Stores — coverage gaps

Все 8 stores в `src/store/` сейчас тестируются только косвенно через
e2e. Прямых store-тестов нет. Это значит: race-conditions, защитные
guard'ы и cascade-логика, явно прокомментированные в коде как
"единственная защита от X", покрыты только удачным сценарием в e2e.

## Список

### S-1 — `entities.deleteDirectionWithCascade`
- **File**: `src/store/entities.ts:166-183`
- **Severity**: critical
- **Effort**: small
- **Что покрыть**: cascade обновляет `direction_id=null` на linked
  projects И удаляет direction в одном write. Комментарий в коде
  явно про прошлый bug-fix (заменили N+1 на single-write для
  removal of UI flicker).
- **Тип**: store integration + VirtualFS

### S-2 — `entities.addEntity` / `updateEntity` ordering
- **File**: `src/store/entities.ts:121-124`
- **Severity**: high
- **Effort**: small
- **Что покрыть**: persist-first → set-first flip. Rapid
  consecutive `addEntity` calls не должны терять intermediate
  updates. Комментарий в коде ссылается на bug-fix.
- **Тип**: store integration + VirtualFS

### S-3 — `schedule.loadWeek` token guard
- **File**: `src/store/schedule.ts:67-68`, `:140`, `:164`, `:179`
- **Severity**: critical
- **Effort**: small
- **Что покрыть**: rapid prev/next clicks не должны смешать
  состояние. Token guard — единственная защита от того что
  старый `loadWeek` финиширует последним и затрёт новый.
- **Тип**: store integration + VirtualFS (с delayed mockIPC)

### S-4 — `schedule.applyToWeek` cross-week branch
- **File**: `src/store/schedule.ts:258-301`
- **Severity**: critical
- **Effort**: medium
- **Что покрыть**: off-current week mutation через
  `enqueueWeekWrite` — чтобы две одновременные мутации в одну
  off-current неделю не клобберили друг друга.
- **Тип**: store integration + VirtualFS

### S-5 — `pool.loadWeek/add/update/remove` week snapshot
- **File**: `src/store/pool.ts:92`, `:103`, `:115`
- **Severity**: critical
- **Effort**: small
- **Что покрыть**: capture `currentWeek` синхронно в начале
  action — переключение недели mid-await должно сохранить в
  оригинальную неделю, не в текущую.
- **Тип**: store integration + VirtualFS

### S-6 — `horizon.addProject` de-dup guard
- **File**: `src/store/horizon.ts:203`
- **Severity**: medium
- **Effort**: small
- **Что покрыть**: одна строка `some()` guard. Subscription
  на изменения entities вызывает addProject — если guard
  убрать, каждый update entity создаст дубль.
- **Тип**: store integration

### S-7 — `dashboards.addDashboard` slug + rollback
- **File**: `src/store/dashboards.ts:139-180`
- **Severity**: high
- **Effort**: medium
- **Что покрыть**: slugify + transliteration (cyrillic title →
  latin slug), collision loop (`-2`, `-3`), collision против
  orphan `.jsx` файла, rollback `.jsx` write при failure
  persistRegistry.
- **Тип**: store integration + VirtualFS

### S-8 — `commands.clearAllFailed` / `clearAllDone` survivors
- **File**: `src/store/commands.ts:137-166`, `:209-239`
- **Severity**: medium
- **Effort**: small
- **Что покрыть**: если delete одного файла failed/done упал —
  остальные удалены, выживший остаётся в списке.
- **Тип**: store integration + VirtualFS

## Заметки

- `ui.ts` намеренно не в списке — почти все actions это
  setters/togglers, тестировать через e2e эффективнее. Исключение —
  `migrateDeactivated` и `replaceLastBangFragment`, но они
  индиректно покрыты Quick Add e2e.
- `config.ts` — в основном setter-функции, но при rapid edits
  Settings UI race-condition реальный (см.
  `coverage-e2e.md` E-12).
