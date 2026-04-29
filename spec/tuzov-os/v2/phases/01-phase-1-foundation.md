# Phase 1 — Foundation v2

> **Цель:** заменить старый Shell (Sidebar 5 кнопок + Header) на
> новый **Top Navigation Bar** с шестью табами и week navigation,
> добавить заглушки пяти новых экранов и Direction-сущность.
> Существующий Planner временно «переезжает» под таб «Планирование»
> без визуальных переделок.
>
> **Результат после фазы:** запускаешь приложение → видишь
> 40-пиксельный навбар сверху, 6 табов кликаются, на 5 — заглушка
> «В разработке», на «Планировании» — старый planner. Quick Add
> (`Cmd+N`) пока открывает существующий `EntityEditor`. Direction
> уже доступен в `EntitySchema`, можно создать через старый
> debug-вход (Cmd+Shift+E → старая EntitiesPage), он валидируется
> и сохраняется в `entities.json`.

## Контекст

Прочитай:

- `spec/tuzov-os/v2/spec.md` §1 (Архитектура), §2 (Токены),
  §3 (Top Navigation Bar), §11 (Данные).
- `spec/tuzov-os/v2/pool-planner-demo-v2.html` — посмотри
  верхнюю шапку (`<header class="topbar">` или аналог) и
  переключение `data-tab`.
- `spec/tuzov-os/done/00-overview.md`, `01-data-schema.md`.
- Текущий `src/components/layout/Shell.tsx`,
  `src/components/layout/Header.tsx`,
  `src/components/layout/Sidebar.tsx`.

## Что в фазе

### 1. Расширение Zod-схем

#### 1.1. Direction entity type

В `src/schemas/entity.ts` добавить:

```ts
export const DirectionFieldsSchema = z.object({
  // Measurable (optional)
  target: z.string().nullable().default(null),
  current: z.string().nullable().default(null),
  progress: z.number().min(0).max(100).nullable().default(null),
  // Cadence (optional)
  cadence: z.number().int().positive().nullable().default(null),
  last_act: isoDate().nullable().default(null),
  cadence_label: z.string().nullable().default(null),
});
export type DirectionFields = z.infer<typeof DirectionFieldsSchema>;
```

> Имена полей подбираем под snake_case-конвенцию текущей схемы
> (`last_contact`, `target_date`). Спека v2 использует camelCase
> (`lastAct`, `cadLbl`) — это для in-mock JS. На диске —
> snake_case.

Расширить `EntityTypeSchema`:

```ts
export const EntityTypeSchema = z.enum([
  "task",
  "project",
  "routine",
  "event",
  "contact",
  "goal",
  "note",
  "metric",
  "direction",          // ← new
]);
```

Добавить в `EntitySchema` discriminated union вариант для
`direction` + экспорт `DirectionEntity`.

В `ProjectFieldsSchema` добавить **новые поля v2**:

```ts
direction_id: z.string().nullable().default(null),
board_id: z.string().default("brd3"),
column_index: z.number().int().nonnegative().default(0),
last_activity_days: z.number().int().nonnegative().default(0),
```

> `pipeline_stage` (string) уже есть и продолжает работать. Новые
> поля `board_id` + `column_index` дублируют его на новом уровне:
> board задаёт набор стадий, column_index — позицию в нём. На
> переходный период разрешаем сосуществование: `pipeline_stage`
> остаётся для совместимости, новые экраны читают
> `board_id`/`column_index`. См. фазу 9 для финальной развязки.

В `TaskFieldsSchema` ничего нового не нужно — все поля v2 (cat,
prio, deadline, done) уже представлены через `tags`, `priority`,
`deadline`, `status` в `baseEntityShape`.

#### 1.2. Pool storage schema

Новый файл `src/schemas/pool.ts`:

```ts
import { z } from "zod";

export const PoolItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  hours: z.number().positive(),       // в часах с долями (0.5, 1.5)
  category: z.string(),                // area id из config
  splittable: z.boolean(),
  // Привязки (optional, эксклюзивны: либо project, либо direction
  // (когда direction без проектов), либо ничего (атомарка из задачи))
  source_entity_id: z.string().nullable().default(null),
  source_kind: z.enum(["task","project","direction","ad-hoc"])
    .default("ad-hoc"),
  // Атомарные айтемы фиксируют флаг placed после первого drop.
  // Дробимые — нет; для них scheduled вычисляется derived из
  // блоков на сетке (recalcPool).
  placed: z.boolean().default(false),
  created_at: z.string(),
  updated_at: z.string(),
});
export type PoolItem = z.infer<typeof PoolItemSchema>;

export const PoolFileSchema = z.object({
  version: z.literal(1),
  week: z.string(),                    // "2026-w18"
  items: z.array(PoolItemSchema),
});
export type PoolFile = z.infer<typeof PoolFileSchema>;
```

