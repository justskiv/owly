# TuzovOS v2 — Полная спецификация

Единый документ, описывающий всё приложение: экраны, компоненты, взаимодействия, данные, стили. Достаточен для реализации без дополнительного контекста.

Источник истины для визуала — `spec/tuzov-os/v2/pool-planner-demo-v2.html`.

---

## 1. Общая архитектура

### 1.1. Что это

Десктопное приложение (Tauri v2 + React 19 + TypeScript) — персональный центр управления. Единая система, объединяющая все сферы жизни: работа, люди, быт, развитие, здоровье. Из хаоса сущностей собирается конкретный план на неделю.

### 1.2. Принципы

- Данные — JSON-файлы на диске (`data/`). Никаких баз данных.
- Приложение — UI поверх файлов. Читает, рендерит, пишет обратно.
- AI-агент работает снаружи (Claude Code / Cowork), читает файлы напрямую, пишет через очередь команд.
- Тегирование вместо папок. Двухосевая модель: тип сущности × область жизни.
- Тёмная тема — единственная.
- State — Zustand stores, auto-save через подписку.
- Стили — semantic CSS-классы поверх токенов. Tailwind подключён, но утилитарные классы в компонентах не используем.

### 1.3. Layout приложения

```
┌──────────────────────────────────────────────────┐
│ Top Navigation Bar (40px height)                 │
├──────────────────────────────────────────────────┤
│                                                  │
│           Active View (flex: 1)                  │
│                                                  │
└──────────────────────────────────────────────────┘
```

Приложение — `display: flex; flex-direction: column; height: 100vh`. Overflow: hidden на body. Скролл — внутри вьюх.

---

## 2. Дизайн-токены

### 2.1. Цвета

```css
--bg-base:     #0D0D12    /* фон приложения */
--bg-surface:  #16161E    /* карточки, сайдбар, шапка */
--bg-tint-1:   #1E1E28    /* hover, поля ввода */
--bg-tint-2:   #26263A    /* active, focus, выпадающие */

--text-primary:   #E8E8ED
--text-secondary: #A0A0B0
--text-tertiary:  #6A6A7A
--text-disabled:  #484858

--accent:  #D4A843    /* золотой — акцент, активные табы, границы */
--success: #30D888    /* зелёный — выполнено, здоровье, в норме */
--error:   #E06878    /* красный — ошибка, просрочено, удаление */
--warning: #E8A735    /* жёлтый — предупреждение */

--border:       rgba(255,255,255, .08)
--border-hover: rgba(255,255,255, .15)
```

### 2.2. Категории (области жизни)

Пять предустановленных категорий. Каждая имеет уникальный цвет. Цвета приходят из JS-объекта `CATS` и инлайнятся в `style`. Канонический порядок (совпадает с `CATS`):

| ID       | Название  | Цвет       |
|----------|-----------|------------|
| work     | Работа    | `#FF7A3D`  |
| growth   | Развитие  | `#9B6CFF`  |
| life     | Быт       | `#B8D84A`  |
| people   | Люди      | `#FF5CA8`  |
| health   | Здоровье  | `#30D888`  |

> **Примечание.** В `:root` мока объявлены CSS-переменные `--work`, `--people` и т. д., но нигде в CSS на них нет ссылки — все цвета категорий инлайнятся из JS. CSS-переменные оставлены как dead code; единственный источник правды для цветов — объект `CATS`.

Порядок отображения категорий **различается по экранам** (зафиксировано из мока):
- Контекст (§7): `work → growth → people → health → life`
- Tasks Sidebar (§5): `work → growth → life → people → health`
- Review weekly (§9): `work → growth → health → life → people`

### 2.3. Радиусы

```css
--radius-sm: 6px     /* кнопки, поля, чипы, карточки kanban */
--radius-md: 8px     /* карточки направлений, попапы, контекстное меню */
--radius-lg: 12px    /* модалки, quick-add bar, entity popup */
```

### 2.4. Типографика

```css
--fs-2xs: 10px    /* мета, счётчики, метки */
--fs-xs:  11px    /* подписи, secondary text */
--fs-sm:  12px    /* основной мелкий текст, табы навигации */
--fs-md:  14px    /* основной текст, заголовки карточек */
--fs-lg:  16px    /* крупные заголовки */
```

Основной шрифт: `'Inter', -apple-system, sans-serif`.
Моноширинный (для времени, недель): `'SF Mono', 'Fira Code', monospace`.

### 2.5. Скроллбары

Тонкие (6px), прозрачный трек, полупрозрачный thumb (`rgba(255,255,255,.1)`, hover `.2`). Через webkit-scrollbar и scrollbar-width: thin.

### 2.6. Анимации

- Все transitions: `0.1s–0.15s` (быстро, не тормозят).
- Попапы: `popIn` — `scale(.95) → scale(1)` за `0.1s ease-out`.
- Quick-add: `qaSlide` — `translateY(-12px) → 0` за `0.15s`.
- ~~Detail panel: `dpSlide`~~ — **не реализовывать** (legacy в моке, заменён на Entity Popup §10.3).
- Toast: `toastIn` — `translateY(16px) → 0` за `0.2s`.
- Quick-add overlay: `qaFadeIn` — `opacity 0 → 1` за `0.12s`.

---

## 3. Top Navigation Bar

### 3.1. Структура

```
[Планирование] [Задачи] [Проекты] [Контекст] [Горизонт] [Ревью]  ←spacer→  [Сегодня] [‹] W18 · 27 апр — 3 мая [›]  [+]
```

### 3.2. Табы навигации (`nav-tab`)

- 6 табов: Планирование, Задачи, Проекты, Контекст, Горизонт, Ревью.
- `data-tab` значения: `plan`, `tasks`, `proj`, `ctx`, `horizon`, `review`.
- Стиль: `font-size: var(--fs-sm)`, `font-weight: 600`, `color: var(--text-tertiary)`.
- Active: `color: var(--accent)`, `border-bottom: 2px solid var(--accent)`.
- Hover: `color: var(--text-secondary)`.
- Высота таба = высота навбара (40px), padding: `8px 14px`.

### 3.3. Week Navigation (`nav-week`)

Блок справа от spacer. Моноширинный шрифт. Показывает текущую неделю и позволяет переключаться.

Элементы слева направо:
1. **Кнопка «Сегодня»** (`wk-today`) — текст "Сегодня", `font-size: var(--fs-2xs)`, `color: var(--text-tertiary)`. Hover: `border-color: var(--accent)`, `color: var(--accent)`. Скрывается (`display: none`) когда `weekOffset === 0` (класс `.current`). Всегда слева от стрелок.
2. **Стрелка «‹»** (`wk-arrow`) — `28×28px`, border: `1px solid transparent`. Hover: `border-color: var(--border-hover)`, `background: var(--bg-tint-1)`.
3. **Метка недели** (`wkLabel`) — формат `W{номер} · {начало} — {конец}`. Пример: `W18 · 27 апр — 3 мая`.
4. **Стрелка «›»** (`wk-arrow`) — аналогично.

#### Логика недельной навигации

```
weekOffset: number = 0  // 0 = текущая, -1 = предыдущая, +1 = следующая
```

Функции:
- `getWeekStart(offset)` — дата понедельника для offset. Неделя начинается с понедельника.
- `getWeekDays()` — массив из 7 дат (Пн–Вс) для `weekOffset`.
- `getDayLabels()` — массив строк типа `"Пн 28"`, `"Вт 29"`.
- `getWeekLabel()` — строка `"W18 · 27 апр — 3 мая"`.

Номер недели (приближённый): `Math.ceil(((start - Jan1) / 86400000 + Jan1.getDay() + 1) / 7)`.

> **Примечание:** формула не является строго ISO 8601 (не учитывает правило "first Thursday"). Для 2026 года совпадает, но на стыках лет может дать ±1 смещение. При необходимости заменить на полноценный ISO 8601 алгоритм.

Месяцы: `['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек']`.
Дни: `['Вс','Пн','Вт','Ср','Чт','Пт','Сб']`.

При переключении недели: пересчитываются метки дней, метка недели, заголовок пула, перестраивается сетка.

### 3.4. Кнопка «+» (`nav-add-btn`)

- `28×28px`, `border: 1px dashed var(--border-hover)`, `border-radius: var(--radius-sm)`.
- Hover: `border-color: var(--accent)`, `color: var(--accent)`, `border-style: solid`, `background: rgba(212,168,67,.08)`.
- `margin-left: 8px`.
- Клик → открывает Quick Add (см. §10.1).
- `title="Создать (Cmd+N)"`.

---

## 4. Экран «Планирование» (план недели)

Главный экран. Сетка расписания + боковая панель пула.

### 4.1. Layout

```
┌──────────────────────────────────┬────────────────┐
│         Grid (flex: 1)           │  Pool Sidebar  │
│                                  │   (280px)      │
│  [TimeGutter 48px] [7 DayCols]  │                │
│                                  │                │
└──────────────────────────────────┴────────────────┘
```

`display: flex`. Grid слева (`flex: 1`), Pool справа (`width: 280px`, `flex-shrink: 0`).

#### Вложенные обёртки Grid (критично для скролла)

```
.plan-view (flex row, overflow: hidden)
  └─ .grid-wrap (flex: 1, flex-direction: column, overflow: hidden)
       └─ .grid-scroll (flex: 1, overflow-y: auto, display: flex)
            ├─ .time-gutter (48px)
            └─ .day-cols (flex: 1, display: flex)
                 ├─ .day-col-wrap × 7 (flex: 1)
                 │    ├─ .day-head (sticky)
                 │    └─ .day-body (relative, height: GRID_H)
```

Без `.grid-wrap` и `.grid-scroll` вертикальный скролл сетки не работает.

### 4.2. Time Gutter (Столбец времени)

