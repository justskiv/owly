# Фаза 3: Drag & Drop + Task Pool

> **Цель:** добавить полноценный drag-and-drop в сетку и боковую
> панель с пулом задач.
>
> **Результат:** блоки перетаскиваются между днями и временами,
> ресайзятся за нижний край. Справа — пул незапланированных задач
> (264px), откуда задачи перетаскиваются на сетку. Это превращает
> статичную сетку фазы 2 в интерактивный инструмент планирования.
>
> **Предусловие:** фаза 2 завершена, сетка рендерит блоки, inline-
> создание и редактирование работают.

## Контекст

Прочитай `00-overview.md`, `01-data-schema.md`, `02-architecture.md`.
Схема `Block` — в `01-data-schema.md`.

**Референс:**
- `design/tuzov-os-design-spec.md`, разделы «Drag & Drop»,
  «Resize», «Drag из пула», «Пул задач»
- `design/tuzov-os-design-mock.html` — функции `onBlockMouseDown`,
  `onPoolMouseDown`, `getDropTarget`, `showSnapPreview`,
  `removeAllPreviews`, `renderPool`, CSS-классы `.drag-ghost`,
  `.snap-preview`, `.dur-tip`, `.pi`, `.pg`, `.pool`, `.pool-hd`,
  `.pool-s`, `.pool-items`

## Библиотека

```bash
npm install @dnd-kit/core @dnd-kit/utilities
```

`@dnd-kit/core` даёт примитивы без навязанной структуры, достаточно
для кастомной сетки. `@dnd-kit/sortable` **не нужен** — у нас не
сортируемые списки.

> **Альтернатива:** поведение в моке реализовано на голых
> `mousedown / mousemove / mouseup`-слушателях без библиотеки, с
> кастомным threshold и ghost-элементом. @dnd-kit даёт тот же UX
> через sensors/modifiers, но React-friendly. Решение: начать с
> @dnd-kit, но если возникнут сложности с управлением ghost и
> snap-preview — вернуться к ручным событиям (ровно как в моке).

## Drag блоков в сетке

### Перемещение

Пользователь хватает блок → ghost следует за курсором с
сохранением offset → над валидной ячейкой — snap-preview → отпустил
→ блок переезжает.

**Ключевые параметры (из мока):**
- **Threshold активации drag**: 5px (клик с меньшим сдвигом =
  просто select)
- **Snap**: 30 минут (`SNAP_MIN`)
- **grabOffX / grabOffY** сохраняем в momentum — чтобы ghost не
  прыгал в угол, а оставался на том же визуальном месте
  относительно курсора
- **Drop target detection**: `cy - rect.top` (координата курсора
  минус top bounding box колонки). **Важно:** без двойного
  вычитания `scrollTop` — `getBoundingClientRect()` уже учитывает
  прокрутку. Это конкретная ошибка из раннего мока, не повторять

**Визуальная обратная связь:**
- При начале drag → исходный блок получает `.dragging` (opacity
  .4, pointer-events: none)
- Ghost `.drag-ghost` — копия блока, `position: fixed`, следует за
  курсором, `box-shadow: var(--shadow-drag)`, `opacity: .85`
- Над валидной ячейкой — `.snap-preview` (dashed border 1.5px,
  background `--bg-tint-2`) на snap-позиции
- Если drop создаст overlap — будет подсвечено после drop как
  `.tb.overlap` (dashed red + ⚠); drop всё равно разрешён

**Алгоритм `onBlockMouseDown` (упрощённо):**

```typescript
function onBlockMouseDown(e, block, el) {
  if (e.button !== 0) return;
  const rect = el.getBoundingClientRect();
  const isResize = e.clientY > rect.bottom - 10;
  const startX = e.clientX, startY = e.clientY;
  const grabOffX = e.clientX - rect.left;
  const grabOffY = e.clientY - rect.top;
  let moved = false, ghost = null, preview = null, durTip = null;

  function onMove(ev) {
    const dx = ev.clientX - startX, dy = ev.clientY - startY;
    if (!moved && Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
    moved = true;
    if (isResize) { /* см. Resize */ }
    else          { /* обновить ghost + snap-preview */ }
  }
  function onUp(ev) {
    /* teardown; если !moved → select; иначе применить drop/resize */
  }
  /* addEventListener mousemove/mouseup */
}
```

### Resize

Нижние 8px блока = зона resize (`.rh`, `cursor: ns-resize`).
Курсор при hover меняется на `ns-resize`.

- При mousedown на `.rh` → tracking mousemove
- `newDur = Math.max(MIN_BLOCK_MIN, round((block.duration + dy/R*30) / SNAP_MIN) * SNAP_MIN)`
- Визуально блок растягивается/сжимается в реальном времени
- Рядом с курсором — `.dur-tip` (tooltip, background `--bg-
  elevated`, border `--border-default`), показывает `fmtDur(newDur)`
- При mouseup → применить новую длительность, убрать tooltip

### Клик vs drag

Проблема: клик и drag оба стартуют с `mousedown`. Решение — threshold:

