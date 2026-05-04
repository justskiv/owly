# TuzovOS

Десктопное приложение на Tauri v2 + React 19 + TypeScript. Персональный
центр управления: недельный планировщик, сущности с тегами, дашборды,
очередь команд для AI-агента.

Спецификация — в `spec/tuzov-os/`. Дизайн-система — в `design/`.

v2 переархитектура завершена: фазы 1–9 в
`spec/tuzov-os/v2/phases/`. Top nav из 6 экранов (Plan / Tasks /
Projects / Context / Horizon / Review), Quick Add по `Cmd+N`,
AI-агент через очередь команд (`docs/api/commands-api.md`). Спеки
v1 — в `spec/tuzov-os/done/`. Cmd+Shift+E / Cmd+Shift+D — debug-
входы к v1 EntitiesPage / DashboardsPage (per Phase 9 D1/D2).
Активные доработки поверх v2 — `post-review-backlog.md` рядом с
фазами.

## Workflow перед нетривиальной работой

1. `spec/tuzov-os/00-overview.md` — общая картина
2. `spec/tuzov-os/01-data-schema.md` — схемы данных
3. `spec/tuzov-os/02-architecture.md` — архитектура
4. Релевантная спека: активная доработка либо номерная фаза
   (`05-…`–`08-…` для 3–6, `done/03-…`–`done/04-…` для 1–2)
5. Покажи план реализации **до** старта работы

После завершения:

- Пройдись по чеклисту в конце спеки
- Прогони `task check` (typecheck + vitest + frontend build)
- Длительный `task dev` / `npm run tauri dev` запускает юзер сам —
  жди smoke от него перед коммитом UX-изменений
- Сообщи, что готово, дождись пока заберу

## Принципы реализации

- Спека — закон. Не добавляй фич, которых в спеке нет
- Не делай заглушек: если спека требует компонент — реализуй полностью
- Все данные — JSON в `data/` (включая `data/commands/{pending,done,
  failed}/` для очереди агента — отклонение от исходной спеки, теперь
  всё user-state в одной папке). Никаких баз
- Zod-схемы — источник правды для типов: сначала схема, потом код
- Валидация через Zod при каждом чтении файла; запись через
  `writeJsonFile` → Rust `write_file` (temp + rename, атомарно)
- Тёмная тема — единственная
- State — Zustand stores по одному на срез (`schedule`, `entities`,
  `config`, `dashboards`, `commands`, `ui`); auto-save через подписку
- Стили — semantic CSS-классы из `design/tuzov-os-design-mock.html`
  поверх токенов в `src/styles/globals.css`. Tailwind подключён
  плагином, но утилитарные классы в компонентах не используем —
  миграция отложена (`docs/tasks/tailwind-migration.md`)

## Стиль кода

- TypeScript strict mode
- Функциональные компоненты с хуками
- Имена файлов: `PascalCase` для компонентов, `camelCase` для утилит
- **Код, идентификаторы И комментарии — строго на английском.**
  Без исключений. Русский только в UI-строках, которые видит юзер
  (лейблы кнопок, тексты страниц, `title=`), плюс планы/задачи/чат/
  Markdown-доки
- Без лишних абстракций. Простой код лучше «правильного»

Подробные принципы и анти-паттерны — в `CODESTYLE.md`. Каждое правило
оттуда связано с реальным кейсом ревью. В обсуждении PR — ссылаться
номером пункта.

## AI-агент / очередь команд

Внешний клиент пишет в `data/commands/pending/<id>.json`, watcher
исполняет, перемещает в `done/` или `failed/`. Полный reference
действий, схем и примеров — `docs/api/commands-api.md`. Source of
truth для схем — `src/schemas/command.ts`.