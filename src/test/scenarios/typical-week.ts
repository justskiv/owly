import { ROOT, VirtualFS } from "../virtual-fs";
import { DEFAULT_CONFIG } from "../../services/defaults";
import { buildBlock } from "../builders/block";
import {
  buildDirection,
  buildProject,
  buildTask,
} from "../builders";
import {
  done,
  inDeepWorkSlot,
  onToday,
  onTomorrow,
  onYesterday,
  withDeadlineIn,
} from "../builders/traits";

// FROZEN_NOW (2025-06-11 Wed) → ISO week 2025-w24, Mon 2025-06-09.
const WEEK = "2025-w24";
const WEEK_START = "2025-06-09";

// Default fixture: typical mid-week state with 6 entities and 3
// blocks (today/tomorrow/yesterday-done). Empty pool/horizon — most
// tests don't need them populated, builders/scenarios let individual
// tests opt in.
export function typicalWeek(): VirtualFS {
  const fs = new VirtualFS();

  fs.write(
    `${ROOT}/config.json`,
    JSON.stringify(DEFAULT_CONFIG, null, 2),
  );

  fs.write(
    `${ROOT}/entities.json`,
    JSON.stringify(
      {
        version: 1,
        entities: [
          buildTask({ title: "Test report", ...withDeadlineIn(2) }),
          buildTask({ title: "Daily review", ...withDeadlineIn(0) }),
          buildTask({ title: "Read paper" }),
          buildProject({ title: "Site refactor" }),
          buildProject({ title: "Tuzov OS v2" }),
          buildDirection({ title: "YouTube" }),
        ],
      },
      null,
      2,
    ),
  );

  fs.write(
    `${ROOT}/schedule/${WEEK}.json`,
    JSON.stringify(
      {
        version: 1,
        week: WEEK,
        start_date: WEEK_START,
        template_applied: null,
        blocks: [
          buildBlock({
            ...onToday(),
            ...inDeepWorkSlot(),
            title: "Сегодня deep work",
          }),
          buildBlock({
            ...onTomorrow(),
            title: "Завтрашний созвон",
          }),
          buildBlock({
            ...onYesterday(),
            ...done(),
            title: "Вчерашняя задача",
          }),
        ],
      },
      null,
      2,
    ),
  );

  fs.write(
    `${ROOT}/pool/${WEEK}.json`,
    JSON.stringify({ version: 1, week: WEEK, items: [] }, null, 2),
  );

  fs.write(
    `${ROOT}/horizon.json`,
    JSON.stringify(
      {
        version: 1,
        base_month: "2025-06-01",
        projects: [],
        group_collapsed: { big: false, mid: false, small: false },
        section_collapsed: {
          active: false,
          someday: false,
          deferred: true,
        },
      },
      null,
      2,
    ),
  );

  fs.ensureDir(`${ROOT}/commands/pending`);
  fs.ensureDir(`${ROOT}/commands/done`);
  fs.ensureDir(`${ROOT}/commands/failed`);

  return fs;
}
