# Phase E5 — Cross-screen + journeys

> **Цель:** написать 9 cross-screen / journey тестов: F-1..F-3
> (Quick Add из любого экрана + reload), F-8 (entity edit
> propagates), F-9 (pending command flow), J-1..J-4 (daily-use
> journeys включая persistence round-trip с реальным `<App />`).
>
> **Результат после фазы:** `task check` гоняет 37 тестов
> (28 от E4 + 9 новых). Persistence round-trip (J-3) — самый
> ценный тест для file-based product'а — зелёный с реальным
> boot, write, reset, reboot, read. F-9 ловит регрессии command-
> queue (parse + execute + move).
>
> **Разделы спеки:** §4.3 (cross-screen + journeys, 9 тестов),
> §6 (команд-очередь и persistence)
>
> **Зависимости:** E1, плюс хотя бы один из E2/E3/E4 (нужны
> фичи на которые ссылаются journeys).
> **MVP:** да.

## Контекст

Cross-screen flow + journey — самые ценные тесты для приложения с
JSON-storage. F-9 (pending command) ловит регрессии command-queue
contract (`docs/api/commands-api.md`). J-3 (persistence
round-trip) ловит регрессии read/write пайплайна целиком.

Это **тяжёлые** тесты — Level 2 boot (рендерим `<App />`,
ожидаем `bootReady`, делаем UI-flow, flush, ресетим, рендерим
снова, читаем). На каждый — 30-40 строк setup + assertion.

**Убрано из rev.1** (см. §4.3 спеки):
- F-4 (`#tag` modifier) — не существует в `quick-add-tokenizer.ts`
- F-5 (`p Test → project` type-detect) — не существует
- F-6 (Settings UI route) — нет route из Shell/TopNav
- F-7 (Cmd+Shift+E debug) — low value
- F-10 (boot-from-empty → seed-migration) — false expectation
  (`seed-migration.ts:113` копирует только если `seed-v2/` уже
  в data root)

Заменено на J-1..J-4 daily-use journeys.

## Ключевые решения

**`with-pending-commands` scenario создаём в этой фазе.** Не в
E1 — нужен только для F-9. Файл: `src/test/scenarios/with-pending-
commands.ts`. Внутри = `typicalWeek()` + 1 файл
`/tuzov-test/data/commands/pending/cmd-1.json` с валидной
`Command` (`action: "create_block"`, `payload: {...}`).

**`__processOnePendingForTests` экспорт в `command-processor.ts`.**
Делает:
1. сбрасывает `started/inflight/chain` (ради повторного вызова)
2. читает path
3. парсит `CommandFileSchema`
4. вызывает `executeCommand(cmd)`
5. переносит файл в `done/` или `failed/`

Т.е. это **execute + move**, без watcher (`notify` крейт). Watcher
gap — manual smoke от юзера.

**J-3 persistence round-trip — Level 2 boot обязателен.**
Тестируем что write → reload → read возвращает то же самое. Без
полного `<App />` boot не покрывает реальный pipeline (sandbox
guard, `cachedDataDir`, `loadAll()`). Шаги:
1. `installFS(empty())`
2. `render(<App />)` + `vi.advanceTimersByTimeAsync(20)`
3. `await poll(() => bootReady).toBe(true)`
4. `quickAdd(screen, "Persistent task")` + `flushAllWrites()`
5. `resetAllStores() + resetServiceSingletons()` (НЕ `installFS` —
   FS должна сохраниться, имитируя «реальный диск»)
6. `render(<App />)` снова + boot ждём
7. Проверяем что entity видна на Tasks

**`vi.advanceTimersByTimeAsync(20)` для App-level setTimeout'ов.**
`App.tsx:27,37` — `setTimeout(16)` paint yield + `setTimeout
(5000)` safety. Без advance — fake timers держат их.

**F-9 не использует watcher** — direct call
`__processOnePendingForTests(path)`. Watcher не покрываем (см.
§3.1.4).

