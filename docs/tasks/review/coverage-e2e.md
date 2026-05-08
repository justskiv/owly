# E2E — UI features без e2e-теста

UI-компоненты и flows, которые существуют в коде, видны пользователю,
но не покрыты ни одним e2e-тестом. Сгруппировано по продуктовой теме.

## Quick Add

### E-1 — Cmd+1/2/3 type switch (task/project/direction)
- **File**: `src/components/quick-add/QuickAdd.tsx:179-194`
- **Severity**: high
- **Effort**: trivial
- **Что**: F-3 covers только task с deadline. Cmd+digit
  переключает тип создаваемой сущности — регрессия отправит
  всё в `task` независимо от выбора.

### E-2 — Category dot click → tags persistence
- **File**: `src/components/quick-add/QuickAdd.tsx:265-273`
- **Severity**: high
- **Effort**: trivial
- **Что**: dot button `qa-cat-dot` устанавливает category;
  submit без категории → shake. Регрессия mis-tags все
  созданные сущности.

### E-3 — Popover (autocomplete) Tab/Enter/Arrow keys
- **File**: `src/components/quick-add/QuickAdd.tsx:123-150`,
  `src/components/quick-add/QuickAddPopover.tsx`
- **Severity**: high
- **Effort**: small
- **Что**: F-3 явно обходит popover trailing-space hack.
  Нужен тест: open popover → arrow nav → Enter applies item.

### E-4 — Date picker keyboard navigation
- **File**: `src/components/quick-add/QuickAdd.tsx:153-178`
- **Severity**: medium
- **Effort**: small
- **Что**: arrows ±1/±7 days, Enter commits, Esc closes
  picker (не overlay).

### E-5 — Esc layering: closes popover before overlay
- **File**: `src/components/quick-add/QuickAdd.tsx:57`,
  `:144-149`
- **Severity**: high
- **Effort**: small
- **Что**: первый Esc закрывает popover, overlay остаётся;
  второй Esc закрывает overlay. Регрессия закроет всё на
  первый Esc.

### E-6 — Quick Add создание project и direction
- **File**: `src/services/quick-add-create.ts:23-55`
- **Severity**: high
- **Effort**: small
- **Что**: e2e сейчас только для type=task. Project и
  direction имеют другие default fields.

### E-7 — defaultType из page (TYPE_BY_PAGE)
- **File**: `src/store/ui.ts:500-502`
- **Severity**: medium
- **Effort**: trivial
- **Что**: per-page Quick Add trigger использует
  page-specific тип. Cmd+N global ignores defaultType.

## Planner DnD

### ~~E-8~~ — Drag entity из Tasks side-tab → planner — applied
- **File**: `src/hooks/useBlockGesture.ts:336-352`,
  `src/components/planner/pool/PoolTabTasks.tsx`
- **Severity**: critical
- **Effort**: small
- **Что**: отдельная ветка от pool-item drag. Создаёт block
  с `source_entity_id`, `pool_item_id: null`. P-10 и J-1
  только pool-item.

### ~~E-9~~ — Drag block: end-of-day boundary — applied
- **File**: `src/hooks/useBlockGesture.ts:111-117`
- **Severity**: critical
- **Effort**: small
- **Что**: drop с `min + duration > END_HOUR*60` отвергается.
  Off-by-one в `yToMin` snap делает last legal slot
  un-droppable или wrap past midnight.

### ~~E-10~~ — Drag: invalid drop (above/below day-body) — applied
- **File**: `src/hooks/useBlockGesture.ts:104`, `:231`
- **Severity**: critical
- **Effort**: small
- **Что**: drop вне `.day-body` → no-op. Регрессия может
  silently move/create block в неправильном слоте.

### E-11 — Placed atomic pool item — нельзя dup-drag
- **File**: `src/components/planner/pool/PoolTabPool.tsx:79`,
  `src/hooks/useBlockGesture.ts:316`
- **Severity**: high
- **Effort**: small
- **Что**: pool item с `placed=true` не должен создавать
  второй block. Регрессия double-counts atomic work.

### E-12 — Drag block назад в Pool (`pool-actions` "→ В пул")
- **File**: `src/components/planner/pool/PoolTabTasks.tsx:120`,
  `PoolTabContext.tsx:187`
- **Severity**: high
- **Effort**: small
- **Что**: per-tab buttons "→ В пул" перемещают entity в
  pool. Не покрыто.

### E-13 — Stale pool-week guard
- **File**: `src/components/planner/PoolSidebar.tsx:36-49`
- **Severity**: high
- **Effort**: medium
- **Что**: schedule week ≠ pool week → drag из старого пула
  в новую неделю должен быть no-op (orphan `pool_item_id`).

## Planner — Block UX

