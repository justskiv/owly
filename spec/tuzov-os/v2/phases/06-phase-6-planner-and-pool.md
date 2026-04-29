# Phase 6 — Planner v2 + Pool Sidebar

> **Цель:** перестроить главный экран «Планирование» по §4 спеки.
> Сетка 7 дней × 30-минутных слотов 07:00–23:00 (GRID_H=1280),
> новые блоки (border-left 3px, новый padding), drag/resize/context
> menu/hotkeys работают; справа — **Pool Sidebar** (280px) с
> бюджетом и четырьмя табами (Пул / Задачи / Проекты / Контекст);
> можно перетягивать любой элемент из sidebar на сетку.
>
> **Результат после фазы:** Plan tab — это новый главный экран с
> двумя пулом-листингами и сеткой. Drag-to-grid из любого таба
> работает (дробимые → 60 мин, атомарные → их часы), recalcPool
> пересчитывается, бюджет live обновляется.

## Контекст

Прочитай:

- `spec.md` §4 целиком (Layout, Time Gutter, Day Columns, Block,
  Drag-to-grid, Pool Sidebar — Header / Budget / Tabs / Pool /
  Tasks / Projects / Context, Shared Item Style).
- `spec.md` §10.5 (Modal `+ В пул недели` / «Новая задача»).
- `spec.md` §11.6 (Pool Item), §11.7 (Block).
- `spec.md` §14.1, §14.2 (seed для блоков и pool items).
- `pool-planner-demo-v2.html`: `renderBlocks`, `renderSidePool`,
  `renderSideTasks`, `renderSideProjects`, `renderSideDirs`,
  `renderBudget`, `recalcPool`, обработчики drag-to-grid.
- Текущий код Planner: `src/pages/PlannerPage.tsx`,
  `src/components/planner/*` (Все 13 файлов).
- Phases 1, 2, 3, 4, 5.

## Что в фазе

### 1. Перенос текущего Planner в legacy

Текущий код `PlannerPage.tsx` + 13 файлов в `components/planner/`
**не переписываем поверх** — слишком много инкрементальных
изменений. Вместо этого, **в строгой последовательности** (на
случай отката):

1. **Backup сначала.** Скопировать (cp -R, не mv) `src/pages/
   PlannerPage.tsx` → `PlannerPage.legacy.tsx`. Скопировать
   `src/components/planner/` → `src/components/planner.legacy/`.
   Эти файлы помечены `// LEGACY — phase 6 backup, removed in
   phase 9`.
2. **Убедиться, что legacy не подключён в Shell.tsx** (новый
   PlannerPage будет рендериться вместо старого).
3. **Только после этого** перезаписать `src/pages/PlannerPage.tsx`
   с нуля по спеке.
4. Перезаписать необходимые компоненты в `src/components/planner/`
   (имена сохраняем, чтобы ссылки в Shell не ломались):
   `WeekGrid.tsx`, `DayColumn.tsx`, `DayHeader.tsx`, `TimeBlock.tsx`,
   `TaskPool.tsx` (тот станет Pool Sidebar v2). `BlockEditor.tsx`
   удаляется (заменяется на EntityPopup), backup в legacy.

> Откат фазы 6: восстановить из `planner.legacy/` обратно
> `planner/`, восстановить `PlannerPage.tsx` из `.legacy.tsx`,
> в Shell.tsx — поменять импорты обратно. Проверено.

> Альтернатива: переписывать инкрементально. Не делаем — слишком
> рисково для целостности фазы. Лучше один раз большая фаза, с
> чистой переработкой.

### 2. Layout

```
PlannerPage (.plan-view, flex, height 100vh under TopNav, overflow hidden)
├── GridWrap (.grid-wrap, flex 1, flex-direction column, overflow hidden)
│   └── GridScroll (.grid-scroll, flex 1, overflow-y auto, display flex)
│       ├── TimeGutter (.time-gutter, 48px, flex-shrink 0)
│       └── DayCols (.day-cols, flex 1, display flex)
│           └── DayColWrap × 7 (.day-col-wrap, flex 1)
│               ├── DayHead (.day-head, sticky, top 0)
│               └── DayBody (.day-body, relative, height GRID_H)
│                   ├── HourLine × 32 (absolute, top by row)
│                   ├── TimeBlock × N
│                   └── DropIndicator
└── PoolSidebar (.pool-sidebar, 280px, flex-shrink 0)
    ├── PoolHeader
    ├── PoolBudget
    ├── PoolTabs
    └── PoolPanel (контент по активному табу)
```

