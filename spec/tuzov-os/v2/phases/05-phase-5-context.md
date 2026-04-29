# Phase 5 — Экран «Контекст» (Directions)

> **Цель:** реализовать экран Context по §7 спеки: грид карточек
> направлений, разбитый по областям; внутри карточки — meta
> (progress / target / cadence), список привязанных проектов,
> inline editor проекта, inline creation направления и проекта,
> отметка каденции, отвязка проекта. Entity Popup для direction.
>
> **Результат после фазы:** на табе «Контекст» видно 9 seed-направлений,
> сгруппированных по 5 категориям (work → growth → people →
> health → life). Внутри каждого — список проектов из v1 с
> visual days indicator. Можно отметить каденцию, отвязать
> проект, создать новое направление, создать проект из
> направления, открыть Entity Popup direction'а.

## Контекст

Прочитай:

- `spec.md` §7 целиком (Layout, Section Header, Direction Grid,
  Card, Inline Editor, Inline Creation), §10.3 (Entity Popup
  → блок «Для direction»), §5.7 урgency для каденций (отдельная
  формула!), §11.5 (Direction model), §14.5 (seed).
- `pool-planner-demo-v2.html`: `renderContext`, обработчики
  cadence toggle, dc-unlink, inline editor, inline create direction
  / project.
- Phases 1, 2, 3, 4.

## Что в фазе

### 1. ContextPage

`src/pages/ContextPage.tsx` — заменяет заглушку.

#### 1.1. Layout (§7.1, §7.2)

```
ContextPage (flex-direction column, padding 16/20, overflow-y auto)
└── CategorySection × N
    ├── CategorySectionHead (full-width, border-bottom, click toggle collapse)
    └── DirectionGrid (display grid auto-fill minmax 300px, gap 10)
        ├── DirectionCard × M
        └── InlineCreateDirectionTrigger
```

**Порядок секций.** Для экрана Context: `work → growth → people →
health → life` (см. §2.2 заметку). Это **отличается** от
`config.areas` дефолтного порядка — мы хардкодим этот порядок для
v2 как `CONTEXT_AREA_ORDER`. В Settings можно изменить → но это
фаза 9.

```ts
// src/services/context-helpers.ts
export const CONTEXT_AREA_ORDER = ["work","growth","people","health","life"];
export function sortAreasForContext(areas: Area[]): Area[];
// возвращает areas в порядке CONTEXT_AREA_ORDER, неизвестные — в
// конец.
```

#### 1.2. CategorySectionHead (§7.2)

```tsx
<div className="cat-section-head" onClick={toggleCollapse}>
  <span className="cs-dot" style={{ background: area.color }} />
  <span className="cs-label">{area.label.toUpperCase()}</span>
  <span className="cs-arrow">{collapsed ? "▶" : "▼"}</span>
  <span className="cs-count">{count}</span>
</div>
```

Стили — full-width (block-level flex), border-bottom 1px
`--border`. Hover: border-hover. Cs-count — `margin-left: auto`.

State (в `ui.ts`):

```ts
contextCollapsed: Record<string, boolean>;  // areaId → collapsed
toggleContextSection: (areaId: string) => void;
```

Default — все expanded.

#### 1.3. DirectionGrid

CSS-grid: `grid-template-columns: repeat(auto-fill, minmax(300px, 1fr))`,
`gap: 10`.

#### 1.4. DirectionCard (§7.4)

Компонент `src/components/context/DirectionCard.tsx`.

Содержимое (см. §7.4):

```tsx
<div className="dir-card">
  <div className="dc-top" onClick={openPopup}>
    <span className="dc-dot" style={{ background: cat.color }} />
    <span className="dc-title">{direction.title}</span>
  </div>

  {direction.fields.progress !== null && (
    <div className="dc-progress">
      <div className="dc-progress-bar"
           style={{ width: progress + "%", background: cat.color }} />
    </div>
  )}

  {/* Meta */}
  <div className="dc-meta">
    {measurable && `${current} → ${target}`}
    {deadline && <span className={urgClass(d)}>Дедлайн: {date} ({d}д)</span>}
    {cadence && <span className={cadUrgClass(over)}>{cadLbl} · {days}д назад{over > 0 && ` · просрочено ${over}д`}</span>}
  </div>

  {/* Empty state — если нет cadence, нет measurable И нет проектов */}
  {!direction.fields.cadence
    && direction.fields.progress === null
    && linkedProjects.length === 0
    && <div className="dc-meta dc-empty">нет проектов</div>
  }

  {/* Projects list */}
  {linkedProjects.length > 0 && (
    <div className="dc-projects">
      <div className="dc-projects-head">{count} проект{plural}</div>
      {linkedProjects.map(p => <DirectionProjectRow project={p} key={p.id} />)}
    </div>
  )}

  {/* Actions */}
  <div className="dc-actions">
    <button className={"btn-pool" + (inPool ? " in" : "")} onClick={togglePool}>
      {inPool ? "✓ В пуле" : "→ В пул"}
    </button>
    {cadence && (
      <button className="btn-cadence" onClick={markCadence}>✓ Отметить</button>
    )}
    <button className="btn-add-project" onClick={openInlineProject}>+ Проект</button>
  </div>

  {inlineProjectOpen && <InlineCreateProject direction={direction} onClose={…} />}
</div>
```