> Pool — per-week, файл `data/pool/2026-w18.json`. Параллелит
> `schedule/2026-wNN.json`. При смене недели читается соответствующий
> файл, при отсутствии — создаётся пустой (как делает scheduling
> сейчас).

#### 1.3. Horizon storage schema

Новый файл `src/schemas/horizon.ts`:

```ts
export const HorizonSizeSchema = z.enum(["big","mid","small"]);
export type HorizonSize = z.infer<typeof HorizonSizeSchema>;

export const HorizonProjectStateSchema = z.object({
  project_id: z.string(),
  months: z.array(z.number().int().min(0).max(11)).default([]),
  size: HorizonSizeSchema.default("mid"),
  hidden: z.boolean().default(false),
});
export type HorizonProjectState = z.infer<typeof HorizonProjectStateSchema>;

export const HorizonFileSchema = z.object({
  version: z.literal(1),
  base_month: z.string(),               // ISO "2026-04-01" — точка
                                        // отсчёта; колонки = base..base+7
  projects: z.array(HorizonProjectStateSchema),
  group_collapsed: z.object({
    big: z.boolean().default(false),
    mid: z.boolean().default(false),
    small: z.boolean().default(false),
  }).default({ big: false, mid: false, small: false }),
  section_collapsed: z.object({
    active: z.boolean().default(false),
    someday: z.boolean().default(false),
    deferred: z.boolean().default(true),
  }).default({ active: false, someday: false, deferred: true }),
});
export type HorizonFile = z.infer<typeof HorizonFileSchema>;
```

> Horizon — один файл `data/horizon.json` (не per-period).
> Заметили: спека §11.8 описывает `hzData`, `hzSize`, `hzHidden`,
> `hzGroupCollapsed`, `hzCollapsed`. Мы их объединяем под одну
> схему. `hzPrio` спека явно говорит **не реализовывать** (§8.3).
> `base_month` — нужен потому что Apr–Nov из мока хардкод; у нас
> «текущий месяц + 7» вычисляется динамически.

Реэкспорт в `src/schemas/index.ts`.

### 2. Новые stores

#### 2.1. `src/store/pool.ts`

Минимальный API:

```ts
interface PoolStore {
  currentWeek: string;
  items: PoolItem[];
  loading: boolean;
  error: string | null;

  loadWeek: (week: string) => Promise<void>;

  addItem: (item: Omit<PoolItem, "id" | "created_at" | "updated_at">)
    => Promise<PoolItem>;
  updateItem: (id: string, updates: Partial<PoolItem>) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  setPlaced: (id: string, placed: boolean) => Promise<void>;
}
```

#### 2.1.1. Persistence паттерн (общий для pool и horizon)

Каждый mutator (`addItem`, `updateItem`, `removeItem`, `setPlaced`)
работает по persist-first сценарию (см. `done/post-review-backlog.md`
H1):

```ts
addItem: async (input) => {
  const next = [...get().items, { ...input, id: uuid(), created_at: now(), updated_at: now() }];
  // 1. Запись на диск с валидацией (Zod):
  await writeJsonFile(
    getDataPath(`pool/${get().currentWeek}.json`),
    PoolFileSchema.parse({ version: 1, week: get().currentWeek, items: next }),
  );
  // 2. Только после успеха — обновление state:
  set({ items: next });
  // 3. trackSave — для индикатора в TopNav:
  trackSave();
  return next[next.length - 1];
};
```

Если запись падает — state не меняется, ошибка наружу через
`JsonReadError` / `WriteError`. То же для `removeItem` и т.д.

Файл — `data/pool/2026-wNN.json`. По смене
`useScheduleStore.currentWeek` подгружаем тот же week — подписка
на schedule store в `App.tsx`:

```ts
useScheduleStore.subscribe(
  (s) => s.currentWeek,
  (week) => { void usePoolStore.getState().loadWeek(week); },
);
```

