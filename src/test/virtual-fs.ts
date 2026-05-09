import { mockIPC } from "@tauri-apps/api/mocks";

export class VirtualFS {
  private files = new Map<string, string>();
  private dirs = new Set<string>();

  read(path: string): string {
    const c = this.files.get(path);
    if (c === undefined) throw new Error(`ENOENT: ${path}`);
    return c;
  }

  write(path: string, content: string): void {
    this.files.set(path, content);
    this.registerParents(path);
  }

  exists(path: string): boolean {
    return this.files.has(path) || this.dirs.has(path);
  }

  // Names directly under `dir` — files and explicitly-ensured
  // subdirectories. Mirrors fs::read_dir, not just files.
  list(dir: string): string[] {
    const prefix = dir.endsWith("/") ? dir : dir + "/";
    const names = new Set<string>();
    for (const p of this.files.keys()) {
      if (!p.startsWith(prefix)) continue;
      const rest = p.slice(prefix.length);
      const slash = rest.indexOf("/");
      names.add(slash === -1 ? rest : rest.slice(0, slash));
    }
    for (const d of this.dirs) {
      if (!d.startsWith(prefix)) continue;
      const rest = d.slice(prefix.length);
      const slash = rest.indexOf("/");
      names.add(slash === -1 ? rest : rest.slice(0, slash));
    }
    return [...names].sort();
  }

  ensureDir(path: string): void {
    this.dirs.add(path);
    this.registerParents(path);
  }

  // Real fs::rename creates destination parents (Rust does
  // fs::create_dir_all before the rename in move_file).
  move(from: string, to: string): void {
    if (!this.files.has(from)) throw new Error(`ENOENT: ${from}`);
    this.files.set(to, this.files.get(from)!);
    this.files.delete(from);
    this.registerParents(to);
  }

  delete(path: string): void {
    if (!this.files.delete(path)) throw new Error(`ENOENT: ${path}`);
    // Don't remove dirs — empty dirs are still valid surfaces
    // (commands/{pending,done,failed} are routinely empty).
  }

  snapshot(): Record<string, string> {
    return Object.fromEntries(this.files);
  }

  static fromSnapshot(s: Record<string, string>): VirtualFS {
    const fs = new VirtualFS();
    for (const [k, v] of Object.entries(s)) fs.write(k, v);
    return fs;
  }

  private registerParents(p: string): void {
    let cur = p;
    while (true) {
      const parent = cur.replace(/\/[^/]+$/, "");
      if (!parent || parent === cur) break;
      this.dirs.add(parent);
      cur = parent;
    }
  }
}

// Module-level current FS so test helpers can reach it without
// passing the instance everywhere. Reset by installFS().
let currentFS: VirtualFS | null = null;

export function getCurrentFS(): VirtualFS {
  if (!currentFS) throw new Error("No VirtualFS installed");
  return currentFS;
}

export const ROOT = "/tuzov-test/data";

export function installFS(fs: VirtualFS): void {
  currentFS = fs;
  mockIPC(
    async (cmd, args: unknown) => {
      const a = (args ?? {}) as Record<string, string>;
      switch (cmd) {
        case "plugin:app|name":
          // App.tsx's error-dialog path resolves productName via
          // getName(); without this case mockIPC returns null and
          // any test that hits the catch branch shows "null" as
          // the app name.
          return "TuzovOS";
        case "get_data_dir":
          return ROOT;
        case "read_file":
          return fs.read(a.path);
        case "write_file":
          fs.write(a.path, a.content);
          return null;
        case "file_exists":
          return fs.exists(a.path);
        case "ensure_dir":
          fs.ensureDir(a.path);
          return null;
        case "list_files":
          return fs.list(a.dir);
        case "move_file":
          fs.move(a.from, a.to);
          return null;
        case "delete_file":
          fs.delete(a.path);
          return null;
      }
      return null;
    },
    { shouldMockEvents: true },
  );
}
