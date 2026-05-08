import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { CommandSchema } from "../schemas";
import { toast } from "../components/shared/Toast";
import { useCommandStore } from "../store/commands";
import { batchPartialOf, executeCommand } from "./command-executor";
import {
  fileExists,
  getCommandsPath,
  listFiles,
  writeJsonFile,
} from "./file-io";
import { nowISO } from "./time-utils";
import { errMsg } from "./format";

const ACTION_RU: Record<string, string> = {
  create_block: "Блок создан",
  update_block: "Блок обновлён",
  move_block: "Блок перемещён",
  resize_block: "Блок изменён",
  delete_block: "Блок удалён",
  set_block_status: "Статус обновлён",
  create_entity: "Сущность создана",
  update_entity: "Сущность обновлена",
  delete_entity: "Сущность удалена",
  create_week: "Неделя создана",
  create_pool_item: "Задача в пуле создана",
  update_pool_item: "Задача в пуле обновлена",
  delete_pool_item: "Задача в пуле удалена",
  set_horizon_months: "Месяцы горизонта обновлены",
  set_horizon_hidden: "Видимость на горизонте обновлена",
  set_horizon_size: "Размер на горизонте обновлён",
  mark_cadence: "Каденция отмечена",
  batch: "Команды применены",
};

// Wait this many ms before retrying a JSON.parse failure. Covers
// the case where a non-atomic client write was caught mid-flush.
const PARSE_RETRY_MS = 80;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

let started = false;
const inflight = new Set<string>();
let chain: Promise<unknown> = Promise.resolve();
let unlisten: UnlistenFn | null = null;

function isPendingCommandPath(path: string): boolean {
  return path.includes("/data/commands/pending/");
}

function assertTestOnly(name: string): void {
  if ((globalThis as { __APP_MODE__?: string }).__APP_MODE__ !== "test") {
    throw new Error(`${name} is test-only`);
  }
}

// only for src/test/** — do not call from prod
export async function __resetCommandProcessorForTests(): Promise<void> {
  assertTestOnly("__resetCommandProcessorForTests");
  if (unlisten) {
    // mockIPC's shouldMockEvents stub doesn't fully implement the
    // unregisterListener bridge — `unlisten()` returns a promise that
    // rejects in test mode. Await it so the next test's `listen()` is
    // sequenced after this teardown; swallow the rejection so a test
    // that booted via <App /> doesn't surface an unhandled rejection.
    const u = unlisten;
    unlisten = null;
    try {
      await u();
    } catch {
      /* ignore — mockIPC unregisterListener stub */
    }
  }
  started = false;
  inflight.clear();
  chain = Promise.resolve();
}

// only for src/test/** — do not call from prod
//
// Drives a single command file through the production processOne path,
// bypassing only the watcher (so tests don't race a real notify-crate
// dispatch). Delegating instead of duplicating means a regression in
// processOne — broken retry, missing fail() routing, dropped markDone
// fallback — surfaces in F-9 instead of staying hidden behind a
// happy-path copy.
export async function __processOnePendingForTests(
  path: string,
): Promise<void> {
  assertTestOnly("__processOnePendingForTests");
  if (!isPendingCommandPath(path)) {
    throw new Error(`test command path outside pending dir: ${path}`);
  }
  await processOne(path);
}

// Boot wires up the watcher listener and drains anything sitting in
// commands/pending/ from the last session. Idempotent — guarded by
// `started` so React StrictMode's double-mount can't install twice.
export async function startCommandProcessor(): Promise<void> {
  if (started) return;

  // Install the listener BEFORE drain. Anything that arrives between
  // the listener install and the drain finishing is captured by both;
  // the inflight Set dedupes so it runs exactly once.
  unlisten = await listen<string>("command-received", (e) => {
    // shouldSkip mirrors drainPending — without it, atomic-write
    // .tmp.<pid>.* siblings would land in inflight and fail to parse.
    const base = e.payload.split("/").pop() ?? "";
    if (shouldSkip(base)) return;
    enqueue(e.payload);
  });

  await drainPending();

  // Set the started flag only after listen() resolves. If listen
  // throws, leaving the flag false lets a retry re-attempt; setting
  // it true early would freeze the processor permanently.
  started = true;
}

async function drainPending(): Promise<void> {
  const dir = await getCommandsPath("pending");
  let names: string[];
  try {
    names = await listFiles(dir);
  } catch (e) {
    console.warn("[commands] cannot list pending:", errMsg(e));
    return;
  }
  // Sort by name — convention is timestamp-prefixed, so this gives
  // chronological order even after restart.
  names.sort();
  for (const name of names) {
    if (shouldSkip(name)) continue;
    const path = await getCommandsPath("pending", name);
    enqueue(path);
  }
}