**Critical:** обёртки `.grid-wrap` и `.grid-scroll` обязательны
для скрола (см. §4.1 «без них вертикальный скролл не работает»).

CSS константы:
- `H_START = 7`, `H_END = 23`.
- `ROW_H = 40`.
- `GRID_H = (H_END - H_START) * 2 * ROW_H = 1280`.
- `POOL_W = 280`.
- `GUTTER_W = 48`.

### 3. Time Gutter (§4.2)

```tsx
<div className="time-gutter">
  <div className="day-head-spacer" />  {/* 32px, выравнивает первую строку */}
  {Array.from({ length: 32 }, (_, i) => {
    const minutes = (H_START * 60) + i * 30;
    const isHour = minutes % 60 === 0;
    const label = isHour ? formatHHMM(minutes) : "";
    return <div key={i} className="time-row">{label}</div>;
  })}
</div>
```

Стили: `font-size: var(--fs-2xs)`, `font-family: monospace`, color
`text-disabled`, text-align right, padding `2 6 0 0`. Высота row =
`ROW_H`.

### 4. Day Columns (§4.3)

```tsx
const days = getWeekDays(currentWeek);  // 7 ISO dates
{days.map((date, dayIdx) => (
  <div key={dayIdx} className="day-col-wrap">
    <DayHead date={date} />
    <DayBody date={date} dayIdx={dayIdx} />
  </div>
))}
```

#### DayHead

```tsx
<div className="day-head">
  {ruDayLabel(date)} {dayOfMonth(date)}
</div>
```

Sticky top 0, z-index 10, height 32, font-xs bold,
color `text-tertiary`.

#### DayBody

```tsx
<div className="day-body" style={{ height: GRID_H }}>
  {Array.from({ length: 32 }, (_, i) => (
    <div key={i} className="hour-line"
         style={{ top: i * ROW_H }} />
  ))}
  {blocksForDay(date).map(b => <TimeBlock block={b} key={b.id} />)}
  {dragOverDay === date && <DropIndicator top={dropTop} />}
</div>
```

### 5. TimeBlock (§4.4)

Компонент `src/components/planner/TimeBlock.tsx`.

#### 5.1. Позиционирование

```ts
const top = (block.start - H_START * 60) / 30 * ROW_H;
const height = block.duration / 30 * ROW_H;
```

Где `block.start` — minutes from midnight (как в схеме v1
`Block.start = "HH:MM"`, парсим через `parseHHMM`).

#### 5.2. Визуал

```tsx
<div
  className={"block" + (selected ? " selected" : "") + (done ? " done" : "")}
  style={{
    top, height, left: 3, right: 3,
    background: catColor + "15",     // 15 hex ≈ 8.2% opacity
    borderLeft: `3px solid ${catColor}`,
  }}
  onMouseDown={onDragStart}
  onContextMenu={onContextMenu}
  data-block-id={block.id}
>
  <div className="b-title">{block.title}</div>
  {height > 28 && (
    <div className="b-time">{formatHHMM(start)}–{formatHHMM(end)}</div>
  )}
  <div className="resize-handle" onMouseDown={onResizeStart} />
</div>
```

CSS:
- `.block.done` → opacity 0.35, title text-decoration line-through.
- `.block.selected` → outline 2px var(--accent), z-index 3.
- `.resize-handle::after` → width 24, height 2, background
  rgba(255,255,255,.15). Hover: rgba(255,255,255,.35).

#### 5.3. Drag

См. фазу v1 с `useBlockGesture` — используем тот же подход
(нативный pointer events, ghost через portal). Адаптация для
snap 30 мин и clamp `H_START*60` ... `H_END*60 - dur`.

Threshold 5px. Ghost: 120px фиксированной ширины,
`background: catColor + "25"` (25 hex ≈ 14.5%).

#### 5.4. Resize

Mousedown на `.resize-handle` → resize. Snap 30, min 30, max 480.

