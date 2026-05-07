import { test, expect } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { format, addDays } from "date-fns";
import App from "../../App";
import { Shell } from "../../components/layout/Shell";
import { useConfigStore } from "../../store/config";
import { useEntityStore } from "../../store/entities";
import { useUIStore } from "../../store/ui";
import { DEFAULT_CONFIG } from "../../services/defaults";
import { typicalWeek } from "../scenarios/typical-week";
import { empty } from "../scenarios/empty";
import { installFS } from "../virtual-fs";
import { FROZEN_NOW } from "../clock";
import { quickAdd, gotoScreen, flushAllWrites } from "./automation";

// F-1: Cmd+N opens Quick Add no matter which screen is active. Two
// pages (horizon, review) cover the listener — Shell's keydown handler
// is global, so a regression that re-bound it to a single page would
// break this immediately.
test("F-1: Cmd+N opens Quick Add from any screen", async () => {
  installFS(typicalWeek());
  useConfigStore.setState({ config: DEFAULT_CONFIG });
  await useEntityStore.getState().loadEntities(DEFAULT_CONFIG.areas);
  useUIStore.setState({ bootReady: true, currentPage: "horizon" });
  const screen = render(<Shell />);

  await userEvent.keyboard("{Meta>}[KeyN]{/Meta}");
  await expect
    .element(
      screen.getByRole("dialog", { name: /быстрое создание/i }),
    )
    .toBeVisible();

  await userEvent.keyboard("{Escape}");
  useUIStore.setState({ currentPage: "review" });
  await userEvent.keyboard("{Meta>}[KeyN]{/Meta}");
  await expect
    .element(
      screen.getByRole("dialog", { name: /быстрое создание/i }),
    )
    .toBeVisible();
});

// F-2: full boot via <App />. quickAdd writes through the actual
// pipeline (entities-write-queue → mockIPC → VirtualFS), then nav to
// Tasks reads from the same store. Real timers — the boot effect uses
// setTimeout(16) for paint yield and setTimeout(5000) for safety, both
// of which expect.poll picks up on its own.
test("F-2: quick add task visible on Tasks", async () => {
  installFS(empty());
  const screen = render(<App />);
  await expect
    .poll(() => useUIStore.getState().bootReady, { timeout: 5000 })
    .toBe(true);

  await quickAdd(screen, "F-2 task");
  await flushAllWrites();

  await gotoScreen(screen, "tasks");
  await expect.element(screen.getByText("F-2 task")).toBeVisible();
});

// F-3: !завтра is a real tokenizer modifier (quick-add-tokenizer.ts).
// FROZEN_NOW = 2025-06-11 → tomorrow = 2025-06-12. Asserts the parsed
// deadline lands on the entity, not just that the token rendered as a
// chip. Tokenizer's full surface is covered by unit tests; this is the
// one wiring smoke that the parsed value actually reaches the store.
//
// Inline submit instead of the quickAdd helper: handleInputChange opens
// an autocomplete popover while a `!fragment` has no whitespace after
// it, and Enter then commits the popover item rather than submitting
// the form. A trailing space closes the popover so Enter submits.
test("F-3: quick add !завтра sets correct deadline", async () => {
  installFS(empty());
  useConfigStore.setState({ config: DEFAULT_CONFIG });
  await useEntityStore.getState().loadEntities(DEFAULT_CONFIG.areas);
  useUIStore.setState({ bootReady: true, currentPage: "tasks" });
  const screen = render(<Shell />);

  await userEvent.keyboard("{Meta>}[KeyN]{/Meta}");
  const dialog = screen.getByRole("dialog", {
    name: /быстрое создание/i,
  });
  const input = dialog.getByPlaceholder("Что добавить?");
  await userEvent.type(input, "Tomorrow report !завтра ");
  await userEvent.keyboard("{Enter}");
  await flushAllWrites();

  const tomorrow = format(addDays(FROZEN_NOW, 1), "yyyy-MM-dd");
  const created = useEntityStore
    .getState()
    .entities.find((e) => e.title === "Tomorrow report");
  expect(created?.deadline).toBe(tomorrow);
});