#### 1.5. DirectionProjectRow (§7.4 проектные строки)

Компонент `src/components/context/DirectionProjectRow.tsx`:

```tsx
<div
  className="dc-proj"
  onClick={toggleEditor}    // открывает inline-editor
>
  <span className="dc-proj-title">{project.title}</span>

  <div className={"dc-days " + freshClass(project.la)}
       data-tooltip={tooltipText(project.la)}>
    <ClockIcon /> {project.la}д
  </div>

  <button
    className="dc-unlink"
    onClick={(e) => { e.stopPropagation(); unlink(project); }}
    title="Отвязать"
  >
    <BrokenLinkIcon />
  </button>
</div>
```

`dc-days` CSS: `width: 48px`, `text-align: left`,
`font-variant-numeric: tabular-nums` (для выравнивания цифр).

`freshClass`:
- `fresh`: la ≤ 3 → `color: var(--success)`
- `normal`: 4–13 → `color: var(--text-disabled)`
- `stale`: la ≥ 14 → `color: var(--error)`

`tooltipText`:
- la === 0 → «Активность сегодня»
- la === 1 → «Вчера»
- иначе → «Последняя активность {N} дн. назад»

Tooltip позиция (`::after` на `.dc-days[data-tooltip]:hover`):
`bottom: calc(100% + 6px); right: 0` — правое выравнивание,
**без центрирования** (в отличие от Quick Add tooltips).

`dc-unlink`: `opacity 0` по умолчанию, `opacity 1` на
`.dc-proj:hover`. SVG broken-link icon. Click → unlink с toast.

#### 1.6. Inline Project Editor (§7.5)

Компонент `src/components/context/InlineProjectEditor.tsx`:

```tsx
<div className="dc-proj-edit">
  <input
    className="dpe-title"
    value={title}
    onChange={…}
    onBlur={persistTitle}
  />
  <div className="dpe-tags">
    {BOARDS.map(b => (
      <button
        key={b.id}
        className={"dpe-tag" + (project.fields.board_id === b.id ? " on" : "")}
        onClick={() => setBoard(b.id)}
      >
        {b.title}
      </button>
    ))}
  </div>
</div>
```

Toggle по клику на ту же строку проекта; clicking other project —
переоткрытие; click outside — закрытие.

State в `ui.ts` или local в DirectionCard:

```ts
// local: openedProjectId: string | null
```

#### 1.7. Inline Create Direction (§7.7)

В нижней части каждой category section (после grid):

Trigger: `+ Направление` (text dashed, hover border).

При click → input. Категория = текущая section.

```tsx
const handleSubmit = async () => {
  if (!text.trim()) return;
  await createDirection({
    title: text,
    tags: [areaId],
  });
  toast(`✓ ${text}`);
  setText("");
  setMode("trigger");
};
```

Enter / blur при непустом → submit. Escape → cancel. (Тот же
паттерн, что в Projects InlineAdd.)

#### 1.8. Inline Create Project из direction (§7.8)

Кнопка `+ Проект` в actions карточки.

```tsx
const placeholder = `Проект для «${direction.title}»...`;
const handleSubmit = async () => {
  await createEntity({
    type: "project",
    title: text,
    tags: [direction.tags[0]],
    fields: {
      ...defaultProjectFields(),
      board_id: "brd3",
      column_index: 0,
      direction_id: direction.id,
    },
  });
  toast(`✓ ${text} → ${direction.title}`);
};
```

Enter / blur при непустом → submit. Escape → cancel.

#### 1.9. Cadence toggle «✓ Отметить» (§7.4)