## Реализация

### E5.1 `src/test/scenarios/with-pending-commands.ts`

```ts
import { typicalWeek } from "./typical-week";
import { buildCommand } from "../builders/command";
import type { VirtualFS } from "../virtual-fs";

const ROOT = "/tuzov-test/data";

export function withPendingCommands(): VirtualFS {
  const fs = typicalWeek();

  // Single create_block command awaiting processing.
  const cmd = buildCommand({
    id: "cmd-1",
    action: "create_block",
    payload: {
      title: "Created by command",
      date: "2025-06-11",
      start: "14:00",
      duration: 60,
      category: "work",
    },
  });
  fs.write(`${ROOT}/commands/pending/cmd-1.json`,
    JSON.stringify(cmd, null, 2));

  return fs;
}
```

`buildCommand` (из E1.6 `builders/command.ts`) пропускает через
`CommandFileSchema.parse(...)`.

### E5.2 `__processOnePendingForTests` export

В `src/services/command-processor.ts` добавить:

```ts
import { CommandFileSchema } from "../schemas/command";
import { readFile, moveFile } from "./file-io";
import { executeCommand } from "./command-executor";

// Test-only. Bypasses watcher; performs parse → execute → move.
// Caller must ensure mockIPC + VirtualFS are active.
export async function __processOnePendingForTests(
  path: string
): Promise<void> {
  // Reset module globals so a second test invocation starts fresh.
  started = false;
  inflight = null;
  chain = Promise.resolve();

  const text = await readFile(path);
  const cmd = CommandFileSchema.parse(JSON.parse(text));
  try {
    await executeCommand(cmd);
    const donePath = path.replace(
      "/commands/pending/", "/commands/done/");
    await moveFile(path, donePath);
  } catch (e) {
    const failedPath = path.replace(
      "/commands/pending/", "/commands/failed/");
    await moveFile(path, failedPath);
    throw e;
  }
}
```

Точные имена internal-функций (`started`, `inflight`, `chain`,
`executeCommand`, `moveFile`) — взять из текущего
`command-processor.ts` файла (см. §3.7 спеки строки 43-69).

### E5.3 `src/test/e2e/quick-add.test.tsx` — F-1, F-2, F-3

```tsx
import { test, expect } from "vitest";
import { render } from "vitest-browser-react";
import { Shell } from "../../components/layout/Shell";
import App from "../../App";
import { vi } from "vitest";
import { typicalWeek } from "../scenarios/typical-week";
import { empty } from "../scenarios/empty";
import { installFS, getCurrentFS } from "../virtual-fs";
import { quickAdd, gotoScreen, flushAllWrites }
  from "./automation";
import { useUIStore } from "../../store/ui";
import { useEntityStore } from "../../store/entities";
import { format, addDays } from "date-fns";
import { FROZEN_NOW } from "../clock";

// F-1: Cmd+N opens Quick Add from any screen
test("F-1: Cmd+N opens Quick Add from any screen", async () => {
  installFS(typicalWeek());
  await useEntityStore.getState().loadEntities();
  useUIStore.setState({ bootReady: true, currentPage: "horizon" });
  const screen = render(<Shell />);

  await userEvent.keyboard("{Meta>}[KeyN]{/Meta}");
  await expect.element(screen.getByRole("dialog",
    { name: /быстрое создание/i })).toBeVisible();
});

// F-2: Quick Add → Tasks (with Level 2 boot for full reload)
test("F-2: quick add creates task, visible on Tasks reload",
  async () => {
    installFS(empty());
    const screen = render(<App />);
    await vi.advanceTimersByTimeAsync(20);
    await expect.poll(
      () => useUIStore.getState().bootReady,
      { timeout: 3000 }).toBe(true);

    await quickAdd(screen, "F-2 task");
    await flushAllWrites();

    await gotoScreen(screen, "tasks");
    await expect.element(
      screen.getByText("F-2 task")).toBeVisible();
  });

// F-3: !завтра modifier (existing migration smoke)
test("F-3: quick add !завтра sets correct deadline", async () => {
  installFS(empty());
  useUIStore.setState({ bootReady: true, currentPage: "tasks" });
  const screen = render(<Shell />);

  await quickAdd(screen, "Tomorrow report !завтра");
  await flushAllWrites();

  const tomorrow = format(addDays(FROZEN_NOW, 1), "yyyy-MM-dd");
  const created = useEntityStore.getState().entities
    .find((e) => e.title === "Tomorrow report");
  expect(created?.deadline).toBe(tomorrow);
  // Tokenizer fully covered by quick-add-tokenizer.test.ts; this
  // is wiring smoke only.
});
```

