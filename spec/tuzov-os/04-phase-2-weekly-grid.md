# Фаза 2: Weekly Grid

> **Цель:** реализовать недельную сетку — ядро приложения. Блоки
> расписания, создание/редактирование, визуальный баланс дня и недели.
>
> **Результат:** открываешь Planner, видишь неделю с блоками.
> Навигация по неделям в header. Клик на пустое место — создаёт
> инлайн-блок. Клик на блок — выделяет, двойной клик — редактирует в
> модалке. Видно balance bar в каждом дне и stacked summary по неделе.
>
> **Предусловие:** фаза 1 завершена, Shell + status bar + шрифты уже
> подключены, данные читаются и пишутся.

## Контекст

Прочитай `00-overview.md`, `01-data-schema.md`, `02-architecture.md`.
Схемы `Block` и `WeekFile` — в `01-data-schema.md`.

**Референс:**
- `design/tuzov-os-design-spec.md`, раздел «Экран 1 — Планировщик»
- `design/tuzov-os-design-mock.html` — готовая вёрстка сетки,
  селекторы `.dh`, `.gr`, `.tb`, `.wsbar`, `.now-line`,
  `.inline-block`, `.snap-preview`; JS-функции `render()`,
  `minToY/yToMin`, `fmtTime/fmtDur`, `hasOverlap`, `onEmptyClick`,
  `onBlockMouseDown`. Переносим 1-в-1, адаптируя к React.

> Полный DnD (перетаскивание блоков и ресайз) идёт в фазе 3. В
> фазе 2 блоки статичные, но сетка отрисовывает их и поддерживает
> создание/редактирование/удаление.

## Параметры сетки (из мока)

Вынести в CSS-переменные (уже в `:root` из фазы 1):

| Токен | Значение | Назначение |
|---|---|---|
| `--row-h` | `40px` | высота получасовой строки |
| `--time-w` | `44px` | ширина колонки времени |
| `--pool-w` | `264px` | пул задач (пока toggle без содержимого) |

JS-константы (в `src/services/time-utils.ts`):

```typescript
export const ROW_H = 40;            // px, синхронизировано с --row-h
export const START_HOUR = 6;        // 06:00 — верхний край
export const END_HOUR = 23;         // 23:00 — нижний край
export const SNAP_MIN = 30;         // snap и минимальная длительность
export const MIN_BLOCK_MIN = 30;    // минимальный блок
```

Итого видимая область: 17 часов × 2 получасовых строки × 40px = 1360px.

## Компоненты

### WeekGrid.tsx

Корневой компонент планировщика. Состав:

```
┌──────────────────────────────── hdr (48px) ──────────────────────┐
│ ← Неделя 16 · 14–20 апр →   [Сегодня]   [Пул] T                  │
├──────────────────────────── wsummary ─────────────────────────────┤
│ [stacked bar]    ● 23h  ● 7h  ● 3.5h  ● 4h   free 30h            │
├────────┬────────┬────────┬────────┬────────┬────────┬────────┬───┤
│  time  │  Пн 14 │ Вт 15🟡│  Ср 16 │  Чт 17 │  Пт 18 │ Сб 19  │Вс │
│  col   │ [bar]  │ [bar]  │ [bar]  │ [bar]  │ [bar]  │ [bar]  │   │
├────────┼────────┴────────┴────────┴────────┴────────┴────────┴───┤
│        │                                                          │
│        │  (grid-scroll: .gr ячейки + .tb блоки)                  │
│        │                                                          │
└────────┴──────────────────────────────────────────────────────────┘
```

Разметка и классы — ровно как в моке: `.planner-body` →
`.grid-area` (`.day-headers`, `.grid-scroll` → `.grid-body`).

### DayHeader.tsx

Один столбец в `.day-headers`:

- `.dh-name` — UPPERCASE название дня (Пн, Вт...), `--fs-2xs`,
  `--text-tertiary`
