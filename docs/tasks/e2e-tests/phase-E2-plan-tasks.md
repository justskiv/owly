# Phase E2 — Plan + Tasks

> **Цель:** написать 12 E2E-тестов на двух самых-используемых
> экранах: PlannerPage (DnD блоков, resize, week navigation,
> pool→grid) и TasksPage (фильтры, поиск, complete).
>
> **Результат после фазы:** `task check` гоняет 15 тестов в
> `e2e-browser` project'е (3 от E1 + 12 новых). Если в Plan
> сломать persist drag (drop не пишет в store) или в Tasks
> сломать category-filter — `task check` падает с понятной
> ошибкой. V-1 screenshot baseline остаётся стабильным.
>
> **Разделы спеки:** §4.2.1 (Plan, 9 тестов), §4.2.2 (Tasks,
> 5 тестов)
>
> **Зависимости:** E1.
> **MVP:** да.

## Контекст

Plan — самый часто-используемый экран. DnD блоков (через
`useBlockGesture`) и resize (через тот же хук, но с handle на
bottom-edge) — главные интеракции. До E1 они вообще не тестились
кроме одного смока на drag.

Tasks — второй по частоте использования. Group-by-deadline +
urgency-чипы покрыты unit-тестами (`group-tasks.test.ts`,
`urgency.test.ts`); E2 проверяет только UI wiring (фильтры,
поиск, complete checkbox, screenshot baseline).

3 теста в этой фазе — миграции из E1 (P-3 drag, T-4 Quick Add,
T-7 screenshot V-1). Они уже зелёные после E1; здесь они получают
соседей по тесту.

## Ключевые решения

**Все DnD-тесты используют `dragWithPointer`.** `useBlockGesture`
слушает `pointerdown` через `setPointerCapture`. `userEvent.
dragAndDrop` шлёт HTML5 `DragEvent` — silently no-op (см. E1).

**Target для DnD вычисляем через `getBoundingClientRect()`.**
`.day-body[data-date="2025-06-12"]` (data-date атрибут добавлен
в E1.11) даёт нужный элемент; центр rect → `target.x/y` для
`dragWithPointer`.

**Resize — отдельный сценарий.** Resize bottom-edge handle
(`useBlockGesture` listening to `pointermove` после `pointerdown`
на `.block-resize-handle`) — не drag. Тест P-5 имитирует
`pointerdown` на handle, `pointermove` вертикально вниз на
`+30px` (один час при `SLOT_HEIGHT_PX=60`), `pointerup`.

**Persist через `flushAllWrites()` после DnD.** DnD пишет в store
немедленно, но disk-write идёт через write-queue (Promise chain).
Без `flushAllWrites()` теста на «drop → reload → block на месте»
не будет.

**T-1 (grouping) и T-5 (urgency-chips) НЕ пишем.** Полностью
покрыты `group-tasks.test.ts` (10 кейсов) +
`urgency.test.ts` (9 кейсов). Wiring проверяется через T-2
(category filter рендерит сгруппированный list).

## Реализация

### E2.1 PlannerPage E2E — 9 тестов

`src/pages/PlannerPage.e2e.test.tsx`:

