import { typicalWeek } from "./typical-week";
import { buildCommand } from "../builders/command";
import type { Command } from "../../schemas";
import { ROOT, type VirtualFS } from "../virtual-fs";

type CreateBlockCommand = Extract<Command, { action: "create_block" }>;

// typicalWeek + a single create_block command sitting in
// commands/pending/. Used by F-9 to verify the processor
// drains, executes, and moves the file to done/.
export function withPendingCommands(): VirtualFS {
  const fs = typicalWeek();

  const cmd = buildCommand<CreateBlockCommand>({
    id: "cmd-1",
    action: "create_block",
    data: {
      title: "Created by command",
      date: "2025-06-11",
      start: "14:00",
      duration: 60,
      category: "work",
      source_entity_id: null,
    },
  });
  fs.write(
    `${ROOT}/commands/pending/cmd-1.json`,
    JSON.stringify(cmd, null, 2),
  );

  return fs;
}