#### 2.2. `src/store/horizon.ts`

```ts
interface HorizonStore {
  baseMonth: string;
  projects: HorizonProjectState[];
  groupCollapsed: { big: boolean; mid: boolean; small: boolean };
  sectionCollapsed: { active: boolean; someday: boolean; deferred: boolean };

  load: () => Promise<void>;
  setMonths: (projectId: string, months: number[]) => Promise<void>;
  setHidden: (projectId: string, hidden: boolean) => Promise<void>;
  setSize: (projectId: string, size: HorizonSize) => Promise<void>;
  toggleGroup: (g: HorizonSize) => Promise<void>;
  toggleSection: (s: "active"|"someday"|"deferred") => Promise<void>;
  // Sync с entities (фаза 7 будет вешать подписку):
  addProject: (projectId: string, opts?: { size?: HorizonSize }) => Promise<void>;
  removeProject: (projectId: string) => Promise<void>;
}
```

Файл — `data/horizon.json`. Persistence паттерн — тот же что в
2.1.1: каждый mutator пишет полный snapshot в JSON через
`writeJsonFile` + `HorizonFileSchema.parse`, и только после
успешной записи `set(...)`.

### 3. Расширение `ui` store

В `src/store/ui.ts`:

#### 3.1. Page enum

```ts
export type Page =
  | "plan"      // было "planner"
  | "tasks"
  | "projects"  // спека §3.2 даёт data-tab="proj"
  | "context"   // спека §3.2 даёт data-tab="ctx"
  | "horizon"
  | "review"
  // Скрытые debug-входы (фаза 9 разберётся):
  | "entities"
  | "dashboards";
```

> Переименовываем `"planner" → "plan"` для соответствия `data-tab`
> из спеки §3.2. Это требует обновить все места, где сравнивается
> `currentPage === "planner"`.

> **Маппинг с `data-tab` спеки §3.2.** Спека использует короткие
> атрибуты `plan / tasks / proj / ctx / horizon / review`. Внутри
> приложения **читаемые** имена (`projects`, `context`). На уровне
> render — атрибут `data-tab` ставится у каждого таба для
> совместимости с CSS-селекторами и debug-инспекцией:
> ```tsx
> const PAGE_TO_DATA_TAB: Record<Page, string> = {
>   plan: "plan", tasks: "tasks",
>   projects: "proj", context: "ctx",
>   horizon: "horizon", review: "review",
>   entities: "_entities", dashboards: "_dashboards",
> };
> ```

#### 3.1.1. Поиск сериализации Page

Перед переименованием грепнуть проект на:
- `"planner"` (string literal в JSON-state, ui-config файлах);
- `currentPage` (если где-то записывается на диск);
- localStorage / sessionStorage (если zustand persist используется).

Если найдено — добавить миграцию (при чтении старого значения
маппить `"planner" → "plan"`). На текущий момент `useUIStore`
не использует persist middleware, но проверить.

#### 3.2. Hotkey-карта

```ts
const KEY_PAGE: Record<string, Page> = {
  Digit1: "plan",
  Digit2: "tasks",
  Digit3: "projects",
  Digit4: "context",
  Digit5: "horizon",
  Digit6: "review",
};
```

Cmd+Shift+E → `entities` (debug). Cmd+Shift+D → `dashboards`
(debug). Реализовать через тот же handler в `Shell.tsx`.

#### 3.3. Новое состояние

```ts
weekOffset: number;        // 0 = текущая, ±N — смещение
```

> `weekOffset` — производное от `useScheduleStore.currentWeek` и
> «текущей недели по календарю». Можно держать как `getWeekOffset()`
> вычислимое в `time-utils`, без хранения в ui-store. Решение:
> **не хранить** — Top Nav вычисляет offset из
> `getCurrentWeekId()` и `currentWeek` через `time-utils`.
>
> `sideTab` (активный таб в pool sidebar) — заводим в фазе 6, не
> сейчас. Не плодим dead state.

### 4. Новый Top Navigation Bar

#### 4.1. Удалить из Shell

- `Sidebar` — больше не отображаем (компонент пока оставляем в
  коде как unused, удалим в фазе 9).
- `StatusBar` — пока оставляем снизу, но проверить что не ломает
  layout с Top Nav (вынести логику в фазу 9).