#### 5.5. Context Menu (§4.4)

При ПКМ на блоке:

```
✓ Готово / Не готово
Дублировать
Удалить (red)
```

Дублировать: создаёт копию с `start = block.start + duration`
(сразу после оригинала). Если выходит за `H_END` — сдвиг невозможен,
отказ + toast.

#### 5.6. Hotkeys (§4.4)

Selected block + `Delete` / `Backspace` → удаление. Уже
поддерживается в v1 (`usePlannerHotkeys`); сохраняем.

#### 5.7. Click → Entity Popup или BlockEditor?

> **Дополнение к спеке.** §4.4 не описывает поведение
> click/double-click на блоке. В моке — только select; в v1 —
> double-click открывает BlockEditor. Чтобы блок был редактируем
> из v2 UI, вводим следующее:

- **Click** — селектит блок (как раньше).
- **Double-click** — открывает Entity Popup:
  - Если `block.source_entity_id` указывает на task / project /
    direction — открывается соответствующий popup.
  - Если `source_entity_id === null` (рутина или ad-hoc блок) —
    открывается **BlockPopup** (новый компонент): поля title /
    category / start / duration / status. Он же принимает на
    себя бывшую функциональность v1 BlockEditor.

### 6. Pool Sidebar Header (§4.6)

```tsx
<div className="pool-header">
  <h3 id="poolTitle">ПУЛ · W{N}</h3>
  <button className="btn-sm pool-add-btn" onClick={openPoolModal}>+</button>
</div>
```

`+` открывает Modal (см. §10.5):
- Если активный таб = `tasks` → модалка «Новая задача».
- Иначе → модалка «В пул недели».

### 7. Pool Budget (§4.6)

Компонент `src/components/planner/PoolBudget.tsx`.

```tsx
<div className="pool-budget">
  <div className="b-row b-busy">
    <span>Занято</span><span>{busy} ч</span>
  </div>
  <div className="b-row b-free">
    <span>Свободно</span><span>{free} ч</span>
  </div>
  <div className="b-row b-pool indented">
    <span><span className="dot dot-accent"/> Пул</span>
    <span className="b-pool-val">{pool} ч</span>
  </div>
  <div className="b-row b-slack indented">
    <span><span className={"dot " + (slack >= 0 ? "dot-success" : "dot-error")}/> Люфт</span>
    <span className={slack >= 0 ? "ok" : "err"}>{slack} ч</span>
  </div>
  <div className="b-progress">
    <div className="seg busy" style={{ width: busyPct + "%" }} />
    <div className="seg pool" style={{ width: poolPct + "%" }} />
    <div className="seg slack" style={{ width: slackPct + "%" }} />
  </div>
</div>
```

Расчёты (§4.6):

```ts
const busy = blocks.reduce((s, b) => s + b.duration, 0) / 60;
const free = (H_END - H_START) * 7 - busy;
const pool = poolItems.reduce((s, pi) => {
  if (pi.splittable) return s + Math.max(0, pi.hours - (pi.scheduled ?? 0));
  return pi.placed ? s : s + pi.hours;
}, 0);
const slack = free - pool;
```

`busyPct = busy / total * 100` (где total = (H_END-H_START)*7 = 112).
`poolPct = pool / total * 100`.
`slackPct = max(0, slack) / total * 100`.

### 8. Pool Tabs (§4.6 «Pool Tabs»)

```tsx
<div className="pool-tabs">
  {(["pool","tasks","projects","context"] as const).map(t => (
    <button
      key={t}
      className={"pt-tab" + (sideTab === t ? " active" : "")}
      onClick={() => setSideTab(t)}
    >
      {ptLabel[t]}
    </button>
  ))}
</div>
```

State `sideTab` — в `ui.ts` (введён в фазе 1).

### 9. Pool Panel — содержимое каждого таба

#### 9.1. Tab «Пул» (§4.6 «Tab: Пул»)

Две секции:

```tsx
<div className="pool-panel">
  <div className="pool-section">ДРОБИМЫЕ</div>
  {splittableItems.map(pi => <PoolSplittableRow item={pi} key={pi.id} />)}

  <div className="pool-section">АТОМАРНЫЕ</div>
  {atomicItems.map(pi => <PoolAtomicRow item={pi} key={pi.id} />)}
</div>
```

