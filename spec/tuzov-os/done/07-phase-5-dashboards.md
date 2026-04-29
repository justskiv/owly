# Фаза 5: Dashboards

> **Цель:** система динамического рендеринга дашбордов + стартовый набор витрин.
>
> **Результат:** страница Dashboards показывает список дашбордов, клик открывает дашборд. Дашборды — .jsx файлы, генерируемые AI-агентом или написанные руками. Приложение компилирует и рендерит их в runtime.
>
> **Предусловие:** Фазы 1-4 завершены.

## Контекст

Прочитай `01-data-schema.md` (раздел 5 — дашборды, реестр),
`02-architecture.md` (раздел «Дашборды: динамический рендеринг»).

**Референс:**
- `design/tuzov-os-design-spec.md`, раздел «Экран 3 — Дашборды»
- `design/tuzov-os-design-mock.html`, селекторы `.dash-grid`,
  `.dcard`, `.dcard-icon`, `.dcard-title`, `.dcard-desc` —
  референс разметки страницы дашбордов

## Установить

```bash
npm install sucrase
```

`sucrase` — минимальный JSX-транспилер для runtime-компиляции.

---

## Рендерер дашбордов

### DashboardHost.tsx

Ключевой компонент. Получает путь к `.jsx` файлу, компилирует и рендерит.

**Алгоритм:**

1. Прочитать файл через Tauri invoke `read_file`
2. Транспилировать JSX → JS через `sucrase`:
   ```typescript
   import { transform } from 'sucrase';

   const jsCode = transform(jsxCode, {
     transforms: ['jsx', 'imports'],
   }).code;
   ```
3. Создать модуль и выполнить:
   ```typescript
   const module = { exports: {} as any };
   const fn = new Function(
     'module', 'exports', 'React', 'useState', 'useEffect', 'useMemo',
     jsCode
   );
   fn(module, module.exports, React, useState, useEffect, useMemo);
   const DashboardComponent = module.exports.default;
   ```
4. Рендерить `<DashboardComponent entities={...} schedule={...} config={...} />`

**Props передаваемые в каждый дашборд:**

```typescript
interface DashboardProps {
  entities: Entity[];         // все сущности
  schedule: WeekFile | null;  // текущая неделя (может быть null)
  config: Config;             // конфигурация приложения
  allWeeks: WeekFile[];       // все доступные недели (для аналитики)
}
```

**Обработка ошибок:**
- Ошибка компиляции → показать сообщение: "Ошибка в дашборде: [текст ошибки]" + кнопка "Открыть в редакторе"
- Runtime ошибка → ErrorBoundary оборачивает каждый дашборд, при крэше показывает ошибку
- Файл не найден → "Дашборд не найден: [путь]"

### DashboardErrorBoundary.tsx

React ErrorBoundary, оборачивающий DashboardHost:

```tsx
class DashboardErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="error-panel">
          <h3>Ошибка в дашборде</h3>
          <pre>{this.state.error.message}</pre>
          <button onClick={() => this.setState({ error: null })}>
            Попробовать снова
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

---

## Навигация по дашбордам

### DashboardsPage.tsx

Разметка из мока (селекторы `.dash-grid`, `.dcard`):

```
┌───────── hdr (48px) ───────────────────────────┐
│ Дашборды                        [+ Добавить]   │
├─────────── .dash-grid (padding 20) ─────────────┤
│                                                 │
│  ┌────── .dcard ──────┐ ┌──────┐ ┌──────┐ ┌─+─┐ │
│  │ 📊 (.dcard-icon)   │ │ 📅   │ │ 🔄   │ │   │ │
│  │                    │ │      │ │      │ │   │ │
│  │ KPI 2026           │ │ Пла- │ │ Пайп-│ │Доб│ │
│  │ Подписчики, доход  │ │ ны   │ │ лайн │ │   │ │
│  └────────────────────┘ └──────┘ └──────┘ └───┘ │
│    200×130                                      │
└─────────────────────────────────────────────────┘
```

**Карточка `.dcard`:**
- Размер 200×130px, `padding: 16px`, `background: var(--bg-tint-1)`,
  `border: 1px solid var(--border)`, `border-radius: var(--radius-lg)`
- `.dcard-icon` — эмодзи или Lucide-иконка, `--fs-xl`, `margin-
  bottom: 12px`, `opacity: .7`
- `.dcard-title` — название, `--fs-md` 500
- `.dcard-desc` — описание, `--fs-xs`, `--text-tertiary`, margin-top 3
- Hover: `border-color: var(--border-default)`, `transform:
  translateY(-1px)`
- Карточка `«+ Добавить»` — `border-style: dashed`, `opacity: .5`,
  внутри иконка `+` + подпись

**Grid:**
- `display: flex`, `flex-wrap: wrap`, `gap: 12px`, `padding: 20px`
- `align-content: flex-start` — карточки прижаты наверх
- `flex: 1`, `overflow-y: auto`

**Навигация:**
- Клик на карточку → рендерить дашборд в full screen (заменяет grid)
- Кнопка «Назад к списку» в header
- Кнопка «+ Добавить» → формочка: title, описание, загрузить .jsx
  или создать пустой

### DashboardNav.tsx

Breadcrumbs для навигации внутри:
```
Дашборды > KPI 2026
```

---

## Реестр дашбордов

Файл: `data/dashboards/_registry.json`

```json
{
  "dashboards": [
    {
      "id": "kpi",
      "title": "KPI 2026",
      "file": "kpi.jsx",
      "icon": "bar-chart",
      "order": 1,
      "description": "Ключевые метрики: подписчики, просмотры, доход"
    }
  ]
}
```

### CRUD реестра

- **Добавить дашборд:** создать запись в реестре + создать .jsx файл (пустой шаблон или загруженный)
- **Удалить дашборд:** удалить запись из реестра + удалить .jsx файл (с подтверждением)
- **Переименовать:** обновить title в реестре
- **Изменить порядок:** drag-and-drop карточек на странице списка (обновляет `order`)

---

## Стартовые дашборды

Создать 3 дашборда и положить в `data/dashboards/` (или генерировать через seed-скрипт):

### 1. kpi.jsx — KPI 2026

Показывает:
- Карточки с метриками (из entities типа "metric"): YouTube подписчики, TG подписчики, доход
- Прогресс к целям (из entities типа "goal")
- Тренд (↑↓→) на основе history в метриках

### 2. monthly-plans.jsx — Планы по месяцам

Показывает:
- Переключатель месяцев (tabs или кнопки)
- Для каждого месяца: список ключевых задач/проектов с дедлайнами в этом месяце
- Статус: done/in progress/planned
- Из entities с deadline в выбранном месяце

### 3. work-pipeline.jsx — Пайплайн контента

Показывает:
- Kanban-вид стадий пайплайна (research → production → editing → review → publishing → done)
- Карточки проектов (entities типа "project") в соответствующих стадиях
- Можно просто визуализировать, drag-and-drop между стадиями не нужен (это делается через EntityEditor)

---

## Шаблон пустого дашборда

Когда пользователь нажимает "+ Добавить" и выбирает "Создать пустой":

```jsx
export default function NewDashboard({ entities, schedule, config }) {
  return (
    <div style={{ padding: 24, color: '#E2E8F0' }}>
      <h2 style={{ fontSize: 24, marginBottom: 16 }}>Новый дашборд</h2>
      <p>Entities: {entities.length}</p>
      <p>Blocks this week: {schedule?.blocks?.length || 0}</p>
      {/* Отредактируйте этот файл или попросите AI-агента сгенерировать дашборд */}
    </div>
  );
}
```

---

## Стилизация дашбордов

Дашборды не имеют доступа к Tailwind (они компилируются в runtime). Два варианта:

**Вариант 1 (рекомендуемый):** inline styles. Дашборды используют `style={{ ... }}`. Это то, что AI-агент генерирует по умолчанию — он привык к inline styles в артефактах.

**Вариант 2:** использовать CSS-переменные из дизайн-системы,
которые уже объявлены в `globals.css` (см. фазу 1):

Доступные из любого дашборда:

```css
/* Поверхности */
var(--bg-deep) var(--bg-base) var(--bg-surface)
var(--bg-elevated) var(--bg-hover) var(--bg-active)
var(--bg-tint-1) var(--bg-tint-2)

/* Текст */
var(--text-primary) var(--text-secondary) var(--text-tertiary)
var(--text-disabled) var(--text-inverse)

/* Акцент + семантика */
var(--accent)     /* #E0B860 */
var(--success)    /* #30D888 */
var(--error)      /* #E06878 */

/* Категории */
var(--work) var(--people) var(--life) var(--growth) var(--health)

/* Границы и радиусы */
var(--border) var(--border-default) var(--border-strong)
var(--radius-sm) var(--radius-md) var(--radius-lg) var(--radius-xl)

/* Типографика */
var(--fs-2xs) var(--fs-xs) var(--fs-sm) var(--fs-md)
var(--fs-lg) var(--fs-xl) var(--fs-2xl)
var(--font) var(--mono)
```

Дашборд может использовать `style={{ background: 'var(--bg-surface)',
color: 'var(--text-primary)' }}` — и выглядеть консистентно с
остальным приложением.

**Решение:** оба. AI-агент генерирует inline styles (вариант 1), но
может использовать CSS-переменные из дизайн-системы для визуальной
согласованности (вариант 2). Полный список переменных — в
`design/tuzov-os-design-spec.md`.

---

## Hot reload дашбордов

При изменении .jsx файла на диске (агент обновил или пользователь отредактировал) — дашборд должен перерисоваться.

**Реализация:**
- File watcher на папку `data/dashboards/` (тот же механизм что для commands)
- При изменении файла → отправить Tauri event `dashboard-changed`
- DashboardHost слушает событие → перечитать и перекомпилировать файл

---

## Критерии готовности

- [ ] Страница дашбордов показывает grid карточек из реестра
- [ ] Клик на карточку → дашборд рендерится
- [ ] Ошибки компиляции/runtime показываются без крэша приложения
- [ ] Три стартовых дашборда работают с реальными данными
- [ ] Добавление нового дашборда (пустой шаблон)
- [ ] Удаление дашборда
- [ ] Props (entities, schedule, config) корректно передаются
- [ ] Hot reload при изменении .jsx файла на диске
- [ ] CSS-переменные тёмной темы доступны в дашбордах