- Если курсор прошёл < 5px к моменту `mouseup` → это клик →
  `selectBlock(id)` (поставить `.selected`)
- Иначе это drag → выполнить перемещение/ресайз

В `@dnd-kit` это — `activationConstraint: { distance: 5 }` у
PointerSensor.

## Drag из пула на сетку

Тот же механизм, что перемещение блока, но:

- Ghost создаётся из `.pi`-элемента в пуле
- Ширина ghost — фиксированная (140px), высота — по duration задачи
- При drop:
  1. Создать блок с title/duration/category из задачи, `source_
     entity_id` = entity.id, `status: "planned"`, `notes: ""`
  2. Убрать задачу из пула (фильтр getUnscheduled пересчитает,
     см. ниже)

```typescript
const block = {
  id: generateId("blk"),
  title: entity.title,
  date: dropTarget.date,
  start: dropTarget.time,
  duration: entity.estimated_minutes || 60,
  category: entity.tags[0] || 'work',
  source_entity_id: entity.id,
  status: 'planned',
  notes: '',
};
```

## Пул задач (TaskPool)

Боковая панель справа от сетки.

### Что попадает в пул

Задача в пуле если:
1. `type ∈ ["task", "project", "event", "routine"]` (не note, не
   metric, не contact, не goal)
2. `status === "active"` (не done, не archived, не someday)
3. Нет блока в текущей неделе с `source_entity_id === entity.id`

Реализация — `getUnscheduled(currentWeekBlocks, entities)` в entity
store (селектор, не мутация).

> В фазе 3 редактор сущностей ещё не готов (идёт в фазе 4). Новые
> сущности добавляются через seed или ручное редактирование
> `entities.json`. Пул просто рендерит, что есть.

### UI пула (из мока)

```
┌────── Пул задач ─── 8 ── ✕ ──┐
│ 🔍 Поиск...                   │
├───────────────────────────────┤
│ ● Высокий                     │ ← .pg (error dot)
│ ┌───────────────────────────┐ │
│ │ Монтаж GC v2              │ │ ← .pi
│ │ ● work · 2h               │ │
│ └───────────────────────────┘ │
│ ┌───────────────────────────┐ │
│ │ Правки глава 5            │ │
│ │ ● work · 1.5h             │ │
│ └───────────────────────────┘ │
│                               │
│ ● Средний                     │ ← .pg (med dot)
│ ...                           │
│                               │
│ ● Низкий                      │ ← .pg (low dot)
│ ...                           │
└───────────────────────────────┘
```

**Разметка:**
- `.pool` — ширина `var(--pool-w)` (264px), `border-left`, flex-
  col, фон `--bg-surface`
- `.pool-hd` — заголовок «Пул задач», счётчик `.pool-n` (mono),
  кнопка закрытия `.pool-x` (×)
- `.pool-s` — поле поиска
- `.pool-items` — скроллящийся список
- Группы `.pg` с dot `.pgd` и названием приоритета
- Карточки `.pi` (dots `.pit` цвета категории, title `.pi-t`,
  meta `.pi-m` с "категория · длительность")
- Priority dots цвета:
  - high = `var(--error)` (красный)
  - med  = `#c78a3a` (горчичный — 3-ий жёлтый,  намеренно
    отличается и от accent, и от life)
  - low  = `#707070` (серый)

### Создание элементов

**Важно:** элементы пула создаются через `createElement +
appendChild`, **не** через `innerHTML +=`. Это нужно, чтобы
mousedown-listeners не слетали при перерисовке (см. мок
`renderPool()`).

