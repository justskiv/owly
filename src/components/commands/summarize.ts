// Compact one-line description of a command for the log row.
// Returns "" if the action isn't recognized — caller falls back to
// just showing the raw action label.
export function summarizeCommand(action: string, data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const d = data as Record<string, unknown>;

  switch (action) {
    case "create_block": {
      const parts: string[] = [];
      if (typeof d.title === "string" && d.title) parts.push(`«${d.title}»`);
      if (typeof d.date === "string" && typeof d.start === "string") {
        parts.push(`${d.date} ${d.start}`);
      }
      if (typeof d.duration === "number") parts.push(`${d.duration}m`);
      return parts.join(" · ");
    }

    case "update_block":
    case "delete_block":
    case "resize_block":
    case "set_block_status": {
      const id = typeof d.block_id === "string" ? d.block_id : "";
      const tail = id ? `blk-…${id.slice(-6)}` : "";
      const extra: string[] = [];
      if (action === "set_block_status" && typeof d.status === "string") {
        extra.push(`→ ${d.status}`);
      }
      if (action === "resize_block" && typeof d.new_duration === "number") {
        extra.push(`${d.new_duration}m`);
      }
      return [tail, ...extra].filter(Boolean).join(" · ");
    }

    case "move_block": {
      const id = typeof d.block_id === "string" ? d.block_id : "";
      const tail = id ? `blk-…${id.slice(-6)}` : "";
      const date = typeof d.new_date === "string" ? d.new_date : "";
      const start = typeof d.new_start === "string" ? d.new_start : "";
      return [tail, `→ ${date} ${start}`].filter(Boolean).join(" · ");
    }

    case "create_entity": {
      const type = typeof d.type === "string" ? d.type : "?";
      const title = typeof d.title === "string" ? d.title : "";
      return title ? `${type}: «${title}»` : type;
    }

    case "update_entity":
    case "delete_entity": {
      const id = typeof d.entity_id === "string" ? d.entity_id : "";
      return id ? `ent-…${id.slice(-6)}` : "";
    }

    case "create_week": {
      const w = typeof d.week === "string" ? d.week : "";
      const tpl =
        typeof d.apply_template === "string" && d.apply_template
          ? ` (template: ${d.apply_template})`
          : "";
      return `${w}${tpl}`;
    }

    case "apply_template": {
      const w = typeof d.week === "string" ? d.week : "";
      const tn = typeof d.template_name === "string" ? d.template_name : "";
      return [w, tn].filter(Boolean).join(" · ");
    }

    case "batch": {
      const len = Array.isArray(d.commands) ? d.commands.length : 0;
      return len === 1 ? "1 sub-command" : `${len} sub-commands`;
    }

    default:
      return "";
  }
}

// HH:MM extracted from any ISO-ish timestamp. Falls back to the
// original string so the log never shows blank cells.
export function formatHHMM(iso: string | undefined): string {
  if (!iso) return "";
  const m = /T(\d{2}:\d{2})/.exec(iso);
  return m ? m[1] : iso;
}