- `.dh-date` — число дня, `--fs-md`, `--text-secondary`
- Today: `.dh.today`, число обёрнуто в `<span>` — золотой круг
  `24×24px` с `color: var(--text-inverse)`
- `.dh-bal` — balance bar для дня:
  - `.dh-bar` — фоновый трек `var(--bg-tint-2)`, высота 4px,
    `border-radius: var(--radius-xs)`
  - Сегменты `.bseg` — ширина в % от занятых часов, цвет категории.
    **Без gap** (`overflow: hidden`)
  - Справа `.bfree` — свободное время (mono, `--text-disabled`)

### WeekSummary.tsx

`.wsummary` под header, перед сеткой:

- `.wsbar` — stacked bar шириной до 300px. Такие же цветные сегменты,
  как в day-header balance
- `.wstats` — часы по категориям (цветная точка `.wdot` + число).
  Без прозрачности для занятых категорий, `opacity: .4` для `free`

Значения — сумма `block.duration / 60` по category.

### DayColumn.tsx

Один столбец `.day-col`:

- Высота — `calc(var(--row-h) * 34)` (17 часов × 2 строки)
- Сетка `.gr`-ячеек: `h-hf` = `hour + halfHour` → `data-day`,
  `data-min`. Каждая 2-я ячейка с классом `.hm` имеет bottom-border
- **Hover affordance:** `.gr:hover::before` — 2px полоска `--work`
  слева, opacity .4. Подсказка: клик создаст work-блок
- **`.gr.drop-target`** — подсветка при drag-over (используется в
  фазе 3)
- Блоки `.tb` рендерятся абсолютно поверх колонки
- Если колонка соответствует сегодня — рендерится `.now-line`

### TimeBlock.tsx

Один блок расписания (`.tb`):

**Позиция и размеры:**
```typescript
top = minToY(block.start) = ((startMinutes - START_HOUR*60) / 30) * ROW_H;
height = (block.duration / 30) * ROW_H;
left = 2, right = 2;  // пара пикселей от границ колонки
```

**Классы-модификаторы:**
- Категория: `.work | .people | .life | .growth | .health` —
  заливка `rgba(...<color>..., .35)`, hover `.45`
- `.selected` — золотой box-shadow 1.5px
- `.done` — opacity 35%, префикс `✓` в title
- `.skipped` — opacity 20%, text-decoration line-through
- `.overlap` — `1px dashed var(--error)` + ⚠ в правом верхнем углу
- `.now` — блок пересекается с now-линией: заливка `.55` (hover
  `.62`), title bold + `--text-primary`. Работает и для
  done/skipped (opacity перебивается)

**Внутреннее содержание (условное):**
- `.bt` — title (14px Outfit 500, `--text-primary`)
- `.bm` — диапазон времени + длительность (10px mono 300,
  `--text-secondary`), только если `duration >= 30`
- `.bn` — notes одной строкой (11px, `--text-tertiary`), только
  если `duration >= 90` и notes заданы
- `.rh` — невидимая resize-зона (8px снизу, cursor `ns-resize`).
  Логика resize — в фазе 3, но DOM-элемент уже кладём

**Взаимодействия (фаза 2):**
- Клик → `selectBlock(block.id)` (ставит `.selected`)
- Двойной клик → открыть BlockEditor (модалка)
- ПКМ → context menu (см. ниже)
- Удаление/смена статуса → через context menu или хоткеи

### NowLine.tsx

Золотая линия текущего времени в колонке сегодня:

- `position: absolute`, `height: 2px`, `background: var(--accent)`
- `::before` — круг 6×6px в золоте, left: -3px
- `top = minToY(nowMinutes)`
- `z-index: 20`, `pointer-events: none`

В фазе 2 используем **демо-константу** `NOW_MIN` (как в моке, 10:15
для демо). В фазе 6 можно подключить `setInterval` или слушать
системное время.

### InlineCreate.tsx

