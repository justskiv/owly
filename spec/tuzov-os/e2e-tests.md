# E2E-тесты для TuzovOS — спецификация (rev. 2)

Документ-источник для нарезки на фазы. Покрывает: что значит E2E в
этом проекте, какую инфру дотягиваем поверх Phase 01–04 smoke-инфры,
как обеспечить стабильные данные «как будто сейчас Среда такой-то
недели», что именно тестируем, что осознанно не тестируем.

**rev. 2** учитывает результаты глубокого ревью 12 reviewer'ами
(см. §13.1 changelog). Главные правки: DataRoot переехал в
`/tuzov-test/data`, миграция clock'а расширена до 26+ сайтов, code
snippets приведены в соответствие с реальным `@vitest/browser` v4 и
`vitest-browser-react` 1.x, добавлены §3.7 (service singletons
reset) и §3.8 (boot через `App.loadAll()`), убраны 5 invented-
features тестов (F-4/F-5/F-6/F-7/F-10), добавлено 4 daily-use
journey, итог — 35 новых + 3 миграции.

Параллельные research-документы (`tmp/`):
- `smoke-tests-research.md` (rev.2) — почему выбран Vitest browser
  mode + Chromium, почему tauri-driver на macOS отброшен, что в
  коробке у `@tauri-apps/api/mocks`.
- `research-electron-e2e.md` — что делают зрелые Electron-проекты
  (VS Code и др.), какие паттерны переносимы.
- `research-e2e-fixtures.md` — frozen-clock vs relative, builders vs
  static fixtures, ESLint-guard, calendar-app references.

---

## TL;DR

