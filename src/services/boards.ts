// Project boards for the Kanban screen (Phase 4). Hardcoded for
// Phase 1; Phase 9 decides whether to move them into config.json.

export interface Board {
  id: string;
  title: string;
  columns: string[];
}

export const BOARDS: readonly Board[] = [
  {
    id: "brd1",
    title: "Видео",
    columns: ["Идея", "Сценарий", "Съёмка", "Монтаж", "Публикация"],
  },
  {
    id: "brd2",
    title: "Контент",
    columns: ["Идея", "Черновик", "Ревью", "Публикация"],
  },
  {
    id: "brd3",
    title: "Разное",
    columns: ["Надо", "Начал", "Делаю", "Почти", "Готово"],
  },
] as const;

export type BoardId = (typeof BOARDS)[number]["id"];

export const FALLBACK_BOARD_ID: BoardId = "brd3";

export function getBoardById(id: string): Board | undefined {
  return BOARDS.find((b) => b.id === id);
}