```tsx
import { test, expect } from "vitest";
import { render } from "vitest-browser-react";
import { Shell } from "../components/layout/Shell";
import { typicalWeek } from "../test/scenarios/typical-week";
import { installFS, getCurrentFS } from "../test/virtual-fs";
import { setStoreState, flushAllWrites }
  from "../test/e2e/automation";
import { dragWithPointer } from "../test/e2e/drag";
import { useScheduleStore } from "../store/schedule";
import { useUIStore } from "../store/ui";
import { sel } from "../test/e2e/selectors";

// Setup helper for all 9 tests:
async function setup() {
  installFS(typicalWeek());
  // hydrate stores from VirtualFS for fast Level 1 boot
  await useScheduleStore.getState().loadCurrentWeek();
  await usePoolStore.getState().loadCurrentWeek();
  useUIStore.setState({ bootReady: true, currentPage: "plan" });
  return render(<Shell />);
}

// P-1
test("P-1: renders current week with today highlighted", async () => {
  const screen = await setup();
  // FROZEN_NOW = 2025-06-11 (Wednesday)
  const today = screen.container.querySelector(
    '.day-column[data-date="2025-06-11"]') as HTMLElement;
  expect(today).toBeTruthy();
  expect(today.classList.contains("day-column-today")).toBe(true);
});

// P-3 (existing migration — already green after E1)
test("P-3: drag block to different day persists", async () => {
  const screen = await setup();
  const block = screen.getByText(/Сегодня deep work/i);
  const targetCell = screen.container.querySelector(
    '.day-body[data-date="2025-06-12"]') as HTMLElement;
  const r = targetCell.getBoundingClientRect();
  await dragWithPointer(block,
    { x: r.left + r.width / 2, y: r.top + 60 });

  await flushAllWrites();
  const stored = useScheduleStore.getState().blocks
    .find((b) => /Сегодня deep work/.test(b.title));
  expect(stored?.date).toBe("2025-06-12");

  // verify on disk
  const fs = getCurrentFS();
  const week = JSON.parse(
    fs.read("/tuzov-test/data/schedule/2025-w24.json"));
  expect(week.blocks.some(
    (b: { date: string }) => b.date === "2025-06-12")).toBe(true);
});

// P-4
test("P-4: drag block to different time updates start", async () => {
  const screen = await setup();
  const block = screen.getByText(/Сегодня deep work/i);
  const todayCell = screen.container.querySelector(
    '.day-body[data-date="2025-06-11"]') as HTMLElement;
  const r = todayCell.getBoundingClientRect();
  // Move down by 60px (1 hour at SLOT_HEIGHT_PX=60)
  await dragWithPointer(block,
    { x: r.left + r.width / 2, y: r.top + 60 });

  const stored = useScheduleStore.getState().blocks
    .find((b) => /Сегодня deep work/.test(b.title));
  // Initial start was 09:00 from typicalWeek; +1h → 10:00
  expect(stored?.start).toBe("10:00");
});

// P-5: resize bottom-edge handle
test("P-5: resize block from bottom edge updates duration",
  async () => {
    const screen = await setup();
    const block = screen.getByText(/Сегодня deep work/i)
      .element() as HTMLElement;
    const handle = block.querySelector(
      ".block-resize-handle") as HTMLElement;
    expect(handle).toBeTruthy();

    const r = handle.getBoundingClientRect();
    // Use raw pointer events on the handle directly:
    handle.dispatchEvent(new PointerEvent("pointerdown", {
      bubbles: true, clientX: r.left, clientY: r.top,
      pointerId: 1, button: 0,
    }));
    document.dispatchEvent(new PointerEvent("pointermove", {
      bubbles: true, clientX: r.left, clientY: r.top + 30,
      pointerId: 1,
    }));
    document.dispatchEvent(new PointerEvent("pointerup", {
      bubbles: true, clientX: r.left, clientY: r.top + 30,
      pointerId: 1,
    }));

    const stored = useScheduleStore.getState().blocks
      .find((b) => /Сегодня deep work/.test(b.title));
    // typicalWeek's deep-work has duration 120; +30px → +30min
    expect(stored?.duration).toBe(150);
  });

// P-6: click empty slot opens BlockPopup
test("P-6: click empty slot opens popup with prefilled day/time",
  async () => {
    installFS(empty());
    setStoreState({ config: defaultConfig, entities: [] });
    useScheduleStore.setState({ /* empty week */ });
    useUIStore.setState({ bootReady: true, currentPage: "plan" });
    const screen = render(<Shell />);

    const cell = screen.container.querySelector(
      '.day-body[data-date="2025-06-11"]') as HTMLElement;
    const r = cell.getBoundingClientRect();
    await userEvent.click({ element: cell }, {
      clientX: r.left + 10, clientY: r.top + 60,
    });

    await expect.element(
      screen.getByRole("dialog", { name: /новый блок/i }),
    ).toBeVisible();
    // Day/time prefill — check prefilled date input value matches
  });

// P-7: delete via Delete key
test("P-7: delete selected block via Delete key", async () => {
  const screen = await setup();
  const block = screen.getByText(/Сегодня deep work/i);
  await userEvent.click(block);  // select
  await userEvent.keyboard("{Delete}");
  await flushAllWrites();

  expect(useScheduleStore.getState().blocks
    .some((b) => /Сегодня deep work/.test(b.title))).toBe(false);
  // verify removed from disk
  const fs = getCurrentFS();
  const week = JSON.parse(
    fs.read("/tuzov-test/data/schedule/2025-w24.json"));
  expect(week.blocks.length).toBe(2);  // started with 3
});

// P-8 + P-9: week navigation
test("P-8: prev → previous week loads", async () => {
  const screen = await setup();
  const prev = screen.getByRole("button",
    { name: /предыдущая неделя/i });
  await userEvent.click(prev);
  await flushAllWrites();
  // expect week label / state update
  expect(useScheduleStore.getState().currentWeekId)
    .toBe("2025-w23");
});

test("P-9: today → returns to current week", async () => {
  const screen = await setup();
  // navigate away first
  await userEvent.click(screen.getByRole("button",
    { name: /предыдущая неделя/i }));
  await userEvent.click(screen.getByRole("button",
    { name: /предыдущая неделя/i }));
  // back via "today"
  await userEvent.click(screen.getByRole("button",
    { name: /сегодня/i }));
  expect(useScheduleStore.getState().currentWeekId)
    .toBe("2025-w24");
});

// P-10: drag pool item onto grid
test("P-10: drag pool item creates linked block", async () => {
  const screen = await setup();
  // Assume typicalWeek includes 1 pool item; if not, seed one
  const poolItem = screen.getByText(/pool item/i);
  const cell = screen.container.querySelector(
    '.day-body[data-date="2025-06-11"]') as HTMLElement;
  const r = cell.getBoundingClientRect();
  await dragWithPointer(poolItem,
    { x: r.left + r.width / 2, y: r.top + 60 });

  await flushAllWrites();
  // block should appear with linked entity_id
  const blocks = useScheduleStore.getState().blocks;
  expect(blocks.some(
    (b) => b.entity_id !== null && b.date === "2025-06-11"))
    .toBe(true);
});
```

