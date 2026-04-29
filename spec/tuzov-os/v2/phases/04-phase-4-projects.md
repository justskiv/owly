# Phase 4 — Экран «Проекты»

> **Цель:** реализовать экран Projects по §6 спеки: kanban с
> досками-табами, фильтр категорий, summary bar со stale-фильтром,
> drag-drop карточек между колонками, inline-create в каждой
> колонке. Entity Popup для project (расширение каркаса фазы 2).
>
> **Результат после фазы:** Projects tab показывает kanban активной
> доски, проекты в колонках по `column_index`, можно перетягивать
> между колонками (la=0 после drop), фильтровать по категориям и
> заброшенным (la≥14), создавать новый проект inline в колонке,
> кликать по карточке для редактирования.

## Контекст

Прочитай:

- `spec.md` §6 целиком, §10.3 (Entity Popup → блок «Для project»),
  §11.2 (Boards), §11.4 (Project model), §15.1 (маппинг на Entity).

### Маппинг имён полей: v2-spec ↔ Entity (наш store)

Спека v2 описывает `Project` в краткой форме (для in-mock JS):
`{ id, title, cat, bid, col, dirId, la }`. У нас на диске —
`Entity` с full snake_case полями (фаза 1 расширила
`ProjectFieldsSchema`):

| spec v2 | Entity store |
|---------|--------------|
| `bid` | `fields.board_id` |
| `col` | `fields.column_index` |
| `dirId` | `fields.direction_id` |
| `la` | `fields.last_activity_days` |
| `cat` | `tags[0]` (первый tag = область) |

Везде в коде используем имена из правой колонки. Адаптер для seed-
миграции (`seed-v2/entities.json`) применяет это преобразование
один раз при первом запуске v2 (фаза 1).
- `pool-planner-demo-v2.html`: `renderProjects`, обработчики drag,
  inline create.
- Текущий код: `src/components/entities/detail/ProjectDetail.tsx`,
  `src/components/entities/EntityList.tsx`, `EntityEditor.tsx`
  (для понимания текущей формы создания project).
- Phases 1, 2, 3.

## Что в фазе

### 1. ProjectsPage

`src/pages/ProjectsPage.tsx` — заменяет заглушку.

#### 1.1. Layout

```
ProjectsPage (flex column, padding 16/20, overflow hidden)
├── BoardBar (flex row, gap 6, padding-bottom 8, border-bottom)
│   ├── BoardTabs (flex, gap 2)
│   └── CatFilters (margin-left auto, gap 10)
├── SummaryBar (font-xs, padding 6 0)
└── Kanban (flex, gap 8, padding-top 10, overflow-x auto, flex 1)
    └── KanbanColumn × N (flex 0 0 220px)
        ├── ColumnHead
        ├── KanbanCard × M
        └── AddTrigger / InlineAdd
```

#### 1.2. Board Bar (§6.2)

Компонент `src/components/projects/BoardBar.tsx`.

Tab кнопки для каждой board из `BOARDS` (фаза 1). Active tab —
`background --bg-tint-2`, color `--text-primary`. Click меняет
`useUIStore.activeBoard`.

Cat filters справа: «Все» (текстовая кнопка) + по точке для
каждой `config.areas`. Click переключает
`useUIStore.catFilter` (single value, повторный клик — сброс).

**Стили (точно по §6.2 спеки):**

- `.cat-btn.all-btn` (кнопка «Все»):
  - default: `padding: 2 8`, `border: 1px solid var(--border)`.
  - **active**: `border-color: var(--accent)`, `color: var(--accent)`,
    `background: rgba(212,168,67,.08)`, `transform: none`, **без**
    `::after` checkmark. См. чек-лист §16: «"Все" — текстовая
    кнопка с accent border, без галочки».
- `.cat-btn` (точки категорий): `18×18px`, `border-radius: 50%`,
  `border: 2px solid transparent`. Hover: `transform: scale(1.15)`.
  **Active**: `border: 2px solid transparent` (НЕ белый),
  `transform: scale(1.25)`, `::after` с `✓` (font 9px, color #fff,
  font-weight 800, text-shadow `0 1px 2px rgba(0,0,0,.5)`). Gap
  10px между фильтрами.

State:

```ts
// в ui.ts
activeBoard: string;          // "brd1" | "brd2" | "brd3"
catFilter: string | null;     // area id
staleFilter: boolean;
```

#### 1.3. Summary Bar (§6.3)

```
"N активных" + " · M заброшенных" (если есть stale)
```

`stale-link` — кликабельная (red), toggle `staleFilter`.

