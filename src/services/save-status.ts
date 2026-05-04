import { useUIStore } from "../store/ui";
import { toast } from "../components/shared/Toast";
import { errMsg } from "./format";

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
    const message = errMsg(e);
    const prev = useUIStore.getState().saveStatus;
    useUIStore.getState().setSaveStatus("error", message);
    // First transition into error fires a toast — without it, a
    // disk-full / readonly mount left the user staring at a
    // quietly red dot they would never click. Subsequent errors
    // while already in `error` only update the message; the dot
    // stays red and the user can click it for the full text.
    if (prev !== "error") {
      toast.error(`Ошибка сохранения: ${message}`);
    }
    throw e;
  }
}
