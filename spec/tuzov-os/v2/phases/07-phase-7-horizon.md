# Phase 7 — Экран «Горизонт»

> **Цель:** реализовать экран Horizon по §8 спеки: таблица
> проекты × месяцы (8 столбцов), группировка по размеру (big /
> mid / small), drop row снизу, бэклог-сайдбар (260px) с тремя
> динамическими секциями (Актуальное / Когда-нибудь / Скрытое),
> drag-and-drop из бэклога на доску, hide / delete actions,
> highlight at hover/click.
>
> **Результат после фазы:** на табе «Горизонт» видна таблица
> с 8 колонками месяцев (текущий + 7 вперёд), 16 seed-проектов
> размещены по chips, 5 — в бэклоге «Когда-нибудь». Скрытое
> пустое. Drag из бэклога на доску, hide убирает в Скрытое,
> delete — обратно в Когда-нибудь. Highlight подсвечивает строку
> в обе стороны (доска ↔ бэклог).

## Контекст

Прочитай:

- `spec.md` §8 целиком (Layout, Horizon Board, Backlog, Auto move).
- `spec.md` §11.8 (Horizon Data, важно: `hzPrio` НЕ реализуется).
- `spec.md` §14.6 (seed данные).
- `pool-planner-demo-v2.html`: `renderHorizon`, `renderBacklog`,
  обработчики drag/hide/delete, highlight logic.
- Phases 1, 2, 4 (горизонт оперирует projects, нужен board_id и
  category из projects).

## Что в фазе

### 1. HorizonPage

`src/pages/HorizonPage.tsx` — заменяет заглушку.

#### 1.1. Layout (§8.1)

```
HorizonPage (.horizon-view, flex, overflow hidden)
├── HorizonBoard (.hz-board, flex 1, overflow auto)
│   ├── Toolbar (.hz-toolbar)
│   └── Table (.hz-grid, border-collapse collapse, width 100%)
│       ├── thead (sticky)
│       │   └── tr — name col + 8 месяцев
│       ├── tbody — group rows + project rows
│       └── tfoot — drop row
└── Backlog (.hz-backlog, 260px, border-left)
    ├── Header
    └── Section × 3 (active / someday / deferred)
```

### 2. Mонths header (§8.2)

```ts
// src/services/horizon-helpers.ts
const MC = 8;  // month columns
export function getHorizonMonths(baseMonth: string): { label: string; isCurrent: boolean }[];
```

`baseMonth = "2026-04-01"`. Лейблы — рус. сокращения `["янв",
"фев", ...]`. Первый месяц помечается `.current` с
`color: --accent`.

> Hardcoded в моке Apr–Nov, у нас динамически от текущего месяца
> (с round к началу месяца).

### 3. Project size grouping (§8.2)

Размеры берутся из `HorizonProjectState.size`. Группы:

```ts
export const SIZE_GROUPS = [
  { id: "big",   label: "Тяжёлые проекты", icon: "⏨" },
  { id: "mid",   label: "Средние проекты", icon: "□" },
  { id: "small", label: "Мелкие проекты",  icon: "○" },
] as const;
```

Group header row (`hz-group-row`): кликабельный, toggle через
`useHorizonStore.toggleGroup(g)`. Arrow ▼/▶ + icon + label + count.

### 4. Project row (§8.2)

```tsx
<tr className={highlighted ? "highlighted" : ""}>
  <td className="name-cell">
    <span className="hz-dot" style={{ background: catColor }} />
    <span className="hz-title">{project.title}</span>
    <div className="hz-actions">
      <button className="hz-action-btn" onClick={hide} title="Скрыть">
        <EyeSlashIcon />
      </button>
      <button className="hz-action-btn danger" onClick={remove}>
        <XIcon />
      </button>
    </div>
  </td>
  {months.map((m, i) => (
    <td
      key={i}
      className={"month-cell" + (m.isCurrent ? " current" : "")}
      onClick={() => toggleChip(project.id, i)}
    >
      {state.months.includes(i) && (
        <span
          className="hz-chip"
          style={{ background: catColor + "20", color: catColor }}
        >
          ●
        </span>
      )}
    </td>
  ))}
</tr>
```