### E5.4 `src/test/e2e/popup-flow.test.tsx` — F-8

```tsx
test("F-8: entity popup edit propagates across screens",
  async () => {
    installFS(typicalWeek());
    await useEntityStore.getState().loadEntities();
    useUIStore.setState({ bootReady: true, currentPage: "tasks" });
    const screen = render(<Shell />);

    await userEvent.click(screen.getByText("Test report"));
    const dialog = screen.getByRole("dialog",
      { name: /test report/i });
    const titleInput = dialog.getByPlaceholder(/название/i);
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, "Test report (edited)");
    await userEvent.keyboard("{Tab}");
    await flushAllWrites();

    // Close popup (Escape or click outside)
    await userEvent.keyboard("{Escape}");

    // Switch to Projects/Plan — wherever this entity is referenced
    await gotoScreen(screen, "projects");
    // If "Test report" is project (not task), it shows here. If
    // it's a task — switch to Plan and check pool/block titles.
    // Adapt to typicalWeek's entity types.

    // Verify in store
    const updated = useEntityStore.getState().entities
      .find((e) => e.id.startsWith("task-1"));  // first task
    expect(updated?.title).toBe("Test report (edited)");
  });
```

### E5.5 `src/test/e2e/command-queue.test.tsx` — F-9

```tsx
import { withPendingCommands } from "../scenarios/with-pending-commands";
import { __processOnePendingForTests }
  from "../../services/command-processor";

test("F-9: pending command processed and moved to done",
  async () => {
    installFS(withPendingCommands());
    await useEntityStore.getState().loadEntities();
    await useScheduleStore.getState().loadCurrentWeek();
    useUIStore.setState({ bootReady: true, currentPage: "plan" });
    const screen = render(<Shell />);

    const fs = getCurrentFS();
    expect(fs.exists(
      "/tuzov-test/data/commands/pending/cmd-1.json")).toBe(true);

    await __processOnePendingForTests(
      "/tuzov-test/data/commands/pending/cmd-1.json");
    await flushAllWrites();

    // pending file gone, done file present
    expect(fs.exists(
      "/tuzov-test/data/commands/pending/cmd-1.json")).toBe(false);
    expect(fs.exists(
      "/tuzov-test/data/commands/done/cmd-1.json")).toBe(true);

    // block created in store and on disk
    const block = useScheduleStore.getState().blocks
      .find((b) => b.title === "Created by command");
    expect(block).toBeTruthy();

    const week = JSON.parse(
      fs.read("/tuzov-test/data/schedule/2025-w24.json"));
    expect(week.blocks.some(
      (b: { title: string }) =>
        b.title === "Created by command")).toBe(true);
  });
```

### E5.6 `src/test/e2e/journeys.test.tsx` — J-1..J-4