При клике на пустую `.gr`-ячейку (`onMouseDown` с `target === row`):

```typescript
function onEmptyClick(e, day, minute) {
  const snapMin = Math.round(minute / SNAP_MIN) * SNAP_MIN;
  // показать инлайн-инпут на позиции (snapMin, 60min default)
  // Enter → создать блок { d: day, s: snapMin, dur: 60, c: 'work', t: value }
  // Escape → отменить
}
```

UI: `.inline-block` — тот же размер, что обычный блок, но с
`.inline-input` (transparent border, sans-serif, 12px). Категория
по умолчанию — `work` (см. hover affordance).

### BlockEditor.tsx (модалка)

`.modal` — 400px, backdrop-blur:

**Поля формы:**
- Название (text, required) — `input.fi`
- Начало (HH:MM, font-mono) — `input.fi`
- Длительность (минут, font-mono) — `input.fi`
- День (0–6, Пн=0) — `input.fi` (в фазе 4 можно заменить на
  dropdown с названиями дней)
- Область (radio-подобные кнопки `.f-cat` — pill c `.cd` точкой
  цвета и названием категории)
- Заметки — `textarea.fi`, 56px высоты, vertical resize

**Поведение:**
- Открывается на:
  - Клик «+ Создать» (если будет в фазе 4 в header) или хоткей `N`
  - Двойной клик на блок
  - Пункт «Редактировать» в ctx-меню
- Enter внутри `.fi` — `modalSave()`, Escape — закрыть
- При создании нового блока: предзаполняем `start` = текущее время
  с округлением, `duration` = 60, `day` = сегодня, категория =
  work
- При редактировании: все поля из блока
- Кнопки: **Удалить** (outline red, слева) + **Сохранить**
  (`.btn-save` золотая, справа)

### BlockContextMenu.tsx

`.ctx` — меню по ПКМ на блоке:

- ✓ Выполнено `D`
- ✗ Пропущено `S`
- ─────────
- ✎ Редактировать `Enter`
- ⧉ Дублировать `⌘D`
- ✕ Удалить `⌫`
- ─────────
- Ряд цветных кружков `.ctx-c` — клик сразу меняет категорию
  блока

Закрывается по клику вне, хоткеям или выбору действия.

## Алгоритмы (из мока)

В `src/services/time-utils.ts`:

```typescript
// Номер недели в формате "YYYY-wWW" (ISO 8601)
export function getWeekId(date: Date): string;

// Границы недели по ID
export function getWeekRange(weekId: string): { start: Date; end: Date };

// Координаты ↔ время
export function minToY(minutes: number): number;
export function yToMin(y: number, snap = SNAP_MIN): number;

// Форматирование
export function fmtTime(minutes: number): string;    // "09:30"
export function fmtDur(minutes: number): string;     // "1.5h" | "30m"

// Overlap
export function hasOverlap(block: Block, others: Block[]): boolean;

// Баланс
export function dayBalance(blocks: Block[], day: string): Record<CatId, number>;
export function weekBalance(blocks: Block[]): Record<CatId, number>;
```

`date-fns` используется для ISO-недель: `getISOWeek`, `startOfISOWeek`.

## Навигация по неделям

В Header:
- `←` / `→` — `goToPrevWeek()` / `goToNextWeek()`
- «Сегодня» — `goToCurrentWeek()`
- Отображение: `Неделя 16 · 14–20 апр` (`.hdr-week` + `.hdr-week-sub`)

**При переключении:**
1. Сохранить текущую неделю если были изменения
2. Загрузить новую неделю из файла
3. Если файла нет — показать пустую неделю (в фазе 4 появится
   диалог «применить шаблон / создать пустую»)

## Хоткеи (в фазе 2 работают глобально)

