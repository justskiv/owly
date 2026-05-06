import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: ["src/services/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        test: {
          name: "smoke-jsdom",
          include: ["src/**/*.smoke.test.tsx"],
          environment: "jsdom",
          setupFiles: ["src/test/setup.ts"],
        },
      },
      {
        test: {
          name: "smoke-browser",
          include: ["src/**/*.browser.test.tsx"],
          setupFiles: ["src/test/setup-browser.ts"],
          browser: {
            enabled: true,
            provider: playwright(),
            instances: [{ browser: "chromium" }],
            headless: true,
            screenshotFailures: false,
          },
        },
      },
    ],
  },
});
