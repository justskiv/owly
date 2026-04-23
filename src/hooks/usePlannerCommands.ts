import { useCallback, useMemo } from "react";
import type { Block } from "../schemas";
import type { EditorPrefill } from "../components/planner/BlockEditor";
import { toast } from "../components/shared/Toast";
import { useScheduleStore } from "../store/schedule";
import { useUIStore } from "../store/ui";
import {
  DEFAULT_BLOCK_CATEGORY,
  DEFAULT_BLOCK_DURATION_MIN,
  END_HOUR,
  SNAP_MIN,
  START_HOUR,
  clampBlockToGrid,
  minutesToTime,
  timeToMinutes,
} from "../services/time-utils";

interface CommandsArgs {
  weekDates: string[];
  weekStart: string;
  todayIdx: number;
}

export function usePlannerCommands({
  weekDates,
  weekStart,
  todayIdx,
}: CommandsArgs) {
  const setSelected = useUIStore((s) => s.setSelectedBlock);

  const buildNewDefaults = useCallback((): EditorPrefill => {
    const date = todayIdx >= 0 ? weekDates[todayIdx] : weekStart;
    const now = new Date();
    const snapped =
      Math.round((now.getHours() * 60 + now.getMinutes()) / SNAP_MIN) *
      SNAP_MIN;
    const clamped = Math.max(
      START_HOUR * 60,
      Math.min((END_HOUR - 1) * 60, snapped),
    );
    return {
      date,
      start: minutesToTime(clamped),
      duration: DEFAULT_BLOCK_DURATION_MIN,
      category: DEFAULT_BLOCK_CATEGORY,
    };
  }, [weekDates, weekStart, todayIdx]);

  const setStatus = useCallback(
    async (block: Block, status: "done" | "skipped", label: string) => {
      try {
        await useScheduleStore.getState().setBlockStatus(block.id, status);
        toast.success(label);
      } catch (e) {
        toast.error(`Не удалось сохранить: ${(e as Error).message}`);
      }
    },
    [],
  );

  const completeBlock = useCallback(
    (block: Block) => setStatus(block, "done", "Done ✓"),
    [setStatus],
  );

  const skipBlock = useCallback(
    (block: Block) => setStatus(block, "skipped", "Skipped"),
    [setStatus],
  );

  const deleteBlock = useCallback(
    async (block: Block) => {
      try {
        await useScheduleStore.getState().deleteBlock(block.id);
        setSelected(null);
        toast.success(`✕ Удалён: ${block.title}`);
      } catch (e) {
        toast.error(`Не удалось удалить: ${(e as Error).message}`);
      }
    },
    [setSelected],
  );

  const nudgeBlock = useCallback(async (block: Block, delta: number) => {
    const cur = timeToMinutes(block.start);
    const { start: next } = clampBlockToGrid(cur + delta, block.duration);
    if (next === cur) return;
    try {
      await useScheduleStore
        .getState()
        .updateBlock(block.id, { start: minutesToTime(next) });
      toast.success(minutesToTime(next));
    } catch (e) {
      toast.error(`Не удалось сохранить: ${(e as Error).message}`);
    }
  }, []);

  const duplicateBlock = useCallback(
    async (block: Block) => {
      const newStartMin = timeToMinutes(block.start) + block.duration;
      const { start, duration } = clampBlockToGrid(newStartMin, block.duration);
      try {
        const created = await useScheduleStore.getState().addBlock({
          title: block.title,
          date: block.date,
          start: minutesToTime(start),
          duration,
          category: block.category,
          status: "planned",
          notes: block.notes,
          source_entity_id: block.source_entity_id,
        });
        setSelected(created.id);
        toast.success(`⧉ Дублирован: ${block.title}`);
      } catch (e) {
        toast.error(`Не удалось дублировать: ${(e as Error).message}`);
      }
    },
    [setSelected],
  );

  const setBlockCategory = useCallback(
    async (block: Block, categoryId: string) => {
      if (categoryId === block.category) return;
      try {
        await useScheduleStore
          .getState()
          .updateBlock(block.id, { category: categoryId });
        toast.success(`Категория: ${categoryId}`);
      } catch (e) {
        toast.error(`Не удалось сохранить: ${(e as Error).message}`);
      }
    },
    [],
  );

  const createInline = useCallback(
    async (
      date: string,
      minute: number,
      title: string,
    ): Promise<Block | null> => {
      try {
        const created = await useScheduleStore.getState().addBlock({
          title,
          date,
          start: minutesToTime(minute),
          duration: DEFAULT_BLOCK_DURATION_MIN,
          category: DEFAULT_BLOCK_CATEGORY,
          status: "planned",
          notes: "",
          source_entity_id: null,
        });
        setSelected(created.id);
        toast.success(`✓ Создан: ${title}`);
        return created;
      } catch (e) {
        toast.error(`Не удалось создать: ${(e as Error).message}`);
        return null;
      }
    },
    [setSelected],
  );

  // Stable identity for the same reasons as usePlannerOverlay.
  return useMemo(
    () => ({
      buildNewDefaults,
      completeBlock,
      skipBlock,
      deleteBlock,
      nudgeBlock,
      duplicateBlock,
      setBlockCategory,
      createInline,
    }),
    [
      buildNewDefaults,
      completeBlock,
      skipBlock,
      deleteBlock,
      nudgeBlock,
      duplicateBlock,
      setBlockCategory,
      createInline,
    ],
  );
}
