import { beforeEach, describe, expect, it, vi } from "vitest";

// Tauri runtime APIs are mocked at the module-graph root so every
// downstream call (file-io, save-status, listen-based watchers)
// becomes a no-op. invoke gates by command name: write/move/delete
// silently succeed; read returns "not found" so cross-week file reads
// degrade to an empty week (the executor surfaces it as a thrown
// error, matching real behavior).
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async (cmd: string) => {
    switch (cmd) {
      case "get_data_dir":
        return "/tmp/owly-test";
      case "file_exists":
        return false;
      case "list_files":
        return [];
      case "read_file":
        throw new Error("read_file mocked: not found");
      case "ensure_dir":
      case "write_file":
      case "move_file":
      case "delete_file":
        return undefined;
      default:
        return undefined;
    }
  }),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async () => () => undefined),
}));

import type {
  Block,
  Command,
  DirectionEntity,
  PoolItem,
  ProjectEntity,
  TaskEntity,
} from "../schemas";
import { useEntityStore } from "../store/entities";
import { useHorizonStore } from "../store/horizon";
import { usePoolStore } from "../store/pool";
import { useScheduleStore } from "../store/schedule";
import { batchPartialOf, executeCommand } from "./command-executor";

// 2026-05-04 is the Monday of ISO week 19, so currentWeek and the
// seeded blocks/dates must agree on W19; using W18 + 05-04 puts them
// in different weeks and the executor rejects the cross-week op.
const WEEK = "2026-w19";
const NOW = "2026-05-04T10:00:00";

function makeDirection(over: Partial<DirectionEntity> = {}): DirectionEntity {
  return {
    id: "dir-1",
    type: "direction",
    title: "Test direction",
    tags: ["work"],
    status: "active",
    priority: null,
    deadline: null,
    estimated_minutes: null,
    description: "",
    created_at: "2026-01-01T00:00:00",
    updated_at: "2026-01-01T00:00:00",
    fields: {
      target: "100",
      current: "10",
      progress: 10,
      cadence: 7,
      last_act: null,
      cadence_label: "раз в неделю",
    },
    ...over,
  } as DirectionEntity;
}

function makeProject(over: Partial<ProjectEntity> = {}): ProjectEntity {
  return {
    id: "prj-1",
    type: "project",
    title: "Test project",
    tags: ["work"],
    status: "active",
    priority: null,
    deadline: null,
    estimated_minutes: null,
    description: "",
    created_at: "2026-01-01T00:00:00",
    updated_at: "2026-01-01T00:00:00",
    fields: {
      description: "",
      pipeline_stage: "research",
      task_ids: [],
      direction_id: null,
      board_id: "brd3",
      column_index: 0,
      last_activity_days: 0,
    },
    ...over,
  } as ProjectEntity;
}

function makeTask(over: Partial<TaskEntity> = {}): TaskEntity {
  return {
    id: "tsk-1",
    type: "task",
    title: "Test task",
    tags: ["work"],
    status: "active",
    priority: null,
    deadline: null,
    estimated_minutes: null,
    description: "",
    created_at: "2026-01-01T00:00:00",
    updated_at: "2026-01-01T00:00:00",
    fields: {
      parent_project_id: null,
      checklist: [],
    },
    ...over,
  } as TaskEntity;
}

function makeBlock(over: Partial<Block> = {}): Block {
  return {
    id: "blk-1",
    title: "Test block",
    date: "2026-05-04",
    start: "09:00",
    duration: 60,
    category: "work",
    source_entity_id: null,
    pool_item_id: null,
    status: "planned",
    notes: "",
    ...over,
  };
}

function makePoolItem(over: Partial<PoolItem> = {}): PoolItem {
  return {
    id: "pool-1",
    title: "Test pool item",
    hours: 2,
    category: "work",
    splittable: true,
    source_entity_id: null,
    source_kind: "ad-hoc",
    placed: false,
    created_at: "2026-05-01T00:00:00",
    updated_at: "2026-05-01T00:00:00",
    ...over,
  };
}

