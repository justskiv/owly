import { mockIPC } from "@tauri-apps/api/mocks";

export function installDefaultMockIPC(): void {
  mockIPC(async (cmd) => {
    if (cmd === "get_data_dir") return "/test-data";
    if (cmd === "read_file") return "";
    if (cmd === "write_file") return null;
    if (cmd === "file_exists") return false;
    if (cmd === "ensure_dir") return null;
    if (cmd === "list_files") return [];
    if (cmd === "move_file") return null;
    if (cmd === "delete_file") return null;
    return null;
  });
}