### E-14 — BlockContextMenu (right-click меню)
- **File**: `src/components/planner/BlockContextMenu.tsx:51-78`,
  `:194-228`
- **Severity**: high
- **Effort**: medium
- **Что**: целое меню без e2e — done/skipped/duplicate/delete +
  keyboard shortcuts (D/S/Enter/⌫). J-2 явно обходит UX через
  store.updateBlock.

### E-15 — BlockContextMenu viewport edge clamping
- **File**: `src/components/planner/BlockContextMenu.tsx:70-89`
- **Severity**: medium
- **Effort**: small
- **Что**: измерение + clamp menu внутри viewport. Регрессия
  кладёт меню под правый/нижний край.

### E-16 — BlockContextMenu category change
- **File**: `src/components/planner/BlockContextMenu.tsx:269-292`
- **Severity**: medium
- **Effort**: trivial
- **Что**: area dots `role="radio"` меняют category блока.

### ~~E-17~~ — BlockPopup unmount-flush draft — applied
- **File**: `src/components/planner/BlockPopup.tsx:122-175`
- **Severity**: critical
- **Effort**: small
- **Что**: cleanup на unmount flush'ит title/start/duration/notes
  drafts. Outside-click без blur — edits должны сохраниться.

### E-18 — BlockPopup: edit time/duration/title persistence
- **File**: `src/components/planner/BlockPopup.tsx`,
  `src/components/planner/BlockEditor.tsx:99-108`
- **Severity**: medium
- **Effort**: small
- **Что**: edit UX existing block. `parseHHMMStrict` reject
  invalid times (toast + не save).

### E-19 — Drag planned block: keyboard-DnD / cancellation
  via Cmd+N
- **File**: `src/hooks/useBlockGesture.ts`
- **Severity**: critical
- **Effort**: medium
- **Что**: pressing Cmd+N во время DnD — должен cancel drag
  и убрать ghost из DOM.
- **Status**: deferred. Production-кода для этого нет:
  Shell.tsx:73 на Cmd+N только toggle-ит QuickAdd, useBlockGesture
  не подписан на ui store, кроме unmount-cleanup. Это **пропуск
  фичи**, не coverage gap — тест без implementation бессмыслен.
  Перед написанием теста добавить subscribe в useBlockGesture
  на `quickAdd.open` flip → `teardown("cancel")`.

## WeekNotFoundDialog

### E-20 — Создание пустой недели / из шаблона
- **File**: `src/components/planner/WeekNotFoundDialog.tsx:50-78`,
  `src/services/week-manager.ts`
- **Severity**: high
- **Effort**: small
- **Что**: J-4 явно pre-creates `2025-w23` чтобы избежать
  dialog. Сам dialog с `silentCreate: true` не покрыт.

### E-21 — Esc routes to current-week (не just close)
- **File**: `src/components/planner/WeekNotFoundDialog.tsx:35-38`
- **Severity**: medium
- **Effort**: small
- **Что**: Esc вызывает `goToCurrent()`, не просто
  `setPrompt(null)`. Иначе loop при следующей мутации.

## Tasks / Projects / Context / Horizon

### E-22 — Tasks filters: priority / overdue / week / done
- **File**: `src/pages/TasksPage.tsx:56`
- **Severity**: medium
- **Effort**: trivial
- **Что**: T-2 covers только category. Остальные filter
  branches без e2e.

### E-23 — Tasks inline add (TaskBar — отдельный путь от Cmd+N)
- **File**: `src/components/tasks/TaskBar.tsx:27`, `:113`,
  `:162`
- **Severity**: high
- **Effort**: small
- **Что**: click "+" → autofocus → category picker (portalled)
  → Enter submit. Esc/click-outside exits without duplicate.

### E-24 — Project popup: edit board/direction/category
- **File**: `src/components/entities/popup/ProjectPopup.tsx:60`,
  `:69`, `:83`
- **Severity**: high
- **Effort**: small
- **Что**: Pr-6 проверяет только что popup открылся с
  правильным проектом. Edit handlers (setCategory/setBoard/
  setDirection) не покрыты.

### E-25 — Direction popup: cadence + delete cascade
- **File**: `src/components/entities/popup/DirectionPopup.tsx:207`
- **Severity**: high
- **Effort**: medium
- **Что**: cadence/last_act updates, deleteCascade с linked
  projects (см. S-1). C-2 (inline edit direction title) тоже
  не покрыт.

### E-26 — Direction cadence + togglePool в PoolTabContext
- **File**: `src/components/planner/pool/PoolTabContext.tsx:61`,
  `:79`
- **Severity**: high
- **Effort**: medium
- **Что**: `markCadence` обновляет `last_act`; `togglePool`
  имеет 4 ветки (existing direction / linked-existing /
  no-linked / freshest). Сложная логика без покрытия.

