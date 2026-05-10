# Phase 10 — Архив выполненных задач

> **Цель:** вынести выполненные задачи (`status === "done"`) с
> экрана Tasks в отдельный экран-архив с фильтрами по дате
> завершения, поиском, сортировкой и группировкой по периодам.
> На Tasks остаётся только активная работа; накопившиеся «готовые»
> не зашумляют список и при этом остаются доступны через одну
> точку входа из sidebar Tasks.
>
> **Результат после фазы:** на Tasks в карточке «Обзор»
> sidebar'а строка «✓ Выполнено N» становится кнопкой-входом в
> архив. Открывается отдельный экран `Archive` с группами по
> месяцам завершения, быстрыми чипами «Этот месяц / Прошлый
> месяц / Этот год / Всё время», поиском по названию,
> сортировкой и кнопкой «Вернуть в работу» прямо в строке. На
> Tasks в группе «✓ Готово» больше ничего не показываем.

## Контекст

Прочитай:

- `00-overview.md` (этот каталог) — общая картина v2.
- `03-phase-3-tasks.md` — текущее устройство TasksPage,
  TaskRow, TasksSidebar, фильтр `taskFilter.type === "done"`.
- `09-phase-9-cleanup.md` — фаза, в которой жил пункт «Archive
  как роадмап» в духе перформанса; здесь конкретизируем.
- `done/01-data-schema.md` §1 — базовые поля Entity, в т.ч.
  `updated_at`, `status`, без `completed_at`.
- `src/schemas/entity.ts` — текущая Zod-схема (нет
  `completed_at`).
- `src/services/group-tasks.ts` — `groupTasks` собирает
  done-список в `groups.done`, который мы в этой фазе вырезаем.
- `src/components/tasks/TasksSidebar.tsx` — клик по
  «Выполнено» сейчас выставляет `taskFilter = { type: "done" }`,
  и `TasksPage` показывает только done; этот код заменяется
  переходом на Archive.

## 1. UX research notes

### 1.1. Как это решают другие

- **Things 3 «Logbook».** Отдельный пункт в левом сайдбаре, не
  фильтр на todo-экране. Группировка по дню завершения, заголовки
  в духе «Today / Yesterday / This Week / Last Month / 2025».
  Поиск и базовая фильтрация по проекту/тегам. Бесконечный скролл,
  ленивая подгрузка по 50 записей. **Берём:** отдельный экран,
  группировка по периоду завершения, быстрые «человеческие»
  лейблы для близких периодов.
- **Todoist «Completed».** Модальная панель с фильтром по
  проекту и временным окном (7/30/90 дней / all). Search по
  query. Кнопка «Reschedule» возвращает таск активным.
  **Отвергаем модалку:** для сценария «найти ту штуку» нужна
  полноразмерная зона, не popover.
- **OmniFocus completed projects.** Перспектива «Completed»
  с фильтрами по контексту/проекту. Дата завершения отдельным
  столбцом, сортировка кликом по заголовку. **Берём:** дата
  завершения как отдельный визуальный элемент в строке,
  сортировка по дате — обязательный default.
- **Linear archive.** Глобальный «Archived» feed с фильтрами
  по команде/проекту/типу и поиском. Виртуализированный
  список. **Берём:** виртуализация с ходу, иначе на 5k+
  записей фриз; «Restore» рядом с каждой строкой — основное
  действие.
- **Notion done DBs.** Произвольные view'ы поверх той же
  таблицы. Удобно, но требует бэкенда. **Отвергаем:** у нас
  один tasks-список в `entities.json`, второго представления
  не строим.

Обобщённо: индустрия сходится на «отдельный экран + поиск +
быстрые периодные чипы + одно-кликовый restore + ленивая
отрисовка». Это и берём.

### 1.2. Группировка и отрисовка

- **Группировка — по месяцу завершения.** Day-level
  группировка слишком мелкая (тысячи групп на длинной
  истории), week-level — слабо узнаваема (юзер мыслит «в
  октябре делал», не «на 42-й неделе»). Месяц — компромисс:
  одна группа = ~10–40 записей при нормальной активности.
  Текущий месяц и предыдущий получают человеческие лейблы
  («Май 2026 — этот месяц», «Апрель 2026 — прошлый месяц»),
  старые — `«Месяц YYYY»`.
- **Бесконечный скролл с виртуализацией.** Пагинация
  «следующие 50» в десктопном приложении ощущается старомодно;
  всё должно скроллиться плавно. На 10k+ задач без
  виртуализации DOM умирает (даже один div × 10k — фриз scroll).
  Решение — `@tanstack/react-virtual`: headless, ~6 КБ,
  встаёт поверх любого вложенного скролл-контейнера, не лезет
  в стили (см. §5).

## 2. Entry points & navigation

### 2.1. Решение: sub-route Tasks → Archive

Архив — это «вид» Tasks, не самостоятельный домен. Не
заслуживает 7-го таба в Top Nav (топ-нав живёт по доменам, не
по фильтрам). Вынос в отдельный таб «Архив» создаст ещё одну
постоянно-видимую кнопку в навигации, которой юзер пользуется
раз в неделю.

Решение: **внутренний sub-page Tasks.** Юзер на Tasks-табе
кликает «✓ Выполнено N» в sidebar'е → экран в `<main>`
переключается с `TasksPage` на `ArchivePage`. Активный таб
Top Nav остаётся «Задачи» (визуально подсвечен). Возврат —
кнопкой «← Активные» в шапке Archive (повторяет паттерн
«Reminders → List → Completed» в нативном macOS Reminders).