function shouldSkip(name: string): boolean {
  if (!name.endsWith(".json")) return true;
  // Tauri's atomic write produces .tmp.<pid>.<nanos>.<n> sibling
  // files; the watcher emits Create events for those too. Filter
  // them so we never read half-written input.
  if (name.startsWith(".tmp.")) return true;
  if (name.startsWith(".")) return true;
  return false;
}

function enqueue(path: string): void {
  // Defense-in-depth: even with capabilities tightened so the
  // frontend can't emit('command-received'), a forged event from
  // a future broadened permission would otherwise let any path
  // be processed (read, parsed as command, executed, then deleted).
  // Reject anything not inside data/commands/pending/ before we
  // touch FS.
  if (!isPendingCommandPath(path)) {
    console.warn("[commands] rejected path outside pending dir:", path);
    return;
  }
  if (inflight.has(path)) return;
  inflight.add(path);
  // Catch ANY uncaught throw from processOne so the chain never
  // settles in a rejected state. Without this guard, one stray
  // exception (a finally-throw, a runtime invariant break) would
  // wedge every future command attached to the chain.
  chain = chain.then(async () => {
    try {
      await processOne(path);
    } catch (e) {
      console.error("[commands] uncaught in processOne:", e);
    } finally {
      inflight.delete(path);
    }
  });
}

async function processOne(path: string): Promise<void> {
  // A duplicate watcher event (FSEvents coalesces or fires twice)
  // can land after the file was moved by the first run — silent skip.
  if (!(await fileExists(path))) return;

  // Read + parse with one retry. A non-atomic client write can
  // surface as truncated JSON if the watcher fires between flush
  // bytes; a short wait usually catches the rest.
  let raw: unknown = null;
  let parseError: string | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const text = await invoke<string>("read_file", { path });
      raw = JSON.parse(text);
      parseError = null;
      break;
    } catch (e) {
      parseError = errMsg(e);
      if (attempt === 0) await sleep(PARSE_RETRY_MS);
    }
  }
  if (parseError !== null) {
    await fail(path, raw, `Read/parse failed: ${parseError}`);
    return;
  }

  const parsed = CommandSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    await fail(path, raw, `Schema rejected: ${issues}`);
    return;
  }

  try {
    await executeCommand(parsed.data);
  } catch (e) {
    await fail(path, raw, errMsg(e), batchPartialOf(e));
    return;
  }

  const donePath = await markDone(path);
  useCommandStore.getState().bumpExecuted();
  if (donePath) {
    void useCommandStore.getState().addDone(donePath);
  }
  const label = ACTION_RU[parsed.data.action] ?? parsed.data.action;
  toast.success(`✓ ${label}`);
}

async function markDone(path: string): Promise<string | null> {
  const name = path.split("/").pop();
  if (!name) return null;
  const dest = await getCommandsPath("done", name);
  try {
    // moveFile auto-creates the parent if missing.
    await invoke("move_file", { from: path, to: dest });
    return dest;
  } catch (moveErr) {
    // Move failed but the command already executed. If the source
    // file is still there, the next watcher event or boot drain
    // would re-execute it → duplicate effect. Force-delete the
    // source as a fallback; if that also fails, surface to the
    // user so they can clean up by hand.
    try {
      if (await fileExists(path)) {
        await invoke("delete_file", { path });
      }
    } catch (delErr) {
      console.error("[commands] markDone fallback delete failed:", delErr);
      toast.error(
        `Команда выполнена, но не удалось убрать ${name} из pending — ` +
          `удалите вручную, иначе при перезапуске запустится снова.`,
      );
      return null;
    }
    console.warn("[commands] markDone moved-failed; deleted source:", moveErr);
    return null;
  }
}

async function fail(
  path: string,
  raw: unknown,
  error: string,
  partial?: { succeeded: number; failed_at_index: number },
): Promise<void> {
  const name = path.split("/").pop() ?? "command.json";
  const failedPath = await getCommandsPath("failed", name);

  const base =
    raw && typeof raw === "object"
      ? (raw as Record<string, unknown>)
      : { id: name, action: "unknown", data: raw };

  const failed = {
    id: typeof base.id === "string" ? base.id : name,
    action: typeof base.action === "string" ? base.action : "unknown",
    timestamp:
      typeof base.timestamp === "string" ? base.timestamp : undefined,
    data: base.data,
    error,
    failed_at: nowISO(),
    ...(partial ? { partial } : {}),
  };

  try {
    // Write the failed snapshot first — that way we keep a record
    // even if the source delete loses its race against a watcher
    // duplicate event.
    await writeJsonFile(failedPath, failed);
    if (await fileExists(path)) {
      try {
        await invoke("delete_file", { path });
      } catch {
        // already gone
      }
    }
  } catch (e) {
    console.error("[commands] failed to record failure:", e);
  }

  await useCommandStore.getState().addFailed(failedPath);
  const action =
    typeof base.action === "string" ? base.action : "command";
  toast.error(`✗ ${action}: ${error}`);
}