- `Header` — заменяется на новый компонент.

#### 4.2. Новый компонент `src/components/layout/TopNav.tsx`

Структура (см. §3.1):

```
┌─ TopNav (40px height) ────────────────────────────────┐
│ [Tab×6: Plan|Tasks|Projects|Context|Horizon|Review]   │
│            ⟵ spacer ⟶            [Today][‹] W18 27 апр — 3 мая [›] [+] │
└────────────────────────────────────────────────────────┘
```

CSS-классы (semantic, в `globals.css`):
- `.topbar` — flex row, height 40, `bg-surface`, border-bottom.
- `.nav-tabs` — flex row, gap 0, padding-left 16.
- `.nav-tab` — padding 8 14, font 12 bold, color `text-tertiary`.
- `.nav-tab.active` — color `accent`, border-bottom 2px accent.
- `.nav-tab:hover` — color `text-secondary`.
- `.nav-week` — flex row, monospace, padding-right 8.
- `.wk-today` — кнопка, font 10, скрыта при offset===0.
- `.wk-arrow` — 28×28, transparent border, hover `border-hover`.
- `.wk-label` — текст «W{N} · {start} — {end}».
- `.nav-add-btn` — 28×28, dashed border, hover accent.

Поведение:
- Клик по табу → `setPage(tab.dataTab)`.
- Клик по `‹`/`›` → `goToPrevWeek` / `goToNextWeek` (уже есть в
  `useScheduleStore`).
- Клик по «Сегодня» → `goToCurrentWeek`. Скрывается, когда
  `currentWeek === getCurrentWeekId()`.
- Клик по `+` → `openQuickAdd()` (заглушка пока, фаза 2 наполнит
  реализацией). Сейчас просто открывает существующий
  `EntityEditor` в режиме «new task» через `openEntityEditorNew("task")`.
- `data-tauri-drag-region` на пустых местах между блоками —
  чтобы окно тащилось.

Утилиты (новый файл `src/services/week-format.ts`):

```ts
export function getWeekOffsetFromCurrent(weekId: string): number;
export function getWeekRangeLabel(weekId: string): string;
// "W18 · 27 апр — 3 мая"
```

Использует существующие `getWeekNumber`, `formatWeekRange` из
`time-utils`. Формат: спека §3.3 говорит
`"W{N} · {start} — {end}"`, значит подгоняем под это.

#### 4.3. Удалить старый Header

Файл `src/components/layout/Header.tsx` удаляем. `PlannerHeader` /
`EntitiesHeader` / `DashboardsHeader` — их функциональность либо
переезжает в `TopNav` (week navigation), либо в самой странице
(search в Tasks — фаза 3, breadcrumb в Dashboards — остаётся как
debug). На время фазы 1 в Plan tab на месте кнопки «Пул» в шапке
ничего не показываем (у нас всё ещё работает старый planner со
своим внутренним layout — он не должен сломаться).

### 5. Заглушки пяти экранов

Новые файлы `src/pages/`:

- `TasksPage.tsx`
- `ProjectsPage.tsx`
- `ContextPage.tsx`
- `HorizonPage.tsx`
- `ReviewPage.tsx`

Каждый — функциональный компонент, рендерит:

```tsx
<div className="page page-stub">
  <div className="page-stub-title">Задачи</div>
  <div className="page-stub-hint">В разработке (Phase 3)</div>
</div>
```

Класс `.page-stub` — flex, центр, opacity .5, font 14, color
`text-disabled`.

### 6. Переключение страниц в Shell

`src/components/layout/Shell.tsx`:

```tsx
<TopNav />
<main className="main">
  {currentPage === "plan" && <PlannerPage />}
  {currentPage === "tasks" && <TasksPage />}
  {currentPage === "projects" && <ProjectsPage />}
  {currentPage === "context" && <ContextPage />}
  {currentPage === "horizon" && <HorizonPage />}
  {currentPage === "review" && <ReviewPage />}
  {currentPage === "entities" && <EntitiesPage />}
  {currentPage === "dashboards" && <DashboardsPage />}
</main>
```

Старая логика «всё рендерится одновременно, переключается через
CSS» — заменяется на условный рендер. Это упростит lazy-load в
будущих фазах (но пока не делаем).

### 7. App.tsx: подгрузка новых stores

См. секцию 8.3.1 — полный порядок boot. Кратко:

