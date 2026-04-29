# TuzovOS v2 — план реализации

Этот документ — обзор разбиения новой спецификации
(`spec/tuzov-os/v2/spec.md`) на фазы реализации. Каждая фаза —
законченная и тестируемая поверх рабочего приложения. Внутри фазы
не делаем промежуточных коммитов; коммит — после полного
прохождения чек-листа фазы и smoke-теста от пользователя.

## Стартовый контекст

Текущее состояние проекта (фазы v1 1–6 закрыты):

- 3 страницы (`PlannerPage`, `EntitiesPage`, `DashboardsPage`),
  навигация — `Sidebar` (5 кнопок) + `Header`.
- Zustand stores: `ui`, `schedule`, `entities`, `config`,
  `dashboards`, `commands`.
- Zod-схемы: `Entity` (`task | project | routine | event | contact
  | goal | note | metric`), `Block`, `Command`, `WeekFile`,
  `ConfigFile`, `Template`, `Dashboard`.
- Хранилище: JSON-файлы в `data/` (`entities.json`,
  `schedule/YYYY-wNN.json`, `templates/`, `dashboards/`,
  `commands/{pending,done,failed}/`).
- Существующий Planner: drag/resize блоков, inline-create, context
  menu, hotkeys, NowLine, недельная навигация.
- AI: команды через файловую очередь.
- Сохранены принципы из `done/00-overview.md`: файлы — источник
  истины, UI тупой, AI снаружи, теги вместо папок.

## Что меняет v2

Спека `spec.md` описывает **полную перестройку UX** поверх той же
файловой основы:

- Глобальная навигация — **Top Navigation Bar** (40px) с шестью
  табами (Планирование, Задачи, Проекты, Контекст, Горизонт,
  Ревью), week navigation справа, кнопка `+` (Quick Add).
- Новый экран **«Задачи»**: dual-mode task bar, группировка по
  deadline, sidebar-фильтры.
- Новый экран **«Проекты»**: kanban по доскам, фильтры категорий,
  inline-create в колонках.
- Новый экран **«Контекст»**: направления (новый тип сущности!),
  сетка карточек по областям, inline-edit проектов внутри карточки.
- Новый экран **«Горизонт»**: таблица проекты × месяцы + бэклог
  с динамическими секциями.
- Новый экран **«Ревью»**: 3 периода (неделя/месяц/год), gauges +
  charts из реальных данных.
- **Quick Add** (`Cmd+N`) — глобальное создание любой сущности.
- **Entity Popup** — компактный попап редактирования, заменяет
  тяжёлую Detail Panel.
- Полная переработка **Planner** + **Pool Sidebar** с четырьмя
  табами и бюджетом.

### Что **не** меняется

- **Цветовая схема приложения**. У нас уже есть тёмная тема и
  своя палитра в `src/styles/globals.css` — она остаётся. Спека
  v2 декларирует свою палитру в §2.1, но **берём из неё только
  токены, которых ещё нет** (например, `--bg-tint-2` отдельно от
  `--bg-tint-1`, если их нет). Цвета категорий в `config.json`
  тоже остаются (юзер настроил).
- Принципы хранения и архитектуры — JSON-файлы, Zod-схемы,
  Zustand stores, Tauri-команды, AI-очередь.
- Persist-first паттерн (`done/post-review-backlog.md` H1).
- Нативный menu bar, hotkeys на `e.code`, focus-trap.
- Боот-перцепция (`done/loading-perception.md`).

### Авторитет источников

При расхождениях:

1. **`spec/tuzov-os/v2/spec.md`** — основной источник правды.
2. **`spec/tuzov-os/v2/pool-planner-demo-v2.html`** — визуальный
   референс. Юзер предупредил: код в моке писан тяп-ляп, есть
   косяки. Принципы дизайна — берём, имплементацию — чистим.
3. **`done/01-data-schema.md`** — текущая Zod-модель v1, не
   ломаем без необходимости.
4. **`done/00-overview.md`** — глобальные принципы. Не меняем.

## Список фаз

| # | Фаза | Что появляется | Можно потыкать |
|---|------|----------------|----------------|
| 1 | **Foundation v2** | Top Nav, 6 табов, Direction-сущность, новые stores и схемы для pool/horizon, миграция seed | Переключение табов, на 5 — заглушки, Plan — старый planner |
| 2 | **Quick Add + Toast v2** | `Cmd+N` overlay с категориями и тогглами типов, inline-modifiers (`!завтра`), новый Toast | Cmd+N работает на всех экранах, создаёт task/project/direction |
| 2.5 | **Quick Add polish** | Spotlight-якорь, segmented control, autocomplete popover на `!` с inline date picker'ом, live-подсветка модификаторов в input'е, preview-строка | Quick Add по уровню Raycast/Linear; ввод `!` открывает popover, дата подсвечивается на лету |
| 3 | **Экран «Задачи»** | TasksPage (Task Bar, группы, sidebar, поиск, фильтры), Entity Popup | Полнофункциональный экран Tasks |
| 4 | **Экран «Проекты»** | ProjectsPage (Kanban, board tabs, cat-filter, inline-create), drag-drop карточек | Полнофункциональный экран Projects |
| 5 | **Экран «Контекст»** | ContextPage (карточки направлений, проекты внутри, каденции), inline editor проекта | Полнофункциональный экран Context |
| 6 | **Planner v2 + Pool Sidebar** | Перестроенный Plan: грид 07–23, новый Pool sidebar с 4 табами, бюджет, drag-to-grid | Новый главный экран целиком |
| 7 | **Экран «Горизонт»** | HorizonPage (таблица проекты × месяцы, бэклог), drag из бэклога, hide/delete | Полнофункциональный экран Horizon |
| 8 | **Экран «Ревью»** | ReviewPage (3 периода, gauges, charts из реальных данных) | Полнофункциональный экран Review |
| 9 | **Cleanup + AI integration** | Удаление legacy, расширение command-processor для direction/pool/horizon | Прибранный код, агент пишет во все домены |

