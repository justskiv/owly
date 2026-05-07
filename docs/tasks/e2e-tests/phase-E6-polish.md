# Phase E6 — Polish (опционально)

> **Цель:** доводка после реальных прогонов в течение 1-2 недель.
> Удаление дублирующих тестов, починка flake'ов, выявленных в
> работе.
>
> **Результат после фазы:** 37 e2e-тестов стабильны под
> регулярным `task check`. `app-flow.smoke.test.tsx` удалён
> (дублирован F-2 + J-3). Любые flake-моменты, всплывшие в первых
> двух неделях работы, или зачищены, или явно `.skip` + ticket в
> Linear по noise policy.
>
> **Разделы спеки:** §11 (что не ломается),
> noise policy в README
>
> **Зависимости:** E1, E5 (нужно покрытие чтобы делать polish).
> **MVP:** нет.

## Контекст

После E5 у проекта 37 e2e-тестов плюс смок-pyramid. Реальная
ценность инфраструктуры проявляется через 1-2 недели работы:
- Какие тесты flake'ают (DnD steps мало, `clearMocks` race,
  selector сменился из-за UI-правок) — diagnose+fix вместо
  retry-loop
- Какие тесты дублируют unit (выяснилось при code review) —
  drop с ссылкой на unit-test
- Что-то в setup-browser.ts можно упростить
- Documentation drift — README phase'ов после реальных правок

E6 **не запускают сразу** после E5. Запускают когда юзер скажет:
«вижу что вот эти 2 теста за неделю упали 3 раза, давай разбирать».

`app-flow.smoke.test.tsx` (jsdom) — **удалить**. F-2 + J-3
покрывают то же самое в browser-mode. Файл оставлен в спеке
§11 как «пока остаётся, после E5 удалим».

## Ключевые решения

**Drop без апелляции.** Любой тест, который flake'ает 2 раза
подряд без продуктовой причины:
1. Упростить (убрать лишний `waitFor`)
2. Спустить уровнем (browser → jsdom → unit)
3. `.skip` + Linear ticket

Никаких retry-loop, никаких `await sleep(100)` для «надёжности».

**Нет нового feature coverage.** Если всплыло «а вот это бы тоже
тестить» — это E7+ или unit (если pure-logic). E6 — только
доводка.

**Документация — последняя.** README/phase-доки переписываем
только если в них фактическая ошибка (имя файла сменилось,
helper переименовался). Не «улучшаем формулировки».

## Реализация

### E6.1 Удалить `app-flow.smoke.test.tsx`

После E5 этот файл дублирует F-2 (Quick Add → Tasks visible) +
J-3 (persistence round-trip). Browser-mode покрытие сильнее
(реальные pointer events, реальный layout).

```sh
git rm src/test/app-flow.smoke.test.tsx
```

Прогнать `task check` — должны остаться 3 jsdom-смока (Context,
Horizon, Review). Все зелёные.

### E6.2 Flake audit

Запустить полный набор 5 раз подряд:

```sh
for i in {1..5}; do task check && echo "Pass $i" || echo "FAIL $i"; done
```

Любой тест что не зелёный 5/5 — кандидат на drop/simplify.

Типичные причины flake (из Phase 03 опыта):
- DnD `steps` слишком мало для threshold — увеличить до 7-8
- `expect.element` race с unmount — добавить `getByTestId` без
  retry-await
- `mockIPC` callback async race — проверить `clearMocks` в
  `afterEach` (должен быть после E1.15)
- Screenshot baseline drift из-за viewport size — фиксировать
  `browser.viewport: { width: 1280, height: 720 }` в
  `vitest.config.ts` если ещё не сделано

### E6.3 Selector cleanup

Если в коде накопились `data-testid` / `data-*` атрибуты,
которые **никем не используются** в тестах (например, добавили
«про запас» в E1, не использовали в E2-E5) — удалить. Помечать
их `// for E2E selector` в E1 был whitelisting; те что
не whitelisted — мусор.

```sh
# find all data-testid in source
grep -rn 'data-testid' src/ --include='*.tsx' | \
  grep -v test.tsx
# find usage in tests
grep -rn 'data-testid' src/ --include='*.test.tsx' \
  --include='*.e2e.test.tsx'
```

Diff — кандидаты на drop.

### E6.4 Documentation update

Только если в `docs/tasks/e2e-tests/phase-E*.md` есть фактические
ошибки:
- Имя test-helper сменилось
- Какой-то test исчез (заменился, спущен в unit)
- Effort actual vs estimated сильно разошлись

Обновить README.md таблицу с актуальными числами.

### E6.5 Возможные drop'ы (по факту)

Кандидаты на drop через 2 недели работы (если проявят себя как
дубли или flake-источники):

- **R-1 period tabs** — если оказался trivially-duplicating
  `useUIStore.period` setState без визуального wiring
- **C-3/C-4 inline-create direction/project** — могут
  оверлапить с T-4/Pr-5 (всё inline-create через одну
  сервис-функцию)
- **F-1 Cmd+N from any screen** — может быть избыточным
  если global keymap покрыт unit-смоком

**Не дропать про запас.** Только если за 2 недели тест:
- упал 0 раз с продуктовой причиной (не flake)
- его падение покрыто сильнее другим тестом (unit / другой
  e2e)

## Файлы

| Файл | Действие |
|---|---|
| `src/test/app-flow.smoke.test.tsx` | Удалить |
| `vitest.config.ts` | Изменить (если нужен `browser.viewport` pin) |
| `src/**/*.tsx` | Изменить (если data-testid cleanup) |
| `docs/tasks/e2e-tests/README.md` | Изменить (если числа изменились) |
| `docs/tasks/e2e-tests/phase-E*.md` | Изменить (фактические правки) |

## Верификация

1. `task check` 5 раз подряд — все зелёные.
2. `app-flow.smoke.test.tsx` отсутствует. Project `smoke-jsdom`
   показывает 3 теста (Context, Horizon, Review).
3. Если есть `.skip` тесты — каждый имеет ticket-link в
   комментарии.
4. README.md таблица отражает реальное число тестов.
5. Любой удалённый `data-testid` атрибут не используется ни в
   одном `*.test.tsx`/`*.e2e.test.tsx`.

## Заметки для реализации

- **E6 не одна сессия.** Это набор дискретных мини-правок,
  каждая = 15-30 мин. Можно делать частями, **но коммит один**
  («e2e polish» собирает все правки).
- Если за 2 недели работы flake не проявился (всё стабильно) —
  E6 = только удаление `app-flow.smoke.test.tsx` + проверка
  что тесты по-прежнему зелёные. 30 минут.
- Если flake массовый — это сигнал что E1 helpers не дотянуты
  (не E6 issue). Возможно нужен E1.5 «helper hardening» вместо
  E6 «polish».
- **Если возникнет соблазн добавить test «вот ещё бы это
  покрыть»** — стоп. Это E7+ или backlog в `docs/tasks/`. E6
  не для feature growth.
- **НЕ коммитить** до smoke от юзера.
- Возможный subject (≤50):
  ```
  test(e2e): polish and dedupe smokes
  ```
