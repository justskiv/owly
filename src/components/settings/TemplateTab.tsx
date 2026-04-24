import { useEffect, useState } from "react";
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

export function TemplateTab() {
  const areas = useConfigStore((s) => s.config?.areas) ?? [];
  const [file, setFile] = useState<TemplateFile | null>(null);
  const [loading, setLoading] = useState(true);

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
          toast.error(`Не удалось загрузить шаблон: ${(e as Error).message}`);
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = async (next: TemplateFile) => {
    setFile(next);
    try {
      const path = await getDataPath("templates", "default.json");
      await writeJsonFile(path, next);
    } catch (e) {
      toast.error(`Не удалось сохранить: ${(e as Error).message}`);
    }
  };

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
    void persist({ ...file, blocks });
  };

  const removeBlock = (i: number) => {
    void persist({
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
    void persist({ ...file, blocks: [...file.blocks, nb] });
  };

  return (
    <div className="settings-inner">
      <div className="settings-hint">
        Шаблонные блоки копируются при создании новой недели. Применяются
        только если пользователь выбрал «Создать из шаблона».
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
