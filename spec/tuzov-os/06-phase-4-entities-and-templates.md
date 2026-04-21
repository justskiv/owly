# Фаза 4: Entities + Templates + Week Lifecycle

> **Цель:** полноценное управление сущностями (master-detail с
> виджетами по типу), шаблон рутинной недели, переход между
> неделями, базовые настройки.
>
> **Результат:** страница «Сущности» показывает 3-колоночный
> master-detail: фильтры · список · детали. Для каждого типа —
> свой виджет в detail-панели (pipeline для проектов, heatmap для
> рутин, status-widget для контактов, sparkline для целей, bar
> chart для метрик, mini-MD для заметок). Новая неделя создаётся
> из шаблона. Settings-страница редактирует области и пайплайн.
>
> **Предусловие:** фазы 1–3 завершены.

## Контекст

Прочитай `01-data-schema.md` (все типы сущностей с полями + раздел
«Вычисляемые поля») и `02-architecture.md` (структура `src/
components/entities/` и `src/services/`).

**Референс:**
- `design/tuzov-os-design-spec.md`, раздел «Экран 2 — Сущности
  (Master-Detail)»
- `design/tuzov-os-design-mock.html`, селекторы `.ent-content`,
  `.ent-filters`, `.ent-list`, `.erow`, `.edp`, `.edp-head`,
  `.edp-sec`, функции `renderEnt()`, `showEntDetail()`,
  `genHeatmap()`, `genStreakWeek()`, `genSparkline()`; массив `EN`
  с реальными сэмплами для всех типов

Мок — источник правды по структуре каждого виджета. Переносим в
React-компоненты без потерь (классы, разметка, числовые
параметры).

---

## Часть 1. Layout страницы

```
┌───────────── hdr (48px) ─────────────────────────────────────┐
│ Сущности   [🔍 поиск..]                       [+ Создать ▾]  │
├──────────┬───────────────┬────────────────────────────────────┤
│          │               │                                    │
│ Filters  │  List         │  Detail panel                      │
│ 180px    │  380px        │  flex (max-width 480 на секции)    │
│          │               │                                    │
│  Тип     │  ┌─────────┐  │  ┌─────────────┐                   │
│  ● Все   │  │ 📋 ...  │  │  │ Title       │                   │
│  ○ Задачи│  │ work·hi │  │  │ tags        │                   │
│  ...     │  └─────────┘  │  │ badges      │                   │
│          │  ┌─────────┐  │  ├─────────────┤                   │
│  Область │  │ 📁 ...  │  │  │ секция 1    │                   │
│  [ work ]│  └─────────┘  │  ├─────────────┤                   │
│  [people]│               │  │ секция 2    │                   │
│  ...     │               │  ├─────────────┤                   │
│          │               │  │ ...         │                   │
│  Статус  │               │  ├─────────────┤                   │
│  [active]│               │  │ Ред.  Удал. │                   │
│          │               │  └─────────────┘                   │
└──────────┴───────────────┴────────────────────────────────────┘
```

`.ent-content` — flex-row, дочерние колонки. В header: заголовок
«Сущности», поле поиска `.search-input` (260×32px), кнопка `«+
Создать»` (`.hdr-btn`).

---

## Часть 2. Фильтры (EntityFilters)

Колонка `.ent-filters` шириной 180px. Три секции `.fs`:

### По типу (8 опций)

| Метка | Тип данных | Иконка |
|---|---|---|
| Все | — | — |
| 📋 Задачи | `task` | 📋 |
| 📁 Проекты | `project` | 📁 |
| 🔄 Рутины | `routine` | 🔄 |
| 👤 Контакты | `contact` | 👤 |
| 🎯 Цели | `goal` | 🎯 |
| 📈 Метрики | `metric` | 📈 |
| 📝 Заметки | `note` | 📝 |

**Важно:** отдельной вкладки для `event` нет — события в
данных остаются (тип не удаляется), но в UI доступны через «Все».
Это осознанное решение из дизайн-спеки: под 1 событие отдельный
фильтр избыточен, а семантика события пересекается с блоком
расписания.

