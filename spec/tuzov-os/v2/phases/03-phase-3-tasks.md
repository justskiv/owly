# Phase 3 — Экран «Задачи»

> **Цель:** реализовать полнофункциональный экран Tasks по §5
> спеки: dual-mode task bar, группировка задач по deadline,
> sidebar-фильтры, поиск, urgency classes. На этой же фазе
> наполнить **Entity Popup для task** (используя каркас из фазы
> 2) — клик по строке задачи открывает popup с
> кат / приоритет / deadline / удалить.
>
> **Результат после фазы:** на табе «Задачи» видны все 12 seed-задач,
> сгруппированных по горит/срочно/скоро/когда-нибудь/готово.
> Фильтры, поиск, чекбоксы, создание, редактирование, удаление
> работают полностью.

## Контекст

Прочитай:

- `spec.md` §5 целиком (Layout, Task Bar, Groups, Row, Sidebar,
  Filtering, Urgency).
- `spec.md` §10.3 — Entity Popup, конкретно блок «Для task».
- `spec.md` §10.2 — Cat Picker Popup (используется в task bar).
- `pool-planner-demo-v2.html` — функции `renderTasksView`,
  обработчик task bar, `createTask`, `toggleTaskDone`.
- `spec/tuzov-os/v2/phases/01-…`, `02-…`.

## Что в фазе

### 1. Cat Picker Popup (доделать каркас из фазы 2)

Файл `src/components/quick-add/CatPickerPopup.tsx` (или
`shared/CatPickerPopup.tsx` — компонент общего назначения).

Props:

```ts
interface CatPickerPopupProps {
  anchor: { x: number; y: number };  // позиция точки-trigger
  onSelect: (categoryId: string) => void;
  onClose: () => void;
  // current selection — выделить как .active
  current: string | null;
}
```

Содержимое: список всех `config.areas` с иконкой dot и label.
Auto-clamp в viewport. См. §10.2.

### 2. TasksPage

Файл `src/pages/TasksPage.tsx` — заменяет заглушку из фазы 1.

#### 2.1. Layout

См. §5.1:

```
TasksPage (flex, padding 16/20, gap 16, justify center, overflow-y auto)
├── TasksInner (max-width 420)
│   ├── TasksHeader
│   ├── TaskBarWrap
│   ├── TaskGroups[]
│   └── DoneGroup
└── TasksSide (220px sticky)
    ├── OverviewCard
    ├── ByCategoryCard
    └── ByPriorityCard
```

CSS-классы: `.tasks-page`, `.tasks-inner`, `.tasks-side`. В
`globals.css`.

#### 2.2. TasksHeader (§5.2 верх)

```tsx
<div className="tasks-header">
  <h1>Задачи</h1>
  <span className="tasks-count">{activeCount} активных</span>
  {filterActive && (
    <button className="filter-chip" onClick={resetFilter}>
      ✕ {filterLabel}
    </button>
  )}
</div>
```

Стили: title font-lg bold, count font-xs `text-tertiary`,
`filter-chip` с иконкой ✕.

#### 2.3. Dual-mode Task Bar (§5.2)

Компонент `src/components/tasks/TaskBar.tsx`.

Самая хитрая часть фазы. Два слота:

- **Left slot** (`.tb-left`): morphs между `.as-btn` (32×32 кнопка
  «+») и `.as-field` (flex 1, поле ввода с category dot и ✕).
- **Right slot** (`.tb-right`): поле поиска, прячется
  (`width 0, opacity 0`) когда left в режиме `.as-field`.

State (в TaskBar — local state, не глобально):

```ts
const [mode, setMode] = useState<"search"|"add">("search");
const [addText, setAddText] = useState("");
```

Поиск (`useUIStore.taskSearch`) — глобальный state (см. ниже).

Поведение:

1. **Клик по `+`** (mode === "search"): `setMode("add")` →
   left morph, right hide. Auto-focus на input. Click-outside
   (`useEffect` с `mousedown` listener на `document`) → возврат
   в `"search"`.
