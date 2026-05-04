# R1 Phase 4 — Hard + Cosmetic

> **Pre-flight:** прочитай `../PRE-FLIGHT.md` ПЕРЕД стартом.
> Каждый пункт независимый и большой — делай один за раз с
> отдельным smoke + commit. Re-grep актуальных строк перед
> правкой.

## Контекст

Большие рефакторы, которые улучшают maintainability /
performance / type safety, но не закрывают конкретный bug или
security gap. Делаем когда есть bandwidth и реальная боль —
не из принципа.

Каждая правка независимая. Не bundle'ить — каждая = свой
коммит с smoke.

## Scope

| # | Severity | Path:line | Задача | Effort |
|---|---|---|---|---|
| 1 | medium | `src/hooks/useBlockGesture.ts:293-323` | Splittable pool drop overscheduling: pass `PoolItemView` (с `scheduled` field) в drag handler, compute `remaining = (hours - scheduled) * 60`, disable drag at `remaining <= 0`, clamp drop duration в `min(snapped, remaining)`. Сейчас always 60min блок, completed splittable draggable. | M |
| 2 | medium | `src/schemas/schedule.ts` (BlockSchema) | Cross-field refine: `start + duration ≤ END_HOUR*60`, `start ≥ START_HOUR*60`. Защищает от agent с `start: "00:00", duration: 1500` → битый block. Также: EventFieldsSchema `time + duration` в [00:00, 24:00], RoutineFieldsSchema `frequency==="weekly" → days.length>0`. | S |
| 3 | medium | `src/services/command-executor.test.ts:159` | Replace `cmd<T>(...)` direct cast with `CommandSchema.safeParse` gate. Table-driven tests: один valid + один boundary reject per action. Сейчас 17 payloads bypass'ят Zod, schema/executor drift проходит CI. | M |
| 4 | medium | `src/services/command-processor.ts` (новая логика) + `src/store/commands.ts` | done/ retention: на boot если `done/` > 1000 файлов — keep last 1000 (lexicographic sort by filename), delete tail. Опционально age-based: delete > 90 дней. failed/ — same treatment, но keep last 100 (rare). | S |
| 5 | medium | (multiple files) | Title denormalization fix: lazy lookup. В `TimeBlock`, `PoolItemRow`, `KanbanCard`, `BlockPopup`, `recalc-pool` — selector reads live entity title (если есть), fall back на stored block.title для orphan-tolerance. Сейчас rename entity = stale title в blocks/pool forever. | M |
| 6 | medium | `src-tauri/src/watcher.rs:91`, `src/services/week-cache.ts`, `src/services/review-aggregations.ts:60-78` | Watcher для `data/schedule/` и `data/pool/`. На modify event — emit `schedule-files-changed` / `pool-files-changed` → `invalidateCachedWeek(week)` / `invalidatePoolCache(week)`. Сейчас external edits (manual fix) не invalidate cache. | M |
| 7 | low | `tsconfig.json` + sweep | Enable `"noUncheckedIndexedAccess": true`. Fix fallout: ~50-80 sites где `arr[i]`, `obj[key]` access. Большинство — добавить `!` assertion (когда invariant обеспечен) или explicit `if (item)` guard. Catches class of `undefined` bugs at compile-time. | L |
| 8 | medium | `src/store/ui.ts:1-657` | Split: extract `useQuickAddStore` (Quick Add tokenizer state, ~200 LOC), `usePageFiltersStore` (taskAddCat, taskSearch, contextCollapsed, sideTab, rvPeriod). Оставить в `useUIStore` только page-chrome: currentPage, saveStatus, settingsOpen, popups. Снижает re-render surface. | M |
| 9 | medium | `src/hooks/useBlockGesture.ts:1-798` | Extract `startGesture(opts: { kind, ghostBuilder, onCommit, onClick })` shared helper. Каждый из трёх public callbacks (`onBlockPointerDown`, `onPoolItemPointerDown`, `onPoolItemDragStart`) → ~30 LOC describing source-specific bits. Mutually-exclusive Active fields → discriminated union. | M |
| 10 | low | `src/store/entities.ts` (структура) + selectors | Normalize entities: `Record<string, Entity>` + `ids: string[]`. Components subscribe to specific id (`useEntity(id)`) → unrelated edits не trigger re-render. Сейчас `useEntityStore((s) => s.entities)` подписка во всех major pages. Большой рефакторинг: меняет паттерн selectors во всем проекте. | L |
| 11 | low | (новый файл `src/services/file-versioning.ts`) | Versioned file migrators: `parseEntitiesFile`, `parseScheduleFile` etc. — accept v1, v2, …, migrate to current. Replace `version: z.literal(1)` на `z.union([V1Schema, V2Schema])`. Pre-emptive: ничего сейчас не использует, но первая реальная миграция станет дороже без этой основы. | L |

## Шаги реализации

Каждый пункт — отдельный коммит. Порядок не критичен, но
рекомендуемый по value/risk:

1. **#2 cross-field refine** — лучшая ROI (S effort, real bug catch)
2. **#4 done/ retention** — простой servicing
3. **#1 splittable overscheduling** — UX/data correctness
4. **#5 title lazy lookup** — UX consistency
5. **#3 schema gate test** — coverage gap
6. **#6 watcher invalidation** — UX (edit JSON, see change)
7. **#9 useBlockGesture extract** — maintainability
8. **#8 useUIStore split** — maintainability
9. **#7 noUncheckedIndexedAccess** — type safety
10. **#10 entities normalization** — performance (требует validate реального impact сначала)
11. **#11 versioned migrators** — defensive (только когда v2 уже выпущен)

## Acceptance criteria

### #1 splittable
- [ ] Pool item `splittable, hours: 1` → drag создаёт 60min block. Drag второй раз → drag disabled (remaining 0)
- [ ] Pool item `splittable, hours: 0.5` → drag создаёт 30min block (clamped)

### #2 schema refines
- [ ] Block schema reject для `start: "00:00", duration: 1500`
- [ ] Event reject для `time: "23:30", duration: 120`
- [ ] Routine reject для `frequency: "weekly", days: []`

### #3 schema test gate
- [ ] Coverage: 17 actions × (valid + boundary reject) = 34+ schema tests
- [ ] Drift detection: добавить новый command в schema без executor case → falling test

### #4 retention
- [ ] Boot с 2000 done/ файлами → 1000 deleted, 1000 oldest remain
- [ ] Cleanup async — не блокирует boot

### #5 lazy title
- [ ] Rename entity → block в planner показывает new title в next render
- [ ] Delete entity → block показывает stored fallback title

### #6 watcher invalidation
- [ ] Edit `data/schedule/2026-w19.json` извне → cache invalidated → next read shows changes
- [ ] Edit `data/pool/2026-w19.json` извне → review screen shows new aggregation

### #7 noUncheckedIndexedAccess
- [ ] `tsc --noEmit` zelёный
- [ ] `task check` zelёный

### #8 useUIStore split
- [ ] `useUIStore` < 250 LOC
- [ ] React DevTools Profiler: keystroke в Quick Add не triggеr re-render PlannerPage

### #9 useBlockGesture
- [ ] LOC: 798 → ~350
- [ ] Все три gesture path работают (drag block, drag pool item to grid, drag pool entity to grid)
- [ ] Тесты не упали

### #10 entities Record
- [ ] React DevTools: edit entity title → only affected components re-render
- [ ] `useEntity(id)` selector + Map lookup
- [ ] All call sites migrated

### #11 versioned migrators
- [ ] `parseEntitiesFile({version: 1, ...})` → migrate to v2 happy path
- [ ] Unparseable input → JsonReadError as before

## Smoke

Каждый пункт — независимый smoke. См. acceptance criteria.

## Ловушки

- **R1 (#1 splittable).** PoolItemView сейчас НЕ передаётся в drag handler (only PoolItem). Изменить signature `useBlockGesture.onPoolItemDragStart(view: PoolItemView, ...)`. Меняет call site в `PoolSidebar`/`PoolTabContext`.
- **R2 (#5 lazy title).** Не делать lazy lookup внутри hot path рендера (TimeBlock рендерится 50+ раз). Использовать `useEntityStore` selector с stable equality.
- **R3 (#6 watcher).** На macOS FSEvents может coalesce много изменений в один event. Не вызывать `loadWeek` каждый раз — invalidate cache, пусть next render trigger'ит read. На Linux inotify — отдельные events на каждое изменение, debounce 100мс.
- **R4 (#7 noUncheckedIndexedAccess).** Большой sweep, ~50-80 файлов. Делать в одну сессию, иначе drift. Использовать `arr[i]!` только когда invariant строгий (loop bound).
- **R5 (#8 useUIStore split).** Components импортируют из `useUIStore` много полей. После split — `useQuickAddStore` где-то, `usePageFiltersStore` где-то. Refactoring всего проекта. Сделать через codemod или скрипт, иначе человеческий error.
- **R6 (#10 entities normalization).** Меняет паттерн `useEntityStore((s) => s.entities.find(e => e.id === X))` на `useEntity(X)` повсеместно. Touches ~30+ files. Делать через codemod.
- **R7 (#11 versioned migrators).** Сейчас все file schemas pin'ят `version: z.literal(1)`. Не bumb'ить версию пока не нужно — задача — основа на будущее. Если v2 не bumb'нется в Phase 10, эта работа dormant.

## Что НЕ включает

- Любые правки из Phase 1-3 (если что-то пропущено — назад в свою фазу)
- File permissions Unix `0700`/`0600` — defer, single-user low-risk
- Расширенные agent commands (move_pool_item, apply_template existing, delete_week, set_horizon_base_month, update_config) — отдельный backlog
- Component тесты (BlockEditor, QuickAdd, EntityEditor) — требуют jsdom + testing-library, отдельная инфраструктурная работа
- iOS / Android / Tailwind migration — out of scope
