# Phase E1 — Foundation: clock, virtual FS, builders, automation

> **Цель:** поставить ВСЮ инфру для E2E-тестов, мигрировать
> существующие 3 `*.browser.test.tsx` под новую инфру, активировать
> ESLint guard на `new Date()` / `Date.now()`. После фазы можно
> писать новые `*.e2e.test.tsx` без какой-либо доинфры.
>
> **Результат после фазы:** `task check` зелёный, vitest project
> переименован в `e2e-browser`. 3 мигрированных теста (PlannerPage
> drag, TasksPage Cmd+N, TasksPage screenshot V-1) проходят на
> новой инфре. Запуск `npm run lint` валит любую попытку использовать
> `new Date()` или `Date.now()` вне `clock.ts`. `git diff` показывает
> миграцию 26 callsites + новые модули в `src/test/`.
>
> **Разделы спеки:** §3.1, §3.2, §3.3, §3.4, §3.5, §3.6, §3.7, §3.8,
> §5.6, §9.1
>
> **Зависимости:** Phase 01–04 (smoke-tests) — **должны быть
> зелёными**.
>
> **MVP:** да.

## Контекст

Phase 01–04 поставили smoke-pyramid (unit, smoke-jsdom, smoke-browser,
cargo). `smoke-browser` использует **stub `mockIPC`** в
`src/test/mock-ipc.ts` — он отвечает на каждую команду статикой
(`""`, `null`, `false`). Этого хватает на render-смоки, но не
покрывает: persistence round-trip, command-queue flow, реальный
write→reload→read.

Эта фаза **полностью пересобирает** test-infra под E2E:

- VirtualFS (Map-based round-trip) — заменяет stub
- Frozen clock + миграция 26 callsites + ESLint guard
- Builders по типам (`buildTask`/`buildProject`/`buildDirection`)
  + traits (`onToday`, `withDeadlineIn` и т.д.)
- Scenarios (`empty`, `typical-week`)
- Automation library (`quickAdd`, `gotoScreen`, `dragWithPointer`,
  `dragWithDragEvent`, `flushAllWrites`)
- Service singletons reset (cachedDataDir, week-cache,
  command-processor, seed-migration, dashboard-hot-reload)
- `App.loadAll()` refactor — extract useEffect-IIFE в exported
  function (для Level 2 boot тестов)
- Vitest project rename `smoke-browser` → `e2e-browser`
- Миграция 3 существующих `*.browser.test.tsx` →
  `*.e2e.test.tsx`, включая screenshot baseline directory rename

Это ~12-16 ч реальной работы (~2 рабочих дня). По решению юзера
коммит — **один в конце фазы**.

## Ключевые решения

**DataRoot = `/tuzov-test/data`, не `/tuzov-test`.** Реальный Rust
`setup()` делает `DataRoot(root.join("data"))` — `get_data_dir`
возвращает `<app_root>/data`. `command-processor.ts:108` отвергает
любой path не содержащий `/data/commands/pending/` (security
tightening commit `8976d20`). Без этого префикса F-9 в E5 будет
падать на path guard.

**ESLint guard активируется ПОСЛЕ полной миграции 26 callsites.**
Если включить раньше — `task check` падает немедленно. Порядок:
clock.ts → миграция → green → guard → green.