```tsx
// J-1: morning ritual
test("J-1: morning ritual — today blocks visible, drag pool to today",
  async () => {
    installFS(typicalWeek());
    await Promise.all([
      useScheduleStore.getState().loadCurrentWeek(),
      usePoolStore.getState().loadCurrentWeek(),
    ]);
    useUIStore.setState({ bootReady: true, currentPage: "plan" });
    const screen = render(<Shell />);

    // verify today's deep work block visible
    await expect.element(screen.getByText(/Сегодня deep work/i))
      .toBeVisible();

    // drag pool item (assume typicalWeek seeds one) onto today
    const poolItem = screen.getByText(/pool item/i);
    const todayCell = screen.container.querySelector(
      '.day-body[data-date="2025-06-11"]') as HTMLElement;
    const r = todayCell.getBoundingClientRect();
    await dragWithPointer(poolItem,
      { x: r.left + r.width / 2, y: r.top + 60 });
    await flushAllWrites();

    expect(useScheduleStore.getState().blocks
      .some((b) => b.date === "2025-06-11" && b.entity_id))
      .toBe(true);
  });

// J-2: nightly review — mark blocks done, check Review gauges
test("J-2: nightly review — done blocks update Review gauges",
  async () => {
    installFS(typicalWeek());
    await Promise.all([
      useScheduleStore.getState().loadCurrentWeek(),
      useEntityStore.getState().loadEntities(),
    ]);
    useUIStore.setState({ bootReady: true, currentPage: "plan" });
    const screen = render(<Shell />);

    // mark today's block as done (right-click → done, or whatever
    // the affordance is — check PlannerPage UI)
    const block = screen.getByText(/Сегодня deep work/i);
    // ...mark-done flow specific to UI...
    await flushAllWrites();

    // navigate to Review
    await gotoScreen(screen, "review");
    // verify gauge updated — exact assertion depends on UI
    // (e.g., "Выполнено: 1 из 3")
    await expect.element(
      screen.getByText(/выполнено/i)).toBeVisible();
  });

// J-3: persistence round-trip (THE most valuable test)
test("J-3: persistence round-trip via reload", async () => {
  installFS(empty());
  let screen = render(<App />);
  await vi.advanceTimersByTimeAsync(20);
  await expect.poll(
    () => useUIStore.getState().bootReady,
    { timeout: 3000 }).toBe(true);

  await quickAdd(screen, "Persistent task");
  await flushAllWrites();

  const fs = getCurrentFS();
  const file = JSON.parse(
    fs.read("/tuzov-test/data/entities.json"));
  expect(file.entities.some(
    (e: { title: string }) =>
      e.title === "Persistent task")).toBe(true);

  // simulate reload — keep VirtualFS, reset stores + singletons
  resetAllStores();
  resetServiceSingletons();
  screen.unmount();
  screen = render(<App />);
  await vi.advanceTimersByTimeAsync(20);
  await expect.poll(
    () => useUIStore.getState().bootReady,
    { timeout: 3000 }).toBe(true);

  await gotoScreen(screen, "tasks");
  await expect.element(
    screen.getByText("Persistent task")).toBeVisible();
});

// J-4: week navigation boundary
test("J-4: prev → next → today preserves data", async () => {
  installFS(typicalWeek());
  await useScheduleStore.getState().loadCurrentWeek();
  useUIStore.setState({ bootReady: true, currentPage: "plan" });
  const screen = render(<Shell />);

  expect(useScheduleStore.getState().currentWeekId).toBe("2025-w24");

  // go to prev week (loads 2025-w23, may create empty week file)
  await userEvent.click(screen.getByRole("button",
    { name: /предыдущая неделя/i }));
  await flushAllWrites();
  expect(useScheduleStore.getState().currentWeekId).toBe("2025-w23");

  // forward to next (back to w24)
  await userEvent.click(screen.getByRole("button",
    { name: /следующая неделя/i }));
  await flushAllWrites();
  expect(useScheduleStore.getState().currentWeekId).toBe("2025-w24");

  // verify original blocks still intact (not lost on nav)
  expect(useScheduleStore.getState().blocks.length).toBe(3);

  // back to today (should already be on w24)
  await userEvent.click(screen.getByRole("button",
    { name: /сегодня/i }));
  expect(useScheduleStore.getState().currentWeekId).toBe("2025-w24");
});
```