Считаем:
- activeCount = projects, у которых `status === "active"` И
  `board_id === activeBoard` (после cat filter).
- staleCount = тех же, у которых `last_activity_days >= 14`.

#### 1.4. Kanban (§6.4)

Компонент `src/components/projects/Kanban.tsx`.

Колонки берутся из `BOARDS.find(b => b.id === activeBoard).columns`.

```tsx
{columns.map((colName, colIdx) => (
  <KanbanColumn
    key={colIdx}
    title={colName}
    columnIndex={colIdx}
    projects={projectsForColumn(colIdx)}
  />
))}
```

`projectsForColumn(idx)` — фильтрация проектов через cat /
stale, где `column_index === idx`.

#### 1.5. KanbanColumn

Компонент `src/components/projects/KanbanColumn.tsx`.

Структура:

```tsx
<div className="kanban-col"
     onDragOver={onDragOver}
     onDrop={onDrop}>
  <div className="kanban-col-head">
    {title} <span className="kanban-col-count">{count}</span>
  </div>
  <div className="kanban-cards">
    {projects.map(p => <KanbanCard project={p} key={p.id} />)}
  </div>
  <AddTrigger onCreate={createProject} colIdx={columnIndex} />
</div>
```

Drop handler: получает `projectId` из dataTransfer, вызывает
`updateEntity(projectId, { fields: { ...p.fields, column_index:
columnIndex, last_activity_days: 0 }})`.

#### 1.6. KanbanCard

Компонент `src/components/projects/KanbanCard.tsx`.

```tsx
<div
  className="kanban-card"
  draggable={true}
  onDragStart={(e) => e.dataTransfer.setData("text/plain", project.id)}
  onClick={openPopup}
  style={{ borderLeft: `3px solid ${categoryColor}` }}
>
  <div className="kc-title">{project.title}</div>
  <div className="kc-meta">
    <span className="kc-badge" style={{ background: catColor + "20", color: catColor }}>
      {catLabel}
    </span>
    <span className={"kc-days" + (la >= 14 ? " stale" : "")}>
      {la}д
    </span>
  </div>
  <button className={"btn-pool" + (inPool ? " in" : "")}
          onClick={togglePool}>
    {inPool ? "✓ В пуле" : "→ В пул"}
  </button>
</div>
```

#### 1.7. Pool toggle (заглушка для фазы 6)

Кнопка «→ В пул» / «✓ В пуле»:

- В фазе 4 — **минимальная имплементация**. Создаёт / удаляет
  PoolItem в `usePoolStore` для текущей недели (`splittable: true,
  hours: 4, source_entity_id: project.id, source_kind: "project"`)
  — см. §4.6 («Tab: Проекты»).
- Визуально работает: после клика кнопка меняет состояние, на
  Plan tab пока не виден pool item (фаза 6 покажет).
- Если pool item уже есть для project — состояние «✓ В пуле»,
  клик удаляет item.

```ts
function togglePool(project: ProjectEntity) {
  const existing = poolItems.find(
    pi => pi.source_entity_id === project.id && pi.source_kind === "project"
  );
  if (existing) usePoolStore.getState().removeItem(existing.id);
  else usePoolStore.getState().addItem({
    title: project.title,
    hours: 4,
    category: project.tags[0] ?? "work",
    splittable: true,
    source_entity_id: project.id,
    source_kind: "project",
    placed: false,
  });
}
```

#### 1.8. AddTrigger / InlineAdd (§6.4)

Компонент `src/components/projects/InlineAdd.tsx`.

Trigger (default): `+ Проект`, dashed border on hover. Click →
переходим в режим input.

Input mode:

```tsx
<div className="inline-add">
  <span className="ia-dot" style={{ background: catColor }} />
  <input
    autoFocus
    value={text}
    onChange={…}
    onKeyDown={handleKey}
    onBlur={handleBlur}
    placeholder="Название проекта..."
  />
</div>
```

Поведение:
- **Enter** при непустом тексте → создать проект
  (`createProject(text, activeBoard, columnIndex, defaultCat="work")`).
  Toast `"✓ {title}"`. Поле очищается, **остаётся открытым** —
  можно подряд создавать (по аналогии с task bar §5.2). Это же
  поведение в моке.
- **Escape** → закрыть, не сохранять.
- **Blur** при непустом тексте → создать (как Enter), затем
  закрыть. При пустом — закрыть без создания. См. чек-лист
  спеки §16.

Default category для inline в колонке Kanban (§6.4 примечание):
`work`. Категорию можно менять (клик по `.ia-dot` → cat picker
popup).

