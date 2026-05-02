# PoolItem.placed — расхождение persisted vs derived

> **Статус:** отложено. Решить во время Phase 9 cleanup или раньше,
> если AI-агент начнёт активно читать pool.json.

## Что не так

Атомарный pool item имеет поле `placed: boolean` в `PoolItemSchema`.
На диске оно живёт между сессиями. В UI же `placed` пересчитывается
налету через `recalcPool` (services/recalc-pool.ts:32):

```ts
return { ...pi, scheduled, placed: linked.length > 0 };
```

Это значит: на диске лежит `placed: false`, в `PoolItemView` (то что
видит UI) — `placed: true`. Расхождение, которое не ломает UX
(юзер всегда видит правильное состояние через recalcPool), но
агент, читающий `data/pool/<week>.json` напрямую, увидит ложь.

## Когда заболит

- Агент анализирует pool офлайн (например, считает «сколько
  атомарных не разместили»). Получит неверное число.
- Команда `update_pool_item` патчит item с `placed: true` —
  бессмысленно, всё равно перетрётся следующим recalcPool.
- Любая логика, рассчитанная на диск как источник правды для
  `placed`.

## Варианты

### A. Удалить `placed` из persisted shape

Снять поле из `PoolItemSchema`. Хранить только `splittable`,
`hours`, `source_entity_id`, `source_kind`. recalcPool остаётся
единственным источником истины. Минимальная инвазивность.

Риск: миграция старых файлов — Zod упадёт на полях, которых нет в
схеме. Решается `looseObject` или явной миграцией. Лучший вариант
для Phase 9.

### B. Синхронизировать persisted `placed` через подписку

В pool store держать subscribe на schedule.blocks. После каждого
изменения blocks — пересчитать `placed` для всех атомарных items
и записать pool.json. Но тогда схема и derived пересчёт сходятся.

Риск: пишем pool.json часто (на каждую перетяжку блока).
recalcPool — pure, persisted сейчас НЕ обновляется. Изменение
семантики вызовет лавину писем.

### C. Оставить как есть, задокументировать

Расхождение явно описано в комментарии recalc-pool.ts. Агенту в
prompt'е объяснить: «`placed` на диске — последний явно записанный
снапшот. Текущее состояние выводится через recalcPool». Минимальный
труд, но боль для агента.

## Рекомендация

**A в Phase 9.** В Phase 6 оставляем как есть. В рамках текущей
сессии (только UI) расхождение незаметно.

## Связанные файлы

- `src/services/recalc-pool.ts` — `recalcPool` (источник derived)
- `src/schemas/pool.ts` — `PoolItemSchema` (поле, которое надо
  убрать в варианте A)
- `src/store/pool.ts` — addItem/updateItem (создают с `placed: false`)
- `src/services/pool-actions.ts` — applyToPoolWeek
- ai-review Phase 6 finding H5 (Claude general-purpose agent)
