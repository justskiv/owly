# E2E Tests — Post-Review Backlog

Тесты, которые описаны в спеке, но отложены до соответствующей
UX-доработки. Каждая запись — что не реализовано в продукте,
поэтому тест нельзя написать без правки компонентов.

## P-6 — click empty cell opens BlockPopup

**Статус:** deferred (E2 → backlog).
**Спека:** `phase-E2-plan-tasks.md` §4.2.1, P-6.

`.day-body` cells (`DayColumn.tsx:60-64`) имеют только
`onPointerDown` через `<TimeBlock>` дочерние элементы — на
самой ячейке нет click handler'а. Click на пустую часть дня
ничего не открывает.

Чтобы реализовать P-6 нужна UX-доработка компонента:

- Добавить `onClick` на `.day-body` (с проверкой
  `e.target === e.currentTarget` чтобы не пересекаться с click
  по блоку), вычислить `date` из `data-date` атрибута и
  `time` через `yToMinutes()` из координат event.
- Открыть `BlockPopup` через `useUIStore.openBlockPopup(...)`
  с prefilled day/time.
- Защитить от случайных кликов после drag (см. paтерн в
  `useBlockGesture.ts` для `wasDrag` флага).

После UX-правки тест из E2 спеки можно будет реализовать
1:1 (примерно 30 строк) и добавить в
`PlannerPage.e2e.test.tsx`.

## C-2 — inline edit direction title persists

**Статус:** deferred (E3 → backlog).
**Спека:** `phase-E3-projects-context.md` §4.2.4, C-2.

`DirectionCard.tsx:222-245` — `.dc-top` `onClick` вызывает
`openEntityPopup`, не превращает title в `<input>`. Inline-edit
direction title как UX-фича отсутствует — title редактируется
только через DirectionPopup (через `openEntityPopup`).

Чтобы реализовать C-2 нужна UX-доработка `DirectionCard`:

- Добавить локальный state `editingTitle: boolean`.
- Двойной клик / отдельная кнопка-карандаш → `<input>` поверх
  `.dc-title`, не открывая popup.
- onBlur/Enter → `updateEntity(directionId, { title })`.
- Esc → cancel.
- Защита от случайной активации редактора при single-click,
  который сейчас открывает popup (event guard на double vs single).

После UX-правки тест из E3 спеки можно реализовать 1:1
(~25 строк) и добавить в `ContextPage.e2e.test.tsx`.

