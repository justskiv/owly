import type { Entity, ProjectEntity } from "../schemas";
import { getBoardById } from "./boards";

export const STALE_THRESHOLD_DAYS = 14;

export function projectsForBoard(
  entities: readonly Entity[],
  boardId: string,
): ProjectEntity[] {
  return entities.filter(
    (e): e is ProjectEntity =>
      e.type === "project" &&
      e.status === "active" &&
      e.fields.board_id === boardId,
  );
}

export function applyProjectFilters(
  projects: readonly ProjectEntity[],
  catFilter: string | null,
  staleFilter: boolean,
): ProjectEntity[] {
  let r: ProjectEntity[] = [...projects];
  if (catFilter) r = r.filter((p) => p.tags.includes(catFilter));
  if (staleFilter) {
    r = r.filter((p) => p.fields.last_activity_days >= STALE_THRESHOLD_DAYS);
  }
  return r;
}

// Bucket out-of-bounds column_index into the last column so projects
// stranded by a board switch are never invisible. The popup's board
// selector resets column_index to 0, but pre-existing or hand-edited
// data may still point past columns.length — the second line of
// defence keeps them on screen.
export function projectsForColumn(
  projects: readonly ProjectEntity[],
  boardId: string,
  colIdx: number,
): ProjectEntity[] {
  const board = getBoardById(boardId);
  if (!board) return [];
  const last = board.columns.length - 1;
  return projects.filter((p) => {
    const c = p.fields.column_index;
    if (colIdx === last) return c >= last;
    return c === colIdx;
  });
}
