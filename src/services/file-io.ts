import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";

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
  return readJsonFile(path, schema);
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