Альтернативы и почему отклонены:

- *Отдельный таб Top Nav «Архив».* Перегружает навигацию
  редким сценарием, и архив тогда становится «глобальный по
  всем сущностям» — но в фазе 10 мы делаем только tasks,
  расширение на projects/directions — позже.
- *Модалка / Drawer.* Не позволяет нормально работать
  внутри (фокус, прокрутка, копи-паст). Сценарий «открыть и
  посидеть, поискать» требует полноценного экрана.
- *Inline-раскрывающаяся секция на TasksPage.* Та же
  проблема, что и сейчас, плюс конфликт scroll'а с активным
  списком.

### 2.2. Хранение состояния

- Новый поле в `ui.ts`: `tasksView: "active" | "archive"`
  (default `"active"`). Не персистится — переход на Tasks
  всегда возвращает в `"active"` (см. ловушку 9.1).
- При `setPage("tasks")` принудительно `tasksView = "active"`.
  Иначе после возврата с другого таба юзер мог бы внезапно
  оказаться в архиве, потому что «там был в прошлый раз».
- Trigger перехода в архив: клик по строке «Выполнено» в
  TasksSidebar → `setTasksView("archive")`. Никаких
  «taskFilter.type === 'done'» — этот путь удаляем целиком
  (см. §9.2).

### 2.3. URL / hash

URL-роутинга в проекте нет (Tauri-десктоп, состояние в
zustand). Не вводим. `tasksView` — обычный пункт ui-store.

## 3. Layout

### 3.1. Wireframe

```
┌─ Top Nav (40px) ──────────────────────────────────────────────┐
│ Plan [Tasks*] Projects Context Horizon Review ... + ...       │
├──────────────────────────────────────────────────────────────┤
│ ArchivePage (.archive-page)                                  │
│ ┌──────────────────────────────────────┐  ┌────────────────┐ │
│ │ ArchiveHeader                        │  │ ArchiveSide    │ │
│ │  ← Активные   Архив задач  · 1247    │  │  (220px sticky)│ │
│ │                                       │  │                │ │
│ │  [search...........] [sort ▾]        │  │  Период        │ │
│ │  [Этот месяц][Прошлый][Год][Всё]    │  │   Этот месяц 32│ │
│ │  [21–31 мая ▾]   ← detailed picker  │  │   Прошлый м. 47│ │
│ │   (опционально, см. §3.4)            │  │   Этот год 412 │ │
│ │                                       │  │   Всё  1247    │ │
│ │ ────────────── Май 2026 (этот) ───── │  │                │ │
│ │  ✓  Купить корм             10 мая   │  │  По категориям│ │
│ │  ✓  Забрать документы        7 мая   │  │   ● Работа 18 │ │
│ │  ✓  Заплатить за хостинг     3 мая   │  │   ● Жизнь   8 │ │
│ │ ────────────── Апрель 2026 (прош.) ─ │  │   ● Рост    4 │ │
│ │  ✓  …                                 │  │                │ │
│ │  …                                    │  │  По приоритету│ │
│ │ ────────────── Март 2026 ──────────── │  │   ⚡ 3   ● 24 │ │
│ │  …                                    │  │   ○ 5         │ │
│ └──────────────────────────────────────┘  └────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

CSS-классы:

- `.archive-page` — flex row, padding 16/20, gap 16, justify
  center, overflow-y auto. Зеркалит `.tasks-page`.
- `.archive-inner` — max-width 560 (шире Tasks 420, потому
  что справа есть колонка с датой).
- `.archive-side` — 220px sticky, паттерн `.tasks-side`.
- `.arch-header`, `.arch-back`, `.arch-title`, `.arch-count`.
- `.arch-toolbar` (search + sort + chips), flex row wrap.
- `.arch-chips` — горизонтальные quick-period chips.
- `.arch-group`, `.arch-group-head`, `.arch-row`, `.arch-row-date`.

### 3.2. ArchiveHeader

```tsx
<div className="arch-header">
  <button className="arch-back" onClick={backToActive}>
    ← Активные
  </button>
  <h1>Архив задач</h1>
  <span className="arch-count">{filteredCount} из {totalDone}</span>
</div>
```

`filteredCount` — после применения всех фильтров и поиска.
`totalDone` — все задачи `status === "done"`. Если фильтр
сильно режет — юзер сразу видит соотношение.

### 3.3. Toolbar (search + sort + chips)

```tsx
<div className="arch-toolbar">
  <input
    className="arch-search"
    placeholder="Поиск по названию..."
    value={archiveSearch}
    onChange={e => setArchiveSearch(e.target.value)}
    autoFocus
  />
  <select className="arch-sort" value={sort} onChange={...}>
    <option value="completed_desc">Сначала недавние</option>
    <option value="completed_asc">Сначала старые</option>
    <option value="title_asc">По названию А→Я</option>
    <option value="title_desc">По названию Я→А</option>
  </select>
  <div className="arch-chips">
    {CHIPS.map(c => (
      <button
        className={`arch-chip${activeChip === c.id ? " active" : ""}`}
        onClick={() => setChip(c.id)}
      >
        {c.label}
      </button>
    ))}
  </div>
