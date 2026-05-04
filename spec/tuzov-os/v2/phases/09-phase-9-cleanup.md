# Phase 9 — Cleanup + AI commands integration

> **Цель:** прибрать legacy-код, удалить дубли, расширить
> command-processor для новых сущностей (direction, pool item) и
> доменов (horizon), привести seed v2 в финальный вид. Решить
> судьбу старых типов entities (routine / event / contact / goal
> / note / metric).
>
> **Результат после фазы:** проект на v2 чисто-собран, без
> неиспользуемых файлов и компонентов. AI-агент через очередь
> команд может создавать / обновлять direction, pool items,
> horizon-state. Старые типы либо мигрированы (если есть данные
> юзера), либо явно помечены как unused.

## Контекст

Это **финальная** фаза. Перед ней должны пройти 1–8. Прочитай:

- `spec.md` целиком (для итоговой сверки чек-листа §16).
- `done/post-review-backlog.md` — может оставаться технический
  долг.
- Список добавленных файлов / схем / классов из фаз 1–8.

## Что в фазе

### 1. Удаление legacy

#### 1.1. Старые компоненты Planner

После фазы 6 рядом лежал `src/components/planner.legacy/`. Если
ничего из него не понадобилось переиспользовать — удалить
полностью. То же — `src/pages/PlannerPage.legacy.tsx`.

#### 1.2. Старый Sidebar / StatusBar / Header

- `src/components/layout/Sidebar.tsx` — больше не используется.
  Удалить.
- `src/components/layout/StatusBar.tsx` — оценить: показывал
  save-status и счётчики команд. Если эти элементы переехали в
  другое место (или решено убрать из v2 UI) — удалить. Если
  оставляем как индикатор save-status в углу — переписать в
  стиле v2 (компактнее, без строки внизу всего экрана).
- `src/components/layout/Header.tsx` — оставлен в проекте,
  рендерится только на debug-страницах (Cmd+Shift+E/D) для
  Top Nav-подобной шапки. Не удаляем.

#### 1.3. Старый detail-panel

Спека §16:
> «Detail panel (`detail-panel`, `.dp-*`, `dpSlide`, `openDetail`,
> `dpData`) — legacy, не реализовывать. Заменён на Entity Popup».

В нашем коде: `src/components/entities/EntityDetail.tsx` и
`detail/*Detail.tsx` файлы. На v2 они не вызываются с новых
экранов, но могут оставаться на старой EntitiesPage (debug-вход).

Решение:
- Если EntitiesPage (debug) сохраняется — оставляем
  `EntityDetail` для неё.
- Если решаем удалить EntitiesPage целиком — удаляем и
  `EntityDetail`, и `EntityList`, и `EntityFilters`,
  `EntityEditor` (если последний не используется в v2).

### 2. Судьба старых типов entities

`routine | event | contact | goal | note | metric` — не
показываются на v2 экранах. У реального юзера могут быть данные
этих типов в `entities.json`.

#### 2.1. Решение по миграции

Несколько вариантов на выбор юзера (выяснить отдельным
обсуждением):

A. **Сохранить как есть.** Старые сущности живут в JSON, не
   видны в UI. Юзер может работать с ними через AI-агента
   (file-direct) или через Cmd+Shift+E если EntitiesPage остаётся.

B. **Мигрировать contact + goal в direction.**
   - `contact` → `direction` с cadence (cadence_label из
     desired_cadence_days).
   - `goal` → `direction` с measurable.
   - `routine` → остаются (это рутины расписания, не сущности
     контекста).
   - `event` → может стать блоком расписания (но без entity).
   - `note`, `metric` → удаляются.

C. **Полное удаление.** Hard reset, юзер пересоздаёт.

Согласовать вариант с пользователем перед фазой 9. По умолчанию
— **вариант A** (наименее деструктивный).

#### 2.2. Обновление EntityTypeSchema

Если выбран вариант A или B — оставляем все типы в schema. Если
C — удаляем `routine`, `event`, `contact`, `goal`, `note`,
`metric` и оставляем только `task`, `project`, `direction`.

### 3. AI commands — финальная сверка

К Phase 9 command schema уже расширена по доменам (см.
`00-overview.md`):

- Phase 1: `create_entity { type: "direction" }` — из коробки.
- Phase 6: `create_pool_item / update_pool_item / delete_pool_item`,
  `pool_item_id` в Block.
- Phase 7: `set_horizon_months / set_horizon_hidden /
  set_horizon_size`.

В Phase 9:

#### 3.1. `mark_cadence` action (опционально)

Простой alias для `update_entity` направления с `last_act = today`:

```ts
export const MarkCadenceCommandSchema = z.object({
  ...baseCommandShape,
  action: z.literal("mark_cadence"),
  data: z.object({ direction_id: z.string() }),
});
```

Handler в `command-executor.ts`:

```ts
case "mark_cadence": {
  const today = formatISO(new Date(), { representation: "date" });
  await useEntityStore.getState().updateEntity(cmd.data.direction_id, {
    fields: { last_act: today },
  });
  break;
}
```

Альтернатива — оставить агенту использовать общий
`update_entity`. Если решено не вводить — пропускаем.

#### 3.3. Сверка всех handlers

Пройти по `command-executor.ts` — каждый action имеет handler.
В тестах смоук на каждое новое action из Phases 1, 6, 7.

#### 3.4. Документация

(перенесено из секции 9 ниже — оставляем как было).

#### 3.2. Тесты

- Vitest: каждое новое action создаёт правильный JSON в
  `commands/done/`, мутирует state корректно.
- Smoke: положить руками JSON в `commands/pending/` —
  процессор подхватит, обработает.

#### 3.3. Документация

В `CLAUDE.md` или отдельном `docs/ai-commands.md` — список всех
поддерживаемых команд + примеры. Это нужно агенту, чтобы он мог
писать корректные JSON.

### 4. Boards в config (опционально)

Если юзер захочет настраивать свои доски — переезжаем
`BOARDS` хардкод из `src/services/boards.ts` в `config.json`.

```ts
// schemas/config.ts
export const BoardSchema = z.object({
  id: z.string(),
  title: z.string(),
  columns: z.array(z.string()),
});

// ConfigSchema:
boards: z.array(BoardSchema).default([
  { id: "brd1", title: "Видео", columns: [...] },
  ...
]);
```

UI: `Settings → Boards tab` — добавить / переименовать / удалить.
При удалении доски — все projects с этой board_id переезжают на
**ID доски-фолбэка**, который определён в config как
`config.fallback_board_id` (по умолчанию `"brd3"`). Если
fallback-доска тоже удалена — берём первую из оставшихся.

> **Откладываемо:** если юзер не запросил — оставляем хардкод.

### 5. Sizes UI на Horizon

Из фазы 7: смена размера проекта через UI **не** была
реализована. В фазе 9 — добавить.

Реализация: select в name-cell или контекстное меню (Right click
на name-cell):

```
┌──────────────┐
│ Тяжёлый      │
│ Средний  ✓   │
│ Мелкий       │
└──────────────┘
```

Или: добавить в EntityPopup для project поле «Размер на
горизонте». Решение подбираем по UX.

### 6. Direction history (зависит от фазы 8)

**Связка с фазой 8.** Если в фазе 8 (Review) деLtas (current →
target изменения за месяц/год) реализованы с fallback'ом «нет
истории, показываем «—»» — то здесь решаем, нужно ли догружать
history. Если фаза 8 корректно работает без него, можно
оставить как есть.

Для Review month/year деLtas:

В `DirectionFieldsSchema`:

```ts
history: z.array(z.object({
  date: isoDate(),
  current: z.string().nullable(),
  progress: z.number().nullable(),
})).default([]),
```

При обновлении current/progress направления — append в history.

Review month / year — использует этот history для дельт.

### 7. Судьба DashboardsPage

Фичу динамических dashboards в моке нет. v1 имела их. Решение:

A. **Сохранить.** Dashboards остаются доступны через
   Cmd+Shift+D. Полезно для кастомизации.
B. **Удалить.** Хардкор. Освободить ~600 строк кода.

Согласовать с пользователем. По умолчанию — **A**.

### 8. Финальная проверка

Пройти полный чек-лист спеки §16:

- [ ] Все CSS-классы совпадают с моком (или semantic-эквивалент).
- [ ] Все transitions/анимации реализованы (qaSlide, popIn,
  toastIn, qaFadeIn).
- [ ] Category dots: scale(1.25) + ✓, без border, без glow.
- [ ] Task bar: dual-mode без моргания. В DOM всегда оба
  элемента.
- [ ] Поиск: real-time, без debounce.
- [ ] Week navigation: динамические даты, не хардкод.
- [ ] Pool header: «ПУЛ · W{N}» обновляется.
- [ ] Кнопка «Сегодня»: текст, слева от стрелок, скрыта на
  current week.
- [ ] Стрелки недели: 28×28, hover border.
- [ ] Context headers: full-width, dot/label/arrow/count.
- [ ] Direction days: clock + colored la + tooltip.
- [ ] Inline project editor (`dc-proj-edit`) — tag chips toggle.
- [ ] dc-unlink реализован.
- [ ] Entity popup positions: tasks below, projects right,
  directions click title (right of card).