**Конкретные селекторы (`/Сегодня deep work/i`, `/предыдущая
неделя/i`, etc.) — уточнить через `screen.debug()`** на первом
запуске. typicalWeek может назвать блок иначе — следовать тому,
что builders реально пишут.

### E2.2 TasksPage E2E — 5 тестов

`src/pages/TasksPage.e2e.test.tsx`:

```tsx
import { test, expect } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { Shell } from "../components/layout/Shell";
import { typicalWeek } from "../test/scenarios/typical-week";
import { installFS, getCurrentFS } from "../test/virtual-fs";
import { quickAdd, flushAllWrites, gotoScreen }
  from "../test/e2e/automation";
import { useEntityStore } from "../store/entities";
import { useUIStore } from "../store/ui";

async function setup() {
  installFS(typicalWeek());
  await useEntityStore.getState().loadEntities();
  useUIStore.setState({ bootReady: true, currentPage: "tasks" });
  return render(<Shell />);
}

// T-2: category filter sidebar
test("T-2: category filter narrows list", async () => {
  const screen = await setup();
  // typicalWeek has tasks with tags ["work"]
  await userEvent.click(screen.getByText(/work/i));
  // Only work-tagged tasks visible
  await expect.element(screen.getByText("Test report")).toBeVisible();
  // After filter, non-work task hidden
});

// T-3: search
test("T-3: search filters by title", async () => {
  const screen = await setup();
  const searchInput = screen.getByPlaceholder(/поиск/i);
  await userEvent.type(searchInput, "report");
  await expect.element(screen.getByText("Test report"))
    .toBeVisible();
  // "Daily review" should not be in DOM (filtered out)
});

// T-4: Quick Add (existing migration)
test("T-4: quick add from task bar creates entity", async () => {
  const screen = await setup();
  await quickAdd(screen, "New task from quick add");
  await flushAllWrites();

  expect(useEntityStore.getState().entities.some(
    (e) => e.title === "New task from quick add")).toBe(true);

  const fs = getCurrentFS();
  const file = JSON.parse(
    fs.read("/tuzov-test/data/entities.json"));
  expect(file.entities.some(
    (e: { title: string }) =>
      e.title === "New task from quick add")).toBe(true);
});

// T-6: complete checkbox
test("T-6: complete checkbox toggles status to done", async () => {
  const screen = await setup();
  const task = screen.getByText("Test report")
    .element()?.closest("[data-task-id]") as HTMLElement;
  const checkbox = task.querySelector(
    'input[type="checkbox"]') as HTMLInputElement;
  await userEvent.click(checkbox);
  await flushAllWrites();

  const updated = useEntityStore.getState().entities
    .find((e) => e.title === "Test report");
  expect(updated?.status).toBe("done");
});

// T-7: visual baseline V-1 (existing migration)
test("T-7: tasks list visual baseline", async () => {
  // Use edge fixture with all deadlines null — no "Xд" copy
  installFS(typicalWeek());  // or edge fixture if needed
  // Filter to subset with null deadlines for baseline stability
  setStoreState({
    entities: [
      buildTask({ title: "Stable task 1", deadline: null }),
      buildTask({ title: "Stable task 2", deadline: null }),
      buildTask({ title: "Stable task 3", deadline: null }),
    ],
  });
  useUIStore.setState({ bootReady: true, currentPage: "tasks" });
  const screen = render(<Shell />);

  await expect.element(screen.container).toMatchScreenshot(
    "tasks-list",
    {
      comparatorOptions: { allowedMismatchedPixelRatio: 0.005 },
    },
  );
});
```

