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
// `transforms: ['jsx', 'imports']` — JSX → React.createElement AND
// rewrite `export default X` into `exports.default = X` (and `import`
// into `require`, which will throw at runtime — by design, since the
// authoring guide forbids imports). Without 'imports' the `export`
// keyword survives and `new Function` rejects it as illegal in a
// function body.
export function compileDashboard(
  jsxSource: string,
): ComponentType<DashboardProps> {
  let jsCode: string;
  try {
    jsCode = transform(jsxSource, {
      transforms: ["jsx", "imports"],
    }).code;
  } catch (e) {
    throw new DashboardCompileError(
      jsxSource,
      `JSX transform failed: ${(e as Error).message}`,
      e,
    );
  }

  // Leading newline keeps stack-trace line numbers aligned with the
  // source file. `new Function` injects an implicit line 0 with the
  // parameter list, so without this offset every error reports
  // `lineN+1` of the source.
  const wrapped = "\n" + jsCode;

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