</div>
```

Search — `autoFocus` при входе на экран; ввод фильтрует в
реальном времени без debounce (паттерн TasksPage).

Сортировка — обычный `<select>`. По умолчанию
`completed_desc`. Когда сортировка не по дате (`title_*`) —
группировка по месяцам пропадает, рендерится плоский список.

### 3.4. Quick-period chips

```ts
const CHIPS = [
  { id: "month", label: "Этот месяц" },
  { id: "prev-month", label: "Прошлый месяц" },
  { id: "year", label: "Этот год" },
  { id: "all", label: "Всё время" },
];
```

Поведение:

- По умолчанию активен `"all"`.
- Клик по чипу — выставляет окно фильтрации.
- Один чип активен в любой момент (`activeChip`).
- Никакой комбинаторики между чипами и кастомным диапазоном
  не поддерживаем (см. §3.5) — упрощение.

### 3.5. Кастомный диапазон (необязательно для P10.1)

Под чипами — disclosure-кнопка `«Точный период ▾»`. Раскрывает
два date-input'а (`from` / `to`). Когда оба заданы и
непустые, активный чип сбрасывается, фильтр идёт по диапазону.
Скрыто за disclosure, чтобы не нагружать toolbar для
повседневного сценария.

**Решение:** реализуем в P10.3 (см. §8). На P10.1 — только
чипы.

### 3.6. Filter logic (combination)

Фильтры комбинируются в **AND**:

1. **Базовый набор:** все entities `type === "task"` и
   `status === "done"`.
2. **Период** (chip ИЛИ кастомный диапазон): сравнение
   `completed_at` с границами окна. `null` `completed_at` —
   попадает только в `"all"` (см. §4.2).
3. **Sidebar-фильтры** (категория / приоритет): такой же
   паттерн как в `TasksSidebar` для активных. Кликабельные
   строки правой панели.
4. **Search:** `title.toLowerCase().includes(q.toLowerCase())`.

Empty state:

- Если фильтры/search дают 0 результатов и `totalDone > 0` —
  «Нет задач по этому фильтру» (`.arch-empty`).
- Если `totalDone === 0` — «Архив пуст. Завершайте задачи —
  они будут собираться здесь». Без CTA «вернуться» — экран
  и так открывается из Tasks, путь обратно очевиден.

### 3.7. Группировка списка

```ts
function groupArchiveByMonth(
  tasks: TaskEntity[],
  now: Date,
): Array<{ key: string; label: string; items: TaskEntity[] }> {
  // tasks уже отсортированы по completed_at desc
  // ключ: "YYYY-MM" из completed_at; label —
  // human-readable (см. ниже)
}
```

Лейблы:

- Текущий месяц: `«Май 2026 · этот месяц»`.
- Прошлый месяц: `«Апрель 2026 · прошлый месяц»`.
- Тот же год, более ранний: `«Март 2026»`.
- Прошлые годы: `«Декабрь 2025»` (год обязателен).
- Задачи без `completed_at` (старые, до миграции): отдельная
  группа в самом конце — `«Дата завершения неизвестна»`.

Группа — `<section>` с sticky-заголовком (`.arch-group-head`,
`position: sticky; top: 0; bg-surface`). Когда длинная группа
прокручивается, заголовок остаётся виден.

### 3.8. Sidebar (правая колонка)

Три карточки (`.ts-card` reused):

1. **Период.** Кликабельный отчёт по чипам — те же 4 строки
   с подсчётами. Дублирует chips сверху, но даёт
   быстрый visual-counter без сужения окна.
2. **По категориям.** Те же area-строки, что и в TasksSidebar,
   но считаются от `done` множества. Клик — фильтр; повторный
   клик — снимает.
3. **По приоритету.** То же.

Сводно: визуальный паттерн TasksSidebar повторяется.

### 3.9. ArchiveRow

Новый компонент `ArchiveRow.tsx`. **Не TaskRow:** в архиве
нужны другие affordances:

```
┌──────────────────────────────────────────────────┐
│ ✓  Купить корм                       10 мая  ●   │
│        ● Жизнь · ● Низкий           ↑restore     │
└──────────────────────────────────────────────────┘
```

- Чекбокс (`.ar-check.checked`) — заполненный, клик возвращает
  задачу в `active` (см. §6.3).
- Название (`.ar-title`) — line-through убран в архиве
  (он не нужен — все строки одинаковые), но цвет
  `text-secondary`. Клик — открывает EntityPopup (как и в
  TaskRow).
- Метаданные (`.ar-meta`): «{категория} · {приоритет}» в одну
  строку, мелко.
- Дата завершения (`.ar-date`): `«10 мая»` в текущем году,
  `«10 мая 2025»` в прошлых. Right-aligned. При сортировке
  по title — всё равно показываем.
- Категорийная точка (`.ar-cat`): как в TaskRow.
- Hover-actions: появляется кнопка «↑ Вернуть в работу»
  справа (кроме кейса виртуализации — кнопка всегда в DOM,
  меняется только opacity, чтобы не плодить скачки layout'а).

Ширина строки — фикс, не grow. На очень узких окнах
(планшетный режим) — meta-строка переносится под title.

### 3.10. Loading / empty state

- **Loading.** `entities` уже все в памяти к моменту захода
  на Archive (загружаются в App.tsx boot). Дополнительной
  загрузки нет, отдельного `loading: true` экрана не нужно.
- **Empty.** §3.6 описывает.
- **No results from filter.** §3.6 описывает.

## 4. Data model

### 4.1. Текущее состояние

`TaskFieldsSchema` (см. `src/schemas/entity.ts:29`):

```ts
export const TaskFieldsSchema = z.object({
  parent_project_id: z.string().nullable(),
  checklist: z.array(ChecklistItemSchema).default([]),
});
```

`baseEntityShape` (см. `src/schemas/entity.ts:154`):

```ts
const baseEntityShape = {
  id, title, tags, status, priority, deadline,
  estimated_minutes, description,
  created_at: isoDateTime(),
  updated_at: isoDateTime(),
};
```

Нет поля `completed_at`. Сейчас `updated_at` обновляется
любым `updateEntity` — поэтому equate его с completion-time
**ненадёжно:** редактирование title уже завершённой задачи
сдвигает `updated_at`, и группировка «по месяцу завершения»
посыпется.

### 4.2. Решение: добавить `completed_at`

В `baseEntityShape`:

```ts
const baseEntityShape = {
  // ... existing fields
  completed_at: isoDateTime().nullable().default(null),
};
```

Помещаем в base, не в TaskFields, потому что projects тоже
завершаются (`status === "done"` в kanban-колонке «Готово»,
phase 4) и в перспективе будут видны в общем архиве.
В **этой фазе** UI читает `completed_at` только у tasks.

Семантика:

- `completed_at` ставится **только** при переходе
  `status: <any> → "done"`.
- При обратном переходе `"done" → "active"` (restore из
  архива, §6.3) — `completed_at = null`.
- При повторном завершении — новое значение (не сохраняем
  историю; если задача была завершена 3 раза, видим только
  последнюю дату).
- При прямом изменении title/priority/tags у уже завершённой
  задачи — `completed_at` не трогаем.

Реализация — в `useEntityStore.updateEntity`:

```ts
updateEntity: async (id, updates) => {
  const next = get().entities.map((e) => {
    if (e.id !== id) return e;
    const merged = { ...e, ...updates, updated_at: nowISO() };
    if ("status" in updates) {
      const wasDone = e.status === "done";
      const isDone = merged.status === "done";
      if (!wasDone && isDone) merged.completed_at = nowISO();
      else if (wasDone && !isDone) merged.completed_at = null;
    }
    return merged as Entity;
  });
  // ... persist
};
```

Это единственная точка входа в `status`-мутации (через UI и
через command-executor — оба идут через store), поэтому
правило живёт в одном месте.

### 4.3. Миграция существующих done-задач

Старые задачи с `status === "done"` имеют `completed_at` =
`null` (Zod default). Возможные подходы:

- **A. Жесть-fallback на `updated_at`.** Скрипт миграции один
  раз пробегает по entities.json: для всех `status === "done"
  && completed_at === null` ставит `completed_at = updated_at`.
  Точно: для большинства задач `updated_at` совпадает с
  моментом галочки (юзер ставит чек и больше не трогает).
  Не точно для отредактированных после завершения.
- **B. Без миграции.** `null completed_at` — отдельная группа
  `«Дата завершения неизвестна»` в самом конце списка.
  Информация о реальной дате потеряна, но мы её и без миграции
  не знаем — `updated_at` точно так же может быть смещён.
- **C. Гибрид.** При миграции ставим `completed_at =
  updated_at`, но добавляем флаг `completed_at_inferred:
  boolean` в schema. UI показывает дату приглушённо или с
  знаком «~». Усложняет схему ради edge-case'а.

**Рекомендация: A.** Это лучшее приближение, лучше чем «UI
вообще не показывает дату для всей старой истории». Юзер
свежий — миграция будет работать на 5–20 задач, тут потеря
точности не существенна. На длинной истории (сотни) — `updated_at`
для большинства совпадает с completion (редактирование done-
задачи редкое поведение).

Скрипт — `src/services/archive-migration.ts`,
`maybeBackfillCompletedAt()`. Запуск — однократно, по маркеру
`data/.archive-completed-at-backfilled` (паттерн
`maybeMigrateToV2` из фазы 1, `seed-migration.ts`).

```ts
export async function maybeBackfillCompletedAt(): Promise<void> {
  const marker = await fileExists(
    getDataPath(".archive-completed-at-backfilled"),
  );
  if (marker) return;
  const path = await getDataPath("entities.json");
  const file = await readJsonFileOrCreate(
    path, EntitiesFileSchema, EMPTY_ENTITIES_FILE,
  );
  const next = file.entities.map((e) => {
    if (e.status !== "done") return e;
    if (e.completed_at !== null) return e;
    return { ...e, completed_at: e.updated_at };
  });
  await writeJsonFile(path, { version: 1, entities: next });
  await writeJsonFile(
    getDataPath(".archive-completed-at-backfilled"),
    { at: nowISO() },
  );
}
```

Вызов — в `App.tsx` после `maybeMigrateToV2()` и до
`loadEntities`.

### 4.4. Backward-compat при чтении старых файлов

`completed_at` объявлен через `.nullable().default(null)` —
старые `entities.json` без поля валидируются и получают `null`
автоматически (Zod default), без падений. Отдельная миграция
формата файла не нужна.

### 4.5. Что НЕ трогаем в data model

- `status` enum остаётся `["active","done","archived","someday"]`.
  «Archived» сейчас не используется UI'ем — оставляем как есть.
  Архив выполненных задач = `status === "done"`, не `"archived"`.
  Семантика «archived» (если когда-то понадобится) —
  отдельная история (см. §7).
- `updated_at` продолжает работать как было.
- Не вводим отдельное хранилище / отдельный JSON-файл
  для done-задач. На 10k задач entities.json остаётся ~5 МБ
  (worst case ~500 байт на задачу), это в пределах нормы для
  in-memory и для disk. Выделение в отдельный файл — оптимизация
  под фантомный сценарий, добавляет миграцию и сложность
  координации между двумя файлами.

## 5. Performance

### 5.1. Виртуализация списка

На 10k+ done-задач плоский render — фриз скролла. Берём
`@tanstack/react-virtual` (~6 КБ, headless, dependency-free
кроме React). Добавляем в `package.json`:

```json
"@tanstack/react-virtual": "^3.x"
```

В `ArchiveList`:

```tsx
const rowVirtualizer = useVirtualizer({
  count: flatItems.length,  // плоский массив с group-headers
  getScrollElement: () => scrollerRef.current,
  estimateSize: (i) =>
    flatItems[i].kind === "header" ? 32 : 56,
  overscan: 6,
});
```

`flatItems` — interleaved массив `{ kind: "header", label }` и
`{ kind: "row", task }`, чтобы виртуализатор работал по одному
индексу. Sticky group headers — через CSS (`position: sticky;
top: 0`), а не через отдельный API.

### 5.2. Поиск и фильтрация на 10k

Без отдельного индекса:

- `tasks.filter(t => t.title.toLowerCase().includes(q))` —
  10k items × ~30 символов = 300k операций сравнения
  подстроки. На современном CPU — < 5ms на каждый keystroke.
  Не нужен debounce, не нужен Fuse.js / index.
- Фильтр по дате — `tasks.filter(t => t.completed_at >=
  from && t.completed_at < to)` — лексикографическое
  сравнение ISO-строк, не парсится дата каждый раз. Та же
  скорость.

Если когда-то упрёмся (50k+) — добавить мемоизированный
индекс (`Map<string, TaskEntity[]>` по `YYYY-MM`). Сейчас —
нет.

### 5.3. Сортировка

Один проход по filteredTasks через `.sort()`. На 10k —
~10ms. Мемоизируем по `[filteredTasks, sort]`:

```ts
const sortedTasks = useMemo(
  () => [...filteredTasks].sort(sortFns[sort]),
  [filteredTasks, sort],
);
```

`sort()` мутирует — копируем через spread.

### 5.4. Подсчёты в sidebar

`counts.byCat` / `counts.byPrio` / `counts.period` —
один проход через done-список, мемоизация по `[doneTasks]`.
То же что в TasksSidebar.

## 6. Interaction details

### 6.1. ArchiveRow vs TaskRow

**Решение: новый ArchiveRow.** Причины:

- Структура другая: `[check][title meta][date][cat-dot]` вместо
  `[check][body][deadline][cat-dot]`. `tr-deadline` в активной
  задаче — `«15д»`, в архиве этого нет; нужна `«10 мая»`.
- Hover-actions (restore) — другой набор; мешать в одном
  компоненте через ifs быстро превращается в кашу.
- Поведение чекбокса противоположно: в Tasks клик `→ done`,
  в Archive `→ active`.

Шаринг — на уровне общих хелперов (`pickAreaTag`,
`getAreaColor`, `formatRuDate`).

### 6.2. Click → EntityPopup

Клик по строке (не по check / restore) — открывает
существующий `EntityPopupHost` через
`openEntityPopup(task.id, anchor, "below")`. Поля те же
(category dots / priority / deadline / удалить) — никакой
архив-специфики в TaskPopup не вводим. Юзер видит дедлайн
старой задачи как есть.

При закрытии popup'а юзер остаётся на ArchivePage. Если в
popup'е нажал «Удалить» — задача исчезает из архива (нормально,
хочет — стирает).

### 6.3. Restore (вернуть в работу)

Два пути:

1. **Клик по чекбоксу** в строке. Сразу `updateEntity(id,
   { status: "active" })`. Toast `«Возвращено в работу: {title}»`.
   Задача исчезает из архива.
2. **Клик по hover-кнопке** «↑ Вернуть в работу». То же
   действие, более явное.

В обоих случаях `completed_at` сбрасывается в `null` (см.
§4.2). На Tasks-экране задача появится в группе по своему
deadline (если deadline в прошлом — попадёт в «Горит/Срочно»,
без deadline — в «Когда-нибудь»).

«Вернуть» в архиве **не** меняет deadline. Если задача
завершилась с deadline 1 апреля, восстановление в мае —
получится «просрочена на 40 дней». Это адекватное
поведение: юзер видит, что задача недоделана, и сам решает
сдвинуть deadline.

### 6.4. Bulk operations (out of scope)

Multiselect, bulk-restore, bulk-delete — пропускаем в P10.
Реальный сценарий «выбрать 50 done и вернуть» —
маргинален; добавление multiselect — отдельная UX-история
с checkbox-mode, shift-click range и т.д. Если запросят —
отдельная фаза.

### 6.5. Keyboard

- `/` — focus на search input (если фокус не в input/textarea).
  Стандартный паттерн (Linear, GitHub).
- `Escape` в search — очищает search.
- `Escape` без фокуса в input — `backToActive()` (как
  back-кнопка).
- `Cmd+N` — стандартный QuickAdd, не подменяется.
- `Cmd+F` — то же что `/`. Native shortcut, не override'им —
  пусть отрабатывает браузер/Tauri (там нет браузерного find,
  но юзер привычку имеет).

### 6.6. Hot-reload между Tasks и Archive

Если юзер открыл popup задачи в архиве, поменял title и
закрыл — изменение видно в архиве сразу (entity-store
подписка). То же с любыми другими полями.

Если в момент работы в архиве AI-агент завершил задачу
(через очередь команд) — `entities` обновляется, новая
задача появляется в архиве (в верхней группе) без
дополнительных действий пользователя.

## 7. Open questions / решения для пользователя

1. **Восстановление сбрасывает `completed_at` в `null`?**
   Дефолт: **да** (см. §4.2). Альтернатива — оставлять,
   чтобы при повторном завершении видеть историю. Тогда
   нужно вводить массив. Усложняет схему. Рекомендую
   оставить дефолт.
2. **Backfill `completed_at` через `updated_at` для старых
   done-задач?** Дефолт: **да, вариант A** (см. §4.3).
   Альтернатива — оставить `null` и собрать в группу
   «Дата неизвестна». Если юзеру важна точность дат для
   старых данных — он скажет «не делать backfill».
3. **Кастомный date-range — в P10.1 или P10.3?** Дефолт:
   P10.3 (отложить на полировку, см. §8). Если юзер
   часто будет лезть в архив за конкретной датой — стоит
   вынести в P10.1.
4. **Включать ли projects в архив?** Дефолт: **нет, только
   tasks**. Projects по дизайну проходят через kanban-колонку
   «Готово» и **не исчезают** автоматически — они и так не
   мешают активному workflow. Если юзер захочет «архив
   проектов» — отдельная история с другим UI (kanban или
   список с подзадачами). Но `completed_at` мы добавляем
   в `baseEntityShape` уже сейчас, чтобы не делать вторую
   миграцию.
5. **Что делать с `status === "archived"` (если у юзера
   есть)?** Дефолт: **не трогаем, не показываем в архиве
   tasks**. Архив выполненных = `status === "done"`.
   `archived` исторически означал «спрятать без завершения»
   — это другой сценарий. Если в данных юзера есть такие
   — оставляем за бортом, в фазе 9-style review решим, нужно
   ли мигрировать.
6. **Sticky group headers — нужны?** Дефолт: **да** (см.
   §3.7). Если в smoke-тесте окажется глючно с
   виртуализацией (известная проблема некоторых virtual-list
   реализаций) — отключим, заголовки будут скроллиться вместе
   с контентом.
7. **Удаление задачи из архива требует подтверждения?**
   Дефолт: **нет, паттерн TaskPopup как есть** — кнопка
   «Удалить» удаляет сразу с toast'ом. На Tasks-экране это
   так же работает; не вводим разный UX в одном popup'е.
8. **«Архив» — единственное место для done-задач, или
   на TasksPage в группе «✓ Готово» оставить
   последние N (например, 5) для удобства?** Дефолт:
   **только архив**. Иначе пропадает мотивация
   разделения. Юзер просил «убрать done с активного
   экрана» — выполняем буквально. Если позже захочется
   «recently completed» preview — можно вернуть как
   маленькую карточку в sidebar.

## 8. Implementation phases

### P10.1 — Schema + entry point + базовый экран

**Что появляется:** `completed_at` в schema, миграция
старых done-задач, ArchivePage с группами по месяцам,
search, sort, базовый sidebar (без чипов и кастомного
диапазона), restore через чекбокс, переход из TasksSidebar.

**Что не появляется:** виртуализация, hover-кнопка restore,
кастомный диапазон, чипы периода.

**Что можно потыкать:** Открыть Tasks, кликнуть «Выполнено
N» — переход на ArchivePage, видны все done-задачи
сгруппированными по месяцам, ищется, сортируется. Чек —
возврат в work, задача исчезает из архива. Back-кнопка —
возврат на Tasks.

**Файлы:**

- `src/schemas/entity.ts` — `completed_at` в base.
- `src/services/archive-migration.ts` — backfill skрипт.
- `src/store/entities.ts` — логика `completed_at` в
  `updateEntity`.
- `src/store/ui.ts` — `tasksView`, `archiveSearch`,
  `archiveSort`, `archiveFilter`, setters.
- `src/pages/ArchivePage.tsx`.
- `src/components/archive/ArchiveHeader.tsx`,
  `ArchiveToolbar.tsx`, `ArchiveList.tsx`, `ArchiveRow.tsx`,
  `ArchiveGroup.tsx`, `ArchiveSidebar.tsx`.
- `src/services/archive-grouping.ts` — `groupArchiveByMonth`,
  `formatGroupLabel`.
- `src/components/layout/Shell.tsx` — рендер ArchivePage
  при `tasksView === "archive"`.
- `src/components/tasks/TasksSidebar.tsx` — клик «Выполнено»
  меняет на `setTasksView("archive")` (не `setTaskFilter`).
- `src/components/tasks/TaskGroups.tsx` — убираем done-группу
  из видимых (см. §9.2).
- `src/services/group-tasks.ts` — `groups.done` остаётся
  в типе для обратной совместимости тестов, но всегда `[]`.
  Лучше: убираем поле из `TaskGroups` и обновляем тесты.

### P10.2 — Виртуализация + restore-affordance

**Что появляется:** `@tanstack/react-virtual`, sticky
group headers, hover-кнопка `↑ Вернуть` в строке, корректный
оверфлоу на 10k+ задач.

**Что не появляется:** chips и custom date range — в P10.3.

**Что можно потыкать:** seed-скрипт генерит 1000+ done-задач
для теста (одноразовый dev-only), архив открывается мгновенно,
скролл плавный, при scroll'е headers'ы фиксируются сверху.

**Файлы:**

- `package.json` — добавить `@tanstack/react-virtual`.
- `src/components/archive/ArchiveList.tsx` — переход на
  `useVirtualizer` с `flatItems`.
- `src/components/archive/ArchiveRow.tsx` — hover-кнопка
  restore.
- `scripts/seed-archive-stress.ts` — dev-only утилита, не
  поставляется в prod.

### P10.3 — Quick-period chips + custom date range + полировка

**Что появляется:** chips «Этот месяц / Прошлый / Этот год /
Всё», disclosure-secция с двумя date-input'ами, синхронизация
chip ↔ диапазон, keyboard shortcuts (`/`, `Escape`).

**Файлы:**

- `src/components/archive/ArchiveToolbar.tsx` — chips +
  range.
- `src/services/archive-period.ts` — функции «границы
  периода для chip».
- `src/store/ui.ts` — `archiveChip` / `archiveRange` поля.
- `src/components/archive/ArchivePage.tsx` — keyboard
  handler (mount-level useEffect с `keydown`).

### P10.4 — Acceptance + smoke + memory (опционально)

Пройтись по чеклисту из §10, smoke-тест 30+ done-задач,
запись в memory если будут принципиальные решения.

## 9. Ловушки

### 9.1. `tasksView` не персистится между переходами по табам

При `setPage("tasks")` принудительно сбрасываем
`tasksView = "active"`. Иначе сценарий: юзер на Tasks
открыл архив, переключился на Plan, вернулся на Tasks —
ожидает увидеть активные. «Запомнить вид» удивляет.

Реализация — в `setPage` action в `ui.ts`:

```ts
setPage: (currentPage) =>
  set((prev) => ({
    currentPage,
    tasksView: currentPage === "tasks" ? "active" : prev.tasksView,
    // не сбрасываем horizonHighlight здесь — его
    // условие живёт отдельно в существующем коде
  })),