**Альтернативный путь (если spec'у переформулировать):**
`DirectionPopup.tsx:90,220` уже редактирует title через `<input>`
с persist на blur — реализуемо как «edit direction title via
popup persists» сейчас. Но это другой UX (popup-edit ≠ inline);
менять контракт спеки без явного решения юзера не стоит. Если
inline-edit отложат надолго и persistence-регрессия для title
volume станет беспокойной — стоит-ли добавить popup-вариант
как смотровое покрытие до тех пор.

## DnD dispatch channel в `dragWithPointer`

**Статус:** cleanup (низкий приоритет, не баг сейчас).
**Источник:** review коммита 33c7e05 (Subagent B / Codex B / Gemini B).

`src/test/e2e/drag.ts:39-49` диспатчит `pointermove` и `pointerup`
на `document`. `useKanbanGesture.ts:323-324` слушает на `window`.
По DOM-spec pointer events бабблят `document → window`, поэтому
тесты Pr-4, P-3, P-4, P-10 зелёные. Риск материализуется только
если кто-то добавит `stopPropagation` посередине — production drag
тогда тоже сломается.

Fix (читаемость, не безопасность): диспатчить move/up на `window`
тоже, чтобы test-side явно совпадал с listener-side. Это
единственная правка, никаких других effects. Можно слить в
коммите рядом с другими `drag.ts` cleanup'ами.

## E4 — vitest viewport pinned to 1280×720

**Статус:** applied (deviation from E4 plan).
**Источник:** review коммита a9d70d0.

`vitest.config.ts` теперь явно ставит `viewport: { width: 1280,
height: 720 }` для browser-instances. План E4 говорил «не трогать».
Дефолтный vitest-browser viewport — 414×896 (mobile), и Horizon-grid
схлопывал month-cells до width=0 → `elementFromPoint` промахивался по
drop-target. 1280×720 — минимальный desktop размер где table layout
не ломается.

**Не сделано (defer):**

- Tauri default — 1440×900 (`src-tauri/tauri.conf.json`). Тестовый
  viewport мог бы matchить, но 1280×720 уже стабилен; смена
  invalidate'ит и TasksPage и Review baseline.
- CI parity (`*-chromium-darwin.png`) — нет CI в репо, политика по
  платформе не зафиксирована. Когда появится Linux-CI, нужно либо
  pin macOS для screenshot-тестов, либо commit per-platform.

## E4 — fonts not loaded in setup-browser

**Статус:** known limitation (low priority).
**Источник:** review коммита a9d70d0 (Codex Set 3).

`src/test/setup-browser.ts:15` импортирует только `globals.css`, а
`globals.css` references `Outfit Variable` / `JetBrains Mono Variable`
families. `src/main.tsx:3-4` импортирует `@fontsource-variable/*`
packages — в test setup их нет. Screenshot baselines рендерятся под
OS fallback fonts, не под production-faces.

Fix: добавить в `setup-browser.ts` перед `globals.css`:
```ts
import "@fontsource-variable/outfit";
import "@fontsource-variable/jetbrains-mono";
```
плюс `await document.fonts.ready` перед screenshot assertions. Это
сломает оба существующих baseline (TasksPage + ReviewPage); regen
обязателен. Не делаем сейчас — стабильны как есть.

## E4 — H-3 coverage gaps

**Статус:** documented (low priority).
**Источник:** review коммита a9d70d0.

`src/pages/HorizonPage.e2e.test.tsx:H-3` проверяет
`months.length === 1` после drop, но не закрывает:

- **Точное window-index value.** Conversion `data-month=N` →
  `state.months[]` в `useHorizonDrag.ts` хранит raw window-index.
  Покрыто unit-тестами `horizon-helpers.test.ts`.
- **Hidden→active flip.** `useHorizonDrag.ts:136-138` сбрасывает
  `hidden=false` если drop'нули скрытый проект. H-3 seed использует
  `hidden:false`, ветка не покрыта. Можно расширить тест или добавить
  отдельный H-3b сценарий «drag hidden project».
- **Empty-grid drop.** Тест seed'ит anchor-проект на доске, чтобы
  `<tbody>` не схлопывался — иначе `<tfoot>` HorizonDropRow'а имеет
  width=0 cells и `elementFromPoint` промахивается. Это тестовый
  workaround, но также реальная UX-проблема: при пустой доске
  единственный drop-target неудобен. Исправить — добавить
  `min-height` на `.hz-drop-row .month-cell` в `globals.css`.

## E4 — H-5 anchor seed limitation

**Статус:** documented (low priority).
**Источник:** review коммита a9d70d0.

`H-5` seed'ит ОДИН проект (size=mid) и проверяет переход в small.
После size-change «Средние» group остаётся пустой → её header
исчезает (HorizonBoard short-circuit на `items.length === 0`).
Это упрощает assertion (`midGroupGone: true`), но не покрывает
реальный сценарий «несколько проектов в группе, один уезжает в
другую» — там нужна проверка что только тот row перешёл.

Fix: расширить seed двумя проектами в mid-группе, проверить что
только Site refactor перешёл в small, второй остался в mid (header
mid не исчезает).

## E4 — TasksPage T-7 default comparator threshold

**Статус:** cleanup (low priority).
**Источник:** review коммита a9d70d0 (Set 3 Gemini).

`src/pages/TasksPage.e2e.test.tsx:T-7` использует default vitest
threshold для `toMatchScreenshot("tasks-list")`, в то время как
`R-3` пинит `0.005`. Font-rendering jitter может flake'нуть T-7.
Привести к одному порогу — добавить
`{ comparatorOptions: { allowedMismatchedPixelRatio: 0.005 } }` к T-7.

## Floating-promise teardown в useBlockGesture / useKanbanGesture

**Статус:** partially mitigated (тест-side, не fixed).
**Источник:** review коммитов 0d5ec73 + 33c7e05.

`useBlockGesture.ts:252-265` (move) и `useKanbanGesture.ts:182-207`
(drop) запускают финальную мутацию через `void (async () => …)()` —
fire-and-forget. Если drop на грани teardown'а теста, `afterEach`
сбрасывает сторы, а потом hanging promise проникает в следующий
тест и переписывает state нового VirtualFS.

Симптом — нестабильные drag-тесты (P-3, P-4, P-10, Pr-4) с
рандомными «поломками» на CI. В текущем прогоне тесты зелёные,
но детерминизм держится на скорости sync round-trip через
mockIPC; если IPC станет асинхронным или add'ятся новые
вычисления — поплывёт.

Возможные fix'ы (component side):
- Возвращать promise из `teardown` (хук → тест await'ит)
- Счётчик активных операций в стор → `expect.poll(...isSyncing)
  .toBe(false)` в тестах
- Переписать на синхронный path для test-mode (через
  feature-flag) — наименее предпочтительно

**Применённый тест-side mitigation (33c7e05 review):**
`src/test/setup-browser.ts` теперь делает в `afterEach`:
`cleanup()` (vitest-browser-react unmount) → `flushAllWrites()` →
`thawClock()` → `clearMocks()`. Это дренит все 5 write-queues
ДО reset и убирает leak между тестами. Не закрывает
component-side issue — если promise висит ВНЕ write-queue
(например, side effect через subscribe), всё ещё может leak'нуть.

## E5 — automation.ts ScreenName ↔ data-tab drift

**Статус:** documented (deferred).
**Источник:** review коммита d6650bc (Set 1/2 — F-8 deviation).

`src/test/e2e/automation.ts:19-25` объявляет `ScreenName = "plan" |
"tasks" | "projects" | "context" | "horizon" | "review"`, но
`TopNav.tsx:16-23` рендерит `data-tab="proj"` для `projects` и
`data-tab="ctx"` для `context`. `gotoScreen(screen, "projects")`
ищет `[data-tab="projects"]` → throws «tab not in DOM».

E5 обошёл это: F-8 переключает экраны через
`useUIStore.setState({ currentPage: "..." })` напрямую вместо
`gotoScreen` хелпера. Журналы (J-2, J-3) используют только
безопасные значения (`tasks`, `review`, `plan`).

Fix: либо привести type к real data-tab values (`"proj"`/`"ctx"`),
либо обогатить `gotoScreen` mapping `ScreenName → data-tab`. Не
делаем сейчас — затронет внешние тесты, отдельный коммит.

## E5 — F-3 trailing-space popover hack

**Статус:** documented (low priority).
**Источник:** review коммита d6650bc.

`src/test/e2e/quick-add.e2e.test.tsx:F-3` инлайнит open-Cmd+N +
type + Enter вместо `quickAdd(screen, text)` хелпера. Причина:
`!завтра` в конце ввода открывает date-picker popover, и Enter в
открытом popover'е применяет picker item, а не submit'ит форму.
Trailing space (`"... !завтра "`) закрывает popover, тогда Enter
работает как submit.

Fix: либо расширить `quickAdd(screen, text, { commit: "submit-after-
space" })`, либо UX-доработка чтобы Enter с активным валидным
date-modifier токеном submit'ил даже при открытом popover'е (Things 3
поведение). Не делаем — единственный кейс, изолирован.

## E5 — F-9 helper покрывает только happy path

**Статус:** documented (deferred).
**Источник:** review коммита d6650bc + post-d6650bc fix (delegating
to processOne).

`src/services/command-processor.ts:__processOnePendingForTests`
теперь делегирует к internal `processOne` (после ревью), значит
retry-loop, fail()-ветка и markDone fallback покрыты. НО F-9 тест
seed'ит только валидную команду — error path (corrupt JSON,
schema-rejection, executeCommand throw → файл в `failed/`) не
проверяется e2e. Полное покрытие — в unit-тестах
`command-executor.test.ts`.

Fix: добавить F-9b (corrupt JSON) + F-9c (schema-violation) если
понадобится регрессионная защита e2e уровня. Не делаем — unit
покрывает.

## E5 — F-1 не покрывает все 6 экранов

**Статус:** documented (low priority).
**Источник:** review коммита d6650bc.

`src/test/e2e/quick-add.e2e.test.tsx:F-1` тестирует Cmd+N только из
`horizon` и `review`. Spec §4.3 говорит «from any screen». Listener
живёт в `Shell.tsx` (global, page-agnostic), поэтому 2 экрана
ловят регрессию unbinding'а. Page-specific focus traps или input
handlers могут перехватывать Cmd+N — они не покрыты.

Fix: расширить F-1 параметризацией по 6 страницам через `test.each`,
устанавливать `currentPage` через `useUIStore.setState`. Не делаем —
F-1 уже ловит главный класс регрессии.
