# R1 Phase 2 — Easy + Cosmetic

> **Pre-flight:** прочитай `../PRE-FLIGHT.md` ПЕРЕД стартом.
> Re-grep `path:line` перед каждой правкой.

## Контекст

Лёгкие правки которые не блокируют release, но снимают
накопленный мелкий tech debt: документация vs код drift,
defensive durability в Rust, schema-tightening в местах где
это улучшает agent UX без breaking change.

Каждая правка — независимая. Можно делать по одной или одним
коммитом «cosmetic polish».

## Scope

| # | Severity | Path:line | Задача | Effort |
|---|---|---|---|---|
| 1 | low | `docs/api/commands-api.md` (несколько мест) | Drift fixes: (a) §3 явно «zero-pad numeric prefix or ISO datetime, otherwise lexicographic order breaks»; (b) §5.5 `apply_template`: «сейчас единственный поддерживаемый — `"default"`, schema reject иначе»; (c) добавить заметку «category не валидируется против config.areas — неизвестная область даст серый dot, by-design»; (d) §5.5 `data.type` обязателен для `create_entity`. | XS |
| 2 | medium | `src/services/recalc-pool.ts:22-26` | Pre-compute valid pool item ids set. Suppress source_entity_id fallback ТОЛЬКО когда `b.pool_item_id` указывает на ДРУГОЙ существующий pool item. Сейчас orphan-link молча отрубает entity-link fallback. | S |
| 3 | medium | `src/services/command-executor.ts:228-275` (`update_pool_item`) | Strip `splittable`, `source_entity_id`, `source_kind`, `placed` из patch (identity-fields). Зеркало `update_entity` strip pattern. Защита: если агент `splittable: true → false` на placed item — `placed` flag сохраняется как stale. | XS |
| 4 | medium | `src/schemas/common.ts:65-77` (`weekId()`) | Сейчас refine проверяет `01..53` без учёта года. Расширить: для w=53 — accept только если `getISOWeeksInYear(year)` === 53 (helper из date-fns). Предотвращает hand-edited `2025-w53` (которой нет → `getWeekStartDate("2025-w53")` уезжает в `2026-w01`). Тест: `2020-w53` (long year, accept), `2021-w53` (reject), `2025-w53` (reject), `2026-w53` (accept если long). | S |
| 5 | low | `src/services/horizon-reconcile.ts:22` | Normalize duplicate `project_id` rows на load/reconcile (preserve first, merge remaining months/sizes/hidden). Persist deduped list. | S |
| 6 | low | `src-tauri/src/commands/files.rs:51-65` (`write_file`) | После `fs::rename(tmp, target)` добавить `if let Some(parent) = target.parent() { let _ = fs::File::open(parent).and_then(\|f\| f.sync_all()); }`. Cheap durability bump. | XS |
| 7 | medium | `src/hooks/useReviewData.ts:52-73` | Для year-tab limit concurrency at ~8 (chunked Promise.all через простой helper). Cold start tab switch сейчас стартует 51 параллельных bundle loads → IPC burst. Кэш warm после первого вызова, но первый стрейн заметный. | XS |

## Шаги реализации

1. Правки независимые — можно делать в любом порядке.
2. Один коммит `chore(v2/r1): cosmetic polish + documentation drift`.
3. После — `task check` зелёный.
4. Smoke: один agent batch с правильными commands → all done/, batch с invalid week-53 → reject, dev tools → пара durable rename'ов прошла.

## Acceptance criteria

- [ ] `docs/api/commands-api.md` отражает реальное поведение для filename-ordering, apply_template, category, type
- [ ] update_pool_item с патчем `{ splittable: true }` на placed atomic — silent strip, без эффекта на `placed` flag (или toast.warn)
- [ ] weekId schema reject для `"2025-w53"` (52 недель в 2025) и accept для `"2026-w53"` (если 53)
- [ ] horizon.json с двумя `project_id: "X"` — после reconcile один row, months merged
- [ ] Rust write_file fsync parent в strace/dtrace (опционально, или просто visual review)
- [ ] year tab открыть на холодном кэше — нет визуального freeze

## Smoke

- [ ] agent batch из 5 commands с timestamps `1`, `2`, `10`, `11`, `100` без zero-pad → они исполнятся в неправильном порядке (документ говорит почему)
- [ ] agent command `create_pool_item { week: "2025-w53" }` → fail/ с понятным message (после fix #4)
- [ ] hand-edit `data/horizon.json` чтобы было два rows одного project_id, перезапуск приложения → `task check` + посмотреть что в файле один row (нужно знать project_id для проверки)
- [ ] Year tab → дёрнуть несколько раз — не должно быть Tauri IPC ошибок «too many concurrent invokes»

## Ловушки

- **R1 (#3 update_pool_item strip).** После strip — если patch состоял ТОЛЬКО из identity-полей — `foundCount > 0`, но patch пустой. Тест: проверить что not-throws, и что file не пере-пишется бесполезно.
- **R2 (#4 week-53 refine).** date-fns `getISOWeeksInYear` принимает Date, не number. Преобразовать `parseWeekId(s).year` → `new Date(year, 0, 4)` сначала. Тест на `2020-w53` (long year, валидно), `2021-w53` (short year, должно reject).
- **R3 (#5 horizon dedupe).** При merge — что делать если два row имеют разные `size` ("big" vs "mid")? Take first (lower index). Документировать в комментарии.
- **R4 (#6 fsync parent).** На macOS APFS fsync файла уже вытягивает rename за журнал, но это не гарантия. Cheap defensive — оставить.

## Что НЕ включает

- Расширение action coverage (move_pool_item, apply_template existing, delete_week, set_horizon_base_month) — отдельный backlog (или Phase 4)
- File permissions Unix `0700`/`0600` — defer (single-user macOS, low risk)
- done/ retention cleanup — Phase 4
- Versioned file migrators — Phase 4