2. **Enter в поле добавления** (mode === "add"):
   - Парсим через `parseQuickAdd` (из фазы 2) — поддержка
     `!завтра` и т.п.
   - Создаём task с `priority: "medium"`, `tags: [taskAddCat]`,
     `deadline: parsed.deadline`, status active.
   - Показываем toast `"✓ {title}"`.
   - **Поле остаётся открытым** (mode === "add"), input
     очищается. Можно добавлять подряд.
3. **Escape / клик по `✕`** в поле добавления → mode = "search".
4. **Клик по category dot** (внутри `.as-field`) → открыть Cat
   Picker Popup с anchor на точке. `onSelect` обновляет
   `taskAddCat`.

CSS transitions: `.tb-left`, `.tb-right` — `transition: flex 0.3s
ease, padding 0.3s ease, background 0.3s ease, border-color 0.3s
ease`. Input opacity: `transition: opacity 0.15s 0.1s` (с
задержкой). Все элементы остаются в DOM, только меняются классы
(не unmount/mount — иначе моргание).

#### 2.4. State `taskAddCat` + `taskSearch` + `taskFilter`

В `src/store/ui.ts`:

```ts
taskAddCat: string;             // default из config.areas[0]
taskSearch: string;
taskFilter: TaskFilter | null;

setTaskAddCat: (cat: string) => void;
setTaskSearch: (q: string) => void;
setTaskFilter: (f: TaskFilter | null) => void;

type TaskFilter =
  | { type: "cat"; val: string }
  | { type: "prio"; val: "high"|"medium"|"low" }
  | { type: "overdue" }
  | { type: "week" }
  | { type: "done" };
```

Default `taskAddCat`:

```ts
// Спека §11.9 фиксирует 'life' как seed-значение. У нас config
// настраивается юзером, поэтому: ищем 'life' среди config.areas;
// если нет — берём первую area; если config пустой — Tasks
// экран показывает заглушку «Сначала настройте области».
const defaultCat =
  config.areas.find(a => a.id === "life")?.id ??
  config.areas[0]?.id ??
  null;
```

#### 2.5. Task Groups (§5.3)

Компонент `src/components/tasks/TaskGroups.tsx`.

Логика группировки:

```ts
function groupTasks(tasks: TaskEntity[], today: Date) {
  const groups = {
    burning: [] as TaskEntity[],   // 🔥 Горит, d ≤ 2 (incl. d<0)
    urgent: [] as TaskEntity[],    // ⚡ Срочно, 3 ≤ d ≤ 7
    soon: [] as TaskEntity[],      // 📋 Скоро, 8 ≤ d ≤ 30
    someday: [] as TaskEntity[],   // 💤 Когда-нибудь
    done: [] as TaskEntity[],      // ✓ Готово
  };
  for (const t of tasks) {
    if (t.status === "done") { groups.done.push(t); continue; }
    const d = daysUntil(t.deadline, today);
    if (d === null || d > 30) groups.someday.push(t);
    else if (d <= 2) groups.burning.push(t);
    else if (d <= 7) groups.urgent.push(t);
    else groups.soon.push(t);
  }
  // Внутри группы: priority high→low, потом deadline ближе→дальше
  for (const k of Object.keys(groups)) groups[k].sort(byPriorityThenDeadline);
  return groups;
}
```

`daysUntil` — уже есть в `time-utils` (или в новом
`src/services/urgency.ts`).

Render:

```tsx
{nonEmptyGroups.map(g => (
  <div className="task-group" key={g.id}>
    <div className="task-group-head">
      {g.icon} {g.label} <span className="tg-count">{g.items.length}</span>
    </div>
    {g.items.map(t => <TaskRow task={t} key={t.id} />)}
  </div>
))}
```

Группа Done в самом низу.

`byPriorityThenDeadline` (используется в `groupTasks`):

```ts
function byPriorityThenDeadline(a: TaskEntity, b: TaskEntity): number {
  const prioOrder = { high: 0, medium: 1, low: 2, [null as any]: 3 };
  const pa = prioOrder[a.priority ?? "null"];
  const pb = prioOrder[b.priority ?? "null"];
  if (pa !== pb) return pa - pb;
  // null deadline в конец (значимо в группе someday; в остальных
  // null невозможен, но безопаснее иметь общий порядок).
  if (a.deadline === null) return 1;
  if (b.deadline === null) return -1;
  return a.deadline.localeCompare(b.deadline);  // ISO строки сортируются лексикографически
}
```

