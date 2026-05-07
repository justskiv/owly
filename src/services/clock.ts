// Single source of "now" — tests freeze via vi.setSystemTime.
// ISO formatter for entity/command timestamps lives in time-utils
// (`nowISO`, LOCAL); UTC callers use `now().toISOString()`.

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
