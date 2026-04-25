import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";
import { toast } from "../components/shared/Toast";

let cachedDataDir: string | null = null;

export async function getDataDir(): Promise<string> {
  if (cachedDataDir !== null) return cachedDataDir;
  cachedDataDir = await invoke<string>("get_data_dir");
  return cachedDataDir;
}

function normalizeJoin(parts: string[]): string {
  return parts
    .filter((p) => p.length > 0)
    .join("/")
    .replace(/\/+/g, "/");
}

export async function getDataPath(...segments: string[]): Promise<string> {
  const base = await getDataDir();
  return normalizeJoin([base, ...segments]);
}

export async function getCommandsPath(...segments: string[]): Promise<string> {
  const base = await getDataDir();
  const root = base.replace(/\/data\/?$/, "");
  return normalizeJoin([root, "commands", ...segments]);
}

export async function fileExists(path: string): Promise<boolean> {
  return await invoke<boolean>("file_exists", { path });
}

export async function ensureDir(path: string): Promise<void> {
  await invoke("ensure_dir", { path });
}

export async function listFiles(dir: string): Promise<string[]> {
  return await invoke<string[]>("list_files", { dir });
}

export async function moveFile(from: string, to: string): Promise<void> {
  await invoke("move_file", { from, to });
}

export async function deleteFile(path: string): Promise<void> {
  await invoke("delete_file", { path });
}

export class JsonReadError extends Error {
  constructor(
    public path: string,
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "JsonReadError";
  }
}

export async function readJsonFile<T>(
  path: string,
  schema: z.ZodType<T>,
): Promise<T> {
  let content: string;
  try {
    content = await invoke<string>("read_file", { path });
  } catch (e) {
    throw new JsonReadError(path, `Не удалось прочитать файл: ${String(e)}`, e);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    throw new JsonReadError(
      path,
      `Невалидный JSON: ${(e as Error).message}`,
      e,
    );
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    throw new JsonReadError(path, `Валидация не прошла: ${issues}`);
  }
  return result.data;
}

export async function writeJsonFile(
  path: string,
  data: unknown,
): Promise<void> {
  const content = JSON.stringify(data, null, 2);
  await invoke("write_file", { path, content });
}

export async function readJsonFileOrCreate<T>(
  path: string,
  schema: z.ZodType<T>,
  defaultData: T,
): Promise<T> {
  if (!(await fileExists(path))) {
    await writeJsonFile(path, defaultData);
    return defaultData;
  }
  try {
    return await readJsonFile(path, schema);
  } catch (e) {
    if (!(e instanceof JsonReadError)) throw e;

    // Read the raw bytes BEFORE touching disk. The original recovery
    // flow would silently overwrite the user's file with defaults if
    // `moveFile` failed (cross-device rename, permission, etc.) —
    // worst case the user's whole entities.json vanishes because a
    // single field failed validation. Now we always have a copy in
    // memory and fall back to a content-write backup when rename
    // can't create the side file.
    let rawBytes: string | null = null;
    try {
      rawBytes = await invoke<string>("read_file", { path });
    } catch {
      rawBytes = null;
    }

    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const corrupted = `${path}.corrupted-${ts}.json`;

    let backupOk = false;
    try {
      await moveFile(path, corrupted);
      backupOk = true;
    } catch {
      if (rawBytes !== null) {
        try {
          await invoke("write_file", { path: corrupted, content: rawBytes });
          backupOk = true;
        } catch {
          backupOk = false;
        }
      }
    }

    if (!backupOk) {
      // Without a verified backup we refuse to overwrite. The caller
      // gets the original JsonReadError so the app can surface a
      // clear error rather than returning defaults that look like
      // lost data.
      console.error(`[recovery] ${path} backup FAILED: ${e.message}`);
      toast.error(
        `Файл повреждён, бэкап создать не удалось. Данные не тронуты.`,
      );
      throw e;
    }

    console.error(`[recovery] ${path} → ${corrupted}: ${e.message}`);
    const name = corrupted.split("/").pop() ?? corrupted;
    toast.error(`Файл повреждён, восстановлен пустой. Бэкап: ${name}`);
    await writeJsonFile(path, defaultData);
    return defaultData;
  }
}

export async function ensureDataDir(): Promise<string> {
  const base = await getDataDir();
  const root = base.replace(/\/data\/?$/, "");
  await ensureDir(base);
  await ensureDir(normalizeJoin([base, "schedule"]));
  await ensureDir(normalizeJoin([base, "templates"]));
  await ensureDir(normalizeJoin([base, "dashboards"]));
  await ensureDir(normalizeJoin([root, "commands", "pending"]));
  await ensureDir(normalizeJoin([root, "commands", "done"]));
  await ensureDir(normalizeJoin([root, "commands", "failed"]));
  return base;
}
