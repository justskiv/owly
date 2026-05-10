import { useEffect, useMemo } from "react";
import type { TaskEntity } from "../schemas";
import { useEntityStore } from "../store/entities";
import { useUIStore, type ArchiveSort } from "../store/ui";
import { now } from "../services/clock";
import { groupArchiveByMonth } from "../services/archive-grouping";
import { ArchiveHeader } from "../components/archive/ArchiveHeader";
import { ArchiveToolbar } from "../components/archive/ArchiveToolbar";
import { ArchiveList } from "../components/archive/ArchiveList";
import { ArchiveSidebar } from "../components/archive/ArchiveSidebar";

// completed_at is stored as YYYY-MM-DDTHH:MM:SS without timezone, so
// lex compare is correct chronological order — no Date parsing.
const SORT_FNS: Record<
  ArchiveSort,
  (a: TaskEntity, b: TaskEntity) => number
> = {
  completed_desc: (a, b) =>
    (b.completed_at ?? "").localeCompare(a.completed_at ?? ""),
  completed_asc: (a, b) =>
    (a.completed_at ?? "").localeCompare(b.completed_at ?? ""),
  title_asc: (a, b) => a.title.localeCompare(b.title, "ru"),
  title_desc: (a, b) => b.title.localeCompare(a.title, "ru"),
};

export function ArchivePage() {
  const entities = useEntityStore((s) => s.entities);
  const search = useUIStore((s) => s.archiveSearch);
  const sort = useUIStore((s) => s.archiveSort);
  const filter = useUIStore((s) => s.archiveFilter);

  // Escape exits the archive — first clears the search if focus is in
  // the search input and search is non-empty (matches macOS-style
  // "clear before close"), otherwise returns to the active list.
  // Suspends if an entity popup is open so its own Esc handler closes
  // the popup first.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const ui = useUIStore.getState();
      if (ui.entityPopup.open) return;
      const target = e.target as Element | null;
      const inSearch =
        target instanceof HTMLInputElement &&
        target.classList.contains("arch-search");
      if (inSearch && ui.archiveSearch.length > 0) {
        ui.setArchiveSearch("");
        e.preventDefault();
        return;
      }
      ui.setTasksView("active");
      e.preventDefault();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const doneTasks = useMemo(
    () =>
      entities.filter(
        (e): e is TaskEntity => e.type === "task" && e.status === "done",
      ),
    [entities],
  );

  const filteredAndSorted = useMemo(() => {
    let pool = doneTasks;
    if (search) {
      const q = search.toLowerCase();
      pool = pool.filter((t) => t.title.toLowerCase().includes(q));
    }
    if (filter.cat) {
      const cat = filter.cat;
      pool = pool.filter((t) => t.tags.includes(cat));
    }
    if (filter.prio) {
      const prio = filter.prio;
      pool = pool.filter((t) => t.priority === prio);
    }
    return [...pool].sort(SORT_FNS[sort]);
  }, [doneTasks, search, filter.cat, filter.prio, sort]);

  // Sort by title makes month grouping nonsensical (adjacent rows
  // would jump across years). Render flat in that case.
  const groups = useMemo(() => {
    if (sort.startsWith("title_")) return null;
    return groupArchiveByMonth(filteredAndSorted, now());
  }, [filteredAndSorted, sort]);

  return (
    <div className="archive-page" data-screen="archive">
      <div className="archive-inner">
        <ArchiveHeader filteredCount={filteredAndSorted.length} />
        <ArchiveToolbar />
        <ArchiveList
          groups={groups}
          flatTasks={filteredAndSorted}
          totalDone={doneTasks.length}
        />
      </div>
      <ArchiveSidebar doneTasks={doneTasks} />
    </div>
  );
}
