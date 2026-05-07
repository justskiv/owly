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

## Floating-promise teardown в useBlockGesture

**Статус:** open (флак-риск, не покрыт тестами).
**Источник:** review коммита 0d5ec73.

`useBlockGesture.ts:252-265` (move) и аналогично resize/pool-drop
запускают финальную мутацию через `void (async () => …)()` —
fire-and-forget. Если drop происходит на грани teardown'а теста,
`afterEach` сбрасывает сторы, а потом hanging promise проникает
в следующий тест и переписывает state нового VirtualFS.

Симптом — нестабильные drag-тесты (P-3, P-4, P-10) с
рандомными «поломками» на CI. В текущем прогоне тесты зелёные,
но детерминизм держится на скорости sync round-trip через
mockIPC; если IPC станет асинхронным или add'ятся новые
вычисления — поплывёт.

Возможные fix'ы:
- Возвращать promise из `teardown` (хук → тест await'ит)
- Счётчик активных операций в стор → `expect.poll(...isSyncing)
  .toBe(false)` в тестах
- Переписать на синхронный path для test-mode (через
  feature-flag) — наименее предпочтительно

Тест-only mitigation: в setup-browser добавить
`afterEach(async () => { await flushAllWrites(); })` — это
дренит все чейны до сброса. Дешёвый шаг, можно сделать
отдельным коммитом.