1. `ensureDataDir()` — создать data/ директории.
2. `maybeMigrateToV2()` — миграция (читает config напрямую).
3. `loadConfig()` — после миграции.
4. `Promise.all([loadEntities, loadWeek, loadRegistry, loadPool,
   loadHorizon])` — параллельно.
5. Подписки: при смене `useScheduleStore.currentWeek` —
   `usePoolStore.loadWeek(newWeek)`. Реализовать через `subscribe`
   в `App.tsx`.

> **Cmd+N во время фазы 1.** Native menu пункт «new-block» в
> v1 диспатчит `requestNewBlock()`, который открывает старый
> BlockEditor только на Plan экране. На фазе 1 оставляем эту
> логику — Cmd+N работает только на Plan, открывает старый
> editor. Замена на Quick Add — фаза 2. На остальных табах
> Cmd+N временно ничего не делает (это ОК, фаза 1 — не про
> Quick Add). Кнопка `+` в Top Nav — заглушка через
> `openEntityEditorNew("task")`, как в секции 4.2.

### 8. Seed-миграция данных

Спека §14 описывает seed: 12 задач, 21 проектов, 9 направлений,
5 pool items, ~30 блоков, horizon на 16 проектов.

#### 8.1. Что делаем

- **Бэкап** существующих `data/` файлов в `data/.backup-v1/` —
  одноразово вручную (юзер сам сделает перед запуском фазы) или
  автоматически при первом запуске v2 если найден файл-маркер
  `data/.v2-migrated` отсутствующий.
- **Seed-файлы** для разработки лежат в репозитории в
  `data/seed-v2/` (новая директория). При первом старте v2 (если
  `data/.v2-migrated` отсутствует и `entities.json` найдено
  пустое или содержит только техсущности) — копируем seed в
  `data/`, ставим маркер.
- В CLAUDE.md / README дописать: «для разработки v2 рекомендую
  стереть `data/`, маркер сам сгенерится» — но **не делаем
  деструктивно**.

#### 8.2. Содержимое `data/seed-v2/`

- `entities.json` — 12 task + 21 project + 9 direction (mappings
  из §14.3, §14.4, §14.5). Для каждого entity заполняем
  обязательные поля, ID — UUID, `created_at`/`updated_at` —
  единая дата (например, `2026-04-28T00:00:00Z`).
- `schedule/2026-w18.json` — рутины (Собаки утро/вечер, Японский,
  Тренировка, Обед) + рабочие блоки из §14.1. Привязка к pool —
  через `source_entity_id`. **Внимание:** в спеке `pool: 'p1'`,
  но у нас `source_entity_id` указывает на pool item id, который
  лежит в `pool/2026-w18.json`.
- `pool/2026-w18.json` — 5 pool items из §14.2.
- `horizon.json` — 16 проектов с месяцами из §14.6, base_month =
  `2026-04-01`.
- `config.json` — **не трогаем** (юзеру — его 6 настроенных
  областей). Если в config'е области не покрывают seed (например,
  нет `growth`), миграция падает с понятной ошибкой и просит
  юзера добавить недостающие в Settings перед миграцией.

#### 8.3. Утилита миграции

`src/services/seed-migration.ts`:

```ts
export async function maybeMigrateToV2(): Promise<void> {
  const marker = await fileExists(getDataPath(".v2-migrated"));
  if (marker) return;
  // 1. Прочитать config напрямую (без useConfigStore — миграция
  //    запускается до loadConfig):
  const cfg = await readJsonFile(getDataPath("config.json"), ConfigFileSchema)
    .catch(() => null);
  // 2. Проверить что в config есть нужные area-ids для seed
  //    (work, growth, life, people, health). Если каких-то нет —
  //    бросить понятную ошибку с подсказкой.
  if (cfg) ensureSeedAreasExist(cfg);
  // 3. Решить: пустой ли entities.json (или отсутствует)?
  const entitiesEmpty = await isEntitiesFileEmpty(getDataPath("entities.json"));
  if (entitiesEmpty) {
    await copySeedV2To(getDataPath(""));
  }
  // 4. Маркер ставится всегда — даже если копирование не
  //    выполнено (юзер с реальными данными), чтобы не запускать
  //    миграцию снова.
  await writeJsonFile(getDataPath(".v2-migrated"), { at: new Date().toISOString() });
}
```

