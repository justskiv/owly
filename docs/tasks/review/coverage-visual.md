# Visual baselines — coverage gaps

Сейчас в проекте 2 screenshot baseline'а:
- T-7 — TasksPage tasks-list (`src/pages/TasksPage.e2e.test.tsx:141`)
- R-3 — ReviewPage review-summary week
  (`src/pages/ReviewPage.e2e.test.tsx:123`)

Все остальные layout-dense экраны без visual coverage. CSS-drift,
spacing/typography регрессии, неправильный порядок элементов — silent.

Тесты дешёвые (используют существующие `setup*` helpers, формат
известен по R-3 с `comparatorOptions: { allowedMismatchedPixelRatio:
0.005 }`).

## Список

### V-1 — PlannerPage week grid
- **File**: `src/pages/PlannerPage.tsx:215`,
  `src/components/planner/WeekGrid.tsx:61`
- **Severity**: high
- **Effort**: trivial
- **Что**: самый сложный layout — week grid + pool sidebar +
  now-line + day headers. Существующий `setupPlanner` помогает.
- **Selector**: `[data-screen="plan"]`
- **Дополнительные состояния**: empty week (без блоков),
  selected block, drag in progress.

### V-2 — Review month period
- **File**: `src/pages/ReviewPage.e2e.test.tsx`,
  `src/components/review/MonthCards.tsx:151`
- **Severity**: high
- **Effort**: trivial
- **Что**: R-3 covers только week. Month layout полностью
  отдельный (другой набор cards, "Выполнение по неделям").
- **Selector**: `[data-screen="review"]` после `setRvPeriod("month")`.

### V-3 — Review year period
- **File**: `src/components/review/YearCards.tsx:176`
- **Severity**: high
- **Effort**: trivial
- **Что**: год — третья отдельная вёрстка ("Выполнение по
  месяцам").
- **Selector**: `[data-screen="review"]` после `setRvPeriod("year")`.

### V-4 — ProjectsPage Kanban full board
- **File**: `src/pages/ProjectsPage.tsx:57`,
  `src/components/projects/Kanban.tsx:50-68`
- **Severity**: high
- **Effort**: trivial
- **Что**: board-bar + summary-bar + 5 columns. CSS-drift на
  column widths, card layout, `kanban-col-head` invisible.
- **Selector**: `.kanban` с seeded mix of projects across 3
  columns.

### V-5 — HorizonPage board + backlog
- **File**: `src/pages/HorizonPage.tsx:51-76`
- **Severity**: high
- **Effort**: small
- **Что**: two-pane layout (table grid + sidebar backlog с
  тремя секциями). `.hz-grid`, `.hz-backlog`, `.bl-section`
  drift не ловится smoke-тестом.
- **Selector**: `[data-screen="horizon"]` с seeded mix:
  один project per size group, один per backlog section.

### V-6 — ContextPage DirectionGrid
- **File**: `src/components/context/DirectionCard.tsx`,
  `CategorySection.tsx`
- **Severity**: medium
- **Effort**: trivial
- **Что**: rich layout per area (multiple directions,
  projects per direction). C-1 только counts cards.
- **Selector**: `[data-screen="context"]` с минимум 2 areas.
- **Дополнительные состояния**: hover peek, collapsed section.

### V-7 — Quick Add states (popover / picker / conflict)
- **File**: `src/components/quick-add/QuickAdd.tsx:220`,
  `QuickAddPopover.tsx:38`, `QuickAddDatePicker.tsx:50`
- **Severity**: medium
- **Effort**: small
- **Что**: token highlights, conflict shake, popover open,
  date picker open — каждое состояние отдельно. Текущие
  e2e не делают screenshot.
- **Selector**: `.quick-add-overlay` или `[role="dialog"]`.

### V-8 — Empty states all screens
- **File**: `src/pages/*.tsx`,
  `src/components/context/CategorySection.tsx`,
  `src/components/projects/Kanban.tsx`
- **Severity**: medium
- **Effort**: small
- **Что**: первый запуск без данных — все 6 экранов должны
  rendering placeholder copy. Регрессия в "no data" branch
  показывает blank screen.
- **Тип**: e2e-browser visual + smoke-jsdom для render-only.

### V-9 — DashboardsPage
- **File**: `src/pages/DashboardsPage.tsx:57`
- **Severity**: low
- **Effort**: medium
- **Что**: debug-only screen (Cmd+Shift+D), но всё ещё
  shipped UI. Compile/runtime error states + add/rename/delete
  modals.
- **Заметка**: defer, debug-only.

### V-10 — PlannerPage NowLine position
- **File**: `src/components/planner/NowLine.tsx`,
  `minutesToY` math
- **Severity**: low
- **Effort**: trivial
- **Что**: NowLine position зависит от `minutesToY`. Drift
  classic UI papercut.
- **Тип**: visual baseline на FROZEN_NOW=10:00.

## Заметки

- Все `setup*` helpers (setupPlanner, setupHorizon, setupReview,
  setupContext, setupTasks) уже существуют в e2e файлах.
- Используем `comparatorOptions: { allowedMismatchedPixelRatio:
  0.005 }` (parity с R-3) для font-rendering jitter tolerance.
- Viewport уже pinned на 1280×720 в `vitest.config.ts` (E4
  deviation).
- Baseline-файлы пишутся в `src/pages/__screenshots__/<test>.tsx/`
  при первом запуске — нужен ручной review перед commit.
