import { useCallback, useEffect, useMemo, useState } from "react";
import { BlockContextMenu } from "../components/planner/BlockContextMenu";
import { BlockEditor } from "../components/planner/BlockEditor";
import { DurationTip } from "../components/planner/DurationTip";
import { TaskPool } from "../components/planner/TaskPool";
import { WeekNotFoundDialog } from "../components/planner/WeekNotFoundDialog";
import {
  WeekGrid,
  type WeekActions,
  type WeekModel,
} from "../components/planner/WeekGrid";
import { WeekSummary } from "../components/planner/WeekSummary";
import {
  dayBalance,
  dayFreeMinutes,
  overlappingIds,
  weekBalance,
  weekFreeMinutes,
} from "../services/balance";
import {
  END_HOUR,
  START_HOUR,
  formatDate,
  getWeekDates,
} from "../services/time-utils";
import type { Block } from "../schemas";
import { useBlockGesture } from "../hooks/useBlockGesture";
import { usePlannerCommands } from "../hooks/usePlannerCommands";
import { usePlannerHotkeys } from "../hooks/usePlannerHotkeys";
import { usePlannerOverlay } from "../hooks/usePlannerOverlay";
import { useConfigStore } from "../store/config";
import { useScheduleStore } from "../store/schedule";
import { useUIStore } from "../store/ui";

const NOW_TICK_MS = 60_000;
const EMPTY_AREAS: never[] = [];

function useNowInWeek(weekDates: string[], tick: number) {
  return useMemo(() => {
    const now = new Date();
    const iso = formatDate(now);
    const idx = weekDates.indexOf(iso);
    if (idx < 0) return { todayIdx: -1, nowMinutes: null as number | null };
    const minutes = now.getHours() * 60 + now.getMinutes();
    const visible = minutes >= START_HOUR * 60 && minutes < END_HOUR * 60;
    return { todayIdx: idx, nowMinutes: visible ? minutes : null };
    // tick принудительно инвалидирует мемо раз в минуту
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekDates, tick]);
}