```

### 9.2. `taskFilter.type === "done"` удалить полностью

Сейчас `TaskFilter` union содержит вариант `{ type: "done" }`,
TasksPage его обрабатывает. Этот код **удаляем** —
`Выполнено` больше не фильтр на TasksPage, а вход в архив.

Файлы:

- `src/store/ui.ts` — `TaskFilter` union без `done`.
- `src/components/tasks/TasksSidebar.tsx` — кнопка
  «Выполнено» меняет `tasksView`, не `taskFilter`. Удалить
  `eq(filter, { type: "done" })`-проверки.
- `src/pages/TasksPage.tsx` — убрать ветку `if
  (taskFilter?.type === "done")`. Убрать `allDoneTasks`
  из selectors.
- `src/services/group-tasks.ts` — `groupTasks` принимает
  только active, не done. Убрать второй параметр или
  оставить как `_done = []` для совместимости.

### 9.3. Группа «Готово» в TaskGroupsView

`GROUP_META` сейчас включает done-группу с криттериумом
`«выполненные задачи»` (видна снизу списка активных).
Удаляем строку из массива в P10.1.

### 9.4. Backfill миграция и параллельная загрузка

`maybeBackfillCompletedAt` пишет `entities.json` напрямую,
до `loadEntities`. Если запустится параллельно с
`loadEntities` — race. Реализация: миграция выполняется
строго **до** `Promise.all` boot'а (см. App.tsx
`8.3.1` фазы 1).

```ts
await ensureDataDir();
await maybeMigrateToV2();
await maybeBackfillCompletedAt();   // ← новое
await useConfigStore.getState().loadConfig();
// ... Promise.all
```

### 9.5. Виртуализация и group headers

`@tanstack/react-virtual` без специальной обработки
виртуализирует и заголовки тоже. Sticky-CSS работает
поверх виртуального контейнера, потому что headers —
`position: sticky` на блочном уровне *скролл-контейнера*,
не виртуализатора. Если в P10.2 окажется, что headers
прыгают — потеряет верхний sticky. Известное решение —
выносить headers в overlay через
`StickyHeaderHandling` (см. tanstack-virtual recipes).
В P10.2 пробуем простой sticky-CSS первым; если ломается —
overlay.

### 9.6. ArchiveRow и popup re-anchoring

EntityPopup анкорится к bounding rect строки. При
виртуализации строка может уйти из DOM (виртуализатор
анмаунтит её из overscan'а), и popup потеряет анкор.
EntityPopupHost сейчас этого не проверяет.

Решение: `EntityPopupHost` уже умеет работать с `point`-anchor
(см. `EntityPopupAnchor` в `ui.ts`). При открытии из
ArchiveRow передаём `rect` (как в TaskRow), но если строка
выйдет за viewport — popup сам схлопнется (это окей: юзер
прокрутил, явно потерял интерес). Дополнительной обработки
не вводим.

### 9.7. Sort `title_*` ломает группировку

Если юзер выбрал сортировку по title — группировка по
месяцам бессмысленна (рядом будут январь-2024 и май-2026).
Решение: при `sort.startsWith("title_")` рендерим плоский
список без групп, заголовков нет. Toolbar'ный disclosure
«Сортировка по названию» — естественно не разбивает на
группы. Юзер в 90% случаев на дефолтной сортировке.

### 9.8. Тысяча done в одном месяце

Если у юзера за месяц 1000 завершённых задач (агент-сценарий),
группа становится одной длинной полосой. Виртуализация
справляется, но визуально — стена. На P10.3 можно добавить
collapse для каждой группы (клик по header → collapse).
В P10.1/P10.2 — без collapse, проще.

## 10. Acceptance criteria

- [ ] `entities.json` после первого запуска новой версии
  имеет поле `completed_at` у всех задач (`null` или
  ISO-datetime).
- [ ] При завершении активной задачи `completed_at`
  ставится автоматически на текущее время.
- [ ] При снятии чека с done-задачи `completed_at`
  сбрасывается в `null`.
- [ ] На Tasks в TasksSidebar строка «✓ Выполнено N» —
  кликабельная кнопка, открывает ArchivePage.
- [ ] ArchivePage показывает:
  - back-кнопку «← Активные»;
  - search input с автофокусом;
  - sort-select (default: «Сначала недавние»);
  - sidebar справа с тремя карточками.
- [ ] Поиск фильтрует список в реальном времени.
- [ ] Сортировка по completed_at — асc/desc — работает.
- [ ] Сортировка по title — асc/desc — работает, группы
  пропадают.
- [ ] Группы отрендерены по месяцам, текущий месяц получает
  суффикс `«· этот месяц»`, прошлый — `«· прошлый месяц»`.
- [ ] Чек по чекбоксу в строке — возвращает в active,
  toast «Возвращено в работу: {title}», задача исчезает из
  архива.
- [ ] Клик по строке (не чек) — открывает EntityPopup,
  поля редактируемы, сохраняются.
- [ ] Удаление через popup — задача исчезает из архива.
- [ ] Sidebar-фильтры (категория, приоритет) — комбинируются
  AND с search, повторный клик снимает.
- [ ] [P10.2] На 1000+ задач архив открывается за < 200ms,
  скролл плавный, group headers стикают.
- [ ] [P10.3] Чипы «Этот месяц / Прошлый / Год / Всё»
  переключают окно. Disclosure «Точный период» позволяет
  ввести from/to.
- [ ] Tasks-page в группе «✓ Готово» **не показывается**
  (удалён из `GROUP_META`).
- [ ] При переходе на Plan и обратно на Tasks — `tasksView`
  сбрасывается на `"active"`.
- [ ] `task check` (typecheck + vitest + frontend build)
  проходит.
- [ ] Smoke от пользователя пройден (Тест-план §11).

## 11. Тест-план (smoke)

1. **Backfill миграция.** Удалить файл-маркер, запустить
   приложение. Проверить `entities.json`: у всех `status ===
   "done"` задач `completed_at` равен `updated_at`.
2. **Завершение активной задачи.** На Tasks отметить чеком
   t1 «Забрать документы». В JSON: `completed_at` = текущее
   время, `status` = `done`.
3. **Переход в архив.** Кликнуть «✓ Выполнено» в TasksSidebar.
   Откроется ArchivePage. t1 видна в группе «{Текущий месяц}
   · этот месяц».
4. **Поиск.** Ввести «доку» в search — фильтр работает,
   t1 отображается.
5. **Sort.** Переключить на «Сначала старые» — t1 в самом
   низу. Назад на «Сначала недавние».
6. **Restore.** Кликнуть чек у t1 — toast «Возвращено в
   работу: Забрать документы», задача исчезает из архива.
   Back-кнопкой вернуться на Tasks — t1 в группе по deadline.
7. **Sidebar-фильтры.** В архиве кликнуть категорию «Жизнь»
   — фильтр применяется. Search всё ещё работает поверх.
   Снять кликом ещё раз.
8. **Edit через popup.** Открыть строку → popup → поменять
   priority → закрыть. Изменение сохранено, в строке
   отражено.
9. **Empty state.** Очистить поиск так, чтобы все 0 задач
   подошли — `«Нет задач по этому фильтру»`.
10. **[P10.2 после реализации]** seed-stress скрипт генерит
    1000 done-задач, архив открывается без фриза, scroll
    плавный.
11. **Page switch.** На ArchivePage переключить top-nav на
    «План», вернуться на «Задачи» — открыты Active, не Archive.

## 12. Что НЕ включает фаза 10

- Архив projects (см. §7 q4).
- Multiselect / bulk-restore / bulk-delete (см. §6.4).
- Экспорт архива (CSV / Markdown).
- История версий задачи / changelog поля.
- Undo для restore (Cmd+Z) — на полную историю мутаций
  в проекте undo сейчас нет, не вводим один.
- Archive для других сущностей (`note`, `metric`, `goal`) —
  они и так в `entities.json`, но на v2 экранах не видны.
  Если когда-то нужно — отдельная фаза.
- Server-side / cloud-sync архива — JSON-only, как и весь
  проект.

## 13. Зависимости и связи

- **Опирается на:** Phase 3 (Tasks) — без неё нет
  TasksSidebar и единого места для входа.
- **Опирается на:** Phase 1 — `entities.json` структура,
  `seed-migration` паттерн.
- **Не блокирует:** ничего из 1–9. Можно делать после
  Phase 9 cleanup.
- **Расширяемость:** `completed_at` в `baseEntityShape`
  открывает дорогу для архива projects (отдельной фазой) и
  Review-метрик типа «Сколько задач завершил за месяц».