function cmd<T extends Command["action"]>(
  action: T,
  data: Extract<Command, { action: T }>["data"],
): Command {
  return { id: `cmd-${action}`, timestamp: NOW, action, data } as Command;
}

beforeEach(() => {
  useEntityStore.setState({ entities: [], loading: false, error: null });
  useScheduleStore.setState({
    currentWeek: WEEK,
    // 2026-05-04 is the Monday of W19 — the seeded `currentWeek`.
    startDate: "2026-05-04",
    templateApplied: null,
    blocks: [],
    loading: false,
    error: null,
  });
  usePoolStore.setState({
    currentWeek: WEEK,
    items: [],
    loading: false,
    error: null,
  });
  useHorizonStore.setState({
    baseMonth: "2026-05-01",
    projects: [],
    groupCollapsed: { big: false, mid: false, small: false },
    sectionCollapsed: { active: false, someday: false, deferred: true },
    loading: false,
    error: null,
  });
});

describe("entity actions", () => {
  it("create_entity adds a direction to the store", async () => {
    const direction = makeDirection({ id: "dir-new" });
    await executeCommand(cmd("create_entity", direction));
    const entities = useEntityStore.getState().entities;
    expect(entities).toHaveLength(1);
    expect(entities[0].id).toBe("dir-new");
    expect(entities[0].type).toBe("direction");
  });

  it("update_entity merges patch and refreshes updated_at", async () => {
    useEntityStore.setState({ entities: [makeTask()] });
    await executeCommand(
      cmd("update_entity", {
        entity_id: "tsk-1",
        title: "Renamed",
      }),
    );
    const entity = useEntityStore.getState().entities[0];
    expect(entity.title).toBe("Renamed");
    expect(entity.updated_at).not.toBe("2026-01-01T00:00:00");
  });

  it("update_entity strips identity fields from the patch", async () => {
    useEntityStore.setState({ entities: [makeTask()] });
    await executeCommand(
      cmd("update_entity", {
        entity_id: "tsk-1",
        // Try to morph type + rewrite id; both must be ignored.
        type: "project",
        id: "tsk-evil",
        title: "Renamed",
      }),
    );
    const entity = useEntityStore.getState().entities[0];
    expect(entity.id).toBe("tsk-1");
    expect(entity.type).toBe("task");
    expect(entity.title).toBe("Renamed");
  });

  it("update_entity throws when entity is missing", async () => {
    await expect(
      executeCommand(
        cmd("update_entity", { entity_id: "missing", title: "X" }),
      ),
    ).rejects.toThrow(/not found/);
  });

  it("delete_entity removes the entity", async () => {
    useEntityStore.setState({ entities: [makeTask()] });
    await executeCommand(cmd("delete_entity", { entity_id: "tsk-1" }));
    expect(useEntityStore.getState().entities).toHaveLength(0);
  });
});

