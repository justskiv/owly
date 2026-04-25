# Гайд автора дашбордов

> **Кому это:** AI-агенту или человеку, который пишет/правит `.jsx` в
> `data/dashboards/`. Цель — чтобы дашборды визуально и поведенчески
> были неотличимы от остального приложения.
>
> **Сначала прочитай:** `07-phase-5-dashboards.md` (модель загрузки).

## TL;DR (чеклист самопроверки)

- [ ] `export default function Name(props)` — есть.
- [ ] Props взяты как `{ entities, schedule, config, allWeeks, widgets }`.
- [ ] Ни одного `import` в файле.
- [ ] Все цвета — `var(--*)`, ни одного `#hex`.
- [ ] Числа отрисованы шрифтом `var(--mono)`.
- [ ] Размеры — из шкалы `var(--fs-*)` и `var(--radius-*)`, не
      произвольные числа.
- [ ] Padding/gap — кратные 4 (4, 8, 12, 16, 24, 32).
- [ ] Есть empty state для случая «данных нет».
- [ ] Тяжёлые `.filter`/`.reduce` обёрнуты в `useMemo`.
- [ ] Файл укладывается в ≤500 строк (мягкий лимит).
- [ ] UI-строки (видимый текст) — на русском.
- [ ] Комментарии в коде — на английском.

---

## 1. Как дашборд оживает

1. Файл `data/dashboards/<id>.jsx` читается как текст.
2. JSX транспилируется через `sucrase` (`transforms: ['jsx']`) в JS.
3. JS оборачивается в `new Function('module','exports','React',
   'useState','useEffect','useMemo', code)` и выполняется.
4. `module.exports.default` рендерится как React-компонент с props.

Файлы без записи в `_registry.json` **не показываются**. Реестр —
источник правды для порядка и видимости.

## 2. Скелет

```jsx
// Что показывает дашборд (1-2 фразы — для людей, читающих файл).

export default function MyDashboard({ entities, schedule, config, widgets }) {
  const { Section, Card, EmptyState } = widgets;

  if (!entities || entities.length === 0) {
    return <EmptyState title="Нет данных" hint="Создайте сущности" />;
  }

  return (
    <Section title="Заголовок">
      ...
    </Section>
  );
}
```

## 3. Глобалы и props

**Доступно через `new Function` (локальные переменные функции):**

| Имя         | Тип          | Что это                       |
|-------------|--------------|-------------------------------|
| `React`     | namespace    | Можно `React.createElement`   |
| `useState`  | hook         | `const [v, set] = useState(0)` |
| `useEffect` | hook         | Эффекты                       |
| `useMemo`   | hook         | Мемоизация                    |

**Доступно через props:**

| Поле       | Тип                          | Заметки                                            |
|------------|------------------------------|----------------------------------------------------|
| `entities` | `Entity[]`                   | Все сущности (см. `01-data-schema.md`)             |
| `schedule` | `WeekFile \| null`           | Текущая неделя; **может быть `null`**              |
| `config`   | `Config`                     | Полный конфиг (`areas`, `pipeline_stages`, …)      |
| `allWeeks` | `WeekFile[]`                 | Прошлые недели — **на MVP всегда `[]`**, не строй на нём фичи |
| `widgets`  | `DashboardWidgets`           | Стабильное API виджетов (см. ниже)                 |

**Запрещено:**

- `import` — превратится в `require` и упадёт при выполнении. Если
  нужен `useState`, бери из контекста.
- Внешние библиотеки.
- `fetch`, `XMLHttpRequest`, `WebSocket`.
- Прямой доступ к Zustand-стору, `localStorage`, `window.app`.
- Мутации `entities` / `schedule` / `config` (передаются by-reference,
  но это read-only данные).
- `dangerouslySetInnerHTML` (XSS-риск даже в single-user).

> **Trust model.** Дашборды выполняются в основном app-контексте,
> без sandbox: технически у них есть доступ к `window`, `document`,
> Tauri IPC. Это сознательный выбор для single-user app. **Не
> вставляй чужой непроверенный JSX** — он может прочитать или
> переписать любые данные приложения.

## 4. Design system: цвета

Все цвета — CSS-переменные. Hex-литералы вне виджетов запрещены.

**Поверхности:**

```
--bg-deep       #131313  — самый тёмный
--bg-base       #1a1a1a  — фон страницы
--bg-surface    #222     — sidebar, панели
--bg-elevated   #2b2b2b  — модалки
--bg-hover      #353535
--bg-active     #3f3f3f
--bg-tint-1     rgba(255,255,255,.03)  — карточки, лёгкий overlay
--bg-tint-2     rgba(255,255,255,.05)  — чуть сильнее
```

**Текст:**

```
--text-primary    #f2f2f2  — основные h1/h2 и значения
--text-secondary  #b0b0b0  — описания
--text-tertiary   #808080  — лейблы, метаданные
--text-disabled   #585858  — неактивное
--text-inverse    #131313  — текст на акценте
```