В React это не проблема — компоненты и так переcоздают DOM. Но если
кто-то в оптимизации захочет мутировать DOM напрямую (drag-и-
listener'ы могут тянуть к этому) — использовать `createElement`.

### Collapse

- Кнопка-toggle в header (`[Пул]`) или `.pool-x` в самом пуле
- Хоткей `T`
- CSS-анимация: `.pool.collapsed { width: 0; opacity: 0; overflow:
  hidden }` с `transition: width var(--duration-slow) var(--ease-
  out), opacity var(--duration-slow)`

### Поиск и фильтры

- Поиск по `entity.title` (case-insensitive, substring)
- Фильтры по тегам (кнопки-переключатели) и типу — **в фазе 4**,
  когда появится полноценный UI с EntityFilters. В фазе 3 — только
  поиск и группировка

## Focus-visible и клавиатура

Все интерактивные элементы — focusable:

```typescript
// src/components/shared/makeClickable.ts
export function makeClickable(el: HTMLElement) {
  el.tabIndex = 0;
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      el.click();
    }
  });
}
```

Применяется к `.tb` (блокам), `.pi` (элементам пула), `.si`
(sidebar), `.fo` (фильтрам — в фазе 4), `.erow` (строкам списка
сущностей — в фазе 4). CSS `button:focus-visible, [tabindex]:focus-
visible { outline: 2px solid var(--focus-ring); outline-offset:
2px; }` — в globals.css.

## DnD Context

Один корневой `<DndContext>` в `PlannerPage` оборачивает и сетку, и
пул — чтобы можно было drag из пула на сетку:

```tsx
<DndContext
  sensors={sensors}
  onDragStart={handleDragStart}
  onDragEnd={handleDragEnd}
>
  <div className="planner-body">
    <WeekGrid />
    <TaskPool />
  </div>
  <DragOverlay>
    {activeItem && <TimeBlockGhost item={activeItem} />}
  </DragOverlay>
</DndContext>
```

## Технический долг от фазы 2 (сделать **до** DnD)

Из ревью фазы 2 остались архитектурные/UX-задачи, которые имеет смысл
закрыть **в начале** этой фазы — пока не добавили ещё одно состояние
(resize/drag preview) и ещё одну модалку. Иначе расходятся быстрее.

- **Refactor PlannerPage.** Вынести из страницы:
  - `usePlannerCommands(weekDates, weekStart, todayIdx)` — все
    мутации (`completeBlock` / `skipBlock` / `deleteSelected` /
    `nudgeBlock` / `openNew` / `openEdit` / `duplicateBlock` /
    `setBlockCategory`) с единой обработкой `await + try/catch +
    toast.error` (см. CODESTYLE п.5).
  - `usePlannerHotkeys(commands, selectedId, active, overlayOpen)`
    — единственный keydown listener; внутри 3 guard'а из CODESTYLE
    п.7.
  - `usePlannerOverlay()` — единый discriminated state
    `Overlay = null | { kind: 'editor-new'; defaults } |
    { kind: 'editor-edit'; blockId } | { kind: 'context'; x, y,
    blockId } | { kind: 'inline-create'; date, minute }` вместо
    трёх независимых `editor / ctx / inline` (см. CODESTYLE п.2).
    Это упростит «Esc закрывает один открытый» и взаимоисключение,
    которое сейчас держится на shotgun-сбросе.
- **WeekGrid: weekModel.** Заменить 12-prop pass-through на
  единую модель `weekModel: { dates: { date, isToday, balance,
  free, blocks }[] }` + `actions`. Перед DnD это критично — ещё
  больше колбэков пройдёт через grid.
- **`BlockEditor` discriminated `mode`.**
  `mode: { kind: 'new'; prefill } | { kind: 'edit'; block }` —
  убирает `isEdit && block` танцы и `findBlock(id)` в PlannerPage
  (CODESTYLE п.2).
- **Focus trap + restore-focus в модалке.** Реализовать
  `useFocusTrap(ref)` и `useRestoreFocus()`; применить к
  `BlockEditor` сейчас и к Pool/EntityEditor в фазе 4 (CODESTYLE
  п.10). Tab сейчас уходит из модалки на грид за ней.
- **Ctx-menu клавиатура.** В фазе 2 поставлен `role="menu"`, но
  items без `role="menuitem"`/`tabIndex`/Esc/arrow-nav. С DnD
  ctx-меню становится главным каналом не-drag действий, его пора
  довести до клавиатурной полноты (Shift+F10, Up/Down/Enter, Esc
  закрывает + restore-focus на блок).
- **Cyrillic / Dvorak — `e.code` для letters.** Хоткей `T`
  получает функцию в этой фазе (toggle pool); заодно перевести
  `D/S/N/T` с `e.key` на `e.code` (`KeyD`/`KeyS`/`KeyN`/`KeyT`),
  не-letters (`Enter`/`Escape`/`Delete`/стрелки) оставить на
  `e.key`. Реальные пользователи — на ЙЦУКЕН (CODESTYLE п.7).
- **`fmtDur` форматирование.** Resize даст много блоков с не-
  кратными часу длительностями (1h15m, 2h45m). Сейчас формат
  лоссивный: 75 → "1.3h", 105 → "1.8h". Вернуться к мок-формату
  «1h 15m» / «1.5h» на ровных значениях. UX-решение, обсудить
  перед стартом фазы.

## Критерии готовности

- [ ] Блоки перетаскиваются между днями и временами, snap 30 мин
- [ ] Ghost следует за курсором с правильным offset (не прыгает
  в угол блока)
- [ ] Snap-preview показывает целевую позицию
- [ ] Resize за нижний край работает, снап 30, минимум 30
- [ ] Tooltip длительности виден у курсора при resize
- [ ] Клик на блок открывает редактор не путается с drag
  (threshold 5px)
- [ ] Пул задач 264px открывается/закрывается по `T` и кнопке
- [ ] Незапланированные задачи группируются по priority с
  правильными цветами точек
- [ ] Поиск по title работает (case-insensitive substring)
- [ ] Drag из пула на сетку создаёт блок с корректной привязкой
  к entity
- [ ] Задача исчезает из пула после размещения
- [ ] Удаление блока (из фазы 2) возвращает задачу в пул
- [ ] Focus-visible золотой outline виден при Tab-навигации по
  блокам, пулу, sidebar
- [ ] Enter/Space на сфокусированном блоке/задаче — триггерит
  тот же callback, что клик
- [ ] Все изменения автосохраняются