`hz-actions`: opacity 0 default, opacity 1 on row hover.

`toggleChip(projectId, monthIdx)`:

```ts
async function toggleChip(projectId: string, monthIdx: number) {
  const state = horizon.projects.find(p => p.project_id === projectId);
  const months = state?.months ?? [];
  const next = months.includes(monthIdx)
    ? months.filter(m => m !== monthIdx)
    : [...months, monthIdx].sort();
  await useHorizonStore.getState().setMonths(projectId, next);
}
```

### 5. Drop row (§8.2)

Снизу `<tr.hz-drop-row>`:

```tsx
<tr className="hz-drop-row"
    onDragOver={onDragOver}
    onDrop={onDrop}>
  <td>перетащи сюда ↓</td>
  {months.map((m, i) => (
    <td
      key={i}
      onDragOver={onDragOver}
      onDrop={(e) => onDropToMonth(e, i)}
      className={dragOverMonth === i ? "hz-drop-cell over" : "hz-drop-cell"}
    />
  ))}
</tr>
```

`onDrop`:
- Получить projectId из dataTransfer.
- Drop на конкретный месяц-cell в drop row → `setMonths(projectId, [monthIdx])`.
- Drop на name-cell drop row → **игнорируем** (нет очевидного
  целевого месяца; юзер должен попасть в month cell).
- Если был hidden — `setHidden(projectId, false)`.

Это переводит проект в секцию «Актуальное» (см. §8.4).

### 6. Backlog Sidebar (§8.3)

#### 6.1. Header

```
┌─ Бэклог ─┐
```

Просто заголовок.

#### 6.2. 3 секции (Active / Someday / Deferred)

```ts
// src/services/horizon-helpers.ts
export function classifyProject(state: HorizonProjectState): "active"|"someday"|"deferred" {
  if (state.hidden) return "deferred";
  if (state.months.length > 0) return "active";
  return "someday";
}
```

Спека §8.3 явно: используем `hzData` (months[]) и `hzHidden`
(state.hidden) для определения секции. **Не используем `hzPrio`
вообще** (§11.8).

```tsx
{(["active","someday","deferred"] as const).map(s => {
  const items = projects.filter(p => classifyProject(p) === s);
  return (
    <BacklogSection
      key={s}
      kind={s}
      items={items}
      collapsed={sectionCollapsed[s]}
      onToggle={() => toggleSection(s)}
    />
  );
})}
```

Иконки и подписи (по §8.3):
```ts
const SECTION_META = {
  active:   { icon: "●", label: "Актуальное" },
  someday:  { icon: "○", label: "Когда-нибудь" },
  deferred: { icon: "⏸", label: "Скрытое" },
};
```

#### 6.3. BacklogSection

```tsx
<div className="bl-section">
  <div className="bl-section-head" onClick={onToggle}>
    {iconForSection(kind)} {labelForSection(kind)} <span>{count}</span>
    <span className="bl-arrow">{collapsed ? "▶" : "▼"}</span>
  </div>
  {!collapsed && items.map(p => (
    <BacklogItem state={p} key={p.project_id} />
  ))}
</div>
```

Default `sectionCollapsed`:
- active: false
- someday: false
- deferred: true

#### 6.4. BacklogItem (§8.3)

```tsx
<div
  className={"hz-bl-item" + (highlighted ? " hl" : "") + (hidden ? " hidden" : "")}
  draggable
  onDragStart={onDragStart}
  onMouseEnter={onHover}
  onMouseLeave={onLeave}
  onClick={onClick}
>
  <span className="bl-color" style={{ background: catColor }} />
  <span className="bl-title">{project.title}</span>
  {state.months.length > 0 && (
    <span className="bl-dots">
      {state.months.map(m => MONTH_SHORT[m]).join(" ")}
    </span>
  )}
</div>
```

