# Services — unit coverage gaps

В `src/services/` ~45 файлов, unit-тесты есть только у 14. Список
ниже — pure-function services с branching-логикой, где регрессия
будет silent (тесты на смежных уровнях её не поймают).

Тривиальные getter'ы / константы / re-export'ы пропущены.

## Pure-function services (быстрые тесты)

### Sv-1 — `note-parser.parseNote` + `renderInline`
- **File**: `src/services/note-parser.ts:29-95`
- **Severity**: high
- **Effort**: trivial
- **Что покрыть**: HTML escape перед `dangerouslySetInnerHTML`
  (`<script>` → `&lt;script&gt;`), bold/italic isolation,
  snake_case `_foo_bar_` НЕ italic (boundary regex), `---` hr,
  checkbox state.
- **Тип**: pure unit

### Sv-2 — `balance.overlappingIds`
- **File**: `src/services/balance.ts:78`
- **Severity**: high
- **Effort**: trivial
- **Что покрыть**: classic off-by-one — `aStart < cStart +
  c.duration && cStart < aEnd`. Adjacent (12:00-13:00 +
  13:00-14:00) НЕ overlap. `isCounted` filter excluding
  skipped/cancelled. `areaOrder` sort precedence.
- **Тип**: pure unit

### Sv-3 — `dashboard-compiler.compileDashboard`
- **File**: `src/services/dashboard-compiler.ts:42-105`
- **Severity**: high
- **Effort**: small
- **Что покрыть**: 4 error paths (transform throw, syntax error
  в `new Function`, top-level execution throw, non-function
  default export); JSX → React.createElement; `imports` rewrite
  `export default` → `exports.default`; TypeScript stripper.
- **Тип**: pure unit

### Sv-4 — `routine-stats.computeRoutineStats`
- **File**: `src/services/routine-stats.ts:63-170`
- **Severity**: high
- **Effort**: medium
- **Что покрыть**: streak edge case (today empty allowed),
  rate denominator (today excluded if no blocks yet),
  `doneLevelFor` mapping, heatmap monthLabel heuristic,
  bug-fix at `:153-162` без regression test.
- **Тип**: requires VirtualFS (mock week-cache)

### Sv-5 — `week-format.getWeekOffsetFromCurrent` +
  `getWeekRangeLabel`
- **File**: `src/services/week-format.ts:32`, `:27`
- **Severity**: medium
- **Effort**: trivial
- **Что покрыть**: 2026-w01 ↔ 2025-w52 cross-year, week with
  March DST boundary, cross-month label "27 апреля — 3 мая",
  millisecond-divide + `Math.round` off-by-one риск.
- **Тип**: pure unit

### Sv-6 — `metric-stats.computeMetricStats`
- **File**: `src/services/metric-stats.ts:60-66`
- **Severity**: medium
- **Effort**: trivial
- **Что покрыть**: empty history, single-point (avgGrowth=0
  не NaN), prev=0 percent guard, trend tri-state с
  `Math.abs(change) < 1e-9` flat detection, last-of-month
  aggregation.
- **Тип**: pure unit

### Sv-7 — `contact-stats.computeContactStats`
- **File**: `src/services/contact-stats.ts:21-60`
- **Severity**: high
- **Effort**: trivial
- **Что покрыть**: `daysBetween` использует `T00:00:00`
  parsing — timezone trap. Tomorrow's reading = "ok", cadence
  elapsed by 1 day → "overdue" `overdueDays === 1`,
  null-cadence/null-last → "unknown" без throw.
- **Тип**: pure unit

### Sv-8 — `calendar-i18n.buildMonthGrid`
- **File**: `src/services/calendar-i18n.ts:45`
- **Severity**: medium
- **Effort**: trivial
- **Что покрыть**: Monday shift `(getDay() + 6) % 7`. Month
  starting on Sunday → first row 6 days from prev month.
  Month starting on Monday → clean. `outOfMonth` flag,
  `isToday` matching.
- **Тип**: pure unit

