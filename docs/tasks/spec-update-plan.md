# Обновление спек под новый дизайн — рабочий план

> **Цель файла:** шпаргалка для себя (Claude) на случай, если диалог
> компактится посреди работы. Здесь весь контекст и решения, чтобы
> можно было продолжить с любого места.

## Контекст задачи

Пользователь начал проект TuzovOS (Tauri v2 + React + TS, локальное
приложение на JSON-файлах). Фаза 1 реализована в коде (schemas,
stores, services, pages — базовые заглушки, загрузка/сохранение JSON
работает). После фазы 1 пользователь понял, что дизайн плохо
проработан, и ушёл дорабатывать его отдельно.

Сейчас в `design/` лежит:
- `tuzov-os-design-spec.md` — **финальная дизайн-спека** (токены, экраны)
- `tuzov-os-design-mock.html` — **референс-реализация** (1011 строк,
  готовая вёрстка + JS-логика всех интеракций)
- `tuzov-os-design-mock-original.html` — историческая версия до ревью
- `design_review.md` — глубокое ревью старого дизайна
- `refactoring_tasklist.md` — чеклист правок (бо́льшая часть уже
  применена в актуальном моке)
- `favicon-assets/` — готовые иконки + Tauri-интеграция (есть даже
  `dynamic_icon.rs`)

**Задача:** обновить все 6 фаз спеки (+ overview / data-schema /
architecture) так, чтобы они учитывали новый дизайн и функционал,
которые добавились вместе с дизайном.

**Что НЕ делаем:** код в `src/` и `src-tauri/` не трогаем — это
отдельная работа после фиксации спек.

## Источники правды (приоритет сверху вниз)

1. `design/tuzov-os-design-spec.md` — UI-система, токены, экраны
2. `design/tuzov-os-design-mock.html` — реальное поведение, CSS,
   параметры интеракций
3. `spec/tuzov-os/01-data-schema.md` — схемы данных (дополняем, не
   переписываем)
4. `spec/tuzov-os/00-overview.md`, `02-architecture.md` — общий
   стек/архитектура (точечные правки)

## Решения пользователя (зафиксировано)

1. **CSS стратегия:** пока переносим **голый CSS как в моке**. В
   `docs/tasks/tailwind-migration.md` — отложенная задача на
   миграцию. Новый CSS (если появляется) пишем на Tailwind, голый
   CSS допустим только где Tailwind проблематичен.
2. **Тип `event`:** решаю сам как профи. → **Оставляем в данных
   как 9-й тип.** Вкладку-фильтр не добавляем (мок и так без неё —
   событие доступно через «Все» и через планировщик). Причина:
   `event` имеет обязательные `date/time/duration` и свою
   семантику, которую задача не покрывает.
