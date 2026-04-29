# Phase 2 — Quick Add (Cmd+N) + Toast v2

> **Цель:** реализовать глобальный **Quick Add overlay** (`Cmd+N`),
> заменяющий зов `EntityEditor` для быстрого создания. Привести
> `Toast` к виду из спеки и подготовить базовый `EntityPopup`
> (компонент будущих фаз). `Cat Picker Popup` сознательно
> отложен в фазу 3 — он живёт только внутри task bar (на Tasks
> экране).
>
> **Результат после фазы:** на любом табе нажимаю `Cmd+N` или
> кнопку `+` в Top Nav → появляется overlay с input, точками
> категорий и тогглами типов. Ввожу название, опционально
> `!завтра`, выбираю категорию и тип, Enter → toast «✓ {title}»,
> сущность создана и видна в `entities.json`. Escape /
> click outside / повторный Cmd+N — закрывают.

## Контекст

Прочитай:

- `spec.md` §10.1 (Quick Add), §10.2 (Cat Picker Popup),
  §10.3 (Entity Popup — общий каркас, конкретные case'ы будут в
  3, 4, 5), §10.4 (Toast).
- `pool-planner-demo-v2.html` — функции `openQuickAdd`,
  `closeQuickAdd`, `submitQuickAdd`, обработчики inline modifiers.
- `spec/tuzov-os/v2/phases/01-phase-1-foundation.md` (предыдущая).

## Что в фазе

### 1. Сервис parsing inline modifiers

Новый файл `src/services/quick-add-parser.ts`:

```ts
export interface ParsedQuickAdd {
  title: string;       // без модификаторов
  deadline: string | null;  // ISO date "2026-04-30"
}

// !завтра, !послезавтра, !MM.DD → deadline в текущем году.
// !2026-12-31 — full ISO.
// Принимает дату. Если передан baseDate — отсчёт от него (для
// тестов; в проде — new Date()).
export function parseQuickAdd(input: string, baseDate?: Date): ParsedQuickAdd;
```

Тесты на парсер (vitest): «Купить молоко !завтра» → title «Купить
молоко», deadline = today+1. «!послезавтра» / «!05.15» / «!2026-12-31».

> Спека §10.1 говорит: `@work` — category — **planned, не
> реализовано в моке**. На фазе 2 тоже **не делаем** — категория
> только через клик по точкам.

### 2. Zustand UI state для Quick Add

В `src/store/ui.ts` добавить:

```ts
interface QuickAddState {
  open: boolean;
  // Только при open: true:
  type?: "task" | "project" | "direction";  // выбранный тип
  category?: string;                         // area id
  // Сохраняем последний выбор пользователя — чтобы при следующем
  // открытии префиллить:
  lastCategory?: string;
}

quickAdd: QuickAddState;

openQuickAdd: (defaultType?: "task"|"project"|"direction") => void;
closeQuickAdd: () => void;
setQuickAddType: (t: "task"|"project"|"direction") => void;
setQuickAddCategory: (cat: string) => void;
```

Логика `openQuickAdd`:
- Если `defaultType` не передан, берётся из текущего `currentPage`:
  - `plan` → `"task"` (спека §10.1: pool тип не имеет обработчика,
    fallback на task).
  - `tasks` → `"task"`.
  - `projects` → `"project"`.
  - `context` → `"direction"`.
  - `horizon` → `"project"`.
  - `review` → `"task"`.
  - `entities`/`dashboards` → `"task"` (fallback).
- Категория — `lastCategory ?? первая area из config`.

### 3. Компонент `QuickAdd` overlay

Новый файл `src/components/quick-add/QuickAdd.tsx`.

CSS-классы (в `globals.css`, токены из спеки §10.1):
- `.qa-overlay` — `position: fixed; inset: 0`,
  `background: rgba(0,0,0,.35)`, `padding-top: 80px`,
  `justify-content: center`, `z-index: 300`,
  `animation: qaFadeIn 0.12s`.
- `.qa-bar` — `width: 520px`, `background: var(--bg-surface)`,
  `border: 1px solid var(--border-hover)`,
  `border-radius: var(--radius-lg)`, `padding: 14px`,
  `box-shadow: 0 16px 48px rgba(0,0,0,.5)`.
- `.qa-input-row` — flex row.
- `.qa-input` — flex 1, font 14, transparent bg.
- `.qa-submit` — кнопка `↵`, square 28, accent on hover.
- `.qa-meta` — line под input: «⌘N · Тип: Задача» (статичная).
- `.qa-extras` — flex row, gap 8: dots слева, `|` separator,
  toggles справа.