- Ширина: `48px`, `flex-shrink: 0`.
- Диапазон: **07:00–23:00** (H_START=7, H_END=23).
- Шаг: 30 минут. Итого `(23-7)*2 = 32` строки.
- Высота строки: `ROW_H = 40px`. Общая высота: `32 * 40 = 1280px`.
- Метки времени показываются только на каждом часе (чётные строки): `07:00`, `08:00`, ... Нечётные — пустые.
- Стиль: `font-size: var(--fs-2xs)`, `color: var(--text-disabled)`, `font-family: monospace`, выровнены по правому краю (`text-align: right`), `padding: 2px 6px 0 0`.
- Первая строка gutter — пустая (32px), совпадает с заголовками дней.

### 4.3. Day Columns (Столбцы дней)

7 столбцов, `flex: 1` каждый.

#### Заголовок дня (`day-head`)

- Высота: `32px`, `position: sticky; top: 0; z-index: 10`.
- `background: var(--bg-surface)`, `border-bottom: 1px solid var(--border)`, `border-left: 1px solid var(--border)`.
- Текст: `"Пн 28"` (день недели + число), `font-size: var(--fs-xs)`, `font-weight: 600`, `color: var(--text-tertiary)`.

#### Тело дня (`day-body`)

- `position: relative`, `border-left: 1px solid var(--border)`.
- Высота: `GRID_H = 1280px`.
- Горизонтальные линии (`hour-line`): `position: absolute`, `border-top: 1px solid var(--border)` на каждой 30-минутной отметке.
- Drop indicator (`drop-indicator`): `height: 2px`, `background: var(--accent)`, скрыт по умолчанию, показывается при drag-and-drop.

### 4.4. Блоки расписания (`block`)

Визуальное представление запланированного события на сетке.

#### Позиционирование

- `position: absolute` внутри `day-body`.
- `top = (start_minutes - H_START*60) / 30 * ROW_H` px.
- `height = duration / 30 * ROW_H` px.
- `left: 3px; right: 3px` — отступ от краёв колонки.

#### Визуал

- `border-radius: var(--radius-sm)`.
- `background: {categoryColor}15` (hex suffix `15` ≈ 8.2% opacity, НЕ 15%). Категория передаётся ТОЛЬКО фоновым тинтом — без вертикальной полосы слева (CODESTYLE §11).
- `padding: 3px 6px`, `font-size: var(--fs-2xs)`, `cursor: grab`.
- Содержимое:
  - **Заголовок** (`b-title`): `font-weight: 600`, `white-space: nowrap`, `text-overflow: ellipsis`.
  - **Время** (`b-time`): `"09:00–11:00"`, `font-size: 9px`, `color: rgba(255,255,255,.5)`. Показывается только если высота блока > 28px.
  - **Resize handle** (`resize-handle`): `position: absolute; bottom: 0; height: 8px; cursor: ns-resize`. Полоска **всегда видна** (`::after`: `width: 24px`, `height: 2px`, `background: rgba(255,255,255,.15)`). При hover блока: `background: rgba(255,255,255,.35)`.

#### Состояния

- **done**: `opacity: .35`, заголовок `text-decoration: line-through`.
- **selected**: `outline: 2px solid var(--accent)`, `outline-offset: 1px`, `z-index: 3`.

#### Drag блока

- Mousedown на блоке (не на resize handle) → начало drag.
- Порог: 5px суммарного смещения до начала drag.
- При drag: оригинальный блок `opacity: .3`, появляется ghost-block (фиксированная позиция, `pointer-events: none`, `z-index: 100`, `opacity: .75`, `width: 120px`, `background: {categoryColor}25` (hex suffix 25 ≈ 14.5%)).
- Drop indicator появляется в целевой колонке, snap к 30 мин.
- При drop: блок перемещается в новый день/время.
- Snap: `Math.round(minutes / 30) * 30`.
- Clamp: `H_START*60` ... `H_END*60 - block.duration`.

#### Resize блока

- Mousedown на `.resize-handle` → изменение длительности.
- Snap к 30 мин, min: 30, max: 480 минут.

#### Context Menu (ПКМ)

При правом клике на блоке — контекстное меню (`ctx-menu`):
- **«✓ Готово» / «Не готово»** — переключение статуса done.
- **«Дублировать»** — копия сразу после оригинала (`start + duration`).
- **«Удалить»** — удаление блока (красный текст).

Стиль контекстного меню:
- `position: fixed`, `z-index: 200`, `background: var(--bg-tint-2)`, `border: 1px solid var(--border-hover)`, `border-radius: var(--radius-md)`, `padding: 4px`, `min-width: 140px`.
- Кнопки: `font-size: var(--fs-xs)`, hover `background: var(--bg-tint-1)`.

#### Hotkeys

- **Delete / Backspace** на выделенном блоке → удаление.

### 4.5. Drag-to-Grid (из пула на сетку)

Элементы из пула/сайдбара можно перетянуть на сетку для создания нового блока.