| Клавиша | Действие |
|---|---|
| `1 / 2 / 3` | Переключение страниц |
| `Esc` | Закрыть модалку / ctx-меню / сбросить selection |
| `N` | Открыть BlockEditor (создать новый блок) |
| `T` | Toggle пула (появится в фазе 3, пока no-op или placeholder) |
| `D` | Выделенный блок → status `done` |
| `S` | Выделенный блок → status `skipped` |
| `Delete` / `Backspace` | Удалить выделенный блок |
| `Enter` | Открыть редактор выделенного блока |
| `Ctrl+↑/↓` | Сдвинуть выделенный блок на 30 мин |

Реализация — `useEffect` с `addEventListener('keydown', ...)` на
уровне `PlannerPage` (отписка при unmount). Игнорировать нажатия,
если `event.target.tagName === 'INPUT' | 'TEXTAREA'`.

## Overlap detection

Два блока в одном дне пересекаются → обоим добавляем `.overlap`:
`border: 1px dashed var(--error)` + псевдоэлемент `⚠` в правом
верхнем углу.

```typescript
function hasOverlap(a: Block, b: Block): boolean {
  if (a.date !== b.date || a.id === b.id) return false;
  const aStart = timeToMinutes(a.start);
  const bStart = timeToMinutes(b.start);
  return aStart < bStart + b.duration && bStart < aStart + a.duration;
}
```

Приложение **не запрещает** overlap — только подсвечивает.

## Категории: цвета из config

Классы `.tb.work/.people/.life/.growth/.health` в CSS — уже с
правильной прозрачностью. Чтобы избежать дублирования, компонент
`TimeBlock` просто добавляет `className={cat}` — цвет берётся из
CSS, не из JS (`config.areas[i].color` используется только для
цветных точек `.td`, `.pit`, `.fdot`).

## Toasts

При любом изменении блока (добавлен / изменён / удалён / статус
поменялся) — показать тост в `.toast-c`:

- `.toast.success` — зелёная border-left, текст вида `✓ Создан:
  Монтаж GC`, исчезает через 2500ms
- Анимация появления — keyframe `tIn` (из мока)
- Для ошибок — `.toast.error` (появится в фазе 6)

## Status bar

Обновляется с фазы 2:
- `Сохранено HH:MM` после каждого автосохранения
- Счётчик `N сущностей` — из `entities.length`
- (Счётчики команд/ошибок — появятся в фазе 6)

## Критерии готовности

- [ ] Сетка рендерит 7 дней × 17 часов, 30-мин строки 40px
- [ ] Блоки из `data/schedule/2026-wNN.json` отображаются в
  правильных позициях и цветах
- [ ] Today-колонка выделена золотым кружком в day-header; now-
  линия золотая с точкой слева
- [ ] Balance bar в каждом day-header: занятые категории пропор-
  ционально, справа — свободные часы
- [ ] Week summary stacked bar + часы по категориям в header
- [ ] Текущий блок (через который проходит now-линия) — яркий
  (`.tb.now`, заливка 55%, bold title)
- [ ] Клик на блок — выделяет (`.selected` + золотой box-shadow)
- [ ] Двойной клик на блок — открывает BlockEditor
- [ ] Клик на пустую ячейку — открывает инлайн-инпут на snap-
  позиции; Enter создаёт work-блок, Escape отменяет
- [ ] Hover на пустой ячейке — слева 2px полоска work
  (подсказка категории по умолчанию)
- [ ] ПКМ на блок — контекстное меню с действиями и цветными
  кружками для смены категории
- [ ] Хоткеи работают: `1/2/3`, `Esc`, `N`, `D`, `S`, `Delete`,
  `Enter`, `Ctrl+↑/↓`
- [ ] Overlap подсвечивается dashed red + ⚠
- [ ] Навигация `←` / `Сегодня` / `→` переключает недели
- [ ] Все изменения автосохраняются (debounce 500ms для title/
  notes, мгновенно для статуса/позиции)
- [ ] Status bar обновляется: `Сохранено HH:MM` + счётчик
- [ ] Toast-уведомления появляются на каждое изменение
