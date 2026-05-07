// Flat config (eslint v9+). Minimal rules — only react-hooks/*
// because the existing 7 `eslint-disable-next-line` markers in the
// codebase are all about hooks deps. Adding broader stylistic rules
// here would surface unrelated noise on first run; broaden later.

import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  {
    ignores: [
      "dist/**",
      "src-tauri/**",
      "node_modules/**",
      "data/**",
      "tmp/**",
    ],
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/services/clock.ts", "scripts/**"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "react-hooks": reactHooks,
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "NewExpression[callee.name='Date'][arguments.length=0]",
          message:
            "Use clock.now() / clock.today() — raw `new Date()` " +
            "breaks frozen-clock tests.",
        },
        {
          selector:
            "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message:
            "Use clock.nowMs() — raw `Date.now()` breaks " +
            "frozen-clock tests.",
        },
      ],
    },
  },
];
