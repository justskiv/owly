# Phase 8 — Экран «Ревью»

> **Цель:** реализовать экран Review по §9 спеки: 3 периода
> (Неделя / Месяц / Год), gauges (SVG ring `transform: rotate(-90deg)`),
> charts (horizontal bars + stacked + trend), карточки разных
> размеров (default / span2 / full). Все вычисления — из реальных
> данных (схедула + entities + pool), без mock-чисел.
>
> **Результат после фазы:** на табе «Ревью» видны метрики
> текущей недели (Выполнение блоков, Пул, Каденции, Время по
> категориям, Направления). Переключение на месяц / год
> показывает агрегаты. Все цифры считаются из реальных файлов.

## Контекст

Прочитай:

- `spec.md` §9 целиком (Layout, Period Tabs, Gauge, Week, Month,
  Year, Card Layout Classes).
- `pool-planner-demo-v2.html`: `renderReviewWeek`,
  `renderReviewMonth`, `renderReviewYear`, gauge SVG. **Внимание:**
  в моке month/year используют hardcoded mock-данные. Мы
  вычисляем из реальных данных или показываем «недостаточно
  данных».
- Phases 1, 2, 6 (нужны schedule, pool, entities).

## Что в фазе

### 1. ReviewPage

`src/pages/ReviewPage.tsx` — заменяет заглушку.

#### 1.1. Layout (§9.1)

```
ReviewPage (.review-view, flex column, overflow-y auto, align-items center)
├── Inner (max-width 900, padding 16/24, width 100%)
│   ├── Header (h1 Ревью + week label)
│   ├── PeriodTabs
│   └── Cards (display grid, grid-template-columns repeat(3, 1fr), gap 10)
```

### 2. PeriodTabs (§9.2)

```tsx
<div className="rv-tabs">
  {(["week","month","year"] as const).map(p => (
    <button
      key={p}
      className={"rv-tab" + (rvPeriod === p ? " active" : "")}
      onClick={() => setRvPeriod(p)}
    >
      {labels[p]}
    </button>
  ))}
</div>
```

State в `ui.ts`:

```ts
rvPeriod: "week" | "month" | "year";
setRvPeriod: (p: typeof rvPeriod) => void;
```

CSS отличие от nav-tab: `padding: 6px 14px`, default color
`text-disabled`.

### 3. Gauge component (§9.3)

`src/components/review/Gauge.tsx`:

```tsx
interface GaugeProps {
  value: number | string;     // строка для текстовых; число для ring
  max?: number;               // для ring
  color?: string;             // для ring
  title: string;
  subtitle?: string;
  ring?: boolean;             // false = текстовый gauge без кольца
  fontSize?: number;          // override (для year text gauges)
}
```

Render:

```tsx
<div className="rv-gauge">
  <div className="rv-gauge-ring">
    <svg viewBox="0 0 48 48" style={{ transform: "rotate(-90deg)" }}>
      {ring && (
        <>
          <circle cx={24} cy={24} r={19} fill="none"
                  stroke="var(--bg-tint-1)" strokeWidth={5} />
          <circle cx={24} cy={24} r={19} fill="none"
                  stroke={color} strokeWidth={5} strokeLinecap="round"
                  strokeDasharray={119.38}
                  strokeDashoffset={119.38 * (1 - value/100)} />
        </>
      )}
    </svg>
    <span className="rv-gauge-value" style={{ fontSize }}>
      {ring ? `${value}%` : value}
    </span>
  </div>
  <div className="rv-gauge-label">
    <div className="rv-gauge-title">{title}</div>
    {subtitle && <div className="rv-gauge-sub">{subtitle}</div>}
  </div>
</div>
```

Цветовые пороги (для ring):
- ≥ thresh.green → `--success`
- ≥ thresh.yellow → `--warning`
- < → `--error`

`thresh` зависит от метрики (см. §9.4).

### 4. Card layout classes (§9.7)

CSS:
- `.rv-card` — стандартная.
- `.rv-card.span2` — `grid-column: span 2`.
- `.rv-card.full` — `grid-column: 1 / -1`.

Разделители, паддинг, фон — semantic, как в моке.

### 5. Review week (§9.4)

#### 5.1. Card 1: 3 Gauges (full)