#### 2.6. Task Row (§5.4)

Компонент `src/components/tasks/TaskRow.tsx`:

```tsx
<div className="task-row" onClick={openPopup}>
  <button className={"tr-check" + (done ? " checked" : "")}
          onClick={toggleDone}>
    {done ? "✓" : ""}
  </button>
  <div className="tr-body">
    <div className="tr-title">{title}</div>
    <div className="tr-sub">{prioLabel}</div>
  </div>
  {deadline && (
    <div className={"tr-deadline " + urgClass(d)}>
      {formatDeadline(d)}
    </div>
  )}
  <div className="tr-cat" style={{ background: catColor }} />
</div>
```

Tooltip для tr-cat — label категории.

Цвет точки: **первый из `task.tags`, matching с `config.areas`**
(не просто `tags[0]` — могут быть non-area tags). Если ни один
не matches — fallback `--text-tertiary`. Реализуется через хелпер
`pickAreaTag(tags, areas)` в `src/services/area-helpers.ts`.

CSS для done:
```css
.task-row.done { opacity: .3; }
.task-row.done .tr-title { text-decoration: line-through; }
```

`urgClass`, `formatDeadline` — в `src/services/urgency.ts`. Спека
§5.7:

```ts
function urgClass(d: number | null): string {
  if (d === null) return "";
  if (d < 0 || d <= 3) return "urgency-bad";
  if (d <= 7) return "urgency-warn";
  return "urgency-ok";
}
function formatDeadline(d: number): string {
  if (d < 0) return `${-d}д просрочено`;
  if (d === 0) return "сегодня";
  return `${d}д`;
}
```

CSS для urgency:
- `.urgency-bad` → color `--error`.
- `.urgency-warn` → color `--warning`.
- `.urgency-ok` → color `--success`.

Klик по checkbox → `useEntityStore.updateEntity(id, { status:
toggle })` (persist-first). НЕ распространяется на row click.

Klик по строке (не по checkbox) → `openEntityPopup(t.id, anchor=row,
position="below")`.

#### 2.7. Tasks Sidebar (§5.5)

Компонент `src/components/tasks/TasksSidebar.tsx`.

Три карточки: Обзор / По категориям / По приоритету. Каждая
кликабельная → `setTaskFilter`.

```tsx
<aside className="tasks-side">
  <OverviewCard />        {/* Все, Выполнено, Просрочено, На неделе */}
  <ByCategoryCard />      {/* по config.areas */}
  <ByPriorityCard />      {/* high, medium, low */}
</aside>
```

Активный фильтр — строка с `.active` (background `--bg-tint-2`).
Повторный клик — сбрасывает фильтр (см. §5.5).

#### 2.8. Filtering logic (§5.6)

В компоненте TasksPage селектор:

```ts
const filteredTasks = useMemo(() => {
  let list = allActiveTasks;
  // search первым
  if (taskSearch) {
    const q = taskSearch.toLowerCase();
    list = list.filter(t => t.title.toLowerCase().includes(q));
    // Note: спека §5.6 говорит — search не применяется к группе done.
    // Реализуем это в groupTasks: group "done" собирается из
    // unfiltered set.
  }
  if (taskFilter) {
    switch (taskFilter.type) {
      case "cat": list = list.filter(t => t.tags.includes(taskFilter.val)); break;
      case "prio": list = list.filter(t => t.priority === taskFilter.val); break;
      case "overdue": list = list.filter(t => daysUntil(t.deadline) !== null && daysUntil(t.deadline) < 0); break;
      case "week": list = list.filter(t => daysUntil(t.deadline) !== null && daysUntil(t.deadline) >= 0 && daysUntil(t.deadline) <= 7); break;
      case "done": return allDoneTasks;  // спецслучай
    }
  }
  return list;
}, [allActiveTasks, taskSearch, taskFilter]);
```

> Важно: если `taskFilter.type === "done"`, показываем **только**
> done-задачи (без активных). См. §5.6.

Empty state: «Нет задач по этому фильтру» (opacity .4, центр).

### 3. Entity Popup для task (§10.3)

Доделать каркас из фазы 2.

