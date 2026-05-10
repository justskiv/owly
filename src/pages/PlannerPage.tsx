import { useCallback, useEffect, useMemo, useState } from "react";
import type { Block, BlockStatus, Entity } from "../schemas";
import { BlockContextMenu } from "../components/planner/BlockContextMenu";
import { DurationTip } from "../components/planner/DurationTip";
import { PoolSidebar } from "../components/planner/PoolSidebar";
import { WeekGrid } from "../components/planner/WeekGrid";
import { WeekNotFoundDialog } from "../components/planner/WeekNotFoundDialog";
import { now, nowMs } from "../services/clock";
import {
  END_HOUR,
  START_HOUR,
  formatDate,
  getWeekDates,
} from "../services/time-utils";
import { useBlockGesture } from "../hooks/useBlockGesture";
import { useScheduleStore } from "../store/schedule";
import { useUIStore } from "../store/ui";
import { useEntityStore } from "../store/entities";
import { toast } from "../components/shared/Toast";
import { errMsg } from "../services/format";

const NOW_TICK_MS = 60_000;
const POPUP_ENABLED_TYPES = new Set<Entity["type"]>([
  "task",
  "project",
  "direction",
]);

interface CtxMenuState {
  x: number;
  y: number;
  blockId: string;
}

function useNowInWeek(weekDates: string[], tick: number) {
  // `tick` doesn't appear in the body but is the explicit cadence
  // signal — the parent bumps it once per minute so this memo
  // recomputes the wall-clock minute that the now-line follows.
  void tick;
  return useMemo(() => {
    const wall = now();
    const iso = formatDate(wall);
    const idx = weekDates.indexOf(iso);
    if (idx < 0) return { todayIdx: -1, nowMinutes: null as number | null };
    const minutes = wall.getHours() * 60 + wall.getMinutes();
    const visible = minutes >= START_HOUR * 60 && minutes < END_HOUR * 60;
    return { todayIdx: idx, nowMinutes: visible ? minutes : null };
    // tick isn't textually used in the body but is the trigger that
    // forces a recompute every minute (so the now-line moves).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekDates, tick]);
}

export function PlannerPage() {
  const active = useUIStore((s) => s.currentPage === "plan");
  const week = useScheduleStore((s) => s.currentWeek);
  const blocks = useScheduleStore((s) => s.blocks);

  const selectedId = useUIStore((s) => s.selectedBlockId);
  const setSelected = useUIStore((s) => s.setSelectedBlock);
  const weekPromptId = useUIStore((s) => s.weekPromptId);
  const openEntityPopup = useUIStore((s) => s.openEntityPopup);
  const openBlockPopup = useUIStore((s) => s.openBlockPopup);
  const poolModalOpen = useUIStore((s) => s.poolModalOpen);
  const blockPopupOpen = useUIStore(
    (s) => s.blockPopup.open || s.entityPopup.open,
  );

  const weekDates = useMemo(() => getWeekDates(week), [week]);

  const [nowTick, setNowTick] = useState(0);
  useEffect(() => {
    let interval: number | null = null;
    const msToNextMinute = NOW_TICK_MS - (nowMs() % NOW_TICK_MS);
    const start = window.setTimeout(() => {
      setNowTick((t) => t + 1);
      interval = window.setInterval(
        () => setNowTick((t) => t + 1),
        NOW_TICK_MS,
      );
    }, msToNextMinute);
    return () => {
      window.clearTimeout(start);
      if (interval !== null) window.clearInterval(interval);
    };
  }, []);
  const { todayIdx, nowMinutes } = useNowInWeek(weekDates, nowTick);

  const gesture = useBlockGesture();

  const blocksByDate = useMemo(() => {
    const map = new Map<string, Block[]>();
    for (const b of blocks) {
      const list = map.get(b.date);
      if (list) list.push(b);
      else map.set(b.date, [b]);
    }
    return map;
  }, [blocks]);

  const [ctxMenu, setCtxMenu] = useState<CtxMenuState | null>(null);
  const closeCtxMenu = useCallback(() => setCtxMenu(null), []);

  const onBlockDoubleClick = useCallback(
    (block: Block, rect: DOMRect) => {
      const entityId = block.source_entity_id;
      if (entityId) {
        const entity = useEntityStore
          .getState()
          .entities.find((e) => e.id === entityId);
        if (entity && POPUP_ENABLED_TYPES.has(entity.type)) {
          openEntityPopup(entityId, { type: "rect", rect }, "right");
          return;
        }
      }
      openBlockPopup(block.id, { type: "rect", rect }, "right");
    },
    [openEntityPopup, openBlockPopup],
  );

  const onBlockContextMenu = useCallback(
    (e: { clientX: number; clientY: number }, block: Block) => {
      setSelected(block.id);
      setCtxMenu({ x: e.clientX, y: e.clientY, blockId: block.id });
    },
    [setSelected],
  );

  // Selected-block hotkeys: Delete/Backspace removes; Escape clears
  // selection or cancels the active drag. Cmd+N is global (Quick Add)
  // and not handled here.
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && gesture.gesturing) {
        gesture.cancelGesture();
        return;
      }
      const t = e.target as HTMLElement | null;
      const isInput =
        t instanceof HTMLInputElement ||
        t instanceof HTMLTextAreaElement ||
        (t != null && t.isContentEditable);
      if (isInput) {
        if (e.key === "Escape") (t as HTMLElement).blur();
        return;
      }
      if (e.key === "Escape") {
        if (ctxMenu) {
          setCtxMenu(null);
          return;
        }
        if (selectedId !== null) setSelected(null);
        return;
      }
      // Context menu hosts its own keydown listener (capture phase) and
      // pre-empts these shortcuts while it's open.
      if (poolModalOpen || blockPopupOpen || gesture.gesturing || ctxMenu) {
        return;
      }
      if (selectedId === null) return;
      const noMod = !e.metaKey && !e.ctrlKey && !e.altKey;
      if (!noMod) return;
      const sb = blocks.find((b) => b.id === selectedId);
      if (!sb) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        const t2 = sb.title;
        void useScheduleStore
          .getState()
          .deleteBlock(selectedId)
          .then(() => {
            setSelected(null);
            toast.success(`Удалён: ${t2}`);
          })
          .catch((err) => toast.error(errMsg(err)));
      } else if (e.code === "KeyD") {
        e.preventDefault();
        const isDone = sb.status === "done";
        const next: BlockStatus = isDone ? "planned" : "done";
        void useScheduleStore
          .getState()
          .setBlockStatus(selectedId, next)
          .then(() => toast.success(isDone ? "Не готово" : "Готово ✓"))
          .catch((err) => toast.error(errMsg(err)));
      } else if (e.code === "KeyS") {
        e.preventDefault();
        const isSkipped = sb.status === "skipped";
        const next: BlockStatus = isSkipped ? "planned" : "skipped";
        void useScheduleStore
          .getState()
          .setBlockStatus(selectedId, next)
          .then(() =>
            toast.success(isSkipped ? "Не пропущено" : "Пропущено ✗"),
          )
          .catch((err) => toast.error(errMsg(err)));
      } else if (e.code === "KeyE" || e.key === "Enter") {
        e.preventDefault();
        const el = document.querySelector<HTMLElement>(
          `[data-block-id="${selectedId}"]`,
        );
        if (el) {
          const rect = el.getBoundingClientRect();
          openBlockPopup(selectedId, { type: "rect", rect }, "right");
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    active,
    gesture,
    ctxMenu,
    selectedId,
    setSelected,
    poolModalOpen,
    blockPopupOpen,
    blocks,
    openBlockPopup,
  ]);

  // Outside-click drops selection. Doesn't close popups (they manage
  // their own outside-click), doesn't fire while a gesture is active.
  useEffect(() => {
    if (!active) return;
    const onDocMouseDown = (e: globalThis.MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (
        target.closest(".block") ||
        target.closest(".block-ctx") ||
        target.closest(".entity-popup") ||
        target.closest(".modal-overlay") ||
        target.closest(".drag-ghost") ||
        target.closest(".pool-sidebar")
      ) {
        return;
      }
      if (selectedId !== null) setSelected(null);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [active, selectedId, setSelected]);

  const ctxBlock = useMemo(
    () => (ctxMenu ? blocks.find((b) => b.id === ctxMenu.blockId) : null),
    [ctxMenu, blocks],
  );

  return (
    <div
      className={`plan-view${active ? " active" : ""}`}
      data-screen="plan"
    >
      <WeekGrid
        weekKey={week}
        weekDates={weekDates}
        blocksByDate={blocksByDate}
        selectedId={selectedId}
        draggingId={gesture.activeDragBlockId}
        resizingId={gesture.resizeState?.blockId ?? null}
        resizeDuration={gesture.resizeState?.duration ?? null}
        dropTarget={gesture.dropTarget}
        todayIdx={todayIdx}
        nowMinutes={nowMinutes}
        onBlockPointerDown={gesture.onBlockPointerDown}
        onBlockDoubleClick={onBlockDoubleClick}
        onBlockContextMenu={onBlockContextMenu}
      />
      <PoolSidebar
        onPoolItemDragStart={gesture.onPoolItemDragStart}
        onEntityDragStart={gesture.onPoolItemPointerDown}
      />
      {gesture.resizeState && (
        <DurationTip
          x={gesture.resizeState.tipX}
          y={gesture.resizeState.tipY}
          duration={gesture.resizeState.duration}
        />
      )}
      {ctxMenu && ctxBlock && (
        <BlockContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          block={ctxBlock}
          onClose={closeCtxMenu}
        />
      )}
      {weekPromptId && <WeekNotFoundDialog weekId={weekPromptId} />}
    </div>
  );
}