```tsx
<div className="rv-card full">
  <div className="rv-gauge-row">
    <Gauge {...execMetric} />
    <Gauge {...poolMetric} />
    <Gauge {...cadenceMetric} />
  </div>
</div>
```

Расчёты:

```ts
// Выполнение
const totalBlocks = blocks.length;
const doneBlocks = blocks.filter(b => b.status === "done").length;
const exec = totalBlocks ? Math.round(doneBlocks/totalBlocks * 100) : 0;
// thresh: green ≥70, yellow ≥40, red <40

// Пул недели
const totalPool = poolItems.length;
const donePool = poolItems.filter(pi => pi.splittable
  ? (pi.scheduled ?? 0) >= pi.hours
  : pi.placed
).length;
const poolPct = totalPool ? Math.round(donePool/totalPool * 100) : 0;
// thresh: green ≥70, yellow ≥40, red <40

// Каденции (по directions с cadence)
const cadDirs = directions.filter(d => d.fields.cadence != null);
const cadOk = cadDirs.filter(d => {
  const days = daysSince(d.fields.last_act);
  return days <= d.fields.cadence;
}).length;
const cadPct = cadDirs.length ? Math.round(cadOk/cadDirs.length * 100) : 0;
// thresh: green ≥80 (НЕ 70!), yellow ≥50, red <50
```

#### 5.2. Card 2: Pool недели (default)

```tsx
<div className="rv-card">
  <h4>Пул недели</h4>
  {poolItems.map(pi => (
    <div className="rv-stat" key={pi.id}>
      <span>{pi.title}</span>
      <span className={statusColor(pi)}>
        {pi.splittable
          ? `${(pi.scheduled ?? 0).toFixed(1)}/${pi.hours}ч`
          : (pi.placed ? "✓" : "—")
        }
      </span>
    </div>
  ))}
</div>
```

`statusColor`:
- splittable: ≥100% → green; ≥50% → yellow; иначе → tertiary.
- atomic placed → green; иначе → tertiary.

#### 5.3. Card 3: Каденции (default)

```tsx
<div className="rv-card">
  <h4>Каденции</h4>
  {cadDirs.map(d => {
    const days = daysSince(d.fields.last_act);
    const over = days - d.fields.cadence;
    return (
      <div className="rv-stat" key={d.id}>
        <span><span className="dot" style={{background: catColor}} /> {d.title}</span>
        <span className={cadUrgClass(d, today)}>
          {days}д/{d.fields.cadence}д {over <= 0 ? "✓" : "⚠"}
        </span>
      </div>
    );
  })}
</div>
```

#### 5.4. Card 4: Время по категориям (default)

Horizontal bars + per-day stacked chart.

```tsx
<div className="rv-card">
  <h4>Время по категориям</h4>
  {areas.map(a => {
    const hrs = blocks
      .filter(b => b.category === a.id)
      .reduce((s, b) => s + b.duration, 0) / 60;
    const max = Math.max(...allHrs, 1);
    return (
      <div className="rv-cat-bar" key={a.id}>
        <span style={{ width: 65 }}>{a.label}</span>
        <div className="rv-bar-wrap" style={{ flex: 1 }}>
          <div className="rv-bar"
               style={{ width: (hrs/max*100)+"%", background: a.color }} />
        </div>
        <span style={{ width: 36, textAlign: "right" }}>{hrs.toFixed(1)}ч</span>
      </div>
    );
  })}

  <h5>По дням</h5>
  <div className="rv-chart" style={{ height: 100 }}>
    {weekDays.map((d, i) => {
      const dayBlocks = blocks.filter(b => b.date === d);
      const totalHrs = dayBlocks.reduce((s, b) => s + b.duration, 0) / 60;
      return (
        <div className="rv-chart-col" key={i}>
          <div className="rv-chart-bar" style={{ height: (totalHrs/16*100)+"%" }}>
            {areas.map(a => {
              const aHrs = dayBlocks
                .filter(b => b.category === a.id)
                .reduce((s, b) => s + b.duration, 0) / 60;
              return aHrs ? (
                <div
                  key={a.id}
                  className="rv-chart-seg"
                  style={{
                    height: (aHrs/totalHrs*100)+"%",
                    background: a.color,
                  }}
                />
              ) : null;
            })}
          </div>
          <div className="rv-chart-label">{["Пн","Вт","Ср","Чт","Пт","Сб","Вс"][i]}</div>
        </div>
      );
    })}
  </div>
</div>
```