## Зависимости фаз

```
Phase 1 (Foundation)
   ├── Phase 2 (Quick Add)
   │      └── Phase 2.5 (Quick Add polish) ─┐
   │                                         ├── Phase 3 (Tasks) ───┐
   │                                         ├── Phase 4 (Projects) ┤
   │                                         └── Phase 5 (Context) ─┤
   │                                                                ├── Phase 6 (Planner+Pool)
   │                                                                ├── Phase 7 (Horizon)
   │                                                                └── Phase 8 (Review)
   │
   └── Phase 9 (Cleanup) — после всех остальных
```

Phase 2.5 — рекомендуется до Phase 3, потому что Tasks-экран будет
интенсивно использовать Quick Add, и без полировки overlay это
будет некомфортно. Технически 2.5 не блокирует 3 — можно пропустить
и закрыть позже.

Phase 1 — обязательна первая (закладывает навигацию, типы,
storage). Phase 2 — обязательна перед 3, 4, 5 (Entity Popup и
Quick Add там используются). Phases 3–5 — независимы между собой,
порядок выбираем по удобству; рекомендуется 3 → 4 → 5 (нарастает
сложность). Phase 6 опирается на 3–5 (использует данные tasks /
projects / directions для табов пула). Phases 7 и 8 — независимы
от 3–6 функционально, но опираются на наличие сущностей.

## Что считается «фаза готова»

- Все пункты «Acceptance criteria» в файле фазы выполнены.
- `task check` (typecheck + vitest + frontend build) проходит.
- Юзер прошёл smoke-сценарий из «Тест-плана» в браузере или через
  `npm run tauri dev`.
- Есть запись в memory о принципиальных решениях (если они были).
- Только тогда — коммит. Промежуточных коммитов внутри фазы нет.

## AI command schema по фазам

Текущая command-schema (`src/schemas/command.ts`) — discriminated
union по `action`. Расширение распределяется по фазам:

| Фаза | Что добавляется в command schema |
|------|----------------------------------|
| 1 | Ничего нового. `create_entity { type: "direction" }` работает «из коробки» через расширенный `EntitySchema` (discriminated union пропускает новый тип) |
| 2–5 | Ничего. UI пишет через store, AI пишет через существующие `create_entity / update_entity / delete_entity` |
| 6 | `create_pool_item / update_pool_item / delete_pool_item`. Поле `pool_item_id` в `BlockSchema` — расширение `blockUpdatableFields` для `create_block / update_block` |
| 7 | `set_horizon_months / set_horizon_hidden / set_horizon_size` |
| 8 | Ничего (Review derive-first, ничего не пишется) |
| 9 | Опционально: `mark_cadence` как alias для `update_entity`. Финальная сверка handlers |

Принцип: AI command-side готов **в той же фазе**, где появляется
домен, не откладывается в фазу 9. Это значит, что после Phase 6
агент уже может писать pool-команды; после Phase 7 — horizon-
команды.

## Решения, действующие во всех фазах

- **Direction — отдельный entity type** (не маппинг на goal /
  contact). Имеет свой `DirectionFieldsSchema` (см. `01-…`).
- **Pool — отдельный store + JSON-файл** (`data/pool.json`).
  Старый «pool как derived из entities» сохраняется как seed-стратегия
  (вычисляемые pool items из активных task/project), но текущая
  неделя имеет явное хранилище в `pool.json` со своими полями
  (hours, splittable, scheduled, projectId, directionId).
- **Horizon — отдельный store + JSON-файл** (`data/horizon.json`).
- **Старые типы `routine | event | contact | goal | note | metric`**
  не удаляем. Они просто не показываются на новых экранах. Старая
  EntitiesPage / DashboardsPage сохраняется как «debug»-вход через
  hotkey (Cmd+Shift+E / Cmd+Shift+D), без ссылки в Top Nav.
  Решение об их финальной судьбе — в фазе 9.
- **Категории = области.** В моке `CATS` (5 штук: work, growth,
  life, people, health). У нас в `config.json` категории
  настраиваются юзером (`AreaSchema`). v2 не хардкодит CATS — он
  читает `config.areas`. Если в config'е больше или меньше пяти
  областей, экраны должны корректно работать (адаптивные сетки,
  не падать).
- **Все цвета берём из `config.areas[*].color`**, а не из спеки.
  Палитра спеки (FF7A3D и т.д.) приведена справочно — её
  игнорируем.
- **Семантические CSS-классы** из `globals.css`. Tailwind
  утилитами в компонентах не пользуемся (как в текущем коде).
  Новые классы добавляем в `globals.css`.
- **Persist-first**. Каждая мутация — сначала запись на диск, потом
  set в store. Уже работает в текущих stores, новые stores того же
  паттерна.

## Файлы фаз

- `01-phase-1-foundation.md`
- `02-phase-2-quick-add.md`
- `02.5-phase-2.5-quick-add-polish.md`
- `03-phase-3-tasks.md`
- `04-phase-4-projects.md`
- `05-phase-5-context.md`
- `06-phase-6-planner-and-pool.md`
- `07-phase-7-horizon.md`
- `08-phase-8-review.md`
- `09-phase-9-cleanup.md`