Компонент `src/components/entities/popup/TaskPopup.tsx`:

Поля:

```tsx
<EntityPopup ...>
  <input
    className="ep-title"
    value={title}
    onChange={…}
    onBlur={persist}
  />
  <button className="ep-close" onClick={onClose}>✕</button>

  <div className="ep-row ep-cat-dots">
    {areas.map(a => (
      <button
        key={a.id}
        className={"ep-cat-dot" + (tags.includes(a.id) ? " on" : "")}
        style={{ background: a.color }}
        onClick={() => setCategory(a.id)}
      />
    ))}
    {/* setCategory: replace area-tags only, не сносим non-area tags.
        Реализация: tags.filter(t => !areaIds.includes(t)).concat(a.id) */}
  </div>

  <div className="ep-row ep-prio">
    <button className={prioBtn("high")} onClick={() => setPrio("high")}>
      ⚡ Высокий
    </button>
    <button className={prioBtn("medium")}>● Средний</button>
    <button className={prioBtn("low")}>○ Низкий</button>
  </div>

  <div className="ep-row">
    <input
      type="date"
      className="ep-deadline"
      value={deadline ?? ""}
      onChange={e => setDeadline(e.target.value || null)}
    />
  </div>

  <div className="ep-actions">
    <button className="ep-delete" onClick={onDelete}>Удалить</button>
  </div>
</EntityPopup>
```

Всё persist-first через `useEntityStore.updateEntity` /
`removeEntity`.

`title` редактирование: при blur пишем; Enter тоже триггерит blur.

Удаление: `useEntityStore.removeEntity(id)` → toast «Удалено:
{title}» → закрыть popup.

### 4. Изменения в существующих файлах

- `src/store/ui.ts` — `taskAddCat`, `taskSearch`, `taskFilter`,
  `entityPopup` (если ещё не добавили).
- `src/components/layout/Shell.tsx` — TasksPage уже подключена в
  фазе 1 (была заглушкой), теперь рендерит реальный компонент.

### 5. Тесты (vitest)

- `src/services/urgency.test.ts`: `urgClass`, `formatDeadline`,
  `daysUntil`.
- `src/services/groupTasks.test.ts` (или внутри tasks-page тестов):
  - 12 seed-задач корректно делятся на группы.
  - Сортировка внутри группы (priority → deadline).
  - Empty groups не показываются (если в группе 0 — её нет).
- `src/services/quick-add-parser.test.ts` уже есть из фазы 2.

## Acceptance criteria

- [ ] Tab «Задачи» (или Digit2) открывает реальный TasksPage.
- [ ] Видно 12 seed-задач, разделённых по 4 группам (плюс Готово
  пусто, если не отметить чекбокс).
- [ ] **Task Bar:** клик по `+` → морфит в input + hide search;
  Enter создаёт task; поле остаётся открытым; Escape / ✕ /
  click outside возвращает в search режим.
- [ ] Создание через task bar: «Тестовая !завтра» → создалась
  задача с deadline = завтра, в группе 🔥 Горит.
- [ ] Поиск работает в реальном времени (без debounce). Поиск
  «Купить» — фильтрует, но Готово показывает всё.
- [ ] Sidebar фильтры:
  - Клик «Все» → сброс фильтра.
  - Клик «Выполнено» → показывает только done.
  - Клик «Просрочено» → только просроченные.
  - Клик категории → только этой категории.
  - Клик приоритета → только этого приоритета.
  - Повторный клик активного — сбрасывает.
- [ ] Активный фильтр виден чипом в header с ✕, клик → сброс.
- [ ] Чекбокс toggle → задача мгновенно перепопадает в Готово /
  обратно. Сохраняется на диск.
- [ ] Клик по строке (не по чекбоксу) → открывается **Entity
  Popup** с полями: category dots, priority, deadline, удалить.
- [ ] Изменение в Entity Popup сохраняется (persist-first), UI
  обновляется live.
- [ ] Кнопка «Удалить» в popup — удаляет задачу, toast, popup
  закрывается.
- [ ] Cmd+N на этом экране → Quick Add с тип=task.
- [ ] Urgency колор: «Купить корм» (deadline `2026-04-29`,
  TODAY=2026-04-29) → красный «сегодня». Завтра — красный «1д».
  Через 5 дней — жёлтый. Через 14 дней — зелёный.