- `.qa-cat-dot` — `20×20px`, `border-radius: 50%`,
  `border: 2px solid transparent`. Hover: `transform: scale(1.15)`.
  Selected (`.on`): `border: 2px solid transparent` (НЕ белый!),
  `transform: scale(1.25)`, `::after` с `✓` (10px, белый, bold,
  text-shadow). См. чек-лист спеки §16: «Category dots:
  scale(1.25) + ✓, без border, без glow».
- `.qa-toggle` (alias `qa-opt`) — pill button, padding 3 8, font
  10, accent border + color when `.on`.

Поведение:
- Открывается с focus в input.
- Точки категорий — клик переключает `category`.
- Тогглы типов — клик переключает `type`.
- **Hint «Тип: {label}» — устанавливается при открытии и НЕ
  обновляется при переключении type toggle** (см. спеку §10.1
  нюанс: «hint остаётся стабильным»). Это не баг мока, а
  осознанный UX-выбор: подпись говорит «по контексту экрана»,
  переключение — это override без перерисовки подписи.
- Inline modifiers подсвечиваются прямо в input (опционально, но
  спека про подсветку не настаивает; если сложно — пропускаем).
- Enter → submit:
  - Парсим input через `parseQuickAdd`.
  - Если title пустой — просто закрываем.
  - Создаём entity нужного типа (через `useEntityStore.addEntity`).
  - Показываем toast «✓ {title}».
  - Закрываем overlay.
- Escape → закрыть, не сохраняя.
- Click outside `.qa-bar` (но внутри `.qa-overlay`) → закрыть.
- Cmd+N (повторно) → закрыть.

### 4. Hotkey

В `src/hooks/useGlobalHotkeys.ts` (новый файл — возможно в
`Shell.tsx` уже есть useEffect, расширить или вынести):

```ts
// Cmd+N / Ctrl+N
if ((e.metaKey || e.ctrlKey) && e.code === "KeyN") {
  e.preventDefault();
  if (useUIStore.getState().quickAdd.open) {
    useUIStore.getState().closeQuickAdd();
  } else {
    useUIStore.getState().openQuickAdd();
  }
}
```

> Уже есть native macOS menu с пунктом `new-block` → Cmd+N. Нужно
> переопределить: вместо `requestNewBlock` (который открывает
> старый BlockEditor только на Plan экране) — `openQuickAdd()`
> на любом экране. Менять в `App.tsx` обработчике `menu` (строки
> ~98-100). Старый `requestNewBlock` оставить как trigger
> внутри Plan (фаза 6 решит окончательно).

### 5. Cat Picker Popup — отложен

Cat Picker Popup из §10.2 в этой фазе **не делаем**. Он живёт
только внутри task bar dual-mode на экране Tasks (фаза 3) — там
и реализуется. В Quick Add overlay точки сами кликабельны и не
требуют отдельного выпадающего; tooltip с label показываем через
`data-tooltip` атрибут на каждой точке + CSS-правило `::after`.

### 6. Toast v2

В `src/components/shared/Toast.tsx` (или где он сейчас) привести к
виду §10.4:

- `position: fixed; bottom: 24; left: 50%; transform: translateX(-50%)`.
- `background: var(--bg-tint-2)`, `border: 1px solid var(--border-hover)`,
  `border-radius: var(--radius-md)`, `padding: 8 16`.
- Содержимое: dot (6×6, цвет категории, fallback `work`) + текст.
- `font-size: var(--fs-xs)`, `box-shadow: 0 8px 24px rgba(0,0,0,.4)`.
- Auto-hide 2200ms.
- При показе нового — предыдущий удаляется.

Если текущий Toast уже близок к этому — корректируем; если сильно
отличается — переписываем.

API:

```ts
// src/services/toast.ts (или store/ui)
export function showToast(message: string, opts?: { category?: string }): void;
```

`category` опционален — для цвета точки.

Заменить все вызовы `showToast` в коде, чтобы передавали category
там, где это очевидно (создание entity → category = entity.tags[0]).

### 7. EntityPopup — общий каркас

Новый файл `src/components/shared/EntityPopup.tsx`.

На фазе 2 — **только каркас и позиционирование**. Конкретное
содержимое (поля по типу) — фаза 3 (task), фаза 4 (project), фаза
5 (direction).

CSS:
- `.entity-popup` — fixed, z-index 280, width 260, bg `--bg-surface`,
  border 1px `--border-hover`, border-radius 12, padding 14,
  box-shadow `0 12px 36px rgba(0,0,0,.5)`, animation `popIn 0.12s`.

