# Доработать дефолты часов при добавлении в пул

> **Статус:** отложено. В Phase 6 захардкожено 1ч / 4ч / 2ч / 4ч —
> по букве спеки v2 §4.6. Пора подумать, как сделать это умнее.

## Что сейчас

Toggle «→ В пул» в табе сайдбара выставляет фиксированные часы:

| Источник | Hours | Splittable | Где |
|---|---|---|---|
| Task (таб «Задачи») | **1ч** | false (атомарный) | `src/components/planner/pool/PoolTabTasks.tsx` (togglePool) |
| Project (таб «Проекты») | **4ч** | true (дробимый) | `src/components/planner/pool/PoolTabProjects.tsx` (togglePool) |
| Direction без linked projects | **2ч** | true | `src/components/planner/pool/PoolTabContext.tsx` (togglePool, ветка empty linked) |
| Direction с linked projects | **4ч** | true (на самый свежий project) | там же, ветка freshest |
| Pool item напрямую (modal «В пул недели») | юзер вводит | юзер выбирает | `src/components/planner/PoolAddModal.tsx` |

Цифры — из спеки `spec/tuzov-os/v2/spec.md` §4.6. Не вычисляются из
полей entity. У `task` есть `estimated_minutes` (nullable), но он
игнорируется. У `project` похожего поля нет.

## Что не так

- **Несоответствие реальности.** «Купить корм» и «Переписать
  бэкенд» обе попадают в пул как 1ч задача. Получается дешёвая
  оценка, юзер всё равно потом резайзит блок руками.
- **Нет наследования из entity.** Если юзер уже думал и поставил
  `estimated_minutes`, мы это игнорируем. Двойная работа.
- **Слабая дифференциация для проектов.** Проекту «Доделать сайт»
  и «Переписать архитектуру» одинаковые 4ч в пуле. Реальные часы
  обычно сильно разные.
- **Direction'ы — слишком прямолинейно.** 2ч/4ч взято из мока без
  объяснения. Может быть, для cadence-направлений (ритуал) логичнее
  30 минут, а для measurable — больше.

## Варианты решения

### A. Honor `estimated_minutes` если задано

Минимальная доработка: для tasks использовать `task.estimated_minutes`
если оно set, иначе fallback 1ч. Для projects — добавить такое же
поле в `ProjectFieldsSchema` и использовать его. Для directions —
аналогично.

Плюсы:
- Юзер уже привык указывать estimated в Quick Add (`!1ч`, `!30м` —
  если такие модификаторы добавим)
- Никаких новых UI

Минусы:
- Только для tasks готово; project/direction требуют расширения
  схемы и UI
- Если поле не указано — всё равно дефолт нужен

### B. Дефолты в `config.json`

Добавить секцию:
```json
"pool_defaults": {
  "task_hours": 1,
  "project_hours": 4,
  "direction_hours": 2,
  "direction_with_projects_hours": 4
}
```

Юзер настраивает один раз через Settings. Дефолты применяются всегда.

Плюсы:
- Гибко
- Не требует менять entity-схему
- Уже паттерн `config.areas` — последователен

Минусы:
- Всё ещё «один размер для всех» внутри типа

### C. Спросить часы при добавлении

Кликнул «→» → миниатюрный popover «Сколько часов?» с дефолтом из
B/A и input. Enter — добавил.

Плюсы:
- Самый точный
- Юзер задумывается о реальной оценке

Минусы:
- Дороже UX (доп. клик)
- Может надоесть

### D. Гибрид: B + быстрая правка в самом pool item

Дефолты из config, НО: hours в pool item редактируется inline
(клик по «12ч» в карточке pool item → input → Enter сохраняет).
Сейчас редактирования нет — только удаление через ×.

Плюсы:
- Быстрый дефолт + быстрая правка
- Не блокирует «положил-забыл-потом-довёл» workflow

Минусы:
- Нужен inline editor в pool item

## Рекомендация (когда дойдут руки)

**A + D** в комбинации:
1. Если у entity есть `estimated_minutes` — использовать.
2. Иначе — фиксированный fallback (как сейчас, или из config).
3. На pool item — inline edit hours по клику.

Расширение `estimated_minutes` на projects/directions — отдельная
маленькая задача (обновить схему + popup'ы редактирования).

## Что НЕ делать

- **C** в чистом виде** — всплывающий popover при каждом toggle
  быстро надоест. Если уж модалить, то только при первом добавлении
  типа сущности (с галочкой «не спрашивать больше»).
- Брать оценку из истории (среднее время блоков с этим
  source_entity_id) — слишком сложная эвристика для скромной
  доработки.

## Связанные файлы

- `src/components/planner/pool/PoolTabTasks.tsx` — togglePool
- `src/components/planner/pool/PoolTabProjects.tsx` — togglePool
- `src/components/planner/pool/PoolTabContext.tsx` — togglePool
- `src/schemas/entity.ts` — TaskFields/ProjectFields/DirectionFields
- `src/schemas/config.ts` — Config (для варианта B)
- `src/store/config.ts` — если добавим pool_defaults
- `spec/tuzov-os/v2/spec.md` §4.6 — спецификация (придётся
  обновить, чтобы дефолты не противоречили коду)