`PoolSplittableRow`:
- Цветная s-color полоска.
- Title + meta `{scheduled.toFixed(1)} / {hours}ч`.
- s-bar progress (height 3).
- Если scheduled >= hours → done (line-through, opacity .5).
- Кнопка `×` — удалить из пула (а также все блоки с
  `source_entity_id === pi.id`? — нет, по спеке: «удаляет также
  все связанные блоки», то есть привязанные к этому pool item.
  В нашем маппинге `block.source_entity_id` указывает на
  pool_item.id. Т.е. удаляем все блоки с этим pool_item_id).
- Draggable на сетку (создаёт блок 60 мин).

`PoolAtomicRow`:
- Цветная полоска.
- Title + meta hours.
- Если placed = true → opacity .4, badge ✓ зелёный, не draggable.
- Draggable пока не placed (создаёт блок hours\*60 мин).

#### 9.2. Tab «Задачи» (§4.6 «Tab: Задачи»)

Список **всех** task entities, отсортированных по
`(daysUntil < 0 ? daysUntil*3 : daysUntil) + priorityScore*20`.

```tsx
{sortedTasks.map(t => (
  <div className="s-item">
    <div className="s-color" style={{ background: catColor }} />
    <div className="s-body">
      <div className="s-title">{t.title}</div>
      <div className="s-meta">
        {prioIcon(t.priority)}
        {deadline && <span className={urgClass(d)}>{deadlineLabel}</span>}
      </div>
    </div>
    <button
      className={"s-act" + (inPool ? " in" : "")}
      onClick={togglePoolForTask(t)}
    >
      {inPool ? "✓" : "→"}
    </button>
  </div>
))}
```

`togglePoolForTask`:
- Если есть pool item с `source_entity_id === t.id` (и
  `source_kind === "task"`) — удалить.
- Иначе — добавить с `hours: 1, splittable: false, source_kind:
  "task"`.

> Спека §4.6 «Tab: Задачи» использует match `pi.title === t.title`,
> но это хрупкое. Используем `source_entity_id`.

**Drag задачи из таба «Задачи» напрямую на сетку.** Спека §4.6
говорит: «При drag задачи напрямую (не из пула) блок создаётся с
`pool: null`», то есть без pool item. У нас:

- Создаётся `Block` с `pool_item_id: null`,
  `source_entity_id: task.id`. Pool item не появляется.
- В будущем (если юзер захочет видеть task в пуле) — отдельным
  toggle `→/✓` юзер сам добавит в pool.

Это сохраняет разделение «pool — намеренный план», «прямой drag —
сразу на сетку».

Готовые задачи (status = "done") — в нижней секции «Готово (N)»
(если есть).

#### 9.3. Tab «Проекты» (§4.6 «Tab: Проекты»)

Все project entities, sorted by `last_activity_days`. Аналогично
задачам, кнопка «→/✓» добавляет в pool с
`hours: 4, splittable: true`.

Stale highlighting: la ≥ 14 → красный текст days.

#### 9.4. Tab «Контекст» (`data-pt: dirs`, §4.6 «Tab: Контекст»)

Все directions. Для measurable — meta `current → target` + bar.
Для cadence — meta `cadLbl · {days}д назад` с urgency. Кнопка ✓
зелёная для cadence — отмечает выполнение (как в Context экране).

Кнопка `→/✓` — toggle в пул. Точное правило (см. §4.6):

```ts
function togglePoolForDirection(direction) {
  const linked = projectsForDirection(direction.id);
  if (linked.length === 0) {
    // Само направление как pool item: 2ч, splittable, source=direction
    addItem({ title, hours: 2, splittable: true,
              source_entity_id: direction.id,
              source_kind: "direction", category, placed: false });
  } else {
    // Самый свежий project (min la): 4ч, splittable, source=project
    const freshest = linked.reduce((a, b) =>
      a.fields.last_activity_days < b.fields.last_activity_days ? a : b);
    addItem({ title: freshest.title, hours: 4, splittable: true,
              source_entity_id: freshest.id,
              source_kind: "project", category, placed: false });
  }
}
```

