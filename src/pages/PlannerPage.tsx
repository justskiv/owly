import { useEffect, useMemo, useState } from "react";
import type { MouseEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { BlockContextMenu } from "../components/planner/BlockContextMenu";
import {
  BlockEditor,
  type EditorPrefill,
} from "../components/planner/BlockEditor";
import { WeekGrid } from "../components/planner/WeekGrid";
import { WeekSummary } from "../components/planner/WeekSummary";
import {
  dayBalance,
  dayFreeMinutes,
  overlappingIds,
  weekBalance,
  weekFreeMinutes,
} from "../services/balance";
import {
  DEFAULT_BLOCK_CATEGORY,
  DEFAULT_BLOCK_DURATION_MIN,
  END_HOUR,
  SNAP_MIN,
  START_HOUR,
  clampBlockToGrid,
  formatDate,
  formatWeekRange,
  getWeekDates,
  getWeekNumber,
  minutesToTime,
  timeToMinutes,
} from "../services/time-utils";
import { toast } from "../components/shared/Toast";
import { useConfigStore } from "../store/config";
import { useScheduleStore } from "../store/schedule";
import { useUIStore } from "../store/ui";

type EditorState =
  | null
  | { mode: "new"; prefill: EditorPrefill }
  | { mode: "edit"; id: string };

type CtxState = null | { x: number; y: number; blockId: string };
type InlineState = null | { date: string; minute: number };

const NOW_TICK_MS = 60_000;
const EMPTY_AREAS: never[] = [];

function buildNewDefaults(
  weekDates: string[],
  weekStart: string,
  todayIdx: number,
): EditorPrefill {
  const date = todayIdx >= 0 ? weekDates[todayIdx] : weekStart;
  const now = new Date();
  const snapped =
    Math.round((now.getHours() * 60 + now.getMinutes()) / SNAP_MIN) * SNAP_MIN;
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
}

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
  const goToPrev = useScheduleStore((s) => s.goToPrevWeek);
  const goToNext = useScheduleStore((s) => s.goToNextWeek);
  const goToCurrent = useScheduleStore((s) => s.goToCurrentWeek);

  const selectedId = useUIStore((s) => s.selectedBlockId);
  const setSelectedBlock = useUIStore((s) => s.setSelectedBlock);

  const areas = useConfigStore((s) => s.config?.areas ?? EMPTY_AREAS);
  const areaIds = useMemo(() => areas.map((a) => a.id), [areas]);

  const weekDates = useMemo(() => getWeekDates(week), [week]);
  const overlapping = useMemo(() => overlappingIds(blocks), [blocks]);
  const dayBalances = useMemo(
    () =>
      weekDates.map((d) => ({
        date: d,
        balance: dayBalance(blocks, d, areaIds),
        free: dayFreeMinutes(blocks, d),
      })),
    [blocks, weekDates, areaIds],
  );
  const weekBal = useMemo(
    () => weekBalance(blocks, areaIds),
    [blocks, areaIds],
  );
  const freeWk = useMemo(() => weekFreeMinutes(blocks), [blocks]);

  const [nowTick, setNowTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(
      () => setNowTick((t) => t + 1),
      NOW_TICK_MS,
    );
    return () => window.clearInterval(id);
  }, []);
  const { todayIdx, nowMinutes } = useNowInWeek(weekDates, nowTick);

  const [editor, setEditor] = useState<EditorState>(null);
  const [ctx, setCtx] = useState<CtxState>(null);
  const [inline, setInline] = useState<InlineState>(null);

  const closeAllOverlays = () => {
    setEditor(null);
    setCtx(null);
    setInline(null);
  };

  const navWeek = (fn: () => Promise<void> | void) => () => {
    closeAllOverlays();
    setSelectedBlock(null);
    void fn();
  };

  const editorBlock =
    editor?.mode === "edit"
      ? (blocks.find((b) => b.id === editor.id) ?? null)
      : null;
  const ctxBlock = ctx ? (blocks.find((b) => b.id === ctx.blockId) ?? null) : null;

  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const isInputTarget =
        t instanceof HTMLInputElement ||
        t instanceof HTMLTextAreaElement ||
        (t && t.isContentEditable);

      if (isInputTarget) {
        if (e.key === "Escape") (t as HTMLElement).blur();
        return;
      }

      if (e.key === "Escape") {
        closeAllOverlays();
        setSelectedBlock(null);
        return;
      }

      if (editor || ctx || inline) {
        return;
      }

      const noModifier = !e.metaKey && !e.ctrlKey && !e.altKey;

      if (noModifier && (e.key === "n" || e.key === "N")) {
        e.preventDefault();
        setEditor({
          mode: "new",
          prefill: buildNewDefaults(weekDates, weekStart, todayIdx),
        });
        return;
      }
      if (noModifier && (e.key === "t" || e.key === "T")) {
        // фаза 3 — пул задач
        return;
      }

      const sel = blocks.find((b) => b.id === selectedId);
      if (!sel) return;

      const runStatus = async (status: "done" | "skipped", label: string) => {
        try {
          await useScheduleStore.getState().setBlockStatus(sel.id, status);
          toast.success(label);
        } catch (err) {
          toast.error(`Не удалось сохранить: ${(err as Error).message}`);
        }
      };

      if (noModifier && (e.key === "d" || e.key === "D")) {
        void runStatus("done", "Done ✓");
      } else if (noModifier && (e.key === "s" || e.key === "S")) {
        void runStatus("skipped", "Skipped");
      } else if (
        noModifier &&
        (e.key === "Delete" || e.key === "Backspace")
      ) {
        void (async () => {
          try {
            await useScheduleStore.getState().deleteBlock(sel.id);
            setSelectedBlock(null);
            toast.success(`✕ Удалён: ${sel.title}`);
          } catch (err) {
            toast.error(`Не удалось удалить: ${(err as Error).message}`);
          }
        })();
      } else if (noModifier && e.key === "Enter") {
        e.preventDefault();
        setEditor({ mode: "edit", id: sel.id });
      } else if (
        e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        (e.key === "ArrowUp" || e.key === "ArrowDown")
      ) {
        e.preventDefault();
        const delta = e.key === "ArrowUp" ? -30 : 30;
        const cur = timeToMinutes(sel.start);
        const { start: next } = clampBlockToGrid(cur + delta, sel.duration);
        if (next !== cur) {
          void (async () => {
            try {
              await useScheduleStore
                .getState()
                .updateBlock(sel.id, { start: minutesToTime(next) });
              toast.success(minutesToTime(next));
            } catch (err) {
              toast.error(`Не удалось сохранить: ${(err as Error).message}`);
            }
          })();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    active,
    selectedId,
    blocks,
    weekDates,
    weekStart,
    todayIdx,
    editor,
    ctx,
    inline,
    setSelectedBlock,
  ]);

  useEffect(() => {
    if (!active) return;
    const onDocMouseDown = (e: globalThis.MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (
        target.closest(".tb") ||
        target.closest(".ctx") ||
        target.closest(".modal-bg") ||
        target.closest(".inline-block")
      ) {
        return;
      }
      const ui = useUIStore.getState();
      if (ui.selectedBlockId !== null) {
        setSelectedBlock(null);
      }
      // Click on .gr opens a new inline-create itself; don't kill it here.
      if (!target.closest(".gr")) {
        setInline((cur) => (cur ? null : cur));
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [active, setSelectedBlock]);

  const onInlineSubmit = async (
    date: string,
    minute: number,
    title: string,
  ) => {
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
      setSelectedBlock(created.id);
      setInline(null);
      toast.success(`✓ Создан: ${title}`);
    } catch (err) {
      toast.error(`Не удалось создать: ${(err as Error).message}`);
    }
  };

  return (
    <div className={`page${active ? " active" : ""}`}>
      <div className="hdr">
        <button
          type="button"
          className="nav-btn"
          onClick={navWeek(goToPrev)}
          aria-label="Предыдущая неделя"
        >
          <ChevronLeft />
        </button>
        <span className="hdr-week">
          Неделя {getWeekNumber(week)}
          <span className="hdr-week-sub">{formatWeekRange(week)}</span>
        </span>
        <button
          type="button"
          className="nav-btn"
          onClick={navWeek(goToNext)}
          aria-label="Следующая неделя"
        >
          <ChevronRight />
        </button>
        <button
          type="button"
          className="hdr-today"
          onClick={navWeek(goToCurrent)}
        >
          Сегодня
        </button>
        <div className="hdr-spacer" />
        <button
          type="button"
          className="hdr-btn hdr-btn-ghost"
          onClick={() => {
            /* фаза 3: пул задач */
          }}
        >
          Пул<span className="hkbd">T</span>
        </button>
      </div>
      <WeekSummary balance={weekBal} freeMinutes={freeWk} />
      <WeekGrid
        weekKey={week}
        weekDates={weekDates}
        blocks={blocks}
        dayBalances={dayBalances}
        overlapping={overlapping}
        selectedId={selectedId}
        todayIdx={todayIdx}
        nowMinutes={nowMinutes}
        inline={inline}
        onEmptyClick={(date, minute) => setInline({ date, minute })}
        onBlockClick={(id) => setSelectedBlock(id)}
        onBlockDblClick={(id) => setEditor({ mode: "edit", id })}
        onBlockContext={(e: MouseEvent, id) => {
          setSelectedBlock(id);
          setCtx({ x: e.clientX, y: e.clientY, blockId: id });
        }}
        onInlineCancel={() => setInline(null)}
        onInlineSubmit={onInlineSubmit}
      />
      {editor && (
        <BlockEditor
          key={editor.mode === "edit" ? `edit:${editor.id}` : "new"}
          mode={editor.mode}
          block={editorBlock}
          prefill={editor.mode === "new" ? editor.prefill : {}}
          weekStart={weekStart}
          areas={areas}
          onClose={() => setEditor(null)}
        />
      )}
      {ctx && ctxBlock && (
        <BlockContextMenu
          x={ctx.x}
          y={ctx.y}
          block={ctxBlock}
          areas={areas}
          onEdit={() => {
            setEditor({ mode: "edit", id: ctx.blockId });
            setCtx(null);
          }}
          onClose={() => setCtx(null)}
        />
      )}
    </div>
  );
}
