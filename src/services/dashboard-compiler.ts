import { transform } from "sucrase";
import * as React from "react";
import { useState, useEffect, useMemo } from "react";
import type { ComponentType } from "react";
import type { DashboardWidgets } from "../components/dashboards/widgets";

export interface DashboardProps {
  entities: unknown[];
  schedule: unknown;
  config: unknown;
  allWeeks: unknown[];
  widgets: DashboardWidgets;
}

export class DashboardCompileError extends Error {
  constructor(
    public source: string,
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "DashboardCompileError";
  }
}

// Each call returns a fresh component. We deliberately don't cache:
// hot-reload relies on reading .jsx fresh from disk, and a typical
// dashboard transpiles in <50ms — well under perceptible.
//
// Transforms:
//   - 'jsx'        — JSX → React.createElement
//   - 'imports'    — rewrites `export default X` to `exports.default = X`
//                    (without it, `new Function` rejects the export
//                    keyword as illegal in a function body).
//   - 'typescript' — strips type annotations so authors who slip
//                    `useState<number>(0)` or `(props: Props)` past
//                    the guide get a working dashboard, not a
//                    confusing SyntaxError.
const SUCRASE_TRANSFORMS = ["jsx", "imports", "typescript"] as const;

export function compileDashboard(
  jsxSource: string,
  filename = "dashboard.jsx",
): ComponentType<DashboardProps> {
  let jsCode: string;
  try {
    jsCode = transform(jsxSource, {
      transforms: [...SUCRASE_TRANSFORMS],
    }).code;
  } catch (e) {
    throw new DashboardCompileError(
      jsxSource,
      `JSX transform failed: ${(e as Error).message}`,
      e,
    );
  }

  // sourceURL gives stack traces an honest filename instead of
  // "anonymous"/"eval". Line numbers are still off by a few rows
  // because the imports transform inserts an `Object.defineProperty`
  // prelude, but the file pointer is way more useful than the
  // single-line offset we had before.
  const wrapped = `${jsCode}\n//# sourceURL=tuzov-dashboard:///${filename}`;

  let factory: Function;
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    factory = new Function(
      "module",
      "exports",
      "React",
      "useState",
      "useEffect",
      "useMemo",
      wrapped,
    );
  } catch (e) {
    throw new DashboardCompileError(
      jsxSource,
      `Syntax error: ${(e as Error).message}`,
      e,
    );
  }

  const moduleObj: {
    exports: { default?: ComponentType<DashboardProps> };
  } = { exports: {} };

  try {
    factory(moduleObj, moduleObj.exports, React, useState, useEffect, useMemo);
  } catch (e) {
    throw new DashboardCompileError(
      jsxSource,
      `Top-level execution failed: ${(e as Error).message}`,
      e,
    );
  }

  const Component = moduleObj.exports.default;
  if (typeof Component !== "function") {
    throw new DashboardCompileError(
      jsxSource,
      `Default export must be a function. Got: ${typeof Component}`,
    );
  }
  return Component;
}