Props:

```ts
interface EntityPopupProps {
  entityId: string;
  anchor: { type: "rect"; rect: DOMRect } | { type: "point"; x: number; y: number };
  position: "below" | "right";
  onClose: () => void;
  children: React.ReactNode;
}
```

Логика позиционирования:
- `below`: top = `anchor.bottom + 4`, left = `anchor.left`.
  Если выходит за нижний край viewport → flip вверх (`bottom =
  anchor.top - 4`).
- `right`: top = `anchor.top`, left = `anchor.right + 8`.
  Если выходит за правый край → flip влево.
- Auto-clamp в viewport (минимум 8px от края).

Закрытие:
- Кнопка `×` (children отвечает за её рендеринг).
- Click outside (в `useEffect` ставим listener на document
  `mousedown`, с задержкой 50ms через setTimeout, чтобы клик,
  открывший попап, не закрыл его сразу).
- Escape (через `useEscape` хук — уже есть).

State в `ui.ts`:

```ts
type EntityPopupState =
  | { open: false }
  | {
      open: true;
      entityId: string;
      anchor: { type: "rect"; rect: DOMRect } | { type: "point"; x: number; y: number };
      position: "below" | "right";
    };

entityPopup: EntityPopupState;
openEntityPopup: (
  entityId: string,
  anchor: EntityPopupState extends { open: true } ? EntityPopupState["anchor"] : never,
  position: "below" | "right"
) => void;
closeEntityPopup: () => void;
```

> EntityPopup для разных типов сущности будет иметь разное
> содержимое. Чтобы не дублировать обвязку, каркас принимает
> children, а конкретный «вид» (TaskFields, ProjectFields,
> DirectionFields) приходит из соответствующих компонент в
> фазах 3–5.

В фазе 2 — только тестовый smoke: открыть EntityPopup из старой
EntitiesPage клика по строке (опционально) — этим просто
проверяем, что каркас работает. Если не успеваем — фазу 3 это
покроет.

### 8. Изменения в существующем коде

- `App.tsx`: обработчик menu `new-block` → `openQuickAdd()`.
- `Shell.tsx` (или новый `useGlobalHotkeys`): Cmd+N hotkey.
- `TopNav.tsx` (из фазы 1): кнопка `+` → `openQuickAdd()` вместо
  `openEntityEditorNew("task")`.
- В `useUIStore`: новые полей и actions из секций 2, 7.

### 9. Создание сущностей через Quick Add

В `src/services/quick-add-create.ts`:

```ts
export async function createFromQuickAdd(input: ParsedQuickAdd, opts: {
  type: "task"|"project"|"direction";
  category: string;
}): Promise<Entity>;
```

Внутри:
- Соответствующий `addEntity` из `useEntityStore`.
- Дефолты:
  - **task**: priority `"medium"`, status `"active"`, tags `[category]`,
    deadline = `input.deadline`.
  - **project**: tags `[category]`, status `"active"`,
    `fields.board_id = "brd3"`, `fields.column_index = 0`,
    `fields.direction_id = null`. Это совпадает со спекой §6.4
    (defaults для Quick Add: `bid: 'brd3', col: 0`).
  - **direction**: tags `[category]`, status `"active"`,
    `fields = { target: null, current: null, progress: null,
    cadence: null, last_act: null, cadence_label: null }`.

`source_kind` для последующего pool integration в фазах 5/6 — не
указывается (это про pool items, не про entities).

## Acceptance criteria

- [ ] `Cmd+N` (или `Ctrl+N` на Linux/Win) открывает Quick Add
  overlay на любом из 8 экранов.
- [ ] Кнопка `+` в Top Nav открывает Quick Add.
- [ ] Default тип определяется по экрану: на Plan → task, на
  Tasks → task, на Projects → project, на Context → direction,
  Horizon → project, Review → task.
- [ ] Точки категорий показывают доступные areas из `config.json`
  (без хардкода 5).
- [ ] Тогглы типов: Задача / Проект / Направление. Клик
  переключает.
- [ ] Hint обновляется при переключении типа.
- [ ] Ввести «Купить молоко !завтра» → Enter → создаётся task с
  deadline = завтра, появляется toast «✓ Купить молоко».
- [ ] Ввести «Новый ролик» при типе «Проект» → создаётся project
  с board_id=brd3, column_index=0.
- [ ] Ввести «YouTube» при типе «Направление» → создаётся
  direction.