Кнопка показывается **только если** `direction.fields.cadence` не
null. Click:

```ts
async function markCadence(direction: DirectionEntity) {
  const today = formatISO(new Date(), { representation: "date" });
  await updateEntity(direction.id, {
    fields: { ...direction.fields, last_act: today }
  });
  toast(`✓ ${direction.title}`);
}
```

После update urgency перенается в зелёное (`over` становится
отрицательным).

#### 1.10. Unlink project from direction (§7.4 dc-unlink, §16)

```ts
async function unlinkProject(project: ProjectEntity) {
  await updateEntity(project.id, {
    fields: { ...project.fields, direction_id: null }
  });
  toast(`Отвязано: ${project.title}`);
}
```

После — re-render, проект исчезает из списка direction'а.

### 2. Cadence urgency (отдельная формула!)

**Внимание:** это **не** `urgClass()` для tasks. Спека §5.7 явно
предупреждает.

```ts
// src/services/urgency.ts (расширение из фазы 3)

export function cadUrgClass(direction: DirectionEntity, today: Date): string {
  if (!direction.fields.cadence || !direction.fields.last_act) return "";
  const days = daysSince(direction.fields.last_act, today);
  const over = days - direction.fields.cadence;
  if (over > 0)  return "urgency-bad";
  if (over > -3) return "urgency-warn";
  return "urgency-ok";
}
```

`daysSince` — целая разница в днях.

### 3. Entity Popup для direction (§10.3 «Для direction»)

Файл `src/components/entities/popup/DirectionPopup.tsx`.

Поля:

```tsx
<EntityPopup ...>
  <EpTitle ... />
  <EpClose />

  <div className="ep-row ep-cat-dots">{...}</div>

  <div className="ep-row">
    <label>Каденция (дни)</label>
    <input type="number" min={0} value={cadence ?? ""} onChange={onCadence} />
  </div>

  <div className="ep-row">
    <label>Метка каденции</label>
    <input type="text" value={cadLbl ?? ""} placeholder="1×/нед" />
  </div>

  {measurable && (
    <>
      <div className="ep-row">
        <label>Цель</label>
        <input type="text" value={target ?? ""} onChange={onTarget} />
      </div>
      <div className="ep-row">
        <label>Текущее</label>
        <input type="text" value={current ?? ""} onChange={onCurrent} />
      </div>
    </>
  )}

  {/* Deadline — отсутствует в попапе по спеке (§10.3) */}

  <div className="ep-actions">
    <button className="ep-delete" onClick={onDelete}>Удалить</button>
  </div>
</EntityPopup>
```

> Спека: deadline есть в модели data, но **не редактируется в
> попапе**. Если юзер хочет — через старую EntitiesPage (debug).

#### 3.1. Edge case: cadence + lastAct = null

Спека §10.3 примечание:
> «если пользователь задаёт cadence через попап для direction, у
> которой `lastAct === null`, то `Math.round((TODAY - new
> Date(null)) / 864e5)` = NaN. При реализации рекомендуется при
> установке cadence автоматически ставить `lastAct = TODAY`.»

Реализуем: при изменении cadence из null → значение, если
`last_act === null`, ставим `last_act = today`.

#### 3.2. Cadence = 0 → отключить

Спека §10.3: «при установке cadence=0 → cadence: null,
last_act: null».

#### 3.3. Удаление direction → каскад

Спека §10.3: «При удалении direction — каскадное отвязывание:
все проекты с `dirId === deletedDir.id` получают `dirId = null`».

```ts
async function deleteDirection(direction: DirectionEntity) {
  // 1. Отвязать все проекты
  const linkedProjects = entities.filter(
    e => e.type === "project" && e.fields.direction_id === direction.id
  );
  for (const p of linkedProjects) {
    await updateEntity(p.id, {
      fields: { ...p.fields, direction_id: null }
    });
  }
  // 2. Удалить direction
  await removeEntity(direction.id);
  toast(`Удалено: ${direction.title}`);
}
```

### 4. Сервис context-helpers

`src/services/context-helpers.ts`:

```ts
export const CONTEXT_AREA_ORDER: string[];
export function sortAreasForContext(areas: Area[]): Area[];
export function directionsForArea(entities: Entity[], areaId: string): DirectionEntity[];
export function projectsForDirection(entities: Entity[], directionId: string): ProjectEntity[];
export function freshClass(la: number): "fresh" | "normal" | "stale";
export function tooltipText(la: number): string;
```