3. **Derived state vs stored:** решаю сам. →
   - Routine.week_done → **считаем на лету** из schedule/*.json по
     source_entity_id + block.status
   - Metric.change / change_pct / avg_growth → **derived** из
     history
   - Metric.linked_goal_id → **stored** (user-configurable связь,
     добавляем в MetricFieldsSchema как nullable)
   - Contact.topics (чеклист тем) → **stored**, добавляем в
     ContactFieldsSchema
   - Contact.contact_history (лог встреч/звонков) → **stored**,
     добавляем в ContactFieldsSchema
4. **Favicon:** статика в фазу 1 (просто положить PNG/ICNS из
   `design/favicon-assets/tauri/icons/` в `src-tauri/icons/` и
   обновить `tauri.conf.json`). **Динамическая иконка** —
   отдельная задача в `docs/tasks/dynamic-favicon.md`.
5. **refactoring_tasklist.md — не трогаем.** Все D-пункты (empty
   states, backlinks, loading/error, responsive, onboarding,
   объединение типов) игнорируем.
6. **D1 (объединение типов)** — не делаем.

## Ключевые расхождения старой спеки и нового дизайна

### Палитра и токены — полностью переделаны
- Фон: было `#0F172A` (slate-900), стало шестиступенчатый нейтральный
  серый `#131313 / #1A1A1A / #222 / #2B2B2B / #353535 / #3F3F3F`
- Текст: 5 токенов (`primary / secondary / tertiary / disabled /
  inverse`), никаких inline-hex
- Акцент: было `#3B82F6` (синий), стало `#E0B860` (золото) —
  **только** для selected/now/CTA
- Категории (разведены после ревью):
  - `work #FF7A3D · people #FF5CA8 · life #B8D84A · growth #9B6CFF
    · health #30D888`
- Шрифты: Outfit + JetBrains Mono (конкретно)
- Полные шкалы радиусов, font-size, opacity, spacing (4px-grid),
  motion, elevation, layout — см. дизайн-спеку

### Новые UX-решения (которых не было в спеке фаз)
- Sidebar 52px, OS-логотип, золотой индикатор `::before` на active
- Status bar (26px снизу) — **есть уже в фазе 1-2**, не только в 6
- Week summary stacked bar в header + Balance bar в каждом day-header
- Now-линия золотая + особое состояние `.tb.now` (55% заливки)
- Inline-создание блока при клике на пустую ячейку (не модалка)
- Hover affordance: 2px полоска work слева на пустой ячейке
- DnD-параметры: threshold 5px, resize-зона 8px, grab-offset, snap 30
  (не 15), createElement+append (не innerHTML+=)
- Overlap: `dashed --error` + ⚠
- ctx-меню на блоке с цветными кружками (смена категории)
- Focus-visible + helper `makeClickable(el)`
- Хоткеи: 1/2/3, Esc, N, T, D, S, Delete, Enter, Ctrl+↑/↓

### Экран Entities — почти переделан
- 3-колоночный layout: Фильтры 180 · Список 380 · Detail flex (max
  480)
- 8 вкладок-фильтров по типу (без «События»)
- Priority pills HIGH/MEDIUM/LOW
- Type-specific detail-виджеты (новое):
  - **Проект:** pipeline done/current/future + чеклист глав +
    прогресс-бар
  - **Рутина:** stat-cards + streak-неделя (7 квадратов) + GitHub-
    style heatmap 26 недель
  - **Контакт:** status-widget (кольцо + countdown), «на этой
    неделе» с заливкой категории, чеклист тем с hover-×, история
    контактов, важные даты
  - **Цель:** goal-block, stat-footer (тип/темп/прогноз),
    связанные метрики, sparkline SVG
  - **Метрика:** 36px mono + стрелка + bar chart 6 мес с gradient
    opacity + stat-footer
  - **Заметка:** мини-рендерер h1/h2/p/li/cb/hr + `--note-accent` в
    цвет первой категории

## План работы по файлам

### Статус: 🔲 в очереди · 🟡 в работе · ✅ готово

### 🔲 00-overview.md — лёгкая правка
- [ ] Добавить раздел «Дизайн» со ссылками на design/*
- [ ] Обновить стек: Outfit + JetBrains Mono
- [ ] Подчеркнуть: HTML-мок — референс-реализация, CSS/селекторы
  можно тянуть из него 1-в-1
- [ ] Уточнить: Tailwind в бэклоге, пока голый CSS

### 🔲 01-data-schema.md — добавки к сущностям
- [ ] Обновить `ContactFieldsSchema`:
  - Добавить `topics: Array<{text, done}>` (чеклист тем)
  - Добавить `contact_history: Array<{date, note}>` (история
    контактов)
- [ ] Обновить `MetricFieldsSchema`:
  - Добавить `linked_goal_id: string | null` (ссылка на goal)
- [ ] Обновить `GoalFieldsSchema`:
  - Добавить `linked_metric_ids: string[]` (обратная связь на
    метрики)
- [ ] Обновить сэмпл в `data/config.json`: новые цвета категорий
  (work `#FF7A3D`, people `#FF5CA8`, life `#B8D84A`, growth
  `#9B6CFF`, health `#30D888`)
- [ ] Обновить приоритеты: убрать цвета из config
  (priority-цвета теперь в дизайн-системе, не в пользовательских
  данных)? — **Оставлю как есть**, не усложняю. Цвета в config
  можно переиспользовать для UI.
- [ ] Добавить заметку: `week_done / change / change_pct /
  avg_growth` — **не хранятся**, считаются на лету в сервисах

### 🔲 02-architecture.md — структура UI + токены
- [ ] Переписать раздел «UI: Общая структура» — grid из мока
  (52px sidebar, 26px status bar, status bar всегда)
- [ ] Добавить раздел «Дизайн-токены» — ссылка на design-spec
  + короткий перечень `:root` CSS-переменных
- [ ] Уточнить дерево компонентов: добавить StatusBar, Shell
  управляет активной страницей через `ui.currentPage`
- [ ] Добавить подраздел «Стилизация»: пока голый CSS в
  `globals.css`, миграция на Tailwind — отложено (см.
  `docs/tasks/tailwind-migration.md`)
- [ ] Service layer — добавить упоминания:
  - `services/routine-stats.ts` — derive streak/rate/weekDone
  - `services/metric-stats.ts` — derive change/change_pct/trend

### 🔲 03-phase-1-foundation.md — переписать раздел «Дизайн»
- [ ] Удалить старую палитру (slate-900, blue-500, rounded-lg,
  flat)
- [ ] Заменить блок «Дизайн» ссылкой на design-spec с кратким
  списком токенов (только то, что нужно для фазы 1)
- [ ] Shell структура из мока: sidebar 52px, status bar 26px
- [ ] Подключение Outfit + JetBrains Mono (Google Fonts `<link>`)
- [ ] Favicon: ассеты из design/favicon-assets/tauri/icons/ →
  src-tauri/icons/, поправить tauri.conf.json
- [ ] Обновить конфиг сэмпл + сэмпл в scripts/seed.ts (цвета)
- [ ] Вынести в bottom: «CSS пока голый, Tailwind — отложено» (с
  ссылкой на docs/tasks/tailwind-migration.md)
- [ ] Status bar заглушка с «Сохранено ✓» и счётчиком сущностей —
  уже в фазе 1 (до фазы 6 расширяется)

### 🔲 04-phase-2-weekly-grid.md — капитально переписать
- [ ] Конкретные параметры: 06:00–23:00, row-h=40px, time-w=44px,
  snap=30 мин, min block=30 мин
- [ ] Структура: day-headers с balance bar, grid-scroll, week
  summary в header
- [ ] Рендер-алгоритм из мока: minToY, yToMin, fmtTime, fmtDur,
  hasOverlap
- [ ] Блоки: без левой полоски, заливка 35/45/55%, states done/
  skipped, overlap dashed red + ⚠
- [ ] Current-block (через now-линию) = 55% заливки + bold title
- [ ] Now-линия: золотая 2px с точкой слева, демо-константа пока
  (`setInterval` → отложено до фазы 6 или позже)
- [ ] Inline-создание: клик → инлайн-инпут, Enter создаёт
  (дефолт work), Escape отменяет
- [ ] Hover affordance на пустой ячейке (2px полоска work слева)
- [ ] Контекстное меню + цветные кружки для смены категории
- [ ] Модалка блока: 400px, backdrop-blur, поля Название/Начало/
  Длит/День/Область/Заметки, Enter=save, Esc=close
- [ ] Хоткеи: 1/2/3, N, T, D, S, Delete, Enter, Ctrl+↑/↓, Esc
- [ ] Status bar + toast стили из мока
- [ ] Критерии готовности обновить

### 🔲 05-phase-3-dnd-and-pool.md — параметры DnD и пул
- [ ] Параметры: threshold 5px, grabOffX/grabOffY, resize 8px,
  snap 30
- [ ] Drop-target детект: `cy - r.top` без двойного scrollTop
- [ ] Ghost `.drag-ghost` + snap-preview `.snap-preview` + dur-
  tooltip при resize
- [ ] Pool 264px: структура, группировка по priority, поиск,
  cоздание через createElement+append
- [ ] Focus-visible + makeClickable
- [ ] Collapse по T

### 🔲 06-phase-4-entities-and-templates.md — радикально переписать
- [ ] 3-колоночный master-detail
- [ ] Фильтры: 8 по типу, 5 по области (с точками), 2 по статусу
- [ ] Priority pills HIGH/MEDIUM/LOW
- [ ] Список `erow`: иконка + title + badge + теги + meta
- [ ] Детали для каждого типа сущности (с точными классами из
  мока):
  - task: badges + чеклист + описание
  - project: pipeline + чеклист глав + описание
  - routine: stat-cards + streak-week + heatmap
  - contact: status-widget + this-week + topics + contact-history
    + important-dates
  - goal: goal-block + stat-footer + linked-metrics + sparkline
  - metric: metric-val + bar-chart + stat-footer
  - note: renderer h1/h2/p/li/cb/hr + `--note-accent`
- [ ] Empty state detail-панели
- [ ] TemplateEditor — сохраняется, но под новую стилистику
- [ ] Carry-over в пуле
- [ ] Settings (базово): области, шаблон, пайплайн

### 🔲 07-phase-5-dashboards.md — обновление стилистики
- [ ] Grid карточек 200×130px: иконка + title + description
- [ ] Dashed «+ Добавить»
- [ ] CSS-переменные из новой дизайн-системы доступны внутри
  дашбордов (обновить список)
- [ ] Props + runtime-компиляция через sucrase — без изменений

### 🔲 08-phase-6-ai-integration.md — лёгкая правка
- [ ] Status bar **расширяется** (в фазе 1 уже был) — добавляются
  счётчики команд + ошибок
- [ ] Toast-стили из мока
- [ ] Settings «AI-планирование» — стиль из дизайна
- [ ] Scheduling preferences UI — без изменений

## Открытые вопросы / на принятие решений позже

- Нужна ли отдельная страница Settings (полная) или достаточно
  модалки? В моке есть только иконка шестерёнки, без реализации.
  Отложу до фазы 4 — на текущем этапе задокументирую как «страница
  с табами» и не буду углубляться.
- Template editor — оставляем мини-сетку как в старой спеке. Дизайн
  его не прорабатывал → переиспользуем стилистику WeekGrid в
  компактном режиме.

## Порядок выполнения

1. Создать отложенные задачи в `docs/tasks/` (Tailwind, dynamic
   icon)
2. 00-overview → лёгко
3. 01-data-schema → добавки
4. 02-architecture → структура + токены
5. 03-phase-1 → переписать дизайн-раздел
6. 04-phase-2 → капитально
7. 05-phase-3 → обновления DnD
8. 06-phase-4 → радикально
9. 07-phase-5 → лёгко
10. 08-phase-6 → лёгко
11. Пройтись по всему, проверить консистентность
12. Показать пользователю итог

## Что НЕ трогать

- Код в `src/` и `src-tauri/`
- `data/*.json` (кроме `config.json` — цвета категорий)
- `scripts/seed.ts` — можно коснуться цветов, но контент сэмплов
  сохранить
- `design/*` — это источник правды, только читаем
- `refactoring_tasklist.md` — пользователь сказал игнорить

## Финальная проверка перед сдачей

- [ ] Все спеки ссылаются на design/tuzov-os-design-spec.md
- [ ] Нет упоминаний старых цветов (`#0F172A`, `slate-900`,
  `blue-500`)
- [ ] Нет упоминаний старой палитры категорий (Tailwind-цвета)
- [ ] Везде Outfit + JetBrains Mono как шрифты
- [ ] Каждая фаза ссылается на соответствующие части
  дизайн-спеки и мока
- [ ] Критерии готовности каждой фазы синхронизированы с тем, что
  в моке
- [ ] Tailwind помечен как «отложено», голый CSS — текущая база