- [ ] Escape / click outside / повторный Cmd+N — закрывают
  overlay.
- [ ] Toast: dot + текст, нижний центр, исчезает через 2.2s,
  предыдущий toast удаляется при показе нового.
- [ ] EntityPopup каркас существует, импортируется без ошибок.
  Smoke-точка входа: при двойном клике на блок в старом
  Planner вместо BlockEditor открывается EntityPopup (с
  заглушкой содержимого «фаза 3 наполнит для task»). Этот
  smoke-вход доказывает, что каркас работает; в фазе 3 заглушка
  заменяется на реальные поля.
- [ ] Edge case: пустой `config.areas` → Quick Add показывает
  сообщение «Сначала добавьте области в Settings» и блокирует
  создание (без падения).
- [ ] Никаких регрессий: старый Planner всё ещё работает.
- [ ] `task check` проходит.
- [ ] Vitest на `quick-add-parser.ts` — все кейсы зелёные.

## Тест-план (smoke от пользователя)

1. **Cmd+N на каждом экране.** Открыть Plan → Cmd+N → видишь
   overlay с тип=task. Закрыть Esc. Перейти на Context → Cmd+N
   → тип=direction.
2. **Inline modifier.** На Tasks → Cmd+N → ввести «Тест задача
   !завтра» → Enter. Проверить в `data/entities.json`: появилась
   запись `type: "task"`, `deadline: "<завтра ISO>"`,
   `tags: ["<последняя выбранная категория>"]`.
3. **Toggle типа.** Cmd+N → переключить на Direction → ввести
   «Новое направление» → Enter. Проверить: создан direction.
4. **Escape / click outside.** Открыть Cmd+N, ввести что-то, но
   нажать Escape → ничего не создалось. Снова — кликнуть в overlay
   за пределами bar → тоже закрылось.
5. **Toast.** Создать через Cmd+N — увидеть toast снизу. Сразу
   создать ещё одну — старый исчез, появился новый.
6. **Кнопка +.** Клик по `+` в Top Nav на разных экранах — то же
   поведение, что и Cmd+N.
7. **Регрессия Planner.** Открыть Plan tab → создать блок через
   inline create в сетке (старый flow) → работает как раньше.

## Что НЕ включает фаза 2

- Поля Entity Popup для конкретных типов — фазы 3 (task), 4
  (project), 5 (direction).
- Cat Picker Popup как отдельный standalone компонент — фаза 3
  (там task bar его использует).
- Создание `routine`/`event`/`contact`/`goal`/`note`/`metric`
  через Quick Add — нет, только task/project/direction. Старые
  типы создаются через debug Cmd+Shift+E → старая EntitiesPage.
- Inline modifier `@work` для категории — спека §10.1 явно
  говорит «planned, не реализовано в моке». Не делаем.
- Подсветка модификаторов в input (как в search-engine highlights)
  — nice-to-have, отложено.
- Авто-сохранение черновика Quick Add — нет (Escape отменяет).

## Ловушки

- **Cmd+N конфликт с native menu.** В фазе 1 возможно остался
  native menu пункт «new-block» с accelerator `Cmd+N`. Если
  оставлять — нужно убедиться, что он диспатчит `openQuickAdd`,
  не `requestNewBlock`. Альтернатива: сделать пункт «New» (cmd+n)
  диспатчащим `openQuickAdd`, и удалить старый «new-block». См.
  `src-tauri/src/menu.rs` (или где лежит).
- **Двойное срабатывание Cmd+N.** В StrictMode useEffect
  дублирует listener'ы. Использовать паттерн `cancelled` flag
  как в `App.tsx` (см. lines 79–82, 117–123).
- **Persist-first.** `createFromQuickAdd` сначала пишет в
  `entities.json` через `useEntityStore.addEntity`, потом
  показывает toast. Если запись падает — toast не показывается,
  ошибка наружу через `JsonReadError` уже есть.
- **`!завтра` тайм-зона.** Парсер использует local time, не UTC.
  ISO без time-part: «2026-04-30». Обернуть `new Date()` через
  `getStartOfDay()` (новая утилита в `src/services/time-utils.ts`,
  возвращает Date с обнулённым временем в local TZ) — иначе
  около полуночи возможен off-by-one в deadline.
- **Категория «area» из config.** Если у юзера в `config.areas`
  нет областей вообще (пустой массив) — Quick Add должен
  показать сообщение «Сначала добавьте области в Settings» и
  не давать создать. Реалистичный edge case (новый юзер).