#### 5.5. Card 5: Направления (full)

```tsx
<div className="rv-card full">
  <h4>Направления</h4>
  <div className="rv-grid-2">
    <div>
      <h5>Прогресс измеримых</h5>
      {measurableDirs.map(d => (
        <div className="rv-cat-bar" key={d.id}>
          <span>{d.title}</span>
          <div className="rv-bar-wrap">
            <div className="rv-bar" style={{ width: d.fields.progress+"%" }} />
          </div>
          <span>{d.fields.current} → {d.fields.target}</span>
        </div>
      ))}
    </div>
    <div>
      <h5>Заброшенные проекты (>14д)</h5>
      {staleProjects.map(p => (
        <div className="rv-stat" key={p.id} style={{ color: "var(--error)" }}>
          <span>{p.title}</span>
          <span>{p.fields.last_activity_days}д</span>
        </div>
      ))}
    </div>
  </div>
</div>
```

### 6. Review month (§9.5)

Агрегация за 4 недели (последние 4, включая текущую).

#### 6.1. Загрузка данных

```ts
// Last 4 weeks
const weekIds = Array.from({ length: 4 }, (_, i) =>
  shiftWeek(currentWeek, -i)
);

// Loading: уже могут быть в week-cache, иначе прочитать через
// readJsonFile (без impulsive store update — эфемерное чтение)
const weeks: WeekFile[] = await Promise.all(
  weekIds.map(loadWeekData)
);
```

#### 6.2. Cards

- **Card 1 (full):** среднее выполнение (ring), каденции
  (ring), общие часы (текстовый gauge `font-size: 12px`).
- **Card 2 (span2):** Weekly trend chart — 4 бара по неделям с
  % выполнения. `height: 120px`.
- **Card 3 (full):** 3 columns: Projects (завершено / начато /
  в работе) | Direction deltas (`{from} → {to}`) | Cadence
  summary (`{ok}✓ {miss}✗`).

```tsx
<div className="rv-card full" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr" }}>
  <div>...</div>
  <div>...</div>
  <div>...</div>
</div>
```

> Для пустых данных (4 недели подряд без блоков) — показываем
> «Недостаточно данных для отчёта».

#### 6.3. Расчёты

`projects-completed-this-month` — нужно знать, когда проект был
помечен как done. У нас в Entity нет explicit `completed_at`.
Решение: смотрим `updated_at` — если status === "done" и
updated_at в окне месяца → completed.

`projects-started` — `created_at` в окне.

`direction-deltas` — нужна история значений direction. Сейчас её
нет (только current). На фазе 8: показываем «—» для дельты, если
истории нет. (Опционально завести `direction_history` в фазе 9.)

### 7. Review year (§9.6)

Аналогично месяцу, но за 12 месяцев.

- **Card 1 (full):** 4 gauges: avg execution (ring), cadences
  (ring), hours (text 11px), projects done (text 14px accent).
- **Card 2 (span2):** monthly trend, height 130px, 12 баров.
- **Card 3:** Category yearly totals (single card).
- **Card 4 (full):** Directions yearly progress + achievements.

### 8. Сервис review-aggregations

`src/services/review-aggregations.ts`:

```ts
export async function loadWeekRange(weekIds: string[]): Promise<WeekFile[]>;
export async function loadCurrentMonthWeeks(): Promise<WeekFile[]>;
export async function loadCurrentYearWeeks(): Promise<WeekFile[]>;

export function execPctForBlocks(blocks: Block[]): number;
export function poolPctForItems(items: PoolItem[]): number;
export function cadencePctForDirections(dirs: DirectionEntity[], today: Date): number;
export function hoursByCategory(blocks: Block[]): Record<string, number>;
export function hoursByDay(blocks: Block[], weekDays: string[]): Record<string, number>;
```

Тесты на каждый метод.

### 9. Performance

Месяц/год — это IO (читать 4 / 52 недельных файла). Делать через
`Promise.all`. Кэшировать в weekCache (текущий уже есть). При
переключении периодов — re-load if not cached.

Если файла недели нет (юзер не вёл) — пустая запись, не падаем.

### 10. Тесты

- `review-aggregations.test.ts`: edge cases (0 блоков, 100%
  выполнение, отсутствие directions).
