import { useEffect, useRef, useState } from "react";
import type { DayOfWeek, TemplateBlock, TemplateFile } from "../../schemas";
import { TemplateFileSchema } from "../../schemas";
import { useConfigStore } from "../../store/config";
import {
  getDataPath,
  readJsonFileOrCreate,
  writeJsonFile,
} from "../../services/file-io";
import { EMPTY_TEMPLATE_FILE } from "../../services/defaults";
import { toast } from "../shared/Toast";
import { errMsg } from "../../services/format";

const DAYS: DayOfWeek[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAYS_RU: Record<DayOfWeek, string> = {
  mon: "Пн",
  tue: "Вт",
  wed: "Ср",
  thu: "Чт",
  fri: "Пт",
  sat: "Сб",
  sun: "Вс",
};

const PERSIST_DELAY_MS = 400;

export function TemplateTab() {
  const areas = useConfigStore((s) => s.config?.areas) ?? [];
  const [file, setFile] = useState<TemplateFile | null>(null);
  const [loading, setLoading] = useState(true);

  // Debounce handle + latest-state ref. Writing on every keystroke
  // used to push invalid intermediates (`start: "1"`) straight to
  // disk, which failed schema validation on next load and let the
  // corrupt-recovery path nuke the template. Now edits stay in-memory
  // until they pass TemplateFileSchema AND a short idle window.
  const pendingRef = useRef<TemplateFile | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const path = await getDataPath("templates", "default.json");
        const data = await readJsonFileOrCreate(
          path,
          TemplateFileSchema,
          EMPTY_TEMPLATE_FILE,
        );
        if (!cancelled) {
          setFile(data);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          toast.error(`Не удалось загрузить шаблон: ${errMsg(e)}`);
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Flush any pending draft on unmount so a user's last edit isn't
  // lost when they close Settings before the debounce fires.
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        const pending = pendingRef.current;
        if (pending) {
          void flushWrite(pending);
        }
      }
    };
  }, []);

  async function flushWrite(draft: TemplateFile) {
    const parsed = TemplateFileSchema.safeParse(draft);
    if (!parsed.success) {
      // Invalid drafts stay in-memory — the user will see the bad
      // field highlighted (or rather, feel that nothing saved) and
      // can fix it. Surfacing every keystroke toast would be noisy,
      // so we only log.
      console.warn(
        "[template] skipped invalid save:",
        parsed.error.issues,
      );
      return;
    }
    try {
      const path = await getDataPath("templates", "default.json");
      await writeJsonFile(path, parsed.data);
      pendingRef.current = null;
    } catch (e) {
      toast.error(`Не удалось сохранить: ${errMsg(e)}`);
    }
  }

  function scheduleWrite(next: TemplateFile) {
    setFile(next);
    pendingRef.current = next;
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      void flushWrite(next);
    }, PERSIST_DELAY_MS);
  }

  if (loading || !file) {
    return (
      <div className="settings-inner">
        <div style={{ color: "var(--text-tertiary)" }}>Загрузка…</div>
      </div>
    );
  }

  const updateBlock = (i: number, patch: Partial<TemplateBlock>) => {
    const blocks = file.blocks.map((b, idx) =>
      idx === i ? { ...b, ...patch } : b,
    );
    scheduleWrite({ ...file, blocks });
  };

  const removeBlock = (i: number) => {
    scheduleWrite({
      ...file,
      blocks: file.blocks.filter((_, idx) => idx !== i),
    });
  };

  const addBlock = () => {
    const defaultCategory = areas[0]?.id ?? "work";
    const nb: TemplateBlock = {
      day: "mon",
      start: "09:00",
      duration: 30,
      title: "Новый блок",
      category: defaultCategory,
    };
    scheduleWrite({ ...file, blocks: [...file.blocks, nb] });
  };

  return (
    <div className="settings-inner">
      <div className="settings-hint">
        Шаблонные блоки копируются при создании новой недели. Применяются
        только если пользователь выбрал «Создать из шаблона». Сохраняется
        автоматически; некорректные значения (например, неполное время)
        не уходят на диск — закончите ввод, чтобы закрепить изменения.
      </div>
      <div className="template-list">
        <div className="tpl-header">
          <span>День</span>
          <span>Время</span>
          <span>Длит.</span>
          <span>Название</span>
          <span>Область</span>
          <span />
        </div>
        {file.blocks.map((b, i) => (
          <div key={i} className="tpl-row">
            <select
              className="fi"
              value={b.day}
              onChange={(e) =>
                updateBlock(i, { day: e.target.value as DayOfWeek })
              }
            >
              {DAYS.map((d) => (
                <option key={d} value={d}>
                  {DAYS_RU[d]}
                </option>
              ))}
            </select>
            <input
              className="fi"
              style={{ fontFamily: "var(--mono)", width: 80 }}
              value={b.start}
              onChange={(e) => updateBlock(i, { start: e.target.value })}
            />
            <input
              type="number"
              className="fi"
              style={{ fontFamily: "var(--mono)", width: 70 }}
              value={b.duration}
              onChange={(e) =>
                updateBlock(i, {
                  duration: Math.max(15, Number(e.target.value) || 30),
                })
              }
            />
            <input
              className="fi"
              value={b.title}
              onChange={(e) => updateBlock(i, { title: e.target.value })}
            />
            <select
              className="fi"
              style={{ width: 120 }}
              value={b.category}
              onChange={(e) => updateBlock(i, { category: e.target.value })}
            >
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="editor-x"
              aria-label="Удалить"
              onClick={() => removeBlock(i)}
            >
              ×
            </button>
          </div>
        ))}
        <button type="button" className="editor-add" onClick={addBlock}>
          + Добавить блок
        </button>
      </div>
    </div>
  );
}