### По области (5 опций)

Цветная точка `.fdot` + название: Work / People / Life / Growth /
Health. Клик — toggle фильтра по tag. Можно выбрать несколько
(OR-логика).

### По статусу (3 опции)

Active · Someday · Done. По умолчанию показываем Active + Someday;
Done скрыты, но можно включить.

### Визуал опции

- `.fo` — padding 4px 8px, `--fs-md`, `--text-secondary`
- Счётчик `.fc` справа — mono, `--text-tertiary`
- Active: `color: var(--accent)`, `background: rgba(224,184,96,.1)`
- Hover: `color: var(--text-primary)`, `background: var(--bg-tint-1)`
- Кастомная div-опция `.fo` делаем фокусируемой через
  `makeClickable`

Счётчики в `.fc` считаем на лету из `entities.filter(...)`.

---

## Часть 3. Список (EntityList)

Колонка `.ent-list` шириной 380px, вертикальный скролл.

Каждая строка `.erow`:
- `.er-icon` (30×30, `--radius-lg`, background `--bg-tint-1`) —
  иконка типа (📋/📁/🔄/👤/🎯/📈/📝/📅)
- `.er-body`:
  - `.er-top`: `.er-title` (title `--fs-md` 500) + priority pill
    `.er-badge` справа
  - `.er-meta`: цветные теги `.er-tag` (точка `.td` + текст) +
    meta-инфо `.er-info` (mono, tertiary) — первое: deadline
    или первое слово из sub

**Priority pills (важно — не бейдж-текст, а настоящая pill):**

| Приоритет | Цвет текста | Фон |
|---|---|---|
| HIGH | `#e06878` (`--error`) | `rgba(224,104,120,.15)` |
| MEDIUM | `#c78a3a` (горчичный) | `rgba(199,138,58,.15)` |
| LOW | `#707070` | `var(--bg-tint-2)` |

Это не `--accent` и не случайные цвета — система из мока (см.
константы `PC`, `PCbg`, `PL`).

Клик на `.erow` → снять `.selected` со всех, поставить на эту
строку → вызвать `showEntDetail(id)`.

---

## Часть 4. Detail-панель

`.edp` — flex-колонка справа, `overflow-y: auto`, фон `--bg-
surface`. Ограничение ширины секций: `max-width: 480px` (на `.edp-
head`, `.edp-sec`, `.edp-actions`).

### Empty state

`.edp-empty` — иконка `📋` (или `.lucide-FileText`) opacity 15%,
текст «Выбери сущность для просмотра деталей» (`--fs-md`,
`--text-disabled`).

### Шапка (общая для всех типов)

`.edp-head`:
- `.edp-title` — `--fs-xl` 600
- `.edp-tags` — цветные pill-теги (`background: color + 22%`,
  `color: category color`)
- `.edp-type` — ряд бейджей:
  - `.edp-type-badge` — иконка + название типа, `background:
    --bg-tint-2`, `--text-tertiary`
  - `.edp-status` (Active зелёный / Someday серый)
  - `.er-badge` priority pill (если есть)
  - `.edp-deadline` (`📅 до 18 апр`, серый; при просрочке:
    `.overdue` → красный текст + `rgba(224,104,120,.1)` фон)

### Actions (общие)

`.edp-actions` — снизу, `margin-top: auto`:
- `.edp-btn.edp-btn-p` «Редактировать» — золотая primary
- `.edp-btn.edp-btn-d` «Удалить» — red outline

---

## Часть 5. Виджеты detail-панели по типам

Все виджеты — из мока, функция `showEntDetail(idx)`. Разметка —
точная, переносим в React-компоненты.

### Task

- Шапка с badges
- `.edp-sec` «Заметки»: `.edp-desc` (свободный текст)
- `.edp-sec` «Чеклист (N/M)»: progress bar `.edp-pbar` +
  `<ul class="edp-cl">` с `<li>` + `.edp-chk` (checkbox) +
  текст. `.done`: `.checked` на чекбоксе, `--text-tertiary` +
  strikethrough на тексте. Checked-чекбокс — зелёный
  (`--success`)