### 2. Entity Popup для project (§10.3 «Для project»)

Файл `src/components/entities/popup/ProjectPopup.tsx`.

Поля:

- **Title input** + close (×).
- **Category dots** (как в TaskPopup).
- **Тип/Доска (select)** — список из `BOARDS`. Изменение board:
  если `column_index >= newBoard.columns.length` → reset
  `column_index = 0`.
- **Направление (select)** — список directions + опция «—»
  (null). Изменение → `fields.direction_id`.

> **Спека явно говорит:** для project в Entity Popup **НЕТ**
> кнопки «Удалить» и блока `.ep-actions` (§10.3, §16). Так что
> проект из попапа не удаляется. Удаление — через старую
> EntitiesPage (debug Cmd+Shift+E) или через Quick Add не
> удаляется вообще. Для удаления проекта будет отдельный flow в
> фазе 7 (Horizon) — там есть кнопка «×» на строке проекта.

### 3. Сервис projects-helpers

`src/services/projects-helpers.ts`:

```ts
export function projectsForBoard(entities: Entity[], boardId: string): ProjectEntity[];
export function applyProjectFilters(
  projects: ProjectEntity[],
  catFilter: string | null,
  staleFilter: boolean,
): ProjectEntity[];
export function calcLastActivity(project: ProjectEntity, today: Date): number;
```

> `calcLastActivity` — на фазе 4 просто читает
> `fields.last_activity_days` из entity (seed-значение). В
> будущих фазах можно вычислять из реальной активности (последний
> блок, привязанный к проекту через `source_entity_id`). Пока —
> static.

### 4. Drag-and-drop карточек

Используем **HTML5 drag**, не @dnd-kit (как в моке §6.4).
`draggable={true}` на карточке, `onDragStart` пишет projectId,
column реагирует на `onDragOver` (preventDefault) + `onDrop`.

CSS hover для drop target:
- `.kanban-cards.drag-over` → `background: rgba(212,168,67,.04)`
  или просто акцентная рамка. Класс ставится через state на
  `dragOverColIdx`.

При drop:

```ts
async function onDrop(e: DragEvent, colIdx: number) {
  e.preventDefault();
  const projectId = e.dataTransfer.getData("text/plain");
  await updateEntity(projectId, {
    fields: { ...current.fields, column_index: colIdx, last_activity_days: 0 }
  });
}
```

### 5. Stale filter поведение

Когда `staleFilter === true`:
- Фильтр применяется поверх cat filter.
- Только `last_activity_days >= 14`.
- Title summary меняется: «N активных, показано M заброшенных»
  (или просто «M заброшенных»).
- Клик на «N заброшенных» в summary bar — toggle.

### 6. Изменения в существующих файлах

- `src/store/ui.ts`: `activeBoard`, `catFilter`, `staleFilter` +
  setters.
- Default `activeBoard = "brd1"` при первом запуске; persist в
  ui-store не нужен (state ephemeral).
- `src/store/entities.ts`: уже умеет `addEntity` с типом
  `project`, после фазы 1 ProjectFieldsSchema расширена. Без
  изменений.
- `src/store/pool.ts`: `addItem`, `removeItem` уже из фазы 1.
- `src/components/layout/Shell.tsx`: ProjectsPage уже в роуте.

### 7. Тесты

- `projects-helpers.test.ts`: `projectsForBoard`,
  `applyProjectFilters` (cat + stale combo).
- Smoke test (Playwright/manual): drag projectA из колонки 0 в
  колонку 2 → fields обновлены.

## Acceptance criteria

- [ ] Projects tab → kanban с дефолтной доской «Видео» (brd1) и 5
  колонками (Идея, Сценарий, Съёмка, Монтаж, Публикация).
- [ ] 7 проектов с `board_id=brd1` (pr1, pr16-pr21) распределены
  по колонкам по `column_index`.
- [ ] Переключение board tab меняет вид kanban.
- [ ] Cat filters: клик «work» → видны только work-проекты. Клик
  ещё раз — сброс. Клик «Все» — сброс.
- [ ] Summary bar: «N активных» + (если есть stale) « · M
  заброшенных» (red, кликабельный).
- [ ] Stale filter (la≥14): pr18 (la=25), pr11 (la=45) и др.
  включены в stale фильтр. Toggle через клик на summary.
- [ ] Drag pr16 «Ролик: Concurrency» из «Сценарий» в «Съёмка» →
  карточка переехала, la=0.
- [ ] Inline create в колонке: клик `+ Проект` → input → ввести
  «Новый ролик» → Enter → создан проект на текущей board, в этой
  колонке, cat=work.
