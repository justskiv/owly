// Set BEFORE any module imports — file-io's sandbox guard reads this
// at call time but we'd rather not rely on subtle ordering.
process.env.APP_MODE = "test";

import "@testing-library/jest-dom/vitest";
import { afterAll, beforeEach } from "vitest";
import { mockIPC, clearMocks } from "@tauri-apps/api/mocks";
import { resetAllStores } from "./stores";

class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= MockResizeObserver as never;

class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
  root = null;
  rootMargin = "";
  thresholds = [];
}
globalThis.IntersectionObserver ??= MockIntersectionObserver as never;

if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

beforeEach(() => {
  resetAllStores();
  mockIPC(async (cmd) => {
    if (cmd === "get_data_dir") return "/test-data";
    if (cmd === "read_file") return "";
    if (cmd === "write_file") return null;
    if (cmd === "file_exists") return false;
    if (cmd === "ensure_dir") return null;
    if (cmd === "list_files") return [];
    if (cmd === "move_file") return null;
    if (cmd === "delete_file") return null;
    return null;
  });
});

afterAll(() => {
  clearMocks();
});
