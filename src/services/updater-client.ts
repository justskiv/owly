import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { ask, message } from "@tauri-apps/plugin-dialog";

// Manual trigger from the "Check for Updates…" menu item. Silent boot
// check lives elsewhere; this one always tells the user something —
// either "up to date" or prompts to install — because nothing happens
// without that feedback when the user explicitly asked.
export async function checkForUpdatesManual(): Promise<void> {
  try {
    const update = await check();
    if (!update) {
      await message("You're on the latest version.", {
        title: "Owly",
        kind: "info",
      });
      return;
    }
    const yes = await ask(
      `Owly ${update.version} is available. Install and restart?`,
      { title: "Update available", kind: "info" },
    );
    if (!yes) return;
    await update.downloadAndInstall();
    await relaunch();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await message(`Update check failed:\n\n${msg}`, {
      title: "Owly",
      kind: "error",
    });
  }
}
