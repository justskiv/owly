import type { Area, Entity, DirectionEntity, ProjectEntity } from "../schemas";
import {
  cadUrgClass,
  daysSince,
  daysUntil,
  formatDeadline,
  urgClass,
} from "./urgency";

// Hardcoded section order for the Context screen — fixed by spec §2.2
// and §7.1 even when `config.areas` lists categories in a different
// order. User-added unknown areas fall to the end so they remain
// visible.
export const CONTEXT_AREA_ORDER: readonly string[] = [
  "work",
  "growth",
  "people",
  "health",
  "life",
];

export function sortAreasForContext(areas: readonly Area[]): Area[] {
  const idx = (id: string) => {
    const i = CONTEXT_AREA_ORDER.indexOf(id);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  return [...areas].sort((a, b) => idx(a.id) - idx(b.id));
}

export function directionsForArea(
  entities: readonly Entity[],
  areaId: string,
): DirectionEntity[] {
  return entities.filter(
    (e): e is DirectionEntity =>
      e.type === "direction" &&
      e.status === "active" &&
      e.tags.includes(areaId),
  );
}

// No sort — the Context card lists projects in `entities.json` order
// (spec §«Что НЕ включает»). Sorting by `la` or pipeline_stage is a
// Phase 9 candidate.
export function projectsForDirection(
  entities: readonly Entity[],
  directionId: string,
): ProjectEntity[] {
  return entities.filter(
    (e): e is ProjectEntity =>
      e.type === "project" &&
      e.status === "active" &&
      e.fields.direction_id === directionId,
  );
}

export type FreshClass = "fresh" | "normal" | "stale";

export function freshClass(la: number): FreshClass {
  if (la <= 3) return "fresh";
  if (la >= 14) return "stale";
  return "normal";
}

export function tooltipText(la: number): string {
  if (la === 0) return "Активность сегодня";
  if (la === 1) return "Вчера";
  return `Последняя активность ${la} дн. назад`;
}

export function projectsPlural(n: number): string {
  if (n === 1) return "1 проект";
  if (n < 5) return `${n} проекта`;
  return `${n} проектов`;
}

export interface DirectionSignal {
  text: string;
  // Empty string for no-urgency. Otherwise one of the urgClass /
  // cadUrgClass return values; typed as plain string to avoid having
  // to narrow each return path.
  urgency: string;
  empty: boolean;
}

// Picks the single most actionable line for the compact direction
// tile. Priority: cadence overdue → cadence near-due → deadline near
// → cadence ok → measurable (current→target) → has projects (count +
// freshest) → empty.
export function getPrimarySignal(
  direction: DirectionEntity,
  linked: readonly ProjectEntity[],
  today: Date = new Date(),
): DirectionSignal {
  const f = direction.fields;
  const cadLabel = f.cadence_label ?? (f.cadence ? `1×/${f.cadence}д` : null);
  const cadDays = f.cadence !== null ? daysSince(f.last_act, today) : null;
  const cadOver =
    cadDays !== null && f.cadence !== null ? cadDays - f.cadence : null;
  const dl = daysUntil(direction.deadline, today);

  if (cadOver !== null && cadOver > 0 && cadLabel) {
    return {
      text: `${cadLabel} · просрочено ${cadOver}д`,
      urgency: "urgency-bad",
      empty: false,
    };
  }
  if (cadOver !== null && cadOver > -3 && cadLabel && cadDays !== null) {
    return {
      text: `${cadLabel} · ${cadDays}д назад`,
      urgency: cadUrgClass(cadOver),
      empty: false,
    };
  }
  if (dl !== null && dl <= 14 && direction.deadline) {
    return {
      text: `Дедлайн: ${formatDeadline(dl)}`,
      urgency: urgClass(dl),
      empty: false,
    };
  }
  if (cadLabel && cadDays !== null) {
    return {
      text: `${cadLabel} · ${cadDays}д назад`,
      urgency: cadUrgClass(cadOver),
      empty: false,
    };
  }
  if (f.target !== null || f.current !== null) {
    return {
      text: `${f.current ?? "—"} → ${f.target ?? "—"}`,
      urgency: "",
      empty: false,
    };
  }
  if (linked.length > 0) {
    const freshest = linked.reduce((a, b) =>
      a.fields.last_activity_days < b.fields.last_activity_days ? a : b,
    );
    return {
      text: `${projectsPlural(linked.length)} · свежее ${freshest.fields.last_activity_days}д`,
      urgency: "",
      empty: false,
    };
  }
  if (dl !== null && direction.deadline) {
    return {
      text: `Дедлайн: ${direction.deadline} (${formatDeadline(dl)})`,
      urgency: urgClass(dl),
      empty: false,
    };
  }
  return { text: "нет проектов", urgency: "", empty: true };
}