- [ ] Budget: занято dim, свободно bold, пул accent, люфт color.
- [ ] «Все» в фильтре проектов — текстовая, accent border на
  active.
- [ ] Gap between dots: 8 для extras, 8 для ep-row, 10 для
  cat-filters.
- [ ] Horizon: drag from backlog, hide preserves state, dynamic
  sections.
- [ ] Review: 3 периода, gauges + charts + stats.
- [ ] Quick-add: auto-detect type from screen, dots, toggles.
- [ ] Toast: dot + text, 2.2s, bottom center, predecessor removal.
- [ ] Project Popup: НЕТ кнопки «Удалить».
- [ ] Direction delete: каскадно отвязывает projects.
- [ ] SVG gauge: rotate -90.
- [ ] Grid scroll: .grid-wrap → .grid-scroll wrappers.
- [ ] Атомарные drag: pi.hours\*60.
- [ ] Horizon sections by hzData/hzHidden, not hzPrio.
- [ ] Cadence urgency: отдельная формула.
- [ ] Seed data: 12 tasks, 21 projects, 9 directions.
- [ ] Detail panel — удалена.
- [ ] Kanban inline blur при непустом = create.
- [ ] dc-unlink toast.

### 9. Документация

- Обновить `CLAUDE.md`: новая структура Top Nav, экраны, Quick Add.
- Обновить `docs/architecture.md` (если есть) с новыми stores
  (pool, horizon).
- Создать `docs/ai-commands.md` с описанием всех action-ов.

### 10. Memory updates

После завершения v2 — обновить `~/.claude/projects/.../memory/`:

- `project_tuzov_os.md`: добавить инфо про фазы v2 и
  переархитектуру.
- Возможно: новая memory `feedback_v2_principles.md` если в
  процессе фаз накопились особые принципы (например, «pool — это
  per-week file», «direction — отдельный type, не маппинг»).

## Acceptance criteria

### Решения, согласованные с пользователем перед стартом

- [ ] Вариант A/B/C для старых типов entities выбран (см. §2.1).
- [ ] Решение по DashboardsPage (Сохранить / Удалить) принято
  (см. §7).
- [ ] Решение про `mark_cadence` action: вводим или оставляем
  `update_entity` (см. §3.1).
- [ ] Решение про Boards в config (переезд из хардкода) — да/нет
  (см. §4).
- [ ] Решение про Direction history — нужен ли (см. §6). Если
  фаза 8 (Review) реализовалась с fallback'ом без history,
  оценить: достаточно ли точно работают month/year deltas, или
  history всё-таки нужен.
- [ ] Sizes UI на Horizon — реализовать в этой фазе (см. §5).

### По окончании фазы

- [ ] Все legacy-файлы удалены или явно помечены (комментарий
  «kept for debug entry»).
- [ ] Чек-лист §16 спеки полностью пройден.
- [ ] AI command-processor поддерживает direction, pool, horizon
  + (если решено) `mark_cadence`.
- [ ] `task check` чистый.
- [ ] `npm run tauri dev` запускается, все 6 экранов работают.
- [ ] Smoke от пользователя: создал тест-сценарий «полный путь
  юзера» (Plan → Tasks → Projects → Context → Horizon → Review)
  без ошибок.
- [ ] Документация обновлена.
- [ ] Memory updates применены (см. §10).

## Что НЕ включает фаза 9

- Внедрение новых фич сверх спеки v2. Только cleanup.
- Перформанс-оптимизации (виртуализация списков, lazy-loading).
  Если очень нужно — отдельная фаза.
- iOS / Android port (Tauri 2 поддерживает, но это огромная
  задача).
- Интеграция с внешними API (calendar sync, GitHub и т.п.).
- Tailwind-миграция (отдельный план в `docs/tasks/tailwind-migration.md`).

## Ловушки

- **Удаление слишком многого.** Если что-то ещё используется
  (даже «debug-входом») — оставлять. Грепать `import` перед
  удалением.
- **Нарушение persist-first** при добавлении новых command
  actions. Каждое write должно идти через store action.
- **Memory updates после фазы.** Не забыть, иначе следующая
  сессия будет работать по старой картине.
- **Backward compat.** Если в процессе фаз меняли формат JSON-
  файлов (например, добавили поле в Block) — Zod-default
  должен дружелюбно мигрировать старые файлы. Иначе при первой
  загрузке упадёт.
- **Тестирование на чистом profile.** Удалить `data/.v2-migrated`,
  стереть `data/`, запустить — должно подняться с пустыми seed-
  файлами без падений.