Поведение:
- **Hover** — устанавливает temporary `highlight = projectId`.
- **Click**:
  - Если hidden → восстановить (`setHidden(projectId, false)`).
  - Иначе → toggle fixed highlight (если уже подсвечен — снять).
- **Drag** — `setData("text/plain", projectId)`, drop на drop row
  или month-cell board (как описано выше).

### 7. Highlight (§8.2)

State (в `ui.ts` или local):

```ts
horizonHighlight: { projectId: string; fixed: boolean } | null;
setHorizonHighlight: (h: typeof horizonHighlight) => void;
```

При hover на BacklogItem (если нет fixed) — устанавливается
temporary. На leave — снимается. Click → fixed=true (или toggle).

Effect: на доске `<tr>` с этим projectId получает класс
`.highlighted`. CSS:

```css
tr.highlighted td { background: rgba(212,168,67,.04); }
tr.highlighted .hz-chip { outline: 2px solid var(--accent); outline-offset: 1px; }
```

В backlog `.hl`: `background: var(--bg-tint-2); outline: 1px solid var(--accent)`.

### 8. Auto-move logic (§8.4)

Как только `state.months` или `state.hidden` меняются — секция
проекта в backlog меняется автоматически (она computed). Никакого
явного перемещения между секциями нет.

При drag из бэклога на доску:
1. `setMonths(projectId, [monthIdx])`.
2. Если был `hidden` → `setHidden(projectId, false)`.

При hide:
- `setHidden(projectId, true)`. Состояние months сохраняется,
  чтобы при unhide показались назад chips.

При delete (× icon):
- `setMonths(projectId, [])`. **Только это** — `hidden` не
  трогаем (спека §8.2 говорит «delete очищает `hzData[projectId]`»,
  про hidden не упоминает).
- Если `state.hidden` был true — проект остаётся в «Скрытое»
  с пустыми months. Если был false — попадает в «Когда-нибудь»
  (через computed classifyProject).

> Спека §8.2 говорит «delete очищает hzData[projectId]». Это и
> есть `setMonths([])`. Не путать с удалением проекта-сущности —
> на горизонте `delete` это **снять с доски**, а не удалить
> entity. Кнопка имеет class `.danger` для понимания «Это
> агрессивное действие, но не удаление навсегда». Сам проект
> остаётся в `entities.json`.

### 9. HorizonStore

(Уже введён в фазе 1.) Действия:

- `load()` — читает `data/horizon.json`. Файл к этому моменту
  уже существует (создан seed-миграцией фазы 1). Fallback на
  пустую структуру нужен только в edge case (юзер удалил
  horizon.json вручную) — тогда создаём с `projects: []`,
  `base_month` = первое число текущего месяца.
- `setMonths(projectId, months)` — persist-first.
- `setHidden(projectId, hidden)`.
- `setSize(projectId, size)`.
- `toggleGroup(g)`.
- `toggleSection(s)`.
- `addProject(projectId)` — когда появляется новый project
  entity (через Quick Add / Inline create), мы автоматически
  добавляем его в horizon.projects с пустым months и
  size = "mid" по умолчанию.
- `removeProject(projectId)` — когда entity удалён.

Подписка: при изменении entities (добавление/удаление project)
синхронизировать horizon.projects. Реализовать через
`useEntityStore.subscribe` в `App.tsx` или внутри HorizonStore.

### 10. Drag-and-drop в HorizonPage

HTML5 drag (как в Projects экране):
- BacklogItem — `draggable`, ondragstart пишет projectId.
- Drop row + month cells в drop row — onDragOver/onDrop.
- Также: project row name-cell — `draggable`, чтобы можно было
  перетянуть строку обратно в бэклог? Нет, спека этого не
  описывает.

