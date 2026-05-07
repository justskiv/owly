import { userEvent } from "vitest/browser";
import { expect } from "vitest";
import type { RenderResult } from "vitest-browser-react";
import type { Block, ConfigFile, Entity, PoolItem } from "../../schemas";
import type { HorizonProjectState } from "../../schemas/horizon";
import { useConfigStore } from "../../store/config";
import { useEntityStore } from "../../store/entities";
import { useScheduleStore } from "../../store/schedule";
import { usePoolStore } from "../../store/pool";
import { useHorizonStore } from "../../store/horizon";
import { flushEntitiesQueue } from "../../services/entities-write-queue";
import { flushHorizonQueue } from "../../services/horizon-write-queue";
import { flushConfigQueue } from "../../services/config-write-queue";
import { flushWeekQueue } from "../../services/week-write-queue";
import { flushPoolQueue } from "../../services/pool-write-queue";
import { getWeekStartDate } from "../../services/time-utils";
import { getCurrentFS, ROOT } from "../virtual-fs";

export type ScreenName =
  | "plan"
  | "tasks"
  | "projects"
  | "context"
  | "horizon"
  | "review";

// All helpers take RenderResult — no global `screen`. Cmd+N is
// scoped to the dialog because the same "Что добавить?" placeholder
// appears in TaskBar.tsx and would collide on the Tasks screen.
export async function quickAdd(
  screen: RenderResult,
  text: string,
): Promise<void> {
  await userEvent.keyboard("{Meta>}[KeyN]{/Meta}");
  const dialog = screen.getByRole("dialog", {
    name: /быстрое создание/i,
  });
  const input = dialog.getByPlaceholder("Что добавить?");
  await userEvent.type(input, text);
  await userEvent.keyboard("{Enter}");
}

// Navigation via data-tab — structural, immune to label translation.
export async function gotoScreen(
  screen: RenderResult,
  name: ScreenName,
): Promise<void> {
  const button = screen.container.querySelector<HTMLElement>(
    `[data-tab="${name}"]`,
  );
  if (!button) throw new Error(`tab ${name} not in DOM`);
  await userEvent.click(button);
}

export async function expectScreen(
  screen: RenderResult,
  name: ScreenName,
): Promise<void> {
  const root = screen.container.querySelector(`[data-screen="${name}"]`);
  if (!root) throw new Error(`screen ${name} not in DOM`);
  await expect.element(root as HTMLElement).toBeVisible();
}

export async function pressKey(combo: string): Promise<void> {
  await userEvent.keyboard(combo);
}

// Bypass the UI for fixture setup. Fast, not "production-like".
// Use when the test asserts on downstream behavior, not on the
// create-flow itself.
export interface StoreUpdates {
  config?: ConfigFile;
  entities?: Entity[];
  blocks?: Block[];
  pool?: PoolItem[];
  horizon?: HorizonProjectState[];
}

export function setStoreState(updates: StoreUpdates): void {
  if (updates.config) {
    useConfigStore.setState({ config: updates.config });
  }
  if (updates.entities) {
    useEntityStore.setState({ entities: updates.entities });
  }
  if (updates.blocks) {
    useScheduleStore.setState({ blocks: updates.blocks });
  }
  if (updates.pool) {
    usePoolStore.setState({ items: updates.pool });
  }
  if (updates.horizon) {
    useHorizonStore.setState({ projects: updates.horizon });
  }
}

// Awaits all pending write-chains so an assertion can rely on
// disk state having caught up with the in-memory store.
export async function flushAllWrites(): Promise<void> {
  await Promise.all([
    flushEntitiesQueue(),
    flushPoolQueue(),
    flushHorizonQueue(),
    flushWeekQueue(),
    flushConfigQueue(),
  ]);
}

// Pre-create empty week files so prev/next-week navigation does
// not trigger WeekNotFoundDialog (whose modal-bg would intercept
// further clicks during the test). Used by Plan tests that walk
// past the FROZEN_NOW week.
export function seedEmptyWeeks(weeks: string[]): void {
  const fs = getCurrentFS();
  for (const w of weeks) {
    fs.write(
      `${ROOT}/schedule/${w}.json`,
      JSON.stringify(
        {
          version: 1,
          week: w,
          start_date: getWeekStartDate(w),
          template_applied: null,
          blocks: [],
        },
        null,
        2,
      ),
    );
  }
}
