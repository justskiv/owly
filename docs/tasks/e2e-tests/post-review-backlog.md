# E2E Tests — Post-Review Backlog

Тесты, которые описаны в спеке, но отложены до соответствующей
UX-доработки. Каждая запись — что не реализовано в продукте,
поэтому тест нельзя написать без правки compponent'ов.

## P-6 — click empty cell opens BlockPopup

**Статус:** deferred (E2 → backlog).
**Спека:** `phase-E2-plan-tasks.md` §4.2.1, P-6.

`.day-body` cells (`DayColumn.tsx:60-64`) имеют только
`onPointerDown` через `<TimeBlock>` дочерние элементы — на
самой ячейке нет click handler'а. Click на пустую часть дня
ничего не открывает.

Чтобы реализовать P-6 нужна UX-доработка:

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
