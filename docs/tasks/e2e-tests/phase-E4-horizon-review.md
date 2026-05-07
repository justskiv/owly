# Phase E4 — Horizon + Review

> **Цель:** написать 5 E2E-тестов на Horizon (DnD из backlog в
> месяц, hide через eye, size change reorders) и Review (period
> tabs + V-2 screenshot baseline).
>
> **Результат после фазы:** `task check` гоняет 28 тестов
> (23 от E3 + 5 новых). Регрессия Horizon backlog DnD persist
> или Review summary layout — `task check` падает с понятной
> ошибкой. Новый screenshot baseline `review-summary.png` в репо.
>
> **Разделы спеки:** §4.2.5 (Horizon, 3 теста), §4.2.6 (Review,
> 2 теста), §7.2 (V-2 baseline)
>
> **Зависимости:** E1.
> **MVP:** да.

## Контекст

Horizon — экран годового планирования. `HorizonProject` имеет
`size: "big" | "mid" | "small"` (определяет ряд в grid),
`base_month` для позиционирования. Backlog-секция содержит
не-размещённые проекты; DnD из backlog в month-cell добавляет
проект в grid.

Review — итоги недели/месяца/года. Tabs переключают период.
Внутри — gauge-ы (purpose-balance, scheduled-hours и т.п.).
Покрытие math полностью у `gauge-math.test.ts` +
`review-aggregations.test.ts` — E2E проверяет только wiring (tab
switch + visual baseline).

H-1 (grid render) и H-2 (backlog render) — **НЕ пишем**, покрыты
`horizon-helpers.test.ts` + jsdom `HorizonPage.smoke.test.tsx`.
R-2 (weekly gauges) тоже out — `gauge-math.test.ts`.

## Ключевые решения

**Horizon DnD — `dragWithPointer`.** `useBacklogGesture` —
pointer-capture (как `useBlockGesture`). `userEvent.dragAndDrop`
silently no-op'ит.

**Target для H-3** — month-cell в horizon grid.
`querySelector('[data-month="2025-06"]')` или аналогичный
data-атрибут (добавить в E1 если нет; иначе в этой фазе).

**V-2 baseline** — Review summary screenshot. **Стабильность:**
gauges + статичные labels. `period=week` → `2025-w24` (frozen
clock). Никаких «Xд» и других дате-зависимых copy. Threshold
`0.005`.

**H-4 hide через eye icon** — `eye-off` button рядом с проектом
в grid. Проект пропадает из grid, появляется в deferred section.
Tест проверяет оба DOM-хода + persist.

**H-5 size change reorders rows.** Изменение `size` от `mid` →
`big` поднимает проект в верхний ряд (рост-вниз порядок:
big → mid → small). Тест проверяет DOM-порядок до/после.

## Реализация

### E4.1 HorizonPage E2E — 3 теста

`src/pages/HorizonPage.e2e.test.tsx`:

```tsx
import { test, expect } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { Shell } from "../components/layout/Shell";
import { typicalWeek } from "../test/scenarios/typical-week";
import { installFS, getCurrentFS } from "../test/virtual-fs";
import { dragWithPointer } from "../test/e2e/drag";
import { flushAllWrites } from "../test/e2e/automation";
import { useHorizonStore } from "../store/horizon";
import { useUIStore } from "../store/ui";
import { buildHorizonProject } from "../test/builders/horizon";
import { useEntityStore } from "../store/entities";

async function setup() {
  // typicalWeek seeds horizon.json with empty projects array.
  // Add 2 backlog projects + 1 in-grid for these tests.
  const fs = typicalWeek();
  const horizonContent = JSON.parse(
    fs.read("/tuzov-test/data/horizon.json"));
  horizonContent.projects = [
    buildHorizonProject({
      title: "Backlog A",
      base_month: null,  // backlog
      size: "mid",
    }),
    buildHorizonProject({
      title: "Backlog B",
      base_month: null,
      size: "small",
    }),
    buildHorizonProject({
      title: "In June",
      base_month: "2025-06-01",
      size: "big",
    }),
  ];
  fs.write("/tuzov-test/data/horizon.json",
    JSON.stringify(horizonContent, null, 2));
  installFS(fs);

  await useHorizonStore.getState().loadHorizon();
  useUIStore.setState({ bootReady: true, currentPage: "horizon" });
  return render(<Shell />);
}

// H-3: drag project from backlog into month
test("H-3: drag project from backlog adds to grid",
  async () => {
    const screen = await setup();
    const item = screen.getByText("Backlog A");
    const monthCell = screen.container.querySelector(
      '[data-month="2025-06"]') as HTMLElement;
    expect(monthCell).toBeTruthy();
    const r = monthCell.getBoundingClientRect();
    await dragWithPointer(item,
      { x: r.left + r.width / 2, y: r.top + r.height / 2 });
    await flushAllWrites();

    const updated = useHorizonStore.getState().projects
      .find((p) => p.title === "Backlog A");
    expect(updated?.base_month).toBe("2025-06-01");

    const fs = getCurrentFS();
    const file = JSON.parse(
      fs.read("/tuzov-test/data/horizon.json"));
    expect(file.projects.find(
      (p: { title: string; base_month: string | null }) =>
        p.title === "Backlog A")?.base_month).toBe("2025-06-01");
  });

// H-4: hide via eye icon moves to deferred
test("H-4: hide project moves to deferred section",
  async () => {
    const screen = await setup();
    const project = screen.getByText("In June")
      .element()?.closest("[data-project-id]") as HTMLElement;
    const hideButton = project.querySelector(
      '[data-hide-button]') as HTMLElement;
    await userEvent.click(hideButton);
    await flushAllWrites();

    const updated = useHorizonStore.getState().projects
      .find((p) => p.title === "In June");
    expect(updated?.deferred).toBe(true);

    // appears in deferred section
    const deferredSection = screen.container.querySelector(
      '[data-section="deferred"]') as HTMLElement;
    expect(deferredSection.textContent).toContain("In June");
  });

// H-5: size change reorders rows
test("H-5: size change reorders rows", async () => {
  const screen = await setup();
  const project = screen.getByText("In June")
    .element()?.closest("[data-project-id]") as HTMLElement;
  const sizeButton = project.querySelector(
    '[data-size-control]') as HTMLElement;
  // Cycle: big → mid (or whatever the UI affordance is)
  await userEvent.click(sizeButton);  // open popover/menu
  await userEvent.click(screen.getByRole("menuitem",
    { name: /small/i }));
  await flushAllWrites();

  const updated = useHorizonStore.getState().projects
    .find((p) => p.title === "In June");
  expect(updated?.size).toBe("small");

  // DOM ordering shifts — "In June" now appears in small row, not
  // big row. Easier: check size row container has it as child.
  const smallRow = screen.container.querySelector(
    '[data-row="small"]') as HTMLElement;
  expect(smallRow.textContent).toContain("In June");
});
```

**Селекторы `[data-month]`, `[data-project-id]`,
`[data-hide-button]`, `[data-size-control]`, `[data-section]`,
`[data-row]`** — добавить в `HorizonPage.tsx` /
`HorizonProjectCard.tsx` если их нет. Помечать комментом
`// for E2E selector`.

**Альтернатива selectors:** если eye-icon — `<button
aria-label="Скрыть проект">`, использовать `getByRole("button",
{ name: /скрыть/i })` без data-атрибута. Зависит от того что
уже есть в DOM.

### E4.2 ReviewPage E2E — 2 теста

`src/pages/ReviewPage.e2e.test.tsx`:

```tsx
import { test, expect } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { Shell } from "../components/layout/Shell";
import { typicalWeek } from "../test/scenarios/typical-week";
import { installFS } from "../test/virtual-fs";
import { setStoreState } from "../test/e2e/automation";
import { useUIStore } from "../store/ui";
import { useEntityStore } from "../store/entities";
import { useScheduleStore } from "../store/schedule";

async function setup() {
  installFS(typicalWeek());
  await useEntityStore.getState().loadEntities();
  await useScheduleStore.getState().loadCurrentWeek();
  useUIStore.setState({ bootReady: true, currentPage: "review" });
  return render(<Shell />);
}

// R-1: period tabs week/month/year switch content
test("R-1: period tabs switch content", async () => {
  const screen = await setup();

  // Default — week. Verify week summary visible.
  await expect.element(
    screen.getByText(/неделя/i)).toBeVisible();

  // Click "month" tab
  await userEvent.click(screen.getByRole("tab",
    { name: /месяц/i }));
  await expect.element(
    screen.getByText(/месяц/i)).toBeVisible();
  // weekly content gone — example: weekly gauge title disappears
  // (specific check depends on what differentiates the two views)

  // Click "year" tab
  await userEvent.click(screen.getByRole("tab",
    { name: /год/i }));
  await expect.element(
    screen.getByText(/год/i)).toBeVisible();
});

// R-3: V-2 visual baseline (NOT R-2 — that one is dropped)
test("R-3: review summary visual baseline", async () => {
  const screen = await setup();

  // Frozen clock = 2025-06-11 (Wed of 2025-w24).
  // typicalWeek seeds 3 blocks. Stable for screenshot.
  await expect.element(screen.container).toMatchScreenshot(
    "review-summary",
    {
      comparatorOptions: { allowedMismatchedPixelRatio: 0.005 },
    },
  );
});
```