### Project

Всё что у task, **плюс**:
- `.edp-sec` «Стадия»:
  - `.pipe-current` — `--fs-md` 600, название текущей стадии
  - `.pipeline` — ряд `.pipe-col`. Каждая:
    - `.pipe-bar` — 4px полоска
    - `.pipe-name` — название стадии мелким шрифтом
    - Классы: `.done` (серый `--text-tertiary`), `.current`
      (золотой `--accent` opacity .6 + bold name), `''` (будущее,
      `--text-disabled`)
  - Стадии: research / production / editing / review /
    publishing / done (из `config.pipeline_stages`, русифицируются
    через мэп: Ресёрч / Продакшн / Монтаж / Ревью / Публик. / Готово)
- Чеклист «глав» — обычный `.edp-cl`

### Routine

- Шапка с tags + frequency в sub
- `.edp-sec` «Текущая серия»:
  - `.stat-row` из 3 `.stat-card`:
    - Стрик (`.stat-num` зелёным `--success` с «дн.»)
    - Выполнение (`%`)
    - Частота (`daily`, `3x/week` — из `routine.frequency`)
  - `.streak-week`: 7 `.streak-day` квадратов 36×36:
    - `.done` — зелёный фон `rgba(48,216,136,.25)`
    - `.today` — золотая рамка `1.5px var(--accent)`
- `.edp-sec` «Активность (6 месяцев)»:
  - `.heatmap-wrap` с вложенной структурой: месяцы сверху (14px
    строка), дни-label слева (Пн/Ср/Пт каждые 2 строки), сетка
    26 недель × 7 дней
  - `.hm-cell` 11×11px:
    - Пустая — `var(--bg-tint-2)`
    - `.l1/.l2/.l3/.l4` — прогрессия зелёного `rgba(48,216,136, 0.15/.3/.5/.75)`
  - `.hm-legend` снизу: «Меньше» + 5 ячеек + «Больше»

**Источники данных:**
- streak, rate, weekDone, heatmap — вычисляются на лету
  `src/services/routine-stats.ts`, на основе блоков из всех
  доступных недель с `source_entity_id === routine.id` и
  `status === "done" | "skipped"`

### Contact

- Шапка с name + cadence в sub
- `.edp-sec` «Статус» (status-widget):
  - `.ct-status` — horizontal flex, gap 16px, padding 16px,
    background `--bg-tint-1`, `--radius-lg`
  - `.ct-ring` — 40×40 круг с 2.5px border. `.ok` (зелёный `--
    success`), `.overdue` (красный `--error`), ✓ или !
  - `.ct-status-text`:
    - `.ct-status-title` — «Через N дн.» / «Просрочено на N дн.»
      (`--fs-md` 600, `--text-primary`; при overdue — `--error`)
    - `.ct-status-sub` — «Последний: 6 апр · каждые 7д»
  - `.ct-countdown` справа:
    - `.ct-cd-num` — 24px mono 600, зелёный / красный
    - `.ct-cd-label` — «дн. до» / «дн. назад»
- `.edp-sec` «На этой неделе» (если есть блоки с этим контактом в
  текущей неделе):
  - `.ct-week-item` — inline-bg цвета категории контакта (pink
    для people или orange для work — зависит от `contact.tags[0]`)
  - `.ct-week-day` (Пн/Вт/...), `.ct-week-title` (название ·
    время), `.ct-week-dur` (длительность mono)
- `.edp-sec` «Чеклист (N/M)» — темы (`contact.topics`):
  - `.ct-cl-item` — checkbox `.edp-chk` + текст `.ct-cl-text`
    + hover-кнопка `.ct-cl-x` (× справа, появляется на hover)
  - `.done` — tertiary + strikethrough
  - Клик на item → toggle done. Клик на × → убрать topic из
    массива
- `.edp-sec` «История контактов» — `.ct-item` строки:
  - `.ct-dot` (цветная точка pink), `.ct-date` (mono, tertiary,
    фикс 50px), текст `.n`
