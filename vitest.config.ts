import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      exclude: [
        // Non-code or technically uncoverable. Vitest already excludes
        // node_modules, dist, test files, *.d.ts and configs by default.
        "**/*.css",
        "scripts/**",
        "src/main.tsx",
        "src/schemas/index.ts",
      ],
    },
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
          name: "e2e-browser",
          include: ["src/**/*.e2e.test.tsx"],
          setupFiles: ["src/test/setup-browser.ts"],
          browser: {
            enabled: true,
            provider: playwright(),
            // Desktop-class viewport: Owly targets a desktop Tauri
            // window, and the Horizon grid (200px name-col + 8 month
            // cols) collapses below ~1000px wide. The Playwright
            // default in vitest-browser is mobile-sized (414×896),
            // which empties Horizon's TD widths and breaks DnD
            // hit-testing via elementFromPoint.
            instances: [
              {
                browser: "chromium",
                viewport: { width: 1280, height: 720 },
              },
            ],
            headless: true,
            screenshotFailures: false,
          },
        },
      },
    ],
  },
});