### 5. Pool toggle для direction (§4.6 «Tab: Контекст»)

Спека:
> «Логика: если есть связанные проекты, добавляет самый свежий
> (наименьший `la`) как `splittable: true, hours: 4`; если нет —
> добавляет само направление как `splittable: true, hours: 2,
> directionId: dir.id`.»

Реализуем в togglePool на DirectionCard:

```ts
function togglePool(direction: DirectionEntity) {
  const linked = projectsForDirection(entities, direction.id);
  if (linked.length === 0) {
    // pool из самой direction
    addItem({
      title: direction.title, hours: 2, splittable: true,
      category: direction.tags[0],
      source_entity_id: direction.id,
      source_kind: "direction",
      placed: false,
    });
  } else {
    // pool из самого свежего проекта
    const freshest = linked.reduce((a, b) =>
      a.fields.last_activity_days < b.fields.last_activity_days ? a : b);
    addItem({
      title: freshest.title, hours: 4, splittable: true,
      category: freshest.tags[0],
      source_entity_id: freshest.id,
      source_kind: "project",
      placed: false,
    });
  }
}
```

«✓ В пуле» состояние — если в pool есть item с
`source_entity_id === direction.id` ИЛИ
`source_entity_id === one_of_linked_projects`. Логика отображения
in-pool — может быть неоднозначной (если проект уже добавлен из
ProjectsPage отдельно). Спецификация мока не уточняет — **берём
самое простое**: «в пуле, если хоть один из связанных проектов
или сама direction там».

### 6. Изменения в существующих файлах

- `src/store/ui.ts`: `contextCollapsed`, toggle.
- `src/services/urgency.ts`: добавить `cadUrgClass`.
- `CreateDropdown` (старый, в EntitiesHeader): добавить пункт
  «Direction», если ещё не добавили в фазе 1. Это позволит
  создавать direction через debug Cmd+Shift+E (для удобства, не
  обязательное).

### 7. Тесты

- `urgency.test.ts`: `cadUrgClass` для разных over.
- `context-helpers.test.ts`: sortAreasForContext, directionsForArea,
  projectsForDirection, freshClass.

## Acceptance criteria

- [ ] Context tab показывает 5 category sections в порядке work,
  growth, people, health, life.
- [ ] Под work — 4 direction-карточки (dir-yt-subs, dir-yt,
  dir-habr, dir-tg).
- [ ] Под growth — 2 (dir-arch, dir-jpn).
- [ ] Под people — 2 (dir-mama, dir-sasha).
- [ ] Под health — 1 (dir-weight).
- [ ] Под life — 0 (показывается секция или нет? — секция
  показывается всегда, в ней только trigger «+ Направление»).
- [ ] У dir-yt-subs (measurable, progress 60): progress bar 60%,
  meta «33K → 55K · Дедлайн: 31.12.26 (...д)».
- [ ] У dir-yt (cadence 60, lastAct 2026-03-02): meta
  «1×/2мес · {days}д назад» — где `days = today - lastAct` (на
  29.04.2026 это ~58д). `over = days - 60`; формула:
  - over > 0 → bad + текст «· просрочено {over}д».
  - over в (-3, 0] → warn (без хвоста).
  - over ≤ -3 → ok (без хвоста).
  При today=29.04.2026: over≈-2 → urgency-warn, без «просрочено».
- [ ] У dir-mama (cadence 7, lastAct 2026-04-20): на 29.04.2026
  days=9, over=+2 → urgency-bad + «просрочено 2д». Если
  «✓ Отметить» нажать — last_act=today, days=0, over=-7 →
  urgency-ok.
- [ ] dir-yt direction содержит 7 проектов (pr1, pr16-pr21).
- [ ] У pr1 (la=3): фоn `freshClass=fresh`, зелёный «3д».
- [ ] У pr18 (la=25): красный «25д» + tooltip.
- [ ] Hover на проекте → появляется dc-unlink. Click → проект
  отвязан, исчез из direction (но остался на ProjectsPage без
  direction_id).
- [ ] Click по проекту в карточке → раскрывается inline editor с
  title input + tag chips (Видео / Контент / Разное). Click ту же
  строку — закрывает.
- [ ] Click по `+ Проект` → input. Ввести «Новый ролик» → Enter
  → создан project с direction_id = current direction, board_id
  = brd3, col_index = 0.