1. **«E2E» = feature-level через React+Chromium с виртуальной FS
   вместо реального диска.** Это не shell-level — полный Tauri
   binary на macOS не автоматизируем (issue #7068). Rust-сторону уже
   ловит Phase 04 (cargo + MockRuntime). Реальные dialogs / native
   menu / file watchers / packaging остаются на manual smoke от
   юзера (~5%).
2. **Один новый vitest project — `e2e-browser`** — рождается из
   переименования `smoke-browser`. Туда мигрируют 3 существующих
   теста и добавляется ~35 новых.
3. **Виртуальная FS в `mockIPC`** — Map-based, round-trip
   read/write/list/move/delete. **Корень = `/tuzov-test/data`** (а
   не `/tuzov-test`) — иначе `command-processor` отвергает пути.
4. **Frozen clock = `2025-06-11T10:00:00`** (среда, ISO `2025-w24`,
   без DST). **Миграция 26+ сайтов** (не ~6 как в rev.1) —
   подробный список в §3.2.3.
5. **Builders + traits** — но **по типу** (`buildTask`,
   `buildProject`, `buildDirection` отдельно), не один универсальный
   `buildEntity` — `EntitySchema` это discriminated union, single-
   builder ломает narrowing.
6. **Automation library — POM-lite** в `src/test/e2e/`: `quickAdd`,
   `gotoScreen` (через `data-tab`, не локализованные regex'ы),
   `dragBlockTo` для HTML5-DnD, **новый `dragWithPointer`** для
   custom-pointer hooks (Plan/PoolSidebar используют `pointerdown`,
   а не `dragstart`).
7. **3 сценария seed** в виртуальную FS: `empty`, `typical-week`,
   `with-pending-commands`. `dense-week` отложен — добавим когда
   первый тест докажет потребность.
8. **ESLint-guard на `new Date()` И `Date.now()`** вне `clock.ts`,
   **после** полной миграции — иначе `task check` сломается
   немедленно.
9. **Service singletons reset** в `beforeEach` (§3.7) — Zustand
   `resetAllStores()` не чистит `cachedDataDir`, `week-cache`,
   `command-processor.started`, `seed-migration.inflight`,
   `dashboard-hot-reload.installed`. Без этого order-dependent
   flake через 2-3 недели.
10. **Boot через настоящий `App.loadAll()`** (refactor App.tsx,
    extract useEffect-IIFE в exported function) — для тестов с
    реальным boot-flow. Лёгкие тесты — `setStoreState` напрямую,
    как существующие smokes.
11. **Visual regression — 2 кадра**: V-1 Tasks (есть), V-2 Review
    summary. V-3 (Quick Add) drop'нут — focus-ring и animation
    flake. Threshold `allowedMismatchedPixelRatio: 0.005`.

---

## 1. Что значит «E2E» в этом проекте

### 1.1. Что тестируем

Полный путь пользователя через React-приложение, пересекая все
границы кроме реального Tauri-runtime:

- Реальный `Shell.tsx` со всеми 6 экранами + 2 debug, **либо**
  реальный `App.tsx` с boot-flow (см. §3.8)
- Реальные Zustand stores (8 штук)
- Реальная Zod-валидация на read/write
- Реальный Chromium через `@vitest/browser` Playwright provider
- **Виртуальная файловая система** — `mockIPC` round-trip'ом
  обслуживает `read_file/write_file/list_files/file_exists/
  ensure_dir/move_file/delete_file/get_data_dir`
- **Frozen clock** — `getCurrentWeekId()`, `nowISO()` и весь
  date math привязан к одному моменту между запусками

### 1.2. Что не тестируем (и почему)

| Слой | Почему не |
|---|---|
| Реальный Tauri shell на macOS | Issue tauri-apps/tauri#7068 без движения. `safaridriver` не attach-ится к WKWebView. tauri-driver — Linux/Windows. `@crabnebula/tauri-driver` существует с macOS-поддержкой через `tauri-plugin-automation`, но платный — оставляем как backup. |
| Native menu bar / `tauri-plugin-global-shortcut` | Не достижимы через DOM-event. Manual smoke от юзера. JS-реакция на `menu` event при необходимости — отдельной unit-проверкой. |
| Native file dialogs (`tauri-plugin-dialog`) | Невозможно из webview без приватного API. |
| File watchers (`notify` крейт) | Требуют реальные fsevents события. Watcher-driven flow тестируем **явным вызовом** processor'а из теста (не имитируем notify). |
| Window state plugin | Прозрачен для UI, ловится приёмкой. |
| Packaging / notarization | Release-pipeline. Manual smoke. |
| Performance / нагрузка | Другая категория. |
| Atomic write tmp+rename | VirtualFS делает прямую `Map.set()` — partial-read window не моделируется. Acknowledged tradeoff: атомарность проверяется Phase 04 unit-тестом `write_file_persists_and_reads_back`, плюс `command-processor.ts` уже имеет `PARSE_RETRY_MS = 80` retry для partial-read. |

Вывод: **5%-й слой** покрывается ручным smoke'ом от юзера перед
коммитом UX-изменений (как и сейчас по `feedback_no_commit_before_
user_test.md`). 95% — в zone-of-test.

### 1.3. Соотношение со смоками

Phase 01–04 закрыли **smoke pyramid**:
- `unit` (14 файлов в `src/services/*.test.ts`) — services
  pure-logic. Многие выполняют по 5–25 кейсов.
- `smoke-jsdom` (4 теста: Context, Horizon, Review, app-flow) —
  render-краши, базовый interactivity.
- `smoke-browser` (3 теста в 2 файлах: PlannerPage DnD,
  TasksPage Cmd+N + screenshot) — реальный layout, real DnD.
- `cargo test --lib` (10 тестов) — Rust commands через
  MockRuntime.

**Smoke ≠ E2E.** Smoke ловит «компонент белым экраном упал» и одну
happy-path-ленту. E2E покрывает feature-by-feature: drag из pool
создаёт блок с правильными полями; Quick Add `!завтра` ставит
правильную дату; write → reload → read возвращает то же самое;
pending-команда после processor'а перемещается в `done/`.

**Что НЕ дублируем в E2E** (живёт в unit и не нужно повторять
через Chromium): grouping (`group-tasks.test.ts`), urgency
(`urgency.test.ts`), Quick Add tokenizer (`quick-add-tokenizer.
test.ts` ~25 кейсов), gauge math, project filter logic,
horizon-helpers, context-helpers. На каждый из этих helper'ов в
E2E — **один wiring-смок**, что UI его читает и рисует, не пере-
тестирование case-list'а.

### 1.4. Где живут новые тесты

```
src/test/
├── setup.ts                  # smoke-jsdom (как сейчас)
├── setup-browser.ts          # smoke-browser → e2e-browser
├── mock-ipc.ts               # ↓ заменяется на virtual-fs.ts wrapper
├── stores.ts                 # как сейчас
├── clock.ts                  # NEW: freezeClock / thawClock
├── reset-singletons.ts       # NEW: service-singleton resets
├── virtual-fs.ts             # NEW: VirtualFS class + installFS
├── builders/
│   ├── block.ts
│   ├── task.ts               # NEW: per-type
│   ├── project.ts            # NEW: per-type
│   ├── direction.ts          # NEW: per-type
│   ├── pool.ts
│   ├── horizon.ts
│   ├── command.ts
│   ├── traits.ts             # onToday(), done()...
│   └── index.ts              # resetBuilderCounters
├── scenarios/
│   ├── empty.ts
│   ├── typical-week.ts
│   └── with-pending-commands.ts
├── e2e/
│   ├── automation.ts         # quickAdd, gotoScreen...
│   ├── drag.ts               # dragWithPointer + dragWithDragEvent
│   └── selectors.ts          # data-tab/data-testid маппинги
├── fixtures/                 # legacy edge.ts → builder-based
│   ├── empty.ts
│   ├── typical.ts
│   └── edge.ts
└── *.smoke.test.tsx          # cross-screen flow (jsdom, current)

src/services/clock.ts          # NEW: now/today/nowISO
src/pages/*.e2e.test.tsx       # NEW: per-screen E2E
src/test/e2e/*.test.tsx        # NEW: cross-screen + journey E2E
```

Существующие `*.browser.test.tsx` (PlannerPage drag, TasksPage Cmd+N
+ screenshot) **мигрируем** в `*.e2e.test.tsx` под новую инфру в
Foundation-фазе. Они становятся первыми членами E2E-suite.

---

## 2. Существующая инфра — что уже работает

Ничего из перечисленного **не пересоздаём**:

- `__APP_MODE__ = "test"` sandbox guard в `src/services/file-io.
  ts:18-28` — отказывает реальному `invoke()` если mockIPC не
  активен. Виртуальная FS не сможет «утечь» на реальный диск.
- `mockIPC` из `@tauri-apps/api/mocks` (стабильно с 2.7.0,
  включая `shouldMockEvents: true` для emit/listen) — расширяем,
  не заменяем.
- `resetAllStores()` в `src/test/stores.ts` — чистит все 8 stores
  через `setState(initial, true)` (replace-flag).
- 3 vitest project'а в `vitest.config.ts` — `unit`,
  `smoke-jsdom`, `smoke-browser` (последний → `e2e-browser`).
- ESLint, TypeScript strict, Zod-схемы, `task check` контракт.
- Phase 04 cargo-тесты — Rust-сторона покрыта.

---

## 3. Архитектурные решения

### 3.1. Виртуальная FS

#### 3.1.1. Зачем

Текущий `src/test/mock-ipc.ts` — заглушка-stub:

```ts
mockIPC(async (cmd) => {
  if (cmd === "read_file") return "";       // всегда пусто
  if (cmd === "write_file") return null;    // молча
  if (cmd === "file_exists") return false;  // ничего нет
  // ...
});
```

С такой моделью невозможно проверить:
- «entity создан → перезагрузка → entity на месте»
  (persist-first паттерн);
- command queue (`pending/<id>.json` → processor →
  `done/<id>.json`);
- write-queue flush (write → следующее чтение возвращает свежее);
- boot-flow с `readJsonFileOrCreate` recovery.

#### 3.1.2. Дизайн

```ts
// src/test/virtual-fs.ts
import { mockIPC } from "@tauri-apps/api/mocks";

export class VirtualFS {
  private files = new Map<string, string>();
  private dirs = new Set<string>();

  read(path: string): string {
    const c = this.files.get(path);
    if (c === undefined) throw new Error(`ENOENT: ${path}`);
    return c;
  }

  write(path: string, content: string): void {
    this.files.set(path, content);
    this.registerParents(path);
  }

  exists(path: string): boolean {
    return this.files.has(path) || this.dirs.has(path);
  }

  // Returns names directly under `dir` — both files and explicitly-
  // ensured subdirectories. Mirrors fs::read_dir, not just files.
  list(dir: string): string[] {
    const prefix = dir.endsWith("/") ? dir : dir + "/";
    const names = new Set<string>();
    for (const p of this.files.keys()) {
      if (!p.startsWith(prefix)) continue;
      const rest = p.slice(prefix.length);
      const slash = rest.indexOf("/");
      names.add(slash === -1 ? rest : rest.slice(0, slash));
    }
    for (const d of this.dirs) {
      if (!d.startsWith(prefix)) continue;
      const rest = d.slice(prefix.length);
      const slash = rest.indexOf("/");
      names.add(slash === -1 ? rest : rest.slice(0, slash));
    }
    return [...names].sort();
  }

  ensureDir(path: string): void {
    this.dirs.add(path);
    this.registerParents(path);
  }

  // Real fs::rename creates destination parents (Rust does
  // fs::create_dir_all before the rename in move_file). Virtual FS
  // matches that semantic.
  move(from: string, to: string): void {
    if (!this.files.has(from))
      throw new Error(`ENOENT: ${from}`);
    this.files.set(to, this.files.get(from)!);
    this.files.delete(from);
    this.registerParents(to);
  }

  delete(path: string): void {
    if (!this.files.delete(path))
      throw new Error(`ENOENT: ${path}`);
    // Don't remove dirs — empty dirs are still valid surfaces
    // (commands/{pending,done,failed} are routinely empty).
  }

  snapshot(): Record<string, string> {
    return Object.fromEntries(this.files);
  }

  static fromSnapshot(s: Record<string, string>): VirtualFS {
    const fs = new VirtualFS();
    for (const [k, v] of Object.entries(s)) fs.write(k, v);
    return fs;
  }

  private registerParents(p: string): void {
    let cur = p;
    while (true) {
      const parent = cur.replace(/\/[^/]+$/, "");
      if (!parent || parent === cur) break;
      this.dirs.add(parent);
      cur = parent;
    }
  }
}

// Module-level "current FS" so test helpers can read it without
// passing it everywhere. Reset by installFS().
let currentFS: VirtualFS | null = null;
export function getCurrentFS(): VirtualFS {
  if (!currentFS) throw new Error("No VirtualFS installed");
  return currentFS;
}

export function installFS(fs: VirtualFS): void {
  currentFS = fs;
  mockIPC(async (cmd, args: unknown) => {
    const a = args as Record<string, string>;
    switch (cmd) {
      case "get_data_dir":  return "/tuzov-test/data";
      case "read_file":     return fs.read(a.path);
      case "write_file":    fs.write(a.path, a.content); return null;
      case "file_exists":   return fs.exists(a.path);
      case "ensure_dir":    fs.ensureDir(a.path); return null;
      case "list_files":    return fs.list(a.dir);
      case "move_file":     fs.move(a.from, a.to); return null;
      case "delete_file":   fs.delete(a.path); return null;
    }
    return null;
  }, { shouldMockEvents: true });
}
```

#### 3.1.3. Корень DataRoot — `/tuzov-test/data`

**Критично.** Реальный Rust-side `setup()` делает
`DataRoot(root.join("data"))`, то есть `get_data_dir` возвращает
`<app_root>/data`, не `<app_root>`. Кроме того,
`command-processor.ts:108` отвергает любой path не содержащий
`/data/commands/pending/` (security tightening, commit `8976d20`).

Поэтому в virtual FS:
```
get_data_dir → "/tuzov-test/data"
entities.json   →  /tuzov-test/data/entities.json
schedule/W.json →  /tuzov-test/data/schedule/2025-w24.json
pool/W.json     →  /tuzov-test/data/pool/2025-w24.json
horizon.json    →  /tuzov-test/data/horizon.json
config.json     →  /tuzov-test/data/config.json
dashboards/X    →  /tuzov-test/data/dashboards/<id>.json
commands/pending/cmd-1.json → /tuzov-test/data/commands/pending/cmd-1.json
```

Все scenario-builder'ы используют константу `ROOT = "/tuzov-test/
data"`.

#### 3.1.4. Scope: что НЕ моделируем в виртуальной FS

- **Atomic write через tmp+rename** — `Map.set()` атомарен по
  определению, partial-read window не моделируется. Acknowledged:
  атомарность проверена Phase 04, retry в command-processor
  существует. Это не суть E2E-coverage — структурные регрессии
  ловят unit-тесты.
- **File watchers** — `mockIPC.shouldMockEvents` позволяет
  `emit/listen`, но `notify` крейт (Rust) на virtual FS не
  реагирует. Watcher-flow тестируем **явным вызовом**
  `__processOnePendingForTests()` — экспорт из command-
  processor добавляется в Foundation.
- **Errors транспорта** (disk full, permission denied) — out
  of scope.

### 3.2. Frozen clock

#### 3.2.1. Why frozen, не relative

Подробно — `tmp/research-e2e-fixtures.md` §2. Краткий вывод:
hybrid (freeze + fixtures relative to frozen now) выигрывает почти
всегда. Bug class в E2E — «дано: сегодня среда; ожидается:
правильная подсветка today, urgency-чипы». Безразличен к тому
*какая* среда, важно что *воспроизводимо*.

#### 3.2.2. Канонический момент

```ts
// src/services/clock.ts (prod)
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
```

```ts
// src/test/clock.ts
import { vi } from "vitest";

export const FROZEN_NOW = new Date("2025-06-11T10:00:00");
// Why this date:
// - Wednesday — wd-related ассерты не на границе недели.
// - 10:00 — рабочее утро (попадает в deep-work slot
//   ConfigFileSchema'овый `08:00–13:00`, см. defaults.ts:18).
// - 2025-06 — без DST в MSK и в US tz.
// - Не leap-day, не год-граница, не месяц-граница.
// - ISO week: 2025-w24. Mon=2025-06-09, Sun=2025-06-15. Внутри
//   одного месяца.

export function freezeClock(now: Date = FROZEN_NOW): void {
  vi.useFakeTimers();   // shouldAdvanceTime: false уже default
  vi.setSystemTime(now);
}

export function thawClock(): void {
  vi.useRealTimers();
}
```

**Не пишем `shouldAdvanceTime: false`** — оно и так default,
комментарий в rev.1 о «setTimeout(0) двинут clock» был неверен.
Реальная проблема fake timers — в §5.3 (timer policy для flush).

#### 3.2.3. Полнота freeze: миграция кода

`vi.setSystemTime` подменяет `Date` в Chromium. Но **закэшированный
`new Date()` на загрузке модуля** или прямой `new Date()`/`Date.now()`
в render/handler не покрывается само-собой.

**Полный список миграции** (по grep в `src/`):

| Файл | Строки | Что |
|---|---|---|
| `services/time-utils.ts` | 59, 100, 147 | `getStartOfDay` default, `getCurrentWeekId`, helper |
| `services/file-io.ts` | 165 | recovery timestamp |
| `services/format.ts` | 45 | `isOverdue` default |
| `services/contact-stats.ts` | 12 | `todayISO` |
| `services/routine-stats.ts` | 65, 126 | stats default |
| `services/command-executor.ts` | 368 | `last_act` write |
| `services/seed-migration.ts` | 121 | migration timestamp |
| `services/dashboard-context.ts` | (audit) | проверить |
| `hooks/useToday.ts` | 11, 17, 22, 29 | весь хук |
| `hooks/usePlannerCommands.ts` | 34 | ручка |
| `pages/PlannerPage.tsx` | 40 (`new Date`), 73 (`Date.now`) | now-line tick |
| `components/shared/Toast.tsx` | 40 (`Date.now`) | toast id |
| `components/entities/EntityEditor.tsx` | 52 | `formatDate(new Date())` |
| `components/entities/detail/GoalDetail.tsx` | 58 | history default |
| `components/entities/detail/RoutineDetail.tsx` | 18-21 | log timestamp |
| `components/entities/editor/HistoryEditor.tsx` | 10 | entry timestamp |
| `store/horizon.ts` | 21 | `base_month` default |
| `store/ui.ts` | 431 | `savedAt` |
| `services/quick-add-create.ts` | (косвенно через formatDate) | OK |

**Total: ~26 callsites** в 18 файлах. **Часть из них** уже
принимает `today: Date = new Date()` как DI-параметр (urgency.ts,
group-tasks.ts, context-helpers.ts) — но default всё равно читает
wall-clock и **сломается** при ESLint guard. Решение: переписать
все default'ы с `new Date()` на `clock.now()`:

```ts
// before:
export function urgClass(deadline: string | null, today: Date = new Date()): string {

// after:
import { now } from "./clock";
export function urgClass(deadline: string | null, todayDate: Date = now()): string {
```

#### 3.2.4. ESLint-guard — после миграции

```js
// eslint.config.js
{
  files: ["src/**/*.{ts,tsx}"],
  ignores: [
    "src/services/clock.ts",   // только это место
    "scripts/**",              // npm run seed = real time
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
          "Use clock.nowISO() or clock.now().getTime() — raw " +
          "`Date.now()` breaks frozen-clock tests.",
      },
    ],
  },
},
```

**Sequencing критичен:** ESLint guard **активируется ПОСЛЕ** того
как все 26 сайтов мигрированы — иначе `task check` сразу красный.
Порядок в Foundation:
1. Создать `services/clock.ts`
2. Мигрировать 26 callsites
3. Прогнать `task check` — green
4. Включить ESLint guard
5. Прогнать `task check` ещё раз — green

`src/test/**` НЕ в `ignores` — тестовые builders должны идти через
`clock.now()` (которое после `freezeClock` возвращает frozen
момент). Иначе фикстуры захватят wall-clock.

### 3.3. Builders + traits

#### 3.3.1. Per-type builders, не универсальный `buildEntity`

`EntitySchema` — discriminated union по `type` (`schemas/entity.ts`).
Один `buildEntity({ type: "task", ... })` ломает narrowing —
`Partial<Entity>` collapse'ится, `fields` обязательное поле
проваливается. Решение — отдельные builders на каждый тип:

```ts
// src/test/builders/task.ts
import { format } from "date-fns";
import { now } from "../../services/clock";
import { EntitySchema, type TaskEntity } from "../../schemas/entity";

let counter = 0;
export function buildTask(overrides: Partial<TaskEntity> = {}): TaskEntity {
  return EntitySchema.parse({
    id: `task-${++counter}`,
    type: "task",
    title: "Task",
    tags: ["work"],
    status: "active",
    priority: "medium",
    deadline: null,
    estimated_minutes: null,
    description: "",
    created_at: now().toISOString(),
    updated_at: now().toISOString(),
    fields: { parent_project_id: null },
    ...overrides,
  }) as TaskEntity;
}

export function resetTaskCounter(): void { counter = 0; }
```

Аналогично `buildProject`, `buildDirection`. `Block` /
`PoolItem` / `HorizonProject` — не discriminated, обычные
builders.

#### 3.3.2. Traits

```ts
// src/test/builders/traits.ts
import { addDays, format } from "date-fns";
import { now } from "../../services/clock";

export const onToday = () => ({ date: format(now(), "yyyy-MM-dd") });
export const onTomorrow = () =>
  ({ date: format(addDays(now(), 1), "yyyy-MM-dd") });
export const onYesterday = () =>
  ({ date: format(addDays(now(), -1), "yyyy-MM-dd") });
export const onMonday = () => {
  const d = now();
  const day = d.getDay();              // Sun=0..Sat=6
  const diff = day === 0 ? -6 : 1 - day; // ISO Mon offset
  return { date: format(addDays(d, diff), "yyyy-MM-dd") };
};
export const inDeepWorkSlot = () =>
  ({ start: "09:00", duration: 120, category: "work" });
export const done = () => ({ status: "done" as const });
export const planned = () => ({ status: "planned" as const });
export const withDeadlineIn = (days: number) =>
  ({ deadline: format(addDays(now(), days), "yyyy-MM-dd") });
```

Применение:
```ts
buildBlock({
  ...onTomorrow(),
  ...inDeepWorkSlot(),
  title: "Завтрашний deep work",
});
buildTask({ title: "Test report", ...withDeadlineIn(2) });
```

Тест читается как ТЗ. Ноль арифметики дат в test-телах.

#### 3.3.3. Counter scope — module-level + ban `test.concurrent`

`let counter = 0` на модуль — простейший вариант. Race возможен
**только** при `test.concurrent` или параллельных builder-вызовах
внутри одного теста. Политика: `test.concurrent` **не используем**
в e2e-browser project (документируем в `setup-browser.ts` комментом).

`resetBuilderCounters()` дёргается в `beforeEach`:

```ts
// src/test/builders/index.ts
import { resetBlockCounter } from "./block";
import { resetTaskCounter } from "./task";
import { resetProjectCounter } from "./project";
import { resetDirectionCounter } from "./direction";
import { resetPoolCounter } from "./pool";
// ...

export function resetBuilderCounters(): void {
  resetBlockCounter();
  resetTaskCounter();
  resetProjectCounter();
  resetDirectionCounter();
  resetPoolCounter();
  // ...
}
```

### 3.4. Scenarios

`src/test/scenarios/<name>.ts` — функция, возвращающая `VirtualFS`
с уже посеянными данными:

```ts
// src/test/scenarios/typical-week.ts
import { VirtualFS } from "../virtual-fs";
import { buildBlock } from "../builders/block";
import { buildTask, buildProject, buildDirection } from "../builders";
import { onToday, onTomorrow, onYesterday, done, withDeadlineIn,
         inDeepWorkSlot } from "../builders/traits";

const ROOT = "/tuzov-test/data";

export function typicalWeek(): VirtualFS {
  const fs = new VirtualFS();

  fs.write(`${ROOT}/entities.json`, JSON.stringify({
    version: 1,
    entities: [
      buildTask({ title: "Test report", ...withDeadlineIn(2) }),
      buildTask({ title: "Daily review", ...withDeadlineIn(0) }),
      buildTask({ title: "Read paper" }),
      buildProject({ title: "Site refactor" }),
      buildProject({ title: "Tuzov OS v2" }),
      buildDirection({ title: "YouTube" }),
    ],
  }, null, 2));

  fs.write(`${ROOT}/schedule/2025-w24.json`, JSON.stringify({
    version: 1,
    week: "2025-w24",
    start_date: "2025-06-09",
    template_applied: null,
    blocks: [
      buildBlock({ ...onToday(), ...inDeepWorkSlot(),
                   title: "Сегодня deep work" }),
      buildBlock({ ...onTomorrow(), title: "Завтрашний созвон" }),
      buildBlock({ ...onYesterday(), ...done(),
                   title: "Вчерашняя задача" }),
    ],
  }, null, 2));

  fs.write(`${ROOT}/pool/2025-w24.json`, JSON.stringify({
    version: 1,
    week: "2025-w24",
    items: [/* via buildPoolItem */],
  }, null, 2));

  fs.write(`${ROOT}/horizon.json`, JSON.stringify({
    version: 1,
    base_month: "2025-06-01",
    projects: [],
  }, null, 2));

  fs.write(`${ROOT}/config.json`, /* ConfigFileSchema-shaped */);

  fs.ensureDir(`${ROOT}/commands/pending`);
  fs.ensureDir(`${ROOT}/commands/done`);
  fs.ensureDir(`${ROOT}/commands/failed`);

  return fs;
}
```

#### 3.4.1. Список сценариев

| Сценарий | Что внутри | Используется |
|---|---|---|
| `empty` | Пустые `commands/{pending,done,failed}/`, минимально валидный `config.json`, никаких entities/schedule/pool. Покрывает первый запуск + `readJsonFileOrCreate`. | Boot-from-empty тест |
| `typical-week` | Текущая неделя `2025-w24` + 6 entities + 3 blocks + pool/horizon. Дефолт для большинства тестов. | Default |
| `with-pending-commands` | `typical-week` + 1 файл `create_block.json` в `commands/pending/`. | Command-queue executor flow |

**Принцип:** добавлять scenario, **только** когда нужен явно
отличный state. `dense-week` (rev.1) **отложен** — добавим если
будет тест который реально требует 30 блоков и 15 entities.

Имена файлов в `pending/` — произвольные; `action` внутри JSON —
из `CommandActionSchema` (`create_block`, `update_entity` и т.д.).
В rev.1 фигурировал `add_block.json` — `add_block` не существует,
правильно `create_block.json` или любое имя с правильным `action`
внутри.

### 3.5. Automation library

#### 3.5.1. Дизайн (правильный API!)

`src/test/e2e/automation.ts` — POM-lite. Самый **критичный** для
исправления раздел в rev.1: код не компилировался против `@vitest/
browser` v4 (`getByPlaceholderText` не существует — есть
`getByPlaceholder`; нет global `screen`; нет `findBy*`; locators
синхронны и принимаются `userEvent` напрямую).

```ts
// src/test/e2e/automation.ts
import { userEvent } from "vitest/browser";
import { expect } from "vitest";
import type { RenderResult } from "vitest-browser-react";
import type { Locator } from "@vitest/browser/context";

export type ScreenName =
  | "plan" | "tasks" | "projects" | "context" | "horizon" | "review";

// All helpers take RenderResult — no global `screen`. This matches
// the canonical pattern in TasksPage.browser.test.tsx:20.
export async function quickAdd(
  screen: RenderResult,
  text: string,
): Promise<void> {
  await userEvent.keyboard("{Meta>}[KeyN]{/Meta}");
  // Scope to dialog — `Что добавить?` placeholder is shared with
  // TaskBar.tsx:123 and would collide on Tasks screen.
  const dialog = screen.getByRole("dialog",
    { name: /быстрое создание/i });
  const input = dialog.getByPlaceholder("Что добавить?");
  await userEvent.type(input, text);
  await userEvent.keyboard("{Enter}");
}

// Navigation via data-tab — structural attribute, immune to label
// translation churn ("План" → "Планирование" already broke the
// rev.1 regex `/^план$/i`).
export async function gotoScreen(
  screen: RenderResult,
  name: ScreenName,
): Promise<void> {
  const button = screen.container
    .querySelector<HTMLElement>(`[data-tab="${name}"]`);
  if (!button) throw new Error(`tab ${name} not in DOM`);
  await userEvent.click(button);
}

export async function expectScreen(
  screen: RenderResult,
  name: ScreenName,
): Promise<void> {
  // Each page has a stable data-screen attribute on its root.
  await expect.element(
    screen.container.querySelector(`[data-screen="${name}"]`)!
  ).toBeVisible();
}

export async function pressKey(combo: string): Promise<void> {
  await userEvent.keyboard(combo);
}

// Set store state directly — bypass UI for fixture setup. Fast,
// not "production-like". Use when test asserts on a downstream
// behavior, not on the create-flow itself.
export function setStoreState(updates: Partial<{
  config: ConfigFile;
  entities: Entity[];
  blocks: Block[];
  // ...
}>): void {
  if (updates.config)
    useConfigStore.setState({ config: updates.config });
  if (updates.entities)
    useEntityStore.setState({ entities: updates.entities });
  // ...
}
```

#### 3.5.2. DnD: `dragWithPointer` + `dragWithDragEvent`

App **не использует** `@dnd-kit` (зависимость в package.json
заявлена, но импортов нет). Реальные DnD-хуки — `useBlockGesture.ts`
(planner blocks) и `useBacklogGesture` (horizon backlog) — слушают
`pointerdown → pointermove(threshold) → pointerup` через
`setPointerCapture`. Для kanban (Projects) DnD — отдельная история
(там HTML5 DragEvent через draggable attribute).

`userEvent.dragAndDrop` шлёт HTML5 `DragEvent` — для pointer-
capture-хуков **silently no-op'ит**. Нужны **два** helper'а:

```ts
// src/test/e2e/drag.ts
import { userEvent } from "vitest/browser";
import type { Locator } from "@vitest/browser/context";

// For elements driven by useBlockGesture / useBacklogGesture etc.
// Sends raw pointer events with intermediate moves to clear the
// drag-threshold (DRAG_THRESHOLD_PX = 5 in useBlockGesture.ts).
export async function dragWithPointer(
  source: Locator,
  target: { x: number; y: number },
  opts: { steps?: number } = {},
): Promise<void> {
  const src = source.element() as HTMLElement;
  const r = src.getBoundingClientRect();
  const startX = r.left + r.width / 2;
  const startY = r.top + r.height / 2;
  const steps = opts.steps ?? 5;

  src.dispatchEvent(new PointerEvent("pointerdown", {
    bubbles: true, clientX: startX, clientY: startY,
    pointerId: 1, button: 0, isPrimary: true,
  }));

  for (let i = 1; i <= steps; i++) {
    const x = startX + (target.x - startX) * (i / steps);
    const y = startY + (target.y - startY) * (i / steps);
    document.dispatchEvent(new PointerEvent("pointermove", {
      bubbles: true, clientX: x, clientY: y, pointerId: 1,
    }));
  }

  document.dispatchEvent(new PointerEvent("pointerup", {
    bubbles: true, clientX: target.x, clientY: target.y,
    pointerId: 1,
  }));
}

// For kanban (HTML5 DragEvent) — wraps userEvent.dragAndDrop
// directly. Existing PlannerPage.browser.test.tsx:31 happens to
// work via this path through chromium polyfills.
export async function dragWithDragEvent(
  source: Locator,
  target: HTMLElement | Locator,
): Promise<void> {
  const tgt = target instanceof HTMLElement
    ? target
    : (target.element() as HTMLElement);
  await userEvent.dragAndDrop(source, tgt);
}
```

В тестах:
- Plan `useBlockGesture` блоков — `dragWithPointer`
- Plan pool→grid (PoolSidebar) — `dragWithPointer`
- Horizon backlog DnD — `dragWithPointer`
- Projects kanban (если используется HTML5 DragEvent) —
  `dragWithDragEvent`

Для Plan target вычисляется через `getBoundingClientRect()`
конкретной `.day-body[data-date="..."]` ячейки.

#### 3.5.3. Что не делаем

- **Полный POM** — окупается выше ~50 спек, у нас ~38. VS Code
  smoke использует "automation library" (helpers, не классы).
- **Wrapper над `expect`** — ассерты inline.
- **Скрытие селекторов под function-name'ы для каждого экрана** —
  лежат в `selectors.ts` константами.

### 3.6. vitest projects

#### 3.6.1. Изменения в `vitest.config.ts`

```ts
{
  name: "e2e-browser",
  include: [
    "src/**/*.e2e.test.tsx",
    "src/**/*.browser.test.tsx",  // legacy, удаляется после миграции
  ],
  setupFiles: ["src/test/setup-browser.ts"],
  browser: {
    enabled: true,
    provider: playwright(),
    instances: [{ browser: "chromium" }],
    headless: true,
    screenshotFailures: false,
  },
},
```

#### 3.6.2. Setup

```ts
// src/test/setup-browser.ts
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
// builder counters (block-id, task-id, etc.) race under concurrent
// execution. Sequential test ordering is the contract.

beforeEach(() => {
  // Order matters: reset state, then freeze clock, then install FS.
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

### 3.7. Service singletons reset

Zustand `resetAllStores()` чистит только store state. Module-level
state в сервисах **не** сбрасывается и leak'ает между тестами:

| Файл | Состояние | Риск |
|---|---|---|
| `services/file-io.ts:30` | `cachedDataDir` | Кэш `get_data_dir` навсегда — новый VirtualFS с другим root игнорируется |
| `services/seed-migration.ts:59` | `inflight` | Двойной boot не запустит миграцию повторно |
| `services/command-processor.ts:43-69` | `started`, `inflight`, `chain` | F-9 не запустит processor дважды; chain protected by `started` |
| `services/dashboard-hot-reload.ts` | `installed` | Двойная инсталляция watcher'ов |
| `services/week-cache.ts` | `cache`, `inflight` | Уже public: `clearWeekCache()` |
| `services/review-aggregations.ts` | `poolCache` | Уже public: `invalidatePoolCache()` |

Каждый сервис добавляет export `__resetForTests()` (или
эквивалент). Aggregator:

```ts
// src/test/reset-singletons.ts
import { __resetDataDirCacheForTests } from "../services/file-io";
import { __resetSeedMigrationForTests } from "../services/seed-migration";
import { __resetCommandProcessorForTests } from "../services/command-processor";
import { __resetDashboardHotReloadForTests } from "../services/dashboard-hot-reload";
import { clearWeekCache } from "../services/week-cache";
import { invalidatePoolCache } from "../services/review-aggregations";

export function resetServiceSingletons(): void {
  __resetDataDirCacheForTests();
  __resetSeedMigrationForTests();
  __resetCommandProcessorForTests();
  __resetDashboardHotReloadForTests();
  clearWeekCache();
  invalidatePoolCache();
}
```

Каждый `__resetForTests` помечается комментом
`// only for src/test/** — do not call from prod`. ESLint правило
запрета вызова из `src/**/!(test)/**` — backlog.

### 3.8. Boot через `App.loadAll()` — refactor App.tsx

Текущий `src/App.tsx:46-102` — длинный inline `useEffect` с
async-IIFE. Тесты не могут его запустить отдельно. Refactor:

```tsx
// src/App.tsx
export async function loadAll(opts?: { signal?: AbortSignal }): Promise<void> {
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

Тесты — **два уровня**:

```ts
// Level 1 — fast: bypass boot, hydrate stores directly
test("Tasks shows Quick Add (fast)", async () => {
  setStoreState({ config: edgeConfig, entities: edgeEntities });
  useUIStore.setState({ bootReady: true, currentPage: "tasks" });
  const screen = render(<Shell />);
  await quickAdd(screen, "x");
  // ...
});

// Level 2 — real boot: from VirtualFS
test("real boot from typical-week", async () => {
  installFS(typicalWeek());
  const screen = render(<App />);
  await expect.poll(
    () => useUIStore.getState().bootReady,
    { timeout: 3000 },
  ).toBe(true);
  // app fully booted from FS
  await expectScreen(screen, "plan");
});
```

Level 1 — для ~70% тестов (per-screen behavior). Level 2 — для
persistence/boot/cross-screen (J-1..J-4, F-9). Level 2 требует
`vi.advanceTimersByTime` чтобы App-level `setTimeout` (paint
yield 16ms, safety 5s) сработали — см. §5.3.

---

## 4. Покрытие — что именно тестируем

### 4.1. Принципы выбора тестов

- **One feature, one assertion-cluster.** Тест проверяет один
  пользовательский путь.
- **Поведение, не внутренности.** `screen.getByText` дефолт.
  Stores проверяем когда DOM-сигнал weak (DnD, async writes).
- **Happy-path + 1–2 edge.** Не пишем 12 negative-кейсов на
  каждый feature.
- **Не дублируем unit.** Пометка `(unit: ...)` рядом с тестом
  означает что подробное покрытие у unit-теста, e2e только
  wiring-смок (UI вообще читает результат).
- **«Относительно несложно»** = укладывается в 15 строк setup'а.
  Сложнее — manual smoke или unit.

### 4.2. Per-screen breakdown

#### 4.2.1. Plan (`src/pages/PlannerPage.e2e.test.tsx`)

| # | Тест | Сценарий | Notes |
|---|---|---|---|
| P-1 | renders current week with today highlighted | typical-week | smoke |
| P-3 | drag block to different day persists | typical-week | dragWithPointer |
| P-4 | drag block to different time updates start | typical-week | dragWithPointer |
| P-5 | resize block from bottom edge updates duration | typical-week | dragWithPointer (resize handle) |
| P-6 | click empty slot opens BlockPopup with prefilled day/time | empty | |
| P-7 | delete selected block via Delete key removes from DOM and disk | typical-week | persist via flush |
| P-8 | week navigation prev → previous week loads | typical-week | |
| P-9 | week navigation today → returns to current week | typical-week | |
| P-10 | drag pool item onto grid creates linked block | typical-week | dragWithPointer |

**9 тестов** (P-2 «renders blocks at correct day/time slots» убран
— покрыт `block-position.test.ts` + `time-utils.test.ts`).

#### 4.2.2. Tasks (`src/pages/TasksPage.e2e.test.tsx`)

| # | Тест | Сценарий | Notes |
|---|---|---|---|
| T-2 | category filter sidebar narrows list | typical-week | |
| T-3 | search input filters by title | typical-week | |
| T-4 | quick add from task bar creates entity (existing migration) | typical-week | |
| T-6 | complete checkbox toggles status to done | typical-week | persist via flush |
| T-7 | tasks list visual baseline (existing screenshot migration) | screenshot fixture | V-1 |

**5 тестов** (T-1 grouping и T-5 urgency-chips убраны — оба
полностью покрыты `group-tasks.test.ts` + `urgency.test.ts`,
оставляем wiring через само рендерение листа в T-2/T-3).

#### 4.2.3. Projects (`src/pages/ProjectsPage.e2e.test.tsx`)

| # | Тест | Сценарий | Notes |
|---|---|---|---|
| Pr-1 | renders kanban for active board | typical-week | |
| Pr-4 | drag card between columns updates project col field | typical-week | dragWithDragEvent (HTML5) |
| Pr-5 | inline create card in column adds entity | typical-week | persist via flush |
| Pr-6 | click card opens entity popup | typical-week | |

**4 теста** (Pr-2 board-tabs и Pr-3 cat-filter убраны — покрыты
`projects-helpers.test.ts`).

#### 4.2.4. Context (`src/pages/ContextPage.e2e.test.tsx`)

| # | Тест | Сценарий | Notes |
|---|---|---|---|
| C-1 | renders direction grid grouped by area | typical-week | smoke |
| C-2 | inline edit direction title persists | typical-week | persist via flush |
| C-3 | inline create new direction in section | typical-week | |
| C-4 | inline create project inside direction card | typical-week | |

**4 теста** (C-5 cadence-chip убран — `urgency.cadUrgClass` через
`urgency.test.ts`).

#### 4.2.5. Horizon (`src/pages/HorizonPage.e2e.test.tsx`)

| # | Тест | Сценарий | Notes |
|---|---|---|---|
| H-3 | drag project from backlog into month adds to grid | typical-week | dragWithPointer |
| H-4 | hide project (eye icon) moves to deferred section | typical-week | |
| H-5 | size change (big/mid/small) reorders rows | typical-week | |

**3 теста** (H-1 grid-render и H-2 backlog-render убраны —
покрыты `horizon-helpers.test.ts` + jsdom smoke).

#### 4.2.6. Review (`src/pages/ReviewPage.e2e.test.tsx`)

| # | Тест | Сценарий | Notes |
|---|---|---|---|
| R-1 | period tabs week/month/year switch content | typical-week | |
| R-3 | review summary visual baseline (screenshot) | screenshot fixture | V-2 |

**2 теста** (R-2 weekly-gauges убран — `gauge-math.test.ts` +
`review-aggregations.test.ts`).

### 4.3. Cross-screen flows + journeys

`src/test/e2e/`:

| # | Тест | Сценарий | Notes |
|---|---|---|---|
| F-1 | Cmd+N from any screen opens Quick Add | typical-week | |
| F-2 | Quick Add creates task, visible on Tasks | empty | persist + reload via Level 2 boot |
| F-3 | Quick Add modifier `!завтра` sets correct deadline (existing migration) | empty | wiring smoke; tokenizer fully covered by `quick-add-tokenizer.test.ts` |
| F-8 | Entity popup edit propagates across screens | typical-week | |
| F-9 | Pending command file → executor → entity created | with-pending-commands | uses `__processOnePendingForTests()` |
| **J-1** | **Morning ritual:** today's blocks present, drag tomorrow's pool item to today | typical-week | full Level 2 boot |
| **J-2** | **Nightly review:** mark blocks done, mark cadence, Review gauges update | typical-week | |
| **J-3** | **Persistence round-trip:** create entity → flush writes → reset stores → reload from FS → entity still present | empty | full Level 2 boot |
| **J-4** | **Week navigation boundary:** prev → next → today preserves data | typical-week | |

**9 тестов** (F-4 Quick Add `#tag`, F-5 type-detection `p Test`,
F-6 Settings UI route, F-7 Cmd+Shift+E debug, F-10 boot-from-empty
→ seed-migration — все убраны, причины:
- F-4/F-5: features не реализованы в `quick-add-tokenizer.ts` —
  тестировать нечего.
- F-6: у Settings нет UI route из Shell/TopNav — тестируется
  программно, что не имеет смысла как E2E.
- F-7: low-value, debug-only path.
- F-10: `seed-migration.ts:113` копирует только если `seed-v2/`
  уже в data root — false expectation. Replaced by **J-3**
  persistence round-trip.

Добавлены 4 daily-use journey (J-1..J-4) — пользовательские
сценарии, не feature mirror.

### 4.4. Visual regression — short list

| # | Surface | Why stable |
|---|---|---|
| V-1 | Tasks list (existing) | Все deadline=null → нет «Xд» текста |
| V-2 | Review weekly summary | Gauges + статичные labels |

**V-3 (Quick Add modal) убран** — focus-ring, caret, entry
animation flake-факторы; ровно тот класс шума, от которого
избавлялись для V-1 (использовали null deadlines).

Что **не** скриншотим: Plan grid (DnD-active), Context (inline-
edit states), Horizon (drag-states), Toast (animated).

### 4.5. Итого

| Категория | Тестов |
|---|---|
| Plan | 9 |
| Tasks | 5 |
| Projects | 4 |
| Context | 4 |
| Horizon | 3 |
| Review | 2 |
| Cross-screen + journeys | 9 |
| Visual regression | 2 |
| **Всего** | **38** |

Из них **3 — миграция** существующих `*.browser.test.tsx`
(PlannerPage drag, TasksPage Cmd+N, TasksPage screenshot). Новых
— **35**.

Это сопоставимо с VS Code smoke (15-20 journeys + integration
tests). У нас 9 journey-стиля + 25 per-screen wiring + 2 visual.

### 4.6. Что осознанно не покрываем

| Что | Где остаётся |
|---|---|
| Реальный Tauri shell на macOS | Manual smoke от пользователя |
| Native menu / global shortcut | Manual smoke; JS-реакция на `menu` event — unit |
| Native file dialog | Manual smoke |
| File watchers (`notify`) | Phase 04 Rust unit-тесты + manual fsevents smoke |
| Window state persist | Manual smoke |
| Crash recovery (corrupted JSON) | `file-io.ts` recovery logic — unit-тесты в backlog |
| DST/timezone transitions | Frozen clock dodges; backlog: ISO-week boundary unit |
| Performance / нагрузка | Другая категория |
| Concurrent multi-window | Tauri-only |
| Real `tauri dev` / packaged binary | Manual только |
| Quick Add `#tag` / `p Test → project` | Features не существуют в коде |

---

## 5. Тестовые паттерны

### 5.1. Setup boilerplate (правильный API)

**Level 1 — fast (per-screen behavior):**

```tsx
import { test, expect } from "vitest";
import { render } from "vitest-browser-react";
import { Shell } from "../components/layout/Shell";
import { typicalWeek } from "../test/scenarios/typical-week";
import { installFS } from "../test/virtual-fs";
import { setStoreState } from "../test/e2e/automation";
import { useUIStore } from "../store/ui";
import { useConfigStore } from "../store/config";
import { useEntityStore } from "../store/entities";
import { edgeConfig, edgeEntities } from "../test/fixtures/edge";

test("Tasks: Cmd+N opens Quick Add", async () => {
  // bypass boot, hydrate stores directly — fast
  installFS(typicalWeek());
  setStoreState({ config: edgeConfig, entities: edgeEntities });
  useUIStore.setState({ bootReady: true, currentPage: "tasks" });

  const screen = render(<Shell />);

  await userEvent.keyboard("{Meta>}[KeyN]{/Meta}");

  await expect
    .element(screen.getByRole("dialog",
      { name: /быстрое создание/i }))
    .toBeVisible();
});
```

**Level 2 — real boot (persistence/journey):**

```tsx
import App from "../App";
import { vi } from "vitest";

test("J-3: persistence round-trip", async () => {
  installFS(empty());
  const screen = render(<App />);

  // App.tsx has setTimeout(16) paint yield + setTimeout(5000)
  // safety. With fake timers, advance them so loadAll() resolves.
  await vi.advanceTimersByTimeAsync(20);

  await expect
    .poll(() => useUIStore.getState().bootReady, { timeout: 3000 })
    .toBe(true);

  await quickAdd(screen, "Persistent task");
  await flushAllWrites();

  // verify on disk
  const fs = getCurrentFS();
  const file = JSON.parse(fs.read("/tuzov-test/data/entities.json"));
  expect(file.entities.some(
    (e: { title: string }) => e.title === "Persistent task")).toBe(true);

  // simulate reload
  resetAllStores();
  resetServiceSingletons();
  // FS не сбрасываем — снова рендерим App, она читает с диска
  render(<App />);
  await vi.advanceTimersByTimeAsync(20);
  await expect
    .poll(() => useUIStore.getState().bootReady, { timeout: 3000 })
    .toBe(true);

  await gotoScreen(screen, "tasks");
  await expect.element(
    screen.getByText("Persistent task")
  ).toBeVisible();
});
```

### 5.2. Assertions: store vs DOM

| Когда DOM | Когда store |
|---|---|
| Видимый текст / role | DnD-finalize (race с DOM render) |
| Disabled state, aria-* | Async write-queue flush |
| Screenshot diff | Internal computed values (urgency class, scheduled hours) — на эти есть unit-тесты |
| Cmd+N opens dialog | После `dragWithPointer` — read `useScheduleStore.getState().blocks[0].date` |

Принцип: store-assert — это «эскейп-хач», когда DOM-signal weak.
Default — DOM (с `expect.element` + retry-ability).

### 5.3. Timer policy с fake timers

`freezeClock` ставит `vi.useFakeTimers()`. Это значит:
- `setTimeout` / `setInterval` **не выполняются** автоматически.
- Real timer для `Toast.tsx:50` (4000ms auto-dismiss),
  `App.tsx:27,37` (5000ms safety + 16ms paint yield),
  `command-processor.ts:147` (80ms parse retry),
  write-queues — все blocked until explicit advance.

**Стратегия:** `flushAllWrites()` дёргает write-queue flush
напрямую через exported `flush*Queue()` функции (Promise-based,
независимы от fake timers). Для App-level `setTimeout`-ов в Level
2 boot:

```ts
await vi.advanceTimersByTimeAsync(20);  // paint yield + boot
```

Toast auto-dismiss и т.п. тестируем явно:
```ts
await vi.advanceTimersByTimeAsync(4000);
expect(toast).not.toBeVisible();
```

### 5.4. Avoiding flaky waits

- **`await expect.element(...).toBeVisible()`** имеет встроенный
  retry — не нужно `waitFor`.
- **`expect.poll(fn).toBe(value)`** для store-state с
  polling-таймаутом.
- **Никаких retry-loop'ов** — следуем noise-policy: упростить →
  спустить уровнем → `.skip` + ticket.

### 5.5. Selectors

`src/test/e2e/selectors.ts`:

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

**Стратегия:**
1. **Структурные атрибуты** (`data-tab`, `data-testid`,
   `data-screen`, `data-date`) для навигации и идентификации
   экранов.
2. **role + accessible name** для интерактивных контролов.
3. **text** для контента.

`data-testid="planner-grid"`, `data-screen="plan"` и `data-tab` —
точечные правки в компоненты, помечаются `// for E2E selector`.
Это легитимные test-friendly правки.

**Не используем** локализованные regex'ы (`/^план$/i`) — copy
дрейфит чаще структуры.

### 5.6. Async write queues — `flushAllWrites`

Write-queues (`entities-/pool-/horizon-/week-/config-write-queue.
ts`) — **serial promise chains**, не debounce-таймеры
(rev.1 это путал). Каждый держит модульно-приватный `inflight:
Promise`. Для теста нужны экспорты:

```ts
// src/services/entities-write-queue.ts
let inflight: Promise<unknown> = Promise.resolve();
// ...existing enqueueEntitiesWrite...

// Test-only flush hook — awaits any pending write-chain.
export async function flushEntitiesQueue(): Promise<void> {
  await inflight;
}
```

Аналогично остальные 4. Aggregator:

```ts
// src/test/e2e/automation.ts
import { flushEntitiesQueue } from "../../services/entities-write-queue";
// ... 4 more imports

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

В тесте:
```ts
await quickAdd(screen, "Test");
await flushAllWrites();
const fs = getCurrentFS();
expect(fs.read("/tuzov-test/data/entities.json")).toContain("Test");
```

---

## 6. Команд-очередь и persistence

### 6.1. Path guard и DataRoot

`command-processor.ts:108` отвергает любой path не содержащий
`/data/commands/pending/`. Поскольку DataRoot virtual = `/tuzov-
test/data`, путь к pending-команде = `/tuzov-test/data/commands/
pending/<id>.json` — содержит `/data/commands/pending/`, проходит.
Это **причина** почему root именно `/tuzov-test/data`, а не
`/tuzov-test`.

### 6.2. Pending → done flow

```ts
test("F-9: pending command processed and moved to done", async () => {
  installFS(withPendingCommands());
  setStoreState({ config: edgeConfig, entities: edgeEntities });
  useUIStore.setState({ bootReady: true });

  render(<Shell />);
  const fs = getCurrentFS();

  // Direct call bypasses watcher (fsevents impossible to fake);
  // exposes only the parse → execute → move portion.
  await __processOnePendingForTests(
    "/tuzov-test/data/commands/pending/cmd-1.json"
  );

  expect(fs.exists(
    "/tuzov-test/data/commands/pending/cmd-1.json")).toBe(false);
  expect(fs.exists(
    "/tuzov-test/data/commands/done/cmd-1.json")).toBe(true);

  await gotoScreen(screen, "tasks");
  await expect.element(
    screen.getByText("Created by command")).toBeVisible();
});
```

`__processOnePendingForTests(path)` — экспорт из command-
processor.ts добавляется в Foundation. Внутри он сбрасывает
`started/inflight/chain` module-globals и вызывает приватный
`processOne(path)` единожды. Это **тестирует execute+move
поведение, но не watcher**. Watcher gap — manual smoke от юзера.

### 6.3. Persistence round-trip

Тест записывает через UI → flushes → читает через виртуальную FS:

```ts
test("J-3: persistence round-trip", async () => {
  installFS(empty());
  const screen = render(<App />);
  await vi.advanceTimersByTimeAsync(20);
  await expect
    .poll(() => useUIStore.getState().bootReady).toBe(true);

  await quickAdd(screen, "Persistent task");
  await flushAllWrites();

  const fs = getCurrentFS();
  const file = JSON.parse(
    fs.read("/tuzov-test/data/entities.json"));
  expect(file.entities.some(
    (e: { title: string }) => e.title === "Persistent task")).toBe(true);

  // simulate full reload — VirtualFS persists across this
  resetAllStores();
  resetServiceSingletons();
  render(<App />);
  await vi.advanceTimersByTimeAsync(20);
  await expect.poll(
    () => useUIStore.getState().bootReady, { timeout: 3000 }).toBe(true);

  await gotoScreen(screen, "tasks");
  await expect.element(
    screen.getByText("Persistent task")).toBeVisible();
});
```

Этот класс тестов — самый ценный для file-based-storage product'а.

---

## 7. Visual regression

### 7.1. Принцип

Только 2 кадра. Всё что:
- Имеет даты в копи (urgency-чипы, «Xд»)
- Анимировано (Toast, hover, transitions, focus-ring)
- DnD-active (Plan grid, Horizon backlog)
- Содержит caret (Quick Add input)

— **не** скриншотим. Иначе baseline-rot.

### 7.2. Конкретно (правильный API!)

```ts
await expect.element(screen.container).toMatchScreenshot(
  "tasks-list",
  { comparatorOptions: { allowedMismatchedPixelRatio: 0.005 } },
);
```

| Кадр | Файл | Threshold |
|---|---|---|
| `tasks-list.png` (existing migration) | `src/pages/__screenshots__/TasksPage.e2e.test.tsx/` | `0.005` |
| `review-summary.png` | `src/pages/__screenshots__/ReviewPage.e2e.test.tsx/` | `0.005` |

**API замечания:**
- `toMatchScreenshot` (vitest), не `toHaveScreenshot` (playwright).
- `comparatorOptions.allowedMismatchedPixelRatio`, не
  `maxDiffPixelRatio` (playwright). См. `node_modules/@vitest/
  browser/jest-dom.d.ts:700-705`.
- Threshold `0.005` (0.5%) — research recommendation для macOS
  subpixel AA. `0.01` слишком permissive (целые text-rows
  не fail).

### 7.3. Migration шаг для V-1

Существующий baseline лежит в `src/pages/__screenshots__/
TasksPage.browser.test.tsx/`. После переименования тестового
файла в `*.e2e.test.tsx` директория должна быть переименована
тоже — `git mv ...browser.test.tsx ...e2e.test.tsx`. Иначе
vitest создаст новый baseline и diff будет всегда зелёным
(false-confidence).

### 7.4. Update strategy

`vitest --update-snapshots` после намеренной правки CSS /
компоновки. В commit message указываем какой кадр обновили
(V-1 / V-2). Visual baselines — pin к **одной OS**: macOS-only
(локально). Cross-OS font-rendering всё равно дрейфует.

---

## 8. CI (заметки на будущее)

Сейчас CI у проекта нет — соло-разработка на macOS. Когда появится:

- **GitHub Actions:** `macos-latest` для visual baselines (один
  OS!). `ubuntu-latest` опционально для не-visual тестов
  (быстрее, но AA отличается).
- **Frozen clock spans across runners** — TZ-эффекты убиты через
  freeze. Однако `new Date("2025-06-11T10:00:00")` парсится как
  **local time** — для CI стабильности либо добавить `Z`
  (`2025-06-11T10:00:00Z`), либо `process.env.TZ = "Europe/Moscow"`
  в setup. Решение: оставить local + `TZ=Europe/Moscow` в CI env.
- **Visual regression — только на macOS**, как master baseline.
- **Per-worker temp dir** в command-queue тестах (если будут) —
  оба runner'а имеют temp.
- **Debuggability:** на CI flake DnD-теста запускать `vitest
  --browser-mode tracing` для скриншотов фейла. Сейчас
  `screenshotFailures: false` (без CI) — для CI поменяем.

OUT OF SCOPE текущих фаз — заметка чтобы дизайн сразу не закрывал
двери.

---

## 9. Нарезка на фазы

Спека одна, фазы независимы. Раскладка:

| # | Фаза | Что появляется | Тесты | Effort |
|---|---|---|---|---|
| **E1** | **Foundation** | `services/clock.ts`, миграция 26+ callsites, ESLint guard (after migration), `virtual-fs.ts` (с правильной семантикой dirs/list/move), DataRoot=`/tuzov-test/data`, builders по типам, traits, scenarios `empty`/`typical-week`, automation library (правильный API + `dragWithPointer`/`dragWithDragEvent`), service singletons reset, `App.loadAll()` refactor, write-queue flush exports (5 файлов), vitest project rename, миграция 3 существующих браузерных тестов, screenshot baseline directory rename, `data-tab`/`data-screen`/`data-testid` атрибуты в TopNav/pages/PlannerPage. | 3 (мигрированных) | **12–16ч** |
| **E2** | **Plan + Tasks** | `PlannerPage.e2e.test.tsx` (9 включая мигрированный P-3), `TasksPage.e2e.test.tsx` (5 включая мигрированные T-4 + T-7). | +12 | 4–5ч |
| **E3** | **Projects + Context** | `ProjectsPage.e2e.test.tsx` (4), `ContextPage.e2e.test.tsx` (4). | +8 | 2–3ч |
| **E4** | **Horizon + Review** | `HorizonPage.e2e.test.tsx` (3), `ReviewPage.e2e.test.tsx` (2 включая R-3 V-2 screenshot). | +5 | 2ч |
| **E5** | **Cross-screen + journeys** | `e2e/quick-add.test.tsx` (F-1, F-2, F-3), `e2e/popup-flow.test.tsx` (F-8), `e2e/command-queue.test.tsx` (F-9), `e2e/journeys.test.tsx` (J-1..J-4). Scenario `with-pending-commands`. Включает `__processOnePendingForTests` export. | +9 | 4–5ч |
| **E6** | **Polish (опционально)** | Доводка flake'ующих тестов после первых прогонов в реальной работе. Migration `app-flow.smoke.test.tsx` → e2e (он дублирует F-2). | +0 | 1–2ч |

**Каждая фаза — самодостаточный коммит.** После E1 — гонка можно
идти параллельно по E2..E5, **но рекомендуется** последовательно
E2 → E3 → E4 → E5 — первые 5–10 тестов проверят helpers (дешевле
исправить одни helpers чем 27 тестов retro-fit'ить).

**Зависимости:**
- E1 блокирует ВСЕ остальные.
- E2..E4 независимы между собой, но рекомендуется E2 первым
  (Plan/Tasks — самые видимые).
- E5 после хотя бы одного из E2/E3/E4 (нужны фичи на которые
  ссылаются journeys).

### 9.1. Что в E1 ЯВНО

E1 — это не «инфра + 2 теста», как казалось в rev.1. Это:

1. **clock.ts создание** (15 мин)
2. **Миграция 26 callsites** на `clock.now()` / `clock.today()`
   (3-5 ч — touch 18 файлов, проверить каждый)
3. **ESLint guard включение** + verify `task check` green (30
   мин)
4. **VirtualFS class** с правильной семантикой dirs/list/move
   (45 мин)
5. **DataRoot пути** = `/tuzov-test/data` (5 мин)
6. **Builders по типам** (1 ч — 4 builders + traits + index)
7. **Scenarios** `empty` + `typical-week` (1 ч — реалистичные
   данные через builders)
8. **Automation library** включая `dragWithPointer`,
   `dragWithDragEvent`, `flushAllWrites` aggregator (1.5 ч)
9. **Service singletons reset** — добавить
   `__resetForTests` exports в 4 модуля + aggregator (45 мин)
10. **App.loadAll() refactor** — extract из useEffect (45 мин)
11. **Write-queue flush exports** (5 файлов × 10 мин = 50 мин)
12. **vitest config** rename + setup-browser обновление (15 мин)
13. **`data-tab` / `data-screen` / `data-testid`** в TopNav,
    pages, PlannerPage (30 мин)
14. **Миграция 3 existing browser tests** в новую инфру (1 ч,
    включая screenshot baseline rename)

**Итого: 12-16 ч реальной работы.** Это не 4-6 ч rev.1.

---

## 10. Принятые решения

(в rev.1 были «открытые вопросы», 8 пунктов — все закрыты в rev.2)

1. **Atomic write через tmp+rename** — НЕ моделируем в virtual
   FS. Acknowledged tradeoff (§3.1.4).
2. **Watcher-driven flow** — явный вызов
   `__processOnePendingForTests(path)` (§6.2).
3. **Boot-flow в тестах** — два уровня: Level 1 fast
   (`setStoreState` + `<Shell />`), Level 2 real
   (`installFS` + `<App />` + `vi.advanceTimersByTimeAsync`).
   Большинство тестов — Level 1 (§3.8, §5.1).
4. **Visual regression scope** — V-1 + V-2 only. V-3 drop
   (§4.4).
5. **`flushAllWrites`-API** — внутри каждой queue
   `flush*Queue()` export, automation.ts агрегирует (§5.6).
6. **ESLint guard** — `new Date()` + `Date.now()` оба селектора,
   активация **после** миграции, `ignores` только `clock.ts` и
   `scripts/` (§3.2.4).
7. **Counter reset для builders** — module-let + `test.concurrent`
   запрещён политикой (комментарий в setup-browser.ts) (§3.3.3).
8. **`@crabnebula/tauri-driver`** — фиксируем как backup-план
   для real-shell E2E на macOS (paid через `tauri-plugin-
   automation`). Не сейчас (§1.2).

---

## 11. Что НЕ ломается

Список «не трогать»:

- `src/services/*.test.ts` (14 unit-тестов) — стоят на ноге.
  E2E НЕ дублирует их case-list (§1.3).
- `src/pages/{Context,Horizon,Review}Page.smoke.test.tsx` (jsdom)
  — оставляем как fast feedback layer.
- `src/test/app-flow.smoke.test.tsx` — пока остаётся в jsdom как
  cross-screen smoke; F-2 в E5 его эффективно дублирует через
  Level 2 boot — после E5 можно удалить (E6).
- `src/services/file-io.ts` sandbox guard — критично для
  безопасности.
- Phase 04 cargo-тесты — независимая ветка покрытия.

---

## 12. Стоимость и сроки (грубо)

| Фаза | Effort |
|---|---|
| E1 Foundation | **12–16 ч** (см. §9.1 разложение) |
| E2 Plan + Tasks | 4–5 ч (12 тестов, из них 5 DnD через `dragWithPointer`) |
| E3 Projects + Context | 2–3 ч (8 тестов) |
| E4 Horizon + Review | 2 ч (5 тестов + V-2 screenshot baseline) |
| E5 Cross-screen + journeys | 4–5 ч (9 тестов, J-3 + F-9 — heavy с Level 2 boot) |
| E6 Polish | 1–2 ч |
| **Всего** | **25–33 ч** |

С запасом на flake-fixes и непредвиденные «компонент рисует не
то» — **30–40 ч реалистично**. Spec rev.1 заявляла 15-21 ч —
была занижена примерно в 2 раза по аудиту 5 reviewer'ов.

Темп: E1 — 1.5–2 рабочих дня, остальное по фазе в день.

---

## 13. Ссылки

- Этот документ
- `tmp/smoke-tests-research.md` — выбор стека, tauri-driver gap
- `tmp/research-electron-e2e.md` — VS Code patterns,
  Spectron history
- `tmp/research-e2e-fixtures.md` — frozen-clock, builders, ESLint
- `docs/tasks/smoke-tests/README.md` — Phase 01–04 done
- `spec/tuzov-os/v2/spec.md` — feature inventory (sections 4–10)
- `spec/tuzov-os/v2/phases/00-overview.md` — фазная структура v2
- `vitest.config.ts` — три project'а, точка интеграции
- `src/test/setup-browser.ts` — точка расширения
- `src/services/file-io.ts:18-28` — sandbox guard
- `src/services/command-processor.ts:108` — path guard
  (`/data/commands/pending/`)
- `src/components/layout/TopNav.tsx:16-22` — labels reference
- `node_modules/@vitest/browser/context.d.ts:500-526` —
  LocatorSelectors API truth
- `node_modules/vitest-browser-react/dist/pure.d.ts:5-12` —
  RenderResult shape
- Tauri issue #7068 — macOS WebDriver gap
- `@crabnebula/tauri-driver` — paid macOS path (backup)

### 13.1. Changelog rev.1 → rev.2

Изменения после deep review (12 reviewer'ов):

**Critical fixes:**
- `loadAll()` теперь реален — refactor App.tsx добавлен в E1
  (§3.8). Тесты могут запускать настоящий boot-flow.
- DataRoot переехал `/tuzov-test` → `/tuzov-test/data` (§3.1.3).
  command-processor path guard теперь проходит для F-9.
- Frozen-clock миграция расширена с ~6 до 26 callsites
  (§3.2.3 — full list).
- `__processOnePendingForTests` явно описан как нужный refactor
  command-processor.ts; spec больше не делает вид что это
  one-line export (§6.2).
- `flushAllWrites` теперь требует 5 новых exports (по queue) —
  явно учтено в E1 effort (§5.6, §9.1).
- API drift в code snippets исправлен: `getByPlaceholder` (не
  `getByPlaceholderText`), `screen` как `RenderResult` параметр
  (не global), нет `findBy*`, `userEvent.type(input, text)` без
  `.element()` cast (§3.5).
- `gotoScreen` через `data-tab` (не локализованные regex'ы) —
  rev.1 `/^план$/i` не матчил «Планирование» (§3.5.1, §5.5).
- `quickAdd` scope'нут под dialog — rev.1 collision с
  TaskBar.tsx placeholder (§3.5.1).
- `maxDiffPixelRatio` → `comparatorOptions.allowedMismatchedPixelRatio`,
  `toMatchScreenshot` (vitest API, не Playwright) (§7.2).

**Architecture additions:**
- §3.7 Service singletons reset (новый раздел) — Zustand reset
  не чистит `cachedDataDir`, `week-cache`,
  `command-processor.started` и т.д.
- §3.8 Boot via App + loadAll() (новый раздел) — refactor
  App.tsx + Level 1/Level 2 testing strategy.
- §5.3 Timer policy with fake timers (новый раздел) —
  `vi.advanceTimersByTimeAsync` для App-level setTimeout'ов.
- ESLint guard покрывает `Date.now()` тоже, активируется только
  после миграции (§3.2.4).
- Builders разделены по типам (`buildTask`, `buildProject`,
  `buildDirection`) — `EntitySchema` discriminated union ломал
  один универсальный `buildEntity` (§3.3.1).
- `dragWithPointer` helper для custom-pointer-capture хуков
  (Plan, Pool, Horizon backlog), `dragWithDragEvent` для
  HTML5-DnD (Projects kanban) (§3.5.2).
- `clearMocks()` перенесён `afterAll` → `afterEach` — listener
  leakage (§3.6.2).

**Coverage rebalance:**
- Тесты cut с 49 до 38 (3 миграции + 35 новых).
- 9 тестов убраны как дубли с unit (P-2, T-1, T-5, Pr-2, Pr-3,
  C-5, R-2, H-1, H-2). E2E больше не тестирует тот же case-list.
- 5 cross-screen тестов убраны: F-4 (`#tag` не существует), F-5
  (`p Test → project` не существует), F-6 (Settings нет UI
  route), F-7 (Cmd+Shift+E low value), F-10 (boot-from-empty →
  seed false expectation).
- 4 daily-use journey добавлены: J-1 (morning ritual), J-2
  (nightly review), J-3 (persistence round-trip — replaces
  F-10), J-4 (week navigation boundary).
- V-3 (Quick Add screenshot) drop — animation/focus-ring noise.
- Visual threshold `0.01 → 0.005` — research recommendation для
  macOS subpixel AA.

**Effort recalibration:**
- E1: 4-6 ч → 12-16 ч (real scope explained in §9.1).
- Total: 15-21 ч → 25-33 ч (30-40 ч с запасом).

**Open questions all closed** (§10) — rev.1 имела 8 open
вопросов, rev.2 их закрыла.