**Акцент и семантика:**

```
--accent   #e0b860  — охра, главный цвет приложения
--success  #30d888  — зелёный (рост, сделано)
--error    #e06878  — красный (опасность, падение)
```

Не путать с категориями:

```
--work    #ff7a3d  --people  #ff5ca8  --life  #b8d84a
--growth  #9b6cff  --health  #30d888
```

Категории нужны только когда визуализируется конкретная
категория данных (например, цвет блока). Не для общей раскраски.

**Границы:** `--border`, `--border-default`, `--border-strong`.

**Радиусы:** `--radius-sm` (4) → `--radius-xl` (12) → `--radius-pill`.

## 5. Типографика

```
--font  : Outfit (proportional sans)
--mono  : JetBrains Mono
```

- **Заголовки** (h1/h2/h3) — Outfit, `font-weight: 500`. Не 700+.
- **Основной текст** — Outfit, 400.
- **Числа в виджетах** — всегда `style={{ fontFamily: 'var(--mono)' }}`.
  Иначе цифры пляшут (Outfit пропорциональный — единица тоньше восьмёрки).
- **Лейблы** — `var(--fs-xs)` + `text-transform: uppercase` +
  `letter-spacing: .05em`.
- Не использовать `text-transform: uppercase` для основного текста.

**Шкала кеглей:**

```
--fs-2xs  10  --fs-xs   11  --fs-sm   12  --fs-md   14
--fs-lg   16  --fs-xl   20  --fs-2xl  28
```

Произвольных кеглей не использовать.

## 6. Размеры и отступы

- Padding/margin/gap — кратные 4 (4, 8, 12, 16, 24, 32, 48).
- Border-radius — только из шкалы `--radius-*`. `border-radius: 50%`
  — только для аватаров/dot-маркеров.
- Тени — `var(--shadow-sm/md/lg)`.

## 7. Виджеты (стабильное API)

Все виджеты приходят через `props.widgets`. Их сигнатуры
заморожены — props не меняются без major-релиза.

### `Card({ children, padding=16, elevated=false, style })`
Базовая карточка-контейнер с фоном `--bg-tint-1` и границей.
`elevated=true` — чуть ярче (`--bg-tint-2`).

### `Section({ title, action, children })`
Секция с заголовком и опциональным действием справа. Снизу
24px отступ. `action` — React-нода (обычно кнопка):

```jsx
<Section title="Метрики" action={<Pill variant="muted">обновлено вчера</Pill>}>
  ...
</Section>
```

### `KpiCard({ label, value, unit, delta, deltaLabel, accent, inverted })`
Карточка с большим числом. `delta` — `+/-` число, цвет
автоматически (зелёный/красный). `accent` — цвет числа
(например, `var(--accent)`). `inverted: true` — для метрик где
«меньше = лучше» (вес, баги): отрицательная дельта будет зелёной.

### `Stat({ label, value, hint, color })`
Компактный label/value (моноширинное число), с опциональной
подсказкой.

### `StatRow({ children, gap=24 })`
Горизонтальный ряд статистик с border-left разделителями.
Children — обычно `<Stat>`.

### `ProgressBar({ value, max=100, color, height=6 })`
Линейный progress. Pill-радиус.

### `Pill({ children, variant })`
Pill/badge. `variant`: `default | accent | success | error | muted`.

### `Sparkline({ data, color, width=160, height=40, showDots=false })`
SVG line chart. `data` — `number[]`. При <2 точках рендерит
плейсхолдер «нет данных» — но лучше заранее показать `EmptyState`.

### `BarChart({ bars, color, height=120 })`
Vertical bar chart. `bars` — `{ label, value }[]`. Bars
масштабируются с 10% запасом ниже минимума, чтобы видеть разницу.
Если все значения равны (включая все-нули) — рисуются плоские
тонкие бары, чтобы не врать «100% во всём».

### `EmptyState({ title, hint, icon })`
Empty state. Использовать всегда, когда «данных нет».

### `Icon({ name, size=18, strokeWidth=1.5 })`
Lucide-иконка по имени (`bar-chart`, `target`, `trending-up`,
`calendar`, `users`, `pie-chart`, `line-chart`, `heart`, `zap`,
`settings`, `database`). Неизвестное имя → `bar-chart` fallback.

## 8. Empty states (обязательно)

Каждое из следующих условий должно быть обработано:

```jsx
if (!schedule || !schedule.blocks || schedule.blocks.length === 0) {
  return <EmptyState title="..." hint="..." />;
}

if (entities.length === 0) {
  return <EmptyState title="..." hint="..." />;
}

const filtered = entities.filter(...);
if (filtered.length === 0) {
  return <EmptyState title="..." hint="..." />;
}
```

Без них AI-агент часто пишет `entities[0].title` и получает
TypeError при пустых данных.

## 9. Performance