- [ ] **Empty `config.areas`** edge case: TasksPage показывает
  заглушку «Сначала добавьте области в Settings» вместо TaskBar
  и групп. Не падает, не пустой экран.
- [ ] **Search input cursor restore.** Печатать в поле поиска,
  потом кликнуть в середину текста, ввести ещё букву — курсор
  остаётся в нужной позиции (re-render не сбрасывает selection).
  Реализация — controlled input + `useRef` для selectionStart.
- [ ] `task check` проходит. Vitest зелёный.

## Тест-план (smoke)

1. **Открыть Tasks tab.** Видишь 12 задач в группах. Из спеки
   §14.3:
   - 🔥 Горит: t3 «Купить корм» (29.04 = сегодня), t1 «Забрать
     документы» (30.04 = +1д), t9 «Оплатить хостинг» (01.05 = +2д).
   - ⚡ Срочно: пусто (если today=29.04).
   - 📋 Скоро: t2 «Купить билеты» (15.05 = +16д), t11 «Поменять
     масло» (20.05 = +21д).
   - 💤 Когда-нибудь: t4-t8, t10, t12 (без deadline).
2. **Создание.** Клик «+» → ввести «Заплатить за интернет
   !05.10» → Enter → задача в группе 🔥/📋 (зависит от 11д
   разницы — Срочно или Скоро). Tab остаётся открытым, добавить
   ещё.
3. **Поиск.** Ввести «купить» — отфильтровались. Очистить.
4. **Sidebar.** Клик «По категориям → Работа» → только work.
   Клик ещё раз — сбросить.
5. **Чекбокс.** Кликнуть на t1 «Забрать документы» — переехал в
   Готово, line-through.
6. **Entity Popup.** Клик по строке t2 → попап. Поменять prio
   на High → закрыть → видно «⚡ Высокий» в строке. Удалить.
7. **Cmd+N.** На Tasks → Cmd+N → Quick Add с тип=task.

## Что НЕ включает фаза 3

- Связь tasks ↔ pool (toggle «→ В пул» из task list — это
  делает задачу частью pool недели). Это будет в фазе 6 (когда
  pool sidebar подключаем).
- Связь tasks ↔ projects (через `parent_project_id`) — в фазе 4
  (Projects).
- Drag tasks на сетку — фаза 6.
- Управление чек-листом задачи (`fields.checklist`) внутри
  popup — нет, оставляем редактирование чек-листа через
  старую EntityEditor (Cmd+Shift+E). Можно добавить в фазе 9.
- Markdown в title или description — нет.
- Сортировка пустого результата фильтра — empty state из спеки
  §5.6 («Нет задач по этому фильтру»).

## Ловушки

- **Морфинг task bar.** Если переключать через
  unmount/mount компонента — будет моргание. Реализуем через
  CSS-классы и conditional rendering inside (input всегда в DOM,
  только меняется flex/opacity). См. чек-лист спеки §16:
  «Task bar: dual-mode через CSS-классы, без моргания».
- **Click outside для task bar.** Listener на mousedown на
  document, проверка `e.target` не внутри `.task-bar-wrap`.
  Учесть, что click по cat picker popup тоже может быть outside
  task bar — но cat picker рендерится через portal, нужно
  whitelist по `.cat-popup`.
- **Tasks без deadline сортировка.** В группе «Когда-нибудь»
  сортируем только по priority (deadline отсутствует).
- **`isoDate` от parseQuickAdd.** Учесть, что `daysUntil` в
  v1 уже умеет null. Не сломать.
- **Cat color в `.tr-cat`.** Берём из `config.areas`. Если у
  task `tags = []` — fallback на serый. Если несколько тегов
  одновременно — берём первый matching из areas.
- **Persist-first.** При toggle done: сначала
  `await updateEntity(id, { status })`, потом UI меняется через
  store-подписку (это уже работает в текущем
  `useEntityStore`). Не делать optimistic update до записи.
- **Big lists.** 12 задач — не проблема. Если в проде юзер
  накопит 200 — нужны virtualized lists. Откладываем.
