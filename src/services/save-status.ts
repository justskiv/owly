import { useUIStore } from "../store/ui";

export async function trackSave<T>(fn: () => Promise<T>): Promise<T> {
  const ui = useUIStore.getState();
  ui.setSaveStatus("saving");
  try {
    const result = await fn();
    useUIStore.getState().setSaveStatus("saved");
    setTimeout(() => {
      const s = useUIStore.getState();
      if (s.saveStatus === "saved") s.setSaveStatus("idle");
    }, 1500);
    return result;
  } catch (e) {
    useUIStore.getState().setSaveStatus("error", (e as Error).message);
    throw e;
  }
}