### 10. Drag-to-Grid (§4.5)

При начале drag pool-item:

1. Mousedown → ghost (120px wide, height по hours\*ROW_H для
   атомарных или 60 для дробимых).
2. Mousemove → ghost follows cursor; в day cols под cursor —
   drop indicator (height 2, background accent).
3. Mouseup на day-body → создать новый Block:

```ts
async function dropPoolToGrid(item: PoolItem, dayIdx: number, startMinutes: number) {
  const duration = item.splittable ? 60 : item.hours * 60;
  await useScheduleStore.getState().addBlock({
    title: item.title,
    date: getWeekDays(currentWeek)[dayIdx],
    start: formatHHMM(startMinutes),
    duration,
    category: item.category,
    source_entity_id: item.source_entity_id,  // entity id
    status: "planned",
    notes: "",
  });
  await useScheduleStore.getState().recalcPool();
}
```

> NB: связь `block.source_entity_id` — это **id Entity** (task,
> project, direction). Связь pool item ↔ block — через
> `source_entity_id` matching: оба указывают на одну entity. Если
> pool item имеет `source_entity_id === null` (ad-hoc), то
> matching по `pool_item_id` (новое поле `Block.pool_item_id`?
> или нет — лучше через title-match на крайний случай).
>
> Решение: добавляем в `Block` опциональное поле `pool_item_id`
> (string nullable) для прямой связи. Это требует расширить
> `BlockSchema` на этой фазе.

### 11. recalcPool

`src/services/recalc-pool.ts`:

```ts
// Каждый блок учитывается ровно один раз (избегаем double-counting):
// предпочитаем direct match по pool_item_id; если его нет — fallback
// на source_entity_id.
export function recalcPool(
  poolItems: PoolItem[],
  blocks: Block[]
): PoolItem[] {
  return poolItems.map(pi => {
    const linked = blocks.filter(b => {
      if (b.pool_item_id === pi.id) return true;
      if (b.pool_item_id !== null) return false; // уже учтён в другом pi
      return pi.source_entity_id !== null &&
             b.source_entity_id === pi.source_entity_id;
    });
    const hoursScheduled = linked.reduce((s, b) => s + b.duration, 0) / 60;
    if (pi.splittable) return { ...pi, scheduled: hoursScheduled };
    return { ...pi, placed: linked.length > 0 };
  });
}
```

Вызывается:
- При load week (после loadWeek + loadPool).
- После каждого add/move/resize/delete блока.
- После каждого add/remove pool item.

В store `usePoolStore` подписывается на schedule store через
zustand `subscribe`. **Важно:** подписка должна сравнивать
relevantный snapshot (массив `blocks`), а не объект целиком, и
recalcPool **не должен записывать `pool.json`** — он только
обновляет в-памяти `scheduled`/`placed` derived values. Сама
запись pool.json идёт только при явных мутациях
(addItem/removeItem). Иначе будет infinite loop schedule ↔ pool.

### 12. Modal `+ В пул недели` / «Новая задача» (§10.5)

Компонент `src/components/shared/Modal.tsx` — общий каркас
(если ещё не существует).

`src/components/planner/PoolAddModal.tsx`:

Логика `+` в pool header:

```ts
function openPoolModal() {
  if (sideTab === "tasks") openModal(<NewTaskModal />);
  else openModal(<NewPoolItemModal />);
}
```

NewPoolItemModal — поля: название, часы (number), категория
(select), тип toggle (Дробимый / Атомарный). Submit → addItem +
toast.

NewTaskModal — поля: название, приоритет (select), категория
(select), дедлайн (date). Submit → addEntity (task) + toast.

### 12.5. Command schema расширение для pool

В `src/schemas/command.ts` добавить новые command-actions, чтобы
AI-агент мог управлять пулом параллельно с UI:

