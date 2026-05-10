import { useUIStore, type ArchiveSort } from "../../store/ui";

const SORT_OPTIONS: Array<{ value: ArchiveSort; label: string }> = [
  { value: "completed_desc", label: "Дата ↓" },
  { value: "completed_asc", label: "Дата ↑" },
  { value: "title_asc", label: "Имя ↑" },
  { value: "title_desc", label: "Имя ↓" },
];

export function ArchiveToolbar() {
  const search = useUIStore((s) => s.archiveSearch);
  const setSearch = useUIStore((s) => s.setArchiveSearch);
  const sort = useUIStore((s) => s.archiveSort);
  const setSort = useUIStore((s) => s.setArchiveSort);

  return (
    <div className="arch-toolbar">
      <input
        type="text"
        className="search-input arch-search"
        placeholder="Поиск"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        autoFocus
      />
      <select
        className="arch-sort"
        value={sort}
        onChange={(e) => setSort(e.target.value as ArchiveSort)}
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