describe("block actions (current week)", () => {
  it("create_block appends to the current week", async () => {
    await executeCommand(
      cmd("create_block", {
        title: "Deep work",
        date: "2026-05-04",
        start: "10:00",
        duration: 90,
        category: "work",
        source_entity_id: null,
      }),
    );
    const blocks = useScheduleStore.getState().blocks;
    expect(blocks).toHaveLength(1);
    expect(blocks[0].title).toBe("Deep work");
    expect(blocks[0].duration).toBe(90);
    expect(blocks[0].status).toBe("planned");
  });

  it("update_block patches an existing block", async () => {
    useScheduleStore.setState({ blocks: [makeBlock()] });
    await executeCommand(
      cmd("update_block", { block_id: "blk-1", title: "Renamed" }),
    );
    expect(useScheduleStore.getState().blocks[0].title).toBe("Renamed");
  });

  it("resize_block updates duration", async () => {
    useScheduleStore.setState({ blocks: [makeBlock({ duration: 60 })] });
    await executeCommand(
      cmd("resize_block", { block_id: "blk-1", new_duration: 120 }),
    );
    expect(useScheduleStore.getState().blocks[0].duration).toBe(120);
  });

  it("set_block_status changes status", async () => {
    useScheduleStore.setState({ blocks: [makeBlock()] });
    await executeCommand(
      cmd("set_block_status", { block_id: "blk-1", status: "done" }),
    );
    expect(useScheduleStore.getState().blocks[0].status).toBe("done");
  });

  it("delete_block removes the block", async () => {
    useScheduleStore.setState({ blocks: [makeBlock()] });
    await executeCommand(cmd("delete_block", { block_id: "blk-1" }));
    expect(useScheduleStore.getState().blocks).toHaveLength(0);
  });

  it("delete_block is idempotent on missing block", async () => {
    await expect(
      executeCommand(cmd("delete_block", { block_id: "missing" })),
    ).resolves.toBeUndefined();
  });

  it("move_block within the same week updates date/start", async () => {
    useScheduleStore.setState({ blocks: [makeBlock()] });
    await executeCommand(
      cmd("move_block", {
        block_id: "blk-1",
        new_date: "2026-05-05",
        new_start: "14:00",
      }),
    );
    const block = useScheduleStore.getState().blocks[0];
    expect(block.date).toBe("2026-05-05");
    expect(block.start).toBe("14:00");
  });
});

describe("pool actions (current week)", () => {
  it("create_pool_item appends an item", async () => {
    await executeCommand(
      cmd("create_pool_item", {
        week: WEEK,
        title: "New item",
        hours: 3,
        category: "work",
        splittable: false,
        source_entity_id: null,
        source_kind: "ad-hoc",
      }),
    );
    const items = usePoolStore.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("New item");
    expect(items[0].placed).toBe(false);
  });

  it("update_pool_item patches an item", async () => {
    usePoolStore.setState({ items: [makePoolItem()] });
    await executeCommand(
      cmd("update_pool_item", {
        week: WEEK,
        pool_item_id: "pool-1",
        title: "Renamed",
        hours: 5,
      }),
    );
    const item = usePoolStore.getState().items[0];
    expect(item.title).toBe("Renamed");
    expect(item.hours).toBe(5);
  });

  it("delete_pool_item removes item from current week", async () => {
    usePoolStore.setState({ items: [makePoolItem()] });
    await executeCommand(
      cmd("delete_pool_item", { week: WEEK, pool_item_id: "pool-1" }),
    );
    expect(usePoolStore.getState().items).toHaveLength(0);
  });
});

describe("horizon actions", () => {
  beforeEach(() => {
    useHorizonStore.setState({
      baseMonth: "2026-05-01",
      projects: [
        {
          project_id: "prj-1",
          months: [],
          size: "mid",
          hidden: false,
        },
      ],
      groupCollapsed: { big: false, mid: false, small: false },
      sectionCollapsed: { active: false, someday: false, deferred: true },
      loading: false,
      error: null,
    });
  });

  it("set_horizon_months updates project months", async () => {
    await executeCommand(
      cmd("set_horizon_months", { project_id: "prj-1", months: [3, 4, 5] }),
    );
    const proj = useHorizonStore.getState().projects[0];
    expect(proj.months).toEqual([3, 4, 5]);
  });

  it("set_horizon_hidden flips hidden flag", async () => {
    await executeCommand(
      cmd("set_horizon_hidden", { project_id: "prj-1", hidden: true }),
    );
    expect(useHorizonStore.getState().projects[0].hidden).toBe(true);
  });

  it("set_horizon_size changes size", async () => {
    await executeCommand(
      cmd("set_horizon_size", { project_id: "prj-1", size: "big" }),
    );
    expect(useHorizonStore.getState().projects[0].size).toBe("big");
  });

  it("set_horizon_size throws on missing project", async () => {
    await expect(
      executeCommand(
        cmd("set_horizon_size", { project_id: "missing", size: "big" }),
      ),
    ).rejects.toThrow(/Horizon project missing not found/);
  });
});

