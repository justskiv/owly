import { defineConfig } from "vitest/config";

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
    ],
  },
});