```ts
export const CreatePoolItemCommandSchema = z.object({
  ...baseCommandShape,
  action: z.literal("create_pool_item"),
  data: z.object({
    week: weekId(),                       // "2026-w18"
    title: z.string(),
    hours: z.number().positive(),
    category: z.string(),
    splittable: z.boolean(),
    source_entity_id: z.string().nullable().default(null),
    source_kind: z.enum(["task","project","direction","ad-hoc"])
      .default("ad-hoc"),
  }),
});

export const UpdatePoolItemCommandSchema = z.object({
  ...baseCommandShape,
  action: z.literal("update_pool_item"),
  data: z.looseObject({
    week: weekId(),
    pool_item_id: z.string(),
  }),
});

export const DeletePoolItemCommandSchema = z.object({
  ...baseCommandShape,
  action: z.literal("delete_pool_item"),
  data: z.object({
    week: weekId(),
    pool_item_id: z.string(),
  }),
});
```

Добавить их в `SingleCommandSchema` и `CommandSchema`
discriminated union'ы (вместе с существующими actions).

В `command-executor.ts` написать handlers. Все они вызывают
методы `usePoolStore` (persist-first уже там).

В `Block` schema (см. ниже) добавляется `pool_item_id` — это
поле тоже доступно для `create_block` / `update_block` через
`blockUpdatableFields`.

### 13. Block + PoolItem model расширения

#### 13.1. Block

В `src/schemas/schedule.ts` уже есть `Block` с
`source_entity_id`. Добавим:

```ts
pool_item_id: z.string().nullable().default(null),
```

`.nullable().default(null)` (НЕ `.optional()`) — чтобы старые
week-файлы пропускались Zod без ошибок и поле явно стало `null`.

#### 13.2. PoolItem

`PoolItemSchema` (введена в фазе 1) уже содержит поля
`source_entity_id` и `source_kind`. Никаких новых полей не
добавляем — расширение исчерпано на фазе 1. Команды pool из 12.5
оперируют только этими существующими полями.

> Если в `data/pool/*.json` найдены v1-объекты с полем
> `projectId` (как в моке) — миграция при загрузке: `projectId`
> → `source_entity_id`, `source_kind = "project"`. Реализуем в
> `usePoolStore.loadWeek` через preload-нормализацию перед
> `PoolFileSchema.parse`.

### 14. Удаление существующих файлов

После того как новый planner работает:

- `src/components/planner/InlineCreate.tsx` — старый inline create
  на ячейке. В v2 inline create через TaskBar (на Tasks экране)
  и через Quick Add. Удалить.
- `src/components/planner/WeekSummary.tsx` — старый «balance»
  виджет. Заменён на PoolBudget. Удалить.
- `src/components/planner/SnapPreview.tsx` — заменён на
  DropIndicator. Удалить (или переименовать).
- `src/components/planner/BlockEditor.tsx` — заменяется на
  EntityPopup для блока. Не удаляем сразу — оставляем как backup
  до фазы 9.
- `src/components/planner/WeekNotFoundDialog.tsx` — оставляем,
  логика та же.
- `src/components/planner/NowLine.tsx` — оставляем, та же.

### 15. Изменения в ui.ts

```ts
sideTab: "pool" | "tasks" | "projects" | "dirs";
setSideTab: (t: SideTab) => void;
// Modal — единственный API; в render используем switch по этому
// полю, без JSX-children pattern (псевдокод выше в §12 был
// иллюстративным).
poolModalOpen: null | "new-task" | "new-pool-item";
openPoolModal: (kind: "new-task"|"new-pool-item") => void;
closePoolModal: () => void;
```

`poolCollapsed` (toggle pool sidebar visibility) — сохраняем,
работает.

### 16. Тесты

- `recalc-pool.test.ts`: дробимые (hours scheduled), атомарные
  (placed), пустой набор.
- `block-position.test.ts`: top/height из start/duration.
- `pool-budget.test.ts`: busy/free/pool/slack для seed данных.

## Acceptance criteria

- [ ] Plan tab → новый layout с TimeGutter (07-23), 7 day cols,
  Pool Sidebar справа.
- [ ] Все seed-блоки из §14.1 видны:
  - Собаки утро Пн-Вс 07:00-07:30 (Пн-Ср done, opacity 0.35).
  - Собаки вечер 12:30-13:00.
  - Японский Пн/Ср/Пт 08:00-08:30 (Пн done).
  - Тренировка Вт/Чт/Сб 08:00-09:00 (Вт done).
  - Обед Пн-Пт 13:00-14:00 (Пн-Вт done).
  - GC монтаж Пн 09:00-11:00, Вт 09:00-10:30, Пт 10:00-11:00.
  - Подкаст Ср 09:00-11:00, Чт 10:00-11:00.
  - Статья FB Чт 09:00-10:30, Сб 09:00-10:00.