Вызов — в `App.tsx` **до** `loadConfig` / `loadEntities`.

#### 8.3.1. Порядок boot в App.tsx

Чтобы избежать race с loadConfig и проверки seed-areas:

```ts
await ensureDataDir();
await maybeMigrateToV2();          // читает config напрямую
await useConfigStore.getState().loadConfig();
const areas = useConfigStore.getState().config?.areas;
await Promise.all([
  useEntityStore.getState().loadEntities(areas),
  useScheduleStore.getState().loadWeek(getCurrentWeekId(), { silentCreate: true }),
  useDashboardStore.getState().loadRegistry(),
  usePoolStore.getState().loadWeek(getCurrentWeekId()),
  useHorizonStore.getState().load(),
]);
```

Миграция читает `config.json` через `readJsonFile` напрямую, не
через store. Это безопасно: store не инициализирован, но файл уже
существует (либо после `ensureDataDir` создан, либо лежит из v1).

> Если в `data/entities.json` есть пользовательские данные — мы
> их не трогаем. Юзер сам перенесёт через UI или удалением
> `data/`. В v2 экранах эти entities просто не будут
> показываться (нет direction, есть только goal/contact, которые
> в новом UI не выводятся).

### 8.5. Command schema на фазе 1

Текущий `src/schemas/command.ts` использует `EntitySchema` как
data для `create_entity` / `update_entity`. После расширения
`EntityTypeSchema` на `"direction"` (секция 1.1), AI-агент
**автоматически** сможет создавать direction через существующее
действие `create_entity` — discriminated union пропустит новый
тип через Zod-валидацию.

**Что НЕ меняется в команд-схеме на фазе 1:**
- `create_entity { type: "direction", fields: { ... } }` — работает
  из коробки.
- `update_entity { entity_id, ... }` — работает (loose object).
- `delete_entity` — работает.

**Что добавляется:**
- Ничего. Новых actions для фазы 1 не вводим. Pool/Horizon
  command-actions — в фазах 6 и 7 соответственно.

**Что проверить smoke-тестом:**
- Положить руками `data/commands/pending/<uuid>.json` с
  `{ action: "create_entity", data: { type: "direction",
  title: "Тест", tags: ["work"], status: "active", ... } }`.
- Подождать обработки — файл должен переехать в `commands/done/`,
  direction появиться в `entities.json`. Если падает — значит
  `EntitySchema` собран некорректно.

### 9. Вспомогательные изменения

- Удалить из Shell.tsx Tab-блокировку, если она ломает фокусирование
  на табах (см. строка 38 в текущем Shell). Возможно, нужно
  адаптировать: разрешить Tab в Top Nav, но запретить в page body
  (как было).
- В `src/services/week-cache.ts` ничего не меняется. Pool/horizon
  не кэшируем в памяти на этом этапе — они малы.

## Acceptance criteria

- [ ] Запускаешь `npm run tauri dev` → видишь приложение с Top Nav
  (40px) и 6 табами.
- [ ] Клик по каждому табу — переключает контент:
  - Plan → старый planner работает как раньше (drag, resize, pool,
    inline create — без регрессий).
  - Tasks/Projects/Context/Horizon/Review → плейсхолдер.
- [ ] Week navigation в Top Nav работает: ‹/› переключают неделю,
  «Сегодня» возвращает к текущей и скрывается при offset=0.
- [ ] `+` в Top Nav открывает существующий EntityEditor (заглушка
  для Quick Add).
- [ ] Hotkeys 1-6 переключают табы. Cmd+Shift+E открывает старую
  EntitiesPage. Cmd+Shift+D — DashboardsPage.
- [ ] Direction добавлен в EntitySchema, можно создать direction
  через старую EntitiesPage → CreateDropdown (если он умеет;
  иначе через временное API). Запись валидируется и пишется в
  `entities.json`.
- [ ] AI command `create_entity { type: "direction" }` —
  работает «из коробки» (см. секцию 8.5). Smoke: файл в
  `commands/pending/` → переехал в `commands/done/`, direction
  в `entities.json`.
- [ ] Pool store и Horizon store загружаются при старте без
  ошибок (если файлов нет — создаются пустыми).
- [ ] При первом запуске на чистом `data/` срабатывает seed
  migration: скопировались `entities.json`, `schedule/2026-w18.json`,
  `pool/2026-w18.json`, `horizon.json`, появился маркер
  `.v2-migrated`.
