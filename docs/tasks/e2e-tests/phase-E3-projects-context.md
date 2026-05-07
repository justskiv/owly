# Phase E3 — Projects + Context

> **Цель:** написать 8 E2E-тестов на Projects (kanban DnD,
> inline-create, popup) и Context (направления-grid, inline-edit,
> inline-create direction/project).
>
> **Результат после фазы:** `task check` гоняет 23 теста в
> `e2e-browser` (15 от E2 + 8 новых). Регрессия kanban move
> (drop не апдейтит project col field) или поломка inline-edit
> direction title — `task check` падает с понятной ошибкой.
>
> **Разделы спеки:** §4.2.3 (Projects, 4 теста), §4.2.4 (Context,
> 4 теста)
>
> **Зависимости:** E1.
> **MVP:** да.

## Контекст

Projects — kanban-доска по project entity. Активная board выбирается
из `boards.json`. DnD card между колонками (`backlog → in-progress
→ done`) пишет в `entity.fields.col` (или аналогичное поле в
`projects-helpers.ts`). Эта DnD — **HTML5 DragEvent через
`draggable=true`**, не custom pointer-capture.

Context — grid направлений, сгруппированных по area. Поддерживает
inline-edit title direction'a и inline-create новых direction'ов и
project'ов внутри direction.

Pr-2 (board tabs) и Pr-3 (cat filter) — **НЕ пишем**, покрыты
`projects-helpers.test.ts` (`applyProjectFilters`,
`projectsForBoard`). C-5 (cadence chip) тоже out — `urgency.
cadUrgClass` через `urgency.test.ts`.

## Ключевые решения

**Projects DnD — `dragWithDragEvent`.** Если в `ProjectsPage.tsx`
карточки имеют `draggable={true}` атрибут, то DnD идёт через
HTML5 `DragEvent` — `dragWithDragEvent` (обёртка над
`userEvent.dragAndDrop`) подходит. Если в реальности оказалось
pointer-capture — переключить на `dragWithPointer`.

**Inline-create через `contenteditable`.** ContextPage и `KanbanCard`
inline-edit могут использовать `contenteditable={true}` — у
`userEvent.type` на нём специфика caret-position. Тестировать
через `userEvent.type(element, "text")` + проверить
`element.textContent` после. Если flake — заменить на
`fireEvent.input(element, { target: { textContent: "x" } })`.

**Persist через `flushAllWrites()`.** Все mutating-тесты этой
фазы заканчиваются `await flushAllWrites()` + `JSON.parse(fs.read
(...))` — иначе тест проходит, но baseline-on-disk не проверен.

**Pr-1 board needs `boards.json`.** `typicalWeek` сейчас не сеет
`boards.json` (см. §4.5 спеки). Решение: добавить минимальный
`boards.json` в `typicalWeek` сценарий — один default board с
3 columns. Это меняет E1 артефакт, но изменение **локальное**
к scenario, безопасно. **Если `typicalWeek` уже его сеет** —
ничего не делать.

## Реализация

### E3.1 ProjectsPage E2E — 4 теста

`src/pages/ProjectsPage.e2e.test.tsx`:

```tsx
import { test, expect } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { Shell } from "../components/layout/Shell";
import { typicalWeek } from "../test/scenarios/typical-week";
import { installFS, getCurrentFS } from "../test/virtual-fs";
import { dragWithDragEvent } from "../test/e2e/drag";
import { flushAllWrites } from "../test/e2e/automation";
import { useEntityStore } from "../store/entities";
import { useUIStore } from "../store/ui";

async function setup() {
  installFS(typicalWeek());
  await useEntityStore.getState().loadEntities();
  // boards.json must be loaded too — check what store reads it
  useUIStore.setState({ bootReady: true, currentPage: "projects" });
  return render(<Shell />);
}

// Pr-1
test("Pr-1: renders kanban for active board", async () => {
  const screen = await setup();
  // typicalWeek seeds projects with default col=backlog
  await expect.element(
    screen.getByRole("heading", { name: /backlog/i })).toBeVisible();
  await expect.element(
    screen.getByText("Site refactor")).toBeVisible();
});

// Pr-4: drag card between columns (HTML5)
test("Pr-4: drag card between columns updates col field",
  async () => {
    const screen = await setup();
    const card = screen.getByText("Site refactor");
    const inProgressCol = screen.container.querySelector(
      '[data-column="in-progress"]') as HTMLElement;
    expect(inProgressCol).toBeTruthy();

    await dragWithDragEvent(card, inProgressCol);
    await flushAllWrites();

    const updated = useEntityStore.getState().entities
      .find((e) => e.title === "Site refactor");
    expect(updated?.fields?.col).toBe("in-progress");
  });

// Pr-5: inline create card in column
test("Pr-5: inline create card in column adds entity",
  async () => {
    const screen = await setup();
    const addButton = screen.container.querySelector(
      '[data-column="backlog"] [data-add-card]') as HTMLElement;
    await userEvent.click(addButton);

    const input = screen.getByPlaceholder(/название проекта/i);
    await userEvent.type(input, "New kanban project");
    await userEvent.keyboard("{Enter}");
    await flushAllWrites();

    expect(useEntityStore.getState().entities.some(
      (e) => e.title === "New kanban project" && e.type === "project"))
      .toBe(true);
  });

// Pr-6: click card opens entity popup
test("Pr-6: click card opens entity popup", async () => {
  const screen = await setup();
  const card = screen.getByText("Site refactor");
  await userEvent.click(card);

  await expect.element(
    screen.getByRole("dialog", { name: /site refactor/i }),
  ).toBeVisible();
});
```