- Всё, что читает `entities` или `allWeeks` — внутри `useMemo`:

  ```jsx
  const projects = useMemo(
    () => entities.filter((e) => e.type === "project"),
    [entities],
  );
  ```

- Не складывать большие массивы в `useState` — пересчитывать
  через `useMemo`.
- Лимит ~500 строк на файл. Если больше — два дашборда.

## 10. Anti-patterns

- ❌ `style={{ background: '#0d0d0d' }}` — hex запрещён.
- ❌ `style={{ fontFamily: 'JetBrains Mono' }}` для всего —
  только для чисел.
- ❌ `import { useState } from 'react'` — `import` будет переписан в
  `require` и упадёт в рантайме. Бери `useState` из контекста.
- ❌ `function Dash({ entities })` без `widgets` — обращение к
  `widgets.Card` даст `widgets is not defined`. Всегда деструктурируй
  `widgets` (или весь `props`).
- ❌ `widgets.NotExistingThing` — runtime TypeError.
- ❌ Мутация `entities.push(...)` или `schedule.blocks[0].title = '...'`.
- ❌ `onClick={() => counter++}` где counter — внешняя переменная.
  Нужен `useState`.

## 10a. Tip: цвет по категории

Если дашборд про конкретную area (Здоровье / Работа / Развитие) —
бери цвет из `config.areas`, а не `var(--accent)`:

```jsx
const area = config.areas.find((a) => a.id === "health");
const color = area?.color ?? "var(--accent)";
<BarChart bars={...} color={color} />
```

Так дашборд визуально соответствует тому, к какой области он
относится — те же цвета, что и блоки этой категории в Планировщике.

## 11. Регистрация

После создания файла добавить запись в `_registry.json`:

```json
{
  "id": "my-dashboard",
  "title": "Мой дашборд",
  "file": "my-dashboard.jsx",
  "icon": "📊",
  "order": 7,
  "description": "Кратко: что показывает"
}
```

Правила:

- `id` — уникален в реестре, lowercase + dash.
- `file` — `<id>.jsx`, должен существовать на диске.
- `icon` — эмодзи или имя Lucide (`bar-chart`, `target`,
  `trending-up`, `users`, …).
- `order` — `max(existing) + 1`.

## 12. Debugging

- **Compile-time error** (синтаксис, отсутствует default export) —
  экран `Не удалось загрузить дашборд` с stacktrace. Имя файла в
  стеке — `tuzov-dashboard:///<file.jsx>` (благодаря `sourceURL`).
  Номера строк могут быть смещены на 1-2 из-за prelude от sucrase.
- **Runtime error** (sync exception в render) — ErrorBoundary с
  кнопкой «Попробовать снова», которая бампает reload-token и
  рекомпилирует с актуальными props.
- **Async error** (Promise rejection в `useEffect` или `setTimeout`) —
  ловится `unhandledrejection` listener и показывается в том же
  панели ошибок.
- `console.log()` — работает, видно в DevTools (Cmd+Opt+I).
- Кнопка `↻ Обновить` в шапке — перечитывает `.jsx` с диска и
  recompile. Использовать после каждой правки.

## 13. Полный пример (KPI)

```jsx
// KPI: shows top 3 metrics with trends.

export default function TopKpis({ entities, widgets }) {
  const { Card, Section, EmptyState, Sparkline } = widgets;

  const metrics = entities
    .filter((e) => e.type === "metric")
    .slice(0, 3);

  if (metrics.length === 0) {
    return <EmptyState title="Нет метрик" hint="Создайте Metric-сущности" />;
  }

  return (
    <Section title="Главные метрики">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {metrics.map((m) => {
          const series = (m.fields.history || []).map((h) => h.value);
          const last = series[series.length - 1] ?? m.fields.current_value;
          return (
            <Card key={m.id}>
              <div style={{
                fontSize: "var(--fs-xs)",
                color: "var(--text-tertiary)",
                textTransform: "uppercase",
                letterSpacing: ".05em",
                marginBottom: 8,
              }}>
                {m.title}
              </div>
              <div style={{
                fontFamily: "var(--mono)",
                fontSize: "var(--fs-2xl)",
                color: "var(--accent)",
                marginBottom: 6,
              }}>
                {last}
              </div>
              {series.length >= 2 && (
                <Sparkline data={series} color="var(--accent)" />
              )}
            </Card>
          );
        })}
      </div>
    </Section>
  );
}
```

## 14. Когда что-то не так

- Дашборд не отображается в списке → проверь запись в
  `_registry.json` (валидный JSON, `file` совпадает с реальным
  именем).
- Compile-error «Default export must be a function» → должен быть
  именно `export default function ...`, не `export const ... = ...`
  и не named-export.
- Runtime «`undefined is not a function`» → опечатка в имени
  виджета: проверь по списку из части 7.
- Дашборд выглядит «не как остальной интерфейс» → шансы 99%, что
  ты захардкодил цвет или шрифт. Прогони чеклист.