describe("mark_cadence", () => {
  it("stamps last_act = today on the direction", async () => {
    useEntityStore.setState({ entities: [makeDirection()] });
    await executeCommand(
      cmd("mark_cadence", { direction_id: "dir-1" }),
    );
    const dir = useEntityStore.getState().entities[0] as DirectionEntity;
    // Format YYYY-MM-DD; we don't pin the exact date because the
    // executor uses local time and CI may run in different TZ.
    expect(dir.fields.last_act).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("preserves other direction fields (cadence/target/progress)", async () => {
    useEntityStore.setState({ entities: [makeDirection()] });
    await executeCommand(
      cmd("mark_cadence", { direction_id: "dir-1" }),
    );
    const dir = useEntityStore.getState().entities[0] as DirectionEntity;
    expect(dir.fields.cadence).toBe(7);
    expect(dir.fields.target).toBe("100");
    expect(dir.fields.progress).toBe(10);
    expect(dir.fields.cadence_label).toBe("раз в неделю");
  });

  it("throws when entity is not a direction", async () => {
    useEntityStore.setState({ entities: [makeProject({ id: "dir-1" })] });
    await expect(
      executeCommand(cmd("mark_cadence", { direction_id: "dir-1" })),
    ).rejects.toThrow(/not direction/);
  });

  it("throws when direction is missing", async () => {
    await expect(
      executeCommand(cmd("mark_cadence", { direction_id: "missing" })),
    ).rejects.toThrow(/not found/);
  });

  it("rejects when stored direction fields are type-corrupt", async () => {
    // Hand-edited file: cadence wrote a string instead of a number.
    // The merge-then-safeParse guard should refuse to persist.
    const bad = makeDirection();
    (bad.fields as unknown as { cadence: string }).cadence = "seven";
    useEntityStore.setState({ entities: [bad] });
    await expect(
      executeCommand(cmd("mark_cadence", { direction_id: "dir-1" })),
    ).rejects.toThrow(/mark_cadence rejected/);
  });
});

describe("batch", () => {
  it("runs every sub-command sequentially", async () => {
    useEntityStore.setState({ entities: [makeTask()] });
    await executeCommand(
      cmd("batch", {
        commands: [
          {
            id: "sub-1",
            timestamp: NOW,
            action: "update_entity",
            data: { entity_id: "tsk-1", title: "Renamed" },
          },
          {
            id: "sub-2",
            timestamp: NOW,
            action: "create_block",
            data: {
              title: "From batch",
              date: "2026-05-04",
              start: "11:00",
              duration: 60,
              category: "work",
              source_entity_id: null,
            },
          },
        ],
      }),
    );
    expect(useEntityStore.getState().entities[0].title).toBe("Renamed");
    expect(useScheduleStore.getState().blocks).toHaveLength(1);
  });

  it("reports partial counts when a sub-command throws", async () => {
    // Use a guaranteed-failing sub: update_entity on missing entity.
    useEntityStore.setState({ entities: [makeTask()] });
    let caught: unknown = null;
    try {
      await executeCommand(
        cmd("batch", {
          commands: [
            {
              id: "ok",
              timestamp: NOW,
              action: "update_entity",
              data: { entity_id: "tsk-1", title: "Renamed" },
            },
            {
              id: "boom",
              timestamp: NOW,
              action: "update_entity",
              data: { entity_id: "missing", title: "X" },
            },
          ],
        }),
      );
    } catch (e) {
      caught = e;
    }
    const partial = batchPartialOf(caught);
    expect(partial).toEqual({ succeeded: 1, failed_at_index: 1 });
    // Sub #0 (rename) ran before the abort.
    expect(useEntityStore.getState().entities[0].title).toBe("Renamed");
  });
});