**Селекторы `[data-column="..."]` и `[data-add-card]` могут не
существовать** в текущем `ProjectsPage`. Если так — добавить как
точечные правки (помечать комментом `// for E2E selector`):
- `data-column={col.id}` на каждой колонке kanban
- `data-add-card` на кнопке «+» в каждой колонке

Это **легитимные** test-friendly правки, не хак.

**Pr-4 DnD** — если HTML5 не работает (silently no-op),
переключить на `dragWithPointer`. Признак HTML5: в коде
`draggable={true}` + `onDragStart`/`onDrop` handlers. Признак
pointer-capture: `onPointerDown` + `setPointerCapture`.

### E3.2 ContextPage E2E — 4 теста

`src/pages/ContextPage.e2e.test.tsx`:

```tsx
import { test, expect } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { Shell } from "../components/layout/Shell";
import { typicalWeek } from "../test/scenarios/typical-week";
import { installFS, getCurrentFS } from "../test/virtual-fs";
import { flushAllWrites } from "../test/e2e/automation";
import { useEntityStore } from "../store/entities";
import { useUIStore } from "../store/ui";

async function setup() {
  installFS(typicalWeek());
  await useEntityStore.getState().loadEntities();
  useUIStore.setState({ bootReady: true, currentPage: "context" });
  return render(<Shell />);
}

// C-1: render direction grid grouped by area
test("C-1: renders direction grid grouped by area",
  async () => {
    const screen = await setup();
    // typicalWeek seeds direction "YouTube" (no area assigned),
    // expect default group rendering
    await expect.element(screen.getByText("YouTube")).toBeVisible();
  });

// C-2: inline edit direction title persists
test("C-2: inline edit direction title persists", async () => {
  const screen = await setup();
  const directionTitle = screen.getByText("YouTube")
    .element() as HTMLElement;
  await userEvent.click(directionTitle);
  // typically contenteditable becomes active on click
  await userEvent.keyboard("{End}");  // move caret to end
  await userEvent.type(directionTitle, " channel");
  await userEvent.keyboard("{Tab}");  // commit edit
  await flushAllWrites();

  const updated = useEntityStore.getState().entities
    .find((e) => e.id.startsWith("direction-"));
  expect(updated?.title).toBe("YouTube channel");

  const fs = getCurrentFS();
  const file = JSON.parse(
    fs.read("/tuzov-test/data/entities.json"));
  expect(file.entities.some(
    (e: { title: string }) => e.title === "YouTube channel"))
    .toBe(true);
});

// C-3: inline create new direction in section
test("C-3: inline create new direction in section",
  async () => {
    const screen = await setup();
    // assume "+" button per area or one global; uncertain — adapt
    const addButton = screen.container.querySelector(
      '[data-add-direction]') as HTMLElement;
    await userEvent.click(addButton);
    const input = screen.getByPlaceholder(/новое направление/i);
    await userEvent.type(input, "New direction");
    await userEvent.keyboard("{Enter}");
    await flushAllWrites();

    expect(useEntityStore.getState().entities.some(
      (e) => e.title === "New direction" && e.type === "direction"))
      .toBe(true);
  });

// C-4: inline create project inside direction card
test("C-4: inline create project inside direction card",
  async () => {
    const screen = await setup();
    const direction = screen.getByText("YouTube")
      .element()?.closest("[data-direction-id]") as HTMLElement;
    const addProject = direction.querySelector(
      "[data-add-project]") as HTMLElement;
    await userEvent.click(addProject);
    const input = screen.getByPlaceholder(/новый проект/i);
    await userEvent.type(input, "Inline project");
    await userEvent.keyboard("{Enter}");
    await flushAllWrites();

    const created = useEntityStore.getState().entities
      .find((e) => e.title === "Inline project");
    expect(created?.type).toBe("project");
    // Linked to YouTube direction (parent_direction_id or similar
    // — exact field name in EntitySchema TaskFields/ProjectFields)
  });
```