- [ ] Border-left 3px цвета категории. Background — 8.2% opacity.
- [ ] Done block: opacity .35, line-through.
- [ ] Time-text «09:00–11:00» виден если высота > 28px.
- [ ] Drag блока: ghost появляется, drop-indicator в целевой
  колонке, snap 30 мин, clamp. После drop — block перемещён.
- [ ] Resize за нижний край: snap 30 мин, min 30, max 480.
- [ ] ПКМ на блоке → context menu (Готово / Дублировать /
  Удалить).
- [ ] Selected block → outline accent. Delete/Backspace удаляет.
- [ ] Pool Header: «ПУЛ · W18». «+» открывает modal.
- [ ] Budget: live numbers (Занято, Свободно, Пул, Люфт).
  Прогресс-бар three segments.
- [ ] 4 таба переключаются.
- [ ] Tab «Пул»:
  - Дробимые:
    - p1 (12ч, scheduled = `Пн 2ч + Вт 1.5ч + Пт 1ч = 4.5ч`).
    - p2 (6ч, scheduled = `Ср 2ч + Чт 1ч = 3ч`).
    - p3 (4ч, scheduled = `Чт 1.5ч + Сб 1ч = 2.5ч`).
  - Атомарные: p4 (Позвонить маме, 0.5ч). p5 (Забрать документы,
    1.5ч).
  - p1, p2, p3 имеют progress bar.
- [ ] Tab «Задачи»: 12 задач отсортированы. ⚡ icons. Урgency
  цвета по deadline. Кнопка → toggles pool.
- [ ] Tab «Проекты»: 21 проект, sorted by la. Stale (la≥14)
  red days. Toggle → adds project as splittable pool item, 4ч.
- [ ] Tab «Контекст»: 9 directions, urgency для cadence
  отдельной формулой. Кнопка ✓ для cadence — отмечает выполнение.
  Toggle → adds via projects-or-direction logic.
- [ ] Drag из таба «Пул» дробимый p1 на сетку → создан 60-мин
  block, scheduled p1 += 1ч.
- [ ] Drag атомарный p5 (1.5ч) → создан 90-мин block, p5.placed = true.
- [ ] Drag из таба «Задачи» t5 → создан 60-мин block, t5
  отмечается «✓» в pool.
- [ ] Drag из таба «Проекты» pr1 → создан 60-мин block.
- [ ] При перемещении блока — pool пересчитывается.
- [ ] При удалении блока — pool пересчитывается.
- [ ] Modal «+ В пул недели» (sideTab !== tasks): создаёт
  PoolItem с указанными параметрами.
- [ ] Modal «Новая задача» (sideTab === tasks): создаёт task
  entity.
- [ ] Cmd+N на Plan → Quick Add тип = task (как в фазе 2).
- [ ] Week navigation: при смене недели заголовок «ПУЛ · WN»
  обновляется, pool/blocks подгружаются для новой недели.

## Тест-план

1. **Открыть Plan.** Видишь новую сетку. Проверь все блоки рутин
   и рабочих.
2. **Drag block.** Вторник GC 09:00-10:30 → перетащить на четверг
   на 14:00. Snap. Готово.
3. **Resize.** Тренировка вторник → растянуть до 10:00. Должна
   занять 8:00-10:00 (2ч).
4. **ctx menu.** ПКМ на «Японский Пн» → «Не готово» (он done) →
   стал planned.
5. **Pool tab Pool.** Видишь дробимые и атомарные. p1 GC scheduled
   = 4.5ч (sum: Пн 2ч + Вт 1.5ч + Пт 1ч). p2 = 3ч (Ср 2 + Чт 1).
   p3 = 2.5ч (Чт 1.5 + Сб 1).
6. **Drag pool dробимый.** p1 → перетащить на воскресенье 14:00 →
   создан 60-мин блок. p1.scheduled стало 5.5ч.
7. **Drag pool атомарный.** p5 «Забрать документы» (1.5ч) → drop
   на четверг 16:00 → создан 90-мин блок. p5.placed = true,
   opacity .4 в pool.
