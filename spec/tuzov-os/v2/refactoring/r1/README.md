# R1 — рефакторинг по итогам финального ревью v2

Источник — финальное массовое ревью после Phase 9 (29 независимых
проходов: 14 субагентов + 7 Gemini + 8 Codex). Здесь — только
находки, с которыми согласился человек после фильтрации
false-positive'ов.

> **Свежая Claude-сессия:** прочитай `PRE-FLIGHT.md` рядом
> ПЕРЕД любой фазой. Там — required reading list, паттерны на
> которые ссылаются фазы, workflow и анти-паттерны. Без него
> можно сделать правильную правку в неправильном месте или
> раздуть scope.

## Принцип сортировки фаз

Лёгкое всегда идёт раньше тяжёлого. Внутри сложности — сначала
важное (data-loss, security, correctness), потом косметика
(perf, maintenance, prevention). Сначала закрываем мелочи —
получаем быстрый чекин по большинству пунктов, потом беремся
за рефакторы.

| # | Файл | Что внутри | Объём |
|---|---|---|---|
| 1 | [01-easy-critical.md](phases/01-easy-critical.md) | Лёгкие + важные. Concurrency races, schema input safety, security tightening, error UX. | ~26 правок, ~6 ч |
| 2 | [02-easy-cosmetic.md](phases/02-easy-cosmetic.md) | Лёгкие + не-критичные. Documentation drift, defensive hardening, schema polish. | ~7 правок, ~2 ч |
| 3 | [03-hard-critical.md](phases/03-hard-critical.md) | Тяжёлые + важные. Cross-week cascade, command idempotency, dashboard sandbox, отсутствующие тесты. | ~5 правок, ~1 неделя |
| 4 | [04-hard-cosmetic.md](phases/04-hard-cosmetic.md) | Тяжёлые + не-критичные. Re-render normalization, store/hook splits, type-safety strict knob, watcher cache. | ~11 правок, ~2 недели |

## Workflow

Каждая фаза = отдельный план + atomic commit (или серия коммитов
по логическим группам). Smoke-тест от пользователя между группами.

1. Открыть фазу
2. Пройтись по scope сверху вниз
3. После каждой логической группы — `task check` зелёный
4. Smoke от пользователя
5. Atomic commit
6. Следующая группа / следующая фаза

## Что НЕ входит в R1

- Дизайн / UX / удобство — отдельный рефакторинг (R2+).
- Любые новые фичи сверх spec v2.
- iOS / Android / Tailwind migration / внешние интеграции.
- v1 dashboards (Cmd+Shift+D) и v1 entities (Cmd+Shift+E) — kept
  per Phase 9 D1/D2.

## Источник правды

Все находки имеют конкретные `path:line` ссылки в момент написания
(коммит `baaae5e`). Перед стартом фазы — пере-проверить, что строки
не уехали. Если пути изменились — обновить файл фазы перед
выполнением.

False-positive'ы (выкинуто из R1):
- `z.looseObject` это не Zod API (на самом деле валидный API в Zod 4)
- Deep merge для `fields` — `EntitySchema.safeParse(merged)` уже
  ловит partial, не silent loss
- `innerHTML` в ghosts — `escapeHtml` есть
- Non-portable path normalization — single-platform (macOS only)
- ScheduleStore `loadToken` race — проверено, защита корректна