- [ ] Blur при непустом → создаёт. Escape → отмена.
- [ ] Клик по карточке → ProjectPopup с category, board, direction.
  Изменения сохраняются (persist-first).
- [ ] В ProjectPopup НЕТ кнопки «Удалить».
- [ ] «→ В пул» создаёт PoolItem; повторный клик удаляет. Кнопка
  меняет состояние «✓ В пуле»/«→ В пул».
- [ ] Cmd+N на Projects → Quick Add с тип=project.
- [ ] Cat dot в карточке: borderLeft 3px цвета категории.
- [ ] kc-badge: background 20% opacity цвета, color — цвет.
- [ ] Stale day red: la≥14 → `color: var(--error)`.

## Тест-план

1. **Открыть Projects.** Видишь board «Видео» с 5 колонками.
   pr1 «Ролик про GC» в col 3 «Монтаж», pr19 «Сетап 2026» в col
   2, и т.п. Сверху summary «N активных».
2. **Переключить на «Контент».** Видишь pr2-pr3 в колонках.
3. **Cat filter.** На «Видео» → cat dot work — все остаются.
   На «Разное» → cat dot life — только pr7 «Рогалик».
4. **Stale.** Клик «N заброшенных» → видны только stale (pr18
   la=25, pr11 la=45, pr12 la=60, pr15 la=15 и т.п. из разных
   досок). Снять — обратно.
5. **Drag.** Перетянуть pr16 из «Сценарий» в «Монтаж» → теперь
   col=3, la=0. Через debug `Cmd+Shift+E` проверить
   `entities.json`.
6. **Inline create.** Кликнуть `+ Проект` под колонкой «Идея»
   → ввести «Test new» → Enter. Проект появился. Открыть Quick
   Add → пусто (input не остался).
7. **Edit popup.** Клик по карточке → попап. Сменить board на
   «Разное». Карточка исчезает (т.к. не в `brd1` теперь).
   Переключить на «Разное» — увидеть. В попапе НЕТ кнопки
   «Удалить».
8. **Pool toggle.** Клик «→ В пул» на pr5 → state изменился. В
   data/pool/2026-w18.json появилась запись с
   `source_entity_id: "pr5"`. Снова клик — удалилась.

## Что НЕ включает фаза 4

- Pool sidebar UI на Plan tab — фаза 6.
- Drag projects на сетку — фаза 6 (через pool sidebar).
- Удаление project через Project Popup — нет (по спеке). Через
  старую EntitiesPage Cmd+Shift+E.
- Реальный `last_activity_days` (вычисление по последнему блоку)
  — пока seed-значение. Можно сделать в фазе 9.
- Экспорт / импорт projects — нет.
- Sub-проекты, иерархия проектов — нет (нет в спеке).
- Архив колонки «Готово» (auto-status `done`) — нет в спеке. Но
  можно опционально: при column = последняя в board ставить
  status=done. Спека не требует — не делаем.

## Ловушки

- **Boards в config?** На фазе 1 BOARDS — хардкод. Если юзер
  попросит — переезжаем в config.json в фазе 9. Сейчас просто
  фиксированы 3 доски из спеки §11.2.
- **Цвет категории.** Берём из `config.areas`. Если у проекта
  `tags = []` — fallback `--text-tertiary`.
- **`pipeline_stage` vs `column_index`.** На фазе 1 мы добавили
  оба поля. Новый UI пишет **только** `column_index`/`board_id`.
  Поле `pipeline_stage` — legacy v1, его не трогаем (читаем
  только в старой EntitiesPage). Sync между двумя источниками
  правды — НЕ делаем (избегаем дрифта). В фазе 9 решаем, что с
  `pipeline_stage` (удалить или мигрировать).
- **Drag CSS.** Браузерный default style для drag-source
  достаточен (полупрозрачный preview). Дополнительный класс
  `.dragging` и задержку при unmount — НЕ вводим (gold-plate, не
  требуется спекой).
- **Drop в ту же колонку.** Игнорировать (no-op), не сбрасывать
  la=0 если column не сменился.
- **Empty kanban column.** Когда в колонке 0 проектов — показываем
  только трigger «+ Проект» (без пустого «No items»).
- **HTML5 drag без preventDefault.** На onDragOver обязателен
  `e.preventDefault()`, иначе onDrop не сработает.
- **Cat picker в InlineAdd.** Спека §6.4 явно требует только
  default cat = work. Возможность сменить категорию через клик
  по dot — **не делаем в фазе 4** (юзер изменит cat в Entity
  Popup после создания). Если нужно — фаза 9.