### Sv-9 — `date-format-ru.formatRelativeRU`
- **File**: `src/services/date-format-ru.ts:23-36`
- **Severity**: medium
- **Effort**: trivial
- **Что покрыть**: base 23:00 + target next-day 00:30 → diff
  должен быть `+1` не `+2` (after `setHours(0,0,0,0)`).
  "через N дн." cap при N=7. Negative diff → "вчера" при -1.
- **Тип**: pure unit

### Sv-10 — `save-status.trackSave`
- **File**: `src/services/save-status.ts:5-30`
- **Severity**: medium
- **Effort**: trivial
- **Что покрыть**: с `vi.useFakeTimers` — saved → idle через
  1500ms; first error fires toast и stays red; second error
  обновляет message но НЕ повторяет toast.
- **Тип**: store integration (uses `useUIStore` + toast mock)

### Sv-11 — `quick-add-create.createFromQuickAdd`
- **File**: `src/services/quick-add-create.ts:12-55`
- **Severity**: high
- **Effort**: trivial
- **Что покрыть**: все три типа (task/project/direction) с
  правильными defaults; priority `"medium"` только для task;
  deadline propagation; `tags = [category]` always
  single-element.
- **Тип**: store integration

## Requires VirtualFS

### Sv-12 — `week-cache.getCachedWeek`
- **File**: `src/services/week-cache.ts:16-50`
- **Severity**: high
- **Effort**: small
- **Что покрыть**: in-flight dedup (2 параллельных
  `getCachedWeek` шарят один IPC), null distinction (verified
  missing vs never asked), corrupt file → null + warn + cache.
- **Тип**: requires VirtualFS

### Sv-13 — `week-manager.createWeekFromTemplate`
- **File**: `src/services/week-manager.ts:51-87`
- **Severity**: high
- **Effort**: small
- **Что покрыть**: `WeekFileSchema.safeParse` fail-fast guard
  при template drift. Template с блоком < 15 минут — throw
  с week id в message.
- **Тип**: requires VirtualFS

### Sv-14 — `week-manager.getCarryOverEntities`
- **File**: `src/services/week-manager.ts:97`
- **Severity**: high
- **Effort**: small
- **Что покрыть**: 3 conjunctive filters (prev.status='planned'
  + source_entity_id + no curr source + e.status='active').
- **Тип**: requires VirtualFS (mock prev/curr week)

### Sv-15 — `pool-actions.applyToPoolWeek` off-current
- **File**: `src/services/pool-actions.ts:39-66`
- **Severity**: high
- **Effort**: small
- **Что покрыть**: off-current read-modify-write inside
  `enqueuePoolWrite` (зеркало schedule.applyToWeek). 2
  одновременные writes в одну неделю — sequential.
- **Тип**: requires VirtualFS

### Sv-16 — `pool-actions.removePoolItemAndBlocks`
- **File**: `src/services/pool-actions.ts:73-82`
- **Severity**: critical
- **Effort**: small
- **Что покрыть**: cascade удаляет linked blocks по
  `pool_item_id` ONLY — entity-linked blocks НЕ удаляются.
- **Тип**: requires VirtualFS

### Sv-17 — `dashboard-hot-reload.installDashboardHotReload`
- **File**: `src/services/dashboard-hot-reload.ts:33-69`
- **Severity**: medium
- **Effort**: small
- **Что покрыть**: `.tmp.123.jsx` filtered out; debounce 100ms
  collapses 2 events; only `.jsx` и `_registry.json` pass; no
  double-install под StrictMode.
- **Тип**: store integration

## Заметки

- `clock.ts`, `defaults.ts`, `boards.ts`, `categories.ts`,
  `entity-icons.ts`, `format.ts` — константы / re-exports / DI,
  тестировать нечего.
- `useReviewData` (hook) — orchestration над `recalcPool` и
  `loadWeekBundle`, оба покрыты. Хук — стыковка, низкий ROI
  пока race не проявится.
- `useBlockGesture.ts` (823 строки) и `useKanbanGesture.ts`
  (357 строк) — pointer-event plumbing, тестировать через
  component-level e2e (см. `coverage-e2e.md` E-3..E-7).