### 11. Sizes — кто их назначает?

Спека §8.2 показывает группировку, но не описывает UI для смены
размера. В моке размеры захардкожены.

**Решение фазы 7:** размер хранится в `HorizonProjectState.size`,
seed заполняет из §14.6 (10 big / 8 mid / 3 small). Изменение
размера — **не реализуем** в этой фазе. В фазе 9 (или поздней)
можно добавить контекстное меню или select в name-cell.

### 12. Category section ordering — для Horizon

Спека не описывает явно порядок проектов в группе. В моке
проекты в порядке `entities.json`. Делаем то же.

### 12.5. Command schema расширение для horizon

В `src/schemas/command.ts` добавить:

```ts
export const SetHorizonMonthsCommandSchema = z.object({
  ...baseCommandShape,
  action: z.literal("set_horizon_months"),
  data: z.object({
    project_id: z.string(),
    months: z.array(z.number().int().min(0).max(11)),
  }),
});

export const SetHorizonHiddenCommandSchema = z.object({
  ...baseCommandShape,
  action: z.literal("set_horizon_hidden"),
  data: z.object({
    project_id: z.string(),
    hidden: z.boolean(),
  }),
});

export const SetHorizonSizeCommandSchema = z.object({
  ...baseCommandShape,
  action: z.literal("set_horizon_size"),
  data: z.object({
    project_id: z.string(),
    size: HorizonSizeSchema,    // "big"|"mid"|"small"
  }),
});
```

Добавить в discriminated union'ы. Handlers в `command-executor.ts`
— через `useHorizonStore` (persist-first).

> Расширение командной схемы для каденций (`mark_cadence`) — это
> alias для `update_entity` направления с `last_act = today`.
> Можно реализовать как отдельный action для удобства AI, либо
> оставить агенту использовать общий `update_entity`. Решение —
> в фазе 9.

### 13. Тесты

- `horizon-helpers.test.ts`: `getHorizonMonths`,
  `classifyProject`, корректные секции.
- `horizon-store.test.ts`: setMonths, setHidden, persist.

## Acceptance criteria

- [ ] Horizon tab → таблица с 8 колонками месяцев (current month
  + next 7).
- [ ] Первая колонка месяца — `.current` (accent color), label
  `«{текущий месяц рус. сокр.} · сейчас»` (например на 29.04.2026
  — «Апр · сейчас»; в мае — «Май · сейчас»).
- [ ] 3 группы (big / mid / small) с count.
- [ ] 16 проектов из §14.6 видны на доске:
  - pr1: chips в Апр и Май.
  - pr2: chip в Апр.
  - pr3: chip в Май.
  - и т.д.
- [ ] 5 проектов в бэклоге «Когда-нибудь» (те, у которых
  `months: []` и !hidden): pr7, pr11, pr12, pr18, pr21 (если
  опираться на seed §14.4 которые **не** в hzData §14.6).
- [ ] «Скрытое» пусто.
- [ ] Hover BacklogItem → строка на доске подсвечивается
  (rgba accent), chip outline accent. В бэклоге item gets `.hl`.
- [ ] Click BacklogItem → fix highlight. Click ещё раз — снять.
- [ ] Drag pr7 из бэклога на drop row col=Апр → pr7 получил
  chip Апр, переехал в «Актуальное».
- [ ] Click month-cell на пустой ячейке → создал chip там.
  Click на chip → удалил.
- [ ] Click hide на pr1 → pr1 убрался с доски, в «Скрытое».
  Click на pr1 в «Скрытое» → восстановился (chips на месте).
- [ ] Click delete (`×`) на pr1 → chips сняты, pr1 в «Когда-
  нибудь». Project entity не удалён.
- [ ] Toggle group (big) → строки этой группы скрылись, header
  остался с count. Toggle обратно.