**Builders разделены по типам.** `EntitySchema` — discriminated union
по `type`. Один универсальный `buildEntity({ type: "task", ... })`
ломает narrowing TypeScript: `Partial<Entity>` collapse'ится,
`fields` обязательное поле проваливается. Решение — отдельные
`buildTask`, `buildProject`, `buildDirection` (на каждый вариант
union'а).

**DnD двумя путями.** App **не использует** `@dnd-kit` несмотря на
запись в `package.json`. Реальные DnD-хуки (`useBlockGesture.ts`,
`useBacklogGesture`) — pointer-capture (`pointerdown` →
`pointermove(threshold=5px)` → `pointerup`). `userEvent.dragAndDrop`
шлёт HTML5 `DragEvent` — для pointer-capture **silently no-op'ит**.
Нужен `dragWithPointer` (raw PointerEvent dispatch). Для kanban
(если HTML5 draggable=true) — отдельный `dragWithDragEvent` обёрткой
над `userEvent.dragAndDrop`.

**`test.concurrent` запрещён политикой.** Module-level builder
counter (`let counter = 0`) race'ит под concurrent execution.
Запрет документируется комментарием в `setup-browser.ts`.

**Boot — два уровня.** Level 1 fast: `setStoreState` + `<Shell />`
(для ~70% тестов — per-screen behavior). Level 2 real: `installFS`
+ `<App />` + `vi.advanceTimersByTimeAsync(20)` (для J-3, J-1, F-9
— persistence/journey).

## Реализация

### E1.1 `src/services/clock.ts` (создать)

```ts
// Single source of "now" for the whole app. Tests freeze this via
// vi.setSystemTime; production reads wall-clock.
export function now(): Date {
  return new Date();
}

export function today(): Date {
  const d = now();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function nowISO(): string {
  return now().toISOString();
}

export function nowMs(): number {
  return now().getTime();
}
```

**Не добавлять** `nowUTC()` или другие варианты до первого реального
требования.

### E1.2 Миграция 26 callsites на `clock.now()` / `clock.today()`

Точный список (по `grep` в `src/`):

| Файл | Строки |
|---|---|
| `services/time-utils.ts` | 59, 100, 147 |
| `services/file-io.ts` | 165 |
| `services/format.ts` | 45 |
| `services/contact-stats.ts` | 12 |
| `services/routine-stats.ts` | 65, 126 |
| `services/command-executor.ts` | 368 |
| `services/seed-migration.ts` | 121 |
| `services/dashboard-context.ts` | (audit grep) |
| `hooks/useToday.ts` | 11, 17, 22, 29 |
| `hooks/usePlannerCommands.ts` | 34 |
| `pages/PlannerPage.tsx` | 40 (`new Date`), 73 (`Date.now`) |
| `components/shared/Toast.tsx` | 40 (`Date.now`) |
| `components/entities/EntityEditor.tsx` | 52 |
| `components/entities/detail/GoalDetail.tsx` | 58 |
| `components/entities/detail/RoutineDetail.tsx` | 18-21 |
| `components/entities/editor/HistoryEditor.tsx` | 10 |
| `store/horizon.ts` | 21 |
| `store/ui.ts` | 431 |

**Паттерн миграции (default-параметры):**
```ts
// before:
export function urgClass(deadline: string | null,
                         today: Date = new Date()): string {

// after:
import { now } from "./clock";
export function urgClass(deadline: string | null,
                         todayDate: Date = now()): string {
```

**Паттерн миграции (`Date.now()`):**
```ts
// before:
const id = `toast-${Date.now()}`;

// after:
import { nowMs } from "../../services/clock";
const id = `toast-${nowMs()}`;
```

Прогнать `task check` после каждых 5-7 файлов — поймать тип-эррор
рано. Финальный grep:

```sh
grep -rn 'new Date()' src/ --include='*.ts' --include='*.tsx' \
  | grep -v clock.ts
grep -rn 'Date\.now(' src/ --include='*.ts' --include='*.tsx' \
  | grep -v clock.ts
```

Пусто = миграция готова. Если что-то остаётся — это либо
осознанный wall-clock (тогда `// eslint-disable-next-line` с
обоснованием), либо пропущено.

### E1.3 ESLint guard — после миграции

В `eslint.config.js` (flat-config) добавить блок:

```js
{
  files: ["src/**/*.{ts,tsx}"],
  ignores: [
    "src/services/clock.ts",
    "scripts/**",
  ],
  rules: {
    "no-restricted-syntax": ["error",
      {
        selector:
          "NewExpression[callee.name='Date'][arguments.length=0]",
        message:
          "Use clock.now() / clock.today() — raw `new Date()` " +
          "breaks frozen-clock tests.",
      },
      {
        selector:
          "CallExpression[callee.object.name='Date'][callee.property.name='now']",
        message:
          "Use clock.nowMs() — raw `Date.now()` breaks " +
          "frozen-clock tests.",
      },
    ],
  },
},
```

`src/test/**` НЕ в `ignores` — тестовые builders читают через
`clock.now()` (после `freezeClock` он возвращает frozen момент).

Verify: прогнать `task check` — green.

### E1.4 `src/test/clock.ts` (создать)

```ts
import { vi } from "vitest";

// Wednesday, ISO 2025-w24, no DST in MSK/US, mid-month.
// 10:00 falls inside ConfigFileSchema's deep-work slot 08:00-13:00.
export const FROZEN_NOW = new Date("2025-06-11T10:00:00");

export function freezeClock(now: Date = FROZEN_NOW): void {
  vi.useFakeTimers();
  vi.setSystemTime(now);
}

export function thawClock(): void {
  vi.useRealTimers();
}
```

### E1.5 `src/test/virtual-fs.ts` (создать)

См. §3.1.2 спеки — code snippet полный, переносится 1:1. Ключевые
моменты:

- `Map<string, string>` файлы + `Set<string>` директории
- `read()` бросает `ENOENT: ${path}` (как `fs::read_to_string`)
- `list(dir)` возвращает имена файлов **и** explicitly-ensured
  subdirs (mirrors `fs::read_dir`)
- `move(from, to)` создаёт parent dirs (mirrors Rust `move_file`
  через `fs::create_dir_all`)
- `delete(path)` — НЕ удаляет dirs (commands/{pending,done,failed}
  rutинно пустые)
- `installFS(fs)` — module-level current FS + `mockIPC` callback
  обслуживает 8 команд: `read_file`, `write_file`, `file_exists`,
  `ensure_dir`, `list_files`, `move_file`, `delete_file`,
  `get_data_dir`

**`get_data_dir` возвращает `/tuzov-test/data`** (не
`/tuzov-test` — иначе command-processor path guard блокирует).

`mockIPC(callback, { shouldMockEvents: true })` — флаг для
`emit/listen` (стабилен с `@tauri-apps/api` 2.7.0).

### E1.6 `src/test/builders/` (создать)

Файлы:
- `block.ts` — `buildBlock(overrides) → Block`
- `task.ts` — `buildTask(overrides) → TaskEntity`
- `project.ts` — `buildProject(overrides) → ProjectEntity`
- `direction.ts` — `buildDirection(overrides) → DirectionEntity`
- `pool.ts` — `buildPoolItem(overrides) → PoolItem`
- `horizon.ts` — `buildHorizonProject(overrides) → HorizonProject`
- `command.ts` — `buildCommand(overrides) → Command`
- `traits.ts` — функции-`...spread` (`onToday()`, `inDeepWorkSlot()`,
  `done()`, `withDeadlineIn(days)`)
- `index.ts` — реэкспорт + `resetBuilderCounters()`

Каждый builder:
- `EntitySchema.parse(...)` (или соответствующая schema) — Zod
  ловит сразу любое нарушение
- `let counter = 0` модульный + `export function resetXxxCounter()`
- ID в формате `task-1`, `task-2`, ... (predictable)
- Дефолт всех `created_at`/`updated_at` через `clock.now().toISOString()`
  — frozen clock делает их детерминированными

Точные snippets — §3.3 спеки. Traits — §3.3.2.

### E1.7 `src/test/scenarios/` (создать)

- `empty.ts` — `empty(): VirtualFS` — пустые `commands/{pending,
  done,failed}/`, минимально валидный `config.json`. **Никаких**
  entities/schedule/pool. Покрывает первый запуск +
  `readJsonFileOrCreate` recovery.
- `typical-week.ts` — `typicalWeek(): VirtualFS` — текущая неделя
  `2025-w24` + 6 entities (3 task + 2 project + 1 direction) + 3
  blocks (today/tomorrow/yesterday-done) + пустой pool/horizon.
  Дефолт для большинства тестов.

`with-pending-commands.ts` — **отложен до E5** (нужен только для
F-9). Описание есть в §3.4.

ROOT константа — `"/tuzov-test/data"`.

Полный snippet — §3.4 спеки.

### E1.8 `src/test/e2e/automation.ts` (создать)

POM-lite. **Критично**: code должен быть совместим с `@vitest/
browser` v4 + `vitest-browser-react` 1.x:

- `getByPlaceholder` (НЕ `getByPlaceholderText`)
- `screen` это `RenderResult` параметр (НЕ global)
- НЕТ `findBy*` — только `getBy*` с `await expect.element(...)`
- `userEvent.type(input, text)` — без `.element()` cast

Helpers:
- `quickAdd(screen, text)` — Cmd+N → ввод → Enter. Scope под
  `getByRole("dialog", { name: /быстрое создание/i })` чтобы не
  collide с `TaskBar.tsx:123` placeholder
- `gotoScreen(screen, name)` — клик по `[data-tab="<name>"]`
  (структурный атрибут, не локализованный regex)
- `expectScreen(screen, name)` — `await expect.element(querySelector
  ('[data-screen="..."]')).toBeVisible()`
- `pressKey(combo)` — `userEvent.keyboard(combo)`
- `setStoreState(updates)` — bypass UI, hydrate stores напрямую
  (для Level 1 fast тестов)

Полный snippet — §3.5.1 спеки.

### E1.9 `src/test/e2e/drag.ts` (создать)

Два helper'а:

- `dragWithPointer(source: Locator, target: { x, y }, opts?)` —
  raw `PointerEvent` dispatch с N intermediate `pointermove` чтобы
  пройти `DRAG_THRESHOLD_PX = 5` в `useBlockGesture.ts`. Для
  Plan-блоков, Pool→grid, Horizon backlog.
- `dragWithDragEvent(source: Locator, target)` — обёртка над
  `userEvent.dragAndDrop`. Для kanban (Projects, если HTML5
  draggable).

Полный snippet — §3.5.2 спеки.

### E1.10 `src/test/e2e/selectors.ts` (создать)

```ts
export const sel = {
  topNav: {
    plan: '[data-tab="plan"]',
    tasks: '[data-tab="tasks"]',
    projects: '[data-tab="projects"]',
    context: '[data-tab="context"]',
    horizon: '[data-tab="horizon"]',
    review: '[data-tab="review"]',
  },
  quickAdd: {
    dialog: { role: "dialog" as const,
              name: /быстрое создание/i },
    input: "Что добавить?",
  },
  planner: {
    grid: '[data-testid="planner-grid"]',
    dayBody: (date: string) => `.day-body[data-date="${date}"]`,
    block: (title: string) => new RegExp(`^${title},`, "i"),
  },
};
```

### E1.11 `data-tab` / `data-screen` / `data-testid` в компоненты

Точечные правки (помечать комментом `// for E2E selector`):

- `src/components/layout/TopNav.tsx` — каждой кнопке навигации
  атрибут `data-tab="plan"|"tasks"|...`
- `src/pages/{PlannerPage,TasksPage,ProjectsPage,ContextPage,
  HorizonPage,ReviewPage}.tsx` — корневой элемент `data-screen=
  "plan"|...`
- `src/pages/PlannerPage.tsx` — на grid-контейнер `data-testid=
  "planner-grid"`; на каждую `.day-body` ячейку `data-date="<ISO>"`

Никакой косметики, только атрибуты.

### E1.12 Service singletons reset

Файл `src/test/reset-singletons.ts`:

```ts
import { __resetDataDirCacheForTests }
  from "../services/file-io";
import { __resetSeedMigrationForTests }
  from "../services/seed-migration";
import { __resetCommandProcessorForTests }
  from "../services/command-processor";
import { __resetDashboardHotReloadForTests }
  from "../services/dashboard-hot-reload";
import { clearWeekCache } from "../services/week-cache";
import { invalidatePoolCache }
  from "../services/review-aggregations";

export function resetServiceSingletons(): void {
  __resetDataDirCacheForTests();
  __resetSeedMigrationForTests();
  __resetCommandProcessorForTests();
  __resetDashboardHotReloadForTests();
  clearWeekCache();
  invalidatePoolCache();
}
```

В каждом сервисе добавить export с комментом `// only for
src/test/** — do not call from prod`:

- `services/file-io.ts:30` — сбросить `cachedDataDir = null`
- `services/seed-migration.ts:59` — сбросить `inflight = null`
- `services/command-processor.ts:43-69` — сбросить `started =
  false`, `inflight = null`, `chain = Promise.resolve()`
- `services/dashboard-hot-reload.ts` — сбросить `installed = false`

`week-cache.ts` и `review-aggregations.ts` уже имеют public
`clearWeekCache()` / `invalidatePoolCache()`.

### E1.13 Write-queue flush exports

В каждом из 5 файлов добавить export:

```ts
// src/services/entities-write-queue.ts (и аналогично в 4 других)
let inflight: Promise<unknown> = Promise.resolve();
// ... existing enqueueXxxWrite ...

// Test-only: awaits any pending write-chain.
// Do not call from prod.
export async function flushEntitiesQueue(): Promise<void> {
  await inflight;
}
```

Файлы:
- `services/entities-write-queue.ts` → `flushEntitiesQueue`
- `services/pool-write-queue.ts` → (имя по факту, обычно
  `flushPoolQueue`)
- `services/horizon-write-queue.ts` → `flushHorizonQueue`
- `services/week-write-queue.ts` (для schedule) → `flushWeekQueue`
- `services/config-write-queue.ts` → `flushConfigQueue`

(Имена queue-функций уточнить grep'ом по существующим файлам.)

В `src/test/e2e/automation.ts` aggregator:

```ts
export async function flushAllWrites(): Promise<void> {
  await Promise.all([
    flushEntitiesQueue(),
    flushPoolQueue(),
    flushHorizonQueue(),
    flushWeekQueue(),
    flushConfigQueue(),
  ]);
}
```

### E1.14 `App.loadAll()` refactor

В `src/App.tsx` — extract async-IIFE из useEffect (текущий
`App.tsx:46-102`) в exported function:

```tsx
export async function loadAll(
  opts?: { signal?: AbortSignal }
): Promise<void> {
  await ensureDataDir();
  const migrated = await maybeMigrateToV2();
  if (opts?.signal?.aborted) return;
  await Promise.all([
    useConfigStore.getState().loadConfig(),
    useEntityStore.getState().loadEntities(),
    useScheduleStore.getState().loadCurrentWeek(),
    usePoolStore.getState().loadCurrentWeek(),
    useHorizonStore.getState().loadHorizon(),
    useDashboardStore.getState().loadDashboards(),
  ]);
  if (opts?.signal?.aborted) return;
  reconcileHorizon();
  startCommandProcessor();
}

export default function App() {
  const setBootReady = useUIStore((s) => s.setBootReady);
  useEffect(() => {
    const ctrl = new AbortController();
    let cancelled = false;
    void loadAll({ signal: ctrl.signal })
      .then(() => { if (!cancelled) setBootReady(true); })
      .catch(/* show fatal-error UI */);
    return () => { cancelled = true; ctrl.abort(); };
  }, [setBootReady]);
  // existing safety/show timer + paint yield...
  return <Shell />;
}
```

Точные имена store-actions (`loadConfig` / `loadEntities` /
`loadCurrentWeek` / `loadHorizon` / `loadDashboards`) — взять из
текущего useEffect-IIFE один-в-один. **Не** переименовывать.

### E1.15 vitest config + setup-browser

В `vitest.config.ts` переименовать project `smoke-browser` →
`e2e-browser`, расширить `include`:

```ts
{
  name: "e2e-browser",
  include: [
    "src/**/*.e2e.test.tsx",
    "src/**/*.browser.test.tsx",  // legacy, удаляется в E1.16
  ],
  setupFiles: ["src/test/setup-browser.ts"],
  browser: {
    enabled: true,
    provider: "playwright",
    instances: [{ browser: "chromium" }],
    headless: true,
    screenshotFailures: false,
  },
},
```

Полностью переписать `src/test/setup-browser.ts` (полный snippet —
§3.6.2 спеки):

```ts
(globalThis as { __APP_MODE__?: string }).__APP_MODE__ = "test";

import { afterAll, afterEach, beforeEach } from "vitest";
import { clearMocks } from "@tauri-apps/api/mocks";
import { resetAllStores } from "./stores";
import { resetServiceSingletons } from "./reset-singletons";
import { freezeClock, thawClock } from "./clock";
import { resetBuilderCounters } from "./builders";
import { installFS, VirtualFS } from "./virtual-fs";
import "../styles/globals.css";

// `test.concurrent` is forbidden in this project — module-level
// builder counters race under concurrent execution.

beforeEach(() => {
  resetAllStores();
  resetServiceSingletons();
  resetBuilderCounters();
  freezeClock();
  installFS(new VirtualFS());
});

afterEach(() => {
  thawClock();
  clearMocks();   // moved from afterAll — listener leaks otherwise
});
```

Старый `src/test/mock-ipc.ts` **удаляется** — заменён `virtual-fs.ts`.

### E1.16 Миграция 3 существующих тестов

Переименовать (с `git mv`):
- `src/pages/PlannerPage.browser.test.tsx` →
  `src/pages/PlannerPage.e2e.test.tsx`
- `src/pages/TasksPage.browser.test.tsx` →
  `src/pages/TasksPage.e2e.test.tsx`
- `src/pages/__screenshots__/TasksPage.browser.test.tsx/` →
  `src/pages/__screenshots__/TasksPage.e2e.test.tsx/`

**Критично:** screenshot baseline directory **должен**
переименоваться синхронно — иначе vitest создаст новый baseline
и diff будет всегда зелёным (false-confidence).

Адаптировать тесты под новый API:
- `installFS(typicalWeek())` вместо stub `mockIPC`
- `setStoreState({...})` или `useXxxStore.setState(...)` —
  как в спеке §5.1
- Plan DnD — `dragWithPointer` (раньше работал через
  `userEvent.dragAndDrop` случайно)
- Tasks screenshot — `toMatchScreenshot("tasks-list", {
  comparatorOptions: { allowedMismatchedPixelRatio: 0.005 } })`
  (НЕ `toHaveScreenshot` — это Playwright API)

После миграции в `vitest.config.ts` убрать `*.browser.test.tsx`
из `include` (legacy не нужен).

## Файлы

| Файл | Действие |
|---|---|
| `src/services/clock.ts` | Создать |
| `src/services/time-utils.ts` | Изменить (3 callsites) |
| `src/services/file-io.ts` | Изменить (1 callsite + `__resetDataDirCacheForTests`) |
| `src/services/format.ts` | Изменить (1 callsite) |
| `src/services/contact-stats.ts` | Изменить (1 callsite) |
| `src/services/routine-stats.ts` | Изменить (2 callsites) |
| `src/services/command-executor.ts` | Изменить (1 callsite) |
| `src/services/seed-migration.ts` | Изменить (1 callsite + `__resetSeedMigrationForTests`) |
| `src/services/command-processor.ts` | Изменить (`__resetCommandProcessorForTests`) |
| `src/services/dashboard-context.ts` | Изменить (audit + миграция) |
| `src/services/dashboard-hot-reload.ts` | Изменить (`__resetDashboardHotReloadForTests`) |
| `src/services/entities-write-queue.ts` | Изменить (`flushEntitiesQueue`) |
| `src/services/pool-write-queue.ts` | Изменить (`flushPoolQueue`) |
| `src/services/horizon-write-queue.ts` | Изменить (`flushHorizonQueue`) |
| `src/services/week-write-queue.ts` (или как называется в репо для schedule) | Изменить (`flushWeekQueue`) |
| `src/services/config-write-queue.ts` | Изменить (`flushConfigQueue`) |
| `src/hooks/useToday.ts` | Изменить (4 callsites) |
| `src/hooks/usePlannerCommands.ts` | Изменить (1 callsite) |
| `src/pages/PlannerPage.tsx` | Изменить (2 callsites + `data-screen`/`data-testid`/`data-date`) |
| `src/pages/TasksPage.tsx` | Изменить (`data-screen="tasks"`) |
| `src/pages/ProjectsPage.tsx` | Изменить (`data-screen="projects"`) |
| `src/pages/ContextPage.tsx` | Изменить (`data-screen="context"`) |
| `src/pages/HorizonPage.tsx` | Изменить (`data-screen="horizon"`) |
| `src/pages/ReviewPage.tsx` | Изменить (`data-screen="review"`) |
| `src/components/layout/TopNav.tsx` | Изменить (`data-tab` атрибуты) |
| `src/components/shared/Toast.tsx` | Изменить (1 callsite) |
| `src/components/entities/EntityEditor.tsx` | Изменить (1 callsite) |
| `src/components/entities/detail/GoalDetail.tsx` | Изменить (1 callsite) |
| `src/components/entities/detail/RoutineDetail.tsx` | Изменить (4 callsites) |
| `src/components/entities/editor/HistoryEditor.tsx` | Изменить (1 callsite) |
| `src/store/horizon.ts` | Изменить (1 callsite) |
| `src/store/ui.ts` | Изменить (1 callsite) |
| `src/App.tsx` | Изменить (extract `loadAll()` exported function) |
| `src/test/clock.ts` | Создать |
| `src/test/virtual-fs.ts` | Создать |
| `src/test/reset-singletons.ts` | Создать |
| `src/test/builders/block.ts` | Создать |
| `src/test/builders/task.ts` | Создать |
| `src/test/builders/project.ts` | Создать |
| `src/test/builders/direction.ts` | Создать |
| `src/test/builders/pool.ts` | Создать |
| `src/test/builders/horizon.ts` | Создать |
| `src/test/builders/command.ts` | Создать |
| `src/test/builders/traits.ts` | Создать |
| `src/test/builders/index.ts` | Создать |
| `src/test/scenarios/empty.ts` | Создать |
| `src/test/scenarios/typical-week.ts` | Создать |
| `src/test/e2e/automation.ts` | Создать |
| `src/test/e2e/drag.ts` | Создать |
| `src/test/e2e/selectors.ts` | Создать |
| `src/test/setup-browser.ts` | Изменить (полный rewrite) |
| `src/test/mock-ipc.ts` | Удалить |
| `vitest.config.ts` | Изменить (rename project, include `*.e2e.test.tsx`) |
| `eslint.config.js` | Изменить (`no-restricted-syntax` rule) |
| `src/pages/PlannerPage.browser.test.tsx` | Переименовать → `*.e2e.test.tsx` (`git mv`), адаптировать под новый API |
| `src/pages/TasksPage.browser.test.tsx` | Переименовать → `*.e2e.test.tsx` (`git mv`), адаптировать |
| `src/pages/__screenshots__/TasksPage.browser.test.tsx/` | Переименовать → `TasksPage.e2e.test.tsx/` (`git mv`) |

## Верификация

1. `task check` зелёный (typecheck + lint + cargo test + vitest +
   fe:build).
2. `npm run test` показывает 4 vitest project'а: `unit`,
   `smoke-jsdom`, `e2e-browser` (с 3 тестами), `cargo-test`.
3. ESLint: добавить в любой файл `src/**` `const x = new Date()`
   — `npm run lint` падает с сообщением «Use clock.now()...».
   Откатить.
4. ESLint: `const x = Date.now()` — падает с сообщением «Use
   clock.nowMs()...». Откатить.
5. Frozen clock: в любом тесте `expect(now()).toEqual(new
   Date("2025-06-11T10:00:00"))` проходит.
6. Виртуальная FS round-trip: ad-hoc тест
   ```ts
   installFS(new VirtualFS());
   await invoke("write_file", {
     path: "/tuzov-test/data/x.json", content: "y",
   });
   const r = await invoke("read_file", {
     path: "/tuzov-test/data/x.json",
   });
   expect(r).toBe("y");
   ```
   проходит.
7. 3 мигрированных теста (PlannerPage drag, TasksPage Cmd+N,
   TasksPage screenshot V-1) — зелёные. Запустить 3 раза подряд —
   стабильно зелёные.
8. Screenshot baseline в `src/pages/__screenshots__/TasksPage.e2e.
   test.tsx/tasks-list.png` существует, идентичен предыдущему
   (`git diff` бинарник = ничего).
9. Если намеренно сломать `command-processor.ts` `started`
   reset — F-9 будет падать в E5; в E1 регрессии нет, потому что
   нет F-9 пока.
10. Запустить `task check` 3 раза подряд — без флака.

## Заметки для реализации

- **Объём работы — ~12-16 ч.** Это 1.5-2 рабочих дня, не одна
  сессия. Внутри фазы коммит **один** в конце; чекпоинты — в
  голове, не в git.
- Прогонять `task check` после каждого крупного шага (clock
  миграция, virtual-fs создание, automation, миграция тестов) —
  если упало, фиксить до перехода дальше. В конце 4-3 раза подряд
  для проверки стабильности.
- Migration `new Date()` — можно делать пакетами по 5-7 файлов.
  `task typecheck` валит сразу — поймать опечатки рано.
- Builders и scenarios — после `clock.ts`. Иначе дефолты
  `created_at = now().toISOString()` будут wall-clock.
- `App.loadAll()` — копи-паста существующего useEffect-IIFE,
  не переписывание. Если что-то перестало работать после
  refactor'а — значит зацепили side-effect, который зависел от
  IIFE-scope. Откатить и подумать.
- 3 миграции тестов — самая хрупкая часть. PlannerPage `userEvent.
  dragAndDrop` сейчас работает «по случаю» через chromium HTML5
  polyfill — после перехода на `dragWithPointer` может потребовать
  тюнинга `target.x/y` (вычислять через
  `getBoundingClientRect()` целевой `.day-body[data-date="..."]`
  ячейки).
- TasksPage screenshot — после миграции на `toMatchScreenshot`
  (vitest API) сравнить новый baseline с тем что был в git.
  Должны быть идентичны (фронт не трогали). Если не идентичны —
  значит API чуть-чуть рендерит иначе; принять новый baseline и
  обновить.
- **НЕ коммитить** до smoke от юзера. Сообщить:

  > E1 готов: clock + virtual FS + builders + automation, 3
  > мигрированных теста зелёные, ESLint guard активен. `task
  > check` зелёный 3 раза подряд. Прогони у себя.

- Возможный subject (≤50):
  ```
  feat(test): e2e foundation with virtual fs
  ```

- Если в процессе откроется что какая-то store-action или
  service-export называется не как в этом плане (например, не
  `flushEntitiesQueue`, а `flushEntityWrites`) — корректировать
  по факту в коде, не в плане.