- `.edp-sec` «Важные даты» — `.ct-date-item`:
  - Иконка 🎂/💐/🤝 (большая 16px), `.ct-date-label` (слева),
    `.ct-date-val` (mono, справа)
  - **Без фонового бокса** — только hover-подсветка

**Источники:**
- `overdue_days` / `next_in_days` — из `contact.last_contact` +
  `desired_cadence_days` (`src/services/contact-stats.ts`)
- «На этой неделе» — фильтр блоков текущей недели по `source_
  entity_id === contact.id`

### Goal

- Шапка
- `.edp-sec` с `.goal-block`:
  - `.goal-nums` — current (28px mono 600) vs target (`--fs-lg`
    tertiary, правее)
  - Прогресс-бар — `.edp-pbar` с `height: 8px`, `--radius-sm`
    (переопределяет дефолтные 6px из чеклистов)
  - `.goal-sub` — «60% · осталось 22K · дедлайн 31 дек 2026»
- `.edp-sec` с `.stat-footer`:
  - 3 колонки: Тип цели / Темп / Прогноз
- `.edp-sec` «Связанные метрики» (если есть `linked_metric_ids`):
  - `.ct-link-item` — кликабельная строка:
    - Иконка метрики + название слева + значение справа (mono)
    - Transparent фон; hover — `--bg-tint-2`
    - Стрелка `→` справа — opacity 0 → 1 на hover
- `.edp-sec` «Динамика»:
  - SVG sparkline 300×70px (см. `genSparkline` в моке)
  - Оси Y (мин/среднее/макс) и X (месяцы)
  - Точки `.dot` + `.dot-last` (больше)
  - `.grid-line` горизонтали, `.grid-v` вертикали
  - Цвет линии = цвет первой категории (`CAT_COLORS[goal.tags[0]]`)

### Metric

- Шапка
- `.edp-sec` с заголовком:
  - `.metric-val` — **36px** mono 600, текущее значение
  - `.metric-change` — `↑ +1,500 за последний месяц (+4.8%)`
    (зелёный) или `.down` (красный ↓)
- `.edp-sec` «Тренд (6 мес.)» — bar chart:
  - `.bar-chart` — flex с gap 4px, высота 120px
  - `.bar-col` — одна колонка: значение сверху (`.bar-val`
    mono), spacer, fill `.bar-fill` (цвет категории, gradient
    opacity от 0.35 до 1.0 по возрастанию), label месяца снизу
  - Высоты баров — пропорционально `(v - baseV) / range * chartH`,
    где `baseV = minV - spread * 0.25` (не с нуля — показать
    изменения чётче)
- `.edp-sec` с `.stat-footer`:
  - Единица / Ср. рост / Связанная цель

**Источники:**
- `change`, `change_pct`, `avg_growth` — из `metric.history`
  (`src/services/metric-stats.ts`)
- `linked_goal` — читается из `metric.linked_goal_id`, резолвится
  в goal.title

### Note

- Шапка без priority
- `.edp-sec` с `.note-body` (единый бокс):
  - Background `rgba(255,255,255,.015)` (тише, чем `--bg-tint-1`)
  - Border `--bg-tint-2`, `--radius-lg`, padding 16px симметричный
  - Мини-рендерер `note.body` / `note.lines` (см. ниже)
- `.note-footer` — снизу, без separator-линии:
  - `.note-updated` — «обновлено 12 апр» (mono, disabled)
  - `.note-chars` — «N слов · M символов» (mono, disabled)

**Рендерер контента:**

Заметка либо хранит markdown в `note.body`, либо список
"структурированных строк" `note.lines` (мок использует `lines`
для демо). В коде парсим `body` (markdown-like) или используем
структурированный формат — выбрать по ходу фазы 4.