export function PlannerPage() {
  const active = useUIStore((s) => s.currentPage === "planner");
  const week = useScheduleStore((s) => s.currentWeek);
  const weekStart = useScheduleStore((s) => s.startDate);
  const blocks = useScheduleStore((s) => s.blocks);

  const selectedId = useUIStore((s) => s.selectedBlockId);
  const setSelected = useUIStore((s) => s.setSelectedBlock);
  const newBlockTrigger = useUIStore((s) => s.newBlockTrigger);
  const weekPromptId = useUIStore((s) => s.weekPromptId);

  const areas = useConfigStore((s) => s.config?.areas ?? EMPTY_AREAS);
  const areaIds = useMemo(() => areas.map((a) => a.id), [areas]);
  const weekDates = useMemo(() => getWeekDates(week), [week]);

  const [nowTick, setNowTick] = useState(0);
  useEffect(() => {
    let interval: number | null = null;
    // Align first tick to the next :00 minute boundary so the now-line
    // jumps right when the wall clock changes minutes; otherwise it
    // would lag by up to NOW_TICK_MS depending on launch time.
    const msToNextMinute = NOW_TICK_MS - (Date.now() % NOW_TICK_MS);
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

  const overlay = usePlannerOverlay();
  const commands = usePlannerCommands({ weekDates, weekStart, todayIdx });

  // External (menu bar) request to open the new-block editor.
  useEffect(() => {
    if (newBlockTrigger === 0) return;
    overlay.openEditorNew(commands.buildNewDefaults());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newBlockTrigger]);

  const selectedBlock = useMemo(
    () => blocks.find((b) => b.id === selectedId) ?? null,
    [blocks, selectedId],
  );

  const onClearSelection = useCallback(
    () => setSelected(null),
    [setSelected],
  );
  const onOpenNew = useCallback(
    () => overlay.openEditorNew(commands.buildNewDefaults()),
    [overlay, commands],
  );
  const onOpenEdit = useCallback(
    (b: Block) => overlay.openEditorEdit(b.id),
    [overlay],
  );
  const onOpenContext = useCallback(
    (b: Block) => {
      const el = document.querySelector<HTMLElement>(
        `.tb[data-block-id="${CSS.escape(b.id)}"]`,
      );
      if (!el) return;
      const r = el.getBoundingClientRect();
      overlay.openContext(r.left + r.width / 2, r.top + r.height / 2, b.id);
    },
    [overlay],
  );
  const onTogglePool = useCallback(
    () => useUIStore.getState().togglePool(),
    [],
  );

  const gesture = useBlockGesture();

  usePlannerHotkeys({
    active,
    overlayOpen: overlay.overlay !== null,
    gesturing: gesture.gesturing,
    selectedBlock,
    onCloseOverlay: overlay.close,
    onClearSelection,
    onCancelGesture: gesture.cancelGesture,
    onOpenNew,
    onTogglePool,
    onOpenEdit,
    onOpenContext,
    onComplete: commands.completeBlock,
    onSkip: commands.skipBlock,
    onDelete: commands.deleteBlock,
    onNudge: commands.nudgeBlock,
  });

  // Outside-click drops selection + closes inline-create.
  useEffect(() => {
    if (!active) return;
    const onDocMouseDown = (e: globalThis.MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (
        target.closest(".tb") ||
        target.closest(".ctx") ||
        target.closest(".modal-bg") ||
        target.closest(".inline-block") ||
        target.closest(".drag-ghost")
      ) {
        return;
      }
      const ui = useUIStore.getState();
      if (ui.selectedBlockId !== null) {
        setSelected(null);
      }
      if (!target.closest(".gr") && overlay.overlay?.kind === "inline-create") {
        overlay.close();
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [active, setSelected, overlay]);

  const ov = overlay.overlay;
  const inlineForGrid =
    ov?.kind === "inline-create"
      ? { date: ov.date, minute: ov.minute }
      : null;

  const weekModel = useMemo<WeekModel>(() => {
    const blocksByDate = new Map<string, typeof blocks>();
    for (const b of blocks) {
      const list = blocksByDate.get(b.date);
      if (list) list.push(b);
      else blocksByDate.set(b.date, [b]);
    }
    return {
      weekKey: week,
      days: weekDates.map((date, idx) => ({
        date,
        isToday: todayIdx === idx,
        blocks: blocksByDate.get(date) ?? [],
        balance: dayBalance(blocks, date, areaIds),
        free: dayFreeMinutes(blocks, date),
        inline:
          inlineForGrid?.date === date
            ? { minute: inlineForGrid.minute }
            : null,
        nowMinutes: todayIdx === idx ? nowMinutes : null,
      })),
      selectedId,
      overlapping: overlappingIds(blocks),
      todayIdx,
    };
  }, [
    blocks,
    week,
    weekDates,
    todayIdx,
    nowMinutes,
    selectedId,
    areaIds,
    inlineForGrid,
  ]);

  const weekBal = useMemo(
    () => weekBalance(blocks, areaIds),
    [blocks, areaIds],
  );
  const freeWk = useMemo(() => weekFreeMinutes(blocks), [blocks]);

  const actions = useMemo<WeekActions>(
    () => ({
      onEmptyClick: (date, minute) => {
        // Open context menu intercepts the click — user wanted to
        // dismiss the menu, not start a new block. Just close it.
        if (overlay.overlay?.kind === "context") {
          overlay.close();
          return;
        }
        overlay.openInline(date, minute);
      },
      onBlockDblClick: (id) => overlay.openEditorEdit(id),
      onBlockContext: (e, id) => {
        setSelected(id);
        overlay.openContext(e.clientX, e.clientY, id);
      },
      onInlineCancel: () => overlay.close(),
      onInlineSubmit: async (date, minute, title) => {
        const created = await commands.createInline(date, minute, title);
        if (created) overlay.close();
      },
    }),
    [overlay, setSelected, commands],
  );

  const editBlock =
    ov?.kind === "editor-edit"
      ? (blocks.find((b) => b.id === ov.blockId) ?? null)
      : null;
  const ctxBlock =
    ov?.kind === "context"
      ? (blocks.find((b) => b.id === ov.blockId) ?? null)
      : null;

  return (
    <div className={`page${active ? " active" : ""}`}>
      <WeekSummary balance={weekBal} freeMinutes={freeWk} />
      <div className="planner-body">
        <WeekGrid
          model={weekModel}
          actions={actions}
          dropTarget={gesture.dropTarget}
          draggingBlockId={gesture.activeDragBlockId}
          resizingBlockId={gesture.resizeState?.blockId ?? null}
          resizeDuration={gesture.resizeState?.duration ?? null}
          onBlockPointerDown={gesture.onBlockPointerDown}
        />
        <TaskPool onPoolItemPointerDown={gesture.onPoolItemPointerDown} />
      </div>
      {gesture.resizeState ? (
        <DurationTip
          x={gesture.resizeState.tipX}
          y={gesture.resizeState.tipY}
          duration={gesture.resizeState.duration}
        />
      ) : null}
      {ov?.kind === "editor-new" && (
        <BlockEditor
          mode={{ kind: "new", defaults: ov.defaults }}
          weekStart={weekStart}
          areas={areas}
          onClose={overlay.close}
        />
      )}
      {ov?.kind === "editor-edit" && editBlock && (
        <BlockEditor
          key={`edit:${editBlock.id}`}
          mode={{ kind: "edit", block: editBlock }}
          weekStart={weekStart}
          areas={areas}
          onClose={overlay.close}
        />
      )}
      {ov?.kind === "context" && ctxBlock && (
        <BlockContextMenu
          x={ov.x}
          y={ov.y}
          block={ctxBlock}
          areas={areas}
          onEdit={() => overlay.openEditorEdit(ov.blockId)}
          onClose={overlay.close}
        />
      )}
      {weekPromptId && <WeekNotFoundDialog weekId={weekPromptId} />}
    </div>
  );
}