**J-2 mark-done UX** — точный flow зависит от
`PlannerPage`/`BlockPopup`. Если нет button «mark done» —
проверить есть ли double-click → done или checkbox. Адаптировать.

**J-3 `screen.unmount()`** — `vitest-browser-react`
`RenderResult` имеет `unmount()`; если нет — оставить старый
DOM mounted, новый `render(<App />)` создаст рядом второй tree
(не идеально, но для теста ок).

## Файлы

| Файл | Действие |
|---|---|
| `src/test/scenarios/with-pending-commands.ts` | Создать |
| `src/services/command-processor.ts` | Изменить (`__processOnePendingForTests` export) |
| `src/test/e2e/quick-add.test.tsx` | Создать (F-1, F-2, F-3) |
| `src/test/e2e/popup-flow.test.tsx` | Создать (F-8) |
| `src/test/e2e/command-queue.test.tsx` | Создать (F-9) |
| `src/test/e2e/journeys.test.tsx` | Создать (J-1, J-2, J-3, J-4) |

## Верификация

1. `task check` зелёный.
2. `npm run test -- --project e2e-browser` показывает 37 тестов
   зелёных.
3. F-9: запустить 3 раза подряд — стабильно. Если в `command-
   processor.ts` поломать parse-error path (выкинуть `try/catch`)
   — тест ловит регрессию (cmd попадает в `failed/` вместо `done/`,
   ассерт падает).
4. J-3 round-trip: запустить 3 раза — стабильно. Если в
   `entities-write-queue.ts` намеренно убрать flush на quit —
   J-3 второй render не видит entity.
5. Если в `App.loadAll()` вычистить `loadEntities()` вызов —
   J-3 второй render показывает пустой Tasks → тест падает.
6. `__processOnePendingForTests` после первого вызова — модул-
   глобалы сброшены, second invocation работает (специфика
   command-processor module-state).
7. F-2 (Level 2 boot) проходит без `vi.advanceTimersByTimeAsync`
   таймаута — если падает с timeout, увеличить до 50 или
   проверить что `App.tsx` setTimeout-ы не больше 20мс на
   первой итерации.

## Заметки для реализации

- **J-3 — самый ценный тест.** Если он зелёный после намеренной
  поломки в любом из write-pipeline (queue, atomic-rename,
  schema), считать что E2E своё дело сделал.
- **F-9 watcher gap.** Тест НЕ покрывает реальный watcher
  (fsevents → notify → debounce). Если в `command-processor.ts`
  watcher-side debounce сломан, F-9 не поймает. Это документировано
  как acknowledged tradeoff.
- **J-2 mark-done flow** — самый рискованный по селекторам.
  Прочитать `PlannerPage.tsx` / `BlockPopup.tsx` / `useBlockGesture`
  перед написанием. Если flow неудобен для теста (нужно открыть
  popup → жмякнуть кнопку → закрыть) — упростить через
  store-direct: `useScheduleStore.getState().updateBlock(id,
  { status: "done" })`. Это ок — мы тестируем что Review читает
  store, не UX mark-done (это P-7 уровня).
- **J-4 week navigation** — `loadCurrentWeek()` для нового недели
  при первом обращении создаёт пустой week-файл (если
  `readJsonFileOrCreate`). Тест проверяет что в w23 нет ошибок и
  что w24 остаётся целой.
- **`__processOnePendingForTests`** — единственная test-only
  утечка в продовый сервис. Помечаем комментом
  `// only for src/test/** — do not call from prod`. ESLint
  правило запрета вызова из `src/**/!(test)/**` — backlog.
- Если F-3 `!завтра` падает — значит `quick-add-tokenizer.ts`
  не умеет этот modifier. Тогда F-3 = wiring-смок, не feature
  test. Поставить smoke вместо feature и прокомментировать.
- **НЕ коммитить** до smoke от юзера. Включая screenshots если
  они появились (не должны — V-2 в E4).
- Возможный subject (≤50):
  ```
  test(e2e): cross-screen and journey flows
  ```