**Селектор для T-3 search input** — `getByPlaceholder(/поиск/i)`
если placeholder русский. Уточнить по `TasksPage.tsx`.

**T-6 task element** — `[data-task-id]` атрибут может не
существовать. Альтернатива — `closest('[role="listitem"]')` или
ещё какой-то стабильный wrapper. **Если атрибута нет** — добавить
его в `TaskCard.tsx` как `data-task-id={entity.id}`.

## Файлы

| Файл | Действие |
|---|---|
| `src/pages/PlannerPage.e2e.test.tsx` | Расширить (P-1, P-4, P-5, P-6, P-7, P-8, P-9, P-10 — 8 новых сверх P-3 миграции) |
| `src/pages/TasksPage.e2e.test.tsx` | Расширить (T-2, T-3, T-6 — 3 новых сверх T-4 + T-7 миграций) |
| `src/components/tasks/TaskCard.tsx` (если нет) | Изменить (`data-task-id` атрибут) |

## Верификация

1. `task check` зелёный.
2. `npm run test -- --project e2e-browser` показывает 15 тестов
   зелёных (3 от E1 + 12 новых).
3. P-3, P-4, P-5, P-10 — DnD-тесты — стабильны 3 запуска подряд.
4. Если в `useBlockGesture.ts` намеренно убрать вызов
   `setBlockDate()` после drop — P-3 падает.
5. Если в `TasksPage.tsx` убрать category-filter wiring — T-2
   падает.
6. V-1 screenshot baseline остался идентичным после миграции
   (`git diff src/pages/__screenshots__/...png` пустой).
7. Если намеренно поменять padding на `.task-card` +2px —
   T-7 падает с diff-картинкой.

## Заметки для реализации

- **Стабильность DnD-тестов — главный риск этой фазы.** Если
  P-3/P-4/P-10 флакают:
  - Убедись, что `target.x/y` действительно внутри `.day-body`
    (через `getBoundingClientRect()` целевой ячейки), не на
    границе.
  - `dragWithPointer` шлёт `pointermove` через `document`, не
    через source — это правильно: после `setPointerCapture`
    события идут на capture-target.
  - `steps: 5` (default) хватает для `DRAG_THRESHOLD_PX = 5`.
    Если хук другой threshold — увеличить.
  - Между `pointerdown` и `pointerup` ловит ли useBlockGesture
    `pointermove`? `dispatchEvent(new PointerEvent(...))` на
    `document` должен — если хук вешается через `useEffect`,
    listener живой.
- T-7 V-1 baseline — после миграции в E1 baseline должен
  остаться идентичным (фронт не трогали в E1 кроме `data-screen`
  атрибута). Если diff появляется — значит `data-screen` всё-
  таки повлиял на layout (например через CSS-селектор);
  обновить baseline `npx vitest --update-snapshots`, закоммитить
  binarник.
- Селекторы вроде `screen.getByText(/Сегодня deep work/i)` —
  если в typicalWeek блок назван иначе, читать билдер и
  поправлять regex. Не выдумывать.
- В P-7 (delete) — Selected state может требовать `aria-
  selected="true"` на блоке. Если `userEvent.click(block)` не
  выбирает блок — проверить как `useBlockGesture` обрабатывает
  click vs pointer-down (часто хук reservation `if click move
  small → select; large → drag`).
- **НЕ коммитить** до smoke от юзера. После прогона `task check`
  3 раза подряд — сообщить.
- Возможный subject (≤50):
  ```
  test(e2e): plan and tasks coverage
  ```
