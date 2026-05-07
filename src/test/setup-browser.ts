(globalThis as { __APP_MODE__?: string }).__APP_MODE__ = "test";

import { afterEach, beforeEach } from "vitest";
import { cleanup } from "vitest-browser-react";
import { clearMocks } from "@tauri-apps/api/mocks";
import { resetAllStores } from "./stores";
import { resetServiceSingletons } from "./reset-singletons";
import { freezeClock, thawClock } from "./clock";
import { resetBuilderCounters } from "./builders";
import { installFS, VirtualFS } from "./virtual-fs";
import { flushAllWrites } from "./e2e/automation";
// Real Chromium renders the test harness without app CSS unless we
// explicitly pull it in here. Layout-dependent tests (DnD coords,
// screenshots) need the production stylesheet active.
import "../styles/globals.css";

// `test.concurrent` is forbidden in this project — module-level
// builder counters race under concurrent execution. The default
// sequential runner is the contract.

beforeEach(() => {
  resetAllStores();
  resetServiceSingletons();
  resetBuilderCounters();
  freezeClock();
  // Default to an empty VirtualFS so any boot-path invoke() call
  // hits a deterministic mock instead of crashing on a missing
  // mockIPC. Tests that need pre-seeded data call installFS(...)
  // again in the test body.
  installFS(new VirtualFS());
});

afterEach(async () => {
  // Unmount before draining writes. vitest-browser-react auto-cleans
  // in `beforeEach`, but by then resetAllStores has already wiped
  // state — open inline editors that blur during cleanup would race
  // through to writes against an empty store. Explicit cleanup here
  // unmounts while the test's stores are still live.
  cleanup();
  // Drain the five write queues before clearMocks() pulls the IPC rug.
  // Catch leaked failures so a bad test still tears down cleanly.
  await flushAllWrites().catch(() => {
    /* surfaced by the test that produced the failure */
  });
  thawClock();
  // clearMocks lives in afterEach, not afterAll — afterAll-only
  // leaves emit/listen subscribers from one test wired up while
  // the next test runs.
  clearMocks();
});
