# E2E-тесты для TuzovOS — план реализации

Цель — feature-by-feature покрытие через React+Chromium с виртуальной
FS поверх существующих smoke-тестов (Phase 01–04). Это не shell-level:
полный Tauri binary на macOS не автоматизируем (issue #7068),
Rust-стороной занимается Phase 04.

Полная спецификация (что почему):
[`spec/tuzov-os/e2e-tests.md`](../../../spec/tuzov-os/e2e-tests.md).

## Фазы

| # | Фаза | Результат | Тестов | MVP |
|---|---|---|---|---|
| E1 | [Foundation](phase-E1-foundation.md) | clock + virtual FS + builders + scenarios + automation lib + App.loadAll() refactor + 3 мигрированных существующих теста зелёные. ESLint guard на `new Date()`/`Date.now()`. Vitest project переименован `smoke-browser` → `e2e-browser`. | 3 (миграция) | да |
| E2 | [Plan + Tasks](phase-E2-plan-tasks.md) | `PlannerPage.e2e.test.tsx` + `TasksPage.e2e.test.tsx`. DnD-блоки, resize, week navigation, Quick Add, complete checkbox, V-1 screenshot baseline. | +12 | да |
| E3 | [Projects + Context](phase-E3-projects-context.md) | `ProjectsPage.e2e.test.tsx` + `ContextPage.e2e.test.tsx`. Kanban DnD, inline-create, edit. | +8 | да |
| E4 | [Horizon + Review](phase-E4-horizon-review.md) | `HorizonPage.e2e.test.tsx` + `ReviewPage.e2e.test.tsx`. Backlog DnD, hide, size change, period tabs, V-2 screenshot. | +5 | да |
| E5 | [Cross-screen + journeys](phase-E5-journeys.md) | F-* cross-screen flows + J-1..J-4 daily-use journeys. Команд-очередь через `__processOnePendingForTests`. Persistence round-trip с реальным `<App />`. | +9 | да |
| E6 | [Polish](phase-E6-polish.md) | Доводка flake'ующих тестов после реальных прогонов. Удаление `app-flow.smoke.test.tsx` (дублирован F-2). | 0 | нет |

После E5 цель «full E2E coverage минус 5%-shell» закрыта. E6 —
доработка по факту использования.

## Перед стартом любой фазы — обязательное чтение

1. [`CLAUDE.md`](../../../CLAUDE.md) — стиль, что НЕ делать
2. [`CODESTYLE.md`](../../../CODESTYLE.md) — анти-паттерны
3. [`spec/tuzov-os/e2e-tests.md`](../../../spec/tuzov-os/e2e-tests.md)
   — спека (это «как», README — оглавление)
4. [`docs/tasks/smoke-tests/README.md`](../smoke-tests/README.md) —
   что уже сделано (Phase 01–04)
5. `vitest.config.ts` — текущие 3 project'а
6. `Taskfile.yml` — `task check` контракт

## Перед стартом — sanity-check

```sh
task check
```

Должен быть **зелёным**. Если красное — это не задача фазы, чинить
отдельно.

## Принципиальные решения (зафиксированы в спеке)

- **`task check` = контракт.** Каждая фаза оставляет его зелёным.
- **`mockIPC` round-trip через VirtualFS** — Map-based, не stub.
  Корень = `/tuzov-test/data` (E1), не `/tuzov-test`.
- **Frozen clock = `2025-06-11T10:00:00`** (среда, ISO `2025-w24`,
  без DST). Миграция 26 callsites — часть E1.
- **Builders по типам** (`buildTask`/`buildProject`/`buildDirection`),
  не один универсальный.
- **DnD двумя путями:** `dragWithPointer` (custom hooks Plan/Pool/
  Horizon) и `dragWithDragEvent` (HTML5 для Projects kanban).
- **Service singletons reset** в `beforeEach` — `cachedDataDir`,
  `week-cache`, `command-processor.started`, `seed-migration.inflight`,
  `dashboard-hot-reload.installed`.
- **Boot через настоящий `App.loadAll()`** — refactor `App.tsx`,
  extract useEffect-IIFE в exported function.
- **Visual regression — 2 кадра**: V-1 Tasks + V-2 Review.
  Threshold `allowedMismatchedPixelRatio: 0.005`.
- **`test.concurrent` запрещён** — module-level builder counters
  race'ят под concurrent execution.
- **`@crabnebula/tauri-driver`** — фиксируется как backup-план для
  real-shell на macOS (платный). Не сейчас.

## Scope: что НЕ покрываем (manual smoke от юзера, ~5%)

- Реальный Tauri shell на macOS, native menu / global shortcut
- File watchers (`notify` крейт) — Phase 04 unit + manual fsevents
- Native file dialogs, packaging / notarization
- Performance, concurrent multi-window
- Atomic write tmp+rename — VirtualFS не моделирует, ловится Phase 04

## Принцип нарезки

- E1 блокирует ВСЕ остальные.
- E2..E5 независимы, но рекомендуется E2 → E3 → E4 → E5 — первые
  тесты проверят helpers (дешевле починить helpers чем 27 тестов).
- E5 после хотя бы одного из E2/E3/E4 (нужны фичи на которые
  ссылаются journeys).
- E6 — после E5, по факту flake'a.

## Noise policy (важно после внедрения)

E2E флакает 2 запуска подряд без продуктовой причины:

1. Упростить (убрать лишний `waitFor`, перейти на `expect.element`
   с retry-ability)
2. Спустить уровнем: e2e-browser → smoke-jsdom → unit
3. `.skip` + ticket в Linear

Никаких retry-loop-ов.

## Коммиты

Каждая фаза — **один коммит** (промежуточные внутри фазы не делаем).
По `feedback_no_commit_before_user_test.md` — не коммитить пока юзер
не прогнал `task check` сам и не дал добро.
