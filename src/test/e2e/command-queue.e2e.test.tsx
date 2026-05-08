import { test, expect } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { Shell } from "../../components/layout/Shell";
import { useCommandStore } from "../../store/commands";
import { useConfigStore } from "../../store/config";
import { useEntityStore } from "../../store/entities";
import { useScheduleStore } from "../../store/schedule";
import { useUIStore } from "../../store/ui";
import { DEFAULT_CONFIG } from "../../services/defaults";
import { typicalWeek } from "../scenarios/typical-week";
import { withPendingCommands } from "../scenarios/with-pending-commands";
import {
  __processOnePendingForTests,
  __resetCommandProcessorForTests,
} from "../../services/command-processor";
import { installFS, getCurrentFS, ROOT } from "../virtual-fs";
import { flushAllWrites } from "./automation";

const WEEK = "2025-w24";

// F-9: a command file in commands/pending/ goes through parse →
// execute → move-to-done. Watcher gap is intentional (see spec): we
// drive the step manually via __processOnePendingForTests instead of
// waiting on Tauri's notify-crate FS watcher. <Shell /> is rendered,
// not <App />, so loadAll() never starts startCommandProcessor() —
// otherwise the watcher would race with the explicit call.
test("F-9: pending command processed and moved to done", async () => {
  installFS(withPendingCommands());
  // Belt-and-suspenders: beforeEach already resets the processor, but
  // unlisten() runs through Tauri's mocked event bridge, so reasserting
  // a clean state here keeps the test robust to ordering changes.
  await __resetCommandProcessorForTests();

  useConfigStore.setState({ config: DEFAULT_CONFIG });
  await useEntityStore.getState().loadEntities(DEFAULT_CONFIG.areas);
  await useScheduleStore.getState().loadWeek(WEEK);
  useUIStore.setState({ bootReady: true, currentPage: "plan" });
  render(<Shell />);

  const path = `${ROOT}/commands/pending/cmd-1.json`;
  const fs = getCurrentFS();
  expect(fs.exists(path)).toBe(true);

  await __processOnePendingForTests(path);
  await flushAllWrites();

  expect(fs.exists(path)).toBe(false);
  expect(fs.exists(`${ROOT}/commands/done/cmd-1.json`)).toBe(true);

  const block = useScheduleStore
    .getState()
    .blocks.find((b) => b.title === "Created by command");
  expect(block).toBeTruthy();

  const week = JSON.parse(fs.read(`${ROOT}/schedule/${WEEK}.json`));
  expect(
    week.blocks.some(
      (b: { title: string }) => b.title === "Created by command",
    ),
  ).toBe(true);
});

// E-33: schema-rejected pending file moves to failed/ and surfaces in
// the command store. F-9 covers the happy path; without this the
// fail() branch in command-processor.ts:206-220 (and the resulting
// addFailed dispatch on :303) is dead-coverage. The agent contract
// hinges on this — a malformed command silently swallowed would
// leave the agent thinking its instruction succeeded.
test("E-33: schema-rejected pending command lands in failed/", async () => {
  installFS(typicalWeek());
  await __resetCommandProcessorForTests();

  useConfigStore.setState({ config: DEFAULT_CONFIG });
  await useEntityStore.getState().loadEntities(DEFAULT_CONFIG.areas);
  await useScheduleStore.getState().loadWeek(WEEK);
  useUIStore.setState({ bootReady: true, currentPage: "plan" });
  render(<Shell />);

  const fs = getCurrentFS();
  // Action not in the discriminated union → CommandSchema.safeParse
  // fails → fail() runs. Choose this over a malformed-JSON case
  // because the schema branch is the more common agent-side mistake.
  const pendingPath = `${ROOT}/commands/pending/cmd-bad.json`;
  fs.write(
    pendingPath,
    JSON.stringify(
      {
        id: "cmd-bad",
        action: "unknown_action",
        timestamp: "2025-06-11T12:00:00Z",
        data: { foo: "bar" },
      },
      null,
      2,
    ),
  );

  await __processOnePendingForTests(pendingPath);
  await flushAllWrites();

  expect(fs.exists(pendingPath)).toBe(false);
  const failedPath = `${ROOT}/commands/failed/cmd-bad.json`;
  expect(fs.exists(failedPath)).toBe(true);

  // The store entry mirrors the on-disk record so the panel can
  // render it without a separate read. addFailed should have fired
  // from the fail() path.
  await expect
    .poll(() =>
      useCommandStore.getState().failed.some((r) => r.path === failedPath),
    )
    .toBe(true);
});

// E-34: clicking Retry on a failed row must move the file
// failed/ → pending/ and clear it from the store. This is the only
// recovery path for an agent client; commands.ts:125-135 implements
// it by an optimistic in-memory removal that the watcher (in prod)
// re-populates if the retry fails again. Without coverage a refactor
// of moveFile or the retry path could break recovery silently.
test("E-34: retry moves a failed command back to pending/", async () => {
  installFS(typicalWeek());
  await __resetCommandProcessorForTests();

  useConfigStore.setState({ config: DEFAULT_CONFIG });
  await useEntityStore.getState().loadEntities(DEFAULT_CONFIG.areas);
  await useScheduleStore.getState().loadWeek(WEEK);

  const fs = getCurrentFS();
  // Seed a previously-failed command directly on disk.
  // FailedCommandFileSchema is loose so we only need the required
  // fields (id, action, error, failed_at).
  const failedPath = `${ROOT}/commands/failed/cmd-retry-1.json`;
  fs.write(
    failedPath,
    JSON.stringify(
      {
        id: "cmd-retry-1",
        action: "create_block",
        error: "previous attempt failed",
        failed_at: "2025-06-11T12:00:00Z",
        data: {
          title: "Retry me",
          date: "2025-06-11",
          start: "10:00",
          duration: 60,
          category: "work",
          source_entity_id: null,
        },
      },
      null,
      2,
    ),
  );

  // Open the panel on the failed tab BEFORE render so the mount
  // effect's loadFailed call picks up our seeded file.
  useUIStore.setState({
    bootReady: true,
    currentPage: "plan",
    commandsPanelOpen: true,
    commandsPanelTab: "failed",
  });
  const screen = render(<Shell />);

  // Wait for the panel's mount effect to populate the store.
  await expect
    .poll(() => useCommandStore.getState().failed.length)
    .toBe(1);

  const retryBtn = screen.getByRole("button", { name: /retry/i });
  await userEvent.click(retryBtn);
  await flushAllWrites();

  expect(fs.exists(failedPath)).toBe(false);
  expect(
    fs.exists(`${ROOT}/commands/pending/cmd-retry-1.json`),
  ).toBe(true);

  // retryFailed clears the in-memory record optimistically.
  await expect
    .poll(() => useCommandStore.getState().failed.length)
    .toBe(0);
});
