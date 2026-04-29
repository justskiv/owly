# Pool Progress + Routine Strictness — доработка пула

> **Цель:** довести пул задач до состояния, в котором рутина «3 раза в
> неделю» работает корректно (не пропадает после первого drop'а),
> отделить семантику разных типов сущностей в пуле и расширить
> EntityEditor под новые поля рутины и проекта.
>
> **Контекст:** все основные фазы (1–6) уже выполнены. Это
> пост-релизная доработка поверх работающей системы. Меняется логика
> пула, расширяется схема рутины и проекта, в EntityEditor появляются
> новые поля.
>
> **История проработки:** см. `tmp/team-task-pool*/` — три раунда
> (изолированные углы → дебаты → peer-DM брейншторм). Архитектурные
> решения зафиксированы там; здесь — спека реализации.

---

## Концепция (TL;DR)

Пул трекает прогресс **per-type семантически**, а не унифицированно:

| Тип | Поведение в пуле |
|---|---|
| `task` | Исчезает после 1 drop (как сейчас) |
| `event` | Исчезает после 1 drop (как сейчас) |
| `contact` | Исчезает после 1 drop (как сейчас) |
| `routine` | Остаётся со счётчиком до закрытия нормы |
| `project` с `target_sessions_per_week` | Остаётся со счётчиком до закрытия |
| `project` без target | Поведение как `task` |

**Двойной индикатор для рутин** (не смешивать):
- **Counter активности** в пуле: «5 на неделе» — все блоки с этим entity.
- **Streak** в RoutineDetail: «8 недель подряд» — для strict только
  по `days[]`, для flexible — по неделям.

**Drop разрешён всегда.** Никаких блокировок, modal, toast, warning-
цвета. Только пассивные визуальные сигналы (маркер `◇` на блоке,
дифференцированный тултип).

---

## Расширения схемы

```ts
// schemas/entity.ts

routine.fields:
  + days_strict: boolean
    // default: false если days[] пуст или отсутствует;
    //          true  если days[] непуст
    // Семантика: institutional vs frequency-based привычка

  + streak_policy: "strict" | "two_day"
    // default: "two_day" (через Zod default)
    // freeze_weekly заглушка пока не вводится

  + pause_until: string | null   // ISO date
    // default: null
    // Окно «не считать эти дни в streak ни как done, ни как gap»

  + snoozed_until: string | null  // ISO date
    // default: null
    // Окно «не показывать в пуле» (UI на следующей итерации)

project.fields:
  + target_sessions_per_week?: number | null
    // default: null
    // null → поведение как task; число → счётчик
```

**НЕ меняем:**
- `Block` — `block.bonus`, `block.is_off_day` и подобное **запрещены**.
  Всё derived из `(routine.fields, block.date)`.
- `Template.blocks[*].source_routine_id` — отложено
  (миграция шаблонов на связь с рутинами в следующей итерации).

**Backward compat 100%** — все новые поля опциональные с дефолтами.

---

## Сервисы

### `services/pool-progress.ts` (новый)

```ts
type ProgressState = "below" | "exact" | "over";

type Progress = {
  used: number;
  target: number | null;
  state: ProgressState;
};

function routineProgress(e: RoutineEntity, blocks: Block[]): Progress {
  const used = blocks.filter(b => b.source_entity_id === e.id).length;
  const target = routineTarget(e.fields);
  return {
    used,
    target,
    state: target == null ? "below"
         : used <  target ? "below"
         : used == target ? "exact"
         :                   "over",
  };
}

function projectProgress(e: ProjectEntity, blocks: Block[]): Progress {
  const target = e.fields.target_sessions_per_week ?? null;
  const used = blocks.filter(b => b.source_entity_id === e.id).length;
  return {
    used,
    target,
    state: target == null ? "below"  // task-like
         : used <  target ? "below"
         : used == target ? "exact"
         :                   "over",
  };
}

function routineTarget(f: RoutineFields): number | null {
  if (f.frequency === "daily") return 7;
  return f.days?.length || null;
}
```

### `services/block-flags.ts` (новый)

```ts
function isOffDay(block: Block, routine: RoutineEntity): boolean {
  if (routine.fields.frequency === "daily") return false;  // short-circuit
  if (!routine.fields.days_strict) return false;
  return !routine.fields.days.includes(dayOfDate(block.date));
}

function isWithinPauseWindow(date: string, pauseUntil: string | null): boolean {
  return pauseUntil != null && date <= pauseUntil;
}
```

Хелпер `isOffDay` используется в **двух местах**: `Block` рисует
маркер `◇`, `routine-stats` фильтрует блоки для streak. Один источник
правды.

### `services/routine-stats.ts` (расширение)

```ts
function blockCountsForStreak(b: Block, r: RoutineEntity): boolean {
  if (b.status !== "done") return false;
  if (isWithinPauseWindow(b.date, r.fields.pause_until)) return true;
  if (!r.fields.days_strict) return true;
  return r.fields.days.includes(dayOfDate(b.date));
}

function streakWithPolicy(routine: RoutineEntity, allBlocks: Block[]): number {
  const policy = routine.fields.streak_policy ?? "two_day";

  // Для frequency=weekly/custom + flexible: streak в неделях
  if (routine.fields.frequency !== "daily" && !routine.fields.days_strict) {
    return weeklyStreak(routine, allBlocks);
  }

  // Для daily или strict: streak в днях
  switch (policy) {
    case "strict":   return strictDayStreak(routine, allBlocks);
    case "two_day":  return weeklyOrDaily(routine.fields.frequency)
                     === "weekly"
                       ? strictDayStreak(routine, allBlocks)  // weekly+two_day → fallback
                       : twoDayDayStreak(routine, allBlocks);
  }
}
```

**Решение по weekly + two_day:** для weekly/custom рутин `two_day`
интерпретируется как `strict` (нет осмысленного «1 день gap» в weekly-
расписании). Streak считается по неделям.

### `services/a11y-announce.ts` (новый)

```ts
let liveRegion: HTMLElement | null = null;

export function ensureLiveRegion(): void {
  if (liveRegion) return;
  liveRegion = document.createElement("div");
  liveRegion.setAttribute("aria-live", "polite");
  liveRegion.setAttribute("aria-atomic", "true");
  liveRegion.className = "sr-only";
  document.body.appendChild(liveRegion);
}

export function announce(text: string): void {
  if (!liveRegion) ensureLiveRegion();
  // Double rAF для Safari
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (liveRegion) liveRegion.textContent = text;
  }));
}
```

**Один глобальный** `aria-live` контейнер. Per-instance `aria-live` на
карточках — анти-паттерн (cluttering при ререндере).

---

## Селектор пула

### `store/entities.ts`

```ts
type PoolItem = {
  entity: Entity;
  progress: Progress;
  exhausted: boolean;  // true если state === "exact"
};

getPoolItems: (weekBlocks: Block[]) => PoolItem[] => {
  return get().entities
    .filter(e => e.status === "active" && POOL_TYPES.has(e.type))
    .filter(e => !isSnoozedNow(e))
    .flatMap(e => {
      switch (e.type) {
        case "task":
        case "event":
        case "contact": {
          const used = countBlocks(e.id, weekBlocks);
          if (used > 0) return [];  // исчезает после drop
          return [{ entity: e, progress: { used: 0, target: 1, state: "below" }, exhausted: false }];
        }
        case "routine": {
          const p = routineProgress(e, weekBlocks);
          return [{ entity: e, progress: p, exhausted: p.state === "exact" }];
        }
        case "project": {
          const p = projectProgress(e, weekBlocks);
          if (p.target == null && p.used > 0) return [];  // task-like
          return [{ entity: e, progress: p, exhausted: p.state === "exact" }];
        }
      }
    });
}
```

### TaskPool — partition + carry-over win

```ts
const items = useMemo(() =>
  getPoolItems(weekBlocks), [entities, weekBlocks]);

const carryIds = useMemo(() => /* существующая логика */, [...]);

const [carryOver, active, exhausted] = useMemo(() => {
  const co: PoolItem[] = [], ac: PoolItem[] = [], ex: PoolItem[] = [];
  for (const it of items) {
    if (carryIds.has(it.entity.id))      co.push(it);  // carry-over win
    else if (it.exhausted)               ex.push(it);
    else                                 ac.push(it);
  }
  return [co, ac, ex];
}, [items, carryIds]);
```

**Carry-over win при коллизии:** если рутина закрыта 3/3 на этой неделе
и одновременно зависла `planned`-блоком на прошлой — она в **carry-over
секции**, не в exhausted. Карточка обогащается сигналом «закрыта на
этой неделе» (UI-badge внутри карточки).

**Существующий баг carry-over deps (исправить заодно).** В `TaskPool.tsx`
useEffect, который вычисляет carry-over, зависит от `[currentWeek,
entities]` — **без `blocks`**. Это намеренно («`current-week block edits
don't change the set`» в комментарии), но посылка неверная:
`getCarryOverEntities` смотрит на блоки текущей недели через cache и
исключает entity, если для неё уже есть блок этой недели. После drop
из carry-over список **не пересчитывается** — задача остаётся видимой,
хотя должна была пропасть. Фикс: добавить `blocks` в deps, удалить
вводящий в заблуждение комментарий. Оба чтения идут через `week-cache`,
disk I/O нет.

---

## Визуальный язык

### Карточка `.pi` — новый правый кластер `.pi-rep`

```
┌─────────────────────────────┐
│ Японский                    │  .pi-t
│ ● growth · 30m       ● ● ○ │  .pi-m + .pi-rep
└─────────────────────────────┘
```

**Counter-блок (`.pi-rep`):**

| Тип | Условие | Visual |
|---|---|---|
| `routine` | N ≤ 4 | `● ● ○` (точки 4×4px, gap 3px, mono) |
| `routine` | N ≥ 5 | `5 на неделе` (mono, без denominator) |
| `routine` (over-plan) | used > target | точки `● ● ●` + 4-я точка вне ряда (отступ 6px, цвет `--error-soft`) |
| `project` с target | — | `2/4` (дробь, без иконки `↻`) |
| `task` / `event` / без target | — | (ничего) |

**Иконка `↻`** (lucide `repeat-2`, 10×10) — слева от counter'а для
рутин. **Не часть** counter'а.

**Цвета:**
- Заполненная точка: `--text-secondary`.
- Пустая: outline 1px `--border-subtle`, transparent fill.
- Over-plan точка: `--error-soft` (= `rgba(224,104,120,.14)`).

**Pulse при заполнении** — на **последней** точке: scale 1 → 1.4 → 1
за 200ms (`--duration-base`, `--ease-out`).

**Обоснование:** дробь `N/M` визуально сливается со streak-числом
(оба читаются как progress) и активирует goal-substitution. Slot-
метафора (точки) семантически разнесена с cumulative-streak.
Граница N=4 — Cowan 2001 (3-4 chunks foveal recognition).

### `.pi.exhausted` — состояние «закрыто на неделе»

```css
.pi.exhausted          { opacity: .55; cursor: default; }
.pi.exhausted .pi-t    { text-decoration: line-through;
                         text-decoration-color: var(--text-tertiary); }
.pi.exhausted .pi-rep::after { content: " ✓"; color: var(--success); }
```

- Не draggable (guard в `useBlockGesture`).
- Сортируется в самый низ (по `updated_at` desc внутри секции).
- Анимация перехода: ~2с in-place с line-through и ✓, потом slide-down
  в collapsed-секцию (immediate reward → archived).

### Collapsed-секция «Закрыто на неделе»

```html
<details class="pool-exhausted" open={isWeekendDay()}>
  <summary>Закрыто на неделе ({n})</summary>
  <ul>...</ul>
</details>
```

- **Asymmetric default**: Пн-Сб collapsed, Вс auto-expanded (review-
  моменте, без юзер-усилия — Michie et al. 2013, BCT #2.3).
- **Persistence**: нет. Локальный component-state. User раскрыл во
  вторник — открыто до перерендера.
- Native `<details>/<summary>` для бесплатной a11y. Triangle убрать
  (`list-style: none`, `::-webkit-details-marker { display: none }`),
  заменить на rotated chevron.

### Drag-ghost рутины

- Иконка `↻` top-right (10×10, `--text-tertiary`).
- Бейдж bottom-right:
  - `еще 3` / `еще 2` / `последний` / `сверх плана`
  - На «сверх плана»: фон `--error-soft`.

### Маркер `◇` на блоке

Только для блоков с `source_entity_id`, чья рутина имеет `days_strict:
true` И `block.date ∉ days[]`. Lucide `circle-dashed`, 10×10, цвет
`--text-tertiary`.

**Тултип** (native `title` сейчас, custom компонент — позже):
- `days_strict: false`: «Не входит в обычное расписание (Пн/Ср/Пт)»
- `days_strict: true`: «Не входит в расписание (Пн/Ср/Пт) — не зачитывается в streak»

---

## Поведение

### Drop в нецелевой день

1. Блок создаётся как обычно (`addBlock` без модификаций).
2. `isOffDay(block, routine)` возвращает `true`.
3. Block рендерит маркер `◇` + дифференцированный тултип.
4. `blockCountsForStreak` для strict-рутины возвращает `false` —
   блок **не зачитывается в streak**, но **зачитывается в counter**.

**Двойной индикатор:**
- Counter «4 на неделе» в пуле — все блоки независимо от дня.
- Streak в RoutineDetail — для strict только по `days[]`.

### Pause-mode (Zod-only в этапе 1, UI — этап 2)

`pause_until = "2026-05-12"` означает: блоки до этой даты включительно
**не считаются** в streak ни как done, ни как gap. Streak продолжается
с момента возобновления.

Это **отдельная семантика от miss** (Wood/Neal 2007, Lally 2010).
Disruption recovery ≠ выбор не делать.

UI-кнопка «Я в отъезде с X по Y» — следующая итерация. Welcome-back
прайм после истечения окна — следующая итерация (тихая строка в
RoutineDetail).

### Pulse при drop из пула

```css
.tb.just-dropped {
  animation: tb-just-dropped 200ms var(--ease-out);
}
@keyframes tb-just-dropped {
  0%   { transform: scale(1); }
  50%  { transform: scale(1.03); }
  100% { transform: scale(1); }
}
```

Класс снимается через `setTimeout(200ms)`. **Без звука.**

---

## Accessibility baseline (+0.2 дня)

1. **`aria-label` на `.pi-rep`** (динамический):
   - `state: "below"`: «Осталось сделать N раз из M на этой неделе»
   - `state: "exact"`: «<title> закрыт на неделе. M из M»
   - `state: "over"`: «<title>: M из M закрыт, плюс K сверх плана»
   - N≥5: «Сделано N раз на этой неделе»

2. **`aria-label` на `◇`-маркере** — текст из тултипа.

3. **`aria-hidden="true"`** на всех lucide-иконках в новых элементах
   (`↻`, `◇`, ChevronRight, ✓). Заодно sweep по существующим в
   TaskPool.

4. **Native `<details>/<summary>`** для collapsed-секции — VO читает
   состояние «expanded/collapsed» автоматически.

5. **Глобальный `aria-live="polite"`** singleton (см.
   `services/a11y-announce.ts`). Триггер `announce()`:
   - При drop из пула: «Японский, осталось 1 из 3 на этой неделе».
   - При закрытии (`state: "exact"`): «<title> закрыт на неделе».

VO-rotor аудит — следующая итерация.

---

## План реализации (двухэтапный)

Выбран **итеративный путь**: сначала этап 1 (минимальный счётчик),
потом этап 2 (полный визуальный язык + a11y) — после того, как с
первым этапом пожили неделю-две.

### Этап 1 (~1 день) — minimum viable

```
[+0.5d] schemas: routine.fields {days_strict, streak_policy,
                 pause_until, snoozed_until}, project.fields
                 {target_sessions_per_week}
[+0.3d] services/pool-progress.ts (routineProgress, projectProgress,
                 routineTarget)
[+0.2d] store/entities.ts: getPoolItems per-type
[+0.5d] components/planner/TaskPool.tsx: .pi-rep с точками N≤4 и
                 текстом N≥5; иконка ↻ слева; partition active vs
                 exhausted (без collapsed-секции — exhausted просто
                 в самый низ active-списка с line-through)
[+0.3d] hooks/useBlockGesture.ts: ghost с иконкой ↻ + бейдж
[+0.2d] tests на per-type поведение и over-plan
```

**После этапа 1** — юзер живёт неделю-две. Понимает, нужен ли ему
collapsed-секция, маркер на блоках.

### Этап 2 (~2.5 дня) — полный визуальный язык

```
[+0.4d] services/block-flags.ts: isOffDay (с short-circuit для daily),
                 isWithinPauseWindow
[+0.4d] services/routine-stats.ts: blockCountsForStreak с pause +
                 days_strict; streakWithPolicy (strict|two_day,
                 weekly→fallback на strict)
[+0.3d] services/a11y-announce.ts: singleton + announce()
[+0.5d] components/planner/TaskPool.tsx: collapsed <details>/<summary>
                 с asymmetric default; carry-over win + обогащение
                 «закрыта на этой»
[+0.3d] components/planner/Block.tsx: маркер ◇ + дифференцированный
                 native title тултип; aria-label
[+0.2d] hooks/useBlockGesture.ts: just-dropped pulse 200ms
[+0.2d] release-note строка в about/RoutineDetail (ack-флаг в
                 localStorage `tuzov_seen_releases`)
[+0.2d] aria-label на .pi-rep, aria-hidden sweep, announce() вызовы
[+0.5d] tests: edge-cases (daily+strict, pause window, exhausted+
                 carry-over collision, over-plan)
```

**Итого: ~3.5 дня** (этап 1 + этап 2).

---

## Дальше — P0 на следующую итерацию

После того как этапы 1 и 2 этой доработки осели, следующий пакет:

1. **EntityEditor** для всех типов.
2. **`previous_id` подход** — диалог в RoutineEditor «та же привычка с
   обновлённым расписанием, или новая?» при изменении `days[]` /
   `days_strict` / `frequency` / `default_duration` / `category`.
   Архивируем старую, `create(new, previous_id=old.id)`. Heatmap
   объединяет chain рекурсивно.
3. **Vacation-mode UI** — кнопка «Я в отъезде с X по Y» в RoutineDetail
   (устанавливает `pause_until`).
4. **Snooze UI** — кнопка «Не на этой неделе» в `.pi` (устанавливает
   `snoozed_until`).
5. **Welcome-back прайм** после истечения `pause_until` — тихая строка
   в RoutineDetail. Без CTA, dismissable.
6. **VO-аудит** как отдельная задача (rotor, lists, headings, landmarks).
7. **Custom tooltip** компонент — заменит native `title`.
8. **Миграция шаблонов** на `template.blocks[*].source_routine_id`.
9. **Project deadline-tracking** — `target_total_sessions` или
   `deadline + estimated_total_min`, прогресс к финишу проекта.
   Отдельная фича от weekly counter'а.
10. **Расширение `streak_policy` enum** — добавить `freeze_weekly` с
    реальным handler'ом.
11. **`routine.fields.identity?: string`** — короткая identity-фраза.
    Опционально, не required.
12. **Discriminated union в EntityEditor** по `entity.type` —
    показывать только релевантные `fields` для типа.

---

## Backlog (отложено надолго)

- Heatmap default last 4 weeks, opt-in на 26.
- Visual-различие в heatmap «нет данных» vs «не сделал».
- **Sunday highlight** в exhausted-секции — одна карточка с тонкой
  золотой рамкой (самый длинный streak / возвращение после паузы).
- **Counter с превышением в исторических неделях** — `≥ target` = `✓`
  без подсветки. Текущая неделя — актуально. Anti-comparison.
- **Sunday review mode** — отдельный экран с одной highlight-карточкой
  + отстающими рутинами + одним проектом с deadline.
- **Archived routines** — отдельный свёрнутый список в EntityEditor.
- **Habit stacking hint** в snap-preview при примыкании к done-блоку.
- **What-the-hell mini-метка** — при streak=0 показывать «12 ранее»
  отдельной строкой.

---

## Anti-patterns

### Поля и хранение
- ❌ `block.bonus`, `block.is_off_day`, любая денормализация на блоках.
  Всё derived из `(routine.fields, block.date)`.
- ❌ `routine.fields.days_history` / timeline в одной сущности. Open-
  ended нормализация. Версионирование через `previous_id` (см. ниже).
- ❌ `streak_policy_default_at_creation` per-routine. Мёртвый код.
- ❌ Hardcoded `RELEASE_DATE` для миграции. Streak — derived.
- ❌ Глобальный config-флаг `strict_routines`. Институциональные и
  частотные рутины — разные классы (Wood/Neal 2007).

### Визуал
- ❌ **Дробь `N/M` для routine-counter.** Сливается со streak,
  провоцирует goal-substitution (Heath/Larrick/Wu 1999).
- ❌ Цветной фон карточки рутины (фиолетовый-tinted). Конфликт с
  category-color.
- ❌ Modal/popup при drop.
- ❌ Toast при drop в нецелевой день.
- ❌ Красный цвет / shame-копирайт при miss. «You broke your streak»
  → avoidance.
- ❌ Звук по умолчанию.

### Поведение
- ❌ Жёсткий счётчик-блокировка (запрет 5-го drop при target=3).
  Identity-based habits, sprint — оба ломает.
- ❌ Жёсткий restart после disruption. Treats всё как miss.
- ❌ Soft restart с автоматическим понижением target. Identity-
  даунгрейд (Carver/Scheier).
- ❌ Universal streak-freeze без opt-in (Duolingo-style). Не различает
  miss vs disruption. Лучше явная pause.
- ❌ «Сделай вчерашнее сегодня» — долговая логика. Прошлое прошло.

### A11y
- ❌ Per-instance `aria-live` region. Cluttering при ререндере. Один
  глобальный announce-channel.
- ❌ `Math.min(used, target)` для display. Денормализация в показе.

### Копирайт и продуктовая молчаливость
- ❌ Identity-фраза в редакторе по умолчанию. Корпоративный пафос.
  Опционально, не required.
- ❌ Авто-запись в notes от системы.
- ❌ Микро-нотификации («ты сделал 4!», «больше чем на прошлой!»).
- ❌ Onboarding-цепочки. Форма должна быть self-explaining.
- ❌ Info-icons с пояснениями полей. Если нужен tooltip — поле плохо
  названо.
- ❌ Social-pressure метрики.
- ❌ Unsolicited AI suggestions. AI отвечает только на запрос.

### Заглушки
- ❌ `freeze_weekly` enum без handler'а сейчас (cut, добавим вместе с
  логикой).

---

## Критерии готовности

### Этап 1
- [ ] Рутина с `days=["mon","wed","fri"]` остаётся в пуле после первого
      drop, счётчик `● ○ ○` → `● ● ○` → `● ● ●` через 3 drop'а.
- [ ] Daily-рутина показывает «5 на неделе» (без denominator).
- [ ] Project с `target_sessions_per_week=4` показывает `2/4`.
- [ ] Project без target ведёт себя как task (исчезает после 1 drop).
- [ ] Over-plan (4 при target=3) — точки `● ● ●` + 4-я вне ряда с
      `--error-soft`.
- [ ] При `state === "exact"` карточка переходит в `.exhausted`
      (line-through, ✓), сортируется в низ.
- [ ] Удаление блока возвращает счётчик и снимает `.exhausted`.

### Этап 2
- [ ] Collapsed-секция «Закрыто на неделе (N)» — Пн-Сб свёрнута, Вс
      раскрыта.
- [ ] Strict-рутина: drop в нецелевой день → блок с маркером `◇` +
      тултип «не зачитывается в streak». В streak — не растёт.
- [ ] Flexible-рутина: drop в любой день → `◇` отсутствует, streak
      растёт.
- [ ] `pause_until` в JSON: блоки в окне не считаются ни как done, ни
      как gap.
- [ ] Carry-over collision: рутина в одной секции (carry-over win),
      обогащена сигналом «закрыта на этой».
- [ ] Pulse 200ms на блоке после drop из пула.
- [ ] VoiceOver проговаривает `.pi-rep` осмысленно (не «two slash three
      rotate»).
- [ ] Release-note строка показана один раз и помечена в localStorage.

---

## Решения по двум подвешенным вопросам

1. **`two_day` для weekly-рутин**: для `frequency` ∈ `{weekly,
   custom}` `two_day` интерпретируется как `strict` (нет осмысленного
   «1 день gap»). Streak считается по неделям. Реальный `two_day`
   работает только для `frequency: "daily"`.

2. **`used > target` визуал**: разделение на `exact` и `over`.
   `exact` → карточка в `.exhausted` (зачёркнуто, ✓, в низ).
   `over` → карточка остаётся в active с маркером «4-я точка вне ряда»
   и цветом `--error-soft`. Юзер может тащить ещё (sprint-mode).

---

## История проработки

Три раунда виртуальной команды (изолированные углы → дебаты с
rebuttals → peer-DM брейншторм без модератора). Полные материалы — в
`tmp/team-task-pool*/`. Главные находки каждого раунда:

- **R0**: F-вариант (мягкий счётчик + подсветка) и per-type логика.
- **R1+R2**: дифференцированные default'ы, derived-everything,
  отказ от миграции по дате создания.
- **R3 (брейншторм)**: pause-mode (disruption ≠ miss), counter-точки
  вместо дроби, a11y baseline, asymmetric collapsed default,
  `days_strict` по shape данных, carry-over win.

Методологический урок: дебаты сходятся на точках спора, но не дают
список слепых пятен. Для будущих архитектурных решений в TuzovOS —
после R2-консенсуса делать третий формат «найди что упустили».