Элементы, которые нужно уметь рендерить:
- `.n-h1` — 20px 600 (`--fs-xl`)
- `.n-h2` — 14px 600 (`--fs-md`)
- `.n-p` — параграф (`--fs-md`, `--text-secondary`, margin 8px)
- `.n-b` (bold) / `.n-i` (italic)
- `.n-li` — буллет `<span class="n-bullet">●</span>` (8px),
  цвет `var(--note-accent, var(--text-tertiary))` с opacity .55
- `.n-cb` — чекбокс 14×14; unchecked — border `--text-tertiary`;
  checked — border + fill + ✓ в `var(--note-accent, ...)` через
  `color-mix(in srgb, var(--note-accent) 15%, transparent)`
- `.n-hr` — горизонтальный разделитель (1px, `--border`)

**`--note-accent`:** CSS-переменная устанавливается inline на
`.note-body` из цвета первой категории заметки:
```tsx
<div className="note-body" style={{ '--note-accent': CAT_COLORS[note.tags[0]] }}>
```
Это делает буллеты и checkbox'ы «в цвет» заметки — тонкая
индивидуальность, не агрессивный акцент.

### Event

Простая форма-вид (короткий detail):
- Шапка с тегами, priority (если есть), deadline
- `.edp-sec` «Время»: дата · время · длительность · location
- `.edp-sec` «Заметки»: `.edp-desc`

Без сложных виджетов.

---

## Часть 6. EntityEditor

Модалка для создания/редактирования сущности.

### Общие поля

- Title (text, required)
- Type (select — только при создании; при редактировании read-only)
- Tags (multi-select с цветами; можно добавить кастомный)
- Status (select: active / someday / done / archived)
- Priority (select: high / medium / low / нет)
- Deadline (date picker, опциональное)
- Estimated time (опциональное, number + select мин/час)

### Тип-специфичные поля

Появляются динамически в зависимости от `type`:

- **task**: parent project (autocomplete по projects), checklist
  (список с добавлением)
- **project**: description, pipeline_stage (select), task_ids
  (список)
- **routine**: frequency, days (multi-select), default_duration,
  default_time
- **event**: date (picker), time (picker), duration, location,
  travel_time
- **contact**: name, desired_cadence_days, last_contact, travel_
  time, important_dates (repeatable), topics (repeatable), notes
- **goal**: target, current_value, target_date, linked_metric_ids
  (multi-select по metrics)
- **note**: body (textarea, rich-edit можно отложить)
- **metric**: unit, current_value, history (repeatable), linked_
  goal_id (select по goals)

### Кнопки

- Save (золотая primary)
- Delete (красная outline, с подтверждением)
- Cancel

Enter внутри инпута = Save, Escape = Cancel.

---

## Часть 7. «+ Создать» dropdown

Dropdown со списком типов:
- Создать задачу
- Создать проект
- Создать рутину
- Создать событие
- Создать контакт
- Создать цель
- Создать заметку
- Создать метрику

Открывает EntityEditor с предзаданным `type`.

---

## Часть 8. Шаблон недели

### TemplateEditor

Страница или модал для редактирования `data/templates/default.json`.

UI: мини-версия WeekGrid (та же разметка, но без blocks из
расписания — только шаблонные). Можно:
- Добавить шаблонный блок (day / start / duration / title /
  category)
- Удалить
- Редактировать

Стиль — `.tb`, `.gr`, `.day-col`, но в сжатом виде (может быть
меньшая высота row-h, например 24px, или та же 40 — обсудим по
ходу).

**Доступ:** кнопка «Шаблон» в Header на Planner или в Settings.

---

## Часть 9. Переход между неделями

### Создание новой недели

Когда пользователь переходит на неделю без файла:

1. Диалог: «Неделя 17 (21–27 апреля) ещё не создана»
   - «Создать из шаблона» — применить `default.json`
   - «Создать пустую» — пустая неделя
2. При создании из шаблона: `week-manager.createWeek(weekId,
   'default')`:
   - Читаем `data/templates/default.json`
   - Для каждого template block → создаём Block с пересчитанной
     датой, `status: "planned"`, `source_entity_id: null`
   - Сохраняем как `data/schedule/2026-wNN.json`

### WeekManager

