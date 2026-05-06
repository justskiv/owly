(globalThis as { __APP_MODE__?: string }).__APP_MODE__ = "test";

import { afterAll, beforeEach } from "vitest";
import { clearMocks } from "@tauri-apps/api/mocks";
import { installDefaultMockIPC } from "./mock-ipc";
import { resetAllStores } from "./stores";
// Real Chromium renders the test harness without app CSS unless we
// explicitly pull it in here. Layout-dependent tests (DnD coords,
// screenshots) need the production stylesheet active.
import "../styles/globals.css";

beforeEach(() => {
  resetAllStores();
  installDefaultMockIPC();
});

afterAll(() => {
  clearMocks();
});
