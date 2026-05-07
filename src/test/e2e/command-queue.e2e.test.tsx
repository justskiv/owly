import { test, expect } from "vitest";
import { render } from "vitest-browser-react";
import { Shell } from "../../components/layout/Shell";
import { useConfigStore } from "../../store/config";
import { useEntityStore } from "../../store/entities";
import { useScheduleStore } from "../../store/schedule";
import { useUIStore } from "../../store/ui";
import { DEFAULT_CONFIG } from "../../services/defaults";
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
  __resetCommandProcessorForTests();

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
