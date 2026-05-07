// Single source of "now" for the whole app. Tests freeze this via
// vi.setSystemTime; production reads wall-clock. Anything outside
// clock.ts that reads `new Date()` / `Date.now()` is blocked by
// `no-restricted-syntax` in eslint.config.js.
//
// Note: an ISO formatter lives in time-utils.ts (`nowISO`) — it
// emits a LOCAL timestamp (no `Z`), matching what the entity/
// command schemas expect. Callers that genuinely want UTC use
// `now().toISOString()` directly.

export function now(): Date {
  return new Date();
}

export function today(): Date {
  const d = now();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function nowMs(): number {
  return now().getTime();
}