- При drag: ghost-block + drop indicator в колонках.
- При drop: создаётся новый блок с привязкой к pool item (`pool` ID).
- Длительность по умолчанию: **дробимые** — 60 минут; **атомарные** — `pi.hours * 60` (реальные часы item'а, например "Позвонить маме" 0.5ч → 30 мин, "Забрать документы" 1.5ч → 90 мин).
- Пересчёт пула и бюджета после drop.

### 4.6. Pool Sidebar (Боковая панель)

#### Header

```
ПУЛ · W18                                    [+]
```

- `h3#poolTitle`: начальный текст `"Пул"`, динамически обновляется до `"ПУЛ · W{номер}"` после вызова `updateWeekLabel()` при инициализации. `font-size: var(--fs-sm)`, `font-weight: 700`, `color: var(--text-secondary)`.
- Кнопка `+` (`btn-sm`): `24×24px`, `border: 1px solid var(--border)`, hover accent.

#### Budget (Бюджет)

Блок с расчётами времени на неделю:

```
Занято            XX.X ч      ← dim (--text-tertiary)
Свободно          XX.X ч      ← bold (font-weight: 600)
  ● Пул           XX.X ч      ← bold, цвет accent
  ● Люфт          XX.X ч      ← bold, зелёный если ≥0, красный если <0
[═══════════════════════════]  ← progress bar
```

- **Занято** = сумма длительностей всех блоков / 60.
- **Свободно** = (H_END - H_START) × 7 - Занято.
- **Пул** = оставшееся время по pool items (для дробимых: hours - scheduled; для атомарных неразмещённых: hours).
- **Люфт** = Свободно - Пул. Положительный → `var(--success)`, отрицательный → `var(--error)`.
- Progress bar: три сегмента — серый (занято), gold (пул), зелёный (люфт).
- Точки-индикаторы (`dot`): `6×6px`, `border-radius: 50%`, рядом с "Пул" и "Люфт".
- Indent строки: `padding-left: 12px`.

#### Pool Tabs

4 таба под бюджетом:

| Tab       | data-pt    | Содержимое                      |
|-----------|------------|----------------------------------|
| Пул       | pool       | Pool items (дробимые + атомарные)|
| Задачи    | tasks      | Все задачи, отсортированные      |
| Проекты   | projects   | Все проекты, отсортированные     |
| Контекст  | dirs       | Все направления                  |

Стиль: `font-size: var(--fs-2xs)`, `font-weight: 600`, default `color: var(--text-disabled)`. Hover: `color: var(--text-tertiary)`. Active: `color: var(--accent)`, `border-bottom: 2px solid var(--accent)`.

#### Tab: Пул

Разделён на две секции. Заголовки секций (`pool-section`): `font-size: var(--fs-2xs)`, `font-weight: 700`, `color: var(--text-disabled)`, `text-transform: uppercase`, `letter-spacing: .5px`, `padding: 6px 8px 3px`, `margin-top: 2px`.

**Дробимые** — задачи с объёмом в часах, которые можно разбивать на несколько блоков:
- Цветная полоска слева (`s-color`: `width: 3px`).
- Заголовок + мета `"X.X / Yч"`.
- Progress bar (`s-bar`): `height: 3px`, заливка цветом категории.
- Когда `scheduled >= hours`: `text-decoration: line-through`, `opacity: .5`.
- Кнопка `×` — удалить из пула (удаляет также все связанные блоки).
- Draggable на сетку (создаёт блок 60 мин, привязка к pool item).

**Атомарные** — задачи фиксированного объёма, ставятся целиком:
- Аналогичный вид, но без progress bar.
- Когда `placed = true`: `opacity: .4`, badge ✓ зелёный, не draggable.
- Draggable пока не placed.

#### Tab: Задачи

Все задачи из массива `tasks`, отсортированные по комбинации deadline + priority:
- Сортировка: `(daysUntil < 0 ? daysUntil*3 : daysUntil) + priorityScore*20`.
- Priority score: high=0, medium=1, low=2.
- Каждая задача показывает: цветную полоску, заголовок, иконку приоритета (⚡/●/○), deadline с urgency-классом.
- Кнопка `→`/`✓` — toggle в пул недели. При добавлении: `hours: 1`, `splittable: false`. Матчинг задача↔pool по `pi.title === t.title`.
- Draggable на сетку (60 мин). При drag задачи напрямую (не из пула) блок создаётся с `pool: null`.
- Готовые задачи внизу под секцией "Готово (N)".

#### Tab: Проекты

Все проекты, отсортированные по `la` (days since last activity):
- Заголовок, мета: `"{column name}"` + `"{la}д"`.
- Stale (la ≥ 14): красный текст на днях.
- Кнопка `→`/`✓` — toggle в пул. При добавлении: `hours: 4`, `splittable: true`.

#### Tab: Контекст

Все направления:
- Для направлений с progress: мета `"{current} → {target}"`, progress bar.
- Для направлений с cadence: мета `"{cadLbl} · {days}д назад"` с urgency-классом.
- Кнопка `✓` (зелёная) для cadence-направлений — отмечает выполнение.
- Кнопка `→`/`✓` — toggle в пул. Логика: если есть связанные проекты, добавляет самый свежий (наименьший `la`) как `splittable: true, hours: 4`; если нет — добавляет само направление как `splittable: true, hours: 2, directionId: dir.id`.
- Для направлений без cadence и без progress: мета = label категории (fallback).

#### Shared Item Style (`s-item`)

Универсальный стиль элемента в сайдбаре:
- `display: flex; align-items: center; padding: 5px 8px; border-radius: var(--radius-sm); background: var(--bg-tint-1); margin-bottom: 3px; gap: 6px`.
- Hover: `background: var(--bg-tint-2)`.
- `.s-color`: цветная полоска `width: 3px`, `border-radius: 2px`, `align-self: stretch`, `min-height: 20px`.
- `.s-title`: `font-size: var(--fs-xs)`, `font-weight: 600`, ellipsis.
- `.s-meta`: `font-size: 9px`, `color: var(--text-tertiary)`.
- `.s-act`: кнопка `20×20px`, `border: 1px solid var(--border)`. Active (`.in`): `border-color: var(--accent)`, `color: var(--accent)`, `background: rgba(212,168,67,.1)`.
- `.s-bar`: `height: 3px`, `border-radius: 2px`, `background: var(--bg-base)`.
- `.s-badge`: `font-size: 9px`, `padding: 1px 5px`, `border-radius: 8px`.

---

## 5. Экран «Задачи»

### 5.1. Layout

```
┌─────────────────────────────────────────────────────────┐
│    [Tasks Inner (max-width: 420px)]  [Tasks Side 220px] │
└─────────────────────────────────────────────────────────┘
```

`display: flex; padding: 16px 20px; overflow-y: auto; gap: 16px; justify-content: center`.

### 5.2. Header + Task Bar

```
Задачи  12 активных · ✕ Фильтр
[+] [🔍 Поиск задач...                              ]
```

#### Dual-mode Task Bar (`task-bar-wrap`)

Два элемента в одной строке, `height: 32px`, `gap: 6px`:

**Левый слот (`tb-left`)** — морфится между кнопкой `+` и полем добавления:

Режим **кнопки** (`.as-btn`):
- `flex: 0 0 32px`, `justify-content: center`, `cursor: pointer`.
- Показывает иконку `+` (`tb-plus-icon`). Input скрыт (`width: 0; opacity: 0; pointer-events: none`).
- Dot скрыт.
- Hover: `border-color: var(--border-hover); background: var(--bg-tint-1)`.

Режим **поля** (`.as-field`):
- `flex: 1`, `padding: 0 10px`, `background: var(--bg-tint-1)`.
- `border-style: dashed; border-color: rgba(212,168,67,.3)` — даёт ощущение "временности".
- Focus-within: `border-color: rgba(212,168,67,.5); background: var(--bg-tint-2)`.
- Показывает: category dot (`tb-dot`, 10×10px, кликабельный → cat picker popup), input, кнопку `✕`.
- Иконка `+` скрыта.

Переход: CSS transitions на `flex`, `padding`, `background`, `border-color` (`.3s ease`). Input opacity: `transition: opacity .15s .1s` (с задержкой).

**Правый слот (`tb-right`)** — поле поиска:

Нормальный режим:
- `flex: 1`, `background: var(--bg-tint-1)`, `border: 1px solid transparent`.
- Иконка лупы (`tb-icon`), input, кнопка `✕` (только при наличии текста).
- Focus-within: `border-color: var(--border-hover); background: var(--bg-tint-2)`.

Скрытый режим (`.hidden`) — когда открыто добавление:
- `flex: 0 0 0; padding: 0; opacity: 0; overflow: hidden; pointer-events: none; border: none`.

#### Поведение

1. **Клик по `+`**: left → `.as-field`, right → `.hidden`. Focus на input. Click-outside → dismiss.
2. **Enter в поле добавления**: создаёт задачу с `prio: 'medium'`, `deadline: null`, категория из dot. Toast `"✓ {title}"`. Поле остаётся открытым для следующей задачи.
3. **Escape / ✕**: возвращает search mode.
4. **Поиск**: работает в реальном времени (без debounce). Фильтрует по `title.toLowerCase().includes(query)`. Восстанавливает позицию курсора при re-render.

### 5.3. Task Groups (Группировка задач)

Активные задачи разбиты на 4 группы по deadline:

| Группа           | Иконка | Условие                         |
|-----------------|--------|----------------------------------|
| 🔥 Горит         |        | deadline ≤ 2 дней (включая просроченные, т.е. d<0) |
| ⚡ Срочно        |        | deadline 3–7 дней                |
| 📋 Скоро         |        | deadline 8–30 дней               |
| 💤 Когда-нибудь  |        | без deadline или > 30 дней       |

Внутри группы сортировка: priority (high→low), затем deadline (ближе→дальше).

Пустые группы не отображаются.

Стили заголовка группы (`task-group-head`): `font-size: var(--fs-xs)`, `font-weight: 700`, `color: var(--text-tertiary)`, `padding: 4px 0`, `margin-bottom: 4px`. Count (`.tg-count`): `font-size: var(--fs-2xs)`, `color: var(--text-disabled)`. Группа (`task-group`): `margin-bottom: 14px`.

Группа "✓ Готово" внизу — показывает выполненные задачи.

### 5.4. Task Row (`task-row`)

```
[☐] Title                     ⚡ Высокий    3д    ●
     priority sub text
```

- `display: flex; align-items: center; padding: 6px 10px; border-radius: var(--radius-sm); background: var(--bg-surface); margin-bottom: 3px; gap: 8px`.
- Hover: `background: var(--bg-tint-1)`.
- **Checkbox** (`tr-check`): `16×16px`, `border-radius: 4px`, `border: 1.5px solid var(--text-disabled)`. Hover: `border-color: var(--success)`. Checked: `background: var(--success)`, `color: #000`, текст `✓`.
- **Body** (`tr-body`): title + sub (priority text).
- **Deadline** (`tr-deadline`): `font-size: var(--fs-2xs)`, `font-weight: 600`, urgency class.
- **Category dot** (`tr-cat`): `8×8px`.
- Done row: `opacity: .3`, title `text-decoration: line-through`.

Клик по checkbox → toggle done.
Клик по строке (не checkbox) → открывает Entity Popup для task (см. §10.3).

### 5.5. Tasks Sidebar (`tasks-side`)

`width: 220px`, `position: sticky; top: 16px; align-self: flex-start` — не уезжает при скролле.

Каждая карточка (`ts-card`): `background: var(--bg-surface)`, `border: 1px solid var(--border)`, `border-radius: var(--radius-md)`, `padding: 12px`, `margin-bottom: 10px`. h4: `font-size: var(--fs-2xs)`, `font-weight: 700`, `text-transform: uppercase`, `letter-spacing: .4px`, `margin-bottom: 8px`, `color: var(--text-disabled)`.

3 карточки:

**Обзор** — кликабельные строки-фильтры:
- Все: количество активных.
- Выполнено: зелёный count.
- Просрочено: красный count (только если > 0).
- На этой неделе: жёлтый count (только если > 0).

**По категориям** — кликабельные строки с dot + label + count.

**По приоритету** — ⚡ Высокий / ● Средний / ○ Низкий с counts.

Клик по строке → устанавливает `taskFilter`. Повторный клик → сбрасывает. Активный фильтр: `background: var(--bg-tint-2)`.

### 5.6. Task Filtering

Два независимых механизма, применяются последовательно:

1. **taskSearch** (текстовый) — фильтрует по `title.toLowerCase().includes(query)`.
2. **taskFilter** (структурный) — `{type: 'cat'|'prio'|'overdue'|'week'|'done', val?: string}` или `null`.

Стекируются: сначала search, потом filter. Если фильтр активен — показывается метка с `✕` в header.

> **Нюанс мока:** `taskSearch` не применяется к секции «✓ Готово» — готовые задачи показываются полностью независимо от поиска.

При `taskFilter.type === 'done'` — показываются только готовые задачи.

При пустом результате фильтра — текст "Нет задач по этому фильтру" (opacity .4, по центру).

### 5.7. Urgency Classes

#### Для задач (по deadline)

Вычисляется из `daysUntil(deadline)`:

| Класс          | Условие          | Стиль                 |
|----------------|------------------|-----------------------|
| (пустая строка)| `d === null`     | без класса            |
| `urgency-bad`  | `d < 0` или `d ≤ 3` | `color: var(--error)` |
| `urgency-warn` | `4 ≤ d ≤ 7`     | `color: var(--warning)` |
| `urgency-ok`   | `d > 7`          | `color: var(--success)` |

Формат deadline: `"{N}д"`, `"сегодня"`, `"{N}д просрочено"`.

#### Для каденций (отдельная логика!)

Вычисляется из `over = daysSinceLastAct - cadence`:

| Класс          | Условие          | Стиль                 |
|----------------|------------------|-----------------------|
| `urgency-bad`  | `over > 0`       | `color: var(--error)` |
| `urgency-warn` | `over > -3` (т.е. -3...0) | `color: var(--warning)` |
| `urgency-ok`   | `over ≤ -3`      | `color: var(--success)` |

> **Внимание:** это НЕ та же формула, что для задач. Не использовать общий `urgClass()` для каденций.

---

## 6. Экран «Проекты»

### 6.1. Layout

```
┌────────────────────────────────────────────────────┐
│  Board Bar: [Видео] [Контент] [Разное]  ... dots   │
│  Summary Bar: 11 активных · 3 заброшенных          │
├────────────────────────────────────────────────────┤
│  Kanban Columns (flex, scroll-x)                   │
│  [Идея 2] [Сценарий 3] [Съёмка 1] [Монтаж 2] ... │
└────────────────────────────────────────────────────┘
```

### 6.2. Board Bar

Табы досок + фильтр категорий.

**Табы досок** (`board-tab`):
- Стиль: `padding: 5px 10px`, `font-size: var(--fs-xs)`, `font-weight: 600`, `border: 1px solid transparent`.
- Active: `background: var(--bg-tint-2)`, `color: var(--text-primary)`, `border-color: var(--border)`.

**Данные досок:**

| ID   | Название | Колонки                                      |
|------|----------|----------------------------------------------|
| brd1 | Видео    | Идея, Сценарий, Съёмка, Монтаж, Публикация  |
| brd2 | Контент  | Идея, Черновик, Ревью, Публикация            |
| brd3 | Разное   | Надо, Начал, Делаю, Почти, Готово            |

**Фильтры категорий** (`cat-filters`):

```
[Все] [●work] [●growth] [●life] [●people] [●health]
```

- `gap: 10px`, `margin-left: auto`.
- Кнопка "Все" (`cat-btn.all-btn`): текстовая, `padding: 2px 8px`, `border: 1px solid var(--border)`. Active: `border-color: var(--accent)`, `color: var(--accent)`, `background: rgba(212,168,67,.08)`, `transform: none`, без `::after`.
- Цветные dots (`cat-btn`): `18×18px`, `border-radius: 50%`, `border: 2px solid transparent`.
- Hover: `transform: scale(1.15)`.
- Active: **без border**, `transform: scale(1.25)`, `::after` с `✓` (`font-size: 9px`, `color: #fff`, `font-weight: 800`, `text-shadow: 0 1px 2px rgba(0,0,0,.5)`).

### 6.3. Summary Bar

- `"N активных"` + опционально `" · N заброшенных"` (красная ссылка `stale-link`).
- Клик по "заброшенных" → toggle stale filter (показывает только проекты с `la ≥ 14`).

### 6.4. Kanban

`display: flex; gap: 8px; padding: 10px; overflow-x: auto`.

**Колонка** (`kanban-col`): `flex: 0 0 220px`, `background: var(--bg-surface)`, `border-radius: var(--radius-md)`.

**Заголовок колонки** (`kanban-col-head`):
- `font-size: var(--fs-xs)`, `font-weight: 700`, `text-transform: uppercase`, `letter-spacing: .5px`.
- Count badge: `background: var(--bg-tint-2)`, `padding: 0 5px`, `border-radius: 8px`, `font-size: var(--fs-2xs)`.

**Карточка** (`kanban-card`):
- `background: var(--bg-tint-1)`, `border-radius: var(--radius-sm)`, `padding: 8px 10px`, `border-left: 3px solid {categoryColor}`.
- `cursor: grab`, hover: `background: var(--bg-tint-2)`.
- Содержимое: title, meta (category badge + days), кнопка "→ В пул"/"✓ В пуле".
- **Category badge** (`kc-badge`): `background: {color}20`, `color: {color}`.
- **Stale days**: `color: var(--error)` если ≥ 14.
- HTML5 drag: `draggable=true`, `dragstart` → `setData('text/plain', projectId)`.
- Drop на kanban-cards → изменение колонки, `la = 0`.

**Pool button** (`btn-pool`):
- `border: 1px solid var(--accent)`, `color: var(--accent)`, `font-size: var(--fs-xs)`, `font-weight: 600`.
- Hover: `background: rgba(212,168,67,.1)`.
- In pool (`.in`): `background: rgba(212,168,67,.15)`, `border-style: dashed`.
- Текст: `"→ В пул"` / `"✓ В пуле"`.

**Inline creation** — внизу каждой колонки:
- Trigger (`add-trigger`): `"+ Проект"`, `color: var(--text-disabled)`, `border: 1px dashed transparent`. Hover: border visible.
- Клик → inline input (`inline-add`) с category dot.
- Enter → создаёт проект в текущей доске (`activeBoard`) + текущей колонке (`colIdx`). Дефолтная категория: `work`. Toast.
- Escape → закрывает без сохранения. Blur (клик в сторону) → **создаёт проект** (аналогично Enter), если поле не пустое.

> **Дефолты для новых проектов из разных мест:**
> - Inline из kanban: `bid: activeBoard, col: colIdx`.
> - Inline из direction card (§7.8): `bid: 'brd3', col: 0`.
> - Quick Add (§10.1): `bid: 'brd3', col: 0`.

### 6.5. Клик по карточке

Открывает Entity Popup для project (см. §10.3).

---

## 7. Экран «Контекст» (Направления)

### 7.1. Layout

`flex-direction: column; padding: 16px 20px; overflow-y: auto`.

Направления группируются по категориям. Порядок: work → growth → people → health → life.

### 7.2. Category Section Header (`cat-section-head`)

```
● Работа                                    ▼  4
  ↑dot  ↑label  (spacer via margin-left:auto) ↑arrow ↑count
```

- `display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--border)`.
- Полная ширина (block-level).
- **Dot** (`cs-dot`): `8×8px`, цвет категории.
- **Label** (`cs-label`): `font-size: var(--fs-xs)`, `font-weight: 700`, `text-transform: uppercase`, `letter-spacing: .6px`, `color: var(--text-secondary)`.
- **Arrow** (`cs-arrow`): `▼`/`▶`, `color: var(--text-disabled)`, `font-size: 9px`.
- **Count** (`cs-count`): `font-size: var(--fs-2xs)`, `color: var(--text-disabled)`, `margin-left: auto`.
- Hover: `border-bottom-color: var(--border-hover)`.
- Клик → toggle collapse/expand grid.

### 7.3. Direction Grid

`display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 10px`.

### 7.4. Direction Card (`dir-card`)

```
┌─────────────────────────────────────┐
│ ● YouTube — ролик                    │
│ ▓▓▓▓▓▓▓▓░░░░░░ 60%                │ ← progress (если есть)
│ 33K → 55K                           │ ← measurable target
│ 1×/2мес · 57д назад · просрочено 27д│ ← cadence
│ ─────────────────────────────────── │
│ 7 проектов                           │
│ Ролик про GC        🕐 3д           │ ← project list
│ Ролик: Concurrency  🕐 5д           │
│ ...                                  │
│ [→ В пул] [✓ Отметить] [+ Проект]  │
└─────────────────────────────────────┘
```

- `background: var(--bg-surface)`, `border: 1px solid var(--border)`, `border-radius: var(--radius-md)`, `padding: 12px`.
- Hover: `border-color: var(--border-hover)`.

#### Содержимое карточки

**Top** (`dc-top`): dot (8×8px) + title (`font-size: var(--fs-md)`, `font-weight: 600`).

**Progress** (если `progress !== null`): `height: 4px`, `background: var(--bg-tint-1)`, заливка цветом категории.

**Meta** (`dc-meta`): `font-size: var(--fs-xs)`, `color: var(--text-tertiary)`.
- Measurable: `"{current} → {target}"`.
- Deadline: `"Дедлайн: {date} ({days}д)"` с urgency class.
- Cadence: `"{cadLbl} · {days}д назад"` + `" · просрочено {N}д"` если over > 0.

**Empty state** — если нет cadence, measurable И нет проектов: `<div class="dc-meta" style="font-style:italic;opacity:.5">нет проектов</div>`.

**Projects** (`dc-projects`):
- Заголовок: `"{N} проект{ов/а}"`, `font-weight: 600`.
- Каждый проект (`dc-proj`):
  - Title (ellipsis) + days indicator.
  - **Days indicator** (`dc-days`): clock icon SVG + `"{la}д"`.
  - `width: 48px`, `text-align: left`, `font-variant-numeric: tabular-nums`.
  - Color coding:
    - `.fresh` (la ≤ 3): `color: var(--success)` — зелёный.
    - `.normal` (4–13): `color: var(--text-disabled)` — тусклый.
    - `.stale` (la ≥ 14): `color: var(--error)` — красный.
  - Tooltip (`data-tooltip`): `"Активность сегодня"` / `"Вчера"` / `"Последняя активность {N} дн. назад"`. Позиция: `bottom: calc(100% + 6px); right: 0` (без центрирования, в отличие от Quick Add tooltips).
  - **Unlink button** (`dc-unlink`): `opacity: 0`, appears on project hover. SVG иконка broken link. Hover: `color: var(--error)`. Клик → `project.dirId = null`, toast `"Отвязано: {title}"`, ререндер карточки.

**dc-proj стили**: `transition: all .1s; cursor: pointer; border-radius: var(--radius-sm); padding: 2px 4px; margin: 0 -4px`. Hover: `background: var(--bg-tint-1)`. Клик по проекту → раскрывает inline editor (§7.5).

**Actions** (`dc-actions`): `display: flex; gap: 6px; margin-top: 8px`.
- **"→ В пул" / "✓ В пуле"** (`btn-pool`).
- **"✓ Отметить"** (`btn-cadence`) — только для cadence-направлений. `border: 1px solid var(--success)`, `color: var(--success)`. Hover: `background: rgba(48,216,136,.1)`.
- **"+ Проект"** — inline creation кнопка (серая). Клик → inline input внутри карточки.

### 7.5. Inline Project Editor (внутри direction card)

Клик по проекту в списке direction → раскрывается inline editor (`dc-proj-edit`) под строкой проекта.

```
┌─────────────────────────────────────┐
│ [Title input________________]        │
│ [Видео] [Контент] [Разное]          │  ← tag chips
└─────────────────────────────────────┘
```

- `background: var(--bg-tint-1)`, `border: 1px solid var(--border-hover)`, `border-radius: var(--radius-sm)`, `padding: 8px 10px`.
- **Title input** (`dpe-title`): border-bottom only, transparent bg. Focus: `border-bottom-color: var(--accent)`.
- **Tag chips** (`dpe-tag`): `padding: 2px 8px`, `border-radius: 10px`, `border: 1px solid var(--border)`.
  - Hover: `border-color: var(--border-hover)`.
  - Active (`.on`): `border-color: var(--accent)`, `background: rgba(212,168,67,.12)`, `color: var(--accent)`.
- Toggle: повторный клик по проекту закрывает editor. Клик по другому — переоткрывает.
- Click outside → закрывает.

### 7.6. Direction Title Click

Клик по заголовку карточки (`dc-top`) → открывает Entity Popup для direction (см. §10.3). Anchor для позиционирования попапа — **вся карточка** (`dir-card`), не `dc-top`. Попап размещается справа от карточки.

### 7.7. Inline Creation: новое направление

Внизу каждой category section grid — trigger `"+ Направление"`. Клик → inline input. Категория берётся из секции. Enter / blur (при непустом) → создаёт. Escape → отмена.

### 7.8. Inline Creation: новый проект

Кнопка `"+ Проект"` в actions карточки. Клик → inline input с placeholder `"Проект для «{direction}»..."`. Создаёт проект привязанный к направлению. Дефолты: `bid: 'brd3', col: 0, cat: direction.cat`. Enter / blur (при непустом) → создаёт. Escape → отмена. Toast: `"✓ {title} → {direction}"`.

> **Общий паттерн inline creation:** во всех трёх местах (kanban §6.4, direction §7.7, project §7.8) blur при непустом поле = создание (как Enter). Escape = отмена без сохранения.

---

## 8. Экран «Горизонт»

Планирование на месяцы вперёд. Таблица проектов × месяцев + бэклог сайдбар.

### 8.1. Layout

```
┌───────────────────────────────────┬──────────────┐
│        Horizon Board (flex: 1)    │   Backlog    │
│                                   │   (260px)    │
│  Table: projects × months         │              │
└───────────────────────────────────┴──────────────┘
```

`display: flex; overflow: hidden`.

### 8.2. Horizon Board

**Toolbar**: заголовок `"Горизонт"`, `font-size: var(--fs-lg)`, `font-weight: 700`.

**Table** (`hz-grid`): `border-collapse: collapse; width: 100%`.

#### Заголовок таблицы

Колонки: `Проект` + 8 месяцев (Апр...Ноя, `MC=8`). Массив `MONTHS` содержит 9 строк (`'Апр'...'Дек'`), но цикл использует `m<MC`, поэтому Дек не показывается. Первый месяц — `"Апр · сейчас"` с классом `.current` (`color: var(--accent)`, `border-bottom-color: var(--accent)`).

- `th`: `position: sticky; top: 0; z-index: 5`, `background: var(--bg-base)`, `font-size: var(--fs-xs)`, `font-weight: 700`, `text-transform: uppercase`, `letter-spacing: .5px`, `min-width: 100px`.
- `th.name-col`: `text-align: left; padding-left: 12px; min-width: 160px`.

#### Группировка проектов

Проекты на доске группируются по размеру (`hzSize`):

| Группа | Label             | Проекты                    |
|--------|-------------------|----------------------------|
| big    | Тяжёлые проекты   | Крупные, > 20ч             |
| mid    | Средние проекты   | Средние, 5–20ч             |
| small  | Мелкие проекты    | Мелкие, < 5ч               |

**Group header row** (`hz-group-row`): кликабельный, toggle collapse. Arrow `▼`/`▶` + SVG icon + label + count.

#### Строка проекта

```
| ● Ролик про GC [👁][×] | [●Апр] [●Май] |   |   |   |   |   |   |
```

- **Name cell** (`name-cell`): dot (6×6px) + title + action buttons.
  - **Actions** (`hz-actions`): `opacity: 0`, appear on row hover.
    - **Hide** (`hz-action-btn`): eye-with-slash SVG. Перемещает в "Скрытое" в бэклоге, state сохраняется.
    - **Delete** (`hz-action-btn.danger`): × SVG. Очищает `hzData[projectId]`.
- **Month cells** (`month-cell`): `text-align: center; cursor: pointer`.
  - Клик → toggle chip в этом месяце.
  - Если проект размещён: `hz-chip` — `display: inline-block; width: calc(100% - 6px); padding: 4px 0; border-radius: var(--radius-sm); font-size: var(--fs-2xs); font-weight: 600; text-align: center; transition: all .12s; background: {color}20; color: {color}`, текст `●`. Hover: `filter: brightness(1.2)`.
  - Current month: `background: rgba(212,168,67,.02)`.
  - Hover: `background: var(--bg-tint-1)`.

#### Highlighted row

Когда проект подсвечен (hover в бэклоге или фиксированный клик):
- `td { background: rgba(212,168,67,.04) }`.
- Chips: `outline: 2px solid var(--accent); outline-offset: 1px`.
- Соответствующий элемент в бэклоге: `.hl` — `background: var(--bg-tint-2); outline: 1px solid var(--accent)`.

#### Drop row (внизу таблицы)

```
| перетащи сюда ↓ | [drop zone] [drop zone] ... |
```

- Dashed border при dragover: `border-color: var(--accent); background: rgba(212,168,67,.06)`.
- Drop → добавляет месяц в `hzData[id]`, убирает из `hzHidden` → проект автоматически попадает в секцию "Актуальное".

### 8.3. Backlog Sidebar (`hz-backlog`)

`width: 260px`, `background: var(--bg-surface)`, `border-left: 1px solid var(--border)`.

#### Header: `"Бэклог"`.

#### Динамические секции

3 секции, наполняются автоматически:

| Секция      | Label         | Icon | Filter (вычисляемый!)                      | Default collapsed |
|-------------|---------------|------|--------------------------------------------|-------------------|
| active      | Актуальное    | ●    | `hzData[id].length > 0 && !hzHidden.has(id)` | false             |
| someday     | Когда-нибудь  | ○    | `hzData[id].length === 0 && !hzHidden.has(id)` | false           |
| deferred    | Скрытое       | ⏸    | `hzHidden.has(id)`                         | true              |

> **Важно:** секции определяются **вычисляемой логикой**, а НЕ через хранимый `hzPrio`. `hzPrio` в моке объявлен, но для фильтрации бэклога не используется — это dead state. Единственный источник правды: `hzData` (есть ли месяцы) и `hzHidden` (скрыт ли).

Каждая секция кликабельная — toggle collapse.

#### Backlog Item (`hz-bl-item`)

- `display: flex; gap: 6px; padding: 4px 8px; border-radius: var(--radius-sm); cursor: grab`.
- Color bar (3px) + title + month labels (если размещён).
- Hidden items: `opacity: .6`.
- Month labels (`bl-dots`): `font-size: 8px; color: var(--accent)` — показывают названия месяцев где размещён.

**Взаимодействия:**
- Hover → подсветка строки на доске.
- Click на скрытый → восстановить (убрать из hidden).
- Click на обычный → toggle фиксированной подсветки.
- Drag → на drop row или month cell.
- `dragstart`: `setData('text/plain', projectId)`.

### 8.4. Автоматическое перемещение между секциями

Когда проект добавляется на доску (drop) → `hzData[id]` заполняется → попадает в "Актуальное".
Когда скрывается (hide) → `hzHidden.add(id)` → попадает в "Скрытое".
Когда удаляется с доски (delete) → `hzData[id]` очищается → попадает в "Когда-нибудь".

> Перемещение между секциями — **следствие изменения `hzData`/`hzHidden`**, а не записи в отдельное поле. См. §8.3 (таблица фильтров) и §11.8 (`hzPrio` не реализовывать).

---

## 9. Экран «Ревью»

Аналитика и обзор прогресса за период.

### 9.1. Layout

```
┌────────────────────────────────────────┐
│  Ревью   W18 · 27 апр — 3 мая 2026    │
│  [Неделя] [Месяц] [Год]               │
│  ┌─────┬─────┬──────┐                  │
│  │card │card │card  │  grid 3 cols     │
│  ├─────┴─────┼──────┤                  │
│  │ span2     │ card │                  │
│  └───────────┴──────┘                  │
└────────────────────────────────────────┘
```

- `flex-direction: column; overflow-y: auto; align-items: center`.
- Inner: `max-width: 900px; padding: 16px 24px`.

### 9.2. Period Tabs

3 таба: Неделя, Месяц, Год. Стиль **похож** на nav-tab, но отличается: `padding: 6px 14px` (vs nav-tab 8px 14px), default `color: var(--text-disabled)` (vs nav-tab `var(--text-tertiary)`).

### 9.3. Gauge Component

Кольцевая диаграмма SVG:
- Ring: `48×48px`, `border-radius: 50%`.
- SVG: `viewBox="0 0 48 48"`, **`transform: rotate(-90deg)`** (без этого прогресс начнётся справа, а не сверху).
- Два `<circle>`: background (`r=19`, `stroke: var(--bg-tint-1)`, `stroke-width: 5`) и progress (`r=19`, `stroke: {color}`, `stroke-width: 5`, `stroke-linecap: round`, `stroke-dasharray: 2πr ≈ 119.38`, `stroke-dashoffset: 119.38 * (1 - pct/100)`).
- Value: `position: absolute; inset: 0; display: flex; align-items: center; justify-content: center`, `font-size: var(--fs-sm)`, `font-weight: 800`.
- Title + subtitle справа.

#### Текстовые gauges (без кольца)

Для некоторых метрик (часы, количество проектов) используется «пустой» gauge — SVG без кругов, только число по центру:
- Месяц gauge 3: число часов (`font-size: 12px; color: var(--text-primary)`).
- Год gauge 3: часы (`font-size: 11px`), gauge 4: число проектов (`font-size: 14px; color: var(--accent)`).

### 9.4. Review: Неделя

Grid `3 колонки`, `gap: 10px`.

**Карточка 1 (full)** — 3 Gauges в ряд:
- Выполнение: `done_blocks / total_blocks * 100`. Цвет: ≥70% green, ≥40% yellow, <40% red.
- Пул недели: `done_pool_items / total_pool_items * 100`. Пороги: те же (70/40).
- Каденции: `ok_cadences / total_cadences * 100`. **Порог green: ≥80%** (не 70%!), ≥50% yellow, <50% red.

**Карточка 2** — Пул недели:
- Список pool items с прогрессом: `"{scheduled}/{hours}ч"`. Цвет: ≥100% green, ≥50% yellow, <50% tertiary.
- Атомарные: `✓` или `—`.

**Карточка 3** — Каденции:
- Список cadence-направлений: dot + name + `"{days}д/{cadence}д {✓/⚠}"`.
- Urgency classes.

**Карточка 4** — Время по категориям:
- Horizontal bars: label (65px) + fill bar + value.
- **По дням** — stacked bar chart, 7 колонок. Каждая — стек цветных сегментов. Высота пропорциональна часам/16.

**Карточка 5 (full)** — Направления:
- Left: measurable progress с bars.
- Right: stale projects (>14д), красным.

### 9.5. Review: Месяц

Агрегированные данные за 4 недели:
- **Gauges (full card)**: среднее выполнение (ring), каденции за месяц (ring), общие часы (текстовый gauge, не ring).
- **Weekly trend chart (`span2`)**: 4 бара (W15–W18) с %. `height: 120px` (не 100px).
- **Category month totals** (одна карточка).
- **Проекты + Направления + Каденции** — всё в **одной full карточке** с `grid-template-columns: 1fr 1fr 1fr` внутри:
  - Left: Projects — завершено/начато/в работе.
  - Middle: Direction deltas — `"{from} → {to}, +{delta}"`.
  - Right: Cadence summary — `"{ok}✓ {miss}✗"` за месяц.

### 9.6. Review: Год

Данные за год:
- **Gauges (full card)**: среднее выполнение (ring), каденции (ring), часов (текстовый, `font-size: 11px`), проектов завершено (текстовый, `font-size: 14px; color: var(--accent)`).
- **Monthly exec trend (`span2`)**: bars по месяцам. `height: 130px` (не 100px).
- **Category yearly totals** (одна карточка).
- **Итоги года (full card)** — 2 колонки: directions progress (from/to за год + delta %) + achievements list.

### 9.7. Card Layout Classes

- `.rv-card` — стандартная карточка.
- `.rv-card.span2` — `grid-column: span 2`.
- `.rv-card.full` — `grid-column: 1 / -1` (полная ширина).
- `.rv-stat` — строка key-value с разделителем.
- `.rv-bar-wrap` + `.rv-bar` — горизонтальный progress.
- `.rv-cat-bar` — строка категории: label + bar + value.
- `.rv-chart` — контейнер для bar chart. `display: flex; align-items: flex-end; gap: 6px; height: 100px` (базовый; переопределяется inline: 120px для месяца, 130px для года).
- `.rv-chart-col` — колонка чарта. `.rv-chart-bar` — стек сегментов.

---

## 10. Общие компоненты

### 10.1. Quick Add (Cmd+N)

Глобальное быстрое создание. Вызывается:
- **Cmd+N** / **Ctrl+N** — hotkey.
- **Клик по `+` в навбаре**.

#### Визуал

Overlay (`qa-overlay`): `background: rgba(0,0,0,.35)`, `padding-top: 80px`, `justify-content: center`.

Bar (`qa-bar`): `width: 520px`, `background: var(--bg-surface)`, `border: 1px solid var(--border-hover)`, `border-radius: var(--radius-lg)`, `box-shadow: 0 16px 48px rgba(0,0,0,.5)`.

```
┌──────────────────────────────────────────────┐
│  [Input: Задача...]                     [↵]  │
│  ⌘N  Тип: Задача (по контексту экрана)       │
│  ────────────────────────────────────────────│
│  ●w ●p ●l ●g ●h  |  [Задача] [Проект] [Направление] │
└──────────────────────────────────────────────┘
```

#### Авто-определение типа

Тип определяется по активному экрану:

| Экран        | Default тип  |
|-------------|-------------|
| Планирование | pool         |
| Задачи       | task         |
| Проекты      | project      |
| Контекст     | direction    |
| Горизонт     | project      |
| Ревью        | task         |

> **Ограничение мока:** тип `pool` не имеет обработчика в submit — в toggle-кнопках нет кнопки "В пул" (только Задача/Проект/Направление). Если пользователь не переключит тип, submit просто закроет overlay без создания. При реализации это поведение либо оставить as-is, либо автоматически выбирать `task` для экрана "Планирование".

#### Category Dots в Quick Add

- `20×20px`, `border-radius: 50%`, `border: 2px solid transparent`.
- Hover: `transform: scale(1.15)`.
- Selected (`.on`): **border: transparent** (не белый!), `transform: scale(1.25)`, `::after` с `✓` (10px, белый, bold, text-shadow).
- Tooltip (`data-tooltip`): позиция `bottom: calc(100% + 6px)`, `background: var(--bg-tint-2)`.
- Gap между dots: `8px`.

#### Type Toggles (`qa-opt`)

- `padding: 3px 8px`, `border: 1px solid var(--border)`, `font-size: var(--fs-2xs)`.
- Active (`.on`): `border-color: var(--accent)`, `color: var(--accent)`.

#### Submit

- **Enter** или клик по `↵` → создание.
- Пустой input → просто закрывает.

#### Inline Modifiers

- `!завтра` / `!послезавтра` / `!05.15` → deadline. Год — текущий (хардкод, в моке `2026`).
- `@work` → category (planned, не реализовано в моке).

> **Нюанс:** hint "Тип: {label}" устанавливается при открытии и не обновляется при переключении type toggle — остаётся стабильным.

#### Escape / Click outside → закрывает.

### 10.2. Category Picker Popup (`cat-popup`)

Выпадающий список категорий. Используется при клике на category dot в task bar.

- `position: fixed; z-index: 350`.
- `background: var(--bg-tint-2)`, `border: 1px solid var(--border-hover)`, `border-radius: var(--radius-md)`.
- Animation: `popIn .1s ease-out`.
- Items: `12×12px` dot + label. Hover: `background: var(--bg-tint-1)`. Active: `background: rgba(255,255,255,.05)`.
- Auto-clamp to viewport.
- Click outside → close.

### 10.3. Entity Popup (`entity-popup`)

Компактный попап для редактирования сущности. Заменяет тяжёлую detail panel.

- `position: fixed; z-index: 280`.
- `width: 260px`, `background: var(--bg-surface)`, `border: 1px solid var(--border-hover)`, `border-radius: var(--radius-lg)`, `padding: 14px`.
- `box-shadow: 0 12px 36px rgba(0,0,0,.5)`.
- Animation: `popIn .12s ease-out`.

#### Позиционирование

Зависит от типа сущности:
- **Task**: под строкой задачи (или над, если нет места). Left-aligned.
- **Project**: справа от kanban-карточки.
- **Direction**: привязан к **карточке** (`dir-card`), не к `dc-top`. Попап справа от карточки.

#### Содержимое

**Заголовок** (`ep-title`): editable input + кнопка close (×).

**Category dots** (`ep-cat-dot`):
- `18×18px`, аналогично qa-cat-dot, но `::after` с `position: absolute; inset: 0; display: flex; align-items: center; justify-content: center`.
- Gap: `8px`.

**Поля** — зависят от типа:

Для **task**:
- Категория (dots).
- Приоритет (`ep-prio`): 3 кнопки `⚡ Высокий`, `● Средний`, `○ Низкий`. Active: `border-color: var(--accent)`, `color: var(--accent)`, `background: rgba(212,168,67,.08)`.
- Дедлайн (date input).

Для **project**:
- Категория (dots).
- Тип/Доска (select).
- Направление (select с опцией "—").
- **Нет** блока `ep-actions` и кнопки "Удалить".

Для **direction**:
- Категория (dots).
- Каденция (number, дни, 0 = нет). При установке cadence=0 → `cadence: null, lastAct: null`.
- Метка каденции (text, e.g. "1×/нед").
- Цель и Текущее (только если measurable).
- **Deadline — отсутствует** в попапе (хотя поле есть в модели данных). Изменить deadline через UI нельзя.

> **Edge case:** если пользователь задаёт cadence через попап для direction, у которой `lastAct === null`, то `Math.round((TODAY - new Date(null)) / 864e5)` = NaN. При реализации рекомендуется при установке cadence автоматически ставить `lastAct = TODAY`.

**Actions** (`ep-actions`): border-top, кнопка "Удалить" (danger, красный при hover). Присутствует для **task** и **direction**, но **не для project**.

При удалении direction — каскадное отвязывание: все проекты с `dirId === deletedDir.id` получают `dirId = null`.

#### Закрытие

- Кнопка `×`.
- Click outside (с задержкой 50ms чтобы не закрылся сразу).
- Escape.

### 10.4. Toast

- `position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%)`.
- `background: var(--bg-tint-2)`, `border: 1px solid var(--border-hover)`, `border-radius: var(--radius-md)`, `padding: 8px 16px`.
- Dot (6×6px, цвет категории, fallback `'work'` если cat не указан) + текст.
- `font-size: var(--fs-xs)`, `box-shadow: 0 8px 24px rgba(0,0,0,.4)`.
- При показе нового toast — предыдущие удаляются.
- Автоскрытие через 2200ms.

### 10.5. Modal (`modal-overlay`)

Полноэкранный оверлей с центрированной модалкой. Вызывается кнопкой `+` в pool sidebar header (`poolAddBtn`).

**Ветвление по `sideTab`:**
- Если `sideTab === 'tasks'` → модалка "Новая задача" (поля: название, приоритет select, категория select, дедлайн date).
- Иначе → модалка "В пул недели" (поля: название, часы number, категория select, тип toggle Дробимый/Атомарный).

- Overlay: `background: rgba(0,0,0,.5)`.
- Modal: `width: 340px`, `background: var(--bg-surface)`, `border: 1px solid var(--border-hover)`, `border-radius: var(--radius-lg)`, `padding: 20px`.
- Кнопки: Primary (`background: var(--accent)`, `color: #000`) + Cancel.
- Toggle buttons: `border: 1px solid var(--border)`. Active (`.on`): `border-color: var(--accent)`, `color: var(--accent)`.

---

## 11. Данные

### 11.1. Категории (`CATS`)

```javascript
{
  work:   { label: 'Работа',    color: '#FF7A3D' },
  growth: { label: 'Развитие',  color: '#9B6CFF' },
  life:   { label: 'Быт',       color: '#B8D84A' },
  people: { label: 'Люди',      color: '#FF5CA8' },
  health: { label: 'Здоровье',  color: '#30D888' },
}
```

> **Примечание:** в моке используются сокращённые ключи `{ l: 'Работа', c: '#FF7A3D' }` ради компактности. При реализации использовать полные имена (`label`, `color`). Helpers `cc(k)` и `cl(k)` (§12.2) должны обращаться к соответствующим ключам.

### 11.2. Boards (Доски проектов)

```javascript
[
  { id: 'brd1', title: 'Видео',   columns: ['Идея','Сценарий','Съёмка','Монтаж','Публикация'] },
  { id: 'brd2', title: 'Контент', columns: ['Идея','Черновик','Ревью','Публикация'] },
  { id: 'brd3', title: 'Разное',  columns: ['Надо','Начал','Делаю','Почти','Готово'] },
]
```

### 11.3. Модель данных: Task

```typescript
interface Task {
  id: string;         // "t1", "t2"...
  title: string;
  cat: CategoryId;    // "work" | "life" | ...
  prio: Priority;     // "high" | "medium" | "low"
  deadline: string | null;  // ISO date "2026-04-30"
  done: boolean;
}
```

### 11.4. Модель данных: Project

```typescript
interface Project {
  id: string;         // "pr1", "pr2"...
  title: string;
  cat: CategoryId;
  bid: string;        // board ID ("brd1")
  col: number;        // column index (0-based)
  dirId: string | null;  // linked direction ID
  la: number;         // days since last activity
}
```

### 11.5. Модель данных: Direction

```typescript
interface Direction {
  id: string;         // "dir-yt", "dir-habr"...
  title: string;
  cat: CategoryId;
  // Measurable (optional)
  target: string | null;     // "55K"
  current: string | null;    // "33K"
  progress: number | null;   // 0–100
  deadline: string | null;   // ISO date
  // Cadence (optional)
  cadence: number | null;    // days between contacts/actions
  lastAct: string | null;    // ISO date of last action
  cadLbl: string | null;     // "1×/нед", "1×/2мес"
}
```

### 11.6. Модель данных: Pool Item

```typescript
interface PoolItem {
  id: string;           // "p1", "p2"...
  title: string;
  hours: number;        // estimated hours
  cat: CategoryId;
  splittable: boolean;  // true = дробимый, false = атомарный
  // Дробимый:
  scheduled?: number;   // hours already scheduled (computed)
  projectId?: string;   // linked project
  // Атомарный:
  placed?: boolean;     // computed: has blocks on grid
  // Optional:
  directionId?: string; // linked direction (when added from direction without projects)
}
```

### 11.7. Модель данных: Block (Блок расписания)

```typescript
interface Block {
  id: string;           // "b1", "b2"...
  title: string;
  day: number;          // 0-6 (Пн-Вс)
  start: number;        // minutes from midnight (e.g. 540 = 09:00)
  dur: number;          // duration in minutes
  cat: CategoryId;
  pool: string | null;  // pool item ID (null для рутин и задач перетянутых напрямую)
  done: boolean;
}
```

> **Архитектурный нюанс:** модель Block не содержит поля `week` или `date`. В моке один глобальный `blocks[]`, а `weekOffset` меняет только метки дней. При реализации с per-week storage (`schedule/2026-w18.json` из §15.3) необходимо решить, как привязывать блоки к конкретной неделе.

### 11.8. Horizon Data

```typescript
// Какие месяцы у проекта на горизонте
hzData: Record<string, number[]>  // projectId → month indices [0..7]

// Размер проекта (для группировки)
hzSize: Record<string, 'big' | 'mid' | 'small'>

// Скрытые проекты
hzHidden: Set<string>  // project IDs

// Свёрнутость групп
hzGroupCollapsed: Record<string, boolean>  // 'big'|'mid'|'small' → collapsed

// Свёрнутость секций бэклога
hzCollapsed: Record<string, boolean>  // 'active'|'someday'|'deferred' → collapsed
```

> **`hzPrio` не нужен.** В моке он объявлен и обновляется, но для фильтрации бэклога не используется. Секции определяются через `hzData` + `hzHidden` (см. §8.3). Не реализовывать `hzPrio`.

### 11.9. UI State

```typescript
let weekOffset: number = 0;
let selBlock: string | null = null;  // selected block ID
let activeBoard: string = 'brd1';
let catFilter: string | null = null;  // projects category filter
let staleFilter: boolean = false;
let sideTab: 'pool' | 'tasks' | 'projects' | 'dirs' = 'pool';
let taskFilter: { type: string; val?: string } | null = null;
let taskSearch: string = '';
let taskAddCat: string = 'life';  // default cat for task bar add
let rvPeriod: 'week' | 'month' | 'year' = 'week';
let hzHighlight: string | null = null;  // fixed highlight project ID
```

#### Генерация ID

В моке используется два глобальных счётчика: `nxtB` (для блоков, задач, проектов, направлений — все общий) и `nxtPi` (для pool items). Паттерны: `b{N}`, `t{N}`, `pr{N}`, `dir-{N}`, `p{N}`. При реализации рекомендуется UUID или префикс + счётчик по типу.

---

## 12. Утилитные функции

### 12.1. Time/Date

```typescript
fmt(minutes: number): string  // 540 → "09:00"
snap30(minutes: number): number  // round to nearest 30
clamp(value, min, max): number
daysUntil(dateStr: string | null): number | null  // дней до даты
urgClass(days: number | null): string  // null → '', d<0 → 'urgency-bad', d≤3 → 'urgency-bad', d≤7 → 'urgency-warn', else → 'urgency-ok'
cadUrgClass(over: number): string  // over>0 → 'urgency-bad', over>-3 → 'urgency-warn', else → 'urgency-ok'
```

### 12.2. Category helpers

```typescript
cc(catId: string): string  // → color string "#FF7A3D"
cl(catId: string): string  // → label string "Работа"
```

### 12.3. Pool Recalculation

```typescript
function recalcPool(): void
// Для дробимых: scheduled = sum of blocks with matching pool ID / 60
// Для атомарных: placed = any block with matching pool ID exists
```

---

## 13. Keyboard Shortcuts

| Shortcut       | Action                              |
|---------------|--------------------------------------|
| Cmd+N / Ctrl+N| Open Quick Add                       |
| Escape        | Close Quick Add / Entity Popup / Cat Picker |
| Delete        | Delete selected block on grid        |
| Backspace     | Delete selected block on grid        |
| Enter         | Submit in Quick Add / Task bar add   |

---

## 14. Seed Data

### 14.1. Блоки расписания (начальное состояние)

Рутины (на всю неделю). **Оба блока «Собаки» имеют одинаковый title `"Собаки"`** (не "утро"/"вечер"):
- **Собаки** (утро): каждый день 07:00–07:30, cat: health. Пн–Ср done.
- **Собаки** (вечер): каждый день 12:30–13:00, cat: health.
- **Японский**: Пн/Ср/Пт 08:00–08:30, cat: growth. Пн done.
- **Тренировка**: Вт/Чт/Сб 08:00–09:00, cat: health. Вт done.
- **Обед**: Пн–Пт 13:00–14:00, cat: life. Пн–Вт done.

Рабочие блоки (из пула):
- GC монтаж: Пн 09:00–11:00, Вт 09:00–10:30, Пт 10:00–11:00 (pool: p1).
- Подкаст: Ср 09:00–11:00, Чт 10:00–11:00 (pool: p2).
- Статья FB: Чт 09:00–10:30, Сб 09:00–10:00 (pool: p3).

### 14.2. Pool Items

| ID | Title                  | Hours | Cat    | Splittable | Project |
|----|------------------------|-------|--------|------------|---------|
| p1 | Ролик GC — монтаж     | 12    | work   | true       | pr1     |
| p2 | Подкаст #23            | 6     | work   | true       | pr4     |
| p3 | Статья Freedom Bank    | 4     | work   | true       | pr2     |
| p4 | Позвонить маме         | 0.5   | people | false      | —       |
| p5 | Забрать документы      | 1.5   | life   | false      | —       |

### 14.3. Tasks

12 задач, все `done: false` при старте:

| ID  | Title                  | Cat    | Prio   | Deadline    |
|-----|------------------------|--------|--------|-------------|
| t1  | Забрать документы      | life   | high   | 2026-04-30  |
| t2  | Купить билеты          | life   | high   | 2026-05-15  |
| t3  | Купить корм            | health | medium | 2026-04-29  |
| t4  | Убраться дома          | life   | medium | null        |
| t5  | Интро для подкаста     | work   | medium | null        |
| t6  | Обновить резюме        | work   | low    | null        |
| t7  | Починить кран          | life   | low    | null        |
| t8  | Ответить на комменты   | work   | low    | null        |
| t9  | Оплатить хостинг       | work   | high   | 2026-05-01  |
| t10 | Позвонить маме         | people | medium | null        |
| t11 | Поменять масло         | life   | low    | 2026-05-20  |
| t12 | Настроить бэкап NAS    | life   | medium | null        |

### 14.4. Projects

21 проект, распределённых по 3 доскам:

| ID   | Title                      | Cat    | Board | Col | DirId     | LA |
|------|----------------------------|--------|-------|-----|-----------|----|
| pr1  | Ролик про GC               | work   | brd1  | 3   | dir-yt    | 3  |
| pr16 | Ролик: Concurrency         | work   | brd1  | 1   | dir-yt    | 5  |
| pr17 | Ролик: Docker с нуля       | work   | brd1  | 0   | dir-yt    | 12 |
| pr18 | Ролик: Как я учу японский  | work   | brd1  | 0   | dir-yt    | 25 |
| pr19 | Ролик: Мой сетап 2026      | work   | brd1  | 2   | dir-yt    | 1  |
| pr20 | Ролик: gRPC vs REST        | work   | brd1  | 1   | dir-yt    | 8  |
| pr21 | Шортс: 5 фактов о Go      | work   | brd1  | 4   | dir-yt    | 7  |
| pr2  | Статья Freedom Bank        | work   | brd2  | 2   | dir-habr  | 1  |
| pr3  | Статья — путь в IT         | work   | brd2  | 1   | dir-habr  | 5  |
| pr4  | Подкаст #23                | work   | brd3  | 2   | null      | 2  |
| pr5  | VDoing — сайт              | work   | brd3  | 2   | null      | 4  |
| pr6  | Книга — Глава 1            | growth | brd2  | 0   | dir-arch  | 20 |
| pr7  | Рогалик                    | life   | brd3  | 0   | null      | 30 |
| pr8  | Digital Garden Go          | growth | brd3  | 0   | null      | 18 |
| pr9  | Планировщик                | work   | brd3  | 2   | null      | 0  |
| pr10 | Сайт подкаста              | work   | brd3  | 2   | null      | 3  |
| pr11 | Мой курс                   | work   | brd3  | 0   | null      | 45 |
| pr12 | Сайт-книга Сети            | growth | brd3  | 0   | null      | 60 |
| pr13 | Бот бусти                  | work   | brd3  | 1   | null      | 8  |
| pr14 | Книга — оглавление         | growth | brd2  | 1   | dir-arch  | 10 |
| pr15 | Lyra IDE                   | work   | brd3  | 3   | null      | 15 |

### 14.5. Directions

9 направлений:

| ID           | Title                    | Cat    | Target | Current | Progress | Deadline   | Cadence | LastAct    | CadLbl    |
|--------------|--------------------------|--------|--------|---------|----------|------------|---------|------------|-----------|
| dir-yt-subs  | 55K подписчиков YouTube  | work   | 55K    | 33K     | 60       | 2026-12-31 | null    | null       | null      |
| dir-yt       | YouTube — ролик          | work   | null   | null    | null     | null       | 60      | 2026-03-02 | 1×/2мес   |
| dir-habr     | Хабр — статья            | work   | null   | null    | null     | null       | 30      | 2026-04-10 | 1×/мес    |
| dir-tg       | ТГ — пост                | work   | null   | null    | null     | null       | 7       | 2026-04-25 | 1×/нед    |
| dir-arch     | Архитектура компьютера   | growth | null   | null    | null     | null       | null    | null       | null      |
| dir-jpn      | Японский → N3            | growth | N3     | N5      | 20       | 2027-06-01 | null    | null       | null      |
| dir-mama     | Мама                     | people | null   | null    | null     | null       | 7       | 2026-04-20 | 1×/нед    |
| dir-sasha    | Друг Саша                | people | null   | null    | null     | null       | 30      | 2026-04-05 | 1×/мес    |
| dir-weight   | Вес → 75 кг              | health | 75 кг  | 80 кг   | 50       | null       | null    | null       | null      |

### 14.6. Horizon Data

**hzData** (16 проектов на доске):
```
pr1: [0,1], pr2: [0], pr4: [0], pr9: [0,1,2], pr19: [0]
pr3: [1], pr5: [1,2], pr10: [1], pr13: [1], pr16: [1,2]
pr6: [3,4,5], pr14: [2,3], pr15: [2], pr20: [2]
pr8: [4,5], pr17: [3]
```

**hzSize** (группировка):
```
big:   pr1, pr16, pr17, pr18, pr20, pr6, pr14, pr9, pr11, pr12
mid:   pr2, pr3, pr4, pr5, pr8, pr10, pr13, pr15
small: pr7, pr21, pr19
```

**hzHidden** (начальное): пустой Set.

**hzCollapsed** (начальное): `{ active: false, someday: false, deferred: true }`.

**hzGroupCollapsed** (начальное): `{ big: false, mid: false, small: false }`.

---

## 15. Связь с существующей архитектурой (из v1)

### 15.1. Маппинг мока на Zod-схемы

Данные из мока должны быть адаптированы к Zod-схемам из `01-data-schema.md`:

- **Task** → `Entity` с `type: 'task'`, `tags: [cat]`, `priority`, `deadline`, `status: 'active'|'done'`.
- **Project** → `Entity` с `type: 'project'`, `fields.pipeline_stage` (из column name).
- **Direction** → Не имеет прямого маппинга в v1 entity types. В v2 это может быть: `Entity` с `type: 'goal'` (measurable) или `type: 'contact'` (cadence для людей) или новый тип `'direction'`.
- **Block** → `Block` в `schedule/2026-wNN.json`. `start` = minutes from midnight, `source_entity_id` = entity ID.
- **Pool Item** → Derived: entities с `status: 'active'` без блоков в текущей неделе, или явно добавленные в пул. Может потребовать отдельного хранилища `data/pool.json`.

### 15.2. Stores

| Мок State          | Zustand Store    |
|-------------------|------------------|
| blocks            | schedule.blocks  |
| tasks             | entities (type=task) |
| projects          | entities (type=project) |
| directions        | entities (type=goal/contact/direction) |
| poolItems         | pool store (новый) или derived |
| weekOffset        | schedule.currentWeek |
| selBlock          | ui.selectedBlockId |
| taskFilter        | ui.taskFilter |
| taskSearch        | ui.taskSearch |
| catFilter         | ui.catFilter |
| sideTab           | ui.sideTab |
| hzData            | horizon store (новый) |

### 15.3. File Structure

```
data/
├── config.json          # categories, pipeline_stages, preferences
├── entities.json        # all entities (tasks, projects, directions, etc.)
├── schedule/
│   └── 2026-w18.json    # blocks for week 18
├── templates/
│   └── default.json     # routine template
├── pool.json            # weekly pool state (new)
├── horizon.json         # horizon board state (new)
└── dashboards/
    └── ...
```

---

## 16. Чеклист для разработчика

При реализации каждого экрана проверь:

- [ ] Все CSS-классы совпадают с моком.
- [ ] Все transitions/анимации реализованы (не захардкожены, а плавные).
- [ ] Category dots: scale(1.25) + ✓, **без border**, **без glow**.
- [ ] Task bar: dual-mode через CSS-классы, **без моргания** при переключении. Элементы всегда в DOM.
- [ ] Поиск: реальное время, без debounce.
- [ ] Week navigation: динамические даты, не хардкод.
- [ ] Pool header: `"ПУЛ · W{N}"` обновляется при смене недели.
- [ ] Кнопка "Сегодня": текст (не точка), слева от стрелок, скрыта на текущей неделе.
- [ ] Стрелки недели: 28×28px, hover с border.
- [ ] Context headers: full-width с border-bottom. Dot → label → arrow → count (count с margin-left:auto).
- [ ] Direction days: clock icon + цветовая кодировка (fresh/normal/stale) + tooltip.
- [ ] Inline project editor (`dc-proj-edit`): tag chips, toggle. НЕ путать с `dc-unlink` на строке проекта в direction card — кнопка "Отвязать" (dc-unlink) на строке ЕСТЬ и должна быть реализована.
- [ ] Entity popup position: tasks = below, projects = right, directions = click title.
- [ ] Budget: Занято dim, Свободно bold, Пул accent, Люфт зелёный/красный.
- [ ] "Все" в фильтре проектов: текстовая кнопка с accent border когда active, без `::after` checkmark.
- [ ] Gap между dots: 8px для extras, 8px для ep-row, 10px для cat-filters.
- [ ] Horizon: drag from backlog to board, hide preserves state, dynamic sections.
- [ ] Review: 3 периода, gauges + charts + stats.
- [ ] Quick-add: auto-detect type from screen, category dots, type toggles.
- [ ] Toast: dot + text, 2.2s, bottom center. Предыдущие тосты удаляются.
- [ ] Entity Popup project: НЕТ кнопки "Удалить" (в отличие от task/direction).
- [ ] Direction delete: каскадно отвязывает проекты (`dirId = null`).
- [ ] SVG gauge: `transform: rotate(-90deg)` на `<svg>`.
- [ ] Grid scroll: обязательные обёртки `.grid-wrap` → `.grid-scroll` для скролла.
- [ ] Атомарные drag: длительность = `pi.hours * 60`, не 60.
- [ ] Horizon бэклог: секции определяются по `hzData`/`hzHidden`, не по `hzPrio`.
- [ ] Каденции urgency: отдельная формула (`over = days - cadence`), не `urgClass()`.
- [ ] Seed data: полные таблицы tasks (12), projects (21), directions (9) — см. §14.
- [ ] Detail panel (`detail-panel`, `.dp-*`, `dpSlide`, `openDetail`, `dpData`) — **legacy, не реализовывать**. Заменён на Entity Popup (§10.3).
- [ ] Kanban inline add: blur при непустом поле = создание проекта (как Enter), а не просто закрытие.
- [ ] dc-unlink: клик отвязывает проект (`dirId = null`) + toast `"Отвязано: {title}"`.
