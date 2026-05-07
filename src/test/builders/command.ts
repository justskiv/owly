import { CommandSchema, type Command } from "../../schemas/command";
import { nowISO } from "../../services/time-utils";

let counter = 0;

// Single entry-point — the discriminated union does the rest.
// Caller picks the action and data; the builder fills in id/timestamp.
export function buildCommand<C extends Command>(
  cmd: Omit<C, "id" | "timestamp"> & Partial<Pick<C, "id" | "timestamp">>,
): C {
  return CommandSchema.parse({
    id: `cmd-${++counter}`,
    timestamp: nowISO(),
    ...cmd,
  }) as C;
}

export function resetCommandCounter(): void {
  counter = 0;
}
