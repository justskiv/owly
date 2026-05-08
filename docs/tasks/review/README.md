# Test coverage gaps — после E5

Аудит покрытия от 2026-05-08 (после `a55604c chore(test): address e5
review feedback`). 4 угла обзора, источники: gemini + codex + субагенты,
по 3 на угол. Сведено в тематические файлы, дубли отсеяны, добавлены
ссылки на конкретные `file:line`.

## Состояние сейчас

- **41** теста в `e2e-browser` (Planner 11 + Tasks 5 + Projects 4 +
  Context 3 + Horizon 3 + Review 2 + quick-add 3 + popup-flow 2 +
  command-queue 3 + journeys 4 + entity-lifecycle 1)
- **4** теста в `smoke-jsdom` (app-flow + Context + Horizon + Review)
- **14** unit-тестов на `src/services/*.test.ts`
- **2** screenshot baseline'а (T-7 tasks-list, R-3 review-summary)

Дыр много: ни одного store-теста, ~30 services без unit, ~10 schemas
без unit, треть экранов без visual baseline, целые UI-компоненты
(BlockContextMenu, BlockPopup, Settings tabs) без e2e.

## Файлы

- [coverage-stores.md](coverage-stores.md) — 8 stores без прямых
  тестов
- [coverage-services.md](coverage-services.md) — ~30 services без
  unit
- [coverage-schemas.md](coverage-schemas.md) — 10 Zod схем без
  contract test
- [coverage-e2e.md](coverage-e2e.md) — UI features в коде, без e2e
- [coverage-visual.md](coverage-visual.md) — экраны без screenshot
  baseline
- [reliability-scenarios.md](reliability-scenarios.md) — отдельно:
  не coverage, а сценарии сбоев (recovery, race, atomic write)

## Принципы списка

- **Severity**: critical = data loss / agent contract; high = silent
  feature break; medium = UX papercut; low = cosmetic.
- **Effort**: trivial (<15 мин), small (15-90 мин), medium (half-day),
  large (full day).
- Каждая находка указывает `file:line` в production-коде.
- Дубли удалены (источники сводились по одному факту).

## Что НЕ в этом списке

- Тесты для тривиальных getter'ов / re-export'ов / type-only файлов
- Backwards-compat сценарии для будущих фич
- Performance / load testing — это отдельный стек инструментов
- Тесты "на случай что разработчик ошибётся" в простой логике

## Использование

Список — backlog, не план. Брать кусками по теме (один коммит = одна
тематическая группа). Перед стартом — `task check` зелёный, после —
тоже. Smoke от пользователя обязателен перед коммитом UX-правок.
