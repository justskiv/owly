# Фаза 5: Dashboards

> **Цель:** система динамического рендеринга дашбордов + стартовый набор витрин.
>
> **Результат:** страница Dashboards показывает список дашбордов, клик открывает дашборд. Дашборды — .jsx файлы, генерируемые AI-агентом или написанные руками. Приложение компилирует и рендерит их в runtime.
>
> **Предусловие:** Фазы 1-4 завершены.

## Контекст

Прочитай `01-data-schema.md` (раздел 5 — дашборды, реестр), `02-architecture.md` (раздел "Дашборды: динамический рендеринг").

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

```
┌──────────────────────────────────────────────────────┐
│ Дашборды                                [+ Добавить] │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │ 📊 KPI   │  │ 📅 Планы │  │ 🔄 Пайп- │          │
│  │ 2026     │  │ по меся- │  │ лайн     │          │
│  │          │  │ цам      │  │          │          │
│  └──────────┘  └──────────┘  └──────────┘          │
│                                                      │
└──────────────────────────────────────────────────────┘
```

- Grid карточек дашбордов из реестра
- Клик на карточку → рендерить дашборд в full screen (заменяет grid)
- Кнопка "Назад к списку" в header
- Кнопка "+ Добавить" → формочка: title, описание, загрузить .jsx или создать пустой

### DashboardNav.tsx

Tabs или breadcrumbs для навигации между дашбордами:
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

**Вариант 2:** предоставить CSS-переменные для тёмной темы:
```css
:root {
  --bg-primary: #0F172A;
  --bg-card: #1E293B;
  --text-primary: #E2E8F0;
  --text-secondary: #94A3B8;
  --accent: #3B82F6;
}
```

Дашборды могут использовать `var(--bg-card)` в своих стилях. Это обеспечит консистентный вид.

**Решение:** оба. CSS-переменные объявляются в globals.css, дашборды могут их использовать или игнорировать.

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