- [ ] Click по «✓ Отметить» (cadence-direction) → last_act =
  today, urgency перезагрузилась в зелёное.
- [ ] Inline create direction внизу секции: «+ Направление» →
  input → Enter → новое направление в этой category. Скрылся
  trigger.
- [ ] Click по dc-top (dot+title) → DirectionPopup справа от
  карточки.
- [ ] В popup для measurable direction: видны target/current
  fields. Для cadence — cadence/cadLbl. Для пустого — только
  cadence/cadLbl и category.
- [ ] Изменение cadence с null → 7 → автоматически ставит
  last_act = today.
- [ ] Кнопка «Удалить» в popup → удаление direction → все
  привязанные projects получают `direction_id = null`. Toast.
- [ ] Cmd+N на Context → Quick Add тип = direction.
- [ ] Section collapse: click по cat-section-head → grid и
  trigger скрываются. Сохраняется состояние в ui-store.

## Тест-план

1. **Открыть Context.** Видишь 5 секций. Под Работа — 4 карточки.
2. **dir-yt direction.** Проверить meta + projects list (7 шт).
   pr1 «Ролик про GC» зелёным «3д».
3. **Hover unlink.** Hover на pr18 → появляется иконка отвязки.
   Click → проект ушёл из direction.
4. **Inline editor project.** Click pr1 → раскрылся editor. Tag
   chips показывают activated «Видео». Click «Контент» → переезд
   на brd2.
5. **Mark cadence.** Click «✓ Отметить» на dir-mama → urgency
   стала зелёной.
6. **Создать direction.** Внизу секции «Растёт» → «+ Направление»
   → ввести «Чтение книг» → Enter → появилась карточка.
7. **Создать проект из direction.** «+ Проект» → «Тест проект» →
   создан, привязан.
8. **Edit direction.** Click по title → popup → cadence 14 → label
   «1×/2нед» → закрыть. Изменения сохранены.
9. **Delete direction.** Open popup dir-yt → Удалить. Все 7
   проектов остались, но без direction_id (видны на Context — нет;
   на Projects — да).
10. **Section collapse.** Click по «РАЗВИТИЕ» → 2 карточки
    скрыты, count «2» виден. Reopen.

## Что НЕ включает фаза 5

- Полная интеграция с pool sidebar UI — фаза 6. (Toggle «→ В пул»
  для direction в карточке Context **реализуется в этой фазе**,
  раздел 5; в Pool sidebar результат увидится только после фазы
  6.)
- Виджет deadline в popup direction (по спеке отсутствует).
- Сортировка проектов внутри direction по la / по pipeline. Сейчас
  показываются в порядке `entities.json`. Спека не требует —
  не делаем, опционально в фазе 9.
- Бейдж count активных проектов на section header — спека `cs-count`
  ждёт count of directions. Не путать с проектами.
- Линия progress между current и target если оба пусты — нет (если
  progress = null, polosa не рендерится).

## Ловушки

- **Direction без projects, без cadence, без measurable.**
  Empty state «нет проектов» (см. §7.4). Не падать.
- **`cadUrgClass` vs `urgClass`.** Использовать правильную
  функцию (см. §5.7). Cadence — отдельная формула.
- **last_act = null + cadence > 0.** В UI показываем только
  cadLbl без «Nд назад» (нет lastAct). При установке cadence из
  popup автоматически ставим last_act = today (см. 3.1).
- **Direction id pattern.** Спека предполагает `dir-{N}` (`dir-yt`,
  `dir-mama`). У нас UUID. Совместимо: оба валидны через
  `z.string()`. Но при seed migration используем читаемые id из
  спеки.
- **Каскад при удалении.** Атомарно невозможно (write-by-file). При
  падении после первой записи — частично обновлено. В
  `removeEntity` уже есть persist-first; делаем bulk update
  через несколько `updateEntity` подряд + один `removeEntity`.
  При сбое — посередине останется частично отвязанный набор
  проектов, что **не критично** (юзер не теряет данные, просто
  потребуется ручное доведение).
- **Section с 0 directions.** Показываем секцию заголовка + grid
  пустой + trigger «+ Направление». Не скрываем. Юзер может
  добавить туда первое направление.
- **CONTEXT_AREA_ORDER.** Если в config.areas юзер добавил свою
  область (например `family`) — она пойдёт в конец. Если убрал
  одну из стандартных — секции для удалённых не показываются,
  карточки с tags=[deleted_area] не показываются нигде. (Это
  edge case; user-control.)