### E-27 — Horizon: hidden→active при drop, no-duplicate на
  existing month
- **File**: `src/hooks/useHorizonDrag.ts:130-136`
- **Severity**: high
- **Effort**: small
- **Что**: H-3 covers backlog→grid happy path. Hidden item
  при drop → `hidden=false`; drop на existing month —
  `months.length` не растёт.

### E-28 — Project create/delete syncs Horizon backlog
- **File**: `src/App.tsx:155-181`, `src/store/horizon.ts`
- **Severity**: high
- **Effort**: medium
- **Что**: subscription mirrors entities → horizon. Project
  delete должен убирать backlog item.

## Settings

### E-29 — AreasTab: add / edit / delete + orphan warning
- **File**: `src/components/settings/AreasTab.tsx:25-58`
- **Severity**: high
- **Effort**: medium
- **Что**: единственный путь мутировать `config.areas`. При
  delete in-use area — soft warning toast, orphan tags
  остаются. Регрессия может corrupt tag taxonomy.

### E-30 — SchedulingTab rapid edits race
- **File**: `src/components/settings/SchedulingTab.tsx:23`
- **Severity**: high
- **Effort**: medium
- **Что**: каждое поле `void set*()` без debounce. Rapid
  multi-field edits в Areas+Scheduling+Pipeline могут
  потерять или stale-write config.

### E-31 — PipelineTab: add / move / remove + usage count
- **File**: `src/components/settings/PipelineTab.tsx:14-46`
- **Severity**: medium
- **Effort**: small
- **Что**: stage moves через swap, remove с usage count
  warning. Drift в pipeline_stages поломает Kanban.

### E-32 — Settings modal: focus trap + первый-tab autofocus
- **File**: `src/components/settings/SettingsModal.tsx:26-33`
- **Severity**: medium
- **Effort**: small
- **Что**: focus moves на первый tab при mount; Tab/Shift+Tab
  wraps внутри dialog; Esc закрывает + restoreFocus на
  trigger.

## Command queue UI

### ~~E-33~~ — Failed command lands in CommandsLogPanel — applied
- **File**: `src/services/command-processor.ts:206-262`,
  `src/store/commands.ts`
- **Severity**: critical
- **Effort**: small
- **Что**: F-9 covers только pending → done. Schema-rejection,
  parse failure, execute failure — целая ветка не покрыта.

### ~~E-34~~ — Retry button: failed/ → pending/ — applied
- **File**: `src/components/commands/FailedCommandRow.tsx:60-77`,
  `src/store/commands.ts:131`
- **Severity**: critical
- **Effort**: small
- **Что**: единственный recovery path для агентского клиента.
  `retryBlocked` для partial-batch failures.

### E-35 — Done log: dismiss / clearAllDone
- **File**: `src/components/commands/DoneCommandRow.tsx:29`,
  `src/components/commands/CommandsLogPanel.tsx:97`
- **Severity**: high
- **Effort**: small
- **Что**: F-9 проверяет только что done file существует.
  Чтение/dismiss/clear UI не покрыт.

## Cross-cutting

### E-36 — Cmd+N работает на всех 6 экранах + ignored в
  editable
- **File**: `src/components/layout/Shell.tsx:29`, `:79-83`
- **Severity**: medium
- **Effort**: trivial
- **Что**: F-1 covers только Horizon и Review. Toggle
  behavior (Cmd+N когда уже открыт → close) тоже не покрыт.

### ~~E-37~~ — Entity lifecycle (create→edit→archive→delete) — applied
- **File**: `src/components/entities/EntityEditor.tsx:184`,
  `:254`, `:371`
- **Severity**: critical
- **Effort**: medium
- **Что**: EntityEditor вообще без e2e. Весь destructive
  lifecycle path только в коде.

### E-38 — Modal focus restore on close (Settings, Dashboards)
- **File**: `src/components/dashboards/AddDashboardModal.tsx:24`,
  `RenameDashboardModal.tsx:27`,
  `ConfirmDeleteDashboard.tsx:27`
- **Severity**: medium
- **Effort**: small
- **Что**: `useRestoreFocus` возвращает focus на trigger
  после close. Регрессия strands keyboard users на `<body>`.

## Заметки

- Самая жирная категория — Quick Add (7 пунктов): F-2 + F-3 + J-3
  покрывают happy path с deadline, остальные ветки слепые.
- BlockContextMenu и BlockPopup — целые компоненты без e2e (5
  пунктов суммарно). Это самый "невидимый" провал покрытия —
  Plan-screen есть e2e для рендеринга, но нет ни одного для
  edit UX.
- Settings (3 tabs) полностью без e2e — phase-E5 удалил route
  upon discovery, что Settings открывается через store, не Shell
  route. Тесты надо строить через `useUIStore.openSettings()`.
