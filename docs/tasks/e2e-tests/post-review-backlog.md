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