- `gauge.test.ts`: rendering правильного `strokeDashoffset`
  (snapshot test).

## Acceptance criteria

- [ ] Review tab → 3 период tab (Неделя / Месяц / Год).
- [ ] **Неделя:**
  - Card 1: 3 gauges с реальными % из текущей недели.
  - Card 2: Pool list с прогрессом.
  - Card 3: Cadences list (только direction с cadence).
  - Card 4: Time by category (horizontal bars + per-day stacked).
  - Card 5 (full): directions measurable + stale projects.
- [ ] **Месяц:** 3 cards, агрегация за 4 недели. Если нет
  данных — «Недостаточно данных».
- [ ] **Год:** 4 cards, агрегация за 12 месяцев.
- [ ] Gauges рисуются правильно (ring rotated -90deg, прогресс
  начинается сверху).
- [ ] Цвета порогов:
  - Exec: ≥70 green, ≥40 yellow, <40 red.
  - Pool: те же.
  - Cadence: **≥80 green** (не 70!), ≥50 yellow, <50 red.
- [ ] Текстовые gauges (без ring) для часов и счётчика проектов.
- [ ] Все вычисления — из реальных данных (schedule + entities +
  pool).
- [ ] Cmd+N на Review → Quick Add тип=task (по фазе 2).
- [ ] При смене недели week label в header обновляется.

## Тест-план

1. **Открыть Review.** Видишь Period tabs + 5 карточек для
   текущей недели.
2. **Проверить exec gauge.** В seed-неделе W18 несколько блоков
   уже done (Собаки Пн-Ср, Японский Пн, Тренировка Вт, Обед
   Пн-Вт). Считаем: total ~40, done ~7. Exec ~17% → красный.
3. **Pool gauge.** 5 pool items, 0 завершённых → 0% red.
4. **Cadence gauge.** 4 direction с cadence (yt, habr, tg, mama,
   sasha). Some are over → меньше зелёного. Math.
5. **Time by category.** Bars показывают распределение часов
   по work/health/life/growth/people.
6. **Per-day chart.** 7 колонок (Пн-Вс), стек цветов категорий.
7. **Сменить на «Месяц»**. Должен загрузить 4 недели. Если есть
   только 1 — показывает аглицки или null. График weekly trend
   с 4 столбцами.
8. **«Год»**. 12 месяцев trend. Большинство пустых → плоский.
9. **Создать новый блок done на Plan** → вернуться на Review →
   exec обновился.

## Что НЕ включает фаза 8

- Сохранение review-снимков в файл (e.g. `data/reviews/2026-w18.json`)
  — данные derive-первые, ничего не хранятся.
- Экспорт PDF / печать.
- Сравнение периодов (this week vs last week trend lines).
- Drill-down (click на категорию → список блоков). Опционально.
- Direction history (для real direction deltas в month/year).
  Откладываем в фазу 9 (заводим `direction_history` поле или
  отдельный файл).
- Achievements list (year card 4) — спека показывает примеры,
  но без алгоритма. Hardcode или skip — выберем «skip с TBD»
  плейсхолдером.

## Ловушки

- **`stroke-dasharray = 2πr ≈ 119.38`** — проверить, что r=19.
  Если r изменится, формула тоже.
- **`transform: rotate(-90deg)` на SVG**, не на parent. Без этого
  прогресс начнётся справа.
- **Cadence threshold 80** — отдельно от других gauges. См. §16
  чек-лист.
- **Empty data.** Юзер впервые открыл year — все месяцы пустые.
  Не падаем, рендерим «нет данных».
- **Week file format.** Старые v1 weeks могут не иметь pool
  ассоциации — recalc вручную при чтении.
- **Tabular numerics.** Все цифры (часы, дни, %) —
  `font-variant-numeric: tabular-nums` чтобы выравнивались.
- **Stale projects (>14д) на full-week card.** Список может
  расти со временем; ограничиваем 10 первыми. Спека этого не
  требует, но UX ради.
- **Performance for year.** 52 файла — это много IO. На SSD ОК,
  но желательно lazy-load при выборе таба «Год». Не делать
  full year при загрузке Review tab — только активный период.
- **Today's date.** Все вычисления используют `new Date()` —
  стабильный source. В тестах подменять через `vi.useFakeTimers`.