- [ ] Если `data/` уже содержит пользовательские данные —
  миграция не запускается (только маркер ставится). Юзерские
  данные в сохранности.
- [ ] `task check` проходит (typecheck + vitest + frontend build).
- [ ] Старая EntitiesPage / DashboardsPage работают (доступны
  через Cmd+Shift+E/D).

## Тест-план (smoke от пользователя)

1. **Чистый запуск (новый юзер).**
   Удалить `data/.v2-migrated` (если есть), запустить app. Должна
   произойти seed migration. На Plan tab вижу собаки/японский/обед
   как блоки. На Context tab — заглушка.
2. **Существующий юзер (с реальными данными).**
   Сохранить текущий `data/`, запустить app. Маркер `.v2-migrated`
   ставится, никакой миграции данных не происходит. Все мои
   старые задачи на месте, видны через Cmd+Shift+E. На новых
   табах — заглушки.
3. **Top Nav UX.**
   Клик по каждому из 6 табов. Hotkey 1–6. Стрелки недели влево/вправо.
   «Сегодня» появляется/исчезает.
4. **Direction creation.**
   Через Cmd+Shift+E → старая Entities → Create → выбрать
   «Direction» (новый пункт). Заполнить минимум: title=«Тест»,
   tags=[work]. Сохранить. Проверить в `data/entities.json`:
   запись `type: "direction"` валидна.
5. **Old planner regression.**
   На Plan tab: drag блока, resize, inline create, pool toggle.
   Всё работает как раньше.

## Что НЕ включает фаза 1

- Quick Add overlay (фаза 2) — пока заглушка-кнопка `+`.
- Entity Popup — нет вообще, везде используется старый
  EntityEditor.
- Tasks/Projects/Context/Horizon/Review экраны — только
  плейсхолдеры.
- Удаление Sidebar / StatusBar / старого Header из кода — только
  скрытие из layout. Удаление — фаза 9.
- Реализация `dirId` в виджете «Связь» в EntityEditor для
  project (через UI). Можно создать direction-привязку только
  редактированием JSON руками — это OK для фазы 1.
- Старая EntitiesPage CreateDropdown — там надо добавить пункт
  «Direction». Если разработчику быстрее — добавить, иначе
  отложить на фазу 5 (Context экран).
- CSS-классы для Top Nav — копируем по смыслу из спеки §3,
  цвета берём из существующих токенов в `globals.css`. Если
  чего-то нет (например `--bg-tint-2` отдельно от `--bg-tint-1`),
  добавляем токен с близким значением, согласовываем с юзером.

## Ловушки

- **Переименование `"planner" → "plan"`** в `Page` ломает все
  места, где идёт сравнение строки. Найти через
  `grep -rn '"planner"' src/` и поправить везде. Особое внимание:
  `App.tsx` обработчик menu (`case "new-block": setPage("planner")`).
- **Заглушка `+` в Top Nav** не должна вызывать Quick Add — его
  ещё нет. Используем существующий `openEntityEditorNew("task")`
  как самый понятный fallback.
- **Seed migration** не должен затирать данные. Проверка
  «entities.json существует и содержит >0 записей» = не
  мигрируем. Только маркер.
- **Direction в EntitiesPage**. CreateDropdown сейчас знает 8
  типов. Добавить direction в `CreateDropdownItem` массив. Без
  этого создать direction через UI нельзя (но это OK, миграция
  засеет первые 9, плюс через JSON руками).
- **Boards для projects.** Спека §11.2 определяет три доски
  (`brd1` Видео, `brd2` Контент, `brd3` Разное). Это **не
  config.json** (там areas). Доски — отдельная сущность. На
  фазе 1 хардкодим в `src/services/boards.ts` массив:
  ```ts
  export const BOARDS = [
    { id: "brd1", title: "Видео", columns: ["Идея","Сценарий","Съёмка","Монтаж","Публикация"] },
    { id: "brd2", title: "Контент", columns: ["Идея","Черновик","Ревью","Публикация"] },
    { id: "brd3", title: "Разное", columns: ["Надо","Начал","Делаю","Почти","Готово"] },
  ];
  ```
  В фазе 9 решаем — переезжать ли в config.json (юзер настроит
  свои доски). Пока — хардкод.
