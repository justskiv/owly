import { useEffect, useState } from "react";
import { getDataDir } from "../../services/file-io";
import { toast } from "../shared/Toast";

export function DataTab() {
  const [dir, setDir] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getDataDir().then((d) => {
      if (!cancelled) setDir(d);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const copy = async () => {
    if (!dir) return;
    try {
      await navigator.clipboard.writeText(dir);
      toast.success("Путь скопирован");
    } catch {
      toast.error("Не удалось скопировать");
    }
  };

  return (
    <div className="settings-inner">
      <div className="settings-hint">
        Все данные хранятся в этой папке как JSON-файлы. Резервное
        копирование — обычное копирование папки.
      </div>
      <div className="fg">
        <label className="fl">Папка данных</label>
        <div className="data-path">
          <code>{dir ?? "—"}</code>
        </div>
      </div>
      <button
        type="button"
        className="btn-save"
        onClick={copy}
        disabled={!dir}
      >
        Копировать путь
      </button>
    </div>
  );
}