**src/services/week-manager.ts:**

```typescript
export function createWeek(weekId: string, template?: 'default'): Promise<WeekFile>;
export function getCarryOver(currentWeekId: string): Promise<Entity[]>;
export function getWeekId(date: Date): string;
export function getWeekRange(weekId: string): { start: Date; end: Date };
export function listWeeks(): Promise<string[]>;
```

### Carry-over в пуле

В TaskPool (фаза 3) добавляем секцию сверху: **«С прошлой недели»**
(collapsed по умолчанию, badge-счётчик).

**Что туда попадает:** entities, у которых был блок в
предыдущей неделе со `status: "planned"` (не done, не skipped),
и в текущей неделе нет блока для этой entity.

Это не «автоперенос блоков» — просто визуальная группировка.
Перенос делает пользователь руками через DnD из пула на сетку.

---

## Часть 10. Settings (базовый)

Клик на шестерёнку в sidebar (фаза 1 — неактивна; активируется
здесь).

Страница или модал с табами:
- **Области** — CRUD по `config.areas` (id, label, color, icon).
  Редактирование цвета — color picker, но по умолчанию уже стоят
  цвета из дизайн-системы
- **Шаблон недели** — ссылка на TemplateEditor
- **Пайплайн** — редактирование `config.pipeline_stages`
- **Данные** — путь к `data/`, кнопка «Открыть в Finder»

Секция «AI-планирование» (scheduling preferences) добавляется
в фазе 6.

---

## Critical paths для реализации

1. Сначала — layout `EntitiesPage` (3 колонки) + фильтры + список
2. Потом — detail-панель с простыми типами (task / event / note)
3. Потом — сложные виджеты по одному: pipeline (project) → streak
   + heatmap (routine) → status-widget (contact) → sparkline (goal)
   → bar-chart (metric)
4. EntityEditor — в конце, когда все детали понятны
5. Template editor + week manager + settings — после основного UI

---

## Критерии готовности

- [ ] Layout Entities: 3 колонки 180/380/flex, фиксированные
  ширины + max-width 480 на detail
- [ ] Фильтры: 8 вкладок по типу (без «События»), 5 областей с
  точками, 3 статуса; активная опция — золотой фон; счётчики
  корректные
- [ ] Поиск по title работает
- [ ] Список `.erow`: иконка + title + priority pill (правильные
  цвета HIGH red / MEDIUM горчичный / LOW серый) + теги + meta
- [ ] Клик на `.erow` → подсветка + рендер detail
- [ ] Empty state detail-панели виден, когда ничего не выбрано
- [ ] **Task detail:** badges + чеклист с прогресс-баром + notes
- [ ] **Project detail:** pipeline визуализация с done/current/
  future + чеклист глав
- [ ] **Routine detail:** 3 stat-cards + streak-неделя с today-
  рамкой + heatmap 26×7
- [ ] **Contact detail:** status-widget с countdown + «на этой
  неделе» с заливкой категории + topics-чеклист с hover-× +
  история контактов + важные даты без фонового бокса
- [ ] **Goal detail:** goal-block + stat-footer + связанные
  метрики (с opacity-0 стрелкой на hover) + sparkline SVG
- [ ] **Metric detail:** 36px mono value + `↑/↓` change + bar
  chart 6 мес с gradient opacity + stat-footer
- [ ] **Note detail:** рендерер h1/h2/p/li/cb/hr с
  `--note-accent` = категория заметки
- [ ] **Event detail:** простая форма (дата/время/место/заметки)
- [ ] EntityEditor открывается по клику «Редактировать» +
  «+ Создать», все тип-специфичные поля показываются
- [ ] Удаление с подтверждением
- [ ] Шаблон недели редактируется в мини-сетке
- [ ] Создание новой недели: диалог + применение шаблона или
  пустая
- [ ] Carry-over в пуле видит незавершённые задачи прошлой недели
  (секция collapsed, badge-счётчик)
- [ ] Settings: CRUD по областям и пайплайну
- [ ] Все изменения сохраняются в JSON-файлы