8. **Tab Tasks.** Кликнуть «→» у t5 «Интро для подкаста» → теперь
   в pool как `splittable: false, hours: 1`.
9. **Tab Projects.** Кликнуть «→» у pr5 «VDoing — сайт» → в pool
   `splittable: true, hours: 4`.
10. **Tab Context.** Кликнуть «✓ Отметить» для dir-mama → cadence
    обновился (как в Context экране, но из sidebar).
11. **Modal +.** На Tab Tasks → «+» → Modal «Новая задача» →
    создать. На Tab Pool → «+» → Modal «В пул недели».
12. **Budget.** Внести изменения и убедиться что числа двигаются.
    Если люфт = 0 или меньше — красный.
13. **Smena nedeli.** «›» → пул загрузился новый (если файла
    нет — пустой). Header «ПУЛ · W19».

## Что НЕ включает фаза 6

- Carry-over между неделями (перенос pool item на следующую
  неделю автоматически). Нет в спеке v2.
- Автоматическое создание pool items из tasks/projects (при
  старте недели). Сейчас юзер создаёт через toggle вручную.
- Шаблоны рутин (templates/) — оставляем как есть из v1.
  Применение template при создании week file — старая логика
  работает.
- Конфликт-detection блоков (overlap warning). Нет в спеке.
- Виртуализация скрола (если блоков > 100). Не нужно.
- Cross-week drag блоков. Нет.

## Ловушки

- **`pool_item_id`** в block schema — миграция: при чтении
  старых week файлов поле будет undefined. Z-default: null.
  Старая запись «source_entity_id указывает на pool entity»
  должна продолжать работать (matching по entity).
- **Recalc pool на смене недели.** При load week pool тоже
  читается, и recalcPool вызывается с новыми блоками. Без
  этого scheduled остаётся от прошлой недели.
- **Cancel drag.** Escape во время drag — отмена. Cleanup ghost,
  drop indicator.
- **Pointer events vs HTML5 drag.** Внутри планнера используем
  pointer events (нативные, через `useBlockGesture`). В
  Projects был HTML5. На страницу planner это не влияет (в
  pool sidebar drag-to-grid тоже pointer events).
- **Дробимый item: `hours: 12` пример.** scheduled может быть
  до 12. После 12 → progress full, line-through, opacity 0.5.
- **Атомарный item: `placed = true`.** Не draggable, нельзя
  поставить ещё раз. Если юзер удаляет связанный блок —
  recalc заметит и сбросит placed. Чтобы повторно поставить.
- **Pool tab «Задачи» и tasks page.** Один и тот же entity
  показывается на обоих экранах. Изменения через любой —
  применяются глобально. Кнопка в pool sidebar Task = `+ В
  пул`. На Tasks экране (фаза 3) toggle тоже доступен — но
  через какую кнопку? Спека этого не описывает явно. Решение:
  на Tasks экране кнопка «→ В пул» **не показывается** — на
  Tasks мы фокусируемся на статусе/приоритете. Pool toggle —
  только в Pool Sidebar.
- **Drag pool task → grid → проп category.** Берём из task.tags[0].
- **Удаление pool item с блоками.** Спека: «удаляет также все
  связанные блоки». Удаляем все blocks с
  `pool_item_id === pi.id`. И затем удаляем сам pi.
- **`GUTTER_W = 48` ≠ `--time-w` (44)** в текущем globals.css
  v1. v2 явно требует 48. Поменять в стилях.
- **`H_END = 23` ≠ v1 (22).** Это отличие. Все блоки в seed
  теперь умещаются (были до 22:00). Расширение на час —
  безопасно.
- **Day labels.** «Пн 28» — день недели + day-of-month. Уже
  есть `formatDayHeader` в time-utils или подобное. Проверить
  и адаптировать.
- **Persist-first.** Все мутации pool / blocks — сначала на диск,
  потом в state.
- **EntityPopup для блока.** Открывается двойным кликом. Если
  блок без `source_entity_id` (ad-hoc или routine без entity)
  — показываем поля BlockPopup (title / category / start /
  duration / status). Иначе — popup сущности (Task/Project/Direction).