**R-1 specifics** — текущая Review реализация может иметь tabs
с label'ами типа `Неделя/Месяц/Год` (Russian) или
`Week/Month/Year` (English). Уточнить через `screen.debug()`.
Проверить что `useUIStore` или `useReviewStore` (если есть)
имеет `period` field — после клика на tab он должен быть
обновлён.

**R-3 baseline** — первый запуск создаст
`src/pages/__screenshots__/ReviewPage.e2e.test.tsx/review-summary.png`.
Закоммитить вместе с тестом.

## Файлы

| Файл | Действие |
|---|---|
| `src/pages/HorizonPage.e2e.test.tsx` | Создать (H-3, H-4, H-5) |
| `src/pages/ReviewPage.e2e.test.tsx` | Создать (R-1, R-3) |
| `src/pages/HorizonPage.tsx` | Изменить (`data-month`, `data-section="deferred"`, `data-row` атрибуты) |
| `src/components/horizon/HorizonProjectCard.tsx` (или как называется) | Изменить (`data-project-id`, `data-hide-button`, `data-size-control`) |
| `src/pages/__screenshots__/ReviewPage.e2e.test.tsx/review-summary.png` | Создать (генерируется первым прогоном) |

## Верификация

1. `task check` зелёный.
2. `npm run test -- --project e2e-browser` показывает 28 тестов
   зелёных.
3. H-3 DnD стабилен 3 запуска подряд.
4. Если в `useHorizonStore` намеренно убрать persist на drop
   (после `setBaseMonth()`) — H-3 падает на проверке
   `fs.read(...)`.
5. Если в HorizonPage убрать `deferred` filter из grid render —
   H-4 падает (проект остаётся в grid после hide).
6. R-3 первый прогон создаёт baseline. Намеренно поменять padding
   в Review summary +2px → R-3 падает с diff-картинкой.
7. Если в Review tab переключение не пишет period в store —
   R-1 падает.

## Заметки для реализации

- **H-3 DnD стабильность** — те же риски что в E2 (P-3, P-4).
  `dragWithPointer` шлёт `pointermove` через `document` —
  должно работать с pointer-capture хуком.
- **H-4 / H-5 selectors** — самая хрупкая часть. Если в коде
  нет `data-hide-button` / `data-size-control` атрибутов и нет
  `aria-label` — добавить data-атрибуты. Если есть `aria-label`
  типа `"Скрыть проект"` — использовать `getByRole("button",
  { name: /скрыть/i })`.
- **R-1 period tab API** — может оказаться что Review не имеет
  tabs в смысле `role="tab"`, а имеет button-group или
  segmented-control. Тогда `getByText(/месяц/i)` сработает.
  Проверить через `screen.debug()`.
- **R-3 baseline создаётся** на первом запуске. Если CI/локально
  даёт разные baselines — pin к macOS + frozen viewport size в
  `vitest.config.ts` `browser.viewport: { width: 1280, height:
  720 }` (или такой, который даёт стабильный layout).
- **horizon.json structure** — при сидировании 3 проектов
  убедиться что Zod-валидация в `HorizonFileSchema` пропускает
  `base_month: null` для backlog. Если не пропускает — посмотреть
  как `seed-migration.ts` создаёт пустой `horizon.json` и
  использовать его дефолты.
- **`buildHorizonProject` builder** — ожидается из E1.6. Если
  builder не имеет нужных полей (`size`, `base_month`,
  `deferred`) — расширить до этой фазы.
- **НЕ коммитить** до smoke от юзера. Включая screenshot
  baseline (юзер должен открыть `.png` в Finder и убедиться что
  Review правда так выглядит, не пустой/не сломанный).
- Возможный subject (≤50):
  ```
  test(e2e): horizon and review coverage
  ```