**Селекторы `[data-add-direction]` / `[data-direction-id]` /
`[data-add-project]`** — добавить в `ContextPage.tsx` /
`DirectionCard.tsx` если их нет, помечая комментом `// for E2E
selector`.

**Inline-edit через `contenteditable`** в C-2 — может потребовать
fallback на `fireEvent.input` если `userEvent.type` flake'ает с
caret. Решать по факту.

**Linked field** в C-4 — точное имя поля (`parent_direction_id`
или `direction_id`) — посмотреть в `schemas/entity.ts`
`ProjectFields`.

## Файлы

| Файл | Действие |
|---|---|
| `src/pages/ProjectsPage.e2e.test.tsx` | Создать (Pr-1, Pr-4, Pr-5, Pr-6) |
| `src/pages/ContextPage.e2e.test.tsx` | Создать (C-1, C-2, C-3, C-4) |
| `src/pages/ProjectsPage.tsx` или kanban-компонент | Изменить (`data-column`, `data-add-card` если нет) |
| `src/pages/ContextPage.tsx` или DirectionCard | Изменить (`data-direction-id`, `data-add-direction`, `data-add-project` если нет) |
| `src/test/scenarios/typical-week.ts` | Изменить (добавить `boards.json` если не сеется) |

## Верификация

1. `task check` зелёный.
2. `npm run test -- --project e2e-browser` показывает 23 теста
   зелёных (15 от E2 + 8 новых).
3. Pr-4 DnD стабилен 3 запуска подряд. Если flake — переключить
   helper (`dragWithDragEvent` ↔ `dragWithPointer`).
4. Если в `projects-helpers.ts` намеренно убрать `setProjectCol()`
   write — Pr-4 падает на `expect(updated?.fields?.col).toBe(...)`.
5. Если в ContextPage убрать persist на inline-edit — C-2 падает
   на проверке `fs.read(...)`.
6. C-4 created project виден на Projects screen после
   `gotoScreen(screen, "projects")` (опционально проверить).

## Заметки для реализации

- **Pr-1 boards.json sourcing.** `typicalWeek` может не сеять
  `boards.json` — если `useEntityStore` или `useBoardsStore` не
  загружается по этой причине, проверить `src/services/boards.ts`
  чтобы понять формат и добавить минимально валидную structure
  в scenario. Один board, 3 column (backlog/in-progress/done) —
  достаточно для всех 4 тестов.
- **Pr-4 DnD path** — в большинстве kanban-библиотек HTML5
  `draggable={true}` — стандартный подход. Если в коде
  `useDragControls` или подобное (Framer Motion) — это
  pointer-capture, нужен `dragWithPointer`. Прочитать
  `ProjectsPage.tsx` или `Kanban*.tsx` перед написанием теста.
- **C-2 inline-edit** — самый rep-rich тест. Если flake'ает,
  читать `tmp/research-e2e-fixtures.md` про `contenteditable`
  caret quirks в `@vitest/browser`. Альтернативный путь —
  `fireEvent.input(el, { target: { textContent: "..." } })` без
  `userEvent`.
- **C-3 / C-4 placeholders** на input полях — `getByPlaceholder
  (/новое направление/i)` etc. Если placeholder не русский в
  коде — поправить regex.
- Если в `EntitySchema` `direction.fields` структура такая что
  `parent_direction_id` живёт на `project.fields`, не на
  `direction.fields` — это нормально (project знает про
  родителя). Тест C-4 проверяет именно `created.fields.parent_*`.
- **НЕ коммитить** до smoke от юзера.
- Возможный subject (≤50):
  ```
  test(e2e): projects and context coverage
  ```