- [ ] Toggle section в бэклоге.
- [ ] Создание нового project entity (через Quick Add) →
  автоматически появляется в бэклоге «Когда-нибудь».
- [ ] Удаление project entity → исчезает из horizon.
- [ ] Cmd+N на Horizon → Quick Add тип=project (по фазе 2).
- [ ] При смене недели — Horizon не меняется (не per-week).

## Тест-план

1. **Открыть Horizon.** Видишь таблицу. 16 проектов на доске,
   5 в «Когда-нибудь», «Скрытое» пусто. Группа big — 10 проектов.
2. **Drag pr7 из бэклога на Май cell в drop row** → pr7 чипом в
   Май, в «Актуальное».
3. **Click month-cell.** На pr1 row, кликнуть Июн → новый chip.
4. **Hide.** Hover pr1 → видишь action icons. Click eye → ушёл
   в «Скрытое».
5. **Restore from hidden.** Click pr1 в «Скрытое» → вернулся в
   «Актуальное» с прежними chips.
6. **Delete.** Hover pr16 → click ×. chips исчезли, в «Когда-
   нибудь».
7. **Highlight.** Hover на pr19 в бэклоге → строка на доске
   подсветилась. Уйти курсором — снять.
8. **Click highlight.** Click на pr19 → fix highlight. Click
   ещё — снять.
9. **Group collapse.** Click «⏨ Тяжёлые проекты» → строки
   скрыты, count 10 виден. Открыть.
10. **Создание.** Quick Add → Project «Test horizon» → видишь его
    в «Когда-нибудь».
11. **Delete entity.** Cmd+Shift+E → Entities → удалить «Test
    horizon». Возврат на Horizon → исчез.
12. **Persist.** Close app, reopen → состояние сохранено.

## Что НЕ включает фаза 7

- Изменение размера проекта (big / mid / small) через UI. Только
  через JSON или код. Фаза 9 / отдельная.
- Drag нескольких chips одновременно. Только по одному.
- Resize горизонта (количество видимых месяцев). Hardcode 8.
- Календарные события (deadlines) на горизонте. Только месячные
  chips.
- Сортировка проектов внутри группы (по la, по deadline и т.п.).
  В seed-порядке.
- Связь Horizon ↔ Pool (если проект на Apr — автоматически в
  pool недели?). Нет. Только если юзер вручную добавит.
- Уведомления / notifications (e.g. «приближается месяц
  проекта»). Нет.

## Ловушки

- **Synchronization horizon ↔ entities.** Если project удалён,
  но запись `HorizonProjectState` для него осталась — UI
  показывает «битый» row. Нужна защита: при load horizon
  фильтровать `state.project_id` по существующим entities.
- **На первом запуске v2** — `data/horizon.json` имеет seed
  записи (фаза 1 миграция). Если юзер потом создаст новый
  project через Quick Add, мы должны автоматически добавить
  HorizonProjectState. Реализуем подпиской в `App.tsx`.
- **Spec говорит «Apr-Ноя» (8 месяцев), но Дек НЕ показан**
  (§8.2). Это hardcoded MC=8. У нас от текущего месяца + 7
  вперёд (всего 8). На разных месяцах будет разный набор.
- **Drop indicator на месячных drop cells.** При hover-over —
  dashed border accent (как в спеке). State `dragOverMonth`.
- **`hzPrio` не реализуем** (§11.8). Не вводим вообще.
- **HighLight clear** при unmount HorizonPage. Чтобы не
  оставались висящими.
- **Click vs drag в BacklogItem.** Threshold (5px) перед началом
  drag. Если pointer move меньше — это click.
- **Hide preserves months.** При hide мы сохраняем months,
  чтобы при restore показались. Запись в JSON одна и та же —
  меняется только `hidden`.
- **`section_collapsed.deferred = true` default** — ОК. Если
  юзер откроет — сохраняется.
- **Color от категории.** project.tags[0] → area.color. Если
  tags=[] — fallback grey.
