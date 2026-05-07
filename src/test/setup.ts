// Set BEFORE any module imports — file-io's sandbox guard reads this
// at call time but we'd rather not rely on subtle ordering. Using
// globalThis (not process.env) so the same flag works in browser mode
// where process isn't defined.
(globalThis as { __APP_MODE__?: string }).__APP_MODE__ = "test";

import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach } from "vitest";
import { clearMocks } from "@tauri-apps/api/mocks";
import { resetAllStores } from "./stores";
import { resetServiceSingletons } from "./reset-singletons";
import { freezeClock, thawClock } from "./clock";
import { resetBuilderCounters } from "./builders";
import { installFS, VirtualFS } from "./virtual-fs";

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
  resetServiceSingletons();
  resetBuilderCounters();
  freezeClock();
  installFS(new VirtualFS());
});

afterEach(() => {
  thawClock();
  clearMocks();
});
